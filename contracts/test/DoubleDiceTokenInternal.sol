// SPDX-License-Identifier: UNLICENSED
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

    // solhint-disable-next-line func-name-mixedcase
    function ONE_() external pure returns (uint256) {
        return ONE;
    }

    // solhint-disable-next-line func-name-mixedcase
    function ASSUMED_MAX_INIT_TOTAL_SUPPLY() external pure returns (uint256) {
        return _ASSUMED_MAX_INIT_TOTAL_SUPPLY;
    }
    
    // solhint-disable-next-line func-name-mixedcase
    function ASSUMED_MAX_INIT_TOTAL_TO_INIT_CIRCULATING_SUPPLY_RATIO() external pure returns (uint256) {
        return _ASSUMED_MAX_INIT_TOTAL_TO_INIT_CIRCULATING_SUPPLY_RATIO;
    }
    
    // solhint-disable-next-line func-name-mixedcase
    function ASSUMED_MIN_TOTAL_CIRCULATING_TO_EXCLUDED_CIRCULATING_SUPPLY_RATIO() external pure returns (uint256) {
        return _ASSUMED_MIN_TOTAL_CIRCULATING_TO_EXCLUDED_CIRCULATING_SUPPLY_RATIO;
    }

}
