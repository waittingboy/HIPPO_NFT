// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface INFTDepositBox{

    function depositNFT(address _tokenAddress,uint256 _tokenId,uint256 _amount) external;
    function depositNFTByBase(address _tokenAddress,uint256 _tokenId,address _to,uint256 _amount) external returns(uint256);
    function batchDepositNFT(address[] memory _tokenAddresses, uint256[] memory _tokenIds, uint256[] memory _amounts, address _owner) external returns (uint256[] memory);
    function withdrawNFT(uint256 _nftId, uint256 _amount) external;
    function batchWithdrawNFT(uint256[] memory _nftIds, uint256[] memory _amounts) external;
    function batchClaimNFT(address _to,uint256[] memory _nftIds, uint256[] memory _amounts) external;
    function claimNFT(address _to,uint256 _nftId,uint256 _amount) external;
    function setNFTStatus(uint256 _nftId,bool _set) external;
    function getOwnerOfNFT(uint256 _nftId) external view returns (address);
    function getNFTInfo(uint256 _nftId) external view returns(uint256 _nftType,uint256 _amount);
    function getVirtualNftInfo(uint256 _nftId) external view returns (bool _isExternalNFT,address _tokenAddress, uint256 _tokenId, uint256 _nftType);
    function allNFTs(uint256 _nftId) external view returns (address,uint256,uint256,address,uint32,bool);
}
