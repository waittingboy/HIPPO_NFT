const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { ADDRESS_ZERO } = require("./utilities");

let owner, user, alice;
let lots, rand;
let totalQ, _winningTails, _winRateBitValues, _sum;
let _salt, _winQuantity, _totalQuantity, decimal;

describe("draw lots func", async function() {
    this.timeout(10000000)
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];

        this.DrawLots = await ethers.getContractFactory("DrawLotsMock");
        this.Random = await ethers.getContractFactory("RandomNumber")
    });

    beforeEach(async function() {
        rand = await this.Random.deploy();
        await rand.deployed();
        lots = await this.DrawLots.deploy();
        await lots.deployed();
    });

    it("initialize", async function() {
        await lots.initialize();
    });

    describe("draw lots test", async function() {
        beforeEach("", async function() {
            await lots.initialize();
        });

        it("get highest position", async function() {
            let _totalAmount = 66000;
            let str = _totalAmount.toString();
            let eptNum = await lots.getNumberDigit(_totalAmount);
            expect(eptNum).to.be.equal(str.length);
        });

        it("get highest position failed", async function() {
            await expect(lots.getNumberDigit(0)).to.be.revertedWith("length is 0");
        });

        it("get factors", async function() {
            // 1, 2, 5, 8, 9 => [1,0], [2,0], [5,0], [8,0], [9,0]
            let _values = [1,2,5,8,9];
            for (i = 0; i < 5; i++) {
                let eptValues = await lots.getFactors(_values[i]);
                expect(eptValues[0]).to.be.equal(_values[i]);
                expect(eptValues[1]).to.be.equal(0);
            }
            // 3, 4, 6, 7 => [1,2], [2,2], [1,5], [2,5]
            _values = [3,4,6,7];
            let results = [[1,2], [2,2], [1,5], [2,5]];
            for (i = 0; i < 4; i++) {
                let eptValues = await lots.getFactors(_values[i]);
                expect(eptValues[0]).to.be.equal(results[i][0]);
                expect(eptValues[1]).to.be.equal(results[i][1]);
            }
        });

        it("draw lots", async function() {
            //TODO: get the `fail to win lots` tails when the `winRate` GT 0.5
            // let _salt = 66, _winQuantity = 24680, _totalQuantity = 100000, decimal = 6;
            // let _salt = 66, _winQuantity = 24689, _totalQuantity = 100000, decimal = 6;
            // let _salt = 66, _winQuantity = 2, _totalQuantity = 888, decimal = 3;
            // _salt = 66, _winQuantity = 147, _totalQuantity = 527, decimal = 3;
            // _salt = 66, _winQuantity = 255, _totalQuantity = 1030, decimal = 3;
            // _salt = 66, _winQuantity = 170251, _totalQuantity = 170861, decimal = 3;
            let N = 8;
            for(i=0; i<10; i++) {
                console.log("=====================", i+1, "====================");
                _salt = parseInt(Math.random() * 10**3 + 1);
                _totalQuantity = parseInt(Math.random() * 10**N + 1);
                let bitN = await lots.getNumberDigit(_totalQuantity);
                _winQuantity = parseInt(Math.random() * 10**bitN + 1);
                if (_totalQuantity == 1) { _totalQuantity = 7 } // keep `_winQuantity` from being zero.
                if (_winQuantity >= _totalQuantity) {
                    _winQuantity = parseInt(_totalQuantity * Math.random());
                }
                if (_winQuantity == 0) {
                    continue;
                }

                let _winningRate = Math.floor(_winQuantity / _totalQuantity * 10**N); // 135790
                console.log("totalQ:", _totalQuantity);
                console.log("winQ:", _winQuantity);
                console.log("winRate:", _winningRate);

                await lots.drawLots(_salt, _winQuantity, _totalQuantity);
                totalQ = await lots.totalWinQuantity();

                if (_winningRate > 5 * 10**(N - 1)) {
                    _winQuantity = _totalQuantity - _winQuantity;
                }

                console.log("winQ(changed when rate > 0.5):", _winQuantity);
                console.log("totalWinQ:", parseInt(totalQ));
                expect(_winQuantity).to.be.equal(parseInt(totalQ));

                // check compatiable
                _winningTails = await lots.getWinningTails();
                _winRateBitValues = await lots.getWinRateBitValues();
                _sum = 0;
                for(j=0; j<_winRateBitValues.length; j++) {
                    _sum += parseInt(_winRateBitValues[j]);
                }
                console.log("tails' length:", _winningTails.length);
                console.log("the SUM:", _sum);
                expect(_sum).to.be.equal(_winningTails.length);

                // check the tail data
                /*
                let tIndex = 0, eachLen = 0;
                for(j=0; j<_winRateBitValues.length; j++) {
                    eachLen = parseInt(_winRateBitValues[j]);
                    console.log("win rate bit:", eachLen);
                    for (k=0; k<eachLen; k++) {
                        console.log(parseInt(_winningTails[tIndex]));
                        tIndex++;
                    }
                }
                */
            }
        });

        it("draw lots with special rate", async function() {
            // let _salt = 66, _winQuantity = 264119742103, _totalQuantity = 943284793225, N = 12;
            // _salt = 66, _winQuantity = 255, _totalQuantity = 1030, N = 4;
            let _salt = 66, _winQuantity = 277, _totalQuantity = 1000, N = 4;
            for(i=0; i<10; i++) {
                console.log("=====================", i+1, "====================");
                let _winningRate = Math.floor(_winQuantity / _totalQuantity * 10**N); // 135790
                console.log("totalQ:", _totalQuantity);
                console.log("winQ:", _winQuantity);
                console.log("winRate:", _winningRate);

                await lots.drawLots(_salt, _winQuantity, _totalQuantity);
                totalQ = await lots.totalWinQuantity();

                console.log("totalWinQ:", parseInt(totalQ));
                expect(_winQuantity).to.be.equal(parseInt(totalQ));

                // check compatiable
                _winningTails = await lots.getWinningTails();
                _winRateBitValues = await lots.getWinRateBitValues();
                _sum = 0;
                let retRate = 0;
                for(j=0; j<_winRateBitValues.length; j++) {
                    let tValue = parseInt(_winRateBitValues[j]);
                    _sum += tValue;
                    retRate += tValue * 10**(N - j - 1);
                }
                console.log("return winRate:", retRate);
                console.log("tails' length:", _winningTails.length);
                console.log("the SUM:", _sum);
                expect(_sum).to.be.equal(_winningTails.length);
            }
        });

        it("draw lots failed", async function() {
            await expect(lots.drawLots(11, 0, 1)).to.be.revertedWith("win quantity is 0 or greater than or equal to win quantity")
            await expect(lots.drawLots(11, 1, 1)).to.be.revertedWith("win quantity is 0 or greater than or equal to win quantity")
        });

        describe("after draw lots", async function() {
            let _winQ = 147, _totalQ = 525, _N = 3;
            beforeEach("", async function() {
                await lots.drawLots(66, _winQ, _totalQ);
            });

            it("reset date", async function() {
                let _hiBit = await lots.highestDigit();
                let _totalWQ = await lots.totalWinQuantity();
                let _winTails = await lots.getWinningTails();
                let _winRateBits = await lots.getWinRateBitValues();
                let _tail = parseInt(_winTails[0]);
                let eptBool = await lots.isWinningTail(_tail);
                expect(_hiBit).to.be.equal(_N);
                expect(_totalWQ).to.be.equal(_winQ);
                expect(eptBool).to.be.equal(true);

                await lots.resetData();

                _hiBit = await lots.highestDigit();
                _totalWQ = await lots.totalWinQuantity();
                _winTails = await lots.getWinningTails();
                _winRateBits = await lots.getWinRateBitValues();
                eptBool = await lots.isWinningTail(_tail);
                expect(_hiBit).to.be.equal(0);
                expect(_totalWQ).to.be.equal(0);
                expect(_winTails.length).to.be.equal(0);
                expect(_winRateBits.length).to.be.equal(0);
                expect(eptBool).to.be.equal(false);
            });

            it("get winning quantity", async function() {
                let eptInt = await lots.getWinningQuantity(1, 7, _totalQ);
                // 525 / 10 = 52, 7 > 5
                expect(eptInt).to.be.equal(52);

                eptInt = await lots.getWinningQuantity(2, 23, _totalQ);
                // 525 / 100 = 5, 23 < 25, +1
                expect(eptInt).to.be.equal(6);

                eptInt = await lots.getWinningQuantity(3, 23, _totalQ);
                // 525 / 1000 = 0, 23 < 525, +1
                expect(eptInt).to.be.equal(1);
            });

            it("storage winning info", async function() {
                let _tail = 666;
                // 666 > 525, it can't be a valid tail.
                let eptBool = await lots.isWinningTail(_tail);
                expect(eptBool).to.be.equal(false);

                await lots.storageWinningInfo(_tail);
                eptBool = await lots.isWinningTail(_tail);
                expect(eptBool).to.be.equal(true);
            });
        });
    });
});
