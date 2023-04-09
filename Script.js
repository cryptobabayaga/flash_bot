const ethers = require("ethers");
const ethersproj = require("@ethersproject/solidity");
const vaultAbi = require("./vaultAbi.json");
const quoterV2AbI = require("./quoterV2.json");
const { BigNumber } = require("@ethersproject/bignumber");
require("dotenv").config();

const PVT_KEY = process.env.PVT_KEY;
const quoterV2Address = process.env.QUOTER_ADDRESS;
const vaultAddress = process.env.VAULT_ADDRESS;
const RPC = process.env.RPC;
const flashBotAddress = process.env.FLASHBOT;
const receiverAddress = process.env.RECEIVER;
const routerAddress = process.env.Router;

const provider = new ethers.providers.JsonRpcProvider(RPC);

const signer = new ethers.Wallet(PVT_KEY, provider);

const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const ROUTE = "0x16eccfdbb4ee1a85a33f3a9b21175cd7ae753db4";
const DFYN = "0xc168e40227e4ebd8c1cae80f7a55a4f0e6d66c97";

const quoterV2Contract = new ethers.Contract(
  quoterV2Address,
  quoterV2AbI,
  signer
);

const vaultContract = new ethers.Contract(vaultAddress, vaultAbi, signer);

const mixedPath = [
  [USDC, ROUTE, USDC],
  [USDC, DFYN, USDC],
  [DFYN, USDC, DFYN],
  [ROUTE, USDC, ROUTE],
];

const expense = [, , , , ,];

let path;
let packedPath;

async function getQuote(amountIn) {
  let inputAmount = BigNumber.from(amountIn);

  for (let i = 0; i <= mixedPath.length - 1; i++) {
    path = mixedPath[i];
    let tradeExpense = expense[i];
    packedPath = await ethersproj.pack(["address", "address", "address"], path);
    try {
      const quoteData = await quoterV2Contract.callStatic.quoteExactInput(
        packedPath,
        inputAmount
      );

      const quoteAmount = BigNumber.from(quoteData.amountOut);
      console.log(quoteAmount.toString());

      if (quoteAmount.gt(inputAmount.add(expense))) {
        let token = path[0];
        let profit = quoteAmount.sub(inputAmount);
        console.log("Profit Found", profit.toString());
        const minAmountOut = quoteAmount;
        const loanData = ethers.utils.defaultAbiCoder.encode(
          ["address", "bytes", "uint", "uint"],
          [routerAddress, packedPath, minAmountOut, tradeExpense]
        );
        await vaultContract.flashLoan(
          flashBotAddress,
          receiverAddress,
          token,
          inputAmount,
          loanData
        );
      }
    } catch (err) {
      console.error(`Error in path ${path}: ${err}`);
    }
  }
}

async function main() {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 60000));
    getQuote(1000);
  }
}

main();
