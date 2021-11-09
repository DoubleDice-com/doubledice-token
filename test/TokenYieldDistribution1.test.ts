import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DoubleDiceToken__factory } from '../typechain-types';
import { $, EvmCheckpoint, TokenHelper } from './lib/utils';

describe('Yield distribution', () => {
  const TOTAL_YIELD_AMOUNT = $(10);
  const HIGH_YIELD_AMOUNT = $(11);
  const NEGATIVE_YIELD_AMOUNT = $(-10);
  const YIELD_AMOUNT_1 = $(6);
  const YIELD_AMOUNT_2 = $(4);
  const TOTAL_SUPPLY = $(110);
  const user1Supply = $(50);
  const user1SupplyAll = $(100);
  const user2Supply = $(50);

  it('splitting distribution into stages should not affect final balances', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();

    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const helper = new TokenHelper(contract);
    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();

    const checkpoint = await EvmCheckpoint.create();

    await (await contract.distributeYield(TOTAL_YIELD_AMOUNT, [])).wait();
    const { balance: balanceAfterCaseA, unclaimed: unclaimedAfterCaseA } =
      await helper.getBalances(user1);

    checkpoint.revertTo();

    await (await contract.distributeYield(YIELD_AMOUNT_1, [])).wait();
    await (await contract.distributeYield(YIELD_AMOUNT_2, [])).wait();
    const { balance: balanceAfterCaseB, unclaimed: unclaimedAfterCaseB } =
      await helper.getBalances(user1);

    checkpoint.revertTo();

    await (await contract.distributeYield(YIELD_AMOUNT_1, [])).wait();
    await contract.connect(user1).claimYield();
    await (await contract.distributeYield(YIELD_AMOUNT_2, [])).wait();
    const { balance: balanceAfterCaseC, unclaimed: unclaimedAfterCaseC } =
      await helper.getBalances(user1);

    expect(unclaimedAfterCaseA).to.eq(unclaimedAfterCaseB);
    expect(balanceAfterCaseA.add(unclaimedAfterCaseA)).to.eq(
      balanceAfterCaseB.add(unclaimedAfterCaseB)
    );
    expect(balanceAfterCaseA.add(unclaimedAfterCaseA)).to.eq(
      balanceAfterCaseC.add(unclaimedAfterCaseC)
    );
  });

  it('Case 1: UNDistributed Yield should decrease with the same amount after yield distribution', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const UNDISTRIBUTED_YIELD_ACCOUNT =
      await contract.UNDISTRIBUTED_YIELD_ACCOUNT();

    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();
    await (await contract.distributeYield(TOTAL_YIELD_AMOUNT, [])).wait();
    expect(await contract.balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      TOTAL_YIELD_AMOUNT.sub(TOTAL_YIELD_AMOUNT)
    );
  });

  it('Case 2 : Revert if amount to be distributed is greater than UNDISTRIBUTED YIELD', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();
    await expect(contract.distributeYield(HIGH_YIELD_AMOUNT, [])).to.be.revertedWith('ERC20: transfer amount exceeds balance');
  });

  it('Case 3 : Revert if the amount to be distributed is NEGATIVE', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();
    try {
      await (await contract.distributeYield(NEGATIVE_YIELD_AMOUNT, [])).wait();
    } catch (error) {
      console.error('Reverted : Amount distributed is NEGATIVE');
    }
  });

  it('Case 4 : Should not change cumulative Yield if the amount distributed is ZERO', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const helper = new TokenHelper(contract);
    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();
    await (await contract.distributeYield($(0), [])).wait();
    const { unclaimed: unclaimedAfterCaseA } = await helper.getBalances(user1);
    expect(unclaimedAfterCaseA).to.eq($(0));
    const { unclaimed: unclaimedAfterCaseB } = await helper.getBalances(user2);
    expect(unclaimedAfterCaseB).to.eq($(0));
  });

  it('Case 5 : Should increase cumulative yield if points distributed ( yielded ) is greater than zero', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const helper = new TokenHelper(contract);
    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();
    await (await contract.distributeYield(TOTAL_YIELD_AMOUNT, [])).wait();
    const { unclaimed: unclaimedAfterCaseA } = await helper.getBalances(user1);
    expect(unclaimedAfterCaseA).to.gt($(0));
    const { unclaimed: unclaimedAfterCaseB } = await helper.getBalances(user2);
    expect(unclaimedAfterCaseB).to.gt($(0));
  });

  it('Case 6 : Excluded accounts should have same cumulative yield before distribution', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const helper = new TokenHelper(contract);
    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();
    await (
      await contract.distributeYield(TOTAL_YIELD_AMOUNT, [user2.address])
    ).wait();
    const { unclaimed: unclaimedAfterCaseB } = await helper.getBalances(user2);
    expect(unclaimedAfterCaseB).to.eq($(0));
  });

  it('Case 7 : Cumulative yield should not change when we exclude accounts with zero balance on yielding distributions', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const helper = new TokenHelper(contract);
    await (
      await contract
        .connect(tokenHolder)
        .transfer(user1.address, user1SupplyAll)
    ).wait();
    await (
      await contract.distributeYield(TOTAL_YIELD_AMOUNT, [user2.address])
    ).wait();
    const { unclaimed: unclaimedAfterCaseA } = await helper.getBalances(user1);
    expect(unclaimedAfterCaseA).to.eq(TOTAL_YIELD_AMOUNT);
  });

  it('Case 8 : Cumulative yield should not be changed even when passing duplicate accounts to be excluded', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const helper = new TokenHelper(contract);
    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();
    const { unclaimed: unclaimedBeforeCaseA } = await helper.getBalances(user1);
    expect(unclaimedBeforeCaseA).to.eq($(0));
    await expect(contract.distributeYield(TOTAL_YIELD_AMOUNT, [user2.address, user2.address])).to.be.revertedWith('Duplicate/unordered account');
  });

  it('Case 9 : Unclaimed yield should increase when distribution happens', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const helper = new TokenHelper(contract);
    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();
    const { unclaimed: unclaimedBeforeCaseA } = await helper.getBalances(user1);
    expect(unclaimedBeforeCaseA).to.eq($(0));
    const { unclaimed: unclaimedBeforeCaseB } = await helper.getBalances(user2);
    expect(unclaimedBeforeCaseB).to.eq($(0));
    await (await contract.distributeYield(TOTAL_YIELD_AMOUNT, [])).wait();
    const { unclaimed: unclaimedAfterCaseA } = await helper.getBalances(user1);
    expect(unclaimedAfterCaseA).to.gt($(0));
    const { unclaimed: unclaimedAfterCaseB } = await helper.getBalances(user2);
    expect(unclaimedAfterCaseB).to.gt($(0));
  });

  it('Case 10 : Distributing to only one account should make sure all the amount yielded goes to his balance', async () => {
    const [owner, tokenHolder, user1] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const helper = new TokenHelper(contract);
    await (
      await contract
        .connect(tokenHolder)
        .transfer(user1.address, user1SupplyAll)
    ).wait();
    const { unclaimed: unclaimedBeforeCaseA } = await helper.getBalances(user1);
    expect(unclaimedBeforeCaseA).to.eq($(0));
    await (await contract.distributeYield(TOTAL_YIELD_AMOUNT, [])).wait();
    const { unclaimed: unclaimedAfterCaseA } = await helper.getBalances(user1);
    expect(unclaimedAfterCaseA).to.eq(TOTAL_YIELD_AMOUNT);
  });

  it('Case 11 : Distributing yield to only one account and including the account as an excluded account', async () => {
    const [owner, tokenHolder, user1] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    await (
      await contract
        .connect(tokenHolder)
        .transfer(user1.address, user1SupplyAll)
    ).wait();
    try {
      await (
        await contract.distributeYield(TOTAL_YIELD_AMOUNT, [user1.address])
      ).wait();
    } catch (error) {
      console.error('Yield cannot be distrbuted between 0 token holders');
    }
  });

  it('Case 12 : Claimable yield of reserved accounts should be zero always even after a yield distribution', async () => {
    const [owner, tokenHolder, user1, user2] = await ethers.getSigners();
    const contract = await new DoubleDiceToken__factory(owner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    const UNDISTRIBUTED_YIELD_ACCOUNT =
      await contract.UNDISTRIBUTED_YIELD_ACCOUNT();
    const UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT =
      await contract.UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT();
    await (
      await contract.connect(tokenHolder).transfer(user1.address, user1Supply)
    ).wait();
    await (
      await contract.connect(tokenHolder).transfer(user2.address, user2Supply)
    ).wait();
    expect(await contract.balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      TOTAL_YIELD_AMOUNT
    );
    await (await contract.distributeYield(TOTAL_YIELD_AMOUNT, [])).wait();
    expect(await contract.balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT)).to.eq($(0));
    expect(await contract.balanceOf(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      TOTAL_YIELD_AMOUNT
    );
    await contract.connect(user1).claimYield();
    await contract.connect(user2).claimYield();
    expect(await contract.balanceOf(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      $(0)
    );
  });
});
