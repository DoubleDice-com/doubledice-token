
# DoubleDice Token and Vesting contract

This is the repository for the DoubleDice (DODI) Token and DoubleDice Token Vesting contract.

## Contracts

[DoubleDiceToken.sol](./contracts/DoubleDiceToken.sol)
DODI Token contract based on an ERC20 token. See [token documentation](./TOKEN.md). 

[DoubleDiceTokenVesting.sol](./contracts/DoubleDiceTokenVesting.sol) 
Stores and manages the DODI Token grants and its deployed per user have following functions:

* `addTokenGrant` - Adds a new token grant for the user. Only one grant per user is allowed. The amount of DODI grant tokens here need to be preapproved by the DODI Deployer (which mints and owns the tokens) for transfer by the `Vesting` contract before this call. There is an option to backdate the grant here if needed.

* `removeTokenGrant` - Terminate token grant for a given user transferring all vested tokens to the user and returning all non-vested tokens to the DODI Deployer.

external functions:
* `collectInitiallyClaimableAmount` - Allows user to collect their initial claimable tokens. Errors if the already collected. Note that it is advised user to check they are able to collect via `tokenGrant.initialClaimableCollected` .

* `claimVestedTokens` - Allows a grant recipient to claim their vested tokens. Errors if no tokens have vested. Note that it is advised the user to check they are entitled to claim via `calculateGrantClaim` before calling this.

* `calculateGrantClaim` - Calculates the vested and unclaimed months and tokens available for a given user to claim. Due to rounding errors once grant duration is reached, returns the entire left grant amount. Returns (0, 0) if cliff has not been reached.

## Testing

To run all tests:
```
npm test
```
To run tests with code coverage using [solidity-coverage](https://github.com/sc-forks/solidity-coverage):
```
npm run coverage
```

## Etherscan code-verification

Configure `ETHERSCAN_API_KEY` in `.env` file, then e.g.:

```
npx hardhat verify --network goerli CONTRACT_ADDRESS CONSTRUCTOR_ARG_1 CONSTRUCTOR_ARG_2 CONSTRUCTOR_ARG_3
```

Contract deployed to Ethereum mainnet at `0x4E08F03079c5CD3083eA331Ec61bCC87538B7665` was verified with:

```
npx hardhat verify --network mainnet 0x4E08F03079c5CD3083eA331Ec61bCC87538B7665 10000000000000000000000000000 3700000000000000000000000000 0x4b64e8187E44810e828A9e97c2FeB01F2e3B8cc6
```
