pragma solidity ^0.8.0;
// Copyright (C) 2021 Cycan Technologies

import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract MockEOAPayer {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    IERC20MetadataUpgradeable public payToken;

    constructor(address _payToken, address mbPoolAdmin)  {
        payToken = IERC20MetadataUpgradeable(_payToken);
        payToken.safeApprove(mbPoolAdmin,type(uint).max);

        console.log("this",address(this));
        bytes memory payload = abi.encodeWithSignature("payToQualifyForCreateMBPool()");
        (bool success, bytes memory returndata) = mbPoolAdmin.call(payload);
        if (!success) {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("call payAndCreateMBPool failed");
            }
        }

    }

    /// @notice Copy from OpenZeppelin Contracts v4.4.1 (utils/AddressUpgradeable.sol)
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

}
