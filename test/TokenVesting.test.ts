import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { DoubleDiceToken, DoubleDiceTokenVesting, DoubleDiceTokenVestingProxyFactory, DoubleDiceTokenVestingProxyFactory__factory, DoubleDiceTokenVesting__factory, DoubleDiceToken__factory } from '../typechain';
import { $, currentBlockTime, forwardTime } from './lib/utils';

chai.use(chaiAsPromised);

const SECONDS_PER_MONTH = 2628000;

class Helper {
  constructor(
    public token: DoubleDiceToken,
    public tokenVestingProxyFactory: DoubleDiceTokenVestingProxyFactory,
    public tokenHolder: SignerWithAddress
  ) { }

  async deploy({
    user,
    startTime = 0,
    grantAmount,
    vestingDuration,
    vestingCliff,
    initiallyClaimableAmount = 0,
    _skipApproval = false,
    _noWait = false,
  }: {
    user: SignerWithAddress;
    startTime?: number;
    grantAmount: BigNumberish;
    vestingDuration: BigNumberish;
    vestingCliff: BigNumberish;
    initiallyClaimableAmount?: BigNumberish;
    _skipApproval?: boolean,
    _noWait?: boolean,
  }): Promise<[DoubleDiceTokenVesting, Promise<ContractTransaction>]> {

    if (!_skipApproval) {
      await (await this.token.connect(this.tokenHolder).increaseAllowance(this.tokenVestingProxyFactory.address, grantAmount)).wait();
    }

    const tx = this.tokenVestingProxyFactory.createDoubleDiceTokenVestingProxy(
      this.tokenHolder.address,
      user.address,
      startTime,
      grantAmount,
      vestingDuration,
      vestingCliff,
      initiallyClaimableAmount
    );

    let proxyAddress: string;

    if (!_noWait) {
      const { events } = await (await tx).wait();
      const event = events?.find(({ event }) => event === 'DoubleDiceTokenVestingProxyCreation');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { args } = event!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ({ proxyAddress } = args!);
    } else {
      proxyAddress = '0x0000000000000000000000000000000000000000';
    }

    const instance = new DoubleDiceTokenVesting__factory(this.tokenHolder).attach(proxyAddress);

    return [instance, tx];
  }
}


describe('Token Vesting Simple Test ', () => {
  let token: DoubleDiceToken;
  let currentTime: number;

  let tokenHolder: SignerWithAddress;
  let tokenVestingDeployer: SignerWithAddress;
  let tokenVestingProxyFactoryOwner: SignerWithAddress;
  let tokenOwner: SignerWithAddress;
  let USER0: SignerWithAddress;
  let USER1: SignerWithAddress;
  let USER2: SignerWithAddress;
  let USER3: SignerWithAddress;
  let USER4: SignerWithAddress;
  let USER5: SignerWithAddress;
  let USER6: SignerWithAddress;
  let USER7: SignerWithAddress;
  let USER8: SignerWithAddress;
  let USER9: SignerWithAddress;
  let USER10: SignerWithAddress;

  let helper: Helper;

  const USER_1_GRANT_AMOUNT = $(1200);
  const USER_2_GRANT_AMOUNT = $(500);
  const USER_3_GRANT_AMOUNT = $(750);
  const USER_4_GRANT_AMOUNT = $(23);
  const USER_5_GRANT_AMOUNT = $(650);
  const USER_6_GRANT_AMOUNT = $(800);
  const USER_7_GRANT_AMOUNT = $(198);
  const USER_8_GRANT_AMOUNT = $(350);
  const USER_9_GRANT_AMOUNT = $(1001);
  const USER_10_GRANT_AMOUNT = $(1091);
  const TOTAL_YIELD_AMOUNT = $(2000);

  const TOTAL_SUPPLY = TOTAL_YIELD_AMOUNT
    .add(USER_1_GRANT_AMOUNT)
    .add(USER_2_GRANT_AMOUNT)
    .add(USER_3_GRANT_AMOUNT)
    .add(USER_4_GRANT_AMOUNT)
    .add(USER_5_GRANT_AMOUNT)
    .add(USER_6_GRANT_AMOUNT)
    .add(USER_7_GRANT_AMOUNT)
    .add(USER_8_GRANT_AMOUNT)
    .add(USER_9_GRANT_AMOUNT)
    .add(USER_10_GRANT_AMOUNT);

  let grantProperties: { account: SignerWithAddress; amount: BigNumber; duration: number; cliff: number }[];

  before(async () => {
    [
      tokenHolder,
      tokenVestingDeployer,
      tokenVestingProxyFactoryOwner,
      tokenOwner,
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
      USER10,
    ] = await ethers.getSigners();

    grantProperties = [
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
  });

  let USERS_VESTING_CONTRACTS: DoubleDiceTokenVesting[];

  beforeEach(async () => {
    currentTime = await currentBlockTime();

    token = await new DoubleDiceToken__factory(tokenOwner).deploy(
      TOTAL_SUPPLY,
      TOTAL_YIELD_AMOUNT,
      tokenHolder.address
    );
    await token.deployed();

    const tokenVestingMasterCopy = await new DoubleDiceTokenVesting__factory(tokenVestingDeployer).deploy();
    await tokenVestingMasterCopy.deployed();

    const tokenVestingProxyFactory = (
      await new DoubleDiceTokenVestingProxyFactory__factory(tokenVestingProxyFactoryOwner)
        .deploy(token.address, tokenVestingMasterCopy.address)
    ).connect(tokenVestingProxyFactoryOwner);

    helper = new Helper(token, tokenVestingProxyFactory, tokenHolder);
  });

  describe('when creating vesting contract for a user ', () => {
    it('should create grant correctly, when a startDate in the past is used', async () => {
      const vestingDuration = 24;
      const vestingCliff = 6;

      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime - SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff
      });

      const grant = await vestingContract.tokenGrant();

      expect(grant.startTime).to.equal(currentTime - SECONDS_PER_MONTH);
      expect(grant.amount).to.eq(USER_1_GRANT_AMOUNT);
      expect(grant.vestingDuration).to.eq(vestingDuration);
      expect(grant.vestingCliff).to.eq(vestingCliff);
      expect(grant.monthsClaimed).to.eq(0);
      expect(grant.totalClaimed).to.eq(0);

      const user1ContractBalance = await token.balanceOf(vestingContract.address);
      expect(user1ContractBalance).to.eq(USER_1_GRANT_AMOUNT);
    });

    it('should create grant correctly, when a startDate in the future is used', async () => {
      const vestingDuration = 24;
      const vestingCliff = 6;

      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff
      });

      const grant = await vestingContract.tokenGrant();

      expect(grant.startTime).to.equal(currentTime + SECONDS_PER_MONTH);
      expect(grant.amount).to.eq(USER_1_GRANT_AMOUNT);
      expect(grant.vestingDuration).to.eq(vestingDuration);
      expect(grant.vestingCliff).to.eq(vestingCliff);
      expect(grant.monthsClaimed).to.eq(0);
      expect(grant.totalClaimed).to.eq(0);

      const user1ContractBalance = await token.balanceOf(vestingContract.address);
      expect(user1ContractBalance).to.eq(USER_1_GRANT_AMOUNT);
    });

    it('should create grant correctly, using the current time, when no startDate was passed', async () => {
      const vestingDuration = 24;
      const vestingCliff = 6;

      const [vestingContract] = await helper.deploy({
        user: USER1,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff
      });

      const grant = await vestingContract.tokenGrant();

      expect(grant.startTime.toNumber()).to.be.closeTo(currentTime, 10);
      expect(grant.amount).to.eq(USER_1_GRANT_AMOUNT);
      expect(grant.vestingDuration).to.eq(vestingDuration);
      expect(grant.vestingCliff).to.eq(vestingCliff);
      expect(grant.monthsClaimed).to.eq(0);
      expect(grant.totalClaimed).to.eq(0);

      const user1ContractBalance = await token.balanceOf(vestingContract.address);
      expect(user1ContractBalance).to.eq(USER_1_GRANT_AMOUNT);
    });

    it('should log correct event', async () => {
      const vestingDuration = 24;
      const vestingCliff = 6;

      const [vestingContract, tx] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
      });

      await expect(tx).to.emit(vestingContract, 'GrantAdded').withArgs(
        currentTime + SECONDS_PER_MONTH,
        USER_1_GRANT_AMOUNT.toBigInt(),
        vestingDuration,
        vestingCliff
      );

    });

    it('should error if duration is 0', async () => {
      const [, tx] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration: 0,
        vestingCliff: 6,
        _noWait: true
      });
      await expect(tx).to.be.revertedWith('cliff-longer-than-duration');
    });

    it('should error if cliff is 0', async () => {
      const [, tx] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration: 0,
        vestingCliff: 0,
        _noWait: true
      });
      await expect(tx).to.be.revertedWith('zero-vesting-cliff');
    });

    it('should error if amount/duration is not greater than zero', async () => {
      const [, tx] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: 0,
        vestingDuration: 24,
        vestingCliff: 6,
        _noWait: true
      });
      await expect(tx).to.be.revertedWith('Initial claimable should be less than the total amount');
    });

    it('should error on grant amount overflow', async () => {
      const [, tx] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT.mul(USER_1_GRANT_AMOUNT),
        vestingDuration: 24,
        vestingCliff: 6,
        _noWait: true
      });
      await expect(tx).to.be.revertedWith('ERC20: transfer amount exceeds balance'); // ToDo: Check
    });

    it('should error on grant duration overflow', async () => {
      const [, tx] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration: (2n ** 32n - 1n) + 1n,
        vestingCliff: 6,
        _noWait: true
      });
      await expect(tx).to.be.rejectedWith(/out-of-bounds/);
    });

    it('should error if grant amount cannot be transferred', async () => {
      const [, tx] = await helper.deploy({
        user: USER1,
        startTime: currentTime,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration: 24,
        vestingCliff: 6,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.div(4),
        _skipApproval: true,
        _noWait: true
      });
      await expect(tx).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
    });
  });

  describe('when removing token grants', () => {
    let vestingContract: DoubleDiceTokenVesting;
    const vestingDuration = 24;
    const vestingCliff = 6;
    const initiallyClaimableAmount = USER_1_GRANT_AMOUNT.div(4);
    beforeEach(async () => {
      [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount,
      });
    });

    it('should log correct event', async () => {
      await expect(
        vestingContract.removeTokenGrant()
      )
        .to.emit(vestingContract, 'GrantRemoved')
        .withArgs(
          0,
          USER_1_GRANT_AMOUNT.sub(initiallyClaimableAmount),
        );
    });

    it('should return non-vested tokens', async () => {
      const balanceBefore = await token.balanceOf(tokenHolder.address);
      await forwardTime(SECONDS_PER_MONTH);

      await (await vestingContract.removeTokenGrant()).wait();
      const userEarnedToken = await token.balanceOf(USER1.address);

      const balanceAfter = await token.balanceOf(tokenHolder.address);

      const balanceChange = balanceAfter.sub(balanceBefore).toString();
      expect(balanceChange).to.eq(USER_1_GRANT_AMOUNT.sub(userEarnedToken));
      expect(await token.balanceOf(USER1.address)).to.eq(initiallyClaimableAmount);
    });

    it('should return non-vested tokens and vested tokens to the user also the initial claimable', async () => {
      const balanceBefore = await token.balanceOf(tokenHolder.address);
      await forwardTime(SECONDS_PER_MONTH * 7);

      const grantClaimResponse = await vestingContract.calculateGrantClaim();
      await (await vestingContract.removeTokenGrant()).wait();

      const userEarnedToken = await token.balanceOf(USER1.address);

      const balanceAfter = await token.balanceOf(tokenHolder.address);

      const balanceChange = balanceAfter.sub(balanceBefore).toString();
      expect(balanceChange).to.eq(USER_1_GRANT_AMOUNT.sub(userEarnedToken));
      expect(await token.balanceOf(USER1.address)).to.eq(initiallyClaimableAmount.add(grantClaimResponse[1]));
    });

    it('should give grant recipient any vested amount', async () => {
      const balanceBefore = await token.balanceOf(USER1.address);
      await forwardTime(SECONDS_PER_MONTH);

      await (await vestingContract.removeTokenGrant()).wait();

      const balanceAfter = await token.balanceOf(USER1.address);
      const balanceChange = balanceAfter.sub(balanceBefore).toString();
      expect(balanceChange).to.eq($(300));
    });

    it('should return the correct amounts if there have been tokens claimed already', async () => {
      const tokenHolderBalanceBefore = await token.balanceOf(tokenHolder.address);
      const userBalanceBefore = await token.balanceOf(USER1.address);

      // 7 months vested and claimed
      await forwardTime(SECONDS_PER_MONTH * 7);
      const grantClaimAfter7month = await vestingContract.calculateGrantClaim();
      await (await vestingContract.connect(USER1).claimVestedTokens()).wait();
      // Another 6 months vested and claimed
      await forwardTime(SECONDS_PER_MONTH * 6);
      const grantClaimAfter13month = await vestingContract.calculateGrantClaim();
      await (await vestingContract.connect(USER1).claimVestedTokens()).wait();
      const balanceAfterClaimsRecipient = await token.balanceOf(USER1.address);
      const balanceChangeAfterClaimsRecipient = balanceAfterClaimsRecipient
        .sub(userBalanceBefore)
        .toString();
      expect(balanceChangeAfterClaimsRecipient).to.eq(grantClaimAfter7month[1].add(grantClaimAfter13month[1]));

      // Another 3 months vested but not claimed
      await forwardTime(SECONDS_PER_MONTH * 3);
      const grantClaimAfter16month = await vestingContract.calculateGrantClaim();
      // 16 months vested of which 13 months claimed, another 6 months not yet vested
      await (await vestingContract.removeTokenGrant()).wait();

      const balanceAfterRecipient = await token.balanceOf(USER1.address);
      const balanceChangeRecipient = balanceAfterRecipient
        .sub(balanceAfterClaimsRecipient)
        .toString();
      // Expecting 3 months worth of vested unclaimed tokens here
      expect(balanceChangeRecipient).to.eq(grantClaimAfter16month[1].add(initiallyClaimableAmount));
      // Expectingt their total balanace to be 16 months worth of vested tokens
      expect(balanceAfterRecipient.sub(userBalanceBefore)).to.eq(
        grantClaimAfter7month[1].add(grantClaimAfter13month[1])
          .add(grantClaimAfter16month[1]).add(initiallyClaimableAmount).sub(userBalanceBefore)
      );

      const balanceAfterMultiSig = await token.balanceOf(tokenHolder.address);
      const balanceChangeMultiSig = balanceAfterMultiSig
        .sub(tokenHolderBalanceBefore)
        .toString();
      // Expecting non-vested tokens here to = total grant amount - 16 months worth of vested tokens
      const vestedAmountOver16Months = grantClaimAfter7month[1].add(grantClaimAfter13month[1]).add(grantClaimAfter16month[1]);
      expect(balanceChangeMultiSig).to.eq(USER_1_GRANT_AMOUNT.sub(vestedAmountOver16Months).sub(initiallyClaimableAmount));
    });

    it('should error if called by anyone but the Owner', async () => {
      await expect(
        vestingContract.connect(USER0).removeTokenGrant()
      ).to.be.revertedWith('caller is not the owner');

      const grant = await vestingContract.tokenGrant();
      expect(grant.amount).to.eq(USER_1_GRANT_AMOUNT);
    });


    it('should transfer yield to the user', async () => {
      const userBalanceBefore = await token.balanceOf(USER1.address);

      const amountToDistribute = BigNumber.from(20);

      await token.approve(tokenHolder.address, token.address);
      await (await token.connect(tokenOwner).distributeYield(amountToDistribute, [])).wait();

      const claimableYield = await token.unclaimedYieldOf(vestingContract.address);

      await (await vestingContract.removeTokenGrant()).wait();

      expect(await token.balanceOf(USER1.address)).to.eq(userBalanceBefore.add(claimableYield));
    });

  });

  describe('when claiming vested tokens', () => {
    const vestingDuration = 24;
    const vestingCliff = 6;

    it('should NOT be able to claim within the first month', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
      });

      await forwardTime(3600);

      const balanceBefore = await token.balanceOf(USER1.address);
      expect(balanceBefore).to.eq(0);

      await expect(
        vestingContract.connect(USER1).claimVestedTokens()
      ).to.be.revertedWith('token-zero-amount-vested');

      const balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter).to.eq(0);
    });

    it('should NOT be able to claim before cliff reached', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
      });

      await forwardTime(SECONDS_PER_MONTH * vestingCliff - 3600);
      const balanceBefore = await token.balanceOf(USER1.address);
      expect(balanceBefore).to.eq(0);

      await expect(
        vestingContract.connect(USER1).claimVestedTokens()
      ).to.be.revertedWith('token-zero-amount-vested');

      const balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter).to.eq(0);
    });

    it('should NOT be able to claim a non-existent grant', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
      });

      await expect(
        vestingContract.connect(USER1).claimVestedTokens()
      ).to.be.revertedWith('token-zero-amount-vested');
    });

    it('should log correct event', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
      });

      await forwardTime(SECONDS_PER_MONTH * 24);
      await expect(
        vestingContract.connect(USER1).claimVestedTokens()
      )
        .to.emit(vestingContract, 'GrantTokensClaimed')
        .withArgs(
          USER_1_GRANT_AMOUNT.toBigInt()
        );
    });
  });


  describe('when claiming vested tokens (2)', () => {
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

    account1GrantProperties.forEach(grantProp => {
      it(`${grantProp.monthsElapsed} months after grant start date, user should be able to claim ${grantProp.monthsElapsed}/${grantProp.duration + grantProp.startTimeMonthsBeforeNow} of their total token grant`, async () => {
        const currentTime = await currentBlockTime();

        const [vestingContract] = await helper.deploy({
          user: USER1,
          startTime: currentTime - grantProp.startTimeMonthsBeforeNow * SECONDS_PER_MONTH,
          grantAmount: USER_1_GRANT_AMOUNT,
          vestingDuration: grantProp.duration,
          vestingCliff: grantProp.cliff,
        });

        const timeToForward = SECONDS_PER_MONTH * grantProp.monthsElapsed;
        await forwardTime(timeToForward);
        const balanceBefore = await token.balanceOf(USER1.address);
        expect(balanceBefore).to.eq(0);

        const calculatedGrantClaim = await vestingContract.calculateGrantClaim();
        expect(calculatedGrantClaim[0]).to.eq(
          grantProp.monthsElapsed + grantProp.startTimeMonthsBeforeNow
        );

        await (await vestingContract.connect(USER1).claimVestedTokens()).wait();
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

        const tokenGrant = await vestingContract.tokenGrant();

        expect(tokenGrant.monthsClaimed).to.eq(
          grantProp.monthsElapsed + grantProp.startTimeMonthsBeforeNow
        );
        expect(tokenGrant.totalClaimed).to.eq(expectedClaimedAmount);
      });
    });

    it('should be able to handle multiple grants correctly over time', async () => {
      // Note: we must wait for 1 contract to be deployed before proceeding to the next,
      // otherwise if we use Promise.all, all the getTransactionCount() in deploy() will
      // happen concurrently and return the same value, and the address of the contracts
      // of different users will be precalculated to be all the same.
      USERS_VESTING_CONTRACTS = [];
      for (const { account, amount, duration, cliff } of grantProperties) {
        const [contract] = await helper.deploy({
          user: account,
          grantAmount: amount,
          vestingDuration: duration,
          vestingCliff: cliff,
        });
        USERS_VESTING_CONTRACTS.push(contract);
      }

      let balanceBefore;
      let balanceAfter;
      // Go forward 1 month
      await forwardTime(SECONDS_PER_MONTH);
      // Check account 3 and 10 can claim correctly
      balanceBefore = await token.balanceOf(USER3.address);
      await (await USERS_VESTING_CONTRACTS[2].connect(USER3).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER3.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_3_GRANT_AMOUNT.div(12)
      );

      balanceBefore = await token.balanceOf(USER10.address);
      await (await USERS_VESTING_CONTRACTS[9].connect(USER10).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER10.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_10_GRANT_AMOUNT.div(6)
      );

      // Go forward another 1 month, to the end of month 2 since grants created
      await forwardTime(SECONDS_PER_MONTH);
      // Check account 7 can claim correctly
      balanceBefore = await token.balanceOf(USER7.address);
      await (await USERS_VESTING_CONTRACTS[6].connect(USER7).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER7.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_7_GRANT_AMOUNT.div(20).mul(2)
      );

      // Go forward another 1 month, to the end of month 3 since grants created
      await forwardTime(SECONDS_PER_MONTH);
      // Check account 8 can claim correctly
      balanceBefore = await token.balanceOf(USER8.address);
      await (await USERS_VESTING_CONTRACTS[7].connect(USER8).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER8.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_8_GRANT_AMOUNT.div(12).mul(3)
      );

      // Go forward another 1 month, to the end of month 4 since grants created
      await forwardTime(SECONDS_PER_MONTH);
      // Check account 9 can claim correctly
      balanceBefore = await token.balanceOf(USER9.address);
      await (await USERS_VESTING_CONTRACTS[8].connect(USER9).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER9.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_9_GRANT_AMOUNT.div(16).mul(4)
      );

      // Go forward another 2 months, to the end of month 6 since grants created
      await forwardTime(SECONDS_PER_MONTH * 2);
      // Check accounts 1 and 2 can claim correctly
      balanceBefore = await token.balanceOf(USER1.address);
      await (await USERS_VESTING_CONTRACTS[0].connect(USER1).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_1_GRANT_AMOUNT.div(24).mul(6)
      );

      balanceBefore = await token.balanceOf(USER2.address);
      await (await USERS_VESTING_CONTRACTS[1].connect(USER2).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER2.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_2_GRANT_AMOUNT.div(24).mul(6)
      );

      // Go forward another 6 months, to the end of month 12 since grants created
      await forwardTime(SECONDS_PER_MONTH * 6);
      // Check accounts 4, 5 and 6 can claim correctly
      balanceBefore = await token.balanceOf(USER4.address);
      await (await USERS_VESTING_CONTRACTS[3].connect(USER4).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER4.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_4_GRANT_AMOUNT.div(36).mul(12)
      );

      balanceBefore = await token.balanceOf(USER5.address);
      await (await USERS_VESTING_CONTRACTS[4].connect(USER5).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER5.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_5_GRANT_AMOUNT.div(33).mul(12)
      );

      balanceBefore = await token.balanceOf(USER6.address);
      await (await USERS_VESTING_CONTRACTS[5].connect(USER6).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER6.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_6_GRANT_AMOUNT.div(28).mul(12)
      );

      // Check account 3, 8 and 10 can claim their entire left grant
      await (await USERS_VESTING_CONTRACTS[2].connect(USER3).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER3.address);
      expect(balanceAfter).to.eq(USER_3_GRANT_AMOUNT);

      await (await USERS_VESTING_CONTRACTS[7].connect(USER8).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER8.address);
      expect(balanceAfter).to.eq(USER_8_GRANT_AMOUNT);

      await (await USERS_VESTING_CONTRACTS[9].connect(USER10).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER10.address);
      expect(balanceAfter).to.eq(USER_10_GRANT_AMOUNT);

      // Go forward another 5 months, to the end of month 17 since grants created
      await forwardTime(SECONDS_PER_MONTH * 5);
      // Check account 9 can claim their entire left grant
      await (await USERS_VESTING_CONTRACTS[8].connect(USER9).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER9.address);
      expect(balanceAfter).to.eq(USER_9_GRANT_AMOUNT);

      // Check account 7 can claim (15 months vested tokens) correctly
      balanceBefore = await token.balanceOf(USER7.address);
      await (await USERS_VESTING_CONTRACTS[6].connect(USER7).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER7.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_7_GRANT_AMOUNT.div(20).mul(17 - 2)
      );

      // Go forward another 3 months, to the end of month 20 since grants created
      await forwardTime(SECONDS_PER_MONTH * 3);
      // Check account 7 can claim their entire left grant
      await (await USERS_VESTING_CONTRACTS[6].connect(USER7).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER7.address);
      expect(balanceAfter).to.eq(USER_7_GRANT_AMOUNT);

      // Check accounts 1, 2, 4 and 5 can claim correctly
      balanceBefore = await token.balanceOf(USER1.address);
      await (await USERS_VESTING_CONTRACTS[0].connect(USER1).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_1_GRANT_AMOUNT.div(24).mul(20 - 6)
      );

      balanceBefore = await token.balanceOf(USER2.address);
      await (await USERS_VESTING_CONTRACTS[1].connect(USER2).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER2.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_2_GRANT_AMOUNT.div(24).mul(20 - 6)
      );

      balanceBefore = await token.balanceOf(USER4.address);
      await (await USERS_VESTING_CONTRACTS[3].connect(USER4).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER4.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_4_GRANT_AMOUNT.div(36).mul(20 - 12)
      );

      balanceBefore = await token.balanceOf(USER5.address);
      await (await USERS_VESTING_CONTRACTS[4].connect(USER5).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER5.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_5_GRANT_AMOUNT.div(33).mul(20 - 12)
      );

      // Go forward another 4 months, to the end of month 24 since grants created
      await forwardTime(SECONDS_PER_MONTH * 4);
      // Check account 1 and 2 can claim their entire left grant
      await (await USERS_VESTING_CONTRACTS[0].connect(USER1).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER1.address);
      expect(balanceAfter).to.eq(USER_1_GRANT_AMOUNT);

      await (await USERS_VESTING_CONTRACTS[1].connect(USER2).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER2.address);
      expect(balanceAfter).to.eq(USER_2_GRANT_AMOUNT);

      // Check accounts 4, 5 and 6 can claim correctly
      balanceBefore = await token.balanceOf(USER4.address);
      await (await USERS_VESTING_CONTRACTS[3].connect(USER4).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER4.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_4_GRANT_AMOUNT.div(36).mul(24 - 20)
      );

      balanceBefore = await token.balanceOf(USER5.address);
      await (await USERS_VESTING_CONTRACTS[4].connect(USER5).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER5.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_5_GRANT_AMOUNT.div(33).mul(24 - 20)
      );

      balanceBefore = await token.balanceOf(USER6.address);
      await (await USERS_VESTING_CONTRACTS[5].connect(USER6).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER6.address);
      expect(balanceAfter.sub(balanceBefore)).to.eq(
        USER_6_GRANT_AMOUNT.div(28).mul(24 - 12)
      );

      // Go forward another 12 months, to the end of month 36 since grants created
      await forwardTime(SECONDS_PER_MONTH * 12);
      // Check account 4, 5 and 6 can claim their entire left grant
      await (await USERS_VESTING_CONTRACTS[3].connect(USER4).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER4.address);
      expect(balanceAfter).to.eq(USER_4_GRANT_AMOUNT);

      await (await USERS_VESTING_CONTRACTS[4].connect(USER5).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER5.address);
      expect(balanceAfter).to.eq(USER_5_GRANT_AMOUNT);

      await (await USERS_VESTING_CONTRACTS[5].connect(USER6).claimVestedTokens()).wait();
      balanceAfter = await token.balanceOf(USER6.address);
      expect(balanceAfter).to.eq(USER_6_GRANT_AMOUNT);
    });
  });

  describe('when adding token grant with initial claimable amount ', () => {

    const vestingDuration = 24;
    const vestingCliff = 6;
    const INITIAL_CLAIMABLE_PERCENT = 12;

    it('should create with the right claimable amount specified ', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
      });
      const userGrant = await vestingContract.tokenGrant();
      expect(userGrant.initiallyClaimableAmount).to.eq(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100));
    });


    it('should NOT be able to add token grant with initial claim able more than or equal to the total amount ', async () => {
      const [, tx] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.toBigInt(),
        _noWait: true
      });
      await expect(tx).to.be.revertedWith('Initial claimable should be less than the total amount');
    });

    it('should be able to claim and see the exact amount on the user\'s balance ', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
      });
      await (await vestingContract.connect(USER1).collectInitiallyClaimableAmount()).wait();
      expect(await token.balanceOf(USER1.address)).eq(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100));
    });

    it('should NOT be able to collect initial claimable amount twice ', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
      });
      await (await vestingContract.connect(USER1).collectInitiallyClaimableAmount()).wait();
      await expect(
        vestingContract.connect(USER1).collectInitiallyClaimableAmount()
      ).to.be.revertedWith('Initial claimable already collected');
    });

    it('should NOT be able to collect before token grant start time ', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
      });
      await expect(
        vestingContract.connect(USER1).collectInitiallyClaimableAmount()
      ).to.be.revertedWith('Initial claimable not claimable before token grant start time');
    });

    it('should emit event with respective argument', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
      });
      await expect(
        vestingContract.connect(USER1).collectInitiallyClaimableAmount()
      )
        .to.emit(vestingContract, 'InitialGrantTokensClaimed')
        .withArgs(
          USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        );
    });

    it('should be able to claim their total vested tokens + initial claimable tokens  which should be equal to total token grant amount', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime + SECONDS_PER_MONTH,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
      });

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await vestingContract.connect(USER1).claimVestedTokens()).wait();
      await (await vestingContract.connect(USER1).collectInitiallyClaimableAmount()).wait();

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT);
    });

  });

  describe('Sharing yield for users with vested token grant', () => {

    let vestingContract: DoubleDiceTokenVesting;
    const vestingDuration = 24;
    const vestingCliff = 6;
    const INITIAL_CLAIMABLE_PERCENT = 12;

    beforeEach(async () => {
      [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
      });
    });

    it('should be able to get yield of a token share distribution when owner distributes in AMIDST of vesting period', async () => {
      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await (await token.connect(tokenOwner).distributeYield(amountToDistribute, [])).wait();
      const claimableYield = await token.unclaimedYieldOf(vestingContract.address);

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await vestingContract.connect(USER1).claimVestedTokens()).wait();

      await (await vestingContract.connect(USER1).collectInitiallyClaimableAmount()).wait();

      await (await vestingContract.connect(USER1).collectYield()).wait();

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(claimableYield));

    });

    it('should be able to get yield of a token share distribution when owner distributes in AFTER of vesting period', async () => {
      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address); //??????

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await token.connect(tokenOwner).distributeYield(amountToDistribute, [])).wait();
      const claimableYield = await token.unclaimedYieldOf(vestingContract.address);

      await (await vestingContract.connect(USER1).claimVestedTokens()).wait();

      await (await vestingContract.connect(USER1).collectInitiallyClaimableAmount()).wait();

      await (await vestingContract.connect(USER1).collectYield()).wait();

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(claimableYield));
    });

    it('should be able to get yield of a token share distribution when owner distributes in AFTER of vesting period AND user claimed all vested tokens', async () => {
      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await vestingContract.connect(USER1).claimVestedTokens()).wait();

      await (await vestingContract.connect(USER1).collectInitiallyClaimableAmount()).wait();

      await (await token.connect(tokenOwner).distributeYield(amountToDistribute, [])).wait();
      const claimableYieldOfVestedTokens = await token.unclaimedYieldOf(vestingContract.address);
      const claimableYieldOfUserClaimedTokens = await token.unclaimedYieldOf(USER1.address);
      await (await token.claimYieldFor(USER1.address)).wait();

      expect(await token.balanceOf(vestingContract.address)).to.eq(BigNumber.from(0));
      expect(claimableYieldOfVestedTokens).to.eq(BigNumber.from(0));

      await expect(
        vestingContract.connect(USER1).collectYield()
      ).to.be.revertedWith('zero yield profit');

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(claimableYieldOfUserClaimedTokens));
    });
  });

  describe('When collecting yield for users', () => {
    const vestingDuration = 24;
    const vestingCliff = 6;
    const INITIAL_CLAIMABLE_PERCENT = 12;

    it('should be able to get yield of a token share distribution when owner distributes in AMIDST of vesting period and should log correct event', async () => {
      const [vestingContract] = await helper.deploy({
        user: USER1,
        startTime: currentTime,
        grantAmount: USER_1_GRANT_AMOUNT,
        vestingDuration,
        vestingCliff,
        initiallyClaimableAmount: USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
      });

      const amountToDistribute = BigNumber.from(20);
      await token.approve(tokenHolder.address, token.address);

      await (await token.connect(tokenOwner).distributeYield(amountToDistribute, [])).wait();
      const claimableYield = await token.unclaimedYieldOf(vestingContract.address);

      await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

      await (await vestingContract.connect(USER1).claimVestedTokens()).wait();

      await (await vestingContract.connect(USER1).collectInitiallyClaimableAmount()).wait();

      await expect(
        vestingContract.connect(USER1).collectYield()
      )
        .to.emit(vestingContract, 'YieldCollected')
        .withArgs(
          USER1.address,
          claimableYield
        );

      expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(claimableYield));
    });
  });

  describe('when claiming with generic function all claimable amounts', () => {
    let vestingContract: DoubleDiceTokenVesting;
    const vestingDuration = 24;
    const vestingCliff = 6;
    const INITIAL_CLAIMABLE_PERCENT = 10;

    describe('with non-zero initially claimable amount', () => {
      beforeEach(async () => {
        [vestingContract] = await helper.deploy({
          user: USER1,
          startTime: currentTime,
          grantAmount: USER_1_GRANT_AMOUNT,
          vestingDuration,
          vestingCliff,
          initiallyClaimableAmount: USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)
        });
      });

      it('should be able to get yield of a token share distribution when owner distributes before vesting period end', async () => {
        const amountToDistribute = BigNumber.from(20);
        await token.approve(tokenHolder.address, token.address);

        await (await token.connect(tokenOwner).distributeYield(amountToDistribute, [])).wait();
        const claimableYield = await token.unclaimedYieldOf(vestingContract.address);

        await forwardTime(SECONDS_PER_MONTH);

        const claimAbleAmountOfVestingContract = await vestingContract.connect(USER1).getClaimableAmount();
        expect(claimAbleAmountOfVestingContract).to.eq(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100));
        const yieldOfTheContract = await token.unclaimedYieldOf(vestingContract.address);
        expect(yieldOfTheContract).to.eq(claimableYield);

        await (await vestingContract.connect(USER1).claim()).wait();

        // Initial Claimable plus distributed yield of the contract only since only one month passed they user has not claimed any vested tokens
        const expectedBalance = claimAbleAmountOfVestingContract.add(claimableYield);

        expect(await token.balanceOf(USER1.address)).to.eq(expectedBalance);
      });

      it('should be able to get yield of a token share distribution when owner distributes in AMIDST of vesting period and should log correct event', async () => {
        const amountToDistribute = BigNumber.from(20);
        await token.approve(tokenHolder.address, token.address);

        await (await token.connect(tokenOwner).distributeYield(amountToDistribute, [])).wait();
        const claimableYield = await token.unclaimedYieldOf(vestingContract.address);

        await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

        const claimAbleAmountOfVestingContract = await vestingContract.connect(USER1).getClaimableAmount();
        expect(claimAbleAmountOfVestingContract).to.eq(USER_1_GRANT_AMOUNT);
        const yieldOfTheContract = await token.unclaimedYieldOf(vestingContract.address);
        expect(yieldOfTheContract).to.eq(claimableYield);

        await expect(
          vestingContract.connect(USER1).claim()
        ).to.emit(vestingContract, 'TokensClaimed')
          .withArgs(
            claimAbleAmountOfVestingContract.add(yieldOfTheContract)
          );

        expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(claimableYield));
      });

      it('should be able to get yield of a token share distribution when owner distributes in AFTER of vesting period and should log correct event', async () => {
        await forwardTime(SECONDS_PER_MONTH * (vestingDuration + 1));

        const amountToDistribute = BigNumber.from(20);
        await token.approve(tokenHolder.address, token.address);

        await (await token.connect(tokenOwner).distributeYield(amountToDistribute, [])).wait();
        const claimableYield = await token.unclaimedYieldOf(vestingContract.address);

        const claimAbleAmountOfVestingContract = await vestingContract.connect(USER1).getClaimableAmount();
        expect(claimAbleAmountOfVestingContract).to.eq(USER_1_GRANT_AMOUNT);
        const yieldOfTheContract = await token.unclaimedYieldOf(vestingContract.address);
        expect(yieldOfTheContract).to.eq(claimableYield);

        await expect(
          vestingContract.connect(USER1).claim()
        ).to.emit(vestingContract, 'TokensClaimed')
          .withArgs(
            claimAbleAmountOfVestingContract.add(yieldOfTheContract)
          );

        expect(await token.balanceOf(USER1.address)).to.eq(USER_1_GRANT_AMOUNT.add(claimableYield));
      });

      it('should be return with zero claims if all claimable are already just claimed', async () => {
        const amountToDistribute = BigNumber.from(20);
        await token.approve(tokenHolder.address, token.address);

        await (await token.connect(tokenOwner).distributeYield(amountToDistribute, [])).wait();
        const claimableYield = await token.unclaimedYieldOf(vestingContract.address);

        const claimAbleAmountOfVestingContract = await vestingContract.connect(USER1).getClaimableAmount();
        expect(claimAbleAmountOfVestingContract).to.eq(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100));
        const yieldOfTheContract = await token.unclaimedYieldOf(vestingContract.address);
        expect(yieldOfTheContract).to.eq(claimableYield);

        await expect(
          vestingContract.connect(USER1).claim()
        )
          .to.emit(vestingContract, 'TokensClaimed')
          .withArgs(
            claimAbleAmountOfVestingContract.add(yieldOfTheContract)
          );

        await expect(
          vestingContract.connect(USER1).claim()
        ).to.be.revertedWith('zero claims');

        expect(await token.balanceOf(USER1.address)).to.eq(claimableYield.add(USER_1_GRANT_AMOUNT.mul(INITIAL_CLAIMABLE_PERCENT).div(100)));
      });
    });

    describe('with zero initially claimable amount', () => {
      beforeEach(async () => {
        [vestingContract] = await helper.deploy({
          user: USER1,
          startTime: currentTime,
          grantAmount: USER_1_GRANT_AMOUNT,
          vestingDuration,
          vestingCliff,
          initiallyClaimableAmount: 0
        });
      });

      it('should be return with zero claims if there are no initial claimable and zero tokens vested so far and no yield distributed', async () => {
        const claimAbleAmountOfVestingContract = await vestingContract.connect(USER1).getClaimableAmount();
        expect(claimAbleAmountOfVestingContract).to.eq(0);
        const yieldOfTheContract = await token.unclaimedYieldOf(vestingContract.address);
        expect(yieldOfTheContract).to.eq(0);

        await expect(
          vestingContract.connect(USER1).claim()
        ).to.be.revertedWith('zero claims');

        expect(await token.balanceOf(USER1.address)).to.eq(0);
      });
    });

  });

});

