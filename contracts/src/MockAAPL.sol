// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test token only. No rights in Apple Inc. or any security.
contract MockAAPL is ERC20 {
    constructor() ERC20("Mock AAPL (TEST ONLY)", "mAAPL") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
