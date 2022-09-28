// Copyright (C) 2021 Cycan Technologies
//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract RandomNumber {
	uint internal randomNow;

	function randomNumber(uint salt) internal returns(uint) {
		randomNow = uint(keccak256(abi.encode(randomNow, salt, block.timestamp, block.number)));

		return uint(keccak256(abi.encode(randomNow, block.number)));
	}
}
