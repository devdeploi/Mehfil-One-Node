const User = require('../models/User');

// Get all users with pagination
exports.getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments();

        res.json({
            users,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalUsers: total
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Get single user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('wishlist', 'mahalName coverImage city district fullDayPrice morningPrice seatingCapacity averageRating reviewCount');
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const { fullName } = req.body;
        const updateData = {};
        
        if (fullName) updateData.fullName = fullName;
        if (req.file) {
            updateData.profileImage = req.file.path.replace(/\\/g, "/");
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        ).select('-password');
        
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json({ msg: 'User deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Toggle Wishlist
exports.toggleWishlist = async (req, res) => {
    try {
        const { mahalId } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) return res.status(404).json({ msg: 'User not found' });
        
        const index = user.wishlist.findIndex(id => id.toString() === mahalId.toString());
        if (index > -1) {
            // Remove from wishlist
            user.wishlist.splice(index, 1);
        } else {
            // Add to wishlist
            user.wishlist.push(mahalId);
        }
        
        await user.save();
        res.json(user.wishlist);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
