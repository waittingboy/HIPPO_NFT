// Copyright (C) 2021 Cycan Technologies
//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import  "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import  "@openzeppelin/contracts/access/Ownable.sol";

contract ERC20Smart is ERC20, Ownable{

    constructor (string memory name_, string memory symbol_) ERC20(name_, symbol_){
    }

	function mint(address account, uint256 amount) public onlyOwner {
		_mint(account, amount);
	}

	function burnFrom(address from, uint256 amount) public virtual onlyOwner{
        _burn(from, amount);
    }
}
