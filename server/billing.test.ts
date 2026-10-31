import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { billingStore } from './billingStore.ts';
import { razorpayService } from './razorpay.ts';
import { getUserEntitlementStatus, checkFeatureEntitlement } from './entitlements.ts';
import { formatInrCurrency } from '../src/shared/plans.ts';

test('DOCUAGENT AI SaaS Billing Suite', async (t) => {
  // Test 1: Plan definitions & INR pricing retrieval
  await t.test('1. Retrieval of plan definitions and prices in Indian Rupees (INR)', () => {
    const plans = billingStore.getPlans();
    assert.ok(plans.free, 'Free plan must exist');
    assert.ok(plans.starter, 'Starter plan must exist');
    assert.ok(plans.professional, 'Professional plan must exist');
    assert.ok(plans.business, 'Business plan must exist');
    assert.ok(plans.enterprise, 'Enterprise plan must exist');

    assert.equal(plans.free.priceInrMonthly, 0, 'Free plan must be ₹0');
    assert.equal(plans.starter.priceInrMonthly, 499, 'Starter plan must be ₹499');
    assert.equal(plans.professional.priceInrMonthly, 1499, 'Professional plan must be ₹1,499');
    assert.equal(plans.business.priceInrMonthly, 3999, 'Business plan must be ₹3,999');

    assert.equal(plans.free.documentAllowanceMonthly, 10, 'Free plan quota is 10 docs/mo');
    assert.equal(plans.starter.documentAllowanceMonthly, 50, 'Starter plan quota is 50 docs/mo');
    assert.equal(plans.professional.documentAllowanceMonthly, 250, 'Professional plan quota is 250 docs/mo');
    assert.equal(plans.business.documentAllowanceMonthly, 1000, 'Business plan quota is 1000 docs/mo');

    assert.equal(formatInrCurrency(499), '₹499');
    assert.equal(formatInrCurrency(1499), '₹1,499');
    assert.equal(formatInrCurrency(3999), '₹3,999');
  });

  // Test 2: Default assignment of the Free plan to new users
  await t.test('2. Default assignment of Free plan with 10 documents monthly allowance to new users', () => {
    const testUserId = `user_test_free_${Date.now()}`;
    const sub = billingStore.getSubscription(testUserId);

    assert.ok(sub);
    assert.equal(sub.plan_id, 'free');
    assert.equal(sub.status, 'active');

    const status = getUserEntitlementStatus(testUserId);
    assert.equal(status.plan.id, 'free');
    assert.equal(status.documentAllowance, 10);
    assert.equal(status.documentsUsed, 0);
    assert.equal(status.remainingAllowance, 10);
    assert.equal(status.isQuotaExhausted, false);
  });

  // Test 3: Accurate usage tracking per document processed
  await t.test('3. Accurate usage tracking per document processed', () => {
    const testUserId = `user_test_usage_${Date.now()}`;

    const record1 = billingStore.recordDocumentProcessed(testUserId, { pages: 1, success: true });
    assert.equal(record1.documents_uploaded, 1);

    const record2 = billingStore.recordDocumentProcessed(testUserId, { pages: 2, success: true });
    assert.equal(record2.documents_uploaded, 2);

    const status = getUserEntitlementStatus(testUserId);
    assert.equal(status.documentsUsed, 2);
    assert.equal(status.remainingAllowance, 8);
  });

  // Test 4: Deduplication of failed vs successful jobs
  await t.test('4. Tracking failed vs successful jobs and remaining allowance', () => {
    const testUserId = `user_test_dedup_${Date.now()}`;

    // Successful document consumes 1
    const s1 = billingStore.recordDocumentProcessed(testUserId, { success: true });
    assert.equal(s1.documents_uploaded, 1);
    assert.equal(s1.successful_jobs, 1);

    // Failed processing job does not count against upload allowance
    const f1 = billingStore.recordDocumentProcessed(testUserId, { success: false });
    assert.equal(f1.documents_uploaded, 1, 'Failed job must not consume document upload allowance');
    assert.equal(f1.failed_jobs, 1);

    const status = getUserEntitlementStatus(testUserId);
    assert.equal(status.documentsUsed, 1);
    assert.equal(status.remainingAllowance, 9);
  });

  // Test 5: Rejection of document processing when quota is exhausted (HTTP 429 logic)
  await t.test('5. Quota exhaustion triggers limit boundary', () => {
    const testUserId = `user_test_exhaust_${Date.now()}`;

    // Record 10 documents
    for (let i = 1; i <= 10; i++) {
      billingStore.recordDocumentProcessed(testUserId, { success: true });
    }

    const statusAfter10 = getUserEntitlementStatus(testUserId);
    assert.equal(statusAfter10.documentsUsed, 10);
    assert.equal(statusAfter10.remainingAllowance, 0);
    assert.equal(statusAfter10.isQuotaExhausted, true);

    // canProcessDocument should now return allowed: false
    const quotaCheck = billingStore.canProcessDocument(testUserId);
    assert.equal(quotaCheck.allowed, false);
    assert.equal(quotaCheck.used, 10);
    assert.equal(quotaCheck.allowance, 10);
    assert.equal(quotaCheck.warningLevel, 'exhausted_100');
  });

  // Test 6: Premium feature restrictions on Free plan (HTTP 403 logic)
  await t.test('6. Premium feature restrictions on Free plan', () => {
    const testUserId = `user_test_features_${Date.now()}`;

    // Free tier features
    const basicUpload = checkFeatureEntitlement(testUserId, 'basic_upload');
    assert.equal(basicUpload.allowed, true);

    const basicValidation = checkFeatureEntitlement(testUserId, 'basic_validation');
    assert.equal(basicValidation.allowed, true);

    // Starter feature locked on Free
    const bulkUpload = checkFeatureEntitlement(testUserId, 'bulk_upload');
    assert.equal(bulkUpload.allowed, false);
    assert.equal(bulkUpload.requiredPlan, 'starter');

    // Professional features locked on Free
    const aiExtraction = checkFeatureEntitlement(testUserId, 'ai_extraction');
    assert.equal(aiExtraction.allowed, false);
    assert.equal(aiExtraction.requiredPlan, 'professional');

    const lineItems = checkFeatureEntitlement(testUserId, 'line_item_extraction');
    assert.equal(lineItems.allowed, false);
    assert.equal(lineItems.requiredPlan, 'professional');

    // Business feature locked on Free
    const customRouting = checkFeatureEntitlement(testUserId, 'custom_routing_rules');
    assert.equal(customRouting.allowed, false);
    assert.equal(customRouting.requiredPlan, 'business');
  });

  // Test 7: Creation of Razorpay payment orders with server-computed prices
  await t.test('7. Creation of Razorpay payment orders with trusted server-calculated prices in INR', async () => {
    const testUserId = `user_test_order_${Date.now()}`;

    // Starter order: ₹499 = 49900 paisa
    const starterOrder = await razorpayService.createOrder({
      userId: testUserId,
      userEmail: 'user@example.com',
      planId: 'starter'
    });
    assert.ok(starterOrder.orderId);
    assert.equal(starterOrder.amountPaisa, 49900);
    assert.equal(starterOrder.amountInr, 499);
    assert.equal(starterOrder.currency, 'INR');

    // Professional order: ₹1,499 = 149900 paisa
    const proOrder = await razorpayService.createOrder({
      userId: testUserId,
      userEmail: 'user@example.com',
      planId: 'professional'
    });
    assert.ok(proOrder.orderId);
    assert.equal(proOrder.amountPaisa, 149900);
    assert.equal(proOrder.amountInr, 1499);
    assert.equal(proOrder.currency, 'INR');

    // Free plan order creation must reject
    await assert.rejects(
      async () => {
        await razorpayService.createOrder({
          userId: testUserId,
          userEmail: 'user@example.com',
          planId: 'free'
        });
      },
      (err: any) => /free/i.test(err.message)
    );
  });

  // Test 8: Signature verification using HMAC SHA-256 activating plan
  await t.test('8. HMAC SHA-256 signature verification activating paid plan', async () => {
    const testUserId = `user_test_verify_${Date.now()}`;
    const order = await razorpayService.createOrder({
      userId: testUserId,
      userEmail: 'testuser@example.com',
      planId: 'starter'
    });
    const paymentId = `pay_test_${Date.now()}`;

    const validSig = razorpayService.generateTestSignature(order.orderId, paymentId);
    assert.equal(razorpayService.verifySignature(order.orderId, paymentId, validSig), true);

    const verifyResult = await razorpayService.verifyAndActivatePayment({
      orderId: order.orderId,
      paymentId,
      signature: validSig,
      userId: testUserId,
      userEmail: 'testuser@example.com',
      planId: 'starter'
    });

    assert.equal(verifyResult.success, true);
    assert.equal(verifyResult.subscription.plan_id, 'starter');
    assert.equal(verifyResult.subscription.status, 'active');
    assert.equal(verifyResult.transaction.status, 'succeeded');
    assert.equal(verifyResult.transaction.amount_inr, 499);

    // User now has starter entitlements
    const bulkEntitlement = checkFeatureEntitlement(testUserId, 'bulk_upload');
    assert.equal(bulkEntitlement.allowed, true);
  });

  // Test 9: Rejection of tampered or invalid payment signatures
  await t.test('9. Rejection of tampered or invalid payment signatures', async () => {
    const testUserId = `user_test_tamper_${Date.now()}`;
    const order = await razorpayService.createOrder({
      userId: testUserId,
      userEmail: 'tamper@example.com',
      planId: 'professional'
    });
    const paymentId = `pay_tamper_${Date.now()}`;

    const fakeSignature = '0000000000000000000000000000000000000000000000000000000000000000';
    assert.equal(razorpayService.verifySignature(order.orderId, paymentId, fakeSignature), false);

    await assert.rejects(
      async () => {
        await razorpayService.verifyAndActivatePayment({
          orderId: order.orderId,
          paymentId,
          signature: fakeSignature,
          userId: testUserId,
          userEmail: 'tamper@example.com',
          planId: 'professional'
        });
      },
      (err: any) => /signature/i.test(err.message) || err.code === 'SIGNATURE_VERIFICATION_FAILED'
    );
  });

  // Test 10: Prevention of duplicate payment callback processing
  await t.test('10. Duplicate payment callback prevention (idempotent)', async () => {
    const testUserId = `user_test_idemp_${Date.now()}`;
    const order = await razorpayService.createOrder({
      userId: testUserId,
      userEmail: 'idemp@example.com',
      planId: 'professional'
    });
    const paymentId = `pay_idemp_${Date.now()}`;
    const signature = razorpayService.generateTestSignature(order.orderId, paymentId);

    const firstAttempt = await razorpayService.verifyAndActivatePayment({
      orderId: order.orderId,
      paymentId,
      signature,
      userId: testUserId,
      userEmail: 'idemp@example.com',
      planId: 'professional'
    });
    assert.equal(firstAttempt.success, true);

    // Second call with same order and payment ID returns existing transaction without double charge
    const duplicateAttempt = await razorpayService.verifyAndActivatePayment({
      orderId: order.orderId,
      paymentId,
      signature,
      userId: testUserId,
      userEmail: 'idemp@example.com',
      planId: 'professional'
    });
    assert.equal(duplicateAttempt.success, true);
    assert.equal(duplicateAttempt.subscription.plan_id, 'professional');
  });

  // Test 11: Webhook signature verification and handling
  await t.test('11. Razorpay Webhook signature verification and event processing', async () => {
    const testUserId = `user_test_webhook_${Date.now()}`;
    const order = await razorpayService.createOrder({
      userId: testUserId,
      userEmail: 'webhook@example.com',
      planId: 'business'
    });
    const paymentId = `pay_hook_${Date.now()}`;

    const webhookPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: order.orderId,
            amount: 399900,
            currency: 'INR',
            status: 'captured',
            notes: {
              userId: testUserId,
              planId: 'business'
            }
          }
        }
      }
    });

    // Compute HMAC
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_whsec_docuagent_audit_2026';
    const validSignature = crypto.createHmac('sha256', webhookSecret).update(webhookPayload).digest('hex');

    const result = await razorpayService.processWebhook(webhookPayload, validSignature, JSON.parse(webhookPayload));
    assert.equal(result.handled, true);

    // Confirm business subscription activated
    const sub = billingStore.getSubscription(testUserId);
    assert.equal(sub.plan_id, 'business');
    assert.equal(sub.status, 'active');
  });

  // Test 12: Webhook event idempotency ensuring duplicate webhooks do not double-process
  await t.test('12. Webhook event idempotency cache prevents duplicate processing', async () => {
    const testUserId = `user_test_hook_dup_${Date.now()}`;
    const order = await razorpayService.createOrder({
      userId: testUserId,
      userEmail: 'hookdup@example.com',
      planId: 'starter'
    });
    const paymentId = `pay_hook_dup_${Date.now()}`;

    const eventId = `evt_test_${Date.now()}`;
    const webhookPayload = JSON.stringify({
      entity: 'event',
      id: eventId,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: order.orderId,
            amount: 49900,
            currency: 'INR',
            status: 'captured',
            notes: {
              userId: testUserId,
              planId: 'starter'
            }
          }
        }
      }
    });

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_whsec_docuagent_audit_2026';
    const signature = crypto.createHmac('sha256', webhookSecret).update(webhookPayload).digest('hex');
    const parsedPayload = JSON.parse(webhookPayload);

    const first = await razorpayService.processWebhook(webhookPayload, signature, parsedPayload);
    assert.equal(first.handled, true);

    const second = await razorpayService.processWebhook(webhookPayload, signature, parsedPayload);
    assert.equal(second.handled, false);
    assert.match(second.reason || '', /duplicate/i);
  });

  // Test 13: Subscription cancellation workflow
  await t.test('13. Subscription cancellation and status fallback to Free', () => {
    const testUserId = `user_test_cancel_${Date.now()}`;

    // Activate starter
    billingStore.activateSubscription({
      userId: testUserId,
      planId: 'starter',
      orderId: `ord_cancel_${Date.now()}`,
      paymentId: `pay_cancel_${Date.now()}`
    });
    const initialSub = billingStore.getSubscription(testUserId);
    assert.equal(initialSub.plan_id, 'starter');

    // Cancel subscription
    const cancelled = billingStore.cancelSubscription(testUserId);
    assert.equal(cancelled.status, 'cancelled');

    // Manually mark expired to test fallback
    billingStore.setSubscriptionStatus(testUserId, 'expired');
    const statusAfterExpiry = getUserEntitlementStatus(testUserId);
    assert.equal(statusAfterExpiry.plan.id, 'free');
  });

  // Test 14: Admin dynamic plan updates (price and quotas) without frontend rebuild
  await t.test('14. Admin dynamic plan pricing and quota updates', async () => {
    const originalProPrice = billingStore.getPlan('professional').priceInrMonthly;
    const originalProDocs = billingStore.getPlan('professional').documentAllowanceMonthly;

    // Admin updates Professional plan: ₹1,599 and 300 docs
    const updated = billingStore.updatePlan('professional', {
      priceInrMonthly: 1599,
      documentAllowanceMonthly: 300
    });

    assert.equal(updated.priceInrMonthly, 1599);
    assert.equal(updated.documentAllowanceMonthly, 300);

    // Server-side order creation reflects the new dynamic price
    const order = await razorpayService.createOrder({
      userId: `user_dyn_${Date.now()}`,
      userEmail: 'dyn@example.com',
      planId: 'professional'
    });
    assert.equal(order.amountPaisa, 159900, 'Order amount in paisa must reflect updated price of ₹1,599');

    // Restore original
    billingStore.updatePlan('professional', {
      priceInrMonthly: originalProPrice,
      documentAllowanceMonthly: originalProDocs
    });
  });

  // Test 15: Admin revenue calculations in INR reflect only verified transactions
  await t.test('15. Admin revenue metrics in INR reflect only succeeded payments', () => {
    const initialStats = billingStore.getOverviewStats(10);
    const initialRev = initialStats.totalVerifiedRevenueInr;

    // Record a failed transaction
    billingStore.recordTransaction({
      transaction_id: `tx_fail_${Date.now()}`,
      order_id: `ord_fail_${Date.now()}`,
      payment_id: `pay_fail_${Date.now()}`,
      user_id: `user_fail_${Date.now()}`,
      user_email: 'user_fail@example.com',
      tenant_id: 'tenant_default',
      receipt_number: `RCPT-FAIL-${Date.now()}`,
      plan_id: 'starter',
      amount_paisa: 49900,
      amount_inr: 499,
      currency: 'INR',
      status: 'failed',
      payment_method: 'card',
      error_code: 'PAYMENT_CANCELLED',
      created_at: new Date().toISOString()
    });

    const statsAfterFail = billingStore.getOverviewStats(10);
    assert.equal(statsAfterFail.totalVerifiedRevenueInr, initialRev, 'Failed transaction must not add to revenue');
    assert.equal(statsAfterFail.paymentFailures, initialStats.paymentFailures + 1);

    // Record a verified transaction
    billingStore.recordTransaction({
      transaction_id: `tx_rev_${Date.now()}`,
      order_id: `ord_rev_${Date.now()}`,
      payment_id: `pay_rev_${Date.now()}`,
      user_id: `user_rev_${Date.now()}`,
      user_email: 'user_rev@example.com',
      tenant_id: 'tenant_default',
      receipt_number: `RCPT-REV-${Date.now()}`,
      plan_id: 'starter',
      amount_paisa: 49900,
      amount_inr: 499,
      currency: 'INR',
      status: 'succeeded',
      payment_method: 'card',
      created_at: new Date().toISOString()
    });

    const statsAfterSuccess = billingStore.getOverviewStats(10);
    assert.equal(statsAfterSuccess.totalVerifiedRevenueInr, initialRev + 499, 'Succeeded payment must increment revenue by ₹499');
  });
});
