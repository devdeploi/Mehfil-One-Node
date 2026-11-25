const express = require('express');
const router = express.Router();
const mahalController = require('../controllers/mahalController');
const upload = require('../config/upload'); // Import upload config

const uploadFields = upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
    { name: 'brochure', maxCount: 1 },
    { name: 'menuImages', maxCount: 10 },
    { name: 'decorationImages', maxCount: 20 },
    { name: 'panoramaImage', maxCount: 1 },
    { name: 'floorPlanImage', maxCount: 1 }
]);

router.get('/smart-match', mahalController.smartMatchMahals);
router.post('/smart-match/inquire', mahalController.broadcastSmartInquiry);
router.get('/resolve-streetview', mahalController.resolveStreetView);
router.get('/', mahalController.getAllMahals);
router.get('/:id', mahalController.getMahalById);
router.post('/', uploadFields, mahalController.createMahal);
router.put('/:id', uploadFields, mahalController.updateMahal);
router.delete('/:id', mahalController.deleteMahal);

module.exports = router;
