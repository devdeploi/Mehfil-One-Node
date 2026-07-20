const Message = require('../models/Message');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

// Fetch conversations for a specific user or vendor
exports.getConversations = async (req, res) => {
    try {
        const userId = req.params.userId;
        const role = req.params.role; // 'User' or 'Vendor'

        // Find all messages where this user is sender or receiver
        const messages = await Message.find({
            $or: [{ sender: userId }, { receiver: userId }]
        }).sort({ createdAt: -1 }).populate('mahalId', 'mahalName');

        // Group by the other party
        const conversations = {};
        for (let msg of messages) {
            const otherPartyId = msg.sender.toString() === userId ? msg.receiver.toString() : msg.sender.toString();
            const otherPartyModel = msg.sender.toString() === userId ? msg.receiverModel : msg.senderModel;
            
            if (!conversations[otherPartyId]) {
                // Fetch other party details
                let otherPartyDetails = null;
                if (otherPartyModel === 'User') {
                    otherPartyDetails = await User.findById(otherPartyId).select('fullName email profileImage');
                } else {
                    otherPartyDetails = await Vendor.findById(otherPartyId).select('businessName fullName profileImage');
                }

                if (otherPartyDetails) {
                    conversations[otherPartyId] = {
                        contactId: otherPartyId,
                        contactModel: otherPartyModel,
                        contactName: otherPartyModel === 'User' ? otherPartyDetails.fullName : otherPartyDetails.businessName,
                        contactImage: otherPartyDetails.profileImage || null,
                        lastMessage: msg.content,
                        timestamp: msg.createdAt,
                        unreadCount: msg.read === false && msg.receiver.toString() === userId ? 1 : 0
                    };
                }
            } else {
                if (msg.read === false && msg.receiver.toString() === userId) {
                    conversations[otherPartyId].unreadCount += 1;
                }
            }
        }

        res.status(200).json(Object.values(conversations).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Fetch chat history between two users
exports.getChatHistory = async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;

        const messages = await Message.find({
            $or: [
                { sender: userId1, receiver: userId2 },
                { sender: userId2, receiver: userId1 }
            ]
        }).sort({ createdAt: 1 }).populate('mahalId', 'mahalName');

        // Mark as read if user1 is receiver
        await Message.updateMany(
            { sender: userId2, receiver: userId1, read: false },
            { $set: { read: true } }
        );

        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Send a new message via API (could also be handled strictly via socket)
exports.sendMessage = async (req, res) => {
    try {
        const { sender, senderModel, receiver, receiverModel, mahalId, content } = req.body;
        const io = req.app.get('io');
        let isOnline = false;
        if (io) {
            const room = io.sockets.adapter.rooms.get(receiver);
            if (room && room.size > 0) {
                isOnline = true;
            }
        }

        const newMessage = new Message({
            sender,
            senderModel,
            receiver,
            receiverModel,
            mahalId: mahalId || null,
            content,
            delivered: isOnline
        });

        await newMessage.save();

        // Emit via socket.io only to receiver (sender already has optimistic message in UI)
        if (io) {
            io.to(receiver).emit('newMessage', newMessage);
            if (isOnline) {
                // Also notify sender immediately that it was delivered
                io.to(sender).emit('messageStatusUpdate', { messageId: newMessage._id, delivered: true, read: false });
            }
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
