//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "../CrowdfundPools.sol";

//CrowdfundPools receive pledge token, and award bonus token according different pool
contract CrowdfundPoolsMock is CrowdfundPools {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using SafeERC20Upgradeable for IHnqToken;

    // Update reward variables of the given pool to be up-to-date.
    function updatePool_public(
        uint256 _pid,
        IERC20MetadataUpgradeable _bonusToken,
        uint256 _bonusAmount
    ) public {
        updatePool(_pid, _bonusToken, _bonusAmount);
    }

    function safeBonusTokenTransfer_public(
        IERC20MetadataUpgradeable bonusToken,
        address _to,
        uint256 _amount
    ) public onlyOwner {
        safeBonusTokenTransfer(bonusToken, _to, _amount);
    }

    // function getAccBonusesPerShares(uint256 _pid)
    //     public
    //     view
    //     returns (uint256[] memory accBonusesPerShares)
    // {
    //     uint256 len = bonusTokens.length;
    //     PoolInfo storage pool = poolInfo[_pid];
    //     accBonusesPerShares = new uint256[](len);
    //     for (uint256 i = 0; i < len; i++) {
    //         accBonusesPerShares[i] = pool.accBonusesPerShare[bonusTokens[i]];
    //     }
    // }

    function getUserRewardDebts(uint256 _pid, address _user)
        public
        view
        returns (uint256[] memory rewardDebts)
    {
        uint256 len = bonusTokens.length;
        UserInfo storage user = userInfo[_pid][_user];
        rewardDebts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            rewardDebts[i] = user.rewardDebts[bonusTokens[i]];
        }
    }

    //for test
    function setWinnedDataOfPools(
        uint256 _pid,
        uint256 _position,
        uint256 _value
    ) public onlyOwner {
        WinningData storage winningData = winnedDataOfPools[_pid];
        winningData.decimalTails[_position].push(_value);
        winningData.isWinnedTail[_value] = true;
        winningData.isPosiWinnedTail[_position][_value] = true;
    }

    //for test
    function setWinnedDataOfPools02(uint256 _pid) public onlyOwner {
        WinningData storage winningData = winnedDataOfPools[_pid];
        if (!winningData.isCompleted) winningData.isCompleted = true;
        if (!winningData.isTrueTail) winningData.isTrueTail = true;
    }

    //for test
    function getWinnedDataOfPool(uint256 _pid, uint256 _posi)
        public
        view
        returns (
            bool,
            bool,
            uint256[] memory
        )
    {
        WinningData storage winningData = winnedDataOfPools[_pid];
        uint256 len;
        for (uint256 i = 1; i <= _posi; i++) {
            len += winningData.decimalTails[i].length;
        }
        uint256[] memory allTails = new uint256[](len);
        uint256 index = 0;
        for (uint256 i = 1; i <= _posi; i++) {
            for (uint256 j = 0; j < winningData.decimalTails[i].length; j++) {
                allTails[index] = winningData.decimalTails[i][j];
                index++;
            }
        }

        return (winningData.isCompleted, winningData.isTrueTail, allTails);
    }

    // for test
    function setTargetTotalAmountOfPool(uint256 _pid, uint256 _target) public {
        PoolInfo storage pool = poolInfo[_pid];
        pool.targetTotalAmount = _target;
    }
}
