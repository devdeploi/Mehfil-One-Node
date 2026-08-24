const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const SuperAdmin = require('../models/SuperAdmin');

// Load env vars
dotenv.config({ path: './.env' }); // Adjust path if running from root

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        const email = 'info@safprotech.com';
        const password = 'safeer@123';

        // Check if exists and remove
        await SuperAdmin.findOneAndDelete({ email });
        console.log('Existing admin removed (if any).');

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const admin = new SuperAdmin({
            fullName: 'Anaikar Safeer',
            email,
            phone: '9789621043',
            password: hashedPassword,
            role: 'superadmin'
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
