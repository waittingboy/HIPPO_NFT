pragma solidity ^0.8.0;

interface IExternalNftBase {
    function collectIdToWorkId(uint256 _collectionId) external returns(uint256);
    function getCollectInfo(uint256 _collectionId) external view returns(string memory,string memory,string memory);
    function poolingBonusToCollectOwner(
        uint256[] memory _workIds,
        address _bonusToken,
        uint256 _totalBonusAmount
    ) external returns (bool);
}

