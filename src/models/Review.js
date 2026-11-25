const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    mahalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mahal', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    aspects: {
        ambience: { type: Number, min: 1, max: 5, default: 5 },
        foodQuality: { type: Number, min: 1, max: 5, default: 5 },
        cleanliness: { type: Number, min: 1, max: 5, default: 5 },
        staffBehavior: { type: Number, min: 1, max: 5, default: 5 },
        valueForMoney: { type: Number, min: 1, max: 5, default: 5 }
    },
    comment: { type: String, required: true },
    
    // Verified Customer Booking Verification
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    isVerifiedBooking: { type: Boolean, default: false },
    eventDate: { type: Date },
    eventType: { type: String, default: 'Wedding / Reception' },

    // Customer Event Photo & Video Uploads
    photos: [{
        url: { type: String, required: true },
        caption: { type: String, default: '' }
    }],
    videos: [{
        url: { type: String, required: true },
        thumbnail: { type: String, default: '' },
        duration: { type: Number }
    }],

    // Community Feedback & Moderation
    helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    helpfulCount: { type: Number, default: 0 },
    vendorReply: {
        comment: { type: String },
        repliedAt: { type: Date }
    },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);
