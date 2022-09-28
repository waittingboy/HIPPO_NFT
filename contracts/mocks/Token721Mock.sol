pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract Token721Mock is ERC721Upgradeable {
    constructor(){
    }

    function myMint(address to, uint256 tokenId) public {
        _safeMint(to, tokenId);
    }
}
