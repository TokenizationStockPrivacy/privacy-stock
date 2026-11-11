// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Immediate-entry fee sharing for the split-balance pool.
/// @dev Immediate eligibility is intentional. It removes the V1 activation delay but permits fee sniping.
contract RewardsVaultV2 is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    uint256 private constant SCALE = 1e27;
    IERC20 public immutable asset;
    address public collector;
    uint256 public totalPrincipal;
    uint256 public accRewardPerShare;
    uint256 public totalFeesReceived;
    uint256 public totalRewardsPaid;

    struct Position {
        uint256 principal;
        uint256 rewardDebt;
        uint256 accrued;
    }
    mapping(address => Position) public positions;

    error ZeroAmount();
    error FeeTooSmall();
    error NoPrincipal();
    error UnauthorizedCollector();
    error InsufficientPrincipal();
    error UnsupportedToken();

    event CollectorChanged(address indexed previous, address indexed current);
    event Deposited(address indexed user, uint256 amount);
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

    /// @notice Compatibility/readability alias: every deposited principal is immediately eligible.
    function eligiblePrincipal() external view returns (uint256) {
        return totalPrincipal;
    }

    function _accrue(Position storage p) internal {
        uint256 earned = Math.mulDiv(p.principal, accRewardPerShare, SCALE);
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
        p.principal += amount;
        totalPrincipal += amount;
        p.rewardDebt = Math.mulDiv(p.principal, accRewardPerShare, SCALE);
        emit Deposited(msg.sender, amount);
    }

    function fundFees(uint256 amount) external nonReentrant {
        if (msg.sender != collector) revert UnauthorizedCollector();
        if (amount == 0) revert ZeroAmount();
        if (totalPrincipal == 0) revert NoPrincipal();
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedToken();
        uint256 increment = Math.mulDiv(amount, SCALE, totalPrincipal);
        if (increment == 0) revert FeeTooSmall();
        totalFeesReceived += amount;
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
        if (amount > p.principal) revert InsufficientPrincipal();
        p.principal -= amount;
        totalPrincipal -= amount;
        p.rewardDebt = Math.mulDiv(p.principal, accRewardPerShare, SCALE);
        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function pendingReward(address user) external view returns (uint256) {
        Position storage p = positions[user];
        return p.accrued + Math.mulDiv(p.principal, accRewardPerShare, SCALE) - p.rewardDebt;
    }
}
