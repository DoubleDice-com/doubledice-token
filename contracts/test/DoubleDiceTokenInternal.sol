// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.6;

import "../DoubleDiceToken.sol";

contract DoubleDiceTokenInternal is DoubleDiceToken {

    constructor(
        uint256 initTotalSupply,
        uint256 totalYieldAmount,
        address initTokenHolder
    )
        DoubleDiceToken(
            initTotalSupply,
            totalYieldAmount,
            initTokenHolder            
        )
    { // solhint-disable-line no-empty-blocks
    } 

    function isReservedAccount(address account) external pure returns (bool) {
        return _isReservedAccount(account);        
    }

    function factor() external view returns (uint256) {
        return _factor;
    }

    function entryOf(address account) external view returns (AccountEntry memory) {
        return _entries[account];
    }
    
}
