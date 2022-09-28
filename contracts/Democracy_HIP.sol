// Copyright (C) 2021 Cycan Technologies
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./interfaces/IBase.sol";
import "./interfaces/ICrowdFund.sol";
import "./interfaces/IDemocracy.sol";
import "./interfaces/IOracle.sol";
import "./interfaces/IMysteryBox.sol";

contract Democracy is IDemocracy, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    IERC20MetadataUpgradeable public hipToken;
    IERC20MetadataUpgradeable public usdToken;

    IBase public base;
    ICrowdFund public crowdfund;
    address public feeTo;

    uint256 public maxProposalId;
    uint256 public totalPropNum;

    uint256 public maxDuration; //max duration of every crowdfund
    uint256 public minValuation;
    uint256 public override hipAmountPerHnq;

    uint256 public pledgeRate;

    uint256[] public proposingIds;
    mapping(uint256 => uint256) public proposingId2Index;

    struct ProposalInfo {
        address proposer;
        uint256 startTime;
        uint256 endTime; //startTime + voteDuration
        uint256 lastCrowdfundId; //last crowdfund id launched by this proposal
        uint256 crowdfundRatio; // per 1e6
        uint256 dividendRatio; // per 1e6
        uint256 duration;
        uint256 maxJoinAmount;
        uint256 valuation; // uint HIP, token amount with decimals
        uint8 status; //Proposal status: 1.Proposal 2.Voting 3.Proposal passed 4.Proposal failed 5.Votes counted
        uint8 failNum; //failNum++ when Proposal failed,and failNum<=3;
    }
    //collectionId == proposalId => ProposalInfo
    mapping(uint256 => ProposalInfo) public proposals;
    mapping(address => uint256[]) public userProposals;

    struct VoteInfo {
        uint256 totalLockNum; //Total Amount of locked token
        uint256 approve; //Number of votes in approve
        uint256 against; //Number of votes in against
        uint256 voters; //Number of voters joined
    }
    //proposalId => failed Number => VoteInfo
    mapping(uint256 => mapping(uint256 => VoteInfo)) public votes;
    //User voting data, a positive number is the number of positive votes, a negative number is the number of negative votes, uint is the proposal ID
    //userAddress => proposalId => failed Number => the number of votes
    mapping(address => mapping(uint256 => mapping(uint256 => int256)))
    public userVote;

    //user voted proposalId list
    mapping(address => uint256[]) public userVotedList;
    mapping(address => mapping(uint256 => bool)) public isUserVotedPropId;

    uint256 public voteUsersNeed; //minimum number of account to vote
    uint256 public voteDuration; //Voting duration
    uint256 public uploadFeePerWork; //Fee of uploading one work

    mapping(address => bool) public isManager;

    IBase public externalNftBase;

    IOracle public oracle;

    // if crowdRatioSwitch is 'true',crowdRatio must be 'specifiedCrowdRatio'; 'false' for any crowdRatio
    bool public crowdRatioSwitch;
    uint256 public specifiedCrowdRatio;

    // 0:Simple majority system; 1:Absolute majority in favour of the system;
    uint256 internal countVoteMethodNum;
    uint256 public voteScaleFactor;// per 10000

    // max amount to vote
    uint256 public maxAmountVote;
    // the proposal Id => the HIP amount to proposal fee
    mapping(uint256 => uint256) public feeToCreateProp;

    //IMysteryBox
    IMysteryBox public mysteryBox;


    modifier onlyManager() {
        require(isManager[_msgSender()], "Democracy:only managers can call");

        _;
    }

    event Proposal(
        address indexed sender,
        uint256 indexed proposalId,
        uint256 worksNum,
        uint256 failNum
    );
    event Update(
        address indexed sender,
        uint256 indexed proposalId,
        uint256 result
    );
    event Vote(
        address indexed sender,
        uint256 indexed proposalId,
        uint256 indexed failNum,
        int256 amount
    );
    event Refund(
        address indexed sender,
        uint256 indexed proposalId,
        uint256 indexed failNum,
        uint256 amount
    );

    constructor() {}

    function initialize(
        IERC20MetadataUpgradeable _hip,
        uint256 _uploadFeePerWork,
        IBase _base,
        address _feeTo,
        uint256 _pledgeRate,//init 10000 => 100%
        IERC20MetadataUpgradeable _usdToken,
        IBase _externalNftBase,
        ICrowdFund _crowdfund,
        IMysteryBox _mysteryBox 
        
    ) public initializer {
        __Ownable_init();
        hipToken = _hip;
        uploadFeePerWork = _uploadFeePerWork;
        //init 200, 000hip/work, 2e23
        base = _base;
        feeTo = _feeTo;
        externalNftBase = _externalNftBase;
        crowdfund = _crowdfund;
        mysteryBox = _mysteryBox;
        voteDuration = 3 days;
        voteUsersNeed = 1;

        hipAmountPerHnq = 200000 * 10 ** hipToken.decimals();
        maxDuration = 30 days;

        usdToken = _usdToken;
        minValuation = 1e6 * 10 ** hipToken.decimals();

        pledgeRate = _pledgeRate;
        crowdRatioSwitch = true;
        specifiedCrowdRatio = 1e6;
        voteScaleFactor = 1000;// per 10000

        maxAmountVote = 1e6 * 10 ** hipToken.decimals();
    }

    function setVoteScaleFactor(uint256 _newFactor) external onlyOwner {
        require(_newFactor <= 10000,"Invalid new voteScaleFactor");
        voteScaleFactor = _newFactor;
    }

    function setCountVoteMethodNum(uint256 _newNum) external onlyOwner {
        require(_newNum <= 2,"Invalid new countVoteMethodNum");
        countVoteMethodNum = _newNum;
    }

    function setCrSwitchAndScRatio(bool _newSwitch, uint256 _newRatio) external onlyOwner{
        require(_newRatio <= 1e6,"_newRatio too large");
        if(crowdRatioSwitch != _newSwitch) crowdRatioSwitch = _newSwitch;
        if(specifiedCrowdRatio != _newRatio) specifiedCrowdRatio = _newRatio;
    }

    function setPledgeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 10000, "The pledge rate need LT 100%");
        pledgeRate = _newRate;
    }

    function setMysteryBox(IMysteryBox _mysteryBox) external onlyOwner {
        require(address(_mysteryBox) != address(0), "Zero address");
        mysteryBox = _mysteryBox;
    }

    function setManager(address _manager, bool _bo) public onlyOwner {
        require(_manager != address(0), "can't set manager to address zero");
        isManager[_manager] = _bo;
    }

    function setCrowdfund(ICrowdFund _crowdfund) public onlyOwner {
        require(address(_crowdfund) != address(0));
        crowdfund = _crowdfund;
    }

    function initProposal(
        uint256 _collectionId,
        uint256 _crowdfundRatio,
        uint256 _dividendRatio,
        uint256 _duration,
        uint256 _maxJoinAmount,
        uint256 _valuation,
        IBase _ibase
    ) public returns (bool) {
        uint256 _num = _ibase.getTotalNftNumOfCollect(_collectionId);
        require(_num > 0, "Nums of NFTs need GT 0");
        require(
            _ibase.getUploaderOfCollection(_collectionId) == _msgSender(),
            "Not your collection"
        );

        //call _initProposal()
        return
        _initProposal(
            _collectionId,
            _msgSender(),
            _num,
            _crowdfundRatio,
            _dividendRatio,
            _duration,
            _maxJoinAmount,
            _valuation
        );
    }

    function initProposalFromBase(
        uint256 _collectionId,
        address _uploader,
        uint256 _num,
        uint256 _crowdfundRatio,
        uint256 _dividendRatio,
        uint256 _duration,
        uint256 _maxJoinAmount,
        uint256 _valuation
    ) public override returns (bool) {
        require(
            address(base) == _msgSender() ||
            address(externalNftBase) == _msgSender(),
            "Only Base can call"
        );

        return
        _initProposal(
            _collectionId,
            _uploader,
            _num,
            _crowdfundRatio,
            _dividendRatio,
            _duration,
            _maxJoinAmount,
            _valuation
        );
    }

    // Self-funded: _crowdfundRatio ==0
    // Partial Crowdfunding: _crowdfundRatio > 0
    function _initProposal(
        uint256 _collectionId,
        address _uploader,
        uint256 _num,
        uint256 _crowdfundRatio,
        uint256 _dividendRatio,
        uint256 _duration,
        uint256 _maxJoinAmount,
        uint256 _valuation
    ) internal returns (bool) {
        if(crowdRatioSwitch) {
            require(_crowdfundRatio == specifiedCrowdRatio,"Input _crowdfundRatio must be equal to specifiedCrowdRatio");
        }

        _checkCrowdfundParams(_crowdfundRatio, _dividendRatio, _duration, _maxJoinAmount, _valuation);

        require(proposals[_collectionId].status == 0, "Proposal Existed");

        //(uint256 priceMainPool,,,) = mysteryBox.getPoolInfo(0);
        uint256 totalPropFee = uploadFeePerWork * _num;
        feeToCreateProp[_collectionId] = totalPropFee;
        hipToken.safeTransferFrom(_uploader, address(this), totalPropFee);

        if (_collectionId > maxProposalId) maxProposalId = _collectionId;
        totalPropNum++;
        proposals[_collectionId].proposer = _uploader;

        _setPropInfo(_collectionId, _crowdfundRatio, _dividendRatio, _duration, _maxJoinAmount, _valuation);

        //add new proposal into user's proposals
        userProposals[_uploader].push(_collectionId);

        emit Proposal(_uploader, _collectionId, _num, 0);
        return true;
    }

    function _checkCrowdfundParams(
        uint256 _crowdfundRatio,
        uint256 _dividendRatio,
        uint256 _duration,
        uint256 _maxJoinAmount,
        uint256 _valuation
    ) internal {
        require(_dividendRatio <= 1e6, "Dividend ratio too large");
        require(_crowdfundRatio <= 1e6, "Crowdfund ratio too large");
        require(_duration <= maxDuration, "Duration exceeds max duration");
        require(_valuation >= minValuation, "_valuation need GT minValuation");
        require(_maxJoinAmount / 1e9 * hipAmountPerHnq / 1e9 >= minValuation, "_maxJoinAmount need GT 20 HNQ");

    }

    function _setPropInfo(
        uint256 _proposalId,
        uint256 _crowdfundRatio,
        uint256 _dividendRatio,
        uint256 _duration,
        uint256 _maxJoinAmount,
        uint256 _valuation
    ) internal {
        ProposalInfo storage proposal = proposals[_proposalId];

        proposal.status = 1;
        proposal.startTime = block.timestamp;

        //crowdfund params
        proposal.crowdfundRatio = _crowdfundRatio;
        proposal.dividendRatio = _dividendRatio;
        proposal.maxJoinAmount = _maxJoinAmount;
        proposal.duration = _duration;
        proposal.valuation = _valuation;

        //add new proposal into proposing proposals
        proposingIds.push(_proposalId);
        proposingId2Index[_proposalId] = proposingIds.length - 1;
    }

    /// Modify the collection in Base contract first, then launch the proposal and vote
    function modifyProposal(
        uint256 _proposalId,
        uint256 _crowdfundRatio,
        uint256 _dividendRatio,
        uint256 _duration,
        uint256 _maxJoinAmount,
        uint256 _valuation
    ) public {
        IBase _base;
        if(_proposalId % 2 == 1) _base = base;
        else _base = externalNftBase;

        _checkCrowdfundParams(_crowdfundRatio, _dividendRatio, _duration, _maxJoinAmount, _valuation);

        ProposalInfo storage proposal = proposals[_proposalId];
        require(proposal.proposer == _msgSender(), "msgSender is not proposer");
        require(proposal.status == 4, "This proposal must be failed");
        require(
            proposal.failNum > 0 && proposal.failNum < 3,
            "FailNum need GT 0 and LT 3"
        );

        uint256 num = _base.getTotalNftNumOfCollect(_proposalId);
        require(num > 0, "Nums of works need GT 0");
        uint256 totalPropFee = uploadFeePerWork * num;
        require(feeToCreateProp[_proposalId] == 0,"feeToCreateProp is not 0");
        feeToCreateProp[_proposalId] = totalPropFee;
        hipToken.safeTransferFrom(_msgSender(), address(this), totalPropFee);

        _setPropInfo(_proposalId, _crowdfundRatio, _dividendRatio, _duration, _maxJoinAmount, _valuation);

        emit Proposal(_msgSender(), _proposalId, num, proposal.failNum);
    }

    /**
     * @dev get proposal state
     * There is no proposal when the result is Zero.
     */
    function getPropState(uint256 _proposalId) public view override returns (uint8) {
        if (_proposalId == 0 || _proposalId > maxProposalId) return 0;
        ProposalInfo storage proposal = proposals[_proposalId];
        if (proposal.status == 1 || proposal.status == 2) {
            if (block.timestamp <= proposal.startTime + voteDuration) return 2;
            else return 5;
        } else return proposal.status;
    }

    function updateProposalStatus(uint256 _proposalId) public {
        require(
            proposals[_proposalId].status != 0,
            "proposalId is not existed"
        );
        uint256 propStatus = getPropState(_proposalId);
        ProposalInfo storage proposal = proposals[_proposalId];
        if (propStatus == 2 || propStatus == 5)
            proposal.status = uint8(propStatus);

        uint256 fee = feeToCreateProp[_proposalId];
        uint256 result = getVoteResult(_proposalId, proposal.failNum);
        if (result == 1 || result == 2) {
            if (result == 1) {
                proposal.status = 3;
                proposal.endTime = block.timestamp;

                // if proposal success, the fee for created proposal will transfer back to '_uploader'
                if(fee > 0){
                    delete feeToCreateProp[_proposalId];
                    hipToken.safeTransfer(proposal.proposer, fee);
                }
                emit Update(_msgSender(), _proposalId, 3);
            } else {
                proposal.status = 4;
                if (proposal.failNum < 3 && propStatus == 5)
                    proposal.failNum += 1;
                proposal.endTime = block.timestamp;

                // if proposal failed, the fee for created proposal will transfer to 'feeTo'
                if(fee > 0){
                    delete feeToCreateProp[_proposalId];
                    hipToken.safeTransfer(feeTo, fee);
                }
                emit Update(_msgSender(), _proposalId, 4);
            }
            //replace deleted _proposalId with last proposingId
            proposingIds[proposingId2Index[_proposalId]] = proposingIds[
            proposingIds.length - 1
            ];
            proposingId2Index[
            proposingIds[proposingIds.length - 1]
            ] = proposingId2Index[_proposalId];
            delete proposingId2Index[_proposalId];
            proposingIds.pop();
        }
    }

    function vote(uint256 _proposalId, int256 _amount) public {
        ProposalInfo storage proposal = proposals[_proposalId];
        uint256 failNum = proposal.failNum;
        require(failNum < 3, "Cannot vote when failNum >= 3");
        require(
            userVote[_msgSender()][_proposalId][failNum] == 0,
            "Already vote the proposal!"
        );
        require(
            block.timestamp < proposal.startTime + voteDuration,
            "Need on vote duration"
        );
        uint256 poll;
        if (_amount < 0) poll = uint256(- _amount);
        else poll = uint256(_amount);
        require(poll > 0, "Poll can't be zero");
        require(poll <= maxAmountVote,"The amount to vote too large");
        require(
            poll % (1000 * 10 ** hipToken.decimals()) == 0,
            "Amount must be divisible by 1000 tokens"
        );

        if (proposal.status == 1) proposal.status = 2;
        require(proposal.status == 2, "Not at vote status");

        hipToken.safeTransferFrom(_msgSender(), address(this), poll);
        userVote[_msgSender()][_proposalId][failNum] = _amount;

        VoteInfo storage voteInfo = votes[_proposalId][failNum];
        if (_amount > 0) voteInfo.approve += poll;
        else voteInfo.against += poll;
        voteInfo.voters += 1;
        voteInfo.totalLockNum += poll;

        //add proposal id into user voted list
        if (!isUserVotedPropId[_msgSender()][_proposalId]) {
            userVotedList[_msgSender()].push(_proposalId);
            isUserVotedPropId[_msgSender()][_proposalId] = true;
        }

        emit Vote(_msgSender(), _proposalId, failNum, _amount);
    }

    function refund(uint256 _proposalId, uint256 _failNum) public {
        uint256 failNum = proposals[_proposalId].failNum;
        if (_failNum == failNum) {
            require(
                block.timestamp >
                proposals[_proposalId].startTime + voteDuration,
                "Need passed vote duration"
            );
        }

        int256 amount = userVote[_msgSender()][_proposalId][_failNum];
        require(amount != 0, "Not exist");
        if (amount >= 0) {
            hipToken.safeTransfer(_msgSender(), uint256(amount));
        } else {
            hipToken.safeTransfer(_msgSender(), uint256(- amount));
        }
        //clear user vote data
        userVote[_msgSender()][_proposalId][_failNum] = 0;

        emit Refund(_msgSender(), _proposalId, _failNum, uint256(- amount));
    }

    /// Self-funded: _crowdfundRatio ==0
    /// Partial Crowdfunding: _crowdfundRatio > 0
    function toCrowdfund(uint256 _proposalId) public {
        ProposalInfo storage proposal = proposals[_proposalId];
        require(proposal.proposer == _msgSender(), "Not proposer");
        uint256 status = getPropState(_proposalId);
        require(status == 3, "Proposal did not pass");
        //only initial or failed state
        require(canCrowdfund(_proposalId), "Cannot launch crowdfund");
        uint256 baseHipAmountPerHnq = crowdfund.baseHipAmountPerHnq();
        uint256 _targetAmount = proposal.valuation;
        uint256 _openAmount = _targetAmount * proposal.crowdfundRatio / 1e6;
        // ensure that _openAmount must be a multiple of hipAmountPerHnq
        // for integer number of the payable HNQs
    
        if(_openAmount % baseHipAmountPerHnq != 0) {
            _openAmount = (_openAmount/baseHipAmountPerHnq +1)*baseHipAmountPerHnq;
        }

        uint256 newId = crowdfund.add(
            _proposalId,
            _msgSender(),
            _openAmount,
            proposal.dividendRatio,
            proposal.duration,
            proposal.maxJoinAmount,
            _targetAmount
        );
        proposal.lastCrowdfundId = newId;
    }

    function updateGlobalParams(
        uint256 _voteDura,
        uint256 _voteUsersNeed,
        uint256 _uploadFeePerWork
    ) public onlyManager {
        voteDuration = _voteDura;
        voteUsersNeed = _voteUsersNeed;
        uploadFeePerWork = _uploadFeePerWork;
    }

    function setPledgeParams(uint256 _hipAmountPerHnq)
    public
    onlyManager
    returns (bool)
    {
        hipAmountPerHnq = _hipAmountPerHnq;
        return true;
    }

    function setMaxDuration(uint256 _maxDuration) public onlyOwner {
        maxDuration = _maxDuration;
    }

    function getVoteResult(uint256 _proposalId, uint256 _failNum)
    public
    view
    returns (uint8)
    {
        uint256 status = getPropState(_proposalId);
        if (status == 1 || status == 2) return 0;
        else if (status == 3) return 3;
        else if (status == 4) return 4;
        else if (status == 5) {
            VoteInfo storage voteInfo = votes[_proposalId][_failNum];
            if (voteInfo.voters < voteUsersNeed) return 2;
            uint256 powerSupply = hipToken.totalSupply();
            if (countingVote(voteInfo.approve, voteInfo.against, powerSupply))
                return 1;
            else return 2;
        } else return 0;
    }

    /**
     * @dev calculate the vote result
     * approve is the number of approve,_against is the number of against,_powerSupply is the all token in all net.
     */
    function countingVote(
        uint256 _approve,
        uint256 _against,
        uint256 _powerSupply
    ) public view returns (bool) {

        if(countVoteMethodNum == 0) return _approve > _against;

        _approve = _approve / (10**hipToken.decimals());
        _against = _against / (10**hipToken.decimals());
        uint256 turnout = _approve + _against;
        uint256 electorate = _powerSupply * voteScaleFactor / 10000 / (10**hipToken.decimals());
        require(electorate > 0, "PowerSupply must > 0");
        uint256 a = _against ** 2 * electorate;
        uint256 b = _approve ** 2 * turnout;
        return a < b;
    }

    function getVoteData(uint256 _proposalId, uint256 _failNum)
    public
    view
    returns (
        uint256 _approved,
        uint256 _against,
        uint256 _voters
    )
    {
        VoteInfo storage voteInfo = votes[_proposalId][_failNum];
        return (voteInfo.approve, voteInfo.against, voteInfo.voters);
    }

    function canModifyCollection(uint256 _proposalId)
    public
    view
    override
    returns (bool)
    {
        uint256 status = getPropState(_proposalId);
        if (status == 0 || status == 4) return true;
        return false;
    }

    function getProposingIdsLen() external view returns (uint256) {
        return proposingIds.length;
    }

    function getUserVotedListLen(address _user)
    external
    view
    returns (uint256)
    {
        return userVotedList[_user].length;
    }

    function getPartialProposingIds(uint256 _start, uint256 _end)
    external
    view
    returns (uint256[] memory)
    {
        require(
            _end - _start >= 0 && _end < proposingIds.length,
            "Index wrong"
        );
        uint256[] memory partIds = new uint256[](_end - _start + 1);
        for (uint256 i = _start; i <= _end; i++) {
            partIds[i - _start] = proposingIds[i];
        }
        return partIds;
    }

    function getUserProposalIdsLen(address _user)
    external
    view
    returns (uint256)
    {
        return userProposals[_user].length;
    }

    function getPartialUserProposalIds(
        address _user,
        uint256 _start,
        uint256 _end
    ) external view returns (uint256[] memory) {
        require(
            _end - _start >= 0 && _end < userProposals[_user].length,
            "Index wrong"
        );
        uint256[] memory partIds = new uint256[](_end - _start + 1);
        for (uint256 i = _start; i <= _end; i++) {
            partIds[i - _start] = userProposals[_user][i];
        }
        return partIds;
    }

    function getPartialUserVotedList(
        address _user,
        uint256 _start,
        uint256 _end
    ) external view returns (uint256[] memory) {
        require(
            _end - _start >= 0 && _end < userVotedList[_user].length,
            "Index wrong"
        );
        uint256[] memory partIds = new uint256[](_end - _start + 1);
        for (uint256 i = _start; i <= _end; i++) {
            partIds[i - _start] = userVotedList[_user][i];
        }
        return partIds;
    }

    function getAllProposingIds() external view returns (uint256[] memory) {
        uint256[] memory allIds = new uint256[](proposingIds.length);
        allIds = proposingIds;
        return allIds;
    }

    function getAllUserProposalIds(address _user)
    external
    view
    returns (uint256[] memory)
    {
        uint256[] memory allIds = new uint256[](userProposals[_user].length);
        allIds = userProposals[_user];
        return allIds;
    }

    function getPropInfo(uint256 _proposalId)
    public
    view
    returns (
        address _proposer,
        uint256 _startTime,
        uint256 _lastCrowdfundId,
        uint8 _failNum,
        bool _canCrowdfund
    )
    {
        ProposalInfo storage proposal = proposals[_proposalId];
        _proposer = proposal.proposer;
        _startTime = proposal.startTime;
        _lastCrowdfundId = proposal.lastCrowdfundId;
        _failNum = proposal.failNum;
        _canCrowdfund = canCrowdfund(_proposalId);
    }


    function canCrowdfund(uint256 _proposalId) public view override returns (bool) {
        require(_proposalId > 0, "_proposalId need GT 0");
        uint256 lastCrowdfundId = proposals[_proposalId].lastCrowdfundId;
        if (lastCrowdfundId == 0) return true;
        uint256 crowdfundStatus = crowdfund.getCrowdfundStatus(lastCrowdfundId);
        bool _canCrowdfund = crowdfundStatus == 3 ? true : false;
        
        bool hasNFTinCollection = false;
        if(_proposalId % 2 ==0) {
            if(externalNftBase.getTotalNftNumOfCollect(_proposalId) > 0) hasNFTinCollection = true;
            return (hasNFTinCollection && _canCrowdfund);
        }
        return _canCrowdfund;
    }

    function setMinValuation(uint256 _newMinValuation) public onlyOwner {
        minValuation = _newMinValuation;
    }

    function setMaxAmountVote(uint256 _newMaxAmount) public onlyOwner {
        maxAmountVote = _newMaxAmount;
    }
}
