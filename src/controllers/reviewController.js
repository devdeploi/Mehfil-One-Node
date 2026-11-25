const Review = require('../models/Review');
const Booking = require('../models/Booking');

exports.addReview = async (req, res) => {
    try {
        const { mahalId, userId, userName, rating, comment } = req.body;

        // Parse aspects if passed as string via FormData
        let parsedAspects = req.body.aspects;
        if (typeof parsedAspects === 'string') {
            try {
                parsedAspects = JSON.parse(parsedAspects);
            } catch (e) {
                parsedAspects = null;
            }
        }

        // Compute or validate 5-aspect ratings
        let safeAspects = {
            ambience: 5,
            foodQuality: 5,
            cleanliness: 5,
            staffBehavior: 5,
            valueForMoney: 5
        };

        if (parsedAspects && typeof parsedAspects === 'object') {
            safeAspects = {
                ambience: Math.min(5, Math.max(1, Number(parsedAspects.ambience) || 5)),
                foodQuality: Math.min(5, Math.max(1, Number(parsedAspects.foodQuality) || 5)),
                cleanliness: Math.min(5, Math.max(1, Number(parsedAspects.cleanliness) || 5)),
                staffBehavior: Math.min(5, Math.max(1, Number(parsedAspects.staffBehavior) || 5)),
                valueForMoney: Math.min(5, Math.max(1, Number(parsedAspects.valueForMoney) || 5))
            };
        } else if (rating) {
            const r = Math.min(5, Math.max(1, Number(rating)));
            safeAspects = {
                ambience: r,
                foodQuality: r,
                cleanliness: r,
                staffBehavior: r,
                valueForMoney: r
            };
        }

        // Computed overall rating (mean of 5 aspects)
        const computedRating = Number((
            (safeAspects.ambience + safeAspects.foodQuality + safeAspects.cleanliness + safeAspects.staffBehavior + safeAspects.valueForMoney) / 5
        ).toFixed(1));

        // Automatic Booking Verification
        let isVerifiedBooking = false;
        let bookingId = null;
        let eventDate = null;
        let eventType = req.body.eventType || 'Wedding / Reception';

        if (userId && mahalId) {
            const verifiedBooking = await Booking.findOne({
                mahalId,
                userId,
                bookingStatus: 'Confirmed'
            }).sort({ date: -1 });

            if (verifiedBooking) {
                isVerifiedBooking = true;
                bookingId = verifiedBooking._id;
                eventDate = verifiedBooking.date;
                if (verifiedBooking.packageBooked?.packageName) {
                    eventType = verifiedBooking.packageBooked.packageName;
                } else if (verifiedBooking.shift) {
                    eventType = `${verifiedBooking.shift} Celebration`;
                }
            }
        }

        // Extract Customer Uploaded Photos & Video
        let uploadedPhotos = [];
        if (req.files && req.files.photos && req.files.photos.length > 0) {
            uploadedPhotos = req.files.photos.map(file => ({
                url: file.path.replace(/\\/g, '/'),
                caption: ''
            }));
        }

        let uploadedVideos = [];
        if (req.files && req.files.video && req.files.video.length > 0) {
            uploadedVideos = req.files.video.map(file => ({
                url: file.path.replace(/\\/g, '/'),
                thumbnail: '',
                duration: 0
            }));
        }

        const newReview = new Review({
            mahalId,
            userId,
            userName,
            rating: computedRating,
            aspects: safeAspects,
            comment,
            bookingId,
            isVerifiedBooking,
            eventDate,
            eventType,
            photos: uploadedPhotos,
            videos: uploadedVideos
        });

        await newReview.save();
        res.status(201).json({ 
            msg: 'Review added successfully', 
            review: newReview,
            isVerified: isVerifiedBooking 
        });
    } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ msg: 'Server error while adding review' });
    }
};

exports.checkEligibility = async (req, res) => {
    try {
        const { mahalId, userId } = req.params;
        if (!userId || !mahalId) {
            return res.status(400).json({ isVerified: false, msg: 'Missing parameters' });
        }

        const booking = await Booking.findOne({
            mahalId,
            userId,
            bookingStatus: 'Confirmed'
        }).sort({ date: -1 });

        if (booking) {
            return res.status(200).json({
                isVerified: true,
                booking: {
                    _id: booking._id,
                    date: booking.date,
                    shift: booking.shift,
                    customerName: booking.customerName,
                    eventType: booking.packageBooked?.packageName || `${booking.shift} Celebration`
                }
            });
        }

        return res.status(200).json({ isVerified: false });
    } catch (error) {
        console.error("Error checking review eligibility:", error);
        res.status(500).json({ isVerified: false, error: error.message });
    }
};

exports.getMahalMedia = async (req, res) => {
    try {
        const { mahalId } = req.params;
        const reviews = await Review.find({
            mahalId,
            $or: [
                { 'photos.0': { $exists: true } },
                { 'videos.0': { $exists: true } }
            ]
        }).sort({ createdAt: -1 });

        let mediaList = [];
        reviews.forEach(rev => {
            (rev.photos || []).forEach((photo, idx) => {
                mediaList.push({
                    id: `${rev._id}-p-${idx}`,
                    type: 'photo',
                    url: photo.url,
                    caption: photo.caption || '',
                    reviewId: rev._id,
                    userName: rev.userName,
                    rating: rev.rating,
                    isVerifiedBooking: rev.isVerifiedBooking,
                    eventType: rev.eventType,
                    createdAt: rev.createdAt
                });
            });
            (rev.videos || []).forEach((vid, idx) => {
                mediaList.push({
                    id: `${rev._id}-v-${idx}`,
                    type: 'video',
                    url: vid.url,
                    thumbnail: vid.thumbnail || '',
                    duration: vid.duration || 0,
                    reviewId: rev._id,
                    userName: rev.userName,
                    rating: rev.rating,
                    isVerifiedBooking: rev.isVerifiedBooking,
                    eventType: rev.eventType,
                    createdAt: rev.createdAt
                });
            });
        });

        res.status(200).json({
            media: mediaList,
            totalPhotos: mediaList.filter(m => m.type === 'photo').length,
            totalVideos: mediaList.filter(m => m.type === 'video').length
        });
    } catch (error) {
        console.error("Error fetching mahal customer media:", error);
        res.status(500).json({ msg: 'Server error while fetching customer media' });
    }
};

exports.voteHelpful = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ msg: 'User ID is required' });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ msg: 'Review not found' });
        }

        if (!review.helpfulVotes) {
            review.helpfulVotes = [];
        }

        const existingIdx = review.helpfulVotes.findIndex(id => id.toString() === userId.toString());
        let hasVoted = false;

        if (existingIdx > -1) {
            // Unvote
            review.helpfulVotes.splice(existingIdx, 1);
            hasVoted = false;
        } else {
            // Vote
            review.helpfulVotes.push(userId);
            hasVoted = true;
        }

        review.helpfulCount = review.helpfulVotes.length;
        await review.save();

        res.status(200).json({
            msg: hasVoted ? 'Marked as helpful' : 'Helpful vote removed',
            helpfulCount: review.helpfulCount,
            hasVoted
        });
    } catch (error) {
        console.error("Error voting helpful:", error);
        res.status(500).json({ msg: 'Server error voting helpful' });
    }
};

exports.getMahalReviews = async (req, res) => {
    try {
        const { mahalId } = req.params;
        const reviews = await Review.find({ mahalId }).sort({ createdAt: -1 });

        // Calculate aspect breakdown averages & overall statistics
        let summary = {
            totalReviews: reviews.length,
            overallRating: 0,
            verifiedCount: 0,
            mediaCount: 0,
            aspectAverages: {
                ambience: 0,
                foodQuality: 0,
                cleanliness: 0,
                staffBehavior: 0,
                valueForMoney: 0
            }
        };

        if (reviews.length > 0) {
            let totalRating = 0;
            let totalAmbience = 0;
            let totalFood = 0;
            let totalCleanliness = 0;
            let totalStaff = 0;
            let totalValue = 0;
            let verifiedCount = 0;
            let mediaCount = 0;

            reviews.forEach(rev => {
                const r = rev.rating || 5;
                totalRating += r;
                const asp = rev.aspects || {};
                totalAmbience += Number(asp.ambience || r);
                totalFood += Number(asp.foodQuality || r);
                totalCleanliness += Number(asp.cleanliness || r);
                totalStaff += Number(asp.staffBehavior || r);
                totalValue += Number(asp.valueForMoney || r);
                if (rev.isVerifiedBooking) verifiedCount++;
                if ((rev.photos && rev.photos.length > 0) || (rev.videos && rev.videos.length > 0)) {
                    mediaCount++;
                }
            });

            const count = reviews.length;
            summary.overallRating = Number((totalRating / count).toFixed(1));
            summary.verifiedCount = verifiedCount;
            summary.mediaCount = mediaCount;
            summary.aspectAverages = {
                ambience: Number((totalAmbience / count).toFixed(1)),
                foodQuality: Number((totalFood / count).toFixed(1)),
                cleanliness: Number((totalCleanliness / count).toFixed(1)),
                staffBehavior: Number((totalStaff / count).toFixed(1)),
                valueForMoney: Number((totalValue / count).toFixed(1))
            };
        }

        res.status(200).json({ reviews, summary });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ msg: 'Server error while fetching reviews' });
    }
};