// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

interface INFTFactory is IERC1155Upgradeable {
    function mint(address _mysteryBoxMarketAddress,string memory _uri, uint _numFullCopies, uint _numSplitFullCopies, uint _numFragments) external returns(uint, uint[] memory);
    function getTokenInfo(uint _tokenId) external view returns (uint, string memory, uint, uint, bool);
    function getIsFragment(uint _tokenId) external view returns (bool);
}

