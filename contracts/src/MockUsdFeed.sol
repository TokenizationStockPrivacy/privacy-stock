// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test-only mutable oracle. Never use in a production deployment.
contract MockUsdFeed {
    uint80 public roundId;
    int256 public answer;
    uint256 public updatedAt;
    function decimals() external pure returns (uint8) { return 8; }
    function set(int256 next, uint256 timestamp) external {
        roundId++;
        answer = next;
        updatedAt = timestamp;
    }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}
