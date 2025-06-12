const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema({ 
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Userdetail", required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  investAmount: { type: Number, required: true }, // Amount invested by the user
//   type: { type: String, default: "Referral Income" }, 
//   date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Investment", investmentSchema);
