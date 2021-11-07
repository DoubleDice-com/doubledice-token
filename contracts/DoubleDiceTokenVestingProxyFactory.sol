// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./DoubleDiceTokenVesting.sol";

/// @title Contract for deploying `DoubleDiceTokenVesting` proxies with minimal footprint.
contract DoubleDiceTokenVestingProxyFactory is Ownable {

    IERC20 immutable public dodiToken;

    address immutable public dodiTokenVestingImplementation;

    /// @param _dodiTokenAddress The address at which the `DoubleDiceToken` is deployed
    /// @param _dodiTokenVestingImplementation The address at which the `DoubleDiceTokenVesting`
    /// singleton is deployed. All proxies deployed by this contract will delegate calls
    /// to this singleton.
    constructor(address _dodiTokenAddress, address _dodiTokenVestingImplementation) {
        dodiToken = IERC20(_dodiTokenAddress);
        dodiTokenVestingImplementation = _dodiTokenVestingImplementation;
    }

    event DoubleDiceTokenVestingProxyCreation(address proxyAddress);

    /// @notice Deploy and initialize a new `DoubleDiceTokenVesting` proxy.
    /// Only the `owner()` of this factory contract may invoke this function.
    /// @dev This function deploys a EIP-1167 Minimal Proxy Contract in front of the
    /// `DoubleDiceTokenVesting` singleton implementation at `dodiTokenVestingImplementation`.
    /// @param _dodiOwner The account funding the vesting-contract. It must have pre-approved
    /// this factory contract to `transferFrom` at least `_amount` out of its balance.
    function createDoubleDiceTokenVestingProxy(
        address _dodiOwner, address _userAddress,
        uint256 _startTime, uint256 _amount, uint32 _vestingDuration, uint32 _vestingCliff, uint256 _initiallyClaimableAmount
    )
        external
        onlyOwner
    {
        // The `_dodiOwner` account funding the vesting-contract must have pre-approved
        // this factory contract to `transferFrom` at least `_amount` out of its balance.
        dodiToken.transferFrom(_dodiOwner, address(this), _amount);

        // Deploy a new `DoubleDiceTokenVesting` proxy-instance, and
        // immediately increase its allowance to `transferFrom` `_amount` out of
        // this factory contract's balance.
        address newProxyInstance = Clones.clone(dodiTokenVestingImplementation);

        // Since this is the only line where this factory gives spending allowance to accounts,
        // and the only accounts it gives allowance to are `DoubleDiceTokenVesting` proxies
        // that spend that entire allowance immediately in their `intialize`,
        // then the allowance should *always* be zero at this point.
        assert(dodiToken.allowance(address(this), newProxyInstance) == 0);
        dodiToken.approve(newProxyInstance, _amount);

        // `initialize` the newly-created `DoubleDiceTokenVesting` proxy-instance.
        // The `initialize` function will transfer `_amount` from this contract
        // to itself, thus spending the allowance it has just been given.
        // Since `initialize` is an `Initializable.initializer`, it will not be possible
        // for `initialize` to be called again thereafter.
        DoubleDiceTokenVesting(newProxyInstance).initialize(
            address(dodiToken), _userAddress,
            _startTime, _amount, _vestingDuration, _vestingCliff, _initiallyClaimableAmount
        );

        // Since `DoubleDiceTokenVesting` is `Ownable`, and it was `initialize`-d by
        // this factory contract, this factory contract automatically becomes its (interim) owner.
        // In the next line, as the current `owner()` of the vesting-contract,
        // this factory contract will transfer its ownership to `_dodiOwner`,
        // the account that funded the vesting-contract.
        DoubleDiceTokenVesting(newProxyInstance).transferOwnership(_dodiOwner);

        emit DoubleDiceTokenVestingProxyCreation(newProxyInstance);
    }

}
