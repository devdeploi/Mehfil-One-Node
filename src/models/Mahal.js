const mongoose = require('mongoose');

const mahalSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },

    // 1. Basic Details
    mahalName: { type: String, required: true },
    mahalType: { type: String, enum: ['Wedding Hall', 'Convention Center', 'Mini Hall'], required: true },
    ownerName: { type: String },
    mobile: { type: String, required: true },
    altMobile: { type: String },
    email: { type: String },
    whatsapp: { type: String },
    description: { type: String, required: true },

    // 2. Address & Location
    doorNo: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true }, // Used for filtering
    district: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    mapUrl: { type: String, required: true },
    landmark: { type: String },

    // 3. Hall Capacity
    seatingCapacity: { type: Number, required: true },
    diningCapacity: { type: Number, required: true },
    parkingCapacity: { type: Number },
    totalRooms: { type: Number },
    brideRoom: { type: Boolean, default: false },
    groomRoom: { type: Boolean, default: false },

    // 4. Pricing / Rent
    morningPrice: { type: Number },
    eveningPrice: { type: Number },
    fullDayPrice: { type: Number, required: true },
    extraHourPrice: { type: Number },
    advanceAmount: { type: Number },
    refundPolicy: { type: String },

    // 5. Availability / Booking
    availableDays: { type: String, enum: ['All Days', 'Weekends', 'Custom'], default: 'All Days' },
    morningTimeFrom: { type: String },
    morningTimeTo: { type: String },
    eveningTimeFrom: { type: String },
    eveningTimeTo: { type: String },

    // 6. Facilities / Amenities
    facilities: {
        ac: { type: Boolean, default: false },
        generator: { type: Boolean, default: false },
        parking: { type: Boolean, default: false },
        lift: { type: Boolean, default: false },
        drinkingWater: { type: Boolean, default: false },
        cleaning: { type: Boolean, default: false },
        soundSystem: { type: Boolean, default: false },
        stage: { type: Boolean, default: false },
        cctv: { type: Boolean, default: false }
    },
    powerSupply: { type: String },
    restRooms: { type: Number },

    // 7. Images / Media
    coverImage: { type: String }, // URL path
    galleryImages: [{ type: String }], // Array of URL paths
    videoUrl: { type: String },
    brochureUrl: { type: String }, // PDF Path

    // 8. Decoration Module (Array of Objects)
    decoration: {
        available: { type: Boolean, default: false },
        items: [{
            type: { type: String }, // Simple, Premium, Custom (Flexible)
            startPrice: { type: Number },
            maxPrice: { type: Number },
            description: { type: String },
            images: [{ type: String }]
        }]
    },

    // 9. Stalls Module
    stalls: {
        available: { type: Boolean, default: false },
        count: { type: Number },
        type: { type: String }, // Food, Tea, Sweet, Mixed
        price: { type: Number },
        electricity: { type: Boolean, default: false },
        water: { type: Boolean, default: false },
        notes: { type: String }
    },

    // 10. Utensils Module
    utensils: {
        available: { type: Boolean, default: false },
        included: { type: String, enum: ['Free', 'Paid'] },
        price: { type: Number },
        items: {
            plates: { type: Number },
            glasses: { type: Number },
            spoons: { type: Number },
            bowls: { type: Number }
        },
        cleaning: { type: Boolean, default: false },
        notes: { type: String }
    },

    // 11. Food / Catering
    catering: {
        available: { type: Boolean, default: false },
        type: { type: String, enum: ['Veg', 'Non-Veg', 'Both'] },
        startPrice: { type: Number },
        maxPrice: { type: Number },
        servingItems: { type: Number },
        menuImages: [{ type: String }],
        notes: { type: String }
    },

    // 12. Terms
    terms: { type: String },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mahal', mahalSchema);
