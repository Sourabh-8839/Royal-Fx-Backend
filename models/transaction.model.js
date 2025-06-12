const mongoose = require("mongoose");
// buy package
const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Userdetail',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        default: 0.0
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
    transactionID: {
        type: String,
        default: null,
        unique: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Completed'
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal' ],
        default: 'deposit'
    }
}, { timestamps: true, versionKey: false });

exports.TransactionModel = mongoose.model('Transaction', transactionSchema);