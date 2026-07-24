const mongoose = require('mongoose');

const heroSettingSchema = new mongoose.Schema({
    mainArch: {
        url: { type: String, default: '' },
        title: { type: String, default: 'The Royal Palace' },
        subtitle: { type: String, default: 'Featured' }
    },
    horizontal: {
        url: { type: String, default: '' },
        title: { type: String, default: 'Grand Banquet' }
    },
    vertical: {
        url: { type: String, default: '' },
        title: { type: String, default: 'Luxury Decor' }
    },
    circular: {
        url: { type: String, default: '' },
        title: { type: String, default: 'Event Hall' }
    }
}, { timestamps: true });

module.exports = mongoose.model('HeroSetting', heroSettingSchema);
