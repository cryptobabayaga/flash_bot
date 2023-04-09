// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;
import "@boringcrypto/boring-solidity/contracts/libraries/BoringERC20.sol";
import "./IFlashLoan.sol";
import "./IVaultMinimal.sol";
import "./IDfynRouterV2.sol";


contract FlashLoan is IFlashBorrower {
    using BoringERC20 for IERC20;
    address public vault;
    address public owner;
    event Loan(address borrower, address token, uint amount, uint fee);

    constructor(address _vault) {
        vault = _vault;
        owner = msg.sender;
    }

    function onFlashLoan(address sender, IERC20 token, uint256 amount, uint256 fee, bytes calldata data) external {

        (address router,bytes memory path,uint amountOutMinimum,uint tradeExpense) = abi.decode(data, (address,bytes,uint,uint));

        require(IERC20(token).balanceOf(sender) >= amount,"Missing:FlashLoan Fund");
        
        require(sender==owner,"Not Owner");
        
        //Deposit To Vault
        IVaultMinimal(vault).deposit(address(token),sender,sender,amount,0);
        IDfynRouterV2.ExactInputParams memory params=IDfynRouterV2.ExactInputParams({
        unWrapVault:true,
        path:path,
        recipient:address(this),
        amountIn:amount,
        amountOutMinimum:amountOutMinimum
        });

        //Swap on Signal
        uint amountOut= IDfynRouterV2(router).exactInput(params);

        //slippage check
        require(amountOut >= amountOutMinimum,"Slippage Loss");

        uint profit = amountOut - amountOutMinimum;

        //profit check
        require(profit>tradeExpense,"Loss trade");

        //Transfer borrowed amount & fee
        IERC20(token).safeTransfer(vault,amount + fee);

        emit Loan(sender, address(token), amount, fee);
    }

    function withdrawProfit(address _receiver, IERC20 token) external onlyOwner {
        token.safeTransfer(_receiver, token.balanceOf(address(this)));
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not Owner");
        _;
    }
}
