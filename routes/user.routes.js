const router = require('express').Router();

const  levelIncomeDistribution  = require('../controllers/levelIncomeDistribution');
const UserController = require('../controllers/user.controller');
const { authenticateUser } = require('../middleware/user.middleware');
// User registration route
const { userNotverifyAccountDelete } = require('../utils/verifyAccountCalculate');
setInterval(() => {
    userNotverifyAccountDelete();
}, 1000)


// ------------------------------------ACCOUINT DETAIL START -------------------------------------
// register
router.post('/register', UserController.UserRegister);
// User login
router.post('/login', UserController.UserLogin);
// get logged in user
router.get('/get-user', authenticateUser, UserController.GetUser);
// Verify OTP
router.post('/register-otp-verify', UserController.UserOTPVerify);
router.post('/regenerate-otp', UserController.UserRegenerateOTP);
router.post('/change-password', UserController.UserChangePassword);
router.post('/password-forgot', UserController.PasswordForgot);
router.post('/verify-forgot-password-otp', UserController.VerifyForgotPasswordOtp);

router.get('/profile', authenticateUser, UserController.UserProfile);
router.get("/get-direct-users" , authenticateUser , UserController.getReferrals)
router.post('/fill-vendor-details/:id', UserController.fillVendorDetails);
router.post('/fill-vendor-details/:id/update', UserController.fillVendorDetails);

router.get('/get-all-users', UserController.getAllUsers)
router.get('/get-user-details/:id', UserController.getUserDetails)

router.post('/deposit-amount', authenticateUser, UserController.deposit);
router.get("/get-transaction-history", authenticateUser, UserController.getTransactionHistory);
router.post('/purchase-products', authenticateUser, UserController.purchasePlans);

router.post('/withdraw-amount', authenticateUser, UserController.Withdrawal)
router.get('/withdrawal-history', authenticateUser, UserController.WithdrawalsHistory)
router.post('/transfer-amount', authenticateUser, UserController.transferFunds);

//---------------------GET PLANS--------------------------
router.get("/get-plans" , UserController.getPlans)
router.get("/get-investment" , authenticateUser , UserController.getMyinvestment)
//----------------------GET LEVEL INCOME HISTORY---------------
router.get("/get-level-history" , authenticateUser , levelIncomeDistribution.getMyLevelHistory)
//-----------------------STOP STRATEGY-------------------------
router.post("/stop-strategy" , authenticateUser , UserController.stopStrategy)


module.exports = router;