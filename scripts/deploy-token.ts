import is from '@sindresorhus/is';
import assert from 'assert';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { DoubleDiceToken__factory } from '../typechain-types';
import { pressAnyKey } from './utils';

const {
  OWNER,
  INIT_TOKEN_SUPPLY,
  INIT_TOKEN_HOLDER,
  TOTAL_YIELD_AMOUNT
} = process.env;

async function main() {
  assert(is.string(OWNER));
  assert(is.string(INIT_TOKEN_SUPPLY));
  assert(is.string(TOTAL_YIELD_AMOUNT));
  assert(is.string(INIT_TOKEN_HOLDER));

  const initTokenSupply = BigNumber.from(10).pow(18).mul(INIT_TOKEN_SUPPLY);
  const totalYieldAmount = BigNumber.from(10).pow(18).mul(TOTAL_YIELD_AMOUNT);

  const [owner] = await ethers.getSigners();
  assert(owner.address === OWNER, `OWNER = ${owner.address} != ${OWNER}`);

  const nonce = await ethers.provider.getTransactionCount(owner.address);

  // assert(nonce === 0, 'Deploy from nonce 0 to get a common contract address across chains');

  console.log(`To be deployed from account ${owner.address} nonce ${nonce}`);
  console.log(`initTokenSupply = ${ethers.utils.formatEther(initTokenSupply)}`);
  console.log(`totalYieldAmount = ${ethers.utils.formatEther(totalYieldAmount)}`);
  console.log(`INIT_TOKEN_HOLDER = ${INIT_TOKEN_HOLDER} (all non-yield tokens will be transferred here, ensure you can control this account)`);

  const { name, chainId } = await ethers.provider.getNetwork();

  await pressAnyKey(`to deploy to network "${name}" (🔗 ${chainId})`);

  const contract = await new DoubleDiceToken__factory(owner).deploy(
    initTokenSupply,
    totalYieldAmount,
    INIT_TOKEN_HOLDER
  );

  const { deployTransaction: { hash } } = contract;
  console.log(`Tx sent with hash ${hash}`);
  console.log(`Waiting for deployment to ${contract.address}...`);
  await contract.deployed();

  const { deployTransaction: { blockHash } } = contract;
  console.log(`Contract deployed to ${contract.address}, tx mined in block ${blockHash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
