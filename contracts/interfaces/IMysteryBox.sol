// Copyright (C) 2021 Cycan Technologies

pragma solidity ^0.8.0;


interface IMysteryBox {
	/// @notice Mystery box pool struct
	/// @param poolId the id of mystery box pool, the main pool id  is "0"
	/// @param name the name of mystery box pool
	/// @param price the price of mystery box pool
	/// @param feeRatio the Platform share ratio, per 1e4
	/// @param ownerRatio the total share ratio of creator and crowdfund Pool, per 1e4
	/// @param fundRatio the decentralised fund share ratio, per 1e4
	/// @param rewardRatio the reward pool share ratio, per 1e4
	/// @param isValid the 'bool' flag of validity
	struct BoxPool {
		uint 		poolId;
		string		name;
		uint 		price;
		uint32		feeRatio;
		uint32 		ownerRatio;
		uint32 		fundRatio;
		uint32 		rewardRatio;
		bool  		isValid;
	}

	/// @notice The minimal platform share ratio , per 1e4
	function minFeeRatio() external view returns(uint);
	/// @notice The maximum platform discount ratio , per 1e4
	function maxFeeDiscount() external view returns(uint);
	/// @notice Get infos of mystery box pool
	function getBoxPool(uint poolId_) external view returns(BoxPool memory);

	/// @notice Prepare to create mystery box package by adding NFT token one by one
	function preparePackage(uint worksId_, uint NFTtokenId_, uint count_) external;

	/// @notice Create a mystery box package when the last NTFToken id is added, and put it into the main pool
	/// @param worksId_ the work id
	/// @param NFTtokenId_ the last tokenId of this work
	/// @param count_ the number of the last tokenId
	/// @param poolId_ the Id  of the mystery box pool that the new mystery box package will be put into
	/// @param operator_ the operator to create package
	function createPackage(uint worksId_, uint NFTtokenId_, uint count_, uint poolId_, address operator_) external;

	/// @notice Sold a mystery box package
	function packageSold(uint worksId_) external;
	/// @notice Open a mystery box package and take put a NFT
	function packageOpened(uint worksId_, uint NFTtokenId_) external;
	/// @notice Set the maximum platform discount ratio
	function setMaxFeeDiscount(uint maxFeeDiscount_) external;

	/// @notice Set the allowed user which can add mystery box pack into 'poolId_' pool
	/// @param poolId_ the id of pool
	/// @param userAddrs the address array of users who will be set
	/// @param set_ true or false
	function setIsAllowedUser(uint poolId_, address[] memory userAddrs, bool set_) external;

	/// @notice Create sub-pools
	/// @param feeRatio_ the Platform share ratio, per 1e4
	/// @param ownerRatio_ the total share ratio of creator and crowdfund Pool, per 1e4
	/// @param fundRatio_ the decentralised fund share ratio, per 1e4
	/// @param rewardRatio_ the reward pool share ratio, per 1e4
	/// @param price_ the price of mystery box pool
	/// @param name_ the name of mystery box pool
	/// @return the id of mystery box pool created
	function createPool(uint32 feeRatio_, uint32 ownerRatio_, uint32 fundRatio_, uint32 rewardRatio_, uint price_, string memory name_) external returns(uint);

	/// @notice Get the total Number of pools
	function getPoolCount() external view returns(uint);
	/// @notice Get info about each property of the pool,including 'feeRatio','ownerRatio','fundRatio','rewardRatio'
	function  getPoolInfo(uint poolId_) external view returns(uint, uint32[4] memory, bool, string memory);
	/// @notice Get the number of mystery box packs in the pool
	function getPackageCount(uint poolId_) external view returns(uint);
	/// @notice Get the id of mystery box pack in the pool
	function getPackage(uint poolId_, uint index_) external view returns(uint);
	/// @notice Get infos about mystery box pack,
	/// including the total number of NFT in this pack, the number of remain NFT,and the number of unsold NFT
	function getPackageNFTCount(uint worksId_) external view returns(uint, uint, uint);

	/// @notice Get the number of mystery box packs,
	function getPackagePoolCount(uint worksId_) external view returns(uint);

	/// @notice Get the poolId in 'pools' array of mystery box package by index
	function getPacakgePool(uint worksId_, uint index_) external view returns(uint);
	/// @notice Get NFT info of the pool,including NFT tokenId, the number and remain number of this NFT
	function getPackageNFTInfo(uint worksId_, uint index_) external view returns(uint, uint, uint);

	/// @notice Get the 'NFTtokenID' array
	function getPackageNFTtokenID(uint worksId_) external view  returns(uint[] memory);
	/// @notice Get the length of 'NFTtokenID' array
	function getPackageNFTsLength(uint worksId_) external view  returns(uint);
	/// @notice Query whether an NFTId is already in the mystery box package
	function isInPackage(uint worksId_, uint nftId_) external view returns(bool);
	/// @notice Get the number of NFTs remained in a mystery box package
	function getPackageNFTremained(uint worksId_, uint NFTtokenId_) external view returns(uint);
	/// @notice Get the number of unsold mystery boxes and the number of remain boxes in the pool
	function getCountInfoOfPool(uint poolId_) external view returns(uint unsoldTotal_, uint remained_);
	/// @notice Query whether a poolId pool exists
	function isPoolExisted(uint poolId_) external view returns(bool);
	/// @notice Query whether a poolId pool is exclusive pool
	function isExclusivePool(uint poolId_) external view returns(bool);

	/// @notice Event that can be emitted when a mystery box pool has created
	/// @param sender the creator of new mystery box pool
	/// @param poolId the id of mystery box pool
	/// @param poolName the name of mystery box pool
	event CreatePool(address indexed sender, uint indexed poolId, string indexed poolName);

	/// @notice Event that can be emitted when a mystery box pool has deleted
	/// @param sender the deleter of new mystery box pool
	/// @param poolId the id of mystery box pool
	/// @param poolName the name of mystery box pool
	event DeletePool(address indexed sender, uint indexed poolId, string indexed poolName);

	/// @notice Event that can be emitted when a mystery box package has created
	/// @param worksId the work id which NFT will put into mystery box package
	/// @param total the number of the last tokenId
	event CreatePackage(address indexed sender, uint indexed worksId, uint total);
}
