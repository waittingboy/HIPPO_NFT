// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IIdProvider {
    function createNewCollectionId() external returns(uint256);
    function createNewWorkId() external returns(uint256);
}
