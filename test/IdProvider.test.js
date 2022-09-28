const {ethers} = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { time } = require("./utilities")


let owner, user, alice, bob;
let ip;

describe("IdProvider test", async function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        owner = this.signers[0];
        user = this.signers[1];
        alice = this.signers[2];
        bob = this.signers[3];

        this.IdProvider = await ethers.getContractFactory("IdProvider");
    });

    beforeEach(async function() {
        ip = await this.IdProvider.deploy();
        await ip.deployed();
    });

    it("initialize", async function() {
        await ip.initialize(owner.address, user.address);
        expect(await ip.base()).to.be.equal(owner.address);
        expect(await ip.externalBase()).to.be.equal(user.address);
    });

    describe("IdProvider func test", async function() {

        beforeEach("",async function() {
            await ip.initialize(owner.address, user.address);
            await ip.setInternalCaller(alice.address, true);
            expect(await ip.internalCaller(alice.address)).to.be.equal(true);
        });

        it("create new collection id", async function() {
            // owner will get odd collection id, user will get even collection id
            // owner
            await ip.createNewCollectionId(); // 1
            expect(await ip.baseCollectionId()).to.be.equal(1); // 0*1 + 1
            await ip.createNewCollectionId(); // 2
            expect(await ip.baseCollectionId()).to.be.equal(2); // 2*1 + 1

            // user
            await ip.connect(user).createNewCollectionId({from:user.address}); // 1*2
            expect(await ip.externalBaseCollectionId()).to.be.equal(1);
            await ip.connect(user).createNewCollectionId({from:user.address}); // 2*2
            expect(await ip.externalBaseCollectionId()).to.be.equal(2);
        });

        it("create new collection id failed", async function() {
            await expect(ip.connect(bob).createNewCollectionId({from:bob.address}))
                .to.be.revertedWith("IdProvider: caller is not a internal caller")
        });

        it("create work id", async function() {
            await ip.createNewWorkId();
            expect(await ip.curWorkId()).to.be.equal(1);
            await ip.createNewWorkId();
            await ip.createNewWorkId();
            expect(await ip.curWorkId()).to.be.equal(3);
            await ip.createNewWorkId();
            expect(await ip.curWorkId()).to.be.equal(4);
            await ip.createNewWorkId();
            await ip.createNewWorkId();
            expect(await ip.curWorkId()).to.be.equal(6);
        });

        it("create new work id failed", async function() {
            await expect(ip.connect(bob).createNewWorkId({from:bob.address}))
                .to.be.revertedWith("IdProvider: caller is not a internal caller")
        });
    });
});
