import { expect } from 'chai';
import { waffle } from 'hardhat';
import { DoubleDiceToken, DoubleDiceToken__factory } from '../typechain';
import { $ } from './utils';

const TOTAL_YIELD_AMOUNT = $(37);
const TOTAL_SUPPLY = $(100);

let UNDISTRIBUTED_YIELD_ACCOUNT: string;
let UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT: string;

let contract: DoubleDiceToken;

describe('Total Supply', () => {
  const [owner, tokenHolder, user1, user2] = waffle.provider.getWallets();

  const ownerSigner = waffle.provider.getSigner(owner.address);
  const tokenHolderSigner = waffle.provider.getSigner(tokenHolder.address);
  const user1Signer = waffle.provider.getSigner(user1.address);
  const user2Signer = waffle.provider.getSigner(user2.address);

  it('Should succeed with 4B/6B init yield/holdings split', async () => {
    await (await new DoubleDiceToken__factory(ownerSigner).deploy(
      $(10_000_000_000n),
      $(4_000_000_000n),
      tokenHolder.address
    )).deployed();
  });

  it('UNDISTRIBUTED YIELD ACCOUNT  should get allocated yield amount.', async () => {
    contract = await new DoubleDiceToken__factory(ownerSigner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    await contract.deployed();

    UNDISTRIBUTED_YIELD_ACCOUNT = await contract.UNDISTRIBUTED_YIELD_ACCOUNT();
    UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT =
      await contract.UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT();

    expect(await contract.balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      TOTAL_YIELD_AMOUNT
    );
  });

  it('Token holder should have same balance to (total supply - yield amount )', async () => {
    contract = await new DoubleDiceToken__factory(ownerSigner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    await contract.deployed();

    UNDISTRIBUTED_YIELD_ACCOUNT = await contract.UNDISTRIBUTED_YIELD_ACCOUNT();
    UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT =
      await contract.UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT();

    expect(await contract.balanceOf(tokenHolder.address)).to.eq(
      TOTAL_SUPPLY.sub(TOTAL_YIELD_AMOUNT)
    );
  });
});

describe('DoubleDiceToken', () => {
  const [owner, tokenHolder, user1, user2] = waffle.provider.getWallets();

  const ownerSigner = waffle.provider.getSigner(owner.address);
  const tokenHolderSigner = waffle.provider.getSigner(tokenHolder.address);
  const user1Signer = waffle.provider.getSigner(user1.address);
  const user2Signer = waffle.provider.getSigner(user2.address);

  beforeEach('Deploy Token', async () => {
    contract = await new DoubleDiceToken__factory(ownerSigner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    await contract.deployed();

    UNDISTRIBUTED_YIELD_ACCOUNT = await contract.UNDISTRIBUTED_YIELD_ACCOUNT();
    UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT =
      await contract.UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT();
  });

  it('base case', async function () {
    expect(await contract.totalSupply()).to.eq($(100));
    expect(await contract.balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT)).to.eq($(37));
    expect(await contract.balanceOf(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      $(0)
    );
    expect(await contract.balanceOf(tokenHolder.address)).to.eq($(63));

    await (
      await contract.connect(tokenHolderSigner).transfer(user1.address, $(10))
    ).wait();
    await (
      await contract.connect(tokenHolderSigner).transfer(user2.address, $(10))
    ).wait();

    expect(await contract.balanceOf(user1.address)).to.eq($(10));
    expect(await contract.balanceOf(user2.address)).to.eq($(10));
    expect(await contract.unclaimedYieldOf(user1.address)).to.eq($(0));
    expect(await contract.unclaimedYieldOf(user2.address)).to.eq($(0));

    await (await contract.distributeYield($(7), [])).wait();
    expect(await contract.balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      TOTAL_YIELD_AMOUNT.sub($(7))
    );
    expect(await contract.balanceOf(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      $(7)
    );

    expect(await contract.balanceOf(user1.address)).to.eq($(10));
    expect(await contract.balanceOf(user2.address)).to.eq($(10));
    expect(await contract.unclaimedYieldOf(user1.address)).to.eq(
      $(7).mul(10).div(63)
    );
    expect(await contract.unclaimedYieldOf(user2.address)).to.eq(
      $(7).mul(10).div(63)
    );

    await (await contract.connect(user1Signer).claimYield()).wait();
    expect(await contract.balanceOf(user1.address)).to.eq(
      $(10).add($(7).mul(10).div(63))
    );
    expect(await contract.balanceOf(user2.address)).to.eq($(10));
    expect(await contract.balanceOf(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      $(7).sub($(7).mul(10).div(63))
    );

    await (await contract.connect(user2Signer).claimYield()).wait();
    expect(await contract.balanceOf(user1.address)).to.eq(
      $(10).add($(7).mul(10).div(63))
    );
    expect(await contract.balanceOf(user2.address)).to.eq(
      $(10).add($(7).mul(10).div(63))
    );
    expect(await contract.balanceOf(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT)).to.eq(
      $(7).sub($(7).mul(10).div(63)).sub($(7).mul(10).div(63))
    );
  });

  describe('Transfer', () => {
    const USER1_TRANSFER_AMOUNT = $(10);
    const USER2_TRANSFER_AMOUNT = $(20);

    const AMOUNT_TO_DISTRIBUTE = $(5);

    it('Should not be able to to transfer to reserved account', async () => {
      await expect(
        contract.transfer(UNDISTRIBUTED_YIELD_ACCOUNT, $(10))
      ).to.be.revertedWith('Transfer to reserved account');
    });

    it('Should not be able to transfer from a reserved account', async () => {
      await expect(
        contract.transferFrom(
          UNDISTRIBUTED_YIELD_ACCOUNT,
          tokenHolder.address,
          $(10)
        )
      ).to.be.revertedWith('Transfer from reserved account');
    });

    it('Should have the same cumulativeYield after transferring certain tokens.', async () => {
      // Transferring tokens to User 1 and User 2
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user1.address, USER1_TRANSFER_AMOUNT)
      ).wait();
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user2.address, USER2_TRANSFER_AMOUNT)
      ).wait();

      await (
        await contract
          .connect(ownerSigner)
          .distributeYield(AMOUNT_TO_DISTRIBUTE, [])
      ).wait();

      const user1CumulativeYield = await contract.unclaimedYieldOf(
        user1.address
      );
      const user2CumulativeYield = await contract.unclaimedYieldOf(
        user2.address
      );

      // User 1 transfers all his balance to user 2
      await (
        await contract
          .connect(user1Signer)
          .transfer(user2.address, USER1_TRANSFER_AMOUNT)
      ).wait();

      // then
      expect(await contract.unclaimedYieldOf(user1.address)).to.eq(
        user1CumulativeYield
      );
      expect(await contract.unclaimedYieldOf(user2.address)).to.eq(
        user2CumulativeYield
      );
    });

    it('Should have zero cumulative yield if the user has transferred all his balance and if there was no yield distribution in the past.', async () => {
      // Transferring tokens to User 1 and User 2
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user1.address, USER1_TRANSFER_AMOUNT)
      ).wait();
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user2.address, USER2_TRANSFER_AMOUNT)
      ).wait();

      // User 1 transfers all his balance to user 2
      await (
        await contract
          .connect(user1Signer)
          .transfer(user2.address, USER1_TRANSFER_AMOUNT)
      ).wait();

      // then
      expect(await contract.unclaimedYieldOf(user1.address)).to.eq(0);
      expect(await contract.unclaimedYieldOf(user2.address)).to.eq(0);
    });

    it('Should not be able to transfer unclaimed yield tokens even if the user has an unclaimed amount greater than zero.', async () => {
      // Transferring tokens to User 1 and User 2
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user1.address, USER1_TRANSFER_AMOUNT)
      ).wait();
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user2.address, USER2_TRANSFER_AMOUNT)
      ).wait();

      await (
        await contract
          .connect(ownerSigner)
          .distributeYield(AMOUNT_TO_DISTRIBUTE, [])
      ).wait();

      // User 1 transfers all his balance to user 2
      await (
        await contract
          .connect(user1Signer)
          .transfer(user2.address, USER1_TRANSFER_AMOUNT)
      ).wait();

      // then
      expect(await contract.unclaimedYieldOf(user1.address)).to.gt(0);

      const unclaimedYieldOfUser1 = await contract.unclaimedYieldOf(
        user1.address
      );

      expect(await contract.balanceOf(user1.address)).to.eq(0);

      await expect(
        contract
          .connect(user1Signer)
          .transfer(user2.address, unclaimedYieldOfUser1)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should be able to transfer yield tokens after claiming them.', async () => {
      // Transferring tokens to User 1 and User 2
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user1.address, USER1_TRANSFER_AMOUNT)
      ).wait();
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user2.address, USER2_TRANSFER_AMOUNT)
      ).wait();

      await (
        await contract
          .connect(ownerSigner)
          .distributeYield(AMOUNT_TO_DISTRIBUTE, [])
      ).wait();

      // User 1 transfers all his balance to user 2
      await (
        await contract
          .connect(user1Signer)
          .transfer(user2.address, USER1_TRANSFER_AMOUNT)
      ).wait();

      expect(await contract.unclaimedYieldOf(user1.address)).to.gt(0);

      const unclaimedYieldOfUser1 = await contract.unclaimedYieldOf(
        user1.address
      );

      expect(await contract.balanceOf(user1.address)).to.eq(0);

      await (await contract.claimYieldFor(user1.address)).wait();

      await (
        await contract
          .connect(user1Signer)
          .transfer(user2.address, unclaimedYieldOfUser1)
      ).wait();

      // User 2 balance should be = user1ClaimedAndTransferredAmount + User2OriginalBalance + User1TransferAmountToUser2
      expect(await contract.balanceOf(user2.address)).to.eq(
        unclaimedYieldOfUser1
          .add(USER2_TRANSFER_AMOUNT)
          .add(USER1_TRANSFER_AMOUNT)
      );
    });

    it('Cumulative yield should not change after the user received some tokens.', async () => {
      // Transferring tokens to User 1 and User 2
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user1.address, USER1_TRANSFER_AMOUNT)
      ).wait();
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user2.address, USER2_TRANSFER_AMOUNT)
      ).wait();

      await (
        await contract
          .connect(ownerSigner)
          .distributeYield(AMOUNT_TO_DISTRIBUTE, [])
      ).wait();

      const user2CumulativeYield = await contract.unclaimedYieldOf(
        user2.address
      );

      // User 1 transfers all his balance to user 2
      await (
        await contract
          .connect(user1Signer)
          .transfer(user2.address, USER1_TRANSFER_AMOUNT)
      ).wait();

      // assert user 2 received the transfer
      expect(await contract.balanceOf(user2.address)).to.eq(
        USER1_TRANSFER_AMOUNT.add(USER2_TRANSFER_AMOUNT)
      );

      // user 2 cumulative yield should not change
      expect(await contract.unclaimedYieldOf(user2.address)).to.eq(
        user2CumulativeYield
      );
    });
  });

  describe('Burn', () => {
    const USER1_TRANSFER_AMOUNT = $(10);
    const AMOUNT_TO_DISTRIBUTE = $(5);

    it('Only owner of the contract should be able to burn undistributed yield amount', async () => {
      await expect(
        contract.connect(user1Signer).burnUndistributedYield($(1))
      ).to.be.revertedWith('caller is not the owner');
    });

    it('Owner Should not be able to distribute yield anymore if all the UNDISTRIBUTED YIELD AMOUNT is burnt.', async () => {
      await contract.burnUndistributedYield(
        await contract.balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT)
      );

      await expect(contract.distributeYield($(1), [])).to.be.revertedWith(
        'transfer amount exceeds balance'
      );
    });
  });

  describe('distribute yield', () => {
    const USER1_TRANSFER_AMOUNT = $(10);
    const AMOUNT_TO_DISTRIBUTE = $(5);

    it('excluding the distubte yield account ', async () => {
      // Transferring tokens to User 1
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user1.address, USER1_TRANSFER_AMOUNT)
      ).wait();

      await expect(
        contract
          .connect(ownerSigner)
          .distributeYield(AMOUNT_TO_DISTRIBUTE, [UNDISTRIBUTED_YIELD_ACCOUNT])
      ).to.be.revertedWith('Reserved account');

      await expect(
        contract
          .connect(ownerSigner)
          .distributeYield(AMOUNT_TO_DISTRIBUTE, [
            UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT,
          ])
      ).to.be.revertedWith('Reserved account');
    });
  });

  describe('Claiming', () => {
    const USER1_TRANSFER_AMOUNT = $(10);
    const AMOUNT_TO_DISTRIBUTE = $(5);

    it('Claiming for reserved accounts should fail !', async () => {
      await (
        await contract.connect(ownerSigner).distributeYield($(10), [])
      ).wait();

      await expect(
        contract.unclaimedYieldOf(UNDISTRIBUTED_YIELD_ACCOUNT)
      ).to.be.revertedWith('Reserved account');

      await expect(
        contract.claimYieldFor(UNDISTRIBUTED_YIELD_ACCOUNT)
      ).to.be.revertedWith('Reserved account');
    });

    it('Claiming an unclaimed amount should reflect on the user balance.', async () => {
      // Transferring tokens to User 1
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user1.address, USER1_TRANSFER_AMOUNT)
      ).wait();

      await (
        await contract
          .connect(ownerSigner)
          .distributeYield(AMOUNT_TO_DISTRIBUTE, [])
      ).wait();

      const unclaimedYieldOfUser1 = await contract.unclaimedYieldOf(
        user1.address
      );

      // User claiming his yield
      await contract.claimYieldFor(user1.address);

      // then it should reflect on the balance
      expect(await contract.balanceOf(user1.address)).to.eq(
        USER1_TRANSFER_AMOUNT.add(unclaimedYieldOfUser1)
      );
    });

    it('Cumulative yield should be zero after claiming all unclaimed amounts.', async () => {
      // Transferring tokens to User 1
      await (
        await contract
          .connect(tokenHolderSigner)
          .transfer(user1.address, USER1_TRANSFER_AMOUNT)
      ).wait();

      await (
        await contract
          .connect(ownerSigner)
          .distributeYield(AMOUNT_TO_DISTRIBUTE, [])
      ).wait();

      // User claiming his yield
      await contract.claimYieldFor(user1.address);

      // then
      expect(await contract.unclaimedYieldOf(user1.address)).to.eq(0);
    });
  });
});
