const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const upload = require('../config/upload');

// Allow multiple event photos (up to 6) and 1 short video clip (max 35MB)
const reviewUpload = upload.fields([
    { name: 'photos', maxCount: 6 },
    { name: 'video', maxCount: 1 }
]);

router.post('/add', reviewUpload, reviewController.addReview);
router.get('/eligibility/:mahalId/:userId', reviewController.checkEligibility);
router.get('/:mahalId/media', reviewController.getMahalMedia);
router.post('/:reviewId/helpful', reviewController.voteHelpful);
router.get('/:mahalId', reviewController.getMahalReviews);

module.exports = router;
