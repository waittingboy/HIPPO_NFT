const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const {BN} = require('@openzeppelin/test-helpers');
const { time } = require("./utilities")
const { ADDRESS_ZERO } = require("./utilities");


let owner, user, alice,bob;
let vbase, nft, utoken, democracy, box, token20, ctrt, crowd;

async function withDecimals(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(18))).toString();
}

describe("Virtual Work Base func", async function() {
    let _targetAmount = await withDecimals("10000000");
    let _basePayAmount = await withDecimals("100000");

    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];
        bob = this.signers[3];

        this.Base = await ethers.getContractFactory("BaseMock");
        this.ExternalBase = await ethers.getContractFactory("ExternalNftBaseMock");
        this.UserToken = await ethers.getContractFactory("UserTokensMock");
        this.Democracy = await ethers.getContractFactory("MyDemocracyMock");
        this.mysteryBox = await ethers.getContractFactory("MysteryBoxMock");
        this.IdProvider = await ethers.getContractFactory("IdProvider");
        this.NFTDepositBox = await ethers.getContractFactory("NFTDepositBoxMock");
        this.Contract = await ethers.getContractFactory("Contract");
        this.TOKEN1155 = await ethers.getContractFactory("NFTFactoryMock");
        this.ERC20 = await ethers.getContractFactory("Token20Mock");
        this.ERC721 = await ethers.getContractFactory("Token721Mock");
        this.Crowdfund = await ethers.getContractFactory("CrowdfundPoolsMock")
        this.Oracle = await ethers.getContractFactory("OracleV3");

        this.ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        this.MysteryBox = await ethers.getContractFactory("MysteryBox");
        this.MBPoolAdmin = await ethers.getContractFactory("MBPoolAdmin");
    });

    beforeEach(async function() {
        base = await this.Base.deploy();
        await base.deployed();

        vbase = await this.ExternalBase.deploy();
        await vbase.deployed();

        token1155 = await this.TOKEN1155.deploy()
        await token1155.deployed();

        token20 = await this.ERC20.deploy();
        await token20.deployed();

        token721 = await this.ERC721.deploy();
        await token721.deployed();

        utoken = await this.UserToken.deploy();
        await utoken.deployed();

        democracy = await this.Democracy.deploy();
        await democracy.deployed();

        box = await this.mysteryBox.deploy();
        await box.deployed();

        ip = await this.IdProvider.deploy();
        await ip.deployed();

        nftdb = await this.NFTDepositBox.deploy();
        await nftdb.deployed();

        ctrt = await this.Contract.deploy();
        await ctrt.deployed();

        crowd = await this.Crowdfund.deploy();
        await crowd.deployed();

        oracle = await this.Oracle.deploy(user.address, user.address, user.address, democracy.address);
        await oracle.deployed();

        this.hipToken = await this.ERC20Mock.deploy("hip token", "hip");
        await this.hipToken.deployed()
        await this.hipToken.mint(owner.address,_targetAmount)
        await this.hipToken.mint(user.address,_targetAmount)
        await this.hipToken.mint(alice.address,_targetAmount)

        // this.mysteryBox = await this.MysteryBox.deploy();
        // await this.mysteryBox.deployed();

        this.mbPoolAdmin = await this.MBPoolAdmin.deploy();
        await this.mbPoolAdmin.deployed();
        console.log("this.mbPoolAdmin.address",this.mbPoolAdmin.address);
        await this.mbPoolAdmin.initialize(
          this.hipToken.address,
          box.address,
          _basePayAmount
        )

        //await box.initialize(owner.address,this.mbPoolAdmin.address);
    });

    it("initialize", async function() {
        await vbase.initialize(
            box.address,
            democracy.address,
            ip.address,
            nftdb.address,
            crowd.address
        );
        expect(await vbase.mysteryBox()).to.be.equal(box.address);
        expect(await vbase.democracy()).to.be.equal(democracy.address);
        expect(await vbase.idProvider()).to.be.equal(ip.address);
        expect(await vbase.nftDepositBox()).to.be.equal(nftdb.address);
        expect(await vbase.crowdfund()).to.be.equal(crowd.address);
    });

    describe("collection management", async function() {

        beforeEach("",async function() {
            await box.initialize(owner.address, this.mbPoolAdmin.address)
            await box.setInternalCaller(vbase.address, true)
            await democracy.initialize(
                token20.address, 1, base.address, user.address, 10000,
                token20.address, vbase.address, crowd.address, oracle.address);
            await ip.initialize(owner.address, vbase.address);
            await ip.setInternalCaller(vbase.address, true);
            await ip.setInternalCaller(owner.address, true);
            await nftdb.initialize(box.address, token1155.address, vbase.address);
            // add whitelist
            await nftdb.addWhitelistNFTAddr(token721.address);
            await crowd.initialize(
                0, token20.address, owner.address, token20.address,
                token1155.address, base.address, democracy.address,
                owner.address, [token20.address], vbase.address
            );
            await vbase.initialize(
                box.address,
                democracy.address,
                ip.address,
                nftdb.address,
                crowd.address
            );
            await token1155.initialize(utoken.address, owner.address);
            await utoken.initialize(
                token1155.address, ctrt.address, user.address, user.address, user.address);
            await utoken.setInternalCaller(owner.address, true);
            await utoken.setInternalCaller(nftdb.address, true);
            await utoken.setInternalCaller(token1155.address, true);
            await utoken.setInternalCaller(token721.address, true);

        });

        it("update user info", async function() {
            let _name = "testName", _desc = "testDesc";
            let _id = 7, _amount = 6;
            await token1155.addBalance(owner.address, _id, _amount);
            await token1155.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(vbase.address, token1155.address, _id);
            await nftdb.setInternalCaller(vbase.address, true);

            let totalUsersBefore = await vbase.totalUsers();
            // first time: totalUsers++
            await vbase.updateUserInfo(_name, _desc, token1155.address, _id);
            expect(await token1155.balanceOf(nftdb.address, _id)).to.be.equal(1);
            expect(await token1155.balanceOf(owner.address, _id)).to.be.equal(_amount - 1);


            let eptUser = await vbase.users(owner.address);
            let totalUsersAfter = await vbase.totalUsers();
            expect(eptUser.name).to.be.equal(_name);
            expect(eptUser.desc).to.be.equal(_desc);
            expect(eptUser.avatarNftId).to.be.equal(1);
            expect(totalUsersAfter).to.be.equal(parseInt(totalUsersBefore) + 1);
            expect(eptUser.isRegistered).to.be.equal(true);

            // second time: totalUsers has no change
             _desc = "testDescAgain";
            await vbase.updateUserInfo(_name, _desc, token1155.address, _id);
            expect(await token1155.balanceOf(nftdb.address, _id)).to.be.equal(1);
            expect(await token1155.balanceOf(owner.address, _id)).to.be.equal(_amount - 1);

            eptUser = await vbase.users(owner.address);
            expect(eptUser.desc).to.be.equal(_desc);
            let totalUsersAfterAfter = await vbase.totalUsers();
            expect(totalUsersAfterAfter).to.be.equal(totalUsersAfter);
            expect(eptUser.isRegistered).to.be.equal(true);
        });

        it("create colletcion", async function() {
            let _collectionName = "testClName";
            let _collectionDesc = "testClDesc";
            let _collectionUrl = "testClUrl";
            await ip.createNewCollectionId();  // workId = 0, collectionId = 1;
            let userCollectLenBefore = await vbase.getUserCollectLen(owner.address);

            await vbase.createCollection(_collectionName, _collectionDesc, _collectionUrl); // 2
            let collectId = parseInt(await vbase.collectionId());
            let workId = parseInt(await vbase.collectIdToWorkId(collectId));

            expect(await vbase.workId()).to.be.equal(workId);
            expect(await vbase.collectionId()).to.be.equal(collectId);
            expect(await vbase.workIdToCollectId(workId)).to.be.equal(collectId)
            expect(await vbase.collectIdToWorkId(collectId)).to.be.equal(workId)

            let eptWork = await vbase.collections(collectId);
            expect(eptWork.name).to.be.equal(_collectionName);
            expect(eptWork.desc).to.be.equal(_collectionDesc);
            expect(eptWork.url).to.be.equal(_collectionUrl);
            expect(await vbase.getUploaderOfCollection(collectId)).to.be.equal(owner.address);

            let userCollectLenAfter = await vbase.getUserCollectLen(owner.address);
            expect(userCollectLenAfter).to.be.equal(parseInt(userCollectLenBefore) + 1);
            expect(await vbase.userCollections(owner.address, parseInt(userCollectLenAfter) - 1)).to.be.equal(collectId);
        });

        it("add nft to collection", async function() {
            let _collectionName = "testClName";
            let _collectionDesc = "testClDesc";
            let _collectionUrl = "testClUrl";
            await vbase.createCollection(_collectionName, _collectionDesc, _collectionUrl);
            let _collectId = parseInt(await vbase.collectionId());

            // deposit nft before add to collection
            let _ids = [7, 8], _amounts = [6, 1];
            await token1155.addBalance(owner.address, _ids[0], _amounts[0]);
            await token1155.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(owner.address, token1155.address, _ids[0]);
            await token721.myMint(owner.address, _ids[1]);
            await token721.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(owner.address, token721.address, _ids[1]);
            await nftdb.batchDepositNFT([token1155.address, token721.address], _ids, _amounts, owner.address);
            let _id = parseInt(await nftdb.nftId());  // 2

            // _nftId: [1, 2], collectionId: 2
            let nftIdsBefore = await vbase.getAllNFTIdsOfCollect(_collectId);
            let nftIdsLenBefore = nftIdsBefore.length;

            // add nft
            await vbase.addNFTToCollection(_id - 1, _collectId);  //
            let nftIdsAfter = await vbase.getNftIdsOfCollect(_collectId, 0, nftIdsLenBefore);
            let nftIdsLenAfter = nftIdsAfter.length;
            expect(nftIdsLenAfter).to.be.equal(nftIdsLenBefore + 1);
            expect(nftIdsAfter[nftIdsLenAfter - 1]).to.be.equal(_id - 1);
            expect(await vbase.isNFTOfCollect(_id - 1, _collectId)).to.be.equal(true);

            let eptNFT = await vbase.allNFTs(_id - 1);
            expect(eptNFT.collectionId).to.be.equal(_collectId);
            // TODO: the first NFT's index in collection nftids[] is 0, it is same with the default value 0.
            // need to start with value 1?
            expect(eptNFT.indexInCollection).to.be.equal(nftIdsLenAfter);
        });

        it("add nft to collection failed", async function() {
            let _collectionName = "testClName", _collectionDesc = "testClDesc", _collectionUrl = "testClUrl";
            await vbase.connect(user).createCollection(_collectionName, _collectionDesc, _collectionUrl, {from:user.address});
            let _collectId = parseInt(await vbase.collectionId());
            let _ids = [7, 8], _amounts = [6, 1];
            await token1155.addBalance(owner.address, _ids[0], _amounts[0]);
            await token1155.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(owner.address, token1155.address, _ids[0]);
            await token721.myMint(owner.address, _ids[1]);
            await token721.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(owner.address, token721.address, _ids[1]);
            await nftdb.batchDepositNFT([token1155.address, token721.address], _ids, _amounts, owner.address);
            let _id = parseInt(await nftdb.nftId());  // 2

            // not nft owner.
            await expect(vbase.connect(user).addNFTToCollection(_id, _collectId, {from:user.address}))
                .to.be.revertedWith("Only NFT owner can add");

            // not collection owner.
            await expect(vbase.addNFTToCollection(_id, _collectId))
                .to.be.revertedWith("Only collection owner can add");

            // collection's owner is ADDRESS_ZERO.
            // TODO: can not reach.

            // collection's status is not zero.
            await vbase.createCollection(_collectionName, _collectionDesc, _collectionUrl);
            _collectId = parseInt(await vbase.collectionId());
            await vbase.modifyCollectionStatus(_collectId, 1);
            await expect(vbase.addNFTToCollection(_id, _collectId))
                .to.be.revertedWith("Cannot add NFT now");

            // can not modify cause proposal status is not in ready.
            await vbase.modifyCollectionStatus(_collectId, 0);
            await democracy.modifyProposalStatus(_collectId, 1);  // make proposal's status not 0 or 4
            await democracy.setMaxProposalId(_collectId + 1);  // make max proposal GT _collectId
            await expect(vbase.addNFTToCollection(_id, _collectId))
                .to.be.revertedWith("Cannot modify");

            // Aready added
            await democracy.setMaxProposalId(_collectId - 1);  // make max proposal less than _collectId
            await vbase.addNFTToCollection(_id, _collectId)
            await expect(vbase.addNFTToCollection(_id, _collectId))
                .to.be.revertedWith("Already added");
        });

        describe("after create collection", async function() {
            let _collectionName = "testClName", _collectionDesc = "testClDesc", _collectionUrl = "testClUrl";
            let _ids = [7, 8], _amounts = [6, 1];
            beforeEach("", async function() {
                await vbase.createCollection(_collectionName, _collectionDesc, _collectionUrl);
                let _collectId = parseInt(await vbase.collectionId());

                // deposit nft before add to collection
                await token1155.addBalance(owner.address, _ids[0], _amounts[0]);
                await token1155.setApprovalForAll(nftdb.address, true);  // approve
                await utoken.addUserTokenId(owner.address, token1155.address, _ids[0]);
                await token721.myMint(owner.address, _ids[1]);
                await token721.setApprovalForAll(nftdb.address, true);  // approve
                await utoken.addUserTokenId(owner.address, token721.address, _ids[1]);
                await nftdb.depositNFT(token1155.address, _ids[0], _amounts[0]);
                let _id = parseInt(await nftdb.nftId());

                // add nft
                await vbase.addNFTToCollection(_id, _collectId);  //
            });

            it("deposit and add nft to collection", async function() {
                let _collectId = parseInt(await vbase.collectionId());
                // _nftId: 1, collectId: 1
                let nftIdsBefore = await vbase.getAllNFTIdsOfCollect(_collectId);
                let nftIdsLenBefore = nftIdsBefore.length;

                await vbase.depositAndAddNFTToCollection(token721.address, _ids[1], _amounts[1], _collectId);
                let _id = parseInt(await nftdb.nftId());

                let nftIdsAfter = await vbase.getAllNFTIdsOfCollect(_collectId);
                let nftIdsLenAfter = nftIdsAfter.length;
                expect(nftIdsLenAfter).to.be.equal(nftIdsLenBefore + 1);
                expect(nftIdsAfter[nftIdsLenAfter - 1]).to.be.equal(_id);

                let eptNFT = await vbase.allNFTs(_id);
                expect(eptNFT.collectionId).to.be.equal(_collectId);
                expect(eptNFT.indexInCollection).to.be.equal(nftIdsLenAfter);
            });

            it("batch deposit and add nft to collection", async function() {
                let _collectId = parseInt(await vbase.collectionId());
                // _nftId: 1, collectId: 1
                let nftIdsBefore = await vbase.getAllNFTIdsOfCollect(_collectId);
                let nftIdsLenBefore = nftIdsBefore.length;

                await vbase.batchDepositAndAddNFTToCollection([token721.address], [_ids[1]], [_amounts[1]], _collectId);
                let _id = parseInt(await nftdb.nftId());

                let nftIdsAfter = await vbase.getAllNFTIdsOfCollect(_collectId);
                let nftIdsLenAfter = nftIdsAfter.length;
                expect(nftIdsLenAfter).to.be.equal(nftIdsLenBefore + 1);
                expect(nftIdsAfter[nftIdsLenAfter - 1]).to.be.equal(_id);

                let eptNFT = await vbase.allNFTs(_id);
                expect(eptNFT.collectionId).to.be.equal(_collectId);
                expect(eptNFT.indexInCollection).to.be.equal(nftIdsLenAfter);
            });

            it("remove nft from collection", async function() {
                let _collectId = parseInt(await vbase.collectionId());
                let nftIdsBefore = await vbase.getAllNFTIdsOfCollect(_collectId);
                let nftIdsLenBefore = nftIdsBefore.length;
                await vbase.depositAndAddNFTToCollection(token721.address, _ids[1], _amounts[1], _collectId);
                let _id = parseInt(await nftdb.nftId());

                // nftIds: [1, 2], _id: 2, _collectId: 1
                await vbase.removeNFTFromCollection(_id - 1, _collectId);  // remove 1
                let nftIdsAfter = await vbase.getAllNFTIdsOfCollect(_collectId);
                let nftIdsLenAfter = nftIdsAfter.length;
                expect(nftIdsLenAfter).to.be.equal(nftIdsLenBefore); // add 1, then remove 1
                expect(nftIdsAfter[nftIdsLenAfter - 1]).to.be.equal(_id);

                let eptNFT = await vbase.allNFTs(_id);  // 2
                expect(eptNFT.collectionId).to.be.equal(_collectId);
                expect(eptNFT.indexInCollection).to.be.equal(nftIdsLenAfter);  // index: 1

                eptNFT = await vbase.allNFTs(_id - 1);
                expect(eptNFT.collectionId).to.be.equal(0);
                expect(eptNFT.indexInCollection).to.be.equal(0);  // index: 0
            });

            it("remove nft from collection failed", async function() {
                let _collectId = parseInt(await vbase.collectionId());
                let nftIdsBefore = await vbase.getAllNFTIdsOfCollect(_collectId);
                let nftIdsLenBefore = parseInt(await vbase.getCollectLen(_collectId));
                await vbase.depositAndAddNFTToCollection(token721.address, _ids[1], _amounts[1], _collectId);
                let _id = parseInt(await nftdb.nftId());

                // caller is not the collection owner
                await expect(vbase.connect(user).removeNFTFromCollection(_id, _collectId, {from:user.address}))
                    .to.be.revertedWith("Only collection owner can remove")

                // NFT not in the collection
                await vbase.createCollection(_collectionName, _collectionDesc, _collectionUrl);
                // need to add 2, IdProvider only provide even number for virtual base collectId
                await expect(vbase.removeNFTFromCollection(_id, _collectId + 2))
                    .to.be.revertedWith("NFT not in collection");

                // collection's status is not zero.
                await vbase.modifyCollectionStatus(_collectId, 1);
                await expect(vbase.removeNFTFromCollection(_id, _collectId))
                    .to.be.revertedWith("Cannot remove NFT now");

                // can not modify cause proposal status is not in ready.
                await vbase.modifyCollectionStatus(_collectId, 0);
                await democracy.modifyProposalStatus(_collectId, 1);  // make proposal's status not 0 or 4
                await democracy.setMaxProposalId(_collectId + 1);  // make max proposal GT _collectId
                await expect(vbase.removeNFTFromCollection(_id, _collectId))
                    .to.be.revertedWith("Cannot modify");
            });

            it("create proposal", async function() {
                let _tokenAddrs = [token721.address, token1155.address];
                let _tokenIds = [8, 9], _balances = [1, 10], _crowdfundParams = [1e6,2,3,4,5];

                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                await token20.addBalance(owner.address, await withDecimals(10));
                await token20.approveTo(owner.address, democracy.address, await withDecimals(10));

                _crowdfundParams[4] = await withDecimals(5);
                await vbase.createProposal(
                    _tokenAddrs, _tokenIds, _balances, _collectionName, _collectionDesc, _collectionUrl,  _crowdfundParams);
                let _collectId = parseInt(await vbase.collectionId());
                let eptCol = await vbase.collections(_collectId);
                expect(eptCol.status).to.be.equal(1);
            });

            it("create proposal failed", async function() {
                let _tokenAddrs = [token721.address, token1155.address];
                let _tokenIds = [8, 9], _balances = [1, 10], _crowdfundParams = [1,2,3,4];
                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);

                // _crowdfundParams length must be 5.
                await expect(vbase.createProposal(_tokenAddrs, _tokenIds, _balances,
                    _collectionName, _collectionDesc, _collectionUrl, _crowdfundParams))
                    .to.be.revertedWith("The length of _crowdfundParams need be 5");

                // collection's status is not zero.
                let _collectId = parseInt(await vbase.collectionId());
                _crowdfundParams = [1e6,2,3,4,5];
                // need to add 2, IdProvider only provide even number for virtual base collectId
                await vbase.modifyCollectionStatus(_collectId + 2, 1);
                await expect(vbase.createProposal(_tokenAddrs, _tokenIds, _balances,
                    _collectionName, _collectionDesc, _collectionUrl, _crowdfundParams))
                    .to.be.revertedWith("Cannot add NFT now'");
            });

            it("create proposal final step", async function() {
                let _tokenAddrs = [token721.address, token1155.address];
                let _tokenIds = [8, 9], _balances = [1, 10], _crowdfundParams = [1e6,2,3,4,5];

                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                await token20.addBalance(owner.address, await withDecimals(10));
                await token20.approveTo(owner.address, democracy.address, await withDecimals(10));

                _crowdfundParams[4] = await withDecimals(5);
                // create collection
                await vbase.createCollection(_collectionName, _collectionDesc, _collectionUrl);
                // add NFT to collection
                _colId = parseInt(await vbase.collectionId());
                await vbase.batchDepositAndAddNFTToCollection(_tokenAddrs, _tokenIds, _balances, _colId);
                _len = _tokenIds.length;
                await vbase.createProposalFinalStep(_colId, _len, _crowdfundParams);
                let eptCol = await vbase.collections(_colId);
                expect(eptCol.status).to.be.equal(1);
            });

            it("create proposal final step failed", async function() {
                let _tokenAddrs = [token721.address, token1155.address];
                let _tokenIds = [8, 9], _balances = [1, 10], _crowdfundParams = [1,2,3,4];
                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                // create collection
                await vbase.createCollection(_collectionName, _collectionDesc, _collectionUrl);
                // add NFT to collection
                _colId = parseInt(await vbase.collectionId());
                await vbase.batchDepositAndAddNFTToCollection(_tokenAddrs, _tokenIds, _balances, _colId);
                _len = _tokenIds.length;

                // _crowdfundParams length must be 5.
                await expect(vbase.createProposalFinalStep(_colId, _len, _crowdfundParams))
                    .to.be.revertedWith("The length of _crowdfundParams need be 5");
                // len is incorrect
                _crowdfundParams = [1e6,2,3,4,5];
                await expect(vbase.createProposalFinalStep(_colId, _len-1, _crowdfundParams))
                    .to.be.revertedWith("The input _len must equal to the len of nftIds");

                // collection's status is not zero.
                // need to add 2, IdProvider only provide even number for virtual base collectId
                await vbase.modifyCollectionStatus(_colId + 2, 1);
                await expect(vbase.createProposalFinalStep(_colId + 2, 0, _crowdfundParams))
                    .to.be.revertedWith("Cannot create proposal now'");
            });

            it("prepare mystery box package", async function() {
                let _tokenAddrs = [token721.address, token1155.address, token721.address, token1155.address];
                let _tokenIds = [8, 9, 10, 11], _balances = [1, 10, 1, 11];
                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await token1155.addBalance(owner.address, _tokenIds[3], _balances[3]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[3]);
                await token721.myMint(owner.address, _tokenIds[2]);
                await utoken.addUserTokenId(owner.address, token721.address, _tokenIds[2]);

                // add all the _tokenIds to collection, the collection has nftIds: [7,8,9,10,11]
                let _collectId = parseInt(await vbase.collectionId());
                await vbase.batchDepositAndAddNFTToCollection(_tokenAddrs, _tokenIds, _balances, _collectId);

                // prepare nftIds: [7, 8]
                let st = 0, ed = 1;
                // await vbase.modifyCollectionStatus(_collectId, 2);  // set the status 2 to pass the require check
                await vbase.prepareMbPackage(_collectId, st, ed);
                let eptCol = await vbase.collections(_collectId);
                expect(eptCol.status).to.be.equal(3);
                expect(eptCol.nextNFTId).to.be.equal(ed + 1);
                // prepare nftIds: [9,10]
                st = 2, ed = 3;
                await vbase.prepareMbPackage(_collectId, st, ed);
                eptCol = await vbase.collections(_collectId);
                expect(eptCol.nextNFTId).to.be.equal(ed + 1);
            });

            it("prepare mystery box package failed", async function() {
                let _tokenAddrs = [token721.address, token1155.address, token721.address, token1155.address];
                let _tokenIds = [8, 9, 10, 11], _balances = [1, 10, 1, 11];
                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await token1155.addBalance(owner.address, _tokenIds[3], _balances[3]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[3]);
                await token721.myMint(owner.address, _tokenIds[2]);
                await utoken.addUserTokenId(owner.address, token721.address, _tokenIds[2]);
                // add all the _tokenIds to collection, the collection has nftIds: [7,8,9,10,11]
                let _collectId = parseInt(await vbase.collectionId());
                await vbase.batchDepositAndAddNFTToCollection(_tokenAddrs, _tokenIds, _balances, _collectId);

                // Index wrong
                await expect(vbase.prepareMbPackage(_collectId, 1, 0)).to.be.revertedWith("Input index wrong");
                await expect(vbase.prepareMbPackage(_collectId, 0, 4)).to.be.revertedWith("Input index wrong");

                // start index must be collection.nextNFTId
                await expect(vbase.prepareMbPackage(_collectId, 1, 2))
                    .to.be.revertedWith("_startIndex must equal to nextNFTId");

                // crowdfund not success
                // TODO: Is the crowdfund success default?
                await crowd.setTargetTotalAmountOfPool(0, 66);
                await expect(vbase.prepareMbPackage(_collectId, 0, 2))
                    .to.be.revertedWith("Crowdfund must success");
                await crowd.setTargetTotalAmountOfPool(0, 0);

                // Already added
                // TODO: can not reach (_startIndex must equal to nextNFTId means adding a nft twice is impossible)

                // balance must GT 0
                await vbase.modifyCollectionStatus(_collectId, 2);
                await nftdb.modifyNFTAmountZero(1);
                await expect(vbase.prepareMbPackage(_collectId, 0, 1))
                    .to.be.revertedWith("the amount of NFT must GT 0");

                await expect(vbase.prepareMbPackage(_collectId + 2, 0, 0))
                    .to.be.revertedWith("The length of nftIds must GT 0");
            });

            it("create mystery box package", async function() {
                let _tokenAddrs = [token721.address, token1155.address, token721.address, token1155.address];
                let _tokenIds = [8, 9, 10, 11], _balances = [1, 10, 1, 11];
                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await token1155.addBalance(owner.address, _tokenIds[3], _balances[3]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[3]);
                await token721.myMint(owner.address, _tokenIds[2]);
                await utoken.addUserTokenId(owner.address, token721.address, _tokenIds[2]);
                // add all the _tokenIds to collection, the collection has nftIds: [7,8,9,10,11]
                let _collectId = parseInt(await vbase.collectionId());
                await vbase.batchDepositAndAddNFTToCollection(_tokenAddrs, _tokenIds, _balances, _collectId);

                await vbase.modifyCollectionStatus(_collectId, 3);
                await vbase.prepareMbPackage(_collectId, 0, 3);
                await vbase._createMbPackage(_collectId, 1);
                let eptCol = await vbase.collections(_collectId);
                expect(eptCol.nextNFTId).to.be.equal(5);
            });

            it("create mystery box package failed", async function() {
                let _tokenAddrs = [token721.address, token1155.address, token721.address, token1155.address];
                let _tokenIds = [8, 9, 10, 11], _balances = [1, 10, 1, 11];
                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await token1155.addBalance(owner.address, _tokenIds[3], _balances[3]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[3]);
                await token721.myMint(owner.address, _tokenIds[2]);
                await utoken.addUserTokenId(owner.address, token721.address, _tokenIds[2]);
                // add all the _tokenIds to collection, the collection has nftIds: [7,8,9,10,11]
                let _collectId = parseInt(await vbase.collectionId());
                await vbase.batchDepositAndAddNFTToCollection(_tokenAddrs, _tokenIds, _balances, _collectId);

                // not ready
                await expect(vbase._createMbPackage(_collectId, 1))
                    .to.be.revertedWith("Only create when last 2 NFT already put into mysBox");
            });

            it("create mystery box package one step when nftIds length is one", async function() {
                let _collectId = parseInt(await vbase.collectionId());
                // await vbase.modifyCollectionStatus(_collectId, 3);
                await vbase.createMbPackageOneStep(_collectId, 0, 10, 0);
                let eptCol = await vbase.collections(_collectId);
                expect(eptCol.nextNFTId).to.be.equal(1);
            });

            it("create mystery box package one step", async function() {
                let _tokenAddrs = [token721.address, token1155.address, token721.address, token1155.address];
                let _tokenIds = [8, 9, 10, 11], _balances = [1, 10, 1, 11];
                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await token1155.addBalance(owner.address, _tokenIds[3], _balances[3]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[3]);
                await token721.myMint(owner.address, _tokenIds[2]);
                await utoken.addUserTokenId(owner.address, token721.address, _tokenIds[2]);
                // add all the _tokenIds to collection, the collection has nftIds: [7,8,9,10,11]
                let _collectId = parseInt(await vbase.collectionId());
                await vbase.batchDepositAndAddNFTToCollection(_tokenAddrs, _tokenIds, _balances, _collectId);

                // await vbase.modifyCollectionStatus(_collectId, 3);
                await vbase.createMbPackageOneStep(_collectId, 0, 10, 0);
                let eptCol = await vbase.collections(_collectId);
                expect(eptCol.nextNFTId).to.be.equal(5);
            });

            it("createn mystery box package one step failed", async function () {
                await expect(vbase.createMbPackageOneStep(1, 1, 0, 0)).to.be.revertedWith("Input _startIndex need LT _endIndex")
            });

            it("get field array of nfts of collect", async function() {
                let _tokenAddrs = [token721.address, token1155.address, token721.address, token1155.address];
                let _tokenIds = [8, 9, 10, 11], _balances = [1, 10, 1, 11];
                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await token1155.addBalance(owner.address, _tokenIds[3], _balances[3]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[3]);
                await token721.myMint(owner.address, _tokenIds[2]);
                await utoken.addUserTokenId(owner.address, token721.address, _tokenIds[2]);
                // add all the _tokenIds to collection, the collection has nftIds: [7,8,9,10,11]
                let _collectId = parseInt(await vbase.collectionId());
                await vbase.batchDepositAndAddNFTToCollection(_tokenAddrs, _tokenIds, _balances, _collectId);
                // add all the _tokenIds to collection, the collection has nftIds: [7,8,9,10,11]
                let eptRet = await vbase.getFieldArrayOfNFTsOfCollect(_collectId)
                // nftIds
                expect(eptRet[0].length).to.be.equal(5)
                expect(eptRet[0][0]).to.be.equal(1)
                expect(eptRet[0][1]).to.be.equal(2)
                expect(eptRet[0][2]).to.be.equal(3)
                expect(eptRet[0][3]).to.be.equal(4)
                expect(eptRet[0][4]).to.be.equal(5)
                // tokenAddrs
                expect(eptRet[1].length).to.be.equal(5)
                expect(eptRet[1][0]).to.be.equal(token1155.address)
                expect(eptRet[1][1]).to.be.equal(token721.address)
                expect(eptRet[1][2]).to.be.equal(token1155.address)
                expect(eptRet[1][3]).to.be.equal(token721.address)
                expect(eptRet[1][4]).to.be.equal(token1155.address)
                // tokenIds
                expect(eptRet[2].length).to.be.equal(5)
                expect(eptRet[2][0]).to.be.equal(_ids[0])
                expect(eptRet[2][1]).to.be.equal(_tokenIds[0])
                expect(eptRet[2][2]).to.be.equal(_tokenIds[1])
                expect(eptRet[2][3]).to.be.equal(_tokenIds[2])
                expect(eptRet[2][4]).to.be.equal(_tokenIds[3])
                // amounts
                expect(eptRet[3].length).to.be.equal(5)
                expect(eptRet[3][0]).to.be.equal(_amounts[0])
                expect(eptRet[3][1]).to.be.equal(_balances[0])
                expect(eptRet[3][2]).to.be.equal(_balances[1])
                expect(eptRet[3][3]).to.be.equal(_balances[2])
                expect(eptRet[3][4]).to.be.equal(_balances[3])
                // owners
                expect(eptRet[4].length).to.be.equal(5)
                expect(eptRet[4][0]).to.be.equal(owner.address)
                expect(eptRet[4][1]).to.be.equal(owner.address)
                expect(eptRet[4][2]).to.be.equal(owner.address)
                expect(eptRet[4][3]).to.be.equal(owner.address)
                expect(eptRet[4][4]).to.be.equal(owner.address)
                // nftTypes
                expect(eptRet[5].length).to.be.equal(5)
                expect(eptRet[5][0]).to.be.equal(1155)
                expect(eptRet[5][1]).to.be.equal(721)
                expect(eptRet[5][2]).to.be.equal(1155)
                expect(eptRet[5][3]).to.be.equal(721)
                expect(eptRet[5][4]).to.be.equal(1155)
            });

            it("get collection info", async function() {
                let _collectId = parseInt(await vbase.collectionId())
                let eptInfo = await vbase.getCollectInfo(_collectId)
                expect(eptInfo[0]).to.be.equal(_collectionName)
                expect(eptInfo[1]).to.be.equal(_collectionDesc)
                expect(eptInfo[2]).to.be.equal(_collectionUrl)
            });
        });

        describe("create collection and Proposal one step", async function() {
            let _ids = [7, 8], _amounts = [6, 1];
            beforeEach("", async function() {

                // deposit nft before add to collection
                await token1155.addBalance(owner.address, _ids[0], _amounts[0]);
                await token1155.setApprovalForAll(nftdb.address, true);  // approve
                await utoken.addUserTokenId(owner.address, token1155.address, _ids[0]);
                await token721.myMint(owner.address, _ids[1]);
                await token721.setApprovalForAll(nftdb.address, true);  // approve
                await utoken.addUserTokenId(owner.address, token721.address, _ids[1]);

            });

            it("create exclusive mystery box package one step", async function() {
                //1 create exclusive mystery box pool
                await this.hipToken.connect(user).approve(this.mbPoolAdmin.address,_basePayAmount);
                expect(await this.mbPoolAdmin.owner()).to.equal(owner.address);

                await this.mbPoolAdmin.connect(user).payAndCreateMBPool(300,4000,2700,3000,await withDecimals(3),"part2");
                let exPoolId = await box.exPoolIdListOfCreator(user.address,"0")
                console.log("user-exPoolId",exPoolId.toString())

                //2 the exclusive creator set whitelist users which can add external NFT into exclusive pool directly
                await box.connect(user).setIsAllowedUser(exPoolId,[owner.address,alice.address],true)
            

                let _tokenAddrs = [token721.address, token1155.address, token721.address, token1155.address];
                let _tokenIds = [8, 9, 10, 11], _balances = [1, 10, 1, 11];
                await token1155.addBalance(owner.address, _tokenIds[1], _balances[1]);
                await token1155.addBalance(owner.address, _tokenIds[3], _balances[3]);
                await token1155.setApprovalForAll(nftdb.address, true);  // approve
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[1]);
                await utoken.addUserTokenId(owner.address, token1155.address, _tokenIds[3]);
                await token721.myMint(owner.address, _tokenIds[2]);
                await token721.setApprovalForAll(nftdb.address, true);  // approve
                await utoken.addUserTokenId(owner.address, token721.address, _tokenIds[2]);
            
                //3 The whitelist user add external NFT into exclusive pool directly
                let _collectionNameEx = "testExClName", _collectionDescEx = "testExClDesc", _collectionUrlEx = "testExClUrl";
                let mainPoolId ="0";
                await expect(vbase.connect(owner).createMbPackageAndPutIntoExclusivePool(_tokenAddrs, _tokenIds, _balances,_collectionNameEx,_collectionDescEx,_collectionUrlEx,mainPoolId))
                    .to.revertedWith("Need exclusive poolId")
                await vbase.connect(owner).createMbPackageAndPutIntoExclusivePool(_tokenAddrs, _tokenIds, _balances,_collectionNameEx,_collectionDescEx,_collectionUrlEx,exPoolId);

            });
        });

        it("create mystery box package one step failed", async function() {
            await expect(vbase.createMbPackageOneStep(1, 0, 1, 0))
                .to.be.revertedWith("len of nftIds must GT 0")
        });

        it("set manager", async function() {
            let eptBool = await vbase.isManager(owner.address)
            expect(eptBool).to.be.equal(false)

            await vbase.setManager(owner.address, true);
            eptBool = await vbase.isManager(owner.address)
            expect(eptBool).to.be.equal(true)
        });

        it("set manager failed when caller is not owner", async function() {
            await expect(vbase.connect(user)
                .setManager(user.address, true, {from:user.address}))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});
