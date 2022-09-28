const {ethers} = require("hardhat");
const { smockit } = require("@eth-optimism/smock");
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { BN } = require("@openzeppelin/test-helpers");
const { time } = require("./utilities")

async function withDecimals(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(18))).toString();
}
async function withDecimals6(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(6))).toString();
}
let owner;
let user;
let alice;
let bob;
let cloud;
describe("Base user func",function() {
    before(async function () {
        this.signers = await ethers.getSigners()
        owner = this.signers[0]
        user = this.signers[1]
        alice = this.signers[2]
        bob = this.signers[3];
        cloud = this.signers[4];
        this.Token = await ethers.getContractFactory("ERC20Smart");
        //this.BancorFormulaMock = await ethers.getContractFactory("BancorFormulaMock");
        this.BancorFormulaMock = await ethers.getContractFactory("BancorFormula");
        this.NFTFundToken = await ethers.getContractFactory("NFTFundToken");

        this.ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        this.ERC20Mock6 = await ethers.getContractFactory("ERC20MockDecimals6");

    })

    beforeEach(async function () {
        this.bancor = await this.BancorFormulaMock.deploy();
        await this.bancor.deployed();
        const myBancor = await smockit(this.bancor);
        //string memory name_, string memory symbol_, uint32  weight_, uint initConnAmount_, uint initSupply_, IBancorFormula bancor_
        this.nft_found_token = await this.NFTFundToken.deploy();
        await this.nft_found_token.deployed();
        await this.nft_found_token.initialize("testFund","testFundToken","800000",await withDecimals(209),await withDecimals(3012),this.bancor.address);

        this.token = this.Token.attach(await this.nft_found_token.token());
        this.usdc = await this.ERC20Mock6.deploy("USDC Test token", "USDCT");
        this.elc = await this.ERC20Mock.deploy("ELC Test token", "ELCT");

        await this.usdc.mint(owner.address, await withDecimals6(100000000));
        await this.elc.mint(owner.address, await withDecimals(100000000));
    })

    it("test addConnector", async function() {
        await this.nft_found_token.addConnector("100000",await withDecimals(20));
        let connector = await this.nft_found_token.connectors(1);
        let connectors = await this.nft_found_token.getConnector(1)
        expect(connectors[0]).to.equal(await withDecimals(20));
        expect(connector[1]).to.equal(100000);
        expect(await this.nft_found_token.getConnectorCount()).to.equal(2);
    });

    it("test getReturn", async function() {
        await this.nft_found_token.addConnector("100000",await withDecimals(20));
        await expect(this.nft_found_token.getReturn(2,await withDecimals(100),this.elc.address)).to.revertedWith("No such connector");
        let returns = await this.nft_found_token.getReturn(0,await withDecimals6(3),this.usdc.address);
        expect(returns).to.equal("34538195419384262132");
    });

    it("test mintSmart", async function() {
        await this.nft_found_token.addConnector(10,20);
        await expect(this.nft_found_token.connect(bob).mintSmart(owner.address,2,100,this.elc.address,{from:bob.address})).to.revertedWith("Ownable: caller is not the owner");
        await expect(this.nft_found_token.mintSmart(owner.address,2,100,this.elc.address)).to.revertedWith("No such connector");
        let connector = await this.nft_found_token.getConnector(1);
        let balanceOrigin = connector[0];
        let balanceOf = await this.token.balanceOf(owner.address);
        let balanceOfOrigin = balanceOf;
        await this.nft_found_token.mintSmart(owner.address,1,100,this.elc.address);
        connector = await this.nft_found_token.getConnector(1);
        let balanceNew = connector[0];
        balanceOf = await this.token.balanceOf(owner.address);
        let balanceOfNew = balanceOf;
        expect(balanceNew.sub(balanceOrigin)).to.equal(100);
        expect(balanceOfNew.sub(balanceOfOrigin)).to.equal(BigNumber.from("53968278702577200"));
    });

    it("test burnSmart", async function() {
        await this.nft_found_token.addConnector(10,20);
        await expect(this.nft_found_token.burnSmart(2,100)).to.revertedWith("No such connector");
        let connector = await this.nft_found_token.getConnector(1);
        let balanceOrigin = connector[0];
        let balanceOf = await this.token.balanceOf(owner.address);
        let balanceOfOrigin = balanceOf;
        await this.nft_found_token.burnSmart(100,1);
        connector = await this.nft_found_token.getConnector(1);
        let balanceNew = connector[0];
        balanceOf = await this.token.balanceOf(owner.address);
        let balanceOfNew = balanceOf;
        expect(balanceNew.sub(balanceOrigin)).to.equal(0);
        expect(balanceOfNew.sub(balanceOfOrigin)).to.equal(-100);
    });
});
