/**
 * @type import('hardhat/config').HardhatUserConfig
 */

/* eslint-disable no-undef */
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import dotenv from 'dotenv';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

const dotenvResult = dotenv.config();

if (dotenvResult.error) {
  throw dotenvResult.error;
}

const {
  PROVIDER_HOST,
  PROVIDER_PORT,
  PROVIDER_URL,
  MNEMONIC,
} = process.env;

const GWEI = 1000000000;

module.exports = {
  networks: {
    local: {
      url: `http://${PROVIDER_HOST}:${PROVIDER_PORT}`,
      chainId: 31337,
    },

    rinkeby: {
      url: PROVIDER_URL || '',
      accounts: { mnemonic: MNEMONIC },
      chainId: 4,
      gas: 7700000,
      gasPrice: 1 * GWEI,
    },

    mainnet: {
      url: PROVIDER_URL || '',
      accounts: { mnemonic: MNEMONIC },
      chainId: 4,
      gas: 7700000,
      gasPrice: 1 * GWEI,
    },
  },

  solidity: {
    version: '0.8.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
      metadata: {
        bytecodeHash: 'none',
      },
    },
  },
};
