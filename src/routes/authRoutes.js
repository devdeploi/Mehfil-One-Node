const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const upload = require('../config/upload');

router.post('/register', upload.single('proofDocument'), authController.registerVendor);
router.post('/login', authController.loginVendor);
router.post('/register-user', upload.single('proofDocument'), authController.registerUser);
router.post('/login-user', authController.loginUser);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
