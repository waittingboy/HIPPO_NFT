const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { ADDRESS_ZERO } = require("./utilities");

let owner, user, alice;
let nft, ctrt;

describe("NFT Factory func", async function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];

        this.NFT = await ethers.getContractFactory("NFTFactoryMock");
        
        this.Contract = await ethers.getContractFactory("Contract");
    });

    beforeEach(async function() {
        nft = await this.NFT.deploy();
        await nft.deployed();

        ctrt = await this.Contract.deploy();
        await ctrt.deployed();
    });

    it("initialize", async function() {
        await nft.initialize(user.address);
        let eptMBGAddr = await nft.MBGovernanceAddress();
        expect(eptMBGAddr).to.be.equal(user.address);
    
    });

    describe("NFT Factory test", async function() {
        let originId;
        let fragmentIds = [];
        beforeEach("", async function() {
            await nft.initialize( owner.address);
        });

        it("mint", async function() {
            let _mBoxMarketAddr = alice.address, _uri = "testUri";
            let _nFullCopies = 1, _nSFullcopies = 2, _nFragments = 3;
            // before
            let idBefore = await nft.id();

    
            let tx = await nft.mint(_mBoxMarketAddr, _uri,
                _nFullCopies, _nSFullcopies, _nFragments);

            // After
            let idAfter = await nft.id();
            expect(idAfter).to.be.equal(parseInt(idBefore) + 1);

            // check work
            originId = BigNumber.from(2).pow(128).mul(idAfter);
            expect(await nft.balanceOf(alice.address, originId)).to.be.equal(_nFullCopies);
            let eptWork = await nft.originIdToWork(originId);
            expect(eptWork.uri).to.be.equal(_uri);
            expect(await nft.uri(originId)).to.be.equal(_uri);
            expect(eptWork.numFragments).to.be.equal(_nFragments);

            // check fragmentIds
            let eptFragmentIds = [1,1,1];//length equal to _nFragments
            for(i = 0; i < _nFragments; i++) {
                let fragmentId = BigNumber.from(i + 1).add(originId);
                fragmentIds.push(fragmentId);
                eptFragmentIds[i] = fragmentId;
                let eptIsFragment = await nft.isFragment(fragmentId);
                expect(eptIsFragment).to.be.equal(true);
                expect(await nft.balanceOf(alice.address, fragmentId)).to.be.equal(_nSFullcopies);
            }

            // check event
            let receipt = await tx.wait();
            let mintEvent = receipt.events.pop();
            expect(mintEvent.event).to.be.equal("NFTMinted");
            expect(mintEvent.eventSignature)
                .to.be.equal("NFTMinted(uint256,uint256[],uint256,uint256,uint256)");
            let amounts = mintEvent.args;
            expect(amounts._originId).to.be.equal(originId);
            // TODO: array in event, not test
            // expect(amounts._fragmentIds.length).to.be.equal(_nFragments);
            // for(i = 0; i < _nFragments; i++) {
                // expect(amounts._fragmentIds[i]).to.be.equal(eptFragmentIds[i])
            // }
            expect(amounts._numFullCopies).to.be.equal(_nFullCopies);
            expect(amounts._numSplitFullCopies).to.be.equal(_nSFullcopies);
            expect(amounts._numFragments).to.be.equal(_nFragments);

            _nFullCopies = 0
            await nft.mint(_mBoxMarketAddr, _uri,
                _nFullCopies, _nSFullcopies, _nFragments);
            idAfter = await nft.id();
            expect(idAfter).to.be.equal(parseInt(idBefore) + 2);
            let originId2 = BigNumber.from(2).pow(128).mul(idAfter);
            expect(await nft.balanceOf(alice.address, originId2)).to.be.equal(_nFullCopies);
            
        });

        it("mint failed when caller is not governance address", async function() {
            let _mBoxMarketAddr = alice.address, _uri = "testUri";
            let _nFullCopies = 1, _nSFullcopies = 2, _nFragments = 3;
            await expect(nft.connect(user).mint(_mBoxMarketAddr, _uri,
                _nFullCopies, _nSFullcopies, _nFragments, {from:user.address}))
                .to.be.revertedWith("only MB governance contract authorized");
        });

        describe("After mint fragments", async function() {
            let _uri = "testUri", _nFullCopies = 1, _nSFullcopies = 2, _nFragments = 3;
            beforeEach("", async function() {
                // mint
                await nft.mint(owner.address, _uri, _nFullCopies, _nSFullcopies, _nFragments);
            });

            it("merge", async function() {
                
                // let originId = BigNumber.from(2).pow(128).mul(1);

                // for(i = 0; i < _nFragments; i++) {
                //     let fragmentId = BigNumber.from(i + 1).add(originId);
                
                // }

                let originId = BigNumber.from(2).pow(128).mul(1);
                let fragmentId = BigNumber.from(1).add(originId);
                
                let _balance = await nft.balanceOf(owner.address, originId);
                expect(_balance).to.be.equal(1);

                // merge
                let _quantity = 2;
                let tx = await nft.merge(originId, _quantity);
                _balance = await nft.balanceOf(owner.address, originId);
                expect(_balance).to.be.equal(3);

                // check event
                let receipt = await tx.wait();
                let mergeEvent = receipt.events.pop();
                expect(mergeEvent.event).to.be.equal("NFTMerged");
                expect(mergeEvent.eventSignature)
                    .to.be.equal("NFTMerged(uint256,uint256)");
                let amounts = mergeEvent.args;
                expect(amounts._originId).to.be.equal(originId);
                expect(amounts._quantity).to.be.equal(_quantity);
            });

            it("merge failed", async function() {
                // quantity must GT 0
                await expect(nft.merge(originId, 0)).to.be.revertedWith("quantity is zero");
                // all (msgSender, fragmentId)'s balance must GT _quantity
                let _quantity = 3;
                // need balance >= _quantity
                for(i = 0; i < fragmentIds.length - 1; i++) {
                    await nft.addBalance(owner.address, fragmentIds[i], _quantity);
                }
                await expect(nft.merge(originId, _quantity))
                    .to.be.revertedWith("you have not collected all required fragments");
            });

            it("transfer", async function() {
                
                // let originId = BigNumber.from(2).pow(128).mul(1);
                

                // let fragmentId = 0;
                // for(i = 0; i < _nFragments; i++) {
                //     fragmentId = BigNumber.from(i + 1).add(originId);
                // }

                let originId = BigNumber.from(2).pow(128).mul(1);
                let fragmentId = BigNumber.from(1).add(originId);
                // owner.address
                let _balance = await nft.balanceOf(owner.address, fragmentId);
                expect(_balance).to.be.equal(2);
                // alice.address, has nothing.
                _balance = await nft.balanceOf(alice.address, fragmentId);
                expect(_balance).to.be.equal(0);

                await nft.safeTransferFrom(owner.address, alice.address, fragmentId, 1, 0x00);
                // owner.address
                _balance = await nft.balanceOf(owner.address, fragmentId);  // minus 1
                expect(_balance).to.be.equal(1);
                // alice.address
            
                _balance = await nft.balanceOf(alice.address, fragmentId);  // add 1
                expect(_balance).to.be.equal(1);

                await nft.safeTransferFrom(owner.address, alice.address, fragmentId, 1, 0x00);
                // owner.address
                
                _balance = await nft.balanceOf(owner.address, fragmentId);  // minus 1
                expect(_balance).to.be.equal(0);
                // alice.address
                
                _balance = await nft.balanceOf(alice.address, fragmentId);  // add 1
                expect(_balance).to.be.equal(2);
            });

            it("batch transfer", async function() {
                
                // let originId = BigNumber.from(2).pow(128).mul(1);

                // let fragmentId = 0;
                // for(i = 0; i < _nFragments; i++) {
                //     fragmentId = BigNumber.from(i + 1).add(originId);
                
                // }

                let originId = BigNumber.from(2).pow(128).mul(1);
                let fragmentId = BigNumber.from(1).add(originId);
                // owner.address
            
                let _balance = await nft.balanceOf(owner.address, originId);
                expect(_balance).to.be.equal(1);
                _balance = await nft.balanceOf(owner.address, fragmentId);
                expect(_balance).to.be.equal(2);
                
                _balance = await nft.balanceOf(alice.address, originId);
                expect(_balance).to.be.equal(0);
                _balance = await nft.balanceOf(alice.address, fragmentId);
                expect(_balance).to.be.equal(0);

                await nft.safeBatchTransferFrom(owner.address, alice.address, [originId, fragmentId], [1, 1], 0x00);
                // owner.address
                _balance = await nft.balanceOf(owner.address, originId);  // all transfered.
                expect(_balance).to.be.equal(0);
                _balance = await nft.balanceOf(owner.address, fragmentId);  // minus 1
                expect(_balance).to.be.equal(1);
                // alice.address
                _balance = await nft.balanceOf(alice.address, originId); // add 1
                expect(_balance).to.be.equal(1);
                _balance = await nft.balanceOf(alice.address, fragmentId);  // add 1
                expect(_balance).to.be.equal(1);
            });

            it("verify if it is fragment", async function() {
                let eptBool = await nft.getIsFragment(fragmentIds[0]);
                expect(eptBool).to.be.equal(true);
                eptBool = await nft.getIsFragment(fragmentIds[1]);
                expect(eptBool).to.be.equal(true);
                eptBool = await nft.getIsFragment(fragmentIds[2]);
                expect(eptBool).to.be.equal(true);

                eptBool = await nft.getIsFragment(originId);
                expect(eptBool).to.be.equal(false);
            });

            it("get token info", async function() {
                let _id = BigNumber.from(2).pow(128).mul(1);
                let eptRet = await nft.getTokenInfo(_id);
                expect(eptRet[0]).to.be.equal(_id);
                expect(eptRet[1]).to.be.equal(_uri);
                expect(eptRet[2]).to.be.equal(_nFragments)
                expect(eptRet[3]).to.be.equal(0)
                expect(eptRet[4]).to.be.equal(false)

                // let _id1 = BigNumber.from(1).add(_id);
                eptRet = await nft.getTokenInfo(fragmentIds[0]);
                expect(eptRet[0]).to.be.equal(_id);
                expect(eptRet[1]).to.be.equal(_uri);
                expect(eptRet[2]).to.be.equal(_nFragments)
                expect(eptRet[3]).to.be.equal(1)
                expect(eptRet[4]).to.be.equal(true)

                // let _id2 = BigNumber.from(2).add(_id);
                eptRet = await nft.getTokenInfo(fragmentIds[1]);
                expect(eptRet[0]).to.be.equal(_id);
                expect(eptRet[1]).to.be.equal(_uri);
                expect(eptRet[2]).to.be.equal(_nFragments)
                expect(eptRet[3]).to.be.equal(2)
                expect(eptRet[4]).to.be.equal(true)

                // let _id3 = BigNumber.from(3).add(_id);
                eptRet = await nft.getTokenInfo(fragmentIds[2]);
                expect(eptRet[0]).to.be.equal(_id);
                expect(eptRet[1]).to.be.equal(_uri);
                expect(eptRet[2]).to.be.equal(_nFragments)
                expect(eptRet[3]).to.be.equal(3)
                expect(eptRet[4]).to.be.equal(true)
            });
        });
    });
});
