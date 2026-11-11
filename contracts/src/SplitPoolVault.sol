// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FeeManager} from "./FeeManager.sol";
import {RewardsVaultV2} from "./RewardsVaultV2.sol";

/// @notice A public AAPLc balance pool that can be split into many fixed-recipient, one-time-code notes.
/// @dev Amounts, owners, recipients, and redemptions are public. This is not a private or ZK pool.
contract SplitPoolVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant BASE_AAPLC = 0xb200000000000000000000C2e324d24d7eEcd1fb;
    uint256 public constant RECLAIM_DELAY = 90 days;
    uint256 public constant MAX_BATCH_SIZE = 100;
    IERC20 public immutable asset;
    FeeManager public immutable feeManager;
    RewardsVaultV2 public immutable rewardsVault;

    uint256 public totalPoolBalance;
    uint256 public totalLocked;
    uint256 public pendingFees;
    mapping(address => uint256) public poolBalance;

    struct Note {
        address depositor;
        address recipient;
        uint256 amount;
        uint256 reclaimAfter;
    }
    mapping(bytes32 => Note) public notes;
    mapping(bytes32 => bool) public usedCommitments;

    error InvalidConfig();
    error InvalidAmount();
    error InvalidNote();
    error InvalidBatch();
    error InsufficientPoolBalance();
    error FeeExceeded();
    error UnsupportedTokenBehavior();
    error NoteMissing();
    error NotDepositor();
    error TooEarly();
    error RewardsUnavailable();

    event PoolDeposited(address indexed user, uint256 amount, uint256 balance);
    event PoolWithdrawn(address indexed user, uint256 amount, uint256 balance);
    event NoteCreated(bytes32 indexed commitment, address indexed depositor, address indexed recipient, uint256 grossAmount, uint256 feeAmount, uint256 netAmount, uint256 reclaimAfter);
    event NoteRedeemed(bytes32 indexed commitment, address indexed recipient, uint256 amount);
    event NoteReclaimed(bytes32 indexed commitment, address indexed depositor, uint256 amount, uint256 poolBalance);
    event FeesFlushed(uint256 amount);

    constructor(IERC20 asset_, FeeManager feeManager_, RewardsVaultV2 rewardsVault_) {
        if (address(asset_) == address(0) || address(feeManager_) == address(0) || address(rewardsVault_) == address(0)) revert InvalidConfig();
        if (block.chainid == 8453 && address(asset_) != BASE_AAPLC) revert InvalidConfig();
        if (address(feeManager_.token()) != address(asset_) || address(rewardsVault_.asset()) != address(asset_)) revert InvalidConfig();
        asset = asset_;
        feeManager = feeManager_;
        rewardsVault = rewardsVault_;
    }

    function depositToPool(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
        poolBalance[msg.sender] += amount;
        totalPoolBalance += amount;
        emit PoolDeposited(msg.sender, amount, poolBalance[msg.sender]);
    }

    function withdrawFromPool(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 balance = poolBalance[msg.sender];
        if (amount > balance) revert InsufficientPoolBalance();
        poolBalance[msg.sender] = balance - amount;
        totalPoolBalance -= amount;
        asset.safeTransfer(msg.sender, amount);
        emit PoolWithdrawn(msg.sender, amount, poolBalance[msg.sender]);
    }

    /// @param grossAmount Amount removed from the depositor's pool balance. The fee is deducted from it.
    /// @param commitment keccak256(abi.encode(secret, recipient, address(this), block.chainid)).
    /// @param maxFee Maximum token units authorized as the fee.
    function createNote(uint256 grossAmount, address recipient, bytes32 commitment, uint256 maxFee) external nonReentrant {
        _createNote(msg.sender, grossAmount, recipient, commitment, maxFee);
        _flushIfPossible();
    }

    /// @notice Atomically creates as many as 100 independent notes from one pool balance.
    /// @dev Every array index describes one note. Each note has its own amount, recipient, commitment, and fee limit.
    function createNotes(
        uint256[] calldata grossAmounts,
        address[] calldata recipients,
        bytes32[] calldata commitments,
        uint256[] calldata maxFees
    ) external nonReentrant {
        uint256 length = grossAmounts.length;
        if (
            length == 0 || length > MAX_BATCH_SIZE || recipients.length != length
                || commitments.length != length || maxFees.length != length
        ) revert InvalidBatch();
        for (uint256 i; i < length; ++i) {
            _createNote(msg.sender, grossAmounts[i], recipients[i], commitments[i], maxFees[i]);
        }
        _flushIfPossible();
    }

    function _createNote(address depositor, uint256 grossAmount, address recipient, bytes32 commitment, uint256 maxFee) internal {
        if (grossAmount == 0 || recipient == address(0) || commitment == bytes32(0) || usedCommitments[commitment]) revert InvalidNote();
        uint256 balance = poolBalance[depositor];
        if (grossAmount > balance) revert InsufficientPoolBalance();
        (uint256 fee,,,,,) = feeManager.quote(grossAmount);
        if (fee > maxFee || fee >= grossAmount) revert FeeExceeded();

        uint256 net = grossAmount - fee;
        uint256 reclaimAfter = block.timestamp + RECLAIM_DELAY;
        poolBalance[depositor] = balance - grossAmount;
        totalPoolBalance -= grossAmount;
        pendingFees += fee;
        totalLocked += net;
        usedCommitments[commitment] = true;
        notes[commitment] = Note(depositor, recipient, net, reclaimAfter);
        emit NoteCreated(commitment, depositor, recipient, grossAmount, fee, net, reclaimAfter);
    }

    function _flushIfPossible() internal {
        // Transfers never pause. Fees wait safely in this contract until an Earn position exists.
        if (pendingFees != 0 && rewardsVault.totalPrincipal() != 0) _flushFees();
    }

    function flushFees() external nonReentrant {
        if (pendingFees == 0 || rewardsVault.totalPrincipal() == 0) revert RewardsUnavailable();
        _flushFees();
    }

    function _flushFees() internal {
        uint256 amount = pendingFees;
        pendingFees = 0;
        asset.forceApprove(address(rewardsVault), amount);
        rewardsVault.fundFees(amount);
        asset.forceApprove(address(rewardsVault), 0);
        emit FeesFlushed(amount);
    }

    function redeem(bytes32 secret, address recipient) external nonReentrant {
        bytes32 commitment = keccak256(abi.encode(secret, recipient, address(this), block.chainid));
        Note memory note = notes[commitment];
        if (note.amount == 0 || note.recipient != recipient) revert NoteMissing();
        delete notes[commitment];
        totalLocked -= note.amount;
        asset.safeTransfer(recipient, note.amount);
        emit NoteRedeemed(commitment, recipient, note.amount);
    }

    /// @notice After 90 days, returns an unredeemed note's net amount to its depositor's pool balance.
    function reclaim(bytes32 commitment) external nonReentrant {
        Note memory note = notes[commitment];
        if (note.amount == 0) revert NoteMissing();
        if (msg.sender != note.depositor) revert NotDepositor();
        if (block.timestamp < note.reclaimAfter) revert TooEarly();
        delete notes[commitment];
        totalLocked -= note.amount;
        poolBalance[note.depositor] += note.amount;
        totalPoolBalance += note.amount;
        emit NoteReclaimed(commitment, note.depositor, note.amount, poolBalance[note.depositor]);
    }
}
