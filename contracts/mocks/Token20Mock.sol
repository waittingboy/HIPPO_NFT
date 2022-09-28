pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract Token20Mock is ERC20, ERC165 {
    constructor() ERC20("erc20", "erc20") {
    }

    function addBalance(
        address account,
        uint256 amount
    ) public returns(bool) {
        _mint(account, amount);
        return true;
    }

    function approveTo(
        address owner, 
        address spender, 
        uint256 amount
    ) public returns(bool) {
        _approve(owner, spender, amount);
        return true;
    }
}
