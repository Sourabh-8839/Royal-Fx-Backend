const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    clientAddress: {
        type: String,
        default: null
    },
    mainAddress: {
        type: String,
        default: null
    },
    hash: {
        type: String,
        default: null
    },
    gasLimit: {
        type: String,
        default: null
    },
    value: {
        type: String,
        default: null
    },
    type: {
        type: String,
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Userdetail',
        required: true
    },
    status: {
        type: String,
        enum: ['Completed', 'Pending', 'Rejected']
    },
    transactionId: {
        type: String,
        default: null
    },
}, { timestamps: true, versionKey: false });

const WithdrawalRequestModel = mongoose.model('Withdrawal', withdrawalRequestSchema);

module.exports = { WithdrawalRequestModel };