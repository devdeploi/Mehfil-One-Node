const mongoose = require('mongoose');

const superAdminSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'superadmin' }
}, { timestamps: true });

module.exports = mongoose.model('SuperAdmin', superAdminSchema);
