const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['vendor', 'superadmin'], default: 'vendor' },
    status: { type: String, enum: ['Active', 'Inactive', 'Pending'], default: 'Active' },
    profileImage: { type: String, default: null },
    plan: { type: String, default: 'Standard' },
    businessName: { type: String },
    gstNumber: { type: String },
    businessAddress: { type: String },
    proofDocument: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vendor', vendorSchema);