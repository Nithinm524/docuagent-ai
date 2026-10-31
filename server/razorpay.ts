/**
 * Razorpay Payment Gateway Integration & Cryptographic Verification Service
 * DOCUAGENT AI SaaS Platform
 *
 * Implements:
 * - Server-side order creation with trusted server pricing calculation
 * - Cryptographic HMAC SHA-256 payment signature verification (constant-time)
 * - Razorpay Webhook signature verification (X-Razorpay-Signature)
 * - Duplicate payment prevention & idempotency locks
 * - Currency formatting & paisa normalization for Indian Rupees (INR)
 * - Safe fallback sandbox for test execution when credentials are not yet supplied
 */

import crypto from 'node:crypto';
import { billingStore } from './billingStore.ts';
import { type PlanId } from '../src/shared/plans.ts';
import { log } from './logger.ts';
import { AppError } from './errors.ts';

// Server-side environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_docuagent_ai';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_docuagent_secure_2026';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_whsec_docuagent_audit_2026';

const IS_LIVE_GATEWAY =
  !!process.env.RAZORPAY_KEY_ID &&
  !!process.env.RAZORPAY_KEY_SECRET &&
  !process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_docuagent_ai');

export interface CreateOrderParams {
  userId: string;
  userEmail: string;
  userName?: string;
  tenantId?: string;
  planId: PlanId;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  orderId: string;
  amountPaisa: number;
  amountInr: number;
  currency: 'INR';
  keyId: string;
  planId: PlanId;
  planName: string;
  receipt: string;
  isTestMode: boolean;
  user: {
    name: string;
    email: string;
  };
}

export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature: string;
  userId: string;
  userEmail: string;
  tenantId?: string;
  planId: PlanId;
  paymentMethod?: string;
}

export class RazorpayService {
  public getKeyId(): string {
    return RAZORPAY_KEY_ID;
  }

  public isLiveMode(): boolean {
    return IS_LIVE_GATEWAY;
  }

  /**
   * Generates a new order on the server.
   * Calculates the exact price in INR and converts to paisa from the trusted plan configuration.
   * NEVER trusts price values sent by the frontend.
   */
  public async createOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
    const plan = billingStore.getPlan(params.planId);
    if (!plan || plan.priceInrMonthly <= 0) {
      throw new AppError('INVALID_PLAN', 400, `Cannot create order for free or invalid plan: ${params.planId}`);
    }

    const amountInr = plan.priceInrMonthly;
    const amountPaisa = amountInr * 100; // Razorpay expects amount in smallest currency unit (paisa)
    const receipt = `rcpt_${params.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}_${Date.now().toString(36)}`;

    let orderId: string;

    if (IS_LIVE_GATEWAY) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
        const resp = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader
          },
          body: JSON.stringify({
            amount: amountPaisa,
            currency: 'INR',
            receipt,
            notes: {
              userId: params.userId,
              userEmail: params.userEmail,
              planId: params.planId,
              platform: 'DOCUAGENT_AI',
              ...(params.notes || {})
            }
          })
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          log({
            level: 'ERROR',
            operation: 'RAZORPAY_ORDER_FAILED',
            message: `Razorpay API returned status ${resp.status}: ${errBody}`
          });
          throw new AppError('PAYMENT_GATEWAY_ERROR', 502, 'Failed to create payment order with Razorpay gateway.');
        }

        const data: any = await resp.json();
        orderId = data.id;
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError('GATEWAY_COMMUNICATION_ERROR', 502, `Failed to communicate with Razorpay: ${err.message}`);
      }
    } else {
      // Local Sandbox / Test Mode order generation
      orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
      log({
        level: 'INFO',
        operation: 'RAZORPAY_ORDER_CREATED_SANDBOX',
        message: `Created test mode Razorpay order ${orderId} for ₹${amountInr} (${params.planId}).`
      });
    }

    // Register order in persistent billing store
    billingStore.registerOrder({
      orderId,
      userId: params.userId,
      planId: params.planId,
      amountPaisa
    });

    billingStore.logEvent(params.userId, 'ORDER_CREATED', `Created payment order ${orderId} for ${plan.name} (₹${amountInr})`, {
      orderId,
      planId: params.planId,
      amountInr,
      amountPaisa
    });

    return {
      orderId,
      amountPaisa,
      amountInr,
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID,
      planId: params.planId,
      planName: plan.name,
      receipt,
      isTestMode: !IS_LIVE_GATEWAY,
      user: {
        name: params.userName || 'Specialist',
        email: params.userEmail
      }
    };
  }

  /**
   * Cryptographically verifies the payment signature using HMAC SHA-256.
   * Employs crypto.timingSafeEqual to prevent timing attacks.
   */
  public verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!orderId || !paymentId || !signature) return false;

    try {
      const payload = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(payload)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');

      if (sigBuf.length !== expBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (err) {
      console.error('[RazorpayService] Signature verification exception:', err);
      return false;
    }
  }

  /**
   * Verifies payment and activates user subscription.
   * Prevents duplicate payment verification.
   */
  public async verifyAndActivatePayment(params: VerifyPaymentParams): Promise<{
    success: boolean;
    subscription: any;
    transaction: any;
  }> {
    // 1. Check duplicate payment ID
    const existingTx = billingStore.getTransactionByPaymentId(params.paymentId);
    if (existingTx && existingTx.status === 'succeeded') {
      log({
        level: 'WARN',
        operation: 'DUPLICATE_PAYMENT_CALLBACK',
        message: `Payment ${params.paymentId} was already successfully processed. Rejecting duplicate activation.`
      });
      const sub = billingStore.getSubscription(params.userId, params.tenantId);
      return {
        success: true,
        subscription: sub,
        transaction: existingTx
      };
    }

    // 2. Validate Order Registration
    const order = billingStore.getOrder(params.orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND', 404, `Payment order ${params.orderId} is unrecognized or expired.`);
    }

    // 3. Cryptographic Signature Verification
    const isSignatureValid = this.verifySignature(params.orderId, params.paymentId, params.signature);
    if (!isSignatureValid) {
      billingStore.recordTransaction({
        transaction_id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        order_id: params.orderId,
        payment_id: params.paymentId,
        user_id: params.userId,
        user_email: params.userEmail,
        tenant_id: params.tenantId || 'tenant_default',
        plan_id: order.planId,
        amount_paisa: order.amountPaisa,
        amount_inr: Math.round(order.amountPaisa / 100),
        currency: 'INR',
        status: 'failed',
        payment_method: params.paymentMethod || 'card',
        razorpay_signature: params.signature,
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Cryptographic signature mismatch: payment tamper detected.',
        created_at: new Date().toISOString(),
        receipt_number: `REC-${Date.now()}`
      });

      billingStore.logEvent(params.userId, 'PAYMENT_SIGNATURE_FAILED', `Signature check failed for order ${params.orderId}`, {
        orderId: params.orderId,
        paymentId: params.paymentId
      });

      throw new AppError('INVALID_SIGNATURE', 400, 'Payment verification failed: cryptographic signature mismatch.');
    }

    // 4. Record Successful Transaction
    const amountInr = Math.round(order.amountPaisa / 100);
    const receiptNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const transaction = billingStore.recordTransaction({
      transaction_id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      order_id: params.orderId,
      payment_id: params.paymentId,
      user_id: params.userId,
      user_email: params.userEmail,
      tenant_id: params.tenantId || 'tenant_default',
      plan_id: order.planId,
      amount_paisa: order.amountPaisa,
      amount_inr: amountInr,
      currency: 'INR',
      status: 'succeeded',
      payment_method: params.paymentMethod || 'upi',
      razorpay_signature: params.signature,
      created_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      receipt_number: receiptNumber
    });

    // 5. Activate Paid Subscription in Persistent Store
    const subscription = billingStore.activateSubscription({
      userId: params.userId,
      tenantId: params.tenantId,
      planId: order.planId,
      orderId: params.orderId,
      paymentId: params.paymentId,
      periodDays: 30
    });

    log({
      level: 'INFO',
      operation: 'PAYMENT_VERIFIED_AND_ACTIVATED',
      message: `Verified payment ${params.paymentId} (₹${amountInr}). Activated ${order.planId} for ${params.userEmail}.`
    });

    return {
      success: true,
      subscription,
      transaction
    };
  }

  /**
   * Handles payment failure reports.
   */
  public handlePaymentFailure(params: {
    orderId: string;
    paymentId?: string;
    userId: string;
    userEmail: string;
    tenantId?: string;
    planId: PlanId;
    errorCode?: string;
    errorDescription?: string;
  }): any {
    const order = billingStore.getOrder(params.orderId);
    const amountPaisa = order ? order.amountPaisa : 0;

    const tx = billingStore.recordTransaction({
      transaction_id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      order_id: params.orderId,
      payment_id: params.paymentId || `failed_${Date.now()}`,
      user_id: params.userId,
      user_email: params.userEmail,
      tenant_id: params.tenantId || 'tenant_default',
      plan_id: params.planId,
      amount_paisa: amountPaisa,
      amount_inr: Math.round(amountPaisa / 100),
      currency: 'INR',
      status: 'failed',
      error_code: params.errorCode || 'PAYMENT_FAILED',
      error_description: params.errorDescription || 'Payment transaction failed or cancelled by user.',
      created_at: new Date().toISOString(),
      receipt_number: `FAIL-${Date.now()}`
    });

    billingStore.logEvent(params.userId, 'PAYMENT_FAILED', `Payment attempt failed for order ${params.orderId}: ${params.errorDescription || 'Unknown error'}`, {
      orderId: params.orderId,
      errorCode: params.errorCode
    });

    return tx;
  }

  /**
   * Verifies incoming Webhook signature from Razorpay.
   */
  public verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!rawBody || !signature) return false;

    try {
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');

      if (sigBuf.length !== expBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /**
   * Processes a verified Razorpay webhook payload with strict event idempotency.
   */
  public async processWebhook(rawBody: string, signature: string, payload: any): Promise<{ handled: boolean; reason?: string }> {
    const isValid = this.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new AppError('INVALID_WEBHOOK_SIGNATURE', 401, 'Webhook HMAC SHA-256 signature mismatch.');
    }

    const eventId = payload?.event_id || payload?.id || `wh_${Date.now()}`;
    if (billingStore.isWebhookEventProcessed(eventId)) {
      return { handled: false, reason: 'Duplicate webhook event: already processed.' };
    }

    const event = payload?.event;
    const entity = payload?.payload?.payment?.entity || payload?.payload?.subscription?.entity || {};

    log({
      level: 'INFO',
      operation: 'WEBHOOK_RECEIVED',
      message: `Processing Razorpay webhook event: ${event} (Event ID: ${eventId})`
    });

    switch (event) {
      case 'payment.captured': {
        const orderId = entity.order_id;
        const paymentId = entity.id;
        const notes = entity.notes || {};
        const userId = notes.userId;
        const planId = notes.planId as PlanId;

        if (orderId && paymentId && userId && planId) {
          const registeredOrder = billingStore.getOrder(orderId);
          if (registeredOrder) {
            billingStore.activateSubscription({
              userId,
              planId,
              orderId,
              paymentId
            });
          }
        }
        break;
      }

      case 'payment.failed': {
        const orderId = entity.order_id;
        const notes = entity.notes || {};
        const userId = notes.userId || 'unknown';
        billingStore.logEvent(userId, 'WEBHOOK_PAYMENT_FAILED', `Razorpay reported payment failure for order ${orderId}`, {
          error_code: entity.error_code,
          error_description: entity.error_description
        });
        break;
      }

      case 'subscription.cancelled': {
        const notes = entity.notes || {};
        const userId = notes.userId;
        if (userId) {
          billingStore.cancelSubscription(userId);
        }
        break;
      }

      default:
        // Other events logged but no direct state mutation
        break;
    }

    billingStore.markWebhookEventProcessed(eventId);
    return { handled: true };
  }

  /**
   * Helper to generate a valid test signature for Sandbox/Test verification.
   */
  public generateTestSignature(orderId: string, paymentId: string): string {
    return crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }
}

export const razorpayService = new RazorpayService();
