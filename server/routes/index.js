const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Landing page route
router.get('/', async (req, res) => {
    try {
        // Make sure we have the latest user data
        if (req.user && req.user.id) {
            const userData = await User.getById(req.user.id);
            if (userData) {
                req.user = {
                    ...req.user,
                    ...userData
                };
                res.locals.user = req.user;
            }
        }
        
        res.render('index', {
            title: 'StartupConnect | Connect. Collaborate. Fund.',
            user: req.user || null
        });
    } catch (error) {
        console.error('Error in home route:', error);
        res.render('index', {
            title: 'StartupConnect | Connect. Collaborate. Fund.',
            user: null
        });
    }
});

module.exports = router; 