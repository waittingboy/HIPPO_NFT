// Copyright (C) 2021 Cycan Technologies
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "./interfaces/IBase.sol";
import "./interfaces/IDemocracy.sol";
import "./interfaces/IHnqToken.sol";
import "./interfaces/INFTFactory.sol";
import "./interfaces/IMysteryBox.sol";
import "./interfaces/ICrowdFund.sol";
import "./interfaces/IDrawLots.sol";
import "./interfaces/IExternalNftBase.sol";

/// @notice CrowdfundPools receive pledge token, and award bonus token according different pool
contract CrowdfundPools is ICrowdFund, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using SafeERC20Upgradeable for IHnqToken;

    uint256 public oneMonth;
    uint256 public surplusBoundary;
    uint256 public hipAmountPerHnq;

    uint256 public minTotalAmount; //minimum total amount of every crowdfund
    //uint256 public maxDuration; //max duration of every crowdfund
    uint256 public minJoinAmount; // min join amount of Hnq
    uint256 public startBlock;
    uint256 public poolId;
    address[] public bonusTokens;
    mapping(address => bool) public isBonusToken;

    address public mysteryBoxMarket;
    IERC20MetadataUpgradeable public pledgeToken; //hipToken
    IHnqToken public hnqToken; //Qualification Token
    IBase public base;
    IDemocracy public democracy;
    INFTFactory public nftFactory;
    IDrawLots public drawLotsContract;

    // Info of each crowdfund user.
    struct UserInfo {
        uint256 amount; // How many pledged tokens the user has provided before crowdfund success.
        uint256 wonAmount; //How many pledged tokens wined after draw lots
        //tokenAddress => rewardDebtsOfToken
        mapping(address => uint256) rewardDebts; // Reward debts. See explanation below.
        uint256 releasedAmount; // after crowdfund success , release 80% first 8 months,release 20% after 4 months
        uint256 startIndexHNQ;
        uint256 endIndexHNQ;
    }

    // Info of each crowdfund pool.
    struct PoolInfo {
        uint256 proposalId; // equal to collectionId
        uint256 openAmount;
        uint256 dividendRatio; //per 1e6
        uint256 startTime; // start time of crowdfund
        uint256 duration; // crowdfund duration
        uint256 maxJoinAmount; // max join amount of Hnq
        //tokenAddress => accBonusPerShare
        mapping(address => uint256) accBonusesPerShare; //Accumulated bonusTokens per share, times 1e12.
        uint256 targetTotalAmount;
        uint256 curPledgeTotalAmount; // the total amount of HIP pledged now.
        uint256 lastRewardBlock; // Last block number that bonusTokens distribution occurs.
        address proposer;
        bool isCreatedNft;
    }
    mapping(uint256 => PoolInfo) public poolInfo;
    mapping(uint256 => uint256) public needHnqAmount;
    //workId => poolId
    mapping(uint256 => uint256) public override workId2PoolId;

    uint256[] public crowdfundingIds;
    mapping(uint256 => uint256) public crowdfundingId2Index;

    struct WinningData {
        bool isCompleted;
        bool isTrueTail;
        //decimal => tail numbers on this digit
        mapping(uint256 => uint256[]) decimalTails; //decimalTails[10].length <= 10;
        //winnedTail => is winned tail or not,
        mapping(uint256 => bool) isWinnedTail;
        //decimal => winnedTail =>is winned tail or not,
        mapping(uint256 => mapping(uint256 => bool)) isPosiWinnedTail;
    }
    //pid => WinningData
    mapping(uint256 => WinningData) public winnedDataOfPools;
    mapping(uint256 => uint256) public highestPosi;

    struct SurplusInfo {
        uint256 countedWonAmount;
        uint256 nextStart;
    }
    // Statistics of some of the winning data of surplus user.
    mapping(uint256 => mapping(address => SurplusInfo)) public surplusInfo;

    // Info of each user that stakes tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    //user joined crowdfund Id list
    mapping(address => uint256[]) public userJoinedIdList;

    //proposer's crowdfunds
    mapping(address => uint256[]) public myCrowdfundList;

    mapping(address => bool) public isManager;

    // ExternalNftBase contract
    IExternalNftBase public externalNftBase;

    uint256 public oneWeek;

    struct TicketInfo {
        uint256 hipAmountPerHnq;
        uint256 multiCostHnq;
    }
    // poolId => the info of ticket
    mapping(uint256 => TicketInfo) public ticketInfoOfPool;

    uint256 public override baseHipAmountPerHnq;
    uint256 public baseMultiCostHnq;

    uint256 public newSurplusBoundary;

    modifier onlyMysteryBoxMarket() {
        require(
            mysteryBoxMarket == _msgSender(),
            "Crowdfund:only mysteryBoxMarket can call"
        );

        _;
    }

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 unwinnedHipAmount,
        uint256 unwinnedHnqAmount
    );
    event Refund(
        address indexed user,
        uint256 indexed pid,
        uint256 amountHip,
        uint256 amountHnq
    );
    event Release(address indexed user, uint256 indexed pid, uint256 amount);
    event DestroyHnq(uint256 indexed pooId, uint256 destroyAmount);
    event DrawLots(
        uint256 indexed poolId,
        uint256 indexed highestPosition,
        uint256 winningAmount,
        uint256 totalAmount
    );

    function initialize(
        uint256 _startBlock,
        IERC20MetadataUpgradeable _pledgeToken,
        address _mysteryBoxMarket,
        IHnqToken _hnqToken,
        INFTFactory _nftFactory,
        IBase _base,
        IDemocracy _democracy,
        IDrawLots _drawLots,
        address[] memory _bonusTokens, //IMysteryBox _mysteryBox,
        IExternalNftBase _externalNftBase

    ) public initializer {
        __Ownable_init();
        startBlock = _startBlock;
        pledgeToken = _pledgeToken;
        hnqToken = _hnqToken;
        mysteryBoxMarket = _mysteryBoxMarket;
        base = _base;
        democracy = _democracy;
        nftFactory = _nftFactory;
        drawLotsContract = _drawLots;
        bonusTokens = _bonusTokens;
        uint256 len = _bonusTokens.length;
        for (uint256 i = 0; i < len; i++) {
            isBonusToken[_bonusTokens[i]] = true;
        }

        isManager[_msgSender()] = true;

        hipAmountPerHnq = 200000 * 10**pledgeToken.decimals(); //1 HNQ => 200000 HIP

        minTotalAmount = 200000 * 10**pledgeToken.decimals();
        surplusBoundary = 25000000 * 10**pledgeToken.decimals();
        minJoinAmount = 20*10**hnqToken.decimals();
        oneMonth = 30 days;

        crowdfundingIds.push(0);
        externalNftBase = _externalNftBase;

        oneWeek = 7 days;
        baseHipAmountPerHnq = 1000000 * 10**pledgeToken.decimals();
        baseMultiCostHnq = 20;
        newSurplusBoundary = 125000000 * 10**pledgeToken.decimals();
    }

    function addBonusToken(address _newBonusToken)
        external
        override
        onlyMysteryBoxMarket
        returns (bool)
    {
        if (isBonusToken[_newBonusToken]) return false;

        isBonusToken[_newBonusToken] = true;
        bonusTokens.push(_newBonusToken);
        return true;
    }

    function add(
        uint256 _proposalId,
        address _proposer,
        uint256 _openAmount,
        uint256 _dividendRatio,
        uint256 _duration,
        uint256 _maxJoinAmount,
        uint256 _targetAmount
    ) public override returns (uint256) {
        require(address(democracy) == _msgSender(), "Only democracy can call");
        require(_dividendRatio <= 1e6, "Ratio too large");

        require(
            baseHipAmountPerHnq >= hipAmountPerHnq &&
            baseHipAmountPerHnq % hipAmountPerHnq == 0,
            "baseHipAmountPerHnq must GT and divisible by hipAmountPerHnq"
        );
        require(baseMultiCostHnq >= 1, "_multiCostHnq must GT 0");
        uint256 lastRewardBlock = block.number > startBlock
            ? block.number
            : startBlock;
        _targetAmount = _targetAmount > minTotalAmount
            ? _targetAmount
            : minTotalAmount;
        require(
            _openAmount <= _targetAmount,
            "The amount of open crowdfund need LT _targetAmount"
        );

        //If the crowdfunding ratio is 0, you pledge yourself;
        //If the crowdfunding cycle is 0 and you can mint NFT immediately after pledging
        if (_openAmount == 0) _duration = 0;
        poolId++;
        ticketInfoOfPool[poolId].hipAmountPerHnq = baseHipAmountPerHnq;
        ticketInfoOfPool[poolId].multiCostHnq = baseMultiCostHnq;
        require(
            _openAmount % ticketInfoOfPool[poolId].hipAmountPerHnq == 0,
            "OpenAmount needs to be divisible by hipAmountPerHnq"
        );

        PoolInfo storage pool = poolInfo[poolId];
        pool.proposalId = _proposalId;
        pool.proposer = _proposer;
        pool.openAmount = _openAmount;
        pool.dividendRatio = _dividendRatio;
        pool.startTime = block.timestamp;
        pool.duration = _duration;
        pool.maxJoinAmount = _maxJoinAmount;// Hnq amount
        pool.targetTotalAmount = _targetAmount;
        pool.lastRewardBlock = lastRewardBlock;
        pool.curPledgeTotalAmount = 0;

        //set pool.isCreatedNft is true when the virtualBaseContract with NFT already created call
        if(_proposalId % 2 == 0) pool.isCreatedNft = true;

        needHnqAmount[poolId] =
            (_openAmount * 10**hnqToken.decimals()) /
            ticketInfoOfPool[poolId].hipAmountPerHnq;

        UserInfo storage user = userInfo[poolId][_proposer];
        uint256 _amountHnq;
        if (pool.openAmount == 0) {
            pledgeToken.safeTransferFrom(
                _proposer,
                address(this),
                _targetAmount
            );

            user.amount = _targetAmount;
            user.wonAmount = _targetAmount;

            pool.curPledgeTotalAmount += _targetAmount;
            winnedDataOfPools[poolId].isCompleted = true;

            _amountHnq = _targetAmount * 10**hnqToken.decimals() * ticketInfoOfPool[poolId].multiCostHnq / ticketInfoOfPool[poolId].hipAmountPerHnq ;
        } else {
            uint256 initAmount = _targetAmount - _openAmount;
            if(initAmount > 0) {
                pledgeToken.safeTransferFrom(_proposer, address(this), initAmount);
                user.amount = initAmount;
                user.wonAmount = initAmount;
                pool.curPledgeTotalAmount += initAmount;
                _amountHnq = initAmount * 10**hnqToken.decimals() * ticketInfoOfPool[poolId].multiCostHnq / ticketInfoOfPool[poolId].hipAmountPerHnq;
            }

            //when openAmount > 0 push poolId into crowdfundingIds
            crowdfundingIds.push(poolId);
            crowdfundingId2Index[poolId] = crowdfundingIds.length - 1;

        }

        //pay hnq token
        if(_amountHnq > 0)  hnqToken.safeTransferFrom(_proposer, address(this), _amountHnq);

        myCrowdfundList[_proposer].push(poolId);

        // if externalNftBase call, set workId2PoolId
        if(_proposalId % 2 == 0) {
            uint256 _workId = externalNftBase.collectIdToWorkId(_proposalId);
            workId2PoolId[_workId] = poolId;
        }

        return poolId;
    }

    function poolingBonusToPools(
        uint256[] memory _workIds,
        address _bonusToken,
        uint256 _totalBonusAmount
    ) external override onlyMysteryBoxMarket returns (bool) {
        uint256 len = _workIds.length;
        // Use two arrays to mimic the function of mapping,
        // arr1 to store the key and arr2 to store the value
        uint256[] memory keys = new uint256[](len);
        uint256[] memory poolIds = new uint256[](len);
        uint256[] memory accBonusAmounts = new uint256[](len);
        // Get all PoolIds corresponding to all workIds, including duplicate PoolIds
        for (uint256 i = 0; i < len; i++) {
            keys[i] = workId2PoolId[_workIds[i]];
        }
        // Store the index corresponding to the PoolId of the last dividend
        uint256 lastAccIndex;
        // Get the poolIds of the unique PoolId array and
        // accumulate the corresponding values into the values corresponding to the same subscript
        for (uint256 i = 0; i < len; i++) {
            for (uint256 j = 0; j < len; j++) {
                if (poolIds[j] == keys[i]) {
                    //keys[j] == pid or 0,j=>old, i=>new
                    accBonusAmounts[j]++;
                    break;
                }
                if (poolIds[j] == 0) {
                    poolIds[j] = keys[i];
                    accBonusAmounts[j]++;
                    lastAccIndex = j;
                    break;
                }
            }
        }

        uint256 totalTransferAmount = 0;
        for (uint256 i = 0; i < len; i++) {
            if (i == lastAccIndex) {
                updatePool(
                    poolIds[i],
                    IERC20MetadataUpgradeable(_bonusToken),
                    _totalBonusAmount - totalTransferAmount
                );
                break;
            }
            if (accBonusAmounts[i] > 0) {
                totalTransferAmount +=
                    (_totalBonusAmount * accBonusAmounts[i]) /
                    len;
                updatePool(
                    poolIds[i],
                    IERC20MetadataUpgradeable(_bonusToken),
                    (_totalBonusAmount * accBonusAmounts[i]) / len
                );
            } else break;
        }
        return true;
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(
        uint256 _pid,
        IERC20MetadataUpgradeable _bonusToken,
        uint256 _bonusAmount
    ) internal {
        //_bonusAmountDaily from Crowdfund transfer CrowdfundToken to PledgeMint contract accumulate pool.accBonusPerShare and bonusTotalAmount
        uint256 bonusReward = _bonusAmount;
        if (bonusReward == 0) {
            return;
        }
        PoolInfo storage pool = poolInfo[_pid];
        // Fully pledged by yourself, with rewards paid directly to the crowdfunding sponsor
        if (pool.openAmount == 0) {
            _bonusToken.safeTransferFrom(
                _msgSender(),
                pool.proposer,
                bonusReward
            );
        } else {
            uint256 dividendReward = (bonusReward * pool.dividendRatio) / 1e6;
            //dividend reward to bonus users join crowdfund
            _bonusToken.safeTransferFrom(
                _msgSender(),
                address(this),
                dividendReward
            );
            //proposer reward
            _bonusToken.safeTransferFrom(
                _msgSender(),
                pool.proposer,
                bonusReward - dividendReward
            );

            //uint lpSupply = pledgeToken.balanceOf(address(this));
            uint256 curPledgeTotalAmount = pool.curPledgeTotalAmount;
            if (curPledgeTotalAmount == 0) {
                pool.lastRewardBlock = block.number;
                return;
            } else {
                pool.accBonusesPerShare[address(_bonusToken)] =
                    pool.accBonusesPerShare[address(_bonusToken)] +
                    ((dividendReward * 1e12) / pool.openAmount);
            }
            pool.lastRewardBlock = block.number;
        }
    }

    // Deposit HIP tokens and cost HNQ tokens to CrowdfundPool for bonusTokens allocation.
    // _amountHnq == baseHnq * multiCostHnq;
    function deposit(uint256 _pid, uint256 _amountHnq) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        require(user.amount == 0, "Already joined");
        //check the amount of deposit
        require(pool.openAmount > 0, "This pool does not need crowdfund");
        require(pool.proposer != _msgSender(), "Not proposer");
        require(
            block.timestamp < pool.startTime + pool.duration,
            "Cannot deposit now"
        );

        uint256 costHipAmountPerDrawNumber = ticketInfoOfPool[_pid].hipAmountPerHnq;
        uint256 costHnqAmountPerDrawNumber = ticketInfoOfPool[_pid].multiCostHnq * 10 ** hnqToken.decimals();

        require(_amountHnq >= costHnqAmountPerDrawNumber,"_amountHnq need GT minJoinAmount");
        require(pool.maxJoinAmount >= _amountHnq, "_amountHnq need LT maxJoinAmount");

        uint256 _drawNumAmount = _amountHnq / costHnqAmountPerDrawNumber;//'_drawNumAmount' without decimals
        uint256 _amountHip = _drawNumAmount * costHipAmountPerDrawNumber;
        _amountHnq = _drawNumAmount * costHnqAmountPerDrawNumber;

        uint256 proposerDepositAmount = userInfo[_pid][pool.proposer].amount;
        user.startIndexHNQ =
            (pool.curPledgeTotalAmount - proposerDepositAmount) /
            costHipAmountPerDrawNumber +
            1;
        pool.curPledgeTotalAmount = pool.curPledgeTotalAmount + _amountHip;
        user.endIndexHNQ =
            user.startIndexHNQ +
            _drawNumAmount -
            1;

        pledgeToken.safeTransferFrom(
            address(_msgSender()),
            address(this),
            _amountHip
        );
        hnqToken.safeTransferFrom(
            address(_msgSender()),
            address(this),
            _amountHnq
        );

        userJoinedIdList[_msgSender()].push(_pid);
        user.amount += _amountHip;

        emit Deposit(_msgSender(), _pid, _amountHip);
    }

    //claim bonuses after crowdfund success.
    function claimBonus(uint256 _pid) public {
        uint256 result = getCrowdfundStatus(_pid);
        require(result == 1, "ClaimBonus: not success");

        updateCrowdfundingIds(_pid);

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        require(pool.openAmount > 0, "Not crowdfund not bonus");
        require(pool.proposer != _msgSender(), "Not proposer");
        uint256 len = bonusTokens.length;
        uint256 accBonusPerShare;
        uint256 pending;
        (bool bo,uint256 wonAmount) = getWonInfo(_pid, _msgSender());
        require(bo,"Not counted amountUser or not drwan");
        if(user.wonAmount > 0) wonAmount =user.wonAmount;

        require(wonAmount > 0, "Not won");
        for (uint256 i = 0; i < len; i++) {
            accBonusPerShare = pool.accBonusesPerShare[bonusTokens[i]];
            pending =
                (wonAmount * accBonusPerShare) /
                1e12 -
                user.rewardDebts[bonusTokens[i]];
            if (pending > 0) {
                safeBonusTokenTransfer(
                    IERC20MetadataUpgradeable(bonusTokens[i]),
                    _msgSender(),
                    pending
                );
                user.rewardDebts[bonusTokens[i]] =
                    (wonAmount * accBonusPerShare) /
                    1e12;
            }
        }
    }

    /// @dev View function to see pending bonusTokens on frontend.
    // Formula:pendingBonus = user.amount*accBonusPerShare_now - user.rewardDebt
    function pendingBonusToken(uint256 _pid, address _user)
        external
        view
        returns (uint256[] memory)
    {
        uint256 len = bonusTokens.length;
        uint256[] memory pendingRewards = new uint256[](len);
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user]; //pid may not equal proposalId
        if (pool.proposer == _user) return pendingRewards;
        uint256 accBonusPerShare;
        uint256 reward;

        (bool bo,uint256 wonAmount) = getWonInfo(_pid, _user);
        if(!bo) return pendingRewards;
        if(user.wonAmount > 0) wonAmount =user.wonAmount;

        for (uint256 i = 0; i < len; i++) {
            if (wonAmount > 0) {
                accBonusPerShare = pool.accBonusesPerShare[bonusTokens[i]];
                reward =
                    (wonAmount * accBonusPerShare) /
                    1e12 -
                    user.rewardDebts[bonusTokens[i]];
            } else {
                reward = 0;
            }
            pendingRewards[i] = reward;
        }
        return pendingRewards;
    }

    function getCrowdfundStatus(uint256 _pid)
        public
        view
        override
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        if(pool.startTime == 0 || pool.proposalId == 0) return 0;
        if (block.timestamp < pool.startTime + pool.duration) return 0;
        else {
            if (pool.curPledgeTotalAmount >= pool.targetTotalAmount) {
                if (pool.openAmount > 0) {
                    if (winnedDataOfPools[_pid].isCompleted) return 1;
                    else return 2;
                } else return 1; //pool.openAmount == 0,success
            } else return 3;
        }
    }

    function updateCrowdfundingIds(uint256 _pid) public {
        if (crowdfundingId2Index[_pid] > 0) {
            uint256 status = getCrowdfundStatus(_pid);
            // 1 success , 3 fail,0 being crowdfunded
            if (status == 1 || status == 3) {
                //replace deleted _proposalId with last proposingId
                crowdfundingIds[crowdfundingId2Index[_pid]] = crowdfundingIds[
                    crowdfundingIds.length - 1
                ];
                crowdfundingId2Index[
                    crowdfundingIds[crowdfundingIds.length - 1]
                ] = crowdfundingId2Index[_pid];
                delete crowdfundingId2Index[_pid]; //set 0
                crowdfundingIds.pop();
            }
        }
    }

    function storageWonInfo(
        uint256 _pid,
        uint256 _position,
        uint256 _winnedTail
    ) internal {
        winnedDataOfPools[_pid].decimalTails[_position].push(_winnedTail);
        winnedDataOfPools[_pid].isWinnedTail[_winnedTail] = true;
        winnedDataOfPools[_pid].isPosiWinnedTail[_position][_winnedTail] = true;
    }

    function getHighestPosi(uint256 _totalAmount)
        internal
        pure
        returns (uint256)
    {
        for (uint256 i = 0; i < 50; i++) {
            //X integer digits correspond to X +1 fractional digits
            if (_totalAmount / 10**i == 0) return i;
        }
    }

    function drawLots(uint256 _pid, uint256 _salt) public {
        if(winnedDataOfPools[_pid].isCompleted) return;
        PoolInfo storage pool = poolInfo[_pid];
        uint256 result = getCrowdfundStatus(_pid);
        require(result == 2, "drawLots: need in undrawn status");

        uint256 proposerDepositAmount = userInfo[_pid][pool.proposer].amount;
        //drawLotsContract//drawLots(_salt,_winningAmount,_totalAmount)
        uint256 hipAmountPerHnqOfPool = ticketInfoOfPool[_pid].hipAmountPerHnq;
        uint256 totalAmount = (pool.curPledgeTotalAmount -
            proposerDepositAmount) / hipAmountPerHnqOfPool;
        require(
            pool.openAmount / hipAmountPerHnqOfPool <= totalAmount,
            "The amount of crowdfund too less"
        );
        if (pool.openAmount / hipAmountPerHnqOfPool < totalAmount) {
            (
                uint256[] memory decimalTails,
                uint256[] memory pointValues,
                bool isTrueTail
            ) = drawLotsContract.drawLots(
                    _salt,
                    pool.openAmount / hipAmountPerHnqOfPool,
                    totalAmount
                );
            highestPosi[_pid] = getHighestPosi(totalAmount);
            uint256 nextTailIndex = 0;
            uint256 len = pointValues.length;
            for (uint256 i = 0; i < len; i++) {
                for (uint256 j = 0; j < pointValues[i]; j++) {
                    storageWonInfo(_pid, i + 1, decimalTails[nextTailIndex]);
                    nextTailIndex++;
                }
            }
            winnedDataOfPools[_pid].isTrueTail = isTrueTail;
        } else winnedDataOfPools[_pid].isTrueTail = true;

        winnedDataOfPools[_pid].isCompleted = true;

        emit DrawLots(
            _pid,
            highestPosi[_pid],
            pool.openAmount / hipAmountPerHnqOfPool,
            totalAmount
        );
    }

    /// @dev Batch calculate the Winning amount
    function calculateSurplusInfo(uint256 _pid, uint256 _maxGap) public {
        //_maxGap <= 60
        UserInfo storage user = userInfo[_pid][_msgSender()];
        SurplusInfo storage surUserInfo = surplusInfo[_pid][_msgSender()];
        PoolInfo storage pool = poolInfo[_pid];
        require(
            winnedDataOfPools[_pid].isCompleted,
            "Draw lots do not complete"
        );
        bool needCalc;
        //for test
        //if(_pid >= 1 && _pid <= 14) needCalc = user.amount >= surplusBoundary;
        //for prod
        if(_pid == 1 || _pid == 2) needCalc = user.amount >= surplusBoundary;
        else  needCalc = user.amount >= newSurplusBoundary;

        require(needCalc, "Not surplus user");

        require(
            surUserInfo.nextStart <= user.endIndexHNQ,
            "Already get won amount"
        );
        // false tail and the length of decimalTails is 0, all amount winning.

        if (
            (pool.curPledgeTotalAmount -
                userInfo[_pid][pool.proposer].amount) ==
            pool.openAmount &&
            winnedDataOfPools[_pid].isTrueTail
        ) {
            surUserInfo.countedWonAmount += user.amount;
            surUserInfo.nextStart = user.endIndexHNQ + 1;
            user.wonAmount = user.amount;
            return;
        }
        uint256 start = user.startIndexHNQ;
        if (start < surUserInfo.nextStart) start = surUserInfo.nextStart;
        uint256 end = user.endIndexHNQ + 1;
        if (end > start + _maxGap) end = start + _maxGap;
        uint256 _wonAmount;
        // Maximum 1000 cycles, Total number of cycles in two levels Less than 1000
        // Maximum number of tickets purchased 125
        for (uint256 i = start; i < end; i++) {
            for (uint256 n = 1; n <= highestPosi[_pid]; n++) {
                // Up to 8 cycles
                if (winnedDataOfPools[_pid].isPosiWinnedTail[n][i % 10**n])
                     _wonAmount += ticketInfoOfPool[_pid].hipAmountPerHnq;
            }
        }
        surUserInfo.countedWonAmount += _wonAmount;
        surUserInfo.nextStart = end;
        if (surUserInfo.nextStart > user.endIndexHNQ) withdraw(_pid);
    }

    //proposer call,need return 0
    function getWonInfo(uint256 _pid, address _user)
        public
        view
        returns (bool,uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        SurplusInfo storage surUserInfo = surplusInfo[_pid][_user];

        if(pool.openAmount ==0) return (true,user.wonAmount);
        //return 0 before draw lots
        if (!winnedDataOfPools[_pid].isCompleted || user.amount == 0) return (false,0);
        // false tail and the length of decimalTails is 0, all amount winning.
        if (
            (pool.curPledgeTotalAmount -
                userInfo[_pid][pool.proposer].amount) == pool.openAmount
        ) {
            return (true,user.amount);
        }

        uint256 _wonAmount;
        if (user.amount > 0 && user.wonAmount > 0)
            return (true,user.wonAmount);

        if (user.amount >= newSurplusBoundary) {
        //if (user.amount >= surplusBoundary) {
            // require(
            //     surUserInfo.nextStart >= user.endIndexHNQ,
            //     "Not counted the user amount"
            // );
            if(surUserInfo.nextStart < user.endIndexHNQ) {
                return (false,0);
            }
            if (winnedDataOfPools[_pid].isTrueTail)
                _wonAmount = surUserInfo.countedWonAmount;
            else _wonAmount = user.amount - surUserInfo.countedWonAmount;
        } else {
            uint256 start = user.startIndexHNQ;
            uint256 end = user.endIndexHNQ;
            // Maximum 1000 cycles, Total number of cycles in two levels Less than 1000
            // Maximum number of tickets purchased 125
            for (uint256 i = start; i <= end; i++) {
                for (uint256 n = 1; n <= highestPosi[_pid]; n++) {
                    // Up to 8 cycles
                    if (winnedDataOfPools[_pid].isPosiWinnedTail[n][i % 10**n])
                        _wonAmount += ticketInfoOfPool[_pid].hipAmountPerHnq;
                }
            }
            if (!winnedDataOfPools[_pid].isTrueTail)
                _wonAmount = user.amount - _wonAmount;
        }
        return (true,_wonAmount);
    }

    // Withdraw HIP and HNQ unwinned tokens from CrowdfundPool after crowdfund success.
    function withdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        require(user.amount > 0, "User did not joined");
        require(pool.openAmount > 0, "Only withdraw when openAmount > 0");
        require(pool.proposer != _msgSender(), "Not proposer");
        uint256 result = getCrowdfundStatus(_pid);
        require(result == 1, "withdraw: not success");

        updateCrowdfundingIds(_pid);

        (bool bo,uint256 wonAmount) = getWonInfo(_pid, _msgSender());
        require(bo,"Not counted amountUser or not drwan");
        if(user.wonAmount > 0) wonAmount =user.wonAmount;
        
        uint256 _unwinnedHipAmount = user.amount - wonAmount;
        require(_unwinnedHipAmount > 0, "Not unwinned amount");
        uint256 hipAmountPerHnqOfPool = ticketInfoOfPool[_pid].hipAmountPerHnq;

        uint256 _unwinnedHnqAmountBase = (_unwinnedHipAmount *
            10**hnqToken.decimals()) / hipAmountPerHnqOfPool;

        uint256 _unwinnedHnqAmount = _unwinnedHnqAmountBase * ticketInfoOfPool[_pid].multiCostHnq;

        user.amount = wonAmount;
        user.wonAmount = wonAmount;
        pledgeToken.safeTransfer(address(_msgSender()), _unwinnedHipAmount);
        hnqToken.safeTransfer(address(_msgSender()), _unwinnedHnqAmount);

        emit Withdraw(
            _msgSender(),
            _pid,
            _unwinnedHipAmount,
            _unwinnedHnqAmount
        );
    }

    // Refund HIP and HNQ tokens from CrowdfundPool after crowdfund fail.
    function refund(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        require(user.amount > 0, "User did not joined");
        require(pool.openAmount > 0, "Only refund when openAmount > 0");
        uint256 result = getCrowdfundStatus(_pid);
        require(result == 3, "refund: not failed");

        updateCrowdfundingIds(_pid);

        uint256 hipAmountPerHnqOfPool = ticketInfoOfPool[_pid].hipAmountPerHnq;

        uint256 _amountHip = user.amount;
        user.amount = 0;

        uint256 _baseAmountHnq = (_amountHip * 10**hnqToken.decimals()) /
            hipAmountPerHnqOfPool;

        uint256 _amountHnq = _baseAmountHnq * ticketInfoOfPool[_pid].multiCostHnq;

        if(_amountHip > 0) pledgeToken.safeTransfer(_msgSender(), _amountHip);

        if(_amountHnq > 0) hnqToken.safeTransfer(_msgSender(), _amountHnq);

        emit Refund(_msgSender(), _pid, _amountHip, _amountHnq);
    }

    function release(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        uint256 result = getCrowdfundStatus(_pid);
        require(result == 1, "release: not success");

        updateCrowdfundingIds(_pid);

        bool bo;
        uint256 wonAmount;
        if (pool.openAmount == 0) {
            require(
                _msgSender() == pool.proposer,
                "Only proposer can release when openAmount == 0"
            );
            //wonAmount = user.wonAmount;
        } else {
            if (user.wonAmount == 0) {
                (bo,wonAmount) = getWonInfo(_pid, _msgSender());        
                require(bo,"Not counted amountUser or not drwan");
                if(wonAmount > 0) user.wonAmount = wonAmount;
            }
                
        }
        require(user.wonAmount > 0, "Not won, not release");
        if (user.releasedAmount >= user.wonAmount) return;

        uint256 intervalWeek = (block.timestamp -
            (pool.startTime + pool.duration)) / oneWeek;

        if (intervalWeek > 4) intervalWeek = 4;

        uint256 releaseAmount;
        if(_pid == 1) {
            releaseAmount = user.wonAmount - user.releasedAmount;
        }else {
            if (intervalWeek > 0) {
                releaseAmount = (user.wonAmount / 4) * intervalWeek - user.releasedAmount;
            }
        }

        if(releaseAmount >0) {
            user.releasedAmount += releaseAmount;
            pledgeToken.safeTransfer(address(_msgSender()), releaseAmount);
            emit Release(_msgSender(), _pid, releaseAmount);
        }
    }

    function getReleaseAmount(uint256 _pid,address _userAddr) public view returns(uint) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_userAddr];
        uint256 result = getCrowdfundStatus(_pid);
        uint256 releaseAmount;
        uint wonAmount = user.wonAmount;
        bool bo;
        if(result == 1) {
            if ((pool.openAmount == 0 && _userAddr == pool.proposer) || pool.openAmount > 0) {
                if (wonAmount == 0) {
                    (bo, wonAmount) = getWonInfo(_pid, _userAddr);
                    if(!bo && wonAmount == 0) return 0;

                }
                if(wonAmount > 0) {
                    if (user.releasedAmount >= wonAmount) return 0;

                    uint256 intervalWeek = (block.timestamp -(pool.startTime + pool.duration)) / oneWeek;
                    if (intervalWeek > 4) intervalWeek = 4;

                    if(_pid == 1) {
                        releaseAmount = user.wonAmount - user.releasedAmount;
                    }else {
                        if (intervalWeek > 0) {
                            releaseAmount = wonAmount / 4 * intervalWeek - user.releasedAmount;
                        }
                    }
                }
            }

        }else return 0;

        return releaseAmount;
    }

    function destroyHNQ(uint256 _pid) public {
        uint256 result = getCrowdfundStatus(_pid);
        require(result == 1, "destroyHNQ: not success");
        PoolInfo storage pool = poolInfo[_pid];
        require(needHnqAmount[_pid] > 0, "Already destroyed");
        uint256 hipAmountPerHnqOfPool = ticketInfoOfPool[_pid].hipAmountPerHnq;
        uint256 _baseAmountHnq = (pool.openAmount * 10**hnqToken.decimals()) /
            hipAmountPerHnqOfPool;

        uint256 destroyHnqAmount = _baseAmountHnq * ticketInfoOfPool[_pid].multiCostHnq;
        needHnqAmount[_pid] = 0;
        hnqToken.burn(destroyHnqAmount);
        emit DestroyHnq(_pid, destroyHnqAmount);
    }

    function batchCreateNFT(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        require(pool.proposalId % 2 == 1,"Only odd proposalId can create NFT");
        uint256 result = getCrowdfundStatus(_pid);
        require(result == 1, "crowdfund is not success");

        uint256 len = base.getCollectLen(pool.proposalId);
        uint256[] memory _workIds = base.getAllWorkIdsOfCollection(
            pool.proposalId
        );
        string memory _url;
        uint256[] memory _nums;
        uint256 _completeNftId;
        //works info
        for (uint256 i = 0; i < len; i++) {
            (_url, _nums) = base.getWorkInfo(_workIds[i]);
            //mint NFTs to mysteryBoxMarket
            (_completeNftId, ) = nftFactory.mint(
                address(mysteryBoxMarket),
                _url,
                _nums[0],
                _nums[1],
                _nums[2]
            );
            // cannot re-fulfill work info
            base.fulfillWorkNftInfo(_workIds[i], _completeNftId);
            workId2PoolId[_workIds[i]] = _pid;
        }
        pool.isCreatedNft = true;
        updateCrowdfundingIds(_pid);
    }

    // set manager address accepted by pledgeDividendPools
    function setManager(address _manager, bool _bo) public onlyOwner {
        isManager[_manager] = _bo;
    }

    function setGlobalParam(
        uint256 _minTotalAmount,
        uint256 _hipAmountPerHnq,
        uint256 _minJoinAmount
    ) public onlyOwner {
        if(minTotalAmount != _minTotalAmount) minTotalAmount = _minTotalAmount;
        if(hipAmountPerHnq != _hipAmountPerHnq) hipAmountPerHnq = _hipAmountPerHnq;
        if(minJoinAmount != _minJoinAmount) minJoinAmount = _minJoinAmount;
    }

    // Safe bonus token transfer function, just in case if rounding error causes pool to not have enough bonus tokens.
    function safeBonusTokenTransfer(
        IERC20MetadataUpgradeable bonusToken,
        address _to,
        uint256 _amount
    ) internal {
        uint256 bonusTokenBal = bonusToken.balanceOf(address(this));
        if (_amount > bonusTokenBal) {
            bonusToken.safeTransfer(_to, bonusTokenBal);
        } else {
            bonusToken.safeTransfer(_to, _amount);
        }
    }

    function poolLength() external view returns (uint256) {
        return poolId;
    }

    function getMyCrowdfundListLen(address _user)
        external
        view
        returns (uint256)
    {
        return myCrowdfundList[_user].length;
    }

    function getUserJoinedIdListLen(address _user)
        external
        view
        returns (uint256)
    {
        return userJoinedIdList[_user].length;
    }

    function getPartialMyCrowdfundList(
        address _user,
        uint256 _start,
        uint256 _end
    ) external view returns (uint256[] memory) {
        require(
            _end - _start >= 0 && _end < myCrowdfundList[_user].length,
            "Index wrong"
        );
        uint256[] memory partIds = new uint256[](_end - _start + 1);
        for (uint256 i = _start; i <= _end; i++) {
            partIds[i - _start] = myCrowdfundList[_user][i];
        }
        return partIds;
    }

    function getPartialUserJoinedIdList(
        address _user,
        uint256 _start,
        uint256 _end
    ) external view returns (uint256[] memory) {
        require(
            _end - _start >= 0 && _end < userJoinedIdList[_user].length,
            "Index wrong"
        );
        uint256[] memory partIds = new uint256[](_end - _start + 1);
        for (uint256 i = _start; i <= _end; i++) {
            partIds[i - _start] = userJoinedIdList[_user][i];
        }
        return partIds;
    }

    function getCrowdfundingIdsLen() external view returns (uint256) {
        return crowdfundingIds.length;
    }

    function getPartialCrowdfundingIds(uint256 _start, uint256 _end)
        external
        view
        returns (uint256[] memory)
    {
        require(
            _end - _start >= 0 && _end < crowdfundingIds.length,
            "Index wrong"
        );
        uint256[] memory partIds = new uint256[](_end - _start + 1);
        for (uint256 i = _start; i <= _end; i++) {
            partIds[i - _start] = crowdfundingIds[i];
        }
        return partIds;
    }

    function getAllCrowdfundingIds() external view returns (uint256[] memory) {
        uint256[] memory allIds = new uint256[](crowdfundingIds.length);
        allIds = crowdfundingIds;
        return allIds;
    }

    function getAllBonusTokens() public view returns(address[] memory) {
        return bonusTokens;
    }

    function setSurplusBoundary(uint256 _newSurplusBoundary) public onlyOwner {
        surplusBoundary = _newSurplusBoundary * 10**pledgeToken.decimals();
    }

    function setAccBonusesPerShares(uint256 _pid,uint256 _newAcc) public onlyOwner {
        PoolInfo storage pool = poolInfo[_pid];
        pool.accBonusesPerShare[bonusTokens[0]] = _newAcc;
    }

    function setBaseParams(
        uint256 _newSurplusBoundary,
        uint256 _baseHipAmountPerHnq,
        uint256 _baseMultiCostHnq
    ) public onlyOwner {
        newSurplusBoundary = _newSurplusBoundary;
        baseHipAmountPerHnq = _baseHipAmountPerHnq;
        baseMultiCostHnq = _baseMultiCostHnq;
    }

    function getAccBonusesPerShares(uint256 _pid)
        public
        view
        returns (uint256[] memory accBonusesPerShares)
    {
        uint256 len = bonusTokens.length;
        PoolInfo storage pool = poolInfo[_pid];
        accBonusesPerShares = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            accBonusesPerShares[i] = pool.accBonusesPerShare[bonusTokens[i]];
        }
    }

}
