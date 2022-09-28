// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./lib/ERC20Tokens.sol";
import "./interfaces/IContract.sol";
import "./interfaces/IUserTokens.sol";

contract NFTExchangeMarket is ERC721HolderUpgradeable, ERC1155HolderUpgradeable, ERC20Tokens {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using SafeMathUpgradeable for uint;

    // NFT token instance
    IContract public token;

    // User tokens instance
    IUserTokens public userTokens;

    // Handling fee transfer to this account
    address payable public handlingFeeAccount;

    uint private handlingFeeRatio;

    // Used to enumerate NFTCommodity's status
    enum NFTCommodityStatus {
        ONSHELF,
        SOLD,
        OFFSHELF
    }

    // Used to store NFTCommodity's info
    struct NFTCommodity {
        uint commodityId;
        address payable owner;
        address tokenAddress;
        uint[] tokenIds;
        uint[] tokenQuantities;
        uint price;
        address token20Address;
        NFTCommodityStatus status;
        address buyer;
    }

    // Id if NFTCommodity, start from 1
    uint private commodityId;
    // Mapping from commodity id to commodity
    mapping(uint => NFTCommodity) private commodityIdOfCommodity;
    // Mapping from seller to the commodity ids which he sold
    mapping(address => uint[]) private sellerCommodityIds;

    // OnShelf commodity ids
    uint[] private onShelfCommodityIds;
    mapping(uint => uint) private onShelfCommodityIdIndex;

    // Mapping from nft token id to commodity ids which the auction item contains it
    mapping(uint => uint[]) private tokenIdOfCommodityIds;

    // Mapping from buyer to commodity ids which he purchased
    mapping(address => uint[]) private buyerCommodityIds;

    function initialize(IContract _token, IUserTokens _userTokens, address payable _handlingFeeAccount, address[] memory _token20sAddress) public initializer {
        __ERC1155Holder_init();
        __ERC20Tokens_init(_token20sAddress);

        require(_handlingFeeAccount != address(0), "account is zero address");

        token = _token;
        userTokens = _userTokens;
        handlingFeeAccount = _handlingFeeAccount;
        handlingFeeRatio = 200;
    }

    /*
     * Emitted when owner's 'quantities' NFTs of type 'tokenIds' sale at 'price'
     */
    event NFTCommodityOnShelf(uint indexed _commodityId, address indexed _owner, address _tokenAddress, uint[] _tokenIds, uint[] _tokenQuantities, uint _price);
    /*
     * Emitted when owner's 'quantities' NFTs of type 'tokenIds' sold at 'price'
     */
    event NFTCommoditySold(uint indexed _commodityId, address indexed _owner, address _tokenAddress, uint[] _tokenIds, uint[] _tokenQuantities, uint _price, address indexed _buyer);
    /*
     * Emitted when owner's 'quantities' NFTs of type 'tokenIds' off shelf
     */
    event NFTCommodityOffShelf(uint indexed _commodityId, address indexed _owner, address _tokenAddress, uint[] _tokenIds, uint[] _tokenQuantities, uint _price);
    /*
     * Emitted when owner's 'quantities' NFTs of type 'tokenIds' 'price' change
     */
    event NFTCommodityPriceChange(uint indexed _commodityId, address indexed _owner, address _tokenAddress, uint[] _tokenIds, uint[] _tokenQuantities, uint _oldPrice, uint _newPrice);

    /**
     * @dev Transfers handling fee account to a new account
     * Can only be called by the current owner
     */
    function transferHandlingFeeAccount(address payable _handlingFeeAccount) public onlyOwner {
        require(_handlingFeeAccount != address(0), "account is zero address");

        handlingFeeAccount = _handlingFeeAccount;
    }

    /**
     * @dev Adjust the ratio of handling fee and seller income
     * Can only be called by the current owner
     */
    function adjustFeeRatio(uint _handlingFeeRatio) public onlyOwner {
        handlingFeeRatio = _handlingFeeRatio;
    }

    /*
     * Emits a {NFTCommodityOnShelf} event
     *
     * Requirements:
     * - 'tokenAddress' must be erc721 or erc1155 contract address
     * - 'ids' and 'quantities' must have the same length
     * - 'quantities' must greater than zero
     * - _msgSender() have the number of NFTs of type 'ids' must be greater than or equal to 'quantities'
     * - price must greater than zero
     * - token must be in support tokens
     * - _msgSender() must have approved the Exchange contract address to transfer NFTs
     */
    function onShelfNFTCommodity(address _tokenAddress, uint[] memory _tokenIds, uint[] memory _tokenQuantities, uint _price, address _token20Address) public {
        require(token.isERC721(_tokenAddress) || token.isERC1155(_tokenAddress), "not erc721 or erc1155 contract address");
        require(_tokenIds.length == _tokenQuantities.length, "ids and quantities length mismatch");

        uint[] memory balances = new uint[](_tokenIds.length);
        for (uint i = 0; i < _tokenIds.length; i++) {
            require(_tokenQuantities[i] > 0, "quantity is zero");
            if (token.isERC721(_tokenAddress)) {
                IERC721Upgradeable token721 = IERC721Upgradeable(_tokenAddress);
                require(token721.ownerOf(_tokenIds[i]) == _msgSender(), "nft balance not enough");
            } else if (token.isERC1155(_tokenAddress)) {
                IERC1155Upgradeable token1155 = IERC1155Upgradeable(_tokenAddress);
                balances[i] = token1155.balanceOf(_msgSender(), _tokenIds[i]);
                require(balances[i] >= _tokenQuantities[i], "nft balance not enough");
            }
        }
        require(_price > 0, "price is zero");
        require(isSupportToken[_token20Address], "not in support tokens");

        commodityId++;
        NFTCommodity storage commodity = commodityIdOfCommodity[commodityId];
        commodity.commodityId = commodityId;
        commodity.owner = payable(_msgSender());
        commodity.tokenAddress = _tokenAddress;
        commodity.tokenIds = _tokenIds;
        commodity.tokenQuantities = _tokenQuantities;
        commodity.price = _price;
        commodity.token20Address = _token20Address;
        commodity.status = NFTCommodityStatus.ONSHELF;

        sellerCommodityIds[_msgSender()].push(commodityId);
        onShelfCommodityIds.push(commodityId);
        onShelfCommodityIdIndex[commodityId] = onShelfCommodityIds.length;
        for (uint i = 0; i < _tokenIds.length; i++) {
            tokenIdOfCommodityIds[_tokenIds[i]].push(commodityId);
        }

        if (token.isERC721(_tokenAddress)) {
            IERC721Upgradeable token721 = IERC721Upgradeable(_tokenAddress);
            require(token721.isApprovedForAll(_msgSender(), address(this)), "transfer not approved");
            for (uint i = 0; i < _tokenIds.length; i++) {
                token721.safeTransferFrom(_msgSender(), address(this), _tokenIds[i]);
                userTokens.deleteUserTokenId(_msgSender(), _tokenAddress, _tokenIds[i]);
            }
        } else if (token.isERC1155(_tokenAddress)) {
            IERC1155Upgradeable token1155 = IERC1155Upgradeable(_tokenAddress);
            require(token1155.isApprovedForAll(_msgSender(), address(this)), "transfer not approved");
            token1155.safeBatchTransferFrom(_msgSender(), address(this), _tokenIds, _tokenQuantities, "0x");
            if (!token.isInternal(_tokenAddress)) {
                for (uint i = 0; i < balances.length; i++) {
                    if (balances[i] - _tokenQuantities[i] == 0) {
                        userTokens.deleteUserTokenId(_msgSender(), _tokenAddress, _tokenIds[i]);
                    }
                }
            }
        }

        emit NFTCommodityOnShelf(commodityId, _msgSender(), _tokenAddress, _tokenIds, _tokenQuantities, _price);
    }

    /*
     * Emits a {NFTCommodityPriceChange} event
     *
     * Requirements:
     * - price must greater than zero
     * - _msgSender() must be the owner
     * - NFTCommodity's status must be onShelf
     */
    function modifyNFTCommodityPrice(uint _commodityId, uint _price) public {
        NFTCommodity storage commodity = commodityIdOfCommodity[_commodityId];

        require(_price > 0, "price is zero");
        require(_msgSender() == commodity.owner, "you are not the owner");
        require(commodity.status == NFTCommodityStatus.ONSHELF, "have been sold or off shelf");

        uint oldPrice = commodity.price;
        commodity.price = _price;

        emit NFTCommodityPriceChange(_commodityId, commodity.owner, commodity.tokenAddress, commodity.tokenIds, commodity.tokenQuantities, oldPrice, _price);
    }

    /*
     * @dev Delete sold and offShelf commodity
     *
     * Requirements:
     * - the index of commodityId must be greater than zero
     */
    function deleteNFTCommodity(uint _commodityId) private {
        require(onShelfCommodityIdIndex[_commodityId] > 0, "index is zero");

        uint lastCommodityId = onShelfCommodityIds[onShelfCommodityIds.length - 1];
        onShelfCommodityIds[onShelfCommodityIdIndex[_commodityId] - 1] = lastCommodityId;
        onShelfCommodityIdIndex[lastCommodityId] = onShelfCommodityIdIndex[_commodityId];
        delete onShelfCommodityIds[onShelfCommodityIds.length - 1];
        delete onShelfCommodityIdIndex[_commodityId];
        onShelfCommodityIds.pop();
    }

    /*
     * Emits a {NFTCommoditySold} event
     *
     * Requirements:
     * - Buyer must be not the current owner
     * - NFTCommodity's status must be onShelf
     * - The payment must be equal to NFTCommodity's price
     */
    function buyNFTCommodity(uint _commodityId, uint _amount) public {
        NFTCommodity storage commodity = commodityIdOfCommodity[_commodityId];

        require(_msgSender() != commodity.owner, "can not buy own");
        require(commodity.status == NFTCommodityStatus.ONSHELF, "have been sold or off shelf");
        require(_amount == commodity.price, "amount not equal to price");

        IERC20MetadataUpgradeable token20 = IERC20MetadataUpgradeable(commodity.token20Address);
        uint handlingFee = _amount.mul(handlingFeeRatio).div(10000);
        uint sellerIncome = _amount.sub(handlingFee);

        if (handlingFeeRatio > 0) {
            token20.safeTransferFrom(_msgSender(), handlingFeeAccount, handlingFee);
        }
        token20.safeTransferFrom(_msgSender(), commodity.owner, sellerIncome);

        if (token.isERC721(commodity.tokenAddress)) {
            IERC721Upgradeable token721 = IERC721Upgradeable(commodity.tokenAddress);
            for (uint i = 0; i < commodity.tokenIds.length; i++) {
                token721.safeTransferFrom(address(this), _msgSender(), commodity.tokenIds[i]);
                userTokens.addUserTokenId(_msgSender(), commodity.tokenAddress, commodity.tokenIds[i]);
            }
        } else if (token.isERC1155(commodity.tokenAddress)) {
            IERC1155Upgradeable token1155 = IERC1155Upgradeable(commodity.tokenAddress);
            token1155.safeBatchTransferFrom(address(this), _msgSender(), commodity.tokenIds, commodity.tokenQuantities, "0x");
            if (!token.isInternal(commodity.tokenAddress)) {
                for (uint i = 0; i < commodity.tokenIds.length; i++) {
                    userTokens.addUserTokenId(_msgSender(), commodity.tokenAddress, commodity.tokenIds[i]);
                }
            }
        }

        buyerCommodityIds[_msgSender()].push(_commodityId);
        commodity.buyer = _msgSender();
        commodity.status = NFTCommodityStatus.SOLD;
        deleteNFTCommodity(_commodityId);

        emit NFTCommoditySold(_commodityId, commodity.owner, commodity.tokenAddress, commodity.tokenIds, commodity.tokenQuantities, commodity.price, _msgSender());
    }

    /*
     * Emits a {NFTCommodityOffShelf} event
     *
     * Requirements:
     * - _msgSender() must be the owner
     * - NFTCommodity's status must be onShelf
     */
    function offShelfNFTCommodity(uint _commodityId) public {
        NFTCommodity storage commodity = commodityIdOfCommodity[_commodityId];

        require(_msgSender() == commodity.owner, "you are not the owner");
        require(commodity.status == NFTCommodityStatus.ONSHELF, "have been sold or off shelf");

        if (token.isERC721(commodity.tokenAddress)) {
            IERC721Upgradeable token721 = IERC721Upgradeable(commodity.tokenAddress);
            for (uint i = 0; i < commodity.tokenIds.length; i++) {
                token721.safeTransferFrom(address(this), _msgSender(), commodity.tokenIds[i]);
                userTokens.addUserTokenId(_msgSender(), commodity.tokenAddress, commodity.tokenIds[i]);
            }
        } else if (token.isERC1155(commodity.tokenAddress)) {
            IERC1155Upgradeable token1155 = IERC1155Upgradeable(commodity.tokenAddress);
            token1155.safeBatchTransferFrom(address(this), _msgSender(), commodity.tokenIds, commodity.tokenQuantities, "0x");
            if (!token.isInternal(commodity.tokenAddress)) {
                for (uint i = 0; i < commodity.tokenIds.length; i++) {
                    userTokens.addUserTokenId(_msgSender(), commodity.tokenAddress, commodity.tokenIds[i]);
                }
            }
        }

        commodity.status = NFTCommodityStatus.OFFSHELF;
        deleteNFTCommodity(_commodityId);

        emit NFTCommodityOffShelf(_commodityId, commodity.owner, commodity.tokenAddress, commodity.tokenIds, commodity.tokenQuantities, commodity.price);
    }

    function getHandlingFeeRatio() public view returns (uint) {
        return handlingFeeRatio;
    }

    function getOnShelfCommodityQuantity() public view returns (uint) {
        return onShelfCommodityIds.length;
    }

    function getOnShelfCommodity(uint _index) public view returns (NFTCommodity memory) {
        return commodityIdOfCommodity[onShelfCommodityIds[_index]];
    }

    function getSellerCommodityQuantity(address _address) public view returns (uint) {
        return sellerCommodityIds[_address].length;
    }

    function getSellerCommodity(address _address, uint _index) public view returns (NFTCommodity memory) {
        return commodityIdOfCommodity[sellerCommodityIds[_address][_index]];
    }

    function getTokenCommodityQuantity(uint _tokenId) public view returns (uint) {
        return tokenIdOfCommodityIds[_tokenId].length;
    }

    function getTokenCommodity(uint _tokenId, uint _index) public view returns (NFTCommodity memory) {
        return commodityIdOfCommodity[tokenIdOfCommodityIds[_tokenId][_index]];
    }

    function getBuyerCommodityQuantity(address _address) public view returns (uint) {
        return buyerCommodityIds[_address].length;
    }

    function getBuyerCommodity(address _address, uint _index) public view returns (NFTCommodity memory) {
        return commodityIdOfCommodity[buyerCommodityIds[_address][_index]];
    }

    function getNFTCommodity(uint _commodityId) public view returns (NFTCommodity memory) {
        return commodityIdOfCommodity[_commodityId];
    }
}
