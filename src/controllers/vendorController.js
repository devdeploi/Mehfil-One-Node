const Vendor = require('../models/Vendor');
const fs = require('fs');
const path = require('path');

// Get all vendors
exports.getAllVendors = async (req, res) => {
    try {
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Exclude password. Include docs where role is 'vendor' or missing.
        const query = { $or: [{ role: 'vendor' }, { role: { $exists: false } }] };

        const vendors = await Vendor.find(query)
            .select('-password')
            .skip(skip)
            .limit(limit);

        const total = await Vendor.countDocuments(query);

        res.json({
            vendors,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalVendors: total
        });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Get Single Vendor by ID
exports.getVendorById = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id).select('-password');
        if (!vendor) return res.status(404).json({ msg: 'Vendor not found' });
        res.json(vendor);
    } catch (err) {
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Vendor not found' });
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Update vendor details
exports.updateVendor = async (req, res) => {
    try {
        const { fullName, phone, email } = req.body;
        let profileImage = req.body.profileImage; // Keep existing if no new file

        if (req.file) {
            // Find the vendor to get the old image path
            const currentVendor = await Vendor.findById(req.params.id);
            if (currentVendor && currentVendor.profileImage) {
                const oldImagePath = path.join(__dirname, '../../', currentVendor.profileImage);
                // Check if file exists and delete it
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            // Normalize path to forward slashes for URL usage
            profileImage = req.file.path.replace(/\\/g, '/');
        }

        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id,
            { fullName, phone, email, profileImage },
            { new: true }
        ).select('-password');
        res.json(vendor);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
};

const sendEmail = require('../utils/email');

// Update vendor status
exports.updateVendorStatus = async (req, res) => {
    try {
        const { status } = req.body; // Expect { status: 'Active' | 'Inactive' | 'Pending' }
        const vendor = await Vendor.findByIdAndUpdate(req.params.id, { status }, { new: true });

        if (vendor) {
            let subject = '';
            let message = '';
            let color = '';
            let btnText = '';
            let btnLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/Superadmin/login`;

            if (status === 'Active') {
                subject = 'Account Approved - Welcome to Mehfil One!';
                message = 'Congratulations! Your vendor profile has been approved. You can now login to your dashboard and start listing your venues.';
                color = '#16a34a'; // Green
                btnText = 'Login to Dashboard';
            } else if (status === 'Pending') {
                subject = 'Account Status Update - Mehfil One';
                message = 'Your account status has been set to Pending. Our team is reviewing your details. We will notify you once the review is complete.';
                color = '#d97706'; // Amber
                btnText = 'Check Status';
            } else if (status === 'Inactive') {
                subject = 'Important Account Update - Mehfil One';
                message = 'We regret to inform you that your vendor profile has been deactivated or declined following our internal review. <br><br><strong>Refund Notice:</strong> The registration fee has been fully refunded and will be credited to your original payment method within <strong>24 hours</strong>.';
                color = '#dc2626'; // Red
                btnText = 'Contact Support';
                btnLink = 'mailto:support@mehfilone.com';
            }

            if (subject) {
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
                                                <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px; letter-spacing: 0.5px;">VENDOR PARTNER PROGRAM</p>
                                            </td>
                                        </tr>
                                        
                                        <!-- Status Banner -->
                                        <tr>
                                            <td style="background-color: ${color}10; padding: 25px; text-align: center; border-bottom: 2px solid ${color};">
                                                <div style="display: inline-block; padding: 8px 16px; border-radius: 50px; background-color: ${color}; color: #ffffff; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 6px -1px ${color}50;">
                                                    ${status === 'Active' ? 'Account Verified' : status === 'Inactive' ? 'Status Update' : 'Under Review'}
                                                </div>
                                                ${status === 'Active' ? '<div style="margin-top: 15px; font-size: 48px;">🎉</div>' : ''}
                                            </td>
                                        </tr>

                                        <!-- Content -->
                                        <tr>
                                            <td style="padding: 40px 40px 30px 40px;">
                                                <h2 style="color: ${darkColor}; margin-top: 0; font-size: 24px; font-weight: 700;">Hello ${vendor.fullName},</h2>
                                                <p style="color: #475569; font-size: 16px; line-height: 1.8; margin-bottom: 25px;">
                                                    ${message}
                                                </p>
                                                
                                                <!-- Call to Action -->
                                                <div style="text-align: center; margin: 40px 0;">
                                                    <a href="${btnLink}" style="background-color: ${themeColor}; color: ${darkColor}; display: inline-block; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(250, 195, 113, 0.4); text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.3s ease;">
                                                        ${btnText}
                                                    </a>
                                                </div>
                                                
                                                <div style="background-color: #f8fafc; border-left: 4px solid ${themeColor}; padding: 15px 20px; border-radius: 4px; margin-top: 30px;">
                                                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">
                                                        <strong>Need assistance?</strong><br>
                                                        Our support team is always here to help. Reach us at <a href="mailto:support@mehfilone.com" style="color: ${themeColor}; text-decoration: none; font-weight: 600;">support@mehfilone.com</a>.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>

                                        <!-- Footer -->
                                        <tr>
                                            <td style="background-color: ${darkColor}; padding: 30px; text-align: center;">
                                                <p style="color: ${themeColor}; font-weight: 700; margin: 0 0 10px 0; font-size: 18px;">Mehfil One</p>
                                                <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.5;">
                                                    &copy; ${new Date().getFullYear()} Mehfil One. All rights reserved.<br>
                                                    You are receiving this email because you are a registered vendor.
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

                await sendEmail(vendor.email, subject, message, html);
            }
        }

        res.json(vendor);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Delete vendor
exports.deleteVendor = async (req, res) => {
    try {
        await Vendor.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Vendor removed' });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
};
