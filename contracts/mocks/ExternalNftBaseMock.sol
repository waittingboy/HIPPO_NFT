// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

import "../interfaces/INFTFactory.sol";
import "../interfaces/IMysteryBox.sol";
import "../interfaces/IDemocracy.sol";
import "../interfaces/ICrowdFund.sol";
import "../interfaces/IExternalNftBase.sol";
import "../interfaces/IIdProvider.sol";
import "../interfaces/INFTDepositBox.sol";


contract ExternalNftBaseMock is IExternalNftBase, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IDemocracy public democracy;
    address public mysteryBoxMarket;

    IMysteryBox public mysteryBox;

    IIdProvider public idProvider;
    INFTDepositBox public nftDepositBox;

    uint256 public totalUsers;

    struct User {
        string name;
        string desc; //user description
        uint256 avatarNftId;
        uint8 status; //0: non;1: upload works; 2: sponsor proposal; 3: create NFT; 4: been complained
        bool isRegistered; //false=> non-register, true=> register
    }

    mapping(address => User) public users;
    mapping(address => bool) public isManager;

    struct NFT {
        uint128 collectionId;
        uint128 indexInCollection;
    }
    // nftId => NFT
    mapping(uint256 => NFT) public allNFTs;

    uint256 public workId ;
    uint256 public collectionId;
    struct Collection {
        string name;
        string desc;
        address owner;
        uint8 status;//0: can add and remove NFT;1: created proposal; 3: created mystery box
        uint256[] nftIds;
        uint256 nextNFTId;//next index of nftIds to put in mystery box pack when call prepareMbPackage
        string url;
    }
    //workId => collectId
    mapping(uint256 => uint256) public workIdToCollectId;
    //collectId => workId
    mapping(uint256 => uint256) public override collectIdToWorkId;
    //collectionId => Collection
    mapping(uint256 => Collection) public collections;
    // userAddress => collectionId[]
    mapping(address => uint256[]) public userCollections;

    // crowdfund contract
    ICrowdFund public crowdfund;

    modifier onlyManager() {
        require(isManager[_msgSender()], "Not manager");

        _;
    }
    //onlyMysteryBoxMarket
    modifier onlyMysteryBoxMarket() {
        require(_msgSender() == mysteryBoxMarket, "Not manager");

        _;
    }

    function initialize(
        IMysteryBox _mysteryBox,
        IDemocracy _democracy,
        IIdProvider _idProvider,
        INFTDepositBox _nftDepositBox,
        ICrowdFund _crowdfund
    ) public initializer {
        __Ownable_init();
        mysteryBox = _mysteryBox;
        democracy = _democracy;
        idProvider = _idProvider;
        nftDepositBox = _nftDepositBox;
        crowdfund = _crowdfund;
    }

    function updateUserInfo(
        string memory _name,
        string memory _desc,
        //uint256 _avatarNftId,
        address _tokenAddress,
        uint256 _tokenId
    ) public returns (bool) {
        //update user info
        User storage user = users[_msgSender()];

        user.name = _name;
        user.desc = _desc;
        // withdraw old avatar NFT, then deposit new avatar NFT
        if (user.avatarNftId > 0)
            nftDepositBox.withdrawNFT(user.avatarNftId, 1);
        uint256 _nftId = nftDepositBox.depositNFTByBase(
            _tokenAddress,
            _tokenId,
            _msgSender(),
            1
        );
        user.avatarNftId = _nftId;

        if (!user.isRegistered) {
            user.isRegistered = true;
            totalUsers++;
        }
        return true;
    }

    function createCollection(
        string memory _collectionName,
        string memory _collectionDesc,
        string memory _collectionUrl
    ) public returns (uint256) {
        collectionId = idProvider.createNewCollectionId();
        workId = idProvider.createNewWorkId();
        //set mapping
        workIdToCollectId[workId] = collectionId;
        collectIdToWorkId[collectionId] = workId;

        //update collection info
        Collection storage newCollection = collections[collectionId];
        newCollection.name = _collectionName;
        newCollection.desc = _collectionDesc;
        newCollection.url = _collectionUrl;
        newCollection.owner = _msgSender();
        //add new collection into user own collection array
        userCollections[_msgSender()].push(collectionId);

        return collectionId;
    }

    function addNFTToCollection(uint256 _nftId, uint256 _collectionId) public {
        Collection storage collection = collections[_collectionId];
        NFT storage nft = allNFTs[_nftId];
        address _owner = nftDepositBox.getOwnerOfNFT(_nftId);
        require(_owner == _msgSender(), "Only NFT owner can add");
        require(
            collection.owner == _msgSender(),
            "Only collection owner can add"
        );
        require(collection.status == 0, "Cannot add NFT now");

        //only when proposal on init or fail status
        require(democracy.canModifyCollection(_collectionId), "Cannot modify");

        require(nft.collectionId == 0, "Already added");
        nft.collectionId = uint128(_collectionId);

        nftDepositBox.setNFTStatus(_nftId, true);

        // add new NFT to nftIds.
        collection.nftIds.push(_nftId);
        nft.indexInCollection = uint64(collection.nftIds.length);
    }

    function depositAndAddNFTToCollection(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _amount,
        uint256 _collectionId
    ) external {
        uint256 nftId = nftDepositBox.depositNFTByBase(
            _tokenAddress,
            _tokenId,
            _msgSender(),
            _amount
        );
        addNFTToCollection(nftId, _collectionId);
    }

    function batchDepositAndAddNFTToCollection(
        address[] memory _tokenAddresses,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        uint256 _collectionId
    ) public {
        uint256 len = _tokenIds.length;
        uint256[] memory nftIds = new uint256[](len);
        nftIds = nftDepositBox.batchDepositNFT(
            _tokenAddresses,
            _tokenIds,
            _amounts,
            _msgSender()
        );
        for (uint256 i = 0; i < len; i++) {
            addNFTToCollection(nftIds[i], _collectionId);
        }
    }

    function removeNFTFromCollection(uint256 _nftId, uint256 _collectionId) external {
        Collection storage collection = collections[_collectionId];
        NFT storage rmNFT = allNFTs[_nftId];
        require(
            collection.owner == _msgSender(),
            "Only collection owner can remove"
        );
        require(rmNFT.collectionId == _collectionId, "NFT not in collection");
        require(collection.status <= 1, "Cannot remove NFT now");
        //only when proposal on init or fail status
        require(democracy.canModifyCollection(_collectionId), "Cannot modify");

        //change NFT status on nftDepositBox contract
        nftDepositBox.setNFTStatus(_nftId, false);

        uint256 lastNFTId = collection.nftIds[collection.nftIds.length - 1];
        uint128 rmIndex = rmNFT.indexInCollection;

        collection.nftIds[rmIndex -1] = lastNFTId;
        allNFTs[lastNFTId].indexInCollection = rmIndex;
        collection.nftIds.pop();

        delete allNFTs[_nftId];
    }

    function batchRemoveNFTFromCollection(uint256 _collectionId) external {
        Collection storage collection = collections[_collectionId];
        require(
            collection.owner == _msgSender(),
            "Only collection owner can remove"
        );
        require(collection.status <= 1, "Cannot remove NFT now");
        //only when proposal on init or fail status
        require(democracy.canModifyCollection(_collectionId) || 
            democracy.canCrowdfund(_collectionId), 
            "Cannot modify");

        for(uint256 i =0; i<collection.nftIds.length; i++) {
            uint256 _nftId = collection.nftIds[i];
            require(allNFTs[_nftId].collectionId == _collectionId, "NFT not in collection");
            //change NFT status on nftDepositBox contract
            nftDepositBox.setNFTStatus(_nftId, false);

            delete allNFTs[_nftId];
        }

        (uint256[] memory _nftIds,,,uint256[] memory _amounts,,)
        = getFieldArrayOfNFTsOfCollect(_collectionId);

        nftDepositBox.batchWithdrawNFT(_nftIds,_amounts);

        delete collection.nftIds;
        delete collection.status;//collection.status == 0
    }

    function _createProposal(
        uint256 _collectionId,
        uint256 _num,
        uint256[] memory _crowdfundParams
    ) internal returns (bool) {
        require(
            _crowdfundParams.length == 5,
            "The length of _crowdfundParams need be 5"
        );
        require(
            collections[_collectionId].status == 0 &&
            collections[_collectionId].owner != address(0),
            "Cannot create proposal now"
        );

        democracy.initProposalFromBase(
            _collectionId,
            _msgSender(),
            _num,
            _crowdfundParams[0],
            _crowdfundParams[1],
            _crowdfundParams[2],
            _crowdfundParams[3],
            _crowdfundParams[4]
        );

        collections[_collectionId].status = uint8(1);
        return true;
    }

    function createProposalFinalStep(
        uint256 _collectionId,
        uint256[] memory _crowdfundParams
    ) external {
        uint256 _num = getTotalNftNumOfCollect(_collectionId);
        require(_createProposal(_collectionId,_num,_crowdfundParams),"Create proposal failed");
    }

    function createProposal(
        address[] memory _tokenAddresses,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        string memory _collectionName,
        string memory _collectionDesc,
        string memory _collectionUrl,
        uint256[] memory _crowdfundParams
    ) public {
        uint256 _collectionId = createCollection(
            _collectionName,
            _collectionDesc,
            _collectionUrl
        );
        
        batchDepositAndAddNFTToCollection(
            _tokenAddresses,
            _tokenIds,
            _amounts,
            _collectionId
        );

        uint256 _num = getTotalNftNumOfCollect(_collectionId);
        require(_createProposal(_collectionId,_num,_crowdfundParams),"Create proposal failed");
    }

    function prepareMbPackage(
        uint256 _collectionId,
        uint256 _startIndex,
        uint256 _endIndex
    ) public {
        uint256 _workId = collectIdToWorkId[_collectionId];
        uint256 _poolId = crowdfund.workId2PoolId(_workId);
        require(
            crowdfund.getCrowdfundStatus(_poolId) == 1,
            "Crowdfund must success"
        );
        _prepareMbPackage(_collectionId,_startIndex,_endIndex);
    }

    function _prepareMbPackage(
        uint256 _collectionId,
        uint256 _startIndex,
        uint256 _endIndex
    ) internal {
        Collection storage collection = collections[_collectionId];
        require(collection.nftIds.length > 0, "The length of nftIds must GT 0");
        //Only the first to the second to last nftId can be added to the mystery box package via the 'prepareMbPackage'
        require(
            _startIndex <= _endIndex &&
            _endIndex < collection.nftIds.length - 1,
            "Input index wrong"
        );
        require(
            _startIndex == collection.nextNFTId,
            "_startIndex must equal to nextNFTId"
        );

        uint256 _workId = collectIdToWorkId[_collectionId];
        uint256 _amount;
        for (uint256 i = _startIndex; i <= _endIndex; i++) {
            bool isInPackage = mysteryBox.isInPackage(
                _workId,
                collection.nftIds[i]
            );
            require(!isInPackage, "Already added");
            (, _amount) = nftDepositBox.getNFTInfo(
                collection.nftIds[i]
            );
            require(_amount > 0, "the amount of NFT must GT 0");
            mysteryBox.preparePackage(
                _workId,
                collection.nftIds[i],
                _amount
            );
            if (collection.status != 3) collection.status = 3;
        }
        //update the nextNFTId of collection;
        collection.nextNFTId = _endIndex + 1;
    }

    function _createMbPackage(uint256 _collectionId,  uint256 _poolId) public {
        Collection storage collection = collections[_collectionId];
        bool _canCreate = collection.nextNFTId == collection.nftIds.length - 1
            ? true
            : false;
        require(_canCreate, "Only create when last 2 NFT already put into mysBox");
        uint256 _workId = collectIdToWorkId[_collectionId];

        uint256 lastNFTId = collection.nftIds[collection.nftIds.length - 1];
        (, uint256 _amount) = nftDepositBox.getNFTInfo(lastNFTId);
        require(_amount > 0, "the _amount must GT 0");
        mysteryBox.createPackage(_workId, lastNFTId, _amount, _poolId, _msgSender());

        //update the nextNFTId of collection;//(collection.nftIds.length -1) +1
        collection.nextNFTId = collection.nftIds.length;

        uint256 nftIdsLength = mysteryBox.getPackageNFTsLength(_workId);
        require(
            nftIdsLength == collection.nftIds.length,
            "Cannot create before put all NFTs into mysBox"
        );
    }

    /// @notice Prepare and create mystery box package one step
    /// @param _collectionId the Id of collection which NFTs will be put into mystery box package
    /// @param _startIndex the start index of the 'fragmentNumPerCompNFT' array which values will be put into mystery box package
    /// @param _endIndex the end index of the 'fragmentNumPerCompNFT' array which values will be put into mystery box package
    /// @param _poolId the Id of pool which the mystery box package will be put into
    /// @return _whichOp 0:No operation; 1:Only has prepared, 2: Has created
    function _createMbPackageOneStep(
        uint256 _collectionId,
        uint256 _startIndex,
        uint256 _endIndex,
        uint256 _poolId
    ) internal returns(uint256 _whichOp){
        require(mysteryBox.isPoolExisted(_poolId),"The _poolId not existed");
        require(_startIndex <= _endIndex,"Input _startIndex need LT _endIndex");
        Collection storage collection = collections[_collectionId];
        require(collection.nftIds.length > 0,"len of nftIds must GT 0");
        if(collection.nftIds.length == 1) {
            _createMbPackage(_collectionId, _poolId);
            return 2;
        }

        _endIndex = _endIndex > collection.nftIds.length - 2
            ? collection.nftIds.length - 2
            : _endIndex;

        if(_startIndex <= _endIndex) {
            if(mysteryBox.isExclusivePool(_poolId)) {
                _prepareMbPackage(_collectionId, _startIndex, _endIndex);
            } else prepareMbPackage(_collectionId, _startIndex, _endIndex);
            
            _whichOp = 1;
        }

        if (_endIndex == collection.nftIds.length - 2) {
            _createMbPackage(_collectionId, _poolId);
            return 2;
        }
        return _whichOp;

    }

    /// @notice Prepare and create mystery box package one step
    /// @param _collectionId the Id of collection which NFTs will be put into mystery box package
    /// @param _startIndex the start index of the 'fragmentNumPerCompNFT' array which values will be put into mystery box package
    /// @param _endIndex the end index of the 'fragmentNumPerCompNFT' array which values will be put into mystery box package
    /// @param _poolId the Id of pool which the mystery box package will be put into
    /// @return _whichOp 0:No operation; 1:Only has prepared, 2: Has created
    function createMbPackageOneStep(
        uint256 _collectionId,
        uint256 _startIndex,
        uint256 _endIndex,
        uint256 _poolId
    ) public returns(uint256 _whichOp) {
        require(
            mysteryBox.isPoolExisted(_poolId) && 
            !mysteryBox.isExclusivePool(_poolId),
            "Need non exclusive poolId"
        );
        _whichOp = _createMbPackageOneStep(_collectionId,_startIndex,_endIndex,_poolId);
    }

    function createMbPackageAndPutIntoExclusivePool(
        address[] memory _tokenAddresses,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        string memory _collectionName,
        string memory _collectionDesc,
        string memory _collectionUrl,
        uint256 _poolId
    ) public {
        require(mysteryBox.isExclusivePool(_poolId),"Need exclusive poolId");
        require(_tokenIds.length >0,"The len of _tokenIds must GT 0");

        uint256 _collectionId = createCollection(
            _collectionName,
            _collectionDesc,
            _collectionUrl
        );
        
        batchDepositAndAddNFTToCollection(
            _tokenAddresses,
            _tokenIds,
            _amounts,
            _collectionId
        );
        
        uint256 _endIndex = _tokenIds.length - 1;

        _createMbPackageOneStep(_collectionId,0,_endIndex,_poolId);

    }

    /// @notice Pooling bonus to the collection owners whose mystery box has been bought
    /// @param _workIds the work id relative mystery box package bought
    /// @param _bonusToken the token address of bonus
    /// @param _totalBonusAmount the total amount of bonus token
    function poolingBonusToCollectOwner(
        uint256[] memory _workIds,
        address _bonusToken,
        uint256 _totalBonusAmount
    ) external override onlyMysteryBoxMarket returns (bool) {
        uint256 len = _workIds.length;
        // Use two arrays to mimic the function of mapping,
        // arr1 to store the key and arr2 to store the value
        uint256[] memory keys = new uint256[](len);
        uint256[] memory collectIds = new uint256[](len);
        uint256[] memory accNumOfCollectId = new uint256[](len);
        // Get all PoolIds corresponding to all workIds, including duplicate PoolIds
        for (uint256 i = 0; i < len; i++) {
            keys[i] = workIdToCollectId[_workIds[i]];
        }
        // Store the index corresponding to the PoolId of the last dividend
        uint256 lastAccIndex;
        // Get the collectIds of the unique CollectId array and
        // accumulate the corresponding values into the values corresponding to the same subscript
        for (uint256 i = 0; i < len; i++) {//Iterating over keys == collectIds
            for (uint256 j = 0; j < len; j++) {
                //keys == all collectIds eg.[1,1,5,3,3,1]
                //collectIds            == [1,5,3,0,0,0]
                //accNumOfCollectId[j] == [3,1,2,0,0,0]
                if (collectIds[j] == keys[i]) {
                    //keys[j] == collectIds or 0,j=>old, i=>new
                    accNumOfCollectId[j]++;
                    break;
                }
                if (collectIds[j] == 0) {
                    collectIds[j] = keys[i];
                    accNumOfCollectId[j]++;
                    lastAccIndex = j;
                    break;
                }
            }
        }

        uint256 totalTransferedAmount = 0;
        address _creator;
        uint256 transferAmountThis;
        for (uint256 i = 0; i <= lastAccIndex; i++) {
            _creator = collections[collectIds[i]].owner;
            transferAmountThis = _totalBonusAmount * accNumOfCollectId[i] / len;
            if(i == lastAccIndex) transferAmountThis = _totalBonusAmount - totalTransferedAmount;
            
            if (transferAmountThis > 0) {
                IERC20Upgradeable(_bonusToken).safeTransfer(_creator,transferAmountThis);
                totalTransferedAmount +=transferAmountThis;
            }
        }
        return true;
    }

    function setManager(address _manager, bool _flag) public onlyOwner {
        isManager[_manager] = _flag;
    }

    function getUploaderOfCollection(uint256 _collectionId)//getOwnerOfCollect
        public
        view
        returns (address)
    {
        return collections[_collectionId].owner;
    }

    function getCollectLen(uint256 _collectionId) public view returns (uint256) {//getNFTsLen
        return collections[_collectionId].nftIds.length;
    }

    function getNftIdsOfCollect(
        uint256 _collectionId,
        uint256 _startIndex,
        uint256 _endIndex
    ) public view returns (uint256[] memory) {
        uint256 len = _endIndex - _startIndex + 1;
        uint256[] memory partialIds = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            partialIds[i] = collections[_collectionId].nftIds[_startIndex + i];
        }
        return partialIds;
    }

    function getAllNFTIdsOfCollect(uint256 _collectionId) public view returns (uint256[] memory){
        return collections[_collectionId].nftIds;
    }

    function isNFTOfCollect(uint256 _nftId, uint256 _collectionId) public view returns (bool){
        return allNFTs[_nftId].collectionId == _collectionId ? true :false;
    }

    function getUserCollectLen(address _userAddr) public view returns (uint256){
        return userCollections[_userAddr].length;
    }

    function getFieldArrayOfNFTsOfCollect(uint256 _collectionId)
        public
        view
    returns (
        uint256[] memory _nftIds,
        address[] memory _tokenAddresses,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        address[] memory _owners,
        uint32[] memory _nftTypes
    )
    {
        uint256 realLen = collections[_collectionId].nftIds.length;
        _nftIds = new uint256[](realLen);
        _tokenAddresses = new address[](realLen);
        _tokenIds = new uint256[](realLen);
        _owners = new address[](realLen);
        _amounts = new uint256[](realLen);
        _nftTypes = new uint32[](realLen);

        for (uint256 i = 0; i < realLen; i++) {
            (
                _tokenAddresses[i],
                _tokenIds[i],
                _amounts[i],
                _owners[i],
                _nftTypes[i],
            ) = nftDepositBox.allNFTs(collections[_collectionId].nftIds[i]);

        }
        _nftIds = collections[_collectionId].nftIds;
    }

    function getCollectInfo(uint256 _collectionId)
        public
        view
        override
        returns (string memory,string memory,string memory)
    {
        return (collections[_collectionId].name,collections[_collectionId].desc,collections[_collectionId].url);
    }

    // for test
    function modifyCollectionStatus(uint256 _collectionId, uint8 _s) public {
        Collection storage collection = collections[_collectionId];
        collection.status = _s;
    }

    function getTotalNftNumOfCollect(uint _collectionId) public view returns(uint) {
        Collection storage collect = collections[_collectionId];
        uint256 nftLen = collect.nftIds.length;
        uint256 totalNftNum;
        for(uint256 i =0; i < nftLen; i++) {
            (,uint256 _amount) = nftDepositBox.getNFTInfo(collect.nftIds[i]);
            if(_amount >0) totalNftNum += _amount;
        }

        return totalNftNum;
    }
}
