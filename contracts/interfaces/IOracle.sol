// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IOracle {
    function getTargetAmount(uint256 _valuation) external view returns (uint256);
}
