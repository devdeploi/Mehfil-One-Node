const Booking = require('../models/Booking');
const Mahal = require('../models/Mahal');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const sendEmail = require('../utils/email');
const mongoose = require('mongoose');

// Get bookings
exports.getBookings = async (req, res) => {
    try {
        const { mahalId, date, month, year, vendorId, userId } = req.query;
        let query = {};

        if (mahalId) {
            query.mahalId = mahalId;
        } else if (userId) {
            query.userId = userId;
        } else if (vendorId) {
            // Support both direct vendorId (new schema) and mahalId lookup (old schema/backward compat)
            // Support both direct vendorId (new schema) and mahalId lookup (old schema/backward compat)

            // Ensure vendorId is an ObjectId
            const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

            const mahals = await Mahal.find({ vendorId: vendorObjectId }).select('_id');
            const mahalIds = mahals.map(m => m._id);


            // Query: Booking has this vendorId OR Booking belongs to one of the vendor's mahals
            query.$or = [
                { vendorId: vendorObjectId },
                { mahalId: { $in: mahalIds } }
            ];
        }


        // If specific date is requested
        if (date) {
            // Match exact date (assuming stored as ISODate at 00:00:00 or similar, or range for the day)
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            query.date = { $gte: startOfDay, $lte: endOfDay };
        } else if (month && year) {
            // Get bookings for the whole month
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
            query.date = { $gte: startOfMonth, $lte: endOfMonth };
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        let bookings;
        let total = 0;

        if (req.query.all === 'true') {
            bookings = await Booking.find(query)
                .populate('mahalId', 'mahalName mahalType coverImage')
                .sort({ date: -1 });
            total = bookings.length;
        } else {
            bookings = await Booking.find(query)
                .populate('mahalId', 'mahalName mahalType coverImage')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit);
            total = await Booking.countDocuments(query);
        }

        res.json({
            bookings,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalBookings: total
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Create Booking
// Create Booking
exports.createBooking = async (req, res) => {
    try {
        const { mahalId, date, shift } = req.body;

        // Fetch Mahal to get vendorId
        const mahal = await Mahal.findById(mahalId);
        if (!mahal) return res.status(404).json({ msg: 'Mahal not found for booking' });

        // Normalize Date (ensure it's saved as 00:00:00 UTC or local 00:00 consistent with query)
        // We'll trust the client sends YYYY-MM-DD or valid ISO. 
        // Let's force it to be a Date object at start of day to avoid time mismatches.
        const bookingDate = new Date(date);
        bookingDate.setHours(0, 0, 0, 0);

        // Check for overlaps
        const startOfDay = new Date(bookingDate);
        const endOfDay = new Date(bookingDate);
        endOfDay.setHours(23, 59, 59, 999);

        const existingBookings = await Booking.find({
            mahalId,
            date: { $gte: startOfDay, $lte: endOfDay },
            bookingStatus: { $ne: 'Cancelled' } // Don't count cancelled bookings
        });

        // Validation Logic
        const hasFullDay = existingBookings.some(b => b.shift === 'Full Day');
        const hasMorning = existingBookings.some(b => b.shift === 'Morning');
        const hasEvening = existingBookings.some(b => b.shift === 'Evening');

        if (shift === 'Full Day') {
            if (existingBookings.length > 0) {
                return res.status(400).json({ msg: 'Cannot book Full Day. Other bookings exist for this date.' });
            }
        } else if (shift === 'Morning') {
            if (hasFullDay) return res.status(400).json({ msg: 'Date is blocked by Full Day booking.' });
            if (hasMorning) return res.status(400).json({ msg: 'Morning slot is already booked.' });
        } else if (shift === 'Evening') {
            if (hasFullDay) return res.status(400).json({ msg: 'Date is blocked by Full Day booking.' });
            if (hasEvening) return res.status(400).json({ msg: 'Evening slot is already booked.' });
        }

        const newBooking = new Booking({
            ...req.body,
            date: bookingDate, // Save standardized date
            vendorId: mahal.vendorId // Associate with Vendor
        });

        const savedBooking = await newBooking.save();

        // Send Email Notification to Vendor for Online Bookings
        if (req.body.bookingType === 'Online') {
            try {
                // Get Vendor Email
                let vendorEmail = mahal.email;
                if (!vendorEmail) {
                    const vendor = await Vendor.findById(mahal.vendorId);
                    if (vendor) vendorEmail = vendor.email;
                }

                if (vendorEmail) {
                    const subject = `New Booking Request: ${mahal.mahalName}`;
                    const bookingDateStr = new Date(date).toLocaleDateString('en-IN', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    });

                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <h2 style="color: #c8102e; border-bottom: 2px solid #c8102e; padding-bottom: 10px;">New Booking Received</h2>
                            <p>Dear Vendor,</p>
                            <p>You have received a new online booking request for your venue <strong>${mahal.mahalName}</strong>.</p>
                            
                            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #333;">Booking Details:</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Customer Name:</strong></td>
                                        <td style="padding: 8px 0;">${req.body.customerName}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td>
                                        <td style="padding: 8px 0;">${bookingDateStr}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Shift:</strong></td>
                                        <td style="padding: 8px 0;">${shift}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Total Amount:</strong></td>
                                        <td style="padding: 8px 0;">₹${req.body.totalAmount.toLocaleString('en-IN')}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Advance Paid:</strong></td>
                                        <td style="padding: 8px 0; color: #28a745;">₹${req.body.advancePaid.toLocaleString('en-IN')}</td>
                                    </tr>
                                    ${req.body.transactionId ? `
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Transaction ID:</strong></td>
                                        <td style="padding: 8px 0; font-family: monospace;">${req.body.transactionId}</td>
                                    </tr>` : ''}
                                </table>
                            </div>

                            <p>Please log in to your dashboard to review this request and confirm the booking.</p>
                            
                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee; text-align: center;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/vendor/login" 
                                   style="background-color: #c8102e; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                                   View Dashboard
                                </a>
                            </div>
                            
                            <p style="font-size: 12px; color: #999; margin-top: 30px;">
                                This is an automated notification. Please do not reply directly to this email.
                            </p>
                        </div>
                    `;

                    await sendEmail(vendorEmail, subject, `New booking for ${mahal.mahalName} by ${req.body.customerName}`, htmlContent);
                }

                // --- 2. Send Confirmation Email to the User ---
                let userEmail = null;
                if (req.body.userId) {
                    const user = await User.findById(req.body.userId);
                    if (user) userEmail = user.email;
                }

                if (userEmail) {
                    const userSubject = `Booking Request Sent: ${mahal.mahalName}`;
                    const bookingDateStr = new Date(date).toLocaleDateString('en-IN', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    });

                    const userHtmlContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <h2 style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Booking Request Received</h2>
                            <p>Dear ${req.body.customerName},</p>
                            <p>Your booking request for <strong>${mahal.mahalName}</strong> has been successfully sent and is currently under review by the venue management.</p>
                            
                            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #333;">Summary of Request:</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Venue:</strong></td>
                                        <td style="padding: 8px 0;">${mahal.mahalName}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td>
                                        <td style="padding: 8px 0;">${bookingDateStr}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Shift:</strong></td>
                                        <td style="padding: 8px 0;">${shift}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Advance Paid:</strong></td>
                                        <td style="padding: 8px 0; color: #28a745; font-weight: bold;">₹${req.body.advancePaid.toLocaleString('en-IN')}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td>
                                        <td style="padding: 8px 0;"><span style="background-color: #fff3f4; color: #dc3545; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">PENDING REVIEW</span></td>
                                    </tr>
                                </table>
                            </div>

                            <p style="background-color: #fff3f4; padding: 12px; border-radius: 6px; border-left: 4px solid #dc3545; color: #333; font-size: 14px;">
                                <strong>Next Steps:</strong> The venue manager will review your request and the advance payment. You will receive a final confirmation email once it's verified.
                            </p>

                            <p>For any urgent queries, please contact the venue manager directly:</p>
                            <div style="margin: 15px 0; padding: 10px; border: 1px dashed #ccc; display: inline-block;">
                                <strong>Contact:</strong> ${mahal.mobile} ${mahal.altMobile ? ` / ${mahal.altMobile}` : ''}
                            </div>

                            <p style="font-size: 12px; color: #999; margin-top: 30px;">
                                Thank you for using our booking service!<br>
                                This is an automated notification. Please do not reply directly to this email.
                            </p>
                        </div>
                    `;

                    await sendEmail(userEmail, userSubject, `Your booking request for ${mahal.mahalName} has been sent.`, userHtmlContent);
                }
            } catch (emailError) {
                console.error("Error sending notification emails:", emailError);
            }
        }

        res.json(savedBooking);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
};

// Update Booking Status
exports.updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Fetch original booking to get customer details and mahal info
        const booking = await Booking.findById(id).populate('mahalId');
        if (!booking) return res.status(404).json({ msg: 'Booking not found' });

        const updatedBooking = await Booking.findByIdAndUpdate(id, updates, { new: true });

        // Check if status or payment changed
        const statusChanged = updates.bookingStatus && updates.bookingStatus !== booking.bookingStatus;
        const paymentChanged = updates.paymentStatus && updates.paymentStatus !== booking.paymentStatus;

        if (statusChanged || paymentChanged) {
            try {
                let userEmail = booking.customerEmail;
                let userName = booking.customerName;

                // If it's an online user booking
                if (!userEmail && booking.userId) {
                    const user = await User.findById(booking.userId);
                    if (user) {
                        userEmail = user.email;
                        userName = user.fullName;
                    }
                }

                if (userEmail) {
                    const mahalName = booking.mahalId?.mahalName || 'the venue';
                    const subject = `Booking Update: ${mahalName}`;
                    
                    let paymentStatusText = updatedBooking.paymentStatus;
                    let extraText = '';
                    
                    if (updatedBooking.paymentStatus === 'Pending') {
                        extraText = `<p style="color: #dc3545; font-weight: bold; margin-top: 15px;">Note: Your payment is pending. Please contact <strong>${mahalName}</strong> for further details.</p>`;
                    }

                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <h2 style="color: #c8102e; border-bottom: 2px solid #c8102e; padding-bottom: 10px;">Booking Status Updated</h2>
                            <p>Hi ${userName},</p>
                            <p>There has been an update to your booking at <strong>${mahalName}</strong>.</p>
                            
                            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Booking Status:</strong></td>
                                        <td style="padding: 8px 0;"><span style="background-color: ${updatedBooking.bookingStatus === 'Confirmed' ? '#eefcf1' : '#fff3f4'}; color: ${updatedBooking.bookingStatus === 'Confirmed' ? '#28a745' : '#dc3545'}; padding: 4px 10px; border-radius: 4px; font-weight: bold;">${updatedBooking.bookingStatus}</span></td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Payment Status:</strong></td>
                                        <td style="padding: 8px 0;"><span style="background-color: ${updatedBooking.paymentStatus === 'Paid' ? '#eefcf1' : '#fff3f4'}; color: ${updatedBooking.paymentStatus === 'Paid' ? '#28a745' : '#dc3545'}; padding: 4px 10px; border-radius: 4px; font-weight: bold;">${updatedBooking.paymentStatus}</span></td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;"><strong>Booking Date:</strong></td>
                                        <td style="padding: 8px 0;">${new Date(booking.date).toLocaleDateString('en-IN')}</td>
                                    </tr>
                                </table>
                                ${extraText}
                            </div>

                            <p>If you have any questions, please feel free to reach out to the venue management.</p>
                            
                            <p style="font-size: 12px; color: #999; margin-top: 30px;">
                                This is an automated notification. Please do not reply directly to this email.
                            </p>
                        </div>
                    `;

                    await sendEmail(userEmail, subject, `Your booking at ${mahalName} has been updated.`, htmlContent);
                }
            } catch (error) {
                console.error("Error sending user status update email:", error);
            }
        }

        res.json(updatedBooking);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Delete Booking
exports.deleteBooking = async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Booking removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
};
