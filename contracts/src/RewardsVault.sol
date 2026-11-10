// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Allocates actual incoming AAPL-denominated fees to eligible deposits.
/// @dev Fee collector must aggregate private fees before funding, or individual funding reveals them.
contract RewardsVault is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;
    error ZeroAmount();
    error FeeTooSmall();
    error NotEligible();
    error UnauthorizedCollector();
    error InsufficientShares();
    error UnsupportedToken();

    uint256 private constant SCALE = 1e27;
    uint256 public constant ACTIVATION_DELAY = 1 days;
    IERC20 public immutable asset;
    address public collector;
    uint256 public totalPrincipal;
    uint256 public eligiblePrincipal;
    uint256 public accRewardPerShare;
    uint256 public totalFeesReceived;
    uint256 public totalRewardsPaid;

    struct Position {
        uint256 pending;
        uint256 eligible;
        uint256 unlockAt;
        uint256 rewardDebt;
        uint256 accrued;
    }
    mapping(address => Position) public positions;

    event CollectorChanged(address indexed previous, address indexed current);
    event Deposited(address indexed user, uint256 amount, uint256 unlockAt);
    event Activated(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event FeesAllocated(uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);

    constructor(IERC20 asset_, address owner_, address collector_) Ownable(owner_) {
        if (address(asset_) == address(0) || collector_ == address(0)) revert UnsupportedToken();
        asset = asset_;
        collector = collector_;
    }

    function setCollector(address next) external onlyOwner {
        if (next == address(0)) revert UnauthorizedCollector();
        emit CollectorChanged(collector, next);
        collector = next;
    }

    function _accrue(Position storage p) internal {
        uint256 earned = Math.mulDiv(p.eligible, accRewardPerShare, SCALE);
        p.accrued += earned - p.rewardDebt;
        p.rewardDebt = earned;
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Position storage p = positions[msg.sender];
        _accrue(p);
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedToken();
        p.pending += amount;
        p.unlockAt = block.timestamp + ACTIVATION_DELAY;
        totalPrincipal += amount;
        emit Deposited(msg.sender, amount, p.unlockAt);
    }

    function activate() external nonReentrant {
        Position storage p = positions[msg.sender];
        if (p.pending == 0 || block.timestamp < p.unlockAt) revert NotEligible();
        _accrue(p);
        uint256 amount = p.pending;
        p.pending = 0;
        p.eligible += amount;
        eligiblePrincipal += amount;
        p.rewardDebt = Math.mulDiv(p.eligible, accRewardPerShare, SCALE);
        emit Activated(msg.sender, amount);
    }

    function fundFees(uint256 amount) external nonReentrant {
        if (msg.sender != collector) revert UnauthorizedCollector();
        if (amount == 0) revert ZeroAmount();
        if (eligiblePrincipal == 0) revert NotEligible();
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedToken();
        totalFeesReceived += amount;
        // Fractional entitlements remain in accRewardPerShare until later funding.
        // Rolling integer dust separately would credit those fractions twice.
        uint256 increment = Math.mulDiv(amount, SCALE, eligiblePrincipal);
        if (increment == 0) revert FeeTooSmall();
        accRewardPerShare += increment;
        emit FeesAllocated(amount);
    }

    function claim() external nonReentrant returns (uint256 amount) {
        Position storage p = positions[msg.sender];
        _accrue(p);
        amount = p.accrued;
        if (amount == 0) return 0;
        p.accrued = 0;
        totalRewardsPaid += amount;
        asset.safeTransfer(msg.sender, amount);
        emit RewardClaimed(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Position storage p = positions[msg.sender];
        _accrue(p);
        uint256 fromPending = amount < p.pending ? amount : p.pending;
        p.pending -= fromPending;
        uint256 fromEligible = amount - fromPending;
        if (fromEligible > p.eligible) revert InsufficientShares();
        p.eligible -= fromEligible;
        eligiblePrincipal -= fromEligible;
        totalPrincipal -= amount;
        p.rewardDebt = Math.mulDiv(p.eligible, accRewardPerShare, SCALE);
        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function pendingReward(address user) external view returns (uint256) {
        Position storage p = positions[user];
        return p.accrued + Math.mulDiv(p.eligible, accRewardPerShare, SCALE) - p.rewardDebt;
    }
}
