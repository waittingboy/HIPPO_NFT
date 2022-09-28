// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IDrawLots {
    function drawLots(uint _salt, uint _winningAmount, uint _totalAmount) external returns (uint[] memory, uint[] memory, bool);
}