// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./lib/ERC20Smart.sol";
import "./interfaces/IBancorFormula.sol";
import "./interfaces/INFTFund.sol";
import "./interfaces/IMysteryBox.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract NFTFundToken is INFTFund, OwnableUpgradeable {
    uint32 private constant MAX_WEIGHT = 1000000;

    IBancorFormula bancor;
    ERC20Smart public token;

    struct Connector {
        uint256 balance;
        uint32 weight; //connector weight, represented in ppm, 1-1000000
    }

    Connector[] public connectors;

    IMysteryBox public mysteryBox;

    event MintSmart(
        address indexed from,
        address indexed to,
        uint256 indexed connector,
        uint256 connValue,
        uint256 smartValue
    );

    event BurnSmart(
        address indexed from,
        uint256 indexed connector,
        uint256 connValue,
        uint256 smartValue
    );

    function initialize(
        string memory name_,
        string memory symbol_,
        uint32 weight_,
        uint256 initConnAmount_,
        uint256 initSupply_,
        IBancorFormula bancor_,
        IMysteryBox mysteryBox_
    ) public initializer {
        __Ownable_init();
        bancor = bancor_;

        token = new ERC20Smart(name_, symbol_);
        connectors.push(Connector(initConnAmount_, weight_));
        token.mint(_msgSender(), initSupply_);

        mysteryBox = mysteryBox_;

        emit MintSmart(
            _msgSender(),
            _msgSender(),
            0,
            initConnAmount_,
            initSupply_
        );
    }

    /// @notice add new connector
    function addConnector(uint32 weight_, uint256 initConnAmount_)
        public
        onlyOwner
        returns (uint256 _newConnectorId)
    {
        connectors.push(Connector(initConnAmount_, weight_));
        return connectors.length - 1;
    }

    /// @notice Get 'balance' and 'weight' infos of the connector
    function getConnector(uint256 connector_)
        public
        view
        returns (uint256, uint256)
    {
        return (connectors[connector_].balance, connectors[connector_].weight);
    }

    /// @notice Get the total number of all connectors
    function getConnectorCount() public view returns (uint256) {
        return connectors.length;
    }

    /// @notice Calculating the number of funds available for issue Using the bancor algorithm
    function getReturn(
        uint256 connector_,
        uint256 connAmount_,
        address tokenAddress_
    ) public view returns (uint256) {
        require(connectors.length > connector_, "No such connector");
        uint256 virtualConnAmount_ = (connAmount_ * 10**18) /
            10**IERC20MetadataUpgradeable(tokenAddress_).decimals();
        return
            bancor.calculatePurchaseReturn(
                token.totalSupply(),
                connectors[connector_].balance,
                connectors[connector_].weight,
                virtualConnAmount_
            );
    }

    /// @notice Issue fund token. Using the bancor algorithm
    function mintSmart(
        address to_,
        uint256 connector_,
        uint256 connAmount_,
        address tokenAddress_
    ) public override onlyOwner returns (uint256) {
        require(connectors.length > connector_, "No such connector");

        IMysteryBox.BoxPool memory mainBoxPoolInfo = mysteryBox.getBoxPool(0);
        require(mainBoxPoolInfo.poolId ==0,"Not main pool");

        uint256 amountOneToken = 10**IERC20MetadataUpgradeable(tokenAddress_).decimals();
        require(amountOneToken > 0, "The amountOneToken must GT 0");

        uint256 multipleNum = mainBoxPoolInfo.price / amountOneToken;
        connAmount_ = connAmount_ / multipleNum;

        uint256 mintAmount = getReturn(connector_, connAmount_, tokenAddress_);
        uint256 virtualConnAmount_ = (connAmount_ * 10**18) / amountOneToken;

        connectors[connector_].balance += virtualConnAmount_;
        token.mint(to_, mintAmount);

        emit MintSmart(_msgSender(), to_, connector_, connAmount_, mintAmount);
    }


    /// @notice Burn fund token. Using the bancor algorithm
    function burnSmart(uint256 amount_, uint256 connector_) public {//amount_ need "18" decimals
        require(connectors.length > connector_, "No such connector");

        uint256 outAmount = bancor.calculateSaleReturn(
            token.totalSupply(),
            connectors[connector_].balance,
            connectors[connector_].weight,
            amount_
        );

        connectors[connector_].balance -= outAmount;
        token.burnFrom(_msgSender(), amount_);

        emit BurnSmart(_msgSender(), connector_, outAmount, amount_);
    }

}
