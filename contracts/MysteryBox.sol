// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "./interfaces/IMysteryBox.sol";

contract MysteryBox is Context, Initializable, IMysteryBox{

	address payable public owner;
	/// @notice admin address => bool
	mapping(address => bool) public admin;
	/// @notice internal contract address => bool
	mapping(address => bool) public internalCaller;

	/// @notice mystery box package struct
	/// @param worksId the works id is equal to mystery box package id
	/// @param NFTtokenID the NFT tokenId representative NFT species
	/// @param NFTCount the number of NFTs per species
	/// @param total the total number of all NFTs
	/// @param pools record the pool in which the mystery box package is located
	/// @param poolIndex the index of pool in 'pools' array
	/// @param remNFTCount the number of NFTs left per species
	/// @param remained the total number of NFTs left
	/// @param unsoldTotal the number of NFTs unsold
	/// @param state the state number of BoxPackage, 0:uncreated, 1:created  2:sold
	struct BoxPackage {
		uint   worksId;
		uint[] NFTtokenID;
		mapping(uint => uint)  NFTCount;
		uint  total;
		uint[]  pools;
		mapping(uint => uint) poolIndex;
		mapping(uint => uint)  remNFTCount;
		uint  remained;
		uint  unsoldTotal;
		uint32 state;
	}

	/// @notice poolId Sequence number, used to generate new poolId
	uint poolIdSeq;
	/// @notice poolId array The set of mystery box pools The first one, with PoolId 0, is the main pool
	uint[] public pools;
	/// @notice poolId => index of mystery box poolId list
	mapping(uint => uint) public poolsIndex;

	/// @notice worksId => boxPackage, worksId is equal to mystery box package id
	mapping(uint => BoxPackage) public boxPackages;

	/// @notice poolId => boxPool
	mapping(uint => BoxPool) public boxPools;
	/// @notice poolId => mystery box package id array
	mapping(uint => uint[]) public packages;
	/// @notice poolId => worksId => index of mystery box package id array,
	/// Record the position of the mystery box package id array
	mapping(uint => mapping(uint => uint)) public packIndex;

	/// @inheritdoc IMysteryBox
	uint public override minFeeRatio;
	/// @inheritdoc IMysteryBox
	uint public override maxFeeDiscount;

	/// @notice poolId => the creator of pool
	mapping(uint => address) public poolCreator;

	/// @notice poolId => the allowed user => allowed flag 'true' or 'false'
	mapping(uint => mapping(address => bool)) public isAllowedUser;

	/// @notice MBPoolAdmin contract address
	address public MBPoolAdmin;

	/// @notice The length of the pool Id list created with the admin
	uint public lenOfPoolIdsCreatedByAdmin;

	/// @notice pool creator => exclusive poolId list created by the creator
	mapping(address => uint[]) public exPoolIdListOfCreator;

	/// @notice exPoolId => index of mystery box pool id list
	mapping(uint => uint) public exPoolId2Index;

	/// @notice allowed user => exclusive poolId list which user can put mystery box package in
	mapping(address => uint[]) public allowedPoolIdListOfUser;
	/// @notice allowed user => allowed poolId => index of 'allowedPoolIdListOfUser' list
	mapping(address => mapping(uint => uint)) public allowedPoolId2User2Index;


	modifier onlyOwner() {
		require(owner == _msgSender(), "MysteryBox: caller is not the owner");
		_;
	}

	modifier  onlyAdmin() {
		require(admin[_msgSender()], "MysteryBox: caller is not a admin");
		_;
	}

	modifier  onlyInternal() {
		require(internalCaller[_msgSender()], "Internalable: caller is not a internal caller");
		_;
	}

	constructor(){}

	/// @notice Initialisation function generate the main pool and Initialize system params
	function initialize(address payable ownerAddr, address _MBPoolAdmin) public initializer{
		owner = ownerAddr;
		MBPoolAdmin = _MBPoolAdmin;
		admin[ownerAddr] = true;
		admin[MBPoolAdmin] = true;

		poolIdSeq = 0;
		uint poolId = poolIdSeq;
		poolIdSeq += 1;

		pools.push(poolId);
		poolsIndex[poolId] = pools.length;

		BoxPool storage boxPool = boxPools[poolId];
		boxPool.poolId = poolId;
		boxPool.name = "main";
		boxPool.price = 1e24;//init price 100 million HIP
		boxPool.feeRatio = 1000;
		boxPool.ownerRatio = 7000;
		boxPool.fundRatio = 0;
		boxPool.rewardRatio = 2000;
		boxPool.isValid = true;

		minFeeRatio = 500;
		maxFeeDiscount = 0;

		lenOfPoolIdsCreatedByAdmin++;
		emit CreatePool(_msgSender(), poolId, "main");
	}

	function setAdmin(address admin_, bool set_) public onlyOwner{
		admin[admin_] = set_;
	}

	function setInternalCaller(address internal_, bool set_) public onlyOwner{
		internalCaller[internal_] = set_;
	}

	/// @inheritdoc IMysteryBox
	function createPool(uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_, uint price_, string memory name_) public onlyAdmin override returns(uint){
		require(feeRatio_ + ownerRatio_ + fundRatio_ + rewardRatio_ == 10000, "Ration sum not equ 100%");
		if(feeRatio_ < minFeeRatio){
			require( feeRatio_ >= maxFeeDiscount, "feeRatio less than maxFeeDiscount");
			minFeeRatio = feeRatio_;
		}

		uint poolId = poolIdSeq;
		poolIdSeq += 1;

		pools.push(poolId);
		poolsIndex[poolId] = pools.length;

		BoxPool storage boxPool = boxPools[poolId];
		boxPool.poolId = poolId;
		boxPool.name = name_;
		boxPool.price = price_;
		boxPool.feeRatio = feeRatio_;
		boxPool.ownerRatio = ownerRatio_;
		boxPool.fundRatio = fundRatio_;
		boxPool.rewardRatio = rewardRatio_;
		boxPool.isValid = true;

		// _msgSender() is MBPoolAdmin contract, tx.origin pay to create pool
		if(tx.origin != _msgSender()) {
			poolCreator[poolId] = tx.origin;

			exPoolIdListOfCreator[tx.origin].push(poolId);
			exPoolId2Index[poolId] = exPoolIdListOfCreator[tx.origin].length;
		} else {
			lenOfPoolIdsCreatedByAdmin++;
		}

		emit CreatePool(_msgSender(), poolId, name_);
		return poolId;
	}

	/// @notice Delete sub-pool and the first in the array is the main pool id
	/// @param poolId_ the poolId of sub pool cannot be 0
	function deletePool(uint poolId_) public onlyAdmin{
		require(poolsIndex[poolId_] > 1, "Not exist the child pool");
		BoxPool storage boxPool = boxPools[poolId_];
		require(packages[poolId_].length == 0, "The child pool has box packages");

		string memory name = boxPool.name;
		uint feeRatio = boxPool.feeRatio;

		//delete boxPool;
		pools[poolsIndex[poolId_]-1] = pools[pools.length - 1];
		poolsIndex[pools[pools.length - 1]] = poolsIndex[poolId_];

		pools.pop();
		delete poolsIndex[poolId_];

		if(feeRatio == minFeeRatio && pools.length <= 100) {
			feeRatio = boxPools[pools[0]].feeRatio;
			for(uint i=1; i< pools.length; i++){
				if(boxPools[pools[i]].feeRatio < feeRatio )  feeRatio = boxPools[pools[i]].feeRatio;
			}
			minFeeRatio = feeRatio;
		}

		if(poolCreator[poolId_] != address(0)) {
			// delete exPool data
			delete poolCreator[poolId_];
			if(exPoolIdListOfCreator[_msgSender()].length > 0) {
				uint lastId = exPoolIdListOfCreator[_msgSender()][exPoolIdListOfCreator[_msgSender()].length -1];
				exPoolIdListOfCreator[_msgSender()][exPoolId2Index[poolId_] -1] = lastId;
				exPoolId2Index[lastId] = exPoolId2Index[poolId_];
				exPoolIdListOfCreator[_msgSender()].pop();
			}
		}else {
			if(lenOfPoolIdsCreatedByAdmin > 0) lenOfPoolIdsCreatedByAdmin--;
		}

		emit DeletePool(_msgSender(), poolId_,  name);
	}

	/// @notice Amend minimum fee ratio (correction of minimum fee ratio is required when a sub-pool is deleted and the commission of this sub-pool is the minimum commission)
	function amendMinFeeRatio(uint minFeeRatio_) public onlyAdmin {
		require(minFeeRatio >= maxFeeDiscount, "feeRatio less than maxFeeDiscount");
		require(pools.length > 100, "No need to amend minFeeRatio");
		uint feeRatio = boxPools[pools[0]].feeRatio;
		for(uint i=1; i< 100; i++){
			if(boxPools[pools[i]].feeRatio < feeRatio )  feeRatio = boxPools[pools[i]].feeRatio;
		}
		require(minFeeRatio_ <= feeRatio, "Parameter is error");

		minFeeRatio = minFeeRatio_;
	}

	/// @inheritdoc IMysteryBox
	function setIsAllowedUser(uint poolId_, address[] memory userAddrs, bool set_) virtual override external {
		require(poolCreator[poolId_] == _msgSender(),"Only the creator of pool can call");
		uint len = userAddrs.length;
		require(len > 0,"The len of userAddrs must GT 0");
		for(uint i =0; i < len; i++) {
			isAllowedUser[poolId_][userAddrs[i]] = set_;
			if(set_) {
				allowedPoolIdListOfUser[userAddrs[i]].push(poolId_);
				allowedPoolId2User2Index[userAddrs[i]][poolId_] = allowedPoolIdListOfUser[userAddrs[i]].length;
			} else {
				if(allowedPoolIdListOfUser[userAddrs[i]].length >0) {
					uint lastId =allowedPoolIdListOfUser[userAddrs[i]][allowedPoolIdListOfUser[userAddrs[i]].length -1];
					allowedPoolIdListOfUser[userAddrs[i]][allowedPoolId2User2Index[userAddrs[i]][poolId_] - 1] = lastId;
					allowedPoolId2User2Index[userAddrs[i]][lastId] = allowedPoolId2User2Index[userAddrs[i]][poolId_];
					allowedPoolIdListOfUser[userAddrs[i]].pop();
				}

			}
		}
	}

	/// @notice Modify the share of each property of the pool
	function setPoolShareRatio(uint poolId_, uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_) public onlyAdmin{
		BoxPool storage boxPool = boxPools[poolId_];
		require(poolsIndex[poolId_] > 0 && boxPool.poolId == poolId_, "Not exist the pool");
		require(feeRatio_ + ownerRatio_ + fundRatio_ + rewardRatio_ == 10000, "Ration sum not equ 100%");
		if(feeRatio_ < minFeeRatio){
			require( feeRatio_ >= maxFeeDiscount, "feeRatio less than maxFeeDiscount");
			minFeeRatio = feeRatio_;
		}

		boxPool.feeRatio = feeRatio_;
		boxPool.ownerRatio = ownerRatio_;
		boxPool.fundRatio = fundRatio_;
		boxPool.rewardRatio = rewardRatio_;
	}

	/// @notice Modify the 'price' attribute of the pool
	function setPoolPrice(uint poolId_, uint price_) public onlyAdmin{
		BoxPool storage boxPool = boxPools[poolId_];
		require(boxPool.poolId == poolId_ && poolsIndex[poolId_] > 0, "Not exist the pool");
		boxPool.price = price_;
	}

	/// @notice Modify the 'isValid' attribute of the pool
	function setPoolValidity(uint poolId_, bool isValid_) public onlyAdmin{
		BoxPool storage boxPool = boxPools[poolId_];
		require(poolsIndex[poolId_] > 0 && boxPool.poolId == poolId_, "Not exist the pool");
		boxPool.isValid = isValid_;
	}

	/// @notice Modify the 'name' attribute of the pool
	function setPoolName(uint poolId_, string memory name_) public onlyAdmin{
		BoxPool storage boxPool = boxPools[poolId_];
		require(poolsIndex[poolId_] > 0 && boxPool.poolId == poolId_, "Not exist the pool");
		boxPool.name = name_;
	}

	/// @inheritdoc IMysteryBox
	function preparePackage(uint worksId_, uint NFTtokenId_, uint count_) public virtual override  onlyInternal{
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state == 0, "The MysteryBox has been created");
		pack.NFTtokenID.push(NFTtokenId_);
		pack.NFTCount[NFTtokenId_] = count_;
		pack.total += count_;
		pack.remNFTCount[NFTtokenId_] = count_;
	}

	/// @inheritdoc IMysteryBox
	function createPackage(uint worksId_, uint NFTtokenId_, uint count_, uint poolId_, address operator_) public virtual override onlyInternal{
		require(poolsIndex[poolId_] > 0, "Not exist this pool");
		if(poolCreator[poolId_] != address(0)) {
			require(
				isAllowedUser[poolId_][operator_] ||
				poolCreator[poolId_] == operator_,
				"The operator_ cannot put pack into this pool"
			);
		}
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state == 0, "The MysteryBox has been created");
		pack.NFTtokenID.push(NFTtokenId_);
		pack.NFTCount[NFTtokenId_] = count_;
		pack.total += count_;
		pack.remNFTCount[NFTtokenId_] = count_;

		pack.pools.push(poolId_);
		pack.poolIndex[poolId_] = pack.pools.length;

		pack.remained = pack.total;
		pack.unsoldTotal = pack.total;
		pack.state = 1;

		packages[poolId_].push(worksId_);
		packIndex[poolId_][worksId_] = packages[poolId_].length;

		emit CreatePackage(_msgSender(), worksId_, pack.total);
	}

	/// @notice Clear mystery box package from all pools when all NFTs in mystery box are sold
	function clearPackage(uint worksId_) internal{
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state == 2, "The mysteryBox is not in saled out state");
		for(uint i=0; i<pack.pools.length; i++){
			uint poolId = pack.pools[i];

			if(packIndex[poolId][worksId_] > 0) {
				uint worksIdLast = packages[poolId][packages[poolId].length - 1];
				packages[poolId][packIndex[poolId][worksId_] -1 ] = worksIdLast;
				packIndex[poolId][worksIdLast] = packIndex[poolId][worksId_];
				delete packages[poolId][packages[poolId].length - 1];
				delete packIndex[poolId][worksId_];
				packages[poolId].pop();
			}
		}
	}

	/// @notice Put a mystery box package into one sub-pool
	function putToPool(uint worksId_, uint poolId_) public onlyAdmin{
		require(poolsIndex[poolId_] > 1, "Not exist the child pool");
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state == 1, "The mysteryBox is not exist or state is not ready");


		require(packIndex[poolId_][worksId_] == 0, "The MysteryBox is already in the child pool");
		packages[poolId_].push(worksId_);
		packIndex[poolId_][worksId_] = packages[poolId_].length;

		pack.pools.push(poolId_);
		pack.poolIndex[poolId_] = pack.pools.length;
	}

	/// @notice remove a mystery box package from one sub-pool
	function takeFromPool(uint worksId_, uint poolId_) public onlyAdmin{
		require(poolsIndex[poolId_] > 1, "Not exist the child pool");
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state == 1, "The mysteryBox is not exist or state is not ready");

		require(packIndex[poolId_][worksId_] > 0, "The MysteryBox is not in the child pool");

		uint worksIdLast = packages[poolId_][packages[poolId_].length - 1];
		packages[poolId_][packIndex[poolId_][worksId_] -1 ] = worksIdLast;
		packIndex[poolId_][worksIdLast] = packIndex[poolId_][worksId_];
		delete packages[poolId_][packages[poolId_].length - 1];
		delete packIndex[poolId_][worksId_];
		packages[poolId_].pop();

		if(pack.poolIndex[poolId_] > 0){
			uint poolIdLast = pack.pools[pack.pools.length -1];
			pack.pools[pack.poolIndex[poolId_] - 1] = poolIdLast;
			pack.poolIndex[poolIdLast] = pack.poolIndex[poolId_];
			delete pack.pools[pack.pools.length - 1];
			//delete pack.pooIndex[poolId_];
			pack.pools.pop();
		}
	}

	/// @inheritdoc IMysteryBox
	function packageSold(uint worksId_) public virtual override onlyInternal{
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state == 1 && pack.unsoldTotal > 0, "The mysteryBox is not exist or state is not ready");

		pack.unsoldTotal--;
		if(pack.unsoldTotal == 0){
			pack.state = 2;
			clearPackage(worksId_);
		}
	}

	/// @inheritdoc IMysteryBox
	function packageOpened(uint worksId_, uint NFTtokenId_) public virtual override onlyInternal{
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state > 0, "The mysteryBox is not exist");
		require(pack.remained > pack.unsoldTotal, "All sold NFTs has been opened");
		require(pack.remNFTCount[NFTtokenId_] > 0, "The NFT remained is zero");
		pack.remNFTCount[NFTtokenId_] --;
		pack.remained--;
	}

	/// @inheritdoc IMysteryBox
	function setMaxFeeDiscount(uint maxFeeDiscount_) public virtual override onlyInternal{
		require(maxFeeDiscount_ <= minFeeRatio, "MaxFeeDiscount must be less or equ to minFeeRatio");
		maxFeeDiscount = maxFeeDiscount_;
	}

	/// @inheritdoc IMysteryBox
	function getPoolCount() public view virtual override returns(uint){
		return pools.length;
	}

	/// @inheritdoc IMysteryBox
	function  getPoolInfo(uint poolId_) public view virtual override returns(uint, uint32[4] memory, bool, string memory){
		require(poolsIndex[poolId_] > 0, "Not exist the pool");
		uint32[4] memory ratio;
		BoxPool storage boxPool = boxPools[poolId_];
		ratio[0] = boxPool.feeRatio;
		ratio[1] = boxPool.ownerRatio;
		ratio[2] = boxPool.fundRatio;
		ratio[3] = boxPool.rewardRatio;

		return (boxPool.price, ratio, boxPool.isValid, boxPool.name);
	}

	/// @inheritdoc IMysteryBox
	function getPackageCount(uint poolId_) public view virtual override returns(uint){
		require(poolsIndex[poolId_] > 0, "Not exist the pool");

		return packages[poolId_].length;
	}

	/// @inheritdoc IMysteryBox
	function getPackage(uint poolId_, uint index_) public view virtual override returns(uint){
		require(poolsIndex[poolId_] > 0, "Not exist the pool");

		return packages[poolId_][index_];
	}

	/// @inheritdoc IMysteryBox
	function getPackageNFTCount(uint worksId_) public view virtual override returns(uint, uint, uint){
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state > 0, "The mysteryBox is not created");

		return (pack.total, pack.remained, pack.unsoldTotal);
	}

	/// @inheritdoc IMysteryBox
	function getPackagePoolCount(uint worksId_) public view virtual override returns(uint){
		BoxPackage storage pack = boxPackages[worksId_];
		if(pack.state == 1 && pack.unsoldTotal > 0){
			return pack.pools.length;
		}
		return 0;
	}

	/// @notice Get the index of pool in 'pools' array
	function getPacakgePoolIndex(uint worksId_, uint poolId) public view virtual returns(uint){
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state == 1 && pack.unsoldTotal > 0, "The mysteryBox is not exist or state is not ready");
		return pack.poolIndex[poolId];
	}

	/// @inheritdoc IMysteryBox
	function getPacakgePool(uint worksId_, uint index_) public view virtual override returns(uint){
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state == 1 && pack.unsoldTotal > 0, "The mysteryBox is not exist or state is not ready");
		require(pack.pools.length > index_, "Index_ is out of range");
		return pack.pools[index_];
	}

	/// @inheritdoc IMysteryBox
	function getPackageNFTtokenID(uint worksId_) public view virtual override returns(uint[] memory){
		BoxPackage storage pack = boxPackages[worksId_];
		return pack.NFTtokenID;
	}

	/// @inheritdoc IMysteryBox
	function getPackageNFTsLength(uint worksId_) public view virtual override returns(uint){
		BoxPackage storage pack = boxPackages[worksId_];
		return pack.NFTtokenID.length;
	}
	/// @inheritdoc IMysteryBox
	function isInPackage(uint worksId_, uint nftId_) external virtual override view returns(bool) {
		BoxPackage storage pack = boxPackages[worksId_];
		return pack.NFTCount[nftId_] > 0 ? true : false;
	}

	/// @inheritdoc IMysteryBox
	function getPackageNFTInfo(uint worksId_, uint index_) public view virtual override returns(uint, uint, uint){
		BoxPackage storage pack = boxPackages[worksId_];
		require(pack.state > 0, "The mysteryBox is not created");

		uint NFT = pack.NFTtokenID[index_];

		return (NFT, pack.NFTCount[NFT], pack.remNFTCount[NFT]);
	}

	/// @inheritdoc IMysteryBox
	function getPackageNFTremained(uint worksId_, uint NFTtokenId_) public view virtual override returns(uint){
		BoxPackage storage pack = boxPackages[worksId_];
		return pack.remNFTCount[NFTtokenId_];
	}

	/// @inheritdoc IMysteryBox
	function getBoxPool(uint poolId_) public view virtual override returns(BoxPool memory){
		return boxPools[poolId_];
	}

	/// @notice Get an array of partial pool Id's
	function getPartialPools(uint _start,uint _end) external view returns(uint[] memory) {
		require(_end -_start >=0 && _end < pools.length,'Index wrong');
		uint[] memory partIds = new uint[](_end - _start +1);
		for(uint i =_start;i<= _end;i++) {
			partIds[i-_start] = pools[i];
		}
		return partIds;
	}

	/// @inheritdoc IMysteryBox
	function getCountInfoOfPool(uint poolId_) public view virtual override returns(uint unsoldTotal_, uint remained_) {
		uint packageLen = getPackageCount(poolId_);
		for(uint i = 0; i< packageLen; i++) {
			unsoldTotal_ += boxPackages[packages[poolId_][i]].unsoldTotal;
			remained_ += boxPackages[packages[poolId_][i]].remained;
		}
		return (unsoldTotal_,remained_);
	}

	/// @inheritdoc IMysteryBox
	function isPoolExisted(uint poolId_) public view virtual override returns(bool) {
		return poolsIndex[poolId_] > 0;

	}

	function getPoolIdListCreatedByAdmin() public view returns(uint256[] memory _poolIdList) {
		_poolIdList = new uint256[](lenOfPoolIdsCreatedByAdmin);
		uint256 index = 0;
		for(uint256 j=0; j< poolIdSeq; j++) {
			if(poolCreator[j] == address(0) && index < lenOfPoolIdsCreatedByAdmin) {
				_poolIdList[index] = j;
				index++;
			}
		}
	}

	function getExPoolIdListOfCreator(address _user) public view returns(uint[] memory) {
		return exPoolIdListOfCreator[_user];
	}

	function getAllowedPoolIdListOfUser(address _user) public view returns(uint[] memory) {
		return allowedPoolIdListOfUser[_user];
	}

	/// @inheritdoc IMysteryBox
	function isExclusivePool(uint poolId_) public override view returns(bool) {
		bool isCreatorExisted = poolCreator[poolId_] != address(0);
		return isPoolExisted(poolId_) && isCreatorExisted;
	}

}
