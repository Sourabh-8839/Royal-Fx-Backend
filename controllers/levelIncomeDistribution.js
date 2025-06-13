const UserModel = require("../models/user.model");
const PlanModel = require("../models/plan.model");
const IncomeHistoryModel = require("../models/levelIncomeHistory.model");
const BVRewardHistory = require("../models/BVRewardHistory.model")
const levelPercentages = [0.20, 0.05, 0.03, 0.02, 0.01];

exports.distributeLevelIncome = async (userId) => {
  try {
    const buyer = await UserModel.findById(userId);
    if (!buyer) throw new Error("User not found");

    if (buyer.isFirstPurchase === true) {
      throw new Error("Level income already distributed for this user.");
    }

    if (!buyer.firstInvestment || buyer.firstInvestment <= 0) {
      throw new Error("Invalid or missing firstInvestment.");
    }

    const purchaseAmount = buyer.firstInvestment;
    let currentUpline = buyer.referredBy;
    let level = 0;

    while (currentUpline && level < levelPercentages.length) {
      const uplineUser = await UserModel.findById(currentUpline);
      if (!uplineUser) break;

      const maxIncomeLimit = uplineUser.firstInvestment * 5;
      const totalReceived = uplineUser.totalEarningLimit || 0;

      const incomeAmount = purchaseAmount * levelPercentages[level];

      if (totalReceived >= maxIncomeLimit) {
        currentUpline = uplineUser.referredBy;
        level++;
        continue;
      }

      const allowedIncome = Math.min(incomeAmount, maxIncomeLimit - totalReceived);

      uplineUser.wallet.depositWallet = (uplineUser.wallet.depositWallet || 0) + allowedIncome;
      uplineUser.totalEarningLimit = totalReceived + allowedIncome;
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

    // buyer.isFirstPurchase = true;
    await buyer.save();

    return {
      success: true,
      message: "Level income distributed successfully."
    };
  } catch (err) {
    console.error("Level Income Error:", err);
    return {
      success: false,
      message: err.message || "Server error"
    };
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


exports.updateRank = async () => {
  try {
    const users = await UserModel.find();

    for (const user of users) {
      const partners = await UserModel.find({ _id: { $in: user.partners } });
      if (!partners.length) continue;

      // Find highest selfBV partner
      const sorted = partners.sort((a, b) => b.selfBV - a.selfBV);
      const highestBV = sorted[0].selfBV;

      // Sum of others
      const sumOtherBV = sorted.slice(1).reduce((sum, p) => sum + p.selfBV, 0);

      const matchingBV = Math.min(highestBV, sumOtherBV);

      if (matchingBV >= 50) {
        user.rank = "Star";
        await user.save();
      }
    }

    return {
      success: true,
      message: "Ranks updated."
    };
  } catch (err) {
    console.error("Rank Update Error:", err);
    return {
      success: false,
      message: err.message || "Server error"
    };
  }
}



exports.starIncomeDistribution = async (investorId, investmentAmount) => {
  try {
    const investor = await UserModel.findById(investorId);
    if (!investor || investmentAmount <= 0) return;

    let currentUpline = investor.referredBy;

    while (currentUpline) {
      const uplineUser = await UserModel.findById(currentUpline);
      if (!uplineUser) break;

      if (uplineUser.rank === "Star" && uplineUser.firstInvestment > 0) {
        const starDownlines = await UserModel.find({
          referredBy: uplineUser._id,
          rank: "Star",
        });

        if (starDownlines.length >= 10) {
          const earningCap = uplineUser.firstInvestment * 5;
          const currentEarnings = uplineUser.totalEarningLimit || 0;

          if (currentEarnings < earningCap) {
            const reward = investmentAmount * 0.01;
            const allowedReward = Math.min(reward, earningCap - currentEarnings);

            uplineUser.wallet.depositWallet = (uplineUser.wallet.depositWallet || 0) + allowedReward;
            uplineUser.totalEarningLimit = currentEarnings + allowedReward;
            await uplineUser.save();

            await IncomeHistoryModel.create({
              receiver: uplineUser._id,
              fromUser: investor._id,
              amount: allowedReward,
              type: "Star Royalty Income",
              date: new Date()
            });
          }
        }
      }

      currentUpline = uplineUser.referredBy;
    }

  } catch (err) {
    console.error("Star Income Distribution Error:", err);
  }
};


exports.calculateMatchingBV = async (userId) => {
  const user = await UserModel.findById(userId);
  if (!user || !user.partners || user.partners.length === 0) return 0;

  const partners = await UserModel.find({ _id: { $in: user.partners } });

  if (partners.length === 0) return 0;

  const sorted = partners.sort((a, b) => b.selfBV - a.selfBV);
  const highestBV = sorted[0].selfBV;
  const sumOfOthers = sorted.slice(1).reduce((acc, p) => acc + p.selfBV, 0);

  const matchingBV = Math.min(highestBV, sumOfOthers);

  user.rewardBV += matchingBV;
  user.royaltyBV += matchingBV
  await user.save();

  return matchingBV;
};


exports.BVRewards = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let availableBV = user.rewardBV || 0;
    if (availableBV <= 0) {
      return res.status(200).json({ success: false, message: "No reward BV available" });
    }

    const requirements = [
      { matchBV: 25, reward: 100 },
      { matchBV: 50, reward: 200 },
      { matchBV: 100, reward: 400 },
      { matchBV: 250, reward: 1000 },
      { matchBV: 500, reward: 2000 },
      { matchBV: 1000, reward: 4000 },
      { matchBV: 2500, reward: 10000 },
      { matchBV: 5000, reward: 20000 },
      { matchBV: 10000, reward: 40000 },
      { matchBV: 25000, reward: 75000 },
      { matchBV: 50000, reward: 150000 },
      { matchBV: 100000, reward: 300000 },
      { matchBV: 250000, reward: 750000 },
    ];

    const alreadyRewarded = user.bvRewardsGiven || [];

    let distributed = [];

    for (const req of requirements) {
      if (availableBV >= req.matchBV && !alreadyRewarded.includes(req.matchBV)) {
        user.wallet.incomeWallet = (user.wallet.incomeWallet || 0) + req.reward;

        distributed.push({
          matchBV: req.matchBV,
          reward: req.reward,
        });

        await BVRewardHistory.create({
          userId: user._id,
          bv: req.matchBV,
          amount: req.reward,
          date: new Date(),
        });

        availableBV -= req.matchBV;

        alreadyRewarded.push(req.matchBV);
      }
    }

    user.rewardBV = availableBV;
    user.bvRewardsGiven = alreadyRewarded;
    
    await user.save();

    return res.status(200).json({
      success: true,
      message: "BV Rewards distributed",
      distributed,
      remainingBV: availableBV,
    });
  } catch (err) {
    console.error("BV Rewards error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};