import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber, ContractFactory } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { DoubleDiceToken } from '../typechain';
import { DoubleDiceTokenVesting as TokenVesting } from '../typechain';
import { checkErrorRevert, currentBlockTime, forwardTime, toBigNumber } from './utils';


chai.use(solidity);


describe('Token Vesting Simple Test ', () => {
  let token: DoubleDiceToken;
  let currentTime: number;
  let vestingContractFactory: any;

  const SECONDS_PER_MONTH = 2628000;
  const [
    tokenHolder,
    /* skipped */,
    /* skipped */,
    USER0,
    USER1,
    USER2,
    USER3,
    USER4,
    USER5,
    USER6,
    USER7,
    USER8,
    USER9,
    USER10
  ] = waffle.provider.getWallets();
  const USER_0_SIGNER = waffle.provider.getSigner(USER0.address);
  const USER_1_SIGNER = waffle.provider.getSigner(USER1.address);
  const USER_2_SIGNER = waffle.provider.getSigner(USER2.address);
  const USER_3_SIGNER = waffle.provider.getSigner(USER3.address);
  const USER_4_SIGNER = waffle.provider.getSigner(USER4.address);
  const USER_5_SIGNER = waffle.provider.getSigner(USER5.address);
  const USER_6_SIGNER = waffle.provider.getSigner(USER6.address);
  const USER_7_SIGNER = waffle.provider.getSigner(USER7.address);
  const USER_8_SIGNER = waffle.provider.getSigner(USER8.address);
  const USER_9_SIGNER = waffle.provider.getSigner(USER9.address);
  const USER_10_SIGNER = waffle.provider.getSigner(USER10.address);
  const tokenHolderSigner = waffle.provider.getSigner(tokenHolder.address);

  const USER_1_GRANT_AMOUNT = toBigNumber(1200);
  const USER_2_GRANT_AMOUNT = toBigNumber(500);
  const USER_3_GRANT_AMOUNT = toBigNumber(750);
  const USER_4_GRANT_AMOUNT = toBigNumber(23);
  const USER_5_GRANT_AMOUNT = toBigNumber(650);
  const USER_6_GRANT_AMOUNT = toBigNumber(800);
  const USER_7_GRANT_AMOUNT = toBigNumber(198);
  const USER_8_GRANT_AMOUNT = toBigNumber(350);
  const USER_9_GRANT_AMOUNT = toBigNumber(1001);
  const USER_10_GRANT_AMOUNT = toBigNumber(1091);
  const TOTAL_YIELD_AMOUNT = toBigNumber(2000);

  const TOTAL_SUPPLY = USER_1_GRANT_AMOUNT.add(USER_2_GRANT_AMOUNT)
    .add(USER_3_GRANT_AMOUNT)
    .add(USER_4_GRANT_AMOUNT)
    .add(USER_5_GRANT_AMOUNT)
    .add(USER_6_GRANT_AMOUNT)
    .add(USER_7_GRANT_AMOUNT)
    .add(USER_8_GRANT_AMOUNT)
    .add(USER_9_GRANT_AMOUNT)
    .add(USER_10_GRANT_AMOUNT)
    .add(TOTAL_YIELD_AMOUNT);

  const USERS_VESTING_CONTRACTS: Array<TokenVesting> = [];

  let USER_1_VESTING_CONTRACT: TokenVesting;

  beforeEach(async () => {
    currentTime = await currentBlockTime();
    const factory = await ethers.getContractFactory('DoubleDiceToken');
    token = (await factory.deploy(
      TOTAL_SUPPLY.toBigInt(),
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    )) as DoubleDiceToken;
    vestingContractFactory = (await ethers.getContractFactory(
      'DoubleDiceTokenVesting'
    )) as ContractFactory;
  });

  describe('when creating vesting contract for a user ', () => {
    it('should create grant correctly, when a startDate in the past is used', async () => {
      const vestingDuration = 24;
      const vestingCliff = 6;

      USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(
            USER_1_VESTING_CONTRACT.address,
            USER_1_GRANT_AMOUNT.toBigInt()
          )
      ).wait();

      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime - SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          0
        )
      ).wait();

      const grant = await USER_1_VESTING_CONTRACT.tokenGrant();

      expect(grant.startTime).to.equal(currentTime - SECONDS_PER_MONTH);
      expect(grant.amount).to.eq(USER_1_GRANT_AMOUNT);
      expect(grant.vestingDuration).to.eq(vestingDuration);
      expect(grant.vestingCliff).to.eq(vestingCliff);
      expect(grant.monthsClaimed).to.eq(0);
      expect(grant.totalClaimed).to.eq(0);

      const user1ContractBalance = await token.balanceOf(
        USER_1_VESTING_CONTRACT.address
      );
      expect(user1ContractBalance).to.eq(USER_1_GRANT_AMOUNT);
    });

    it('should create grant correctly, when a startDate in the future is used', async () => {
      const vestingDuration = 24;
      const vestingCliff = 6;

      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, USER_1_GRANT_AMOUNT)
      ).wait();

      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          0
        )
      ).wait();

      const grant = await USER_1_VESTING_CONTRACT.tokenGrant();

      expect(grant.startTime).to.equal(currentTime + SECONDS_PER_MONTH);
      expect(grant.amount).to.eq(USER_1_GRANT_AMOUNT);
      expect(grant.vestingDuration).to.eq(vestingDuration);
      expect(grant.vestingCliff).to.eq(vestingCliff);
      expect(grant.monthsClaimed).to.eq(0);
      expect(grant.totalClaimed).to.eq(0);

      const user1ContractBalance = await token.balanceOf(
        USER_1_VESTING_CONTRACT.address
      );
      expect(user1ContractBalance).to.eq(USER_1_GRANT_AMOUNT);
    });

    it('should create grant correctly, using the current time, when no startDate was passed', async () => {
      const vestingDuration = 24;
      const vestingCliff = 6;

      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, USER_1_GRANT_AMOUNT)
      ).wait();

      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          0,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          0
        )
      ).wait();

      const grant = await USER_1_VESTING_CONTRACT.tokenGrant();

      expect(grant.startTime.toNumber()).to.be.closeTo(currentTime, 10);
      expect(grant.amount).to.eq(USER_1_GRANT_AMOUNT);
      expect(grant.vestingDuration).to.eq(vestingDuration);
      expect(grant.vestingCliff).to.eq(vestingCliff);
      expect(grant.monthsClaimed).to.eq(0);
      expect(grant.totalClaimed).to.eq(0);

      const user1ContractBalance = await token.balanceOf(
        USER_1_VESTING_CONTRACT.address
      );
      expect(user1ContractBalance).to.eq(USER_1_GRANT_AMOUNT);
    });

    it('should log correct event', async () => {
      const vestingDuration = 24;
      const vestingCliff = 6;

      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(
            USER_1_VESTING_CONTRACT.address,
            USER_1_GRANT_AMOUNT.toBigInt()
          )
      ).wait();

      await expect(
        USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          0
        )
      )
        .to.emit(USER_1_VESTING_CONTRACT, 'GrantAdded')
        .withArgs(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff
        );
    });

    it('should error if called by anyone but the Contract Owner', async () => {
      const vestingDuration = 24;
      const vestingCliff = 6;

      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, USER_1_GRANT_AMOUNT)
      ).wait();

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_0_SIGNER).addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          0
        )
      ).to.be.revertedWith('caller is not the owner');

    });

    it('should error if duration is 0', async () => {
      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, USER_1_GRANT_AMOUNT)
      ).wait();

      await expect(
        USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          0,
          6,
          0
        )
      ).to.be.revertedWith('cliff-longer-than-duration');
    });

    it('should error if there is an existing grant', async () => {
      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, USER_1_GRANT_AMOUNT)
      ).wait();

      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          24,
          6,
          0
        )
      ).wait();

      await expect(
        USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          24,
          6,
          0
        )
      ).to.be.revertedWith('token-user-grant-exists');

    });

    it('should error if cliff is 0', async () => {
      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, USER_1_GRANT_AMOUNT)
      ).wait();

      await expect(
        USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          0,
          0,
          0
        )
      ).to.be.revertedWith('zero-vesting-cliff');
    });

    it('should error if amount/duration is not greater than zero', async () => {
      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, USER_1_GRANT_AMOUNT)
      ).wait();


      await expect(
        USER_1_VESTING_CONTRACT.addTokenGrant(0, 0, 24, 6, 0)
      ).to.be.revertedWith('Initial claimable should be less than the total amount');
    });

    it('should error on grant amount overflow', async () => {
      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(
            USER_1_VESTING_CONTRACT.address,
            USER_1_GRANT_AMOUNT.mul(USER_1_GRANT_AMOUNT).toBigInt()
          )
      ).wait();

      await expect(
        USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.mul(USER_1_GRANT_AMOUNT).toBigInt(),
          24,
          6,
          0
        )
      ).to.be.revertedWith('revert');
    });

    it('should error on grant duration overflow', async () => {
      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(
            USER_1_VESTING_CONTRACT.address,
            USER_1_GRANT_AMOUNT.mul(USER_1_GRANT_AMOUNT).toBigInt()
          )
      ).wait();

      await checkErrorRevert(
        USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          toBigNumber(10).mul(toBigNumber(10)),
          6,
          0
        ),
        'out-of-bounds'
      );
    });

    it('should error if grant amount cannot be transferred', async () => {
      const USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      await checkErrorRevert(
        USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          24,
          6,
          USER_1_GRANT_AMOUNT.div(4)
        ),
        'revert'
      );
    });
  });

  describe('when removing token grants', () => {
    let USER_1_VESTING_CONTRACT: TokenVesting;
    const vestingDuration = 24;
    const vestingCliff = 6;
    const USER_1_INITIAL_CLAIMABLE = USER_1_GRANT_AMOUNT.div(4);
    beforeEach(async () => {

      USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, USER_1_GRANT_AMOUNT)
      ).wait();

      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_INITIAL_CLAIMABLE
        )
      ).wait();
    });

    it('should remove the grant and destruct contract', async () => {
      await (await USER_1_VESTING_CONTRACT.removeTokenGrant()).wait();

      await expect(
        USER_1_VESTING_CONTRACT.tokenGrant()
      ).to.be.revertedWith('null');
    });

    it('should log correct event', async () => {
      await expect(
        USER_1_VESTING_CONTRACT.removeTokenGrant()
      )
        .to.emit(USER_1_VESTING_CONTRACT, 'GrantRemoved')
        .withArgs(
          0,
          USER_1_GRANT_AMOUNT.sub(USER_1_INITIAL_CLAIMABLE),
        );
    });

    it('should return non-vested tokens', async () => {
      const balanceBefore = await token.balanceOf(tokenHolder.address);
      await forwardTime(SECONDS_PER_MONTH);

      await (await USER_1_VESTING_CONTRACT.removeTokenGrant()).wait();
      const userEarnedToken = await token.balanceOf(USER1.address);

      const balanceAfter = await token.balanceOf(tokenHolder.address);

      const balanceChange = balanceAfter.sub(balanceBefore).toString();
      expect(balanceChange).to.eq(USER_1_GRANT_AMOUNT.sub(userEarnedToken));
      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_INITIAL_CLAIMABLE);
    });

    it('should return non-vested tokens and vested tokens to the user also the initial claimable', async () => {
      const balanceBefore = await token.balanceOf(tokenHolder.address);
      await forwardTime(SECONDS_PER_MONTH * 7);

      const grantClaimResponse = await USER_1_VESTING_CONTRACT.calculateGrantClaim();
      await (await USER_1_VESTING_CONTRACT.removeTokenGrant()).wait();

      const userEarnedToken = await token.balanceOf(USER1.address);

      const balanceAfter = await token.balanceOf(tokenHolder.address);

      const balanceChange = balanceAfter.sub(balanceBefore).toString();
      expect(balanceChange).to.eq(USER_1_GRANT_AMOUNT.sub(userEarnedToken));
      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_INITIAL_CLAIMABLE.add(grantClaimResponse[1]));
    });

    it('should give grant recipient any vested amount', async () => {
      const balanceBefore = await token.balanceOf(USER1.address);
      await forwardTime(SECONDS_PER_MONTH);

      await (await USER_1_VESTING_CONTRACT.removeTokenGrant()).wait();

      const balanceAfter = await token.balanceOf(USER1.address);
      const balanceChange = balanceAfter.sub(balanceBefore).toString();
      expect(balanceChange).to.eq(toBigNumber(300));
    });

    it('should return the correct amounts if there have been tokens claimed already', async () => {
      const tokenHolderBalanceBefore = await token.balanceOf(tokenHolder.address);
      const userBalanceBefore = await token.balanceOf(USER1.address);

      // 7 months vested and claimed
      await forwardTime(SECONDS_PER_MONTH * 7);
      const grantClaimAfter7month = await USER_1_VESTING_CONTRACT.calculateGrantClaim();
      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()).wait();
      // Another 6 months vested and claimed
      await forwardTime(SECONDS_PER_MONTH * 6);
      const grantClaimAfter13month = await USER_1_VESTING_CONTRACT.calculateGrantClaim();
      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()).wait();
      const balanceAfterClaimsRecipient = await token.balanceOf(USER1.address);
      const balanceChangeAfterClaimsRecipient = balanceAfterClaimsRecipient
        .sub(userBalanceBefore)
        .toString();
      expect(balanceChangeAfterClaimsRecipient).to.eq(grantClaimAfter7month[1].add(grantClaimAfter13month[1]));

      // Another 3 months vested but not claimed
      await forwardTime(SECONDS_PER_MONTH * 3);
      const grantClaimAfter16month = await USER_1_VESTING_CONTRACT.calculateGrantClaim();
      // 16 months vested of which 13 months claimed, another 6 months not yet vested
      await (await USER_1_VESTING_CONTRACT.removeTokenGrant()).wait();

      const balanceAfterRecipient = await token.balanceOf(USER1.address);
      const balanceChangeRecipient = balanceAfterRecipient
        .sub(balanceAfterClaimsRecipient)
        .toString();
      // Expecting 3 months worth of vested unclaimed tokens here
      expect(balanceChangeRecipient).to.eq(grantClaimAfter16month[1].add(USER_1_INITIAL_CLAIMABLE));
      // Expectingt their total balanace to be 16 months worth of vested tokens
      expect(balanceAfterRecipient.sub(userBalanceBefore)).to.eq(
        grantClaimAfter7month[1].add(grantClaimAfter13month[1])
          .add(grantClaimAfter16month[1]).add(USER_1_INITIAL_CLAIMABLE).sub(userBalanceBefore)
      );

      const balanceAfterMultiSig = await token.balanceOf(tokenHolder.address);
      const balanceChangeMultiSig = balanceAfterMultiSig
        .sub(tokenHolderBalanceBefore)
        .toString();
      // Expecting non-vested tokens here to = total grant amount - 16 months worth of vested tokens
      const vestedAmountOver16Months = grantClaimAfter7month[1].add(grantClaimAfter13month[1]).add(grantClaimAfter16month[1]);
      expect(balanceChangeMultiSig).to.eq(USER_1_GRANT_AMOUNT.sub(vestedAmountOver16Months).sub(USER_1_INITIAL_CLAIMABLE));
    });

    it('should be able to add a new grant when removed', async () => {
      await (await USER_1_VESTING_CONTRACT.removeTokenGrant()).wait();


      USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, USER_1_GRANT_AMOUNT)
      ).wait();

      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          24,
          6,
          0
        )
      ).wait();

      const grant = await USER_1_VESTING_CONTRACT.tokenGrant();
      expect(grant.amount).to.eq(USER_1_GRANT_AMOUNT);
    });

    it('should error if called by anyone but the Owner', async () => {
      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_0_SIGNER).removeTokenGrant()
      ).to.be.revertedWith('caller is not the owner');

      const grant = await USER_1_VESTING_CONTRACT.tokenGrant();
      expect(grant.amount).to.eq(USER_1_GRANT_AMOUNT);
    });


    it('should transfer yield to the user', async () => {
      const userBalanceBefore = await token.balanceOf(USER1.address);

      const amountToDistribute = BigNumber.from(20);

      await token.approve(tokenHolder.address, token.address);
      await (await token.connect(tokenHolderSigner).distributeYield(amountToDistribute, [])).wait();

      const withdrawAbleYield = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);

      await (await USER_1_VESTING_CONTRACT.removeTokenGrant()).wait();

      expect(await token.balanceOf(USER1.address)).to.eq(userBalanceBefore.add(withdrawAbleYield));
    });

  });

  describe('when claiming vested tokens', () => {
    let USER_1_VESTING_CONTRACT: TokenVesting;
    const vestingDuration = 24;
    const vestingCliff = 6;
    let userGrant: any;
    beforeEach(async () => {
      USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, TOTAL_SUPPLY.toBigInt())
      ).wait();

      userGrant = await USER_1_VESTING_CONTRACT.tokenGrant();
    });

    it('should NOT be able to claim within the first month', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          0
        )
      ).wait();

      await forwardTime(3600);

      const balanceBefore = await token.balanceOf(USER1.address);
      expect(balanceBefore).to.eq(0);

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()
      ).to.be.revertedWith('token-zero-amount-vested');

      const balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter).to.eq(0);
    });

    it('should NOT be able to claim before cliff reached', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          0
        )
      ).wait();

      await forwardTime(SECONDS_PER_MONTH * vestingCliff - 3600);
      const balanceBefore = await token.balanceOf(USER1.address);
      expect(balanceBefore).to.eq(0);

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()
      ).to.be.revertedWith('token-zero-amount-vested');

      const balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter).to.eq(0);
    });

    it('should NOT be able to claim a non-existent grant', async () => {
      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()
      ).to.be.revertedWith('token-zero-amount-vested');
    });

    it('should log correct event', async () => {

      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          0
        )
      ).wait();

      await forwardTime(SECONDS_PER_MONTH * 24);
      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()
      )
        .to.emit(USER_1_VESTING_CONTRACT, 'GrantTokensClaimed')
        .withArgs(
          USER_1_GRANT_AMOUNT.toBigInt()
        );
    });

    const account1GrantProperties = [
      { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 6 }, // 24 months duration, 6 months cliff cases
      { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 7 },
      { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 8 },
      { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 9 },
      { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 10 },
      { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 11 },
      { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 12 },
      { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 18 },
      { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 24 },
      { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 1 }, // 6 months duration, 1 month cliff cases
      { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 2 },
      { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 3 },
      { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 4 },
      { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 5 },
      { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 6 },
      { duration: 15, cliff: 2, startTimeMonthsBeforeNow: 1, monthsElapsed: 1 }, // Other mixed cases of valid grant options
      { duration: 18, cliff: 4, startTimeMonthsBeforeNow: 3, monthsElapsed: 10 },
      { duration: 25, cliff: 7, startTimeMonthsBeforeNow: 1, monthsElapsed: 21 },
      { duration: 33, cliff: 10, startTimeMonthsBeforeNow: 2, monthsElapsed: 26 },
      { duration: 36, cliff: 9, startTimeMonthsBeforeNow: 4, monthsElapsed: 24 },
      { duration: 40, cliff: 12, startTimeMonthsBeforeNow: 6, monthsElapsed: 20 }
    ];

    account1GrantProperties.forEach(async grantProp => {
      it(`${grantProp.monthsElapsed} months after grant start date, user should be able to claim ${grantProp.monthsElapsed}/${grantProp.duration + grantProp.startTimeMonthsBeforeNow} of their total token grant`, async () => {
        const currentTime = await currentBlockTime();
        await (
          await USER_1_VESTING_CONTRACT.addTokenGrant(
            currentTime -
            grantProp.startTimeMonthsBeforeNow * SECONDS_PER_MONTH,
            USER_1_GRANT_AMOUNT.toBigInt(),
            grantProp.duration,
            grantProp.cliff,
            0
          )
        ).wait();

        const timeToForward = SECONDS_PER_MONTH * grantProp.monthsElapsed;
        await forwardTime(timeToForward);
        const balanceBefore = await token.balanceOf(USER1.address);
        expect(balanceBefore).to.eq(0);

        const calculatedGrantClaim = await USER_1_VESTING_CONTRACT.calculateGrantClaim();
        expect(calculatedGrantClaim[0]).to.eq(
          grantProp.monthsElapsed + grantProp.startTimeMonthsBeforeNow
        );

        await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()).wait();
        const balanceAfter = await token.balanceOf(USER1.address);

        let expectedClaimedAmount;
        if (grantProp.monthsElapsed >= grantProp.duration) {
          expectedClaimedAmount = USER_1_GRANT_AMOUNT;
        } else {
          expectedClaimedAmount = USER_1_GRANT_AMOUNT.div(
            grantProp.duration
          ).mul(grantProp.monthsElapsed + grantProp.startTimeMonthsBeforeNow);
        }

        expect(balanceAfter).to.eq(expectedClaimedAmount);

        const tokenGrant = await USER_1_VESTING_CONTRACT.tokenGrant();

        expect(tokenGrant.monthsClaimed).to.eq(
          grantProp.monthsElapsed + grantProp.startTimeMonthsBeforeNow
        );
        expect(tokenGrant.totalClaimed).to.eq(expectedClaimedAmount);
      });
    });

    const grantProperties = [
      { account: USER1, amount: USER_1_GRANT_AMOUNT, duration: 24, cliff: 6 }, // claim at month 6, 20, 24
      { account: USER2, amount: USER_2_GRANT_AMOUNT, duration: 24, cliff: 5 }, // claim at month 6, 20, 24
      { account: USER3, amount: USER_3_GRANT_AMOUNT, duration: 12, cliff: 1 }, // claim at month 1, 12
      { account: USER4, amount: USER_4_GRANT_AMOUNT, duration: 36, cliff: 12 }, // claim at month 12, 20, 24, 36
      { account: USER5, amount: USER_5_GRANT_AMOUNT, duration: 33, cliff: 12 }, // claim at month 12, 20, 24, 36
      { account: USER6, amount: USER_6_GRANT_AMOUNT, duration: 28, cliff: 9 }, // claim at month 12, 24, 36
      { account: USER7, amount: USER_7_GRANT_AMOUNT, duration: 20, cliff: 2 }, // claim at month 2, 17, 20
      { account: USER8, amount: USER_8_GRANT_AMOUNT, duration: 12, cliff: 3 }, // claim at month 3, 12
      { account: USER9, amount: USER_9_GRANT_AMOUNT, duration: 16, cliff: 4 }, // claim at month 4, 17
      { account: USER10, amount: USER_10_GRANT_AMOUNT, duration: 6, cliff: 1 } // claim at month 1, 12
    ];

    it('should be able to handle multiple grants correctly over time', async () => {
      await Promise.all(
        grantProperties.map(async (grantProp, indx) => {
          USERS_VESTING_CONTRACTS[indx] = (await vestingContractFactory.deploy(
            token.address,
            tokenHolder.address,
            grantProp.account.address
          )) as TokenVesting;

          // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
          await (
            await token
              .connect(tokenHolderSigner)
              .approve(
                USERS_VESTING_CONTRACTS[indx].address,
                grantProp.amount.toBigInt()
              )
          ).wait();

          await (
            await USERS_VESTING_CONTRACTS[indx].addTokenGrant(
              0,
              grantProp.amount.toBigInt(),
              grantProp.duration,
              grantProp.cliff,
              0
            )
          ).wait();
        })
      );

      let balanceBefore;
      let balanceAfter;
      // Go forward 1 month
      await forwardTime(SECONDS_PER_MONTH);
      // Check account 3 and 10 can claim correctly
      balanceBefore = await token.balanceOf(USER3.address);
      await USERS_VESTING_CONTRACTS[2].connect(USER_3_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER3.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_3_GRANT_AMOUNT.div(12)
      );

      balanceBefore = await token.balanceOf(USER10.address);
      await USERS_VESTING_CONTRACTS[9].connect(USER_10_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER10.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_10_GRANT_AMOUNT.div(6)
      );

      // Go forward another 1 month, to the end of month 2 since grants created
      await forwardTime(SECONDS_PER_MONTH);
      // Check account 7 can claim correctly
      balanceBefore = await token.balanceOf(USER7.address);
      await USERS_VESTING_CONTRACTS[6].connect(USER_7_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER7.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_7_GRANT_AMOUNT.div(20).mul(2)
      );

      // Go forward another 1 month, to the end of month 3 since grants created
      await forwardTime(SECONDS_PER_MONTH);
      // Check account 8 can claim correctly
      balanceBefore = await token.balanceOf(USER8.address);
      await USERS_VESTING_CONTRACTS[7].connect(USER_8_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER8.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_8_GRANT_AMOUNT.div(12).mul(3)
      );

      // Go forward another 1 month, to the end of month 4 since grants created
      await forwardTime(SECONDS_PER_MONTH);
      // Check account 9 can claim correctly
      balanceBefore = await token.balanceOf(USER9.address);
      await USERS_VESTING_CONTRACTS[8].connect(USER_9_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER9.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_9_GRANT_AMOUNT.div(16).mul(4)
      );

      // Go forward another 2 months, to the end of month 6 since grants created
      await forwardTime(SECONDS_PER_MONTH * 2);
      // Check accounts 1 and 2 can claim correctly
      balanceBefore = await token.balanceOf(USER1.address);
      await USERS_VESTING_CONTRACTS[0].connect(USER_1_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_1_GRANT_AMOUNT.div(24).mul(6)
      );

      balanceBefore = await token.balanceOf(USER2.address);
      await USERS_VESTING_CONTRACTS[1].connect(USER_2_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER2.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_2_GRANT_AMOUNT.div(24).mul(6)
      );

      // Go forward another 6 months, to the end of month 12 since grants created
      await forwardTime(SECONDS_PER_MONTH * 6);
      // Check accounts 4, 5 and 6 can claim correctly
      balanceBefore = await token.balanceOf(USER4.address);
      await USERS_VESTING_CONTRACTS[3].connect(USER_4_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER4.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_4_GRANT_AMOUNT.div(36).mul(12)
      );

      balanceBefore = await token.balanceOf(USER5.address);
      await USERS_VESTING_CONTRACTS[4].connect(USER_5_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER5.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_5_GRANT_AMOUNT.div(33).mul(12)
      );

      balanceBefore = await token.balanceOf(USER6.address);
      await USERS_VESTING_CONTRACTS[5].connect(USER_6_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER6.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_6_GRANT_AMOUNT.div(28).mul(12)
      );

      // Check account 3, 8 and 10 can claim their entire left grant
      await USERS_VESTING_CONTRACTS[2].connect(USER_3_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER3.address);
      expect(balanceAfter).to.eq(USER_3_GRANT_AMOUNT);

      await USERS_VESTING_CONTRACTS[7].connect(USER_8_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER8.address);
      expect(balanceAfter).to.eq(USER_8_GRANT_AMOUNT);

      await USERS_VESTING_CONTRACTS[9].connect(USER_10_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER10.address);
      expect(balanceAfter).to.eq(USER_10_GRANT_AMOUNT);

      // Go forward another 5 months, to the end of month 17 since grants created
      await forwardTime(SECONDS_PER_MONTH * 5);
      // Check account 9 can claim their entire left grant
      await USERS_VESTING_CONTRACTS[8].connect(USER_9_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER9.address);
      expect(balanceAfter).to.eq(USER_9_GRANT_AMOUNT);

      // Check account 7 can claim (15 months vested tokens) correctly
      balanceBefore = await token.balanceOf(USER7.address);
      await USERS_VESTING_CONTRACTS[6].connect(USER_7_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER7.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_7_GRANT_AMOUNT.div(20).mul(17 - 2)
      );

      // Go forward another 3 months, to the end of month 20 since grants created
      await forwardTime(SECONDS_PER_MONTH * 3);
      // Check account 7 can claim their entire left grant
      await USERS_VESTING_CONTRACTS[6].connect(USER_7_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER7.address);
      expect(balanceAfter).to.eq(USER_7_GRANT_AMOUNT);

      // Check accounts 1, 2, 4 and 5 can claim correctly
      balanceBefore = await token.balanceOf(USER1.address);
      await USERS_VESTING_CONTRACTS[0].connect(USER_1_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_1_GRANT_AMOUNT.div(24).mul(20 - 6)
      );

      balanceBefore = await token.balanceOf(USER2.address);
      await USERS_VESTING_CONTRACTS[1].connect(USER_2_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER2.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_2_GRANT_AMOUNT.div(24).mul(20 - 6)
      );

      balanceBefore = await token.balanceOf(USER4.address);
      await USERS_VESTING_CONTRACTS[3].connect(USER_4_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER4.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_4_GRANT_AMOUNT.div(36).mul(20 - 12)
      );

      balanceBefore = await token.balanceOf(USER5.address);
      await USERS_VESTING_CONTRACTS[4].connect(USER_5_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER5.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_5_GRANT_AMOUNT.div(33).mul(20 - 12)
      );

      // Go forward another 4 months, to the end of month 24 since grants created
      await forwardTime(SECONDS_PER_MONTH * 4);
      // Check account 1 and 2 can claim their entire left grant
      await USERS_VESTING_CONTRACTS[0].connect(USER_1_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter).to.eq(USER_1_GRANT_AMOUNT);

      await USERS_VESTING_CONTRACTS[1].connect(USER_2_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER2.address);
      expect(balanceAfter).to.eq(USER_2_GRANT_AMOUNT);

      // Check accounts 4, 5 and 6 can claim correctly
      balanceBefore = await token.balanceOf(USER4.address);
      await USERS_VESTING_CONTRACTS[3].connect(USER_4_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER4.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_4_GRANT_AMOUNT.div(36).mul(24 - 20)
      );

      balanceBefore = await token.balanceOf(USER5.address);
      await USERS_VESTING_CONTRACTS[4].connect(USER_5_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER5.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_5_GRANT_AMOUNT.div(33).mul(24 - 20)
      );

      balanceBefore = await token.balanceOf(USER6.address);
      await USERS_VESTING_CONTRACTS[5].connect(USER_6_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER6.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_6_GRANT_AMOUNT.div(28).mul(24 - 12)
      );

      // Go forward another 12 months, to the end of month 36 since grants created
      await forwardTime(SECONDS_PER_MONTH * 12);
      // Check account 4, 5 and 6 can claim their entire left grant
      await USERS_VESTING_CONTRACTS[3].connect(USER_4_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER4.address);
      expect(balanceAfter).to.eq(USER_4_GRANT_AMOUNT);

      await USERS_VESTING_CONTRACTS[4].connect(USER_5_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER5.address);
      expect(balanceAfter).to.eq(USER_5_GRANT_AMOUNT);

      await USERS_VESTING_CONTRACTS[5].connect(USER_6_SIGNER).claimVestedTokens();
      balanceAfter = await token.balanceOf(USER6.address);
      expect(balanceAfter).to.eq(USER_6_GRANT_AMOUNT);
    });
  });

  describe('when adding token grant with initial claimable amount ', () => {

    let USER_1_VESTING_CONTRACT: TokenVesting;
    const vestingDuration = 24;
    const vestingCliff = 6;
    let userGrant: any;
    const INITIAL_CLAIMABLE_PERCENT = 12;

    beforeEach(async () => {
      USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, TOTAL_SUPPLY.toBigInt())
      ).wait();
    });


    it('should create with the right claimable amount specified ', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();

      userGrant = await USER_1_VESTING_CONTRACT.tokenGrant();

      expect(userGrant.initiallyClaimableAmount).to.eq(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100));

    });


    it('should NOT be able to add token grant with initial claim able more than or equal to the total amount ', async () => {
      await expect(
        USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.toBigInt()
        )
      ).to.be.revertedWith('Initial claimable should be less than the total amount');
    });

    it('should be able to claim and see the exact amount on the user\'s balance ', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()).wait();

      expect(await token.balanceOf(USER1.address)).eq(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100));

    });

    it('should NOT be able to collect initial claimable amount twice ', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()).wait();

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()
      ).to.be.revertedWith('Initial claimable already collected');

    });

    it('should NOT be able to collect before token grant start time ', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()
      ).to.be.revertedWith('Initial claimable not claimable before token grant start time');

    });

    it('should emit event with respective argument', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();


      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()
      )
        .to.emit(USER_1_VESTING_CONTRACT, 'InitialGrantTokensClaimed')
        .withArgs(
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        );

    });

    it('should be able to claim their total vested tokens + initial claimable tokens  which should be equal to total token grant amount', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime + SECONDS_PER_MONTH,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();

      userGrant = await USER_1_VESTING_CONTRACT.tokenGrant();

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()).wait();
      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()).wait();

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT);

    });

  });

  describe('Sharing yield for users with vested token grant', () => {

    let USER_1_VESTING_CONTRACT: TokenVesting;
    const vestingDuration = 24;
    const vestingCliff = 6;
    const INITIAL_CLAIMABLE_PERCENT = 12;

    beforeEach(async () => {
      USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, TOTAL_SUPPLY.toBigInt())
      ).wait();
    });


    it('should be able to get yield of a token share distribution when owner distributes in AMIDST of vesting period', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();


      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await (await token.connect(tokenHolderSigner).distributeYield(amountToDistribute, [])).wait();
      const withdrawAbleYield = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()).wait();

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()).wait();

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectYield()).wait();

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(withdrawAbleYield));

    });


    it('should be able to get yield of a token share distribution when owner distributes in AFTER of vesting period', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();


      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await token.connect(tokenHolderSigner).distributeYield(amountToDistribute, [])).wait();
      const withdrawAbleYield = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()).wait();

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()).wait();

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectYield()).wait();

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(withdrawAbleYield));

    });


    it('should be able to get yield of a token share distribution when owner distributes in AFTER of vesting period AND user claimed all vested tokens', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();


      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()).wait();

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()).wait();

      await (await token.connect(tokenHolderSigner).distributeYield(amountToDistribute, [])).wait();
      const withdrawAbleYieldOfVestedTokens = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);
      const withdrawAbleYieldOfUserClaimedTokens = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER1.address);
      await (await token.claimYieldFor(USER1.address)).wait();

      expect(await token.balanceOf(USER_1_VESTING_CONTRACT.address)).to.eq(BigNumber.from(0));
      expect(withdrawAbleYieldOfVestedTokens).to.eq(BigNumber.from(0));

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectYield()
      ).to.be.revertedWith('zero yield profit');


      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(withdrawAbleYieldOfUserClaimedTokens));

    });
  });

  describe('When collecting yield for users', () => {
    let USER_1_VESTING_CONTRACT: TokenVesting;
    const vestingDuration = 24;
    const vestingCliff = 6;
    const INITIAL_CLAIMABLE_PERCENT = 12;

    beforeEach(async () => {
      USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address,
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, TOTAL_SUPPLY.toBigInt())
      ).wait();
    });

    it('should be able to get yield of a token share distribution when owner distributes in AMIDST of vesting period and should log correct event', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();


      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await (await token.connect(tokenHolderSigner).distributeYield(amountToDistribute, [])).wait();
      const withdrawAbleYield = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claimVestedTokens()).wait();

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectInitiallyClaimableAmount()).wait();

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).collectYield()
      )
        .to.emit(USER_1_VESTING_CONTRACT, 'YieldCollected')
        .withArgs(
          USER1.address,
          withdrawAbleYield
        );

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(withdrawAbleYield));

    });
  });

  describe('when claiming with generic function all claimable amounts', () => {
    let USER_1_VESTING_CONTRACT: TokenVesting;
    const vestingDuration = 24;
    const vestingCliff = 6;
    const INITIAL_CLAIMABLE_PERCENT = 10;

    beforeEach(async () => {
      USER_1_VESTING_CONTRACT = (await vestingContractFactory.deploy(
        token.address,
        tokenHolder.address,
        USER1.address,
      )) as TokenVesting;

      // Approve the amount balance to be transferred by the vesting contract as part of the `addTokenGrant` call
      await (
        await token
          .connect(tokenHolderSigner)
          .approve(USER_1_VESTING_CONTRACT.address, TOTAL_SUPPLY.toBigInt())
      ).wait();

    });

    it('should be able to get yield of a token share distribution when owner distributes before vesting period end', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();

      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await (await token.connect(tokenHolderSigner).distributeYield(amountToDistribute, [])).wait();
      const withdrawAbleYield = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);

      await forwardTime(SECONDS_PER_MONTH);

      const claimAbleAmountOfVestingContract = await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).getClaimableAmount();
      expect(claimAbleAmountOfVestingContract).to.eq(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100));
      const yieldOfTheContract = await token.unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);
      expect(yieldOfTheContract).to.eq(withdrawAbleYield);

      await (await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claim()).wait();

      // Initial Claimable plus distributed yield of the contract only since only one month passed they user has not claimed any vested tokens
      const expectedBalance = claimAbleAmountOfVestingContract.add(withdrawAbleYield);

      expect(await token.balanceOf(USER1.address)).to.eq(expectedBalance);
    });

    it('should be able to get yield of a token share distribution when owner distributes in AMIDST of vesting period and should log correct event', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();

      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await (await token.connect(tokenHolderSigner).distributeYield(amountToDistribute, [])).wait();
      const withdrawAbleYield = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      const claimAbleAmountOfVestingContract = await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).getClaimableAmount();
      expect(claimAbleAmountOfVestingContract).to.eq(USER_1_GRANT_AMOUNT);
      const yieldOfTheContract = await token.unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);
      expect(yieldOfTheContract).to.eq(withdrawAbleYield);

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claim()
      ).to.emit(USER_1_VESTING_CONTRACT, 'TokensClaimed')
        .withArgs(
          claimAbleAmountOfVestingContract.add(yieldOfTheContract)
        );

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(withdrawAbleYield));
    });

    it('should be able to get yield of a token share distribution when owner distributes in AFTER of vesting period and should log correct event', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await (await token.connect(tokenHolderSigner).distributeYield(amountToDistribute, [])).wait();
      const withdrawAbleYield = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);

      const claimAbleAmountOfVestingContract = await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).getClaimableAmount();
      expect(claimAbleAmountOfVestingContract).to.eq(USER_1_GRANT_AMOUNT);
      const yieldOfTheContract = await token.unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);
      expect(yieldOfTheContract).to.eq(withdrawAbleYield);

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claim()
      ).to.emit(USER_1_VESTING_CONTRACT, 'TokensClaimed')
        .withArgs(
          claimAbleAmountOfVestingContract.add(yieldOfTheContract)
        );

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(withdrawAbleYield));
    });

    it('should be return with zero cliams if there are no initial claimable and zero tokens vested so far and no yield distributed', async () => {
      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          0
        )
      ).wait();

      const claimAbleAmountOfVestingContract = await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).getClaimableAmount();
      expect(claimAbleAmountOfVestingContract).to.eq(0);
      const yieldOfTheContract = await token.unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);
      expect(yieldOfTheContract).to.eq(0);

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claim()
      ).to.be.revertedWith('zero claims');

      expect(await token.balanceOf(USER1.address)).to.eq(0);
    });

    it('should be return with zero claims if all claimable are already just claimed', async () => {


      await (
        await USER_1_VESTING_CONTRACT.addTokenGrant(
          currentTime,
          USER_1_GRANT_AMOUNT.toBigInt(),
          vestingDuration,
          vestingCliff,
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        )
      ).wait();

      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await (await token.connect(tokenHolderSigner).distributeYield(amountToDistribute, [])).wait();
      const withdrawAbleYield = await token.connect(tokenHolderSigner).unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);

      const claimAbleAmountOfVestingContract = await USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).getClaimableAmount();
      expect(claimAbleAmountOfVestingContract).to.eq(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100));
      const yieldOfTheContract = await token.unclaimedYieldOf(USER_1_VESTING_CONTRACT.address);
      expect(yieldOfTheContract).to.eq(withdrawAbleYield);

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claim()
      )
        .to.emit(USER_1_VESTING_CONTRACT, 'TokensClaimed')
        .withArgs(
          claimAbleAmountOfVestingContract.add(yieldOfTheContract)
        );

      await expect(
        USER_1_VESTING_CONTRACT.connect(USER_1_SIGNER).claim()
      ).to.be.revertedWith('zero claims');

      expect(await token.balanceOf(USER1.address)).to.eq(withdrawAbleYield.add(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)));
    });
  });

});

