// Copyright (C) 2021 Cycan Technologies
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/INFTFactory.sol";
import "../interfaces/IMysteryBox.sol";
import "../interfaces/IDemocracy.sol";
import "../interfaces/IBase.sol";
import "../interfaces/IIdProvider.sol";
import "../interfaces/IExternalNftBase.sol";

contract BaseMock is IBase, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public crowdfund;
    IDemocracy public democracy;
    uint256 public minFragmentNum;

    INFTFactory public nft;
    IMysteryBox public mysteryBox;
    uint256 public totalUsers;
    IIdProvider public idProvider;

    struct User {
        string name;
        string desc; //user description
        uint256 avatarNftId;
        uint8 status; //0=> non,1=> upload works, 2=> sponsor proposal 3=> create NFT, 4=> been complained
        bool isRegistered; //false=> non-register, true=> register
    }
    mapping(address => User) public users;
    mapping(address => bool) public isManager;

    uint256 public workId;
    struct Work {
        string name;
        string url; // work Cid + store the method of split and whole fragment data
        address uploader;
        uint256 completeNftId; //only one ,id => totalSupply,totalSupply > 1
        uint64 completeNftNum; //min == 0
        uint64 compToFragNftNum; //how many complete NFTs split//min == 1
        uint64 fragmentNumPerCompNFT; //the number of one complete NFT split//min == 10
        uint32 status; //0 => have not created mysteryPackage, >0 => have, and status stand for how many NFTid put into mystery
    }

    mapping(uint256 => Work) public works;

    uint256 public collectionId;
    struct Collection {
        string name;
        string desc;
        string url;
        uint256[] workIds;
    }
    mapping(uint256 => Collection) public collections;
    mapping(address => uint256[]) public userCollections;

    // ExternalNftBase contract
    IExternalNftBase public externalNftBase;
    // max number of tokenIds of each collection
    uint32 public maxTokenIdsNum;
    //collection Id => the number of tokenIds of this collection
    mapping(uint256 => uint256) public totalTokenIdsNumOfCollect;

    modifier onlyManager() {
        require(isManager[_msgSender()], "Not manager");

        _;
    }

    function initialize(
        INFTFactory _nft,
        IMysteryBox _mysteryBox,
        IDemocracy _democracy,
        address _crowdfund,
        IIdProvider _idProvider,
        IExternalNftBase _externalNftBase
    ) public initializer {
        __Ownable_init();
        nft = _nft;
        mysteryBox = _mysteryBox;
        minFragmentNum = 4;
        democracy = _democracy;
        crowdfund = _crowdfund;
        idProvider =_idProvider;
        externalNftBase = _externalNftBase;
        maxTokenIdsNum = 200;
    }

    function setCrowdfund(address _crowdfund) public onlyOwner {
        require(_crowdfund != address(0), "Not 0x00");
        crowdfund = _crowdfund;
    }

    function updateUserInfo(
        string memory _name,
        string memory _desc,
        uint256 _avatarNftId
    ) public returns (bool) {
        //update user info
        User storage user = users[_msgSender()];
        user.name = _name;
        user.desc = _desc;
        if (_avatarNftId > 0) {
            //check _avatarNftId's owner is or not _msgSender()
            require(
                nft.balanceOf(_msgSender(), _avatarNftId) > 0,
                "msgSender has not this NFT"
            );
            user.avatarNftId = _avatarNftId;
        }
        if (!user.isRegistered) {
            user.isRegistered = true;
            totalUsers++;
        }
        return true;
    }

    function modifyUserStatus(address _userAddr, uint8 _statusNum)
        public
        onlyManager
        returns (bool)
    {
        users[_userAddr].status = _statusNum;
        return true;
    }

    function addWorks(
        string memory _collectionName,
        string memory _collectionDesc,
        string memory _collectionUrl,
        string[] memory _workNames,
        string[] memory _urls,
        uint64[] memory _completeNftNums,
        uint64[] memory _compToFragNftNums,
        uint64[] memory _fragNumPerCompNFTs
    ) public returns (uint256) {
        uint256 len = _workNames.length;
        require(len > 0, "Len must GT 0");
        require(
            _workNames.length == _urls.length &&
                _workNames.length == _completeNftNums.length &&
                _workNames.length == _compToFragNftNums.length &&
                _workNames.length == _fragNumPerCompNFTs.length,
            "Array length must match"
        );

        //update collection info
        collectionId = idProvider.createNewCollectionId();

        Collection storage newCollection = collections[collectionId];
        newCollection.name = _collectionName;
        newCollection.desc = _collectionDesc;
        newCollection.url = _collectionUrl;
        uint256 sumTokenIdsNum = totalTokenIdsNumOfCollect[collectionId];
        //update work info
        for (uint256 i = 0; i < len; i++) {
            require(_compToFragNftNums[i] > 0, "CompToFragNftNum must GT 0"); //min ==1
            require(
                _fragNumPerCompNFTs[i] >= minFragmentNum,
                "fragmentNumPerCompNFT need GT minFragmentNum"
            );

            sumTokenIdsNum += (_fragNumPerCompNFTs[i] + 1);
            require(sumTokenIdsNum <= maxTokenIdsNum,"Too many works and fragments");

            workId = idProvider.createNewWorkId();
            Work storage newWork = works[workId];
            newWork.name = _workNames[i];
            newWork.uploader = _msgSender();
            newWork.url = _urls[i];
            newWork.completeNftNum = _completeNftNums[i];
            newWork.compToFragNftNum = _compToFragNftNums[i];
            newWork.fragmentNumPerCompNFT = _fragNumPerCompNFTs[i];
            //update collection info
            newCollection.workIds.push(workId);
        }
        totalTokenIdsNumOfCollect[collectionId] = sumTokenIdsNum;

        //add new collection into user own collection array
        userCollections[_msgSender()].push(collectionId);

        return collectionId;
    }


    /// @dev Create a collection and a proposal with adding works into the collection
    /// @param _crowdfundParams Including _crowdfundRatio,_dividendRatio,_duration,_maxJoinAmount,_valuation
    function createProposal(
        string memory _collectionName,
        string memory _collectionDesc,
        string memory _collectionUrl,
        string[] memory _workNames,
        string[] memory _urls,
        uint64[] memory _completeNftNums,
        uint64[] memory _compToFragNftNums,
        uint64[] memory _fragNumPerCompNFTs,
        uint256[] memory _crowdfundParams
    ) public returns (bool) {
        require(_crowdfundParams.length == 5,"The length of _crowdfundParams need be 5");
        uint256 _collectionId = addWorks(
            _collectionName,
            _collectionDesc,
            _collectionUrl,
            _workNames,
            _urls,
            _completeNftNums,
            _compToFragNftNums,
            _fragNumPerCompNFTs
        );
        uint256 _len = _workNames.length;
        democracy.initProposalFromBase(_collectionId, _msgSender(), _len,_crowdfundParams[0],_crowdfundParams[1],_crowdfundParams[2],_crowdfundParams[3],_crowdfundParams[4]);
        return true;
    }

    function addWorksIntoCollection(
        uint256 _collectionId,
        string[] memory _workNames,
        string[] memory _urls,
        uint64[] memory _completeNftNums,
        uint64[] memory _compToFragNftNums,
        uint64[] memory _fragNumPerCompNFTs
    ) public returns (bool) {
        require(
            works[collections[_collectionId].workIds[0]].uploader ==
                _msgSender(),
            "uploader must be same"
        );
        require(
            works[collections[_collectionId].workIds[0]].completeNftId == 0,
            "Only add before collection create NFT"
        );
        require(_collectionId <= collectionId, "collectionId is not existed");
        require(democracy.canModifyCollection(_collectionId), "Cannot modify");
        uint256 len = _workNames.length;
        require(len > 0, "Len must GT 0");
        require(
            _workNames.length == _urls.length &&
                _workNames.length == _completeNftNums.length &&
                _workNames.length == _compToFragNftNums.length &&
                _workNames.length == _fragNumPerCompNFTs.length,
            "Array length must match"
        );

        Collection storage collection = collections[_collectionId];
        uint256 sumTokenIdsNum = totalTokenIdsNumOfCollect[_collectionId];
        //update work info
        for (uint256 i = 0; i < len; i++) {
            require(_compToFragNftNums[i] > 0, "CompToFragNftNum must GT 0"); //min ==1
            require(
                _fragNumPerCompNFTs[i] >= minFragmentNum,
                "fragmentNumPerCompNFT need GT minFragmentNum"
            );
            sumTokenIdsNum += (_fragNumPerCompNFTs[i] + 1);
            require(sumTokenIdsNum <= maxTokenIdsNum,"Too many works and fragments");
            workId = idProvider.createNewWorkId();
            Work storage newWork = works[workId];
            newWork.name = _workNames[i];
            newWork.uploader = _msgSender();
            newWork.url = _urls[i];
            newWork.completeNftNum = _completeNftNums[i];
            newWork.compToFragNftNum = _compToFragNftNums[i];
            newWork.fragmentNumPerCompNFT = _fragNumPerCompNFTs[i];

            collection.workIds.push(workId);
        }
        totalTokenIdsNumOfCollect[_collectionId] = sumTokenIdsNum;
        return true;
    }

    function deleteWorkOfCollect(uint256 _workId, uint256 _collectionId)
        public
        override
        returns (bool)
    {
        require(
            works[_workId].uploader == _msgSender(),
            "msg.sender is not uploader"
        );
        require(
            works[_workId].completeNftId == 0,
            "Only call before create NFT"
        );

        require(democracy.canModifyCollection(_collectionId), "Cannot modify");
        uint256 worksLen = getCollectLen(_collectionId);
        for (uint256 i = 0; i < worksLen; i++) {
            if (collections[_collectionId].workIds[i] == _workId) {
                collections[_collectionId].workIds[i] = collections[
                    _collectionId
                ].workIds[worksLen - 1];
                collections[_collectionId].workIds.pop();
                break;
            }
        }
        totalTokenIdsNumOfCollect[_collectionId] -= (works[_workId].fragmentNumPerCompNFT + 1);
        return true;
    }

    function updateWorks(
        uint256[] memory _workIds,
        string[] memory _names,
        string[] memory _urls,
        uint64[] memory _completeNftNums,
        uint64[] memory _compToFragNftNums,
        uint64[] memory _fragNumPerCompNFTs
    ) external returns (bool) {
        uint256 len = _names.length;
        require(len > 0, "Len must GT 0");
        require(
            _names.length == _workIds.length &&
                _names.length == _urls.length &&
                _names.length == _completeNftNums.length &&
                _names.length == _compToFragNftNums.length &&
                _names.length == _fragNumPerCompNFTs.length,
            "Array length must match"
        );
        for (uint256 i = 0; i < len; i++) {
            bool _bo = updateOneWork(
                _workIds[i],
                _names[i],
                _urls[i],
                _completeNftNums[i],
                _compToFragNftNums[i],
                _fragNumPerCompNFTs[i]
            );
            require(_bo, "updateOneWork false");
        }

        return true;
    }

    function updateOneWork(
        uint256 _workId,
        string memory _name,
        string memory _url,
        uint64 _completeNftNum,
        uint64 _compToFragNftNum,
        uint64 _fragNumPerCompNFT
    ) public returns (bool) {
        Work storage work = works[_workId];
        require(work.uploader == _msgSender(), "msg.sender is not uploader");
        require(work.completeNftId == 0, "Only call before create NFT");
        work.name = _name;
        work.url = _url;
        work.completeNftNum = _completeNftNum;
        work.compToFragNftNum = _compToFragNftNum;
        work.fragmentNumPerCompNFT = _fragNumPerCompNFT;
        return true;
    }

    function fulfillWorkNftInfo(uint256 _workId, uint256 _completeNftId)
        external
        override
        returns (bool)
    {
        require(crowdfund == _msgSender(), "Not crowdfund contract");
        require(works[_workId].completeNftId == 0, "Already fulfill NFT info");

        works[_workId].completeNftId = _completeNftId;
        return true;
    }

    function prepareMbPackage(
        uint256 _workId,
        uint256 _startIndex,
        uint256 _endIndex
    ) public {
        (
            bool _canPrepare,
            uint256 _compToFragNftNum,
            uint256[] memory _partialFragNftIds
        ) = getFragNftInfosOfWork(_workId, _startIndex, _endIndex);
        require(_canPrepare, "Cannot prepare");

        _endIndex = _endIndex > works[_workId].fragmentNumPerCompNFT - 2
            ? works[_workId].fragmentNumPerCompNFT - 2
            : _endIndex;
        require(
            _endIndex < type(uint32).max,
            "_endIndex need LT the max value of type uint32"
        );

        uint256 nftIdsLength = mysteryBox.getPackageNFTsLength(_workId);
        if (nftIdsLength == 0 && works[_workId].completeNftNum > 0)
            mysteryBox.preparePackage(
                _workId,
                works[_workId].completeNftId,
                works[_workId].completeNftNum
            );

        for (uint256 i = _startIndex; i <= _endIndex; i++) {

            bool isInPackage = mysteryBox.isInPackage(
                _workId,
                _partialFragNftIds[i - _startIndex]
            );
            require(!isInPackage, "Already added");
            mysteryBox.preparePackage(
                _workId,
                _partialFragNftIds[i - _startIndex],
                _compToFragNftNum
            );
        }
        //update work status;
        works[_workId].status = uint32(_endIndex + 1);
    }

    function createMbPackage(uint256 _workId, uint256 _poolId) public {
        bool _canCreate = works[_workId].completeNftId > 0 ? true : false;
        require(_canCreate, "Cannot create");

        uint256 lastFragmentId = works[_workId].completeNftId +
            works[_workId].fragmentNumPerCompNFT;
        mysteryBox.createPackage(
            _workId,
            lastFragmentId,
            works[_workId].compToFragNftNum,
            _poolId,
            _msgSender()
        );

        //update work status;
        works[_workId].status = uint32(works[_workId].fragmentNumPerCompNFT);

        uint256 nftIdsLength = mysteryBox.getPackageNFTsLength(_workId);
        require(
            nftIdsLength == works[_workId].fragmentNumPerCompNFT + 1,
            "Cannot create before put all NFTs into box"
        );
    }

    /// @notice Prepare and create mystery box package one step
    /// @param _workId the Id of work which NFTs will be put into mystery box package
    /// @param _startIndex the start index of the 'fragmentNumPerCompNFT' array which values will be put into mystery box package
    /// @param _endIndex the end index of the 'fragmentNumPerCompNFT' array which values will be put into mystery box package
    /// @param _poolId the Id of pool which the mystery box package will be put into
    /// @return _whichOp 0:No operation; 1:Only has prepared, 2: Has created
    function createMbPackageOneStep(
        uint256 _workId,
        uint256 _startIndex,
        uint256 _endIndex,
        uint256 _poolId
    ) public returns(uint256 _whichOp){
        prepareMbPackage(_workId, _startIndex, _endIndex);
        _whichOp = 1;
        _endIndex = _endIndex > works[_workId].fragmentNumPerCompNFT - 2
            ? works[_workId].fragmentNumPerCompNFT - 2
            : _endIndex;
        if (_endIndex == works[_workId].fragmentNumPerCompNFT - 2) {
            createMbPackage(_workId, _poolId);
            _whichOp = 2;
        }

    }
    function setMaxTokenIdsNum(uint32 _newNum) public onlyManager {
        maxTokenIdsNum = _newNum;
    }

    function setManager(address _manager, bool _flag) public onlyOwner {
        isManager[_manager] = _flag;
    }

    function setMinFragmentNum(uint256 _newNum) public onlyManager {
        minFragmentNum = _newNum;
    }

    function getCollectLen(uint256 _collectionId)
        public
        view
        override
        returns (uint256)
    {
        return collections[_collectionId].workIds.length;
    }

    function getWorkIdsOfCollection(
        uint256 _collectionId,
        uint256 _startIndex,
        uint256 _endIndex
    ) public view override returns (uint256[] memory) {
        uint256 len = _endIndex - _startIndex + 1;
        uint256[] memory partialIds = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            partialIds[i] = collections[_collectionId].workIds[_startIndex + i];
        }
        return partialIds;
    }

    function getAllWorkIdsOfCollection(uint256 _collectionId)
        public
        view
        override
        returns (uint256[] memory)
    {
        return collections[_collectionId].workIds;
    }

    function getWorkInfo(uint256 _workId)
        public
        view
        override
        returns (string memory _url, uint256[] memory nums)
    {
        Work storage work = works[_workId];
        nums = new uint256[](3);
        nums[0] = work.completeNftNum;
        nums[1] = work.compToFragNftNum;
        nums[2] = work.fragmentNumPerCompNFT;
        return (work.url, nums);
    }

    function getFragNftInfosOfWork(
        uint256 _workId,
        uint256 _startIndex,
        uint256 _endIndex
    )
        public
        view
        override
        returns (
            bool _canCreate,
            uint256 _compToFragNftNum,
            uint256[] memory _partialFragNftIds
        )
    {
        Work storage work = works[_workId];
        uint256 fragmentNftIdsLen = work.fragmentNumPerCompNFT;
        require(
            _startIndex <= _endIndex && _endIndex <= fragmentNftIdsLen - 1,
            "Index wrong"
        );
        _canCreate = work.completeNftId > 0 ? true : false;
        _compToFragNftNum = work.compToFragNftNum;
        _partialFragNftIds = new uint256[](_endIndex - _startIndex + 1);
        for (uint256 i = _startIndex; i <= _endIndex; i++) {
            _partialFragNftIds[i - _startIndex] = work.completeNftId + (i + 1);
        }
    }

    function isWorkOfCollection(uint256 _workId, uint256 _collectionId)
        public
        view
        override
        returns (bool)
    {
        uint256 worksLen = getCollectLen(_collectionId);
        for (uint256 i = 0; i < worksLen; i++) {
            if (collections[_collectionId].workIds[i] == _workId) {
                return true;
            }
        }
        return false;
    }

    function getUserCollectLen(address _userAddr)
        public
        view
        returns (uint256)
    {
        return userCollections[_userAddr].length;
    }

    function getWorksInfo(uint256[] memory _workIds)
        public
        view
        returns (Work[] memory)
    {
        uint256 len = _workIds.length;
        require(len > 0, "len must GT 0");
        Work[] memory workInfos = new Work[](len);
        for (uint256 i = 0; i < len; i++) {
            workInfos[i] = works[_workIds[i]];
        }
        return workInfos;
    }

    function getWorksOfCollect(uint256 _collectionId)
        public
        view
        returns (Work[] memory)
    {
        uint256 realLen = getCollectLen(_collectionId);
        uint256[] memory _workIds = new uint256[](realLen);
        for (uint256 i = 0; i < realLen; i++) {
            _workIds[i] = collections[_collectionId].workIds[i];
        }

        return getWorksInfo(_workIds);
    }

    function getFieldArrayOfWorksOfCollect(uint256 _collectionId)
        public
        view
        returns (
            uint256[] memory _workIds,
            string[] memory _workNames,
            string[] memory _urls,
            address[] memory _uploaders,
            uint64[] memory _completeNftNums,
            uint64[] memory _compToFragNftNums,
            uint64[] memory _fragNumPerCompNFTs,
            uint32[] memory _statuses
        )
    {
        uint256 realLen = getCollectLen(_collectionId);
        _workIds = new uint256[](realLen);
        _workNames = new string[](realLen);
        _urls = new string[](realLen);
        _uploaders = new address[](realLen);
        _completeNftNums = new uint64[](realLen);
        _compToFragNftNums = new uint64[](realLen);
        _fragNumPerCompNFTs = new uint64[](realLen);
        _statuses = new uint32[](realLen);
        for (uint256 i = 0; i < realLen; i++) {
            Work storage work = works[collections[_collectionId].workIds[i]];
            _workNames[i] = work.name;
            _uploaders[i] = work.uploader;
            _urls[i] = work.url;
            _completeNftNums[i] = work.completeNftNum;
            _compToFragNftNums[i] = work.compToFragNftNum;
            _fragNumPerCompNFTs[i] = work.fragmentNumPerCompNFT;
            _statuses[i] = work.status;
        }
        _workIds = collections[_collectionId].workIds;
    }

    function getUploaderOfCollection(uint256 _collectionId)
        public
        view
        override
        returns (address)
    {
        return works[collections[_collectionId].workIds[0]].uploader;
    }

    function getCollectInfo(uint256 _collectionId)
        public
        view
        returns (string memory,string memory,string memory)
    {
        if(_collectionId % 2 == 0) return externalNftBase.getCollectInfo(_collectionId);

        return (collections[_collectionId].name,collections[_collectionId].desc,collections[_collectionId].url);
    }
    
    // for test
    function setCollectionId(uint256 _collId) public {
        collectionId = _collId;
    }

    function getTotalNftNumOfCollect(uint _collectionId) external view override returns(uint) {
        Collection storage collect = collections[_collectionId];
        uint256 workLen = collect.workIds.length;
        uint256 totalNftNum;
        for(uint256 i =0; i < workLen; i++) {
            Work storage work = works[collect.workIds[i]];
            totalNftNum += (work.completeNftNum + work.compToFragNftNum * work.fragmentNumPerCompNFT);
        }

        return totalNftNum;
    }

}
