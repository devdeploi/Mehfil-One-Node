const Vendor = require('../models/Vendor');
const User = require('../models/User');

exports.getDashboardStats = async (req, res) => {
    try {
        const totalVendors = await Vendor.countDocuments({ role: 'vendor' });
        const activeVendors = await Vendor.countDocuments({ role: 'vendor', status: 'Active' });
        const totalUsers = await User.countDocuments({});
        
        const recentVendors = await Vendor.find({ role: 'vendor' })
            .sort({ createdAt: -1 })
            .limit(5);

        res.status(200).json({
            totalVendors,
            activeVendors,
            totalUsers,
            recentVendors
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
