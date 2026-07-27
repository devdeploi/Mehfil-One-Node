const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const upload = require('../config/upload');

router.post('/register', upload.single('proofDocument'), authController.registerVendor);
router.post('/login', authController.loginVendor);
router.post('/login-admin', authController.loginSuperAdmin);
router.post('/register-user', authController.registerUser);
router.post('/login-user', authController.loginUser);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Separate OTP Routes
router.post('/send-email-otp', authController.sendEmailOtp);
router.post('/send-phone-otp', authController.sendPhoneOtp);
router.post('/verify-email-otp', authController.verifyEmailOtp);
router.post('/verify-phone-otp', authController.verifyPhoneOtp);

module.exports = router;
