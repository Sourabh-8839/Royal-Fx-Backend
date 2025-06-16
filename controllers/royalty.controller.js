const RoyaltyModel = require("../models/royality.model");
const UserModel = require("../models/user.model");

exports.royaltyDistribution = async (req, res) => {
  try {
    const royaltyLevels = await RoyaltyModel.find({});
    for (let royalty of royaltyLevels) {
      const eligibleUsers = await UserModel.find({
        royaltyBV: { $gte: royalty.matchingBV },
      });

      const totalEligible = eligibleUsers.length;
      if (totalEligible === 0 || royalty.totalRoyalty <= 0) continue;

      const perUserReward = royalty.totalRoyalty / totalEligible;

      for (let user of eligibleUsers) {
        user.wallet.incomeWallet = (user.wallet.incomeWallet || 0) + perUserReward;
        await user.save();
      }

      royalty.totalRoyalty = 0;
      await royalty.save();
    }

    res.status(200).json({ success: true, message: "Royalty distribution completed successfully." });

  } catch (error) {
    console.error("Royalty distribution error:", error);
    res.status(500).json({ success: false, message: "Something went wrong during royalty distribution." });
  }
};
