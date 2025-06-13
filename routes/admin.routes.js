// this is admin routes file
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

const checkAdminLoggedIn = require('../middleware/admin.middleware');
const levelIncomeDistribution  = require('../controllers/levelIncomeDistribution');

// Admin management
router.post('/login', adminController.loginAdmin);
router.post('/create-admin', adminController.createAdmin);
router.post('/forgot-password', adminController.forgotPassword);
router.post('/reset-password', adminController.resetPassword);
router.get('/logout', adminController.logoutAdmin);
router.post('/create-plan', adminController.createPlan);
router.post('/create-royalty', adminController.createRoyalty);
//--------------GET LEVEL HISTORY--------------------------------
router.get("/get-level" , checkAdminLoggedIn , levelIncomeDistribution.getTotalLevelIncome)
// Apply authentication middleware to routes that require authentication
router.use(checkAdminLoggedIn);

router.get('/get-admin', checkAdminLoggedIn, adminController.getAdmin);


router.get('/get-withdrawal-history', checkAdminLoggedIn, adminController.getWithdrawalHistory);

router.post('/update-withdrawal-status/:id', checkAdminLoggedIn, adminController.updateWithdrawalStatus);



// router.get('/get-members', checkAdminLoggedIn, adminController.getMembers);

// router.get('/get-member/:id', checkAdminLoggedIn, adminController.getMember);

// User verify routes
// router.get('/get-users-list-to-verify', checkAdminLoggedIn, adminController.getUserListToVerify);


module.exports = router;