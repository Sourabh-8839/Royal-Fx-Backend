const mongoose = require("mongoose")

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'topup', 'investment', 'profit', 'withdrawal'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  fromWallet: {
    type: String,
    enum: ['deposit', 'topup', 'income']
  },
  toWallet: {
    type: String,
    enum: ['deposit', 'topup', 'income']
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
    },

  referenceId: {
    type: mongoose.Schema.Types.ObjectId // Investment ID or other reference
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);