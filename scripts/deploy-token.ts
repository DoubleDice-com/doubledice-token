import is from '@sindresorhus/is';
import assert from 'assert';
import { ethers } from 'hardhat';
import { formatToken, parseTokenAmount } from '../test/lib/utils';
import { DummyToken__factory as DoubleDiceToken__factory } from '../typechain-types';
import { pressAnyKey } from './utils';

const {
  OWNER_ADDRESS,
  INIT_TOKEN_SUPPLY,
  INIT_TOKEN_HOLDER_ADDRESS,
  TOTAL_YIELD_AMOUNT,
  MAX_FEE_PER_GAS_IN_GWEI,
  MAX_PRIORITY_FEE_PER_GAS_IN_GWEI,
  CHAIN_ID
} = process.env;

async function main() {
  assert(is.string(OWNER_ADDRESS), `OWNER_ADDRESS = ${OWNER_ADDRESS}`);
  assert(is.string(INIT_TOKEN_SUPPLY), `INIT_TOKEN_SUPPLY = ${INIT_TOKEN_SUPPLY}`);
  assert(is.string(TOTAL_YIELD_AMOUNT), `TOTAL_YIELD_AMOUNT = ${TOTAL_YIELD_AMOUNT}`);
  assert(is.string(INIT_TOKEN_HOLDER_ADDRESS), `INIT_TOKEN_HOLDER_ADDRESS = ${INIT_TOKEN_HOLDER_ADDRESS}`);
  assert(is.string(MAX_FEE_PER_GAS_IN_GWEI), `MAX_FEE_PER_GAS_IN_GWEI = ${MAX_FEE_PER_GAS_IN_GWEI}`);
  assert(is.string(MAX_PRIORITY_FEE_PER_GAS_IN_GWEI), `MAX_PRIORITY_FEE_PER_GAS_IN_GWEI = ${MAX_PRIORITY_FEE_PER_GAS_IN_GWEI}`);
  assert(is.string(CHAIN_ID), `CHAIN_ID = ${CHAIN_ID}`);

  const { name, chainId } = await ethers.provider.getNetwork();

  assert(parseInt(CHAIN_ID) === chainId, `${CHAIN_ID} !== ${chainId}; wrong .env config?`);

  const initTokenSupply = parseTokenAmount(INIT_TOKEN_SUPPLY);
  const totalYieldAmount = parseTokenAmount(TOTAL_YIELD_AMOUNT);

  assert(OWNER_ADDRESS !== INIT_TOKEN_HOLDER_ADDRESS, `Not recommended to use same address ${OWNER_ADDRESS} as both OWNER and INIT_TOKEN_HOLDER`);

  const [owner] = await ethers.getSigners();
  assert(owner.address === OWNER_ADDRESS, `OWNER = ${owner.address} != ${OWNER_ADDRESS}`);

  const maxFeePerGas = ethers.utils.parseUnits(MAX_FEE_PER_GAS_IN_GWEI, 'gwei');
  const maxPriorityFeePerGas = ethers.utils.parseUnits(MAX_PRIORITY_FEE_PER_GAS_IN_GWEI, 'gwei');

  const ownerEthBalance = await owner.getBalance();

  console.log(`To be deployed from  = ${owner.address} (balance = ${ethers.utils.formatEther(ownerEthBalance)} ETH)`);
  console.log(`maxFeePerGas         = ${ethers.utils.formatUnits(maxFeePerGas, 'gwei')} gwei`);
  console.log(`maxPriorityFeePerGas = ${ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei')} gwei`);
  console.log();
  console.log('Deployment args:');
  console.log(`* initTokenSupply   = ${formatToken(initTokenSupply, 10)}`);
  console.log(`* totalYieldAmount  = ${formatToken(totalYieldAmount, 10)}`);
  console.log(`* INIT_TOKEN_HOLDER = ${INIT_TOKEN_HOLDER_ADDRESS} (all non-yield tokens will be transferred here, ensure you can control this account)`);
  console.log();

  await pressAnyKey(`to deploy to network "${name}" (🔗 ${chainId})`);

  const factory = new DoubleDiceToken__factory(owner);
  const contract = await factory.deploy(
    initTokenSupply,
    totalYieldAmount,
    INIT_TOKEN_HOLDER_ADDRESS,
    {
      type: 2,
      maxFeePerGas,
      maxPriorityFeePerGas,

      //  simplify the process of deploying to the same address across chains
      nonce: 0,
    }
  );

  const { deployTransaction: { hash } } = contract;

  console.log(`Tx sent with hash ${hash}`);
  console.log(`Waiting for deployment to ${contract.address}...`);
  await contract.deployed();

  const { blockNumber, blockHash } = await contract.deployTransaction.wait();
  console.log(`Contract deployed to ${contract.address}, tx mined in block № ${blockNumber} (${blockHash})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
