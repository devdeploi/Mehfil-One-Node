const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

exports.getDashboardStats = async (req, res) => {
    try {
        const totalVendors = await Vendor.countDocuments({ role: 'vendor' });
        const activeVendors = await Vendor.countDocuments({ role: 'vendor', status: 'Active' });
        const totalUsers = await User.countDocuments({});
        
        const recentVendors = await Vendor.find({ role: 'vendor' })
            .sort({ createdAt: -1 })
            .limit(5);

        // Revenue Calculations
        const currentDate = new Date();
        const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const lastMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0, 23, 59, 59);

        const currentMonthPayments = await Payment.find({ status: 'Completed', createdAt: { $gte: currentMonthStart } });
        const currentMonthRevenue = currentMonthPayments.reduce((acc, curr) => acc + curr.amount, 0);

        const lastMonthPayments = await Payment.find({ status: 'Completed', createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } });
        const lastMonthRevenue = lastMonthPayments.reduce((acc, curr) => acc + curr.amount, 0);

        let revenueGrowth = 0;
        if (lastMonthRevenue > 0) {
            revenueGrowth = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
        } else if (currentMonthRevenue > 0) {
            revenueGrowth = 100;
        }

        // Pending Actions
        const pendingVendors = await Vendor.countDocuments({ role: 'vendor', status: 'Pending' });

        const thirtyDaysAgo = new Date(currentDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const twentyThreeDaysAgo = new Date(currentDate);
        twentyThreeDaysAgo.setDate(twentyThreeDaysAgo.getDate() - 23);
        const planRenewals = await Payment.countDocuments({
            status: 'Completed',
            createdAt: { $gte: thirtyDaysAgo, $lte: twentyThreeDaysAgo }
        });

        const pendingBookings = await Booking.countDocuments({ bookingStatus: 'Pending' });

        res.status(200).json({
            totalVendors,
            activeVendors,
            totalUsers,
            activePlans: activeVendors,
            currentMonthRevenue,
            lastMonthRevenue,
            revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
            pendingVendors,
            planRenewals,
            pendingBookings,
            recentVendors
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.getPaymentsHistory = async (req, res) => {
    try {
        // Fetch subscription payments (payments by vendors to the platform)
        const subscriptions = await Payment.find({})
            .populate('vendorId', 'fullName email phone businessName')
            .sort({ createdAt: -1 });

        // Fetch booking payments (payments by users/customers to the vendors)
        const bookings = await Booking.find({})
            .populate('vendorId', 'fullName email phone businessName')
            .populate('mahalId', 'mahalName coverImage')
            .sort({ createdAt: -1 });

        res.status(200).json({
            subscriptions,
            bookings
        });
    } catch (error) {
        console.error('Error fetching payments history:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

