// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice A public AAPLc escrow released by a one-time, high-entropy secret.
/// @dev This is NOT a ZK/private transfer pool. Deposits and withdrawals are public.
contract AppleVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant BASE_AAPLC = 0xb200000000000000000000C2e324d24d7eEcd1fb;
    uint256 public constant RECLAIM_DELAY = 90 days;
    IERC20 public immutable asset;
    uint256 public totalLocked;

    struct Note {
        address depositor;
        address recipient;
        uint256 amount;
        uint256 reclaimAfter;
    }

    mapping(bytes32 => Note) public notes;
    mapping(bytes32 => bool) public usedCommitments;

    error WrongMainnetAsset();
    error InvalidDeposit();
    error UnsupportedTokenBehavior();
    error NoteMissing();
    error NotDepositor();
    error TooEarly();

    event Deposited(bytes32 indexed commitment, address indexed depositor, address indexed recipient, uint256 amount, uint256 reclaimAfter);
    event Withdrawn(bytes32 indexed commitment, address indexed recipient, uint256 amount);
    event Reclaimed(bytes32 indexed commitment, address indexed depositor, uint256 amount);

    constructor(IERC20 asset_) {
        if (address(asset_) == address(0)) revert InvalidDeposit();
        if (block.chainid == 8453 && address(asset_) != BASE_AAPLC) revert WrongMainnetAsset();
        asset = asset_;
    }

    /// @param commitment keccak256(abi.encode(secret, recipient, address(this), block.chainid)).
    /// @dev Compute locally. Never transmit the secret to an RPC provider before withdrawal.
    function deposit(uint256 amount, address recipient, bytes32 commitment) external nonReentrant {
        if (amount == 0 || recipient == address(0) || commitment == bytes32(0) || usedCommitments[commitment]) {
            revert InvalidDeposit();
        }
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();

        uint256 reclaimAfter = block.timestamp + RECLAIM_DELAY;
        usedCommitments[commitment] = true;
        notes[commitment] = Note(msg.sender, recipient, amount, reclaimAfter);
        totalLocked += amount;
        emit Deposited(commitment, msg.sender, recipient, amount, reclaimAfter);
    }

    /// @notice Anyone may submit the secret; payout always goes to the recipient fixed at deposit.
    function withdraw(bytes32 secret, address recipient) external nonReentrant {
        bytes32 commitment = keccak256(abi.encode(secret, recipient, address(this), block.chainid));
        Note memory note = notes[commitment];
        if (note.amount == 0 || note.recipient != recipient) revert NoteMissing();
        delete notes[commitment];
        totalLocked -= note.amount;
        asset.safeTransfer(recipient, note.amount);
        emit Withdrawn(commitment, recipient, note.amount);
    }

    /// @notice Depositor can recover an unclaimed note after 90 days.
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
