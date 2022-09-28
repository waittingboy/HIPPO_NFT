pragma solidity ^0.8.0;

import "../interfaces/IBancorFormula.sol";

contract BancorFormulaMock is IBancorFormula {
    constructor(){
    }

    function calculatePurchaseReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _depositAmount) override external view returns (uint256){
        return 1;
    }

    function calculateSaleReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _sellAmount) override external view returns (uint256){
        return 2;
    }

    function calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount)override external view returns (uint256){
        return 3;
    }
}
