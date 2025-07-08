const express = require('express');
const router = express.Router();
const Application = require('../models/application');
const { hasRole } = require('../middleware/auth');

// GET all applications (admin only)
router.get('/', hasRole('admin'), async (req, res) => {
    try {
        const { status } = req.query;
        const applications = await Application.getAll(status);
        res.json(applications);
    } catch (error) {
        console.error('Failed to fetch applications:', error);
        res.status(500).json({ message: 'Failed to fetch applications' });
    }
});

// POST to update application status (admin only)
router.post('/:id/status', hasRole('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;
        await Application.updateStatus(id, status);
        res.json({ message: 'Application status updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update application status' });
    }
});

module.exports = router;
