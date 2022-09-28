//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./UniswapV2LibraryMock.sol";
import "../interfaces/IBase.sol";
import "../Democracy.sol";
import "../interfaces/ICrowdFund.sol";
import "hardhat/console.sol";

contract MyDemocracyMock is Democracy{
    address public swapFactory;
    function getTargetAmount(uint256 _valuation)
        public
        override
        view
        returns (uint256)
    {
        //getReserves(address factory, address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB)
        (uint256 reserveIn, uint256 reserveOut) = UniswapV2LibraryMock.getReserves(
            swapFactory,
            10000000000000000000,
            20000000000000000000000000
        );
        //getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) returns (uint amountOut)
        // USDT In, HIP Out
        uint256 amountOut = UniswapV2LibraryMock.getAmountOut(
            _valuation * 10**usdToken.decimals(),
            reserveIn,
            reserveOut
        );

        amountOut = (amountOut / hipAmountPerHnq + 1) * hipAmountPerHnq;
        return amountOut;
    }

    function modifyProposalStatus(uint256 _propId, uint8 _status) public {
        ProposalInfo storage proposal = proposals[_propId];
        proposal.status = _status;
    }

    function setMaxProposalId(uint256 _propId) public {
        maxProposalId = _propId;
    }
}
