pragma solidity ^0.8.0;

interface IVoucherNFT {
    /// @notice the info of every voucher NFT
    /// @param token the address of token deposited when mint voucher NFT
    /// @param amount the amount of token deposited when mint voucher NFT
    /// @param url the outside url of the voucher NFT's metadata
     struct VoucherInfo {
         address token;
         uint256 amount;
         string url;
     }

    /// @notice Create one voucher NFT
    /// @param _token the address of token deposited when mint voucher NFT
    /// @param _amountPerVoucher the amount of token deposited per voucher NFT
    /// @param _amountVoucher the amount of voucher NFTs will be created
    /// @param _url the url of voucher NFTs will be created
    /// @return 'true' when execute success
    function createVoucher(
        address _token,
        uint256 _amountPerVoucher,
        uint256 _amountVoucher,
        string memory _url
    ) external returns(bool);

    /// @notice Create one batch voucher NFT
    /// @param _tokens the address array of token deposited when mint voucher NFT
    /// @param _amountPerVouchers the amount array of token deposited per voucher NFT
    /// @param _amountsVouchers the amount array of voucher NFTs will be created
    /// @param _urls the url array of voucher NFTs will be created
    /// @return _res return 'true' when execute success
    function createVoucherBatch(
        address[] memory _tokens,
        uint256[] memory _amountPerVouchers,
        uint256[] memory _amountsVouchers,
        string[] memory _urls
    ) external returns(bool _res);

    /// @notice Use and destroy one voucher NFT
    /// @param _tokenId the tokenId array of voucher NFT will be used and destroyed
    /// @param _amountVoucher the amount to used
    /// @return 'true' when execute success
    function useVoucher(uint256 _tokenId, uint256 _amountVoucher) external returns(bool);

    /// @notice Use and destroy some voucher NFT
    /// @param _tokenIds the tokenId array of voucher NFT will be used and destroyed
    /// @param _amountsVoucher the amount array Of voucher
    /// @return 'true' when execute success
    function useVoucherBatch(uint256[] memory _tokenIds, uint256[] memory _amountsVoucher) external returns(bool);

    /// @notice Emit when create one voucher NFT
    /// @param _creator the creator of the voucher NFT
    /// @param _tokenId the tokenId of the voucher NFT
    /// @param _token the address of token deposited when mint voucher NFT
    /// @param _amountPerVoucher the amount of token deposited per voucher NFT
    /// @param _amountVoucher the amount of voucher NFTs will be created
    event CreateVoucher(address indexed _creator, uint256 indexed _tokenId, address indexed _token, uint256 _amountPerVoucher, uint256 _amountVoucher);

    /// @notice Emit when use and destroy some voucher NFT
    /// @param _user the user of the voucher
    /// @param _tokenId the tokenId of the voucher NFT
    /// @param _token the token address of voucher NFT used
    /// @param _amountPerVoucher the token amount of voucher NFT used
    /// @param _amountVoucher the amount of voucher NFTs will be used
    event UseVoucher(address indexed _user, uint256 indexed _tokenId, address indexed _token, uint256 _amountPerVoucher, uint256 _amountVoucher);
}
