// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "../lib/UserTokens.sol";

contract UserTokensMock is UserTokens {

    function getTokenIds(address _addr, address _token) public view returns(uint[] memory) {
        uint _len = getUserTokenLengthOfTokenContract(_addr, _token);
        uint[] memory _tokenIds = new uint[](_len);
        _tokenIds = userTokenInfo[_addr][_token].tokenIds;
        return _tokenIds;
    }

    function getTokenIdIndex(address _addr, address _token, uint _tokenId) public view returns(uint) {
        return userTokenInfo[_addr][_token].tokenIdIndex[_tokenId];
    }

    function isExist(address _addr, address _token, uint _tokenId) public view returns(bool) {
        return userTokenInfo[_addr][_token].tokenIdIndex[_tokenId] != 0;
    }
}
