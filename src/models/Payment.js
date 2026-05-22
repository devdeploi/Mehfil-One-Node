const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    plan: { type: String, required: true },
    status: { type: String, enum: ['Completed', 'Failed', 'Pending'], default: 'Completed' },
    method: { type: String, default: 'Razorpay' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
