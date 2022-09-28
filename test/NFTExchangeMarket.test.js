const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { ADDRESS_ZERO } = require("./utilities");

let owner, user, alice;
let nft, token1155, token20, token721, ctrt;

describe("NFT Exchange Market func", async function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];

        this.NFT = await ethers.getContractFactory("NFTExchangeMarketMock");
        this.TOKEN1155 = await ethers.getContractFactory("NFTFactoryMock");
        this.TOKEN20 = await ethers.getContractFactory("Token20Mock");
        this.UserToken = await ethers.getContractFactory("UserTokens");
        this.TOKEN721 = await ethers.getContractFactory("Token721Mock");
        this.Contract = await ethers.getContractFactory("Contract");
    });

    beforeEach(async function() {
        nft = await this.NFT.deploy();
        await nft.deployed();

        token1155 = await this.TOKEN1155.deploy()
        await token1155.deployed();

        token20 = await this.TOKEN20.deploy()
        await token20.deployed();

        token721 = await this.TOKEN721.deploy()
        await token721.deployed();

        ctrt = await this.Contract.deploy();
        await ctrt.deployed();
    });

    it("initialize", async function() {
        await nft.initialize(ctrt.address, owner.address, [token20.address]);
        let eptToken = await nft.token();
        let eptUtoken = await nft.userTokens();
        let eptHandlingFeeAccount = await nft.handlingFeeAccount();
        let eptHandlingFeeRatio = await nft.getHandlingFeeRatio();

        expect(eptToken).to.be.equal(ctrt.address);
        expect(eptHandlingFeeAccount).to.be.equal(owner.address);
        expect(eptHandlingFeeRatio).to.be.equal(200);
    });

    it("initialize failed", async function() {
        await expect(nft.initialize(token1155.address,ADDRESS_ZERO, [token20.address]))
            .to.be.revertedWith("account is zero address");
    });

    describe("NFT exchange market test", async function() {
        beforeEach("", async function() {
            await nft.initialize(ctrt.address, owner.address, [token20.address]);
            await token1155.initialize(owner.address);
            await ctrt.initialize(token1155.address);
        });

        it("transfer handling fee account", async function() {
            await nft.transferHandlingFeeAccount(user.address);
            let eptHandlingFeeAccount = await nft.handlingFeeAccount();
            expect(eptHandlingFeeAccount).to.be.equal(user.address);
        });

        it("transfer handling fee account failed", async function() {
            await expect(nft.connect(user).transferHandlingFeeAccount(user.address, {from:user.address}))
                .to.be.revertedWith("Ownable: caller is not the owner");
            await expect(nft.transferHandlingFeeAccount(ADDRESS_ZERO))
                .to.be.revertedWith("account is zero address");
        });

        it("adjust fee ratio", async function() {
            let _newFeeRatio = 777;
            await nft.adjustFeeRatio(_newFeeRatio);
            let eptHandlingFeeRatio = await nft.getHandlingFeeRatio();
            expect(eptHandlingFeeRatio).to.be.equal(_newFeeRatio);
        });

        it("adjust fee raito when caller is not owner", async function() {
            await expect(nft.connect(user).adjustFeeRatio(999))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("NFT commodity on shelf", async function() {
            let _tokenIds = [1,2], _price = 66;
            let _tokenQuantities = [12, 24];

            // need sufficient balance and approve
            await token1155.addBalance(owner.address, _tokenIds[0], _tokenQuantities[0]);
            await token1155.addBalance(owner.address, _tokenIds[1], _tokenQuantities[1]);
            await token1155.setApprovalForAll(nft.address, true);

            // get state variable before
            let commodityIdBefore = await nft.commodityId();
            let sellerCommodityIdsBefore = await nft.getSellerCommodityIds();
            let sellerCommodityIdsLenBefore = await nft.getSellerCommodityQuantity(owner.address);
            let tokenIdOfCommodityIdsBefore = await nft.getTokenCommodityIds(_tokenIds[0]);
            let tokenIdOfCommodityIdsLenBefore = await nft.getTokenCommodityQuantity(_tokenIds[0]);
            let onShelfCommodityIdsBefore = await nft.getOnShelfCommodityIds();
            let onShelfCommodityIdsLenBefore = onShelfCommodityIdsBefore.length;
            // let commodityBefore = await nft.getNFTCommodity(commodityIdBefore);
            // console.log("NFT commodity:", commodityBefore);

            let tx = await nft.onShelfNFTCommodity(token1155.address, _tokenIds, _tokenQuantities, _price, token20.address);

            // get state variable after
            let commodityIdAfter = await nft.commodityId();
            let sellerCommodityIdsAfter = await nft.getSellerCommodityIds();
            let sellerCommodityIdsLenAfter = sellerCommodityIdsAfter.length;
            let tokenIdOfCommodityIdsAfter = await nft.getTokenCommodityIds(_tokenIds[0]);
            let tokenIdOfCommodityIdsLenAfter = tokenIdOfCommodityIdsAfter.length;
            let onShelfCommodityIdsAfter = await nft.getOnShelfCommodityIds();
            let onShelfCommodityIdsLenAfter = onShelfCommodityIdsAfter.length;
            let commodityAfter = await nft.getNFTCommodity(commodityIdAfter);
            

            let eptOnShelfCom = await nft.getSellerCommodity(owner.address, 0);
            expect(eptOnShelfCom.commodityId).to.be.equal(commodityIdAfter);
            eptOnShelfCom = await nft.getTokenCommodity(_tokenIds[0], 0);
            expect(eptOnShelfCom.owner).to.be.equal(owner.address);

            // check event
            let receipt = await tx.wait();
            let onShelfEvent = receipt.events.pop();
            expect(onShelfEvent.event).to.be.equal("NFTCommodityOnShelf");
            expect(onShelfEvent.eventSignature)
                .to.be.equal("NFTCommodityOnShelf(uint256,address,address,uint256[],uint256[],uint256)");
            let amounts = onShelfEvent.args;
            expect(amounts._commodityId).to.be.equal(commodityIdAfter);
            expect(amounts._owner).to.be.equal(owner.address);
            expect(amounts._tokenAddress).to.be.equal(token1155.address);
            expect(amounts._tokenIds.length).to.be.equal(_tokenIds.length);
            expect(amounts._tokenIds[0]).to.be.equal(_tokenIds[0]);
            expect(amounts._tokenIds[1]).to.be.equal(_tokenIds[1]);
            expect(amounts._tokenQuantities.length).to.be.equal(_tokenQuantities.length);
            expect(amounts._tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
            expect(amounts._tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
            expect(amounts._price).to.be.equal(_price);

            // check data
            expect(commodityIdAfter).to.be.equal(parseInt(commodityIdBefore) + 1);
            expect(sellerCommodityIdsLenAfter).to.be.equal(parseInt(sellerCommodityIdsLenBefore) + 1);
            expect(sellerCommodityIdsAfter[sellerCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            expect(tokenIdOfCommodityIdsLenAfter).to.be.equal(parseInt(tokenIdOfCommodityIdsLenBefore) + 1);
            expect(tokenIdOfCommodityIdsAfter[tokenIdOfCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            expect(onShelfCommodityIdsLenAfter).to.be.equal(onShelfCommodityIdsLenBefore + 1);
            expect(onShelfCommodityIdsAfter[onShelfCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            
            // NFT commodity
            // console.log("NFT commodity:", commodityAfter);
            expect(commodityAfter.commodityId).to.be.equal(commodityIdAfter);
            expect(commodityAfter.owner).to.be.equal(owner.address);
            expect(commodityAfter.tokenAddress).to.be.equal(token1155.address);
            expect(commodityAfter.tokenIds.length).to.be.equal(_tokenIds.length);
            expect(commodityAfter.tokenIds[0]).to.be.equal(_tokenIds[0]);
            expect(commodityAfter.tokenIds[1]).to.be.equal(_tokenIds[1]);
            expect(commodityAfter.tokenQuantities.length).to.be.equal(_tokenQuantities.length);
            expect(commodityAfter.tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
            expect(commodityAfter.tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
            expect(commodityAfter.price).to.be.equal(_price);
            expect(commodityAfter.token20Address).to.be.equal(token20.address);
            expect(commodityAfter.buyer).to.be.equal(ADDRESS_ZERO);
            expect(commodityAfter.status).to.be.equal(0);


            // if it is erc721 token.
            _tokenIds = [3, 4];
            await token721.myMint(owner.address, _tokenIds[0]);
            await token721.myMint(owner.address, _tokenIds[1]);
            await token721.setApprovalForAll(nft.address, true);
            
            tx = await nft.onShelfNFTCommodity(token721.address, _tokenIds, _tokenQuantities, _price, token20.address);

            // get state variable after
            commodityIdAfter = await nft.commodityId();
            sellerCommodityIdsAfter = await nft.getSellerCommodityIds();
            sellerCommodityIdsLenAfter = sellerCommodityIdsAfter.length;
            tokenIdOfCommodityIdsAfter = await nft.getTokenCommodityIds(_tokenIds[0]);
            tokenIdOfCommodityIdsLenAfter = tokenIdOfCommodityIdsAfter.length;
            onShelfCommodityIdsAfter = await nft.getOnShelfCommodityIds();
            onShelfCommodityIdsLenAfter = onShelfCommodityIdsAfter.length;
            commodityAfter = await nft.getNFTCommodity(commodityIdAfter);
            

            eptOnShelfCom = await nft.getSellerCommodity(owner.address, 1);
            expect(eptOnShelfCom.commodityId).to.be.equal(commodityIdAfter);
            eptOnShelfCom = await nft.getTokenCommodity(_tokenIds[0], 0);
            expect(eptOnShelfCom.owner).to.be.equal(owner.address);

            // check event
            receipt = await tx.wait();
            onShelfEvent = receipt.events.pop();
            expect(onShelfEvent.event).to.be.equal("NFTCommodityOnShelf");
            expect(onShelfEvent.eventSignature)
                .to.be.equal("NFTCommodityOnShelf(uint256,address,address,uint256[],uint256[],uint256)");
            amounts = onShelfEvent.args;
            expect(amounts._commodityId).to.be.equal(commodityIdAfter);
            expect(amounts._owner).to.be.equal(owner.address);
            expect(amounts._tokenAddress).to.be.equal(token721.address);
            expect(amounts._tokenIds.length).to.be.equal(_tokenIds.length);
            expect(amounts._tokenIds[0]).to.be.equal(_tokenIds[0]);
            expect(amounts._tokenIds[1]).to.be.equal(_tokenIds[1]);
            expect(amounts._tokenQuantities.length).to.be.equal(_tokenQuantities.length);
            expect(amounts._tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
            expect(amounts._tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
            expect(amounts._price).to.be.equal(_price);

            // check data
            expect(commodityIdAfter).to.be.equal(parseInt(commodityIdBefore) + 2);
            expect(sellerCommodityIdsLenAfter).to.be.equal(parseInt(sellerCommodityIdsLenBefore) + 2);
            expect(sellerCommodityIdsAfter[sellerCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            expect(tokenIdOfCommodityIdsLenAfter).to.be.equal(parseInt(tokenIdOfCommodityIdsLenBefore) + 1);
            expect(tokenIdOfCommodityIdsAfter[tokenIdOfCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            expect(onShelfCommodityIdsLenAfter).to.be.equal(onShelfCommodityIdsLenBefore + 2);
            expect(onShelfCommodityIdsAfter[onShelfCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
           
            // NFT commodity
            // console.log("NFT commodity:", commodityAfter);
            expect(commodityAfter.commodityId).to.be.equal(commodityIdAfter);
            expect(commodityAfter.owner).to.be.equal(owner.address);
            expect(commodityAfter.tokenAddress).to.be.equal(token721.address);
            expect(commodityAfter.tokenIds.length).to.be.equal(_tokenIds.length);
            expect(commodityAfter.tokenIds[0]).to.be.equal(_tokenIds[0]);
            expect(commodityAfter.tokenIds[1]).to.be.equal(_tokenIds[1]);
            expect(commodityAfter.tokenQuantities.length).to.be.equal(_tokenQuantities.length);
            expect(commodityAfter.tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
            expect(commodityAfter.tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
            expect(commodityAfter.price).to.be.equal(_price);
            expect(commodityAfter.token20Address).to.be.equal(token20.address);
            expect(commodityAfter.buyer).to.be.equal(ADDRESS_ZERO);
            expect(commodityAfter.status).to.be.equal(0);
        });

        it("NFT commodity on shelf with Hippo NFT", async function() {
            let _tokenIds = [1,2], _price = 66;
            let _tokenQuantities = [12, 24];

            // need sufficient balance and approve
            await token1155.addBalance(owner.address, _tokenIds[0], _tokenQuantities[0]);
            await token1155.addBalance(owner.address, _tokenIds[1], _tokenQuantities[1]);
            await token1155.setApprovalForAll(nft.address, true);

            // this.HippoNFT = await ethers.getContractFactory("HippoNFT");
            // this.hippoNFT = await this.HippoNFT.deploy();
            // await this.hippoNFT.deployed();
            // await this.hippoNFT.initialize("hippo.cycan.network");

            // let _amount = "5";
            // let _url = "ipfs://12345678"

            // let _urls = ["ipfs://token01","ipfs://token02"];

            // await this.hippoNFT.batchMint(_tokenQuantities,_urls)

            // await this.hippoNFT.setApprovalForAll(nft.address, true);

            // get state variable before
            let commodityIdBefore = await nft.commodityId();
            let sellerCommodityIdsBefore = await nft.getSellerCommodityIds();
            let sellerCommodityIdsLenBefore = await nft.getSellerCommodityQuantity(owner.address);
            let tokenIdOfCommodityIdsBefore = await nft.getTokenCommodityIds(_tokenIds[0]);
            let tokenIdOfCommodityIdsLenBefore = await nft.getTokenCommodityQuantity(_tokenIds[0]);
            let onShelfCommodityIdsBefore = await nft.getOnShelfCommodityIds();
            let onShelfCommodityIdsLenBefore = onShelfCommodityIdsBefore.length;
            // let commodityBefore = await nft.getNFTCommodity(commodityIdBefore);
            // console.log("NFT commodity:", commodityBefore);

            let tx = await nft.onShelfNFTCommodity(token1155.address, _tokenIds, _tokenQuantities, _price, token20.address);

            // get state variable after
            let commodityIdAfter = await nft.commodityId();
            let sellerCommodityIdsAfter = await nft.getSellerCommodityIds();
            let sellerCommodityIdsLenAfter = sellerCommodityIdsAfter.length;
            let tokenIdOfCommodityIdsAfter = await nft.getTokenCommodityIds(_tokenIds[0]);
            let tokenIdOfCommodityIdsLenAfter = tokenIdOfCommodityIdsAfter.length;
            let onShelfCommodityIdsAfter = await nft.getOnShelfCommodityIds();
            let onShelfCommodityIdsLenAfter = onShelfCommodityIdsAfter.length;
            let commodityAfter = await nft.getNFTCommodity(commodityIdAfter);

            let eptOnShelfCom = await nft.getSellerCommodity(owner.address, 0);
            expect(eptOnShelfCom.commodityId).to.be.equal(commodityIdAfter);
            eptOnShelfCom = await nft.getTokenCommodity(_tokenIds[0], 0);
            expect(eptOnShelfCom.owner).to.be.equal(owner.address);

            // check event
            let receipt = await tx.wait();
            let onShelfEvent = receipt.events.pop();
            expect(onShelfEvent.event).to.be.equal("NFTCommodityOnShelf");
            expect(onShelfEvent.eventSignature)
                .to.be.equal("NFTCommodityOnShelf(uint256,address,address,uint256[],uint256[],uint256)");
            let amounts = onShelfEvent.args;
            expect(amounts._commodityId).to.be.equal(commodityIdAfter);
            expect(amounts._owner).to.be.equal(owner.address);
            expect(amounts._tokenAddress).to.be.equal(token1155.address);
            expect(amounts._tokenIds.length).to.be.equal(_tokenIds.length);
            expect(amounts._tokenIds[0]).to.be.equal(_tokenIds[0]);
            expect(amounts._tokenIds[1]).to.be.equal(_tokenIds[1]);
            expect(amounts._tokenQuantities.length).to.be.equal(_tokenQuantities.length);
            expect(amounts._tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
            expect(amounts._tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
            expect(amounts._price).to.be.equal(_price);

            // check data
            expect(commodityIdAfter).to.be.equal(parseInt(commodityIdBefore) + 1);
            expect(sellerCommodityIdsLenAfter).to.be.equal(parseInt(sellerCommodityIdsLenBefore) + 1);
            expect(sellerCommodityIdsAfter[sellerCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            expect(tokenIdOfCommodityIdsLenAfter).to.be.equal(parseInt(tokenIdOfCommodityIdsLenBefore) + 1);
            expect(tokenIdOfCommodityIdsAfter[tokenIdOfCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            expect(onShelfCommodityIdsLenAfter).to.be.equal(onShelfCommodityIdsLenBefore + 1);
            expect(onShelfCommodityIdsAfter[onShelfCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            // NFT commodity
            // console.log("NFT commodity:", commodityAfter);
            expect(commodityAfter.commodityId).to.be.equal(commodityIdAfter);
            expect(commodityAfter.owner).to.be.equal(owner.address);
            expect(commodityAfter.tokenAddress).to.be.equal(token1155.address);
            expect(commodityAfter.tokenIds.length).to.be.equal(_tokenIds.length);
            expect(commodityAfter.tokenIds[0]).to.be.equal(_tokenIds[0]);
            expect(commodityAfter.tokenIds[1]).to.be.equal(_tokenIds[1]);
            expect(commodityAfter.tokenQuantities.length).to.be.equal(_tokenQuantities.length);
            expect(commodityAfter.tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
            expect(commodityAfter.tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
            expect(commodityAfter.price).to.be.equal(_price);
            expect(commodityAfter.token20Address).to.be.equal(token20.address);
            expect(commodityAfter.buyer).to.be.equal(ADDRESS_ZERO);
            expect(commodityAfter.status).to.be.equal(0);


            // if it is erc721 token.
            _tokenIds = [3, 4];
            await token721.myMint(owner.address, _tokenIds[0]);
            await token721.myMint(owner.address, _tokenIds[1]);
            await token721.setApprovalForAll(nft.address, true);
            
            
            tx = await nft.onShelfNFTCommodity(token721.address, _tokenIds, _tokenQuantities, _price, token20.address);

            // get state variable after
            commodityIdAfter = await nft.commodityId();
            sellerCommodityIdsAfter = await nft.getSellerCommodityIds();
            sellerCommodityIdsLenAfter = sellerCommodityIdsAfter.length;
            tokenIdOfCommodityIdsAfter = await nft.getTokenCommodityIds(_tokenIds[0]);
            tokenIdOfCommodityIdsLenAfter = tokenIdOfCommodityIdsAfter.length;
            onShelfCommodityIdsAfter = await nft.getOnShelfCommodityIds();
            onShelfCommodityIdsLenAfter = onShelfCommodityIdsAfter.length;
            commodityAfter = await nft.getNFTCommodity(commodityIdAfter);
            

            eptOnShelfCom = await nft.getSellerCommodity(owner.address, 1);
            expect(eptOnShelfCom.commodityId).to.be.equal(commodityIdAfter);
            eptOnShelfCom = await nft.getTokenCommodity(_tokenIds[0], 0);
            expect(eptOnShelfCom.owner).to.be.equal(owner.address);

            // check event
            receipt = await tx.wait();
            onShelfEvent = receipt.events.pop();
            expect(onShelfEvent.event).to.be.equal("NFTCommodityOnShelf");
            expect(onShelfEvent.eventSignature)
                .to.be.equal("NFTCommodityOnShelf(uint256,address,address,uint256[],uint256[],uint256)");
            amounts = onShelfEvent.args;
            expect(amounts._commodityId).to.be.equal(commodityIdAfter);
            expect(amounts._owner).to.be.equal(owner.address);
            expect(amounts._tokenAddress).to.be.equal(token721.address);
            expect(amounts._tokenIds.length).to.be.equal(_tokenIds.length);
            expect(amounts._tokenIds[0]).to.be.equal(_tokenIds[0]);
            expect(amounts._tokenIds[1]).to.be.equal(_tokenIds[1]);
            expect(amounts._tokenQuantities.length).to.be.equal(_tokenQuantities.length);
            expect(amounts._tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
            expect(amounts._tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
            expect(amounts._price).to.be.equal(_price);

            // check data
            expect(commodityIdAfter).to.be.equal(parseInt(commodityIdBefore) + 2);
            expect(sellerCommodityIdsLenAfter).to.be.equal(parseInt(sellerCommodityIdsLenBefore) + 2);
            expect(sellerCommodityIdsAfter[sellerCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            expect(tokenIdOfCommodityIdsLenAfter).to.be.equal(parseInt(tokenIdOfCommodityIdsLenBefore) + 1);
            expect(tokenIdOfCommodityIdsAfter[tokenIdOfCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            expect(onShelfCommodityIdsLenAfter).to.be.equal(onShelfCommodityIdsLenBefore + 2);
            expect(onShelfCommodityIdsAfter[onShelfCommodityIdsLenAfter - 1]).to.be.equal(commodityIdAfter);
            // NFT commodity
            // console.log("NFT commodity:", commodityAfter);
            expect(commodityAfter.commodityId).to.be.equal(commodityIdAfter);
            expect(commodityAfter.owner).to.be.equal(owner.address);
            expect(commodityAfter.tokenAddress).to.be.equal(token721.address);
            expect(commodityAfter.tokenIds.length).to.be.equal(_tokenIds.length);
            expect(commodityAfter.tokenIds[0]).to.be.equal(_tokenIds[0]);
            expect(commodityAfter.tokenIds[1]).to.be.equal(_tokenIds[1]);
            expect(commodityAfter.tokenQuantities.length).to.be.equal(_tokenQuantities.length);
            expect(commodityAfter.tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
            expect(commodityAfter.tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
            expect(commodityAfter.price).to.be.equal(_price);
            expect(commodityAfter.token20Address).to.be.equal(token20.address);
            expect(commodityAfter.buyer).to.be.equal(ADDRESS_ZERO);
            expect(commodityAfter.status).to.be.equal(0);
        });

        it("NFT commodity on shelf failed", async function() {
            let _tokenIds = [1,2], _price = 66;
            let _tokenQuantities = [0];
            // not erc721 or erc1155
            await expect(nft.onShelfNFTCommodity(
                token20.address, _tokenIds, _tokenQuantities, _price, token20.address
                )).to.be.revertedWith("not erc721 or erc1155 contract address");

            // tokenIds' length must equal to tokenQuantities' length
            await expect(nft.onShelfNFTCommodity(
                token1155.address, _tokenIds, _tokenQuantities, _price, token20.address
                )).to.be.revertedWith("ids and quantities length mismatch");

            // tokenQuantities' value must GT 0
            _tokenQuantities = [0, 0];
            await expect(nft.onShelfNFTCommodity(
                token1155.address, _tokenIds, _tokenQuantities, _price, token20.address
                )).to.be.revertedWith("quantity is zero");

            // balance of (owner, tokenId) must GT tokenQuantitie
            _tokenQuantities = [12, 24];
            await expect(nft.onShelfNFTCommodity(
                token1155.address, _tokenIds, _tokenQuantities, _price, token20.address
                )).to.be.revertedWith("nft balance not enough");
            // the same situation in erc721
            await token721.myMint(user.address, _tokenIds[0]);  // _tokenId must has owner, or it will throw an error.
            await token721.myMint(user.address, _tokenIds[1]);  // _tokenId must has owner, or it will throw an error.
            await expect(nft.onShelfNFTCommodity(
                token721.address, _tokenIds, _tokenQuantities, _price, token20.address
                )).to.be.revertedWith("nft balance not enough");

            // token address must approve this contract address
            await token1155.addBalance(owner.address, _tokenIds[0], _tokenQuantities[0]);
            await token1155.addBalance(owner.address, _tokenIds[1], _tokenQuantities[1]);
            await expect(nft.onShelfNFTCommodity(
                token1155.address, _tokenIds, _tokenQuantities, _price, token20.address
                )).to.be.revertedWith("transfer not approved");
            // the same situation in erc721
            await token721.myMint(owner.address, 6);
            await token721.myMint(owner.address, 7);
            await expect(nft.onShelfNFTCommodity(
                token721.address, [6,7], _tokenQuantities, _price, token20.address
                )).to.be.revertedWith("transfer not approved");

            // token is not supported
            await token1155.setApprovalForAll(nft.address, true);
            await expect(nft.onShelfNFTCommodity(
                token1155.address, _tokenIds, _tokenQuantities, _price, user.address
                )).to.be.revertedWith("not in support tokens");

            // price is zero
            await expect(nft.onShelfNFTCommodity(
                token1155.address, _tokenIds, _tokenQuantities, 0, token20.address
                )).to.be.revertedWith("price is zero");
        });

        describe("After NFT commodity On shelf", async function() {
            let _tokenIds = [1,2], _tokenIds2 = [3, 4], _price = 66;
            let _tokenQuantities = [12, 24];
            beforeEach("", async function() {
                await token1155.addBalance(owner.address, _tokenIds[0], _tokenQuantities[0] + 10);
                await token1155.addBalance(owner.address, _tokenIds[1], _tokenQuantities[1] + 20);
                await token1155.setApprovalForAll(nft.address, true);

                await token721.myMint(owner.address, _tokenIds2[0]);
                await token721.myMint(owner.address, _tokenIds2[1]);
                await token721.setApprovalForAll(nft.address, true);

        
                await nft.onShelfNFTCommodity(token1155.address, _tokenIds, _tokenQuantities, _price, token20.address);
                await nft.onShelfNFTCommodity(token721.address, _tokenIds2, _tokenQuantities, _price, token20.address);
            });

            it("delete NFT commodity", async function() {
                // onShelfCommodityIds:[1, 2], onShelfCommodityIdIndex:{1:1, 2:2}
                let eptOnshelfCommodityIds = await nft.getOnShelfCommodityIds();
                let eptIndex1 = await nft.onShelfCommodityIdIndex(1);
                let eptIndex2 = await nft.onShelfCommodityIdIndex(2);
                expect(await nft.getOnShelfCommodityQuantity()).to.be.equal(eptOnshelfCommodityIds.length);
                expect(eptOnshelfCommodityIds[0]).to.be.equal(1);
                expect(eptOnshelfCommodityIds[1]).to.be.equal(2);
                expect(eptIndex1).to.be.equal(1);
                expect(eptIndex2).to.be.equal(2);

                let eptOnShelfCom = await nft.getOnShelfCommodity(0);
                expect(eptOnShelfCom.owner).to.be.equal(owner.address);

                // after delete commodityId 1, onShelfCommodityIds:[2], onShelfCommodityIdIndex:{2:1}
                let _commodityId = 1;
                await nft.deleteNFTCommodity(_commodityId);
                eptOnshelfCommodityIds = await nft.getOnShelfCommodityIds();
                eptIndex2 = await nft.onShelfCommodityIdIndex(2);
                expect(eptOnshelfCommodityIds.length).to.be.equal(1);
                expect(eptOnshelfCommodityIds[0]).to.be.equal(2);
                expect(eptIndex2).to.be.equal(1);

                // after delete commodityId 2, onShelfCommodityIds:[], onShelfCommodityIdIndex:{}
                _commodityId = 2;
                await nft.deleteNFTCommodity(_commodityId);
                eptOnshelfCommodityIds = await nft.getOnShelfCommodityIds();
                expect(eptOnshelfCommodityIds.length).to.be.equal(0);
            });

            it("deleta NFT commodity failed when not on shelf", async function() {
                await expect(nft.deleteNFTCommodity(9)).to.be.revertedWith("index is zero");
            });

            it("buy NFT commodity", async function() {
                let _commodityId = 1, _commodityId2 = 2, _amount = _price;

                await token20.addBalance(user.address, _amount * 2);
                await token20.approveTo(user.address, nft.address, _amount * 2);

                let buyerCommodityIdsBefore = await nft.connect(user).getBuyerCommodityIds({from:user.address});
                let buyerCommodityIdsLenBefore = await nft.getBuyerCommodityQuantity(user.address);
                let tx = await nft.connect(user).buyNFTCommodity(_commodityId, _amount, {from:user.address});
                let tx2 = await nft.connect(user).buyNFTCommodity(_commodityId2, _amount, {from:user.address});

                // check buyerCommodityIds of user.address
                let buyerCommodityIdsAfter = await nft.connect(user).getBuyerCommodityIds({from:user.address});
                let buyerCommodityIdsLenAfter = buyerCommodityIdsAfter.length;
                expect(buyerCommodityIdsLenAfter).to.be.equal(parseInt(buyerCommodityIdsLenBefore) + 2);
                expect(buyerCommodityIdsAfter[buyerCommodityIdsLenAfter - 1]).to.be.equal(_commodityId2);

                let eptBuyerCom = await nft.getBuyerCommodity(user.address, 0);
                expect(eptBuyerCom.commodityId).to.be.equal(_commodityId);

                // check this commodity's change
                let eptNFTCommodity = await nft.getNFTCommodity(_commodityId);
                expect(eptNFTCommodity.buyer).to.be.equal(user.address);
                expect(eptNFTCommodity.status).to.be.equal(1);
                eptNFTCommodity = await nft.getNFTCommodity(_commodityId2);
                expect(eptNFTCommodity.buyer).to.be.equal(user.address);
                expect(eptNFTCommodity.status).to.be.equal(1);

                // check event
                let receipt = await tx.wait();
                let soldEvent = receipt.events.pop();
                expect(soldEvent.event).to.be.equal("NFTCommoditySold");
                expect(soldEvent.eventSignature)
                    .to.be.equal("NFTCommoditySold(uint256,address,address,uint256[],uint256[],uint256,address)");
                let amounts = soldEvent.args;
                expect(amounts._commodityId).to.be.equal(_commodityId);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token1155.address);
                expect(amounts._tokenIds.length).to.be.equal(_tokenIds.length);
                expect(amounts._tokenIds[0]).to.be.equal(_tokenIds[0]);
                expect(amounts._tokenIds[1]).to.be.equal(_tokenIds[1]);
                expect(amounts._tokenQuantities.length).to.be.equal(_tokenQuantities.length);
                expect(amounts._tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
                expect(amounts._tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
                expect(amounts._price).to.be.equal(_price);
                expect(amounts._buyer).to.be.equal(user.address);

                // erc721 token
                receipt = await tx2.wait();
                soldEvent = receipt.events.pop();
                expect(soldEvent.event).to.be.equal("NFTCommoditySold");
                expect(soldEvent.eventSignature)
                    .to.be.equal("NFTCommoditySold(uint256,address,address,uint256[],uint256[],uint256,address)");
                amounts = soldEvent.args;
                expect(amounts._commodityId).to.be.equal(_commodityId2);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token721.address);
                expect(amounts._tokenIds.length).to.be.equal(_tokenIds2.length);
                expect(amounts._tokenIds[0]).to.be.equal(_tokenIds2[0]);
                expect(amounts._tokenIds[1]).to.be.equal(_tokenIds2[1]);
                expect(amounts._tokenQuantities.length).to.be.equal(_tokenQuantities.length);
                expect(amounts._tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
                expect(amounts._tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
                expect(amounts._price).to.be.equal(_price);
                expect(amounts._buyer).to.be.equal(user.address);
            });

            it("buy NFT commodity when handlingFeeRatio is zero", async function() {
                await nft.adjustFeeRatio(0);
                let _commodityId = 1, _amount = _price;
                await token20.addBalance(user.address, _amount);
                await token20.approveTo(user.address, nft.address, _amount);
                await nft.connect(user).buyNFTCommodity(_commodityId, _amount, {from:user.address});
                // check
                let eptBalanceOfOwner = await token20.balanceOf(owner.address);
                let eptBalanceOfUser = await token20.balanceOf(user.address);
                expect(eptBalanceOfOwner).to.be.equal(_amount);
                expect(eptBalanceOfUser).to.be.equal(0);
            });

            it("buy NFT commodity failed", async function() {
                let _commodityId = 1, _amount = _price;
                // seller and buyer are the same address
                await expect(nft.buyNFTCommodity(_commodityId, _amount)).to.be.revertedWith("can not buy own");

                // Price is not correct.
                await expect(nft.connect(user)
                    .buyNFTCommodity(_commodityId, _amount+1, {from:user.address}))
                    .to.be.revertedWith("amount not equal to price");

                // commodity must on shelf
                await nft.offShelfNFTCommodity(_commodityId);
                await expect(nft.connect(user)
                    .buyNFTCommodity(_commodityId, _amount, {from:user.address}))
                    .to.be.revertedWith("have been sold or off shelf");
            });

            it("NFT commodity off shelf", async function() {
                let _commodityId = 1, _commodityId2 = 2;
                let eptCommodity = await nft.getNFTCommodity(_commodityId);
                expect(eptCommodity.status).to.be.equal(0);
                eptCommodity = await nft.getNFTCommodity(_commodityId2);
                expect(eptCommodity.status).to.be.equal(0);

                let tx = await nft.offShelfNFTCommodity(_commodityId);
                let tx2 = await nft.offShelfNFTCommodity(_commodityId2);

                // check status
                eptCommodity = await nft.getNFTCommodity(_commodityId);
                expect(eptCommodity.status).to.be.equal(2);
                eptCommodity = await nft.getNFTCommodity(_commodityId2);
                expect(eptCommodity.status).to.be.equal(2);

                // check event
                let receipt = await tx.wait();
                let offShelfEvent = receipt.events.pop();
                expect(offShelfEvent.event).to.be.equal("NFTCommodityOffShelf");
                expect(offShelfEvent.eventSignature)
                    .to.be.equal("NFTCommodityOffShelf(uint256,address,address,uint256[],uint256[],uint256)");
                let amounts = offShelfEvent.args;
                expect(amounts._commodityId).to.be.equal(_commodityId);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token1155.address);
                expect(amounts._tokenIds.length).to.be.equal(_tokenIds.length);
                expect(amounts._tokenIds[0]).to.be.equal(_tokenIds[0]);
                expect(amounts._tokenIds[1]).to.be.equal(_tokenIds[1]);
                expect(amounts._tokenQuantities.length).to.be.equal(_tokenQuantities.length);
                expect(amounts._tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
                expect(amounts._tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
                expect(amounts._price).to.be.equal(_price);

                // erc721 token
                receipt = await tx2.wait();
                offShelfEvent = receipt.events.pop();
                expect(offShelfEvent.event).to.be.equal("NFTCommodityOffShelf");
                expect(offShelfEvent.eventSignature)
                    .to.be.equal("NFTCommodityOffShelf(uint256,address,address,uint256[],uint256[],uint256)");
                amounts = offShelfEvent.args;
                expect(amounts._commodityId).to.be.equal(_commodityId2);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token721.address);
                expect(amounts._tokenIds.length).to.be.equal(_tokenIds2.length);
                expect(amounts._tokenIds[0]).to.be.equal(_tokenIds2[0]);
                expect(amounts._tokenIds[1]).to.be.equal(_tokenIds2[1]);
                expect(amounts._tokenQuantities.length).to.be.equal(_tokenQuantities.length);
                expect(amounts._tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
                expect(amounts._tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
                expect(amounts._price).to.be.equal(_price);
            });

            it("NFT commodity off shelf failed", async function() {
                let _commodityId = 1, _amount = _price;
                // not owner
                await expect(nft.connect(user)
                    .offShelfNFTCommodity(_commodityId, {from:user.address}))
                    .to.be.revertedWith("you are not the owner");

                // commodity has been sold
                await token20.addBalance(user.address, _amount);
                await token20.approveTo(user.address, nft.address, _amount);
                await nft.connect(user).buyNFTCommodity(_commodityId, _amount, {from:user.address});
                await expect(nft.offShelfNFTCommodity(_commodityId))
                    .to.be.revertedWith("have been sold or off shelf");
            });

            it("modify NFT commodity price", async function() {
                let _commodityId = 1, _newPrice = 77;
                let tx = await nft.modifyNFTCommodityPrice(_commodityId, _newPrice);
                let eptCommodity = await nft.getNFTCommodity(_commodityId);
                // check price
                expect(eptCommodity.price).to.be.equal(_newPrice);
                // check event
                let receipt = await tx.wait();
                let priceChangeEvent = receipt.events.pop();
                expect(priceChangeEvent.event).to.be.equal("NFTCommodityPriceChange");
                expect(priceChangeEvent.eventSignature)
                    .to.be.equal("NFTCommodityPriceChange(uint256,address,address,uint256[],uint256[],uint256,uint256)");
                let amounts = priceChangeEvent.args;
                expect(amounts._commodityId).to.be.equal(_commodityId);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token1155.address);
                expect(amounts._tokenIds.length).to.be.equal(_tokenIds.length);
                expect(amounts._tokenIds[0]).to.be.equal(_tokenIds[0]);
                expect(amounts._tokenIds[1]).to.be.equal(_tokenIds[1]);
                expect(amounts._tokenQuantities.length).to.be.equal(_tokenQuantities.length);
                expect(amounts._tokenQuantities[0]).to.be.equal(_tokenQuantities[0]);
                expect(amounts._tokenQuantities[1]).to.be.equal(_tokenQuantities[1]);
                expect(amounts._oldPrice).to.be.equal(_price);
                expect(amounts._newPrice).to.be.equal(_newPrice);
            });

            it("modify NFT commodity price failed", async function() {
                let _commodityId = 1, _newPrice = 77;
                // price must GT 0
                await expect(nft.modifyNFTCommodityPrice(_commodityId, 0)).to.be.revertedWith("price is zero");
                // caller must be owner of commodity
                await expect(nft.connect(user)
                    .modifyNFTCommodityPrice(_commodityId, _newPrice, {from:user.address}))
                    .to.be.revertedWith("you are not the owner");
                // commodity must on shelf
                await nft.offShelfNFTCommodity(_commodityId);
                await expect(nft.modifyNFTCommodityPrice(_commodityId, _newPrice))
                    .to.be.revertedWith("have been sold or off shelf");
            });
        });
    });
});
