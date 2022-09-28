import "hardhat/console.sol";
import "../NFTDepositBox.sol";

contract NFTDepositBoxMock is NFTDepositBox {
    constructor() {
    }

    function getOwnerNfts(address _owner) public view returns(uint256[] memory ids) {
        uint _len = nftsOfOwner[_owner].length;
        ids = new uint256[](_len);
        ids = nftsOfOwner[_owner];
    }

    function modifyNFTAmountZero(uint256 _nftId) public {
        NFT storage nft = allNFTs[_nftId];
        nft.amount = 0;
    }
}
