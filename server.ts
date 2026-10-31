
/**
 * Production Full-Stack Server
 * AI Document Review & Routing Agent
 *
 * Features:
 * - Express server
 * - Razorpay webhook endpoint
 * - HMAC SHA256 signature verification
 * - Raw request body validation
 * - Secure webhook secret handling
 * - API route mounting
 * - Static file serving
 * - SPA fallback
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHmac, timingSafeEqual } from 'node:crypto';

import api from './server/api.ts';

// --------------------------------------------------
// SERVER CONFIGURATION
// --------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 3000;

app.disable('x-powered-by');

// --------------------------------------------------
// RAZORPAY WEBHOOK ENDPOINT
// IMPORTANT: This must be registered BEFORE app.use(api)
// because api.ts uses express.json().
// --------------------------------------------------

app.post(
  '/api/webhooks/razorpay',

  // Preserve original request body for signature verification
  express.raw({
    type: 'application/json',
    limit: '1mb'
  }),

  (req, res) => {
    try {
      // 1. Read webhook secret from server environment
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error(
          '[Razorpay] RAZORPAY_WEBHOOK_SECRET is not configured.'
        );

        return res.status(500).json({
          success: false,
          message: 'Webhook configuration error.'
        });
      }

      // 2. Get Razorpay signature
      const signature = req.get('x-razorpay-signature');

      if (!signature) {
        console.error('[Razorpay] Missing webhook signature.');

        return res.status(400).json({
          success: false,
          message: 'Missing webhook signature.'
        });
      }

      // 3. Ensure the original raw body is available
      if (!Buffer.isBuffer(req.body)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook request body.'
        });
      }

      // 4. Validate signature format
      if (!/^[a-f0-9]{64}$/i.test(signature)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid signature format.'
        });
      }

      // 5. Generate expected HMAC SHA256 signature
      const expectedSignature = createHmac(
        'sha256',
        webhookSecret
      )
        .update(req.body)
        .digest();

      const receivedSignature = Buffer.from(
        signature,
        'hex'
      );

      // 6. Compare signatures securely
      if (
        receivedSignature.length !== expectedSignature.length ||
        !timingSafeEqual(
          receivedSignature,
          expectedSignature
        )
      ) {
        console.error(
          '[Razorpay] Webhook signature verification failed.'
        );

        return res.status(400).json({
          success: false,
          message: 'Webhook signature verification failed.'
        });
      }

      // 7. Parse payload only after verification
      let event: any;

      try {
        event = JSON.parse(req.body.toString('utf8'));
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid JSON payload.'
        });
      }

      if (
        !event ||
        typeof event !== 'object' ||
        Array.isArray(event) ||
        typeof event.event !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook event.'
        });
      }

      // 8. Extract event information
      const eventId =
        req.get('x-razorpay-event-id') || 'not-provided';

      const eventType = event.event;

      const payment = event.payload?.payment?.entity;

      // 9. Log verified webhook event
      console.log('[Razorpay] Verified webhook received:', {
        eventId,
        eventType,
        paymentId: payment?.id || null,
        paymentStatus: payment?.status || null,
        orderId: payment?.order_id || null,
        timestamp: new Date().toISOString()
      });

      // 10. Recognize configured payment events
      switch (eventType) {
        case 'payment.captured':
          console.log('[Razorpay] Payment captured event received.');
          break;

        case 'payment.failed':
          console.log('[Razorpay] Payment failed event received.');
          break;

        default:
          console.log(
            `[Razorpay] Received event: ${eventType}`
          );
      }

      // IMPORTANT:
      // Persist verified events and update your actual payment/order
      // records here before acknowledging them in production.
      // Use eventId for persistent duplicate-event prevention.

      // 11. Acknowledge successfully verified webhook
      return res.status(200).json({
        success: true,
        received: true,
        event: eventType,
        message: 'Webhook signature verified successfully.'
      });

    } catch (error) {
      console.error(
        '[Razorpay] Webhook processing error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Internal webhook processing error.'
      });
    }
  }
);

// --------------------------------------------------
// MOUNT EXISTING API HANDLERS
// --------------------------------------------------

app.use(api);

// --------------------------------------------------
// STATIC FILE SERVING
// --------------------------------------------------

const publicPath = path.join(__dirname, 'public');
const distPath = path.join(__dirname, 'dist');

app.use(express.static(publicPath));
app.use(express.static(distPath));

// --------------------------------------------------
// SPA FALLBACK
// --------------------------------------------------

app.get('*', (req, res) => {
  res.sendFile(
    path.join(distPath, 'index.html')
  );
});

// --------------------------------------------------
// STARTUP CONFIGURATION
// --------------------------------------------------

console.log(
  '[Server] Initializing DOCUAGENT AI full-stack server...'
);

console.log(`[Config] Port: ${PORT}`);

console.log(
  `[Config] Node Environment: ${
    process.env.NODE_ENV || 'production'
  }`
);

console.log(
  `[Config] Gemini Vision API: ${
    process.env.GEMINI_API_KEY
      ? 'Configured (Multimodal active)'
      : 'Not set (Deterministic local OCR engine active)'
  }`
);

console.log(
  `[Config] Razorpay Webhook: ${
    process.env.RAZORPAY_WEBHOOK_SECRET
      ? 'Configured'
      : 'Not configured'
  }`
);

console.log(
  `[Config] Force HTTPS: ${
    process.env.FORCE_HTTPS === 'true'
      ? 'Enabled'
      : 'Disabled (Default)'
  }`
);

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[Server] Listening on http://0.0.0.0:${PORT}`
  );

  console.log(
    '[Razorpay] Webhook endpoint: /api/webhooks/razorpay'
  );
});
