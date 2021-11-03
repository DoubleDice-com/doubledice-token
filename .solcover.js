module.exports = {
  file: 'test/*.js',
  copyPackages: [
    '@openzeppelin/contracts'
  ],
  istanbulReporter: ['html', 'lcov', 'text'],
  providerOptions: {
    mnemonic: 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat', // Mnemonic used for develop
    default_balance_ether: '1000000000000000000', // In ethers
    gasLimit: 0xfffffffffff,
  },
};
