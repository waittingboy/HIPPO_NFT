pragma solidity ^0.8.0;

interface IDemocracy {
    function initProposalFromBase(uint _collectionId,address _uploader,uint _len,uint256 _crowdfundRatio, uint256 _dividendRatio, uint256 _duration, uint256 _maxJoinAmount, uint256 _valuation) external returns(bool);
    function canModifyCollection(uint _proposalId) external view returns(bool);
    function getPropState(uint256 _proposalId) external view returns (uint8);
    function hipAmountPerHnq() external view returns (uint256);
    function canCrowdfund(uint256 _proposalId) external view returns (bool);
}

