const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/user');
const Project = require('../models/project'); // Import Project model

const createCheckoutSession = async (req, res) => {
    const { projectId, amount, projectName } = req.body;
    const amountInCents = Math.round(parseFloat(amount) * 100);

    if (!projectId || !amount || !projectName || amountInCents <= 0) {
        return res.status(400).send('Missing required investment data.');
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Investment in ${projectName}`,
                        description: `Project ID: ${projectId}`,
                    },
                    unit_amount: amountInCents,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/dashboard?payment_success=true`,
            cancel_url: `${req.protocol}://${req.get('host')}/projects/${projectId}?payment_cancelled=true`,
            client_reference_id: req.user.id,
            metadata: {
                projectId: projectId,
                amount: amount
            }
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating Stripe checkout session:', error);
        res.status(500).send('Server error');
    }
};

const stripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { projectId, amount } = session.metadata;
        const userId = session.client_reference_id;
        const amountNumber = parseFloat(amount);

        console.log('Webhook received for investment payment.');

        if (userId && projectId && amountNumber > 0) {
            try {
                // Record the investment in the project
                await Project.addInvestment(projectId, userId, amountNumber);
                console.log(`Investment of ${amountNumber} for project ${projectId} by user ${userId} recorded.`);

                // Optionally, update the user model as well if needed
                await User.update(userId, { 
                    lastInvestmentDate: new Date(),
                });
                console.log(`User ${userId} updated with last investment date.`);

            } catch (error) {
                console.error(`Failed to process investment for user ${userId} and project ${projectId}:`, error);
            }
        } else {
            console.error('CRITICAL: Webhook received but missing required metadata for investment.');
        }
    }

    res.json({ received: true });
};

module.exports = {
    createCheckoutSession,
    stripeWebhook
};