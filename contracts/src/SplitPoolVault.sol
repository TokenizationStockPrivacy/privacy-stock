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
        if (grossAmount == 0 || recipient == address(0) || commitment == bytes32(0) || usedCommitments[commitment]) revert InvalidNote();
        uint256 balance = poolBalance[msg.sender];
        if (grossAmount > balance) revert InsufficientPoolBalance();
        (uint256 fee,,,,,) = feeManager.quote(grossAmount);
        if (fee > maxFee || fee >= grossAmount) revert FeeExceeded();

        uint256 net = grossAmount - fee;
        uint256 reclaimAfter = block.timestamp + RECLAIM_DELAY;
        poolBalance[msg.sender] = balance - grossAmount;
        totalPoolBalance -= grossAmount;
        pendingFees += fee;
        totalLocked += net;
        usedCommitments[commitment] = true;
        notes[commitment] = Note(msg.sender, recipient, net, reclaimAfter);
        emit NoteCreated(commitment, msg.sender, recipient, grossAmount, fee, net, reclaimAfter);

        // Transfers never pause. Fees wait safely in this contract until an Earn position exists.
        if (fee != 0 && rewardsVault.totalPrincipal() != 0) _flushFees();
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
