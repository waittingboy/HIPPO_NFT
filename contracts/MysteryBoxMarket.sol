// Copyright (C) 2021 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./lib/ERC20Tokens.sol";
import "./lib/RandomNumber.sol";
import "./interfaces/IMysteryBox.sol";
import "./interfaces/INFTDepositBox.sol";
import "./interfaces/IContract.sol";
import "./interfaces/IUserTokens.sol";
import "./interfaces/ICrowdFund.sol";
import "./interfaces/ILuckyLottery.sol";
import "./interfaces/INFTFund.sol";
import "./interfaces/IExternalNftBase.sol";

contract MysteryBoxMarket is ERC721HolderUpgradeable, ERC1155HolderUpgradeable, ERC20Tokens, RandomNumber {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using SafeMathUpgradeable for uint;

    // Mystery box instance
    IMysteryBox public mysteryBox;

    // NFT deposit box instance
    INFTDepositBox public nftDepositBox;

    // NFT token instance
    IContract public token;

    // User tokens instance
    IUserTokens public userTokens;

    // Crowd fund instance
    ICrowdFund public crowdFund;

    // Lucky lottery instance
    ILuckyLottery public luckyLottery;

    // NFT fund instance
    INFTFund public NFTFund;

    // NFT fund transfer to this account
    address payable public NFTFundAccount;

    // Handling fee transfer to this account
    address payable public handlingFeeAccount;

    // NFT info
    struct NFT {
        bool isExternalNFT;
        address tokenAddress;
        uint tokenId;
    }

    // User's mystery box info
    struct UserMysteryBox {
        uint[] userPackageIds;
        uint openedQuantity;
        NFT[] nfts;
    }

    // Mapping from user to user's mystery box
    mapping(address => UserMysteryBox) private usersMysteryBox;

    // Max quantity of mystery box can be opened at one time
    uint private maxOpenQuantity;

    // Mapping from token address to fee reduction
    mapping(address => uint) private token20sFeeReduction;

    // The pool which user receive reward
    uint private rewardPool;

    // Mapping from reward number to reward quantity
    mapping(uint => uint) private rewardData;

    // The account which to pay reward
    address payable private rewardPayAccount;

    IExternalNftBase public externalNftBase;

    modifier nonContract {
        require(tx.origin == _msgSender(),"Only non contract can call");

        _;
    }

    function initialize(
        IMysteryBox _mysteryBox, INFTDepositBox _nftDepositBox, IContract _token, ICrowdFund _crowdFund, ILuckyLottery _luckyLottery, 
        INFTFund _NFTFund, address payable _NFTFundAccount, address payable _handlingFeeAccount, address[] memory _token20sAddress,
        IExternalNftBase _externalNftBase
        ) public initializer {
        __ERC1155Holder_init();
        __ERC20Tokens_init(_token20sAddress);

        mysteryBox = _mysteryBox;
        nftDepositBox = _nftDepositBox;
        token = _token;
        crowdFund = _crowdFund;
        luckyLottery = _luckyLottery;
        NFTFund = _NFTFund;

        for (uint i = 0; i < _token20sAddress.length; i++) {
            address tokenAddress = _token20sAddress[i];
            // add token to crowd fund
            crowdFund.addBonusToken(tokenAddress);
            // add token to lucky lottery
            luckyLottery.addRewardToken(tokenAddress);
        }
        NFTFundAccount = _NFTFundAccount;
        handlingFeeAccount = _handlingFeeAccount;

        maxOpenQuantity = 10;

        externalNftBase = _externalNftBase;
    }

    /*
     * Emitted when user buy mystery box
     */
    event MysteryBoxSold(address indexed _user, uint _quantity, uint[] _packageIds);
    /*
     * Emitted when user receive reward
     */
    event ReceiveReward(address indexed _user, uint _quantity, uint[] _packageIds);
    /*
     * Emitted when user open mystery box
     */
    event MysteryBoxOpened(address indexed _user, NFT[] _nfts);

    /**
     * @dev See {ERC20Tokens-addToken}
     */
    function addToken(address[] memory _token20sAddress) external override onlyOwner {
        for (uint i = 0; i < _token20sAddress.length; i++) {
            address tokenAddress = _token20sAddress[i];
            if (!isSupportToken[tokenAddress]) {
                isSupportToken[tokenAddress] = true;
                supportTokenQuantity++;
            }
            if (!isHistorySupportToken[tokenAddress]) {
                historySupportTokens.push(tokenAddress);
                isHistorySupportToken[tokenAddress] = true;
                // add token to crowd fund
                crowdFund.addBonusToken(tokenAddress);
                // add token to lucky lottery
                luckyLottery.addRewardToken(tokenAddress);
            }
        }
    }

    /**
     * @dev See {ERC20Tokens-deleteToken}
     */
    function deleteToken(address[] memory _token20sAddress) external override onlyOwner {
        for (uint i = 0; i < _token20sAddress.length; i++) {
            address tokenAddress = _token20sAddress[i];

            require(isSupportToken[tokenAddress], "not in support tokens");
            require(!isDefaultToken[tokenAddress], "default can not delete");

            delete isSupportToken[tokenAddress];
            supportTokenQuantity--;
            // set token fee reduction to 0
            token20sFeeReduction[tokenAddress] = 0;
        }
    }

    /**
     * @dev Transfers NFT fund account to a new account
     * Can only be called by the current owner
     */
    function transferNFTFundAccount(address payable _NFTFundAccount) public onlyOwner {
        require(_NFTFundAccount != address(0), "account is zero address");

        NFTFundAccount = _NFTFundAccount;
    }

    /**
     * @dev Transfers handling fee account to a new account
     * Can only be called by the current owner
     */
    function transferHandlingFeeAccount(address payable _handlingFeeAccount) public onlyOwner {
        require(_handlingFeeAccount != address(0), "account is zero address");

        handlingFeeAccount = _handlingFeeAccount;
    }

    /**
     * @dev Set the pool which user receive reward
     * Can only be called by the current owner
     */
    function setRewardPool(uint _poolId) public onlyOwner {
        require(mysteryBox.isPoolExisted(_poolId), "pool not exist");

        rewardPool = _poolId;
    }

    /**
     * @dev Set the account which to pay reward
     * Can only be called by the current owner
     */
    function setRewardPayAccount(address payable _rewardPayAccount) public onlyOwner {
        rewardPayAccount = _rewardPayAccount;
    }

    /**
     * @dev Adjust the max quantity of mystery box can be opened at one time
     * Can only be called by the current owner
     */
    function adjustMaxOpenQuantity(uint _maxOpenQuantity) public onlyOwner {
        require(_maxOpenQuantity > 0, "quantity is zero");

        maxOpenQuantity = _maxOpenQuantity;
    }

    /**
     * @dev Set the discount of token handling fee
     * Can only be called by the current owner
     *
     * Requirements:
     * - token must be in support tokens
     * - reduction ratio must be less than or equal to min fee ratio
     */
    function setTokenFeeReduction(address _token20Address, uint _reductionRatio) public onlyOwner {
        require(isSupportToken[_token20Address], "not in support tokens");
        require(_reductionRatio <= mysteryBox.minFeeRatio(), "reduction ratio is greater than min fee ratio");

        token20sFeeReduction[_token20Address] = _reductionRatio;
        if (_reductionRatio > mysteryBox.maxFeeDiscount()) {
            mysteryBox.setMaxFeeDiscount(_reductionRatio);
        }
    }

    /**
     * @dev Get packageIds for purchased mystery box
     */
    function getPackageIds(uint _poolId, uint _quantity) private returns (uint[] memory) {
        uint[] memory packageIds = new uint[](_quantity);

        // get the packageId for mystery box, if a package sold out, remove the id from all pools
        for (uint i = 0; i < _quantity; i++) {
            uint packageIndex = randomNumber(i) % mysteryBox.getPackageCount(_poolId);
            uint packageId = mysteryBox.getPackage(_poolId, packageIndex); // packageId is workId
            usersMysteryBox[_msgSender()].userPackageIds.push(packageId);
            packageIds[i] = packageId;
            mysteryBox.packageSold(packageId);
        }

        return packageIds;
    }

    /**
     * @dev Calculate income distribution and transfer
     *
     * Requirements:
     * - receive amount must be equal to the amount after reduction
     */
    function incomeDistribution(
        uint _poolId, uint _quantity, address _token20Address, uint _amount, address _rewardPayAccount, uint[] memory packageIds
        ) private returns (uint _NFTFundAmount, uint _luckyReward) {
        // income distribution
        IMysteryBox.BoxPool memory pool = mysteryBox.getBoxPool(_poolId);
        IERC20MetadataUpgradeable token20 = IERC20MetadataUpgradeable(_token20Address);
        uint beforeReductionAmount = _quantity.mul(pool.price.mul(10**token20.decimals()).div(1e18));
        uint reductionAmount = beforeReductionAmount.mul(token20sFeeReduction[_token20Address]).div(10000);

        if (_amount != 0) {
            require(_amount == beforeReductionAmount.sub(reductionAmount), "amount not equal to after reduction amount");
        } else {
            _amount = beforeReductionAmount.sub(reductionAmount);
        }

        uint handlingFee = beforeReductionAmount.mul(pool.feeRatio).div(10000).sub(reductionAmount);
        uint crowdAmount = beforeReductionAmount.mul(pool.ownerRatio).div(10000);
        _NFTFundAmount = beforeReductionAmount.mul(pool.fundRatio).div(10000);
        _luckyReward = _amount.sub((handlingFee.add(crowdAmount)).add(_NFTFundAmount));

        // transfer to current contract first
        token20.safeTransferFrom(_rewardPayAccount, address(this), _amount);
        // transfer to different accounts
        token20.safeTransfer(handlingFeeAccount, handlingFee);
        //if poolid is exclusive pool id ,transfer bonus token to the creator of mystery box
        if(mysteryBox.isExclusivePool(_poolId)) {
            token20.safeApprove(address(externalNftBase), crowdAmount);
            externalNftBase.poolingBonusToCollectOwner(packageIds, _token20Address, crowdAmount);
        }else {
            token20.safeApprove(address(crowdFund), crowdAmount);
            crowdFund.poolingBonusToPools(packageIds, _token20Address, crowdAmount);
        }
        
        token20.safeTransfer(NFTFundAccount, _NFTFundAmount);
        token20.safeTransfer(address(luckyLottery), _luckyReward);
    }

    /*
     * Emits a {MysteryBoxSold} event

     * @dev Process after buy mystery box
     */
    function buyMysteryBoxProcess(uint _poolId, uint _quantity, address _token20Address, uint _amount) private {
        uint[] memory packageIds = getPackageIds(_poolId, _quantity);

        (uint NFTFundAmount, uint luckyReward) = incomeDistribution(_poolId, _quantity, _token20Address, _amount, _msgSender(), packageIds);

        // reward fund token
        NFTFund.mintSmart(_msgSender(), 0, NFTFundAmount, _token20Address);

        // add sell data to lucky lottery pool
        luckyLottery.addLotteryData(_poolId, _msgSender(), _quantity, _token20Address, luckyReward);

        emit MysteryBoxSold(_msgSender(), _quantity, packageIds);
    }

    function autoLottery(uint _poolId, uint _quantity, address _token20Address, uint _amount) private {
        buyMysteryBoxProcess(_poolId, _quantity, _token20Address, _amount);
        luckyLottery.drawLottery(_poolId);
    }

    /*
     * Requirements:
     * - token must be in support tokens
     * - quantity must greater than zero and less than or equal to unsold quantity
     */
    function buyMysteryBox(uint _poolId, uint _quantity, address _token20Address, uint _amount) public nonContract {
        (uint unsoldQuantity,) = mysteryBox.getCountInfoOfPool(_poolId);
        require(isSupportToken[_token20Address], "not in support tokens");
        require(_quantity > 0 && _quantity <= unsoldQuantity, "quantity is zero or greater than unsold quantity");
        uint currentTimesQuantity = luckyLottery.getRemainLotteryAddressQuantityOfPoolTimes(_poolId);
        if (_quantity > currentTimesQuantity) {
            uint amount = _amount.mul(currentTimesQuantity).div(_quantity);
            autoLottery(_poolId, currentTimesQuantity, _token20Address, amount);
            uint remianQuantity = _quantity - currentTimesQuantity;
            uint lotteryAddressQuantity = luckyLottery.getMinLotteryAddressQuantityOfPool(_poolId);
            while (remianQuantity > lotteryAddressQuantity) {
                remianQuantity = remianQuantity - lotteryAddressQuantity;

                amount = _amount.mul(lotteryAddressQuantity).div(_quantity);
                autoLottery(_poolId, lotteryAddressQuantity, _token20Address, amount);
            }

            amount = _amount.mul(remianQuantity).div(_quantity);
            buyMysteryBoxProcess(_poolId, remianQuantity, _token20Address, amount);
        } else if (_quantity == currentTimesQuantity) {
            autoLottery(_poolId, _quantity, _token20Address, _amount);
        } else {
            buyMysteryBoxProcess(_poolId, _quantity, _token20Address, _amount);
        }
    }

    /**
     * @dev Input reward number's hash array and reward quantity
     *
     * Requirements:
     * - reward number's hash must be not exist
     */
    function inputRewardData(uint[] memory _hashs, uint _quantity) public onlyOwner {
        for (uint i = 0; i < _hashs.length; i++) {
            require(rewardData[_hashs[i]] == 0, "reward number is exist");

            rewardData[_hashs[i]] = _quantity;
        }
    }

    /**
     * @dev User receive reward
     *
     * Requirements:
     * - reward quantity must be greater than 0
     */
    function receiveReward(uint _number, address _token20Address) public nonContract {
        uint hash = uint(sha256(abi.encodePacked(_number)));
        uint quantity = rewardData[hash];

        require(quantity > 0, "this number no reward");

        delete rewardData[hash];

        uint[] memory packageIds = getPackageIds(rewardPool, quantity);

        incomeDistribution(rewardPool, quantity, _token20Address, 0, rewardPayAccount, packageIds);

        emit ReceiveReward(_msgSender(), quantity, packageIds);
    }

    /**
     * @dev Get the NFT for opened mystery box
     */
    function getNFT(uint _nftId) private view returns (NFT memory) {
        (bool isExternalNFT, address tokenAddress, uint tokenId, ) = nftDepositBox.getVirtualNftInfo(_nftId);
        NFT memory nft = NFT(isExternalNFT, tokenAddress, tokenId);

        return nft;
    }

    /**
     * @dev Get the NFTs for opened mystery box
     */
    function getNFTs(UserMysteryBox storage _user, uint _quantity) private {
        // get the NFTs for mystery box
        for (uint i = 0; i < _quantity; i++) {
            uint packageId = _user.userPackageIds[_user.openedQuantity + i];

            ( , uint remained, ) = mysteryBox.getPackageNFTCount(packageId);
            uint length = mysteryBox.getPackageNFTsLength(packageId);
            uint number = randomNumber(i) % remained + 1;
            uint sum = 0;

            for (uint j = 0; j < length; j++) {
                (uint nftId, , uint remNFTCount) = mysteryBox.getPackageNFTInfo(packageId, j);
                sum += remNFTCount;
                if (sum >= number) {
                    mysteryBox.packageOpened(packageId, nftId);
                    NFT memory nft = getNFT(nftId);
                    _user.nfts.push(nft);
                    break;
                }
            }
        }
    }

    /*
     * Emits a {MysteryBoxOpened} event
     *
     * Requirements:
     * - quantity must greater than zero and less than or equal to unOpenedQuantity or maxOpenQuantity
     */
    function openMysteryBox(uint _quantity) public nonContract {
        UserMysteryBox storage user = usersMysteryBox[_msgSender()];
        uint unOpenedQuantity = user.userPackageIds.length - user.openedQuantity;

        require(_quantity > 0 && _quantity <= unOpenedQuantity && _quantity <= maxOpenQuantity, "quantity is zero or greater than unOpenedQuantity or maxOpenQuantity");

        delete user.nfts;

        getNFTs(user, _quantity);

        for (uint i = 0; i < user.nfts.length; i++) {
            NFT memory nft = user.nfts[i];

            if (token.isERC721(nft.tokenAddress)) {
                IERC721Upgradeable token721 = IERC721Upgradeable(nft.tokenAddress);
                token721.safeTransferFrom(address(nftDepositBox), _msgSender(), nft.tokenId);
            } else if (token.isERC1155(nft.tokenAddress)) {
                IERC1155Upgradeable token1155 = IERC1155Upgradeable(nft.tokenAddress);
                if(token.isInternal(nft.tokenAddress)) {
                    token1155.safeTransferFrom(address(this), _msgSender(), nft.tokenId, 1, "0x");
                }else {
                    token1155.safeTransferFrom(address(nftDepositBox), _msgSender(), nft.tokenId, 1, "0x");
                }

            }
        }

        user.openedQuantity += _quantity;

        emit MysteryBoxOpened(_msgSender(), user.nfts);
    }

    function getOpenableQuantity(address _address) public view returns (uint) {
        UserMysteryBox storage user = usersMysteryBox[_address];

        return user.userPackageIds.length - user.openedQuantity;
    }

    function getOpenedNFTsQuantity(address _address) public view returns (uint) {
        UserMysteryBox storage user = usersMysteryBox[_address];

        return user.nfts.length;
    }

    function getOpenedNFTInfo(address _address, uint _index) public view returns (NFT memory) {
        UserMysteryBox storage user = usersMysteryBox[_address];

        return user.nfts[_index];
    }

    function getRewardQuantity(uint _number) public view returns (uint) {
        uint hash = uint(sha256(abi.encodePacked(_number)));

        return rewardData[hash];
    }

    function getRewardPool() public view returns (uint) {
        return rewardPool;
    }

    function getRewardPayAccount() public view returns (address) {
        return rewardPayAccount;
    }

    function getMaxOpenQuantity() public view returns (uint) {
        return maxOpenQuantity;
    }

    function getToken20FeeReduction(address _token20Address) public view returns (uint) {
        return token20sFeeReduction[_token20Address];
    }

    //for test
    function setExternalBase(IExternalNftBase _externalBase) public onlyOwner {
        require(address(_externalBase) != address(0),"Not 0x00");
        externalNftBase = _externalBase;
    }

}
