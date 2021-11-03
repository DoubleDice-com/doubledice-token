// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./IDoubleDiceToken.sol";


contract DoubleDiceToken is
    IDoubleDiceToken,
    ERC20("DoubleDice Token", "DODI"),
    Ownable
{
    // Accounts for which the corresponding private key is unknown,
    // much like for 0x0000000000000000000000000000000000000000
    address constant public UNDISTRIBUTED_YIELD_ACCOUNT = 0xD0D1000000000000000000000000000000000001;
    address constant public UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT = 0xd0D1000000000000000000000000000000000002;

    function _isReservedAccount(address account) internal pure returns (bool) {
        return account == UNDISTRIBUTED_YIELD_ACCOUNT || account == UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT;
    }
    

    // Note: Balance could be moved into this struct, and pack together with
    // capturedUnclaimedYield into a single storage slot, although this would require
    // ERC20 implementation to be slightly forked to allow _setBalance()
    struct AccountEntry {
        uint256 capturedUnclaimedYield;

        /// @dev The value of `_factor` used in the most recent calculation of `capturedUnclaimedYield`
        uint256 factorAtCapture;
    }

    mapping(address => AccountEntry) internal _entries;

    // Rounding errors in this contract can be minimised by calculating `_factor` with maximal precision,
    // and the precision of `_factor` is determined by the value of `ONE`.
    // By setting ONE = 10 ** 47 and never breaking the assumptions below, it can be proven
    // that the largest computation in this contract will never result in uint256 overflow.
    uint256 constant internal ONE = 1e47;

    uint256 constant private _ASSUMED_MAX_INIT_TOTAL_SUPPLY = 20e9 * 1e18;
    uint256 constant private _ASSUMED_MAX_INIT_TOTAL_TO_INIT_CIRCULATING_SUPPLY_RATIO = 2;
    uint256 constant private _ASSUMED_MIN_TOTAL_CIRCULATING_TO_EXCLUDED_CIRCULATING_SUPPLY_RATIO = 2;

    function _checkOverflowProtectionAssumptionsConstructor(uint256 initTotalSupply, uint256 totalYieldAmount) internal pure {
        require(initTotalSupply <= _ASSUMED_MAX_INIT_TOTAL_SUPPLY, "Broken assumption");
        uint256 initCirculatingSupply = initTotalSupply - totalYieldAmount;
        // C/T = initCirculatingSupply / initTotalSupply >= 0.5
        require(initCirculatingSupply * _ASSUMED_MAX_INIT_TOTAL_TO_INIT_CIRCULATING_SUPPLY_RATIO >= initTotalSupply, "Broken assumption");
    }

    function _checkOverflowProtectionAssumptionsDistributeYield(uint256 totalCirculatingSupply, uint256 excludedCirculatingSupply) internal pure {
        // epsilon = excludedCirculatingSupply / totalCirculatingSupply <= 0.5
        require((excludedCirculatingSupply * _ASSUMED_MIN_TOTAL_CIRCULATING_TO_EXCLUDED_CIRCULATING_SUPPLY_RATIO) <= totalCirculatingSupply, "Broken assumption");
    }

    uint256 internal _factor;

    function balancePlusUnclaimedYieldOf(address account) public view returns (uint256) {
        
        // Querying a reserved account's unclaimed yield could be made to return 0, rather than revert,
        // and that would not be incorrect.
        // This function is public, so it is both external and internal.
        // When called externally, it is arbitrary whether to return 0 or to revert for a reserved account.
        // When called internally, this point should never be reached for a reserved account,
        // so this `require` doubles as an `assert` and provides some extra safety
        // at a slightly increased gas cost.
        require(!_isReservedAccount(account), "Reserved account");

        AccountEntry storage entry = _entries[account];
        return ((ONE + _factor) * (balanceOf(account) + entry.capturedUnclaimedYield)) / (ONE + entry.factorAtCapture);
    }

    function unclaimedYieldOf(address account) public view returns (uint256) {
        return balancePlusUnclaimedYieldOf(account) - balanceOf(account);
    }

    event UnclaimedYieldIncrease(address indexed account, uint256 byAmount);

    function _captureUnclaimedYield(address account) internal {
        AccountEntry storage entry = _entries[account];

        assert(entry.factorAtCapture <= _factor);

        if (entry.factorAtCapture == _factor) {
            // No yield distribution since last calculation
            return;
        }

        // Recalculate *before* factorAtCapture is updated
        uint256 newUnclaimedYield = unclaimedYieldOf(account);

        // Update *after* unclaimedYieldOf has been calculated
        entry.factorAtCapture = _factor;

        uint256 increase = newUnclaimedYield - entry.capturedUnclaimedYield;
        if (increase > 0) {
            entry.capturedUnclaimedYield = newUnclaimedYield;
            emit UnclaimedYieldIncrease(account, increase);
        }
    }

    constructor(
        uint256 initTotalSupply,
        uint256 totalYieldAmount,
        address initTokenHolder
    ) {
        require(totalYieldAmount <= initTotalSupply, "Invalid params");

        _checkOverflowProtectionAssumptionsConstructor(initTotalSupply, totalYieldAmount);

        // invoke ERC._mint directly to bypass yield corrections
        ERC20._mint(UNDISTRIBUTED_YIELD_ACCOUNT, totalYieldAmount);
        ERC20._mint(initTokenHolder, initTotalSupply - totalYieldAmount);
    }


    /// @dev `_mint` and `_burn` could be overridden in a similar fashion,
    /// but are omitted, as all mints and burns are done directly via
    /// `ERC20._mint` and `ERC20._burn` so as to bypass yield correction
    function _transfer(address from, address to, uint256 amount) internal virtual override {
        require(!_isReservedAccount(from), "Transfer from reserved account");
        require(!_isReservedAccount(to), "Transfer to reserved account");
        _captureUnclaimedYield(from);
        _captureUnclaimedYield(to);
        // invoke ERC._transfer directly to bypass yield corrections
        ERC20._transfer(from, to, amount);
    }


    event YieldDistribution(uint256 yieldDistributed, address[] excludedAccounts);

    function distributeYield(uint256 amount, address[] calldata excludedAccounts) external onlyOwner {
        // ERC20 functions reject mints/transfers to zero-address,
        // so zero-address can never have balance that we want to exclude from calculations.
        address prevExcludedAccount = 0x0000000000000000000000000000000000000000;
        
        uint256 excludedCirculatingSupply = 0;
        for (uint256 i = 0; i < excludedAccounts.length; i++) {
            address account = excludedAccounts[i];

            require(prevExcludedAccount < account, "Duplicate/unordered account");
            prevExcludedAccount = account; // prepare for next iteration immediately

            require(!_isReservedAccount(account), "Reserved account");

            // The excluded account itself might have a stale `capturedUnclaimedYield` value,
            // so it is brought up to date with pre-distribution `_factor`
            _captureUnclaimedYield(account);

            excludedCirculatingSupply += balancePlusUnclaimedYieldOf(account);
        }

        // totalSupply = balanceOfBefore(UNDISTRIBUTED_YIELD) + (sumOfBalanceOfExcluded + balanceOf(UNCLAIMED_DISTRIBUTED_YIELD) + sumOfBalanceOfIncludedBefore)
        // totalSupply = balanceOfBefore(UNDISTRIBUTED_YIELD) + (            excludedCirculatingSupply        +        includedCirculatingSupplyBefore         )
        // totalSupply = balanceOfBefore(UNDISTRIBUTED_YIELD) + (                               totalCirculatingSupplyBefore                                   )
        uint256 totalCirculatingSupplyBefore = totalSupply() - balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT);

        _checkOverflowProtectionAssumptionsDistributeYield(totalCirculatingSupplyBefore, excludedCirculatingSupply);

        // includedCirculatingSupplyBefore = sum(balancePlusUnclaimedYieldOf(account) for account in includedAccounts)
        uint256 includedCirculatingSupplyBefore = totalCirculatingSupplyBefore - excludedCirculatingSupply;

        // totalSupply = (balanceBeforeOf(UNDISTRIBUTED_YIELD)         ) + (           includedCirculatingSupplyBefore) + (excludedCirculatingSupply)
        // totalSupply = (balanceBeforeOf(UNDISTRIBUTED_YIELD) - amount) + (amount  +  includedCirculatingSupplyBefore) + (excludedCirculatingSupply)
        // totalSupply = (     balanceAfterOf(UNDISTRIBUTED_YIELD)     ) + (    includedCirculatingSupplyAfter        ) + (excludedCirculatingSupply)
        uint256 includedCirculatingSupplyAfter = includedCirculatingSupplyBefore + amount;

        _factor = ((ONE + _factor) * includedCirculatingSupplyAfter) / includedCirculatingSupplyBefore - ONE;

        for (uint256 i = 0; i < excludedAccounts.length; i++) {
            // Force this account to "miss out on" this distribution
            // by "fast-forwarding" its `_factor` to the new value
            // without actually changing its balance or unclaimedYield
            _entries[excludedAccounts[i]].factorAtCapture = _factor;
        }

        // invoke ERC._transfer directly to bypass yield corrections
        ERC20._transfer(UNDISTRIBUTED_YIELD_ACCOUNT, UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, amount);

        emit YieldDistribution(amount, excludedAccounts);
    }

    function burnUndistributedYield(uint256 amount) external onlyOwner {
        // invoke ERC._transfer directly to bypass yield corrections
        ERC20._burn(UNDISTRIBUTED_YIELD_ACCOUNT, amount);
    }

    function claimYieldFor(address account) public {

        // Without this check (and without the check in balancePlusUnclaimedYieldOf),
        // it would be possible for anyone to claim yield for one of the reserved accounts,
        // and this would destabilise the accounting system.
        require(!_isReservedAccount(account), "Reserved account");

        // Not entirely necessary, because ERC20._transfer will block 0-account
        // from receiving any balance, but it is stopped in its tracks anyway.
        require(account != address(0), "Zero account");

        _captureUnclaimedYield(account);
        AccountEntry storage entry = _entries[account];
        ERC20._transfer(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, account, entry.capturedUnclaimedYield);
        entry.capturedUnclaimedYield = 0;
        // No special event is emitted because a `Transfer` from
        // UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT always signifies a yield-claim
    }

    /// @dev Convenience function
    function claimYield() external override {
        claimYieldFor(_msgSender());
    }
}
