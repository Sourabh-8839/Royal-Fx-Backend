const mongoose = require('mongoose');

const swapSchema = new mongoose.Schema({
    from: {
       
    },
    to: {
        value: {
            type: Number,
            required: true,
            default: 0.0
        },
        token: {
            type: String,
            required: true,
            default: null
        },
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Userdetail',
        required: true
    }
}, { timestamps: true, versionKey: false });

const SwapModel = mongoose.model('Swap', swapSchema);

module.exports = { SwapModel };