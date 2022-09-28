const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { ADDRESS_ZERO } = require("./utilities");

let owner, user, alice, bob;
let token20, token721, token1155, erc1155, utoken, ctrt;

describe("User Tokens func", async function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];
        bob = this.signers[3];

        this.TOKEN1155 = await ethers.getContractFactory("NFTFactoryMock");
        this.ERC1155 = await ethers.getContractFactory("Token1155Mock");
        this.UserToken = await ethers.getContractFactory("UserTokensMock");
        this.Contract = await ethers.getContractFactory("Contract");
        this.ERC20 = await ethers.getContractFactory("Token20Mock");
        this.ERC721 = await ethers.getContractFactory("Token721Mock");
    });

    beforeEach(async function() {
        token1155 = await this.TOKEN1155.deploy()
        await token1155.deployed();

        utoken = await this.UserToken.deploy();
        await utoken.deployed();

        ctrt = await this.Contract.deploy();
        await ctrt.deployed();

        token20 = await this.ERC20.deploy();
        await token20.deployed();

        token721 = await this.ERC721.deploy();
        await token721.deployed();

        erc1155 = await this.ERC1155.deploy();
        await erc1155.deployed();
    });

    it("initialize", async function() {
        await utoken.initialize(token1155.address, ctrt.address, owner.address, user.address, alice.address);
        let eptToken1155 = await utoken.internalToken();
        let eptToken = await utoken.token();
        expect(eptToken1155).to.be.equal(token1155.address);
        expect(eptToken).to.be.equal(ctrt.address);
        expect(await utoken.isInternalCaller(token1155.address)).to.be.equal(true)
        expect(await utoken.isInternalCaller(owner.address)).to.be.equal(true)
        expect(await utoken.isInternalCaller(user.address)).to.be.equal(true)
        expect(await utoken.isInternalCaller(alice.address)).to.be.equal(true)
    });

    describe("User Tokens test", async function() {
        beforeEach("", async function() {
            await utoken.initialize(token1155.address, ctrt.address, owner.address, user.address, alice.address);
            await token1155.initialize(utoken.address, owner.address);
        });

        it("set internal caller", async function() {
            let eptBool = await utoken.isInternalCaller(bob.address);
            expect(eptBool).to.be.equal(false);
            await utoken.setInternalCaller(bob.address, true);
            eptBool = await utoken.isInternalCaller(bob.address);
            expect(eptBool).to.be.equal(true);
        });

        it("set internal caller failed", async function() {
            await expect(utoken.connect(user)
                .setInternalCaller(owner.address, true, {from:user.address}))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("add user token id", async function() {
            let _tokenId = 1;
            let tokenIdsLenBefore = await utoken.getUserTokenLengthOfTokenContract(user.address, token1155.address);
            let tokenIdIndex = await utoken.getTokenIdIndex(user.address, token1155.address, _tokenId);
            let _bool = await utoken.isExist(user.address, token1155.address, _tokenId);
            let token_nums = await utoken.getTokenContractQuantity();
            expect(tokenIdsLenBefore).to.be.equal(0);
            expect(tokenIdIndex).to.be.equal(0);
            expect(_bool).to.be.equal(false);
            expect(token_nums).to.be.equal(0);

            await utoken.addUserTokenId(user.address, token1155.address, _tokenId);

            let tokenIds = await utoken.getTokenIds(user.address, token1155.address);
            tokenIdIndex = await utoken.getTokenIdIndex(user.address, token1155.address, _tokenId);
            _bool = await utoken.isExist(user.address, token1155.address, _tokenId);
            token_nums = await utoken.getTokenContractQuantity();
            let token_addr = await utoken.getTokenContractAddress(0);
            expect(tokenIds.length).to.be.equal(parseInt(tokenIdsLenBefore) + 1);
            expect(tokenIds[0]).to.be.equal(_tokenId);
            expect(tokenIdIndex).to.be.equal(1);
            expect(_bool).to.be.equal(true);
            expect(token_nums).to.be.equal(1);
            expect(token_addr).to.be.equal(token1155.address);

            // add again, nothing happen
            await utoken.addUserTokenId(user.address, token1155.address, _tokenId);
            tokenIds = await utoken.getTokenIds(user.address, token1155.address);
            tokenIdIndex = await utoken.getTokenIdIndex(user.address, token1155.address, _tokenId);
            _bool = await utoken.isExist(user.address, token1155.address, _tokenId);
            token_nums = await utoken.getTokenContractQuantity();
            token_addr = await utoken.getTokenContractAddress(0);
            expect(tokenIds.length).to.be.equal(parseInt(tokenIdsLenBefore) + 1);
            expect(tokenIds[0]).to.be.equal(_tokenId);
            expect(tokenIdIndex).to.be.equal(1);
            expect(_bool).to.be.equal(true);
            expect(token_nums).to.be.equal(1);
            expect(token_addr).to.be.equal(token1155.address);
        });

        it("add user token id failed", async function() {
            // not internal caller.
            await expect(utoken.connect(bob).addUserTokenId(user.address, token1155.address, 1, {from:bob.address}))
                .to.be.revertedWith("caller is not a internal caller");

            // TODO: can not test
            await expect(utoken.addUserTokenId(user.address, token20.address, 1))
                .to.be.revertedWith("not erc721 or erc1155 contract address");
        });

        it("delete user token id", async function() {
            let _tokenIds = [1, 2];
            await utoken.addUserTokenId(user.address, token1155.address, _tokenIds[0]);
            await utoken.addUserTokenId(user.address, token1155.address, _tokenIds[1]);
            // tokenIds: [1, 2]
            let tokenIdsLen = await utoken.getUserTokenLengthOfTokenContract(user.address, token1155.address);
            let _index1 = await utoken.getTokenIdIndex(user.address, token1155.address, _tokenIds[0]);
            let _index2 = await utoken.getTokenIdIndex(user.address, token1155.address, _tokenIds[1]);
            let _bool1 = await utoken.isExist(user.address, token1155.address, _tokenIds[0]);
            let _bool2 = await utoken.isExist(user.address, token1155.address, _tokenIds[1]);
            let token_nums = await utoken.getTokenContractQuantity();
            let token_addr = await utoken.getTokenContractAddress(0);

            expect(tokenIdsLen).to.be.equal(_tokenIds.length);
            expect(_index1).to.be.equal(1);
            expect(_index2).to.be.equal(2);
            expect(_bool1).to.be.equal(true);
            expect(_bool2).to.be.equal(true);
            expect(token_nums).to.be.equal(1);
            expect(token_addr).to.be.equal(token1155.address);

            // delete 1, tokenIds[2], tokenIdIndex: 1
            await utoken.deleteUserTokenId(user.address, token1155.address, _tokenIds[0]);
            let tokenIds = await utoken.getTokenIds(user.address, token1155.address);
            _index1 = await utoken.getTokenIdIndex(user.address, token1155.address,  _tokenIds[0]);
            _index2 = await utoken.getTokenIdIndex(user.address, token1155.address, _tokenIds[1]);
            _bool1 = await utoken.isExist(user.address, token1155.address, _tokenIds[0]);
            _bool2 = await utoken.isExist(user.address, token1155.address, _tokenIds[1]);
            token_nums = await utoken.getTokenContractQuantity();
            token_addr = await utoken.getTokenContractAddress(0);

            expect(tokenIds.length).to.be.equal(parseInt(tokenIdsLen) - 1); // delete 1, minus 1
            expect(tokenIds[0]).to.be.equal(_tokenIds[1]); // delete _tokenIds[0], left _tokenIds[1]
            expect(_index1).to.be.equal(0);
            expect(_index2).to.be.equal(1); // tokenId 2's index change to 1
            expect(_bool1).to.be.equal(false);
            expect(_bool2).to.be.equal(true);
            expect(token_nums).to.be.equal(1);
            expect(token_addr).to.be.equal(token1155.address);
        });

        it("delete user token id failed", async function() {
            await expect(utoken.connect(bob).deleteUserTokenId(user.address, token1155.address, 1, {from:bob.address}))
                .to.be.revertedWith("caller is not a internal caller");
        });

        it("get user token info", async function() {
            let _uri = "testUri", _nFullCopies = 10, _nSFullCopies = 12, _nFragments = 10;
            await token1155.mint(user.address, _uri,
                _nFullCopies, _nSFullCopies, _nFragments);

            // id start by 1.
            let originId = BigNumber.from(2).pow(128).mul(1);
            let fragmentId = BigNumber.from(1).add(originId);

            // check
            let eptRet = await utoken.getUserTokenInfoOfTokenContract(user.address, token1155.address, 0);
            expect(eptRet[0]).to.be.equal(fragmentId);
            expect(eptRet[1]).to.be.equal(_uri);
            expect(eptRet[2]).to.be.equal(1); // the first fragment, index is 1
            expect(eptRet[3]).to.be.equal(true);
            expect(eptRet[4]).to.be.equal(_nSFullCopies);

            // the last one is OriginId
            eptRet = await utoken.getUserTokenInfoOfTokenContract(user.address, token1155.address, 10);
            expect(eptRet[0]).to.be.equal(originId);
            expect(eptRet[1]).to.be.equal(_uri);
            expect(eptRet[2]).to.be.equal(0);  // the origin, index is 0
            expect(eptRet[3]).to.be.equal(false);
            expect(eptRet[4]).to.be.equal(_nFullCopies);

            // TODO: not test ERC721 and not internalToken branches.
            // test ERC721
            await token721.myMint(user.address, 1);
            await utoken.addUserTokenId(user.address, token721.address, 1);
            eptRet = await utoken.getUserTokenInfoOfTokenContract(user.address, token721.address, 0);
            expect(eptRet[0]).to.be.equal(1);
            expect(eptRet[1]).to.be.equal("");
            expect(eptRet[2]).to.be.equal(0);
            expect(eptRet[3]).to.be.equal(false);
            expect(eptRet[4]).to.be.equal(1);
            // test not internalToken situation
            await erc1155.setURI(_uri);
            await erc1155.mint(user.address, 1, _nFullCopies);
            await utoken.addUserTokenId(user.address, erc1155.address, 1);
            eptRet = await utoken.getUserTokenInfoOfTokenContract(user.address, erc1155.address, 0);
            expect(eptRet[0]).to.be.equal(1);
            expect(eptRet[1]).to.be.equal(_uri);
            expect(eptRet[2]).to.be.equal(0);
            expect(eptRet[3]).to.be.equal(false);
            expect(eptRet[4]).to.be.equal(_nFullCopies);
        });
    });
});
