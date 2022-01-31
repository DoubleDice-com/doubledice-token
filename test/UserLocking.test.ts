import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { ethers } from 'hardhat';
import { DoubleDiceToken, DoubleDiceUserTokenLocking, DoubleDiceToken__factory, DoubleDiceUserTokenLocking__factory } from '../typechain-types';

import { $, currentBlockTime } from './lib/utils';

chai.use(chaiAsPromised);

describe('DoubleDiceTokenLocking', () => {

  let tokenOwner: SignerWithAddress;
  let tokenHolder: SignerWithAddress;
  let tokenLockingDeployer: SignerWithAddress;
  let USER1: SignerWithAddress;
  let USER2: SignerWithAddress;

  let token: DoubleDiceToken;
  let tokenLocking: DoubleDiceUserTokenLocking;

  const TOTAL_SUPPLY = $(10_000_000_000);
  const TOTAL_YIELD_AMOUNT = $(4_000_000_000);
  const MINIMIUM_LOCK_AMOUNT = $(1_000);
  const ZERO_ETHER_ADDRESS = '0x0000000000000000000000000000000000000000';

  let days = 91;

  const today = new Date();
  const timestamp = (today.setDate(today.getDate() + days)) / 1000;
  const expiryTime = Math.floor(timestamp);

  before(async () => {
    [tokenOwner, tokenHolder, tokenLockingDeployer, USER1, USER2] = await ethers.getSigners();

    const token = await new DoubleDiceToken__factory(tokenOwner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    await token.deployed();

  });


  describe('Contract deployment', () => {

    it('Should return error when invalid token address used', async () => {
      await expect(new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
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
      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
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
      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
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

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      await expect(
        tokenLocking.connect(tokenHolder).createLock($(1_000), 0)
      ).to.be.revertedWith('Expiry can not be equal to zero');

    });

    it('Should revert with the right error message if expiry time is too low', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
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

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      const timestamp = (today.setDate(today.getDate() + 365)) / 1000;
      const expiryTime = Math.floor(timestamp);

      await expect(
        tokenLocking.connect(tokenHolder).createLock($(1_00), expiryTime)
      ).to.be.revertedWith('Token amount is too low');

    });

    it('Should assert right event emitted when locking tokens', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      const timestamp = (today.setDate(today.getDate() + 365)) / 1000;
      const expiryTime = Math.floor(timestamp);
      const blockTimestamp = (await currentBlockTime()) + 1;

      const result = await tokenLocking.connect(tokenHolder).createLock($(1_000), expiryTime);
      const contractReceipt = await result.wait();

      const event = contractReceipt.events?.find(event => event.event === 'UserLockInfo');

      if (event) {
        const user = event.args?.['user'];
        const amount = event.args?.['amount'];
        const startTime = event.args?.['startTime'];
        const expiry = event.args?.['expiryTime'];

        expect(user).to.eq(tokenHolder.address);
        expect(amount).to.eq($(1_000));
        expect(startTime).to.eq(blockTimestamp);
        expect(expiry).to.eq(expiryTime);

      }


    });

    it('Should not be able to create multiple lock from user', async () => {
      const token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        USER2.address
      );

      const tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );

      await token.connect(USER2).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());

      const timestamp = (today.setDate(today.getDate() + 365)) / 1000;
      const expiryTime = Math.floor(timestamp);

      await tokenLocking.connect(USER2).createLock($(1_000), expiryTime);

      await expect(tokenLocking.connect(USER2).createLock($(2_000), expiryTime)).to.be.revertedWith('User already created a lock');


    });

    it('Should be able to check that the balance of contract is correct', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());
      const tokenAmount = $(1_000);
      const timestamp = (today.setDate(today.getDate() + 365)) / 1000;
      const expiryTime = Math.floor(timestamp);

      await tokenLocking.connect(tokenHolder).createLock($(1_000), expiryTime);

      expect(await token.balanceOf(tokenLocking.address)).to.eq(tokenAmount.toString());


    });

    it('Should check if user info is correct', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();

      await token.connect(tokenHolder).transfer(USER1.address, $(3_000));
      await token.connect(USER1).approve(tokenLocking.address, $(3_000));

      const timestamp = (today.setDate(today.getDate() + 365)) / 1000;
      const expiryTime = Math.floor(timestamp);
      const amount = $(1_000);

      expect(
        (await tokenLocking.connect(USER1).getUserLockInfo(USER1.address)).hasLock
      ).to.eq(false);

      await tokenLocking.connect(USER1).createLock(amount, expiryTime);

      expect(
        (await tokenLocking.connect(USER1).getUserLockInfo(USER1.address)).hasLock
      ).to.eq(true);

      expect(
        (await tokenLocking.connect(USER1).getUserLockInfo(USER1.address)).amount
      ).to.eq(amount.toString());

      expect(
        (await tokenLocking.connect(USER1).getUserLockInfo(USER1.address)).expiryTime
      ).to.eq(expiryTime);

    });

  });

  describe('claim', async () => {

    it('should check if claim have expired', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, MINIMIUM_LOCK_AMOUNT.toString());

      const timestamp = (today.setDate(today.getDate() + 365)) / 1000;
      const expiryTime = Math.floor(timestamp);

      await tokenLocking.connect(tokenHolder).createLock($(1_000), expiryTime);

      await expect(
        tokenLocking.connect(tokenHolder).claim()
      ).to.be.revertedWith('Asset have not expired');

    });

    it('should check if token have been claimed', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());

      const newTimeStamp = (await currentBlockTime()) + 3;
      const tokenAmount = $(1_000);

      (await tokenLocking.connect(tokenLockingDeployer).updateMinLockDuration(1)).wait();

      await tokenLocking.connect(tokenHolder).createLock(tokenAmount, newTimeStamp);

      await tokenLocking.connect(tokenHolder).claim();
      await expect(
        tokenLocking.connect(tokenHolder).claim()
      ).to.be.revertedWith('Asset have already been claimed');

    });

    it('should check successful claim', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
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

      await tokenLocking.connect(tokenHolder).createLock(tokenAmount, newTimeStamp);

      expect(await token.balanceOf(tokenHolder.address)).to.eq(newBalance.toString());

      expect(await tokenLocking.connect(tokenHolder).claim())
        .to.emit(tokenLocking, 'Claim')
        .withArgs(tokenHolder.address, tokenAmount);

      expect(await token.balanceOf(tokenHolder.address)).to.eq(ownerBalance.toString());

    });


  });

  describe('updateLockExpiry', async () => {

    it('should not be able update lock expiry', async () => {
      token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );
      await token.deployed();

      tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await tokenLocking.deployed();
      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());

      const timestamp = (today.setDate(today.getDate() + 365)) / 1000;
      const expiryTime = Math.floor(timestamp);
      const newTimeStamp = (await currentBlockTime()) + 3;
      const tokenAmount = $(1_000);

      await (await tokenLocking.connect(tokenLockingDeployer).updateMinLockDuration(1)).wait();
      await tokenLocking.connect(tokenHolder).createLock(tokenAmount, newTimeStamp);

      await expect(
        tokenLocking.connect(tokenHolder).updateLockExpiry(888888)
      ).to.be.revertedWith('Low new expiry date');

      await tokenLocking.connect(tokenHolder).claim();

      await expect(
        tokenLocking.connect(tokenHolder).updateLockExpiry(expiryTime)
      ).to.be.revertedWith('Asset have already been claimed');

    });

    it('should update lock expiry', async () => {
      const token = await new DoubleDiceToken__factory(tokenOwner).deploy(
        TOTAL_SUPPLY,
        TOTAL_YIELD_AMOUNT,
        tokenHolder.address
      );

      const tokenLocking = await new DoubleDiceUserTokenLocking__factory(tokenLockingDeployer).deploy(
        token.address,
        MINIMIUM_LOCK_AMOUNT
      );
      await token.connect(tokenHolder).approve(tokenLocking.address, TOTAL_YIELD_AMOUNT.toString());

      const today = new Date();
      let timestamp = (today.setDate(today.getDate() + 366)) / 1000;
      const oldExpiryTime = Math.floor(timestamp);

      timestamp = (today.setDate(today.getDate() + 367)) / 1000;

      const newExpiryTime1 = Math.floor(timestamp);

      timestamp = (today.setDate(today.getDate() + 368)) / 1000;

      const newExpiryTime2 = Math.floor(timestamp);
      const tokenAmount = $(1_000);

      await tokenLocking.connect(tokenHolder).createLock(tokenAmount, oldExpiryTime);
     

      await tokenLocking.connect(tokenHolder).updateLockExpiry(newExpiryTime1);

      const lockDetails = await tokenLocking.connect(tokenHolder).getUserLockInfo(tokenHolder.address);
      expect(lockDetails.expiryTime).to.eq(newExpiryTime1);

      expect(await tokenLocking.connect(tokenHolder).updateLockExpiry(newExpiryTime2))
        .to.emit(tokenLocking, 'UpdateLockExpiry')
        .withArgs(tokenHolder.address, oldExpiryTime, newExpiryTime2);

    });


  });


});
