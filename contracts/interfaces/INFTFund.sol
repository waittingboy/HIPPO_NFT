pragma solidity ^0.8.0;

interface INFTFund {
    function mintSmart(address to_, uint connector_, uint connAmount_,address tokenAddress_) external returns(uint);
}
