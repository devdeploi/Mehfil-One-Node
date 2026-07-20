const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const vendorController = require('../controllers/vendorController');

const multer = require('multer');

router.get('/', vendorController.getAllVendors);
router.get('/:id', vendorController.getVendorById);
router.put('/:id', (req, res, next) => {
    upload.single('profileImage')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ msg: 'File too large. Max limit is 10MB.' });
            }
            return res.status(400).json({ msg: err.message });
        } else if (err) {
            return res.status(400).json({ msg: err.message });
        }
        next();
    });
}, vendorController.updateVendor);
router.put('/:id/status', vendorController.updateVendorStatus);
router.put('/:id/upgrade', vendorController.upgradeVendorPlan);
router.put('/:id/downgrade', vendorController.downgradeVendorPlan);
router.put('/:id/renew', vendorController.renewVendorPlan);
router.delete('/:id', vendorController.deleteVendor);

module.exports = router;
