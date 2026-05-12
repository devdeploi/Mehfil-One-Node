const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    mahalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mahal', required: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    date: { type: Date, required: true },
    endDate: { type: Date }, // Optional: for multi-day bookings
    isMultiDay: { type: Boolean, default: false },
    shift: { type: String, enum: ['Morning', 'Evening', 'Full Day', 'Multi-day'], required: true },
    endShift: { type: String, enum: ['Morning', 'Evening', 'Full Day'] }, // Optional: end shift for multi-day
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    paymentMode: { type: String, default: 'Offline - Cash' },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Partial'], default: 'Pending' },
    bookingStatus: { type: String, enum: ['Confirmed', 'Pending', 'Cancelled'], default: 'Confirmed' },
    bookingType: { type: String, enum: ['Online', 'Offline'], default: 'Offline' },
    transactionId: { type: String }, // For Online UPI payments
    guests: { type: Number }, // Guest count
    dayShifts: { type: Map, of: String }, // Map of 'YYYY-MM-DD' to 'Shift' for multi-day
    advancePaid: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    price: { type: Number }, // Base Price
    extraFacilities: {
        ac: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        generator: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        soundSystem: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        parking: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        lift: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        drinkingWater: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        cleaning: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        stage: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        cctv: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        rooms: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        decoration: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        stalls: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        utensils: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
        catering: { selected: { type: Boolean, default: false }, price: { type: Number, default: 0 } }
    },
    totalAmount: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
