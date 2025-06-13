const UserModel = require("../models/user.model");
const PlanModel = require("../models/plan.model");
const IncomeHistoryModel = require("../models/levelIncomeHistory.model");

const levelPercentages = [0.20, 0.05, 0.03, 0.02, 0.01];

exports.levelIncomeDistribution = async (req, res) => {
  try {
    const { userId} = req.body;

    const buyer = await UserModel.findById(userId);
    if (!buyer)
      return res.status(404).json({ success: false, message: "User not found" });

    if (buyer.isFirstPurchase === true) {
      return res.status(400).json({
        success: false,
        message: "Level income already distributed for this user.",
      });
    }

    if (!buyer.firstPurchaseAmount || buyer.firstPurchaseAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing firstPurchaseAmount.",
      });
    }

    const purchaseAmount = buyer.firstPurchaseAmount;

    let currentUpline = buyer.referredBy;
    let level = 0;

    while (currentUpline && level < levelPercentages.length) {
      const uplineUser = await UserModel.findById(currentUpline);
      if (!uplineUser) break;

      const uplinePlan = await PlanModel.findById(uplineUser.currentPlan);
      if (!uplinePlan) {
        currentUpline = uplineUser.referredBy;
        level++;
        continue;
      }

      const maxIncomeLimit = uplinePlan.price * 5;

      const previousIncome = await IncomeHistoryModel.aggregate([
        { $match: { receiver: uplineUser._id } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const totalReceived = previousIncome.length > 0 ? previousIncome[0].total : 0;

      const incomeAmount = purchaseAmount * levelPercentages[level];


      if (totalReceived >= maxIncomeLimit) {
        currentUpline = uplineUser.referredBy;
        level++;
        continue;
      }

      const allowedIncome = Math.min(incomeAmount, maxIncomeLimit - totalReceived);


      if (!uplineUser.wallet) uplineUser.wallet = {};
      uplineUser.wallet.incomeWallet = (uplineUser.wallet.incomeWallet || 0) + allowedIncome;
      await uplineUser.save();

     
      await IncomeHistoryModel.create({
        receiver: uplineUser._id,
        fromUser: buyer._id,
        amount: allowedIncome,
        type: `Level ${level + 1} Income`,
        date: new Date()
      });

      currentUpline = uplineUser.referredBy;
      level++;
    }

   
    buyer.isFirstPurchase = true;
    await buyer.save();

    return res.status(200).json({
      success: true,
      message: "Level income distributed based on firstPurchaseAmount.",
    });

  } catch (err) {
    console.error("Level Income Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};



exports.getMyLevelHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const data = await IncomeHistoryModel.find({ receiver: userId })
      .populate('fromUser', 'username name')
      .sort({ date: -1 });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("User income history error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getTotalLevelIncome = async (userId) => {
  const result = await IncomeHistoryModel.aggregate([
    { $match: { receiver: userId } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  return result.length > 0 ? result[0].total : 0;
};