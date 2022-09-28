// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "./interfaces/INFTDepositBox.sol";

contract NFTDepositBox is INFTDepositBox, ERC721HolderUpgradeable,ERC1155HolderUpgradeable,OwnableUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    uint256 public nftId;
    address public mysteryBoxMarket;
    address public internalNFT1155;
    mapping(address => bool) public internalCaller;

    struct NFT {
        address tokenAddress;
        uint256 tokenId;
        uint256 amount;
        address owner;
        uint32 nftType; //0 => Not NFT, 721=> ERC721, 1155 => ERC1155
        bool isInCollection;
    }
    // nftId => NFT
    mapping(uint256 => NFT) public override allNFTs;

    // owner => nftId[]
    mapping(address => uint256[]) public nftsOfOwner;
    // tokenAddress => tokenId => userAddress => nftId
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public nftIdMap;

    EnumerableSetUpgradeable.AddressSet private whitelistNFTAddressSet;

    event NFTDeposit(
        address indexed _owner,
        address indexed _tokenAddress,
        uint256 _tokenId,
        uint256 _amount
    );
    //NFTClaim
    event NFTClaim(
        address indexed _to,
        address indexed _tokenAddress,
        uint256 _tokenId,
        uint256 _amount
    );
    //NFTWithdraw
    event NFTWithdraw(
        address indexed _to,
        address indexed _tokenAddress,
        uint256 _tokenId,
        uint256 _amount
    );

    event AddWhitelistNFT(address indexed nftAddress);

    event RemoveWhitelistNFT(address indexed nftAddress);

    /// @notice only mysteryBoxMarket can call
    modifier onlyMysteryBoxMarket() {
        require(_msgSender() == mysteryBoxMarket, "Not mysteryBoxMarket");

        _;
    }

    /// @notice only internal caller can call
    modifier onlyInternal() {
        require(
            internalCaller[_msgSender()],
            "NFTDepositBox: caller is not a internal caller"
        );
        _;
    }

    /// @notice only whitelist NFT can deposit
    modifier onlyWhitelist(address _nftAddress) {
        require(
            whitelistNFTAddressSet.contains(_nftAddress),
            "NFTDepositBox: only whitelist NFT can deposit"
        );
        _;
    }

    function initialize(address _mysteryBoxMarket, address _internalNFT1155, address _externalNftBase) public initializer {
        __Ownable_init();
        __ERC1155Holder_init();
        __ERC721Holder_init();

        mysteryBoxMarket = _mysteryBoxMarket;
        internalCaller[_mysteryBoxMarket] = true;
        internalCaller[_externalNftBase] = true;
        internalNFT1155 = _internalNFT1155;

        whitelistNFTAddressSet.add(internalNFT1155);
    }

    function _depositNFT(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _amount,
        address _owner
    ) internal onlyWhitelist(_tokenAddress) returns (uint256) {

        bool isERC721 = IERC721Upgradeable(_tokenAddress).supportsInterface(
            0x80ac58cd
        );
        bool isERC1155 = IERC1155Upgradeable(_tokenAddress).supportsInterface(
            0xd9b67a26
        );
        require(isERC721 || isERC1155, "Not ERC721 or ERC1155");

        if (isERC721) {
            require(_amount == 1,"The amount of 721-NFT deposited only be 1");
            IERC721Upgradeable(_tokenAddress).safeTransferFrom(
                _owner,
                address(this),
                _tokenId
            );

            //setApprovalForAll to mysteryBoxMarket
            IERC721Upgradeable(_tokenAddress).setApprovalForAll(mysteryBoxMarket,true);
        }
        if (isERC1155) {
            require(_amount > 0,"The amount of 1155-NFT deposited must GT 0");
            IERC1155Upgradeable(_tokenAddress).safeTransferFrom(
                _owner,
                address(this),
                _tokenId,
                _amount,
                ""
            );

            //setApprovalForAll to mysteryBoxMarket
            IERC1155Upgradeable(_tokenAddress).setApprovalForAll(mysteryBoxMarket,true);
        }

        uint256 _nftId = nftIdMap[_tokenAddress][_tokenId][_owner];

        if (_nftId == 0) {
            _nftId = ++nftId;
            //only add new NFT Id into user own NFT array
            nftsOfOwner[_owner].push(nftId);

            NFT storage nft = allNFTs[_nftId];
            nft.tokenAddress = _tokenAddress;
            nft.tokenId = _tokenId;
            nft.owner = _owner;
            //isERC721 == true => 721;isERC1155 == true => 1155
            if (isERC721) nft.nftType = uint32(721);
            if (isERC1155) nft.nftType = uint32(1155);

            nftIdMap[_tokenAddress][_tokenId][_owner] = _nftId;
        }

        allNFTs[_nftId].amount += _amount;

        emit NFTDeposit(_owner, _tokenAddress, _tokenId, _amount);

        require(_nftId > 0, "deposit NFT failed");

        return _nftId;
    }

    function _batchDepositNFT(
        address[] memory _tokenAddresses,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        address _owner
    ) internal returns (uint256[] memory) {
        uint256 len = _tokenAddresses.length;
        require(len > 0, "Len must GT 0");
        require(
            _tokenAddresses.length == _tokenIds.length &&
                _tokenAddresses.length == _amounts.length,
            "Array length must match"
        );

        uint256[] memory _nftIds = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            _nftIds[i] = _depositNFT(
                _tokenAddresses[i],
                _tokenIds[i],
                _amounts[i],
                _owner
            );
        }
        return _nftIds;
    }

    function depositNFT(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _amount
    ) public override {
        uint256 _nftId = _depositNFT(
            _tokenAddress,
            _tokenId,
            _amount,
            _msgSender()
        );
    }

    function batchDepositNFT(
        address[] memory _tokenAddresses,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        address _owner
    ) public override returns (uint256[] memory) {
        return _batchDepositNFT(_tokenAddresses, _tokenIds, _amounts, _owner);
    }

    function depositNFTByBase(
        address _tokenAddress,
        uint256 _tokenId,
        address _to,
        uint256 _amount
    ) public override onlyInternal returns (uint256) {

        return _depositNFT(_tokenAddress, _tokenId, _amount, _to);
    }

    function _withdrawNFT(
        address _to,
        uint256 _nftId,
        uint256 _amount,
        bool _isClaim
    ) internal {
        NFT storage nft = allNFTs[_nftId];
        require(_amount <= nft.amount, "The amount of withdraw too much");
        nft.amount -= _amount;

        address _tokenAddress = nft.tokenAddress;
        uint256 _tokenId = nft.tokenId;
        uint256 _nftType = nft.nftType;

        if (_nftType == 721) {
            IERC721Upgradeable(_tokenAddress).safeTransferFrom(
                address(this),
                _to,
                _tokenId
            );
            _amount = 1;
        }
        if (_nftType == 1155)
            IERC1155Upgradeable(_tokenAddress).safeTransferFrom(
                address(this),
                _to,
                _tokenId,
                _amount,
                ""
            );

        if (_isClaim) {
            emit NFTClaim(_to, _tokenAddress, _tokenId, _amount);
        } else {
            emit NFTWithdraw(_to, _tokenAddress, _tokenId, _amount);
        }
    }

    function withdrawNFT(uint256 _nftId, uint256 _amount) public override {
        require(
            allNFTs[_nftId].owner == _msgSender() ||
                internalCaller[_msgSender()],
            "Not owner or internal caller"
        );
        require(!allNFTs[_nftId].isInCollection, "NFT in the collection");
        _withdrawNFT(allNFTs[_nftId].owner, _nftId, _amount, false);
    }

    function batchWithdrawNFT(
        uint256[] memory _nftIds,
        uint256[] memory _amounts
    ) external override {
        uint256 len = _nftIds.length;
        require(len > 0, "Len must GT 0");
        require(_nftIds.length == _amounts.length, "Array length must match");

        for (uint256 i = 0; i < len; i++) {
            withdrawNFT(_nftIds[i], _amounts[i]);
        }
    }

    function claimNFT(
        address _to,
        uint256 _nftId,
        uint256 _amount
    ) public override onlyMysteryBoxMarket {

        require(allNFTs[_nftId].isInCollection, "NFT not in the collection");
        _withdrawNFT(_to, _nftId, _amount, true);
    }

    function batchClaimNFT(
        address _to,
        uint256[] memory _nftIds,
        uint256[] memory _amounts
    ) external override onlyMysteryBoxMarket{
        uint256 len = _nftIds.length;
        require(len > 0, "Len must GT 0");
        require(_nftIds.length == _amounts.length, "Array length must match");

        for (uint256 i = 0; i < len; i++) {
            claimNFT(_to, _nftIds[i], _amounts[i]);
        }
    }

    function addWhitelistNFTAddr(address _newNFTAddr)
        public
        onlyOwner
    {
        if(!whitelistNFTAddressSet.contains(_newNFTAddr) && isContract(_newNFTAddr)) {
            whitelistNFTAddressSet.add(_newNFTAddr);
            emit AddWhitelistNFT(_newNFTAddr);
        }
    }

    function removeWhitelistNFTAddr(address _rmNFTAddr)
        public
        onlyOwner
    {
        if(whitelistNFTAddressSet.contains(_rmNFTAddr)) {
            whitelistNFTAddressSet.remove(_rmNFTAddr);
            emit RemoveWhitelistNFT(_rmNFTAddr);
        }
    }

    function batchAddWhitelistNFTAddrs(address[] memory _newNFTAddrs)
        public
        onlyOwner
    {
        uint256 len = _newNFTAddrs.length;
        require(len > 0,"The len of input _newNFTAddrs must GT 0");
        for(uint256 i = 0; i < len; i++) {
            addWhitelistNFTAddr(_newNFTAddrs[i]);
        }

    }

    function batchRemoveWhitelistNFTAddrs(address[] memory _rmNFTAddrs)
        public
        onlyOwner
    {
        uint256 len = _rmNFTAddrs.length;
        require(len > 0,"The len of input _rmNFTAddrs must GT 0");
        for(uint256 i = 0; i < len; i++) {
            removeWhitelistNFTAddr(_rmNFTAddrs[i]);
        }

    }

    function getAllWhitelistNFTAddr() external view returns(address[] memory) {
        return whitelistNFTAddressSet.values();
    }

    function setInternalCaller(address _internalAddr, bool _set)
        external
        onlyOwner
    {
        internalCaller[_internalAddr] = _set;
    }

    function setNFTStatus(uint256 _nftId, bool _set)
        external
        override
        onlyInternal
    {
        NFT storage nft = allNFTs[_nftId];
        require(nft.nftType != 0, "NFT is not existed");
        nft.isInCollection = _set;
    }

    function getNFTInfo(uint256 _nftId)
        external
        view
        override
        returns (uint256 _nftType, uint256 _amount)
    {
        _nftType = allNFTs[_nftId].nftType;
        _amount = allNFTs[_nftId].amount;
    }

    function getOwnerOfNFT(uint256 _nftId)
        public
        view
        override
        returns (address)
    {
        return allNFTs[_nftId].owner;
    }

    /// @notice _nftId from mystery box package
    function getVirtualNftInfo(uint256 _nftId)
        external
        view
        override
        returns (
            bool _isExternalNFT,
            address _tokenAddress,
            uint256 _tokenId,
            uint256 _nftType
        )
    {
        require(_nftId > 0, "NFT id cannot be 0");
        if (_nftId < 2**128) {
            _isExternalNFT = true;
            NFT storage nft = allNFTs[_nftId];
            _tokenAddress = nft.tokenAddress;
            _tokenId = nft.tokenId;
            ////0 => Not NFT, 721=> ERC721, 1155 => ERC1155
            _nftType = uint256(nft.nftType);
        } else {
            _isExternalNFT = false;
            _tokenAddress = internalNFT1155;
            _tokenId = _nftId;
            _nftType = 1155;
        }
    }

    function isWhitelistNFT(address _nftAddress) public view returns(bool){
        return whitelistNFTAddressSet.contains(_nftAddress);
    }

    /// @notice Copy from OpenZeppelin Contracts v4.4.1 (utils/AddressUpgradeable.sol)
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

}
