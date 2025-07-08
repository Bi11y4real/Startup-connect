const express = require('express');
const router = express.Router();
const { createCheckoutSession } = require('../controllers/stripeController');
const { isAuthenticated } = require('../middleware/auth');

// @desc    Render the payment page
// @route   GET /payment
// @access  Private (user must be logged in)
router.get('/', isAuthenticated, (req, res) => {
    res.render('payment', { 
        title: 'Subscribe',
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
    });
});

// @desc    Endpoint to create a Stripe Checkout session
// @route   POST /payment/create-checkout-session
// @access  Private
router.post('/create-checkout-session', isAuthenticated, createCheckoutSession);

module.exports = router;