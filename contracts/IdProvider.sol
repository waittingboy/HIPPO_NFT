// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract IdProvider is OwnableUpgradeable{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter public curWorkId;
    CountersUpgradeable.Counter public baseCollectionId;
    CountersUpgradeable.Counter public externalBaseCollectionId;

    mapping(address => bool) public internalCaller;

    address public base;
    address public externalBase;

    modifier  onlyInternal() {
        require(internalCaller[_msgSender()], "IdProvider: caller is not a internal caller");
        _;
    }

    function initialize(address _base, address _externalBase) public initializer {
        __Ownable_init();
        base = _base;
        externalBase = _externalBase;
        internalCaller[_base] = true;
        internalCaller[_externalBase] = true;
    }

    function createNewCollectionId() external onlyInternal returns(uint256) {
        uint256 curId;
        if(_msgSender() == base) {//return odd number(1,3,5,...) when base call
            curId = baseCollectionId.current();
            baseCollectionId.increment();
            return curId * 2 + 1;
        }else if(_msgSender() == externalBase) {//return even number(2,4,6,...) when externalBase call
            externalBaseCollectionId.increment();
            curId = externalBaseCollectionId.current();
            return curId * 2;
        }
    }

    function createNewWorkId() external onlyInternal returns(uint256) {
        curWorkId.increment();
        return curWorkId.current();
    }

    function setInternalCaller(address _internalAddr, bool _set) external onlyOwner{
        internalCaller[_internalAddr] = _set;
    }

}
