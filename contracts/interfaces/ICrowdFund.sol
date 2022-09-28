pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

interface ICrowdFund {
    //return true when success,return false when fail
    function addBonusToken(address _newBonusToken) external returns(bool);

    function add(uint _proposalId, address _proposer, uint _openAmount, uint _dividendRatio, uint _duration, uint _maxJoinAmount,uint _targetAmount) external returns(uint);

    function poolingBonusToPools(uint[] memory _workIds,address _bonusToken, uint _totalBonusAmount) external returns(bool);
    function getCrowdfundStatus(uint _pid) external view returns(uint);
    function workId2PoolId(uint256 _workId) external returns(uint256);
    function baseHipAmountPerHnq() external view returns(uint);

}
