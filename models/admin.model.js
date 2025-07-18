const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
      
    },
    image: {
        type: String,
        default: null
    },
    mobile: {
        type: String,
        
    },
    email: {
        type: String,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ["admin", "management"],
        default: "admin"
    },
    joiningDate: {
        type: Date,
        default: Date.now
    },
    otp: {
        type: String,
        default: null,
    },
    status: {
        type: Boolean,
        default: true
    }
});


adminSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.otp;
        return ret;
    }
});

adminSchema.set('toObject', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.otp;
        return ret;
    }
});

const AdminModel = mongoose.model("admin", adminSchema);

module.exports = AdminModel