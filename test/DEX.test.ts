import { ethers } from 'hardhat';
import { DoubleDiceTokenInternal__factory } from '../typechain';
import { $, EvmCheckpoint, TokenHelper, UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, UNDISTRIBUTED_YIELD_ACCOUNT } from './lib/utils';

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

});
