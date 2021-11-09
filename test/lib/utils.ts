import { expect } from 'chai';
import { BigNumber, BigNumberish, ContractReceipt, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { DoubleDiceToken } from '../../typechain';
import { zipArrays2, zipArrays3 } from './arrays';
import { TOKEN_DECIMALS, TOKEN_SYMBOL, UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, UNDISTRIBUTED_YIELD_ACCOUNT } from './constants';


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
export const $ = (value: number | bigint, epsilon = 0, log = false): BigNumber => {
  let multiplier = 10n ** 18n;
  if (typeof value === 'number') {
    while (value % 1 !== 0) {
      value *= 10;
      multiplier /= 10n;
    }
  }
  const ans = BigNumber.from(value).mul(multiplier).add(epsilon);
  if (log) {
    console.log(`$(${value}) => ${ans}`);
  }
  return ans;
};

const formatTokenRaw = (value: BigNumberish): string => {
  const multiplier = BigNumber.from(10).pow(TOKEN_DECIMALS);
  const bn = BigNumber.from(value);
  const whole = bn.div(multiplier).toString().replace(/(?=(\d{3})+$)/g, '_').replace(/^_/, '');
  const frac = bn.mod(multiplier).toString().padStart(TOKEN_DECIMALS, '0').replace(/(?=(\d{6})+$)/g, '_').replace(/^_/, '');
  return `${whole}.${frac} ${TOKEN_SYMBOL}`;
};

export const formatToken = (value: BigNumberish, magnitude = 0): string => {
  const widest = formatTokenRaw(BigNumber.from(10).pow(magnitude + TOKEN_DECIMALS)).length;
  const formatted = formatTokenRaw(value);
  return formatted.padStart(widest);
};

type AddressOrSigner = string | { address: string }

export const toAddress = (addressOrSigner: AddressOrSigner) => typeof addressOrSigner === 'string' ? addressOrSigner : addressOrSigner.address;

export const printBalances = (balances: Record<string, BigNumberish>) => {
  console.log(Object.fromEntries(zipArrays2(
    Object.keys(balances),
    Object.values(balances).map(balance => formatToken(balance))
  )));
};


const PATTERN = /^(?<whole>[0-9,_]+)(?:\.(?<frac>[0-9,_]+))?(?<multiplier>[BM])?$/;

export const parseTokenAmount = (tokenAmount: string): BigNumber => {
  const matches = tokenAmount.match(PATTERN);
  if (matches === null) {
    throw new Error(`Could not parse formatted token amount ${tokenAmount}`);
  }
  const { groups } = matches;
  const { whole, frac = '000000000000000000', multiplier } = <Record<string, string>>groups;

  return BigNumber
    .from(10)
    .pow(multiplier === 'B' ? 9 : multiplier === 'M' ? 6 : 0)
    .mul(whole.replace(/[,_]/g, '') + frac.replace(/[,_]/g, '').padEnd(18, '0'));

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

  async transfer(from: Signer, to: AddressOrSigner, amount: BigNumberish): Promise<ContractReceipt> {
    return (await this.contract.connect(from).transfer(toAddress(to), amount)).wait();
  }

  createTokensCheck(accounts: Record<string, AddressOrSigner>, log = false): ((expectedFormatted: string) => Promise<void>)[] {
    const log_ = log;
    const tokenCheck = (tokensOfName: string, tokensOf: (account: AddressOrSigner) => Promise<BigNumber>) =>
      async (expectedFormatted: string, log = log_) => {
        const actuals = await Promise.all(Object.values(accounts).map(account => tokensOf(account)));
        // e.g. '100B/1B | 2/0 | 3M/0'
        const expecteds = expectedFormatted
          .trim()
          .split(/\s*\|\s*/)
          .map(parseTokenAmount);
        for (const [accountName, actual, expected] of zipArrays3(Object.keys(accounts), actuals, expecteds)) {
          const msg = `${tokensOfName}(${accountName}) = ${actual} ≠ ${expected}`;
          expect(actual, msg).to.eq(expected);
          if (log) {
            console.log({
              [accountName]: {
                [tokensOfName]: {
                  expected: formatToken(expected).toString(),
                  actual: formatToken(actual)
                }
              }
            });
          }
        }
      };
    return [
      tokenCheck('balanceOf', account => this.balanceOf(account)),
      tokenCheck('unclaimedYieldOf', account => this.safeUnclaimedYieldOf(account))
    ];
  }

  async distributeYield(amount: BigNumberish, ...excludedAccounts: AddressOrSigner[]): Promise<ContractReceipt> {
    return (await this.contract.distributeYield(amount, excludedAccounts.map(toAddress))).wait();
  }

  undistributedSupply(): Promise<BigNumber> {
    return this.balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT);
  }

  async circulatingSupply(): Promise<BigNumber> {
    return (await this.contract.totalSupply()).sub(await this.undistributedSupply());
  }

}

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
