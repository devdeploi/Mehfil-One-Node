const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    mahalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mahal', required: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    date: { type: Date, required: true },
    shift: { type: String, enum: ['Morning', 'Evening', 'Full Day'], required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    paymentMode: { type: String, default: 'Offline - Cash' },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Partial'], default: 'Pending' },
    bookingStatus: { type: String, enum: ['Confirmed', 'Pending', 'Cancelled'], default: 'Confirmed' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
