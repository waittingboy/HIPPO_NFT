// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./interfaces/INFTFactory.sol";
import "./interfaces/IUserTokens.sol";

contract NFTFactory is ERC1155Upgradeable, INFTFactory {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private id;

    // User tokens instance
    IUserTokens public userTokens;

    // the contract address of the Mystery Box Governance
    address public MBGovernanceAddress;

    struct Work {
        string uri;
        uint numFragments;
    }

    // mapping from originId to Work
    mapping(uint => Work) private originIdToWork;

    // Mapping from id to is fragment
    mapping(uint => bool) private isFragment;

    // modifier to restrict access to the MB governance contract only
    modifier onlyMBGovernance() {
        require(MBGovernanceAddress == _msgSender(), "only MB governance contract authorized");
        _;
    }

    function initialize(address _MBGovernanceAddress) public initializer {
        __ERC1155_init("");

        MBGovernanceAddress = _MBGovernanceAddress;
    }

    /*
     * Emitted when full NFTs and fragment NFTs minted
     */
    event NFTMinted(uint indexed _originId, uint[] _fragemntIds, uint _numFullCopies, uint _numSplitFullCopies, uint _numFragments);
    /*
     * Emitted when merge fragment NFTs to full NFTs
     */
    event NFTMerged(uint indexed _originId, uint _quantity);

    /**
     * @dev Mint full NFTs and fragment NFTs
     *
     * Emits a {NFTMinted} event
     */
    function mint(
        address _mysteryBoxMarketAddress, string memory _uri,
        uint _numFullCopies, uint _numSplitFullCopies, uint _numFragments
        ) external onlyMBGovernance override returns (uint, uint[] memory) {
        id.increment();

        uint newId = id.current();
        uint originId = newId << 128;

        uint[] memory fragmentIds = new uint[](_numFragments);
        uint[] memory fragmentAmounts = new uint[](_numFragments);

        for (uint i = 0; i < _numFragments; i++) {
            uint128 index = uint128(i) + 1;

            fragmentIds[i] = originId + index;
            fragmentAmounts[i] = _numSplitFullCopies;
            isFragment[originId + index] = true;
        }

        _mintBatch(_mysteryBoxMarketAddress, fragmentIds, fragmentAmounts, "");
        if (_numFullCopies > 0) {
            _mint(_mysteryBoxMarketAddress, originId, _numFullCopies, "");
        }

        Work memory work = Work(_uri, _numFragments);
        originIdToWork[originId] = work;

        emit NFTMinted(originId, fragmentIds, _numFullCopies, _numSplitFullCopies, _numFragments);

        return (originId, fragmentIds);
    }

    /**
     * @dev Merge fragment NFTs to full NFTs
     *
     * Emits a {NFTMerged} event
     *
     * Requirements:
     * - quantity must greater than zero
     * - each quantity of fragmentId must be greater than mint quantity
     */
    function merge(uint _originId, uint _quantity) public {
        require(_quantity > 0, "quantity is zero");

        uint numFragments = originIdToWork[_originId].numFragments;

        uint[] memory ids = new uint[](numFragments);
        uint[] memory balances = new uint[](numFragments);
        uint[] memory quantities = new uint[](numFragments);

        for (uint i = 0; i < numFragments; i++) {
            uint128 index = uint128(i) + 1;

            uint fragmentId = _originId + index;
            require(balanceOf(_msgSender(), fragmentId) >= _quantity, "you have not collected all required fragments");

            ids[i] = fragmentId;
            balances[i] = balanceOf(_msgSender(), fragmentId);
            quantities[i] = _quantity;
        }

        // all fragments collected, do the merge
        _burnBatch(_msgSender(), ids, quantities);
        _mint(_msgSender(), _originId, _quantity, "");

        emit NFTMerged(_originId, _quantity);
    }

    function getTokenInfo(uint _tokenId) external view override returns (uint, string memory, uint, uint, bool) {
        uint originId = _tokenId >> 128 << 128;
        uint tokenIndex = _tokenId << 128 >> 128;

        return (originId, originIdToWork[originId].uri, originIdToWork[originId].numFragments, tokenIndex, isFragment[_tokenId]);
    }

    function getIsFragment(uint _tokenId) external view override returns (bool) {
        return isFragment[_tokenId];
    }

    function uri(uint256 _tokenId) public view virtual override returns (string memory) {
        uint originId = _tokenId >> 128 << 128;

        return originIdToWork[originId].uri;
    }
}
