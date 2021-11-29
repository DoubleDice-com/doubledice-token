import { ethers } from 'hardhat';
import { DoubleDiceTokenInternal__factory } from '../typechain-types';
import { UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, UNDISTRIBUTED_YIELD_ACCOUNT } from './lib/constants';
import { $, TokenHelper } from './lib/utils';

describe('No yield distribution', () => {

  it('if no yield distributed, claims should not alter balanceOf or unclaimedYieldOf', async () => {
    const [owner, initTokenHolder, user1, user2] = await ethers.getSigners();

    const initTotalSupply = $(110);
    const totalYieldAmount = $(10);

    const contract = await new DoubleDiceTokenInternal__factory(owner).deploy(initTotalSupply, totalYieldAmount, initTokenHolder.address);
    const helper = new TokenHelper(contract);

    const [checkBal, checkUnc] = helper.createTokensCheck({
      UNDISTRIBUTED: UNDISTRIBUTED_YIELD_ACCOUNT,
      UNCLAIMED: UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT,
      initTokenHolder,
      user1,
      user2,
    });

    await checkBal('10 | 0 | 100 |  0 |  0');
    await checkUnc(' 0 | 0 |   0 |  0 |  0');

    await (await contract.connect(user1).claimYield()).wait();
    await checkBal('10 | 0 | 100 |  0 |  0');
    await checkUnc(' 0 | 0 |   0 |  0 |  0');

    await (await contract.connect(user2).claimYield()).wait();
    await checkBal('10 | 0 | 100 |  0 |  0');
    await checkUnc(' 0 | 0 |   0 |  0 |  0');


    await helper.transfer(initTokenHolder, user1, $(20));
    await checkBal('10 | 0 |  80 | 20 |  0');
    await checkUnc(' 0 | 0 |   0 |  0 |  0');

    await (await contract.connect(user1).claimYield()).wait();
    await checkBal('10 | 0 |  80 | 20 |  0');
    await checkUnc(' 0 | 0 |   0 |  0 |  0');

    await (await contract.connect(user2).claimYield()).wait();
    await checkBal('10 | 0 |  80 | 20 |  0');
    await checkUnc(' 0 | 0 |   0 |  0 |  0');


    await helper.transfer(initTokenHolder, user2, $(30));
    await checkBal('10 | 0 |  50 | 20 | 30');
    await checkUnc(' 0 | 0 |   0 |  0 |  0');

    await (await contract.connect(user1).claimYield()).wait();
    await checkBal('10 | 0 |  50 | 20 | 30');
    await checkUnc(' 0 | 0 |   0 |  0 |  0');

    await (await contract.connect(user2).claimYield()).wait();
    await checkBal('10 | 0 |  50 | 20 | 30');
    await checkUnc(' 0 | 0 |   0 |  0 |  0');
  });

});
