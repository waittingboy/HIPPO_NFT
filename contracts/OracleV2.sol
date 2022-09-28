pragma solidity ^0.8.0;
// Copyright (C) 2021 Cycan Technologies

import "./interfaces/IDemocracy.sol";
import "./libraries/UniswapV2Library.sol";

contract OracleV2 {

    address public factory;
    address public usdToken;
    address public hipToken;
    IDemocracy public democracy;

    constructor(
        address _usdToken,
        address _hipToken,
        IDemocracy _democracy,
        address _factory
    ) public {
        usdToken = _usdToken;
        hipToken = _hipToken;
        democracy = _democracy;
        factory = _factory;
    }

    function getTargetAmount(uint256 _valuationUSD) external view returns (uint256){
        uint256  hipAmountPerHnq = democracy.hipAmountPerHnq();

        (uint256 reserveIn, uint256 reserveOut) = UniswapV2Library.getReserves(
            factory,
            address(usdToken),
            address(hipToken)
        );

        uint256 amountOutHIP = UniswapV2Library.getAmountOut(_valuationUSD,reserveIn,reserveOut);

        amountOutHIP = (amountOutHIP / hipAmountPerHnq + 1) * hipAmountPerHnq;
        return amountOutHIP;
    }
}
