// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "./interfaces/IContract.sol";

contract Contract is Initializable, IContract {
	// Internal NFT token instance
    IERC1155Upgradeable public internalToken;

	function initialize(IERC1155Upgradeable _internalToken) public initializer {
        internalToken = _internalToken;
    }

	function isERC721(address _tokenAddress) public view override returns (bool) {
		return IERC721Upgradeable(_tokenAddress).supportsInterface(0x80ac58cd);
	}

	function isERC1155(address _tokenAddress) public view override returns (bool) {
		return IERC1155Upgradeable(_tokenAddress).supportsInterface(0xd9b67a26);
	}

	function isInternal(address _tokenAddress) public view override returns (bool) {
		return _tokenAddress == address(internalToken);
	}

	function getTokenAddressType(address _tokenAddress) public view returns (uint) {
		if (isERC721(_tokenAddress)) {
			return 1;
		} else if (isERC1155(_tokenAddress)) {
			return 2;
		} else if (isInternal(_tokenAddress)) {
			return 3;
		}

		return 0;
	}
}
