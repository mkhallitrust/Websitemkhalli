/**
 * Payment server for Mavinakayinahalli Sri Mukhyaprana Seva Trust (R)
 * Firebase Cloud Functions (2nd gen) + Firestore + Cashfree Payments (PG API 2023-08-01)
 *
 * Firebase Hosting sends /api/** here (see firebase.json):
 *   GET  /api/catalog          sevas + open seva dates (from Firestore; edited in /admin/)
 *   POST /api/orders           create a Cashfree order  -> { orderId, paymentSessionId, mode }
 *   GET  /api/orders/:orderId  status + receipt (asks Cashfree directly if not yet paid)
 *   POST /api/webhook          Cashfree payment webhook (signature checked)
 *
 * Firestore: sevas/{id}, settings/booking, orders/{orderId}, counters/receipts-YYYY-YY,
 *            mail/{id} (receipt emails, sent by the "Trigger Email" extension), admins/{email}
 * Secrets (never in code):  firebase functions:secrets:set CASHFREE_APP_ID
 *                           firebase functions:secrets:set CASHFREE_SECRET_KEY
 * Settings: functions/.env  (CASHFREE_ENV=sandbox|production, SITE_URL)
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { buildOrder, newOrderId, verifyWebhook, publicView, publicCatalog, receiptMail } = require('./lib');
const seed = require('./catalog');

admin.initializeApp();
const db = admin.firestore();

const CASHFREE_APP_ID = defineSecret('CASHFREE_APP_ID');
const CASHFREE_SECRET_KEY = defineSecret('CASHFREE_SECRET_KEY');
const CASHFREE_ENV = defineString('CASHFREE_ENV', { default: 'sandbox' });
const SITE_URL = defineString('SITE_URL', { default: 'https://www.mkhallipranadevaru.com' });

const PAYEE = 'Mavinakayinahalli Sri Mukhyaprana Seva Trust (R)';
const TRUST = {
  name: PAYEE,
  regNo: 'GBD-4-00153-2013-14',
  address: 'Anjaneya Temple, Arasalbande, Mavinakayinahalli, Karnataka 561211',
  email: 'mkhallitrust@gmail.com',
  phone: '+91 94480 76834',
};

/* ---------------- catalog (sevas + dates) ---------------- */
let catalogCache = null, catalogAt = 0;
async function loadCatalog(fresh = false) {
  if (!fresh && catalogCache && Date.now() - catalogAt < 30 * 1000) return catalogCache;
  let [sevaSnap, bookingSnap] = await Promise.all([db.collection('sevas').get(), db.collection('settings').doc('booking').get()]);
  if (sevaSnap.empty && !bookingSnap.exists) {
    // first run: copy the starting list into Firestore so the admin portal can edit it
    const batch = db.batch();
    seed.sevas.forEach((s, i) => batch.set(db.collection('sevas').doc(s.id), { ...s, active: true, order: i + 1 }));
    batch.set(db.collection('settings').doc('booking'), seed.booking);
    await batch.commit();
    logger.info('Seeded sevas and booking settings');
    [sevaSnap, bookingSnap] = await Promise.all([db.collection('sevas').get(), db.collection('settings').doc('booking').get()]);
  }
  const sevas = sevaSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
  catalogCache = publicCatalog(sevas, bookingSnap.exists ? bookingSnap.data() : null);
  catalogAt = Date.now();
  return catalogCache;
}
const API_VERSION = '2023-08-01';
const isProd = () => CASHFREE_ENV.value() === 'production';
const cfBase = () => (isProd() ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg');

/* ---------------- Cashfree API ---------------- */
async function cashfree(method, path, body, idempotencyKey) {
  const headers = {
    'x-client-id': CASHFREE_APP_ID.value(),
    'x-client-secret': CASHFREE_SECRET_KEY.value(),
    'x-api-version': API_VERSION,
    Accept: 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
  const r = await fetch(cfBase() + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.message || `Cashfree ${r.status}`);
    e.status = r.status; e.cf = j;
    throw e;
  }
  return j;
}

/* ---------------- small per-instance rate limit ---------------- */
const hits = new Map();
function limited(ip, max = 15, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

/* ---------------- receipts ---------------- */
function financialYear(d = new Date()) {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;      // April–March
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Mark an order paid exactly once; gives it the next receipt number. Returns the order. */
async function markPaid(orderId, payment) {
  const ref = db.collection('orders').doc(orderId);
  const fy = financialYear();
  const counterRef = db.collection('counters').doc(`receipts-${fy}`);
  let firstTime = false;
  const order = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('order not found: ' + orderId);
    const o = snap.data();
    if (o.status === 'PAID') return o;
    const paidAmount = Number(payment.payment_amount != null ? payment.payment_amount : o.amount);
    if (Math.round(paidAmount * 100) !== Math.round(o.amount * 100)) {
      logger.error('Amount mismatch', { orderId, expected: o.amount, paidAmount });
      tx.update(ref, { status: 'REVIEW', reviewReason: 'amount mismatch', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return { ...o, status: 'REVIEW' };
    }
    const c = await tx.get(counterRef);
    const n = (c.exists ? c.data().n : 0) + 1;
    tx.set(counterRef, { n }, { merge: true });
    const receiptNo = `MSMPST/${fy}/${String(n).padStart(5, '0')}`;
    const upd = {
      status: 'PAID',
      receiptNo,
      paidAt: new Date().toISOString(),
      payment: {
        cfPaymentId: String(payment.cf_payment_id || ''),
        bankReference: String(payment.bank_reference || ''),
        group: String(payment.payment_group || ''),
        time: String(payment.payment_time || ''),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    tx.update(ref, upd);
    firstTime = true;
    return { ...o, ...upd };
  });
  if (firstTime) await afterPaid(order).catch((e) => logger.error('afterPaid failed', { orderId, err: e.message }));
  return order;
}

/** After payment: queue the receipt email (devotee + copy to the Trust). */
async function afterPaid(o) {
  const mail = receiptMail(o, { ...TRUST, site: SITE_URL.value().replace(/\/$/, '') });
  await db.collection('mail').doc(o.orderId).set(mail);
  await db.collection('orders').doc(o.orderId).update({ receiptEmailQueued: true });
}

/* ---------------- handlers ---------------- */
async function createOrder(req, res) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  if (limited(ip)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
  let o;
  const catalog = req.body && req.body.purpose === 'seva' ? await loadCatalog(true) : null;
  try { o = buildOrder(req.body, catalog); } catch (e) { return res.status(400).json({ error: e.message }); }

  // Until the Trust's Cashfree account is approved the keys are the placeholder "PENDING"
  if (!/^[A-Za-z0-9_-]{8,}$/.test(CASHFREE_APP_ID.value() || '') || CASHFREE_APP_ID.value() === 'PENDING') {
    return res.status(503).json({ error: 'Online payment will open shortly. To book a seva now, please call the Trust on +91 94480 76834.' });
  }
  const orderId = newOrderId();
  const site = SITE_URL.value().replace(/\/$/, '');
  const cfOrder = await cashfree('POST', '/orders', {
    order_id: orderId,
    order_amount: o.amount,
    order_currency: 'INR',
    customer_details: {
      customer_id: 'c' + o.customer.phone,
      customer_name: o.customer.name,
      customer_email: o.customer.email,
      customer_phone: o.customer.phone,
    },
    order_meta: {
      return_url: `${site}/payment-status/?order_id={order_id}`,
      notify_url: `${site}/api/webhook`,
    },
    order_note: o.note,
    order_tags: { purpose: o.purpose },
  }, orderId);

  await db.collection('orders').doc(orderId).set({
    orderId,
    status: 'ACTIVE',
    purpose: o.purpose,
    amount: o.amount,
    items: o.items,
    sevaDate: o.sevaDate,
    customer: o.customer,
    details: o.details,
    performed: false,
    cfOrderId: String(cfOrder.cf_order_id || ''),
    env: isProd() ? 'production' : 'sandbox',
    createdAt: new Date().toISOString(),
  });
  return res.json({ orderId, paymentSessionId: cfOrder.payment_session_id, mode: isProd() ? 'production' : 'sandbox' });
}

async function getOrder(req, res, orderId) {
  if (!/^MSMPST-\d{8}-[A-F0-9]{10}$/.test(orderId)) return res.status(400).json({ error: 'Invalid order ID' });
  const ref = db.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Order not found' });
  let o = snap.data();
  if (o.status !== 'PAID' && o.status !== 'REVIEW') {
    // don't wait for the webhook: ask Cashfree
    const cfo = await cashfree('GET', `/orders/${encodeURIComponent(orderId)}`);
    if (cfo.order_status === 'PAID') {
      const pays = await cashfree('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
      const ok = (Array.isArray(pays) ? pays : []).find((p) => p.payment_status === 'SUCCESS') || {};
      o = await markPaid(orderId, { payment_amount: cfo.order_amount, ...ok });
    } else if (cfo.order_status && cfo.order_status !== o.status) {
      const status = cfo.order_status === 'EXPIRED' || cfo.order_status === 'TERMINATED' ? 'FAILED' : cfo.order_status;
      await ref.update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      o = { ...o, status };
    }
  }
  res.set('Cache-Control', 'no-store');
  return res.json(publicView(o, PAYEE));
}

async function webhook(req, res) {
  const ok = verifyWebhook(req.rawBody, req.headers['x-webhook-timestamp'], req.headers['x-webhook-signature'], CASHFREE_SECRET_KEY.value());
  if (!ok) { logger.warn('Webhook with bad signature'); return res.status(401).send('bad signature'); }
  const evt = req.body || {};
  const orderId = evt.data && evt.data.order && evt.data.order.order_id;
  const payment = (evt.data && evt.data.payment) || {};
  if (!orderId || !String(orderId).startsWith('MSMPST-')) return res.status(200).send('ignored');
  try {
    if (evt.type === 'PAYMENT_SUCCESS_WEBHOOK' && payment.payment_status === 'SUCCESS') {
      await markPaid(orderId, payment);
    } else if (evt.type === 'PAYMENT_FAILED_WEBHOOK' || evt.type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
      const ref = db.collection('orders').doc(orderId);
      await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (s.exists && s.data().status !== 'PAID') tx.update(ref, { status: 'FAILED', lastEvent: evt.type, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });
    }
    await db.collection('webhookLog').add({ orderId, type: evt.type || '', at: new Date().toISOString(), cfPaymentId: String(payment.cf_payment_id || '') });
  } catch (e) {
    logger.error('webhook processing failed', { orderId, err: e.message });
    return res.status(500).send('retry');        // Cashfree retries
  }
  return res.status(200).send('ok');
}

exports.api = onRequest(
  {
    region: 'asia-south1',
    secrets: [CASHFREE_APP_ID, CASHFREE_SECRET_KEY],
    maxInstances: 10,
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (req, res) => {
    const path = req.path.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    try {
      if (req.method === 'GET' && path === '/catalog') {
        res.set('Cache-Control', 'public, max-age=30');
        return res.json(await loadCatalog());
      }
      if (req.method === 'POST' && path === '/orders') return await createOrder(req, res);
      const m = path.match(/^\/orders\/([^/]+)$/);
      if (req.method === 'GET' && m) return await getOrder(req, res, decodeURIComponent(m[1]));
      if (req.method === 'POST' && path === '/webhook') return await webhook(req, res);
      if (req.method === 'GET' && path === '/health') return res.json({ ok: true, mode: isProd() ? 'production' : 'sandbox' });
      return res.status(404).json({ error: 'Not found' });
    } catch (e) {
      logger.error('api error', { path, err: e.message, cf: e.cf });
      return res.status(502).json({ error: 'The payment service is not responding. Please try again in a minute.' });
    }
  }
);
