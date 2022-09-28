const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { time } = require("./utilities")


let owner, user, alice;
<<<<<<< HEAD
let base, nft, democracy, box, token20;
=======
let base, nft, democracy, box, token20, ip;
>>>>>>> external_NFT_compatible_dev

describe("Base user func", async function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];

        this.Base = await ethers.getContractFactory("BaseMock");
        this.ExternalBase = await ethers.getContractFactory("ExternalNftBaseMock");
        this.NFTToken = await ethers.getContractFactory("NFTFactoryMock");
        this.Democracy = await ethers.getContractFactory("MyDemocracyMock")
        this.mysteryBox = await ethers.getContractFactory("MysteryBoxMock")
        this.IdProvider = await ethers.getContractFactory("IdProvider");
    });

    beforeEach(async function() {
        base = await this.Base.deploy();
        await base.deployed();
<<<<<<< HEAD

        nft = await this.NFTToken.deploy();
        await nft.deployed();

        democracy = await this.Democracy.deploy();
        await democracy.deployed();

        box = await this.mysteryBox.deploy();
        await box.deployed();
=======

        exbase = await this.ExternalBase.deploy();
        await exbase.deployed();

        nft = await this.NFTToken.deploy();
        await nft.deployed();

        democracy = await this.Democracy.deploy();
        await democracy.deployed();

        box = await this.mysteryBox.deploy();
        await box.deployed();

        ip = await this.IdProvider.deploy();
        await ip.deployed();
>>>>>>> external_NFT_compatible_dev
    });

    it("initialize", async function() {
        await base.initialize(
<<<<<<< HEAD
            owner.address, 
            nft.address, 
            alice.address,
            democracy.address,
            alice.address
        );

        expect(await base.hipToken()).to.be.equal(owner.address);
=======
            nft.address,
            alice.address,
            democracy.address,
            alice.address,
            ip.address,
            exbase.address
        );

>>>>>>> external_NFT_compatible_dev
        expect(await base.nft()).to.be.equal(nft.address);
        expect(await base.mysteryBox()).to.be.equal(alice.address);
        expect(await base.democracy()).to.be.equal(democracy.address);
        expect(await base.crowdfund()).to.be.equal(alice.address);
<<<<<<< HEAD
        expect(await base.minFragmentNum()).to.be.equal(10);
=======
        expect(await base.idProvider()).to.be.equal(ip.address);
        expect(await base.externalNftBase()).to.be.equal(exbase.address);
        expect(await base.minFragmentNum()).to.be.equal(4);
        expect(await base.maxTokenIdsNum()).to.be.equal(200);
>>>>>>> external_NFT_compatible_dev
    });

    describe("user and work management", async function() {

        beforeEach("",async function() {
<<<<<<< HEAD
            await base.initialize(
                owner.address, 
                nft.address, 
                box.address, 
                democracy.address, 
                owner.address, 
=======
            await ip.initialize(base.address, owner.address);
            await base.initialize(
                nft.address,
                box.address,
                democracy.address,
                owner.address,
                ip.address,
                exbase.address
>>>>>>> external_NFT_compatible_dev
            );
            await ip.setInternalCaller(base.address, true);
        });

        it("add works", async function() {
            let _collectionName = "testClName";
            let _collectionDesc = "testClDesc";
            let _collectionUrl = "testClUrl";
            let _workNames = ["w1"];
            let _urls = ["u1"];
            let _completeNftNums = [2];
            let _compToFragNftNums = [4];
            let _fragNumPerCompNFTs = [4];

            /*
            test how many works can collection hold
            works numbers: 1 => gas: 404943
            works numbers: 10 => gas: 936125
            works numbers: 40 => gas: 2706765
            */
            let workNum = 39;
            for (i=0; i<workNum; i++) {
                _workNames.push("w1");
                _urls.push("u1");
                _completeNftNums.push(2);
                _compToFragNftNums.push(4);
                _fragNumPerCompNFTs.push(4);
            }

<<<<<<< HEAD
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
=======
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
>>>>>>> external_NFT_compatible_dev
            expect(eptWork.name).to.be.equal(_workNames[0]);
            expect(eptWork.url).to.be.equal(_urls[0]);
            let uploader = await base.getUploaderOfCollection(collectionIdAfter);
            expect(eptWork.uploader).to.be.equal(uploader);
            expect(eptWork.completeNftNum).to.be.equal(_completeNftNums[0]);
            expect(eptWork.compToFragNftNum).to.be.equal(_compToFragNftNums[0]);
            expect(eptWork.fragmentNumPerCompNFT).to.be.equal(_fragNumPerCompNFTs[0]);

            // sumTokenIdsNum
            expect(await base.totalTokenIdsNumOfCollect(collectionIdAfter)).to.be.equal((workNum + 1)*(_fragNumPerCompNFTs[0] + 1))
        });

        describe("modify works or collection", async function() {
            let _collectionName = "testClName";
            let _collectionDesc = "testClDesc";
            let _collectionUrl = "testClUrl";
            let _workNames = ["w1"];
            let _urls = ["u1"];
            let _completeNftNums = [2];
            let _compToFragNftNums = [4];
            let _fragNumPerCompNFTs = [4];
            beforeEach("", async function() {
                await base.addWorks(
                    _collectionName, _collectionDesc, _collectionUrl, _workNames,
                    _urls, _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );
            });

            it("add works into collection", async function() {
                /*
                test how many works can collection hold
                works numbers: 1 => gas: 195018
                works numbers: 10 => gas: 1135327
                works numbers: 40 => gas: 4676804
                */
                let workNum = 38;
                let _collectionId = 1;
                for (i=0; i<workNum; i++) {
                    _workNames.push("w1");
                    _urls.push("u1");
                    _completeNftNums.push(2);
                    _compToFragNftNums.push(4);
                    _fragNumPerCompNFTs.push(4);
                }
                await base.addWorksIntoCollection(
                    _collectionId, _workNames, _urls,
                    _completeNftNums, _compToFragNftNums, _fragNumPerCompNFTs
                );

                let _len = await base.getCollectLen(_collectionId);
                let eptWorkIds = await base.getWorkIdsOfCollection(_collectionId, 0, _len - 1);
                let workIdsLen = eptWorkIds.length;
<<<<<<< HEAD
                let eptWork = await base.works(eptWorkIds[workIdsLen - 1]); 
=======
                let eptWork = await base.works(eptWorkIds[workIdsLen - 1]);
>>>>>>> external_NFT_compatible_dev
                expect(eptWork.name).to.be.equal(_workNames[0]);
                expect(eptWork.url).to.be.equal(_urls[0]);
                let uploader = await base.getUploaderOfCollection(_collectionId);
                expect(eptWork.uploader).to.be.equal(uploader);
                expect(eptWork.completeNftNum).to.be.equal(_completeNftNums[0]);
                expect(eptWork.compToFragNftNum).to.be.equal(_compToFragNftNums[0]);
                expect(eptWork.fragmentNumPerCompNFT).to.be.equal(_fragNumPerCompNFTs[0]);

                // sumTokenIdsNum
                expect(await base.totalTokenIdsNumOfCollect(_collectionId)).to.be.equal((workNum + 2)*(_fragNumPerCompNFTs[0] + 1))
            });
        });
    });
});
