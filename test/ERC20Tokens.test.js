const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const {BN} = require('@openzeppelin/test-helpers');
const { time } = require("./utilities")

let ONE_MINUTES = 60;
let ONE_DAY = 86400;

async function withDecimals(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(18))).toString();
}


function contains(arr, obj) {
    var i = arr.length;
    while (i--) {
        if (arr[i] === obj) {
            return true;
        }
    }
    return false;
}

describe("ERC20Tokens func",function() {
    before(async function () {
        this.signers = await ethers.getSigners()
        this.owner = this.signers[0]
        this.user = this.signers[1]
        this.alice = this.signers[2]
        this.bob = this.signers[3];
        this.cloud = this.signers[4];

        this.ERC20Tokens = await ethers.getContractFactory("ERC20TokensMock")
        this.ERC20Mock = await ethers.getContractFactory("ERC20Mock");

    })

    beforeEach(async function () {
        this.erc20Tokens = await this.ERC20Tokens.deploy();
        await this.erc20Tokens.deployed();
        await this.erc20Tokens.initialize([this.user.address,this.alice.address]);
        this.usdc = await this.ERC20Mock.deploy("USDC token", "USDC");
        await this.usdc.deployed()
    })

    it("support token",async function() {
        isSupportToken = await this.erc20Tokens.getSupportTokens();
        var containUser = contains(isSupportToken,this.user.address);
        var containOwner = contains(isSupportToken,this.owner.address);
        expect(containUser).to.equal(true);
        expect(containOwner).to.equal(false);
        expect(isSupportToken.length).to.equal(2);

    })

    it("add token exist",async function(){
        let isSupportToken = await this.erc20Tokens.getSupportTokens();

        var containBob = contains(isSupportToken,this.bob.address);
        var containCloud = contains(isSupportToken,this.cloud.address);
        expect(containBob).to.equal(false);
        expect(containCloud).to.equal(false);
        expect(isSupportToken.length).to.equal(2);

        await this.erc20Tokens.addToken([this.bob.address,this.cloud.address]);
        isSupportToken = await this.erc20Tokens.getSupportTokens();
        var containBob = contains(isSupportToken,this.bob.address);
        var containCloud = contains(isSupportToken,this.cloud.address);
        expect(containBob).to.equal(true);
        expect(containCloud).to.equal(true);
        expect(isSupportToken.length).to.equal(4);

        await this.erc20Tokens.addToken([this.bob.address,this.cloud.address]);
    });

    it("delete token and default support token can not delete",async function(){
        let isSupportToken = await this.erc20Tokens.getSupportTokens();

        var containBob = contains(isSupportToken,this.user.address);
        var containAlice = contains(isSupportToken,this.alice.address);
        expect(containBob).to.equal(true);
        expect(containAlice).to.equal(true);
        expect(isSupportToken.length).to.equal(2);

        await expect(this.erc20Tokens.deleteToken([this.user.address,this.alice.address])).to.revertedWith("default can not delete");
    });

    it("delete token and check exist",async function(){
        await this.erc20Tokens.addToken([this.bob.address,this.cloud.address]);
        var isSupportToken = await this.erc20Tokens.getSupportTokens();

        var containBob = contains(isSupportToken,this.bob.address);
        var containCloud = contains(isSupportToken,this.cloud.address);
        console.log("containBob is:",containBob);
        expect(containBob).to.equal(true);
        expect(containCloud).to.equal(true);
        expect(isSupportToken.length).to.equal(4);

        await this.erc20Tokens.deleteToken([this.bob.address,this.cloud.address]);

        var isSupportToken = await this.erc20Tokens.getSupportTokens();
        var containBob = contains(isSupportToken,this.bob.address);
        var containCloud = contains(isSupportToken,this.cloud.address);
        console.log("containBob is:",containBob);
        expect(containBob).to.equal(false);
        expect(containCloud).to.equal(false);
        expect(isSupportToken.length).to.equal(2);

        await expect(this.erc20Tokens.deleteToken([this.bob.address,this.cloud.address])).to.revertedWith("not in support tokens");


    });

    //test only owner
    it("add token or delete will revert not owner",async function(){
        await expect(this.erc20Tokens.connect(this.alice).addToken([this.bob.address,this.cloud.address])).to.revertedWith("Ownable: caller is not the owner");
        await expect(this.erc20Tokens.connect(this.alice).deleteToken([this.bob.address,this.cloud.address])).to.revertedWith("Ownable: caller is not the owner");
    });

    //test withdraw
    it("test withdrawToken and withdrawTokenBalance",async function(){
        let totalMintAmount = await withDecimals("10000")
        let withdrawAmount = await withDecimals("5000")
        await this.usdc.mint(this.erc20Tokens.address,totalMintAmount)
        expect(await this.usdc.balanceOf(this.erc20Tokens.address)).to.equal(totalMintAmount)
        await this.erc20Tokens.withdrawToken(this.usdc.address,withdrawAmount)
        expect(await this.usdc.balanceOf(this.erc20Tokens.address)).to.equal(withdrawAmount)
        await this.erc20Tokens.withdrawTokenBalance(this.usdc.address)
        expect(await this.usdc.balanceOf(this.erc20Tokens.address)).to.equal(0)

    });
})
