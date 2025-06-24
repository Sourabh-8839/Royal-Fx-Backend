const Plan = require("../models/plan.model");

const UserModel = require("../models/user.model");
const { getToken } = require("../utils/getTokenGenerate");
const {
  getComparePassword,
  getHashPassword,
} = require("../utils/getPassword.password");
const { getOtpGenerate } = require("../utils/getOtpGenerate");
const { sendToOtp } = require("../utils/sendtootp.nodemailer");
const { uploadImageToImageKit } = require("../utils/uploadImageKit");
const {
  generateRandomReferralLink,
} = require("../utils/generateRandomReferralLink");
const randomUser = require("../utils/username");
const TradingAccount = require("../models/tradingAccount.model");
const investmentModel = require("../models/investment.model");
const { WithdrawalRequestModel } = require("../models/withdrawal.model");
const royalityModel = require("../models/royality.model");
const { level } = require("winston");
const {
  distributeLevelIncome,
  starIncomeDistribution,
} = require("./levelIncomeDistribution");
const transactionModel = require("../models/transaction.model");
const ProfitModel = require("../models/InvestProfit.model");


exports.UserRegister = async (req, res) => {
  try {
    const { name, email, mobile, password, referralCode } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const isFirstUser = (await UserModel.countDocuments()) === 0;

    if (!isFirstUser && !referralCode) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required",
      });
    }

    const existingUser = await UserModel.findOne({ email });

    if (existingUser) {
      if (existingUser.otpdetails?.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      } else {
        // Unverified user => update info and re-send OTP
        const { otp, expireOtp } = getOtpGenerate();
        const hashPassword = await getHashPassword(password);

        existingUser.name = name.trim();
        existingUser.mobile = mobile;
        existingUser.password = hashPassword;
        existingUser.otpdetails.otp = otp;
        existingUser.otpdetails.expireOtp = expireOtp;

        await existingUser.save();

        await sendToOtp({
          otp,
          user: existingUser,
          subject: "Verify your account (New OTP)",
        });

        return res.status(200).json({
          success: true,
          message: "Previous unverified user updated. OTP re-sent.",
          data: {
            email: existingUser.email,
            username: existingUser.username,
            referredBy: existingUser.referredBy,
          },
        });
      }
    }

  


    const generatedUsername = randomUser();
    let referredByUser = null;

    if (referralCode) {
      referredByUser = await UserModel.findOne({ username: referralCode });
      if (!referredByUser) {
        return res.status(400).json({
          success: false,
          message: "Referral code not found",
        });
      }
    }

    const { otp, expireOtp } = getOtpGenerate();
    const hashPassword = await getHashPassword(password);

    const newUser = new UserModel({
      name: name.trim(),
      email,
      mobile,
      password: hashPassword,
      username: generatedUsername,
      referredBy: referredByUser?._id,
      otpdetails: {
        otp,
        expireOtp,
      },
    });

    await newUser.save();

    if (referredByUser) {
      referredByUser.partners.push(newUser._id);
      await referredByUser.save();
    }

    await sendToOtp({
      otp,
      user: newUser,
      subject: "Verify your account",
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        name: newUser.name,
        email: newUser.email,
        mobile: newUser.mobile,
        username: newUser.username,
        referredBy: newUser.referredBy,
        isFirstPurchase: newUser.isFirstPurchase,
        createdAt: newUser.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.UserOTPVerify = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (
      !user.otpdetails ||
      user.otpdetails.otp !== otp ||
      new Date(user.otpdetails.expireOtp) < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    user.otpdetails.isVerified = true;
    user.otpdetails.otp = null;
    user.otpdetails.expireOtp = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "User account verified successfully.",
      data: {
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        username: user.username,
        isVerified: user.otpdetails.isVerified,
        isFirstPurchase: user.isFirstPurchase,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.UserProfile = async (req, res) => {
  const userId = req.user._id;

  try {
    // User data with referredBy populated
    const user = await UserModel.findById(userId).populate("referredBy").lean();

    if (!user) {
      return res.status(404).json({ message: "User not found", status: false });
    }

    // Dashboard stats
    const totalEarning = user.account?.totalEarning || 0;
    const totalInvestment = user.account?.totalInvestment || 0;
    const activeStrategy = user.plan?.isActive ? user.plan?.name : null;
    const totalWithdrawal = user.account?.totalWithdrawal || 0;
    const totalReferral = user.account?.totalReferralEarning || 0;

    res.status(200).json({
      message: "User profile & dashboard stats fetched successfully",
      status: true,
      data: {
        userProfile: user,
        dashboardStats: {
          totalEarning,
          totalInvestment,
          activeStrategy,
          totalWithdrawal,
          totalReferral
        }
      }
    });
  } catch (error) {
    console.error("UserProfile error:", error);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error
    });
  }
};


exports.UserChangePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Both old and new passwords are required.",
    });
  }
  try {
    const user = await UserModel.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await getComparePassword(user, oldPassword);
    // const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Old password is incorrect" });
    }
    const hashPassword = await getHashPassword(newPassword);
    user.password = hashPassword; // Ensure to hash the new password before saving
    await user.save();
    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.UserRegenerateOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User does not exist.",
      });
    }

    const { otp, expireOtp } = getOtpGenerate();
    user.otpdetails.otp = otp;
    user.otpdetails.expireOtp = expireOtp;
    user.otpdetails.isVerified = false;

    const otpResult = await sendToOtp({
      subject: "Royal-FX Resend OTP Verification Code",
      user: user,
      otp,
    });

    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP has been regenerated. Please check your email.",
      data: {
        email: user.email,
        username: user.username,
        otpSent: true,
      },
    });
  } catch (error) {
    console.error("Error regenerating OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};

exports.UserLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });

  try {
    const user = await UserModel.findOne({ email });
    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "User does not exist." });

    if (user.isBlocked)
      return res.status(403).json({
        success: false,
        message: "User is blocked. Contact support.",
      });

    const isMatch = await getComparePassword(password, user.password);
    if (!isMatch)
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });

    if (!user.otpdetails.isVerified)
      return res.status(401).json({
        success: false,
        message: "Please verify your account using OTP.",
      });

    const token = await getToken(user);
    user.token = token;
    await user.save();

    res.cookie("token", token, {
      httpOnly: false,
      path: "/",
      secure: false,
      sameSite: "Strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        username: user.username,
        isFirstPurchase: user.isFirstPurchase,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.UserLogout = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id);
    user.tokenBlock.push(user.token);
    user.token = null;
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });

    return res
      .status(200)
      .json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.GetUser = async (req, res) => {
  try {
    const user = req.user;
    const newUser = await UserModel.findById(user._id).populate("addtocart");
    // console.log(newUser);
    return res.status(200).json({
      success: true,
      message: "User fetched successfully.",
      data: newUser,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.PasswordForgot = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res
      .status(400)
      .json({ success: false, message: "Email is required." });
  try {
    const user = await UserModel.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    const { otp, expireOtp } = getOtpGenerate();
    user.otpdetails.otp = otp;
    user.$assertPopulatedotpdetails.expireOtp = expireOtp;
    await user.save();
    sendToOtp({ otp, user, subject: "Royal-FX Password Forgot OTP." });

    return res
      .status(200)
      .json({ success: true, message: "OTP sent to your email." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.VerifyForgotPasswordOtp = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp)
    return res
      .status(400)
      .json({ success: false, message: "Email and OTP are required." });
  try {
    const user = await UserModel.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    if (user.otp !== otp || user.otpExpire < Date.now())
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    const hashPassword = await getHashPassword(newPassword);
    // Clear OTP after verification
    user.otpdetails.otp = null;
    user.otpdetails.expireOtp = null;
    user.password = hashPassword; // Ensure to hash the new password before saving
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified and Password reset successfully.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.ClientProfileUpdate = async (req, res) => {
  const { username, mobile, email, firstname, lastname } = req.body;
  if (!username || !mobile || !email)
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });

  try {
    const user = await UserModel.findByIdAndUpdate(
      req.user._id,
      {
        name: { username, firstname, lastname },
        mobile: { primaryMobile: mobile },
        email: { primary: email },
      },
      { new: true }
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.fillVendorDetails = async (req, res) => {
  const id = req.params.id;
  const {
    vendorName,
    primaryContact,
    secondaryContact,
    email,
    designation,
    country,
    state,
    city,
    pincode,
    companyName,
    businessType,
    gstin,
    nocExpiryDate,
    mcaExpiryDate,
    adharCardImg,
    panCardImg,
    mcaImg,
    gstCertificateImg,
    businessAddressImg,
    businessEmail,
    businessMobile,
    aadharNo,
    pancardNo,
    mcaNo,
    address,
    businessPancardNo,
    businessPanCardImg,
    holdername,
    branchName,
    bankname,
    passbook,
    accountNumber,
    ifsccode,
  } = req.body;

  if (
    !vendorName ||
    !primaryContact ||
    !secondaryContact ||
    !email ||
    !address ||
    !city ||
    !state ||
    !country ||
    !pincode ||
    !designation ||
    !businessType ||
    !gstin ||
    !nocExpiryDate ||
    !mcaExpiryDate ||
    !adharCardImg ||
    !panCardImg ||
    !mcaImg ||
    !gstCertificateImg ||
    !businessAddressImg ||
    !businessEmail ||
    !aadharNo ||
    !pancardNo ||
    !mcaNo ||
    !companyName ||
    !holdername ||
    !branchName ||
    !bankname ||
    !passbook ||
    !businessMobile ||
    !accountNumber ||
    !ifsccode ||
    !businessPanCardImg ||
    !businessPancardNo
  ) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });
  }

  try {
    const user = await UserModel.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const uploadImageIfUrl = async (image, folder) => {
      if (!image) return null;

      // Check if image is a valid URL (supports http & https)
      const isValidUrl =
        /^(http|https):\/\/.*\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(image);

      return isValidUrl ? image : await uploadImageToImageKit(image, folder); // Return URL if valid, otherwise null
    };

    const aadharCardImgFileName = await uploadImageIfUrl(
      adharCardImg,
      "generaldetail"
    );
    const panCardImgFileName = await uploadImageIfUrl(
      panCardImg,
      "generaldetail"
    );
    const businessPanCardImgFileName = await uploadImageIfUrl(
      businessPanCardImg,
      "generaldetail"
    );
    const passbookFileName = await uploadImageIfUrl(passbook, "generaldetail");
    const businessAddImg = await uploadImageIfUrl(
      businessAddressImg,
      "generaldetail"
    );
    const mcaImgFileName = await uploadImageIfUrl(mcaImg, "generaldetail");

    // Update user details
    const updatedUser = await UserModel.findByIdAndUpdate(
      id,
      {
        $set: {
          name: { username: vendorName },
          "mobile.primaryMobile": primaryContact,
          "mobile.secondaryMobile": secondaryContact,
          "email.primary": email,

          "generaldetails.uidai.number": aadharNo,
          "generaldetails.uidai.file": aadharCardImgFileName,
          "generaldetails.pancard.number": pancardNo,
          "generaldetails.pancard.file": panCardImgFileName,
          "generaldetails.address.address": address,
          "generaldetails.city": city,
          "generaldetails.state": state,
          "generaldetails.country": country,
          "generaldetails.pincode": pincode,
          "generaldetails.designation": designation,

          "bankdetails.holdername": holdername,
          "bankdetails.branchName": branchName,
          "bankdetails.bankname": bankname,
          "bankdetails.passbook": passbookFileName,
          "bankdetails.pincode": pincode,
          "bankdetails.accountNumber": accountNumber,
          "bankdetails.ifsccode": ifsccode,
          "bankdetails.proofdetail.proofid": pancardNo,
          "bankdetails.proofdetail.prooffile": panCardImgFileName,

          "shopdetails.shopname": companyName,
          "shopdetails.businessType": businessType,
          "shopdetails.gstDetail.number": gstin,
          "shopdetails.gstDetail.file": gstCertificateImg,
          "shopdetails.nocExpiryDate": nocExpiryDate,
          "shopdetails.mcaDetails.number": mcaNo,
          "shopdetails.mcaDetails.expireDate": mcaExpiryDate,
          "shopdetails.mcaDetails.file": mcaImgFileName,
          "shopdetails.contactDetail.primary": primaryContact,
          "shopdetails.contactDetail.secondary": secondaryContact,
          "shopdetails.emailDetail.primary": businessEmail,
          "shopdetails.emailDetail.secondary": null,
          "shopdetails.pancard.number": businessPancardNo,
          "shopdetails.pancard.file": businessPanCardImgFileName,
          "shopdetails.address.file": businessAddImg,
          "shopdetails.address.proof": address,
          "shopdetails.city": city,
          "shopdetails.state": state,
          "shopdetails.country": country,
          "shopdetails.pincode": pincode,
        },
      },
      { new: true, runValidators: true }
    );

    if (req.path.includes("/update")) {
      updatedUser.isUpdatedVendor = "pending";
      await updatedUser.save();
    } else {
      updatedUser.isVendorVerified = "pending";
      await updatedUser.save();
    }

    return res.status(200).json({
      success: true,
      message: "User details updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error in creating/updating general details:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await UserModel.find();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(401).json({ success: false, message: error.message });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(401).json({ success: false, message: error.message });
  }
};

exports.deposit = async (req, res) => {
  try {
    const user = req.user;
    const { amount, txResponse, recipientAddress, userAddress } = req.body;

    if (!amount)
      return res
        .status(400)
        .json({ success: false, message: "Amount is required." });
    if (amount < 0)
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount." });

    const txnId = generateTxnId();
    const transaction = await TransactionModel.create({
      userId: user._id,
      amount: Number(amount),
      clientAddress: userAddress,
      mainAddress: recipientAddress,
      hash: txResponse.hash,
      transactionID: txnId,
      type: "deposit",
    });

    user.wallet.depositWallet += Number(amount);
    user.transaction.push(transaction._id);
    // user.walletAddress = userAddress;
    await user.save();
    return res
      .status(200)
      .json({ success: true, message: "Deposit successful." });
  } catch (error) {
    console.log("Error depositing:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.purchasePlans = async (req, res) => {
  try {
    // Step 1: Validate Input
    const user = req.user;

    const {
      investmentAmount,
      tradingAcc,
      mainPassword,
      tradingPlatform,
      serverName,
      firstName,
      lastName,
      email,
      password,
      planId,
    } = req.body;

    if (
      !tradingAcc ||
      !mainPassword ||
      !tradingPlatform ||
      !serverName ||
      !firstName ||
      !lastName ||
      !email ||
      !password
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Step 2: Check if the plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(400).json({ message: "Plan not found" });
    }

    // Step 3: Check if the user has sufficient balance in their top-up wallet
    if (user.wallet.topupWallet < investmentAmount) {
      return res
        .status(400)
        .json({ message: "Insufficient funds in your top-up wallet" });
    }

    // Step 4: Deduct funds from the top-up wallet
    user.wallet.topupWallet -= investmentAmount; // Deduct the investment amount from the wallet

    plan.totalInvestment += Number(investmentAmount);

    plan.brokerageCharge += Number(investmentAmount) * 0.2; //Update the plan's brokerage charge based on the investment amount
    // Update the plan's total investment
    // Step 5: Create a new trading account
    const newAccount = new TradingAccount({
      userId: user._id,
      planId: plan._id,
      tradingAcc,
      mainPassword,
      tradingPlatform,
      serverName,
      firstName,
      lastName,
      email,
      password, // Storing password directly (hash it for security in real use)
    });

    // Step 6: Save the new trading account to the database

    // Step 7: Convert investment amount to BV
    const investmentInBV = investmentAmount / 100; // 1 BV = 100 USDT

    const royaltyTiers = ["Silver", "Gold", "Diamond"];

    for (let tier of royaltyTiers) {
      const existingRoyalty = await royalityModel.findOne({ name: tier });

      if (existingRoyalty) {
        // Update the royalty amounts for the existing tier

        const royaltyAmount =
          investmentAmount * (existingRoyalty.percentage / 100);
        existingRoyalty.totalRoyalty += royaltyAmount;
        await existingRoyalty.save();
      }
    }

    // Step 8: Save the investment amount in the investment model
    // Step 7: Save the new trading account to the database

    plan.totalInvestment += Number(investmentAmount);

    const investAmount = new investmentModel({
      userId: user._id,
      plan: plan._id,
      investAmount: investmentAmount, // Amount invested by the user
    });

    // Step 9: Update the user's selfBV and rewardBV
    user.selfBV = (user.selfBV || 0) + investmentInBV; // Add the investment BV to selfBV

    // Add the investment BV to rewardBV

    user.firstInvestment = investmentAmount;
    user.totalEarningLimit = 0;

    user.plan.planId = plan._id; // Associate the user with the plan
    user.plan.isActive = true;
    user.account.totalInvestment = (user.account.totalInvestment || 0.0) + Number(investmentAmount); // Set the plan as active for the user

    if (!user.isFirstPurchase) {
      user.activationdetails = {
        isActive: true,
        activeDate: new Date(),
      };
    }

    await user.save();
    await distributeLevelIncome(user._id);
   
    await starIncomeDistribution(user._id, investmentAmount); // Distribute level income to uplines

    // Save the updated user

    await plan.save(); // Save the updated plan with the new total investment
    await investAmount.save();
    await newAccount.save();

    // Step 10: Send success response
    res
      .status(201)
      .json({
        message: "Trading account created successfully",
        account: newAccount,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPlans = async (req, res) => {
  try {
    let data = await Plan.find({});
    res
      .status(200)
      .json({
        message: "Plans fetched successfully",
        data: data,
        status: true,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "internal server error", error, status: false });
  }
};


exports.getMyinvestment = async(req , res)=>{
  let userId = req.user._id;
  try {
    let data = await investmentModel.findById(userId)
    res.status(200).json({message : "Data fetched successfully" , data : data , success : true})
  } catch (error) {
    res.status(200).json({message : "Internal server error" ,error , success : false})
    
  }
}

exports.Withdrawal = async (req, res) => {
  try {
    const { amount, walletAddress } = req.body;
    console.log(amount, walletAddress);

    if (!amount || !walletAddress)
      return res
        .status(400)
        .json({
          success: false,
          withdrawalPermission: "Rejected",
          message: "Amount & Wallet Address are required.",
        });
    const user = await UserModel.findById(req.user._id).populate({
      path: "withdrawal",
      select: "amount createdAt walletAddress",
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not exists." });
    if (amount > user.wallet.incomeWallet)
      return res
        .status(400)
        .json({ success: false, message: "Insufficient funds." });

    // if (amount < admin.min || amount > admin.max) {
    //     return res.status(400).json({ success: false, message: "Amount is outside the minimum and maximum withdrawal limit." });
    // }
    const txnId = generateTxnId();
    const newWithdrawal = new WithdrawalRequestModel({
      userId: user._id,
      value: amount,
      type: "USDT_Withdrawal",
      clientAddress: walletAddress,
      amount: amount,
      status: "Pending",
      transactionId: txnId,
    });

    user.wallet.incomeWallet -= amount;
    user.account.totalWithdrawal =(user.account.totalWithdrawal || 0) + Number(amount); // Update total withdrawal amount
    user.withdrawal.push(newWithdrawal);
    await user.save();
    await newWithdrawal.save();

    res
      .status(200)
      .json({
        success: true,
        message: "Withdrawal request created successfully.",
        data: newWithdrawal,
      });

    // await WithdrawalUsdt({ req, res, userId: user._id, walletAddress, amount });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.WithdrawalsHistory = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id, {
      withdrawal: 1,
      username: 1,
      investment: 1,
    }).populate({ path: "withdrawal" });
    const history = user.withdrawal;
    const totalAmount = history.reduce((total, w) => total + w.amount, 0);
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0,
      0,
      0
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59
    );
    const todayAmount = history
      .filter(
        (w) =>
          new Date(w.createdAt) >= startOfDay &&
          new Date(w.createdAt) <= endOfDay
      )
      .reduce((total, w) => total + w.amount, 0);
    return res
      .status(200)
      .json({
        success: true,
        data: { history, totalAmount, todayAmount },
        message: "Withdrawal finds successfully. ",
      });
  } catch (error) {
    console.error("Error fetching total withdrawal:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.transferFunds = async (req, res) => {
  const user = req.user;
  const { fromWallet, toWallet, amount } = req.body;

  

  try {
    if (!fromWallet || !toWallet)
      return res
        .status(400)
        .json({ success: false, message: "Both from and to are required." });
    // if (!from.value || !to.value || from.value <= 0 || to.value < 0) return res.status(400).json({ success: false, message: "Invalid amount." });

    if (amount > user.wallet[fromWallet]) {
      return res
        .status(400)
        .json({ success: false, message: `Insufficient Funds` });
    }

    user.wallet[fromWallet] -= amount;

    user.wallet[toWallet] += amount;

    const Wallet = fromWallet === "depositWallet" ? "deposit" : "income";

    // Create transaction record

    const transaction = new transactionModel({
      userId: user._id,
      type: "topup",
      amount,
      fromWallet: Wallet,
      toWallet: "topup",
    });
    await transaction.save();

    user.transaction.push(transaction._id);

    await user.save();

    return res.status(200).json({ success: true, message: "Swap successful." });
  } catch (error) {
    console.log("Error swapping:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


exports.getReferrals = async(req , res)=>{
  let userId = req.user._id
  try {
    let data = await UserModel.findById(userId).select('partners').populate('partners')
    res.status(201).json({message : "Referrals fetched successfully" , data : data , success : true} )
  } catch (error) {
    res.status(500).json({message : "Internal Server error" , error , status : false})
  }
}



exports.stopStrategy = async (req, res) => {
  const userId = req.user._id;

  try {
    const user = await UserModel.findById(userId);
    if (!user || !user.plan?.isActive) {
      return res.status(400).json({ message: "No active strategy found.", success: false });
    }

    const investmentAmount = user.account.totalInvestment || 0;

    const profitDoc = await ProfitModel.findOne({ userId });
    const profitAmount = profitDoc?.profitAmount || 0;

    user.wallet.topupWallet += investmentAmount + profitAmount;

    user.plan.isActive = false;
    user.account.totalInvestment = 0;
    user.account.currentIncome = 0;
    user.currentEarnings = 0;
    user.totalEarningLimit = 0;

    if (profitDoc) {
      await ProfitModel.deleteOne({ _id: profitDoc._id });
    }

    await user.save();

    return res.status(200).json({
      message: "Strategy stopped and amounts refunded to topup wallet.",
      refunded: {
        investmentAmount,
        profitAmount,
        totalRefunded: investmentAmount + profitAmount,
      },
      success: true,
    });

  } catch (error) {
    console.error("Stop Strategy Error:", error);
    return res.status(500).json({ message: "Server Error", error, success: false });
  }
};



