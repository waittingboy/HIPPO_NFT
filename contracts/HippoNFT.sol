//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

contract HippoNFT is ERC1155SupplyUpgradeable{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    uint256 public id;

    struct TokenInfo {
        string url;
    }
    // tokenId => token Info
    mapping(uint256 => TokenInfo) public tokenInfo;

    mapping(address => EnumerableSetUpgradeable.UintSet) tokenIdListOfUser;

    bool _enterStatus;
    bool _enterStatus01;

    modifier nonReentrant() {
        require(!_enterStatus, "ReentrancyGuard: reentrant call");
        _enterStatus = true;
        _;
        _enterStatus = false;
    }
    modifier nonReentrant01() {
        require(!_enterStatus01, "ReentrancyGuard: reentrant call");
        _enterStatus01 = true;
        _;
        _enterStatus01 = false;
    }

    function initialize(string memory uri_) public initializer {
        __ERC1155_init(uri_);
        __ERC1155Supply_init();
    }

    /// @notice Mint one Hippo NFT
    /// @param _amount the amount of Hippo NFTs will be minted
    /// @param _url the url of Hippo NFTs will be minted
    /// @return 'true' when execute success
    function mint(uint256 _amount, string memory _url) public nonReentrant01 returns(bool){
        id++;
        uint256 _tokenId = id;
        _mint(_msgSender(),_tokenId,_amount,"");

        tokenInfo[_tokenId] = TokenInfo(_url);

        tokenIdListOfUser[_msgSender()].add(_tokenId);
        return true;
    }

    /// @notice Mint one batch Hippo NFT
    /// @param _amounts the amount array of Hippo NFTs will be minted
    /// @param _urls the url array of Hippo NFTs will be minted
    /// @return _res 'true' when execute success
    function batchMint(
        uint256[] memory _amounts,
        string[] memory _urls
    ) public nonReentrant returns(bool _res) {
        require(_amounts.length == _urls.length,"The lengths mismatch");

        uint256 len = _amounts.length;
        require(len >0,"len need GT 0");

        for(uint256 i = 0; i < len; i++) {
             _res = mint(_amounts[i],_urls[i]);
             require(_res,"batchMint failed");
        }

        return _res;
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public override {
        if(_amount == balanceOf(_from, _id)) tokenIdListOfUser[_from].remove(_id);
        if(!tokenIdListOfUser[_to].contains(_id)) tokenIdListOfUser[_to].add(_id);

        super.safeTransferFrom(_from, _to, _id, _amount, _data);

    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public override {
        require(_ids.length == _amounts.length, "ids and amounts length mismatch");
        uint256 len = _ids.length;
        for(uint256 i =0; i < len; i++) {
            if(_amounts[i] == balanceOf(_from, _ids[i])) tokenIdListOfUser[_from].remove(_ids[i]);
            if(!tokenIdListOfUser[_to].contains(_ids[i])) tokenIdListOfUser[_to].add(_ids[i]);
        }

        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);

    }

    /// @notice get the url of the tokenId
    function uri(uint256 _tokenId) public view override returns (string memory) {
        return tokenInfo[_tokenId].url;
    }

    /// @notice get the token id list of the user
    function getAllTokenIdOfUser(address _user) public view returns(uint256[] memory) {
        return tokenIdListOfUser[_user].values();
    }

    /// @notice check whether the user has '_tokenId' NFT or not
    function contains(address _user, uint256 _tokenId) public view returns (bool) {
        return tokenIdListOfUser[_user].contains(_tokenId);
    }

    /// @notice get the length of the user's tokenId list
    function lengthOfTokenIdList(address _user) public view returns (uint256) {
        return tokenIdListOfUser[_user].length();
    }

    /// @notice get the tokenId by the index of the user's tokenId list
    function tokenIdByIndex(address _user, uint256 index) public view returns (uint256) {
        return tokenIdListOfUser[_user].at(index);
    }


}
