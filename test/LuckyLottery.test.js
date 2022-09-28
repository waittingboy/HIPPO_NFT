const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { ADDRESS_ZERO } = require("./utilities");

let owner, user, alice;
let lucky, token20, rand, lots;

describe("Lucky Lottery func", async function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];

        this.Lucky = await ethers.getContractFactory("LuckyLotteryMock");
        this.Token20 = await ethers.getContractFactory("Token20Mock")
        this.DrawLot = await ethers.getContractFactory("DrawLotsMock")
        this.Random = await ethers.getContractFactory("RandomNumber")
    });

    beforeEach(async function() {
        rand = await this.Random.deploy();
        await rand.deployed();

        lucky = await this.Lucky.deploy();
        await lucky.deployed();

        token20 = await this.Token20.deploy();
        await token20.deployed();

        lots = await this.DrawLot.deploy();
        await lots.deployed();
    });

    it("initialize", async function() {
        await lucky.initialize(owner.address, lots.address);
        let eptMBMAddr = await lucky.mysteryBoxMarketAddress();
        let eptDrawLot = await lucky.drawLots();
        let eptMLAQuantity = await lucky.getMinLotteryAddressQuantityOfPool(0);

        expect(eptMBMAddr).to.be.equal(owner.address);
        expect(eptDrawLot).to.be.equal(lots.address);
        expect(eptMLAQuantity).to.be.equal(500000)
    });

    describe("Lucky Lottery test", async function() {
        beforeEach("", async function() {
            await lucky.initialize(owner.address, lots.address);
            await lots.initialize();
        });

        it("adjust min lottery address quantity", async function() {
            let _minLAQuantity = 200000;
            await lucky.adjustMinLotteryAddressQuantityOfPool(0, _minLAQuantity);
            let eptMLAQuantity = await lucky.getMinLotteryAddressQuantityOfPool(0);
            expect(eptMLAQuantity).to.be.equal(_minLAQuantity);
        });

        it("mint failed when caller is not governance address", async function() {
            let _minLAQuantity = 200000;
            await expect(lucky.connect(user)
                .adjustMinLotteryAddressQuantityOfPool(0, _minLAQuantity, {from:user.address}))
                .to.be.revertedWith("Ownable: caller is not the owner")
        });

        it("add reward token", async function() {
            let rewardToken20s = await lucky.getRewardToken20s();
            let rewardToken20sLen = rewardToken20s.length;
            await lucky.addRewardToken(token20.address);
            let rewardToken20sAfter = await lucky.getRewardToken20s();
            let rewardToken20sAfterLen = rewardToken20sAfter.length;
            expect(rewardToken20sAfterLen).to.be.equal(rewardToken20sLen + 1);
            expect(rewardToken20sAfter[rewardToken20sAfterLen - 1]).to.be.equal(token20.address);
        });

        it("add reward token faile when caller is not mysteryBoxMarket address", async function() {
            await expect(lucky.connect(user)
                .addRewardToken(token20.address, {from:user.address}))
                .to.revertedWith("only mystery box market contract authorized");
        });

        it("add lottery data", async function() {
            let _poolId = 1, _lotTimes = 1, _quantity = 50, _amount = 50;
            let retBefore = await lucky.getWinningData(_poolId, _lotTimes);
            let _totalQuantityBefore = parseInt(retBefore[0]);
            let _userBuyTimesBefore = parseInt(await lucky.getUserBuyTimes(_poolId, _lotTimes, user.address));
            let _remainAmountBefore = parseInt(await lucky.getRemainAmount(_poolId, token20.address));
            let _userBuyQuantityBefore = parseInt(await lucky.getUserBuyQuantity(_poolId, _lotTimes, user.address));

            await lucky.addLotteryData(_poolId, user.address, _quantity, token20.address, _amount);

            let _totalQuantityAfter = parseInt(await lucky.getLotteryTotalQuantity(_poolId, _lotTimes));
            let _userBuyTimesAfter = parseInt(await lucky.getUserBuyTimes(_poolId, _lotTimes, user.address));
            let _userNumbersAfter = await lucky.getUserNumbers(_poolId, _lotTimes, _userBuyTimesAfter, user.address);
            let _startNum = parseInt(_userNumbersAfter[0]), _endNum = parseInt(_userNumbersAfter[1]);
            let _remainAmountAfter = parseInt(await lucky.getRemainAmount(_poolId, token20.address));
            let _userBuyQuantityAfter = parseInt(await lucky.getUserBuyQuantity(_poolId, _lotTimes, user.address));

            // check
            expect(_totalQuantityAfter).to.be.equal(_totalQuantityBefore + _quantity);
            expect(_userBuyTimesAfter).to.be.equal(_userBuyTimesBefore + 1);
            expect(_endNum).to.be.equal(_startNum + _quantity - 1);
            expect(_remainAmountAfter).to.be.equal(_remainAmountBefore + _amount);
            expect(_userBuyQuantityAfter).to.be.equal(_userBuyQuantityBefore + _quantity);

            await lucky.addLotteryData(_poolId, user.address, 10, token20.address, _amount);
            _userBuyQuantityAfter = parseInt(await lucky.getUserBuyQuantity(_poolId, _lotTimes, user.address));
            expect(_userBuyQuantityAfter).to.be.equal(_userBuyQuantityBefore + _quantity + 10);
        });

        it("add lottery address failed", async function() {
            await expect(lucky.connect(user)
                .addLotteryData(1, user.address, 50, token20.address, 50, {from:user.address}))
                .to.revertedWith("only mystery box market contract authorized");
        });

        describe("after add lottery address", async function() {
            let _poolId = 1, _totalQ = 525, _winQuantity = 1;
            let _lotTimes = 1, _rewardRatio = 10000; _amount = 999;
            beforeEach("", async function() {
                await lucky.addRewardToken(token20.address);
                await lucky.adjustMinLotteryAddressQuantityOfPool(_poolId, _totalQ);
                let addQ1 = 200, addQ2 = 200; addQ3 = 125
                await lucky.addLotteryData(_poolId, user.address, addQ1, token20.address, 333);
                await lucky.addLotteryData(_poolId, alice.address, addQ2, token20.address, 333);
                await lucky.addLotteryData(_poolId, user.address, addQ3, token20.address, 333);
            });

            it("draw lottery", async function() {
                // TODO: all tokens distribute by the same `_rewardRatio`?
                let _remainAmount = parseInt(await lucky.getRemainAmount(_poolId, token20.address));
                expect(_remainAmount).to.be.equal(_amount);
                let _rewardAmount = parseInt(await lucky.getLotteryRewardAmount(_poolId, _lotTimes, token20.address));
                expect(_rewardAmount).to.be.equal(0);

                let _lotteryTimesBefore = parseInt(await lucky.getLotteryTimes(_poolId));
                await lucky.drawLottery(_poolId);
                let _lotteryTimes = parseInt(await lucky.getLotteryTimes(_poolId));
                expect(_lotteryTimes).to.be.equal(_lotteryTimesBefore + 1);

                let eptRatio = await lucky.getLotteryRewardRatio(_poolId, _lotTimes);
                expect(eptRatio).to.be.equal(_rewardRatio);

                _remainAmount = parseInt(await lucky.getToken20RemainAmount(_poolId, token20.address));
                expect(_remainAmount).to.be.equal(0);
                _rewardAmount = parseInt(await lucky.getLotteryRewardAmount(_poolId, _lotTimes, token20.address));
                expect(_rewardAmount).to.be.equal(_amount);

                let retWinDate = await lucky.getWinningData(_poolId, _lotTimes);
                expect(parseInt(retWinDate[0])).to.be.equal(_totalQ);  // all lots
                expect(parseInt(retWinDate[3])).to.be.equal(_winQuantity);  // winning lots

                console.log("check data manually");
                console.log("winQ:", _winQuantity);
                console.log("totalQ:", _totalQ);
                let _winningTails = retWinDate[1], _winRateBitValues = retWinDate[2];
                let tailIndex = 0, eachLen = 0;
                for(j=0; j<_winRateBitValues.length; j++) {
                    eachLen = parseInt(_winRateBitValues[j]);
                    console.log("winning rate bit:", eachLen);
                    for(k=0; k<eachLen; k++) {
                        console.log(parseInt(_winningTails[tailIndex]));
                        tailIndex++;
                    }
                }
            });

            it("draw lottery failed", async function() {
                // requier totalQ >= minAddressQ
                await lucky.adjustMinLotteryAddressQuantityOfPool(_poolId, _totalQ + 1);
                await expect(lucky.drawLottery(_poolId))
                    .to.be.revertedWith("the length of lottery addresses not equal to lotteryAddressQuantity");
            });

            it("receive reward", async function() {
                // limit: endNum - startNum = 137 (1,700,000 gas), 525 (8,290,000 gas)
                let userRewardAmount = await lucky.getUserRewardAmount(_poolId, _lotTimes, user.address, token20.address);
                let aliceRewardAmount = await lucky.getUserRewardAmount(_poolId, _lotTimes,alice.address, token20.address);
                expect(userRewardAmount).to.be.equal(0);
                expect(aliceRewardAmount).to.be.equal(0);

                await lucky.drawLottery(_poolId);

                await token20.addBalance(lucky.address, _amount + 1);

                let eptBalance = await lucky.getToken20Balance(token20.address);
                expect(eptBalance).to.be.equal(_amount + 1);

                await lucky.connect(user).receiveReward(_poolId, _lotTimes, 1, {from:user.address});
                await lucky.connect(alice).receiveReward(_poolId, _lotTimes, 1, {from:alice.address});
                await lucky.connect(user).receiveReward(_poolId, _lotTimes, 2, {from:user.address});

                // `user.address` got all winning lots
                userRewardAmount = await lucky.getUserRewardAmount(_poolId, _lotTimes, user.address, token20.address);
                aliceRewardAmount = await lucky.getUserRewardAmount(_poolId, _lotTimes, alice.address, token20.address);
                // expect(userRewardAmount).to.be.equal(_amount);
                console.log("user's reward amount:", parseInt(userRewardAmount));
                console.log("alice's reward amount:", parseInt(aliceRewardAmount));
            });

            it("receive reward failed", async function() {
                // lotTimes is 0
                await expect(lucky.receiveReward(1, 1, 1))
                    .to.be.revertedWith("input lottery times is 0 or greater than actual lottery times");

                // buyTimes is 1
                await lucky.drawLottery(_poolId);
                await expect(lucky.receiveReward(1, 1, 2))
                    .to.be.revertedWith("input buy times is 0 or greater than actual buy times");

                // already received this reward
                await token20.addBalance(lucky.address, _amount + 1);
                await lucky.connect(user).receiveReward(_poolId, _lotTimes, 1, {from:user.address});
                await expect(lucky.connect(user)
                    .receiveReward(_poolId, _lotTimes, 1, {from:user.address}))
                    .to.be.revertedWith("numbers has been verified");
            });

            it("get remain lottery address quantity of pool times", async function() {
                await lucky.adjustMinLotteryAddressQuantityOfPool(_poolId, _totalQ + 100);
                expect(await lucky.getRemainLotteryAddressQuantityOfPoolTimes(_poolId)).to.be.equal(100);
            })
        });
    });
});
