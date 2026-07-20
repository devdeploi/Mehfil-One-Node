const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getRazorpayKey } = require('../controllers/paymentController');

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.get('/key', getRazorpayKey);

module.exports = router;
