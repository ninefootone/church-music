const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../db/pool');

// POST /api/stripe/webhook
// Must receive raw body — registered before express.json() in index.js
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // Payment confirmed — activate subscription
        const customerId = data.customer;
        const subscriptionId = data.subscription;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await pool.query(
          `UPDATE churches SET
            stripe_customer_id = $1,
            stripe_subscription_id = $2,
            subscription_status = 'active',
            subscription_price_id = $3,
            subscription_current_period_end = to_timestamp($4)
          WHERE id = $5`,
          [
            customerId,
            subscriptionId,
            subscription.items.data[0].price.id,
            subscription.current_period_end,
            data.metadata.church_id,
          ]
        );
        break;
      }

      case 'invoice.paid': {
        // Renewal paid — keep active and update period end
        const subscription = await stripe.subscriptions.retrieve(data.subscription);
        await pool.query(
          `UPDATE churches SET
            subscription_status = 'active',
            subscription_current_period_end = to_timestamp($1)
          WHERE stripe_customer_id = $2`,
          [subscription.current_period_end, data.customer]
        );
        break;
      }

      case 'invoice.payment_failed': {
        await pool.query(
          `UPDATE churches SET subscription_status = 'past_due' WHERE stripe_customer_id = $1`,
          [data.customer]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        await pool.query(
          `UPDATE churches SET
            subscription_status = 'canceled',
            stripe_subscription_id = NULL,
            subscription_price_id = NULL,
            subscription_current_period_end = NULL
          WHERE stripe_customer_id = $1`,
          [data.customer]
        );
        break;
      }

      case 'customer.subscription.updated': {
        const sub = data;
        await pool.query(
          `UPDATE churches SET
            subscription_status = $1,
            subscription_price_id = $2,
            subscription_current_period_end = to_timestamp($3)
          WHERE stripe_customer_id = $4`,
          [
            sub.status,
            sub.items.data[0].price.id,
            sub.current_period_end,
            sub.customer,
          ]
        );
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  res.json({ received: true });
});

module.exports = router;