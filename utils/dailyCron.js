const cron = require("node-cron");
const {updateRank, BVRewards} = require("../controllers/levelIncomeDistribution");
const { validate } = require("../models/transaction.model");


cron.schedule("* * * * *", async () => {
        try {
            console.log("Daily cron job started");
            await updateRank();
            const val=await BVRewards()
            console.log(val)

        //    console.log("Rank update completed:", val);
            console.log("Daily cron job completed successfully");
        } catch (error) {
            console.error("Error in daily cron job:", error);
        }
    });



