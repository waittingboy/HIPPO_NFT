// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/IERC1155MetadataURIUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "../interfaces/IUserTokens.sol";
import "../interfaces/INFTFactory.sol";
import "../interfaces/IContract.sol";

contract UserTokens is OwnableUpgradeable, IUserTokens {
    // Mapping from address to is internal caller or not
    mapping(address => bool) public isInternalCaller;

    // Internal NFT token instance
    INFTFactory public internalToken;

    // NFT token instance
    IContract public token;

    struct TokenInfo {
        // user token id array
        uint256[] tokenIds;
        // mapping from token id to index
        mapping(uint256 => uint256) tokenIdIndex;
    }

    // User token contract address array
    address[] internal tokenContracts;
    // Mapping from token contract address to is exist or not
    mapping(address => bool) internal isTokenContractExist;

    // Mapping from user address to contract address to user token info
    mapping(address => mapping(address => TokenInfo)) internal userTokenInfo;

    // Restrict internal call
    modifier onlyInternal() {
        require(
            isInternalCaller[_msgSender()],
            "caller is not a internal caller"
        );
        _;
    }

    function initialize(
        INFTFactory _internalToken,
        IContract _token,
        address _mysteryBoxMarket,
        address _nftExchangeMarket,
        address _nftAuctionMarket
    ) public initializer {
        __Ownable_init();

        internalToken = _internalToken;
        token = _token;
        isInternalCaller[address(_internalToken)] = true;
        isInternalCaller[_mysteryBoxMarket] = true;
        isInternalCaller[_nftExchangeMarket] = true;
        isInternalCaller[_nftAuctionMarket] = true;
    }

    // set internal call address
    function setInternalCaller(address _internal, bool _set) public onlyOwner {
        isInternalCaller[_internal] = _set;
    }

    /**
     * @dev Add user token id
     *
     * Requirements:
     * - token address must be erc721 or erc1155 contract address
     */
    function addUserTokenId(address _userAddress, address _tokenAddress, uint256 _tokenId)
        external
        override
        onlyInternal
    {
        require(token.isERC721(_tokenAddress) || token.isERC1155(_tokenAddress), "not erc721 or erc1155 contract address");

        TokenInfo storage tokenInfo = userTokenInfo[_userAddress][_tokenAddress];

        if (tokenInfo.tokenIdIndex[_tokenId] == 0) {
            tokenInfo.tokenIds.push(_tokenId);
            tokenInfo.tokenIdIndex[_tokenId] = tokenInfo.tokenIds.length;
        }
        if (!isTokenContractExist[_tokenAddress]) {
            tokenContracts.push(_tokenAddress);
            isTokenContractExist[_tokenAddress] = true;
        }
    }

    /**
     * @dev Delete user token id
     */
    function deleteUserTokenId(address _userAddress, address _tokenAddress, uint256 _tokenId)
        external
        override
        onlyInternal
    {
        TokenInfo storage tokenInfo = userTokenInfo[_userAddress][_tokenAddress];

        uint256 lastTokenId = tokenInfo.tokenIds[tokenInfo.tokenIds.length - 1];
        tokenInfo.tokenIds[tokenInfo.tokenIdIndex[_tokenId] - 1] = lastTokenId;
        tokenInfo.tokenIdIndex[lastTokenId] = tokenInfo.tokenIdIndex[_tokenId];
        delete tokenInfo.tokenIds[tokenInfo.tokenIds.length - 1];
        delete tokenInfo.tokenIdIndex[_tokenId];
        tokenInfo.tokenIds.pop();
    }

    function getTokenContractQuantity() public view returns (uint) {
        return tokenContracts.length;
    }

    function getTokenContractAddress(uint _index) public view returns (address) {
        return tokenContracts[_index];
    }

    function getUserTokenLengthOfTokenContract(address _userAddress, address _tokenAddress) public view returns (uint256) {
        return userTokenInfo[_userAddress][_tokenAddress].tokenIds.length;
    }

    function getUserTokenInfoOfTokenContract(address _userAddress, address _tokenAddress, uint256 _index)
        public
        view
        returns (
            uint256 tokenId,
            string memory uri,
            uint256 tokenIndex,
            bool isFragment,
            uint256 balance
        )
    {
        tokenId = userTokenInfo[_userAddress][_tokenAddress].tokenIds[_index];

        if (token.isERC721(_tokenAddress)) {
            IERC721MetadataUpgradeable token721Metadata = IERC721MetadataUpgradeable(_tokenAddress);
            uri = token721Metadata.tokenURI(tokenId);
            tokenIndex = 0;
            isFragment = false;
            balance = 1;
        } else if (token.isERC1155(_tokenAddress)) {
            IERC1155MetadataURIUpgradeable token1155Metadata = IERC1155MetadataURIUpgradeable(_tokenAddress);
            IERC1155Upgradeable token1155 = IERC1155Upgradeable(_tokenAddress);
            uri = token1155Metadata.uri(tokenId);
            if (_tokenAddress == address(internalToken)) {
                (, , , uint256 _tokenIndex, bool _isFragment) = internalToken.getTokenInfo(tokenId);
                tokenIndex = _tokenIndex;
                isFragment = _isFragment;
            } else {
                tokenIndex = 0;
                isFragment = false;
            }
            balance = token1155.balanceOf(_userAddress, tokenId);
        }
    }
}
