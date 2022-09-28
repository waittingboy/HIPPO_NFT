//SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";
library UniswapV2LibraryMock {
    using SafeMath for uint;

    

    // fetches and sorts the reserves for a pair
    function getReserves(address factory, uint inputReserveA, uint inputReserveB) internal view returns (uint reserveA, uint reserveB) {
        // (address token0,) = sortTokens(tokenA, tokenB);
        // //return reserve0 >> smallAddr,reserve1 >> largeAddr
        // (uint reserve0, uint reserve1,) = IUniswapV2Pair(pairFor(factory, tokenA, tokenB)).getReserves();
        // (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        return (inputReserveA, inputReserveB);
    }


    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal view returns (uint amountOut) {
        require(amountIn > 0, "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "UniswapV2Library: INSUFFICIENT_LIQUIDITY");
        //(amountIn*997/1000 + reserveIn)*(reserveOut - amountOut) = reserveIn*reserveOut
        console.log("amountIn is:",amountIn);
        uint amountInWithFee = amountIn.mul(9975);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(10000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    
}
