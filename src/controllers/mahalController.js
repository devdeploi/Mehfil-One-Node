const Review = require('../models/Review');
const Mahal = require('../models/Mahal');
const Vendor = require('../models/Vendor');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Message = require('../models/Message');
const sendEmail = require('../utils/email');
const sendSms = require('../utils/sms');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Helper to delete file
const deleteFile = (filePath) => {
    if (!filePath) return;
    const fullPath = path.join(__dirname, '../../', filePath);
    fs.unlink(fullPath, (err) => {
        if (err && err.code !== 'ENOENT') console.error(`Error deleting file: ${filePath}`, err);
    });
};

// Helper to normalize file paths for DB storage
const normalizePath = (pathStr) => {
    return pathStr.replace(/\\/g, '/');
};

// Helper to safely parse JSON from req.body (handling potential array duplicates from multipart form)
const parseMultipartJson = (val, fallback = null) => {
    if (!val) return fallback;
    try {
        let target = val;
        if (Array.isArray(val)) {
            const validItems = val.filter(v => typeof v === 'string' && v !== '[object Object]' && (v.trim().startsWith('{') || v.trim().startsWith('[')));
            target = validItems.length > 0 ? validItems[validItems.length - 1] : val[val.length - 1];
        }
        if (!target || target === '[object Object]') return fallback;
        return typeof target === 'string' ? JSON.parse(target) : target;
    } catch (e) {
        return fallback;
    }
};

const https = require('https');
const http = require('http');

// Helper to resolve Google Maps shortlinks and extract Street View 360 photosphere panoid & image URL
const resolveGoogleStreetView = (rawUrl) => {
    return new Promise((resolve) => {
        if (!rawUrl || typeof rawUrl !== 'string') return resolve(null);
        
        function check(url, depth = 0) {
            if (depth > 6) return resolve(null);
            
            const panoidMatch = url.match(/panoid(?:%3D|=)([a-zA-Z0-9_-]+)/i) || url.match(/!1s([a-zA-Z0-9_-]{15,})!2e/);
            if (panoidMatch) {
                const panoid = panoidMatch[1];
                return resolve({
                    panoid,
                    imageUrl: `https://streetviewpixels-pa.clients6.google.com/v1/thumbnail?cb_client=maps_sv.tactile&w=2048&h=1024&panoid=${panoid}&yaw=0&pitch=0`
                });
            }

            if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url) || (url.includes('google.com') && depth < 3)) {
                try {
                    const client = url.startsWith('https') ? https : http;
                    const req = client.get(url, (res) => {
                        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                            check(res.headers.location, depth + 1);
                        } else {
                            resolve(null);
                        }
                    });
                    req.on('error', () => resolve(null));
                    req.setTimeout(4000, () => {
                        req.destroy();
                        resolve(null);
                    });
                } catch (e) {
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        }
        check(rawUrl.trim());
    });
};

// API Endpoint to resolve Google Street View link to 360 Photosphere Image
exports.resolveStreetView = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ success: false, message: 'URL required' });
        const result = await resolveGoogleStreetView(url);
        if (result) {
            return res.json({ success: true, ...result });
        }
        return res.json({ success: false, message: 'Could not extract 360 photosphere' });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
};

// Smart Venue Matcher
exports.smartMatchMahals = async (req, res) => {
    try {
        const { guests, budget, city, priority, eventType, eventDate } = req.query;
        
        // Find all active mahals
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const oneYearAndSevenDaysAgo = new Date();
        oneYearAndSevenDaysAgo.setFullYear(oneYearAndSevenDaysAgo.getFullYear() - 1);
        oneYearAndSevenDaysAgo.setDate(oneYearAndSevenDaysAgo.getDate() - 7);
        
        const suspendedVendors = await Vendor.find({
            $or: [
                { planExpiryDate: { $lt: sevenDaysAgo } },
                { planExpiryDate: { $exists: false }, createdAt: { $lt: oneYearAndSevenDaysAgo } },
                { planExpiryDate: null, createdAt: { $lt: oneYearAndSevenDaysAgo } },
                { status: 'Inactive' }
            ]
        }).select('_id');
        const suspendedVendorIds = suspendedVendors.map(v => v._id);

        let query = {};
        if (suspendedVendorIds.length > 0) {
            query.vendorId = { $nin: suspendedVendorIds };
        }

        const mahals = await Mahal.find(query).populate('vendorId', 'fullName email phone businessName');

        // Check date availability if eventDate is provided
        let bookedMahalIds = new Set();
        if (eventDate) {
            try {
                const targetDate = new Date(eventDate);
                if (!isNaN(targetDate.getTime())) {
                    const startOfDay = new Date(targetDate);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(targetDate);
                    endOfDay.setHours(23, 59, 59, 999);

                    const existingBookings = await Booking.find({
                        date: { $gte: startOfDay, $lte: endOfDay },
                        bookingStatus: { $in: ['Confirmed', 'Pending'] }
                    }).select('mahalId');
                    existingBookings.forEach(b => {
                        if (b.mahalId) bookedMahalIds.add(b.mahalId.toString());
                    });
                }
            } catch (dateErr) {
                console.error("Date check error in smart match:", dateErr);
            }
        }

        // Scoring Logic with granular weights & match highlights
        const scoredMahals = mahals.map(mahal => {
            let score = 0;
            const matchReasons = [];

            // 1. Event Type Match (25%)
            if (eventType) {
                const typeLower = (mahal.mahalType || '').toLowerCase();
                if (eventType === 'Wedding' || eventType === 'Reception') {
                    if (typeLower.includes('wedding') || typeLower.includes('convention') || typeLower.includes('banquet') || typeLower.includes('lawn')) {
                        score += 25;
                        matchReasons.push('Grand setting for Weddings & Receptions');
                    } else {
                        score += 15;
                    }
                    if (mahal.brideRoom || mahal.groomRoom) {
                        matchReasons.push('Dedicated Bride & Groom rooms');
                    }
                } else if (eventType === 'Corporate Offsite' || eventType === 'Product Launch') {
                    if (typeLower.includes('conference') || typeLower.includes('hotel') || typeLower.includes('convention') || typeLower.includes('auditorium') || typeLower.includes('banquet')) {
                        score += 25;
                    } else {
                        score += 10;
                    }
                    if (mahal.corporateAmenities && (mahal.corporateAmenities.wifi || mahal.corporateAmenities.projector || mahal.corporateAmenities.videoConferencing)) {
                        score += 5;
                        matchReasons.push('Equipped with Corporate AV & High-Speed Wi-Fi');
                    }
                } else if (eventType === 'Birthday') {
                    if (typeLower.includes('party') || typeLower.includes('mini') || typeLower.includes('banquet') || typeLower.includes('resort')) {
                        score += 25;
                        matchReasons.push('Ideal party atmosphere for birthdays');
                    } else {
                        score += 15;
                    }
                } else {
                    score += 20;
                }
            } else {
                score += 25;
            }

            // 2. Capacity Match (25%)
            if (guests) {
                const requiredCapacity = parseInt(guests, 10);
                if (mahal.seatingCapacity >= requiredCapacity) {
                    score += 25;
                    matchReasons.push(`Accommodates your ${requiredCapacity}+ guests`);
                } else if (mahal.seatingCapacity >= requiredCapacity * 0.75) {
                    score += 15;
                    matchReasons.push(`Near match for guest capacity (${mahal.seatingCapacity} seats)`);
                } else {
                    score += 5;
                }
            } else {
                score += 25;
            }

            // 3. Budget Match (25%)
            if (budget) {
                const targetBudget = parseInt(budget, 10);
                if (mahal.fullDayPrice <= targetBudget) {
                    score += 25;
                    matchReasons.push(`Within your ₹${targetBudget.toLocaleString('en-IN')} budget`);
                } else if (mahal.fullDayPrice <= targetBudget * 1.2) {
                    score += 15;
                    matchReasons.push(`Close to target budget (₹${mahal.fullDayPrice?.toLocaleString('en-IN')})`);
                } else {
                    score += 5;
                }
            } else {
                score += 25;
            }

            // 4. Location Match (15%)
            if (city && city.trim()) {
                const searchCity = city.trim().toLowerCase();
                const mahalCity = (mahal.city || '').toLowerCase();
                const mahalDistrict = (mahal.district || '').toLowerCase();
                const mahalStreet = (mahal.street || '').toLowerCase();
                if (mahalCity.includes(searchCity) || mahalDistrict.includes(searchCity) || mahalStreet.includes(searchCity)) {
                    score += 15;
                    matchReasons.push(`Located in ${mahal.city}`);
                } else {
                    score += 5;
                }
            } else {
                score += 15;
            }

            // 5. Date Availability & Priority Match (10%)
            const isBooked = eventDate ? bookedMahalIds.has(mahal._id.toString()) : false;
            if (eventDate) {
                if (!isBooked) {
                    score += 5;
                    matchReasons.push('Available on your requested date');
                }
            } else {
                score += 5;
            }

            if (priority) {
                if (priority === 'food' && mahal.catering && mahal.catering.available) {
                    score += 5;
                    matchReasons.push('In-house catering packages available');
                } else if (priority === 'parking' && mahal.facilities && mahal.facilities.parking) {
                    score += 5;
                    matchReasons.push(`Parking for ${mahal.parkingCapacity || 50}+ vehicles`);
                } else if (priority === 'luxury' && mahal.facilities && mahal.facilities.ac) {
                    score += 5;
                    matchReasons.push('Fully air-conditioned luxury hall');
                } else if (priority === 'corporate' && mahal.corporateAmenities && mahal.corporateAmenities.wifi) {
                    score += 5;
                    matchReasons.push('Dedicated business amenities ready');
                }
            } else {
                score += 5;
            }

            const uniqueReasons = [...new Set(matchReasons)].slice(0, 3);

            const mahalObj = mahal.toObject();
            mahalObj.matchScore = Math.min(100, Math.round(score));
            mahalObj.matchReasons = uniqueReasons;
            mahalObj.isAvailableOnDate = !isBooked;
            return mahalObj;
        });

        // Sort by score
        scoredMahals.sort((a, b) => b.matchScore - a.matchScore);
        
        // Return top 3 matches
        const topMatches = scoredMahals.slice(0, 3);
        
        res.json(topMatches);
    } catch (err) {
        console.error("Smart Match Error:", err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Broadcast Quote Inquiry to Multiple Matching Venues (1-Click Multi-Venue Lead Generation)
exports.broadcastSmartInquiry = async (req, res) => {
    try {
        const {
            venueIds,
            userName,
            userPhone,
            userEmail,
            eventType,
            eventDate,
            guests,
            budget,
            city,
            notes,
            userId
        } = req.body;

        if (!venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
            return res.status(400).json({ msg: 'Please select at least one venue.' });
        }
        if (!userName || !userPhone) {
            return res.status(400).json({ msg: 'Name and Phone number are required.' });
        }

        // Find or create sender User record
        let senderUser = null;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            senderUser = await User.findById(userId);
        }
        if (!senderUser && userEmail) {
            senderUser = await User.findOne({ email: userEmail });
        }
        if (!senderUser && userPhone) {
            senderUser = await User.findOne({ phone: userPhone });
        }
        if (!senderUser) {
            const randomPass = Math.random().toString(36).slice(-8);
            senderUser = new User({
                fullName: userName,
                email: userEmail || `lead_${Date.now()}@mehfilone.in`,
                phone: userPhone,
                password: randomPass,
                role: 'user',
                status: 'Active'
            });
            await senderUser.save();
        }

        // Find selected mahals with vendor info
        const mahals = await Mahal.find({ _id: { $in: venueIds } }).populate('vendorId');

        const formattedDate = eventDate 
            ? new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Date to be finalized';

        const inquiryContent = 
`🎯 SMART VENUE REQUIREMENT & QUOTE REQUEST
--------------------------------------------------
• Event Type: ${eventType || 'Celebration / Event'}
• Preferred Date: ${formattedDate}
• Expected Guests: ${guests ? `${guests} pax` : 'Not specified'}
• Target Budget: ${budget ? `₹${Number(budget).toLocaleString('en-IN')}` : 'Flexible / Negotiable'}
• Preferred Location: ${city || 'Any'}

Customer Contact Details:
• Name: ${userName}
• Phone: ${userPhone}
• Email: ${userEmail || 'Not provided'}

Message / Special Requirements:
${notes ? notes : 'Looking for available date slots and a formal quotation proposal.'}
--------------------------------------------------
(Sent via Mehfil-One "Help Me Find a Venue" Matcher)`;

        const contactedVenues = [];

        for (const mahal of mahals) {
            if (mahal.vendorId) {
                const vendorId = mahal.vendorId._id || mahal.vendorId;

                const newMsg = new Message({
                    sender: senderUser._id,
                    senderModel: 'User',
                    receiver: vendorId,
                    receiverModel: 'Vendor',
                    mahalId: mahal._id,
                    content: inquiryContent,
                    read: false,
                    delivered: true
                });
                await newMsg.save();

                contactedVenues.push(mahal.mahalName);

                // Send email notification to vendor if available
                if (mahal.vendorId.email) {
                    const emailSubject = `New Lead for ${mahal.mahalName}: ${eventType || 'Event'} Inquiry (${userName})`;
                    const emailHtml = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                            <h2 style="color: #dc3545; margin-top: 0;">New Smart Match Quote Inquiry!</h2>
                            <p>A customer submitted an inquiry for <strong>${mahal.mahalName}</strong>:</p>
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Customer Name</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${userName}</td></tr>
                                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #ddd;"><a href="tel:${userPhone}">${userPhone}</a></td></tr>
                                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Email</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${userEmail || 'N/A'}</td></tr>
                                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Event Type</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${eventType}</td></tr>
                                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Preferred Date</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${formattedDate}</td></tr>
                                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Guests</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${guests || 'N/A'}</td></tr>
                                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Budget</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">₹${budget ? Number(budget).toLocaleString('en-IN') : 'Flexible'}</td></tr>
                            </table>
                            <p style="background: #f8f9fa; padding: 12px; border-left: 4px solid #dc3545; border-radius: 4px;">${notes || 'Customer is awaiting quote.'}</p>
                            <p>You can reply directly to the customer or check your Mehfil-One Vendor Portal messages.</p>
                        </div>
                    `;
                    sendEmail(mahal.vendorId.email, emailSubject, inquiryContent, emailHtml).catch(e => console.error("Vendor email notify error:", e));
                }
            }
        }

        res.status(200).json({
            success: true,
            msg: `Inquiry successfully sent to ${contactedVenues.length} venue(s)!`,
            contactedVenues,
            userId: senderUser._id
        });
    } catch (err) {
        console.error("Broadcast Smart Inquiry Error:", err);
        res.status(500).json({ msg: 'Server error while sending inquiries.' });
    }
};

// Get all mahals with filters and pagination
exports.getAllMahals = async (req, res) => {
    try {
        const { 
            vendorId, 
            mahalName, 
            city, 
            district, 
            minPrice, 
            maxPrice, 
            minRating, 
            isAC,
            hasWifi,
            hasProjector,
            hasVideoConferencing,
            hasWhiteboard,
            bestPriceGuarantee,
            hasVirtualTour
        } = req.query;

        let matchQuery = {};

        // Exclude suspended vendors (grace period of 7 days after expiry)
        // A vendor is suspended if:
        // 1. They have a planExpiryDate set and it's more than 7 days in the past, OR
        // 2. They have NO planExpiryDate but their createdAt is more than 1 year + 7 days ago (legacy vendors)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const oneYearAndSevenDaysAgo = new Date();
        oneYearAndSevenDaysAgo.setFullYear(oneYearAndSevenDaysAgo.getFullYear() - 1);
        oneYearAndSevenDaysAgo.setDate(oneYearAndSevenDaysAgo.getDate() - 7);

        const suspendedVendors = await Vendor.find({
            $or: [
                // Has explicit expiry date that's past the grace period
                { planExpiryDate: { $lt: sevenDaysAgo } },
                // Legacy vendor: no planExpiryDate but account is older than 1 year + 7 days
                { planExpiryDate: { $exists: false }, createdAt: { $lt: oneYearAndSevenDaysAgo } },
                { planExpiryDate: null, createdAt: { $lt: oneYearAndSevenDaysAgo } },
                { status: 'Inactive' }
            ]
        }).select('_id');
        const suspendedVendorIds = suspendedVendors.map(v => v._id);

        if (vendorId) {
            if (mongoose.Types.ObjectId.isValid(vendorId)) {
                if (suspendedVendorIds.some(id => id.toString() === vendorId)) {
                    // The requested vendor is suspended, return empty
                    return res.json({ mahals: [], currentPage: 1, totalPages: 0, totalMahals: 0 });
                }
                matchQuery.vendorId = new mongoose.Types.ObjectId(vendorId);
            } else {
                return res.json({ mahals: [], currentPage: 1, totalPages: 0, totalMahals: 0 });
            }
        } else {
            if (suspendedVendorIds.length > 0) {
                matchQuery.vendorId = { $nin: suspendedVendorIds };
            }
        }

        if (mahalName) matchQuery.mahalName = { $regex: mahalName, $options: 'i' };
        if (city) matchQuery.city = { $regex: city, $options: 'i' };
        if (district) matchQuery.district = { $regex: district, $options: 'i' };

        // Price Filter (using fullDayPrice)
        if (minPrice || maxPrice) {
            matchQuery.fullDayPrice = {};
            if (minPrice) matchQuery.fullDayPrice.$gte = parseInt(minPrice);
            if (maxPrice) matchQuery.fullDayPrice.$lte = parseInt(maxPrice);
        }

        // AC Filter
        if (isAC) {
            matchQuery['facilities.ac'] = isAC === 'true';
        }

        // Corporate Amenities Filter
        if (hasWifi === 'true') matchQuery['corporateAmenities.wifi'] = true;
        if (hasProjector === 'true') matchQuery['corporateAmenities.projector'] = true;
        if (hasVideoConferencing === 'true') matchQuery['corporateAmenities.videoConferencing'] = true;
        if (hasWhiteboard === 'true') matchQuery['corporateAmenities.whiteboard'] = true;
        if (bestPriceGuarantee === 'true') matchQuery.bestPriceGuarantee = true;
        if (hasVirtualTour === 'true') matchQuery['virtualTour.enabled'] = true;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // If we don't need rating filters, use standard find() which is faster and avoids aggregation issues
        if (!minRating && req.query.needsRating !== 'true') {
            const mahals = await Mahal.find(matchQuery)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
            const total = await Mahal.countDocuments(matchQuery);
            return res.json({
                mahals,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalMahals: total
            });
        }

        const pipeline = [
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'reviews',
                    localField: '_id',
                    foreignField: 'mahalId',
                    as: 'reviews'
                }
            },
            {
                $addFields: {
                    averageRating: { $ifNull: [{ $avg: '$reviews.rating' }, 0] },
                    reviewCount: { $size: '$reviews' }
                }
            }
        ];

        // Rating Filter (Must happen after addFields)
        if (minRating) {
            pipeline.push({ $match: { averageRating: { $gte: parseFloat(minRating) } } });
        }

        // Sort, Skip, Limit
        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            { $project: { reviews: 0 } }
        );

        const mahals = await Mahal.aggregate(pipeline);
        
        let total;
        if (minRating) {
            const countPipeline = [
                { $match: matchQuery },
                {
                    $lookup: {
                        from: 'reviews',
                        localField: '_id',
                        foreignField: 'mahalId',
                        as: 'reviews'
                    }
                },
                {
                    $addFields: {
                        averageRating: { $ifNull: [{ $avg: '$reviews.rating' }, 0] }
                    }
                },
                { $match: { averageRating: { $gte: parseFloat(minRating) } } },
                { $count: 'total' }
            ];
            const countResult = await Mahal.aggregate(countPipeline);
            total = countResult.length > 0 ? countResult[0].total : 0;
        } else {
            total = await Mahal.countDocuments(matchQuery);
        }

        res.json({
            mahals,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalMahals: total
        });
    } catch (err) {
        console.error("Get All Mahals Error:", err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Get single mahal by ID
exports.getMahalById = async (req, res) => {
    try {
        const mahal = await Mahal.findById(req.params.id).populate('vendorId', 'upiId fullName');
        if (!mahal) return res.status(404).json({ msg: 'Mahal not found' });
        res.json(mahal);
    } catch (err) {
        console.error("Get Mahal By ID Error:", err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Create a Mahal
exports.createMahal = async (req, res) => {
    try {
        // Sanitize req.body to handle "null" and "undefined" strings from FormData
        for (const key in req.body) {
            if (req.body[key] === 'null') req.body[key] = null;
            else if (req.body[key] === 'undefined') req.body[key] = undefined;
        }

        console.log("Create Mahal Body:", req.body);
        console.log("Create Mahal Files:", req.files);

        const { vendorId } = req.body;

        if (!vendorId) return res.status(400).json({ msg: 'Vendor ID is required' });

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) return res.status(404).json({ msg: 'Vendor not found' });

        // Enforce Plan Limits
        const plan = vendor.plan || 'Standard';
        if (plan === 'Standard') {
            const currentCount = await Mahal.countDocuments({ vendorId });
            if (currentCount >= 2) {
                return res.status(403).json({
                    msg: 'Upgrade to Premium! Standard plan allows only 2 Mahals.'
                });
            }
        }

        // --- DATA PROCESSING ---
        // Since we are sending FormData, everything is a string. Need to parse JSON fields.

        let facilities = parseMultipartJson(req.body.facilities, {});
        let corporateAmenities = parseMultipartJson(req.body.corporateAmenities, {});
        let decoration = parseMultipartJson(req.body.decoration, { available: false, items: [] });
        let stalls = parseMultipartJson(req.body.stalls, {});
        let utensils = parseMultipartJson(req.body.utensils, {});
        let catering = parseMultipartJson(req.body.catering, {});
        let eventPackages = parseMultipartJson(req.body.eventPackages, []);

        // --- FILE PROCESSING ---
        const files = req.files || {};

        // 1. Cover Image
        let coverImagePath = null;
        if (files.coverImage && files.coverImage[0]) {
            coverImagePath = normalizePath(files.coverImage[0].path);
        }

        // 2. Gallery Images
        let galleryImagesPaths = [];
        if (files.galleryImages) {
            galleryImagesPaths = files.galleryImages.map(file => normalizePath(file.path));
        }

        // 3. Brochure
        let brochurePath = null;
        if (files.brochure && files.brochure[0]) {
            brochurePath = normalizePath(files.brochure[0].path);
        }

        // 4. Catering Menu Images
        if (files.menuImages) {
            const menuPaths = files.menuImages.map(file => normalizePath(file.path));
            if (!catering.menuImages) catering.menuImages = [];
            catering.menuImages = [...catering.menuImages, ...menuPaths];
        }

        // 5. Virtual Tour & Floor Plan Files
        let virtualTour = { enabled: false, tourType: 'embed', embedUrl: '', panoramaImage: '' };
        if (req.body.virtualTour) {
            const parsedVT = parseMultipartJson(req.body.virtualTour, null);
            if (parsedVT && typeof parsedVT === 'object') {
                virtualTour = { ...virtualTour, ...parsedVT };
            }
        }
        if (files.panoramaImage && files.panoramaImage[0]) {
            virtualTour.panoramaImage = normalizePath(files.panoramaImage[0].path);
            virtualTour.enabled = true;
        }
        if (virtualTour.embedUrl && /maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps/i.test(virtualTour.embedUrl)) {
            const sv = await resolveGoogleStreetView(virtualTour.embedUrl);
            if (sv && sv.imageUrl) {
                virtualTour.panoramaImage = sv.imageUrl;
            }
        }

        let floorPlan = { available: false, image: '', totalSqFt: 0, stageDimensions: '', diningSqFt: 0, ceilingHeight: '' };
        if (req.body.floorPlan) {
            const parsedFP = parseMultipartJson(req.body.floorPlan, null);
            if (parsedFP && typeof parsedFP === 'object') {
                floorPlan = { ...floorPlan, ...parsedFP };
            }
        }
        if (files.floorPlanImage && files.floorPlanImage[0]) {
            floorPlan.image = normalizePath(files.floorPlanImage[0].path);
            floorPlan.available = true;
        }

        // 5. Decoration Images - THIS IS TRICKY
        // If we want to assign images to specific decoration items, we need a mapping from frontend.
        // Simplified approach: For this iteration, if decoration images are uploaded, 
        // they might just be added to the FIRST decoration item or stored generically if the schema allows.
        // The current Schema puts images INSIDE decoration items: items: [{ images: [] }]
        // Frontend must ensure it maps these correctly or sends Base64 for simplicity in nested arrays if not using advanced form data mapping.
        // PLAN: For now, we will handle 'decorationImages' as a flat list and assign to the first item if exists, 
        // OR rely on the frontend sending Base64 for these nested specific images if feasible, 
        // OR (Better) assume frontend sends `decoration` JSON with existing image URLs 
        // and we only handle NEW basic uploads here.

        // *Revisit*: The User asked for "Decoration Module: multiple items". 
        // If we strictly use file uploads for nested items, we need keys like `decoration[0][images]`. 
        // Multer supports this if fields are named dynamically.
        // Current route config: `{ name: 'decorationImages', maxCount: 20 }` - this is a flat list.
        // Workaround: We will append these uploaded decoration images to the first decoration item for now, 
        // or expect the frontend to handle specific index mapping. 
        // Let's assume for this step: Flattened decoration images go to the first item for simplicity, 
        // or adhere to what the frontend will send. 

        // Better Approach: Frontend sends JSON with Base64 for nested images for smoother DX in this specific constraints.
        // However, we are using Multipart.
        // Implementation: We will process `req.body.decoration` (parsed). 
        // If there are files in `files.decorationImages`, we assume they belong to the items in order or just the first one.
        // Let's append to the first item for safety if it exists.

        if (files.decorationImages && decoration.items && decoration.items.length > 0) {
            const decPaths = files.decorationImages.map(file => normalizePath(file.path));
            // Just add to the first one for now as a default behavior
            decoration.items[0].images = [...(decoration.items[0].images || []), ...decPaths];
        }


        // Sanitize Enum Fields to prevent empty strings from causing validation errors
        if (utensils.included === '') utensils.included = undefined;
        if (catering.type === '') catering.type = undefined;

        // Construct the Mahal object
        const mahalData = {
            vendorId, // Required
            mahalName: req.body.mahalName,
            mahalType: req.body.mahalType,
            ownerName: req.body.ownerName,
            mobile: req.body.mobile,
            altMobile: req.body.altMobile,
            email: req.body.email,
            whatsapp: req.body.whatsapp,
            description: req.body.description,

            doorNo: req.body.doorNo,
            street: req.body.street,
            city: req.body.city,
            district: req.body.district,
            state: req.body.state,
            pincode: req.body.pincode,
            mapUrl: req.body.mapUrl,
            landmark: req.body.landmark,

            seatingCapacity: req.body.seatingCapacity,
            diningCapacity: req.body.diningCapacity,
            parkingCapacity: req.body.parkingCapacity,
            totalRooms: req.body.totalRooms,
            brideRoom: req.body.brideRoom === 'true', // FormData sends strings
            groomRoom: req.body.groomRoom === 'true',

            morningPrice: req.body.morningPrice,
            eveningPrice: req.body.eveningPrice,
            fullDayPrice: req.body.fullDayPrice,
            extraHourPrice: req.body.extraHourPrice,
            advanceAmount: req.body.advanceAmount,
            refundPolicy: req.body.refundPolicy,
            discountMin: req.body.discountMin,
            discountMax: req.body.discountMax,
            applyGst: req.body.applyGst === 'true',
            bestPriceGuarantee: req.body.bestPriceGuarantee !== undefined ? (req.body.bestPriceGuarantee === 'true' || req.body.bestPriceGuarantee === true) : true,

            availableDays: req.body.availableDays,
            morningTimeFrom: req.body.morningTimeFrom,
            morningTimeTo: req.body.morningTimeTo,
            eveningTimeFrom: req.body.eveningTimeFrom,
            eveningTimeTo: req.body.eveningTimeTo,

            facilities: facilities,
            corporateAmenities: corporateAmenities,
            powerSupply: req.body.powerSupply,
            restRooms: req.body.restRooms,

            coverImage: coverImagePath || req.body.coverImage, // Allow keeping existing if passed
            galleryImages: galleryImagesPaths.length > 0 ? galleryImagesPaths : (req.body.galleryImages || []),
            videoUrl: req.body.videoUrl,
            brochureUrl: brochurePath || req.body.brochureUrl,

            decoration: decoration, // Parsed Object
            stalls: stalls,
            utensils: utensils,
            catering: catering,
            eventPackages: eventPackages,
            virtualTour: virtualTour,
            floorPlan: floorPlan,

            terms: req.body.terms
        };

        const newMahal = new Mahal(mahalData);
        const savedMahal = await newMahal.save();
        res.json(savedMahal);

    } catch (err) {
        console.error("Create Mahal Error:", err);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
};

// Update a Mahal
exports.updateMahal = async (req, res) => {
    try {
        // Sanitize req.body to handle "null" and "undefined" strings from FormData
        for (const key in req.body) {
            if (req.body[key] === 'null') req.body[key] = null;
            else if (req.body[key] === 'undefined') req.body[key] = undefined;
        }

        // Similar logic to create, but finding by ID first
        // For brevity, using FindByIdAndUpdate directly might overwrite complex fields if not careful
        // Best to fetch, merge, and save.

        // ... (Update logic would mirror create logic regarding file processing)
        // For now, let's implement a basic update that supports the main fields

        // Re-use logic or extract to helper function in real app.
        // For this task, we can just use the same logic as Create but merge with existing data.

        const existingMahal = await Mahal.findById(req.params.id);
        if (!existingMahal) return res.status(404).json({ msg: 'Mahal not found' });

        // Process Body & Files (Copy-Paste logical adaptation from Create)
        let facilities = parseMultipartJson(req.body.facilities, existingMahal.facilities || {});
        let corporateAmenities = parseMultipartJson(req.body.corporateAmenities, existingMahal.corporateAmenities || {});
        let decoration = parseMultipartJson(req.body.decoration, existingMahal.decoration || { available: false, items: [] });
        let stalls = parseMultipartJson(req.body.stalls, existingMahal.stalls || {});
        let utensils = parseMultipartJson(req.body.utensils, existingMahal.utensils || {});
        let catering = parseMultipartJson(req.body.catering, existingMahal.catering || {});
        let eventPackages = parseMultipartJson(req.body.eventPackages, existingMahal.eventPackages || []);

        const files = req.files || {};

        // 1. Cover Image
        let coverImagePath = existingMahal.coverImage;
        if (files.coverImage && files.coverImage[0]) {
            if (existingMahal.coverImage) deleteFile(existingMahal.coverImage); // Delete old
            coverImagePath = normalizePath(files.coverImage[0].path);
        }

        // 2. Brochure
        let brochurePath = existingMahal.brochureUrl;
        if (files.brochure && files.brochure[0]) {
            if (existingMahal.brochureUrl) deleteFile(existingMahal.brochureUrl); // Delete old
            brochurePath = normalizePath(files.brochure[0].path);
        }

        // 3. Gallery Images
        let keptGalleryImages = [];
        if (req.body.existingGalleryImages) {
            try {
                keptGalleryImages = JSON.parse(req.body.existingGalleryImages);
                if (!Array.isArray(keptGalleryImages)) keptGalleryImages = [keptGalleryImages];
            } catch (e) {
                // Fallback if not JSON
                if (typeof req.body.existingGalleryImages === 'string') keptGalleryImages = [req.body.existingGalleryImages];
                else if (Array.isArray(req.body.existingGalleryImages)) keptGalleryImages = req.body.existingGalleryImages;
            }
        }

        // Cleanup removed gallery images
        if (existingMahal.galleryImages && existingMahal.galleryImages.length > 0) {
            const removedImages = existingMahal.galleryImages.filter(img => !keptGalleryImages.includes(img));
            removedImages.forEach(img => deleteFile(img));
        }

        let galleryImagesPaths = keptGalleryImages;
        if (files.galleryImages) {
            const newPaths = files.galleryImages.map(file => normalizePath(file.path));
            galleryImagesPaths = [...galleryImagesPaths, ...newPaths];
        }

        // 4. Menu Images (Cleanup Logic)
        let keptMenuImages = [];
        if (req.body.existingMenuImages) {
            try {
                keptMenuImages = JSON.parse(req.body.existingMenuImages);
                if (!Array.isArray(keptMenuImages)) keptMenuImages = [keptMenuImages];
            } catch (e) {
                if (typeof req.body.existingMenuImages === 'string') keptMenuImages = [req.body.existingMenuImages];
                else if (Array.isArray(req.body.existingMenuImages)) keptMenuImages = req.body.existingMenuImages;
            }
        }

        if (existingMahal.catering && existingMahal.catering.menuImages) {
            const removedMenuImages = existingMahal.catering.menuImages.filter(img => !keptMenuImages.includes(img));
            removedMenuImages.forEach(img => deleteFile(img));
        }

        let menuImagesPaths = keptMenuImages;
        if (files.menuImages) {
            const newPaths = files.menuImages.map(file => normalizePath(file.path));
            menuImagesPaths = [...menuImagesPaths, ...newPaths];
        }

        // Merge catering with new menu images
        if (catering) {
            catering.menuImages = menuImagesPaths;
        }

        // 5. Virtual Tour
        let existingVT = existingMahal.virtualTour ? (existingMahal.virtualTour.toObject ? existingMahal.virtualTour.toObject() : existingMahal.virtualTour) : {};
        let virtualTour = { enabled: false, tourType: 'embed', embedUrl: '', panoramaImage: '', ...existingVT };
        if (req.body.virtualTour) {
            const parsedVT = parseMultipartJson(req.body.virtualTour, null);
            if (parsedVT && typeof parsedVT === 'object') {
                virtualTour = { ...virtualTour, ...parsedVT };
            }
        }
        if (files.panoramaImage && files.panoramaImage[0]) {
            if (existingMahal.virtualTour?.panoramaImage) deleteFile(existingMahal.virtualTour.panoramaImage);
            virtualTour.panoramaImage = normalizePath(files.panoramaImage[0].path);
            virtualTour.enabled = true;
        }
        if (virtualTour.embedUrl && /maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps/i.test(virtualTour.embedUrl)) {
            const sv = await resolveGoogleStreetView(virtualTour.embedUrl);
            if (sv && sv.imageUrl) {
                virtualTour.panoramaImage = sv.imageUrl;
            }
        }

        // 6. Floor Plan
        let existingFP = existingMahal.floorPlan ? (existingMahal.floorPlan.toObject ? existingMahal.floorPlan.toObject() : existingMahal.floorPlan) : {};
        let floorPlan = { available: false, image: '', totalSqFt: 0, stageDimensions: '', diningSqFt: 0, ceilingHeight: '', ...existingFP };
        if (req.body.floorPlan) {
            const parsedFP = parseMultipartJson(req.body.floorPlan, null);
            if (parsedFP && typeof parsedFP === 'object') {
                floorPlan = { ...floorPlan, ...parsedFP };
            }
        }
        if (files.floorPlanImage && files.floorPlanImage[0]) {
            if (existingMahal.floorPlan?.image) deleteFile(existingMahal.floorPlan.image);
            floorPlan.image = normalizePath(files.floorPlanImage[0].path);
            floorPlan.available = true;
        }

        // Update fields
        if (req.body.applyGst !== undefined) {
            req.body.applyGst = req.body.applyGst === 'true';
        }
        if (req.body.bestPriceGuarantee !== undefined) {
            req.body.bestPriceGuarantee = req.body.bestPriceGuarantee === 'true' || req.body.bestPriceGuarantee === true;
        }

        // Clean out fields from req.body so they don't overwrite parsed objects
        delete req.body.facilities;
        delete req.body.corporateAmenities;
        delete req.body.decoration;
        delete req.body.stalls;
        delete req.body.utensils;
        delete req.body.catering;
        delete req.body.eventPackages;
        delete req.body.virtualTour;
        delete req.body.floorPlan;
        delete req.body.existingGalleryImages;
        delete req.body.existingMenuImages;
        
        const updateData = {
            ...req.body, // Spread textual fields
            facilities, corporateAmenities, decoration, stalls, utensils, catering, eventPackages,
            virtualTour, floorPlan,
            coverImage: coverImagePath,
            galleryImages: galleryImagesPaths,
            brochureUrl: brochurePath
        };

        const updatedMahal = await Mahal.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json(updatedMahal);

    } catch (err) {
        console.error("Update Mahal Error:", err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Delete a Mahal
exports.deleteMahal = async (req, res) => {
    try {
        const mahal = await Mahal.findById(req.params.id);
        if (!mahal) return res.status(404).json({ msg: 'Mahal not found' });

        // Check for existing bookings
        const bookingCount = await Booking.countDocuments({ mahalId: req.params.id });
        if (bookingCount > 0) {
            return res.status(400).json({ msg: 'Cannot delete this mahal because it has active reservations.' });
        }

        // Delete all associated files
        if (mahal.coverImage) deleteFile(mahal.coverImage);
        if (mahal.brochureUrl) deleteFile(mahal.brochureUrl);

        if (mahal.galleryImages && mahal.galleryImages.length > 0) {
            mahal.galleryImages.forEach(img => deleteFile(img));
        }

        if (mahal.catering && mahal.catering.menuImages && mahal.catering.menuImages.length > 0) {
            mahal.catering.menuImages.forEach(img => deleteFile(img));
        }

        // Nested Decoration Images
        if (mahal.decoration && mahal.decoration.items && mahal.decoration.items.length > 0) {
            mahal.decoration.items.forEach(item => {
                if (item.images && item.images.length > 0) {
                    item.images.forEach(img => deleteFile(img));
                }
            });
        }

        await Mahal.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Mahal and associated files removed' });
    } catch (err) {
        console.error("Delete Mahal Error:", err);
        res.status(500).json({ msg: 'Server Error' });
    }
};
