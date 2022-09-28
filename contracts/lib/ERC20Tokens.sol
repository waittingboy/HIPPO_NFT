// Copyright (C) 2021 Cycan Technologies
//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract ERC20Tokens is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    // default support tokens
    mapping(address => bool) public isDefaultToken;

    // current support tokens
    mapping(address => bool) public isSupportToken;

    // history support tokens
    address[] internal historySupportTokens;
    mapping(address => bool) internal isHistorySupportToken;

    // number of support token
    uint supportTokenQuantity;

    /**
     * @dev Add default support tokens
     */
    function __ERC20Tokens_init(address[] memory _tokensAddress) internal onlyInitializing {
        __Ownable_init();
        __ERC20Tokens_init_unchained(_tokensAddress);
    }

    function __ERC20Tokens_init_unchained(address[] memory _tokensAddress) internal onlyInitializing {
        for (uint i = 0; i < _tokensAddress.length; i++) {
            address tokenAddress = _tokensAddress[i];
            isDefaultToken[tokenAddress] = true;
            isSupportToken[tokenAddress] = true;
            supportTokenQuantity++;
            historySupportTokens.push(tokenAddress);
            isHistorySupportToken[tokenAddress] = true;
        }
    }

    /**
     * @dev Add support tokens
     */
    function addToken(address[] memory _tokensAddress) external virtual onlyOwner {
        for (uint i = 0; i < _tokensAddress.length; i++) {
            address tokenAddress = _tokensAddress[i];
            if (!isSupportToken[tokenAddress]) {
                isSupportToken[tokenAddress] = true;
                supportTokenQuantity++;
            }
            if (!isHistorySupportToken[tokenAddress]) {
                historySupportTokens.push(tokenAddress);
                isHistorySupportToken[tokenAddress] = true;
            }
        }
    }

    /**
     * @dev Delete support tokens
     *
     * Requirements:
     * - token must be in support tokens
     * - token must be not in default support tokens
     */
    function deleteToken(address[] memory _tokensAddress) external virtual onlyOwner {
        for (uint i = 0; i < _tokensAddress.length; i++) {
            address tokenAddress = _tokensAddress[i];

            require(isSupportToken[tokenAddress], "not in support tokens");
            require(!isDefaultToken[tokenAddress], "default can not delete");

            delete isSupportToken[tokenAddress];
            supportTokenQuantity--;
        }
    }

    function withdrawToken(IERC20MetadataUpgradeable _token, uint _amount) external virtual onlyOwner {
        _token.safeTransfer(_msgSender(), _amount);
    }

    function withdrawTokenBalance(IERC20MetadataUpgradeable _token) external virtual onlyOwner {
        _token.safeTransfer(_msgSender(), _token.balanceOf(address(this)));
    }

    function getSupportTokens() public view returns (address[] memory) {
        address[] memory supportTokens = new address[](supportTokenQuantity);
        uint index = 0;

        for (uint i = 0; i < historySupportTokens.length; i++) {
            if (isSupportToken[historySupportTokens[i]]) {
                supportTokens[index] = historySupportTokens[i];
                index++;
            }
        }

        return supportTokens;
    }
}
