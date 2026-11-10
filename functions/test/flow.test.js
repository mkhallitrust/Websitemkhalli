/**
 * End-to-end test of the payment server with a fake Cashfree and an in-memory Firestore.
 * Catalog seeding -> order -> webhook -> paid once -> receipt number + email -> status view.
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const Module = require('module');

process.env.CASHFREE_APP_ID = 'TEST_APP';
process.env.CASHFREE_SECRET_KEY = 'TEST_SECRET';
process.env.CASHFREE_ENV = 'sandbox';
process.env.SITE_URL = 'https://example.test';
process.env.GCLOUD_PROJECT = 'demo';

/* ---------- in-memory Firestore ---------- */
const store = new Map();
const snapOf = (path) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => structuredClone(store.get(path)) });
const docRef = (path) => ({
  path,
  async get() { return snapOf(path); },
  async set(v, o) { store.set(path, o && o.merge ? { ...(store.get(path) || {}), ...v } : structuredClone(v)); },
  async update(v) { if (!store.has(path)) throw new Error('no doc ' + path); store.set(path, { ...store.get(path), ...v }); },
});
let autoId = 0;
const fakeDb = {
  collection: (c) => ({
    doc: (id) => docRef(`${c}/${id}`),
    add: async (v) => { store.set(`${c}/auto${++autoId}`, v); },
    async get() {
      const docs = [...store.keys()].filter((k) => k.startsWith(c + '/') && k.split('/').length === 2).map(snapOf);
      return { empty: docs.length === 0, docs };
    },
  }),
  batch() {
    const ops = [];
    return { set: (r, v) => ops.push(() => r.set(v)), commit: async () => { for (const op of ops) await op(); } };
  },
  async runTransaction(fn) {
    return fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v) });
  },
};
const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => fakeDb, { FieldValue: { serverTimestamp: () => 'TS' } }) };
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === 'firebase-admin' ? fakeAdmin : origLoad.call(this, req, ...rest); };

/* ---------- fake Cashfree ---------- */
const calls = [];
let cfStatus = 'ACTIVE';
let cfAmount = 2501;
global.fetch = async (url, opt = {}) => {
  calls.push({ url, opt });
  const j = (o, s = 200) => ({ ok: s < 300, status: s, json: async () => o });
  if (url === 'https://sandbox.cashfree.com/pg/orders' && opt.method === 'POST') {
    assert.strictEqual(opt.headers['x-client-id'], 'TEST_APP');
    assert.strictEqual(opt.headers['x-api-version'], '2023-08-01');
    const b = JSON.parse(opt.body);
    return j({ cf_order_id: 1, order_id: b.order_id, payment_session_id: 'session_abc', order_status: 'ACTIVE' });
  }
  const m = url.match(/\/pg\/orders\/([^/]+)(\/payments)?$/);
  if (m && m[2]) return j([{ payment_status: 'SUCCESS', cf_payment_id: 99, bank_reference: 'UTR123', payment_group: 'upi' }]);
  if (m) return j({ order_status: cfStatus, order_amount: cfAmount });
  throw new Error('unexpected fetch ' + url);
};

const { api } = require('../index.js');
const call = (method, path, body, headers = {}, rawBody) => new Promise((resolve) => {
  const res = {
    statusCode: 200, headers: {},
    status(c) { this.statusCode = c; return this; },
    set(k, v) { this.headers[k] = v; return this; },
    json(o) { resolve({ status: this.statusCode, body: o }); },
    send(o) { resolve({ status: this.statusCode, body: o }); },
  };
  api({ method, path, body, headers, ip: '1.2.3.4', rawBody: rawBody || Buffer.from(JSON.stringify(body || {})) }, res);
});
const sign = (raw, ts) => crypto.createHmac('sha256', 'TEST_SECRET').update(ts + raw).digest('base64');

const customer = { name: 'Rama Rao', phone: '9876543210', email: 'rama@example.com' };
const details = { familyMembers: [{ name: 'Rama Rao', gotra: 'Kashyapa', nakshatra: 'Rohini' }], persons: 2 };
let orderId, sevaDate;

test('catalog: seeds Firestore on first use and lists only future open dates', async () => {
  const r = await call('GET', '/api/catalog');
  assert.strictEqual(r.status, 200);
  assert.ok(store.has('sevas/pushpalankara'), 'sevas seeded');
  assert.ok(store.has('settings/booking'), 'booking settings seeded');
  // admin adds a past date, a closed date and a future date
  store.set('settings/booking', { open: true, dates: [
    { date: '2020-01-01', label: 'old', open: true },
    { date: '2099-05-01', label: 'closed', open: false },
    { date: '2099-04-12', label: 'Hanuman Jayanti', open: true },
  ] });
  store.set('sevas/annasantarpane', { ...store.get('sevas/annasantarpane'), active: false });
  await new Promise((r2) => setTimeout(r2, 5));
  const r2 = await call('POST', '/api/orders', { purpose: 'seva', sevaDate: '2020-01-01', sevas: ['pushpalankara'], customer, details });
  assert.strictEqual(r2.status, 400, 'past date refused');
  sevaDate = '2099-04-12';
});

test('create seva order: price from Firestore, not from the browser', async () => {
  const r = await call('POST', '/api/orders', { purpose: 'seva', sevaDate, sevas: ['pushpalankara'], amount: 1, customer, details });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.paymentSessionId, 'session_abc');
  orderId = r.body.orderId;
  const sent = JSON.parse(calls.filter((c) => c.url.endsWith('/pg/orders')).pop().opt.body);
  assert.strictEqual(sent.order_amount, 2501);
  assert.strictEqual(sent.order_meta.return_url, 'https://example.test/payment-status/?order_id={order_id}');
  const o = store.get(`orders/${orderId}`);
  assert.strictEqual(o.status, 'ACTIVE');
  assert.strictEqual(o.sevaDate, sevaDate);
  assert.strictEqual(o.performed, false);
});

test('switched-off seva, closed date and missing names are refused', async () => {
  for (const body of [
    { purpose: 'seva', sevaDate, sevas: ['annasantarpane'], customer, details },
    { purpose: 'seva', sevaDate: '2099-05-01', sevas: ['pushpalankara'], customer, details },
    { purpose: 'seva', sevaDate, sevas: ['pushpalankara'], customer, details: { familyMembers: [] } },
  ]) {
    const r = await call('POST', '/api/orders', body);
    assert.strictEqual(r.status, 400, JSON.stringify(body));
  }
});

test('webhook with wrong signature is refused', async () => {
  const body = { type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: orderId }, payment: { payment_status: 'SUCCESS', payment_amount: 2501 } } };
  const r = await call('POST', '/api/webhook', body, { 'x-webhook-timestamp': '1', 'x-webhook-signature': 'bad' }, Buffer.from(JSON.stringify(body)));
  assert.strictEqual(r.status, 401);
  assert.strictEqual(store.get(`orders/${orderId}`).status, 'ACTIVE');
});

test('signed webhook marks paid once, gives receipt number and queues one email', async () => {
  const body = { type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: orderId }, payment: { payment_status: 'SUCCESS', payment_amount: 2501, cf_payment_id: 55, bank_reference: 'BANKREF1', payment_group: 'upi' } } };
  const raw = JSON.stringify(body), ts = '1731220000';
  for (let i = 0; i < 2; i++) {          // Cashfree may send the same webhook twice
    const r = await call('POST', '/api/webhook', body, { 'x-webhook-timestamp': ts, 'x-webhook-signature': sign(raw, ts) }, Buffer.from(raw));
    assert.strictEqual(r.status, 200);
  }
  const o = store.get(`orders/${orderId}`);
  assert.strictEqual(o.status, 'PAID');
  assert.match(o.receiptNo, /^MSMPST\/\d{4}-\d{2}\/00001$/);
  const mail = store.get(`mail/${orderId}`);
  assert.deepStrictEqual(mail.to, ['rama@example.com']);
  assert.deepStrictEqual(mail.bcc, ['mkhallitrust@gmail.com']);
  assert.match(mail.message.subject, /MSMPST\/.*Seva booking/);
  assert.match(mail.message.html, /Kashyapa/);
  assert.match(mail.message.html, /12-04-2099/);
  assert.strictEqual([...store.keys()].filter((k) => k.startsWith('mail/')).length, 1);
});

test('status endpoint returns receipt without phone/email', async () => {
  const r = await call('GET', `/api/orders/${orderId}`);
  assert.strictEqual(r.body.status, 'PAID');
  assert.strictEqual(r.body.sevaDate, '12-04-2099');
  assert.deepStrictEqual(r.body.names, ['Rama Rao']);
  assert.ok(!JSON.stringify(r.body).includes('9876543210'));
  assert.ok(!JSON.stringify(r.body).includes('rama@example.com'));
});

test('status endpoint confirms with Cashfree when the webhook is late', async () => {
  const c = await call('POST', '/api/orders', { purpose: 'donation', amount: 2501, customer, details: { purpose: 'Annadana' } });
  cfStatus = 'PAID';
  const r = await call('GET', `/api/orders/${c.body.orderId}`);
  assert.strictEqual(r.body.status, 'PAID');
  assert.match(r.body.receiptNo, /00002$/);
  assert.strictEqual(r.body.paymentRef, 'UTR123');
  assert.ok(store.has(`mail/${c.body.orderId}`));
});

test('amount mismatch is held for review, not marked paid', async () => {
  const c = await call('POST', '/api/orders', { purpose: 'donation', amount: 5001, customer });
  const body = { type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: c.body.orderId }, payment: { payment_status: 'SUCCESS', payment_amount: 1 } } };
  const raw = JSON.stringify(body), ts = '2';
  await call('POST', '/api/webhook', body, { 'x-webhook-timestamp': ts, 'x-webhook-signature': sign(raw, ts) }, Buffer.from(raw));
  assert.strictEqual(store.get(`orders/${c.body.orderId}`).status, 'REVIEW');
  assert.ok(!store.has(`mail/${c.body.orderId}`));
});
