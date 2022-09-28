pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IHnqToken is IERC20Upgradeable{//IERC20
    function burn(uint256 amount) external;
    function decimals() external view returns (uint8);
}

