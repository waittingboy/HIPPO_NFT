const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;

const initUrl = "hippobox.cycan.network";

async function withDecimals18(amount) {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(18)).toString();
}

describe("HippoNFT", async function() {
    let _initAmount = await withDecimals18("100000000");

    before(async function() {
        this.signers = await ethers.getSigners();
        this.owner = this.signers[0];
        this.user = this.signers[1];
        this.alice = this.signers[2];

        this.HippoNFT = await ethers.getContractFactory("HippoNFT");
    });

    beforeEach(async function() {
        this.hippoNFT = await this.HippoNFT.deploy();
        await this.hippoNFT.deployed();
        await this.hippoNFT.initialize(initUrl);

    });

    it("mint", async function() {
        let _amount = "5";
        let _url = "ipfs://12345678"

        await this.hippoNFT.mint(_amount,_url)

        let allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner);
        let tokenId = allTokenIdOfOwner[0];
        let tokenInfo = await this.hippoNFT.tokenInfo(tokenId);
        console.log("tokenInfo",tokenInfo.toString())
        expect(tokenInfo).to.equal(_url);
        expect(await this.hippoNFT.balanceOf(this.owner.address,tokenId)).to.equal(_amount);

    });

    it("batchMint", async function() {
        let _amounts = [5,10,20];
        let _urls = ["ipfs://token01","ipfs://token02","ipfs://token03"];
        await this.hippoNFT.batchMint( _amounts, _urls);

        let allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
        console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
        expect(allTokenIdOfOwner.length).to.equal(_amounts.length);

        let tokenInfo;
        for(let i=0; i< _amounts.length; i++) {
            tokenInfo = await this.hippoNFT.tokenInfo(allTokenIdOfOwner[i].toString());
            expect(tokenInfo).to.equal(_urls[i]);
            expect(await this.hippoNFT.balanceOf(this.owner.address,allTokenIdOfOwner[i]))
              .to.equal(_amounts[i]);
        }

    });

    it("safeTransferFrom", async function() {
      let _amounts = [5,10,20];
      let _urls = ["ipfs://token01","ipfs://token02","ipfs://token03"];
      await this.hippoNFT.batchMint( _amounts, _urls);

      let allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
      console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());

      // transfer id==1,amount==2 from owner to user
      await this.hippoNFT.safeTransferFrom(
        this.owner.address,
        this.user.address,
        allTokenIdOfOwner[0],2, ethers.utils.formatBytes32String(""));

      allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
      console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
      expect(allTokenIdOfOwner.length).to.equal(3);
      let allTokenIdOfUser = await this.hippoNFT.getAllTokenIdOfUser(this.user.address);
      console.log("allTokenIdOfUser:",allTokenIdOfUser.toString());
      expect(await this.hippoNFT.balanceOf(this.owner.address,allTokenIdOfOwner[0]))
        .to.equal(3);

      expect(allTokenIdOfUser.length).to.equal(1);
      expect(await this.hippoNFT.balanceOf(this.user.address,allTokenIdOfUser[0]))
        .to.equal(2);
      
        expect(await this.hippoNFT.balanceOf(this.owner.address,allTokenIdOfUser[0]))
        .to.equal(3);

      console.log("bal-owner-id-1",await this.hippoNFT.balanceOf(this.owner.address,allTokenIdOfUser[0]))

      // transfer id==2,amount==5 from owner to user
      await this.hippoNFT.safeTransferFrom(
        this.owner.address,
        this.user.address,
        allTokenIdOfOwner[1],5, ethers.utils.formatBytes32String(""));

      allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
      console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
      expect(allTokenIdOfOwner.length).to.equal(3);

      allTokenIdOfUser = await this.hippoNFT.getAllTokenIdOfUser(this.user.address);
      console.log("allTokenIdOfUser:",allTokenIdOfUser.toString());
      expect(await this.hippoNFT.balanceOf(this.owner.address,"2"))
        .to.equal(5);

      expect(allTokenIdOfUser.length).to.equal(2);
      expect(await this.hippoNFT.balanceOf(this.user.address,allTokenIdOfUser[1]))
        .to.equal(5);

        // transfer id==1,amount==3 from owner to user
      await this.hippoNFT.safeTransferFrom(
        this.owner.address,
        this.user.address,
        allTokenIdOfOwner[0],3, ethers.utils.formatBytes32String(""));

      allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
      console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());
      expect(allTokenIdOfOwner.length).to.equal(2);

      allTokenIdOfUser = await this.hippoNFT.getAllTokenIdOfUser(this.user.address);
      console.log("allTokenIdOfUser:",allTokenIdOfUser.toString());
      expect(await this.hippoNFT.balanceOf(this.owner.address,"1"))
        .to.equal(0);

      expect(allTokenIdOfUser.length).to.equal(2);
      expect(await this.hippoNFT.balanceOf(this.user.address,allTokenIdOfUser[0]))
        .to.equal(5);


    });

    it.only("safeBatchTransferFrom", async function() {
      let _amounts = [5,10,20];
      let _amountBatchTransfer_2_5_5 = [2,5,5];
      let _urls = ["ipfs://token01","ipfs://token02","ipfs://token03"];
      await this.hippoNFT.batchMint( _amounts, _urls);

      let allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
      console.log("allTokenIdOfOwner:",allTokenIdOfOwner.toString());

      await this.hippoNFT.safeBatchTransferFrom(
        this.owner.address,
        this.user.address,
        allTokenIdOfOwner,_amountBatchTransfer_2_5_5, ethers.utils.formatBytes32String(""));

      allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
      console.log("allTokenIdOfOwner-1:",allTokenIdOfOwner.toString());
      expect(allTokenIdOfOwner.length).to.equal(3);
      let allTokenIdOfUser = await this.hippoNFT.getAllTokenIdOfUser(this.user.address);
      console.log("allTokenIdOfUser-1:",allTokenIdOfUser.toString());
      expect(allTokenIdOfUser.length).to.equal(3);

      let _amountBatchTransfer_3_5_15 = [3,5,15];
      for(let i =0; i< _amounts.length; i++) {
          expect(await this.hippoNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
            .to.equal(_amountBatchTransfer_2_5_5[i]);

          expect(await this.hippoNFT.balanceOf(this.owner.address,allTokenIdOfOwner[i]))
            .to.equal(_amounts[i] - _amountBatchTransfer_2_5_5[i]);
      }

      //safeBatchTransferFrom again
      let _amountBatchTransfer_3_3_10 = [3,3,10];
      await this.hippoNFT.safeBatchTransferFrom(
        this.owner.address,
        this.user.address,
        allTokenIdOfOwner,_amountBatchTransfer_3_3_10, ethers.utils.formatBytes32String(""));

      for(let i =0; i< _amounts.length; i++) {
          expect(await this.hippoNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
            .to.equal(_amountBatchTransfer_2_5_5[i] + _amountBatchTransfer_3_3_10[i]);

          expect(await this.hippoNFT.balanceOf(this.owner.address,allTokenIdOfOwner[i]))
            .to.equal(_amounts[i] - _amountBatchTransfer_2_5_5[i] - _amountBatchTransfer_3_3_10[i]);
      }

      allTokenIdOfUser = await this.hippoNFT.getAllTokenIdOfUser(this.user.address);
      console.log("allTokenIdOfUser-2:",allTokenIdOfUser.toString());
      expect(allTokenIdOfUser.length).to.equal(3);

      allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
      console.log("allTokenIdOfOwner-2:",allTokenIdOfOwner.toString());
      expect(allTokenIdOfOwner.length).to.equal(2);

      //safeBatchTransferFrom third
      let _amountBatchTransfer_0_2_5 = [0,2,5];
      await this.hippoNFT.safeBatchTransferFrom(
        this.owner.address,
        this.user.address,
        allTokenIdOfUser,_amountBatchTransfer_0_2_5, ethers.utils.formatBytes32String(""));
      //allTokenIdOfUser == [1,2,3]
      //allTokenIdOfOwner == []
      for(let i =0; i< _amounts.length; i++) {
          expect(await this.hippoNFT.balanceOf(this.user.address,allTokenIdOfUser[i]))
            .to.equal(BigNumber.from(_amounts[i]));

          expect(await this.hippoNFT.balanceOf(this.owner.address,allTokenIdOfUser[i]))
            .to.equal(BigNumber.from("0"));
      }

      allTokenIdOfUser = await this.hippoNFT.getAllTokenIdOfUser(this.user.address);
      console.log("allTokenIdOfUser-3:",allTokenIdOfUser.toString());
      expect(allTokenIdOfUser.length).to.equal(3);

      allTokenIdOfOwner = await this.hippoNFT.getAllTokenIdOfUser(this.owner.address);
      console.log("allTokenIdOfOwner-3:",allTokenIdOfOwner.toString());
      expect(allTokenIdOfOwner.length).to.equal(0);

    });

});
