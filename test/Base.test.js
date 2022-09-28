const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const {BN} = require('@openzeppelin/test-helpers');
const { time } = require("./utilities")
const { ADDRESS_ZERO } = require("./utilities");


let owner, user, alice;

let base, exbase, nft, democracy, box, token20, ip;

async function withDecimals(amount) {
    return new BN(amount).mul(new BN(10).pow(new BN(18))).toString();
}

describe("Base user func", async function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];

        this.Base = await ethers.getContractFactory("BaseMock");
        this.ExternalBase = await ethers.getContractFactory("ExternalNftBase");
        this.NFTToken = await ethers.getContractFactory("NFTFactoryMock");
        this.Democracy = await ethers.getContractFactory("MyDemocracyMock");
        this.mysteryBox = await ethers.getContractFactory("MysteryBoxMock");
        this.ERC20 = await ethers.getContractFactory("Token20Mock");
        this.IdProvider = await ethers.getContractFactory("IdProvider");
        this.Crowdfund = await ethers.getContractFactory("CrowdfundPoolsMock");
        this.NFTDepositBox = await ethers.getContractFactory("NFTDepositBoxMock");
        this.Oracle = await ethers.getContractFactory("OracleV3");
    });

    beforeEach(async function() {
        base = await this.Base.deploy();
        await base.deployed();

        exbase = await this.ExternalBase.deploy();
        await exbase.deployed();

        nft = await this.NFTToken.deploy();
        await nft.deployed();

        democracy = await this.Democracy.deploy();
        await democracy.deployed();

        box = await this.mysteryBox.deploy();
        await box.deployed();

        token20 = await this.ERC20.deploy();
        await token20.deployed();

        ip = await this.IdProvider.deploy();
        await ip.deployed();

        nftdb = await this.NFTDepositBox.deploy();
        await nftdb.deployed();

        crowd = await this.Crowdfund.deploy();
        await crowd.deployed();

        oracle = await this.Oracle.deploy(user.address, user.address, user.address, democracy.address);
        await oracle.deployed();
    });

    it("initialize", async function() {
        await base.initialize(

            nft.address,
            alice.address,
            democracy.address,
            alice.address,
            ip.address,
            exbase.address
        );

        expect(await base.nft()).to.be.equal(nft.address);
        expect(await base.mysteryBox()).to.be.equal(alice.address);
        expect(await base.democracy()).to.be.equal(democracy.address);
        expect(await base.crowdfund()).to.be.equal(alice.address);

        expect(await base.idProvider()).to.be.equal(ip.address);
        expect(await base.externalNftBase()).to.be.equal(exbase.address);
        expect(await base.minFragmentNum()).to.be.equal(4);
        expect(await base.maxTokenIdsNum()).to.be.equal(200);
    });

    describe("user and work management", async function() {

        beforeEach("",async function() {

            await ip.initialize(base.address, exbase.address);
            await base.initialize(
                nft.address,
                box.address,
                democracy.address,
                owner.address,
                ip.address,
                exbase.address
            );
            await ip.setInternalCaller(base.address, true);
            await democracy.initialize(
                token20.address, 66, base.address, user.address, 10000,
                token20.address, exbase.address, crowd.address, oracle.address);
            await box.initialize(owner.address, user.address)
            await box.setInternalCaller(base.address, true)
        });

        it("set crowdfund", async function() {
            await base.setCrowdfund(user.address);
            expect(await base.crowdfund()).to.be.equal(user.address);
        });

        it("set crowdfund failed when caller is not owner", async function() {
            await expect(base.connect(user)
                .setCrowdfund(user.address, {from:user.address}))
                .to.be.revertedWith("Ownable: caller is not the owner");
            await expect(base.setCrowdfund(ADDRESS_ZERO))
                .to.be.revertedWith("Not 0x00")
        });

        it("update user info", async function() {
            let _name = "testName";
            let _desc = "testDesc";
            let _avatarNftId = 1;
            await nft.addBalance(owner.address, _avatarNftId, 100);
            let totalUsersBefore = await base.totalUsers();

            // first time: totalUsers++
            await base.updateUserInfo(_name, _desc, _avatarNftId);
            let eptUser = await base.users(owner.address);
            let totalUsersAfter = await base.totalUsers();
            expect(eptUser.name).to.be.equal(_name);
            expect(eptUser.desc).to.be.equal(_desc);
            expect(eptUser.avatarNftId).to.be.equal(_avatarNftId);
            expect(totalUsersAfter).to.be.equal(parseInt(totalUsersBefore) + 1);
            expect(eptUser.isRegistered).to.be.equal(true);

            // second time: totalUsers has no change
             _desc = "testDescAgain", _avatarNftId = 0;
            await base.updateUserInfo(_name, _desc, _avatarNftId);
            eptUser = await base.users(owner.address);
            expect(eptUser.desc).to.be.equal(_desc);
            let totalUsersAfterAfter = await base.totalUsers();
            expect(totalUsersAfterAfter).to.be.equal(totalUsersAfter);
            expect(eptUser.isRegistered).to.be.equal(true);
        });

        it("update user info failed when caller does not have this NFT", async function() {
            let _name = "testName";
            let _desc = "testDesc";
            let _avatarNftId = 2;
            await expect(base.updateUserInfo(_name, _desc, _avatarNftId))
                .to.be.revertedWith("msgSender has not this NFT");
            let eptUser = await base.users(owner.address);
            expect(eptUser.isRegistered).to.be.equal(false);
        });

        it("modify user status", async function() {
            await base.setManager(owner.address, true);
            let _status = 2;
            await base.modifyUserStatus(owner.address, _status);
            let eptUser = await base.users(owner.address);

            expect(eptUser.status).to.be.equal(_status);
        });

        it("modify user status failed when caller is not Manager", async function() {
            let _status = 3;
            await expect(base
                .connect(user)
                .modifyUserStatus(owner.address, _status, {from:user.address}))
                .to.be.revertedWith("Not manager");
        });

        it("add works", async function() {
            let _collectionName = "testClName";
            let _collectionDesc = "testClDesc";
            let _collectionUrl = "testClUrl";
            let _workNames = ["w1"];
            let _urls = ["u1"];
            let _completeNftNums = [2];
            let _compToFragNftNums = [4];
            let _fragNumPerCompNFTs = [13];

            let collectionIdBefore = await base.collectionId();

            await base.addWorks(
                _collectionName, _collectionDesc, _collectionUrl, _workNames,
                _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
            );
            let collectionIdAfter = await base.collectionId();
            // collectionId++
            expect(collectionIdAfter).to.be.equal(collectionIdBefore + 1);
            let eptCollection = await base.collections(collectionIdAfter);
            expect(eptCollection.name).to.be.equal(_collectionName);
            expect(eptCollection.desc).to.be.equal(_collectionDesc);
            expect(eptCollection.url).to.be.equal(_collectionUrl);
            let eptUserCollection = await base.userCollections(owner.address, 0);
            expect(eptUserCollection).to.be.equal(collectionIdAfter);

            let _len = await base.getCollectLen(collectionIdAfter);
            let eptWorkIds = await base.getWorkIdsOfCollection(collectionIdAfter, 0, _len - 1);
            let workIdsLen = eptWorkIds.length;
            let eptWork = await base.works(eptWorkIds[workIdsLen - 1]);
            expect(eptWork.name).to.be.equal(_workNames[0]);
            expect(eptWork.url).to.be.equal(_urls[0]);
            let uploader = await base.getUploaderOfCollection(collectionIdAfter);
            expect(eptWork.uploader).to.be.equal(uploader);
            expect(eptWork.completeNftNum).to.be.equal(_completeNftNums[0]);
            expect(eptWork.compToFragNftNum).to.be.equal(_compToFragNftNums[0]);
            expect(eptWork.fragmentNumPerCompNFT).to.be.equal(_fragNumPerCompNFTs[0]);

            // sumTokenIdsNum
            expect(await base.totalTokenIdsNumOfCollect(collectionIdAfter)).to.be.equal(_fragNumPerCompNFTs[0] + 1)
        });

        it("add works failed", async function() {
            let _collectionName = "testClName";
            let _collectionDesc = "testClDesc";
            let _collectionUrl = "testClUrl";
            let _workNames = [];
            let _urls = ["u1"];
            let _completeNftNums = [2];
            let _compToFragNftNums = [4];
            let _fragNumPerCompNFTs = [13];
            // length of workNames must GT 0
            await expect(base.addWorks(
                _collectionName, _collectionDesc, _collectionUrl, _workNames,
                _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
            )).to.be.revertedWith("Len must GT 0");

            // length of others params must equal length of workNames
            _workNames = ["w1"], _urls = ["u1", "u2"];
            await expect(base.addWorks(
                _collectionName, _collectionDesc, _collectionUrl, _workNames,
                _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
            )).to.be.revertedWith("Array length must match");

            // fragmentNumPerCompNFT must GT minFragmentNum

            _urls = ["u1"], _fragNumPerCompNFTs = [3];
            await expect(base.addWorks(
                _collectionName, _collectionDesc, _collectionUrl, _workNames,
                _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
            )).to.be.revertedWith("fragmentNumPerCompNFT need GT minFragmentNum");

            // compToFragNftNum must GT 0

            _fragNumPerCompNFTs = [13], _compToFragNftNums = [0];
            await expect(base.addWorks(
                _collectionName, _collectionDesc, _collectionUrl, _workNames,
                _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
            )).to.be.revertedWith("CompToFragNftNum must GT 0");

            _fragNumPerCompNFTs = [200], _compToFragNftNums = [4];
            await expect(base.addWorks(
                _collectionName, _collectionDesc, _collectionUrl, _workNames,
                _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
            )).to.be.revertedWith("Too many works and fragments");
        });

        it("create proposal", async function() {
            let _collectionName = "testClName";
            let _collectionDesc = "testClDesc";
            let _collectionUrl = "testClUrl";
            let _workNames = ["w1"];
            let _urls = ["u1"];
            let _completeNftNums = [2];
            let _compToFragNftNums = [4];
            let _fragNumPerCompNFTs = [13];

            let _crowdfundParams = [1e6,2,3,4,5];
            let collectionIdBefore = await base.collectionId();

            await token20.addBalance(owner.address, await withDecimals(10));
            await token20.approveTo(owner.address, democracy.address, await withDecimals(10));
            // await democracy.initialize(
            //     token20.address, 66, base.address,
            //     user.address, token20.address, token20.address);
            _crowdfundParams[4] = await withDecimals(5);
            await base.createProposal(
                _collectionName, _collectionDesc, _collectionUrl, _workNames,
                _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs, _crowdfundParams
            );

            let collectionIdAfter = await base.collectionId();
            // collectionId++
            expect(collectionIdAfter).to.be.equal(collectionIdBefore + 1);
            let eptCollection = await base.collections(collectionIdAfter);
            expect(eptCollection.name).to.be.equal(_collectionName);
            expect(eptCollection.desc).to.be.equal(_collectionDesc);
            expect(eptCollection.url).to.be.equal(_collectionUrl);
            let eptUserCollection = await base.userCollections(owner.address, 0);
            expect(eptUserCollection).to.be.equal(collectionIdAfter);

            let _len = await base.getCollectLen(collectionIdAfter);
            let eptWorkIds = await base.getWorkIdsOfCollection(collectionIdAfter, 0, _len - 1);
            let workIdsLen = eptWorkIds.length;
            let eptWork = await base.works(eptWorkIds[workIdsLen - 1]);
            expect(eptWork.name).to.be.equal(_workNames[0]);
            expect(eptWork.url).to.be.equal(_urls[0]);
            let uploader = await base.getUploaderOfCollection(collectionIdAfter);
            expect(eptWork.uploader).to.be.equal(uploader);
            expect(eptWork.completeNftNum).to.be.equal(_completeNftNums[0]);
            expect(eptWork.compToFragNftNum).to.be.equal(_compToFragNftNums[0]);
            expect(eptWork.fragmentNumPerCompNFT).to.be.equal(_fragNumPerCompNFTs[0]);
        });

        it("create proposal failed", async function() {
            let _collectionName = "testClName";
            let _collectionDesc = "testClDesc";
            let _collectionUrl = "testClUrl";
            let _workNames = ["w1"];
            let _urls = ["u1"];
            let _completeNftNums = [2];
            let _compToFragNftNums = [4];
            let _fragNumPerCompNFTs = [13];
            let _crowdfundParams = [1,2,3];

            await token20.addBalance(owner.address, await withDecimals(10));
            await token20.approveTo(owner.address, democracy.address, await withDecimals(10));
            // await democracy.initialize(
            //     token20.address, 66, base.address,
            //     user.address, token20.address, token20.address);
            await expect(base.createProposal(
                _collectionName, _collectionDesc, _collectionUrl, _workNames,
                _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs, _crowdfundParams
            )).to.be.revertedWith("The length of _crowdfundParams need be 5");
        });

        describe("modify works or collection", async function() {
            let _collectionName = "testClName";
            let _collectionDesc = "testClDesc";
            let _collectionUrl = "testClUrl";
            let _workNames = ["w1"];
            let _urls = ["u1"];
            let _completeNftNums = [2];
            let _compToFragNftNums = [4];
            let _fragNumPerCompNFTs = [13];
            beforeEach("", async function() {
                await base.addWorks(
                    _collectionName, _collectionDesc, _collectionUrl, _workNames,
                    _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );
            });

            it("add works into collection", async function() {
                let _collectionId = 1;
                _workNames = ["w2"];
                _urls = ["u2"];
                _completeNftNums = [3];
                _compToFragNftNums = [2];
                _fragNumPerCompNFTs = [13];
                await base.addWorksIntoCollection(
                    _collectionId, _workNames, _urls,
                    _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );

                let _len = await base.getCollectLen(_collectionId);
                let eptWorkIds = await base.getWorkIdsOfCollection(_collectionId, 0, _len - 1);
                let workIdsLen = eptWorkIds.length;

                let eptWork = await base.works(eptWorkIds[workIdsLen - 1]);
                expect(eptWork.name).to.be.equal(_workNames[0]);
                expect(eptWork.url).to.be.equal(_urls[0]);
                let uploader = await base.getUploaderOfCollection(_collectionId);
                expect(eptWork.uploader).to.be.equal(uploader);
                expect(eptWork.completeNftNum).to.be.equal(_completeNftNums[0]);
                expect(eptWork.compToFragNftNum).to.be.equal(_compToFragNftNums[0]);
                expect(eptWork.fragmentNumPerCompNFT).to.be.equal(_fragNumPerCompNFTs[0]);

                // sumTokenIdsNum
                expect(await base.totalTokenIdsNumOfCollect(_collectionId)).to.be.equal((_fragNumPerCompNFTs[0] + 1)*2)

            });

            it.only("add works into collection", async function() {
                let _collectionId = 1;
                _workNames = ["w2","w2","u2"];
                _urls = ["u2","u2","u2"];
                _completeNftNums = [3,3,10];
                _compToFragNftNums = [2,2,2];
                _fragNumPerCompNFTs = [13,13,10];
                await base.addWorksIntoCollection(
                    _collectionId, _workNames, _urls,
                    _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );

                // expect(await base.totalTokenIdsNumOfCollect(_collectionId)).to.be.equal((_fragNumPerCompNFTs[0] + 1)*2)

                let getTotalNftNumOfCollect = await base.getTotalNftNumOfCollect(_collectionId);
                expect(getTotalNftNumOfCollect).to.be.equal(
                    BigNumber.from(4).mul(13).add(2)
                    .add(BigNumber.from(2).mul(13).add(3))
                    .add(BigNumber.from(2).mul(13).add(3))
                    .add(BigNumber.from(2).mul(10).add(10))
                )
            });

            it("add works into collection failed", async function() {
                let _collectionId = 1;
                _workNames = ["w2"];
                _urls = ["u2"];
                _completeNftNums = [3];
                _compToFragNftNums = [2];
                _fragNumPerCompNFTs = [13];

                // uploader is not caller.
                await expect(base.connect(user)
                    .addWorksIntoCollection(
                        _collectionId, _workNames, _urls,
                        _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs,

                        {from:user.address})).to.be.revertedWith("uploader must be same");

                _workNames = [];
                await expect(base.addWorksIntoCollection(
                        _collectionId, _workNames, _urls,
                        _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                    )).to.be.revertedWith("Len must GT 0");

                _workNames = ["w2", "w3"];
                await expect(base.addWorksIntoCollection(
                        _collectionId, _workNames, _urls,
                        _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                    )).to.be.revertedWith("Array length must match");

                _workNames = ["w2"], _compToFragNftNums = [0];
                await expect(base.addWorksIntoCollection(
                        _collectionId, _workNames, _urls,
                        _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                    )).to.be.revertedWith("CompToFragNftNum must GT 0");

                _compToFragNftNums = [2], _fragNumPerCompNFTs = [2];
                await expect(base.addWorksIntoCollection(

                        _collectionId, _workNames, _urls,
                        _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                    )).to.be.revertedWith("fragmentNumPerCompNFT need GT minFragmentNum");

                _compToFragNftNums = [2], _fragNumPerCompNFTs = [200];
                await expect(base.addWorksIntoCollection(
                        _collectionId, _workNames, _urls,
                        _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                    )).to.be.revertedWith("Too many works and fragments");

                // _collectionId > collectionId, collectionId is not existed
                await base.setCollectionId(_collectionId - 1);  // set collectionId manually for test
                await expect(base.addWorksIntoCollection(
                        _collectionId, _workNames, _urls,
                        _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                    )).to.be.revertedWith("collectionId is not existed");

                // Cannot modify cause proposal status is not ready.
                await base.setCollectionId(_collectionId);
                await democracy.modifyProposalStatus(_collectionId, 1); // set proposal's status manually for test
                await democracy.setMaxProposalId(_collectionId + 1);  // set max proposal id manually for test
                await expect(base.addWorksIntoCollection(
                        _collectionId, _workNames, _urls,
                        _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                    )).to.be.revertedWith("Cannot modify");

                // completeNftId is not 0, the restriction interface must be invoked before NFT is created.
                await democracy.setMaxProposalId(_collectionId - 1);  // set max proposal id manually for test
                _fragNumPerCompNFTs = [13];
                await base.fulfillWorkNftInfo(1, 3);
                await expect(base.addWorksIntoCollection(
                        _collectionId, _workNames, _urls,
                        _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                    )).to.be.revertedWith("Only add before collection create NFT");
                // TODO: not test("collectionId is not existed" and "Cannot modify")
            });

            it("delete work of collection", async function() {
                let _collectionId = 1;
                _workNames = ["w2"];
                _urls = ["u2"];
                _completeNftNums = [3];
                _compToFragNftNums = [2];
                _fragNumPerCompNFTs = [13];
                await base.addWorksIntoCollection(
                    _collectionId, _workNames, _urls,
                    _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );

                // workIds of collection: [1,2]
                let collection = await base.collections(_collectionId);

                let workIdsLenBefore = await base.getCollectLen(_collectionId);
                let workIds = await base.getWorkIdsOfCollection(_collectionId, 0, parseInt(workIdsLenBefore) - 1);
                expect(workIdsLenBefore).to.be.equal(2);
                expect(workIds[0]).to.be.equal(1);
                expect(workIds[1]).to.be.equal(2);
                // sumTokenIdsNum
                expect(await base.totalTokenIdsNumOfCollect(_collectionId)).to.be.equal((_fragNumPerCompNFTs[0] + 1)*2)

                // delete workId == 2
                let _workIds = [1, 2];
                await base.deleteWorkOfCollect(_workIds[1], _collectionId);
                // workIds of collection: [1] after delete 2
                collection = await base.collections(_collectionId);

                let workIdsLenAfter = await base.getCollectLen(_collectionId);
                workIds = await base.getWorkIdsOfCollection(_collectionId, 0, parseInt(workIdsLenAfter) - 1);
                expect(workIdsLenAfter).to.be.equal(1);
                expect(workIds[0]).to.be.equal(1);
                // sumTokenIdsNum
                expect(await base.totalTokenIdsNumOfCollect(_collectionId)).to.be.equal(_fragNumPerCompNFTs[0] + 1)

                // delete workId == 1
                await base.deleteWorkOfCollect(_workIds[0], _collectionId);

                workIdsLenAfter = await base.getCollectLen(_collectionId);
                expect(workIdsLenAfter).to.be.equal(0);
                // sumTokenIdsNum
                expect(await base.totalTokenIdsNumOfCollect(_collectionId)).to.be.equal(0)
            });

            it("delete work of collection failed", async function() {
                let _workId = 1, _collectionId = 1;
                // caller must be crowdfund contract address
                await expect(base.connect(user)

                    .deleteWorkOfCollect(_workId, 3))
                    .to.be.revertedWith("msg.sender is not uploader");

                // cannot modify.
                let _collectionName = "testClName";
                let _collectionDesc = "testClDesc";
                let _collectionUrl = "testClUrl";
                let _workNames = ["w1"];
                let _urls = ["u1"];
                let _completeNftNums = [2];
                let _compToFragNftNums = [4];
                let _fragNumPerCompNFTs = [13];

                let _crowdfundParams = [1e6,2,3,4,5];
                let collectionIdBefore = await base.collectionId();

                await token20.addBalance(owner.address, await withDecimals(10));
                await token20.approveTo(owner.address, democracy.address, await withDecimals(10));
                // await democracy.initialize(
                //     token20.address, 66, base.address,
                //     user.address, token20.address, token20.address);
                _crowdfundParams[4] = await withDecimals(5);
                await base.createProposal(
                    _collectionName, _collectionDesc, _collectionUrl, _workNames,
                    _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs, _crowdfundParams
                );

                // create proposal: call addWorks to increase collectionId, so it is `2` that
                // has changed the proposal's status.

                // need to add 2(1+2=3), IdProvider only provide odd number for virtual base collectId
                await expect(base
                    .deleteWorkOfCollect(_workId, 3))
                    .to.be.revertedWith("Cannot modify");

                // completeNftId is not 0, the restriction interface must be invoked before NFT is created.
                await base.fulfillWorkNftInfo(1, 2);
                await expect(base
                    .deleteWorkOfCollect(_workId, _collectionId))
                    .to.be.revertedWith("Only call before create NFT");
            });

            it("update works", async function() {
                let _workIds = [1];
                _workNames = ["w2"];
                _urls = ["u2"];
                _completeNftNums = [3];
                _compToFragNftNums = [2];
                _fragNumPerCompNFTs = [13];
                await base.updateWorks(
                    _workIds, _workNames, _urls,
                    _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );

                let eptWork = await base.works(_workIds[0]);
                expect(eptWork.name).to.be.equal(_workNames[0]);
                expect(eptWork.url).to.be.equal(_urls[0]);
                expect(eptWork.completeNftNum).to.be.equal(_completeNftNums[0]);
                expect(eptWork.compToFragNftNum).to.be.equal(_compToFragNftNums[0]);
                expect(eptWork.fragmentNumPerCompNFT).to.be.equal(_fragNumPerCompNFTs[0]);
            });

            it("update works failed", async function() {
                let _workIds = [1];
                _workNames = [];
                _urls = ["u2"];
                _completeNftNums = [3];
                _compToFragNftNums = [2];
                _fragNumPerCompNFTs = [13];
                // length of _workNames must GT 0
                await expect(base.updateWorks(
                    _workIds, _workNames, _urls, _completeNftNums,
                    _compToFragNftNums, _fragNumPerCompNFTs)
                ).to.be.revertedWith("Len must GT 0");

                // length of others params must equal length of workNames
                _workNames = ["w2"], _urls = ["u1", "u2"];
                await expect(base.updateWorks(
                    _workIds, _workNames, _urls, _completeNftNums,
                    _compToFragNftNums, _fragNumPerCompNFTs)
                ).to.be.revertedWith("Array length must match");

                // caller must be crowdfund contract address
                _urls = ["u2"]
                await expect(base.connect(user).updateWorks(
                    _workIds, _workNames, _urls, _completeNftNums,
                    _compToFragNftNums, _fragNumPerCompNFTs, {from:user.address})
                ).to.be.revertedWith("msg.sender is not uploader");

                // completeNftId is not 0, the restriction interface must be invoked before NFT is created.
                await base.fulfillWorkNftInfo(1, 3);
                await expect(base.updateWorks(
                    _workIds, _workNames, _urls, _completeNftNums,
                    _compToFragNftNums, _fragNumPerCompNFTs)
                ).to.be.revertedWith("Only call before create NFT");
            });

            it("fulfill work NFT info", async function() {
                let _workId = 1, _completeNftId = 3;
                await base.fulfillWorkNftInfo(_workId, _completeNftId);

                let eptWork = await base.works(_workId);
                expect(eptWork.completeNftId).to.be.equal(_completeNftId);
            });

            it("fulfill work NFT info failed", async function() {
                let _workId = 1, _completeNftId = 3;
                // caller must be crowdfund contract address
                await expect(base.connect(user).fulfillWorkNftInfo(
                    _workId, _completeNftId, {from:user.address})
                ).to.be.revertedWith("Not crowdfund contract");

                // Alread fulfill NFT info.
                await base.fulfillWorkNftInfo(_workId, _completeNftId);
                await expect(base.fulfillWorkNftInfo(_workId, _completeNftId))
                    .to.be.revertedWith("Already fulfill NFT info");
            });

            it("prepare mystery box package", async function() {
                // TODO: test limit(100 fragments need about 5,500,000 gas)
                let _workId = 1, _completeNftId = 3;
                // fulfill work completeNftId
                await base.fulfillWorkNftInfo(_workId, _completeNftId);

                let eptWork = await base.works(_workId);
                let _len = eptWork.fragmentNumPerCompNFT;
                // console.log("len", _len);
                let startIndex = 0, endIndex = _len - 5;
                await base.prepareMbPackage(_workId, startIndex, endIndex);
                eptWork = await base.works(_workId);
                expect(eptWork.status).to.be.equal(endIndex + 1);

                startIndex = _len - 4, endIndex = _len - 2;
                await base.prepareMbPackage(_workId, startIndex, endIndex);
                eptWork = await base.works(_workId);
                expect(eptWork.status).to.be.equal(endIndex + 1);
            });

            it("prepare mystery box package failed", async function() {
                let _workId = 1, _completeNftId = 3;
                let eptWork = await base.works(_workId);
                let _len = eptWork.fragmentNumPerCompNFT;
                let startIndex = 0, endIndex = _len - 5;
                // _canPrepare is false
                // console.log("endIndex:", endIndex);
                await expect(base.prepareMbPackage(_workId, startIndex, endIndex))
                    .to.be.revertedWith("Cannot prepare");
                // can not user last fragment Id
                await base.fulfillWorkNftInfo(_workId, _completeNftId);

                /* // already tested
                endIndex = _len - 2;
                // console.log("endIndex:", endIndex);
                await expect(base.prepareMbPackage(_workId, startIndex, endIndex))
                    .to.be.revertedWith("_endIndex need LT the max value of type uint32");
                */

                // already added
                endIndex = _len - 5;
                await base.prepareMbPackage(_workId, startIndex, endIndex);
                startIndex = _len - 5, endIndex = _len - 2;
                await expect(base.prepareMbPackage(_workId, startIndex, endIndex))
                    .to.be.revertedWith("Already added");
            });

            it("create mystery box Package", async function() {
                let _workId = 1, _completeNftId = 3;
                let eptWork = await base.works(_workId);
                let _len = eptWork.fragmentNumPerCompNFT;
                expect(eptWork.status).to.be.equal(0);
                // fulfill work completeNftId
                await base.fulfillWorkNftInfo(_workId, _completeNftId);
                // prepare all fragment except the last one
                await base.prepareMbPackage(_workId, 0, _len - 2);
                // add last one fragment and create box

                await base.createMbPackage(_workId, 1);
                // status has changed.
                eptWork = await base.works(_workId);
                expect(eptWork.status).to.be.equal(_len);
            });

            it("create mystery box package failed", async function() {
                let _workId = 1, _completeNftId = 3;

                await expect(base.createMbPackage(_workId, 0)).to.be.revertedWith("Cannot create")
                await base.fulfillWorkNftInfo(_workId, _completeNftId);
                await expect(base.createMbPackage(_workId, 0))
                    .to.be.revertedWith("Cannot create before put all NFTs into box");
            });

            it("create mystery box package one step with multi `prepare`", async function() {
                let _workId = 1, _completeNftId = 3;
                let eptWork = await base.works(_workId);
                let _len = eptWork.fragmentNumPerCompNFT;
                expect(eptWork.status).to.be.equal(0);
                // fulfill work completeNftId
                await base.fulfillWorkNftInfo(_workId, _completeNftId);

                // status has changed.

                await base.createMbPackageOneStep(_workId, 0, _len - 6, 1);
                eptWork = await base.works(_workId);
                expect(eptWork.status).to.be.equal(_len - 5);

                await base.createMbPackageOneStep(_workId, _len - 5, _len - 3, 1);
                eptWork = await base.works(_workId);
                expect(eptWork.status).to.be.equal(_len - 2);

                await base.createMbPackageOneStep(_workId, _len - 2, _len - 2, 1);
                eptWork = await base.works(_workId);
                expect(eptWork.status).to.be.equal(_len);
            });

            it("create mystery box package one step with one `prepare`", async function() {
                let _workId = 1, _completeNftId = 3;
                let eptWork = await base.works(_workId);
                let _len = eptWork.fragmentNumPerCompNFT;
                expect(eptWork.status).to.be.equal(0);
                // fulfill work completeNftId
                await base.fulfillWorkNftInfo(_workId, _completeNftId);

                // status has changed.

                await base.createMbPackageOneStep(_workId, 0, _len - 1, 1);
                eptWork = await base.works(_workId);
                expect(eptWork.status).to.be.equal(_len);
            });

            it("get valid length of Collection's workIds", async function() {
                let _collectionId = 1, _workId = 1;
                _workNames = ["w2"];
                _urls = ["u2"];
                _completeNftNums = [3];
                _compToFragNftNums = [2];
                _fragNumPerCompNFTs = [13];
                await base.addWorksIntoCollection(
                    _collectionId, _workNames, _urls,
                    _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );
                // [1,2]
                let workIdsLenBefore = await base.getCollectLen(_collectionId);
                expect(workIdsLenBefore).to.be.equal(2);

                // check again after delete work of collection: [2]
                await base.deleteWorkOfCollect(_workId, _collectionId);
                let workIdsLenAfter = await base.getCollectLen(_collectionId);
                expect(workIdsLenAfter).to.be.equal(1);
            });

            it("get workIds of Collection", async function() {
                let _collectionId = 1, _workId = 1;
                _workNames = ["w2"];
                _urls = ["u2"];
                _completeNftNums = [3];
                _compToFragNftNums = [2];
                _fragNumPerCompNFTs = [13];
                await base.addWorksIntoCollection(
                    _collectionId, _workNames, _urls,
                    _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );
                // after add work, the workIds is [1, 2]
                let _len1 = await base.getCollectLen(_collectionId);
                let eptWorkIds = await base.getWorkIdsOfCollection(_collectionId, 0, _len1 - 1);
                expect(eptWorkIds.length).to.be.equal(_len1);
                expect(eptWorkIds[0]).to.be.equal(1);
                expect(eptWorkIds[1]).to.be.equal(2);

                // after delete work(workId = 1), the workIds is [2]
                await base.deleteWorkOfCollect(_workId, _collectionId);
                let _len2 = await base.getCollectLen(_collectionId);
                eptWorkIds = await base.getWorkIdsOfCollection(_collectionId, 0, _len2 - 1);
                expect(eptWorkIds.length).to.be.equal(_len2);
                expect(eptWorkIds[0]).to.be.equal(2);
            });

            it("get all work ids of collection", async function() {
                let _collectionId = 1, _workId = 1;
                _workNames = ["w2"];
                _urls = ["u2"];
                _completeNftNums = [3];
                _compToFragNftNums = [2];
                _fragNumPerCompNFTs = [13];
                await base.addWorksIntoCollection(
                    _collectionId, _workNames, _urls,
                    _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );
                // after add work, the workIds is [1, 2]
                let _len1 = await base.getCollectLen(_collectionId);
                let eptWorkIds = await base.getAllWorkIdsOfCollection(_collectionId);
                expect(eptWorkIds.length).to.be.equal(_len1);
                expect(eptWorkIds[0]).to.be.equal(1);
                expect(eptWorkIds[1]).to.be.equal(2);

                // after delete work(workId = 1), the workIds is [2]
                await base.deleteWorkOfCollect(_workId, _collectionId);
                let _len2 = await base.getCollectLen(_collectionId);
                eptWorkIds = await base.getAllWorkIdsOfCollection(_collectionId);
                expect(eptWorkIds.length).to.be.equal(_len2);
                expect(eptWorkIds[0]).to.be.equal(2);
            });

            it("get work info", async function() {
                let _workId = 1;
                let work = await base.works(_workId);
                let ret = await base.getWorkInfo(_workId);
                expect(ret[0]).to.be.equal(work.url);
                expect(ret[1].length).to.be.equal(3);
                expect(ret[1][0]).to.be.equal(work.completeNftNum);
                expect(ret[1][1]).to.be.equal(work.compToFragNftNum);
                expect(ret[1][2]).to.be.equal(work.fragmentNumPerCompNFT);
            });

            it("get fragment nft info of work", async function() {
                let _workId = 1, _completeNftId = 3;
                // add nft info
                let inputId = BigNumber.from(2).pow(128).mul(_completeNftId);
                await base.fulfillWorkNftInfo(_workId, inputId);
                let work = await base.works(_workId);
                let startIndex = 0, endIndex = _fragNumPerCompNFTs[0] - 1;
                ret = await base.getFragNftInfosOfWork(_workId, startIndex, endIndex);
                expect(ret[0]).to.be.equal(true);
                expect(ret[1]).to.be.equal(work.compToFragNftNum);
                expect(ret[2].length).to.be.equal(endIndex - startIndex + 1);
                let eptId;
                for (let i = startIndex; i <= endIndex ; i++) {
                    eptId = BigNumber.from(work.completeNftId).add(i + 1);
                    expect(ret[2][i-startIndex]).to.be.equal(eptId);
                }
            });

            it("get fragment nft info of work failed", async function() {
                let _workId = 1, _completeNftId = 3;
                let work = await base.works(_workId);
                // add nft info
                await base.fulfillWorkNftInfo(_workId, _completeNftId);
                // max index is _len - 1, input _len will get ERROR
                let _len = _fragNumPerCompNFTs[0];
                await expect(base.getFragNftInfosOfWork(_workId, 0, _len))
                    .to.be.revertedWith("Index wrong")
            });

            // it("get complete nft info of work", async function() {
            //     let _workId = 1;
            //     let work = await base.works(_workId);
            //     let ret = await base.getCompNftInfoOfWork(_workId);
            //     expect(ret[0]).to.be.equal(work.completeNftId == true);
            //     expect(ret[1]).to.be.equal(work.completeNftId);
            //     expect(ret[2]).to.be.equal(work.completeNftNum);
            // });

            it("check if work is in collection", async function() {
                let _collectionId = 1, _workId = 1;
                let ret = await base.isWorkOfCollection(_workId, _collectionId);
                expect(ret).to.be.equal(true);
                _workId = 2;
                ret = await base.isWorkOfCollection(_workId, _collectionId);
                expect(ret).to.be.equal(false);
            });

            it("get user collection length", async function() {
                let _len1 = await base.getUserCollectLen(owner.address);
                let _len2 = await base.getUserCollectLen(alice.address);
                expect(_len1).to.be.equal(1);
                expect(_len2).to.be.equal(0);
            });

            // it("get poolId with workId", async function() {
            //     let _workId = 1;
            //     let eptPoolId = await base.getPoolIdFromWorkId(_workId);  // 0
            //     expect(eptPoolId).to.be.equal(0);

            //     let _completeNftId = 3;
            //     await base.fulfillWorkNftInfo(_workId, _completeNftId);
            //     eptPoolId = await base.getPoolIdFromWorkId(_workId);  // have changed to _crowdfundPoolId
            //     expect(eptPoolId).to.be.equal(_crowdfundPoolId);
            // });

            it("get works info of collection", async function() {
                let _collectionId = 1;
                let uploader = await base.getUploaderOfCollection(_collectionId);
                let realLen = await base.getCollectLen(_collectionId);
                let eptWorks = await base.getWorksOfCollect(_collectionId);
                expect(eptWorks.length).to.be.equal(realLen);
                for(i = 0; i < realLen; i++) {
                    expect(eptWorks[i].name).to.be.equal(_workNames[i]);
                    expect(eptWorks[i].url).to.be.equal(_urls[i]);
                    expect(eptWorks[i].uploader).to.be.equal(uploader);
                    expect(eptWorks[i].completeNftNum).to.be.equal(_completeNftNums[i]);
                    expect(eptWorks[i].compToFragNftNum).to.be.equal(_compToFragNftNums[i]);
                    expect(eptWorks[i].fragmentNumPerCompNFT).to.be.equal(_fragNumPerCompNFTs[i]);
                }
            });

            it("get works info failed", async function() {
                let _collectionId = 2;  // noe exist
                await expect(base.getWorksOfCollect(_collectionId))
                    .to.be.revertedWith("len must GT 0");
            });

            it("get works' field array info of collection", async function() {
                let _collectionId = 1;
                let uploader = await base.getUploaderOfCollection(_collectionId);
                let realLen = await base.getCollectLen(_collectionId);
                let eptWorks = await base.getFieldArrayOfWorksOfCollect(_collectionId);
                for(i = 0; i < realLen; i++) {
                    expect(eptWorks[0][i]).to.be.equal(1);
                    expect(eptWorks[1][i]).to.be.equal(_workNames[i]);
                    expect(eptWorks[2][i]).to.be.equal(_urls[i]);
                    expect(eptWorks[3][i]).to.be.equal(uploader);
                    expect(eptWorks[4][i]).to.be.equal(_completeNftNums[i]);
                    expect(eptWorks[5][i]).to.be.equal(_compToFragNftNums[i]);
                    expect(eptWorks[6][i]).to.be.equal(_fragNumPerCompNFTs[i]);
                    expect(eptWorks[7][i]).to.be.equal(0);
                }
            });

            it("get collection info", async function() {
                let _collectionId = 1;
                let eptInfos = await base.getCollectInfo(_collectionId)
                expect(eptInfos[0]).to.be.equal(_collectionName)
                expect(eptInfos[1]).to.be.equal(_collectionDesc)
                expect(eptInfos[2]).to.be.equal(_collectionUrl)

                // external nft
                await exbase.initialize(
                    box.address,
                    democracy.address,
                    ip.address,
                    nftdb.address,
                    crowd.address
                )

                await ip.setInternalCaller(exbase.address, true);
                await exbase.createCollection(_collectionName, _collectionDesc, _collectionUrl)
                _collectionId = parseInt(await exbase.collectionId())
                expect(_collectionId).to.be.equal(2)
                eptInfos = await base.getCollectInfo(_collectionId)
                expect(eptInfos[0]).to.be.equal(_collectionName)
                expect(eptInfos[1]).to.be.equal(_collectionDesc)
                expect(eptInfos[2]).to.be.equal(_collectionUrl)
            });
        });

        it("set manager", async function() {
            let eptBool = await base.isManager(owner.address)
            expect(eptBool).to.be.equal(false)

            await base.setManager(owner.address, true);
            eptBool = await base.isManager(owner.address)
            expect(eptBool).to.be.equal(true)
        });

        it("set manager failed when caller is not owner", async function() {
            await expect(base.connect(user)
                .setManager(user.address, true, {from:user.address}))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("set maxTokenIdsNum", async function() {
            // pre state
            expect(await base.maxTokenIdsNum()).to.be.equal(200);
            await base.setManager(owner.address, true);
            await base.setMaxTokenIdsNum(100);
            expect(await base.maxTokenIdsNum()).to.be.equal(100);
        });

        it("set maxTokenIdsNum failed when caller is not Manager", async function() {
            await expect(base.setMaxTokenIdsNum(100))
                .to.be.revertedWith("Not manager");
        });

        it("set min fragment numbers", async function() {
            let _newNum = 16;
            await base.setManager(owner.address, true);
            await base.setMinFragmentNum(_newNum);
            let eptNum = await base.minFragmentNum();
            expect(eptNum).to.be.equal(_newNum);
        });

        it("set min fragment nubmers failed when caller is not manager", async function() {
            await expect(base.setMinFragmentNum(16)).to.be.revertedWith("Not manager")
        });
    });
});
