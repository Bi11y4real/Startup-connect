const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/user');

const createCheckoutSession = async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Startup Connect - Full Access',
                        description: 'One-time payment for lifetime access to all features.',
                    },
                    unit_amount: 1000, // This is in cents, so $10.00
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/dashboard?payment_success=true`,
            cancel_url: `${req.protocol}://${req.get('host')}/payment?payment_cancelled=true`,
            client_reference_id: req.user.id // Pass the user's ID to the session
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating Stripe checkout session:', error);
        res.status(500).send('Server error');
    }
};

const stripeWebhook = async (req, res) => {
    // Use raw body for webhook signature verification
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Enhanced logging to debug payment status updates
        console.log('Webhook received for checkout.session.completed.');
        console.log('Full Stripe Session Object:', JSON.stringify(session, null, 2));

        const userId = session.client_reference_id;

        if (userId) {
            console.log(`Payment successful for user: ${userId}`);
            try {
                await User.update(userId, { 
                    hasPaid: true,
                    paymentDate: new Date(),
                    stripeCustomerId: session.customer,
                });
                console.log(`User ${userId} marked as paid.`);
            } catch (error) {
                console.error(`Failed to update user ${userId} in database:`, error);
            }
        } else {
            console.error('CRITICAL: Webhook received but no client_reference_id (userId) found in session. User payment status was NOT updated.');
        }
    }

    res.json({ received: true });
};

module.exports = {
    createCheckoutSession,
    stripeWebhook
};