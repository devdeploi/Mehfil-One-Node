const Plan = require('../models/Plan');

// Create a new plan
exports.createPlan = async (req, res) => {
    try {
        const { name, price, features, recommended } = req.body;

        // Simple validation
        if (!name || price === undefined) {
            return res.status(400).json({ msg: 'Please provide plan name and price' });
        }

        const newPlan = new Plan({
            name,
            price,
            features,
            recommended
        });

        const plan = await newPlan.save();
        res.json(plan);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Get all plans
exports.getAllPlans = async (req, res) => {
    try {
        const plans = await Plan.find({ active: true }).sort({ price: 1 });
        res.json(plans);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Get plan by ID
exports.getPlanById = async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ msg: 'Plan not found' });
        res.json(plan);
    } catch (err) {
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Plan not found' });
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Update plan
exports.updatePlan = async (req, res) => {
    try {
        const { name, price, features, recommended, maxMahals } = req.body;

        const plan = await Plan.findByIdAndUpdate(
            req.params.id,
            { name, price, features, recommended, maxMahals },
            { new: true }
        );

        if (!plan) return res.status(404).json({ msg: 'Plan not found' });
        res.json(plan);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Delete plan (Hard delete for now)
exports.deletePlan = async (req, res) => {
    try {
        // Option 1: Hard Delete
        const plan = await Plan.findByIdAndDelete(req.params.id);

        // Option 2: Soft Delete (Set active to false)
        // const plan = await Plan.findByIdAndUpdate(req.params.id, { active: false });

        if (!plan) return res.status(404).json({ msg: 'Plan not found' });
        res.json({ msg: 'Plan removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};
