const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Otp = require('../models/Otp');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/email');
const sendSms = require('../utils/sms');

// Register Vendor
exports.registerVendor = async (req, res) => {
    try {
        const { fullName, email, phone, password, plan, businessName, gstNumber, businessAddress, upiId } = req.body;
        const proofDocument = req.file ? req.file.path.replace(/\\/g, "/") : null;

        // Check if user exists
        let vendor = await Vendor.findOne({ email });
        if (vendor) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new vendor
        vendor = new Vendor({
            fullName,
            email,
            phone,
            password: hashedPassword,
            status: 'Pending',
            plan: plan || 'Standard',
            businessName,
            gstNumber,
            businessAddress,
            upiId,
            proofDocument
        });

        await vendor.save();

        // Send Registration Success Email
        const subject = 'Registration Successful - Mehfil One';
        const themeColor = '#fac371';
        const darkColor = '#0f172a';
        const lightBg = '#f8fafc';

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${subject}</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: ${lightBg}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td align="center" style="padding: 40px 0;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                                <tr>
                                    <td style="background-color: ${darkColor}; padding: 35px 30px; text-align: center;">
                                        <h1 style="color: ${themeColor}; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">Mehfil One</h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background-color: #f0fdf4; padding: 30px; text-align: center; border-bottom: 2px solid #22c55e;">
                                        <h2 style="color: #166534; margin: 0; font-size: 22px; font-weight: 800;">Registration Successful!</h2>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 40px 40px 30px 40px;">
                                        <p style="color: ${darkColor}; font-size: 18px; font-weight: 600; margin-top: 0;">Hello ${fullName},</p>
                                        <p style="color: #475569; font-size: 16px; line-height: 1.8; margin-bottom: 25px;">
                                            Thank you for registering with <strong>Mehfil One</strong>. Your application has been successfully submitted and is currently <strong>under review</strong>.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        await sendEmail(email, subject, '', html);
        res.status(201).json({ msg: 'Vendor registered successfully', vendorId: vendor._id });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Login Vendor
exports.loginVendor = async (req, res) => {
    try {
        const { email, password } = req.body;
        const vendor = await Vendor.findOne({ email });
        if (!vendor) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }
        const isMatch = await bcrypt.compare(password, vendor.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }
        if (vendor.role === 'vendor' && vendor.status !== 'Active') {
            return res.status(403).json({ msg: 'Your account is currently pending administrative approval.' });
        }
        res.json({
            msg: 'Login successful',
            vendor: {
                id: vendor._id,
                name: vendor.fullName,
                email: vendor.email,
                phone: vendor.phone,
                role: vendor.role,
                plan: vendor.plan || 'Standard'
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Send OTP (Unified)
exports.sendOtp = async (req, res) => {
    try {
        const { email, phone } = req.body;

        // Check if user already exists in Vendor or User collection
        let existingVendor = await Vendor.findOne({ email });
        let existingUser = await User.findOne({ email });
        if (existingVendor || existingUser) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const phoneOtp = phone ? Math.floor(100000 + Math.random() * 900000).toString() : null;

        const newOtp = new Otp({ email, phone, emailOtp, phoneOtp });
        await newOtp.save();

        const subject = 'Mehfil One - Verify Your Identity';
        const themeColor = '#fac371';
        const darkColor = '#0f172a';
        const lightBg = '#f8fafc';

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${subject}</title>
            </head>
            <body style="background-color: ${lightBg}; font-family: sans-serif;">
                <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #eee;">
                    <div style="background: ${darkColor}; padding: 20px; text-align: center;">
                        <h1 style="color: ${themeColor}; margin: 0;">Mehfil One</h1>
                    </div>
                    <div style="padding: 40px; text-align: center;">
                        <h2>Your Verification Code</h2>
                        <div style="font-size: 36px; font-weight: bold; letter-spacing: 5px; padding: 20px; background: #f9f9f9; border: 2px dashed ${themeColor}; display: inline-block;">
                            ${emailOtp}
                        </div>
                        <p style="color: #666; margin-top: 20px;">Valid for 5 minutes.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const emailSent = await sendEmail(email, subject, '', html);
        let smsSent = false;
        if (phone && phoneOtp) {
            const smsMessage = `Your Mehfil One verification code is: ${phoneOtp}. Valid for 5 minutes.`;
            smsSent = await sendSms(phone, smsMessage);
        }

        // Check if at least one delivery method succeeded
        if (!emailSent && !smsSent) {
            return res.status(500).json({
                msg: 'Failed to deliver OTP via Email or SMS. Please check your contact details or try again later.',
                emailSent,
                smsSent
            });
        }

        res.json({
            msg: 'OTP sent successfully',
            emailSent,
            smsSent
        });
    } catch (err) {
        console.error('Error in sendOtp controller:', err);
        res.status(500).json({ msg: 'Server error while processing OTP request' });
    }
};

// Verify OTP (Unified)
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ msg: 'Invalid or Expired OTP' });
        }

        let isVerified = false;
        if (otpRecord.emailOtp === otp || (otpRecord.phoneOtp && otpRecord.phoneOtp === otp)) {
            isVerified = true;
        }

        if (!isVerified) {
            return res.status(400).json({ msg: 'Invalid OTP' });
        }

        res.json({ msg: 'OTP Verified Successfully', status: 'success' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Verification failed' });
    }
};

// Register User
exports.registerUser = async (req, res) => {
    try {
        const { fullName, email, phone, password, address, city } = req.body;

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            fullName,
            email,
            phone,
            password: hashedPassword,
            address,
            city,
            status: 'Active'
        });

        await user.save();
        res.status(201).json({ msg: 'User registered successfully', userId: user._id });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Registration failed' });
    }
};

// Login User
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }
        if (user.status !== 'Active') {
            return res.status(403).json({ msg: 'Your account is inactive.' });
        }
        res.json({
            msg: 'Login successful',
            user: {
                id: user._id,
                name: user.fullName,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Login failed' });
    }
};

// Granular OTP Routes (keeping for compatibility)
exports.sendEmailOtp = async (req, res) => {
    return exports.sendOtp(req, res);
};

exports.sendPhoneOtp = async (req, res) => {
    return exports.sendOtp(req, res);
};

exports.verifyEmailOtp = async (req, res) => {
    return exports.verifyOtp(req, res);
};

exports.verifyPhoneOtp = async (req, res) => {
    return exports.verifyOtp(req, res);
};
// Forgot Password - Send OTP
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        const vendor = await Vendor.findOne({ email });

        if (!user && !vendor) {
            return res.status(404).json({ msg: 'No account found with this email' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const newOtp = new Otp({ email, emailOtp: otp });
        await newOtp.save();

        const subject = 'Password Reset - Mehfil One';
        const html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
                <h2 style="color: #0f172a; text-align: center;">Reset Your Password</h2>
                <p>Hello,</p>
                <p>You requested to reset your password. Use the following verification code to proceed:</p>
                <div style="font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background: #f8fafc; border: 2px dashed #fac371; margin: 20px 0;">
                    ${otp}
                </div>
                <p style="color: #64748b; font-size: 14px;">This code is valid for 10 minutes. If you didn't request this, you can safely ignore this email.</p>
            </div>
        `;

        await sendEmail(email, subject, '', html);
        res.json({ msg: 'OTP sent to your email' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });
        if (!otpRecord || otpRecord.emailOtp !== otp) {
            return res.status(400).json({ msg: 'Invalid or Expired OTP' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const user = await User.findOneAndUpdate({ email }, { password: hashedPassword });
        const vendor = await Vendor.findOneAndUpdate({ email }, { password: hashedPassword });

        if (!user && !vendor) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json({ msg: 'Password reset successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
};
