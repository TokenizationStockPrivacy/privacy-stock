// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FeeManager} from "./FeeManager.sol";
import {RewardsVault} from "./RewardsVault.sol";

/// @notice Public one-time-secret escrow that sends 100% of actual deposit fees to RewardsVault.
/// @dev Depositor, recipient, amount, and fee are visible. This is not a private ZK pool.
contract AppleFeeVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant BASE_AAPLC = 0xb200000000000000000000C2e324d24d7eEcd1fb;
    uint256 public constant RECLAIM_DELAY = 90 days;
    IERC20 public immutable asset;
    FeeManager public immutable feeManager;
    RewardsVault public immutable rewardsVault;
    uint256 public totalLocked;

    struct Note {
        address depositor;
        address recipient;
        uint256 amount;
        uint256 reclaimAfter;
    }
    mapping(bytes32 => Note) public notes;
    mapping(bytes32 => bool) public usedCommitments;

    error InvalidConfig();
    error InvalidDeposit();
    error FeeExceeded();
    error UnsupportedTokenBehavior();
    error NoteMissing();
    error NotDepositor();
    error TooEarly();

    event Deposited(bytes32 indexed commitment, address indexed depositor, address indexed recipient, uint256 inputAmount, uint256 feeAmount, uint256 netAmount, uint256 reclaimAfter);
    event Withdrawn(bytes32 indexed commitment, address indexed recipient, uint256 amount);
    event Reclaimed(bytes32 indexed commitment, address indexed depositor, uint256 amount);

    constructor(IERC20 asset_, FeeManager feeManager_, RewardsVault rewardsVault_) {
        if (address(asset_) == address(0) || address(feeManager_) == address(0) || address(rewardsVault_) == address(0)) revert InvalidConfig();
        if (block.chainid == 8453 && address(asset_) != BASE_AAPLC) revert InvalidConfig();
        if (address(feeManager_.token()) != address(asset_) || address(rewardsVault_.asset()) != address(asset_)) revert InvalidConfig();
        asset = asset_;
        feeManager = feeManager_;
        rewardsVault = rewardsVault_;
    }

    /// @param commitment keccak256(abi.encode(secret, recipient, address(this), block.chainid)).
    /// @param maxFee Max token units the depositor authorizes for this deposit.
    function deposit(uint256 amount, address recipient, bytes32 commitment, uint256 maxFee) external nonReentrant {
        if (amount == 0 || recipient == address(0) || commitment == bytes32(0) || usedCommitments[commitment]) revert InvalidDeposit();
        (uint256 fee,,,,,) = feeManager.quote(amount);
        if (fee > maxFee || fee >= amount) revert FeeExceeded();

        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
        if (fee != 0) {
            asset.forceApprove(address(rewardsVault), fee);
            rewardsVault.fundFees(fee);
            asset.forceApprove(address(rewardsVault), 0);
        }

        uint256 net = amount - fee;
        uint256 reclaimAfter = block.timestamp + RECLAIM_DELAY;
        usedCommitments[commitment] = true;
        notes[commitment] = Note(msg.sender, recipient, net, reclaimAfter);
        totalLocked += net;
        emit Deposited(commitment, msg.sender, recipient, amount, fee, net, reclaimAfter);
    }

    function withdraw(bytes32 secret, address recipient) external nonReentrant {
        bytes32 commitment = keccak256(abi.encode(secret, recipient, address(this), block.chainid));
        Note memory note = notes[commitment];
        if (note.amount == 0 || note.recipient != recipient) revert NoteMissing();
        delete notes[commitment];
        totalLocked -= note.amount;
        asset.safeTransfer(recipient, note.amount);
        emit Withdrawn(commitment, recipient, note.amount);
    }

    function reclaim(bytes32 commitment) external nonReentrant {
        Note memory note = notes[commitment];
        if (note.amount == 0) revert NoteMissing();
        if (msg.sender != note.depositor) revert NotDepositor();
        if (block.timestamp < note.reclaimAfter) revert TooEarly();
        delete notes[commitment];
        totalLocked -= note.amount;
        asset.safeTransfer(note.depositor, note.amount);
        emit Reclaimed(commitment, note.depositor, note.amount);
    }
}
