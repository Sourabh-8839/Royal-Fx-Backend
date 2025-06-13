const mongoose = require("mongoose");

const bvRewardHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  bv: Number,
  amount: Number,
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("BVRewardHistory", bvRewardHistorySchema);