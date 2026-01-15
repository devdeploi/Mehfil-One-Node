const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/mahals', require('./mahalRoutes'));
router.use('/bookings', require('./bookingRoutes'));
router.use('/vendors', require('./vendorRoutes'));
router.use('/payment', require('./paymentRoutes'));

module.exports = router;
