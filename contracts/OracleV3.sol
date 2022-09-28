pragma solidity ^0.7.0 || ^0.8.0;
// Copyright (C) 2021 Cycan Technologies

import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "./interfaces/IDemocracyV07.sol";

contract OracleV3 {

    IUniswapV3Factory public factory = IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);
    address public usdToken;
    address public hipToken;
    address public elcToken;
    IDemocracyV07 public democracy;

    constructor(
        address _usdToken,
        address _hipToken,
        address _elcToken,
        IDemocracyV07 _democracy
    ) public {
        usdToken = _usdToken;
        hipToken = _hipToken;
        elcToken = _elcToken;
        democracy = _democracy;
    }

    function getTargetAmountELC(uint256 _valuationUSD) external view returns (uint256){
        uint256  hipAmountPerHnq = democracy.hipAmountPerHnq();

        (int24 tick,) = OracleLibrary.consult(factory.getPool(usdToken, elcToken, 500), 60);
        uint256 amountOutELC = OracleLibrary.getQuoteAtTick(tick, uint128(_valuationUSD), usdToken, elcToken);
        return amountOutELC;
    }

    function getTargetAmountHIP(uint256 _valuationELC) external view returns (uint256){
        uint256  hipAmountPerHnq = democracy.hipAmountPerHnq();

        (int24 tick,) = OracleLibrary.consult(factory.getPool(elcToken, hipToken, 3000), 60);
        uint256 amountOutHIP = OracleLibrary.getQuoteAtTick(tick, uint128(_valuationELC), elcToken, hipToken);
        amountOutHIP = (amountOutHIP / hipAmountPerHnq + 1) * hipAmountPerHnq;
        return amountOutHIP;
    }

    function getTargetAmountUSD2ELC2HIP(uint256 _valuationUSD) external view returns (uint256){
        uint256  hipAmountPerHnq = democracy.hipAmountPerHnq();

        (int24 tick,) = OracleLibrary.consult(factory.getPool(usdToken, elcToken, 500), 60);
        uint256 amountOutELC = OracleLibrary.getQuoteAtTick(tick, uint128(_valuationUSD), usdToken, elcToken);

        (tick,) = OracleLibrary.consult(factory.getPool(elcToken, hipToken, 3000), 60);
        uint256 amountOutHIP = OracleLibrary.getQuoteAtTick(tick, uint128(amountOutELC), elcToken, hipToken);
        amountOutHIP = (amountOutHIP / hipAmountPerHnq + 1) * hipAmountPerHnq;
        return amountOutHIP;
    }

    function getTargetAmount(uint256 _valuationUSD) external view returns (uint256){
        uint256  hipAmountPerHnq = democracy.hipAmountPerHnq();

        (int24 tick,) = OracleLibrary.consult(factory.getPool(usdToken, hipToken, 3000), 60);
        uint256 amountOut = OracleLibrary.getQuoteAtTick(tick, uint128(_valuationUSD), usdToken, hipToken);
        amountOut = (amountOut / hipAmountPerHnq + 1) * hipAmountPerHnq;
        return amountOut;
    }
}
