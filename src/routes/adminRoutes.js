const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/stats', adminController.getDashboardStats);
router.get('/payments', adminController.getPaymentsHistory);
router.get('/hero-settings', adminController.getHeroSettings);
router.post('/hero-settings', adminController.updateHeroSettings);

module.exports = router;
