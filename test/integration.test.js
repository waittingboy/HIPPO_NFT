const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const {BN} = require('@openzeppelin/test-helpers');
const { time } = require("./utilities")
const { smoddit } = require("@eth-optimism/smock");

async function withDecimals(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(18))).toString();
}
let owner;
let user;
let alice;
let bob;
let cloud;
let _NFTFundAccount;
let _handlingFeeAccount;
describe("Integration whole func",function() {
    this.timeout(400000);
    before(async function () {
        this.signers = await ethers.getSigners()
        owner = this.signers[0]
        user = this.signers[1]
        alice = this.signers[2]
        bob = this.signers[3];
        cloud = this.signers[4];
        this.mockMysteryBoxMarket = this.signers[4]
        this.MBGovernanceAddress = this.signers[5]
        this.newBonusToken = this.signers[7];

        this.MysteryBox = await smoddit("MysteryBox");
        this.Democracy = await smoddit("MyDemocracyMock");
        this.MysteryBoxMarket = await smoddit("MysteryBoxMarket");
        // this.MysteryBoxMarket = await ethers.getContractFactory("MysteryBoxMarket");
        this.NFTFactory = await ethers.getContractFactory("NFTFactory");
        this.RandomNumber = await ethers.getContractFactory("RandomNumber");
        // this.Crowdfund = await ethers.getContractFactory("Crowdfund");
        this.LuckyLottery = await ethers.getContractFactory("LuckyLottery");
        this.NFTFundToken = await ethers.getContractFactory("NFTFundToken");

        this.ERC20Smart = await ethers.getContractFactory("ERC20Smart");
        this.CrowdfundPools = await ethers.getContractFactory("CrowdfundPools");
        // this.NFTFactory = await ethers.getContractFactory("NFTFactoryMock");
        this.Base = await ethers.getContractFactory("Base");
        this.BancorFormulaMock = await ethers.getContractFactory("BancorFormulaMock");
        this.DrawLots = await ethers.getContractFactory("DrawLots");

        this.UserTokens=await ethers.getContractFactory("UserTokens");
    })

    beforeEach(async function (){
        this.bancor = await this.BancorFormulaMock.deploy();
        await this.bancor.deployed();
        this.mysteryBox = await this.MysteryBox.deploy();
        await this.mysteryBox.deployed();
        await this.mysteryBox.initialize(owner.address);


        // this.crowdfund =await this.Crowdfund.deploy();
        // await this.crowdfund.deployed();

        this.mysteryBoxMarket= await this.MysteryBoxMarket.deploy();
        await this.mysteryBoxMarket.deployed();

        this.pledgeToken = await this.ERC20Smart.deploy("hip token", "hip");
        await this.pledgeToken.deployed()
        this.hnqToken = await this.ERC20Smart.deploy("hnq token", "hnq");
        await this.hnqToken.deployed()
        this.usdc = await this.ERC20Smart.deploy("USDC token", "USDC");
        await this.usdc.deployed();
        this.usdt = await this.ERC20Smart.deploy("USDT token", "USDT");
        await this.usdt.deployed();
        this.dai = await this.ERC20Smart.deploy("dai token", "dai");
        await this.dai.deployed();
        this.elc = await this.ERC20Smart.deploy("ELC token", "ELC");
        await this.elc.deployed()
        this.base = await this.Base.deploy();
        await this.base.deployed()

        this.token1155 = await this.NFTFactory.deploy();
        this.token1155.deployed();
        this.randomNumber = await this.RandomNumber.deploy()
        await this.randomNumber.deployed()
        this.crowdfundPools = await this.CrowdfundPools.deploy();
        await this.crowdfundPools.deployed();

        this.hip = await this.ERC20Smart.deploy("hip","hip token");
        this.democracy = await this.Democracy.deploy();
        await this.democracy.deployed();
        await this.democracy.initialize(this.hip.address,await withDecimals(200000),this.base.address,user.address,this.usdt.address,this.usdt.address);

        //     function initialize(
        //         uint _startBlock,IERC20MetadataUpgradeable _pledgeToken,address _mysteryBoxMarket,
        //         IHnqToken _hnqToken,INFTFactory _nftFactory,IBase _base,address _democracy,
        //         IRandomNumber _randomNumber, address[] memory _bonusTokens//IMysteryBox _mysteryBox,
        // )
        let startBlock = await time.latestBlock()
        let bonusTokens = [this.usdc.address,this.elc.address]
        this.drawLots = await this.DrawLots.deploy();
        await this.drawLots.deployed();
        await this.drawLots.initialize(this.randomNumber.address);
        await this.crowdfundPools.initialize(
            startBlock,this.pledgeToken.address,this.mysteryBoxMarket.address,
            this.hnqToken.address, this.token1155.address,this.base.address,
            this.democracy.address, this.drawLots.address, bonusTokens
        );
        
        // function initialize(
        //     IERC20Upgradeable _hip,INFTFactory _nft, IMysteryBox _mysteryBox,
        //     address _democracy,address _crowdfund
        // )
        await this.base.initialize(
            owner.address,
            this.token1155.address,
            this.mysteryBox.address,
            this.democracy.address,
            this.crowdfundPools.address
        );

        this.luckyLottery =await this.LuckyLottery.deploy();
        await this.luckyLottery.deployed();
        await this.luckyLottery.initialize(this.mysteryBoxMarket.address,this.drawLots.address);
        //constructor (string memory name_, string memory symbol_, uint32  weight_, uint initConnAmount_, uint initSupply_, IBancorFormula bancor_){

        this.nftFound =await this.NFTFundToken.deploy();
        await this.nftFound.deployed();
        await this.nftFound.initialize("testFund","testFundToken",100,200,3000,this.bancor.address);
        await this.nftFound.transferOwnership(this.mysteryBoxMarket.address);
        this.token20 =await this.ERC20Smart.deploy("test1","test1");
        await this.token20.deployed();


        //IERC1155Upgradeable _token1155, IMysteryBox _mysteryBox, IRandomNumber _random, ICrowdFund _crowdFund, ILuckyLottery _luckyLottery,
        // INFTFund _NFTFund, address payable _NFTFundAccount, address payable _handlingFeeAccount, address[] memory _token20sAddress
        _NFTFundAccount = bob.address;
        _handlingFeeAccount = alice.address;
        this.userTokens =await this.UserTokens.deploy();
        await this.userTokens.deployed();
        await this.userTokens.initialize(this.token1155.address);
        //await this.userTokens.setInternalCaller(this.mysteryBoxMarket.address,true);
        await this.userTokens.setInternalCaller(this.token1155.address,true);
        await this.token1155.initialize(this.userTokens.address,this.crowdfundPools.address);

        await this.mysteryBoxMarket.initialize(
            this.token1155.address,
            this.mysteryBox.address,
            this.randomNumber.address,
            this.crowdfundPools.address,
            this.luckyLottery.address,
            this.nftFound.address,
            _NFTFundAccount,
            _handlingFeeAccount,
            bonusTokens);

    });

    it("test initialize", async function() {
        var token1155Address = await this.mysteryBoxMarket.token1155();
        expect(token1155Address).to.equal(this.token1155.address);
        var mysteryBoxAddress = await this.mysteryBoxMarket.mysteryBox();
        expect(mysteryBoxAddress).to.equal(this.mysteryBox.address);
        // var randomAddress = await this.mysteryBoxMarket.random();
        // expect(randomAddress).to.equal(this.randomNumber.address);
        var crowFundAddress = await this.mysteryBoxMarket.crowdFund();
        expect(crowFundAddress).to.equal(this.crowdfundPools.address);
        var luckyLotteryAddress = await this.mysteryBoxMarket.luckyLottery();
        expect(luckyLotteryAddress).to.equal(this.luckyLottery.address);
        var nftFundAddress = await this.mysteryBoxMarket.NFTFund();
        expect(nftFundAddress).to.equal(this.nftFound.address);
        var nftFundAccount = await this.mysteryBoxMarket.NFTFundAccount();
        expect(nftFundAccount).to.equal(_NFTFundAccount);
        var handlingFeeAccount = await this.mysteryBoxMarket.handlingFeeAccount();
        expect(handlingFeeAccount).to.equal(_handlingFeeAccount);
        var maxOpenQuantity = await this.mysteryBoxMarket.getMaxOpenQuantity();
        expect(maxOpenQuantity).to.equal(0);

    });

    it("integration for test create democracy crowdfund buy open", async function() {
        var poolId = 1;
        var workId = 1;
        var workId2 = 2;
        var workId3 = 3;
        var workId4 = 4;

        await this.usdt.mint(owner.address,withDecimals(1000));
        await this.usdt.approve(this.mysteryBoxMarket.address,withDecimals(1000));

        let _crowdfundRatio_0 = "0"
        let _proposer = owner.address;
        let _proposalId = "1"
        let _dividendRatio = "50"
        let _duration = 1000;
        let _minJoinAmount = await withDecimals("100000");
        let _maxJoinAmount = await withDecimals("100000000");
        let _hnqAmount = await withDecimals("3000");
        let _hipAmountPerHnq = await withDecimals("100000");
        let _targetAmount = await withDecimals("110000000");

        // function addWorks(string memory _collectionName,string memory _collectionDesc,string memory _collectionUrl,
        //     string[] memory _workNames,string[] memory _urls, uint64[] memory _completeNftNums,
        //     uint64[] memory _compToFragNftNums,uint64[] memory _fragNumPerCompNFTs
        // )
        await this.base.addWorks("_collectionName","_collectionDesc","_collectionUrl",["_workNames1","_workNames2"]
        ,["_urls1","_urls2"],["10","10"],["20","30"],["10","15"]);

        //start democracy success
        let voteAmount = 1000;
        let hipBalance = await this.hip.balanceOf(owner.address);
        console.log("hipBalance is:",hipBalance.toString());
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        let propState = await this.democracy.getPropState(1);
        await this.democracy.vote(1,await withDecimals(voteAmount));
        let proposalInfo = await this.democracy.proposals(1);

        let voteInfo = await this.democracy.votes(1,0);
        expect(voteInfo.approve).to.equal(await withDecimals(voteAmount));
        expect(voteInfo.against).to.equal(await withDecimals(0));
        expect(voteInfo.voters).to.equal(1);
        expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
        await this.hip.mint(bob.address,await withDecimals(10000000));
        await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
        this.democracy.connect(bob).vote(1,await withDecimals(voteAmount),{from:bob.address})
        let totalSupply = await this.hip.totalSupply();
        let countVote = await this.democracy.countingVote(await withDecimals(voteAmount),await withDecimals(0),totalSupply);
        expect(countVote).to.equal(true);
        let voteDuration = await this.democracy.voteDuration();
        console.log("voteDuration is:",voteDuration.toString());
        this.democracy.smodify.put({
            voteDuration: 100,
        });
        this.democracy.smodify.put({
            voteUsersNeed: 2,
        });
        let timeBlock = await time.latestBlock();
        await time.advanceBlockTo(timeBlock + 100);
        let voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(1);
        await this.democracy.updateProposalStatus(1);
        expect(await this.democracy.getPropState(1)).to.equal(3);
        //end democracy


        await this.pledgeToken.mint(owner.address,_targetAmount)
        await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
        await this.hnqToken.mint(owner.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq))
        await this.hnqToken.approve(this.crowdfundPools.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq))
        
        await this.democracy.setCrowdfund(this.crowdfundPools.address);
        await this.democracy.toCrowdfund(_proposalId,true);

        await this.crowdfundPools.batchCreateNFT(workId);
        await this.crowdfundPools.batchCreateNFT(workId2);
        
        await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("not in support tokens");
        await this.mysteryBoxMarket.addToken([this.usdt.address]);
        await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("Not exist the pool");
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"pool1");

        //function buyMysteryBox(uint _poolId, uint _quantity, address _token20Address, uint _amount)
        await expect(this.mysteryBoxMarket.buyMysteryBox(1,0,this.usdt.address,100)).to.revertedWith("quantity is zero");

        // await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("Division or modulo division by zero");
        await this.mysteryBox.setInternalCaller(this.base.address,true);
        await this.mysteryBox.setInternalCaller(this.mysteryBoxMarket.address,true);

        await this.base.prepareMbPackage(workId,0,5);
        await expect(this.base.prepareMbPackage(workId,5,10)).revertedWith("Index wrong");
        // await expect(this.base.prepareMbPackage(workId,5,9)).to.revertedWith("Cannot use last fragment Id");
        await expect(this.base.prepareMbPackage(workId,5,10-2)).to.revertedWith("Already added");
        await this.base.prepareMbPackage(workId,6,10-2);
        await this.base.createMbPackage(workId);
        await this.base.prepareMbPackage(workId2,0,10);
        await this.base.prepareMbPackage(workId2,11,15-2);
        await this.base.createMbPackage(workId2);
        await this.mysteryBox.putToPool(workId,poolId);
        await this.mysteryBox.putToPool(workId2,poolId);
        
        await this.mysteryBoxMarket.addToken([this.usdt.address]);
        console.log("start ---------------------buy");
        var packages1 = await this.mysteryBox.boxPackages(workId);
        var packages2 = await this.mysteryBox.boxPackages(workId2);
        await expect(this.mysteryBoxMarket.buyMysteryBox(poolId,10,this.usdt.address,await withDecimals(100)))
            .to.revertedWith("amount not equal to after reduction amount");

        var packages1 = await this.mysteryBox.boxPackages(workId);
        var packages2 = await this.mysteryBox.boxPackages(workId2);
        console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
        console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());

        await this.mysteryBoxMarket.buyMysteryBox(poolId,20,this.usdt.address,await withDecimals(20));
        var packages1 = await this.mysteryBox.boxPackages(workId);
        var packages2 = await this.mysteryBox.boxPackages(workId2);
        console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
        console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());
        expect(await packages1.unsoldTotal.add(packages2.unsoldTotal)).to.equal((10+20*10+10+30*15-20).toString());
        var pool =await this.mysteryBox.getBoxPool(poolId);
        // feeRatio: 600,
        // ownerRatio: 3700,
        // fundRatio: 2700,
        // rewardRatio: 3000,
        console.log("pool feeRatio is:",pool.feeRatio.toString());
        console.log("pool ownerRatio is:",pool.ownerRatio.toString());
        console.log("pool fundRatio is:",pool.fundRatio.toString());
        console.log("pool rewardRatio is:",pool.rewardRatio.toString());
        // uint NFTFundAmount = beforeReductionAmount.mul(pool.fundRatio).div(10000);
        // uint handlingFee = beforeReductionAmount.mul(pool.feeRatio).div(10000).sub(reductionAmount);
        // uint crowdAmount = beforeReductionAmount.mul(pool.ownerRatio).div(10000);
        // uint luckyReward = _amount.sub((NFTFundAmount.add(handlingFee)).add(crowdAmount));
        var beforeReductionAmount = await withDecimals(20);
        var feeReduction = await this.mysteryBoxMarket.getToken20FeeReduction(this.usdt.address);
        var amount = BigNumber.from(beforeReductionAmount).sub(feeReduction);
        var reductionAmount = BigNumber.from(beforeReductionAmount).mul(feeReduction).div(10000);
        var nftFundAmount = BigNumber.from(beforeReductionAmount).mul(pool.fundRatio).div(10000);
        var handlingFee = BigNumber.from(beforeReductionAmount).mul(pool.feeRatio).div(10000).sub(feeReduction);
        var crowdAmount = BigNumber.from(beforeReductionAmount).mul(pool.ownerRatio).div(10000);
        var luckyReward = amount.sub(nftFundAmount.add(handlingFee).add(crowdAmount));;
        var balanceOfFundAccount = await this.usdt.balanceOf(_NFTFundAccount);
        var balanceOfHandingFeeAccount = await this.usdt.balanceOf(_handlingFeeAccount);
        var balanceOfCrowdfundPools = await this.usdt.balanceOf(this.crowdfundPools.address);
        var balanceOfLuckyLottery = await this.usdt.balanceOf(this.luckyLottery.address);
        expect(balanceOfFundAccount).to.equal(nftFundAmount);
        expect(balanceOfHandingFeeAccount).to.equal(handlingFee);
        // expect(balanceOfCrowdfundPools).to.equal(crowdAmount);
        expect(balanceOfLuckyLottery).to.equal(luckyReward);
        await expect(this.mysteryBoxMarket.openMysteryBox(2)).to.revertedWith("quantity is zero or greater than maxOpenQuantity");
        await this.mysteryBoxMarket.adjustMaxOpenQuantity(100);
        var tx = await this.mysteryBoxMarket.openMysteryBox(20);
        var packages1 = await this.mysteryBox.boxPackages(workId);
        var packages2 = await this.mysteryBox.boxPackages(workId2);
        console.log("packages1.remained",packages1.remained.toString());
        console.log("packages2.remained",packages2.remained.toString());
        expect(await packages1.remained.add(packages2.remained)).to.equal((10+20*10+10+30*15-20).toString());

        let receipt = await tx.wait()
        let mysteryBoxOpened = receipt.events.pop()
        expect(mysteryBoxOpened.event).to.be.equal("MysteryBoxOpened")
        expect(mysteryBoxOpened.eventSignature).to.be.equal("MysteryBoxOpened(address,uint256[])")
        let tokens = mysteryBoxOpened.args[1];
        var tokenAmount = BigNumber.from(0);
        var repeatToken = new Array();
        for (var i = 0;i<tokens.length;i++){
            var balanceOf = await this.token1155.balanceOf(owner.address,tokens[i]);
            if(balanceOf.gt(1)&&repeatToken.indexOf(tokens[i].toString())>-1){
                continue;
            }else{
                repeatToken.push(tokens[i].toString());
            }
            console.log("balance is:",tokens[i].toString(),balanceOf.toString());
            tokenAmount = tokenAmount.add(balanceOf);
        }
        expect(tokenAmount).to.equal(tokens.length);
        console.log("tokenAmount",tokenAmount.toString())


        //bob start buy left
        var nftTokenAmount = 10+20*10+10+30*15-20;
        console.log("nftTokenAmount is:",nftTokenAmount);
        await this.usdt.mint(bob.address,withDecimals(1000));
        await this.usdt.connect(bob).approve(this.mysteryBoxMarket.address,withDecimals(1000),{from:bob.address});
        await this.mysteryBoxMarket.connect(bob).buyMysteryBox(poolId,nftTokenAmount,this.usdt.address,await withDecimals(nftTokenAmount),{from:bob.address});
        await this.mysteryBoxMarket.adjustMaxOpenQuantity(1000);
        var tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
        var tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
        var tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
        var tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
        var tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(nftTokenAmount-400,{from:bob.address});
        var pack1 = await this.mysteryBox.boxPackages(workId);
        expect(pack1.remained).equal(0);
        expect(pack1.unsoldTotal).equal(0);
        expect(pack1.state).equal(2);
        // console.log("pack1 is:",pack1);
        var pack2 = await this.mysteryBox.boxPackages(workId2);
        expect(pack2.remained).equal(0);
        expect(pack2.unsoldTotal).equal(0);
        expect(pack2.state).equal(2);
        // console.log("pack2 is:",pack2);
    });

})
