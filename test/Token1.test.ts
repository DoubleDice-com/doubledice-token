import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DoubleDiceToken, DoubleDiceToken__factory } from '../typechain';
import {
  TOKEN_DECIMALS,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT,
  UNDISTRIBUTED_YIELD_ACCOUNT
} from './lib/constants';
import { $, EvmCheckpoint, TokenHelper } from './lib/utils';

describe('DoubleDiceToken', function () {

  let owner: SignerWithAddress;
  let tokenHolder: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  before(async () => {
    [owner, tokenHolder, user1, user2, user3] = await ethers.getSigners();
  });

  describe('Basic behaviour', () => {

    let contract: DoubleDiceToken;

    let helper: TokenHelper;

    before(async () => {
      contract = await new DoubleDiceToken__factory(owner).deploy($(10_000_000_000), $(4_000_000_000), tokenHolder.address);
      helper = new TokenHelper(contract);
    });

    it('correct ERC-20 metadata', async () => {
      expect(await contract.name()).to.eq(TOKEN_NAME);
      expect(await contract.symbol()).to.eq(TOKEN_SYMBOL);
      expect(await contract.decimals()).to.eq(TOKEN_DECIMALS);
    });

    it('reserved accounts set correctly', async () => {
      expect(await contract.UNDISTRIBUTED_YIELD_ACCOUNT()).to.eq(UNDISTRIBUTED_YIELD_ACCOUNT);
      expect(await contract.UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT()).to.eq(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT);
    });

    it('correct constructor behaviour', async () => {
      expect(await contract.owner()).to.eq(owner.address);
      expect(await contract.totalSupply()).to.eq($(10_000_000_000));
      expect(await contract.balanceOf(UNDISTRIBUTED_YIELD_ACCOUNT)).to.eq($(4_000_000_000));
      expect(await contract.balanceOf(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT)).to.eq($(0));
      expect(await contract.balanceOf(tokenHolder.address)).to.eq($(6_000_000_000));
    });

    it('base case', async function () {
      await (await contract.connect(tokenHolder).transfer(user1.address, $(3_000))).wait();
      await (await contract.connect(tokenHolder).transfer(user2.address, $(3_000))).wait();

      await helper.balanceCheck(user1, { balance: $(3_000), unclaimed: 0 });
      await helper.balanceCheck(user2, { balance: $(3_000), unclaimed: 0 });

      // It's fine to claimYield if there is none
      await contract.connect(user1).claimYield();
      await contract.connect(user2).claimYield();

      await helper.balanceCheck(user1, { balance: $(3_000), unclaimed: 0 });
      await helper.balanceCheck(user2, { balance: $(3_000), unclaimed: 0 });

      await helper.balanceCheck(UNDISTRIBUTED_YIELD_ACCOUNT, { balance: $(4_000_000_000) });
      await helper.balanceCheck(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, { balance: 0 });

      await (await contract.distributeYield($(1_000_000_000), [])).wait();

      await helper.balanceCheck(UNDISTRIBUTED_YIELD_ACCOUNT, { balance: $(3_000_000_000) });
      await helper.balanceCheck(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, { balance: $(1_000_000_000) });

      // (3_000 / 6_000_000_000) * 1_000_000_000 = 500
      // We get a rounding error, because internally 
      await helper.balanceCheck(user1, { balance: $(3_000), unclaimed: $(500, -1) });
      await helper.balanceCheck(user2, { balance: $(3_000), unclaimed: $(500, -1) });

      await (await contract.connect(user1).claimYield()).wait();

      await helper.balanceCheck(user1, { balance: $(3_500, -1), unclaimed: 0 });
      await helper.balanceCheck(user2, { balance: $(3_000), unclaimed: $(500, -1) });
      await helper.balanceCheck(UNDISTRIBUTED_YIELD_ACCOUNT, { balance: $(3_000_000_000) });
      await helper.balanceCheck(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, { balance: $(1_000_000_000).sub($(500, -1)) });

      const checkpoint1 = await EvmCheckpoint.create();


      await (await contract.connect(user2).claimYield()).wait();

      await helper.balanceCheck(user1, { balance: $(3_500, -1), unclaimed: 0 });
      await helper.balanceCheck(user2, { balance: $(3_500, -1), unclaimed: 0 });
      await helper.balanceCheck(UNDISTRIBUTED_YIELD_ACCOUNT, { balance: $(3_000_000_000) });
      await helper.balanceCheck(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, { balance: $(1_000_000_000).sub($(500, -1)).sub($(500, -1)) });


      await checkpoint1.revertTo();


      await helper.balanceCheck(user1, { balance: $(3_500, -1), unclaimed: 0 }, 'user1');
      await helper.balanceCheck(user2, { balance: $(3_000), unclaimed: $(500, -1) }, 'user2');

      await (await contract.connect(user2).transfer(user3.address, $(500))).wait();

      await helper.balanceCheck(user1, { balance: $(3_500, -1), unclaimed: 0 }, 'user1');
      await helper.balanceCheck(user2, { balance: $(2_500), unclaimed: $(500, -1) }, 'user2');
      await helper.balanceCheck(user3, { balance: $(500), unclaimed: 0 }, 'user3');

      await (await contract.connect(user2).claimYield()).wait();

      await helper.balanceCheck(user1, { balance: $(3_500, -1), unclaimed: 0 }, 'user1');
      await helper.balanceCheck(user2, { balance: $(3_000, -1), unclaimed: 0 }, 'user2');
      await helper.balanceCheck(user3, { balance: $(500), unclaimed: 0 }, 'user3');
      await helper.balanceCheck(UNDISTRIBUTED_YIELD_ACCOUNT, { balance: $(3_000_000_000) });
      await helper.balanceCheck(UNCLAIMED_DISTRIBUTED_YIELD_ACCOUNT, { balance: $(1_000_000_000).sub($(500, -1)).sub($(500, -1)) });

    });

  });

});
