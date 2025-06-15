const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: { type: String, default: null },
        email: {
            type: String,
            default: null,
        },
        mobile: { type: String, default: null },
        password: { type: String, default: null },
        activationdetails: {
            isActive: { type: Boolean, default: false },
            activeDate: { type: Date, default: null },
        },
        username: { type: String, default: null },
        partners: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Userdetail",
            },
        ],
        matchingBVGiven: {
            type: Number,
            default: 0
        },
        account: {
        totalInvestment: { type: Number, default: 0.0 },
        totalEarning: { type: Number, default: 0.0 },
        totalReferralEarning: { type: Number, default: 0.0 },
        totalWithdrawal: { type: Number, default: 0.0 },
        currentIncome: { type: Number, default: 0.0 },
    },
        wallet: {
            incomeWallet: { type: Number, default: 0 },
            topupWallet: { type: Number, default: 0 },
            depositWallet: { type: Number, default: 0 },
        },
        currentEarnings: {
            type: Number,
            default: 0,
        },
        totalEarningLimit: {
            type: Number,
            default: 0, // 5x of first investment
        },
        plan: {
            planId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Plan",
            },
            isActive: {
                type: Boolean,
                default: false,
            },
        },
        rank: {
            type: String,
            default: null
        },
        royalty: { type: mongoose.Schema.Types.ObjectId, ref: "Royalty" },
        referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Userdetail", default: null },
        otpdetails: {
            isVerified: { type: Boolean, default: false },
            otp: { type: String, default: null },
            expireOtp: { type: Date, default: null },
        },
        isBlocked: { type: Boolean, default: false },
        isFirstPurchase: { type: Boolean, default: false },
        selfBV: { type: Number, default: 0 },
        transaction: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transaction",
        }],
        rewardBV: {
            type: Number,
            default: 0
        },
        royaltyBV: {
            type: Number,
            default: 0
        },
        bvRewardsGiven: {
            type: [Number],
            default: [],
        },
        firstInvestment: {
            type: Number,
            default: 0,
        },
        rewardLevel: {
            type: String,
            default: null
        },
        totalEarnings: {
            type: Number,
            default: 0
        },
        firstInvestment: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true, versionKey: false }
);

// // // Exclude the password field by default when converting documents to JSON or objects
// userSchema.set('toJSON', {
//     transform: (doc, ret) => {
//         delete ret.password; // Remove password field
//         delete ret.token; // Remove password field
//         delete ret.tokenBlock; // Remove password field
//         delete ret.otpdetails; // Remove password field
//         return ret;
//     }
// });

// userSchema.set('toObject', {
//     transform: (doc, ret) => {
//         delete ret.password; // Remove password field
//         delete ret.token; // Remove password field
//         delete ret.tokenBlock; // Remove password field
//         return ret;
//     }
// });

module.exports = mongoose.model("Userdetail", userSchema);
