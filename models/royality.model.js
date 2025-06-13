const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define Plan Schema
const royaltySchema = new Schema({
  name: { type: String, 
    required: true,
  enum:['Silver','Gold','Diamond'] }, // Royalty ka naam (e.g., Basic Royalty)
  percentage: { type: Number, required: true }, // Royalty percentage
  totalRoyalty: { type: Number, default: 0 },
  matchingBV:{type:Number,required:true} // Total royalty amount
});

// Model
module.exports = mongoose.model('Royalty', royaltySchema);


