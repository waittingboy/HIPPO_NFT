pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

contract Token1155Mock is ERC1155Upgradeable {
    constructor(){
    }

    function setURI(string memory uri) public {
        _setURI(uri);
    }

    function mint(address to, uint256 id, uint256 amount) public {
        _mint(to, id, amount, "");
    }
    
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts) public {
        _mintBatch(to,ids,amounts,"");
    }
}
