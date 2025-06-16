const cron = require("node-cron");
const {updateRank, BVRewards, calculateMatchingBVForAllUsers} = require("../controllers/levelIncomeDistribution");
const { validate } = require("../models/transaction.model");


cron.schedule("* * * * *", async () => {
        try {
            console.log("Daily cron job started");
            
            await calculateMatchingBVForAllUsers()
            await updateRank()
           await BVRewards()

        //    console.log("Rank update completed:", val);
            console.log("Daily cron job completed successfully");
        } catch (error) {
            console.error("Error in daily cron job:", error);
        }
    });



