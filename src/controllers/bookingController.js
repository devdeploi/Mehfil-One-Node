const Booking = require('../models/Booking');
const Mahal = require('../models/Mahal');
const mongoose = require('mongoose');

// Get bookings
exports.getBookings = async (req, res) => {
    try {
        const { mahalId, date, month, year, vendorId } = req.query;
        let query = {};

        if (mahalId) {
            query.mahalId = mahalId;
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

        // For calendar view, we might want *all* bookings for the mahal if pagination isn't strict, 
        // but let's keep pagination support if needed, or allow 'all'

        let bookings;
        if (req.query.all === 'true') {
            bookings = await Booking.find(query).sort({ date: 1 });
        } else {
            bookings = await Booking.find(query).sort({ date: 1 }); // Just return all for now to simplify calendar population
        }

        // Transform or just return
        res.json({ bookings });
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
        res.json(savedBooking);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
};

// Update Booking Status
exports.updateBooking = async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(booking);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
};
