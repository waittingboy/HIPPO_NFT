module.exports = {
  skipFiles: [
    "Base.sol",
    "LuckyLottery.sol",
    "NFTAuctionMarket.sol",
    "NFTExchangeMarket.sol",
    "NFTFactory.sol",
    "lib/BancorFormula.sol",
    "lib/Utils.sol",
    "mocks/DemocracyMock.sol",
    "mocks/ERC20MockDecimals6.sol",
    "mocks/MysteryBoxMock.sol",
    "mocks/BancorFormulaMock.sol",
    "mocks/Token20Mock.sol",
  ],
  mocha: {
    enableTimeouts: false,
  },
};
