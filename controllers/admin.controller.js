const user = require('../models/admin.model');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/email');
const { getComparePassword, getHashPassword } = require("../utils/getPassword.password");
const Plan = require('../models/plan.model');
const royalityModel = require('../models/royality.model');
const { WithdrawalRequestModel } = require('../models/withdrawal.model');
const { WithdrawalUsdt } = require('./withdrawal.controller');
const UserModel = require("../models/user.model")

exports.loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    console.log('Received email:', email);
    console.log('Received password:', password);

    const admin = await user.findOne({ email }).select('+password');

    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare the hashed password using getComparePassword
    const isMatch = await getComparePassword(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',  // Ensure secure cookies for production
      maxAge: 30 * 24 * 60 * 60 * 1000  // 30 days expiration
    });

    // Update last login date
    admin.lastLogin = new Date();
    await admin.save();

    // Return success response
    res.status(200).json({
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    next(error);
  }
};

// Create Admin
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, name, mobile } = req.body;

    // Validate input karegaaaaaaaa
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Check if admin already hai 
    const existingAdmin = await user.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ message: 'Admin with this email already exists' });
    }
    const hashPassword = await getHashPassword(password);
    // Create kardo admin ko
    const newAdmin = new user({
      email,
      password: hashPassword,
      role: 'admin',
      name,
      mobile
    });

    await newAdmin.save();

    res.status(201).json({ message: 'Admin created successfully', admin: newAdmin });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ message: error.message });
  }
};


exports.getAdmin = async (req, res) => {
  try {
    const admin = req.admin;
    // dont send password and otp field in response
    res.status(200).json(admin);
  } catch (error) {
    console.error('Error getting admin:', error);
    res.status(500).json({ message: error.message });
  }
}

exports.logoutAdmin = async (req, res) => {
  try {
    res.clearCookie('token');
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ message: error.message });
  }
}

// forgot password
const otpStore = new Map(); // { "user_email": { otp, expiresAt } }
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await user.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    // send email to admin
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // OTP valid for 5 minutes

    otpStore.set(email, { otp, expiresAt });

    await sendEmail(email, otp);

    res.status(200).json({ message: 'Password reset otp sent to email', otp });
  } catch (error) {
    console.error('Error forgot password:', error);
    res.status(500).json({ message: error.message });
  }
}
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    // Check if OTP is valid
    const storedOTP = otpStore.get(email);
    if (!storedOTP || storedOTP.otp !== otp || storedOTP.expiresAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in database
    await user.findOneAndUpdate({ email }, { password: hashedPassword });

    // Remove OTP from store after successful reset
    otpStore.delete(email);

    res.status(200).json({ message: 'Password reset successful' });

  } catch (error) {
    console.error('Error reset password:', error);
    res.status(500).json({ message: error.message });
  }
}


// get members
// exports.getMembers = async (req, res) => {
//   try {
//     const members = await user.find({ role: { $ne: 'admin' } });
//     res.status(200).json({ members });
//   } catch (error) {
//     console.error('Error getting members:', error);
//     res.status(500).json({ message: error.message });
//   }
// }

// exports.getMember = async (req, res) => {
//   try {
//     const member = await user.findById(req.params.id);
//     res.status(200).json({ member });
//   } catch (error) {
//     console.error('Error getting member:', error);
//     res.status(500).json({ message: error.message });
//   }
// }

// user verify routes
// exports.getUserListToVerify = async (req, res) => {
//   try {
//     const users = await UserModel.find({ $or: [{ isVendorVerified: "pending" }, { isUpdatedVendor: "pending" }] });
//     res.status(200).json({ data: users });
//   } catch (error) {
//     console.error('Error getting user list:', error);
//     res.status(500).json({ message: error.message });
//   }
// }



exports.createPlan = async (req, res) => {
  try {
    const { name} = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Plan name is required' });
    }

    // Check if plan already exists
    const existingPlan = await Plan.findOne({ name });
    if (existingPlan) {
      return res.status(409).json({ message: 'Plan with this name already exists' });
    }

    // Create new plan
    const newPlan = new Plan({
      name,
    });

    await newPlan.save();

    res.status(201).json({ message: 'Plan created successfully', plan: newPlan });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ message: error.message });
  }
}

exports.createRoyalty = async (req, res) => {
  try {
    const { name, percentage,totalRoyalty,matchingBV } = req.body;

    if (!name || !totalRoyalty) {
      return res.status(400).json({ message: 'Name and total investment are required' });
    }

    // Create new royalty
    const newRoyalty = new royalityModel({
      name,
      totalRoyalty,
      matchingBV,
      percentage
    });

    await newRoyalty.save();

    res.status(201).json({ message: 'Royalty created successfully', royalty: newRoyalty });
  } catch (error) {
    console.error('Error creating royalty:', error);
    res.status(500).json({ message: error.message });
  }
}


exports.getWithdrawalHistory = async (req, res) => {
  try {
    // const users = await UserModel.find().populate('transaction', 'amount transactionType').select('userId name transaction').sort({ createdAt: -1 });
    // if (!users) {
    //   return res.status(404).json({ message: 'No users found' });
    // }
    // const deposits = users.flatMap(user => user.transaction
    //   .filter(transaction => transaction.transactionType === 'withdrawal')
    //   .map(transaction => ({
    //     amount: transaction.amount,
    //     transactionType: transaction.transactionType,
    //     userId: user.userId,
    //     email: user.email,
    //     name: user.name,
    //     mobile: user.mobile
    //   }))
    // );

    const deposits = await WithdrawalRequestModel.find().populate('userId', 'email name mobile userId walletAddress').sort({ createdAt: -1 });
    if (!deposits || deposits.length === 0) {
      return res.status(400).json({ success: true, message: 'No withdrawal requests found' });
    }

    res.status(200).json({ success: true, message: "Withdrawal history fetched successfully", data: deposits });
  } catch (error) {
    console.error('Error getting withdrawal history:', error);
    res.status(500).json({ message: error.message });
  }
}

exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    const withdrawalRequest = await WithdrawalRequestModel.findById(id);
    if (!withdrawalRequest) {
      return res.status(404).json({ message: 'Withdrawal request not found' });
    }
    if (status === "Completed") {
      const user = await UserModel.findById(withdrawalRequest.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      await WithdrawalUsdt({ req, res, userId: user._id, walletAddress: withdrawalRequest.clientAddress, amount: withdrawalRequest.amount, withdrawalRequest });

      // return res.status(200).json({ message: 'Withdrawal status updated to completed', withdrawalRequest });
    } else if (status === "Rejected") {
      withdrawalRequest.status = "Rejected";
      const user = await UserModel.findById(withdrawalRequest.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      user.wallet.incomeWallet += withdrawalRequest.amount;
      user.account.totalWithdrawal -= withdrawalRequest.amount;
      await user.save();
      await withdrawalRequest.save();
      return res.status(200).json({ status: true, message: 'Withdrawal status updated to rejected' });
    } else {
      return res.status(400).json({ message: 'Invalid status' });
    }
  } catch (error) {
    console.error('Error updating withdrawal status:', error);
    res.status(500).json({ message: error.message });
  }
}


exports.getUsers = async(req , res)=>{
  try {
    let data = await UserModel.find().populate("plan" , "planId")
    res.status(200).json({message : "Users fetched successfully" , data : data , success : true})
  } catch (error) {
    res.status(500).json({message : "Internal server error" , error, success : false})
  }
}