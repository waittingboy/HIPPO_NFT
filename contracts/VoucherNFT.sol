pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "./interfaces/IVoucherNFT.sol";

contract VoucherNFT is IVoucherNFT, ERC1155Upgradeable{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    uint256 public id;
    mapping(uint256 => VoucherInfo) public voucherInfos;

    mapping(uint256 => uint256) public supplyOfTokenId;

    mapping(address => EnumerableSetUpgradeable.UintSet) tokenIdListOfUser;

    bool _enterStatus;
    modifier nonReentrant() {
        require(!_enterStatus, "ReentrancyGuard: reentrant call");
        _enterStatus = true;
        _;
        _enterStatus = false;
    }

    bool _enterStatus01;
    modifier nonReentrant01() {
        require(!_enterStatus01, "ReentrancyGuard: reentrant call");
        _enterStatus01 = true;
        _;
        _enterStatus01 = false;
    }

    constructor() {}

    function initialize(string memory uri_) public initializer {
        __ERC1155_init(uri_);
    }

    /// @inheritdoc IVoucherNFT
    function createVoucher(
        address _token,
        uint256 _amountPerVoucher,
        uint256 _amountVoucher,
        string memory _url
    ) public override nonReentrant01 returns(bool) {
        IERC20Upgradeable token = IERC20Upgradeable(_token);
        uint256 totalAmount = _amountPerVoucher * _amountVoucher;
        require(totalAmount <= token.balanceOf(_msgSender()),"Balance not enough");
        token.safeTransferFrom(_msgSender(),address(this),totalAmount);

        id++;
        uint256 _tokenId = id;
        _mint(_msgSender(),_tokenId,_amountVoucher,"");
        supplyOfTokenId[_tokenId] += _amountVoucher;

        voucherInfos[_tokenId] = VoucherInfo(_token,_amountPerVoucher,_url);

        tokenIdListOfUser[_msgSender()].add(_tokenId);

        emit CreateVoucher(_msgSender(),_tokenId,_token,_amountPerVoucher,_amountVoucher);
        return true;
    }

    /// @inheritdoc IVoucherNFT
    function createVoucherBatch(
        address[] memory _tokens,
        uint256[] memory _amountPerVouchers,
        uint256[] memory _amountVouchers,
        string[] memory _urls
    ) public override nonReentrant returns(bool _res) {
        require(
            _tokens.length == _amountPerVouchers.length &&
            _tokens.length == _amountVouchers.length &&
            _tokens.length == _urls.length,
            "The lengths mismatch"
        );

        uint256 len = _tokens.length;
        for(uint256 i = 0; i < len; i++) {
             _res = createVoucher(_tokens[i],_amountPerVouchers[i],_amountVouchers[i],_urls[i]);
             require(_res,"CreateVoucherBatch failed");
        }

        return _res;
    }

    /// @inheritdoc IVoucherNFT
    function useVoucher(uint256 _tokenId, uint256 _amountVoucher) public override nonReentrant01 returns(bool) {
        require(_amountVoucher <= balanceOf(_msgSender(), _tokenId),"The balance not enough");
        VoucherInfo storage voucher = voucherInfos[_tokenId];

        if(_amountVoucher == balanceOf(_msgSender(), _tokenId))
            tokenIdListOfUser[_msgSender()].remove(_tokenId);

        _burn(_msgSender(), _tokenId, _amountVoucher);

        require(
            _amountVoucher <= supplyOfTokenId[_tokenId],
            "_amountVoucher must LT supply Of this tokenId"
        );
        supplyOfTokenId[_tokenId] -= _amountVoucher;

        IERC20Upgradeable(voucher.token).safeTransfer(_msgSender(), voucher.amount * _amountVoucher);

        emit UseVoucher(_msgSender(), _tokenId, voucher.token, voucher.amount, _amountVoucher);

        if(supplyOfTokenId[_tokenId] == 0) delete voucherInfos[_tokenId];

        return true;
    }

    /// @inheritdoc IVoucherNFT
    function useVoucherBatch(uint256[] memory _tokenIds, uint256[] memory _amountsVoucher) external override nonReentrant returns(bool) {
        require(_tokenIds.length == _amountsVoucher.length,"The lengths mismatch");
        uint256 len = _tokenIds.length;
        for(uint256 i = 0; i < len; i++) {
            bool success = useVoucher(_tokenIds[i],_amountsVoucher[i]);
            require(success,"Use vouchers failed");
        }

        return true;
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public override {
        if(_amount == balanceOf(_from, _id)) tokenIdListOfUser[_from].remove(_id);
        if(!tokenIdListOfUser[_to].contains(_id)) tokenIdListOfUser[_to].add(_id);

        super.safeTransferFrom(_from, _to, _id, _amount, _data);

    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public override {
        require(_ids.length == _amounts.length, "ids and amounts length mismatch");
        uint256 len = _ids.length;
        for(uint256 i =0; i < len; i++) {
            if(_amounts[i] == balanceOf(_from, _ids[i])) tokenIdListOfUser[_from].remove(_ids[i]);
            if(!tokenIdListOfUser[_to].contains(_ids[i])) tokenIdListOfUser[_to].add(_ids[i]);
        }

        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);

    }

    /// @notice get the url of the tokenId
    function uri(uint256 _tokenId) public view override returns (string memory) {
        return voucherInfos[_tokenId].url;
    }

    /// @notice get the token id list of the user
    function getAllTokenIdOfUser(address _user) public view returns(uint256[] memory) {
        return tokenIdListOfUser[_user].values();
    }

    /// @notice check whether the user has '_tokenId' NFT or not
    function contains(address _user, uint256 _tokenId) public view returns (bool) {
        return tokenIdListOfUser[_user].contains(_tokenId);
    }

    /// @notice get the length of the user's tokenId list
    function lengthOfTokenIdList(address _user) public view returns (uint256) {
        return tokenIdListOfUser[_user].length();
    }

    /// @notice get the tokenId by the index of the user's tokenId list
    function tokenIdByIndex(address _user, uint256 index) public view returns (uint256) {
        return tokenIdListOfUser[_user].at(index);
    }


}
