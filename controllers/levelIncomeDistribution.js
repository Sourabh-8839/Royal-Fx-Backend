const UserModel = require("../models/user.model");
const PlanModel = require("../models/plan.model");
const IncomeHistoryModel = require("../models/levelIncomeHistory.model");
const BVRewardHistory = require("../models/BVRewardHistory.model")


const levelPercentages = [0.20, 0.05, 0.03, 0.02, 0.01];

exports.distributeLevelIncome = async (userId) => {
  try {
    const buyer = await UserModel.findById(userId);
    console.log(buyer)
    if (!buyer) throw new Error("User not found");

    if (buyer.isFirstPurchase === true) {
      throw new Error("Level income already distributed for this user.");
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

      uplineUser.wallet.incomeWallet = (uplineUser.wallet.incomeWallet || 0) + allowedIncome;
      uplineUser.totalEarningLimit = totalReceived + allowedIncome;
      uplineUser.account.totalEarning = (uplineUser.account.totalEarning || 0) + allowedIncome;
      uplineUser.account.totalReferralEarning = (uplineUser.account.totalReferralEarning || 0) + allowedIncome;
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

exports.getTotalLevelIncome = async (req, res) => {
  try {
    const data = await IncomeHistoryModel.find()
      .populate("receiver", "name")   
      .populate("fromUser" , "name");   



    res.status(200).json({
      success: true,
      message: "Income fetched successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.updateRank = async () => {
  try {
    const users = await UserModel.find();

    const updatePromises = [];

    for (const user of users) {
      const partners = await UserModel.find({ _id: { $in: user.partners } });

      if (!partners.length) continue;

      const sorted = partners.sort((a, b) => b.selfBV - a.selfBV);
      const highestBV = sorted[0].selfBV;

      const sumOtherBV = sorted.slice(1).reduce((sum, p) => sum + p.selfBV, 0);

      const matchingBV = Math.min(highestBV, sumOtherBV);

      if (user.rewardBV >= 50 && user.rank !== "Star") {
        user.rank = "Star";
      }

      updatePromises.push(user.save());
    }

    await Promise.all(updatePromises);

    return {
      success: true,
      message: "Ranks updated successfully."
    };
  } catch (err) {
    console.error("Rank Update Error:", err);
    return {
      success: false,
      message: err.message || "Server error"
    };
  }
};





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

            uplineUser.wallet.incomeWallet = (uplineUser.wallet.incomeWallet || 0) + allowedReward;
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


exports.calculateMatchingBVForAllUsers = async () => {
  try {
    const users = await UserModel.find();
    const allResults = [];

    for (const user of users) {
      if (!user.partners || user.partners.length < 2) continue;

      const partners = await UserModel.find({ _id: { $in: user.partners } });

      if (partners.length < 2) continue;

      const sorted = partners.sort((a, b) => b.selfBV - a.selfBV);
      const highestBV = sorted[0].selfBV;
      const sumOfOthers = sorted.slice(1).reduce((acc, p) => acc + p.selfBV, 0);

      const calculatedMatchingBV = Math.min(highestBV, sumOfOthers);

      const alreadyGiven = user.matchingBVGiven || 0;
      const newMatchingBV = calculatedMatchingBV - alreadyGiven;

      if (newMatchingBV > 0) {
        user.rewardBV += newMatchingBV;
        user.royaltyBV += newMatchingBV;
        user.matchingBVGiven = calculatedMatchingBV; 
        await user.save();

        allResults.push({
          userId: user._id,
          newMatchingBV,
          totalMatchingBV: calculatedMatchingBV,
          updatedRewardBV: user.rewardBV,
          updatedRoyaltyBV: user.royaltyBV,
        });

        console.log(`User ${user._id}: +${newMatchingBV} matching BV added`);
      }
    }

    return {
      success: true,
      message: "Matching BV calculated for all users (incremental).",
      results: allResults,
    };
  } catch (error) {
    console.error("Error in matching BV calculation:", error);
    return { success: false, message: "Server error in BV matching." };
  }
};



exports.BVRewards = async () => {
  try {
    const users = await UserModel.find();
    const allDistributedRewards = [];

    const requirements = [
      { matchBV: 25, reward: 100, rewardLevel: 1 },
      { matchBV: 50, reward: 200, rewardLevel: 2 },
      { matchBV: 100, reward: 400, rewardLevel: 3 },
      { matchBV: 250, reward: 1000, rewardLevel: 4 },
      { matchBV: 500, reward: 2000, rewardLevel: 5 },
      { matchBV: 1000, reward: 4000, rewardLevel: 6 },
      { matchBV: 2500, reward: 10000, rewardLevel: 7 },
      { matchBV: 5000, reward: 20000, rewardLevel: 8 },
      { matchBV: 10000, reward: 40000, rewardLevel: 9 },
      { matchBV: 25000, reward: 75000, rewardLevel: 10 },
      { matchBV: 50000, reward: 150000, rewardLevel: 11 },
      { matchBV: 100000, reward: 300000, rewardLevel: 12 },
      { matchBV: 250000, reward: 750000, rewardLevel: 13 },
    ];

    for (const user of users) {
      let availableBV = user.rewardBV || 0;
      if (availableBV <= 0) continue;

      const alreadyRewarded = user.bvRewardsGiven || [];
      let rewardGiven = null;

      for (const req of requirements) {
        if (availableBV >= req.matchBV && !alreadyRewarded.includes(req.matchBV)) {
          if (!user.wallet) user.wallet = {};
          user.wallet.incomeWallet = (user.wallet.incomeWallet || 0) + req.reward;
          user.account.totalEarning = (user.account.totalEarning || 0) + req.reward;

          await BVRewardHistory.create({
            userId: user._id,
            bv: req.matchBV,
            amount: req.reward,
            date: new Date(),
          });

          availableBV -= req.matchBV;
          alreadyRewarded.push(req.matchBV);
          rewardGiven = {
            matchBV: req.matchBV,
            reward: req.reward,
          };
          break; 
        }
      }

    
      if (rewardGiven) {
        user.rewardBV = availableBV;
        user.bvRewardsGiven = alreadyRewarded;
        await user.save();

        allDistributedRewards.push({
          userId: user._id,
          rewardGiven,
          remainingBV: availableBV,
        });
      }
    }

    return {
      success: true,
      message: "One-step BV reward distributed where applicable.",
      allDistributedRewards,
    };
  } catch (err) {
    console.error("BV Rewards error:", err);
    return { success: false, message: "Server error" };
  }
};


