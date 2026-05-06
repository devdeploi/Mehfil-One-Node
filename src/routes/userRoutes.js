const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

const upload = require('../config/upload');

router.get('/:id', userController.getUserById);
router.get('/', userController.getAllUsers);
router.put('/:id', upload.single('profileImage'), userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
