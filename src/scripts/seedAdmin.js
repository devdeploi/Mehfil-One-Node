const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Vendor = require('../models/Vendor');

// Load env vars
dotenv.config({ path: './.env' }); // Adjust path if running from root

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        const email = 'ubaiseibrahim7@gmail.com';
        const password = 'Ubaise@eache17';

        // Check if exists and remove
        await Vendor.findOneAndDelete({ email });
        console.log('Existing admin removed (if any).');

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const admin = new Vendor({
            fullName: 'Super Admin',
            email,
            phone: '9790494861',
            password: hashedPassword,
            password: hashedPassword,
            role: 'superadmin',
            planId: 2 // Premium/Standard
        });

        await admin.save();
        console.log('Super Admin Seeded Successfully');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedAdmin();
