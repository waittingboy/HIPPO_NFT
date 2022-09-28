pragma solidity ^0.8.0;
// Copyright (C) 2021 Cycan Technologies

import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IMysteryBox.sol";

contract MBPoolAdmin is OwnableUpgradeable{
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    IERC20MetadataUpgradeable public payToken;
    IMysteryBox public mysteryBox;
    uint256 public basePayAmount;

    constructor()  {}

    function initialize(
        IERC20MetadataUpgradeable _payToken,
        IMysteryBox  _mysteryBox,
        uint256 _basePayAmount
    ) public initializer {
        __Ownable_init();
        payToken = _payToken;
        mysteryBox = _mysteryBox;
        basePayAmount = _basePayAmount;
    }

    function payAndCreateMBPool(
        uint32 feeRatio_,
        uint32 ownerRatio_,
        uint32 fundRatio_,
        uint32 rewardRatio_,
        uint price_,
        string memory name_
    ) public returns (bool){
        require(tx.origin == _msgSender(),"Only EOA can call");
        require(fundRatio_ == 0,"fundRatio_ must == 0");

        payToken.safeTransferFrom(_msgSender(),address(this),basePayAmount);

        mysteryBox.createPool(feeRatio_, ownerRatio_, fundRatio_, rewardRatio_, price_, name_);

        return true;
    }

    function setBasePayAmount(uint256 _basePayAmount) public onlyOwner{
        basePayAmount = _basePayAmount;
    }

    function withdrawToken(address _token) public onlyOwner {
        IERC20MetadataUpgradeable token = IERC20MetadataUpgradeable(_token);
        uint256 bal = token.balanceOf(address(this));
        if(bal > 0) token.safeTransfer(owner(),bal);
    }

}
