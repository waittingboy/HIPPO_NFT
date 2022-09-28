// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./lib/ERC20Tokens.sol";
import "./interfaces/INFTFactory.sol";
import "./interfaces/IContract.sol";
import "./interfaces/IUserTokens.sol";

contract NFTAuctionMarket is ERC721HolderUpgradeable, ERC1155HolderUpgradeable, ERC20Tokens {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using SafeMathUpgradeable for uint;

    // Internal NFT token instance
    INFTFactory public internalToken;

    // NFT token instance
    IContract public token;

    // User tokens instance
    IUserTokens public userTokens;

    // Handling fee transfer to this account
    address payable public handlingFeeAccount;

    uint private handlingFeeRatio;

    // Used to enumerate the status of auction
    enum NFTAuctionStatus {
        LISTED,
        BIDDING,
        SOLD,
        UNLISTED
    }

    // Used to store the info of auction item
    struct NFTAuctionItem {
        uint auctionItemId;
        address payable owner;
        address tokenAddress;
        uint tokenId;
        uint auctionStartTime; // in seconds, front end convert current time to seconds
        uint auctionEndTime; // in seconds, front end convert time to seconds
        uint startPrice;
        uint reservePrice;
        uint markdownTimeInterval; // in seconds, front end convert hours to seconds
        address token20Address;
        NFTAuctionStatus status;
        address bidder;
        uint bid;
    }

    // Used to storage the bid record of auction item
    struct BidRecord {
        address bidder;
        uint bid;
        uint time;
    }

    // Mapping from auction item id to bid record
    mapping(uint => BidRecord[]) bidRecords;

    // Auction item id, start from 1
    uint private auctionItemId;
    // Mapping from auction item id to auction item
    mapping(uint => NFTAuctionItem) private auctionItemIdOfAuctionItem;
    // Mapping from auctioneer to the auction item ids which he auctioned
    mapping(address => uint[]) private auctioneerAuctionItemIds;

    // Listed or bidding auction item ids
    uint[] private biddableAuctionItemIds;
    // Mapping from biddable auction item id to its index
    mapping(uint => uint) private biddableAuctionItemIdIndex;

    // Mapping from nft token id to auction item ids which the auction item contains it
    mapping(uint => uint[]) private tokenIdOfAuctionItemIds;

    // Mapping from bidder to auction item ids which he auctioned
    mapping(address => uint[]) private bidderAuctionItemIds;
    // Mapping from bidder to the auction item id which it bid or not
    mapping(address => mapping(uint => bool)) private isBidAuctionItem;

    // The sign of allow fragments list or not
    bool private isAllowFragmentsList;

    function initialize(INFTFactory _internalToken, IContract _token, address payable _handlingFeeAccount, address[] memory _token20sAddress) public initializer {
        __ERC1155Holder_init();
        __ERC20Tokens_init(_token20sAddress);

        require(_handlingFeeAccount != address(0), "account is zero address");

        internalToken = _internalToken;
        token = _token;
        handlingFeeAccount = _handlingFeeAccount;
        handlingFeeRatio = 200;
        isAllowFragmentsList = false;
    }

    /*
     * Emitted when owner's NFTs of type 'tokenId' listed
     */
    event NFTAuctionItemListed(uint indexed _auctionItemId, address indexed _owner, address _tokenAddress, uint _tokenId);
    /*
     * Emitted when owner's NFTs of type 'tokenId' be bid
     */
    event NFTAuctionItemBidding(uint indexed _auctionItemId, address indexed _owner, address _tokenAddress, uint _tokenId, address indexed _bidder, uint _bid);
    /*
     * Emitted when owner's NFTs of type 'tokenId' sold
     */
    event NFTAuctionItemSold(uint indexed _auctionItemId, address indexed _owner, address _tokenAddress, uint _tokenId, address indexed _bidder, uint _bid);
    /*
     * Emitted when owner's NFTs of type 'tokenId' unListed
     */
    event NFTAuctionItemUnListed(uint indexed _auctionItemId, address indexed _owner, address _tokenAddress, uint _tokenId);

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

    /**
     * @dev Allow to set is allow fragments list or not
     * Can only be called by the current owner
     */
    function setIsAllowFragmentsList(bool _isAllowFragmentsList) public onlyOwner {
        isAllowFragmentsList = _isAllowFragmentsList;
    }

    /*
     * Emits a {NFTAuctionItemListed} event
     *
     * Requirements:
     * - 'tokenAddress' must be erc721 or erc1155 contract address
     * - auction end time must after auction start time
     * - start price must greater than zero
     * - reserve price must less than start price
     * - markdown time interval must between 1 and 12 hours
     * - token must be in support tokens
     * - auction duration must between 1 and 7 days
     * - markdown time interval must can divisible by auction duration
     * - the number of NFTs of type 'id' must be not fragment
     * - _msgSender() have the number of NFTs of type 'id' must be greater than 1
     * - _msgSender() must have approved the Auction contract address to transfer NFTs
     */
    function listNFTAuctionItem(
        address _tokenAddress, uint _tokenId, uint _auctionStartTime, uint _auctionEndTime,
        uint _startPrice, uint _reservePrice, uint _markdownTimeInterval, address _token20Address
        ) public {
        require(token.isERC721(_tokenAddress) || token.isERC1155(_tokenAddress), "not erc721 or erc1155 contract address");
        require(_auctionEndTime > _auctionStartTime, "end time earlier than start time");
        require(_startPrice > 0, "start price is zero");
        require(_reservePrice < _startPrice, "reserve price greater than or equal to start price");
        require(_markdownTimeInterval >= 1 hours && _markdownTimeInterval <= 12 hours && _markdownTimeInterval.mod(1 hours) == 0, "markdown time interval is invalid");
        require(isSupportToken[_token20Address], "not in support tokens");

        uint auctionDuration = _auctionEndTime.sub(_auctionStartTime);

        require(auctionDuration >= 1 days && auctionDuration <= 7 days && auctionDuration.mod(1 days) == 0, "auction duration is invalid");
        require(auctionDuration.mod(_markdownTimeInterval) == 0, "auction duration is invalid");

        if (token.isERC721(_tokenAddress)) {
            IERC721Upgradeable token721 = IERC721Upgradeable(_tokenAddress);
            require(token721.ownerOf(_tokenId) == _msgSender(), "nft balance is zero");
        } else if (token.isERC1155(_tokenAddress)) {
            IERC1155Upgradeable token1155 = IERC1155Upgradeable(_tokenAddress);
            require(token1155.balanceOf(_msgSender(), _tokenId) >= 1, "nft balance is zero");
            if (!isAllowFragmentsList && token.isInternal(_tokenAddress)) {
                require(!internalToken.getIsFragment(_tokenId), "nft is fragment");
            }
        }

        auctionItemId++;
        NFTAuctionItem storage item = auctionItemIdOfAuctionItem[auctionItemId];
        item.auctionItemId = auctionItemId;
        item.owner = payable(_msgSender());
        item.tokenAddress = _tokenAddress;
        item.tokenId = _tokenId;
        item.auctionStartTime = _auctionStartTime;
        item.auctionEndTime = _auctionEndTime;
        item.startPrice = _startPrice;
        item.reservePrice = _reservePrice;
        item.markdownTimeInterval = _markdownTimeInterval;
        item.token20Address = _token20Address;
        item.status = NFTAuctionStatus.LISTED;

        auctioneerAuctionItemIds[_msgSender()].push(auctionItemId);
        biddableAuctionItemIds.push(auctionItemId);
        biddableAuctionItemIdIndex[auctionItemId] = biddableAuctionItemIds.length;
        tokenIdOfAuctionItemIds[_tokenId].push(auctionItemId);

        if (token.isERC721(_tokenAddress)) {
            IERC721Upgradeable token721 = IERC721Upgradeable(_tokenAddress);
            require(token721.isApprovedForAll(_msgSender(), address(this)), "transfer not approved");
            token721.safeTransferFrom(_msgSender(), address(this), _tokenId);
        } else if (token.isERC1155(_tokenAddress)) {
            IERC1155Upgradeable token1155 = IERC1155Upgradeable(_tokenAddress);
            require(token1155.isApprovedForAll(_msgSender(), address(this)), "transfer not approved");
            token1155.safeTransferFrom(_msgSender(), address(this), _tokenId, 1, "0x");
        }

        emit NFTAuctionItemListed(auctionItemId, _msgSender(), _tokenAddress, _tokenId);
    }

    /*
     * Emits a {NFTAuctionItemBidding} event
     *
     * Requirements:
     * - Bidder must be not the current owner
     * - current time must be greater than or equal to auction start time
     * - current time must be less than or equal to auction end time
     */
    function bidNFTAuctionItem(uint _auctionItemId, uint _amount) public {
        NFTAuctionItem storage item = auctionItemIdOfAuctionItem[_auctionItemId];
        IERC20MetadataUpgradeable token20 = IERC20MetadataUpgradeable(item.token20Address);

        require(_msgSender() != item.owner, "can not bid own");
        require(block.timestamp >= item.auctionStartTime, "auction not start");
        require(block.timestamp <= item.auctionEndTime, "auction is over");

        if (item.status == NFTAuctionStatus.LISTED) {
            require(_amount == getCurrentAuctionPrice(_auctionItemId), "amount not equal to current auction price");

            token20.safeTransferFrom(_msgSender(), address(this), _amount);

            item.status = NFTAuctionStatus.BIDDING;
        } else if (item.status == NFTAuctionStatus.BIDDING) {
            require(_amount > item.bid, "amount less than or equal to last bid");

            token20.safeTransferFrom(_msgSender(), address(this), _amount);
            token20.safeTransfer(item.bidder, item.bid);
        }
        item.bidder = _msgSender();
        item.bid = _amount;

        // add bid record for auction item
        BidRecord memory bidRecord = BidRecord(_msgSender(), _amount, block.timestamp);
        bidRecords[_auctionItemId].push(bidRecord);

        // set bid auction item data for bidder
        if (!isBidAuctionItem[_msgSender()][_auctionItemId]) {
            bidderAuctionItemIds[_msgSender()].push(_auctionItemId);
            isBidAuctionItem[_msgSender()][_auctionItemId] = true;
        }

        emit NFTAuctionItemBidding(_auctionItemId, item.owner, item.tokenAddress, item.tokenId, _msgSender(), _amount);
    }

    /*
     * @dev Delete sold and unlisted auctionItem
     *
     * Requirements:
     * - the index of auctionItemId must be greater than zero
     */
    function deleteNFTAuctionItem(uint _auctionItemId) private {
        require(biddableAuctionItemIdIndex[_auctionItemId] > 0, "index is zero");

        uint lastAuctionItemId = biddableAuctionItemIds[biddableAuctionItemIds.length - 1];
        biddableAuctionItemIds[biddableAuctionItemIdIndex[_auctionItemId] - 1] = lastAuctionItemId;
        biddableAuctionItemIdIndex[lastAuctionItemId] = biddableAuctionItemIdIndex[_auctionItemId];
        delete biddableAuctionItemIds[biddableAuctionItemIds.length - 1];
        delete biddableAuctionItemIdIndex[_auctionItemId];
        biddableAuctionItemIds.pop();
    }

    /*
     * Emits a {NFTAuctionItemSold} event
     *
     * Requirements:
     * - current time must be greater than auction end time
     * - NFTAuctionItem's status must be BIDDING
     */
    function tradeNFTAuctionItem(uint _auctionItemId) public {
        NFTAuctionItem storage item = auctionItemIdOfAuctionItem[_auctionItemId];

        require(block.timestamp > item.auctionEndTime, "auction not over");
        require(item.status == NFTAuctionStatus.BIDDING, "not in bidding status");

        IERC20MetadataUpgradeable token20 = IERC20MetadataUpgradeable(item.token20Address);
        uint handlingFee = item.bid.mul(handlingFeeRatio).div(10000);
        uint auctioneerIncome = item.bid.sub(handlingFee);

        if (handlingFeeRatio > 0) {
            token20.safeTransfer(handlingFeeAccount, handlingFee);
        }
        token20.safeTransfer(item.owner, auctioneerIncome);

        if (token.isERC721(item.tokenAddress)) {
            IERC721Upgradeable token721 = IERC721Upgradeable(item.tokenAddress);
            token721.safeTransferFrom(address(this), item.bidder, item.tokenId);
        } else if (token.isERC1155(item.tokenAddress)) {
            IERC1155Upgradeable token1155 = IERC1155Upgradeable(item.tokenAddress);
            token1155.safeTransferFrom(address(this), item.bidder, item.tokenId, 1, "0x");
        }

        item.status = NFTAuctionStatus.SOLD;
        deleteNFTAuctionItem(_auctionItemId);

        emit NFTAuctionItemSold(_auctionItemId, item.owner, item.tokenAddress, item.tokenId, item.bidder, item.bid);
    }

    /*
     * Emits a {NFTAuctionItemUnListed} event
     *
     * Requirements:
     * - _msgSender() must be the owner
     * - NFTAuctionItem's status must be listed
     */
    function unListNFTAuctionItem(uint _auctionItemId) public {
        NFTAuctionItem storage item = auctionItemIdOfAuctionItem[_auctionItemId];

        require(_msgSender() == item.owner, "you are not the owner");
        require(item.status == NFTAuctionStatus.LISTED, "not in listed status");

        if (token.isERC721(item.tokenAddress)) {
            IERC721Upgradeable token721 = IERC721Upgradeable(item.tokenAddress);
            token721.safeTransferFrom(address(this), _msgSender(), item.tokenId);
        } else if (token.isERC1155(item.tokenAddress)) {
            IERC1155Upgradeable token1155 = IERC1155Upgradeable(item.tokenAddress);
            token1155.safeTransferFrom(address(this), _msgSender(), item.tokenId, 1, "0x");
        }

        item.status = NFTAuctionStatus.UNLISTED;
        deleteNFTAuctionItem(_auctionItemId);

        emit NFTAuctionItemUnListed(_auctionItemId, item.owner, item.tokenAddress, item.tokenId);
    }

    function getHandlingFeeRatio() public view returns (uint) {
        return handlingFeeRatio;
    }

    function getBiddableAuctionItemQuantity() public view returns (uint) {
        return biddableAuctionItemIds.length;
    }

    function getBiddableAuctionItem(uint _index) public view returns (NFTAuctionItem memory) {
        return auctionItemIdOfAuctionItem[biddableAuctionItemIds[_index]];
    }

    function getAuctioneerAuctionItemQuantity(address _address) public view returns (uint) {
        return auctioneerAuctionItemIds[_address].length;
    }

    function getAuctioneerAuctionItem(address _address, uint _index) public view returns (NFTAuctionItem memory) {
        return auctionItemIdOfAuctionItem[auctioneerAuctionItemIds[_address][_index]];
    }

    function getTokenAuctionItemQuantity(uint _tokenId) public view returns (uint) {
        return tokenIdOfAuctionItemIds[_tokenId].length;
    }

    function getTokenAuctionItem(uint _tokenId, uint _index) public view returns (NFTAuctionItem memory) {
        return auctionItemIdOfAuctionItem[tokenIdOfAuctionItemIds[_tokenId][_index]];
    }

    function getBidderAuctionItemQuantity(address _address) public view returns (uint) {
        return bidderAuctionItemIds[_address].length;
    }

    function getBidderAuctionItem(address _address, uint _index) public view returns (NFTAuctionItem memory) {
        return auctionItemIdOfAuctionItem[bidderAuctionItemIds[_address][_index]];
    }

    function getAuctionItem(uint _auctionItemId) public view returns (NFTAuctionItem memory) {
        return auctionItemIdOfAuctionItem[_auctionItemId];
    }

    function getCurrentAuctionPrice(uint _auctionItemId) public view returns (uint) {
        NFTAuctionItem memory item = auctionItemIdOfAuctionItem[_auctionItemId];

        uint totalMarkdownTimes = item.auctionEndTime.sub(item.auctionStartTime).div(item.markdownTimeInterval).sub(1);
        uint everyPriceMarkdown = item.startPrice.sub(item.reservePrice).div(totalMarkdownTimes);
        uint priceMarkdownTimes = block.timestamp.sub(item.auctionStartTime).div(item.markdownTimeInterval);
        uint currentAuctionPrice = 0;

        if (priceMarkdownTimes >= totalMarkdownTimes) {
            currentAuctionPrice = item.reservePrice;
        } else {
            currentAuctionPrice = item.startPrice.sub(priceMarkdownTimes.mul(everyPriceMarkdown));
        }

        return currentAuctionPrice;
    }

    function getAuctionItemBidRecordQuantity(uint _auctionItemId) public view returns (uint) {
        return bidRecords[_auctionItemId].length;
    }

    function getAuctionItemBidRecord(uint _auctionItemId, uint _index) public view returns (BidRecord memory) {
        return bidRecords[_auctionItemId][_index];
    }

    function getIsAllowFragmentsList() public view returns (bool) {
        return isAllowFragmentsList;
    }
}
