const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const {BN} = require('@openzeppelin/test-helpers');
const { time } = require("./utilities")
const { smoddit,smockit } = require("@eth-optimism/smock");

let ONE_MINUTES = 60;
let ONE_DAY = 86400;

async function withDecimals(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(18))).toString();
}
let owner;
let user;
let alice;
let bob;
let cloud;
describe("Democracy func",function() {
    before(async function () {
        this.signers = await ethers.getSigners()
        owner = this.signers[0]
        user = this.signers[1]
        alice = this.signers[2]
        bob = this.signers[3];
        cloud = this.signers[4];

        this.Democracy = await smoddit("MyDemocracyMock");
        this.ERC20Smart = await ethers.getContractFactory("ERC20Smart");
        this.Base = await ethers.getContractFactory("Base");
        // this.UniswapV2Library = await ethers.getContractFactory("UniswapV2Library");

    })

    beforeEach(async function () {
        this.hip = await this.ERC20Smart.deploy("hip","hip token");
        this.base = await this.Base.deploy();
        //string memory _collectionName,string memory _collectionDesc,string memory _collectionUrl,
        // string[] memory _workNames,string[] memory _urls,string[] memory _fragDataUrls,string[][] memory fragUrls,
        // uint64[] memory _completeNftNums,uint64[] memory _compToFragNftNums,uint64[] memory _fragNumPerCompNFTs
        await this.base.addWorks("test_collectionName","test_collectionDesc","test_collectionUrl",["test_workNames"],["test_urls"],[1],[1],[1]);
        this.democracy = await this.Democracy.deploy();
        await this.democracy.deployed();
        this.usdt = await this.ERC20Smart.deploy("USDT token", "USDT");
        await this.usdt.deployed();
        // IERC20MetadataUpgradeable _hip,
        // uint256 _uploadFeePerWork,
        // IBase _base,
        // address _feeTo,
        // address _swapFactory,
        // IERC20MetadataUpgradeable _usdToken
        await this.democracy.initialize(this.hip.address,await withDecimals(200000),this.base.address,user.address,this.usdt.address,this.usdt.address);
        await this.base.initialize(
            owner.address,
            bob.address,
            alice.address,
            this.democracy.address,
            alice.address
        );
        // this.uniswapV2Library =await this.UniswapV2Library.deploy();
        // await this.uniswapV2Library.deployed();
        // console.log("this.uniswapV2Library is:",this.uniswapV2Library);
        // const MyMockUniswapV2Library = await smockit(this.uniswapV2Library);
        // MyMockUniswapV2Library.smocked.getReserves
        //             .will.return.with(10,10);
    })

    it("proposal init",async function(){
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        // uint256 _collectionId,
        // uint256 _crowdfundRatio,
        // uint256 _dividendRatio,
        // uint256 _duration,
        // uint256 _maxJoinAmount,
        // uint256 _valuation
        await expect(this.democracy.initProposal(1,100,10000000,100,5000,await withDecimals(5000))).to.revertedWith("Dividend ratio too large");
        await expect(this.democracy.initProposal(1,10000000,100,100,5000,await withDecimals(5000))).to.revertedWith("Crowdfund ratio too large");
        await expect(this.democracy.initProposal(1,100000,100,50000000000000,5000,await withDecimals(5000))).to.revertedWith("Duration exceeds max duration");
        await expect(this.democracy.initProposal(1,100000,100,100,5000,0)).to.revertedWith("_valuation need GT minValuation");
        await expect(this.democracy.connect(bob).initProposal(1,100000,100,100,5000,await withDecimals(5000),{from:bob.address})).to.revertedWith("Not your collection");
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        await expect(this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000))).to.revertedWith("Proposal Existed");

        await this.base.addWorks("test_collectionName","test_collectionDesc","test_collectionUrl",["test_workNames"],["test_urls"],[1],[1],[10]);
        await this.base.addWorks("test_collectionName","test_collectionDesc","test_collectionUrl",["test_workNames"],["test_urls"],[1],[1],[10]);
        await this.democracy.initProposal(3,100000,100,100,5000,await withDecimals(5000));
        await this.democracy.initProposal(2,100000,100,100,5000,await withDecimals(5000));

        let propState = await this.democracy.getPropState(1);
        expect(propState).to.equal(2);
    });

    it("initProposalFromBase",async function(){
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        //uint256 _collectionId,address _uploader,uint256 _len,uint256 _crowdfundRatio,uint256 _dividendRatio,uint256 _duration,uint256 _maxJoinAmount,uint256 _valuation
        await expect(this.democracy.initProposalFromBase(1,user.address,10,100000,100,5000,100,await withDecimals(5000))).to.revertedWith("Only Base can call");
        let _collectionName = "testClName";
        let _collectionDesc = "testClDesc";
        let _collectionUrl = "testClUrl";
        let _workNames = [];
        let _urls = ["u1"];
        let _completeNftNums = [2];
        let _compToFragNftNums = [4];
        let _fragNumPerCompNFTs = [13];
        let _valuation = await withDecimals(5000);
        let _crowdfundParams = [100000,4,3,2,_valuation];
        await expect(this.base.createProposal(_collectionName, _collectionDesc, _collectionUrl, _workNames,
            _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs,_crowdfundParams)).to.revertedWith("Len must GT 0");
        _workNames = ["w1"];
        await this.base.createProposal(_collectionName, _collectionDesc, _collectionUrl, _workNames,
            _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs,[100000,100,500,100,await withDecimals(5000)]);
        let propState = await this.democracy.getPropState(2);
        expect(propState).to.equal(2);
        await this.democracy.setContractsAddr(owner.address);
        await expect(this.democracy.initProposalFromBase(2,owner.address,10,100000,100,5000,100,await withDecimals(5000))).to.revertedWith("Proposal Existed");
        await this.democracy.initProposalFromBase(20,owner.address,10,100000,100,5000,100,await withDecimals(5000));
        await this.democracy.initProposalFromBase(10,owner.address,10,100000,100,5000,100,await withDecimals(5000));
    });


    it("test propState ",async function(){
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        let propState = await this.democracy.getPropState(1);
        expect(propState).to.equal(2);
        // await this.base.deleteWorkOfCollect(1,1);
        // await this.democracy.initProposal(1);
    });

    it("proposal vote positive",async function(){
        let voteAmount = 1000;
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        let propState = await this.democracy.getPropState(1);
        expect(propState).to.equal(2);
        await this.democracy.vote(1,await withDecimals(voteAmount));
        let proposalInfo = await this.democracy.proposals(1);

        let voteInfo = await this.democracy.votes(1,0);
        expect(voteInfo.approve).to.equal(await withDecimals(voteAmount));
        expect(voteInfo.against).to.equal(await withDecimals(0));
        expect(voteInfo.voters).to.equal(1);
        expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
        await expect(this.democracy.vote(1,await withDecimals(voteAmount))).to.revertedWith("Already vote the proposal!");
        await expect(this.democracy.connect(bob).vote(1,"0",{from:bob.address})).to.revertedWith("Poll can't be zero");
        let totalSupply = await this.hip.totalSupply();
        let countVote = await this.democracy.countingVote(await withDecimals(voteAmount),await withDecimals(0),totalSupply);
        expect(countVote).to.equal(true);

        var userAddress = await this.democracy.userVotedList(owner.address,0);
        expect(userAddress.toString()).to.equal("1");
        var userIsVote = await this.democracy.isUserVotedPropId(owner.address,1);
        expect(userIsVote.toString()).to.equal("true");
    });

    it("test getVoteResult not vote need",async function(){
        let voteAmount = 1000;
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        let propState = await this.democracy.getPropState(1);
        expect(propState).to.equal(2);
        await this.democracy.vote(1,await withDecimals(voteAmount));
        let proposalInfo = await this.democracy.proposals(1);

        let voteInfo = await this.democracy.votes(1,0);
        expect(voteInfo.approve).to.equal(await withDecimals(voteAmount));
        expect(voteInfo.against).to.equal(await withDecimals(0));
        expect(voteInfo.voters).to.equal(1);
        expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
        await expect(this.democracy.vote(1,await withDecimals(voteAmount))).to.revertedWith("Already vote the proposal!");
        await expect(this.democracy.connect(bob).vote(1,"0",{from:bob.address})).to.revertedWith("Poll can't be zero");
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
        await time.advanceTimeAndBlock(10);
        let voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(0);
        await time.advanceTimeAndBlock(100);
        voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(2);
    });

    it("test getVoteResult success",async function(){
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
    });

    it("test VoteResult is failed",async function(){
        let voteAmount = 1000;
        let hipBalance = await this.hip.balanceOf(owner.address);
        console.log("hipBalance is:",hipBalance.toString());
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        var propState = await this.democracy.getPropState(1);
        await expect(this.democracy.vote(1,await withDecimals(-1050))).to.revertedWith("Amount must be divisible by 1000 tokens");
        await this.democracy.vote(1,await withDecimals(-voteAmount));
        let proposalInfo = await this.democracy.proposals(1);

        let voteInfo = await this.democracy.votes(1,0);
        expect(voteInfo.approve).to.equal(await withDecimals(0));
        expect(voteInfo.against).to.equal(await withDecimals(voteAmount));
        expect(voteInfo.voters).to.equal(1);
        expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
        await this.hip.mint(bob.address,await withDecimals(10000000));
        await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
        this.democracy.connect(bob).vote(1,await withDecimals(-voteAmount),{from:bob.address})
        let totalSupply = await this.hip.totalSupply();
        let countVote = await this.democracy.countingVote(await withDecimals(voteAmount),await withDecimals(0),totalSupply);
        expect(countVote).to.equal(true);
        this.democracy.smodify.put({
            voteDuration: 100,
        });
        let voteDuration = await this.democracy.voteDuration();
        console.log("voteDuration is:",voteDuration.toString());
        this.democracy.smodify.put({
            voteUsersNeed: 2,
        });
        let timeBlock = await time.latestBlock();
        await time.advanceTimeAndBlock(100);
        var propState = await this.democracy.getPropState(1);
        console.log("propState is:",propState.toString());
        await this.hip.mint(alice.address,await withDecimals(10000000));
        await this.hip.connect(alice).approve(this.democracy.address,await withDecimals(10000000),{from:alice.address});
        await expect(this.democracy.connect(alice).vote(1,await withDecimals(-voteAmount),{from:alice.address})).to.revertedWith("Need on vote duration");


        var voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(2);
        var voteResult = await this.democracy.getVoteResult(0,0);
        expect(voteResult).to.equal(0);
        console.log("start updateProposalStatus-----------------111");
        var canModifyCollection = await this.democracy.canModifyCollection(1);
        expect(canModifyCollection).to.equal(false);
        await this.democracy.updateProposalStatus(1);
        expect(await this.democracy.getPropState(1)).to.equal(4);
        var canModifyCollection = await this.democracy.canModifyCollection(1);
        expect(canModifyCollection).to.equal(true);
        var voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(4);
        await this.base.deleteWorkOfCollect(1,1);
        await expect(this.democracy.modifyProposal(1,100000,100,100,5000,await withDecimals(5000))).to.revertedWith("Nums of works need GT 0");
        await expect(this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000))).to.revertedWith("Nums of works need GT 0");
        // this.democracy.vote(100,await withDecimals(-voteAmount));
        // await expect(this.democracy.vote(1,await withDecimals(-voteAmount))).to.revertedWith("Need on vote duration");
    });


    it("test modifyProposal",async function(){
        let voteAmount = 1000;
        let hipBalance = await this.hip.balanceOf(owner.address);
        console.log("hipBalance is:",hipBalance.toString());
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        let propState = await this.democracy.getPropState(1);
        await this.democracy.vote(1,await withDecimals(-voteAmount));
        let proposalInfo = await this.democracy.proposals(1);

        let voteInfo = await this.democracy.votes(1,0);
        expect(voteInfo.approve).to.equal(await withDecimals(0));
        expect(voteInfo.against).to.equal(await withDecimals(voteAmount));
        expect(voteInfo.voters).to.equal(1);
        expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
        await this.hip.mint(bob.address,await withDecimals(10000000));
        await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
        await this.democracy.connect(bob).vote(1,await withDecimals(-voteAmount),{from:bob.address})
        let totalSupply = await this.hip.totalSupply();
        let countVote = await this.democracy.countingVote(await withDecimals(voteAmount),await withDecimals(0),totalSupply);
        expect(countVote).to.equal(true);
        this.democracy.smodify.put({
            voteDuration: 100,
        });
        let voteDuration = await this.democracy.voteDuration();
        console.log("voteDuration is:",voteDuration.toString());
        this.democracy.smodify.put({
            voteUsersNeed: 2,
        });


        await expect(this.democracy.connect(alice).modifyProposal(1,100000,100,100,5000,await withDecimals(5000),{from:alice.address})).to.revertedWith("msgSender is not proposer");
        await expect(this.democracy.modifyProposal(1,100000,100,100,5000,await withDecimals(5000))).to.revertedWith("This proposal must be failed");

        var timeBlock = await time.latestBlock();
        await time.advanceBlockTo(timeBlock + 100);
        var voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(2);
        console.log("start updateProposalStatus-----------------222");
        await this.democracy.updateProposalStatus(1);
        expect(await this.democracy.getPropState(1)).to.equal(4);
        await this.democracy.modifyProposal(1,100000,100,100,5000,await withDecimals(5000));
        var proposal = await this.democracy.proposals(1);
        var failNum = proposal.failNum;
        var status = proposal.status;
        expect(failNum).to.equal(1);
        expect(status).to.equal(1);



        var voteData = await this.democracy.getVoteData(1,0);
        console.log("voteData is:",voteData);
        var canModifyCollection = await this.democracy.canModifyCollection(1);
        console.log("canModifyCollection is:",canModifyCollection.toString());
        var getProposingIdsLen = await this.democracy.getProposingIdsLen();
        console.log("getProposingIdsLen is:",getProposingIdsLen.toString());

        var getUserVotedListLen = await this.democracy.getUserVotedListLen(owner.address);
        console.log("getUserVotedListLen is:",getUserVotedListLen.toString());
        var getPartialProposingIds = await this.democracy.getPartialProposingIds(0,0);
        await expect(this.democracy.getPartialProposingIds(3,5)).to.revertedWith("Index wrong");
        console.log("getPartialProposingIds is:",getPartialProposingIds.toString());
        var getUserProposalIdsLen = await this.democracy.getUserProposalIdsLen(owner.address);
        console.log("getUserProposalIdsLen is:",getUserProposalIdsLen.toString());
        var getPartialUserProposalIds = await this.democracy.getPartialUserProposalIds(owner.address,0,0);
        console.log("getPartialUserProposalIds is:",getPartialUserProposalIds.toString());
        await expect(this.democracy.getPartialUserProposalIds(owner.address,0,3)).to.revertedWith("Index wrong");
        var getPartialUserVotedList = await this.democracy.getPartialUserVotedList(owner.address,0,0);
        console.log("getPartialUserVotedList is:",getPartialUserVotedList.toString());
        await expect(this.democracy.getPartialUserVotedList(owner.address,0,3)).to.revertedWith("Index wrong");
        var getAllProposingIds = await this.democracy.getAllProposingIds();
        console.log("getAllProposingIds is:",getAllProposingIds.toString());
        var getAllUserProposalIds = await this.democracy.getAllUserProposalIds(owner.address);
        console.log("getAllUserProposalIds is:",getAllUserProposalIds.toString());
        var getPropInfo = await this.democracy.getPropInfo(1);
        console.log("getPropInfo is:",getPropInfo.toString());


        await this.hip.mint(bob.address,await withDecimals(10000000));
        await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
        await this.democracy.connect(bob).vote(1,await withDecimals(-voteAmount),{from:bob.address})


        var timeBlock = await time.latestBlock();
        await time.advanceTimeAndBlock(100);
        var voteResult = await this.democracy.getVoteResult(1,1);
        console.log("voteResult:",voteResult);
        console.log("start updateProposalStatus-----------------333");
        await this.democracy.updateProposalStatus(1);
        await this.democracy.modifyProposal(1,100000,100,100,5000,await withDecimals(5000));

        await this.hip.mint(bob.address,await withDecimals(10000000));
        await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
        await this.democracy.connect(bob).vote(1,await withDecimals(-voteAmount),{from:bob.address})

        var timeBlock = await time.latestBlock();
        await time.advanceTimeAndBlock(100);
        var voteResult = await this.democracy.getVoteResult(1,2);
        console.log("voteResult:",voteResult);
        console.log("start updateProposalStatus-----------------444");
        await this.democracy.updateProposalStatus(1);
        await expect(this.democracy.modifyProposal(1,100000,100,100,5000,await withDecimals(5000))).to.revertedWith("FailNum need GT 0 and LT 3");
        await this.democracy.updateProposalStatus(1);
        await this.hip.mint(bob.address,await withDecimals(10000000));
        await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
        await expect(this.democracy.connect(bob).vote(1,await withDecimals(-voteAmount),{from:bob.address})).to.revertedWith("Cannot vote when failNum >= 3");
    });

    it("test VoteResult is failed,refund",async function(){
        let voteAmount = 1000;
        let hipBalance = await this.hip.balanceOf(owner.address);
        console.log("hipBalance is:",hipBalance.toString());
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        let propState = await this.democracy.getPropState(1);
        await expect(this.democracy.refund(1,0)).to.revertedWith("Need passed vote duration");
        await this.democracy.vote(1,await withDecimals(-voteAmount));


        let proposalInfo = await this.democracy.proposals(1);

        let voteInfo = await this.democracy.votes(1,0);
        expect(voteInfo.approve).to.equal(await withDecimals(0));
        expect(voteInfo.against).to.equal(await withDecimals(voteAmount));
        expect(voteInfo.voters).to.equal(1);
        expect(voteInfo.totalLockNum).to.equal(await withDecimals(voteAmount));
        await this.hip.mint(bob.address,await withDecimals(10000000));
        await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
        this.democracy.connect(bob).vote(1,await withDecimals(voteAmount),{from:bob.address})
        let totalSupply = await this.hip.totalSupply();
        let countVote = await this.democracy.countingVote(await withDecimals(voteAmount),await withDecimals(0),totalSupply);
        expect(countVote).to.equal(true);
        this.democracy.smodify.put({
            voteDuration: 100,
        });
        let voteDuration = await this.democracy.voteDuration();
        console.log("voteDuration is:",voteDuration.toString());
        this.democracy.smodify.put({
            voteUsersNeed: 2,
        });
        let timeBlock = await time.latestTime();
        await expect(this.democracy.refund(1,0)).to.revertedWith("Need passed vote duration");
        await time.advanceTimeAndBlock(110);
        let voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(2);
        await this.democracy.updateProposalStatus(1);
        expect(await this.democracy.getPropState(1)).to.equal(4);
        await expect(this.democracy.connect(user).refund(1,0,{from:user.address})).to.revertedWith("Not exist");
        await expect(this.democracy.connect(bob).refund(1,1,{from:bob.address})).to.revertedWith("Not exist");
        await this.democracy.connect(bob).refund(1,0,{from:bob.address});
        let tx = await this.democracy.refund(1,0);
        let receipt = await tx.wait();
        let refundEvent = receipt.events.pop();
        expect(refundEvent.event).to.equal("Refund");
        expect(refundEvent.eventSignature).to.equal("Refund(address,uint256,uint256,uint256)");
        let eventContent = refundEvent.args;
        expect(eventContent[3]).to.equal(await withDecimals(voteAmount));

    });

    it("test getTargetAmount",async function(){
        let hipBalance = await this.hip.balanceOf(owner.address);
        console.log("hipBalance is:",hipBalance.toString());
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        var targetAmount = await this.democracy.getTargetAmount(5000);
        // TODO validate the targetAmount
        expect(targetAmount).to.equal(await withDecimals(20000000));
        // this.democracy.smodify.put({
        //     minTotalAmount: 100,
        // });
        // var targetAmount = await this.democracy.getTargetAmount(1);
        // expect(targetAmount).to.equal(await withDecimals(20000));
    });
    it("test setMaxDuration",async function(){
        let hipBalance = await this.hip.balanceOf(owner.address);
        console.log("hipBalance is:",hipBalance.toString());
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        await expect(this.democracy.connect(bob).setMaxDuration(100,{from:bob.address})).to.revertedWith("caller is not the owner");
        await this.democracy.setMaxDuration(100);
    });

    it("test countingVote",async function(){
        await expect(this.democracy.countingVote(0,0,0)).revertedWith("PowerSupply must > 0");
        let countingVote =await this.democracy.countingVote(0,100,1000000);
        expect(countingVote).to.equal(false);
        countingVote =await this.democracy.countingVote(100,100,1000000);
        expect(countingVote).to.equal(false);
        countingVote =await this.democracy.countingVote(100,0,1000000);
        expect(countingVote).to.equal(true);
    });

    it("test toCrowdfund",async function(){
        let voteAmount = 1000;
        this.Crowdfund = await ethers.getContractFactory("CrowdfundPools");
        let crowdFund = await this.Crowdfund.deploy();
        await crowdFund.deployed();
        await this.democracy.setCrowdfund(crowdFund.address);
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,0,5000,await withDecimals(50000));
        await this.democracy.vote(1,await withDecimals(voteAmount));
        await this.hip.mint(bob.address,await withDecimals(10000000));
        await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
        this.democracy.connect(bob).vote(1,await withDecimals(voteAmount),{from:bob.address})
        this.democracy.smodify.put({
            voteDuration: 100,
        });
        let voteDuration = await this.democracy.voteDuration();
        console.log("voteDuration is:",voteDuration.toString());
        this.democracy.smodify.put({
            voteUsersNeed: 2,
        });
        //uint _proposalId, uint _crowdfundRatio, uint _dividendRatio,uint _duration,uint _minJoinAmount,uint _maxJoinAmount,uint _hnqAmount,uint _hipAmountPerHnq
        await expect(this.democracy.toCrowdfund(1,false)).to.revertedWith("Proposal did not pass");
        let timeBlock = await time.latestBlock();
        await time.advanceTimeAndBlock(100);
        let voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(1);
        await this.democracy.updateProposalStatus(1);
        expect(await this.democracy.getPropState(1)).to.equal(3);
        await expect(this.democracy.connect(bob).toCrowdfund(1,false,{from:bob.address})).to.revertedWith("Not proposer");
        await expect(this.democracy.toCrowdfund(1,false)).to.revertedWith("Only democracy can call");

        this.pledgeToken = await this.ERC20Smart.deploy("hip token", "hip");
        await this.pledgeToken.deployed()
        await this.pledgeToken.mint(owner.address,await withDecimals(100000000));
        await this.pledgeToken.approve(crowdFund.address,await withDecimals(100000000));

        this.hnqToken = await this.ERC20Smart.deploy("hnq token", "hnq");
        await this.hnqToken.deployed()
        const startBlock = await time.latestBlock()
        const bonusTokens = [this.pledgeToken.address,this.pledgeToken.address]
        await crowdFund.initialize(
            startBlock,this.pledgeToken.address,this.pledgeToken.address,
            this.hnqToken.address, this.pledgeToken.address,this.pledgeToken.address,
            this.democracy.address, this.pledgeToken.address, bonusTokens
        );
        let isMakeCrowdfund = await this.democracy.canCrowdfund(1);
        await expect(this.democracy.canCrowdfund(0)).to.revertedWith("_proposalId need GT 0");
        expect(isMakeCrowdfund).to.equal(true);
        await this.democracy.toCrowdfund(1,false);
        // await this.democracy.toCrowdfund(1,true);

    });


    it("test toCrowdfund with mock crowdFund",async function(){
        let voteAmount = 1000;
        this.Crowdfund = await ethers.getContractFactory("CrowdfundPools");
        let crowdFund = await this.Crowdfund.deploy();
        await crowdFund.deployed();

        //add mock crowdFund
        const crowdFundMock = await smockit(crowdFund);


        await this.democracy.setCrowdfund(crowdFundMock.address);

        crowdFundMock.smocked.getCrowdfundStatus
                    .will.return.with(2);
        crowdFundMock.smocked.add
                    .will.return.with(1);

        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));
        await this.democracy.vote(1,await withDecimals(voteAmount));
        await this.hip.mint(bob.address,await withDecimals(10000000));
        await this.hip.connect(bob).approve(this.democracy.address,await withDecimals(10000000),{from:bob.address});
        this.democracy.connect(bob).vote(1,await withDecimals(voteAmount),{from:bob.address})
        this.democracy.smodify.put({
            voteDuration: 100,
        });
        let voteDuration = await this.democracy.voteDuration();
        console.log("voteDuration is:",voteDuration.toString());
        this.democracy.smodify.put({
            voteUsersNeed: 2,
        });
        //uint _proposalId, uint _crowdfundRatio, uint _dividendRatio,uint _duration,uint _minJoinAmount,uint _maxJoinAmount,uint _hnqAmount,uint _hipAmountPerHnq
        await expect(this.democracy.toCrowdfund(1,false)).to.revertedWith("Proposal did not pass");
        let timeBlock = await time.latestBlock();
        await time.advanceTimeAndBlock(100);
        let voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(1);
        await this.democracy.updateProposalStatus(1);
        expect(await this.democracy.getPropState(1)).to.equal(3);
        await this.democracy.toCrowdfund(1,false);
        await expect(this.democracy.toCrowdfund(1,false)).to.revertedWith("Cannot launch crowdfund");
        // await expect(this.democracy.connect(bob).toCrowdfund(1,10,10,10,10,10,{from:bob.address})).to.revertedWith("Not proposer");
        // await expect(this.democracy.toCrowdfund(1,10,10,10,10,10)).to.revertedWith("Only democracy can call");

        // this.pledgeToken = await this.ERC20Smart.deploy("hip token", "hip");
        // await this.pledgeToken.deployed()
        // await this.pledgeToken.mint(owner.address,await withDecimals(100000000));
        // await this.pledgeToken.approve(crowdFund.address,await withDecimals(100000000));

        // this.hnqToken = await this.ERC20Smart.deploy("hnq token", "hnq");
        // await this.hnqToken.deployed()
        // const startBlock = await time.latestBlock()
        // const bonusTokens = [this.pledgeToken.address,this.pledgeToken.address]
        // await crowdFund.initialize(
        //     startBlock,this.pledgeToken.address,this.pledgeToken.address,
        //     this.hnqToken.address, this.pledgeToken.address,this.pledgeToken.address,
        //     this.democracy.address,this.pledgeToken.address, this.pledgeToken.address, bonusTokens
        // );
        // let isMakeCrowdfund = await this.democracy.canCrowdfund(1);
        // expect(isMakeCrowdfund).to.equal(true);
        // await this.democracy.toCrowdfund(1,0,10,10,10,10);
    });

    it("test updateGlobalParams",async function(){
        //uint _voteDura,uint _voteUsersNeed,uint _uploadFeePerWork
        await expect(this.democracy.updateGlobalParams(1,1,1)).to.revertedWith("Democracy:only managers can call");
        await this.democracy.setManager(owner.address,true);
        await this.democracy.updateGlobalParams(1,1,1);
        expect(await this.democracy.voteDuration()).to.equal(1);
        expect(await this.democracy.voteUsersNeed()).to.equal(1);
        expect(await this.democracy.uploadFeePerWork()).to.equal(1);
    });
    it("test setPledgeParams",async function(){
        //uint _voteDura,uint _voteUsersNeed,uint _uploadFeePerWork
        await expect(this.democracy.setPledgeParams(1)).to.revertedWith("Democracy:only managers can call");
        await this.democracy.setManager(owner.address,true);
        await this.democracy.setPledgeParams(1);
        // expect(await this.democracy.pw()).to.equal(1);
        expect(await this.democracy.hipAmountPerHnq()).to.equal(1);
    });
    it("test setContractsAddr",async function(){
        //uint _voteDura,uint _voteUsersNeed,uint _uploadFeePerWork
        await expect(this.democracy.setContractsAddr("0x0000000000000000000000000000000000000000")).to.revertedWith("Not 0x00");
        await this.democracy.setContractsAddr(this.base.address);
        let baseAddress = await this.democracy.base();
        expect(baseAddress).to.equal(this.base.address);
    });
    it("test updateGlobalParams",async function(){
        //uint _voteDura,uint _voteUsersNeed,uint _uploadFeePerWork
        await expect(this.democracy.updateGlobalParams(1,1,1)).to.revertedWith("Democracy:only managers can call");
        await this.democracy.setManager(owner.address,true);
        await this.democracy.updateGlobalParams(1,1,1);
        expect(await this.democracy.voteDuration()).to.equal(1);
        expect(await this.democracy.voteUsersNeed()).to.equal(1);
        expect(await this.democracy.uploadFeePerWork()).to.equal(1);
    });
    it("test setManager",async function(){
        await expect(this.democracy.connect(bob).setManager(owner.address,true,{from:bob.address})).to.revertedWith("Ownable: caller is not the owner");
        await expect(this.democracy.setManager("0x0000000000000000000000000000000000000000",true)).to.revertedWith("can't set manager to address zero");
    });

    it("test setCrowdfund",async function(){
        await expect(this.democracy.connect(bob).setCrowdfund(owner.address,{from:bob.address})).to.revertedWith("Ownable: caller is not the owner");
        await expect(this.democracy.setCrowdfund("0x0000000000000000000000000000000000000000")).to.revertedWith("");
    });
    it("test getPropState",async function(){
        var state = await this.democracy.getPropState(0);
        expect(state).to.equal(0);
    });

    it("test updateProposalStatus",async function(){
        let voteAmount = 1000;
        let hipBalance = await this.hip.balanceOf(owner.address);
        await expect(this.democracy.updateProposalStatus(1)).to.revertedWith("proposalId is not existed");
        await this.hip.mint(owner.address,await withDecimals(10000000));
        await this.hip.approve(this.democracy.address,await withDecimals(10000000));
        await this.democracy.initProposal(1,100000,100,100,5000,await withDecimals(5000));

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
        await time.advanceTimeAndBlock(100);
        let voteResult = await this.democracy.getVoteResult(1,0);
        expect(voteResult).to.equal(1);
        await this.democracy.updateProposalStatus(1);
        await this.democracy.updateProposalStatus(1);
    });

})
