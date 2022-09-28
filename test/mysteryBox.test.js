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
describe("MysteryBox func",async function() {
    this.timeout("800000")
    let _targetAmount = await withDecimals("10000000");
    let _basePayAmount = await withDecimals("100000");

    before(async function () {
        this.signers = await ethers.getSigners()
        owner = this.signers[0]
        user = this.signers[1]
        alice = this.signers[2]
        bob = this.signers[3];
        cloud = this.signers[4];

        this.MysteryBox = await smoddit("MysteryBox");
        this.MBPoolAdmin = await smoddit("MBPoolAdmin");
        this.ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    })

    beforeEach(async function (){
        this.hipToken = await this.ERC20Mock.deploy("hip token", "hip");
        await this.hipToken.deployed()
        await this.hipToken.mint(owner.address,_targetAmount)
        await this.hipToken.mint(user.address,_targetAmount)
        await this.hipToken.mint(alice.address,_targetAmount)

        this.mysteryBox = await this.MysteryBox.deploy();
        await this.mysteryBox.deployed();

        this.mbPoolAdmin = await this.MBPoolAdmin.deploy();
        await this.mbPoolAdmin.deployed();
        console.log("this.mbPoolAdmin.address",this.mbPoolAdmin.address);
        await this.mbPoolAdmin.initialize(
          this.hipToken.address,
          this.mysteryBox.address,
          _basePayAmount
        )

        await this.mysteryBox.initialize(owner.address,this.mbPoolAdmin.address);
    });

    it("test initialize", async function() {
        expect(await this.mysteryBox.owner()).to.equal(owner.address);
        expect(await this.mysteryBox.admin(owner.address)).to.equal(true);
        expect(await this.mysteryBox.pools(0)).to.equal(0);
        expect(await this.mysteryBox.poolsIndex(0)).to.equal(1);
        expect(await this.mysteryBox.minFeeRatio()).to.equal(500);
        expect(await this.mysteryBox.maxFeeDiscount()).to.equal(0);
        let boxPool = await this.mysteryBox.boxPools(0);
        expect(boxPool.poolId).to.equal(0);
        expect(boxPool.name).to.equal("main");
        expect(boxPool.price).to.equal(await withDecimals(1));
        expect(boxPool.feeRatio).to.equal(500);
        expect(boxPool.ownerRatio).to.equal(7000);
        expect(boxPool.fundRatio).to.equal(500);
        expect(boxPool.rewardRatio).to.equal(2000);
        expect(boxPool.isValid).to.equal(true);
    });

    it("test setAdmin", async function() {
        await expect(this.mysteryBox.connect(bob).setAdmin(alice.address,true,{from:bob.address})).revertedWith("MysteryBox: caller is not the owner");
        await this.mysteryBox.setAdmin(alice.address,true);
        expect(await this.mysteryBox.admin(alice.address)).to.equal(true);
    });


    it("test createPool", async function() {
        this.timeout("80000")
        await this.mysteryBox.setInternalCaller(owner.address,true);
        await this.mysteryBox.setMaxFeeDiscount(300)
        await expect(this.mysteryBox.connect(bob).createPool(300,4000,2700,3000,await withDecimals(1),"part",{from:bob.address})).revertedWith("MysteryBox: caller is not a admin");
        await expect(this.mysteryBox.createPool(300,4000,2800,3000,await withDecimals(1),"part")).revertedWith("Ration sum not equ 100%");
        await expect(this.mysteryBox.createPool(200,4000,2800,3000,await withDecimals(1),"part")).revertedWith("feeRatio less than maxFeeDiscount");
        //uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_, uint price_, string memory name_
        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part");
        //isPoolExisted
        expect(await this.mysteryBox.isPoolExisted(1)).to.equal(true);
        expect(await this.mysteryBox.pools(1)).to.equal(1);
        expect(await this.mysteryBox.poolsIndex(1)).to.equal(2);
        expect(await this.mysteryBox.minFeeRatio()).to.equal(300);
        expect(await this.mysteryBox.maxFeeDiscount()).to.equal(300);
        let boxPool = await this.mysteryBox.boxPools(1);
        expect(boxPool.poolId).to.equal(1);
        expect(boxPool.name).to.equal("part");
        expect(boxPool.price).to.equal(await withDecimals(1));
        expect(boxPool.feeRatio).to.equal(300);
        expect(boxPool.ownerRatio).to.equal(4000);
        expect(boxPool.fundRatio).to.equal(2700);
        expect(boxPool.rewardRatio).to.equal(3000);
        expect(boxPool.isValid).to.equal(true);

        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(2),"part2");
        let boxPool2 = await this.mysteryBox.getBoxPool(2);
        expect(boxPool2.poolId).to.equal(2);
        expect(boxPool2.name).to.equal("part2");
        expect(boxPool2.price).to.equal(await withDecimals(2));
        expect(boxPool2.feeRatio).to.equal(300);
        expect(boxPool2.ownerRatio).to.equal(4000);
        expect(boxPool2.fundRatio).to.equal(2700);
        expect(boxPool2.rewardRatio).to.equal(3000);
        expect(boxPool2.isValid).to.equal(true);

        //'alice' as external project parties
        await expect(this.mysteryBox.connect(alice).createPool(300,4000,2700,3000,await withDecimals(1),"part")).revertedWith("MysteryBox: caller is not a admin");
        expect(await this.mysteryBox.isAllowedPoolCreator(alice.address)).to.equal(false);

        await this.hipToken.connect(alice).approve(this.mbPoolAdmin.address,_basePayAmount);
        await this.mbPoolAdmin.connect(alice).payToQualifyForCreateMBPool(300,4000,2700,3000,await withDecimals(3),"part3");

        let boxPool3 = await this.mysteryBox.getBoxPool(3);
        expect(boxPool3.poolId).to.equal(3);
        expect(boxPool3.name).to.equal("part3");
        expect(boxPool3.price).to.equal(await withDecimals(3));
        expect(boxPool3.feeRatio).to.equal(300);
        expect(boxPool3.ownerRatio).to.equal(4000);
        expect(boxPool3.fundRatio).to.equal(2700);
        expect(boxPool3.rewardRatio).to.equal(3000);
        expect(boxPool3.isValid).to.equal(true);
    });

    it("test deletePool", async function() {
        await expect(this.mysteryBox.connect(bob).deletePool(1)).revertedWith("MysteryBox: caller is not a admin");
        await expect(this.mysteryBox.deletePool(1)).revertedWith("Not exist the child pool");
        //uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_, uint price_, string memory name_
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"part1");
        await this.mysteryBox.createPool(400,3900,2700,3000,await withDecimals(1),"part2");
        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part3");
        await this.mysteryBox.createPool(200,4100,2700,3000,await withDecimals(1),"part4");
        var partialPools = await this.mysteryBox.getPartialPools(1,4);
        expect(partialPools.length).to.equal(4);

        var minFeeRatio = await this.mysteryBox.minFeeRatio();
        expect(minFeeRatio).to.equal(200);
        await this.mysteryBox.deletePool(4);

        await expect(this.mysteryBox.getPartialPools(1,4)).revertedWith("Index wrong");

        var partialPools = await this.mysteryBox.getPartialPools(1,3);
        expect(partialPools.length).to.equal(3);

        var minFeeRatio = await this.mysteryBox.minFeeRatio();
        expect(minFeeRatio).to.equal(300);

        var poolId = await this.mysteryBox.pools(1);
        var index = await this.mysteryBox.poolsIndex(4);
        console.log("poolId is:",poolId.toString());
        console.log("index is:",index.toString());
        expect(poolId).to.equal(1);
        expect(index).to.equal(0);

        await this.mysteryBox.deletePool(1);
        var poolId = await this.mysteryBox.pools(1);
        var index = await this.mysteryBox.poolsIndex(3);
        console.log("poolId is:",poolId.toString());
        console.log("index is:",index.toString());
        expect(poolId).to.equal(3);
        expect(index).to.equal(2);

        await this.mysteryBox.deletePool(2);
        var poolId = await this.mysteryBox.pools(1);
        var index = await this.mysteryBox.poolsIndex(poolId.toString());
        console.log("poolId is:",poolId.toString());
        console.log("index is:",index.toString());
        expect(poolId).to.equal(3);
        expect(index).to.equal(2);

        await this.mysteryBox.deletePool(3);

        var poolId = await this.mysteryBox.pools(0);
        var index = await this.mysteryBox.poolsIndex(poolId.toString());
        console.log("poolId is:",poolId.toString());
        console.log("index is:",index.toString());
        expect(poolId).to.equal(0);
        expect(index).to.equal(1);


        var minFeeRatio = await this.mysteryBox.minFeeRatio();
        expect(minFeeRatio).to.equal(500);
    });

    it("test amendMinFeeRatio", async function() {
        await this.mysteryBox.setInternalCaller(owner.address,true);
        await expect(this.mysteryBox.setMaxFeeDiscount(501)).revertedWith("MaxFeeDiscount must be less or equ to minFeeRatio");
        await this.mysteryBox.setMaxFeeDiscount(140)
        //uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_, uint price_, string memory name_
        await expect(this.mysteryBox.amendMinFeeRatio(150)).revertedWith("No need to amend minFeeRatio");
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"part1");
        await this.mysteryBox.createPool(400,3900,2700,3000,await withDecimals(1),"part2");
        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part3");
        await this.mysteryBox.createPool(200,4100,2700,3000,await withDecimals(1),"part4");
        var minFeeRatio = await this.mysteryBox.minFeeRatio();
        expect(minFeeRatio).to.equal(200);
        for(var i = 0;i<30;i++){
            await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"part1");
            await this.mysteryBox.createPool(400,3900,2700,3000,await withDecimals(1),"part2");
            await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part3");
            await this.mysteryBox.createPool(200,4100,2700,3000,await withDecimals(1),"part4");
        }

        //minFeeRatio == 200,maxFeeDiscount == 0
        await this.mysteryBox.amendMinFeeRatio(150);
        var minFeeRatio = await this.mysteryBox.minFeeRatio();
        expect(minFeeRatio).to.equal(150);

        await expect(this.mysteryBox.amendMinFeeRatio(600)).revertedWith("Parameter is error");
    });

    it("test setPoolShareRatio", async function() {
        //uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_, uint price_, string memory name_
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"part1");
        await this.mysteryBox.createPool(400,3900,2700,3000,await withDecimals(1),"part2");
        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part3");
        await this.mysteryBox.createPool(250,4100,2650,3000,await withDecimals(1),"part4");
        //getPoolCount
        expect(await this.mysteryBox.getPoolCount()).to.equal("5")
        await this.mysteryBox.deletePool(2);
        //uint poolId_, uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_
        await expect(this.mysteryBox.setPoolShareRatio(10,200,4100,2700,3000)).to.revertedWith("Not exist the pool");
        await expect(this.mysteryBox.setPoolShareRatio(2,200,4100,2700,3000)).to.revertedWith("Not exist the pool");
        await expect(this.mysteryBox.setPoolShareRatio(1,300,4100,2800,2900)).to.revertedWith("Ration sum not equ 100%");
        await this.mysteryBox.setInternalCaller(owner.address,true);
        await this.mysteryBox.setMaxFeeDiscount(140)
        await expect(this.mysteryBox.setPoolShareRatio(1,100,4200,2800,2900)).to.revertedWith("feeRatio less than maxFeeDiscount");
        await expect(this.mysteryBox.connect(bob).setPoolShareRatio(2,200,4100,2700,3000,{from:bob.address})).to.revertedWith("MysteryBox: caller is not a admin");
        var boxPool = await this.mysteryBox.boxPools(1);
        expect(boxPool.poolId).to.equal(1);
        expect(boxPool.name).to.equal("part1");
        expect(boxPool.price).to.equal(await withDecimals(1));
        expect(boxPool.feeRatio).to.equal(600);
        expect(boxPool.ownerRatio).to.equal(3700);
        expect(boxPool.fundRatio).to.equal(2700);
        expect(boxPool.rewardRatio).to.equal(3000);
        expect(boxPool.isValid).to.equal(true);
        await this.mysteryBox.setPoolShareRatio(1,200,4100,2800,2900);
        var boxPool = await this.mysteryBox.boxPools(1);
        expect(boxPool.poolId).to.equal(1);
        expect(boxPool.name).to.equal("part1");
        expect(boxPool.price).to.equal(await withDecimals(1));
        expect(boxPool.feeRatio).to.equal(200);
        expect(boxPool.ownerRatio).to.equal(4100);
        expect(boxPool.fundRatio).to.equal(2800);
        expect(boxPool.rewardRatio).to.equal(2900);
        expect(boxPool.isValid).to.equal(true);

        await this.mysteryBox.setPoolShareRatio(1,600,4100,2800,2500);
        var poolInfo = await this.mysteryBox.getPoolInfo(1);
        //getPoolCount
        console.log("poolInfo",poolInfo.toString())
        expect(poolInfo[0]).to.equal(await withDecimals(1));
        expect(poolInfo[1][0]).to.equal(600);
        expect(poolInfo[1][1]).to.equal(4100);
        expect(poolInfo[1][2]).to.equal(2800);
        expect(poolInfo[1][3]).to.equal(2500);
        expect(poolInfo[2]).to.equal(true);
        expect(poolInfo[3]).to.equal("part1");

        await expect(this.mysteryBox.getPoolInfo(10)).to.revertedWith("Not exist the pool");

    });

    it("test setPoolPrice", async function() {
        //uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_, uint price_, string memory name_
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"part1");
        await this.mysteryBox.createPool(400,3900,2700,3000,await withDecimals(1),"part2");
        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part3");
        await this.mysteryBox.createPool(200,4100,2700,3000,await withDecimals(1),"part4");
        await this.mysteryBox.deletePool(2);
        //uint poolId_, uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_
        await expect(this.mysteryBox.setPoolPrice(10,200)).to.revertedWith("Not exist the pool");
        await expect(this.mysteryBox.setPoolPrice(2,200)).to.revertedWith("Not exist the pool");
        await expect(this.mysteryBox.connect(bob).setPoolPrice(2,200,{from:bob.address})).to.revertedWith("MysteryBox: caller is not a admin");
        await this.mysteryBox.setPoolPrice(1,200);
        var boxPool = await this.mysteryBox.boxPools(1);
        expect(boxPool.poolId).to.equal(1);
        expect(boxPool.name).to.equal("part1");
        expect(boxPool.price).to.equal(200);
    });

    it("test setPoolValidity", async function() {
        //uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_, uint price_, string memory name_
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"part1");
        await this.mysteryBox.createPool(400,3900,2700,3000,await withDecimals(1),"part2");
        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part3");
        await this.mysteryBox.createPool(200,4100,2700,3000,await withDecimals(1),"part4");
        await this.mysteryBox.deletePool(2);
        //uint poolId_, uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_
        await expect(this.mysteryBox.setPoolValidity(10,false)).to.revertedWith("Not exist the pool");
        await expect(this.mysteryBox.setPoolValidity(2,false)).to.revertedWith("Not exist the pool");
        await expect(this.mysteryBox.connect(bob).setPoolValidity(2,false,{from:bob.address})).to.revertedWith("MysteryBox: caller is not a admin");
        await this.mysteryBox.setPoolValidity(1,false);
        var boxPool = await this.mysteryBox.boxPools(1);
        expect(boxPool.poolId).to.equal(1);
        expect(boxPool.name).to.equal("part1");
        expect(boxPool.isValid).to.equal(false);
        await this.mysteryBox.setPoolValidity(1,true);
        var boxPool = await this.mysteryBox.boxPools(1);
        expect(boxPool.isValid).to.equal(true);
    });


    it("test setPoolName", async function() {
        //uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_, uint price_, string memory name_
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"part1");
        await this.mysteryBox.createPool(400,3900,2700,3000,await withDecimals(1),"part2");
        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part3");
        await this.mysteryBox.createPool(200,4100,2700,3000,await withDecimals(1),"part4");
        await this.mysteryBox.deletePool(2);
        //uint poolId_, uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_
        await expect(this.mysteryBox.setPoolName(10,"setPoolNameTest")).to.revertedWith("Not exist the pool");
        await expect(this.mysteryBox.setPoolName(2,"setPoolNameTest")).to.revertedWith("Not exist the pool");
        await expect(this.mysteryBox.connect(bob).setPoolName(2,"setPoolNameTest",{from:bob.address})).to.revertedWith("MysteryBox: caller is not a admin");
        await this.mysteryBox.setPoolName(1,"setPoolNameTest");
        var boxPool = await this.mysteryBox.boxPools(1);
        expect(boxPool.poolId).to.equal(1);
        expect(boxPool.name).to.equal("setPoolNameTest");
        await this.mysteryBox.setPoolName(1,"setPoolNameTest2");
        var boxPool = await this.mysteryBox.boxPools(1);
        expect(boxPool.name).to.equal("setPoolNameTest2");
    });

    it("test createPackage", async function() {
        this.timeout("100000")
        //createPackage(uint worksId_, uint NFTtokenId_, uint count_, uint poolId_, address operator_)
        let didNotExistPooId = "100";
        const mainPoolId = "0";
        await expect(this.mysteryBox.createPackage(10,320,20,didNotExistPooId,owner.address)).to.revertedWith("Internalable: caller is not a internal caller");
        await this.mysteryBox.setInternalCaller(owner.address,true);
        console.log("internalCaller is:",await this.mysteryBox.internalCaller(owner.address));
        await expect(this.mysteryBox.createPackage(10,320,20,didNotExistPooId,owner.address)).to.revertedWith("Not exist this pool");
        //uint worksId_, uint NFTtokenId_, uint count_
        await this.mysteryBox.createPackage(10,320,20,mainPoolId,owner.address);
        let pack = await this.mysteryBox.boxPackages(10);
        // await expect(pack.worksId).to.equal(10);
        await expect(pack.total).to.equal(20);
        await expect(pack.remained).to.equal(20);
        await expect(pack.unsoldTotal).to.equal(20);
        await expect(pack.state).to.equal(1);

        await expect(this.mysteryBox.getPackageNFTCount(666)).to.revertedWith("The mysteryBox is not created");
        let pack_ = await this.mysteryBox.getPackageNFTCount(10);
        await expect(pack_[0]).to.equal(20);
        await expect(pack_[1]).to.equal(20);
        await expect(pack_[2]).to.equal(20);

        await expect((await this.mysteryBox.getPackageNFTtokenID(10))[0]).to.equal(320);
        await expect((await this.mysteryBox.getPackageNFTsLength(10))).to.equal(1);
        await expect((await this.mysteryBox.getPackageNFTInfo(10,0))[1]).to.equal(20);
        await expect((await this.mysteryBox.getPackageNFTInfo(10,0))[2]).to.equal(20);
        await expect((await this.mysteryBox.getPacakgePool(10,0))).to.equal(0);
        await expect((await this.mysteryBox.getPackageNFTremained(10,320))).to.equal(20);
        await expect((await this.mysteryBox.packages(0,0))).to.equal(10);
        await expect((await this.mysteryBox.packIndex(0,10))).to.equal(1);

        await expect(this.mysteryBox.preparePackage(10,320,20)).to.revertedWith("The MysteryBox has been created");
        await expect(this.mysteryBox.createPackage(10,320,20,mainPoolId,owner.address)).to.revertedWith("The MysteryBox has been created");

        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part");
        let subPoolId = "1";
        await expect(this.mysteryBox.createPackage(20,320,40,didNotExistPooId,owner.address)).to.revertedWith("Not exist this pool");
        await this.mysteryBox.createPackage(20,320,40,subPoolId,owner.address);

        // pay to get qualify to create excluding sub_pool
        await this.hipToken.connect(alice).approve(this.mbPoolAdmin.address,_basePayAmount);
        await this.mbPoolAdmin.connect(alice).payToQualifyForCreateMBPool(300,4000,2700,3000,await withDecimals(3),"part3");

        let excludPoolId = "2";
        await expect(this.mysteryBox.createPackage(20,320,20,excludPoolId,user.address)).to.revertedWith("The operator_ cannot put pack into this pool");
        await expect(this.mysteryBox.createPackage(20,320,20,excludPoolId,user.address)).to.revertedWith("The operator_ cannot put pack into this pool");

        await this.mysteryBox.createPackage(40,320,20,excludPoolId,alice.address);

        await this.mysteryBox.connect(alice).setIsAllowedUser(excludPoolId, [bob.address], true);
        await this.mysteryBox.createPackage(50,320,20,excludPoolId,bob.address);
        await expect(this.mysteryBox.createPackage(60,320,20,excludPoolId,cloud.address)).to.revertedWith("The operator_ cannot put pack into this pool");

    });

    //setIsAllowedPoolCreator and setIsAllowedUser
    it("test setIsAllowedPoolCreator and setIsAllowedUser", async function() {
        this.timeout("100000")
        let excludPoolId = "1";

        await this.hipToken.connect(alice).approve(this.mbPoolAdmin.address,_basePayAmount);
        await this.mbPoolAdmin.connect(alice).payToQualifyForCreateMBPool(300,4000,2700,3000,await withDecimals(3),"part1");
        await this.mysteryBox.connect(alice).setIsAllowedUser(excludPoolId, [bob.address,cloud.address], true);
        expect(await this.mysteryBox.isAllowedUser(excludPoolId,bob.address)).to.equal(true);
        expect(await this.mysteryBox.isAllowedUser(excludPoolId,cloud.address)).to.equal(true);

    });

    it("test preparePackage", async function() {
        await expect(this.mysteryBox.preparePackage(20,640,30)).to.revertedWith("Internalable: caller is not a internal caller");
        await this.mysteryBox.setInternalCaller(owner.address,true);
        //uint worksId_, uint NFTtokenId_, uint count_
        await this.mysteryBox.preparePackage(20,640,30);
        let pack = await this.mysteryBox.boxPackages(20);
        // await expect(pack.worksId).to.equal(10);
        await expect(pack.total).to.equal(30);
        await expect(pack.state).to.equal(0);
        await expect((await this.mysteryBox.getPackageNFTtokenID(20))[0]).to.equal(640);
        await expect((await this.mysteryBox.getPackageNFTsLength(20))).to.equal(1);
        await expect((await this.mysteryBox.getPackageNFTremained(20,640))).to.equal(30);
    });

    it("test putToPool", async function() {
        var poolId = 1;
        var workId = 10;
        //uint worksId_, uint poolId_
        // await expect(this.mysteryBox.putToPool(640,1)).to.revertedWith("MysteryBox: caller is not a admin");
        //Not exist the child pool
        await expect(this.mysteryBox.putToPool(640,1)).to.revertedWith("Not exist the child pool");

        //The mysteryBox is not exist or state is not ready
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"part1");
        await this.mysteryBox.createPool(400,3900,2700,3000,await withDecimals(1),"part2");
        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"part3");
        await this.mysteryBox.createPool(200,4100,2700,3000,await withDecimals(1),"part4");
        await expect(this.mysteryBox.putToPool(640,1)).to.revertedWith("The mysteryBox is not exist or state is not ready");
        await this.mysteryBox.setInternalCaller(owner.address,true);
        console.log("internalCaller is:",await this.mysteryBox.internalCaller(owner.address));

        await this.mysteryBox.createPackage(10,320,20,"0",owner.address);
        //isInPackage
        expect(await this.mysteryBox.isInPackage(10,320)).to.equal(true);
        expect(await this.mysteryBox.isInPackage(10,10000)).to.equal(false);
        await this.mysteryBox.putToPool(workId,poolId);
        await expect(this.mysteryBox.putToPool(workId,poolId)).to.revertedWith("The MysteryBox is already in the child pool");
        await expect(this.mysteryBox.deletePool(poolId)).revertedWith("The child pool has box packages");
        let storeIndex = await this.mysteryBox.packIndex(poolId,workId);
        console.log("storeIndex is:",storeIndex.toString());
        let storeWorkId = await this.mysteryBox.getPackage(poolId,storeIndex-1);
        expect(storeWorkId).to.equal(workId);
        var poolId = await this.mysteryBox.getPacakgePool(workId,1);
        console.log("poolId is :",poolId.toString());
        expect(await this.mysteryBox.getPackagePoolCount(workId)).to.equal("2");

        await expect(this.mysteryBox.getPackage(10,storeIndex-1)).to.revertedWith("Not exist the pool");
        await expect(this.mysteryBox.getPackageCount(10)).to.revertedWith("Not exist the pool");

        expect(await this.mysteryBox.getPackageCount(poolId)).to.equal("1");

    });

    it("test takeFromPool", async function() {
        var poolId = 1;
        var poolId2 = 2;
        var workId = 10;
        var workId2 = 20;
        var workId3 = 30;
        var workId4 = 40;
        var workId5 = 50;

        //uint worksId_, uint poolId_
        // await expect(this.mysteryBox.putToPool(640,1)).to.revertedWith("MysteryBox: caller is not a admin");
        //Not exist the child pool
        await expect(this.mysteryBox.takeFromPool(workId,poolId)).to.revertedWith("Not exist the child pool");

        //The mysteryBox is not exist or state is not ready
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"pool1");
        await this.mysteryBox.createPool(400,3900,2700,3000,await withDecimals(1),"pool2");
        await this.mysteryBox.createPool(300,4000,2700,3000,await withDecimals(1),"pool3");
        await this.mysteryBox.createPool(200,4100,2700,3000,await withDecimals(1),"pool4");
        await expect(this.mysteryBox.takeFromPool(workId,poolId)).to.revertedWith("The mysteryBox is not exist or state is not ready");
        await this.mysteryBox.setInternalCaller(owner.address,true);
        console.log("internalCaller is:",await this.mysteryBox.internalCaller(owner.address));
        //uint worksId_, uint NFTtokenId_, uint count_
        await this.mysteryBox.createPackage(workId,320,20,"0",owner.address);
        await this.mysteryBox.createPackage(workId2,320,20,"0",owner.address);
        await this.mysteryBox.createPackage(workId3,320,20,"0",owner.address);
        await this.mysteryBox.createPackage(workId4,320,20,"0",owner.address);
        await this.mysteryBox.createPackage(workId5,320,20,"0",owner.address);
        await this.mysteryBox.putToPool(workId,poolId);
        await this.mysteryBox.putToPool(workId,2);
        await this.mysteryBox.putToPool(workId2,poolId);
        await this.mysteryBox.putToPool(workId3,poolId);
        await this.mysteryBox.putToPool(workId4,poolId);
        await this.mysteryBox.putToPool(workId5,poolId2);
        var storeIndex = await this.mysteryBox.packIndex(poolId,workId);
        console.log("storeIndex is:",storeIndex.toString());
        var storeWorkId = await this.mysteryBox.getPackage(poolId,storeIndex-1);
        expect(storeWorkId).to.equal(workId);
        await expect(this.mysteryBox.takeFromPool(workId5,poolId)).to.revertedWith("The MysteryBox is not in the child pool");
        // await this.mysteryBox.takeFromPool(workId5,poolId2);
        // await this.mysteryBox.takeFromPool(workId5,poolId2);
        await this.mysteryBox.takeFromPool(workId,poolId);
        var storeIndex = await this.mysteryBox.packIndex(poolId,workId);
        expect(storeIndex).to.equal(0);


        var storeIndex = await this.mysteryBox.packIndex(poolId,workId4);
        console.log("storeIndex4 is:",storeIndex.toString());
        var storeWorkId = await this.mysteryBox.getPackage(poolId,storeIndex-1);
        expect(storeWorkId).to.equal(workId4);
        let paketPoolIndex = await this.mysteryBox.getPacakgePoolIndex(workId,poolId);

        await expect(this.mysteryBox.getPacakgePool(workId,paketPoolIndex)).to.revertedWith("Index_ is out of range")
        var poolId = await this.mysteryBox.getPacakgePool(workId,paketPoolIndex-1);
        console.log("poolId is :",poolId.toString());


    });

    it("test packageSold", async function() {
        var poolId = 1;
        var workId = 10;
        var workId2 = 20;
        var workId3 = 30;
        var workId4 = 40;
        //uint worksId_, uint poolId_
        // await expect(this.mysteryBox.putToPool(640,1)).to.revertedWith("MysteryBox: caller is not a admin");
        //Not exist the child pool
        await expect(this.mysteryBox.takeFromPool(workId,poolId)).to.revertedWith("Not exist the child pool");

        //The mysteryBox is not exist or state is not ready
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"pool1");
        await this.mysteryBox.setInternalCaller(owner.address,true);
        console.log("internalCaller is:",await this.mysteryBox.internalCaller(owner.address));
        await this.mysteryBox.preparePackage(workId,330,1);
        await this.mysteryBox.preparePackage(workId,340,2);
        await this.mysteryBox.preparePackage(workId,350,1);
        //uint worksId_, uint NFTtokenId_, uint count_
        await this.mysteryBox.createPackage(workId,320,1,"0",owner.address);
        await this.mysteryBox.createPackage(workId2,380,1,"0",owner.address);
        var package = await this.mysteryBox.boxPackages(workId);
        console.log("package.unsoldTotal is:",package.unsoldTotal.toString());
        await this.mysteryBox.putToPool(workId,poolId);
        await this.mysteryBox.putToPool(workId2,poolId);
        var nftCountOfPool = await this.mysteryBox.getCountInfoOfPool(poolId);
        console.log("nftCountOfPool is:",nftCountOfPool.toString());
        expect(nftCountOfPool[0]).to.equal(6);
        expect(nftCountOfPool[1]).to.equal(6);
        await this.mysteryBox.packageSold(workId);
        var nftCountOfPool = await this.mysteryBox.getCountInfoOfPool(poolId);
        console.log("nftCountOfPool is:",nftCountOfPool.toString());
        expect(nftCountOfPool[0]).to.equal(5);
        expect(nftCountOfPool[1]).to.equal(6);

        var package = await this.mysteryBox.boxPackages(workId);
        console.log("package.unsoldTotal is:",package.unsoldTotal.toString());
        expect(package.unsoldTotal).to.equal(4);
        await this.mysteryBox.packageSold(workId);
        await this.mysteryBox.packageSold(workId);
        await this.mysteryBox.packageSold(workId);
        await this.mysteryBox.packageSold(workId);
        var package = await this.mysteryBox.boxPackages(workId);
        console.log("package.unsoldTotal is:",package.unsoldTotal.toString());

        expect(package.unsoldTotal).to.equal(0);
        //this.mysteryBox.getPacakgePoolIndex(workId,poolId)
        await expect(this.mysteryBox.getPacakgePoolIndex(workId,poolId)).to.revertedWith("The mysteryBox is not exist or state is not ready")
        await expect(this.mysteryBox.getPacakgePool(workId,poolId)).to.revertedWith("The mysteryBox is not exist or state is not ready")
        expect(await this.mysteryBox.getPackagePoolCount(workId)).to.equal("0");
        var workId = await this.mysteryBox.packages(poolId,0);
        console.log("workId is",workId.toString())
        expect(workId).be.equal(workId2);
    });

    it("test packageOpened", async function() {
        var poolId = 1;
        var workId = 10;
        var workId2 = 20;
        var workId3 = 30;
        var workId4 = 40;
        var nftTokenId1 = 330;
        var nftTokenId2 = 340;
        var nftTokenId3 = 350;
        var nftTokenId4 = 320;
        var nftTokenId5 = 380;
        //uint worksId_, uint poolId_
        // await expect(this.mysteryBox.putToPool(640,1)).to.revertedWith("MysteryBox: caller is not a admin");
        //Not exist the child pool
        await expect(this.mysteryBox.takeFromPool(workId,poolId)).to.revertedWith("Not exist the child pool");

        //The mysteryBox is not exist or state is not ready
        await this.mysteryBox.createPool(600,3700,2700,3000,await withDecimals(1),"pool1");
        await this.mysteryBox.setInternalCaller(owner.address,true);
        console.log("internalCaller is:",await this.mysteryBox.internalCaller(owner.address));
        await this.mysteryBox.preparePackage(workId,nftTokenId1,1);

        await expect(this.mysteryBox.packageOpened(workId,nftTokenId1)).to.revertedWith("The mysteryBox is not exist");
        await expect(this.mysteryBox.packageSold(workId)).revertedWith("The mysteryBox is not exist or state is not ready");

        await this.mysteryBox.preparePackage(workId,nftTokenId2,2);
        await this.mysteryBox.preparePackage(workId,nftTokenId3,1);
        //uint worksId_, uint NFTtokenId_, uint count_
        await this.mysteryBox.createPackage(workId,nftTokenId4,1,"0",owner.address);
        await this.mysteryBox.createPackage(workId2,nftTokenId5,1,"0",owner.address);
        var package = await this.mysteryBox.boxPackages(workId);
        console.log("package.unsoldTotal is:",package.unsoldTotal.toString());
        await this.mysteryBox.putToPool(workId,poolId);
        await this.mysteryBox.putToPool(workId2,poolId);
        await expect(this.mysteryBox.packageOpened(workId,nftTokenId1)).revertedWith("All sold NFTs has been opened");
        await this.mysteryBox.packageSold(workId);

        var package_NFT_Reminded = await this.mysteryBox.getPackageNFTremained(workId,nftTokenId1);
        console.log("package_NFT_Reminded is:",package_NFT_Reminded.toString());

        let work_NFT_id_array = await this.mysteryBox.getPackageNFTtokenID(workId);
        for(var i=0;i<work_NFT_id_array.length;i++){
            console.log(work_NFT_id_array[i].toString());
        }

        await this.mysteryBox.packageOpened(workId,nftTokenId1);
        var package_NFT_Reminded = await this.mysteryBox.getPackageNFTremained(workId,nftTokenId1);
        console.log("package_NFT_Reminded is:",package_NFT_Reminded.toString());

        await expect(this.mysteryBox.packageOpened(workId,nftTokenId1)).to.revertedWith("All sold NFTs has been opened");
        await expect(this.mysteryBox.getPackageNFTInfo(100,0)).to.revertedWith("The mysteryBox is not created");
        // test the NFT remained is zero
        await this.mysteryBox.packageSold(workId);
        await this.mysteryBox.packageSold(workId);
        await this.mysteryBox.packageSold(workId);
        await expect(this.mysteryBox.packageOpened(workId,nftTokenId1)).to.revertedWith("The NFT remained is zero");

        let package_NFT_info = await this.mysteryBox.getPackageNFTInfo(workId,0);
        console.log("package_NFT_info is:",package_NFT_info.toString());
    });


})
