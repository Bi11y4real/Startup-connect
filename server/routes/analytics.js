const express = require('express');
const router = express.Router();
const Analytics = require('../models/analytics');
const { hasRole } = require('../middleware/auth');

/**
 * @route   GET /analytics
 * @desc    Get all analytics data for the admin dashboard
 * @access  Private (Admin)
 */
router.get('/', hasRole('admin'), async (req, res) => {
    try {
        const [summaryStats, userRegistrations, projectsByIndustry, applicationStatus, fundingActivity] = await Promise.all([
            Analytics.getSummaryStats(),
            Analytics.getUserRegistrations(),
            Analytics.getProjectsByIndustry(),
            Analytics.getApplicationStatusDistribution(),
            Analytics.getFundingActivity()
        ]);

        res.json({
            summaryStats,
            userRegistrations,
            projectsByIndustry,
            applicationStatus,
            fundingActivity
        });
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).json({ message: 'Server error while fetching analytics data.' });
    }
});

module.exports = router;
