pragma solidity ^0.8.0;

import '../libraries/FixedPoint.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';

contract MockUniswapV2PairTrade is IUniswapV2Pair {
    address public override factory;
    address public override token0;
    address public override token1;

    uint112 private reserve0;           // uses single storage slot, accessible via getReserves
    uint112 private reserve1;           // uses single storage slot, accessible via getReserves
    uint32  private blockTimestampLast; // uses single storage slot, accessible via getReserves

    uint public override price0CumulativeLast;
    uint public override price1CumulativeLast;

    constructor (address _token0,address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function getReserves() external override view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function simulateTrade(uint112 newReserve0, uint112 newReserve1) external {
        uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        if (timeElapsed > 0 && reserve0 != 0 && reserve1 != 0) {
            price0CumulativeLast += uint(FixedPoint.fraction(reserve1, reserve0)._x) * timeElapsed;
            price1CumulativeLast += uint(FixedPoint.fraction(reserve0, reserve1)._x) * timeElapsed;
        }
        reserve0 = newReserve0;
        reserve1 = newReserve1;
        blockTimestampLast = blockTimestamp;
    }

    /**
     * Should not use
     */
    function name() external override pure returns (string memory) { revert("Should not use"); }
    function symbol() external override pure returns (string memory) { revert("Should not use"); }
    function decimals() external override pure returns (uint8) { revert("Should not use"); }
    function totalSupply() external override view returns (uint) { revert("Should not use"); }
    function balanceOf(address owner) override external view returns (uint) { revert("Should not use"); }
    function allowance(address owner, address spender) external override view returns (uint) { revert("Should not use"); }

    function approve(address spender, uint value) external override returns (bool) { revert("Should not use"); }
    function transfer(address to, uint value) external override returns (bool) { revert("Should not use"); }
    function transferFrom(address from, address to, uint value) external override returns (bool) { revert("Should not use"); }

    function DOMAIN_SEPARATOR() external override view returns (bytes32) { revert("Should not use"); }
    function PERMIT_TYPEHASH() external override pure returns (bytes32) { revert("Should not use"); }
    function nonces(address owner) external override view returns (uint) { revert("Should not use"); }

    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external override { revert("Should not use"); }

    function MINIMUM_LIQUIDITY() external override pure returns (uint) { revert("Should not use"); }
//    function factory() external override view returns (address) { revert("Should not use"); }
//    function token0() external override view returns (address) { revert("Should not use"); }
//    function token1() external override view returns (address) { revert("Should not use"); }
    function kLast() external override view returns (uint) { revert("Should not use"); }

    function mint(address to) external override returns (uint liquidity) { revert("Should not use"); }
    function burn(address to) external override returns (uint amount0, uint amount1) { revert("Should not use"); }
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external override { revert("Should not use"); }
    function skim(address to) external override { revert("Should not use"); }
    function sync() external override { revert("Should not use"); }

    function initialize(address, address) external override { revert("Should not use"); }
}
