import { BigNumber } from 'ethers';

export const toNumber = (value: number | BigNumber): number => typeof value === 'number'
  ? value
  : Number(value.toBigInt());

const gcdOf = (x: BigNumber, y: BigNumber): BigNumber => y.eq(0) ? x : gcdOf(y, x.mod(y));

/**
 * E.g.
 * 75000000000000000000000000000000000000000000 / 100000000000000000000000000000000000000000000 = 0.7499999999999999
 * But using this function,
 * 75000000000000000000000000000000000000000000 / 100000000000000000000000000000000000000000000 = 3 / 4 = 0.75
 */
export const rationalDiv = (x: BigNumber, y: BigNumber): number => {
  const gcd = gcdOf(x, y);
  return toNumber(x.div(gcd)) / toNumber(y.div(gcd));
};

export const LOG10_OF_E = Math.log10(Math.exp(1));

export const LOG10_OF_2 = Math.log10(2);
