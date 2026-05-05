const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: false
    },
    emailOtp: {
        type: String,
        required: false
    },
    phoneOtp: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: 300 } // OTP expires in 5 minutes
    }
});

module.exports = mongoose.model('Otp', otpSchema);
