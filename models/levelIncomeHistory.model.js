const mongoose = require('mongoose');

const incomeHistorySchema = new mongoose.Schema({
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Userdetail',
    required: true,
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Userdetail',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String, 
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('LevelHistory', incomeHistorySchema);
