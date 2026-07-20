const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

router.get('/conversations/:role/:userId', messageController.getConversations);
router.get('/history/:userId1/:userId2', messageController.getChatHistory);
router.post('/send', messageController.sendMessage);

module.exports = router;
