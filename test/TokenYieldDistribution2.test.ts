import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DoubleDiceToken__factory } from '../typechain';
import { $, EvmCheckpoint, TokenHelper } from './utils';

describe('Yield distribution (alternative)', () => {

  it('splitting distribution into stages should not affect final balances', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();

    const contract = await new DoubleDiceToken__factory(owner).deploy($(110), $(10), tokenHolder.address);
    const helper = new TokenHelper(contract);
    await (await contract.connect(tokenHolder).transfer(user1.address, $(50))).wait();
    await (await contract.connect(tokenHolder).transfer(user2.address, $(50))).wait();

    const checkpoint = await EvmCheckpoint.create();

    await (await contract.distributeYield($(10), [])).wait();
    const { balance: balanceAfterCaseA, unclaimed: unclaimedAfterCaseA } = await helper.getBalances(user1);

    checkpoint.revertTo();

    await (await contract.distributeYield($(6), [])).wait();
    await (await contract.distributeYield($(4), [])).wait();
    const { balance: balanceAfterCaseB, unclaimed: unclaimedAfterCaseB } = await helper.getBalances(user1);

    checkpoint.revertTo();

    await (await contract.distributeYield($(6), [])).wait();
    await contract.connect(user1).claimYield();
    await (await contract.distributeYield($(4), [])).wait();
    const { balance: balanceAfterCaseC, unclaimed: unclaimedAfterCaseC } = await helper.getBalances(user1);

    expect(unclaimedAfterCaseA).to.eq(unclaimedAfterCaseB);
    expect(balanceAfterCaseA.add(unclaimedAfterCaseA)).to.eq(balanceAfterCaseB.add(unclaimedAfterCaseB));
    expect(balanceAfterCaseA.add(unclaimedAfterCaseA)).to.eq(balanceAfterCaseC.add(unclaimedAfterCaseC));
  });

});
