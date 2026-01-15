const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const upload = require('../config/upload');

router.post('/register', upload.single('proofDocument'), authController.registerVendor);
router.post('/login', authController.loginVendor);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
