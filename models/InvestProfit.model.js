const mongoose = require("mongoose")


const InvestProfitSchema = new mongoose.Schema({
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Userdetail"
    },
    profitAmount : {
        type : Number,
        default : 0
    }
})


module.exports = mongoose.model("Profit" , InvestProfitSchema)