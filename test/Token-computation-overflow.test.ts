import is from '@sindresorhus/is';
import assert from 'assert';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { DoubleDiceTokenInternal__factory } from '../typechain-types';
import { ONE } from './lib/constants';
import { LOG10_OF_2, LOG10_OF_E, rationalDiv, toNumber } from './lib/numbers';
import { $, formatToken, toAddress, TokenHelper } from './lib/utils';

const LOG = false;

describe('Token computation limits', () => {

  const initTotalSupply = $(10_000_000_000n);
  const totalYieldAmount = $(3_700_000_000n);

  const test = (nDistributions: number) => {
    it(`split distribution over ${nDistributions} rounds`, async () => {
      const [owner, initTokenHolder, excludedAccount1, excludedAccount2] = await ethers.getSigners();

      const factory = new DoubleDiceTokenInternal__factory(owner);
      const contract = await factory.deploy(initTotalSupply, totalYieldAmount, initTokenHolder.address);
      const helper = new TokenHelper(contract);

      expect(await contract.ONE_()).to.eq(ONE);

      // put a single DODI wei in this account...
      await helper.transfer(initTokenHolder, excludedAccount2, 1);

      const initCirculatingSupply = initTotalSupply.sub(totalYieldAmount);

      const ASSUMED_MAX_T = toNumber(await contract.ASSUMED_MAX_INIT_TOTAL_SUPPLY());
      const ASSUMED_MAX_T_OVER_C = (await contract.ASSUMED_MAX_INIT_TOTAL_TO_INIT_CIRCULATING_SUPPLY_RATIO()).toNumber();
      const ASSUMED_MIN_1_OVER_EPSILON = (await contract.ASSUMED_MIN_TOTAL_CIRCULATING_TO_EXCLUDED_CIRCULATING_SUPPLY_RATIO()).toNumber();
      const MAX_EPSILON = 1 / ASSUMED_MIN_1_OVER_EPSILON;
      const MAX_GAMMA = 1 / (1 - MAX_EPSILON);

      const LOG10_ONE = Math.log10(toNumber(ONE));
      const LOG10_ASSUMED_MAX_T = Math.log10(ASSUMED_MAX_T);
      const LOG10_INIT_TOTAL_SUPPLY = Math.log10(toNumber(initTotalSupply));

      const DEPLOYED_T_OVER_C = rationalDiv(initTotalSupply, initCirculatingSupply);

      if (LOG) {
        console.log(`MAX_EPSILON       = ${MAX_EPSILON}`);
        console.log(`MAX_GAMMA         = ${MAX_GAMMA}`);
        console.log(`DEPLOYED_T_OVER_C = ${DEPLOYED_T_OVER_C}`);
      }

      // Theoretical upper bound on f given assumed param limits
      const log2FMaxMax = (LOG10_OF_E * MAX_GAMMA * (ASSUMED_MAX_T_OVER_C - 1) + LOG10_ONE + LOG10_ASSUMED_MAX_T) / LOG10_OF_2;

      let totalDistributed = BigNumber.from(0);

      for (let month = 0; month < nDistributions; month++) {

        const circBefore = await helper.circulatingSupply();
        const undistBefore = await helper.undistributedSupply();

        await helper.transfer(
          initTokenHolder,
          excludedAccount1,
          circBefore.div(2).sub((await helper.balanceOf(excludedAccount1)))
        );

        // split tokens yet undistributed equally between remaining months
        const amountToDistribute = (await helper.undistributedSupply()).div(nDistributions - month);

        // excludedAccount1 has the maximum possible balance to be excluded without breaking assumptions
        // By excluding excludedAccount2 that has that extra 1 wei, the balance is tipped
        await expect(
          contract.connect(owner).distributeYield(
            amountToDistribute,
            [excludedAccount1.address, excludedAccount2.address]
          )
        ).to.be.revertedWith('Broken assumption');

        const { events } = await helper.distributeYield(amountToDistribute, excludedAccount1);

        const circAfter = await helper.circulatingSupply();
        const undistAfter = await helper.undistributedSupply();

        const factor = await contract.factor();
        const log2F = (Math.log10(toNumber(ONE.add(factor))) + LOG10_INIT_TOTAL_SUPPLY) / LOG10_OF_2;

        // Theoretical upper bound on largest computation up to this point
        totalDistributed = totalDistributed.add(amountToDistribute);
        const lnFMax = MAX_GAMMA * rationalDiv(totalDistributed, initCirculatingSupply);
        const log2FMax = (LOG10_OF_E * lnFMax + LOG10_ONE + LOG10_INIT_TOTAL_SUPPLY) / LOG10_OF_2;

        expect(log2F, 'log2(f) < log2(fMax)').to.be.lt(log2FMax);
        expect(log2FMax, 'log2(fMax) < log2(fMaxMax)').to.be.lt(log2FMaxMax);
        expect(log2FMaxMax, 'log2(fMaxMax) < 256').to.be.lt(256);

        if (LOG) {
          console.log(`----- month = ${month} ----- `);
          console.log(`circulatingSupply    = ${formatToken(circBefore, 10)}`);
          console.log(`undistributedSupply  = ${formatToken(undistBefore, 10)}`);
          console.log(`amountToDistribute   = ${formatToken(amountToDistribute, 10)}`);
          console.log(`circulatingSupply'   = ${formatToken(circAfter, 10)}`);
          console.log(`undistributedSupply' = ${formatToken(undistAfter, 10)}`);
          console.log(`log2(f)=${log2F} < log2(fMax)=${log2FMax} < log2(maxMaxF)=${log2FMaxMax} < 256`);
        }

        // ToDo: Move events-checking to own test with purpose of checking all events
        assert(is.array(events));
        expect(events).to.have.lengthOf(2);
        const [transferEvent, yieldDistributionEvent] = events;
        expect(transferEvent.event).to.eq('Transfer');
        expect(yieldDistributionEvent.event).to.eq('YieldDistribution');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(yieldDistributionEvent.args!.yieldDistributed).to.eq(amountToDistribute);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(yieldDistributionEvent.args!.excludedAccounts).to.eql([toAddress(excludedAccount1)]);
      }
    });
  };

  test(1);
  test(10);
  test(24);
  test(100);
});
