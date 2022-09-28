const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const {BN} = require('@openzeppelin/test-helpers');

async function withDecimals(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(18))).toString();
}

describe("MBPoolAdmin func",async function() {

    let _targetAmount = await withDecimals("10000000");
    let _basePayAmount = await withDecimals("100000");

    before(async function () {
        this.signers = await ethers.getSigners()
        this.owner = this.signers[0]
        this.user = this.signers[1]
        this.alice = this.signers[2]
        console.log("this.owner.address",this.owner.address);

        this.ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        this.MysteryBox = await ethers.getContractFactory("MysteryBox");
        this.MBPoolAdmin = await ethers.getContractFactory("MBPoolAdmin");
        this.MockEOAPayer = await ethers.getContractFactory("MockEOAPayer");
    })

    beforeEach(async function (){
        this.hipToken = await this.ERC20Mock.deploy("hip token", "hip");
        await this.hipToken.deployed()
        await this.hipToken.mint(this.owner.address,_targetAmount)
        await this.hipToken.mint(this.user.address,_targetAmount)
        await this.hipToken.mint(this.alice.address,_targetAmount)

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

        await this.mysteryBox.initialize(this.owner.address,this.mbPoolAdmin.address);
    });

    it("test initialize", async function() {
        expect(await this.mbPoolAdmin.owner()).to.equal(this.owner.address);
        expect(await this.mbPoolAdmin.payToken()).to.equal(this.hipToken.address);
        expect(await this.mbPoolAdmin.mysteryBox()).to.equal(this.mysteryBox.address);
        expect(await this.mbPoolAdmin.basePayAmount()).to.equal(_basePayAmount);
    });

    it("test setBasePayAmount", async function() {
        let _newBasePayAmount = await withDecimals("200000");
        await expect(this.mbPoolAdmin.connect(this.alice).setBasePayAmount(_newBasePayAmount)).revertedWith("Ownable: caller is not the owner");
        await this.mbPoolAdmin.setBasePayAmount(_newBasePayAmount);
        expect(await this.mbPoolAdmin.basePayAmount()).to.equal(_newBasePayAmount);

    });

    it.only("test payAndCreateMBPool", async function() {
        await expect(this.MockEOAPayer.deploy(this.hipToken.address,this.mbPoolAdmin.address)).revertedWith("call payAndCreateMBPool failed");
        //1 owner
        await this.hipToken.connect(this.alice).approve(this.mbPoolAdmin.address,_basePayAmount);
        await this.mbPoolAdmin.connect(this.alice).payAndCreateMBPool(3000,4000,0,3000,await withDecimals(3),"part1");

        //2 user
        await this.hipToken.connect(this.user).approve(this.mbPoolAdmin.address,_basePayAmount);
        await this.mbPoolAdmin.connect(this.user).payAndCreateMBPool(3000,4000,0,3000,await withDecimals(3),"part2");

        //3 alice
        await this.hipToken.connect(this.alice).approve(this.mbPoolAdmin.address,_basePayAmount);
        await this.mbPoolAdmin.connect(this.alice).payAndCreateMBPool(3000,4000,0,3000,await withDecimals(3),"part3");
    });

    it("test withdrawToken", async function() {
        //1 owner
        await this.hipToken.connect(this.alice).approve(this.mbPoolAdmin.address,_basePayAmount);
        await this.mbPoolAdmin.connect(this.alice).payAndCreateMBPool(300,4000,2700,3000,await withDecimals(3),"part1");

        //2 user
        await this.hipToken.connect(this.user).approve(this.mbPoolAdmin.address,_basePayAmount);
        await this.mbPoolAdmin.connect(this.user).payAndCreateMBPool(300,4000,2700,3000,await withDecimals(3),"part2");

        //3 alice
        await this.hipToken.connect(this.alice).approve(this.mbPoolAdmin.address,_basePayAmount);
        await this.mbPoolAdmin.connect(this.alice).payAndCreateMBPool(300,4000,2700,3000,await withDecimals(3),"part3");

        //withdrawToken
        await expect(this.mbPoolAdmin.connect(this.alice).withdrawToken(this.hipToken.address))
          .revertedWith("Ownable: caller is not the owner");

        let hipBalMbPoolAdmin = await this.hipToken.balanceOf(this.mbPoolAdmin.address);
        console.log("this.mbPoolAdmin balance",hipBalMbPoolAdmin.toString());

        let hipBalOwner = await this.hipToken.balanceOf(this.owner.address);
        console.log("this.owner balance",hipBalOwner.toString());

        await this.mbPoolAdmin.withdrawToken(this.hipToken.address);
        expect(await this.hipToken.balanceOf(this.mbPoolAdmin.address)).to.be.equal("0");
        expect(await this.hipToken.balanceOf(this.owner.address)).to.be.equal(BigNumber.from(hipBalOwner).add(BigNumber.from(hipBalMbPoolAdmin)));

    });


})
