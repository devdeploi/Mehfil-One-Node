const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const upload = require('../config/upload');

router.get('/stats', adminController.getDashboardStats);
router.get('/payments', adminController.getPaymentsHistory);
router.get('/hero-settings', adminController.getHeroSettings);
router.post('/hero-settings', upload.fields([
    { name: 'mainArchImage', maxCount: 1 },
    { name: 'horizontalImage', maxCount: 1 },
    { name: 'verticalImage', maxCount: 1 },
    { name: 'circularImage', maxCount: 1 }
]), adminController.updateHeroSettings);

module.exports = router;
