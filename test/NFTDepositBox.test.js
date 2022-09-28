const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { ADDRESS_ZERO } = require("./utilities");

let owner, user, alice;
let token20, token721, token1155, nftdb, utoken, ctrt;

describe("NFT deposit box func", async function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];

        this.TOKEN1155 = await ethers.getContractFactory("NFTFactoryMock");
        this.ERC20 = await ethers.getContractFactory("Token20Mock");
        this.ERC721 = await ethers.getContractFactory("Token721Mock");
        this.NFTDepositBox = await ethers.getContractFactory("NFTDepositBoxMock");
        this.UserToken = await ethers.getContractFactory("UserTokensMock");
        this.Contract = await ethers.getContractFactory("Contract");
        this.ExternalBase = await ethers.getContractFactory("ExternalNftBaseMock");
    });

    beforeEach(async function() {
        token1155 = await this.TOKEN1155.deploy()
        await token1155.deployed();

        token20 = await this.ERC20.deploy();
        await token20.deployed();

        token721 = await this.ERC721.deploy();
        await token721.deployed();

        nftdb = await this.NFTDepositBox.deploy();
        await nftdb.deployed();

        utoken = await this.UserToken.deploy();
        await utoken.deployed();

        ctrt = await this.Contract.deploy();
        await ctrt.deployed();

        exbase = await this.ExternalBase.deploy();
        await exbase.deployed();
    });

    it("initialize", async function() {
        await nftdb.initialize(owner.address, alice.address, exbase.address);
        let eptMBMAddr = await nftdb.mysteryBoxMarket();
        let eptBool = await nftdb.internalCaller(eptMBMAddr);
        expect(eptMBMAddr).to.be.equal(owner.address);
        expect(eptBool).to.be.equal(true);
        expect(await nftdb.internalNFT1155()).to.be.equal(alice.address);
        expect(await nftdb.isWhitelistNFT(alice.address)).to.be.equal(true);
        expect(await nftdb.internalCaller(exbase.address)).to.be.equal(true);
    });

    // TODO: All the transfer tokens need to get along with UserTokens?
    describe("NFT deposit box test", async function() {
        beforeEach("", async function() {
            await nftdb.initialize(user.address, alice.address, exbase.address);
            await token1155.initialize(utoken.address, owner.address);
            await utoken.initialize(token1155.address, ctrt.address, user.address, user.address, user.address);
            await utoken.setInternalCaller(owner.address, true);
            await utoken.setInternalCaller(nftdb.address, true);
            await utoken.setInternalCaller(token1155.address, true);
            await utoken.setInternalCaller(token721.address, true);
            await nftdb.addWhitelistNFTAddr(token1155.address);
            await nftdb.addWhitelistNFTAddr(token721.address);
        });

        it("deposit nft", async function() {
            let _id1 = 7, _amount1 = 6, _amount2 = 3;
            let _id2 = 8, _amount721 = 1;
            // before deposit
            let _nftIdBefore = await nftdb.nftId(); // 0
            let _nftIdFromMapBefore1 = await nftdb.nftIdMap(token1155.address, _id1, owner.address);
            let _nftIdFromMapBefore2 = await nftdb.nftIdMap(token721.address, _id2, owner.address);
            let _ownerNftsBefore = await nftdb.getOwnerNfts(owner.address);
            let _ownerNftsLenBefore = _ownerNftsBefore.length;

            // the first deposit: token1155
            await token1155.addBalance(owner.address, _id1, _amount1 + _amount2);
            await token1155.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(owner.address, token1155.address, _id1);
            let tx = await nftdb.depositNFT(token1155.address, _id1, _amount1);

            // get state variables after first deposit
            let _nftIdAfter = await nftdb.nftId(); // 1
            let _nftIdFromMapAfter1 = await nftdb.nftIdMap(token1155.address, _id1, owner.address);
            let _ownerNftsAfter = await nftdb.getOwnerNfts(owner.address);
            let _ownerNftsLenAfter = _ownerNftsAfter.length;

            // check data after first deposit
            expect(_nftIdAfter).to.be.equal(parseInt(_nftIdBefore) + 1);
            expect(_nftIdFromMapAfter1).to.be.equal(_nftIdAfter);
            expect(_ownerNftsLenAfter).to.be.equal(_ownerNftsLenBefore + 1);
            let eptNFT = await nftdb.allNFTs(_nftIdAfter);
            expect(eptNFT.tokenAddress).to.be.equal(token1155.address);
            expect(eptNFT.tokenId).to.be.equal(_id1);
            expect(eptNFT.amount).to.be.equal(_amount1);
            expect(eptNFT.owner).to.be.equal(owner.address);
            expect(eptNFT.nftType).to.be.equal(1155);
            expect(eptNFT.isInCollection).to.be.equal(false);

            // check event
            let receipt = await tx.wait();
            let nftDepositEvent = receipt.events.pop();
            expect(nftDepositEvent.event).to.be.equal("NFTDeposit");
            expect(nftDepositEvent.eventSignature)
                .to.be.equal("NFTDeposit(address,address,uint256,uint256)");
            let amounts = nftDepositEvent.args;
            expect(amounts._owner).to.be.equal(owner.address);
            expect(amounts._tokenAddress).to.be.equal(token1155.address);
            expect(amounts._tokenId).to.be.equal(_id1);
            expect(amounts._amount).to.be.equal(_amount1);

            //the second deposit: token721
            await token721.myMint(owner.address, _id2);
            await token721.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(owner.address, token721.address, _id2);
            tx = await nftdb.depositNFT(token721.address, _id2, _amount721);

            // get state variables after first deposit
            _nftIdAfter = await nftdb.nftId(); // 2
            _nftIdFromMapAfter2 = await nftdb.nftIdMap(token721.address, _id2, owner.address);
            _ownerNftsAfter = await nftdb.getOwnerNfts(owner.address);
            _ownerNftsLenAfter = _ownerNftsAfter.length;

            // check data after second deposit
            expect(_nftIdAfter).to.be.equal(parseInt(_nftIdBefore) + 2);
            expect(_nftIdFromMapAfter2).to.be.equal(_nftIdAfter);
            expect(_ownerNftsLenAfter).to.be.equal(_ownerNftsLenBefore + 2);
            eptNFT = await nftdb.allNFTs(_nftIdAfter);
            expect(eptNFT.tokenAddress).to.be.equal(token721.address);
            expect(eptNFT.tokenId).to.be.equal(_id2);
            expect(eptNFT.amount).to.be.equal(_amount721);
            expect(eptNFT.owner).to.be.equal(owner.address);
            expect(eptNFT.nftType).to.be.equal(721);
            expect(eptNFT.isInCollection).to.be.equal(false);

            // check event
            receipt = await tx.wait();
            nftDepositEvent = receipt.events.pop();
            expect(nftDepositEvent.event).to.be.equal("NFTDeposit");
            expect(nftDepositEvent.eventSignature)
                .to.be.equal("NFTDeposit(address,address,uint256,uint256)");
            amounts = nftDepositEvent.args;
            expect(amounts._owner).to.be.equal(owner.address);
            expect(amounts._tokenAddress).to.be.equal(token721.address);
            expect(amounts._tokenId).to.be.equal(_id2);
            expect(amounts._amount).to.be.equal(_amount721);

            // third deposit: token 1155
            tx = await nftdb.depositNFT(token1155.address, _id1, _amount2);
            // get state variables after first deposit
            _nftIdAfter = await nftdb.nftId(); // 2
            _nftIdFromMapAfter1 = await nftdb.nftIdMap(token1155.address, _id1, owner.address); // 1
            _ownerNftsAfter = await nftdb.getOwnerNfts(owner.address);
            _ownerNftsLenAfter = _ownerNftsAfter.length; // no change, still 2

            // check data after first deposit
            expect(_nftIdAfter).to.be.equal(parseInt(_nftIdBefore) + 2);
            expect(_nftIdFromMapAfter1).to.be.equal(_nftIdAfter - 1);
            expect(_ownerNftsLenAfter).to.be.equal(_ownerNftsLenBefore + 2);
            eptNFT = await nftdb.allNFTs(_nftIdFromMapAfter1);
            expect(eptNFT.tokenAddress).to.be.equal(token1155.address);
            expect(eptNFT.tokenId).to.be.equal(_id1);
            expect(eptNFT.amount).to.be.equal(_amount1 + _amount2);
            expect(eptNFT.owner).to.be.equal(owner.address);
            expect(eptNFT.nftType).to.be.equal(1155);
            expect(eptNFT.isInCollection).to.be.equal(false);

            // check event
            receipt = await tx.wait();
            nftDepositEvent = receipt.events.pop();
            expect(nftDepositEvent.event).to.be.equal("NFTDeposit");
            expect(nftDepositEvent.eventSignature)
                .to.be.equal("NFTDeposit(address,address,uint256,uint256)");
            amounts = nftDepositEvent.args;
            expect(amounts._owner).to.be.equal(owner.address);
            expect(amounts._tokenAddress).to.be.equal(token1155.address);
            expect(amounts._tokenId).to.be.equal(_id1);
            expect(amounts._amount).to.be.equal(_amount2);
        });

        it("deposit nft failed", async function() {
            // only whitelist
            await expect(nftdb.depositNFT(token20.address, 2, 2))
                .to.be.revertedWith("NFTDepositBox: only whitelist NFT can deposit");

            // not erc721 or erc1155
            await nftdb.addWhitelistNFTAddr(token20.address);
            await expect(nftdb.depositNFT(token20.address, 2, 2))
                .to.be.revertedWith("Not ERC721 or ERC1155");

            // 721's amount is not 1
            await expect(nftdb.depositNFT(token721.address, 2, 2))
                .to.be.revertedWith("The amount of 721-NFT deposited only be 1");

            // 1155's amount must GT 0
            await expect(nftdb.depositNFT(token1155.address, 2, 0))
                .to.be.revertedWith("The amount of 1155-NFT deposited must GT 0");
        });

        it("batch deposit nft", async function() {
            // [token1155, token721]
            let _ids = [7, 8], _amounts = [6, 1];
            await token1155.addBalance(owner.address, _ids[0], _amounts[0]);
            await token1155.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(owner.address, token1155.address, _ids[0]);
            await token721.myMint(owner.address, _ids[1]);
            await token721.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(owner.address, token721.address, _ids[1]);

            // before deposit
            let _nftIdBefore = await nftdb.nftId(); // 0
            let _nftIdFromMapBefore1 = await nftdb.nftIdMap(token1155.address, _ids[0], owner.address);
            let _nftIdFromMapBefore2 = await nftdb.nftIdMap(token721.address, _ids[1], owner.address);
            let _ownerNftsBefore = await nftdb.getOwnerNfts(owner.address);
            let _ownerNftsLenBefore = _ownerNftsBefore.length;

            await nftdb.batchDepositNFT([token1155.address, token721.address], _ids, _amounts, owner.address);

            // get state variables after first deposit
            let _nftIdAfter = await nftdb.nftId(); // 2
            let _nftIdFromMapAfter1 = await nftdb.nftIdMap(token1155.address, _ids[0], owner.address);
            let _nftIdFromMapAfter2 = await nftdb.nftIdMap(token721.address, _ids[1], owner.address);
            let _ownerNftsAfter = await nftdb.getOwnerNfts(owner.address);
            let _ownerNftsLenAfter = _ownerNftsAfter.length;

            // check data after first deposit
            expect(_nftIdAfter).to.be.equal(parseInt(_nftIdBefore) + 2);
            expect(_nftIdFromMapAfter1).to.be.equal(parseInt(_nftIdAfter) - 1);
            expect(_nftIdFromMapAfter2).to.be.equal(_nftIdAfter);
            expect(_ownerNftsLenAfter).to.be.equal(_ownerNftsLenBefore + 2);

            let eptNFT = await nftdb.allNFTs(_nftIdFromMapAfter1);
            expect(eptNFT.tokenAddress).to.be.equal(token1155.address);
            expect(eptNFT.tokenId).to.be.equal(_ids[0]);
            expect(eptNFT.amount).to.be.equal(_amounts[0]);
            expect(eptNFT.owner).to.be.equal(owner.address);
            expect(eptNFT.nftType).to.be.equal(1155);
            expect(eptNFT.isInCollection).to.be.equal(false);

            eptNFT = await nftdb.allNFTs(_nftIdAfter);
            expect(eptNFT.tokenAddress).to.be.equal(token721.address);
            expect(eptNFT.tokenId).to.be.equal(_ids[1]);
            expect(eptNFT.amount).to.be.equal(_amounts[1]);
            expect(eptNFT.owner).to.be.equal(owner.address);
            expect(eptNFT.nftType).to.be.equal(721);
            expect(eptNFT.isInCollection).to.be.equal(false);
        });

        it("batch deposit nft failed", async function() {
            // length must > 0.
            let _ids = [], _amounts = [6];
            await expect(nftdb.batchDepositNFT([], _ids, _amounts, owner.address))
                .to.be.revertedWith("Len must GT 0");
            // length of all arrays must match.
            await expect(nftdb.batchDepositNFT([token1155.address], _ids, _amounts, owner.address))
                .to.be.revertedWith("Array length must match");
        });

        it("deposit nft by base", async function() {
            let _id = 7, _amount = 6;
            await token1155.addBalance(owner.address, _id, _amount);
            await token1155.setApprovalForAll(nftdb.address, true);  // approve
            await utoken.addUserTokenId(owner.address, token1155.address, _id);

            await nftdb.setInternalCaller(owner.address, true);
            await nftdb.depositNFTByBase(token1155.address, _id, owner.address, _amount);
            expect(await nftdb.nftId()).to.be.equal(1);
        });

        it("deposit nft by base failed", async function() {
            await expect(nftdb.depositNFTByBase(user.address, 1, user.address, 1))
                .to.be.revertedWith("NFTDepositBox: caller is not a internal caller");
        });

        describe("NFT deposit box test", async function() {
            let _ids = [7, 8], _amounts = [6, 1];
            beforeEach("", async function() {
                await token1155.addBalance(owner.address, _ids[0], _amounts[0]);
                await token1155.setApprovalForAll(nftdb.address, true);  // approve
                await utoken.addUserTokenId(owner.address, token1155.address, _ids[0]);
                await token721.myMint(owner.address, _ids[1]);
                await token721.setApprovalForAll(nftdb.address, true);  // approve
                await utoken.addUserTokenId(owner.address, token721.address, _ids[1]);
                await nftdb.batchDepositNFT([token1155.address, token721.address], _ids, _amounts, owner.address);
            });

            it("withdraw nft", async function() {
                // erc1155
                let _nftId = 1, _amount = 3; // balance is 6, owner and contract both have 3.
                let tx = await nftdb.withdrawNFT(_nftId, _amount);
                expect(await token1155.balanceOf(nftdb.address, _ids[0])).to.be.equal(_amount);
                expect(await token1155.balanceOf(owner.address, _ids[0])).to.be.equal(_amount);

                // check event
                let receipt = await tx.wait();
                let Event = receipt.events.pop();
                expect(Event.event).to.be.equal("NFTWithdraw");
                expect(Event.eventSignature)
                    .to.be.equal("NFTWithdraw(address,address,uint256,uint256)");
                amounts = Event.args;
                expect(amounts._to).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token1155.address);
                expect(amounts._tokenId).to.be.equal(_ids[0]);
                expect(amounts._amount).to.be.equal(_amount);

                // erc721
                _nftId = 2, _amount = 1;
                tx = await nftdb.withdrawNFT(_nftId, _amount);
                expect(await token721.balanceOf(nftdb.address)).to.be.equal(0);
                expect(await token721.balanceOf(owner.address)).to.be.equal(_amount);

                // check event
                receipt = await tx.wait();
                Event = receipt.events.pop();
                expect(Event.event).to.be.equal("NFTWithdraw");
                expect(Event.eventSignature)
                    .to.be.equal("NFTWithdraw(address,address,uint256,uint256)");
                amounts = Event.args;
                expect(amounts._to).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token721.address);
                expect(amounts._tokenId).to.be.equal(_ids[1]);
                expect(amounts._amount).to.be.equal(_amount);
            });

            it("withdraw nft failed", async function() {
                // not owner or internal caller
                await expect(nftdb.connect(alice).withdrawNFT(1, 1, {from:alice.address}))
                    .to.be.revertedWith("Not owner or internal caller");
                // nft in collection
                await nftdb.setInternalCaller(owner.address, true);
                await nftdb.setNFTStatus(1, true);
                await expect(nftdb.withdrawNFT(1, 1))
                    .to.be.revertedWith("NFT in the collection");
                // over amount
                await expect(nftdb.withdrawNFT(2, 2))  // amount is 1
                    .to.be.revertedWith("The amount of withdraw too much");
            });

            it("batch withdraw nft", async function() {
                // contract's tokens: {1155(7):6, 721(8):1}
                // owner has no tokens
                await nftdb.batchWithdrawNFT([1,2], _amounts);
                expect(await token1155.balanceOf(nftdb.address, _ids[0])).to.be.equal(0);
                expect(await token1155.balanceOf(owner.address, _ids[0])).to.be.equal(_amounts[0]);
                expect(await token721.balanceOf(nftdb.address)).to.be.equal(0);
                expect(await token721.balanceOf(owner.address)).to.be.equal(_amounts[1]);
            });

            it("batch withdraw nft failed", async function() {
                // array's len must > 0
                await expect(nftdb.batchWithdrawNFT([], _amounts)).to.be.revertedWith("Len must GT 0");
                // array's length must match
                await expect(nftdb.batchWithdrawNFT([1], _amounts)).to.be.revertedWith("Array length must match");
            });

            it("claim nft", async function() {
                // erc1155
                let _nftId = 1, _amount = 3; // balance is 6, owner and contract both have 3.
                await nftdb.connect(user).setNFTStatus(_nftId, true, {from:user.address});
                let tx = await nftdb.connect(user).claimNFT(owner.address, _nftId, _amount, {from:user.address});
                expect(await token1155.balanceOf(nftdb.address, _ids[0])).to.be.equal(_amount);
                expect(await token1155.balanceOf(owner.address, _ids[0])).to.be.equal(_amount);

                // check event
                let receipt = await tx.wait();
                let Event = receipt.events.pop();
                expect(Event.event).to.be.equal("NFTClaim");
                expect(Event.eventSignature)
                    .to.be.equal("NFTClaim(address,address,uint256,uint256)");
                amounts = Event.args;
                expect(amounts._to).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token1155.address);
                expect(amounts._tokenId).to.be.equal(_ids[0]);
                expect(amounts._amount).to.be.equal(_amount);

                // erc721
                _nftId = 2, _amount = 1;
                await nftdb.connect(user).setNFTStatus(_nftId, true, {from:user.address});
                tx = await nftdb.connect(user).claimNFT(owner.address, _nftId, _amount, {from:user.address});
                expect(await token721.balanceOf(nftdb.address)).to.be.equal(0);
                expect(await token721.balanceOf(owner.address)).to.be.equal(_amount);

                // check event
                receipt = await tx.wait();
                Event = receipt.events.pop();
                expect(Event.event).to.be.equal("NFTClaim");
                expect(Event.eventSignature)
                    .to.be.equal("NFTClaim(address,address,uint256,uint256)");
                amounts = Event.args;
                expect(amounts._to).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token721.address);
                expect(amounts._tokenId).to.be.equal(_ids[1]);
                expect(amounts._amount).to.be.equal(_amount);
            });

            it("claim nft failed", async function() {
                // NFT not in collection
                await expect(nftdb.connect(user).claimNFT(owner.address, 1, 1, {from:user.address}))
                    .to.be.revertedWith("NFT not in the collection");
                await nftdb.connect(user).setNFTStatus(1, true, {from:user.address});
                // over amount
                await expect(nftdb.connect(user).claimNFT(owner.address, 1, 10, {from:user.address}))
                    .to.be.revertedWith("The amount of withdraw too much");
            });

            it("batch claim nft", async function() {
                // contract's tokens: {1155(7):6, 721(8):1}
                // owner has no tokens
                await nftdb.connect(user).setNFTStatus(1, true, {from:user.address});
                await nftdb.connect(user).setNFTStatus(2, true, {from:user.address});
                await nftdb.connect(user).batchClaimNFT(owner.address, [1,2], _amounts, {from:user.address});
                expect(await token1155.balanceOf(nftdb.address, _ids[0])).to.be.equal(0);
                expect(await token1155.balanceOf(owner.address, _ids[0])).to.be.equal(_amounts[0]);
                expect(await token721.balanceOf(nftdb.address)).to.be.equal(0);
                expect(await token721.balanceOf(owner.address)).to.be.equal(_amounts[1]);
            });

            it("batch claim nft failed", async function() {
                // array's len must > 0
                await expect(nftdb.connect(user).batchClaimNFT(
                    owner.address, [], _amounts, {from:user.address})).to.be.revertedWith("Len must GT 0");
                // array's length must match
                await expect(nftdb.connect(user).batchClaimNFT(
                    owner.address, [1], _amounts, {from:user.address})).to.be.revertedWith("Array length must match");
            });

            it("add whitelist NFT address", async function() {
                // pre state
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(3);
                expect(addrs[0]).to.be.equal(alice.address);  // initialize
                expect(addrs[1]).to.be.equal(token1155.address);
                expect(addrs[2]).to.be.equal(token721.address);

                // do call
                tx = await nftdb.addWhitelistNFTAddr(utoken.address);
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(4);
                expect(addrs[3]).to.be.equal(utoken.address);
                // check event
                receipt = await tx.wait();
                Event = receipt.events.pop();
                expect(Event.event).to.be.equal("AddWhitelistNFT");
                expect(Event.eventSignature)
                    .to.be.equal("AddWhitelistNFT(address)");
                _args = Event.args;
                expect(_args.nftAddress).to.be.equal(utoken.address);

                // call again: already exist
                await nftdb.addWhitelistNFTAddr(utoken.address);
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(4);
                expect(addrs[3]).to.be.equal(utoken.address);
                // call again: not contract address
                await nftdb.addWhitelistNFTAddr(alice.address);
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(4);
                expect(addrs[3]).to.be.equal(utoken.address);
            });

            it("add whitelist NFT address failed", async function() {
                await expect(nftdb.connect(user).addWhitelistNFTAddr(utoken.address, {from:user.address}))
                    .to.be.revertedWith("Ownable: caller is not the owner")
            });

            it("remove whitelist NFT address", async function() {
                // pre state
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(3);
                expect(addrs[0]).to.be.equal(alice.address);  // initialize
                expect(addrs[1]).to.be.equal(token1155.address);
                expect(addrs[2]).to.be.equal(token721.address);

                // do call: remove alice
                tx = await nftdb.removeWhitelistNFTAddr(alice.address)
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(2);
                expect(addrs[1]).to.be.equal(token1155.address);
                expect(addrs[0]).to.be.equal(token721.address);
                // check event
                receipt = await tx.wait();
                Event = receipt.events.pop();
                expect(Event.event).to.be.equal("RemoveWhitelistNFT");
                expect(Event.eventSignature)
                    .to.be.equal("RemoveWhitelistNFT(address)");
                _args = Event.args;
                expect(_args.nftAddress).to.be.equal(alice.address);

                // call again: remove 721
                tx = await nftdb.removeWhitelistNFTAddr(token721.address)
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(1);
                expect(addrs[0]).to.be.equal(token1155.address);
                // check event
                receipt = await tx.wait();
                Event = receipt.events.pop();
                expect(Event.event).to.be.equal("RemoveWhitelistNFT");
                expect(Event.eventSignature)
                    .to.be.equal("RemoveWhitelistNFT(address)");
                _args = Event.args;
                expect(_args.nftAddress).to.be.equal(token721.address);

                // call again: remove token721
                await nftdb.removeWhitelistNFTAddr(token721.address)
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(1);
                expect(addrs[0]).to.be.equal(token1155.address);
            });

            it("remove whitelist NFT address failed", async function() {
                await expect(nftdb.connect(user).removeWhitelistNFTAddr(utoken.address, {from:user.address}))
                    .to.be.revertedWith("Ownable: caller is not the owner")
            });

            it("batch add whitelist NFT addresses", async function() {
                _newAddrs = [token20.address, utoken.address]
                // pre state
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(3);
                expect(addrs[0]).to.be.equal(alice.address);  // initialize
                expect(addrs[1]).to.be.equal(token1155.address);
                expect(addrs[2]).to.be.equal(token721.address);

                // do call
                await nftdb.batchAddWhitelistNFTAddrs(_newAddrs)
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(5);
                expect(addrs[3]).to.be.equal(token20.address);
                expect(addrs[4]).to.be.equal(utoken.address);
                // remove token20
                await nftdb.removeWhitelistNFTAddr(token20.address)
                await nftdb.batchAddWhitelistNFTAddrs(_newAddrs)
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(5);
                expect(addrs[4]).to.be.equal(token20.address);
                expect(addrs[3]).to.be.equal(utoken.address);
            });

            it("batch add whitelist NFT addresses failed", async function() {
                await expect(nftdb.batchAddWhitelistNFTAddrs([])).to.be.revertedWith("The len of input _newNFTAddrs must GT 0");
                await expect(nftdb.connect(user)
                    .batchAddWhitelistNFTAddrs([token20.address], {from:user.address}))
                    .to.be.revertedWith("Ownable: caller is not the owner")
            });

            it("batch remove whitelist NFT addresses", async function() {
                _newAddrs = [alice.address, token721.address]
                // pre state
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(3);
                expect(addrs[0]).to.be.equal(alice.address);  // initialize
                expect(addrs[1]).to.be.equal(token1155.address);
                expect(addrs[2]).to.be.equal(token721.address);

                // do call
                await nftdb.batchRemoveWhitelistNFTAddrs(_newAddrs);
                addrs = await nftdb.getAllWhitelistNFTAddr()
                expect(addrs.length).to.be.equal(1);
                expect(addrs[0]).to.be.equal(token1155.address);

            });

            it("batch remove whitelist NFT addresses failed", async function() {
                await expect(nftdb.batchRemoveWhitelistNFTAddrs([])).to.be.revertedWith("The len of input _rmNFTAddrs must GT 0");
                await expect(nftdb.connect(user)
                    .batchRemoveWhitelistNFTAddrs([token20.address], {from:user.address}))
                    .to.be.revertedWith("Ownable: caller is not the owner")
            });

            it("set nft status failed", async function() {
                await expect(nftdb.connect(user).setNFTStatus(
                    3, true, {from:user.address})).to.be.revertedWith("NFT is not existed");
            });

            it("get nft info", async function() {
                let eptRet = await nftdb.getNFTInfo(1);
                expect(eptRet[0]).to.be.equal(1155);
                expect(eptRet[1]).to.be.equal(_amounts[0]);

                eptRet = await nftdb.getNFTInfo(2);
                expect(eptRet[0]).to.be.equal(721);
                expect(eptRet[1]).to.be.equal(_amounts[1]);
            });

            it("get nft'a owner", async function() {
                expect(await nftdb.getOwnerOfNFT(1)).to.be.equal(owner.address);
            });

            it("get virtual nft info", async function() {
                let _nftId = 1;
                let eptRet = await nftdb.getVirtualNftInfo(_nftId);
                expect(eptRet[0]).to.be.equal(true);
                expect(eptRet[1]).to.be.equal(token1155.address);
                expect(eptRet[2]).to.be.equal(_ids[0]);
                expect(eptRet[3]).to.be.equal(1155);

                _nftId = BigNumber.from(2).pow(128).mul(1);
                eptRet = await nftdb.getVirtualNftInfo(_nftId);
                expect(eptRet[0]).to.be.equal(false);
                expect(eptRet[1]).to.be.equal(alice.address);
                expect(eptRet[2]).to.be.equal(_nftId);
                expect(eptRet[3]).to.be.equal(1155);
            });

            it("get virtual nft info failed", async function() {
                await expect(nftdb.getVirtualNftInfo(0)).to.be.revertedWith("NFT id cannot be 0");
            });
        });
    });
});
