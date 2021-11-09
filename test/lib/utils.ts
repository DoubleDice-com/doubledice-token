import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { DoubleDiceToken } from '../../typechain';

export const MULTIPLIER = BigNumber.from(10).pow(48);

export async function forwardTime(seconds: number) {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await ethers.provider.send('evm_mine', []);
}

export async function currentBlockTime() {
  const { timestamp } = await ethers.provider.getBlock('latest');
  return timestamp;
}

/**
 * value * 10^18 + epsilon
 * E.g. to say "500 tokens, with an error of -1", i.e. 499_999999_999999_999999, we write: $(500, -1)
 * For values without error, omit epsilon, e.g. $(10)
 */
export const $ = (value: BigNumberish, epsilon = 0, log = false) => {
  const ans = BigNumber.from(value).mul(BigNumber.from(10).pow(18)).add(epsilon);
  if (log) {
    console.log(`$(${value}) => ${ans}`);
  }
  return ans;
};

const formatToken = (value: BigNumberish) => ethers.utils.formatUnits(value, 'ether');

function zipArrays2<A, B>(aaa: A[], bbb: B[]): [A, B][] {
  if (aaa.length === 0 || bbb.length === 0) {
    return [];
  } else {
    const [[a, ...aa], [b, ...bb]] = [aaa, bbb];
    return [[a, b], ...zipArrays2(aa, bb)];
  }
}

type AddressOrSigner = string | { address: string }

const toAddress = (addressOrSigner: AddressOrSigner) => typeof addressOrSigner === 'string' ? addressOrSigner : addressOrSigner.address;

export const printBalances = (balances: Record<string, BigNumberish>) => {
  console.log(Object.fromEntries(zipArrays2(
    Object.keys(balances),
    Object.values(balances).map(balance => formatToken(balance))
  )));
};

export class TokenHelper {

  constructor(private contract: DoubleDiceToken) { }

  balanceOf(addressOrSigner: AddressOrSigner): Promise<BigNumber> {
    return this.contract.balanceOf(toAddress(addressOrSigner));
  }

  unclaimedYieldOf(addressOrSigner: AddressOrSigner): Promise<BigNumber> {
    return this.contract.unclaimedYieldOf(toAddress(addressOrSigner));
  }

  async safeUnclaimedYieldOf(addressOrSigner: AddressOrSigner): Promise<BigNumber> {
    return isReservedAccount(addressOrSigner) ? BigNumber.from(0) : await this.unclaimedYieldOf(addressOrSigner);
  }

  async getBalances(addressOrSigner: AddressOrSigner): Promise<{ balance: BigNumber, unclaimed: BigNumber }> {
    return {
      balance: await this.balanceOf(addressOrSigner),
      unclaimed: await this.safeUnclaimedYieldOf(addressOrSigner)
    };
  }

  async balanceCheck(
    account: AddressOrSigner,
    expected: { balance?: BigNumberish, unclaimed?: BigNumberish },
    name?: string,
  ): Promise<{ balance: BigNumber, unclaimed: BigNumber | null }> {
    const actual = await this.getBalances(account);
    if (expected.balance !== undefined) {
      expect(actual.balance, `balance${name ? `Of(${name})` : ''} = ${formatToken(actual.balance)} ≠ ${formatToken(expected.balance)}`).to.eq(expected.balance);
    }
    if (expected.unclaimed !== undefined) {
      expect(actual.unclaimed, `unclaimedYield${name ? `Of(${name})` : ''} = ${formatToken(actual.unclaimed)} ≠ ${formatToken(expected.unclaimed)}`).to.eq(expected.unclaimed);
    }
    return actual;
  }
}

export const [TOKEN_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS] = ['DoubleDice Token', 'DODI', 18];

export const UNDISTRIBUTED_YIELD_ACCOUNT = '0xD0D1000000000000000000000000000000000001';

export const UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT = '0xd0D1000000000000000000000000000000000002';

export const isReservedAccount = (addressOrSigner: AddressOrSigner): boolean => {
  return [
    UNDISTRIBUTED_YIELD_ACCOUNT,
    UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT
  ].includes(toAddress(addressOrSigner));
};

export class EvmCheckpoint {

  private snapshot: string;

  private constructor(initSnapshot: string) {
    this.snapshot = initSnapshot;
  }

  static async create(): Promise<EvmCheckpoint> {
    const snapshot = await ethers.provider.send('evm_snapshot', []);
    console.log(`Captured EVM snapshot ${snapshot}`);
    return new EvmCheckpoint(snapshot);
  }

  async revertTo(log = false) {
    const ok = await ethers.provider.send('evm_revert', [this.snapshot]);
    if (!ok) {
      throw new Error(`Error reverting to EVM snapshot ${this.snapshot}`);
    }
    if (log) console.log(`Reverted to EVM snapshot ${this.snapshot}`);
    this.snapshot = await ethers.provider.send('evm_snapshot', []);
    if (log) console.log(`Captured EVM snapshot ${this.snapshot}`);
  }

}
