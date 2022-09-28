const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { ADDRESS_ZERO } = require("./utilities");
const { time } = require("./utilities")

let MINUTE = 60;
let HOUR = 3600;
let DAY = 86400;

let owner, user, alice;
let nft, token1155, token20, token721, ctrt;

describe("NFT Auction Market func", async function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];

        this.NFT = await ethers.getContractFactory("NFTAuctionMarketMock");
        this.TOKEN1155 = await ethers.getContractFactory("NFTFactoryMock");
        this.TOKEN20 = await ethers.getContractFactory("Token20Mock");
        this.TOKEN721 = await ethers.getContractFactory("Token721Mock");
        this.UserToken = await ethers.getContractFactory("UserTokensMock");
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
        await nft.initialize(token1155.address, ctrt.address, owner.address, [token20.address]);
        let eptToken1155 = await nft.internalToken();
        let eptContract = await nft.token();
        let eptUtoken = await nft.userTokens();
        let eptHandlingFeeAccount = await nft.handlingFeeAccount();
        let eptHandlingFeeRatio = await nft.getHandlingFeeRatio();
        let eptIsAllowFragmentsList = await nft.getIsAllowFragmentsList();

        expect(eptToken1155).to.be.equal(token1155.address);
        expect(eptContract).to.be.equal(ctrt.address);
        expect(eptHandlingFeeAccount).to.be.equal(owner.address);
        expect(eptHandlingFeeRatio).to.be.equal(200);
        expect(eptIsAllowFragmentsList).to.be.equal(false);
    });

    it("initialize failed", async function() {
        await expect(nft.initialize(token1155.address, ctrt.address,ADDRESS_ZERO, [token20.address]))
            .to.be.revertedWith("account is zero address");
    });

    describe("NFT auction market test", async function() {
        beforeEach("", async function() {
            await nft.initialize(token1155.address, ctrt.address,owner.address, [token20.address]);
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

        it("auction listed", async function() {
            let _tokenId = 1, _auctionStartTime = await time.latestTime();
            let _auctionEndTime = parseInt(_auctionStartTime) + DAY * 2;
            let _startPrice = 480, _reservePrice = 200, _markdownTimeInterval = HOUR;

            await nft.setIsAllowFragmentsList(true);

            // need sufficient balance and approve
            await token1155.addBalance(owner.address, _tokenId, 1);
            await token1155.setApprovalForAll(nft.address, true);

            // get state variable before
            let auctionItemIdBefore = await nft.auctionItemId();
            let auctioneerAuctionItemIdsBefore = await nft.getAuctioneerAuctionItemIds();
            let auctioneerAuctionItemIdsLenBefore = auctioneerAuctionItemIdsBefore.length;
            let tokenIdOfAuctionItemIdsBefore = await nft.getTokenAuctionItemIds(_tokenId);
            let tokenIdOfAuctionItemIdsLenBefore = tokenIdOfAuctionItemIdsBefore.length;
            let biddableAuctionItemIdsBefore = await nft.getBiddableAuctionItemIds();
            let biddableAuctionItemIdsLenBefore = biddableAuctionItemIdsBefore.length;

            let tx = await nft.listNFTAuctionItem(
                        token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                        _startPrice, _reservePrice, _markdownTimeInterval, token20.address);

            // get state variable after
            let auctionItemIdAfter = await nft.auctionItemId();
            let auctioneerAuctionItemIdsAfter = await nft.getAuctioneerAuctionItemIds();
            let auctioneerAuctionItemIdsLenAfter = auctioneerAuctionItemIdsAfter.length;
            let tokenIdOfAuctionItemIdsAfter = await nft.getTokenAuctionItemIds(_tokenId);
            let tokenIdOfAuctionItemIdsLenAfter = tokenIdOfAuctionItemIdsAfter.length;
            let biddableAuctionItemIdsAfter = await nft.getBiddableAuctionItemIds();
            let biddableAuctionItemIdsLenAfter = biddableAuctionItemIdsAfter.length;
            let auctionItem = await nft.getNFTAuctionItem(auctionItemIdAfter);

            let eptAuctionItem = await nft.getAuctioneerAuctionItem(owner.address, 0);
            expect(eptAuctionItem.tokenId).to.be.equal(_tokenId);
            eptAuctionItem = await nft.getTokenAuctionItem(_tokenId, 0);
            expect(eptAuctionItem.auctionItemId).to.be.equal(auctionItemIdAfter);

            // check data
            expect(auctionItemIdAfter).to.be.equal(auctionItemIdBefore + 1);
            expect(auctioneerAuctionItemIdsLenAfter).to.be.equal(auctioneerAuctionItemIdsLenBefore + 1);
            expect(auctioneerAuctionItemIdsAfter[auctioneerAuctionItemIdsLenAfter - 1]).to.be.equal(auctionItemIdAfter);
            expect(tokenIdOfAuctionItemIdsLenAfter).to.be.equal(tokenIdOfAuctionItemIdsLenBefore + 1);
            expect(tokenIdOfAuctionItemIdsAfter[tokenIdOfAuctionItemIdsLenAfter - 1]).to.be.equal(auctionItemIdAfter);
            expect(biddableAuctionItemIdsLenAfter).to.be.equal(biddableAuctionItemIdsLenBefore + 1);
            expect(biddableAuctionItemIdsAfter[biddableAuctionItemIdsLenAfter - 1]).to.be.equal(auctionItemIdAfter);
            // check auctionItem
            expect(auctionItem.auctionItemId).to.be.equal(auctionItemIdAfter);
            expect(auctionItem.owner).to.be.equal(owner.address);
            expect(auctionItem.tokenAddress).to.be.equal(token1155.address);
            expect(auctionItem.tokenId).to.be.equal(_tokenId);
            expect(auctionItem.auctionStartTime).to.be.equal(_auctionStartTime);
            expect(auctionItem.auctionEndTime).to.be.equal(_auctionEndTime);
            expect(auctionItem.startPrice).to.be.equal(_startPrice);
            expect(auctionItem.reservePrice).to.be.equal(_reservePrice);
            expect(auctionItem.markdownTimeInterval).to.be.equal(_markdownTimeInterval);
            expect(auctionItem.token20Address).to.be.equal(token20.address);
            expect(auctionItem.bidder).to.be.equal(ADDRESS_ZERO);
            expect(auctionItem.bid).to.be.equal(0);
            expect(auctionItem.status).to.be.equal(0);
            // check event
            let receipt = await tx.wait();
            let listEvent = receipt.events.pop();
            expect(listEvent.event).to.be.equal("NFTAuctionItemListed");
            expect(listEvent.eventSignature)
                .to.be.equal("NFTAuctionItemListed(uint256,address,address,uint256)");
            let amounts = listEvent.args;
            expect(amounts._auctionItemId).to.be.equal(auctionItemIdAfter);
            expect(amounts._owner).to.be.equal(owner.address);
            expect(amounts._tokenAddress).to.be.equal(token1155.address);
            expect(amounts._tokenId).to.be.equal(_tokenId);

            // if it is erc721 token.
            _tokenId = 2;
            await token721.myMint(owner.address, _tokenId);
            await token721.setApprovalForAll(nft.address, true);
            
            tx = await nft.listNFTAuctionItem(
                        token721.address, _tokenId, _auctionStartTime, _auctionEndTime,
                        _startPrice, _reservePrice, _markdownTimeInterval, token20.address);

            // get state variable after
            auctionItemIdAfter = await nft.auctionItemId();
            auctioneerAuctionItemIdsAfter = await nft.getAuctioneerAuctionItemIds();
            auctioneerAuctionItemIdsLenAfter = auctioneerAuctionItemIdsAfter.length;
            tokenIdOfAuctionItemIdsAfter = await nft.getTokenAuctionItemIds(_tokenId);
            tokenIdOfAuctionItemIdsLenAfter = tokenIdOfAuctionItemIdsAfter.length;
            biddableAuctionItemIdsAfter = await nft.getBiddableAuctionItemIds();
            biddableAuctionItemIdsLenAfter = biddableAuctionItemIdsAfter.length;
            auctionItem = await nft.getNFTAuctionItem(auctionItemIdAfter);

            eptAuctionItem = await nft.getAuctioneerAuctionItem(owner.address, 1);
            expect(eptAuctionItem.tokenId).to.be.equal(_tokenId);
            eptAuctionItem = await nft.getTokenAuctionItem(_tokenId, 0);
            expect(eptAuctionItem.auctionItemId).to.be.equal(auctionItemIdAfter);

            // check data
            expect(auctionItemIdAfter).to.be.equal(auctionItemIdBefore + 2);
            expect(auctioneerAuctionItemIdsLenAfter).to.be.equal(auctioneerAuctionItemIdsLenBefore + 2);
            expect(auctioneerAuctionItemIdsAfter[auctioneerAuctionItemIdsLenAfter - 1]).to.be.equal(auctionItemIdAfter);
            expect(tokenIdOfAuctionItemIdsLenAfter).to.be.equal(tokenIdOfAuctionItemIdsLenBefore + 1);
            expect(tokenIdOfAuctionItemIdsAfter[tokenIdOfAuctionItemIdsLenAfter - 1]).to.be.equal(auctionItemIdAfter);
            expect(biddableAuctionItemIdsLenAfter).to.be.equal(biddableAuctionItemIdsLenBefore + 2);
            expect(biddableAuctionItemIdsAfter[biddableAuctionItemIdsLenAfter - 1]).to.be.equal(auctionItemIdAfter);
            
            // check auctionItem
            expect(auctionItem.auctionItemId).to.be.equal(auctionItemIdAfter);
            expect(auctionItem.owner).to.be.equal(owner.address);
            expect(auctionItem.tokenAddress).to.be.equal(token721.address);
            expect(auctionItem.tokenId).to.be.equal(_tokenId);
            expect(auctionItem.auctionStartTime).to.be.equal(_auctionStartTime);
            expect(auctionItem.auctionEndTime).to.be.equal(_auctionEndTime);
            expect(auctionItem.startPrice).to.be.equal(_startPrice);
            expect(auctionItem.reservePrice).to.be.equal(_reservePrice);
            expect(auctionItem.markdownTimeInterval).to.be.equal(_markdownTimeInterval);
            expect(auctionItem.token20Address).to.be.equal(token20.address);
            expect(auctionItem.bidder).to.be.equal(ADDRESS_ZERO);
            expect(auctionItem.bid).to.be.equal(0);
            expect(auctionItem.status).to.be.equal(0);
            // check event
            receipt = await tx.wait();
            listEvent = receipt.events.pop();
            expect(listEvent.event).to.be.equal("NFTAuctionItemListed");
            expect(listEvent.eventSignature)
                .to.be.equal("NFTAuctionItemListed(uint256,address,address,uint256)");
            amounts = listEvent.args;
            expect(amounts._auctionItemId).to.be.equal(auctionItemIdAfter);
            expect(amounts._owner).to.be.equal(owner.address);
            expect(amounts._tokenAddress).to.be.equal(token721.address);
            expect(amounts._tokenId).to.be.equal(_tokenId);
        });

        it("auction listed failed", async function() {
            let _tokenId = 1, _auctionStartTime = await time.latestTime();
            let _auctionEndTime = parseInt(_auctionStartTime) - MINUTE;
            let _startPrice = 480, _reservePrice = 200, _markdownTimeInterval = HOUR;
            // not erc721 or erc1155
            await expect(nft.listNFTAuctionItem(
                token20.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("not erc721 or erc1155 contract address");

            // endTime must GT startTime
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("end time earlier than start time");

            // start price must GT 0
            _auctionEndTime = parseInt(_auctionStartTime) + DAY * 2;
            _startPrice = 0;
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("start price is zero");

            // reserve price must LT start price
            _startPrice = 480, _reservePrice = 480;
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("reserve price greater than or equal to start price");

            // markdownTimeInterval must be multiple of hour, and must GT 1 hour LT 12 hours
            _reservePrice = 200, _markdownTimeInterval = HOUR - 1;
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("markdown time interval is invalid");

            // auction duration must be multiple of DAY, [1,7]DAY
            _markdownTimeInterval++, _auctionEndTime -= HOUR
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("auction duration is invalid");

            // nft balance must GT 1
            _auctionEndTime += HOUR;
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("nft balance is zero");
            await token721.myMint(user.address, _tokenId);  // _tokenId must has owner, or it will throw an error.
            await expect(nft.listNFTAuctionItem(
                token721.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("nft balance is zero");

            // nft address must be approved by msgSender
            await token1155.addBalance(owner.address, _tokenId, 66);
            // await token1155.setApprovalForAll(nft.address, true);
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("transfer not approved");
            await token721.myMint(owner.address, 7);  // specified tokenId = 7,
            await expect(nft.listNFTAuctionItem(
                token721.address, 7, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("transfer not approved");

            // not in support tokens
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, user.address)
            ).to.be.revertedWith("not in support tokens");

            // auction duration must be multiple of markdown time interval
            _markdownTimeInterval *= 7;
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("auction duration is invalid");

            // Fragments is not be allowed to list
            _markdownTimeInterval = HOUR;
            token1155.setNFTToFragment(_tokenId);
            await expect(nft.listNFTAuctionItem(
                token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                _startPrice, _reservePrice, _markdownTimeInterval, token20.address)
            ).to.be.revertedWith("nft is fragment");
        });

        describe("After NFT auction listing", async function() {
            let _tokenId = 1, _tokenId2 = 2, _startPrice = 480, _reservePrice = 200, _markdownTimeInterval = HOUR;
            beforeEach("", async function() {
                let _auctionStartTime = await time.latestTime();
                let _auctionEndTime = parseInt(_auctionStartTime) + DAY * 2;
                // need sufficient balance and approve
                await token1155.addBalance(owner.address, _tokenId, 66);
                await token1155.setApprovalForAll(nft.address, true);

                await token721.myMint(owner.address, _tokenId2);
                await token721.setApprovalForAll(nft.address, true);

                await nft.listNFTAuctionItem(token1155.address, _tokenId, _auctionStartTime, _auctionEndTime,
                    _startPrice, _reservePrice, _markdownTimeInterval, token20.address);
                await nft.listNFTAuctionItem(token721.address, _tokenId2, _auctionStartTime, _auctionEndTime,
                    _startPrice, _reservePrice, _markdownTimeInterval, token20.address);
            });

            it("bid NFT auction", async function() {
                let _auctionItemId = 2, _id = _tokenId2;  // the token1155(_auctionItemId = 1) has been tested
                let _amount = await nft.getCurrentAuctionPrice(_auctionItemId);
                let _mintAmount = parseInt(_amount) * 3;
                await token20.addBalance(user.address, _mintAmount);
                await token20.approveTo(user.address, nft.address, _mintAmount);

                // before bid
                let bidderAuctionItemIds = await nft.connect(user).getBidderAuctionItemIds({from:user.address});
                let bidderAuctionItemIdsLen = bidderAuctionItemIds.length;
                let auctionItemBidders = await nft.getBidderRecords(_auctionItemId);
                let auctionItemBiddersLen = auctionItemBidders.length;

                // first bid
                let eptBool = await nft.connect(user).isBidderOfAuctionItem(_auctionItemId, {from:user.address});
                expect(eptBool).to.be.equal(false);
                let tx = await nft.connect(user)
                    .bidNFTAuctionItem(_auctionItemId, _amount, {from:user.address});
                eptBool = await nft.connect(user).isBidderOfAuctionItem(_auctionItemId, {from:user.address});
                expect(eptBool).to.be.equal(true);

                // check data1
                let firstBidderAuctionItemIds = await nft.connect(user).getBidderAuctionItemIds({from:user.address});
                let firstBidderAuctionItemIdsLen = firstBidderAuctionItemIds.length;
                expect(firstBidderAuctionItemIdsLen).to.be.equal(bidderAuctionItemIdsLen + 1);
                expect(firstBidderAuctionItemIds[firstBidderAuctionItemIdsLen - 1]).to.be.equal(_auctionItemId);

                let eptAuctionItem = await nft.connect(user).getBidderAuctionItem(user.address, 0, {from:user.address});
                expect(eptAuctionItem.tokenId).to.be.equal(_id);


                let firstBidderRecords = await nft.getBidderRecords(_auctionItemId);
                let firstBidderRecordsLen = firstBidderRecords.length;
                expect(firstBidderRecordsLen).to.be.equal(auctionItemBiddersLen + 1);
                expect(firstBidderRecords[firstBidderRecordsLen - 1].bidder).to.be.equal(user.address);
                expect(firstBidderRecords[firstBidderRecordsLen - 1].bid).to.be.equal(_amount);

                let eptAuctionItemBidRecord = await nft.getAuctionItemBidRecord(_auctionItemId, 0);
                expect(eptAuctionItemBidRecord.bidder).to.be.equal(user.address);
                expect(eptAuctionItemBidRecord.bid).to.be.equal(_amount);

                // check data2
                let eptItem = await nft.getNFTAuctionItem(_auctionItemId);
                expect(eptItem.bidder).to.be.equal(user.address);
                expect(eptItem.bid).to.be.equal(_amount);
                expect(eptItem.status).to.be.equal(1)

                // check event
                let receipt = await tx.wait();
                let biddingEvent = receipt.events.pop();
                expect(biddingEvent.event).to.be.equal("NFTAuctionItemBidding");
                expect(biddingEvent.eventSignature)
                    .to.be.equal("NFTAuctionItemBidding(uint256,address,address,uint256,address,uint256)");
                let amounts = biddingEvent.args;
                expect(amounts._auctionItemId).to.be.equal(_auctionItemId);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token721.address);
                expect(amounts._tokenId).to.be.equal(_id);
                expect(amounts._bidder).to.be.equal(user.address);
                expect(amounts._bid).to.be.equal(_amount);

                // second bid
                let _amount2 = parseInt(_amount) + 66;
                let _mintAmount2 = parseInt(_amount2) * 3;
                await token20.addBalance(user.address, _mintAmount2);
                await token20.approveTo(user.address, nft.address, _mintAmount2);
                let tx2 = await nft.connect(user)
                    .bidNFTAuctionItem(_auctionItemId, _amount2, {from:user.address});
                eptBool = await nft.connect(user).isBidderOfAuctionItem(_auctionItemId, {from:user.address});
                expect(eptBool).to.be.equal(true);

                // check data1
                let secondBidderAuctionItemIds = await nft.connect(user).getBidderAuctionItemIds({from:user.address});
                let secondBidderAuctionItemIdsLen = secondBidderAuctionItemIds.length;
                // same user, same auctionItem, bidderAuctionItemIds not change.
                expect(secondBidderAuctionItemIdsLen).to.be.equal(firstBidderAuctionItemIdsLen);
                expect(secondBidderAuctionItemIds[secondBidderAuctionItemIdsLen - 1]).to.be.equal(_auctionItemId);
                let secondBidderRecords = await nft.getBidderRecords(_auctionItemId);
                let secondBidderRecordsLen = secondBidderRecords.length;
                expect(secondBidderRecordsLen).to.be.equal(firstBidderRecordsLen + 1);
                expect(secondBidderRecords[secondBidderRecordsLen - 1].bidder).to.be.equal(user.address);
                expect(secondBidderRecords[secondBidderRecordsLen - 1].bid).to.be.equal(_amount2);
                eptBool = (secondBidderRecords[0].time < secondBidderRecords[1].time);
                expect(eptBool).to.be.equal(true);

                // check data2
                eptItem = await nft.getNFTAuctionItem(_auctionItemId);
                expect(eptItem.bidder).to.be.equal(user.address);
                expect(eptItem.bid).to.be.equal(_amount2);
                expect(eptItem.status).to.be.equal(1)

                // check event
                receipt = await tx2.wait();
                biddingEvent = receipt.events.pop();
                expect(biddingEvent.event).to.be.equal("NFTAuctionItemBidding");
                expect(biddingEvent.eventSignature)
                    .to.be.equal("NFTAuctionItemBidding(uint256,address,address,uint256,address,uint256)");
                amounts = biddingEvent.args;
                expect(amounts._auctionItemId).to.be.equal(_auctionItemId);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token721.address);
                expect(amounts._tokenId).to.be.equal(_id);
                expect(amounts._bidder).to.be.equal(user.address);
                expect(amounts._bid).to.be.equal(_amount2);
            });

            it("bid NFT auction failed", async function() {
                let _auctionItemId = 1;
                let _amount = await nft.getCurrentAuctionPrice(_auctionItemId);
                // caller and owner are the same address
                await expect(nft.bidNFTAuctionItem(_auctionItemId, _amount))
                    .to.be.revertedWith("can not bid own");

                // amount not equal to auction price at first bid
                _amount = 360;
                await expect(nft.connect(user)
                    .bidNFTAuctionItem(_auctionItemId, _amount, {from:user.address}))
                    .to.be.revertedWith("amount not equal to current auction price");

                // amount must > bid(first amount) at second bid
                // first bid
                _amount = await nft.getCurrentAuctionPrice(_auctionItemId);
                await token20.addBalance(user.address, _amount);
                await token20.approveTo(user.address, nft.address, _amount);
                await nft.connect(user).bidNFTAuctionItem(_auctionItemId, _amount, {from:user.address});
                // second bid: bid amount must GT first bid amount
                await token20.addBalance(alice.address, _amount);
                await token20.approveTo(alice.address, nft.address, _amount);
                await token20.approveTo(nft.address, nft.address, _amount);
                await expect(nft.connect(alice)
                    .bidNFTAuctionItem(_auctionItemId, _amount, {from:alice.address}))
                    .to.be.revertedWith("amount less than or equal to last bid");

                // auction is over
                await time.advanceTimeAndBlock(DAY*3);
                await expect(nft.connect(user)
                    .bidNFTAuctionItem(_auctionItemId, _amount, {from:user.address}))
                    .to.be.revertedWith("auction is over");
            });

            it("bid NFT auction failed when auction not started", async function() {
                let _tokenId2 = 2,_startPrice = 480, _reservePrice = 200, _markdownTimeInterval = HOUR;
                let _curTime = await time.latestTime();
                let _auctionStartTime = parseInt(_curTime) + DAY * 1;
                let _auctionEndTime = parseInt(_auctionStartTime) + DAY * 2;

                // need sufficient balance and approve
                await token1155.addBalance(owner.address, _tokenId2, 66);
                await token1155.setApprovalForAll(nft.address, true);

                await nft.listNFTAuctionItem(token1155.address, _tokenId2, _auctionStartTime, _auctionEndTime,
                    _startPrice, _reservePrice, _markdownTimeInterval, token20.address);

                let _auctionItemId = 3;
                await expect(nft.connect(user)
                    .bidNFTAuctionItem(_auctionItemId, _startPrice, {from:user.address}))
                    .to.be.revertedWith("auction not start");
            });

            it("delete auction item", async function() {
                // biddableAuctionItemIds:[1, 2], biddableAuctionItemIdIndex:{1:1, 2:2}
                let eptBiddableAuctionItemIds = await nft.getBiddableAuctionItemIds();
                let eptIndex1 = await nft.biddableAuctionItemIdIndex(1);
                let eptIndex2 = await nft.biddableAuctionItemIdIndex(2);
                expect(eptBiddableAuctionItemIds.length).to.be.equal(2);
                expect(eptBiddableAuctionItemIds[0]).to.be.equal(1);
                expect(eptBiddableAuctionItemIds[1]).to.be.equal(2);
                expect(eptIndex1).to.be.equal(1);
                expect(eptIndex2).to.be.equal(2);
                let eptAuctionItem = await nft.getBiddableAuctionItem(0);
                expect(eptAuctionItem.tokenId).to.be.equal(_tokenId);

                // after delete commodityId 1, biddableAuctionItemIds:[2], biddableAuctionItemIdIndex:{2:1}
                let _commodityId = 1;
                await nft.deleteNFTAuctionItem(_commodityId);
                eptBiddableAuctionItemIds = await nft.getBiddableAuctionItemIds();
                eptIndex2 = await nft.biddableAuctionItemIdIndex(2);
                expect(eptBiddableAuctionItemIds.length).to.be.equal(1);
                expect(eptBiddableAuctionItemIds[0]).to.be.equal(2);
                expect(eptIndex2).to.be.equal(1);

                // after delete commodityId 2, biddableAuctionItemIds:[], biddableAuctionItemIdIndex:{}
                _commodityId = 2;
                await nft.deleteNFTAuctionItem(_commodityId);
                eptBiddableAuctionItemIds = await nft.getBiddableAuctionItemIds();
                expect(eptBiddableAuctionItemIds.length).to.be.equal(0);
            });

            it("deleta auction item failed when not listing", async function() {
                await expect(nft.deleteNFTAuctionItem(3)).to.be.revertedWith("index is zero");
            });

            it("trade NFT auction", async function() {
                let _auctionItemId = 1, _auctionItemId2 = 2;
                // bid
                let _amount = await nft.getCurrentAuctionPrice(_auctionItemId);
                let _amount2 = await nft.getCurrentAuctionPrice(_auctionItemId2);

                await token20.addBalance(user.address, _amount + _amount2);
                await token20.approveTo(user.address, nft.address, _amount + _amount2);
                await nft.connect(user).bidNFTAuctionItem(_auctionItemId, _amount, {from:user.address});
                await nft.connect(user).bidNFTAuctionItem(_auctionItemId2, _amount, {from:user.address});
                // trade, user is the bidder
                let item = await nft.getNFTAuctionItem(_auctionItemId);
                expect(item.status).to.be.equal(1);
                item = await nft.getNFTAuctionItem(_auctionItemId2);
                expect(item.status).to.be.equal(1);

                await time.advanceTimeAndBlock(DAY*3);
                // await token20.approveTo(nft.address, nft.address, _amount);
                let tx = await nft.tradeNFTAuctionItem(_auctionItemId);
                let tx2 = await nft.tradeNFTAuctionItem(_auctionItemId2);

                // check data
                let eptItem = await nft.getNFTAuctionItem(_auctionItemId);
                expect(eptItem.status).to.be.equal(2);
                eptItem = await nft.getNFTAuctionItem(_auctionItemId2);
                expect(eptItem.status).to.be.equal(2);

                // check event
                let receipt = await tx.wait();
                soldEvent = receipt.events.pop();
                expect(soldEvent.event).to.be.equal("NFTAuctionItemSold");
                expect(soldEvent.eventSignature)
                    .to.be.equal("NFTAuctionItemSold(uint256,address,address,uint256,address,uint256)");
                amounts = soldEvent.args;
                expect(amounts._auctionItemId).to.be.equal(_auctionItemId);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token1155.address);
                expect(amounts._tokenId).to.be.equal(_tokenId);
                expect(amounts._bidder).to.be.equal(user.address);
                expect(amounts._bid).to.be.equal(_amount);
                // tx2 event
                receipt = await tx2.wait();
                soldEvent = receipt.events.pop();
                expect(soldEvent.event).to.be.equal("NFTAuctionItemSold");
                expect(soldEvent.eventSignature)
                    .to.be.equal("NFTAuctionItemSold(uint256,address,address,uint256,address,uint256)");
                amounts = soldEvent.args;
                expect(amounts._auctionItemId).to.be.equal(_auctionItemId2);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token721.address);
                expect(amounts._tokenId).to.be.equal(_tokenId2);
                expect(amounts._bidder).to.be.equal(user.address);
                expect(amounts._bid).to.be.equal(_amount);
            });

            it("trade NFT auction when handing fee is zero", async function() {
                await nft.adjustFeeRatio(0);
                let _auctionItemId = 1;
                // bid
                let _amount = await nft.getCurrentAuctionPrice(_auctionItemId);
                await token20.addBalance(user.address, _amount);
                await token20.approveTo(user.address, nft.address, _amount);
                await nft.connect(user).bidNFTAuctionItem(_auctionItemId, _amount, {from:user.address});
                await time.advanceTimeAndBlock(DAY*3); // over the end time.

                await nft.tradeNFTAuctionItem(_auctionItemId);

                // check
                let eptBalanceOfOwner = await token20.balanceOf(owner.address);
                expect(eptBalanceOfOwner).to.be.equal(_amount);
                let eptBalanceOfUser = await token20.balanceOf(user.address);
                expect(eptBalanceOfUser).to.be.equal(0);
            });

            it("trade NFT auction failed when auction not over", async function() {
                let _auctionItemId = 1;
                // bid
                let _amount = await nft.getCurrentAuctionPrice(_auctionItemId);
                await token20.addBalance(user.address, _amount);
                await token20.approveTo(user.address, nft.address, _amount);
                await nft.connect(user).bidNFTAuctionItem(_auctionItemId, _amount, {from:user.address});
                // auction not over
                await expect(nft.tradeNFTAuctionItem(_auctionItemId))
                    .to.be.revertedWith("auction not over");
            });

            it("trade NFT auction failed when not in bidding status", async function(){
                let _auctionItemId = 1;
                // not in bidding status
                await time.advanceTimeAndBlock(DAY*3);
                await expect(nft.tradeNFTAuctionItem(_auctionItemId))
                    .to.be.revertedWith("not in bidding status");
            });

            it("auction unlisted", async function() {
                let _auctionItemId = 1, _auctionItemId2 = 2;
                let tx = await nft.unListNFTAuctionItem(_auctionItemId);
                let tx2 = await nft.unListNFTAuctionItem(_auctionItemId2);
                // check data
                let eptItem = await nft.getNFTAuctionItem(_auctionItemId);
                expect(eptItem.status).to.be.equal(3);
                eptItem = await nft.getNFTAuctionItem(_auctionItemId2);
                expect(eptItem.status).to.be.equal(3);
                // check event
                let receipt = await tx.wait();
                unlistEvent = receipt.events.pop();
                expect(unlistEvent.event).to.be.equal("NFTAuctionItemUnListed");
                expect(unlistEvent.eventSignature)
                    .to.be.equal("NFTAuctionItemUnListed(uint256,address,address,uint256)");
                amounts = unlistEvent.args;
                expect(amounts._auctionItemId).to.be.equal(_auctionItemId);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token1155.address);
                expect(amounts._tokenId).to.be.equal(_tokenId);
                // tx2 event
                receipt = await tx2.wait();
                unlistEvent = receipt.events.pop();
                expect(unlistEvent.event).to.be.equal("NFTAuctionItemUnListed");
                expect(unlistEvent.eventSignature)
                    .to.be.equal("NFTAuctionItemUnListed(uint256,address,address,uint256)");
                amounts = unlistEvent.args;
                expect(amounts._auctionItemId).to.be.equal(_auctionItemId2);
                expect(amounts._owner).to.be.equal(owner.address);
                expect(amounts._tokenAddress).to.be.equal(token721.address);
                expect(amounts._tokenId).to.be.equal(_tokenId2);
            });

            it("auction unlisted failed", async function() {
                let _auctionItemId = 1;
                // not owner
                await expect(nft.connect(user)
                    .unListNFTAuctionItem(_auctionItemId, {from:user.address}))
                    .to.be.revertedWith("you are not the owner");
                // not in listed status
                // bid
                let _amount = await nft.getCurrentAuctionPrice(_auctionItemId);
                await token20.addBalance(user.address, _amount);
                await token20.approveTo(user.address, nft.address, _amount);
                await nft.connect(user).bidNFTAuctionItem(_auctionItemId, _amount, {from:user.address});
                await expect(nft.unListNFTAuctionItem(_auctionItemId))
                    .to.be.revertedWith("not in listed status");
            });

            it("get current auction price", async function() {
                let _auctionItemId = 1;
                // auctionDuration: DAY * 2, MarkdownInterval: HOUR
                // totalMarkdownTimes: 47, everyPriceMarkdown: (480-200)/47=5
                // currentAuctionPrice: 480-(5*12) = 420
                await time.advanceTimeAndBlock(HOUR * 12);
                let eptPrice = await nft.getCurrentAuctionPrice(_auctionItemId);
                expect(eptPrice).to.be.equal(420);
                await time.advanceTimeAndBlock(DAY * 2);
                eptPrice = await nft.getCurrentAuctionPrice(_auctionItemId);
                expect(eptPrice).to.be.equal(_reservePrice);
            });
        });

        it("set isAllowFragmentsList", async function() {
            let isAllowFragmentsList = await nft.getIsAllowFragmentsList();
            await nft.setIsAllowFragmentsList(!isAllowFragmentsList);
            let eptIsAllowFragmentsList = await nft.getIsAllowFragmentsList();
            expect(eptIsAllowFragmentsList).to.be.equal(!isAllowFragmentsList);
        });

        it("set isAllowFragmentsList failed when caller is not owner", async function() {
            await expect(nft.connect(user)
                .setIsAllowFragmentsList(true, {from:user.address}))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});
