const { ethers } = require("ethers");
const { UserModel } = require("../models/user.model");
const { WithdrawalRequestModel } = require("../models/withdrawal.model");
const { TransactionModel } = require("../models/transaction.model");
const { generateTxnId } = require("../utils/generateRandomReferralLink");

// ✅ Set Up Provider & Wallet
const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const zcoinWallet = new ethers.Wallet(process.env.ZCOIN_PRIVATE_KEY, provider);

const usdtAbi = [
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 value) public returns (bool)"
];

exports.BalanceCheck = async (req, res) => {
    try {
        const usdtContract = new ethers.Contract(process.env.USDT_CONTRACT_ADDRESS, usdtAbi, wallet);
        // bnb
        const bnbBalance = await provider.getBalance(wallet.address);
        const formattedBNB = ethers.formatEther(bnbBalance);

        // usdt
        const usdtBalance = await usdtContract.balanceOf(wallet.address);
        const formattedUSDT = ethers.formatUnits(usdtBalance, 18);

        // RESPONSE
        res.json({ bnb: formattedBNB, usdt: formattedUSDT });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.WithdrawalUsdt = async ({ req, res, userId, walletAddress, amount, withdrawalRequest }) => {
    try {
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (!walletAddress || !amount) {
            return res.status(400).json({ error: "Recipient and amount are required" });
        }

        const usdtContract = new ethers.Contract(process.env.USDT_CONTRACT_ADDRESS, usdtAbi, wallet);
        const decimals = 18;
        const amountToSend = ethers.parseUnits((Number(amount) * 0.98).toString(), decimals);

        // 🔹 Check USDT Balance
        const walletUsdtBalance = await usdtContract.balanceOf(wallet.address);
        if (walletUsdtBalance < amountToSend) {
            return res.status(200).json({ status: false, message: "Not enough USDT balance for withdrawal in admin wallet" });
        }

        // 🔹 Estimate Gas
        const gasLimit = await usdtContract.transfer.estimateGas(walletAddress, amountToSend);
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits("5", "gwei");
        const estimatedGasFee = gasLimit * gasPrice;

        // 🔹 Check BNB Balance for Gas Fees
        const walletBalance = await provider.getBalance(wallet.address);
        if (walletBalance < estimatedGasFee) {
            return res.status(400).json({ status: false, message: "Not enough BNB for gas fees in admin wallet" });
        }

        // 🔹 Execute Transaction
        const tx = await usdtContract.transfer(walletAddress, amountToSend, { gasLimit, gasPrice });
        await tx.wait();

        const txnId = generateTxnId();
        const transaction = await TransactionModel.create({
            userId: user._id,
            amount: Number(amount),
            clientAddress: walletAddress,
            mainAddress: wallet.address,
            hash: tx.hash,
            transactionID: txnId,
            type: "withdrawal",
            status: "Completed"
        })

        await transaction.save()

        // 🔹 Save Transaction to Database
        // const newWithdrawal = new WithdrawalRequestModel({
        //     userId: user._id,
        //     gasLimit: gasLimit.toString(),
        //     gasPrice: gasPrice.toString(),
        //     hash: tx.hash,
        //     value: amount,
        //     type: "USDT_Withdrawal",
        //     mainAddress: wallet.address,
        //     clientAddress: walletAddress,
        //     amount: amount,
        //     status: "Completed",
        //     transactionId: txnId
        // });

        // user.usdt -= amount;
        // user.withdrawal.push(newWithdrawal);
        // await user.save();
        // await newWithdrawal.save();

        // console.log(amountToSend, "amount");

        const updatedWithdrawal = await WithdrawalRequestModel.findByIdAndUpdate(
            withdrawalRequest._id,
            {
                gasLimit: gasLimit.toString(),
                gasPrice: gasPrice.toString(),
                hash: tx.hash,
                value: amount,
                type: "USDT_Withdrawal",
                mainAddress: wallet.address,
                clientAddress: walletAddress,
                amount: amount,
                status: "Completed",
                transactionId: txnId
            },
            { new: true }
        );

        return res.status(200).json({
            status: true,
            message: "Withdrawal Transaction Successful!",
            hash: tx.hash,
            gasLimit: gasLimit.toString(),
            gasPrice: gasPrice.toString(),
        });
    } catch (error) {
        console.log("❌ Error during USDT withdrawal:", error);
        return res.status(500).json({ status: 500, message: error.message });
    }
};


exports.TransferZToken = async ({ req, res, userId, walletAddress, amount }) => {
    try {
        // Initialize contract
        const usdtContract = new ethers.Contract(process.env.ZCOIN_CONTRACT_ADDRESS, usdtAbi, zcoinWallet);

        // Validate inputs
        if (!ethers.isAddress(walletAddress)) {
            return res.status(400).json({ status: false, message: "Invalid recipient address" });
        }
        if (!Number(amount) || Number(amount) <= 0) {
            return res.status(400).json({ status: false, message: "Invalid amount" });
        }

        // Get decimals dynamically (in case it's not 18)
        const decimals = 18;
        const amountToSend = ethers.parseUnits((Number(amount)).toString(), decimals);
        console.log(`Amount to send: ${ethers.formatUnits(amountToSend, decimals)} ZToken`);

        // Check sender's ZToken balance
        const walletUsdtBalance = await usdtContract.balanceOf(zcoinWallet.address);
        console.log(`Sender (${zcoinWallet.address}) ZToken Balance: ${ethers.formatUnits(walletUsdtBalance, decimals)} ZToken`);

        if (walletUsdtBalance < amountToSend) {
            return res.status(400).json({
                status: false,
                message: `Not enough ZToken balance for withdrawal in admin wallet. Available: ${ethers.formatUnits(walletUsdtBalance, decimals)}, Required: ${ethers.formatUnits(amountToSend, decimals)}`,
            });
        }

        // Estimate gas
        const gasLimit = await usdtContract.transfer.estimateGas(walletAddress, amountToSend);
        console.log(`Estimated Gas Limit: ${gasLimit.toString()}`);

        // Fetch fee data
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits("5", "gwei");
        console.log(`Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

        // Check BNB balance for gas fees
        const walletBalance = await provider.getBalance(zcoinWallet.address);
        const estimatedGasFee = gasLimit * gasPrice;
        console.log(`Estimated Gas Fee: ${ethers.formatUnits(estimatedGasFee, "ether")} BNB`);

        if (walletBalance < estimatedGasFee) {
            return res.status(400).json({
                status: false,
                message: `Not enough BNB for gas fees in admin wallet. Available: ${ethers.formatUnits(walletBalance, "ether")}, Required: ${ethers.formatUnits(estimatedGasFee, "ether")}`,
            });
        }

        // Execute transaction
        console.log(`Transferring ${ethers.formatUnits(amountToSend, decimals)} ZToken from ${zcoinWallet.address} to ${walletAddress}`);
        const tx = await usdtContract.transfer(walletAddress, amountToSend, { gasLimit, gasPrice });
        console.log(`Transaction Hash: ${tx.hash}`);

        // Wait for confirmation
        await tx.wait();
        console.log("ZToken transfer successful!");

        // Save transaction to database
        const txnId = generateTxnId();
        const transaction = await TransactionModel.create({
            userId,
            amount: Number(amount),
            clientAddress: walletAddress,
            mainAddress: zcoinWallet.address,
            hash: tx.hash,
            transactionID: txnId,
            type: "ZCoin_Investment",
            status: "Completed",
        });

        return res.status(200).json({
            success: true,
            status: true,
            message: "Z-Coin Purchase Successful!",
            hash: tx.hash,
            gasLimit: gasLimit.toString(),
            gasPrice: ethers.formatUnits(gasPrice, "gwei"),
        });
    } catch (error) {
        console.error("❌ Error during ZToken transfer:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

