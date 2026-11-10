// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IUsdFeed {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @notice Quotes marginal USD fees for an immutable token and USD oracle.
/// @dev Quotes are informational until a private proof binds the same round and price.
contract FeeManager {
    error InvalidConfig();
    error InvalidPrice();
    error StalePrice();

    uint256 public constant USD_SCALE = 1e8;
    uint256 public constant MAX_FEE_USD = 15_000e8;
    uint256 public immutable tokenUnit;
    uint256 public immutable feedUnit;
    uint256 public immutable maxAge;
    IERC20Metadata public immutable token;
    IUsdFeed public immutable feed;

    constructor(IERC20Metadata token_, IUsdFeed feed_, uint256 maxAge_) {
        if (address(token_) == address(0) || address(feed_) == address(0) || maxAge_ == 0) revert InvalidConfig();
        uint8 td = token_.decimals();
        uint8 fd = feed_.decimals();
        if (td > 18 || fd > 18) revert InvalidConfig();
        token = token_;
        feed = feed_;
        tokenUnit = 10 ** td;
        feedUnit = 10 ** fd;
        maxAge = maxAge_;
    }

    function priceSnapshot() public view returns (uint80 roundId, uint256 price, uint256 updatedAt) {
        int256 answer;
        (roundId, answer,, updatedAt,) = feed.latestRoundData();
        if (answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp) revert InvalidPrice();
        if (block.timestamp - updatedAt > maxAge) revert StalePrice();
        price = Math.mulDiv(uint256(answer), USD_SCALE, feedUnit);
        if (price == 0) revert InvalidPrice();
    }

    /// @return feeUsd USD units with 8 decimals, rounded down per bracket.
    function feeUsdForValue(uint256 valueUsd) public pure returns (uint256 feeUsd) {
        uint256 first = Math.min(valueUsd, 1_000e8);
        feeUsd = first * 50 / 10_000;
        if (valueUsd > 1_000e8) {
            feeUsd += (Math.min(valueUsd, 10_000e8) - 1_000e8) * 100 / 10_000;
        }
        if (valueUsd > 10_000e8) {
            feeUsd += (Math.min(valueUsd, 100_000e8) - 10_000e8) * 150 / 10_000;
        }
        if (valueUsd > 100_000e8) {
            // Avoid multiplication overflow for unreasonable input values.
            uint256 last = valueUsd - 100_000e8;
            if (last >= (MAX_FEE_USD - feeUsd) * 10_000 / 250) return MAX_FEE_USD;
            feeUsd += last * 250 / 10_000;
        }
        return Math.min(feeUsd, MAX_FEE_USD);
    }

    /// @dev Token fee rounds up so a nonzero USD fee is collected. The amount is capped at input.
    function quote(uint256 amount) external view returns (
        uint256 feeTokens, uint256 feeUsd, uint256 valueUsd, uint80 roundId, uint256 price, uint256 updatedAt
    ) {
        (roundId, price, updatedAt) = priceSnapshot();
        valueUsd = Math.mulDiv(amount, price, tokenUnit);
        feeUsd = feeUsdForValue(valueUsd);
        feeTokens = Math.min(amount, Math.mulDiv(feeUsd, tokenUnit, price, Math.Rounding.Ceil));
    }
}
