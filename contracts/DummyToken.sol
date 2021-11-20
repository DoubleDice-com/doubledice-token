// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract DummyToken is
    ERC20("Dummy Token", "DUMMY"),
    Ownable
{
    constructor(
        uint256 a,
        uint256 b,
        address c
    ) {
        ERC20._mint(0x0101010101010101010101010101010101010101, b);
        ERC20._mint(c, a - b);
    }
}
