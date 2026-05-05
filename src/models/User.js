const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    proofDocument: { type: String },
    profileImage: { type: String, default: null },
    role: { type: String, default: 'user' },
    status: { type: String, enum: ['Active', 'Inactive', 'Pending'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
