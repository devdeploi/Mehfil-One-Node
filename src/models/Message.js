const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'senderModel'
    },
    senderModel: {
        type: String,
        required: true,
        enum: ['User', 'Vendor']
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'receiverModel'
    },
    receiverModel: {
        type: String,
        required: true,
        enum: ['User', 'Vendor']
    },
    mahalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mahal',
        required: false // Optional, can be used if message is regarding a specific venue
    },
    content: {
        type: String,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    delivered: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
