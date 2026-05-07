const Review = require('../models/Review');

exports.addReview = async (req, res) => {
    try {
        const { mahalId, userId, userName, rating, comment } = req.body;
        
        const newReview = new Review({
            mahalId,
            userId,
            userName,
            rating,
            comment
        });

        await newReview.save();
        res.status(201).json({ msg: 'Review added successfully', review: newReview });
    } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ msg: 'Server error while adding review' });
    }
};

exports.getMahalReviews = async (req, res) => {
    try {
        const { mahalId } = req.params;
        const reviews = await Review.find({ mahalId }).sort({ createdAt: -1 });
        res.status(200).json({ reviews });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ msg: 'Server error while fetching reviews' });
    }
};
