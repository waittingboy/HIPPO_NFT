const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;

const initUrl = "www.voucherNFT.cycan.io"

async function withDecimals18(amount) {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(18)).toString();
}

describe("VoucherNFT", async function() {
    let _initAmount = await withDecimals18("100000000");

    before(async function() {
        this.signers = await ethers.getSigners();
        this.owner = this.signers[0];
        this.user = this.signers[1];
        this.alice = this.signers[2];

        this.VoucherNFT = await ethers.getContractFactory("VoucherNFT");
        this.ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    });

    beforeEach(async function() {
        this.voucherNFT = await this.VoucherNFT.deploy();
        await this.voucherNFT.deployed();
        await this.voucherNFT.initialize(initUrl);

        this.pledgeToken = await this.ERC20Mock.deploy("hip token", "hip");
        await this.pledgeToken.deployed()
        this.hnqToken = await this.ERC20Mock.deploy("hnq token", "hnq");
        await this.hnqToken.deployed()
        this.usdc = await this.ERC20Mock.deploy("USDC token", "USDC");
        await this.usdc.deployed()
        this.elc = await this.ERC20Mock.deploy("ELC token", "ELC");

        let tokens = [this.pledgeToken,this.hnqToken,this.usdc,this.elc];
        let users = [this.owner,this.user,this.alice]
        for(let i = 0; i< users.length;i++) {
            for(let j = 0; j< tokens.length;j++) {
                await tokens[j].mint(users[i].address,_initAmount)
                await tokens[j].connect(users[i]).approve(this.voucherNFT.address,_initAmount)
            }

        }

    });

    it("createVoucher", async function() {
        let _amountPerExRolls = await withDecimals18("10000")
        let _amountExRolls = "5";
        let _url = "ipfs://12345678"

        await expect(this.voucherNFT.createVoucher(
          ethers.constants.AddressZero,
          _amountPerExRolls,
          _amountExRolls,
          _url
        )).to.revertedWith("function call to a non-contract account");

        //Balance not enough
        await this.pledgeToken.transfer(this.user.address,_initAmount);
        await expect(this.voucherNFT.createVoucher(
          this.pledgeToken.address,
          _amountPerExRolls,
          _amountExRolls,
          _url
        )).to.revertedWith("Balance not enough");
        await this.pledgeToken.connect(this.user).transfer(this.owner.address,_initAmount);

        await this.voucherNFT.createVoucher(
          this.pledgeToken.address,
          _amountPerExRolls,
          _amountExRolls,
          _url
        )

        let allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner);
        let tokenId = allTokenIdOfOwner[0].toString();
        let exRolls = await this.voucherNFT.voucherInfos(tokenId.toString());
        expect(exRolls.token).to.equal(this.pledgeToken.address);
        expect(exRolls.amount).to.equal(_amountPerExRolls);
        expect(exRolls.url).to.equal(_url);
        expect(await this.voucherNFT.balanceOf(this.owner.address,tokenId)).to.equal(_amountExRolls);

    });

    it("createVoucherBatch", async function() {
        let tokens = [this.pledgeToken,this.hnqToken,this.elc];
        let tokenAddrs = [this.pledgeToken.address,this.hnqToken.address,this.elc.address];
        let _amountPerExRollses = [await withDecimals18("10000"),await withDecimals18("20000"),await withDecimals18("30000")];
        let _amountExRollses = [5,10,20];
        let _urls = ["ipfs://token01","ipfs://token02","ipfs://token03"];
        await this.voucherNFT.createVoucherBatch(tokenAddrs, _amountPerExRollses, _amountExRollses, _urls);

        let allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(tokens.length);

        let exRolls;
        for(let i=0; i< tokens.length; i++) {
            exRolls = await this.voucherNFT.voucherInfos(allTokenIdOfOwner[i].toString());
            expect(exRolls.token).to.equal(tokens[i].address);
            expect(exRolls.amount).to.equal(_amountPerExRollses[i]);
            expect(exRolls.url).to.equal(_urls[i]);
            expect(await this.voucherNFT.balanceOf(this.owner.address,allTokenIdOfOwner[i]))
              .to.equal(_amountExRollses[i]);

            expect(await tokens[i].balanceOf(this.owner.address)).to.equal(BigNumber.from(_initAmount).sub(BigNumber.from(_amountPerExRollses[i]).mul(_amountExRollses[i])));
            expect(await tokens[i].balanceOf(this.voucherNFT.address)).to.equal(BigNumber.from(_amountPerExRollses[i]).mul(_amountExRollses[i]));
        }

    });

    it("safeTransferFrom", async function() {
        let _amountPerExRolls = await withDecimals18("10000")
        let _amountExRolls = "5";
        let _url = "ipfs://12345678"

        let tokens = [this.pledgeToken.address,this.hnqToken.address,this.elc.address];
        let _amountPerExRollses = [await withDecimals18("10000"),await withDecimals18("20000"),await withDecimals18("30000")];
        let _amountExRollses = [5,10,20];
        let _urls = ["ipfs://token01","ipfs://token02","ipfs://token03"];
        await this.voucherNFT.createVoucherBatch(tokens, _amountPerExRollses, _amountExRollses, _urls);

        let allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(tokens.length);

        await this.voucherNFT.safeTransferFrom(
          this.owner.address,
          this.user.address,
          allTokenIdOfOwner[0],2, ethers.utils.formatBytes32String(""));

        allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(3);
        let allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser:",allTokenIdOfUser.toString());
        expect(await this.voucherNFT.balanceOf(this.owner.address,allTokenIdOfOwner[0]))
          .to.equal(3);

        expect(allTokenIdOfUser.length).to.equal(1);
        expect(await this.voucherNFT.balanceOf(this.user.address,allTokenIdOfUser[0]))
          .to.equal(2);

        console.log("bal-owner-id==1",await this.voucherNFT.balanceOf(this.owner.address,allTokenIdOfUser[0]))

        await this.voucherNFT.safeTransferFrom(
          this.owner.address,
          this.user.address,
          allTokenIdOfOwner[0],3, ethers.utils.formatBytes32String(""));

        allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(2);

        allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser:",allTokenIdOfUser.toString());
        expect(await this.voucherNFT.balanceOf(this.owner.address,"1"))
          .to.equal(0);

        expect(allTokenIdOfUser.length).to.equal(1);
        expect(await this.voucherNFT.balanceOf(this.user.address,allTokenIdOfUser[0]))
          .to.equal(5);

    });

    it("safeBatchTransferFrom", async function() {
        let tokens = [this.pledgeToken.address,this.hnqToken.address,this.elc.address];
        let _amountPerExRollses = [await withDecimals18("10000"),await withDecimals18("20000"),await withDecimals18("30000")];
        let _amountExRollses = [5,10,20];
        let _amountBatchTransfer_2_5_5 = [2,5,5];
        let _urls = ["ipfs://token01","ipfs://token02","ipfs://token03"];
        await this.voucherNFT.createVoucherBatch(tokens, _amountPerExRollses, _amountExRollses, _urls);

        let allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(tokens.length);

        await this.voucherNFT.safeBatchTransferFrom(
          this.owner.address,
          this.user.address,
          allTokenIdOfOwner,_amountBatchTransfer_2_5_5, ethers.utils.formatBytes32String(""));

        allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner-1:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(3);
        let allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser-1:",allTokenIdOfUser.toString());
        expect(allTokenIdOfUser.length).to.equal(3);

        let _amountBatchTransfer_3_5_15 = [3,5,15];
        for(let i =0; i< _amountExRollses.length; i++) {
            expect(await this.voucherNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
              .to.equal(_amountBatchTransfer_2_5_5[i]);

            expect(await this.voucherNFT.balanceOf(this.owner.address,allTokenIdOfOwner[i]))
              .to.equal(_amountExRollses[i] - _amountBatchTransfer_2_5_5[i]);
        }

        //safeBatchTransferFrom again
        let _amountBatchTransfer_3_3_10 = [3,3,10];
        await this.voucherNFT.safeBatchTransferFrom(
          this.owner.address,
          this.user.address,
          allTokenIdOfOwner,_amountBatchTransfer_3_3_10, ethers.utils.formatBytes32String(""));

        for(let i =0; i< _amountExRollses.length; i++) {
            expect(await this.voucherNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
              .to.equal(_amountBatchTransfer_2_5_5[i] + _amountBatchTransfer_3_3_10[i]);

            expect(await this.voucherNFT.balanceOf(this.owner.address,allTokenIdOfOwner[i]))
              .to.equal(_amountExRollses[i] - _amountBatchTransfer_2_5_5[i] - _amountBatchTransfer_3_3_10[i]);
        }

        allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser-2:",allTokenIdOfUser.toString());
        expect(allTokenIdOfUser.length).to.equal(3);

        allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner-2:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(2);

        //safeBatchTransferFrom third
        let _amountBatchTransfer_0_2_5 = [0,2,5];
        await this.voucherNFT.safeBatchTransferFrom(
          this.owner.address,
          this.user.address,
          allTokenIdOfUser,_amountBatchTransfer_0_2_5, ethers.utils.formatBytes32String(""));
        //allTokenIdOfUser == [1,2,3]
        //allTokenIdOfOwner == []
        for(let i =0; i< _amountExRollses.length; i++) {
            expect(await this.voucherNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
              .to.equal(BigNumber.from(_amountExRollses[i]));

            expect(await this.voucherNFT.balanceOf(this.owner.address,allTokenIdOfUser[i]))
              .to.equal(BigNumber.from("0"));
        }

        allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser-3:",allTokenIdOfUser.toString());
        expect(allTokenIdOfUser.length).to.equal(3);

        allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner-3:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(0);

    });

    it("useVoucher myself", async function() {
        let tokens = [this.pledgeToken.address,this.hnqToken.address,this.elc.address];
        let _amountPerExRollses = [await withDecimals18("10000"),await withDecimals18("20000"),await withDecimals18("30000")];
        let _amountExRollses = [5,10,20];
        let _amountBatchTransfer_2_5_5 = [2,5,5];
        let _urls = ["ipfs://token01","ipfs://token02","ipfs://token03"];
        await this.voucherNFT.createVoucherBatch(tokens, _amountPerExRollses, _amountExRollses, _urls);

        let allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(tokens.length);

        expect(await this.voucherNFT.balanceOf(this.owner.address,1)).to.equal("5");
        await this.voucherNFT.useVoucher(allTokenIdOfOwner[0],3);

        expect(await this.voucherNFT.balanceOf(this.owner.address,1)).to.equal("2");
        await this.voucherNFT.useVoucher(allTokenIdOfOwner[0],2);

        expect(await this.voucherNFT.balanceOf(this.owner.address,1)).to.equal("0");
        await expect(this.voucherNFT.useVoucher(allTokenIdOfOwner[0],_amountExRollses[0]))
          .to.revertedWith("The balance not enough");


    });

    it("useVoucher", async function() {
        let tokens = [this.pledgeToken.address,this.hnqToken.address,this.elc.address];
        let _amountPerExRollses = [await withDecimals18("10000"),await withDecimals18("20000"),await withDecimals18("30000")];
        let _amountExRollses = [5,10,20];
        let _amountBatchTransfer_2_5_5 = [2,5,5];
        let _urls = ["ipfs://token01","ipfs://token02","ipfs://token03"];
        await this.voucherNFT.createVoucherBatch(tokens, _amountPerExRollses, _amountExRollses, _urls);

        let allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(tokens.length);

        await this.voucherNFT.safeBatchTransferFrom(
          this.owner.address,
          this.user.address,
          allTokenIdOfOwner,_amountBatchTransfer_2_5_5, ethers.utils.formatBytes32String(""));

        // use Vouchers first
        // allTokenIdOfOwner = [1,2,3]
        let allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        let _amountBatchTransfer_2_2_2 = [2,2,2];

        let tokensObject = [this.pledgeToken,this.hnqToken,this.elc];
        for(let i =0; i< _amountExRollses.length; i++) {
            await this.voucherNFT.connect(this.user).useVoucher(allTokenIdOfOwner[i],_amountBatchTransfer_2_2_2[i]);
            expect(await this.voucherNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
              .to.equal(_amountBatchTransfer_2_5_5[i] - _amountBatchTransfer_2_2_2[i]);
            //let _amountPerExRollses = [await withDecimals18("10000"),await withDecimals18("20000"),await withDecimals18("30000")];
            expect(await tokensObject[i].balanceOf(this.user.address))
              .to.equal(BigNumber.from(_amountBatchTransfer_2_2_2[i]).mul(_amountPerExRollses[i]).add(_initAmount));

        }

        allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser-1:",allTokenIdOfUser.toString());
        expect(allTokenIdOfUser.length).to.equal(2);

        //allTokenIdOfUser = [3,2], balances = [3,3]
        let elcBal_before = await this.elc.balanceOf(this.user.address);
        let hnqBal_before = await this.hnqToken.balanceOf(this.user.address);
        let bals_before = [elcBal_before,hnqBal_before];
        console.log("bals_before-Elc-hnq:",bals_before.toString());
        let _amountBatchTransfer_3_2 = [3,2];
        let _amountPerExRollsesNow = [_amountPerExRollses[2],_amountPerExRollses[1]]

        tokensObject = [this.elc,this.hnqToken];
        let newBalNFT = [0,1]
        for(let i =0; i< _amountBatchTransfer_3_2.length; i++) {
            await this.voucherNFT.connect(this.user).useVoucher(allTokenIdOfUser[i],_amountBatchTransfer_3_2[i]);
            expect(await this.voucherNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
              .to.equal(newBalNFT[i]);
            expect(await tokensObject[i].balanceOf(this.user.address))
              .to.equal(BigNumber.from(bals_before[i]).add(BigNumber.from(_amountPerExRollsesNow[i]).mul(_amountBatchTransfer_3_2[i])));

        }

        allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser-2:",allTokenIdOfUser.toString());
        expect(allTokenIdOfUser.length).to.equal(1);

    });

    it("useVoucherBatch", async function() {
        let tokens = [this.pledgeToken.address,this.hnqToken.address,this.elc.address];
        let _amountPerExRollses = [await withDecimals18("10000"),await withDecimals18("20000"),await withDecimals18("30000")];
        let _amountExRollses = [5,10,20];
        let _amountBatchTransfer_2_5_5 = [2,5,5];
        let _urls = ["ipfs://token01","ipfs://token02","ipfs://token03"];
        await this.voucherNFT.createVoucherBatch(tokens, _amountPerExRollses, _amountExRollses, _urls);

        let allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(tokens.length);

        await this.voucherNFT.safeBatchTransferFrom(
          this.owner.address,
          this.user.address,
          allTokenIdOfOwner,_amountBatchTransfer_2_5_5, ethers.utils.formatBytes32String(""));

        // use Vouchers first
        // allTokenIdOfOwner = [1,2,3]
        let allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        let _amountBatchTransfer_2_2_2 = [2,2,2];
        await this.voucherNFT.connect(this.user).useVoucherBatch(allTokenIdOfOwner,_amountBatchTransfer_2_2_2);

        let tokensObject = [this.pledgeToken,this.hnqToken,this.elc];
        for(let i =0; i< _amountExRollses.length; i++) {
            expect(await this.voucherNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
              .to.equal(_amountBatchTransfer_2_5_5[i] - _amountBatchTransfer_2_2_2[i]);
            //let _amountPerExRollses = [await withDecimals18("10000"),await withDecimals18("20000"),await withDecimals18("30000")];
            expect(await tokensObject[i].balanceOf(this.user.address))
              .to.equal(BigNumber.from(_amountBatchTransfer_2_2_2[i]).mul(_amountPerExRollses[i]).add(_initAmount));

        }

        allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser-1:",allTokenIdOfUser.toString());
        expect(allTokenIdOfUser.length).to.equal(2);

        //allTokenIdOfUser = [3,2], balances = [3,3]
        let elcBal_before = await this.elc.balanceOf(this.user.address);
        let hnqBal_before = await this.hnqToken.balanceOf(this.user.address);
        let bals_before = [elcBal_before,hnqBal_before];
        console.log("bals_before-Elc-hnq:",bals_before.toString());
        let _amountBatchTransfer_3_2 = [3,2];
        let _amountPerExRollsesNow = [_amountPerExRollses[2],_amountPerExRollses[1]]

        await this.voucherNFT.connect(this.user).useVoucherBatch(allTokenIdOfUser,_amountBatchTransfer_3_2);

        tokensObject = [this.elc,this.hnqToken];
        let newBalNFT = [0,1]
        for(let i =0; i< _amountBatchTransfer_3_2.length; i++) {
            expect(await this.voucherNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
              .to.equal(newBalNFT[i]);
            expect(await tokensObject[i].balanceOf(this.user.address))
              .to.equal(BigNumber.from(bals_before[i]).add(BigNumber.from(_amountPerExRollsesNow[i]).mul(_amountBatchTransfer_3_2[i])));

        }

        allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser-2:",allTokenIdOfUser.toString());
        expect(allTokenIdOfUser.length).to.equal(1);

        let _amountBatchTransfer_3_3_5 = [3,3,5]
        await this.voucherNFT.safeBatchTransferFrom(
          this.owner.address,
          this.user.address,
          allTokenIdOfOwner,_amountBatchTransfer_3_3_5, ethers.utils.formatBytes32String(""));

        allTokenIdOfUser = await this.voucherNFT.getAllTokenIdOfUser(this.user.address);
        console.log("allTokenIdOfUser-3:",allTokenIdOfUser.toString());
        expect(allTokenIdOfUser.length).to.equal(3);

        allTokenIdOfOwner = await this.voucherNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(2);

    });

});
