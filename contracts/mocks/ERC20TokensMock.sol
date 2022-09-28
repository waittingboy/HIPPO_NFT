//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "../lib/ERC20Tokens.sol";

contract ERC20TokensMock is ERC20Tokens {
    function initialize(address[] memory _tokensAddress) public initializer{
        __ERC20Tokens_init(_tokensAddress);
    }
}
