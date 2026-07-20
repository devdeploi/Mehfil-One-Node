const Razorpay = require('razorpay');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

// Safely sanitize keys to prevent hidden newlines or spaces causing Axios header crashes
const safeKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
const safeKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

const razorpay = new Razorpay({
    key_id: safeKeyId || 'rzp_test_invalid_key',
    key_secret: safeKeySecret || 'invalid_secret'
});

// @desc    Create Razorpay Order
// @route   POST /api/payment/create-order
// @access  Public (or Protected based on need)
const createOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt } = req.body;

        const parsedAmount = parseInt(amount, 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: 'Invalid payment amount provided' });
        }

        const options = {
            amount: parsedAmount * 100, // Amount in paise
            currency,
            receipt
        };

        console.log("Razorpay Order Options:", options);

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        
        // Handle Razorpay specific error object format
        let errorDescription = 'Unknown error';
        if (error && error.error) {
            errorDescription = error.error.description || error.error.message;
        } else if (error && error.description) {
            errorDescription = error.description;
        } else if (error && error.message) {
            errorDescription = error.message;
        }
        
        res.status(500).json({ 
            message: 'Something went wrong while creating payment order', 
            error: errorDescription 
        });
    }
};

// @desc    Verify Payment
// @route   POST /api/payment/verify
// @access  Public
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'invalid_secret')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            res.status(200).json({ status: 'success', message: 'Payment verified successfully' });
        } else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ 
            message: 'Internal Server Error during verification', 
            error: error.message || 'Unknown error'
        });
    }
};

// @desc    Get Razorpay Key
// @route   GET /api/payment/key
// @access  Public
const getRazorpayKey = (req, res) => {
    res.json({ key: process.env.RAZORPAY_KEY_ID || 'rzp_test_invalid_key' });
};

module.exports = {
    createOrder,
    verifyPayment,
    getRazorpayKey
};
