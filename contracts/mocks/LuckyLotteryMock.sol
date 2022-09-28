// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "../interfaces/IDrawLots.sol";
import "../interfaces/ILuckyLottery.sol";

contract LuckyLotteryMock is OwnableUpgradeable, ILuckyLottery {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using SafeMathUpgradeable for uint;

    address public mysteryBoxMarketAddress;

    // Draw lots instance
    IDrawLots public drawLots;

    // Tokens need to transfer
    address[] public rewardToken20s;

    struct Lottery {
        // all winning tails
        uint[] winningTails;
        // number of winning tail for each digit
        uint[] winRateBitValues;
        // number of winners
        uint winningQuantity;
        // suggest 10000
        uint rewardRatio;
        // mapping from token address to token amount
        mapping(address => uint) rewardAmount;
    }

    struct Number {
        // number is index plus 1
        uint startNumber;
        uint endNumber;
        bool isVerify;
    }

    struct UserInfo {
        // each user buy times, start from 1
        uint buyTimes;
        // each user buy quantity
        uint buyQuantity;
        // mapping from token address to token amount
        mapping(address => uint) rewardAmount;
        // mapping from buy times to Number
        mapping(uint => Number) numbers;
    }

    struct LotteryPool {
        // each pool lottery times, start from 1
        uint lotteryTimes;
        // mapping from lottery times to total numbers of address
        mapping(uint => uint) totalQuantities;
        // mapping from token address to token amount
        mapping(address => uint) remainAmount;
        // mapping from lottery times to Lottery
        mapping(uint => Lottery) lottery;
        // mapping from lottery times to user address to user info
        mapping(uint => mapping(address => UserInfo)) lotteryUserInfos;
    }

    // Mapping from poolId to lottery pool
    mapping(uint => LotteryPool) public lotteryPools;

    // Reach the min quantity of pool, can draw lottery
    mapping(uint => uint) public minLotteryAddressQuantities;

    modifier onlyMysteryBoxMarket() {
        require (mysteryBoxMarketAddress == _msgSender(), "only mystery box market contract authorized");
        _;
    }

    function initialize(address _mysteryBoxMarketAddress, IDrawLots _drawLots) public initializer {
        __Ownable_init();

        mysteryBoxMarketAddress = _mysteryBoxMarketAddress;
        drawLots = _drawLots;
        minLotteryAddressQuantities[0] = 500000;
    }

    /**
     * @dev Adjust the min lottery address quantity of pool
     * Can only be called by the current owner
     */
    function adjustMinLotteryAddressQuantityOfPool(uint _poolId, uint _minLotteryAddressQuantity) public onlyOwner {
        minLotteryAddressQuantities[_poolId] = _minLotteryAddressQuantity;
    }

    /**
     * @dev Add reward token to transfer this token's balance
     */
    function addRewardToken(address _token20Address) external override onlyMysteryBoxMarket {
        rewardToken20s.push(_token20Address);
    }

    /**
     * @dev Add lottery data to lottery pool
     */
    function addLotteryData(uint _poolId, address _address, uint _quantity, address _token20Address, uint _amount) external override onlyMysteryBoxMarket {
        LotteryPool storage lotteryPool = lotteryPools[_poolId];
        // before the draw, the lottery times need plus 1
        uint lotteryTimes = lotteryPool.lotteryTimes + 1;

        lotteryPool.totalQuantities[lotteryTimes] += _quantity;

        UserInfo storage userInfo = lotteryPool.lotteryUserInfos[lotteryTimes][_address];
        uint buyTimes = ++userInfo.buyTimes;
        userInfo.buyQuantity += _quantity;
        uint endNumber = userInfo.numbers[buyTimes].endNumber = lotteryPool.totalQuantities[lotteryTimes];
        userInfo.numbers[buyTimes].startNumber = endNumber - _quantity + 1;

        lotteryPool.remainAmount[_token20Address] = lotteryPool.remainAmount[_token20Address].add(_amount);
    }

    /**
     * @dev Draw a winner from lottery addresses
     * Can only be called by the current owner
     *
     * Requirements:
     * - the length of lottery addresses must be greater than or equal to 'minLotteryAddressQuantity'
     */
    function drawLottery(uint _poolId) public override {
        uint _rewardRatio = 10000;
        uint _salt = block.number;
        uint _winQuantity = 1;
        LotteryPool storage lotteryPool = lotteryPools[_poolId];
        // before the draw, the lottery times need plus 1
        uint lotteryTimes = lotteryPool.lotteryTimes + 1;
        uint totalQuantity = lotteryPool.totalQuantities[lotteryTimes];

        require(totalQuantity == minLotteryAddressQuantities[_poolId], "the length of lottery addresses not equal to lotteryAddressQuantity");

        (uint[] memory winningTails, uint[] memory winRateBitValues,) = drawLots.drawLots(_salt, _winQuantity, totalQuantity);
        lotteryPool.lotteryTimes++;

        Lottery storage lottery = lotteryPool.lottery[lotteryPool.lotteryTimes];
        lottery.winningTails = winningTails;
        lottery.winRateBitValues = winRateBitValues;
        lottery.winningQuantity = _winQuantity;
        lottery.rewardRatio = _rewardRatio;

        for (uint i = 0; i < rewardToken20s.length; i++) {
            address rewardToken20 = rewardToken20s[i];
            uint reward = lotteryPool.remainAmount[rewardToken20].mul(_rewardRatio).div(10000);

            lotteryPool.remainAmount[rewardToken20] = lotteryPool.remainAmount[rewardToken20].sub(reward);
            lottery.rewardAmount[rewardToken20] = reward;
        }
    }

    /**
     * @dev User receive reward
     *
     * Requirements:
     * - input lottery times must be greater than 0 and less than or equal to actual lottery times
     * - input buy times must be greater than 0 and less than or equal to actual buy times
     * - the numbers of user buy times must not be verified
     */
    function receiveReward(uint _poolId, uint _lotteryTimes, uint _buyTimes) public {
        LotteryPool storage lotteryPool = lotteryPools[_poolId];

        require(_lotteryTimes > 0 && _lotteryTimes <= lotteryPool.lotteryTimes, "input lottery times is 0 or greater than actual lottery times");

        UserInfo storage userInfo = lotteryPool.lotteryUserInfos[_lotteryTimes][_msgSender()];
        Lottery storage lottery = lotteryPool.lottery[_lotteryTimes];

        require(_buyTimes > 0 && _buyTimes <= userInfo.buyTimes, "input buy times is 0 or greater than actual buy times");
        require(!userInfo.numbers[_buyTimes].isVerify, "numbers has been verified");

        // verify the number and count the number of wins
        uint startNumber = userInfo.numbers[_buyTimes].startNumber;
        uint endNumber = userInfo.numbers[_buyTimes].endNumber;
        uint winningQuantity = 0;

        // console.log("tail's length:", lottery.winningTails.length);
        for (uint i = startNumber; i <= endNumber; i++) {
            uint startIndex = 0;

            for (uint j = 0; j < lottery.winRateBitValues.length; j++) {
                for (uint m = startIndex; m < startIndex + lottery.winRateBitValues[j]; m++) {
                    uint numberTail = i % 10 ** (j + 1);
                    // console.log("tail's index:", m);
                    if (numberTail == lottery.winningTails[m]) {
                        // console.log("winning number:", i);
                        winningQuantity++;
                    }
                }
                // console.log("startIndex:", startIndex);
                startIndex += lottery.winRateBitValues[j];
            }
        }

        console.log("=============================================");
        console.log("startNumber:", startNumber);
        console.log("endNumber:", endNumber);
        console.log("winningQuantity:", winningQuantity);
        console.log("totalWinQuantity:", lottery.winningQuantity);

        // send reward
        for (uint i = 0; i < rewardToken20s.length; i++) {
            address rewardToken20 = rewardToken20s[i];
            IERC20MetadataUpgradeable token20 = IERC20MetadataUpgradeable(rewardToken20);

            uint rewardAmount = lottery.rewardAmount[rewardToken20].mul(winningQuantity).div(lottery.winningQuantity);
            console.log("rewardAmount:", rewardAmount);
            token20.transfer(_msgSender(), rewardAmount);
            userInfo.rewardAmount[rewardToken20] += rewardAmount;
        }

        userInfo.numbers[_buyTimes].isVerify = true;
    }

    function getRewardToken20s() public view returns (address[] memory) {
        return rewardToken20s;
    }

    function getWinningData(uint _poolId, uint _lotteryTimes) public view returns (uint, uint[] memory, uint[] memory, uint) {
        LotteryPool storage lotteryPool = lotteryPools[_poolId];
        uint totalQuantity = lotteryPool.totalQuantities[_lotteryTimes];
        Lottery storage lottery = lotteryPool.lottery[_lotteryTimes];

        return (totalQuantity, lottery.winningTails, lottery.winRateBitValues, lottery.winningQuantity);
    }

    function getLotteryTimes(uint _poolId) public view returns (uint) {
        return lotteryPools[_poolId].lotteryTimes;
    }

    function getLotteryTotalQuantity(uint _poolId, uint _lotteryTimes) public view returns (uint) {
        return lotteryPools[_poolId].totalQuantities[_lotteryTimes];
    }

    function getLotteryRewardRatio(uint _poolId, uint _lotteryTimes) public view returns (uint) {
        return lotteryPools[_poolId].lottery[_lotteryTimes].rewardRatio;
    }

    function getLotteryRewardAmount(uint _poolId, uint _lotteryTimes, address _token20Address) public view returns (uint) {
        return lotteryPools[_poolId].lottery[_lotteryTimes].rewardAmount[_token20Address];
    }

    function getUserBuyTimes(uint _poolId, uint _lotteryTimes, address _address) public view returns (uint) {
        return lotteryPools[_poolId].lotteryUserInfos[_lotteryTimes][_address].buyTimes;
    }

    function getUserBuyQuantity(uint _poolId, uint _lotteryTimes, address _address) public view returns (uint) {
        return lotteryPools[_poolId].lotteryUserInfos[_lotteryTimes][_address].buyQuantity;
    }

    function getUserRewardAmount(uint _poolId, uint _lotteryTimes, address _address,  address _token20Address) public view returns (uint) {
        return lotteryPools[_poolId].lotteryUserInfos[_lotteryTimes][_address].rewardAmount[_token20Address];
    }

    function getUserNumbers(uint _poolId, uint _lotteryTimes, uint _buyTimes, address _address) public view returns (Number memory) {
        UserInfo storage userInfo = lotteryPools[_poolId].lotteryUserInfos[_lotteryTimes][_address];

        return userInfo.numbers[_buyTimes];
    }

    function getMinLotteryAddressQuantityOfPool(uint _poolId) public override view returns (uint) {
        return minLotteryAddressQuantities[_poolId];
    }

    function getToken20Balance(address _token20Address) public view returns (uint) {
        return IERC20MetadataUpgradeable(_token20Address).balanceOf(address(this));
    }

    function getToken20RemainAmount(uint _poolId, address _token20Address) public view returns (uint) {
        LotteryPool storage lotteryPool = lotteryPools[_poolId];

        return lotteryPool.remainAmount[_token20Address];
    }


    function getRemainAmount(uint _poolId, address _token20Address) public view returns(uint) {
        return lotteryPools[_poolId].remainAmount[_token20Address];
    }
    
    function getRemainLotteryAddressQuantityOfPoolTimes(uint _poolId) public override view returns (uint) {
        LotteryPool storage lotteryPool = lotteryPools[_poolId];
        // before the draw, the lottery times need plus 1
        uint lotteryTimes = lotteryPool.lotteryTimes + 1;

        return minLotteryAddressQuantities[_poolId] - lotteryPool.totalQuantities[lotteryTimes];
    }
}
