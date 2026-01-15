const express = require('express');
const router = express.Router();
const mahalController = require('../controllers/mahalController');
const upload = require('../config/upload'); // Import upload config

const uploadFields = upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
    { name: 'brochure', maxCount: 1 },
    { name: 'menuImages', maxCount: 10 },
    { name: 'decorationImages', maxCount: 20 } // Supporting multiple decoration items
]);

router.get('/', mahalController.getAllMahals);
router.post('/', uploadFields, mahalController.createMahal);
router.put('/:id', uploadFields, mahalController.updateMahal);
router.delete('/:id', mahalController.deleteMahal);

module.exports = router;
