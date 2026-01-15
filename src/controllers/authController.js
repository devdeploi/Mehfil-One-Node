const Vendor = require('../models/Vendor');
const bcrypt = require('bcryptjs');

// Register
exports.registerVendor = async (req, res) => {
    try {
        const { fullName, email, phone, password, plan, businessName, gstNumber, businessAddress } = req.body;
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
            proofDocument
        });

        await vendor.save();

        // Send Registration Success Email
        const subject = 'Registration Successful - Mehfil One';

        // Application Theme Colors
        const themeColor = '#fac371'; // Gold
        const darkColor = '#0f172a';  // Slate 900
        const lightBg = '#f8fafc';    // Slate 50

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
                                
                                <!-- Header -->
                                <tr>
                                    <td style="background-color: ${darkColor}; padding: 35px 30px; text-align: center;">
                                        <h1 style="color: ${themeColor}; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">Mehfil One</h1>
                                        <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px; letter-spacing: 0.5px;">WELCOME TO MEHFIL ONE</p>
                                    </td>
                                </tr>
                                
                                <!-- Success Banner -->
                                <tr>
                                    <td style="background-color: #f0fdf4; padding: 30px; text-align: center; border-bottom: 2px solid #22c55e;">
                                        <div style="width: 60px; height: 60px; background-color: #22c55e; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px; box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.4);">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                        <h2 style="color: #166534; margin: 0; font-size: 22px; font-weight: 800;">Registration Successful!</h2>
                                    </td>
                                </tr>

                                <!-- Content -->
                                <tr>
                                    <td style="padding: 40px 40px 30px 40px;">
                                        <p style="color: ${darkColor}; font-size: 18px; font-weight: 600; margin-top: 0;">Hello ${fullName},</p>
                                        <p style="color: #475569; font-size: 16px; line-height: 1.8; margin-bottom: 25px;">
                                            Thank you for registering with <strong>Mehfil One</strong>. Your application has been successfully submitted and is currently <strong>under review</strong> by our administration team.
                                        </p>
                                        
                                        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                                            <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">What Happens Next?</h3>
                                            <p style="color: #b45309; font-size: 14px; line-height: 1.6; margin: 0;">
                                                Our team will verify your business details and proof documents. You will be notified via email once your account is verified and activated. This process usually takes 24-48 hours.
                                            </p>
                                        </div>

                                        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 0;">
                                            In the meantime, if you have any urgent queries, please feel free to reach out to our support team.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: ${darkColor}; padding: 30px; text-align: center;">
                                        <p style="color: ${themeColor}; font-weight: 700; margin: 0 0 10px 0; font-size: 18px;">Mehfil One</p>
                                        <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.5;">
                                            &copy; ${new Date().getFullYear()} Mehfil One. All rights reserved.<br>
                                            Vendor Registration System
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

// Login
exports.loginVendor = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check user
        const vendor = await Vendor.findOne({ email });
        if (!vendor) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, vendor.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        if (vendor.role === 'vendor' && vendor.status !== 'Active') {
            return res.status(403).json({ msg: 'Your account is currently pending administrative approval. Please wait for activation.' });
        }

        res.json({
            msg: 'Login successful',
            vendor: {
                id: vendor._id,
                name: vendor.fullName,
                email: vendor.email,
                role: vendor.role,
                plan: vendor.plan || 'Standard'
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

const Otp = require('../models/Otp');
const sendEmail = require('../utils/email');

// Send OTP
exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if vendor already exists
        let vendor = await Vendor.findOne({ email });
        if (vendor) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to DB
        const newOtp = new Otp({ email, otp });
        await newOtp.save();

        // Send Email
        const subject = 'Mehfil One - Verify Your Email';

        // Application Theme Colors
        const themeColor = '#fac371'; // Gold
        const darkColor = '#0f172a';  // Slate 900
        const lightBg = '#f8fafc';    // Slate 50

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
                                
                                <!-- Header -->
                                <tr>
                                    <td style="background-color: ${darkColor}; padding: 35px 30px; text-align: center;">
                                        <h1 style="color: ${themeColor}; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">Mehfil One</h1>
                                        <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px; letter-spacing: 0.5px;">EMAIL VERIFICATION</p>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding: 40px 40px 30px 40px; text-align: center;">
                                        <div style="margin-bottom: 30px;">
                                            <div style="display: inline-block; padding: 16px; background-color: #f0fdf4; border-radius: 50%; color: #16a34a; margin-bottom: 20px;">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                                            </div>
                                            <h2 style="color: ${darkColor}; margin: 0 0 10px 0; font-size: 24px; font-weight: 700;">Verify Your Email Address</h2>
                                            <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0;">
                                                Use the code below to complete your registration process.
                                            </p>
                                        </div>

                                        <!-- OTP Box -->
                                        <div style="background-color: #f8fafc; border: 2px dashed ${themeColor}; border-radius: 12px; padding: 30px; margin: 0 auto 30px auto; max-width: 300px;">
                                            <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; color: ${darkColor}; letter-spacing: 8px; display: block;">${otp}</span>
                                            <p style="margin: 10px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">VALID FOR 5 MINUTES</p>
                                        </div>
                                        
                                        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
                                            If you didn't request this verification code, please ignore this email.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: ${darkColor}; padding: 30px; text-align: center;">
                                        <p style="color: ${themeColor}; font-weight: 700; margin: 0 0 10px 0; font-size: 18px;">Mehfil One</p>
                                        <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.5;">
                                            &copy; ${new Date().getFullYear()} Mehfil One. All rights reserved.<br>
                                            Secure Verification System
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

        const emailSent = await sendEmail(email, subject, '', html);

        if (!emailSent) {
            return res.status(500).json({ msg: 'Failed to send OTP email' });
        }

        res.json({ msg: 'OTP sent successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const otpRecord = await Otp.findOne({ email, otp });

        if (!otpRecord) {
            return res.status(400).json({ msg: 'Invalid or Expired OTP' });
        }

        res.json({ msg: 'OTP Verified Successfully', status: 'success' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
