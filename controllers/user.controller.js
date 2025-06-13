const  Plan  = require("../models/plan.model");

const { UserModel } = require("../models/user.model");
const { getToken } = require("../utils/getTokenGenerate");
const { getComparePassword, getHashPassword } = require("../utils/getPassword.password");
const { getOtpGenerate } = require("../utils/getOtpGenerate");
const { sendToOtp } = require("../utils/sendtootp.nodemailer");
const { uploadImageToImageKit } = require("../utils/uploadImageKit");
const {
    generateRandomReferralLink,
} = require("../utils/generateRandomReferralLink");
const randomUser = require("../utils/username");
const { TransactionModel } = require("../models/transaction.model");
const TradingAccount = require("../models/tradingAccount.model");
const investmentModel = require("../models/investment.model");

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


exports.UserProfile = async(req, res) => {
    const userId = req.user._id
    try {
        let data = await UserModel.findById(userId)
        res.status(200).json({message:"Data fetched successfully"  , data : data , status:true})
    } catch (error) {
        res.status(500).json({message:"Internal server error"  , error , status:false})
        
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
    return res.status(400).json({ success: false, message: "All fields are required." });

  try {
    const user = await UserModel.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, message: "User does not exist." });

    if (user.isBlocked)
      return res.status(403).json({
        success: false,
        message: "User is blocked. Contact support.",
      });

    const isMatch = await getComparePassword(user, password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: "Invalid credentials" });

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
        return res
            .status(500)
            .json({ success: false, message: "Server error" });
    }
};

exports.GetUser = async (req, res) => {
    try {
        const user = req.user;
        const newUser = await UserModel.findById(user._id).populate(
            "addtocart"
        );
        // console.log(newUser);
        return res.status(200).json({
            success: true,
            message: "User fetched successfully.",
            data: newUser,
        });
    } catch (error) {
        console.log(error);
        return res
            .status(500)
            .json({ success: false, message: "Server error" });
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
        return res
            .status(500)
            .json({ success: false, message: "Server error." });
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
        return res
            .status(500)
            .json({ success: false, message: "Server error." });
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
                /^(http|https):\/\/.*\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(
                    image
                );

            return isValidUrl
                ? image
                : await uploadImageToImageKit(image, folder); // Return URL if valid, otherwise null
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
        const passbookFileName = await uploadImageIfUrl(
            passbook,
            "generaldetail"
        );
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

        if (!amount) return res.status(400).json({ success: false, message: "Amount is required." });
        if (amount < 0) return res.status(400).json({ success: false, message: "Invalid amount." });

        const txnId = generateTxnId();
        const transaction = await TransactionModel.create({
            userId: user._id,
            amount: Number(amount),
            clientAddress: userAddress,
            mainAddress: recipientAddress,
            hash: txResponse.hash,
            transactionID: txnId,
            type: "deposit"
        })

        user.wallet.depositWallet += Number(amount);
        user.transaction.push(transaction._id);
        // user.walletAddress = userAddress;
        await user.save();
        return res.status(200).json({ success: true, message: "Deposit successful." });
    } catch (error) {
        console.log("Error depositing:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

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


    if ( !tradingAcc|| !mainPassword || !tradingPlatform || !serverName || !firstName || !lastName || !email || !password) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // Step 3: Check if the plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(400).json({ msg: "Plan not found" });
    }


    // Step 6: Create a new trading account
    const newAccount = new TradingAccount({
      userId:user._id,
      planId:plan._id,
      tradingAcc,
      mainPassword,
      tradingPlatform,
      serverName,
      firstName,
      lastName,
      email,
      password// Storing hashed password for security
    });

    // Step 7: Save the new trading account to the database
    await newAccount.save();


    const investAmount = new investmentModel({
      userId: user._id,
      plan: plan._id,
      investAmount: investmentAmount, // Amount invested by the user
    });

    investAmount.save();

    user.isFirstPurchase = true;

    user.firstInvestment = investamount;

    user.activationdetails= {
      isActive: true,
      activeDate: new Date(),
    };

    await user.save();

    // Step 8: Send success response
    res.status(201).json({ msg: "Trading account created successfully", account: newAccount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getPlans = async(req , res)=>{
    try {
        let data = await Plan.find({})
        res.status(200).json({message:"Plans fetched successfully" ,data : data , status : true })
    } catch (error) {
        res.status(500).json({message:"internal server error" ,error , status : false })
        
    }
}
