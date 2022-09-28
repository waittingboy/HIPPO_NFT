// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IContract {
    function isERC721(address _tokenAddress) external view returns (bool);
    function isERC1155(address _tokenAddress) external view returns (bool);
    function isInternal(address _tokenAddress) external view returns (bool);
}