import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { ethers } from 'hardhat';
import { DoubleDiceToken, DoubleDiceTokenLocking, DoubleDiceToken__factory, DoubleDiceTokenLocking__factory } from '../typechain-types';

import { $, currentBlockTime } from './lib/utils';

chai.use(chaiAsPromised);

describe('DoubleDiceTokenLocking', () => {

  let tokenOwner: SignerWithAddress;
  let tokenHolder: SignerWithAddress;
  let tokenLockingDeployer: SignerWithAddress;
  let USER1: SignerWithAddress;

  let token: DoubleDiceToken;
  let tokenLocking: DoubleDiceTokenLocking;

  const TOTAL_SUPPLY = $(10_000_000_000);
  const TOTAL_YIELD_AMOUNT = $(4_000_000_000);
  const MINIMIUM_LOCK_AMOUNT = $(1_000);
  const ZERO_ETHER_ADDRESS = '0x0000000000000000000000000000000000000000';

  let days = 91;

  const today = new Date();
  const timestamp = (today.setDate(today.getDate() + days)) / 1000;
  const expiryTime = Math.floor(timestamp);

  before(async () => {
    [tokenOwner, tokenHolder, tokenLockingDeployer, USER1] = await ethers.getSigners();

    const token = await new DoubleDiceToken__factory(tokenOwner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    await token.deployed();

  });


  describe('Contract deployment', () => {

    it('Should return error when invalid token address used', async () => {
      await expect(new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        ZERO_ETHER_ADDRESS,
        MINIMIUM_LOCK_AMOUNT
      )).to.be.revertedWith('Not a valid token address');
    });

    it('Should make sure token address is correct', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();
      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      expect(await tokenLocking.token()).to.eq(token.address);
    });

    it('Should make sure the minLockAmount is correct', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();
      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      expect(await tokenLocking.minLockAmount()).to.eq(MINIMIUM_LOCK_AMOUNT);

    });

  });

  describe('createLock', () => {

    it('Should revert is expiry time is zero', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      await expect(
        tokenLocking.connect(tokenHolder).createLock($(1_000), 0)
      ).to.be.revertedWith('Expiry must not be equal to zero');

    });

    it('Should revert with the right error message if expiry time is too low', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 30)) / 1000);

      await expect(
        tokenLocking.connect(tokenHolder).createLock($(1_000), expiryTime)
      ).to.be.revertedWith('Expiry time is too low');

    });

    it('Should revert with the right error message if the token amount is too low', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      days = 91;

      await expect(
        tokenLocking.connect(tokenHolder).createLock($(1_00), expiryTime)
      ).to.be.revertedWith('Token amount is too low');

    });

    it('Should be able to return correct address from lockId', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());
      days = 91;

      const result = await tokenLocking.connect(tokenHolder).createLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];
        expect((await tokenLocking.connect(tokenHolder).getlockIdOwners(lockId)).toString()).to.eq(tokenHolder.address);

      }

    });

    it('Should assert right event emitted when locking tokens', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      days = 91;
      const blockTimestamp = (await currentBlockTime()) + 1;

      const result = await tokenLocking.connect(tokenHolder).createLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();

      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {

        const lockId = event.args?.['lockId'];
        const beneficiary = event.args?.['beneficiary'];
        const amount = event.args?.['amount'];
        const startTime = event.args?.['startTime'];
        const expiry = event.args?.['expiryTime'];

        expect(beneficiary).to.eq(tokenHolder.address);
        expect(amount).to.eq($(1_000));
        expect(startTime).to.eq(blockTimestamp);
        expect(expiry).to.eq(expiryTime);

      }


    });

    it('Should be able to lock tokens more than once', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());

      days = 91;

      await tokenLocking.connect(tokenHolder).createLock($(1_000), expiryTime);
      const lock = await tokenLocking.connect(tokenHolder).createLock($(2_000), expiryTime);
      expect(lock.hash).is.not.empty;

    });

    it('Should be able to check that the balance of contract is correct', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());
      const tokenAmount = $(1_000);
      days = 91;

      await tokenLocking.connect(tokenHolder).createLock($(1_000), expiryTime);

      expect(await token.balanceOf(tokenLocking.address)).to.eq(tokenAmount.toString());


    });

  });

  describe('createVestingBasedLock', () => {

    it('Should revert if expiry time is zero', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await expect(
        tokenLocking.connect(tokenHolder).createVestingBasedLock($(1_000), 0)
      ).to.be.revertedWith('Expiry must not be equal to zero');

    });

    it('Should revert if expiry time is low', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 30)) / 1000);

      await expect(
        tokenLocking.connect(tokenHolder).createVestingBasedLock($(1_000), expiryTime)
      ).to.be.revertedWith('Expiry time is too low');

    });

    it('Should revert if token amount is low', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);

      await expect(
        tokenLocking.connect(tokenHolder).createVestingBasedLock($(1_00), expiryTime)
      ).to.be.revertedWith('Token amount is too low');

    });

    it('Should revert if sender is not whitelisted', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);

      await expect(
        tokenLocking.connect(tokenHolder).createVestingBasedLock($(1_000), expiryTime)
      ).to.be.revertedWith('Sender is not whitelisted');

    });

    it('Should revert if sender already have a reserved lock', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, $(3_000));
      await token.connect(USER1).approve(tokenLocking.address, $(3_000));

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);
      await tokenLocking.connect(USER1).createVestingBasedLock($(1_000), expiryTime);

      await expect(
        tokenLocking.connect(USER1).createVestingBasedLock($(1_000), expiryTime)
      ).to.be.revertedWith('Sender already have a reserved lock');

    });

    it('Should check if user info', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, $(3_000));
      await token.connect(USER1).approve(tokenLocking.address, $(3_000));

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);
      const amount = $(1_000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);

      expect(
        (await tokenLocking.connect(USER1).getUserVestedBaseLockInfo(USER1.address)).hasReservedLock
      ).to.eq(false);

      await tokenLocking.connect(USER1).createVestingBasedLock(amount, expiryTime);

      expect(
        (await tokenLocking.connect(USER1).getUserVestedBaseLockInfo(USER1.address)).hasReservedLock
      ).to.eq(true);

      expect(
        (await tokenLocking.connect(USER1).getUserVestedBaseLockInfo(USER1.address)).initialAmount
      ).to.eq(amount.toString());

      expect(
        (await tokenLocking.connect(USER1).getUserVestedBaseLockInfo(USER1.address)).updatedAmount
      ).to.eq(amount.toString());

    });

    it('Should check if lockIdOwners is correct', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, $(3_000));
      await token.connect(USER1).approve(tokenLocking.address, $(3_000));

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);

      const result = await tokenLocking.connect(USER1).createVestingBasedLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];
        expect(
          await tokenLocking.connect(USER1).getlockIdOwners(lockId)
        ).to.eq(USER1.address);

      }

    });

    it('Should check if createVestingBasedLock succeeds', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, $(3_000));
      await token.connect(USER1).approve(tokenLocking.address, $(3_000));

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);

      const result = await tokenLocking.connect(USER1).createVestingBasedLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];
        const beneficiary = event.args?.['beneficiary'];
        const amount = event.args?.['amount'];
        const startTime = event.args?.['startTime'];
        const expiry = event.args?.['expiryTime'];

        expect(beneficiary).to.eq(USER1.address);
        expect(amount).to.eq($(1_000));
        // expect(startTime).to.eq(currentTime);
        expect(expiry).to.eq(expiryTime);

        const lockDetails = await tokenLocking.connect(USER1).getLockDetails(USER1.address, lockId);

        expect(lockDetails.amount).to.eq($(1_000));
        // expect(lockDetails.startTime).to.eq(currentTime);
        expect(lockDetails.expiryTime).to.eq(expiry);
        expect(lockDetails.claimed).to.eq(false);


        expect(await token.balanceOf(tokenLocking.address)).to.eq(amount.toString());

      }

    });

  });

  describe('topupVestingBasedLock', async () => {

    it('Should check if lockId belongs to sender', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, $(3_000));
      await token.connect(USER1).approve(tokenLocking.address, $(3_000));

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);

      const result = await tokenLocking.connect(USER1).createVestingBasedLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];

        await expect(
          tokenLocking.connect(tokenHolder).topupVestingBasedLock(lockId, $(1_000))
        ).to.be.revertedWith('LockId does not belong to sender');

      }

    });

    it('Should if amount exceed the reserved lock', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, TOTAL_YIELD_AMOUNT);
      await token.connect(USER1).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT);

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);
      const amount = $(1_000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);

      const result = await tokenLocking.connect(USER1).createVestingBasedLock(amount, expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];

        await expect(
          tokenLocking.connect(USER1).topupVestingBasedLock(lockId, $(9_000))
        ).to.be.revertedWith('Amount exceed the reserved amount');

      }


    });

    it('Should not work with invalid lock id', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, TOTAL_YIELD_AMOUNT);
      await token.connect(USER1).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT);

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);
      const amount = $(1_000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);

      const result = await tokenLocking.connect(USER1).createLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();

      await tokenLocking.connect(USER1).createVestingBasedLock($(1_000), expiryTime);

      const events = contractReceipt.events?.find(event => event.event === 'Lock');

      if (events) {
        const lockId = events.args?.['lockId'];

        await expect(
          tokenLocking.connect(USER1).topupVestingBasedLock(lockId, amount)
        ).to.be.revertedWith('Invalid Lock id');
      }
    });

    it('Should if updating reserveLock succeeds', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, TOTAL_YIELD_AMOUNT);
      await token.connect(USER1).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT);

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);
      const amount = $(1_000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);

      const result = await tokenLocking.connect(USER1).createVestingBasedLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];

        await tokenLocking.connect(USER1).topupVestingBasedLock(lockId, amount);

        const userVestedBaseLockInfo = await tokenLocking.connect(USER1).getUserVestedBaseLockInfo(USER1.address);
        const lockDetails = await tokenLocking.connect(USER1).getLockDetails(USER1.address, lockId);

        const totalAmount = amount.add($(1_000));

        expect(userVestedBaseLockInfo.updatedAmount).to.eq(totalAmount);
        expect(lockDetails.amount).to.eq(totalAmount);

        expect(await tokenLocking.connect(USER1).topupVestingBasedLock(lockId, amount))
          .to.emit(tokenLocking, 'TopupVestingBasedLock')
          .withArgs(lockId, USER1.address, amount);

      }


    });

  });

  describe('claim', async () => {

    it('Should check if lockId belongs to sender', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();


      await token.connect(tokenHolder).transfer(USER1.address, $(3_000));
      await token.connect(USER1).approve(tokenLocking.address, $(3_000));

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);

      const result = await tokenLocking.connect(USER1).createVestingBasedLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];

        await expect(
          tokenLocking.connect(tokenHolder).topupVestingBasedLock(lockId, $(1_000))
        ).to.be.revertedWith('LockId does not belong to sender');

      }

    });

    it('should if claim have expired', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);

      const result = await tokenLocking.connect(tokenHolder).createLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];
        await expect(
          tokenLocking.connect(tokenHolder).claim(lockId)
        ).to.be.revertedWith('Asset have not expired');
      }

    });

    it('should check if token have been claimed', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());

      const newTimeStamp = (await currentBlockTime()) + 3;
      const tokenAmount = $(1_000);

      (await await tokenLocking.connect(tokenLockingDeployer).updateMinLockDuration(1)).wait();

      const result = await tokenLocking.connect(tokenHolder).createLock(tokenAmount, newTimeStamp);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];
        await tokenLocking.connect(tokenHolder).claim(lockId);
        await expect(
          tokenLocking.connect(tokenHolder).claim(lockId)
        ).to.be.revertedWith('Asset have already been claimed');
      }

    });

    it('should check successful claim', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());

      const newTimeStamp = (await currentBlockTime()) + 3;
      const tokenAmount = $(1_000);
      const ownerBalance = await token.balanceOf(tokenHolder.address);
      const newBalance = ownerBalance.sub(tokenAmount);

      await (await tokenLocking.connect(tokenLockingDeployer).updateMinLockDuration(1)).wait();

      const result = await tokenLocking.connect(tokenHolder).createLock(tokenAmount, newTimeStamp);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];
        expect(await token.balanceOf(tokenHolder.address)).to.eq(newBalance.toString());

        expect(await tokenLocking.connect(tokenHolder).claim(lockId))
          .to.emit(tokenLocking, 'Claim')
          .withArgs(lockId, tokenHolder.address);

        expect(await token.balanceOf(tokenHolder.address)).to.eq(ownerBalance.toString());

      }


    });


  });

  describe('updateLockExpiry', async () => {

    it('Should check if lockId belongs to sender', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, $(3_000));
      await token.connect(USER1).approve(tokenLocking.address, $(3_000));

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);

      await tokenLocking.connect(tokenLockingDeployer).addToWhiteList(USER1.address);

      const result = await tokenLocking.connect(USER1).createVestingBasedLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];

        await expect(
          tokenLocking.connect(tokenHolder).topupVestingBasedLock(lockId, $(1_000))
        ).to.be.revertedWith('LockId does not belong to sender');

      }

    });

    it('should not be able update lock expiry', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());

      const expiryTime = Math.floor((new Date().setDate(new Date().getDate() + 91)) / 1000);
      const newTimeStamp = (await currentBlockTime()) + 3;
      const tokenAmount = $(1_000);

      await (await tokenLocking.connect(tokenLockingDeployer).updateMinLockDuration(1)).wait();
      const result = await tokenLocking.connect(tokenHolder).createLock(tokenAmount, newTimeStamp);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];
        await expect(
          tokenLocking.connect(tokenHolder).updateLockExpiry(lockId, 888888)
        ).to.be.revertedWith('Low new expiry date');

        await tokenLocking.connect(tokenHolder).claim(lockId);

        await expect(
          tokenLocking.connect(tokenHolder).updateLockExpiry(lockId, expiryTime)
        ).to.be.revertedWith('Asset have already been claimed');
      }


    });

    it('should update lock expiry', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());

      const today = new Date();
      const expiryTime = Math.floor((today.setDate(today.getDate() + 91)) / 1000);
      const newExpiryTime1 = Math.floor((today.setDate(today.getDate() + 100)) / 1000);
      const newExpiryTime2 = Math.floor((today.setDate(today.getDate() + 120)) / 1000);
      const tokenAmount = $(1_000);

      const result = await tokenLocking.connect(tokenHolder).createLock(tokenAmount, expiryTime);
      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'Lock');

      if (event) {
        const lockId = event.args?.['lockId'];

        await tokenLocking.connect(tokenHolder).updateLockExpiry(lockId, newExpiryTime1);
        const lockDetails = await tokenLocking.connect(tokenHolder).getLockDetails(tokenHolder.address, lockId);
        expect(lockDetails.expiryTime).to.eq(newExpiryTime1);

        expect(await tokenLocking.connect(tokenHolder).updateLockExpiry(lockId, newExpiryTime2))
          .to.emit(tokenLocking, 'UpdateLockExpiry')
          .withArgs(lockId, tokenHolder.address, newExpiryTime1, newExpiryTime2);

      }

    });


  });


});
