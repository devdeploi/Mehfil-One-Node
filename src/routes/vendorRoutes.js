const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const vendorController = require('../controllers/vendorController');

router.get('/', vendorController.getAllVendors);
router.get('/:id', vendorController.getVendorById);
router.put('/:id', upload.single('profileImage'), vendorController.updateVendor);
router.put('/:id/status', vendorController.updateVendorStatus);
router.delete('/:id', vendorController.deleteVendor);

module.exports = router;
