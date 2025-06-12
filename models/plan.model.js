const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define Plan Schema
const planSchema = new Schema({
  name: { type: String, required: true },
  totalInvestment:{type:Number,default:0}, // Plan ka naam
  // isActive: { type: Boolean, default: true }, // Whether the plan is active or not
});

// Model
const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
