// Copyright (C) 2021 Cycan Technologies

pragma solidity ^0.8.0;

import  "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import  "@openzeppelin/contracts/access/Ownable.sol";

contract ERC20Mock is ERC20Burnable, Ownable{

    constructor (string memory name_, string memory symbol_) ERC20(name_, symbol_){
    }

	function mint(address account, uint256 amount) public onlyOwner {
		_mint(account, amount);
	}

}
