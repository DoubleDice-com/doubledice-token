import { ethers } from 'hardhat';
import { DoubleDiceTokenInternal__factory } from '../typechain';
import { UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, UNDISTRIBUTED_YIELD_ACCOUNT } from './lib/constants';
import { $, EvmCheckpoint, TokenHelper } from './lib/utils';

describe('DEX', () => {

  it('basic DEX scenario', async () => {
    const [owner, tokenHolder, user1, user2, dex] = await ethers.getSigners();

    const contract = await new DoubleDiceTokenInternal__factory(owner).deploy($(100), $(37), tokenHolder.address);
    const helper = new TokenHelper(contract);

    await (await contract.connect(tokenHolder).transfer(user1.address, $(30))).wait();
    await (await contract.connect(tokenHolder).transfer(user2.address, $(30))).wait();
    await (await contract.connect(tokenHolder).transfer(dex.address, $(3))).wait();

    await helper.balanceCheck(user1, { balance: $(30), unclaimed: 0 });
    await helper.balanceCheck(user2, { balance: $(30), unclaimed: 0 });
    await helper.balanceCheck(dex, { balance: $(3), unclaimed: 0 });
    await helper.balanceCheck(UNDISTRIBUTED_YIELD_ACCOUNT, { balance: $(37) });
    await helper.balanceCheck(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, { balance: $(0) });


    const checkpoint = await EvmCheckpoint.create();


    await (await contract.distributeYield($(10), [])).wait();

    await helper.balanceCheck(user1, { balance: $(30), unclaimed: $(10).mul(30).div(63) });
    await helper.balanceCheck(user2, { balance: $(30), unclaimed: $(10).mul(30).div(63) });
    await helper.balanceCheck(dex, { balance: $(3), unclaimed: $(10).mul(3).div(63) });
    await helper.balanceCheck(UNDISTRIBUTED_YIELD_ACCOUNT, { balance: $(27) });
    await helper.balanceCheck(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, { balance: $(10) });

    console.log((await contract.factor()).toString());


    checkpoint.revertTo();


    await (await contract.distributeYield($(10), [dex.address])).wait();

    await helper.balanceCheck(user1, { balance: $(30), unclaimed: $(10).mul(30).div(60).add(/*err =*/-1) });
    await helper.balanceCheck(user2, { balance: $(30), unclaimed: $(10).mul(30).div(60).add(/*err =*/-1) });
    await helper.balanceCheck(dex, { balance: $(3), unclaimed: 0 });
    await helper.balanceCheck(UNDISTRIBUTED_YIELD_ACCOUNT, { balance: $(27) });
    await helper.balanceCheck(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, { balance: $(10) });

    console.log((await contract.factor()).toString());
  });

  it('basic DEX scenario № 2', async () => {
    const [owner, tokenHolder, user1, user2, dex, thirdParty] = await ethers.getSigners();

    const initTotalSupply = $(110);
    const totalYieldAmount = $(10);

    const contract = await new DoubleDiceTokenInternal__factory(owner).deploy(initTotalSupply, totalYieldAmount, tokenHolder.address);
    const helper = new TokenHelper(contract);

    await helper.transfer(tokenHolder, user1, $(49));
    await helper.transfer(tokenHolder, user2, $(49));
    await helper.transfer(tokenHolder, dex, $(2));

    const [checkBal, checkUnc] = helper.createTokensCheck({
      UNDISTRIBUTED: UNDISTRIBUTED_YIELD_ACCOUNT,
      UNCLAIMED: UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT,
      user1: user1,
      user2: user2,
      DEX: dex
    });

    await checkBal('10 | 0 | 49 | 49 | 2');
    await checkUnc(' 0 | 0 |  0 |  0 | 0');

    await helper.distributeYield($(4));
    await checkBal('6 | 4 | 49.00 | 49.00 | 2.00');
    await checkUnc('0 | 0 |  1.96 |  1.96 | 0.08');

    await helper.transfer(user1, user2, $(10));
    await checkBal('6 | 4 | 39.00 | 59.00 | 2.00');
    await checkUnc('0 | 0 |  1.96 |  1.96 | 0.08');

    await (await contract.connect(user1).claimYield()).wait();
    await checkBal('6 | 2.04 | 40.96 | 59.00 | 2.00');
    await checkUnc('0 | 0.00 |  0.00 |  1.96 | 0.08');

    await helper.transfer(user1, user2, $(10.96));
    await checkBal('6 | 2.04 | 30 | 69.96 | 2.00');
    await checkUnc('0 | 0.00 |  0 |  1.96 | 0.08');

    const checkpoint = await EvmCheckpoint.create();

    await helper.distributeYield($(1));
    // 30/104 * 1 = 0.288461_538461_538461
    // (69.96 + 1.96)/104 * 1 = 0.691538_461538_461538 ; 1.96 + 0.691538_461538_461538 = 2.651538_461538_461538 
    // (2 + 0.08)/104 * 1 = 0.02 ; 0.02 + 0.08 = 0.1
    await checkBal('5 | 3.04 | 30.000000_000000_000000 | 69.960000_000000_000000 | 2.0');
    await checkUnc('0 | 0.00 |  0.288461_538461_538461 |  2.651538_461538_461538 | 0.1');

    await (await contract.connect(thirdParty).claimYieldFor(user1.address)).wait();
    await checkBal('5 | 2.751538_461538_461539 | 30.288461_538461_538461 | 69.960000_000000_000000 | 2.0');
    await checkUnc('0 | 0.000000_000000_000000 |  0.000000_000000_000000 |  2.651538_461538_461538 | 0.1');

    await (await contract.connect(thirdParty).claimYieldFor(user2.address)).wait();
    await checkBal('5 | 0.100000_000000_000001 | 30.288461_538461_538461 | 72.611538_461538_461538 | 2.0');
    await checkUnc('0 | 0.000000_000000_000000 |  0.000000_000000_000000 |  0.000000_000000_000000 | 0.1');

    await (await contract.connect(thirdParty).claimYieldFor(dex.address)).wait();
    await checkBal('5 | 0.000000_000000_000001 | 30.288461_538461_538461 | 72.611538_461538_461538 | 2.1');
    await checkUnc('0 | 0.000000_000000_000000 |  0.000000_000000_000000 |  0.000000_000000_000000 | 0.0');

    await checkpoint.revertTo();
  });

});
