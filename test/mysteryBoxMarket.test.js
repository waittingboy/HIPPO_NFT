const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const {BN} = require('@openzeppelin/test-helpers');
const { time,ADDRESS_ZERO } = require("./utilities")
const { smoddit } = require("@eth-optimism/smock");

async function withDecimals(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(18))).toString();
}


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    // console.log("ethers.utils is:",ethers.utils);
    let abiEncode = abi.encode(types, values);
    console.log("abiEncode is:",abiEncode);
    let shaResult = ethers.utils.sha256(abiEncode);
    console.log("shaResult is",shaResult);
    return shaResult;
}

let owner;
let user;
let alice;
let bob;
let cloud;
let _NFTFundAccount;
let _handlingFeeAccount;
let mockDemocracy;
describe("MysteryBoxMarket func",function() {
    this.timeout(300000);
    before(async function () {
        this.signers = await ethers.getSigners()
        owner = this.signers[0]
        user = this.signers[1]
        alice = this.signers[2]
        bob = this.signers[3];
        cloud = this.signers[4];
        mockDemocracy = this.signers[6];
        this.mockMysteryBoxMarket = this.signers[4]
        this.MBGovernanceAddress = this.signers[5]
        this.newBonusToken = this.signers[7];

        this.MysteryBox = await smoddit("MysteryBox");
        this.Democracy = await smoddit("MyDemocracyMock");
        this.MysteryBoxMarket = await smoddit("MysteryBoxMarket");
        // this.MysteryBoxMarket = await ethers.getContractFactory("MysteryBoxMarket");
        this.NFTFactory = await ethers.getContractFactory("NFTFactoryMock");
        this.RandomNumber = await ethers.getContractFactory("RandomNumber");
        // this.Crowdfund = await ethers.getContractFactory("Crowdfund");
        this.LuckyLottery = await ethers.getContractFactory("LuckyLottery");
        this.NFTFundToken = await ethers.getContractFactory("NFTFundToken");

        this.ERC20Smart = await ethers.getContractFactory("ERC20Smart");
        this.CrowdfundPools = await smoddit("CrowdfundPools");
        // this.NFTFactory = await ethers.getContractFactory("NFTFactoryMock");
        this.Base = await ethers.getContractFactory("Base");
        this.BancorFormula = await ethers.getContractFactory("BancorFormula");
        this.DrawLots = await ethers.getContractFactory("DrawLots");

        this.Contract = await ethers.getContractFactory("Contract");
        this.NFTDepositBox = await ethers.getContractFactory("NFTDepositBoxMock");
        this.IdProvider = await ethers.getContractFactory("IdProvider");
        this.ExternalNftBase = await ethers.getContractFactory("ExternalNftBase");
        this.ERC721 = await ethers.getContractFactory("Token721Mock");
        this.ERC1155 = await ethers.getContractFactory("Token1155Mock");
        this.ExternalNftBaseMock = await ethers.getContractFactory("ExternalNftBaseMock");
        this.MBPoolAdmin = await ethers.getContractFactory("MBPoolAdmin");
    })

    beforeEach(async function (){
        this.externalNftBaseMock = await this.ExternalNftBaseMock.deploy();
        await this.externalNftBaseMock.deployed();
        this.token721 = await this.ERC721.deploy();
        await this.token721.deployed();
        this.externalToken1155 = await this.ERC1155.deploy();
        await this.externalToken1155.deployed();
        this.externalNftBase = await this.ExternalNftBase.deploy();
        await this.externalNftBase.deployed();
        this.bancor = await this.BancorFormula.deploy();
        await this.bancor.deployed();

        this.mbPoolAdmin = await this.MBPoolAdmin.deploy();
        await this.mbPoolAdmin.deployed();

        this.mysteryBox = await this.MysteryBox.deploy();
        await this.mysteryBox.deployed();
        await this.mysteryBox.initialize(owner.address,this.mbPoolAdmin.address);

        this.nftDepositBox = await this.NFTDepositBox.deploy();
        await this.nftDepositBox.deployed();
        await this.nftDepositBox.initialize(user.address, alice.address, bob.address);
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



        this.idProvider = await this.IdProvider.deploy();
        await this.idProvider.deployed();

        await this.idProvider.initialize(this.base.address,this.externalNftBase.address);
        await this.idProvider.setInternalCaller(this.base.address,true);


        this.token1155 = await this.NFTFactory.deploy();
        this.token1155.deployed();
        this.randomNumber = await this.RandomNumber.deploy()
        await this.randomNumber.deployed()
        this.crowdfundPools = await this.CrowdfundPools.deploy();
        await this.crowdfundPools.deployed();

        this.hip = await this.ERC20Smart.deploy("hip","hip token");
        this.democracy = await this.Democracy.deploy();
        await this.democracy.deployed();
        // this.hip.address,await withDecimals(200000),this.base.address,user.address,this.usdt.address,this.usdt.address
     
        await this.democracy.initialize(
            this.hip.address,
            await withDecimals(200000),
            this.base.address,
            user.address,
            "10000",
            this.usdt.address,
            this.externalNftBase.address,
            this.usdt.address,
            this.usdt.address
        );
        
        await this.externalNftBase.initialize(
            this.mysteryBox.address, this.democracy.address,this.idProvider.address, 
            this.nftDepositBox.address,this.crowdfundPools.address, this.mysteryBoxMarket.address
        );
        let startBlock = await time.latestBlock()
        let bonusTokens = [this.usdc.address,this.elc.address]
        
        this.drawLots = await this.DrawLots.deploy();
        await this.drawLots.deployed();
        await this.drawLots.initialize();
        await this.crowdfundPools.initialize(
            startBlock,this.pledgeToken.address,this.mysteryBoxMarket.address,
            this.hnqToken.address, this.token1155.address,this.base.address,
            this.democracy.address,this.drawLots.address, bonusTokens,this.externalNftBase.address
        );

        await this.base.initialize(
            this.token1155.address,
            this.mysteryBox.address,
            this.democracy.address,
            this.crowdfundPools.address,
            this.idProvider.address,
            this.externalNftBase.address
        );

        this.luckyLottery =await this.LuckyLottery.deploy();
        await this.luckyLottery.deployed();
        await this.luckyLottery.initialize(this.mysteryBoxMarket.address,this.drawLots.address);
        //constructor (string memory name_, string memory symbol_, uint32  weight_, uint initConnAmount_, uint initSupply_, IBancorFormula bancor_){

        this.nftFound =await this.NFTFundToken.deploy();
        await this.nftFound.deployed();
        await this.nftFound.initialize("testFound","testFoundToken",100,200,3000,this.bancor.address,this.mysteryBox.address);
        await this.nftFound.transferOwnership(this.mysteryBoxMarket.address);
        this.token20 =await this.ERC20Smart.deploy("test1","test1");
        await this.token20.deployed();


        //IERC1155Upgradeable _token1155, IMysteryBox _mysteryBox, IRandomNumber _random, ICrowdFund _crowdFund, ILuckyLottery _luckyLottery,
        // INFTFund _NFTFund, address payable _NFTFundAccount, address payable _handlingFeeAccount, address[] memory _token20sAddress
        _NFTFundAccount = bob.address;
        _handlingFeeAccount = alice.address;
        this.contract = await this.Contract.deploy();
        await this.contract.deployed();
        await this.contract.initialize(this.token1155.address);

        await this.token1155.initialize(this.crowdfundPools.address);

        await this.mysteryBoxMarket.initialize(
            this.mysteryBox.address,
            this.nftDepositBox.address,
            this.contract.address,
            
            this.crowdfundPools.address,
            this.luckyLottery.address,
            this.nftFound.address,
            _NFTFundAccount,
            _handlingFeeAccount,
            bonusTokens,
            this.externalNftBase.address
        );
    
        // await this.nftDepositBox.initialize(
        //     this.mysteryBoxMarket.address,
        //     this.token1155.address,
        //     this.externalNftBase.address
        // );
    });

    it("test initialize", async function() {
        let tokenAddress = await this.mysteryBoxMarket.token();
        expect(tokenAddress).to.equal(this.contract.address);
        let mysteryBoxAddress = await this.mysteryBoxMarket.mysteryBox();
        expect(mysteryBoxAddress).to.equal(this.mysteryBox.address);
        // let randomAddress = await this.mysteryBoxMarket.random();
        // expect(randomAddress).to.equal(this.randomNumber.address);
        let crowFundAddress = await this.mysteryBoxMarket.crowdFund();
        expect(crowFundAddress).to.equal(this.crowdfundPools.address);
        let luckyLotteryAddress = await this.mysteryBoxMarket.luckyLottery();
        expect(luckyLotteryAddress).to.equal(this.luckyLottery.address);
        let nftFundAddress = await this.mysteryBoxMarket.NFTFund();
        expect(nftFundAddress).to.equal(this.nftFound.address);
        let nftFundAccount = await this.mysteryBoxMarket.NFTFundAccount();
        expect(nftFundAccount).to.equal(_NFTFundAccount);
        let handlingFeeAccount = await this.mysteryBoxMarket.handlingFeeAccount();
        expect(handlingFeeAccount).to.equal(_handlingFeeAccount);
        let maxOpenQuantity = await this.mysteryBoxMarket.getMaxOpenQuantity();
        expect(maxOpenQuantity).to.equal(10);

        // let isSupportToken = await this.mysteryBoxMarket.getIsSupportToken(this.usdc.address);
        // expect(isSupportToken).to.equal(true);
        // let isSupportToken = await this.mysteryBoxMarket.getIsSupportToken(this.elc.address);
        // expect(isSupportToken).to.equal(true);

    });

    // it("test externalNftMarket", async function() {
    //     let poolId = 1;
    //     let workId = 1;
    //     let workId2 = 2;
    //     let collectionId1 = 1;
    //     let proposalId1 = collectionId1;

    //     await this.usdt.mint(owner.address,withDecimals(1000));
    //     await this.usdt.approve(this.mysteryBoxMarket.address,withDecimals(1000));
    //     //start democracy success
    //     let voteAmount = 1000;
    //     let hipBalance = await this.hip.balanceOf(owner.address);
    //     console.log("hipBalance is:",hipBalance.toString());
    //     await this.hip.mint(owner.address,await withDecimals(10000000));
    //     await this.hip.approve(this.democracy.address,await withDecimals(10000000));

    //     let _hipAmountPerHnq = await withDecimals("100000")
    //     let _targetAmount = await withDecimals("110000000")

    //     // await this.base.addWorks("_collectionName","_collectionDesc","_collectionUrl",["_workNames1","_workNames2"]
    //     // ,["_urls1","_urls2"],["10","10"],["20","30"],["10","15"]);

    //     await this.idProvider.setInternalCaller(this.externalNftBase.address, true);
    //     await this.idProvider.setInternalCaller(owner.address, true);
    //     let nftIds = [7,8], nftAmounts = [6,1], _crowdfundParams = [1,2,3,4,5];
    //     _crowdfundParams[4] = await withDecimals(5);
    //     let _tokenAddress = [this.externalToken1155.address,this.token721.address];
    //     await this.externalToken1155.mint(owner.address, nftIds[0], nftAmounts[0]);
    //     await this.externalToken1155.setApprovalForAll(this.nftDepositBox.address, true);
        
    //     await this.token721.myMint(owner.address, nftIds[1]);
    //     await this.token721.setApprovalForAll(this.nftDepositBox.address, true);


    //     // await this.nftDepositBox.batchDepositNFT([this.token1155.address, this.token721.address], nftIds, nftAmounts, owner.address);
    //     let _collectionName = "testClName", _collectionDesc = "testClDesc",_collectionUrl = "_collectionUrl";
    //     //TODO address[] _tokenAddresses,uint256[] _tokenIds,uint256[] _amounts,string _collectionName,
    //     // string _collectionDesc,string _collectionUrl,uint256[] _crowdfundParams
    //     await this.nftDepositBox.addWhitelistNFTAddr(_tokenAddress[0]);
    //     await this.nftDepositBox.addWhitelistNFTAddr(_tokenAddress[1]);
    //     await this.externalNftBase.connect(user).createProposal(_tokenAddress, nftIds, nftAmounts, _collectionName, _collectionDesc,_collectionUrl, _crowdfundParams,{from:user.address});







    //     let userCollectLen = await this.externalNftBase.getUserCollectLen(owner.address);
    //     collectionId1 = await this.externalNftBase.userCollections(owner.address,userCollectLen-1);
    //     console.log("collectionId1 is:",collectionId1);
    //     // collectionId1 = userCollections[userCollections.length];
    //     proposalId1 = collectionId1;
        

        
    //     // await this.democracy.initProposal(collectionId1,100000,100,100,5000,await withDecimals(5000));
    //     // let propState = await this.democracy.getPropState(proposalId1);
    //     await this.democracy.vote(proposalId1,await withDecimals(voteAmount));
    //     let proposalInfo = await this.democracy.proposals(proposalId1);

    //     let voteInfo = await this.democracy.votes(proposalId1,0);
    //     expect(voteInfo.approve).to.equal(await withDecimals(voteAmount));
    //     expect(voteInfo.against).to.equal(await withDecimals(0));
    //     expect(voteInfo.voters).to.equal(1);
    //     expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
    //     await this.hip.mint(bob.address,await withDecimals(10000000));
    //     await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
    //     this.democracy.connect(bob).vote(proposalId1,await withDecimals(voteAmount),{from:bob.address})
    //     let totalSupply = await this.hip.totalSupply();
    //     let countVote = await this.democracy.countingVote(await withDecimals(voteAmount),await withDecimals(0),totalSupply);
    //     expect(countVote).to.equal(true);
    //     let voteDuration = await this.democracy.voteDuration();
    //     console.log("voteDuration is:",voteDuration.toString());
    //     this.democracy.smodify.put({
    //         voteDuration: 100,
    //     });
    //     this.democracy.smodify.put({
    //         voteUsersNeed: 2,
    //     });
    //     let timeBlock = await time.latestBlock();
    //     await time.advanceBlockTo(timeBlock + 100);
    //     let voteResult = await this.democracy.getVoteResult(proposalId1,0);
    //     expect(voteResult).to.equal(1);
    //     await this.democracy.updateProposalStatus(proposalId1);
    //     expect(await this.democracy.getPropState(proposalId1)).to.equal(3);
    //     //end democracy

    //     await this.pledgeToken.mint(owner.address,_targetAmount)
    //     await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
    //     await this.hnqToken.mint(owner.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq))
    //     await this.hnqToken.approve(this.crowdfundPools.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq))


    //     await this.democracy.setCrowdfund(this.crowdfundPools.address);
    //     await this.democracy.toCrowdfund(proposalId1);

    //     let crowFundId = (await this.democracy.proposals(proposalId1)).lastCrowdfundId;

    //     let balanceOfErc1155 = await this.token1155.balanceOf(owner.address,nftIds[0]);
    //     console.log("balanceOfErc1155 is:",balanceOfErc1155);
    //     // await this.externalNftBase.batchDepositAndAddNFTToCollection(_tokenAddress, nftIds, nftAmounts, collectionId1);
    //     // await this.crowdfundPools.batchCreateNFT(crowFundId);
    //     // await this.crowdfundPools.batchCreateNFT(workId2);

    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("not in support tokens");
    //     await this.mysteryBoxMarket.addToken([this.usdt.address]);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("Not exist the pool");
    //     await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"pool1");

    //     //function buyMysteryBox(uint _poolId, uint _quantity, address _token20Address, uint _amount)
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,0,this.usdt.address,100)).to.revertedWith("quantity is zero");

    //     // await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("Division or modulo division by zero");
    //     await this.mysteryBox.setInternalCaller(this.base.address,true);
    //     await this.mysteryBox.setInternalCaller(this.mysteryBoxMarket.address,true);
    //     await this.mysteryBox.setInternalCaller(this.externalNftBase.address,true);

    //     await this.externalNftBase.prepareMbPackage(collectionId1,0,0);
    //     // await expect(this.externalNftBase.prepareMbPackage(collectionId1,5,10)).revertedWith("Index wrong");
    //     // await expect(this.base.prepareMbPackage(workId,5,9)).to.revertedWith("Cannot use last fragment Id");
    //     // await expect(this.externalNftBase.prepareMbPackage(collectionId1,5,10-2)).to.revertedWith("Already added");
    //     // await this.base.prepareMbPackage(workId,6,10-2);
    //     workId = await this.externalNftBase.collectIdToWorkId(collectionId1);
    //     await this.externalNftBase.createMbPackage(collectionId1);
    //     // await this.base.prepareMbPackage(workId2,0,10);
    //     // await this.base.prepareMbPackage(workId2,11,15-2);
    //     // await this.base.createMbPackage(workId2);
    //     let poolsLength = await this.mysteryBox.getPoolCount();
    //     poolId = await this.mysteryBox.pools(poolsLength-1);
    //     await this.mysteryBox.putToPool(workId,poolId);
    //     console.log("my poolId is:",poolId);
    //     // await this.mysteryBox.putToPool(workId2,poolId);


    //     console.log("start ---------------------buy");
    //     let packages1 = await this.mysteryBox.boxPackages(workId);
    //     // let packages2 = await this.mysteryBox.boxPackages(workId2);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(poolId,1,this.usdt.address,await withDecimals(100)))
    //         .to.revertedWith("amount not equal to after reduction amount");

    //     console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
    //     // console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());

    //     await this.mysteryBoxMarket.buyMysteryBox(poolId,1,this.usdt.address,await withDecimals(1));
    //     packages1 = await this.mysteryBox.boxPackages(workId);
    //     // packages2 = await this.mysteryBox.boxPackages(workId2);
    //     console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
    //     // console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());
    //     expect(await packages1.unsoldTotal).to.equal(6);
    //     let pool =await this.mysteryBox.getBoxPool(poolId);
    //     // feeRatio: 600,
    //     // ownerRatio: 3700,
    //     // fundRatio: 2700,
    //     // rewardRatio: 3000,
    //     console.log("pool feeRatio is:",pool.feeRatio.toString());
    //     console.log("pool ownerRatio is:",pool.ownerRatio.toString());
    //     console.log("pool fundRatio is:",pool.fundRatio.toString());
    //     console.log("pool rewardRatio is:",pool.rewardRatio.toString());
    //     // uint NFTFundAmount = beforeReductionAmount.mul(pool.fundRatio).div(10000);
    //     // uint handlingFee = beforeReductionAmount.mul(pool.feeRatio).div(10000).sub(reductionAmount);
    //     // uint crowdAmount = beforeReductionAmount.mul(pool.ownerRatio).div(10000);
    //     // uint luckyReward = _amount.sub((NFTFundAmount.add(handlingFee)).add(crowdAmount));
    //     let beforeReductionAmount = await withDecimals(1);
    //     let feeReduction = await this.mysteryBoxMarket.getToken20FeeReduction(this.usdt.address);
    //     let amount = BigNumber.from(beforeReductionAmount).sub(feeReduction);
    //     let reductionAmount = BigNumber.from(beforeReductionAmount).mul(feeReduction).div(10000);
    //     let nftFundAmount = BigNumber.from(beforeReductionAmount).mul(pool.fundRatio).div(10000);
    //     let handlingFee = BigNumber.from(beforeReductionAmount).mul(pool.feeRatio).div(10000).sub(feeReduction);
    //     let crowdAmount = BigNumber.from(beforeReductionAmount).mul(pool.ownerRatio).div(10000);
    //     let luckyReward = amount.sub(nftFundAmount.add(handlingFee).add(crowdAmount));;
    //     let balanceOfFundAccount = await this.usdt.balanceOf(_NFTFundAccount);
    //     let balanceOfHandingFeeAccount = await this.usdt.balanceOf(_handlingFeeAccount);
    //     let balanceOfCrowdfundPools = await this.usdt.balanceOf(this.crowdfundPools.address);
    //     let balanceOfLuckyLottery = await this.usdt.balanceOf(this.luckyLottery.address);
    //     expect(balanceOfFundAccount).to.equal(nftFundAmount);
    //     expect(balanceOfHandingFeeAccount).to.equal(handlingFee);
    //     // // expect(balanceOfCrowdfundPools).to.equal(crowdAmount);
    //     expect(balanceOfLuckyLottery).to.equal(luckyReward);
    //     await expect(this.mysteryBoxMarket.openMysteryBox(2)).to.revertedWith("quantity is zero or greater than maxOpenQuantity");
    //     await this.mysteryBoxMarket.adjustMaxOpenQuantity(100);
    //     let tx = await this.mysteryBoxMarket.openMysteryBox(1);

    //     packages1 = await this.mysteryBox.boxPackages(workId);
    //     console.log("packages1.remained",packages1.remained.toString());
    //     expect(await packages1.remained).to.equal((6).toString());

    //     let receipt = await tx.wait()
    //     let mysteryBoxOpened = receipt.events.pop()
    //     expect(mysteryBoxOpened.event).to.be.equal("MysteryBoxOpened")
    //     expect(mysteryBoxOpened.eventSignature).to.be.equal("MysteryBoxOpened(address,(bool,address,uint256)[])")
    //     let tokens = mysteryBoxOpened.args[1];
    //     let tokenAmount = BigNumber.from(0);
    //     let repeatToken = [];
    //     for (let i = 0;i<tokens.length;i++){
    //         let balanceOf = await this.token1155.balanceOf(owner.address,tokens[i][2]);
    //         console.log("balanceOf is:",balanceOf);
    //         if(balanceOf.gt(1)&&repeatToken.indexOf(tokens[i][2].toString())>-1){
    //             continue;
    //         }else{
    //             repeatToken.push(tokens[i][2].toString());
    //         }
    //         console.log("balance is:",tokens[i][2].toString(),balanceOf.toString());
    //         tokenAmount = tokenAmount.add(balanceOf);
    //     }
    //     expect(tokenAmount).to.equal(0);
    //     console.log("tokenAmount",tokenAmount.toString())
    //     await this.mysteryBoxMarket.buyMysteryBox(poolId,6,this.usdt.address,await withDecimals(6));

    //     packages1 = await this.mysteryBox.boxPackages(workId);
    //     // packages2 = await this.mysteryBox.boxPackages(workId2);
    //     console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
    //     // console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());
    //     expect(await packages1.unsoldTotal).to.equal(0);

    //     let tx6 = await this.mysteryBoxMarket.openMysteryBox(6);


    //     let openedNftInfo = await this.mysteryBoxMarket.getOpenedNFTInfo(owner.address,0);
    //     console.log("openedNftInfo is:",openedNftInfo);
    //     expect(openedNftInfo.tokenId.toString()).to.equal('7');

    //     // //bob start buy left
    //     // let nftTokenAmount = 10+20*10+10+30*15-20;
    //     // console.log("nftTokenAmount is:",nftTokenAmount);
    //     // await this.usdt.mint(bob.address,withDecimals(1000));
    //     // await this.usdt.connect(bob).approve(this.mysteryBoxMarket.address,withDecimals(1000),{from:bob.address});
    //     // await this.mysteryBoxMarket.connect(bob).buyMysteryBox(poolId,nftTokenAmount,this.usdt.address,await withDecimals(nftTokenAmount),{from:bob.address});
    //     // await this.mysteryBoxMarket.adjustMaxOpenQuantity(1000);
    //     // tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
    //     // let openBoxCount = await this.mysteryBoxMarket.getOpenedNFTsQuantity(bob.address);
    //     // expect(100).to.equal(openBoxCount);
    //     // let openableQuantity = await this.mysteryBoxMarket.getOpenableQuantity(bob.address);
    //     // expect(openableQuantity).to.equal(nftTokenAmount-100);
    //     // tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
    //     // tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
    //     // tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
    //     // tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(nftTokenAmount-400,{from:bob.address});
    //     // let pack1 = await this.mysteryBox.boxPackages(workId);
    //     // expect(pack1.remained).equal(0);
    //     // expect(pack1.unsoldTotal).equal(0);
    //     // expect(pack1.state).equal(2);
    //     // // console.log("pack1 is:",pack1);
    //     // let pack2 = await this.mysteryBox.boxPackages(workId2);
    //     // expect(pack2.remained).equal(0);
    //     // expect(pack2.unsoldTotal).equal(0);
    //     // expect(pack2.state).equal(2);
    //     // console.log("pack2 is:",pack2);
    // });

    // it("test addToken and deleteToken", async function() {
    //     await expect(this.mysteryBoxMarket.connect(bob).addToken([this.usdt.address],{from:bob.address})).revertedWith("Ownable: caller is not the owner");
    //     await this.mysteryBoxMarket.addToken([this.usdt.address]);
    //     await this.mysteryBoxMarket.addToken([this.usdt.address]);

    //     // let historySupportTokens = await this.mysteryBoxMarket.getHistorySupportTokens();
    //     // expect(historySupportTokens[2]).equal(this.usdt.address);
    //     let bonusToken = await this.crowdfundPools.bonusTokens(2);
    //     expect(bonusToken).equal(this.usdt.address);
    //     let rewardToken20s = await this.luckyLottery.getRewardToken20s();
    //     expect(rewardToken20s[0]).equal(this.usdc.address);

    //     //start test delete token.
    //     await expect(this.mysteryBoxMarket.deleteToken([this.dai.address])).to.revertedWith("not in support tokens");
    //     await expect(this.mysteryBoxMarket.deleteToken([this.usdc.address])).to.revertedWith("default can not delete");
    //     await expect(this.mysteryBoxMarket.connect(bob).deleteToken([this.usdc.address],{from:bob.address})).to.revertedWith("Ownable: caller is not the owner");

    //     await this.mysteryBoxMarket.deleteToken([this.usdt.address]);

    //     // let historySupportTokens = await this.mysteryBoxMarket.getHistorySupportTokens();
    //     // expect(historySupportTokens[2]).equal(this.usdt.address);
    //     bonusToken = await this.crowdfundPools.bonusTokens(2);
    //     expect(bonusToken).equal(this.usdt.address);
    //     rewardToken20s = await this.luckyLottery.getRewardToken20s();
    //     expect(rewardToken20s[0]).equal(this.usdc.address);
    //     let token20FeeReduction = await this.mysteryBoxMarket.getToken20FeeReduction(this.usdc.address);
    //     expect(token20FeeReduction).to.equal(0);
    // });


    // it("test transferNFTFundAccount", async function() {
    //     await expect(this.mysteryBoxMarket.connect(bob).transferNFTFundAccount(bob.address,{from:bob.address})).revertedWith("Ownable: caller is not the owner");
    //     let nftFundAccount = await this.mysteryBoxMarket.NFTFundAccount();
    //     expect(nftFundAccount).to.equal(_NFTFundAccount);
    //     await this.mysteryBoxMarket.transferNFTFundAccount(bob.address);
    //     nftFundAccount = await this.mysteryBoxMarket.NFTFundAccount();
    //     expect(nftFundAccount).to.equal(bob.address);
    //     await expect(this.mysteryBoxMarket.transferNFTFundAccount(ADDRESS_ZERO)).to.revertedWith("account is zero address");
    // });

    // it("test transferHandlingFeeAccount", async function() {
    //     await expect(this.mysteryBoxMarket.connect(bob).transferHandlingFeeAccount(bob.address,{from:bob.address})).revertedWith("Ownable: caller is not the owner");
    //     let handlingFeeAccount = await this.mysteryBoxMarket.handlingFeeAccount();
    //     expect(handlingFeeAccount).to.equal(_handlingFeeAccount);
    //     await this.mysteryBoxMarket.transferHandlingFeeAccount(bob.address);
    //     handlingFeeAccount = await this.mysteryBoxMarket.handlingFeeAccount();
    //     expect(handlingFeeAccount).to.equal(bob.address);
    //     await expect(this.mysteryBoxMarket.transferHandlingFeeAccount(ADDRESS_ZERO)).to.revertedWith("account is zero address");
    // });

    // it("test adjustMaxOpenQuantity", async function() {
    //     await expect(this.mysteryBoxMarket.connect(bob).adjustMaxOpenQuantity(100,{from:bob.address})).revertedWith("Ownable: caller is not the owner");
    //     let maxOpenQuantity = await this.mysteryBoxMarket.getMaxOpenQuantity();
    //     expect(maxOpenQuantity).to.equal(10);
    //     this.mysteryBoxMarket.adjustMaxOpenQuantity(100);
    //     maxOpenQuantity = await this.mysteryBoxMarket.getMaxOpenQuantity();
    //     expect(maxOpenQuantity).to.equal(100);
    //     await expect(this.mysteryBoxMarket.adjustMaxOpenQuantity(0)).revertedWith("quantity is zero");
    // });

    // it("test setTokenFeeReduction", async function() {
    //     await expect(this.mysteryBoxMarket.connect(bob).setTokenFeeReduction(this.usdt.address,100,{from:bob.address})).revertedWith("Ownable: caller is not the owner");
    //     await expect(this.mysteryBoxMarket.setTokenFeeReduction(this.usdt.address,100)).revertedWith("not in support tokens");
    //     await this.mysteryBoxMarket.addToken([this.usdt.address]);
    //     await expect(this.mysteryBoxMarket.setTokenFeeReduction(this.usdt.address,600)).revertedWith("reduction ratio is greater than min fee ratio");
    //     await this.mysteryBox.setInternalCaller(this.mysteryBoxMarket.address,true);
    //     await this.mysteryBoxMarket.setTokenFeeReduction(this.usdt.address,400);
    //     let token20FeeReduction = await this.mysteryBoxMarket.getToken20FeeReduction(this.usdt.address);
    //     expect(token20FeeReduction).to.equal(400);
    //     let maxFeeDiscount = await this.mysteryBox.maxFeeDiscount();
    //     expect(maxFeeDiscount).to.equal(400);
    //     //mysteryBox.maxFeeDiscount()
    //     console.log("maxFeeDiscount:",await this.mysteryBox.maxFeeDiscount());
    //     await this.mysteryBoxMarket.setTokenFeeReduction(this.usdt.address,300);
    // });

<<<<<<< HEAD
    it("test buyMysteryBox", async function() {
=======
    it.only("test buyMysteryBox", async function() {
        console.log("start test buyMysteryBox");
>>>>>>> 930c126f3597875a8d50a744e74cc437204301ea
        let poolId = 1;
        let workId = 1;
        let workId2 = 2;
        let workId3 = 3;
        let workId4 = 4;

        await this.usdt.mint(owner.address,withDecimals(100000));
        await this.usdt.approve(this.mysteryBoxMarket.address,withDecimals(100000));

        let _crowdfundRatio_0 = "0"
        let _proposer = owner.address;
        let _proposalId = "1"
        let _dividendRatio = "50"
        let _duration = 1000;
        let _minJoinAmount = await withDecimals("100000")
        let _maxJoinAmount = await withDecimals("100000000")
        let _hnqAmount = await withDecimals("3000")
        let _hipAmountPerHnq = await withDecimals("100000")
        let _targetAmount = await withDecimals("110000000")

        await this.base.addWorks("_collectionName","_collectionDesc","_collectionUrl",["_workNames1","_workNames2"]
        ,["_urls1","_urls2"],["10","10"],["10","10"],["10","10"]);


        //start democracy success
        let voteAmount = 1000;
        let hipBalance = await this.hip.balanceOf(owner.address);
        console.log("hipBalance is:",hipBalance.toString());
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,1000000,100,100,5000,await withDecimals(5000),this.base.address);
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

<<<<<<< HEAD





=======
>>>>>>> 930c126f3597875a8d50a744e74cc437204301ea
        this.democracy.smodify.put({
            voteDuration: 100,
        });
        this.democracy.smodify.put({
            voteUsersNeed: 2,
        });
        let timeBlock = await time.latestBlock();
        await time.advanceBlockTo(timeBlock + 500);
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
<<<<<<< HEAD
        await this.democracy.toCrowdfund(_proposalId);
        await time.advanceBlockTo(timeBlock + 1000);
        let _curPoolId = await this.crowdfundPools.poolId()
        await this.crowdfundPools.deposit(_curPoolId,BigNumber.from(_targetAmount));
        await this.crowdfundPools.batchCreateNFT(_curPoolId);
        console.log("_curPoolId is:",_curPoolId);

        this.luckyLottery.adjustMinLotteryAddressQuantityOfPool(_curPoolId,1000);

=======

        console.log("before toCrowdfund");

        await this.democracy.toCrowdfund(_proposalId);
        let _curPoolId = await this.crowdfundPools.poolId()
        console.log("_curPoolId is:",_curPoolId.toString());
        await time.advanceBlockTo(timeBlock + 1000);

        // mock env to make crowdfund succeed
        // pool.curPledgeTotalAmount== 20000000 >= pool.targetTotalAmount== 20000000
        // if (winnedDataOfPools[_pid].isCompleted) return 1;
        await this.crowdfundPools.smodify.put({
            poolInfo: {"1":{curPledgeTotalAmount: await withDecimals(20000000)}},
        });
        await this.crowdfundPools.smodify.put({
            winnedDataOfPools:{"1" : {isCompleted : true}}
        });

        await this.crowdfundPools.batchCreateNFT(_curPoolId);

        this.luckyLottery.adjustMinLotteryAddressQuantityOfPool(poolId,1000);

>>>>>>> 930c126f3597875a8d50a744e74cc437204301ea
        await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("Not exist the pool");
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"pool1");
        await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("not in support tokens");
        await this.mysteryBoxMarket.addToken([this.usdt.address]);
        await expect(this.mysteryBoxMarket.buyMysteryBox(0,0,this.usdt.address,0)).to.revertedWith("quantity is zero or greater than unsold quantity");
<<<<<<< HEAD
        //function buyMysteryBox(uint _poolId, uint _quantity, address _token20Address, uint _amount)
        

=======
        
>>>>>>> 930c126f3597875a8d50a744e74cc437204301ea
        await expect(this.mysteryBoxMarket.buyMysteryBox(1,0,this.usdt.address,100)).to.revertedWith("quantity is zero");

        await this.mysteryBox.setInternalCaller(this.mysteryBoxMarket.address,true);
        await this.mysteryBox.setInternalCaller(owner.address,true);
        //uint worksId_, uint NFTtokenId_, uint count_
<<<<<<< HEAD
        await this.mysteryBox.preparePackage(workId,320,20);
        await this.mysteryBox.preparePackage(workId,330,20);
        await this.mysteryBox.preparePackage(workId,340,20);
        // uint worksId_, uint NFTtokenId_, uint count_, uint poolId_, address operator_
        await this.mysteryBox.createPackage(workId,350,20,poolId,owner.address);
        await this.mysteryBox.preparePackage(workId2,360,20);
        await this.mysteryBox.preparePackage(workId2,370,20);
        await this.mysteryBox.preparePackage(workId2,380,20);
        await this.mysteryBox.createPackage(workId2,390,201,poolId,owner.address);
=======
        let countPre = "300";
        let countBuy = "10";
        let countBuy_next = "990";
        let countBuy_1100 = "1100";
        let countExceed = "5000";
        await this.mysteryBox.preparePackage(workId,320,countPre);
        await this.mysteryBox.preparePackage(workId,330,countPre);
        await this.mysteryBox.preparePackage(workId,340,countPre);
        // uint worksId_, uint NFTtokenId_, uint count_, uint poolId_, address operator_
        await this.mysteryBox.createPackage(workId,350,countPre,poolId,owner.address);
        await this.mysteryBox.preparePackage(workId2,360,countPre);
        await this.mysteryBox.preparePackage(workId2,370,countPre);
        await this.mysteryBox.preparePackage(workId2,380,countPre);
        await this.mysteryBox.createPackage(workId2,390,countPre,poolId,owner.address);
>>>>>>> 930c126f3597875a8d50a744e74cc437204301ea
        // await this.mysteryBox.putToPool(workId,poolId);
        // await this.mysteryBox.putToPool(workId2,poolId);
        console.log("start ---------------------buy");
        let packages1 = await this.mysteryBox.boxPackages(workId);
        let packages2 = await this.mysteryBox.boxPackages(workId2);


        await expect(this.mysteryBoxMarket.buyMysteryBox(poolId,countBuy,this.usdt.address,await withDecimals(100)))
            .to.revertedWith("amount not equal to after reduction amount");
        await expect(this.mysteryBoxMarket.buyMysteryBox(poolId,countExceed,this.usdt.address,await withDecimals(countExceed)))
            .to.revertedWith("quantity is zero or greater than unsold quantity");
        let nftFoundToken = await this.nftFound.token();
        nftFoundToken= await this.ERC20Smart.attach(nftFoundToken);

        let balanceOfOwner = await nftFoundToken.balanceOf(owner.address);
        console.log("balanceOfOwner------------------is:",balanceOfOwner.toString());
        console.log("1 test _quantity < remainQuantityThisTime");
        await this.mysteryBoxMarket.buyMysteryBox(poolId,countBuy,this.usdt.address,await withDecimals(countBuy));
        console.log("2 test _quantity == remainQuantityThisTime");
        await this.mysteryBoxMarket.buyMysteryBox(poolId,countBuy_next,this.usdt.address,await withDecimals(countBuy_next));
        

        balanceOfOwner = await nftFoundToken.balanceOf(owner.address);
        console.log("balanceOfOwner------------------is:",balanceOfOwner.toString());

        packages1 = await this.mysteryBox.boxPackages(workId);
        packages2 = await this.mysteryBox.boxPackages(workId2);
        expect(await packages1.unsoldTotal.add(packages2.unsoldTotal)).to.equal(BigNumber.from(countPre).mul(8).sub(countBuy).sub(countBuy_next));
        let pool =await this.mysteryBox.getBoxPool(poolId);

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
        let beforeReductionAmount = await withDecimals(BigNumber.from(countBuy).add(countBuy_next).toString());
        let feeReduction = await this.mysteryBoxMarket.getToken20FeeReduction(this.usdt.address);
        let amount = BigNumber.from(beforeReductionAmount).sub(feeReduction);
        let reductionAmount = BigNumber.from(beforeReductionAmount).mul(feeReduction).div(10000);
        let nftFundAmount = BigNumber.from(beforeReductionAmount).mul(pool.fundRatio).div(10000);
        let handlingFee = BigNumber.from(beforeReductionAmount).mul(pool.feeRatio).div(10000).sub(feeReduction);
        let crowdAmount = BigNumber.from(beforeReductionAmount).mul(pool.ownerRatio).div(10000);
        let luckyReward = amount.sub(nftFundAmount.add(handlingFee).add(crowdAmount));;
        let balanceOfFundAccount = await this.usdt.balanceOf(_NFTFundAccount);
        let balanceOfHandingFeeAccount = await this.usdt.balanceOf(_handlingFeeAccount);
        let balanceOfCrowdfundPools = await this.usdt.balanceOf(this.crowdfundPools.address);
        let balanceOfLuckyLottery = await this.usdt.balanceOf(this.luckyLottery.address);
        expect(balanceOfFundAccount).to.equal(nftFundAmount);
        expect(balanceOfHandingFeeAccount).to.equal(handlingFee);
        // expect(balanceOfCrowdfundPools).to.equal(crowdAmount);
        expect(balanceOfLuckyLottery).to.equal(luckyReward);
        console.log("balanceOfFundAccount is:",balanceOfFundAccount.toString());
        console.log("feeReduction is:",feeReduction.toString());
<<<<<<< HEAD
=======

        console.log("3 test _quantity > remainQuantityThisTime");
        await this.mysteryBoxMarket.buyMysteryBox(poolId,countBuy_1100,this.usdt.address,await withDecimals(countBuy_1100));
>>>>>>> 930c126f3597875a8d50a744e74cc437204301ea
    });

    // it("test openMysteryBox", async function() {
    //     let poolId = 1;
    //     let workId = 1;
    //     let workId2 = 2;
    //     let workId3 = 3;
    //     let workId4 = 4;
    //     let collectionId1 = 1;
    //     let proposalId1 = collectionId1;

    //     await this.usdt.mint(owner.address,withDecimals(1000));
    //     await this.usdt.approve(this.mysteryBoxMarket.address,withDecimals(1000));

    //     let _crowdfundRatio_0 = "0"
    //     let _proposer = owner.address;
    //     let _proposalId = "1"
    //     let _dividendRatio = "50"
    //     let _duration = 1000;
    //     let _minJoinAmount = await withDecimals("100000")
    //     let _maxJoinAmount = await withDecimals("100000000")
    //     let _hnqAmount = await withDecimals("3000")
    //     let _hipAmountPerHnq = await withDecimals("50000")
    //     let _targetAmount = await withDecimals("110000000")
    //     let oneHNQ = await withDecimals(1);

    //     await this.base.addWorks("_collectionName","_collectionDesc","_collectionUrl",["_workNames1","_workNames2"]
    //     ,["_urls1","_urls2"],["10","10"],["20","30"],["10","15"]);


    //     //start democracy success
    //     let voteAmount = 1000;
    //     let hipBalance = await this.hip.balanceOf(owner.address);
    //     console.log("hipBalance is:",hipBalance.toString());
    //     await this.hip.mint(owner.address,await withDecimals(10000000));
    //     await this.hip.approve(this.democracy.address,await withDecimals(10000000));
    //     await this.democracy.initProposal(collectionId1,1000000,100,100,5000,await withDecimals(5000),this.base.address);
    //     let propState = await this.democracy.getPropState(proposalId1);
    //     await this.democracy.vote(proposalId1,await withDecimals(voteAmount));
    //     let proposalInfo = await this.democracy.proposals(proposalId1);

    //     let voteInfo = await this.democracy.votes(proposalId1,0);
    //     expect(voteInfo.approve).to.equal(await withDecimals(voteAmount));
    //     expect(voteInfo.against).to.equal(await withDecimals(0));
    //     expect(voteInfo.voters).to.equal(1);
    //     expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
    //     await this.hip.mint(bob.address,await withDecimals(10000000));
    //     await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
    //     this.democracy.connect(bob).vote(proposalId1,await withDecimals(voteAmount),{from:bob.address})
    //     let totalSupply = await this.hip.totalSupply();
    //     let countVote = await this.democracy.countingVote(await withDecimals(voteAmount),await withDecimals(0),totalSupply);
    //     expect(countVote).to.equal(true);
    //     let voteDuration = await this.democracy.voteDuration();
    //     console.log("voteDuration is:",voteDuration.toString());
    //     this.democracy.smodify.put({
    //         voteDuration: 100,
    //     });
    //     this.democracy.smodify.put({
    //         voteUsersNeed: 2,
    //     });
    //     let timeBlock = await time.latestBlock();
    //     await time.advanceBlockTo(timeBlock + 100);
    //     let voteResult = await this.democracy.getVoteResult(proposalId1,0);
    //     expect(voteResult).to.equal(1);
    //     await this.democracy.updateProposalStatus(proposalId1);
    //     expect(await this.democracy.getPropState(proposalId1)).to.equal(3);
    //     //end democracy

    //     await this.pledgeToken.mint(owner.address,_targetAmount)
    //     await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
    //     await this.hnqToken.mint(owner.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq).mul(oneHNQ))
    //     await this.hnqToken.approve(this.crowdfundPools.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq).mul(oneHNQ))


    //     await this.democracy.setCrowdfund(this.crowdfundPools.address);
    //     let balHIP = await this.pledgeToken.balanceOf(owner.address);
    //     let balHnQ = await this.hnqToken.balanceOf(owner.address);
    //     console.log("balHIP,;balHnQ,proposalId1",balHIP/1e18,balHnQ/1e18,proposalId1)
    //     await this.democracy.toCrowdfund(proposalId1);

    //     let crowFundId = (await this.democracy.proposals(proposalId1)).lastCrowdfundId;
    //     console.log("crowFundId",crowFundId);
    //     //set curPledgeTotalAmount = _targetAmount
    //     await this.crowdfundPools.smodify.put({
    //         poolInfo:{"1" : {curPledgeTotalAmount : _targetAmount}}
    //     });
    //     //set winnedDataOfPools[_pid].isCompleted == true
    //     await this.crowdfundPools.smodify.put({
    //         winnedDataOfPools:{"1" : {isCompleted : true}}
    //     });

    //     await time.advanceTimeAndBlock(200);
    //     let res = await this.crowdfundPools.getCrowdfundStatus(crowFundId);
    //     console.log("res",res.toString());
    
    //     await this.crowdfundPools.batchCreateNFT(crowFundId);
    //     // await this.crowdfundPools.batchCreateNFT(workId2);

    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("not in support tokens");
    //     await this.mysteryBoxMarket.addToken([this.usdt.address]);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("Not exist the pool");
    //     await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"pool1");

    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,0,this.usdt.address,100)).to.revertedWith("quantity is zero");

    //     // await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("Division or modulo division by zero");
    //     await this.mysteryBox.setInternalCaller(this.base.address,true);
    //     await this.mysteryBox.setInternalCaller(this.mysteryBoxMarket.address,true);

    //     await this.base.prepareMbPackage(workId,0,5);
    //     await expect(this.base.prepareMbPackage(workId,5,10)).revertedWith("Index wrong");
    //     // await expect(this.base.prepareMbPackage(workId,5,9)).to.revertedWith("Cannot use last fragment Id");
    //     await expect(this.base.prepareMbPackage(workId,5,10-2)).to.revertedWith("Already added");
    //     await this.base.prepareMbPackage(workId,6,10-2);
    //     await this.base.createMbPackage(workId,"0");
    //     await this.base.prepareMbPackage(workId2,0,10);
    //     await this.base.prepareMbPackage(workId2,11,15-2);
    //     await this.base.createMbPackage(workId2,"0");
    //     await this.mysteryBox.putToPool(workId,poolId);
    //     await this.mysteryBox.putToPool(workId2,poolId);


    //     console.log("start ---------------------buy");
    //     let packages1 = await this.mysteryBox.boxPackages(workId);
    //     let packages2 = await this.mysteryBox.boxPackages(workId2);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(poolId,10,this.usdt.address,await withDecimals(100)))
    //         .to.revertedWith("amount not equal to after reduction amount");

    //     console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
    //     console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());

    //     await this.mysteryBoxMarket.buyMysteryBox(poolId,20,this.usdt.address,await withDecimals(20));
    //     packages1 = await this.mysteryBox.boxPackages(workId);
    //     packages2 = await this.mysteryBox.boxPackages(workId2);
    //     console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
    //     console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());
    //     expect(await packages1.unsoldTotal.add(packages2.unsoldTotal)).to.equal((10+20*10+10+30*15-20).toString());
    //     let pool =await this.mysteryBox.getBoxPool(poolId);
    //     // feeRatio: 600,
    //     // ownerRatio: 3700,
    //     // fundRatio: 2700,
    //     // rewardRatio: 3000,
    //     console.log("pool feeRatio is:",pool.feeRatio.toString());
    //     console.log("pool ownerRatio is:",pool.ownerRatio.toString());
    //     console.log("pool fundRatio is:",pool.fundRatio.toString());
    //     console.log("pool rewardRatio is:",pool.rewardRatio.toString());
    //     // uint NFTFundAmount = beforeReductionAmount.mul(pool.fundRatio).div(10000);
    //     // uint handlingFee = beforeReductionAmount.mul(pool.feeRatio).div(10000).sub(reductionAmount);
    //     // uint crowdAmount = beforeReductionAmount.mul(pool.ownerRatio).div(10000);
    //     // uint luckyReward = _amount.sub((NFTFundAmount.add(handlingFee)).add(crowdAmount));
    //     let beforeReductionAmount = await withDecimals(20);
    //     let feeReduction = await this.mysteryBoxMarket.getToken20FeeReduction(this.usdt.address);
    //     let amount = BigNumber.from(beforeReductionAmount).sub(feeReduction);
    //     let reductionAmount = BigNumber.from(beforeReductionAmount).mul(feeReduction).div(10000);
    //     let nftFundAmount = BigNumber.from(beforeReductionAmount).mul(pool.fundRatio).div(10000);
    //     let handlingFee = BigNumber.from(beforeReductionAmount).mul(pool.feeRatio).div(10000).sub(feeReduction);
    //     let crowdAmount = BigNumber.from(beforeReductionAmount).mul(pool.ownerRatio).div(10000);
    //     let luckyReward = amount.sub(nftFundAmount.add(handlingFee).add(crowdAmount));;
    //     let balanceOfFundAccount = await this.usdt.balanceOf(_NFTFundAccount);
    //     let balanceOfHandingFeeAccount = await this.usdt.balanceOf(_handlingFeeAccount);
    //     let balanceOfCrowdfundPools = await this.usdt.balanceOf(this.crowdfundPools.address);
    //     let balanceOfLuckyLottery = await this.usdt.balanceOf(this.luckyLottery.address);
    //     expect(balanceOfFundAccount).to.equal(nftFundAmount);
    //     expect(balanceOfHandingFeeAccount).to.equal(handlingFee);
    //     // expect(balanceOfCrowdfundPools).to.equal(crowdAmount);
    //     expect(balanceOfLuckyLottery).to.equal(luckyReward);
    //     await expect(this.mysteryBoxMarket.openMysteryBox(0)).to.revertedWith("quantity is zero or greater than unOpenedQuantity or maxOpenQuantity");
    //     await expect(this.mysteryBoxMarket.openMysteryBox(100)).to.revertedWith("quantity is zero or greater than unOpenedQuantity or maxOpenQuantity");
    //     await this.mysteryBoxMarket.adjustMaxOpenQuantity(100);
    //     let tx = await this.mysteryBoxMarket.openMysteryBox(20);
        
    //     packages1 = await this.mysteryBox.boxPackages(workId);
    //     packages2 = await this.mysteryBox.boxPackages(workId2);
    //     console.log("packages1.remained",packages1.remained.toString());
    //     console.log("packages2.remained",packages2.remained.toString());
    //     expect(await packages1.remained.add(packages2.remained)).to.equal((10+20*10+10+30*15-20).toString());

    //     let receipt = await tx.wait()
    //     let mysteryBoxOpened = receipt.events.pop()
    //     expect(mysteryBoxOpened.event).to.be.equal("MysteryBoxOpened")
    //     expect(mysteryBoxOpened.eventSignature).to.be.equal("MysteryBoxOpened(address,(bool,address,uint256)[])")
    //     let tokens = mysteryBoxOpened.args[1];
    //     let tokenAmount = BigNumber.from(0);
    //     let repeatToken = [];
    //     for (let i = 0;i<tokens.length;i++){
    //         let balanceOf = await this.token1155.balanceOf(owner.address,tokens[i][2]);
    //         if(balanceOf.gt(1)&&repeatToken.indexOf(tokens[i][2].toString())>-1){
    //             continue;
    //         }else{
    //             repeatToken.push(tokens[i][2].toString());
    //         }
    //         console.log("balance is:",tokens[i][2].toString(),balanceOf.toString());
    //         tokenAmount = tokenAmount.add(balanceOf);
    //     }
    //     expect(tokenAmount).to.equal(tokens.length);
    //     console.log("tokenAmount",tokenAmount.toString())


    //     //bob start buy left
    //     let nftTokenAmount = 10+20*10+10+30*15-20;
    //     console.log("nftTokenAmount is:",nftTokenAmount);
    //     await this.usdt.mint(bob.address,withDecimals(1000));
    //     await this.usdt.connect(bob).approve(this.mysteryBoxMarket.address,withDecimals(1000),{from:bob.address});
    //     await this.mysteryBoxMarket.connect(bob).buyMysteryBox(poolId,nftTokenAmount,this.usdt.address,await withDecimals(nftTokenAmount),{from:bob.address});
    //     await this.mysteryBoxMarket.adjustMaxOpenQuantity(1000);
    //     tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
    //     let openBoxCount = await this.mysteryBoxMarket.getOpenedNFTsQuantity(bob.address);
    //     expect(100).to.equal(openBoxCount);
    //     let openableQuantity = await this.mysteryBoxMarket.getOpenableQuantity(bob.address);
    //     expect(openableQuantity).to.equal(nftTokenAmount-100);
    //     tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
    //     tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
    //     tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(100,{from:bob.address});
    //     tx = await this.mysteryBoxMarket.connect(bob).openMysteryBox(nftTokenAmount-400,{from:bob.address});
    //     let pack1 = await this.mysteryBox.boxPackages(workId);
    //     expect(pack1.remained).equal(0);
    //     expect(pack1.unsoldTotal).equal(0);
    //     expect(pack1.state).equal(2);
    //     // console.log("pack1 is:",pack1);
    //     let pack2 = await this.mysteryBox.boxPackages(workId2);
    //     expect(pack2.remained).equal(0);
    //     expect(pack2.unsoldTotal).equal(0);
    //     expect(pack2.state).equal(2);
    // });

    // it("test buyMysteryBox after setTokenFeeReduction", async function() {
    //     let poolId = 1;
    //     let workId = 1;
    //     let workId2 = 2;
    //     let workId3 = 3;
    //     let workId4 = 4;
    //     let collectionId1 = 1;
    //     let proposalId1 = collectionId1;
    //     await this.usdt.mint(owner.address,withDecimals(1000));
    //     await this.usdt.approve(this.mysteryBoxMarket.address,withDecimals(1000));

    //     let _crowdfundRatio_0 = "0"
    //     let _proposer = owner.address;
    //     // let _proposalId = "1"
    //     let _dividendRatio = "50"
    //     let _duration = 1000;
    //     let _minJoinAmount = await withDecimals("100000")
    //     let _maxJoinAmount = await withDecimals("100000000")
    //     let _hnqAmount = await withDecimals("3000")
    //     let _hipAmountPerHnq = await withDecimals("100000")
    //     let _targetAmount = await withDecimals("110000000")

    //     // function addWorks(string memory _collectionName,string memory _collectionDesc,string memory _collectionUrl,
    //     //     string[] memory _workNames,string[] memory _urls, uint64[] memory _completeNftNums,
    //     //     uint64[] memory _compToFragNftNums,uint64[] memory _fragNumPerCompNFTs
    //     // )
    //     await this.base.addWorks("_collectionName","_collectionDesc","_collectionUrl",["_workNames1","_workNames2"]
    //     ,["_urls1","_urls2"],["10","10"],["20","30"],["10","15"]);

    //     //start democracy success
    //     let voteAmount = 1000;
    //     let hipBalance = await this.hip.balanceOf(owner.address);
    //     console.log("hipBalance is:",hipBalance.toString());
    //     await this.hip.mint(owner.address,await withDecimals(10000000));
    //     await this.hip.approve(this.democracy.address,await withDecimals(10000000));
    //     await this.democracy.initProposal(collectionId1,1000000,100,100,5000,await withDecimals(5000),this.base.address);
    //     let propState = await this.democracy.getPropState(proposalId1);
    //     await this.democracy.vote(proposalId1,await withDecimals(voteAmount));
    //     let proposalInfo = await this.democracy.proposals(proposalId1);

    //     let voteInfo = await this.democracy.votes(proposalId1,0);
    //     expect(voteInfo.approve).to.equal(await withDecimals(voteAmount));
    //     expect(voteInfo.against).to.equal(await withDecimals(0));
    //     expect(voteInfo.voters).to.equal(1);
    //     expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
    //     await this.hip.mint(bob.address,await withDecimals(10000000));
    //     await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
    //     this.democracy.connect(bob).vote(proposalId1,await withDecimals(voteAmount),{from:bob.address})
    //     let totalSupply = await this.hip.totalSupply();
    //     let countVote = await this.democracy.countingVote(await withDecimals(voteAmount),await withDecimals(0),totalSupply);
    //     expect(countVote).to.equal(true);
    //     let voteDuration = await this.democracy.voteDuration();
    //     console.log("voteDuration is:",voteDuration.toString());
    //     this.democracy.smodify.put({
    //         voteDuration: 100,
    //     });
    //     this.democracy.smodify.put({
    //         voteUsersNeed: 2,
    //     });
    //     let timeBlock = await time.latestBlock();
    //     await time.advanceBlockTo(timeBlock + 100);
    //     let voteResult = await this.democracy.getVoteResult(1,0);
    //     expect(voteResult).to.equal(1);
    //     await this.democracy.updateProposalStatus(1);
    //     expect(await this.democracy.getPropState(1)).to.equal(3);
    //     //end democracy


    //     await this.pledgeToken.mint(owner.address,_targetAmount)
    //     await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
    //     await this.hnqToken.mint(owner.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq))
    //     await this.hnqToken.approve(this.crowdfundPools.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq))

    //     await this.democracy.setCrowdfund(this.crowdfundPools.address);
    //     await this.democracy.toCrowdfund(proposalId1);
    //     let crowFundId = (await this.democracy.proposals(proposalId1)).lastCrowdfundId;

    //     await this.crowdfundPools.batchCreateNFT(crowFundId);
    //     // await this.crowdfundPools.batchCreateNFT(workId2);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("not in support tokens");
    //     await this.mysteryBoxMarket.addToken([this.usdt.address]);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("Not exist the pool");
    //     await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"pool1");
    //     //function buyMysteryBox(uint _poolId, uint _quantity, address _token20Address, uint _amount)
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,0,this.usdt.address,100)).to.revertedWith("quantity is zero");
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("quantity is zero or greater than unsold quantity");

    //     await this.mysteryBox.setInternalCaller(this.base.address,true);
    //     await this.mysteryBox.setInternalCaller(this.mysteryBoxMarket.address,true);

    //     await this.base.prepareMbPackage(workId,0,5);
    //     await expect(this.base.prepareMbPackage(workId,5,10)).revertedWith("Index wrong");
    //     // await expect(this.base.prepareMbPackage(workId,5,9)).to.revertedWith("Cannot use last fragment Id");
    //     await expect(this.base.prepareMbPackage(workId,5,10-2)).to.revertedWith("Already added");
    //     await this.base.prepareMbPackage(workId,6,10-2);
    //     await this.base.createMbPackage(workId);
    //     await this.base.prepareMbPackage(workId2,0,10);
    //     await this.base.prepareMbPackage(workId2,11,15-2);
    //     await this.base.createMbPackage(workId2);
    //     await this.mysteryBox.putToPool(workId,poolId);
    //     await this.mysteryBox.putToPool(workId2,poolId);
    //     console.log("start ---------------------buy");

    //     let packages1 = await this.mysteryBox.boxPackages(workId);
    //     let packages2 = await this.mysteryBox.boxPackages(workId2);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(poolId,10,this.usdt.address,await withDecimals(100)))
    //         .to.revertedWith("amount not equal to after reduction amount");

    //     console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
    //     console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());
    //     let minFeeRatio = await this.mysteryBox.minFeeRatio();
    //     console.log("minFeeRatio is:",minFeeRatio.toString());
    //     let feeReduction = 400;
    //     await this.mysteryBoxMarket.setTokenFeeReduction(this.usdt.address,feeReduction);
    //     let amount = BigNumber.from(10).pow(18).mul(20).mul(96).div(100);
    //     console.log("amount is:",amount.toString());
    //     await this.mysteryBoxMarket.buyMysteryBox(poolId,20,this.usdt.address,amount.toString());
    //     packages1 = await this.mysteryBox.boxPackages(workId);
    //     packages2 = await this.mysteryBox.boxPackages(workId2);
    //     console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
    //     console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());
    //     expect(await packages1.unsoldTotal.add(packages2.unsoldTotal)).to.equal((10+20*10+10+30*15-20).toString());
    //     let pool =await this.mysteryBox.getBoxPool(poolId);
    //     // feeRatio: 600,
    //     // ownerRatio: 3700,
    //     // fundRatio: 2700,
    //     // rewardRatio: 3000,
    //     console.log("pool feeRatio is:",pool.feeRatio.toString());
    //     console.log("pool ownerRatio is:",pool.ownerRatio.toString());
    //     console.log("pool fundRatio is:",pool.fundRatio.toString());
    //     console.log("pool rewardRatio is:",pool.rewardRatio.toString());
    //     // uint NFTFundAmount = beforeReductionAmount.mul(pool.fundRatio).div(10000);
    //     // uint handlingFee = beforeReductionAmount.mul(pool.feeRatio).div(10000).sub(reductionAmount);
    //     // uint crowdAmount = beforeReductionAmount.mul(pool.ownerRatio).div(10000);
    //     // uint luckyReward = _amount.sub((NFTFundAmount.add(handlingFee)).add(crowdAmount));
    //     let beforeReductionAmount = await withDecimals(20);
    //     feeReduction = await this.mysteryBoxMarket.getToken20FeeReduction(this.usdt.address);
    //     let reductionAmount = BigNumber.from(beforeReductionAmount).mul(feeReduction).div(10000);
    //     amount = BigNumber.from(beforeReductionAmount).sub(reductionAmount);
    //     console.log("reductionAmount is:",reductionAmount.toString());
    //     let nftFundAmount = BigNumber.from(beforeReductionAmount).mul(pool.fundRatio).div(10000);
    //     let handlingFee = BigNumber.from(beforeReductionAmount).mul(pool.feeRatio).div(10000).sub(reductionAmount);
    //     let crowdAmount = BigNumber.from(beforeReductionAmount).mul(pool.ownerRatio).div(10000);
    //     let luckyReward = amount.sub(nftFundAmount.add(handlingFee).add(crowdAmount));;
    //     let balanceOfFundAccount = await this.usdt.balanceOf(_NFTFundAccount);
    //     let balanceOfHandingFeeAccount = await this.usdt.balanceOf(_handlingFeeAccount);
    //     let balanceOfCrowdfundPools = await this.usdt.balanceOf(this.crowdfundPools.address);
    //     let balanceOfLuckyLottery = await this.usdt.balanceOf(this.luckyLottery.address);
    //     expect(balanceOfFundAccount).to.equal(nftFundAmount);
    //     console.log("balanceOfHandingFeeAccount is:",balanceOfHandingFeeAccount.toString());
    //     console.log("handlingFee is:",handlingFee.toString());
    //     expect(balanceOfHandingFeeAccount).to.equal(handlingFee);
    //     // expect(balanceOfCrowdfundPools).to.equal(crowdAmount);
    //     expect(balanceOfLuckyLottery).to.equal(luckyReward);

    // });

    // it("test setRewardPool", async function() {
    //     await expect(this.mysteryBoxMarket.connect(alice).setRewardPool(0,{from:alice.address})).revertedWith("caller is not the owner");
    //     await expect(this.mysteryBoxMarket.setRewardPool(100)).to.revertedWith("pool not exist");
    //     await this.mysteryBoxMarket.setRewardPool(0);
    //     let rewardPool = await this.mysteryBoxMarket.getRewardPool();
    //     expect(rewardPool).to.equal(0);
    // });

    // it("test inputRewardData", async function() {
    //     await expect(this.mysteryBoxMarket.connect(alice).inputRewardData([1],10,{from:alice.address})).revertedWith("caller is not the owner");
    //     let encode_value = encodeParameters(["uint"],[1]);
    //     console.log("encode_value is",encode_value.toString());
    //     let reward_number = BigNumber.from(encode_value.toString());
    //     await this.mysteryBoxMarket.inputRewardData([reward_number],10);
    //     await expect(this.mysteryBoxMarket.inputRewardData([reward_number],10)).to.revertedWith("reward number is exist");
    //     let rewardQuantity = await this.mysteryBoxMarket.getRewardQuantity(1);
    //     expect(rewardQuantity).to.equal(10);
    // });

    // it("test receiveReward", async function() {
    //     await expect(this.mysteryBoxMarket.receiveReward(1,this.usdt.address)).to.revertedWith("this number no reward");
    //     let poolId = 1;
    //     let workId = 1;
    //     let workId2 = 2;
    //     let workId3 = 3;
    //     let workId4 = 4;
    //     let collectionId1 = 1;
    //     let proposalId1 = collectionId1;

    //     await this.usdt.mint(owner.address,withDecimals(1000));
    //     await this.usdt.approve(this.mysteryBoxMarket.address,withDecimals(1000));

    //     let _crowdfundRatio_0 = "0"
    //     let _proposer = owner.address;
    //     let _dividendRatio = "50"
    //     let _duration = 1000;
    //     let _minJoinAmount = await withDecimals("100000")
    //     let _maxJoinAmount = await withDecimals("100000000")
    //     let _hnqAmount = await withDecimals("3000")
    //     let _hipAmountPerHnq = await withDecimals("100000")
    //     let _targetAmount = await withDecimals("110000000")

    //     // function addWorks(string memory _collectionName,string memory _collectionDesc,string memory _collectionUrl,
    //     //     string[] memory _workNames,string[] memory _urls, uint64[] memory _completeNftNums,
    //     //     uint64[] memory _compToFragNftNums,uint64[] memory _fragNumPerCompNFTs
    //     // )
    //     await this.base.addWorks("_collectionName","_collectionDesc","_collectionUrl",["_workNames1","_workNames2"]
    //     ,["_urls1","_urls2"],["10","10"],["20","30"],["10","15"]);

    //     //start democracy success
    //     let voteAmount = 1000;
    //     let hipBalance = await this.hip.balanceOf(owner.address);
    //     console.log("hipBalance is:",hipBalance.toString());
    //     await this.hip.mint(owner.address,await withDecimals(10000000));
    //     await this.hip.approve(this.democracy.address,await withDecimals(10000000));
    //     await this.democracy.initProposal(collectionId1,1000000,100,100,5000,await withDecimals(5000),this.base.address);
    //     let propState = await this.democracy.getPropState(proposalId1);
    //     await this.democracy.vote(proposalId1,await withDecimals(voteAmount));
    //     let proposalInfo = await this.democracy.proposals(proposalId1);

    //     let voteInfo = await this.democracy.votes(proposalId1,0);
    //     expect(voteInfo.approve).to.equal(await withDecimals(voteAmount));
    //     expect(voteInfo.against).to.equal(await withDecimals(0));
    //     expect(voteInfo.voters).to.equal(1);
    //     expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
    //     await this.hip.mint(bob.address,await withDecimals(10000000));
    //     await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
    //     this.democracy.connect(bob).vote(proposalId1,await withDecimals(voteAmount),{from:bob.address})
    //     let totalSupply = await this.hip.totalSupply();
    //     let countVote = await this.democracy.countingVote(await withDecimals(voteAmount),await withDecimals(0),totalSupply);
    //     expect(countVote).to.equal(true);
    //     let voteDuration = await this.democracy.voteDuration();
    //     console.log("voteDuration is:",voteDuration.toString());
    //     this.democracy.smodify.put({
    //         voteDuration: 100,
    //     });
    //     this.democracy.smodify.put({
    //         voteUsersNeed: 2,
    //     });
    //     const timeBlock = await time.latestBlock();
    //     await time.advanceBlockTo(timeBlock + 100);
    //     const voteResult = await this.democracy.getVoteResult(1,0);
    //     expect(voteResult).to.equal(1);
    //     await this.democracy.updateProposalStatus(1);
    //     expect(await this.democracy.getPropState(1)).to.equal(3);
    //     //end democracy


    //     await this.pledgeToken.mint(owner.address,_targetAmount)
    //     await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
    //     await this.hnqToken.mint(owner.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq))
    //     await this.hnqToken.approve(this.crowdfundPools.address,BigNumber.from(_targetAmount).div(_hipAmountPerHnq))

    //     await this.democracy.setCrowdfund(this.crowdfundPools.address);
    //     await this.democracy.toCrowdfund(proposalId1);
    //     let crowFundId = (await this.democracy.proposals(proposalId1)).lastCrowdfundId;
    //     await this.crowdfundPools.batchCreateNFT(crowFundId);
    //     // await this.crowdfundPools.batchCreateNFT(workId2);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("not in support tokens");
    //     await this.mysteryBoxMarket.addToken([this.usdt.address]);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("Not exist the pool");
    //     await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"pool1");
    //     //function buyMysteryBox(uint _poolId, uint _quantity, address _token20Address, uint _amount)
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,0,this.usdt.address,100)).to.revertedWith("quantity is zero");
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(1,10,this.usdt.address,100)).to.revertedWith("quantity is zero or greater than unsold quantity");

    //     await this.mysteryBox.setInternalCaller(this.base.address,true);
    //     await this.mysteryBox.setInternalCaller(this.mysteryBoxMarket.address,true);

    //     await this.base.prepareMbPackage(workId,0,5);
    //     await expect(this.base.prepareMbPackage(workId,5,10)).revertedWith("Index wrong");
    //     // await expect(this.base.prepareMbPackage(workId,5,9)).to.revertedWith("Cannot use last fragment Id");
    //     await expect(this.base.prepareMbPackage(workId,5,10-2)).to.revertedWith("Already added");
    //     await this.base.prepareMbPackage(workId,6,10-2);
    //     await this.base.createMbPackage(workId);
    //     await this.base.prepareMbPackage(workId2,0,10);
    //     await this.base.prepareMbPackage(workId2,11,15-2);
    //     await this.base.createMbPackage(workId2);
    //     await this.mysteryBox.putToPool(workId,poolId);
    //     await this.mysteryBox.putToPool(workId2,poolId);
    //     console.log("start ---------------------buy");

    //     let packages1 = await this.mysteryBox.boxPackages(workId);
    //     let packages2 = await this.mysteryBox.boxPackages(workId2);
    //     await expect(this.mysteryBoxMarket.buyMysteryBox(poolId,10,this.usdt.address,await withDecimals(100)))
    //         .to.revertedWith("amount not equal to after reduction amount");

    //     console.log("packages1.unsoldTotal",packages1.unsoldTotal.toString());
    //     console.log("packages2.unsoldTotal",packages2.unsoldTotal.toString());
    //     let minFeeRatio = await this.mysteryBox.minFeeRatio();
    //     console.log("minFeeRatio is:",minFeeRatio.toString());
    //     let feeReduction = 400;
    //     await this.mysteryBoxMarket.setTokenFeeReduction(this.usdt.address,feeReduction);

    //     let encode_value = encodeParameters(["uint"],[1]);
    //     console.log("encode_value is",encode_value.toString());
    //     let reward_number = BigNumber.from(encode_value.toString());
    //     await this.mysteryBoxMarket.inputRewardData([reward_number],100);
    //     // await this.mysteryBoxMarket.inputRewardData([1],1);
    //     console.log("await withDecimals(9.6)",await withDecimals("96"));

    //     await this.usdt.mint(bob.address,await withDecimals(100000000000));
    //     await this.usdt.connect(bob).approve(this.mysteryBoxMarket.address,await withDecimals(100000000000),{from:bob.address});
    //     await this.hip.mint(bob.address,await withDecimals(100000000000));
    //     await this.hip.connect(bob).approve(this.mysteryBoxMarket.address,await withDecimals(100000000000),{from:bob.address});

    //     await this.mysteryBoxMarket.setRewardPayAccount(bob.address);
    //     let rewardPayAccount = await this.mysteryBoxMarket.getRewardPayAccount();
    //     expect(rewardPayAccount).to.equal(bob.address);
    //     await this.mysteryBoxMarket.receiveReward(1,this.usdt.address);
    //     //,await withDecimals("96")
    //     await expect(this.mysteryBoxMarket.receiveReward(1,this.usdt.address)).to.revertedWith("this number no reward");
    // });

    

})
