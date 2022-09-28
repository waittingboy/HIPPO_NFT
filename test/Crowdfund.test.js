const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const {BN} = require('@openzeppelin/test-helpers');
const { time } = require("./utilities")
const { smoddit} = require("@eth-optimism/smock");

const ONE_MINUTES = 60;
const ONE_DAY = 86400;

const _proposalId = "1"
const _proposalId02 = "2"
const _proposalId03 = "3"
const _proposalId04 = "4"
let _dividendRatio = "500000"//50%
const _duration = ONE_DAY


async function withDecimals(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(18))).toString();
}
async function withDecimals6(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(6))).toString();
}
async function withDecimals12(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(12))).toString();
}

describe("CrowdfundPools",async function() {
    this.timeout(1000000)
    let _minJoinAmount = await withDecimals("20")
    let _maxJoinAmount = await withDecimals("410000")
    //let _hnqAmount = "1100"
    let _hipAmountPerHnq = await withDecimals("100000")
    let _baseHipAmountPerHnq = await withDecimals("1000000")
    let _baseMultiCostHnq ="20";
    let _targetAmount = await withDecimals("100000000")
    let oneHip = await withDecimals("1")
    let oneHNQ = await withDecimals("1")
    const _openAmount_0 = await withDecimals("0")
    let _openAmount  = await withDecimals("50000000")

    before(async function () {
        this.signers = await ethers.getSigners()
        this.owner = this.signers[0]
        this.user = this.signers[1]
        this.alice = this.signers[2]
        this.bob = this.signers[3]
        this.alex = this.signers[18]
        this.mockMysteryBoxMarket = this.signers[4]
        this.MBGovernanceAddress = this.signers[5]
        this.mockDemocracy = this.signers[6];
        this.newBonusToken = this.signers[7];
        this.depositUser1 = this.signers[8];
        this.depositUser2 = this.signers[9];
        this.depositUser3 = this.signers[10];
        this.depositUser4 = this.signers[11];

        this.CrowdfundPools = await smoddit("CrowdfundPoolsMock");
        this.ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        this.NFTFactory = await ethers.getContractFactory("NFTFactoryMock");
        this.Base = await ethers.getContractFactory("Base");
        this.MysteryBox = await ethers.getContractFactory("MysteryBoxMock")
        this.DrawLots = await ethers.getContractFactory("DrawLots")
        this.IdProvider = await ethers.getContractFactory("IdProvider");
        this.NFTDepositBox = await ethers.getContractFactory("NFTDepositBox");
        this.VirtualBase = await ethers.getContractFactory("ExternalNftBase");
        this.MysteryBox = await ethers.getContractFactory("MysteryBoxMock");
        this.ERC721 = await ethers.getContractFactory("Token721Mock");
        this.Contract = await ethers.getContractFactory("Contract");
        this.ExternalNftBase = await ethers.getContractFactory("ExternalNftBase");
    })

    beforeEach(async function () {

        this.pledgeToken = await this.ERC20Mock.deploy("hip token", "hip");
        await this.pledgeToken.deployed()
        this.hnqToken = await this.ERC20Mock.deploy("hnq token", "hnq");
        await this.hnqToken.deployed()
        this.usdc = await this.ERC20Mock.deploy("USDC token", "USDC");
        await this.usdc.deployed()
        this.elc = await this.ERC20Mock.deploy("ELC token", "ELC");
        await this.elc.deployed()
        this.mysteryBox = await this.MysteryBox.deploy();
        await this.mysteryBox.deployed();

        this.base = await this.Base.deploy();
        await this.base.deployed()
        this.externalNftBase = await this.ExternalNftBase.deploy();
        await this.externalNftBase.deployed()

        //ExternalNftBase

        this.nftFactory = await this.NFTFactory.deploy();
        this.nftFactory.deployed();

        this.drawLots = await this.DrawLots.deploy()
        await this.drawLots.deployed()
        //initialize
        await this.drawLots.initialize()

        this.crowdfundPools = await this.CrowdfundPools.deploy();
        this.crowdfundPools_setStartBlockDiff = await this.CrowdfundPools.deploy();
        await this.crowdfundPools.deployed();
        const startBlock = await time.latestBlock()
        const startBlock_diff =BigNumber.from(startBlock).add(10000)
        const bonusTokens = [this.usdc.address,this.elc.address]
        await this.crowdfundPools.initialize(
          startBlock,this.pledgeToken.address,this.mockMysteryBoxMarket.address,
          this.hnqToken.address, this.nftFactory.address,this.base.address,
          this.mockDemocracy.address,this.drawLots.address, bonusTokens,this.externalNftBase.address
        );
        await this.crowdfundPools_setStartBlockDiff.initialize(
          startBlock_diff,this.pledgeToken.address,this.mockMysteryBoxMarket.address,
          this.hnqToken.address, this.nftFactory.address,this.base.address,
          this.mockDemocracy.address,this.drawLots.address, bonusTokens,this.externalNftBase.address
        );

        this.UserToken = await ethers.getContractFactory("UserTokens");
        this.usertoken = await this.UserToken.deploy();
        await this.usertoken.deployed();
        await this.usertoken.initialize(this.nftFactory.address);
        await this.usertoken.setInternalCaller(this.nftFactory.address,true)

        this.ctrt = await this.Contract.deploy();
        await this.ctrt.deployed();

        this.token721 = await this.ERC721.deploy();
        await this.token721.deployed();

        await this.usertoken.initialize(
          this.nftFactory.address,
          this.ctrt.address,
          this.nftFactory.address,
          this.nftFactory.address,
          this.nftFactory.address)
        await this.usertoken.setInternalCaller(this.nftFactory.address, true);

        await this.nftFactory.initialize(this.usertoken.address,this.crowdfundPools.address);

        //this.MysteryBox
        this.mysteryBox = await this.MysteryBox.deploy();
        await this.mysteryBox.deployed();

        this.nftDepositBox = await this.NFTDepositBox.deploy();
        await this.nftDepositBox.deployed();

        this.idProvider = await this.IdProvider.deploy();
        await this.idProvider.deployed();

        await this.externalNftBase.initialize(
          this.mysteryBox.address, this.mockDemocracy.address,
          this.idProvider.address, this.nftDepositBox.address,this.crowdfundPools.address
        );

        await this.idProvider.initialize(this.base.address,this.externalNftBase.address);
        await this.idProvider.setInternalCaller(this.base.address,true);
        await this.idProvider.setInternalCaller(this.externalNftBase.address,true);

    })

    it("addBonusToken func", async function () {
        expect(await this.crowdfundPools.isBonusToken(this.newBonusToken.address)).to.be.equal(false)
        await this.crowdfundPools.connect(this.mockMysteryBoxMarket).addBonusToken(this.newBonusToken.address)
        expect(await this.crowdfundPools.isBonusToken(this.newBonusToken.address)).to.be.equal(true)
        await this.crowdfundPools.connect(this.mockMysteryBoxMarket).addBonusToken(this.newBonusToken.address)

    })

    it("setGlobalParams func", async function () {

        let newMinTotalAmount = await withDecimals(8000000);
        let newHipAmountPerHnq = await withDecimals(200000);

        expect(await this.crowdfundPools.minTotalAmount()).to.be.equal(await withDecimals(1000000))
        expect(await this.crowdfundPools.hipAmountPerHnq()).to.be.equal(await withDecimals(100000))

        await this.crowdfundPools.setGlobalParam(newMinTotalAmount,newHipAmountPerHnq)

        expect(await this.crowdfundPools.minTotalAmount()).to.be.equal(newMinTotalAmount)
        expect(await this.crowdfundPools.hipAmountPerHnq()).to.be.equal(newHipAmountPerHnq)
    })

    it("setManager func", async function() {
        let eptBool = await this.crowdfundPools.isManager(this.user.address)
        expect(eptBool).to.be.equal(false)

        await this.crowdfundPools.setManager(this.user.address, true);
        eptBool = await this.crowdfundPools.isManager(this.user.address)
        expect(eptBool).to.be.equal(true)
    });

    describe("add func", function () {

        it("when open amount == 0", async function () {
            const _proposer = this.owner.address
            let _dividendrate_large = BigNumber.from(1000000).add(1)
            let _duration_exceeds = BigNumber.from(86400).mul(30).add(1)
            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await expect(this.crowdfundPools.add(_proposalId,_proposer,_openAmount_0,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)).to.be.revertedWith("Only democracy can call")

            await expect(this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount_0,
              _dividendrate_large,_duration,_maxJoinAmount,_targetAmount)).to.be.revertedWith("Ratio too large")

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount_0,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            let poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            expect(poolInfo.proposalId.toString()).to.be.equal(_proposalId)
            expect(poolInfo.proposer.toString()).to.be.equal(_proposer)
            expect(poolInfo.openAmount.toString()).to.be.equal(_openAmount_0)
            expect(poolInfo.dividendRatio.toString()).to.be.equal(_dividendRatio)
            expect(poolInfo.duration.toString()).to.be.equal("0")
            expect(poolInfo.maxJoinAmount.toString()).to.be.equal(_maxJoinAmount)
            expect(poolInfo.targetTotalAmount.toString()).to.be.equal(_targetAmount)
            expect(poolInfo.curPledgeTotalAmount.toString()).to.be.equal(_targetAmount)

            let needHnqAmount = await this.crowdfundPools.needHnqAmount(await this.crowdfundPools.poolId())
            expect(needHnqAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ))

            let user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),_proposer)
            expect(user.amount.toString()).to.be.equal(_targetAmount)
            expect(user.wonAmount.toString()).to.be.equal(_targetAmount)
        })

        it("when open amount > 0", async function () {
            const _proposer = this.owner.address
            const initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await expect(this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,BigNumber.from(_targetAmount).add(1),
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)).to.be.revertedWith("The amount of open crowdfund need LT _targetAmount")

            await expect(this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,BigNumber.from(_baseHipAmountPerHnq).div(2),
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)).to.be.revertedWith("OpenAmount needs to be divisible by hipAmountPerHnq")

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            let poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            expect(poolInfo.proposalId.toString()).to.be.equal(_proposalId)
            expect(poolInfo.proposer.toString()).to.be.equal(_proposer)
            expect(poolInfo.openAmount.toString()).to.be.equal(_openAmount )
            expect(poolInfo.dividendRatio.toString()).to.be.equal(_dividendRatio)
            expect(poolInfo.duration.toNumber()).to.be.equal(_duration)
            expect(await this.crowdfundPools.minJoinAmount()).to.be.equal(_minJoinAmount)
            expect(poolInfo.maxJoinAmount.toString()).to.be.equal(_maxJoinAmount)
            expect(poolInfo.targetTotalAmount.toString()).to.be.equal(_targetAmount)
            expect(poolInfo.curPledgeTotalAmount.toString()).to.be.equal(initAmount)

            let needHnqAmount = await this.crowdfundPools.needHnqAmount(await this.crowdfundPools.poolId())
            expect(needHnqAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ))

            let user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),_proposer)
            expect(user.amount.toString()).to.be.equal(initAmount)
            expect(user.wonAmount.toString()).to.be.equal(initAmount)
        })
        it("when open amount == _targetAmount", async function () {
            _dividendRatio = BigNumber.from("800000");
            _maxJoinAmount = BigNumber.from(await withDecimals("2850000"));
            let _targetAmount = BigNumber.from(_baseHipAmountPerHnq).mul(3);
            const _proposer = this.owner.address
            _openAmount = _targetAmount;
            const initAmount = BigNumber.from(_targetAmount).sub(_openAmount )

            await this.pledgeToken.mint(this.owner.address,initAmount)
            //await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            //await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await expect(this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,BigNumber.from(_targetAmount).add("100"),
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)).to.be.revertedWith("The amount of open crowdfund need LT _targetAmount")

            await expect(this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,BigNumber.from(_baseHipAmountPerHnq).div(2),
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)).to.be.revertedWith("OpenAmount needs to be divisible by hipAmountPerHnq")

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            let poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            expect(poolInfo.proposalId.toString()).to.be.equal(_proposalId)
            expect(poolInfo.proposer.toString()).to.be.equal(_proposer)
            expect(poolInfo.openAmount.toString()).to.be.equal(_openAmount )
            expect(poolInfo.dividendRatio.toString()).to.be.equal(_dividendRatio)
            expect(poolInfo.duration.toNumber()).to.be.equal(_duration)
            expect(await this.crowdfundPools.minJoinAmount()).to.be.equal(_minJoinAmount)
            expect(poolInfo.maxJoinAmount.toString()).to.be.equal(_maxJoinAmount)
            expect(poolInfo.targetTotalAmount.toString()).to.be.equal(_targetAmount)
            expect(poolInfo.curPledgeTotalAmount.toString()).to.be.equal(initAmount)

            let needHnqAmount = await this.crowdfundPools.needHnqAmount(await this.crowdfundPools.poolId())
            expect(needHnqAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ))

            let user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),_proposer)
            expect(user.amount.toString()).to.be.equal(initAmount)
            expect(user.wonAmount.toString()).to.be.equal(initAmount)
        })
    })

    it("poolingBonusToPools func", async function () {
        const _proposer = this.user.address
        const _proposer02 = this.alice.address
        const _proposer03 = this.bob.address
        const _proposer04 = this.alex.address
        //pool01
        await this.pledgeToken.mint(_proposer,_targetAmount)
        await this.pledgeToken.connect(this.user).approve(this.crowdfundPools.address,_targetAmount)
        let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(_baseMultiCostHnq)
        await this.hnqToken.mint(_proposer,payHnqAmount)
        await this.hnqToken.connect(this.user).approve(this.crowdfundPools.address,payHnqAmount)
        await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount_0,
          _dividendRatio,_duration,_maxJoinAmount,_targetAmount
        )
        //pool02
        const initAmount = BigNumber.from(_targetAmount).sub(_openAmount)
        await this.pledgeToken.mint(_proposer02,initAmount)
        await this.pledgeToken.connect(this.alice).approve(this.crowdfundPools.address,initAmount)
        payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
        await this.hnqToken.mint(_proposer02,payHnqAmount)
        await this.hnqToken.connect(this.alice).approve(this.crowdfundPools.address,payHnqAmount)
        await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId02,_proposer02,_openAmount ,
          _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
        //pool03
        await this.pledgeToken.mint(_proposer03,initAmount)
        await this.pledgeToken.connect(this.bob).approve(this.crowdfundPools.address,initAmount)
        payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
        await this.hnqToken.mint(_proposer03,payHnqAmount)
        await this.hnqToken.connect(this.bob).approve(this.crowdfundPools.address,payHnqAmount)
        await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId03,_proposer03,_openAmount ,
          _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

        //pool04
        await this.pledgeToken.mint(_proposer04,initAmount)
        await this.pledgeToken.connect(this.alex).approve(this.crowdfundPools.address,initAmount)
        payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
        await this.hnqToken.mint(_proposer04,payHnqAmount)
        await this.hnqToken.connect(this.alex).approve(this.crowdfundPools.address,payHnqAmount)
        await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId04,_proposer04,_openAmount ,
          _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

        let mockedWorkId = BigNumber.from("10");
        const mockedPoolId01 = BigNumber.from("1");
        const mockedPoolId02 = BigNumber.from("2");
        const mockedPoolId03 = BigNumber.from("3");
        const mockedPoolId04 = BigNumber.from("4");

        expect(await this.crowdfundPools.workId2PoolId(mockedWorkId)).to.be.equal("0")
        let workIds = [];
        for (let i =1;i<=150;i++) {
            mockedWorkId = BigNumber.from(i);
            if(i<= 50 ) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId01}});
            if(i >50 && i<= 100 ) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId02}});
            if(i >100 && i<= 120 ) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId03}});
            if(i >120) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId04}});
            workIds.push(i)
        }

        let totalBonusAmount = await withDecimals("15000")
        await this.usdc.mint(this.mockMysteryBoxMarket.address,totalBonusAmount)
        await this.usdc.connect(this.mockMysteryBoxMarket).approve(this.crowdfundPools.address,totalBonusAmount)
        await this.crowdfundPools.connect(this.mockMysteryBoxMarket).poolingBonusToPools(workIds,this.usdc.address, totalBonusAmount)
        //await this.usdc.balanceOf(this.mockMysteryBoxMarket.address)
        expect(await this.usdc.balanceOf(this.mockMysteryBoxMarket.address)).to.be.equal("0")
        expect(await this.usdc.balanceOf(_proposer)).to.be.equal(BigNumber.from(totalBonusAmount).div(3))
        expect(await this.usdc.balanceOf(_proposer02)).to.be.equal(BigNumber.from(totalBonusAmount).div(3).mul(initAmount).div(_targetAmount))
        expect(await this.usdc.balanceOf(this.crowdfundPools.address)).to.be.equal(BigNumber.from(totalBonusAmount).div(3))


    })

    it("poolingBonusToPools func when _openAmount < _targetAmount", async function () {
      const _proposer = this.user.address
      const _proposer02 = this.alice.address
      const _proposer03 = this.bob.address
      const _proposer04 = this.alex.address

      _openAmount  = await withDecimals("10000000") // 10000 0000
      _targetAmount = await withDecimals("100000000")// 10000 0000

      //pool01
      await this.pledgeToken.mint(_proposer,_targetAmount)
      await this.pledgeToken.connect(this.user).approve(this.crowdfundPools.address,_targetAmount)
      let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
      await this.hnqToken.mint(_proposer,payHnqAmount)
      await this.hnqToken.connect(this.user).approve(this.crowdfundPools.address,payHnqAmount)
      await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount,
        _dividendRatio,_duration,_maxJoinAmount,_targetAmount
      )
      //pool02
      const initAmount = BigNumber.from(_targetAmount).sub(_openAmount)
      await this.pledgeToken.mint(_proposer02,initAmount)
      await this.pledgeToken.connect(this.alice).approve(this.crowdfundPools.address,initAmount)
      payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
      await this.hnqToken.mint(_proposer02,payHnqAmount)
      await this.hnqToken.connect(this.alice).approve(this.crowdfundPools.address,payHnqAmount)
      await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId02,_proposer02,_openAmount ,
        _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
      //pool03
      await this.pledgeToken.mint(_proposer03,initAmount)
      await this.pledgeToken.connect(this.bob).approve(this.crowdfundPools.address,initAmount)
      payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
      await this.hnqToken.mint(_proposer03,payHnqAmount)
      await this.hnqToken.connect(this.bob).approve(this.crowdfundPools.address,payHnqAmount)
      await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId03,_proposer03,_openAmount ,
        _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

      //pool04
      await this.pledgeToken.mint(_proposer04,initAmount)
      await this.pledgeToken.connect(this.alex).approve(this.crowdfundPools.address,initAmount)
      payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
      await this.hnqToken.mint(_proposer04,payHnqAmount)
      await this.hnqToken.connect(this.alex).approve(this.crowdfundPools.address,payHnqAmount)
      await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId04,_proposer04,_openAmount ,
        _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

      let mockedWorkId = BigNumber.from("10");
      const mockedPoolId01 = BigNumber.from("1");
      const mockedPoolId02 = BigNumber.from("2");
      const mockedPoolId03 = BigNumber.from("3");
      const mockedPoolId04 = BigNumber.from("4");

      expect(await this.crowdfundPools.workId2PoolId(mockedWorkId)).to.be.equal("0")
      let workIds = [];
      for (let i =1;i<=200;i++) {
          mockedWorkId = BigNumber.from(i);
          if(i<= 50 ) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId01}});
          if(i >50 && i<= 100 ) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId02}});
          if(i >100 && i<= 150 ) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId03}});
          if(i >150) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId04}});
          workIds.push(i)
      }
      //分红比例都是50%，总分红15000，总购买次数 150次
      // pool01 -[1,50],openAmount ==0,50盲盒，分配数额 50/200 * 20000 = 20000 / 4 => proposer分 1/2
      // pool02 -[51,100],_openAmount,50盲盒，分配数额 50/200 * 20000 = 20000 / 4,proposer分50%
      // pool03 -[101,150],_openAmount,20盲盒，分配数额 502050 * 20000 = 20000 / 4 
      // pool04 -[150,200],_openAmount,30盲盒，分配数额 50/200 * 20000 = 20000 / 5

      let totalBonusAmount = await withDecimals("20000")
      await this.usdc.mint(this.mockMysteryBoxMarket.address,totalBonusAmount)
      await this.usdc.connect(this.mockMysteryBoxMarket).approve(this.crowdfundPools.address,totalBonusAmount)
      await this.crowdfundPools.connect(this.mockMysteryBoxMarket).poolingBonusToPools(workIds,this.usdc.address, totalBonusAmount)
      await this.usdc.balanceOf(this.mockMysteryBoxMarket.address)
      expect(await this.usdc.balanceOf(this.crowdfundPools.address)).to.be.equal(BigNumber.from(totalBonusAmount).div(2))
      expect(await this.usdc.balanceOf(this.mockMysteryBoxMarket.address)).to.be.equal("0")
      expect(await this.usdc.balanceOf(_proposer)).to.be.equal(BigNumber.from(totalBonusAmount).div(8))
      expect(await this.usdc.balanceOf(_proposer02)).to.be.equal(BigNumber.from(totalBonusAmount).div(8))

      // check getAccBonusesPerShares
      let getAccBonusesPerShares01 = await this.crowdfundPools.getAccBonusesPerShares("1");
      console.log(getAccBonusesPerShares01[0].toString())
      expect(getAccBonusesPerShares01[0]).to.equal(BigNumber.from(totalBonusAmount).div(4).div(2).mul(await withDecimals12(1)).div(_openAmount))

      let getAccBonusesPerShares03 =await this.crowdfundPools.getAccBonusesPerShares("3");
      console.log(getAccBonusesPerShares03[0].toString())
      expect(getAccBonusesPerShares03[0]).to.equal(BigNumber.from(totalBonusAmount).div(4).div(2).mul(await withDecimals12(1)).div(_openAmount))
  
    })

    it("poolingBonusToPools func when _openAmount == _targetAmount", async function () {
      const _proposer = this.user.address
      const _proposer02 = this.alice.address
      const _proposer03 = this.bob.address
      const _proposer04 = this.alex.address

      _openAmount  = await withDecimals("100000000") // 10000 0000
      _targetAmount = await withDecimals("100000000")// 10000 0000
      _dividendRatio = "500000";

      //pool01
      await this.pledgeToken.mint(_proposer,_targetAmount)
      await this.pledgeToken.connect(this.user).approve(this.crowdfundPools.address,_targetAmount)
      let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
      await this.hnqToken.mint(_proposer,payHnqAmount)
      await this.hnqToken.connect(this.user).approve(this.crowdfundPools.address,payHnqAmount)
      await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount,
        _dividendRatio,_duration,_maxJoinAmount,_targetAmount
      )

      const _amountHnq = await withDecimals("200")
      _targetAmount = await withDecimals("100000000")
      const _depositAmount = BigNumber.from(_baseHipAmountPerHnq).mul(_amountHnq).div(oneHNQ).div(_baseMultiCostHnq);

      //depositUser1
      await this.pledgeToken.mint(this.depositUser1.address,_depositAmount)
      await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_depositAmount)
      await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
      await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)

      let _curPoolId = await this.crowdfundPools.poolId()
      await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)

      let mockedWorkId = BigNumber.from("10");
      const mockedPoolId01 = BigNumber.from("1");
      const mockedPoolId02 = BigNumber.from("2");
      const mockedPoolId03 = BigNumber.from("3");
      const mockedPoolId04 = BigNumber.from("4");

      expect(await this.crowdfundPools.workId2PoolId(mockedWorkId)).to.be.equal("0")
      let workIds = [];
      for (let i =1;i<=100;i++) {
          mockedWorkId = BigNumber.from(i);
          if(i<= 100 ) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId01}});
          workIds.push(i)
      }
      //分红比例都是50%，总分红20000，总购买次数 100次
      // pool01 -[1,100],openAmount == tar,100盲盒，分配数额 100/100 * 20000 = 20000 => proposer分50%

      // pooling one
      let totalBonusAmount01 = await withDecimals("20000")
      await this.usdc.mint(this.mockMysteryBoxMarket.address,totalBonusAmount01)
      await this.usdc.connect(this.mockMysteryBoxMarket).approve(this.crowdfundPools.address,totalBonusAmount01)
      await this.crowdfundPools.connect(this.mockMysteryBoxMarket).poolingBonusToPools(workIds,this.usdc.address, totalBonusAmount01)
      
      expect(await this.usdc.balanceOf(this.crowdfundPools.address)).to.be.equal(BigNumber.from(totalBonusAmount01).div(2))
      expect(await this.usdc.balanceOf(this.mockMysteryBoxMarket.address)).to.be.equal("0")
      expect(await this.usdc.balanceOf(_proposer)).to.be.equal(BigNumber.from(totalBonusAmount01).div(2))

      // check getAccBonusesPerShares
      let getAccBonusesPerShares01 = await this.crowdfundPools.getAccBonusesPerShares("1");
      console.log("getAccBonusesPerShares01[0]",getAccBonusesPerShares01[0].toString())
      expect(getAccBonusesPerShares01[0]).to.equal(BigNumber.from(totalBonusAmount01).div(2).mul(await withDecimals12(1)).div(_openAmount));

      // pooling two
      let totalBonusAmount02 = await withDecimals("10000")
      await this.usdc.mint(this.mockMysteryBoxMarket.address,totalBonusAmount02)
      await this.usdc.connect(this.mockMysteryBoxMarket).approve(this.crowdfundPools.address,totalBonusAmount02)
      await this.crowdfundPools.connect(this.mockMysteryBoxMarket).poolingBonusToPools(workIds,this.usdc.address, totalBonusAmount02)

      getAccBonusesPerShares01 = await this.crowdfundPools.getAccBonusesPerShares("1");
      console.log("getAccBonusesPerShares01[0]",getAccBonusesPerShares01[0].toString())
      expect(getAccBonusesPerShares01[0]).to.equal(BigNumber.from(totalBonusAmount01).add(totalBonusAmount02).div(2).mul(await withDecimals12(1)).div(_openAmount));
    
    })

    describe("updatePool func", async function () {
        beforeEach(async function () {
            const _proposer = this.user.address
            await this.pledgeToken.mint(_proposer,_targetAmount)
            await this.pledgeToken.connect(this.user).approve(this.crowdfundPools.address,_targetAmount)
            let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.user).approve(this.crowdfundPools.address,payHnqAmount)

        })

        it("when bonusReward == 0", async function () {
            let _bonusAmount = await withDecimals("10000")
            let ZERO = "0"
            await this.usdc.mint(this.owner.address,_bonusAmount)
            await this.usdc.approve(this.crowdfundPools.address,_bonusAmount)
            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,this.user.address,_openAmount_0,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount
            )

            await this.crowdfundPools.updatePool_public(_proposalId,this.usdc.address, ZERO)
            expect(await this.usdc.balanceOf(this.user.address)).to.be.equal(ZERO)
            await this.crowdfundPools.updatePool_public(_proposalId,this.usdc.address, _bonusAmount)
            expect(await this.usdc.balanceOf(this.user.address)).to.be.equal(_bonusAmount)

        })

        it("when curPledgeTotalAmount > 0 and bonusReward > 0", async function () {
            const _proposer = this.user.address
            const initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            let _bonusAmount = await withDecimals("10000")
            await this.usdc.mint(this.owner.address,_bonusAmount)
            await this.usdc.approve(this.crowdfundPools.address,_bonusAmount)
            await this.crowdfundPools.updatePool_public(_proposalId,this.usdc.address, _bonusAmount)
            expect(await this.usdc.balanceOf(_proposer)).to.be.equal(BigNumber.from(_bonusAmount).div(2))
            let _curPoolId01 = await this.crowdfundPools.poolId()
            let accBonusesPerShares = await this.crowdfundPools.getAccBonusesPerShares(_curPoolId01)
            expect(BigNumber.from(accBonusesPerShares[0]).gt("0")).to.be.equal(true)
            expect(accBonusesPerShares[1]).to.be.equal("0")

        })

        it("when curPledgeTotalAmount ==0 and bonusReward > 0", async function () {
            const _proposer = this.user.address
            const initAmount = BigNumber.from(_targetAmount).sub(_targetAmount)
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_targetAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            let _bonusAmount = await withDecimals("10000")
            await this.usdc.mint(this.owner.address,_bonusAmount)
            await this.usdc.approve(this.crowdfundPools.address,_bonusAmount)
            await this.crowdfundPools.updatePool_public(_proposalId,this.usdc.address, _bonusAmount)
            expect(await this.usdc.balanceOf(_proposer)).to.be.equal(BigNumber.from(_bonusAmount).div(2))
            let _curPoolId01 = await this.crowdfundPools.poolId()
            let accBonusesPerShares = await this.crowdfundPools.getAccBonusesPerShares(_curPoolId01)
            expect(accBonusesPerShares[0]).to.be.equal("0")
            expect(accBonusesPerShares[1]).to.be.equal("0")

            await this.crowdfundPools_setStartBlockDiff.connect(this.mockDemocracy).add(_proposalId,_proposer,_targetAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            await this.usdc.mint(this.owner.address,_bonusAmount)
            await this.usdc.approve(this.crowdfundPools_setStartBlockDiff.address,_bonusAmount)
            await this.crowdfundPools_setStartBlockDiff.updatePool_public(_proposalId,this.usdc.address, _bonusAmount)
            expect(await this.usdc.balanceOf(_proposer)).to.be.equal(BigNumber.from(_bonusAmount))
            let _curPoolId01_diff = await this.crowdfundPools_setStartBlockDiff.poolId()
            let accBonusesPerShares_diff = await this.crowdfundPools_setStartBlockDiff.getAccBonusesPerShares(_curPoolId01_diff)
            expect(accBonusesPerShares_diff[0]).to.be.equal("0")
            expect(accBonusesPerShares_diff[1]).to.be.equal("0")

        })

    })

    describe("deposit func", async function (){
        it("when open amount == 0", async function () {
            const _proposer = this.owner.address;
            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await this.crowdfundPools.connect(this.mockDemocracy).add(
              _proposalId,_proposer,_openAmount_0, _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            const _amountHnq = await withDecimals("100")
            await expect(this.crowdfundPools.connect(this.owner).deposit(_proposalId,_amountHnq))
              .to.be.revertedWith('Already joined')
            await expect(this.crowdfundPools.connect(this.alice).deposit(_proposalId,_amountHnq))
              .to.be.revertedWith('This pool does not need crowdfund')

        })

        it("when open amount > 0", async function () {
            const _proposer = this.owner.address
            let _amountHnq = await withDecimals("1258")
            let baseMultiCostHnq = await this.crowdfundPools.baseMultiCostHnq()
            let baseCostHnqAmount = BigNumber.from(baseMultiCostHnq).mul(oneHNQ)
            _amountHnq = BigNumber.from(_amountHnq).div(baseCostHnqAmount).mul(baseCostHnqAmount)
            const _depositAmount = BigNumber.from(_baseHipAmountPerHnq).mul(_amountHnq).div(oneHNQ)
            const initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            await expect(this.crowdfundPools.connect(this.owner).deposit(_proposalId,_amountHnq))
              .to.be.revertedWith('Already joined')//=="Not proposer"
            await expect(this.crowdfundPools.connect(this.user).deposit(
              _proposalId,BigNumber.from(_minJoinAmount).sub(oneHNQ)))
              .to.be.revertedWith('_amountHnq need GT minJoinAmount')
            await expect(this.crowdfundPools.connect(this.user).deposit(
              _proposalId,BigNumber.from(_maxJoinAmount).add(oneHNQ)))
              .to.be.revertedWith('_amountHnq need LT maxJoinAmount')

            //depositUser1
            await this.pledgeToken.mint(this.depositUser1.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)

            let poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            let _curPoolId = await this.crowdfundPools.poolId()
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)
            let user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
            let curPledgeTotalAmount = poolInfo.curPledgeTotalAmount;
          
            console.log("userInfo:",user.toString())
            expect(user.amount).to.be.equal(BigNumber.from(_depositAmount).div(baseMultiCostHnq));
            //user.startIndexHNQ = (pool.curPledgeTotalAmount - proposerDepositAmount)/pool.hipAmountPerHNQ + 1;
            expect(user.startIndexHNQ).to.be.equal(
              BigNumber.from(curPledgeTotalAmount).sub(initAmount).div(_baseHipAmountPerHnq).add("1")
            )
            //user.endIndexHNQ = user.startIndexHNQ + _amountHnq - 1;
            expect(user.endIndexHNQ.toString()).to.be.equal(BigNumber.from(user.startIndexHNQ).add(BigNumber.from(_amountHnq).div(baseMultiCostHnq).div(oneHNQ)).sub("1"))

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)

            poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)
            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser2.address)
            curPledgeTotalAmount = poolInfo.curPledgeTotalAmount;
            console.log(user.toString())
            console.log("curPledgeTotalAmount",poolInfo.curPledgeTotalAmount.toString())
            console.log("targetTotalAmount",poolInfo.targetTotalAmount.toString())

            expect(user.amount).to.be.equal(BigNumber.from(_depositAmount).div(baseMultiCostHnq))
            //user.startIndexHNQ = (pool.curPledgeTotalAmount - proposerDepositAmount)/pool.hipAmountPerHNQ + 1;
            expect(user.startIndexHNQ).to.be.equal(
              BigNumber.from(curPledgeTotalAmount).sub(initAmount).div(_baseHipAmountPerHnq).add("1")
            )
            //user.endIndexHNQ = user.startIndexHNQ + _amountHnq - 1;
            expect(user.endIndexHNQ.toString()).to.be.equal(BigNumber.from(user.startIndexHNQ).add(BigNumber.from(_amountHnq).div(baseMultiCostHnq).div(oneHNQ)).sub("1"))

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)

            poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)
            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser3.address)
            curPledgeTotalAmount = poolInfo.curPledgeTotalAmount;
            console.log(user.toString())
            expect(user.amount).to.be.equal(BigNumber.from(_depositAmount).div(baseMultiCostHnq))
            //user.startIndexHNQ = (pool.curPledgeTotalAmount - proposerDepositAmount)/pool.hipAmountPerHNQ + 1;
            expect(user.startIndexHNQ).to.be.equal(
              BigNumber.from(curPledgeTotalAmount).sub(initAmount).div(_baseHipAmountPerHnq).add("1")
            )
            //user.endIndexHNQ = user.startIndexHNQ + _amountHnq - 1;
            expect(user.endIndexHNQ.toString()).to.be.equal(BigNumber.from(user.startIndexHNQ).add(BigNumber.from(_amountHnq).div(baseMultiCostHnq).div(oneHNQ)).sub("1"))

            //exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            await expect(this.crowdfundPools.connect(this.user).deposit(
              _proposalId,BigNumber.from(_minJoinAmount).div(_baseHipAmountPerHnq)))
              .to.be.revertedWith('Cannot deposit now')


        })

        it("when open amount == target amount", async function () {
            const _proposer = this.owner.address
            let _amountHnq = await withDecimals("1221")
            let baseMultiCostHnq = await this.crowdfundPools.baseMultiCostHnq()
            let baseCostHnqAmount = BigNumber.from(baseMultiCostHnq).mul(oneHNQ)
            _amountHnq = BigNumber.from(_amountHnq).div(baseCostHnqAmount).mul(baseCostHnqAmount)
            _targetAmount = await withDecimals("100000000")
            _openAmount = _targetAmount
            const _depositAmount = BigNumber.from(_baseHipAmountPerHnq).mul(_amountHnq).div(oneHNQ)
            const initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            await expect(this.crowdfundPools.connect(this.owner).deposit(_proposalId,_amountHnq))
              .to.be.revertedWith('Not proposer')//=="Already joined"
            await expect(this.crowdfundPools.connect(this.user).deposit(
              _proposalId,BigNumber.from(_minJoinAmount).sub(oneHNQ)))
              .to.be.revertedWith('_amountHnq need GT minJoinAmount')
            await expect(this.crowdfundPools.connect(this.user).deposit(
              _proposalId,BigNumber.from(_maxJoinAmount).add(oneHNQ)))
              .to.be.revertedWith('_amountHnq need LT maxJoinAmount')

            //depositUser1
            await this.pledgeToken.mint(this.depositUser1.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)

            let poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            let _curPoolId = await this.crowdfundPools.poolId()
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)
            let user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
            let curPledgeTotalAmount = poolInfo.curPledgeTotalAmount;
            console.log("userInfo:",user.toString())
            expect(user.amount).to.be.equal(BigNumber.from(_depositAmount).div(baseMultiCostHnq));
            //user.startIndexHNQ = (pool.curPledgeTotalAmount - proposerDepositAmount)/pool.hipAmountPerHNQ + 1;
            expect(user.startIndexHNQ).to.be.equal(
              BigNumber.from(curPledgeTotalAmount).sub(initAmount).div(_baseHipAmountPerHnq).add("1")
            )
            //user.endIndexHNQ = user.startIndexHNQ + _amountHnq - 1;
            expect(user.endIndexHNQ.toString()).to.be.equal(BigNumber.from(user.startIndexHNQ).add(BigNumber.from(_amountHnq).div(baseMultiCostHnq).div(oneHNQ)).sub("1"))

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)

            poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)
            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser2.address)
            curPledgeTotalAmount = poolInfo.curPledgeTotalAmount;
            console.log(user.toString())
            console.log("curPledgeTotalAmount",poolInfo.curPledgeTotalAmount.toString())
            console.log("targetTotalAmount",poolInfo.targetTotalAmount.toString())

            expect(user.amount).to.be.equal(BigNumber.from(_depositAmount).div(baseMultiCostHnq))
            //user.startIndexHNQ = (pool.curPledgeTotalAmount - proposerDepositAmount)/pool.hipAmountPerHNQ + 1;
            expect(user.startIndexHNQ).to.be.equal(
              BigNumber.from(curPledgeTotalAmount).sub(initAmount).div(_baseHipAmountPerHnq).add("1")
            )
            //user.endIndexHNQ = user.startIndexHNQ + _amountHnq - 1;
            expect(user.endIndexHNQ.toString()).to.be.equal(BigNumber.from(user.startIndexHNQ).add(BigNumber.from(_amountHnq).div(baseMultiCostHnq).div(oneHNQ)).sub("1"))

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)

            poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)
            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser3.address)
            curPledgeTotalAmount = poolInfo.curPledgeTotalAmount;
            console.log(user.toString())
            expect(user.amount).to.be.equal(BigNumber.from(_depositAmount).div(baseMultiCostHnq))
            //user.startIndexHNQ = (pool.curPledgeTotalAmount - proposerDepositAmount)/pool.hipAmountPerHNQ + 1;
            expect(user.startIndexHNQ).to.be.equal(
              BigNumber.from(curPledgeTotalAmount).sub(initAmount).div(_baseHipAmountPerHnq).add("1")
            )
            //user.endIndexHNQ = user.startIndexHNQ + _amountHnq - 1;
            expect(user.endIndexHNQ.toString()).to.be.equal(BigNumber.from(user.startIndexHNQ).add(BigNumber.from(_amountHnq).div(baseMultiCostHnq).div(oneHNQ)).sub("1"))

            //exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            await expect(this.crowdfundPools.connect(this.user).deposit(
              _proposalId,BigNumber.from(_minJoinAmount).div(_baseHipAmountPerHnq)))
              .to.be.revertedWith('Cannot deposit now')


        })
    })

    //function drawLots(uint _pid,uint _salt) public
    describe("drawLots func", async function (){
        this.timeout(4000000)
        it("when winningRate <= 0.5", async function () {
            let _proposer = this.owner.address.toString()
            //_targetAmount = BigNumber.from(_targetAmount).mul(10)
            let _targetAmount02 = await withDecimals("100000000")
            let _openAmount02 = await withDecimals("100000000")//10*baseHipAmountPerHnq
            let initAmount = BigNumber.from(_targetAmount).sub(_openAmount02)
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount02 ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount02)

            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount02 ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount02)
            let _curPoolId = await this.crowdfundPools.poolId()//poolId ==2

            // branch 02 : on duration
            //depositUser1
            let _amountHnq = BigNumber.from(_targetAmount02).div(_baseHipAmountPerHnq).mul(10).mul(oneHNQ)
            await this.pledgeToken.mint(this.depositUser1.address,BigNumber.from(_amountHnq).mul(_targetAmount02).mul(20))
            //await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,BigNumber.from(_targetAmount02).mul(20))
            await this.hnqToken.mint(this.depositUser1.address,BigNumber.from(_amountHnq).mul(20))
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).mul(20))
            //await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,BigNumber.from(_amountHnq).mul(20))

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_targetAmount02)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount02)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_targetAmount02)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_targetAmount02)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)

            //depositUser4 //deposit 10,000,000
            await this.pledgeToken.mint(this.depositUser4.address,BigNumber.from(_targetAmount02).div(10))
            await this.pledgeToken.connect(this.depositUser4).approve(this.crowdfundPools.address,BigNumber.from(_targetAmount02).div(10))
            await this.hnqToken.mint(this.depositUser4.address,BigNumber.from(_amountHnq).div(10))
            await this.hnqToken.connect(this.depositUser4).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).div(10))
            await this.crowdfundPools.connect(this.depositUser4).deposit(_curPoolId,BigNumber.from(_amountHnq).div(10))

            await expect(this.crowdfundPools.drawLots(_curPoolId,await time.latestTime()))
              .to.be.revertedWith("drawLots: need in undrawn status")
            ////exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("2")
            await this.crowdfundPools.drawLots(_curPoolId,await time.latestTime())

            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

            // await expect(this.crowdfundPools.drawLots(_curPoolId,await time.latestTime()))
            //   .to.be.revertedWith("drawLots: need in undrawn status")
            let highestPosi = await this.crowdfundPools.highestPosi(_curPoolId)
            console.log("_curPoolId => highestPosi",_curPoolId.toString(),highestPosi.toString())
            let winningInfo = await this.crowdfundPools.getWinnedDataOfPool(_curPoolId,highestPosi)
            console.log(winningInfo.toString())

            let user;
            let user1WonAmount;
            let user2WonAmount;
            let user3WonAmount;
            let user4WonAmount;

            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_Info",user.toString())
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_surInfo",surUserInfo.toString())
            await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,100)
            await expect(this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address))
              .to.be.revertedWith('Not counted the user amount')

            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_Info",user.toString())

            await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,100)
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_surInfo_2",surUserInfo.toString())
            user1WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)
            console.log("user1WonAmount",user1WonAmount.toString())

            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser2.address)
            console.log("user2_surInfo_1",user.toString())
            user2WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser2.address)
            console.log("user2WonAmount",user2WonAmount.toString())
            user3WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser3.address)
            console.log(user3WonAmount.toString())
            user4WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser4.address)
            console.log(user4WonAmount.toString())
            //equal
            console.log("1,2,3,4",user1WonAmount.toString(),user2WonAmount.toString(),user3WonAmount.toString(),user4WonAmount.toString())
            expect(_openAmount02).to.be.equal(
              BigNumber.from(user1WonAmount).add(user2WonAmount).add(user3WonAmount).add(user4WonAmount)
            )

        })

        it("when winningRate <= 0.5, 100000, 410000", async function () {
            let _proposer = this.owner.address.toString()
            let _amountHnq = await withDecimals("100000")
            let _openAmount02 = await withDecimals("10000000000")//8000000
            _targetAmount = await withDecimals("10000000000")
            let _minJoinAmount = await withDecimals("1000")
            let _maxJoinAmount = await withDecimals("410000")
            let initAmount = BigNumber.from(_targetAmount).sub(_openAmount02)
            let step = "1000";

            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount02 ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount02 ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            let _curPoolId = await this.crowdfundPools.poolId()//poolId ==2

            // branch 02 : on duration
            //depositUser1
            _amountHnq = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ)
            await this.pledgeToken.mint(this.depositUser1.address,BigNumber.from(_amountHnq).mul(_targetAmount))
            //await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,BigNumber.from(_targetAmount).mul(20))
            await this.hnqToken.mint(this.depositUser1.address,BigNumber.from(_amountHnq).mul(20))
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).mul(20))
            //await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,BigNumber.from(_amountHnq).mul(20))

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser2.address,BigNumber.from(_amountHnq).mul(2))
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).mul(2))
            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,BigNumber.from(_amountHnq).mul(2))

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser3.address,BigNumber.from(_amountHnq).mul(2))
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).mul(2))
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,BigNumber.from(_amountHnq).mul(2))

            //depositUser4 //deposit 10,000,000
            await this.pledgeToken.mint(this.depositUser4.address,BigNumber.from(_targetAmount).div(10))
            await this.pledgeToken.connect(this.depositUser4).approve(this.crowdfundPools.address,BigNumber.from(_targetAmount).div(10))
            await this.hnqToken.mint(this.depositUser4.address,BigNumber.from(_amountHnq).div(10))
            await this.hnqToken.connect(this.depositUser4).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).div(10))
            await this.crowdfundPools.connect(this.depositUser4).deposit(_curPoolId,BigNumber.from(_amountHnq).div(10))

            await expect(this.crowdfundPools.drawLots(_curPoolId,await time.latestTime()))
              .to.be.revertedWith("drawLots: need in undrawn status")
            // exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("2")
            await this.crowdfundPools.drawLots(_curPoolId,await time.latestTime())

            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

            // await expect(this.crowdfundPools.drawLots(_curPoolId,await time.latestTime()))
            //   .to.be.revertedWith("drawLots: need in undrawn status")
            let highestPosi = await this.crowdfundPools.highestPosi(_curPoolId)
            console.log("_curPoolId => highestPosi",_curPoolId.toString(),highestPosi.toString())
            let winningInfo = await this.crowdfundPools.getWinnedDataOfPool(_curPoolId,highestPosi)
            console.log(winningInfo.toString())

            let user;
            let user1WonAmount;
            let user2WonAmount;
            let user3WonAmount;
            let user4WonAmount;

            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_Info",user.toString())
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_surInfo",surUserInfo.toString())


            let len = BigNumber.from(_amountHnq).mul(2).div(step).div(oneHNQ)
            for(let i = 0 ; i<len; i++) {
                await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,step)
                //surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
                console.log("len -i",len.toString(),i)
                if(i<len-1) {
                    await expect(this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address))
                      .to.be.revertedWith('Not counted the user amount')
                }else{
                    let user1WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)
                    console.log("user1WonAmount",user1WonAmount.toString())
                }
            }

            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser2.address)
            console.log("user2_Info",user.toString())
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser2.address)
            console.log("user2_surInfo",surUserInfo.toString())
            len = BigNumber.from(_amountHnq).div(step).div(oneHNQ)
            for(let i = 0 ; i<len; i++) {
                await this.crowdfundPools.connect(this.depositUser2).calculateSurplusInfo(_curPoolId,step)
                await this.crowdfundPools.connect(this.depositUser3).calculateSurplusInfo(_curPoolId,step)
                //surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser2.address)
                console.log("len -i",len.toString(),i)
                if(i<len-1) {
                    await expect(this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser2.address))
                      .to.be.revertedWith('Not counted the user amount')
                }else{
                    console.log("User2 Won amount",await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser2.address))
                }
            }

            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser4.address)
            console.log("user4_Info",user.toString())
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser4.address)
            console.log("user4_surInfo",surUserInfo.toString())
            len = BigNumber.from(_amountHnq).div(10).div(step).div(oneHNQ)
            for(let i = 0 ; i<len; i++) {
                await this.crowdfundPools.connect(this.depositUser4).calculateSurplusInfo(_curPoolId,step)
                //surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser2.address)
                console.log("len -i",len.toString(),i)
                if(i<len-1) {
                    await expect(this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser4.address))
                      .to.be.revertedWith('Not counted the user amount')
                }else{
                    console.log("User4 Won amount",await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser4.address))
                }
            }

            user1WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)
            console.log(user1WonAmount.toString())
            user2WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser2.address)
            console.log(user2WonAmount.toString())
            user3WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser3.address)
            console.log(user3WonAmount.toString())
            user4WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser4.address)
            console.log(user4WonAmount.toString())
            //equal
            console.log("1,2,3,4",user1WonAmount.toString(),user2WonAmount.toString(),user3WonAmount.toString(),user4WonAmount.toString())
            expect(_openAmount02).to.be.equal(
              BigNumber.from(user1WonAmount).add(user2WonAmount).add(user3WonAmount).add(user4WonAmount)
            )

        })

        it("when winningRate > 0.5", async function () {
            let _proposer = this.owner.address.toString()
            let _amountHnq = await withDecimals("100")
            let _openAmount02 = await withDecimals("2500000000")//8000000
            let _targetAmount02 = await withDecimals("3000000000")
            let _originalAmount = await withDecimals("1000000000")
            let initAmount = BigNumber.from(_targetAmount02).sub(_openAmount02)
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount02 ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount02)

            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount02 ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount02)
            let _curPoolId = await this.crowdfundPools.poolId()

            // branch 02 : on duration
            //depositUser1
            _amountHnq = BigNumber.from(_originalAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(10)
            let depositAmount01 = BigNumber.from(_amountHnq).mul(2)
            let depositAmount04 = BigNumber.from(_amountHnq)
            await this.pledgeToken.mint(this.depositUser1.address,BigNumber.from(_targetAmount02).mul(20))
            //await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount02)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,BigNumber.from(_targetAmount02).mul(20))
            await this.hnqToken.mint(this.depositUser1.address,BigNumber.from(_amountHnq).mul(20))
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,depositAmount01)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,depositAmount01)

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_targetAmount02)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount02)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_targetAmount02)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_targetAmount02)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)

            //depositUser4 //deposit 10,000,000
            await this.pledgeToken.mint(this.depositUser4.address,BigNumber.from(_targetAmount02))
            await this.pledgeToken.connect(this.depositUser4).approve(this.crowdfundPools.address,BigNumber.from(_targetAmount02))
            await this.hnqToken.mint(this.depositUser4.address,depositAmount04)
            await this.hnqToken.connect(this.depositUser4).approve(this.crowdfundPools.address,depositAmount04)
            await this.crowdfundPools.connect(this.depositUser4).deposit(_curPoolId,depositAmount04)

            await expect(this.crowdfundPools.drawLots(_curPoolId,await time.latestTime()))
              .to.be.revertedWith("drawLots: need in undrawn status")
            // exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("2")
            await this.crowdfundPools.drawLots(_curPoolId,await time.latestTime())

            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

            // await expect(this.crowdfundPools.drawLots(_curPoolId,await time.latestTime()))
            //   .to.be.revertedWith("drawLots: need in undrawn status")
            let highestPosi = await this.crowdfundPools.highestPosi(_curPoolId)
            console.log("_curPoolId => highestPosi",_curPoolId.toString(),highestPosi.toString())
            let winningInfo = await this.crowdfundPools.getWinnedDataOfPool(_curPoolId,highestPosi)
            console.log(winningInfo.toString())

            let user;
            let user1WonAmount;
            let user2WonAmount;
            let user3WonAmount;
            let user4WonAmount;

            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_Info",user.toString())

            await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,100)
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_surInfo",surUserInfo.toString())
            await expect(this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address))
              .to.be.revertedWith('Not counted the user amount')

            user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
            console.log("depositUser1-userInfo:",user.toString())
            await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,100)
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
            console.log("2-surUserInfo",surUserInfo.toString())
            // user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser2.address)
            // console.log(user.toString())
            user1WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)
            console.log("user1WonAmount",user1WonAmount.toString())
            user2WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser2.address)
            console.log(user2WonAmount.toString())
            user3WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser3.address)
            console.log(user3WonAmount.toString())
            user4WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser4.address)
            console.log(user4WonAmount.toString())
            //equal
            let winnedDataOfPools = await await this.crowdfundPools.winnedDataOfPools(_curPoolId)
            console.log("isTrueTail",winnedDataOfPools.toString())
            if(winnedDataOfPools[1]) {
                expect(_openAmount02).to.be.equal(
                  BigNumber.from(user1WonAmount).add(user2WonAmount).add(user3WonAmount).add(user4WonAmount)
                )
            }else {
                console.log("1,2,3,4",user1WonAmount.toString(),user2WonAmount.toString(),user3WonAmount.toString(),user4WonAmount.toString())
                expect(_openAmount02).to.be.equal(
                  BigNumber.from(user1WonAmount).add(user2WonAmount).add(user3WonAmount).add(user4WonAmount)
                )
            }
        })
    })

    describe("getCrowdfundStatus func", async function (){
        it("when open amount == 0", async function () {
            const _proposer = this.owner.address
            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await this.crowdfundPools.connect(this.mockDemocracy).add(
              _proposalId,_proposer,_openAmount_0, _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            let _curPoolId = await this.crowdfundPools.poolId()
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

        })

        it("when open amount > 0", async function () {
            let _proposer = this.owner.address
            let _amountHnq = await withDecimals("100")
            let _depositAmount = BigNumber.from(_baseHipAmountPerHnq).mul(_amountHnq)
            let initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            let _curPoolId = await this.crowdfundPools.poolId()
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("0")

            // // branch 01 : exceeds duration
            // await time.advanceTimeAndBlock(ONE_DAY*2)
            // expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("3")

            // branch 02 : on duration

            //depositUser1
            await this.pledgeToken.mint(this.depositUser1.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)

            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)
            // exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("2")

            //set winnedDataOfPools[_pid].isCompleted == true
            await this.crowdfundPools.smodify.put({
                winnedDataOfPools:{
                    "1" : {isCompleted : true}
                }
            });
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

        })

    })

    describe("refund func", async function (){

        it("when open amount == 0", async function () {
            const _proposer = this.owner.address
            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await this.crowdfundPools.connect(this.mockDemocracy).add(
              _proposalId,_proposer,_openAmount_0, _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            let _curPoolId = await this.crowdfundPools.poolId()
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

            await expect(this.crowdfundPools.connect(this.depositUser1).refund(_curPoolId))
              .to.be.revertedWith("User did not joined")
            await expect(this.crowdfundPools.refund(_curPoolId))
              .to.be.revertedWith("Only refund when openAmount > 0")

        })

        it("when open amount > 0", async function () {
            const _proposer = this.owner.address
            const _amountHnq = await withDecimals("100")
            const _depositAmount = BigNumber.from(_baseHipAmountPerHnq).mul(_amountHnq).div(oneHNQ)

            _targetAmount = await withDecimals("1000000000")
            _openAmount  = await withDecimals("500000000")

            const initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            let poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            console.log("===poolInfo",poolInfo.toString())
            let _curPoolId = await this.crowdfundPools.poolId()
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("0")

            await expect(this.crowdfundPools.connect(this.owner).refund(_curPoolId))
              .to.be.revertedWith("refund: not failed")

            //depositUser1
            await this.pledgeToken.mint(this.depositUser1.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)

            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)

            await expect(this.crowdfundPools.connect(this.owner).refund(_curPoolId))
              .to.be.revertedWith("refund: not failed")

            //exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            console.log("===poolInfo",poolInfo.toString())
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("3")
            //uint initAmount = _targetAmount *(1e6 - pool.crowdfundRatio)/1e6;
            await this.crowdfundPools.connect(this.owner).refund(_curPoolId)
            expect(await this.hnqToken.balanceOf(this.owner.address)).to.be.equal("0")
            expect(await this.pledgeToken.balanceOf(this.owner.address))
              .to.be.equal(BigNumber.from(_targetAmount).sub(_openAmount ))

            let user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_Info",user.toString())

            let hipBal = await this.pledgeToken.balanceOf(this.depositUser1.address)
            let hnqBal = await this.hnqToken.balanceOf(this.depositUser1.address)
            console.log("hipBal-1_before",BigNumber.from(hipBal).div(oneHip).toString());
            console.log("hnqBal-1_before",BigNumber.from(hnqBal).div(oneHNQ).toString());
            await this.crowdfundPools.connect(this.depositUser1).refund(_curPoolId)
            hipBal = await this.pledgeToken.balanceOf(this.depositUser1.address)
            hnqBal = await this.hnqToken.balanceOf(this.depositUser1.address)
            console.log("hipBal-1_after",BigNumber.from(hipBal).div(oneHip).toString());
            console.log("hnqBal-1_after",BigNumber.from(hnqBal).div(oneHNQ).toString());
            expect(await this.pledgeToken.balanceOf(this.depositUser1.address)).to.be.equal(_depositAmount)
            expect(await this.hnqToken.balanceOf(this.depositUser1.address)).to.be.equal(_amountHnq)

            await this.crowdfundPools.connect(this.depositUser2).refund(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser2.address)).to.be.equal(_depositAmount)
            expect(await this.hnqToken.balanceOf(this.depositUser2.address)).to.be.equal(_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).refund(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser3.address)).to.be.equal(_depositAmount)
            expect(await this.hnqToken.balanceOf(this.depositUser3.address)).to.be.equal(_amountHnq)

            // //safeBonusTokenTransfer_public
            // await this.crowdfundPools.safeBonusTokenTransfer_public(this.pledgeToken.address,this.owner.address,_targetAmount)

        })

        it("when open amount == traget amount", async function () {
            const _proposer = this.owner.address
            const _amountHnq = await withDecimals("100")
            const _depositAmount = BigNumber.from(_baseHipAmountPerHnq).mul(_amountHnq).div(oneHNQ)

            _targetAmount = await withDecimals("1000000000")
            _openAmount  = await withDecimals("1000000000")

            const initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            let poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            console.log("===poolInfo",poolInfo.toString())
            let _curPoolId = await this.crowdfundPools.poolId()
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("0")

            //User did not joined
            //refund: not failed
            await expect(this.crowdfundPools.connect(this.owner).refund(_curPoolId))
              .to.be.revertedWith("User did not joined")

            //depositUser1
            await this.pledgeToken.mint(this.depositUser1.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)

            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)

            await expect(this.crowdfundPools.connect(this.depositUser3).refund(_curPoolId))
              .to.be.revertedWith("refund: not failed")

            //exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            poolInfo = await this.crowdfundPools.poolInfo(await this.crowdfundPools.poolId())
            console.log("===poolInfo",poolInfo.toString())
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("3")
            //uint initAmount = _targetAmount *(1e6 - pool.crowdfundRatio)/1e6;

            let user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
            console.log("user1_Info",user.toString())

            let hipBal = await this.pledgeToken.balanceOf(this.depositUser1.address)
            let hnqBal = await this.hnqToken.balanceOf(this.depositUser1.address)
            console.log("hipBal-1_before",BigNumber.from(hipBal).div(oneHip).toString());
            console.log("hnqBal-1_before",BigNumber.from(hnqBal).div(oneHNQ).toString());
            await this.crowdfundPools.connect(this.depositUser1).refund(_curPoolId)
            hipBal = await this.pledgeToken.balanceOf(this.depositUser1.address)
            hnqBal = await this.hnqToken.balanceOf(this.depositUser1.address)
            console.log("hipBal-1_after",BigNumber.from(hipBal).div(oneHip).toString());
            console.log("hnqBal-1_after",BigNumber.from(hnqBal).div(oneHNQ).toString());
            expect(await this.pledgeToken.balanceOf(this.depositUser1.address)).to.be.equal(_depositAmount)
            expect(await this.hnqToken.balanceOf(this.depositUser1.address)).to.be.equal(_amountHnq)

            await this.crowdfundPools.connect(this.depositUser2).refund(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser2.address)).to.be.equal(_depositAmount)
            expect(await this.hnqToken.balanceOf(this.depositUser2.address)).to.be.equal(_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).refund(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser3.address)).to.be.equal(_depositAmount)
            expect(await this.hnqToken.balanceOf(this.depositUser3.address)).to.be.equal(_amountHnq)

            // //safeBonusTokenTransfer_public
            // await this.crowdfundPools.safeBonusTokenTransfer_public(this.pledgeToken.address,this.owner.address,_targetAmount)

        })
    })

    describe("release func", async function (){
        it("when open amount == 0", async function () {
            const _proposer = this.owner.address
            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await this.crowdfundPools.connect(this.mockDemocracy).add(
              _proposalId,_proposer,_openAmount_0, _dividendRatio,_duration,_maxJoinAmount, _targetAmount)
            let _curPoolId = await this.crowdfundPools.poolId()

            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await this.crowdfundPools.connect(this.mockDemocracy).add(
              _proposalId,_proposer,_openAmount_0, _dividendRatio,_duration,_maxJoinAmount, _targetAmount)
            _curPoolId = await this.crowdfundPools.poolId()
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

            await expect(this.crowdfundPools.connect(this.depositUser1).release(_curPoolId))
              .to.be.revertedWith("Only proposer can release when openAmount == 0")

            // pass pool duration
            await time.advanceTimeAndBlock(ONE_DAY)

            //passed x weeks
            //releaseAmount = user.wonAmount/4*intervalWeek - user.releasedAmount;
            //passed 1 weeks
            let pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.owner.address)
            expect(pendingRelease.toString()).to.be.equal("0")
            await time.advanceTimeAndBlock(ONE_DAY*7*1)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.owner.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from(_targetAmount).div(4))
            await this.crowdfundPools.connect(this.owner).release(_curPoolId)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.owner.address)
            expect(pendingRelease.toString()).to.be.equal("0")
            expect(await this.pledgeToken.balanceOf(this.owner.address)).to.be.equal(BigNumber.from(_targetAmount).div(4))
            let user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),_proposer)
            expect(user.releasedAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).div(4))
            //passed 2 weeks
            await time.advanceTimeAndBlock(ONE_DAY*7*1)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.owner.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from(_targetAmount).div(4).mul(1))
            await this.crowdfundPools.connect(this.owner).release(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.owner.address)).to.be.equal(BigNumber.from(_targetAmount).div(4).mul(2))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),_proposer)
            expect(user.releasedAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).div(4).mul(2))
            //passed 4 weeks
            await time.advanceTimeAndBlock(ONE_DAY*7*2)
            await this.crowdfundPools.connect(this.owner).release(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.owner.address)).to.be.equal(BigNumber.from(_targetAmount).div(4).mul(4))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),_proposer)
            expect(user.releasedAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).div(4).mul(4))

            //passed 10 weeks
            await time.advanceTimeAndBlock(ONE_DAY*6)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.owner.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from("0"))
            await this.crowdfundPools.connect(this.owner).release(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.owner.address)).to.be.equal(_targetAmount)
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),_proposer)
            expect(user.releasedAmount.toString()).to.be.equal(_targetAmount)


        })

        it.only("when open amount > 0", async function () {
            let _proposer = this.owner.address.toString()
            let _amountHnq = await withDecimals("10000")

            _targetAmount = await withDecimals("1000000000")
            _openAmount  =  await withDecimals("500000000")

            let baseMultiCostHnq = await this.crowdfundPools.baseMultiCostHnq()
            let baseCostHnqAmount = BigNumber.from(baseMultiCostHnq).mul(oneHNQ)

            let _depositAmount = BigNumber.from(_baseHipAmountPerHnq).mul(_amountHnq).div(oneHNQ).div(20)
            let initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            let _curPoolId = await this.crowdfundPools.poolId()

            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await this.crowdfundPools.connect(this.mockDemocracy).add(
              _proposalId,_proposer,_openAmount, _dividendRatio,_duration,_maxJoinAmount, _targetAmount)
            _curPoolId = await this.crowdfundPools.poolId()

            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await this.crowdfundPools.connect(this.mockDemocracy).add(
              _proposalId,_proposer,_openAmount, _dividendRatio,_duration,_maxJoinAmount, _targetAmount)
            _curPoolId = await this.crowdfundPools.poolId()
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("0")

            // branch 02 : on duration
            //depositUser1
            await this.pledgeToken.mint(this.depositUser1.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)
            let userInfo = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            console.log("depositUser1",userInfo.toString());

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,BigNumber.from(_amountHnq).div(5))
            userInfo = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser2.address)
            console.log("depositUser2",userInfo.toString());

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_depositAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_depositAmount)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,BigNumber.from(_amountHnq).div(5))
            userInfo = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser3.address)
            console.log("depositUser3",userInfo.toString());

            // exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("2")
            await expect(this.crowdfundPools.connect(this.depositUser3).release(_curPoolId))
              .to.be.revertedWith("release: not success")

            await this.crowdfundPools.drawLots(_curPoolId,await time.latestTime())

            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

            let highestPosi = await this.crowdfundPools.highestPosi(_curPoolId)
            console.log("_curPoolId => highestPosi",_curPoolId.toString(),highestPosi.toString())
            let winningInfo = await this.crowdfundPools.getWinnedDataOfPool(_curPoolId,highestPosi)
            console.log(winningInfo.toString())


            let user;
            let user1WonAmount;
            let user2WonAmount;
            let user3WonAmount;
            let user4WonAmount;
            user1WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)
            console.log("user1WonAmount",user1WonAmount.toString())
            user2WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser2.address)
            console.log("user2WonAmount",user2WonAmount.toString())
            user3WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser3.address)
            console.log("user3WonAmount",user3WonAmount.toString())
            user4WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser4.address)
            console.log("user4WonAmount:",user4WonAmount.toString())

            //passed x weeks
            //releaseAmount = user.wonAmount/4*intervalWeek - user.releasedAmount;
            //passed 1 weeks
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            console.log("====user-wonAmount:",user.wonAmount.toString());
            await time.advanceTimeAndBlock(ONE_DAY*7*1)
            //getReleaseAmount(uint256 _pid,address _userAddr)
            //depositUser1
            let pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser1.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from(user1WonAmount[1]))
            
            await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,600)
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
            console.log("1 -surUserInfo",surUserInfo.toString())
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            console.log("====userInfo:",user.toString());
            user1WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)
            console.log("user1WonAmount",user1WonAmount.toString())


            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser1.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from(user1WonAmount[1]).div(4))
            let bal_depositUser1_before = await this.pledgeToken.balanceOf(this.depositUser1.address);

            await this.crowdfundPools.connect(this.depositUser1).release(_curPoolId)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser1.address)
            expect(pendingRelease.toString()).to.be.equal("0")
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            console.log("====user:",user.toString());
            expect(await this.pledgeToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(user1WonAmount[1]).div(4).add(bal_depositUser1_before))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            expect(user.releasedAmount.toString()).to.be.equal(BigNumber.from(user1WonAmount[1]).div(4))

            //depositUser2
            console.log("====depositUser2===========");
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser2.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from(user2WonAmount[1]).div(4))
            
            await expect(this.crowdfundPools.connect(this.depositUser2).calculateSurplusInfo(_curPoolId,600))
              .to.be.revertedWith("Not surplus user")
      
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser2.address)
            console.log("1 -surUserInfo",surUserInfo.toString())
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser2.address)
            console.log("====userInfo:",user.toString());
            
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser2.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from(user2WonAmount[1]).div(4))
            await this.crowdfundPools.connect(this.depositUser2).withdraw(_curPoolId)
            let bal_depositUser2_before = await this.pledgeToken.balanceOf(this.depositUser2.address);

            await this.crowdfundPools.connect(this.depositUser2).release(_curPoolId)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser2.address)
            expect(pendingRelease.toString()).to.be.equal("0")
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser2.address)
            console.log("====user:",user.toString());
            expect(await this.pledgeToken.balanceOf(this.depositUser2.address)).to.be.equal(BigNumber.from(user2WonAmount[1]).div(4).add(bal_depositUser2_before))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser2.address)
            expect(user.releasedAmount.toString()).to.be.equal(BigNumber.from(user2WonAmount[1]).div(4))

            //depositUser3
            console.log("====depositUser3===========");
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser3.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from(user3WonAmount[1]).div(4))
            
            await expect(this.crowdfundPools.connect(this.depositUser3).calculateSurplusInfo(_curPoolId,600))
              .to.be.revertedWith("Not surplus user")
      
            surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser3.address)
            console.log("3 -surUserInfo",surUserInfo.toString())
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser3.address)
            console.log("====userInfo:",user.toString());
            
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser3.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from(user3WonAmount[1]).div(4))
            //await this.crowdfundPools.connect(this.depositUser3).withdraw(_curPoolId)
            let bal_depositUser3_before = await this.pledgeToken.balanceOf(this.depositUser3.address);

            await this.crowdfundPools.connect(this.depositUser3).release(_curPoolId)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser3.address)
            expect(pendingRelease.toString()).to.be.equal("0")
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser3.address)
            console.log("====user:",user.toString());
            expect(await this.pledgeToken.balanceOf(this.depositUser3.address)).to.be.equal(BigNumber.from(user3WonAmount[1]).div(4).add(bal_depositUser3_before))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser3.address)
            expect(user.releasedAmount.toString()).to.be.equal(BigNumber.from(user3WonAmount[1]).div(4))

            //passed 2 weeks
            await time.advanceTimeAndBlock(ONE_DAY*7*1)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser1.address)
            expect(pendingRelease.toString()).to.be.equal(BigNumber.from(user1WonAmount[1]).div(4).mul(1))
            await this.crowdfundPools.connect(this.depositUser1).release(_curPoolId)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser1.address)
            expect(pendingRelease.toString()).to.be.equal("0")
            expect(await this.pledgeToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(user1WonAmount[1]).div(4).mul(2).add(bal_depositUser1_before))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            expect(user.releasedAmount.toString()).to.be.equal(BigNumber.from(user1WonAmount[1]).div(4).mul(2))
            //passed 4 weeks
            await time.advanceTimeAndBlock(ONE_DAY*7*2)
            await this.crowdfundPools.connect(this.depositUser1).release(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(user1WonAmount[1]).div(4).mul(4).add(bal_depositUser1_before))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            expect(user.releasedAmount.toString()).to.be.equal(BigNumber.from(user1WonAmount[1]).div(4).mul(4))

            //passed 10 weeks
            await time.advanceTimeAndBlock(ONE_DAY*6)
            pendingRelease = await this.crowdfundPools.getReleaseAmount(_curPoolId,this.depositUser1.address)
            expect(pendingRelease.toString()).to.be.equal("0")
            await this.crowdfundPools.connect(this.depositUser1).release(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(user1WonAmount[1]).add(bal_depositUser1_before))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)

            expect(user.releasedAmount.toString()).to.be.equal(user1WonAmount[1])

            // await expect(this.crowdfundPools.connect(this.user).release(_curPoolId))
            //   .to.be.revertedWith("Not won, not release")

            

        })

    })

    describe("withdraw func", async function (){

        it("when open amount == 0", async function () {
            const _proposer = this.owner.address
            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(
              _proposalId,_proposer,_openAmount_0, _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            let _curPoolId = await this.crowdfundPools.poolId()
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

            await expect(this.crowdfundPools.connect(this.depositUser1).withdraw(_curPoolId))
              .to.be.revertedWith("User did not joined")
            await expect(this.crowdfundPools.withdraw(_curPoolId))
              .to.be.revertedWith("Only withdraw when openAmount > 0")

        })

        it("when open amount > 0", async function () {
            let _proposer = this.owner.address.toString()

            _targetAmount = await withDecimals("1000000000")
            _openAmount  = await withDecimals("500000000")

            let baseMultiCostHnq = await this.crowdfundPools.baseMultiCostHnq()
            let baseCostHnqAmount = BigNumber.from(baseMultiCostHnq).mul(oneHNQ)

            let initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            let _curPoolId = await this.crowdfundPools.poolId()

            // branch 02 : on duration
            //depositUser1
            let _amountHnq = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(20)
            _amountHnq = BigNumber.from(_amountHnq).div(baseCostHnqAmount).mul(baseCostHnqAmount)

            await this.pledgeToken.mint(this.depositUser1.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

            //depositUser3

            await this.pledgeToken.mint(this.depositUser3.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)
            // exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("2")

            await expect(this.crowdfundPools.connect(this.depositUser3).withdraw(_curPoolId))
              .to.be.revertedWith("withdraw: not success")

            //set winnedDataOfPools[_pid].isCompleted == true
            await this.crowdfundPools.smodify.put({
                winnedDataOfPools:{"2" : {isCompleted : true}}
            });
            console.log("getWinnedDataOfPool-2:",_curPoolId.toString(),await this.crowdfundPools.getWinnedDataOfPool(_curPoolId,"10"))
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")
            //set user.wonAmount
            let user1WonAmount = await withDecimals("160000000")
            let user2WonAmount = await withDecimals("170000000")
            let user3WonAmount = await withDecimals("170000000")

            await this.crowdfundPools.smodify.put({//depositUser1
                userInfo:{"2" : { "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f": {wonAmount :user1WonAmount} }},
                surplusInfo:{"2" : { "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f": {countedWonAmount :user1WonAmount,nextStart:1001} }},
            });
            await this.crowdfundPools.smodify.put({//depositUser2
                userInfo:{"2" : { "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720": {wonAmount :user2WonAmount} }},
                surplusInfo:{"2" : { "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720": {countedWonAmount :user2WonAmount,nextStart:2001} }}
            });
            await this.crowdfundPools.smodify.put({//depositUser3
                userInfo:{"2" : { "0xBcd4042DE499D14e55001CcbB24a551F3b954096": {wonAmount :user3WonAmount} }},
                surplusInfo:{"2" : { "0xBcd4042DE499D14e55001CcbB24a551F3b954096": {countedWonAmount :user3WonAmount,nextStart:3001} }}
            });

            // completed drawLots
            await this.crowdfundPools.setWinnedDataOfPools02(_curPoolId)

            //depositUser1
            let ticketInfoOfPool_2 = await this.crowdfundPools.ticketInfoOfPool(_curPoolId);
            let multiCostHnq = ticketInfoOfPool_2.multiCostHnq;
            let user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            console.log("depositUser1",user.toString());
            expect(user.amount.toString()).to.be.equal(BigNumber.from(_targetAmount))
            await this.crowdfundPools.connect(this.depositUser1).withdraw(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user1WonAmount))
            expect(await this.hnqToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user1WonAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(multiCostHnq))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            expect(user.amount.toString()).to.be.equal(BigNumber.from(user1WonAmount))
            //depositUser2
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser2.address)
            console.log("depositUser1",user.toString());
            expect(user.amount.toString()).to.be.equal(BigNumber.from(_targetAmount))
            await this.crowdfundPools.connect(this.depositUser2).withdraw(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser2.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user2WonAmount))
            expect(await this.hnqToken.balanceOf(this.depositUser2.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user2WonAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(multiCostHnq))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser2.address)
            expect(user.amount.toString()).to.be.equal(BigNumber.from(user2WonAmount))
            //depositUser3
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser3.address)
            expect(user.amount.toString()).to.be.equal(BigNumber.from(_targetAmount))
            await this.crowdfundPools.connect(this.depositUser3).withdraw(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser3.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user3WonAmount))
            expect(await this.hnqToken.balanceOf(this.depositUser3.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user3WonAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(multiCostHnq))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser3.address)
            expect(user.amount.toString()).to.be.equal(BigNumber.from(user3WonAmount))

            await expect(this.crowdfundPools.connect(this.owner).withdraw(_curPoolId))
              .to.be.revertedWith("Not proposer")

        })

        it("when open amount == target Amount", async function () {
            let _proposer = this.owner.address.toString()

            _targetAmount = await withDecimals("1000000000")
            _openAmount  = _targetAmount

            let baseMultiCostHnq = await this.crowdfundPools.baseMultiCostHnq()
            let baseCostHnqAmount = BigNumber.from(baseMultiCostHnq).mul(oneHNQ)

            let initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

            let _curPoolId = await this.crowdfundPools.poolId()

            // branch 02 : on duration
            //depositUser1
            let _amountHnq = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(20)
            _amountHnq = BigNumber.from(_amountHnq).div(baseCostHnqAmount).mul(baseCostHnqAmount)
            await this.pledgeToken.mint(this.depositUser1.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

            //depositUser3

            await this.pledgeToken.mint(this.depositUser3.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)
            // exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("2")

            await expect(this.crowdfundPools.connect(this.depositUser3).withdraw(_curPoolId))
              .to.be.revertedWith("withdraw: not success")

            //set winnedDataOfPools[_pid].isCompleted == true
            await this.crowdfundPools.smodify.put({
                winnedDataOfPools:{"2" : {isCompleted : true}}
            });
            console.log("getWinnedDataOfPool-2:",_curPoolId.toString(),await this.crowdfundPools.getWinnedDataOfPool(_curPoolId,"10"))
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")
            //set user.wonAmount
            let user1WonAmount = await withDecimals("300000000")
            let user2WonAmount = await withDecimals("300000000")
            let user3WonAmount = await withDecimals("400000000")

            await this.crowdfundPools.smodify.put({//depositUser1
              userInfo:{"2" : { "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f": {wonAmount :user1WonAmount} }},
              surplusInfo:{"2" : { "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f": {countedWonAmount :user1WonAmount,nextStart:1001} }},
            });
            await this.crowdfundPools.smodify.put({//depositUser2
                userInfo:{"2" : { "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720": {wonAmount :user2WonAmount} }},
                surplusInfo:{"2" : { "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720": {countedWonAmount :user2WonAmount,nextStart:2001} }}
            });
            await this.crowdfundPools.smodify.put({//depositUser3
                userInfo:{"2" : { "0xBcd4042DE499D14e55001CcbB24a551F3b954096": {wonAmount :user3WonAmount} }},
                surplusInfo:{"2" : { "0xBcd4042DE499D14e55001CcbB24a551F3b954096": {countedWonAmount :user3WonAmount,nextStart:3001} }}
            });

            //depositUser1
            let ticketInfoOfPool_2 = await this.crowdfundPools.ticketInfoOfPool(_curPoolId);
            let multiCostHnq = ticketInfoOfPool_2.multiCostHnq;
            let user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            console.log("userInfo-1:",user.toString())
            expect(user.amount.toString()).to.be.equal(BigNumber.from(_targetAmount))
            await this.crowdfundPools.connect(this.depositUser1).withdraw(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user1WonAmount))
            expect(await this.hnqToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user1WonAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(multiCostHnq))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
            expect(user.amount.toString()).to.be.equal(BigNumber.from(user1WonAmount))
            //depositUser2
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser2.address)
            console.log("userInfo-2:",user.toString())
            expect(user.amount.toString()).to.be.equal(BigNumber.from(_targetAmount))
            await this.crowdfundPools.connect(this.depositUser2).withdraw(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser2.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user2WonAmount))
            expect(await this.hnqToken.balanceOf(this.depositUser2.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user2WonAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(multiCostHnq))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser2.address)
            expect(user.amount.toString()).to.be.equal(BigNumber.from(user2WonAmount))
            //depositUser3
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser3.address)
            console.log("userInfo-3:",user.toString())
            expect(user.amount.toString()).to.be.equal(BigNumber.from(_targetAmount))
            await this.crowdfundPools.connect(this.depositUser3).withdraw(_curPoolId)
            expect(await this.pledgeToken.balanceOf(this.depositUser3.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user3WonAmount))
            expect(await this.hnqToken.balanceOf(this.depositUser3.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user3WonAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(multiCostHnq))
            user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser3.address)
            expect(user.amount.toString()).to.be.equal(BigNumber.from(user3WonAmount))

            await expect(this.crowdfundPools.connect(this.owner).withdraw(_curPoolId))
              .to.be.revertedWith("User did not joined")

        })
    })

    describe("claimBonus and pendBonusToken func", async function (){
        it("when open amount == 0", async function () {
            const _proposer = this.owner.address
            await this.pledgeToken.mint(this.owner.address,_targetAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,_targetAmount)
            let payHnqAmount = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)
            await this.crowdfundPools.connect(this.mockDemocracy).add(
              _proposalId,_proposer,_openAmount_0, _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            let _curPoolId = await this.crowdfundPools.poolId()
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

            await expect(this.crowdfundPools.claimBonus(_curPoolId))
              .to.be.revertedWith("Not crowdfund not bonus")

        })

        it("when open amount > 0", async function () {
            let _proposer = this.owner.address.toString()
            //_targetAmount = BigNumber.from(_targetAmount).mul(10)
            let initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

            expect(await this.crowdfundPools.poolLength()).to.be.equal("0")
            //getMyCrowdfundListLen
            expect(await this.crowdfundPools.getMyCrowdfundListLen(_proposer)).to.be.equal("0")
            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            expect(await this.crowdfundPools.poolLength()).to.be.equal("1")
            expect(await this.crowdfundPools.getMyCrowdfundListLen(_proposer)).to.be.equal("1")
            let _curPoolId01 = await this.crowdfundPools.poolId()

            let allCrowdfundIdlist = await this.crowdfundPools.getAllCrowdfundingIds()
            //[0,1,2,3]
            expect(allCrowdfundIdlist[0]).to.be.equal("0")
            expect(allCrowdfundIdlist[1]).to.be.equal("1")

            // on duration
            //depositUser1
            let _amountHnq  = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(20)
            await this.pledgeToken.mint(this.depositUser1.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
            expect(await this.crowdfundPools.getUserJoinedIdListLen(this.depositUser1.address)).to.be.equal("0")
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId01,_amountHnq)
            expect(await this.crowdfundPools.getUserJoinedIdListLen(this.depositUser1.address)).to.be.equal("1")

            let user = await this.crowdfundPools.userInfo(_curPoolId01,this.depositUser1.address);
            console.log("user1",user.toString());

            //depositUser2
            await this.pledgeToken.mint(this.depositUser2.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId01,_amountHnq)

            user = await this.crowdfundPools.userInfo(_curPoolId01,this.depositUser2.address);
            console.log("user1",user.toString());

            //depositUser3
            await this.pledgeToken.mint(this.depositUser3.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId01,_amountHnq)
            // exceeds duration
            await time.advanceTimeAndBlock(ONE_DAY*2)
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId01)).to.be.equal("2")

            await expect(this.crowdfundPools.connect(this.depositUser3).claimBonus(_curPoolId01))
              .to.be.revertedWith("ClaimBonus: not success")

            // //set winnedDataOfPools[_pid].isCompleted == true
            // await this.crowdfundPools.smodify.put({
            //     winnedDataOfPools:{"1" : {isCompleted : true}}
            // });
            expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId01)).to.be.equal("2")

            // await expect(this.crowdfundPools.connect(this.depositUser3).claimBonus(_curPoolId01))
            //     .to.be.revertedWith("Not won")

            let wonInfo = await this.crowdfundPools.getWonInfo(_curPoolId01,this.depositUser1.address)
            console.log("wonInfo-deposit01-before",wonInfo.toString())
            await this.crowdfundPools.drawLots(_curPoolId01,await time.latestTime())
            wonInfo = await this.crowdfundPools.getWonInfo(_curPoolId01,this.depositUser1.address)
            console.log("wonInfo-deposit01-after",wonInfo.toString())

            // poolingBonusToPools
            const _proposer02 = this.alice.address
            await this.pledgeToken.mint(_proposer02,initAmount)
            await this.pledgeToken.connect(this.alice).approve(this.crowdfundPools.address,initAmount)
            payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer02,payHnqAmount)
            await this.hnqToken.connect(this.alice).approve(this.crowdfundPools.address,payHnqAmount)

            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId02,_proposer02,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            expect(await this.crowdfundPools.poolLength()).to.be.equal("2")
            let _curPoolId02 = await this.crowdfundPools.poolId()

            let mockedWorkId = BigNumber.from("10");
            const mockedPoolId01 = BigNumber.from("1");
            const mockedPoolId02 = BigNumber.from("2");

            expect(await this.crowdfundPools.workId2PoolId(mockedWorkId)).to.be.equal("0")
            let workIds = [];
            for (let i =1;i<=100;i++) {
                mockedWorkId = BigNumber.from(i);
                if(i<= 50 ) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId01}});
                if(i> 50 ) this.crowdfundPools.smodify.put({workId2PoolId:{[mockedWorkId]:mockedPoolId02}});
                workIds.push(i)
            }

            let totalBonusAmount = await withDecimals("10000")
            await this.usdc.mint(this.mockMysteryBoxMarket.address,totalBonusAmount)
            await this.usdc.connect(this.mockMysteryBoxMarket).approve(this.crowdfundPools.address,totalBonusAmount)
            await this.crowdfundPools.connect(this.mockMysteryBoxMarket).poolingBonusToPools(workIds,this.usdc.address, totalBonusAmount)
            expect(await this.usdc.balanceOf(_proposer)).to.be.equal(BigNumber.from(totalBonusAmount).div(4))
            expect(await this.usdc.balanceOf(_proposer02)).to.be.equal(BigNumber.from(totalBonusAmount).div(4))
            let accBonusesPerShares = await this.crowdfundPools.getAccBonusesPerShares(_curPoolId01)
            expect(accBonusesPerShares[0])
              .to.be.equal(BigNumber.from(totalBonusAmount).div(2).mul(_dividendRatio).div(await withDecimals6(1)).mul(await withDecimals12(1)).div(_openAmount))

            //getUserRewardDebts
            let rewardDebts = await this.crowdfundPools.getUserRewardDebts(_curPoolId01,this.depositUser1.address)
            console.log("rewardDebts:",rewardDebts.toString())
            expect(rewardDebts[0].toString()).to.be.equal("0")

            await expect(this.crowdfundPools.connect(this.owner).claimBonus(_curPoolId01))
              .to.be.revertedWith("Not proposer")
            await expect(this.crowdfundPools.connect(this.user).claimBonus(_curPoolId01))
              .to.be.revertedWith("Not counted amountUser or not drwan")

            //depositUser1
            //pendingBonusToken(uint _pid, address _user)
            user = await this.crowdfundPools.userInfo(_curPoolId01,this.user.address);
            console.log("user-not deposit",user.toString());
            let pendings_0 = await this.crowdfundPools.pendingBonusToken(_curPoolId01,this.user.address)
            console.log("pendings_0",pendings_0.toString())
            expect(pendings_0[0].toString()).to.be.equal("0")
            expect(pendings_0[1].toString()).to.be.equal("0")
            let pendings_proposer = await this.crowdfundPools.pendingBonusToken(_curPoolId01,this.owner.address)
            expect(pendings_proposer[0].toString()).to.be.equal("0")
            expect(pendings_proposer[1].toString()).to.be.equal("0")

            let pendings = await this.crowdfundPools.pendingBonusToken(_curPoolId01,this.depositUser1.address)
            console.log("pendings01:",pendings.toString())
            rewardDebts = await this.crowdfundPools.getUserRewardDebts(_curPoolId01,this.depositUser1.address)
            console.log("rewardDebts:",rewardDebts.toString())
            await this.crowdfundPools.connect(this.depositUser1).claimBonus(_curPoolId01)
            wonInfo = await this.crowdfundPools.getWonInfo(_curPoolId01,this.depositUser1.address)
            expect(await this.usdc.balanceOf(this.depositUser1.address))
              .to.be.equal(BigNumber.from(accBonusesPerShares[0]).mul(wonInfo[1]).div("1000000000000").sub(rewardDebts[0]))//BigNumber.from(1).pow(12)
              
            expect(await this.usdc.balanceOf(this.depositUser1.address)).to.be.equal(pendings[0].toString())
            rewardDebts = await this.crowdfundPools.getUserRewardDebts(_curPoolId01,this.depositUser1.address)
            console.log("rewardDebts:",rewardDebts.toString())
            
            expect(rewardDebts[0]).to.be.equal(BigNumber.from(accBonusesPerShares[0]).mul(wonInfo[1]).div("1000000000000"))

            allCrowdfundIdlist = await this.crowdfundPools.getAllCrowdfundingIds()
            //[0,1,2,3]
            expect(allCrowdfundIdlist[0]).to.be.equal("0")
            expect(allCrowdfundIdlist[1]).to.be.equal("2")

            pendings = await this.crowdfundPools.pendingBonusToken(_curPoolId01,this.depositUser2.address)
            console.log("pendings02:",pendings.toString())
            rewardDebts = await this.crowdfundPools.getUserRewardDebts(_curPoolId01,this.depositUser2.address)
            console.log("rewardDebts:",rewardDebts.toString())
            await this.crowdfundPools.connect(this.depositUser2).claimBonus(_curPoolId01)
            wonInfo = await this.crowdfundPools.getWonInfo(_curPoolId01,this.depositUser2.address)
            expect(await this.usdc.balanceOf(this.depositUser2.address))
              .to.be.equal(BigNumber.from(accBonusesPerShares[0]).mul(wonInfo[1]).div("1000000000000").sub(rewardDebts[0]))//BigNumber.from(1).pow(12)
            expect(await this.usdc.balanceOf(this.depositUser2.address)).to.be.equal(pendings[0].toString())
            rewardDebts = await this.crowdfundPools.getUserRewardDebts(_curPoolId01,this.depositUser2.address)
            console.log("rewardDebts:",rewardDebts.toString())
            expect(rewardDebts[0]).to.be.equal(BigNumber.from(accBonusesPerShares[0]).mul(wonInfo[1]).div("1000000000000"))

            pendings = await this.crowdfundPools.pendingBonusToken(_curPoolId01,this.depositUser3.address)
            console.log("pendings03:",pendings.toString())
            rewardDebts = await this.crowdfundPools.getUserRewardDebts(_curPoolId01,this.depositUser3.address)
            console.log("rewardDebts:",rewardDebts.toString())
            await this.crowdfundPools.connect(this.depositUser3).claimBonus(_curPoolId01)
            wonInfo = await this.crowdfundPools.getWonInfo(_curPoolId01,this.depositUser3.address)
            expect(await this.usdc.balanceOf(this.depositUser3.address))
              .to.be.equal(BigNumber.from(accBonusesPerShares[0]).mul(wonInfo[1]).div("1000000000000").sub(rewardDebts[0]))//BigNumber.from(1).pow(12)
            expect(await this.usdc.balanceOf(this.depositUser3.address)).to.be.equal(pendings[0].toString())
            rewardDebts = await this.crowdfundPools.getUserRewardDebts(_curPoolId01,this.depositUser3.address)
            console.log("rewardDebts:",rewardDebts.toString())
            expect(rewardDebts[0]).to.be.equal(BigNumber.from(accBonusesPerShares[0]).mul(wonInfo[1]).div("1000000000000"))

            //claimBonus again ,but nothing
            await this.crowdfundPools.connect(this.depositUser3).claimBonus(_curPoolId01)
            expect(await this.usdc.balanceOf(this.depositUser3.address)).to.be.equal(pendings[0].toString())

            //check getCrowdfundingIdsLen
            expect(await this.crowdfundPools.getCrowdfundingIdsLen()).to.be.equal("2")

            // launch crowdfund03
            await this.pledgeToken.mint(this.owner.address,initAmount)
            await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
            payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
            await this.hnqToken.mint(_proposer,payHnqAmount)
            await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount);
            await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
              _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
            expect(await this.crowdfundPools.poolLength()).to.be.equal("3")
            expect(await this.crowdfundPools.getMyCrowdfundListLen(_proposer)).to.be.equal("2")
            expect(await this.crowdfundPools.getCrowdfundingIdsLen()).to.be.equal("3")
            await expect(this.crowdfundPools.getPartialCrowdfundingIds("0","3"))
              .to.be.revertedWith("Index wrong")
            let partialCrowdfundingIds = await this.crowdfundPools.getPartialCrowdfundingIds("1","2")
            console.log("===partialCrowdfundingIds",partialCrowdfundingIds.toString())
            expect(partialCrowdfundingIds[0]).to.be.equal("2")
            expect(partialCrowdfundingIds[1]).to.be.equal("3")

            //getPartialMyCrowdfundList
            await expect(this.crowdfundPools.getPartialMyCrowdfundList(_proposer,"0","2"))
              .to.be.revertedWith("Index wrong")

            let crowdfundIdlist = await this.crowdfundPools.getPartialMyCrowdfundList(_proposer,"0","1")
            expect(crowdfundIdlist[0]).to.be.equal("1")
            expect(crowdfundIdlist[1]).to.be.equal("3")
            //getAllCrowdfundingIds
            allCrowdfundIdlist = await this.crowdfundPools.getAllCrowdfundingIds()
            //[0,2,3]
            expect(allCrowdfundIdlist[0]).to.be.equal("0")
            expect(allCrowdfundIdlist[1]).to.be.equal("2")
            expect(allCrowdfundIdlist[2]).to.be.equal("3")

            await this.pledgeToken.mint(this.depositUser1.address,_targetAmount)
            await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount)
            await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
            await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
            await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId02,_amountHnq)
            //[1,2]
            await expect(this.crowdfundPools.getPartialUserJoinedIdList(_proposer,"0","2"))
              .to.be.revertedWith("Index wrong")
            await expect(this.crowdfundPools.getPartialUserJoinedIdList(_proposer,"0","3"))
              .to.be.revertedWith("Index wrong")
            let userJoinedlist = await this.crowdfundPools.getPartialUserJoinedIdList(this.depositUser1.address,"0","1")
            expect(userJoinedlist[0]).to.be.equal("1")
            expect(userJoinedlist[1]).to.be.equal("2")

        })
    })

    it("destroyHNQ func", async function () {
        let _proposer = this.owner.address.toString()

        _targetAmount = await withDecimals("1000000000")
        _openAmount  = await withDecimals("500000000")

        let initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
        await this.pledgeToken.mint(this.owner.address,initAmount)
        await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
        let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
        await this.hnqToken.mint(_proposer,payHnqAmount)
        await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

        await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
          _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

        await this.pledgeToken.mint(this.owner.address,initAmount)
        await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
        payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
        await this.hnqToken.mint(_proposer,payHnqAmount)
        await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

        await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
          _dividendRatio,_duration,_maxJoinAmount,_targetAmount)

        let _curPoolId = await this.crowdfundPools.poolId()

        // branch 02 : on duration
        //depositUser1
        let _amountHnq = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(10)
        await this.pledgeToken.mint(this.depositUser1.address,_targetAmount)
        await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount)
        await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
        await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)

        //depositUser2
        await this.pledgeToken.mint(this.depositUser2.address,_targetAmount)
        await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount)
        await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
        await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

        //depositUser3

        await this.pledgeToken.mint(this.depositUser3.address,_targetAmount)
        await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_targetAmount)
        await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
        await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)
        // exceeds duration
        await time.advanceTimeAndBlock(ONE_DAY*2)
        expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("2")

        await expect(this.crowdfundPools.connect(this.depositUser3).withdraw(_curPoolId))
          .to.be.revertedWith("withdraw: not success")

        //set winnedDataOfPools[_pid].isCompleted == true
        await this.crowdfundPools.smodify.put({
            winnedDataOfPools:{"2" : {isCompleted : true}}
        });
        console.log("getWinnedDataOfPool-2:",_curPoolId.toString(),await this.crowdfundPools.getWinnedDataOfPool(_curPoolId,"10"))
        expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")
        //set user.wonAmount
        let user1WonAmount = await withDecimals("160000000")
        let user2WonAmount = await withDecimals("170000000")
        let user3WonAmount = await withDecimals("170000000")

        await this.crowdfundPools.smodify.put({//depositUser1
            userInfo:{"2" : { "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f": {wonAmount :user1WonAmount} }}
        });
        await this.crowdfundPools.smodify.put({//depositUser2
            userInfo:{"2" : { "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720": {wonAmount :user2WonAmount} }}
        });
        await this.crowdfundPools.smodify.put({//depositUser3
            userInfo:{"2" : { "0xBcd4042DE499D14e55001CcbB24a551F3b954096": {wonAmount :user3WonAmount} }}
        });

        //depositUser1
        let ticketInfoOfPool_2 = await this.crowdfundPools.ticketInfoOfPool(_curPoolId);
        let multiCostHnq = ticketInfoOfPool_2.multiCostHnq;
        let user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser1.address)
        await this.crowdfundPools.connect(this.depositUser1).withdraw(_curPoolId)

        //depositUser2
        user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser2.address)
        await this.crowdfundPools.connect(this.depositUser2).withdraw(_curPoolId)

        //depositUser3
        user = await this.crowdfundPools.userInfo(await this.crowdfundPools.poolId(),this.depositUser3.address)
        await this.crowdfundPools.connect(this.depositUser3).withdraw(_curPoolId)
        expect(await this.pledgeToken.balanceOf(this.depositUser3.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user3WonAmount))
        expect(await this.hnqToken.balanceOf(this.depositUser3.address)).to.be.equal(
          BigNumber.from(_targetAmount).sub(user3WonAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(multiCostHnq)
        )

        let thisHnqBal_before = await this.hnqToken.balanceOf(this.crowdfundPools.address)
        console.log("thisHnqBal_before",BigNumber.from(thisHnqBal_before).div(oneHNQ).toString());
        await this.crowdfundPools.connect(this.depositUser1).destroyHNQ(_curPoolId)
        let thisHnqBal_after = await this.hnqToken.balanceOf(this.crowdfundPools.address)
        console.log("thisHnqBal_after",BigNumber.from(thisHnqBal_after).div(oneHNQ).toString());
        expect(BigNumber.from(thisHnqBal_before).sub(thisHnqBal_after)).to.equal(
          BigNumber.from(user3WonAmount).add(user2WonAmount).add(user1WonAmount).div(_baseHipAmountPerHnq).mul(oneHNQ).mul(multiCostHnq)
        )
        // expect(await this.pledgeToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user1WonAmount))
        // expect(await this.hnqToken.balanceOf(this.depositUser1.address)).to.be.equal(BigNumber.from(_targetAmount).sub(user1WonAmount).div(_baseHipAmountPerHnq))
        await expect(this.crowdfundPools.connect(this.depositUser3).destroyHNQ(_curPoolId))
          .to.be.revertedWith("Already destroyed")

    })

    it("batchCreateNFT func", async function () {
        let _proposer = this.owner.address.toString()
        let _amountHnq = await withDecimals("100")
        let _depositAmount = BigNumber.from(_baseHipAmountPerHnq).mul(_amountHnq).div(oneHNQ)
        let initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
        await this.pledgeToken.mint(this.owner.address,initAmount)
        await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
        let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
        await this.hnqToken.mint(_proposer,payHnqAmount)
        await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

        await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
          _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
        let _curPoolId = await this.crowdfundPools.poolId()

        // on duration
        //depositUser1
        _amountHnq = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ)
        await this.pledgeToken.mint(this.depositUser1.address,_targetAmount)
        await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount)
        await this.hnqToken.mint(this.depositUser1.address,_amountHnq)
        await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)

        //depositUser2
        await this.pledgeToken.mint(this.depositUser2.address,_targetAmount)
        await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount)
        await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
        await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

        //depositUser3
        await this.pledgeToken.mint(this.depositUser3.address,_targetAmount)
        await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_targetAmount)
        await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
        await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)
        // exceeds duration
        await time.advanceTimeAndBlock(ONE_DAY*2)
        expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("2")
        await expect(this.crowdfundPools.connect(this.owner).batchCreateNFT(_curPoolId))
          .to.be.revertedWith("crowdfund is not success")

        //set winnedDataOfPools[_pid].isCompleted == true
        await this.crowdfundPools.smodify.put({
            winnedDataOfPools:{"1" : {isCompleted : true}}
        });
        expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

        await this.base.initialize(
          this.nftFactory.address, this.mysteryBox.address, this.mockDemocracy.address,
          this.crowdfundPools.address,this.idProvider.address,this.externalNftBase.address
        );

        let _collectionName = "testClName";
        let _collectionDesc = "testClDesc";
        let _collectionUrl = "testClUrl";
        // let _workNames = ["work1","work2","work3","work4","work5"];
        // let _urls = ["url1","url2","url3","url4","url5"];
        let _workNames = ["work1","work2","work3","work4","work5","work6","work7","work8","work9","work10"];
        let _urls = ["url1","url2","url3","url4","url5","url6","url7","url8","url9","url10"];
        let _completeNftNums =[] ;
        let _compToFragNftNums =[] ;
        let _fragNumPerCompNFTs =[] ;
        let workLen = 10;
        for(let i = 0;i < workLen;i++) {
            // _completeNftNums.push(i+1);//[1,2,3,4,5,];
            // _compToFragNftNums.push(i+6);//[6,7,8,9,10];
            // _fragNumPerCompNFTs.push(10);//[10,10,10,10,10];
            _completeNftNums.push(i+1);
            _compToFragNftNums.push(i+11);
            _fragNumPerCompNFTs.push(19);
        }


        await this.base.addWorks(
          _collectionName, _collectionDesc, _collectionUrl, _workNames,
          _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
        );
        //set poolInfo["1"].proposalId == 1
        let _collectId = BigNumber.from("1");
        await this.crowdfundPools.smodify.put({
            poolInfo:{"1" : { proposalId: _collectId }}
        });
        expect(await this.base.getCollectLen(_collectId)).to.be.equal(workLen)
        //console.log(await this.base.getFieldArrayOfWorksOfCollect(_collectId))

        await expect(this.crowdfundPools.connect(this.owner).batchCreateNFT("100"))
          .to.be.revertedWith("Only odd proposalId can create NFT")

        await this.crowdfundPools.batchCreateNFT(_curPoolId)
        let workIds = await this.base.getAllWorkIdsOfCollection(_collectId)
        let work;
        for(let i = 0;i < workLen;i++) {
            expect(await this.crowdfundPools.workId2PoolId(workIds[i])).to.be.equal(_curPoolId)
            work = await this.base.works(workIds[i])
            console.log(work.completeNftId.toString())
            expect(BigNumber.from(work.completeNftId).gt("0")).to.be.equal(true)
        }

    })

    it("calculateSurplusInfo, getWonInfo func", async function () {
        this.timeout(400000)
        let _proposer = this.owner.address.toString()
        _targetAmount = BigNumber.from(_targetAmount).mul(10)
        let initAmount = BigNumber.from(_targetAmount).sub(_openAmount )
        await this.pledgeToken.mint(this.owner.address,initAmount)
        await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
        let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
        await this.hnqToken.mint(_proposer,payHnqAmount)
        await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

        await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount ,
          _dividendRatio,_duration,_maxJoinAmount,_targetAmount)
        let _curPoolId = await this.crowdfundPools.poolId()

        // branch 02 : on duration
        //depositUser1
        let  _amountHnq = BigNumber.from(_targetAmount).div(_baseHipAmountPerHnq).mul(oneHNQ)
        await this.pledgeToken.mint(this.depositUser1.address,BigNumber.from(_amountHnq).mul(_targetAmount))
        //await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount)
        await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,BigNumber.from(_targetAmount).mul(2))
        await this.hnqToken.mint(this.depositUser1.address,BigNumber.from(_amountHnq).mul(2))
        await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).mul(2))
        //await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,BigNumber.from(_amountHnq).mul(2))

        //depositUser2
        await this.pledgeToken.mint(this.depositUser2.address,_targetAmount)
        await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount)
        await this.hnqToken.mint(this.depositUser2.address,_amountHnq)
        await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,_amountHnq)

        //depositUser3
        await this.pledgeToken.mint(this.depositUser3.address,_targetAmount)
        await this.pledgeToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_targetAmount)
        await this.hnqToken.mint(this.depositUser3.address,_amountHnq)
        await this.hnqToken.connect(this.depositUser3).approve(this.crowdfundPools.address,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser3).deposit(_curPoolId,_amountHnq)

        //depositUser4 //deposit 10,000,000
        await this.pledgeToken.mint(this.depositUser4.address,BigNumber.from(_targetAmount).div(10))
        await this.pledgeToken.connect(this.depositUser4).approve(this.crowdfundPools.address,BigNumber.from(_targetAmount).div(10))
        await this.hnqToken.mint(this.depositUser4.address,BigNumber.from(_amountHnq).div(10))
        await this.hnqToken.connect(this.depositUser4).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).div(10))
        await this.crowdfundPools.connect(this.depositUser4).deposit(_curPoolId,BigNumber.from(_amountHnq).div(10))

        // exceeds duration
        await time.advanceTimeAndBlock(ONE_DAY*2)

        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.owner.address)).to.be.equal("0")
        await expect(this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,600))
          .to.be.revertedWith('Draw lots do not complete')
        // completed drawLots
        await this.crowdfundPools.setWinnedDataOfPools02(_curPoolId)
        // set again
        await this.crowdfundPools.setWinnedDataOfPools02(_curPoolId)

        expect(await this.crowdfundPools.getCrowdfundStatus(_curPoolId)).to.be.equal("1")

        let user3WonAmount = await withDecimals("20000000")
        let user4WonAmount = await withDecimals("20000000")

        await this.crowdfundPools.smodify.put({
            userInfo:{"1" : { "0xBcd4042DE499D14e55001CcbB24a551F3b954096": {wonAmount :user3WonAmount} }}
        });
        await this.crowdfundPools.smodify.put({
            userInfo:{"1" : { "0x71bE63f3384f5fb98995898A86B02Fb2426c5788": {wonAmount :user4WonAmount} }}
        });

        //await this.crowdfundPools.connect(this.depositUser1).destroyHNQ(_curPoolId)
        //set winning data
        let winningRate = 23;
        await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"1",1)
        await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"1",3)
        //await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"1",8)
        // await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"1",5)

        await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"2",19)
        await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"2",27)
        await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"2",77)

        // await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"3",112)
        // await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"3",437)
        // await this.crowdfundPools.setWinnedDataOfPools(_curPoolId,"3",937)

        //set highestPosition highestPosi[_pid]
        await this.crowdfundPools.smodify.put({highestPosi:{"1" : "3"}});
        let user;
        let surUserInfo

        user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser2.address)
        console.log(user.toString())
        surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser2.address)
        console.log(surUserInfo.toString())
        await this.crowdfundPools.connect(this.depositUser2).calculateSurplusInfo(_curPoolId,2000)
        surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser2.address)
        console.log("user2_surUserInfo",surUserInfo.toString())
        expect(surUserInfo.countedWonAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).mul(winningRate).div(100))

        //getWonInfo
        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser2.address))
          .to.be.equal(BigNumber.from(_targetAmount).mul(winningRate).div(100))

        user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
        console.log("user1_Info",user.toString())
        surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
        console.log("user1_surInfo",surUserInfo.toString())
        await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,600)
        surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
        console.log("1 -surUserInfo",surUserInfo.toString())
        await expect(this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address))
          .to.be.revertedWith('Not counted the user amount')

        user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
        console.log(user.toString())

        await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,400)
        surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
        console.log("2 -surUserInfo",surUserInfo.toString())
        expect(surUserInfo.countedWonAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).mul(winningRate).div(100))

        await expect(this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address))
          .to.be.revertedWith('Not counted the user amount')

        user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
        console.log(user.toString())
        surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
        console.log(surUserInfo.toString())
        await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,1000)
        surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
        console.log("3 -surUserInfo",surUserInfo.toString())
        expect(surUserInfo.countedWonAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).mul(2).mul(winningRate).div(100))

        await expect(this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,600))
          .to.be.revertedWith('Already get won amount')

        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address))
          .to.be.equal(BigNumber.from(_targetAmount).mul(2).mul(winningRate).div(100))

        user4WonAmount = await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser4.address)
        console.log("user4WonAmount:",user4WonAmount.toString())
        expect(user4WonAmount.toString()).to.be.equal(BigNumber.from(_targetAmount).div(10).mul(winningRate).div(100))


        //outside user' wonAmount is 0
        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.user.address)).to.be.equal("0")
        await expect(this.crowdfundPools.connect(this.depositUser4).calculateSurplusInfo(_curPoolId,100))
          .to.be.revertedWith('Not surplus user')

    })

    it("calculateSurplusInfo, getWonInfo func when full exactly", async function () {
        this.timeout(400000)
        let _proposer = this.owner.address.toString()
        let _targetAmount02 = await withDecimals("100000000")
        let _openAmount02  = await withDecimals("50000000")
        let initAmount = BigNumber.from(_targetAmount02).sub(_openAmount02)
        await this.pledgeToken.mint(this.owner.address,initAmount)
        await this.pledgeToken.approve(this.crowdfundPools.address,initAmount)
        let payHnqAmount = BigNumber.from(initAmount).div(_baseHipAmountPerHnq).mul(await withDecimals(1))
        await this.hnqToken.mint(_proposer,payHnqAmount)
        await this.hnqToken.connect(this.owner).approve(this.crowdfundPools.address,payHnqAmount)

        await this.crowdfundPools.connect(this.mockDemocracy).add(_proposalId,_proposer,_openAmount02 ,
          _dividendRatio,_duration,_maxJoinAmount,_targetAmount02)
        let _curPoolId = await this.crowdfundPools.poolId()

        // branch 02 : on duration
        //depositUser1
        let  _amountHnq = BigNumber.from(_openAmount02).div(_baseHipAmountPerHnq).mul(oneHNQ)
        await this.pledgeToken.mint(this.depositUser1.address,BigNumber.from(_amountHnq).mul(_targetAmount02))
        //await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,_targetAmount02)
        await this.pledgeToken.connect(this.depositUser1).approve(this.crowdfundPools.address,BigNumber.from(_targetAmount02).mul(2))
        await this.hnqToken.mint(this.depositUser1.address,BigNumber.from(_amountHnq).div(2))
        await this.hnqToken.connect(this.depositUser1).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).div(2))
        //await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,_amountHnq)
        await this.crowdfundPools.connect(this.depositUser1).deposit(_curPoolId,BigNumber.from(_amountHnq).div(2))

        //depositUser2
        await this.pledgeToken.mint(this.depositUser2.address,_targetAmount02)
        await this.pledgeToken.connect(this.depositUser2).approve(this.crowdfundPools.address,_targetAmount02)
        await this.hnqToken.mint(this.depositUser2.address,BigNumber.from(_amountHnq).div(2))
        await this.hnqToken.connect(this.depositUser2).approve(this.crowdfundPools.address,BigNumber.from(_amountHnq).div(2))
        await this.crowdfundPools.connect(this.depositUser2).deposit(_curPoolId,BigNumber.from(_amountHnq).div(2))

        // exceeds duration
        await time.advanceTimeAndBlock(ONE_DAY*2)

        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.owner.address)).to.be.equal(0)
        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)).to.be.equal(0)
        // completed drawLots
        //await this.crowdfundPools.setWinnedDataOfPools02(_curPoolId)
        await expect(this.crowdfundPools.drawLots(_curPoolId,await time.latestTime()))
        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.owner.address)).to.be.equal(initAmount)

        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)).to.be.equal(BigNumber.from(_openAmount02).div(2))

        user = await this.crowdfundPools.userInfo(_curPoolId,this.depositUser1.address)
        console.log("user1_Info",user.toString())
        surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
        console.log("user1_surInfo",surUserInfo.toString())
        await this.crowdfundPools.connect(this.depositUser1).calculateSurplusInfo(_curPoolId,100)
        surUserInfo = await this.crowdfundPools.surplusInfo(_curPoolId,this.depositUser1.address)
        console.log("1 -surUserInfo",surUserInfo.toString())
        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)).to.be.equal(BigNumber.from(_openAmount02).div(2))
        expect(surUserInfo.countedWonAmount).to.be.equal(BigNumber.from(_openAmount02).div(2))
        expect(surUserInfo.nextStart).to.be.equal(BigNumber.from(_openAmount02).div(2).div(_baseHipAmountPerHnq).add(1))
        expect(await this.crowdfundPools.getWonInfo(_curPoolId,this.depositUser1.address)).to.be.equal(BigNumber.from(_openAmount02).div(2))

        await expect(this.crowdfundPools.connect(this.depositUser1).withdraw(_curPoolId))
          .to.be.revertedWith("Not unwinned amount")

    })


})
