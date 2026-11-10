const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { buildOrder, newOrderId, verifyWebhook, publicView, publicCatalog, todayIST } = require('../lib');

const customer = { name: 'Rama Rao', phone: '9876543210', email: 'Rama@Example.com' };
const cat = publicCatalog(
  [{ id: 'pushpa', name: 'Pushpalankara', amount: 2501 }, { id: 'anna', name: 'Annasantarpane', amount: 10001 }, { id: 'off', name: 'Old', amount: 5, active: false }],
  { open: true, dates: [{ date: '2099-01-01', label: 'Utsava' }, { date: '2000-01-01' }] },
);
const details = { familyMembers: [{ name: 'Rama' }], persons: 3 };

test('catalog hides switched-off sevas and past dates', () => {
  assert.deepStrictEqual(cat.sevas.map((s) => s.id), ['pushpa', 'anna']);
  assert.deepStrictEqual(cat.dates.map((d) => d.date), ['2099-01-01']);
});

test('seva price comes from the catalog, not the browser', () => {
  const o = buildOrder({ purpose: 'seva', sevaDate: '2099-01-01', sevas: ['pushpa', 'anna', 'pushpa'], amount: 1, customer, details }, cat);
  assert.strictEqual(o.amount, 2501 + 10001);
  assert.strictEqual(o.customer.email, 'rama@example.com');
  assert.strictEqual(o.details.persons, 3);
});

test('unknown seva, past date, closed booking, no names are rejected', () => {
  assert.throws(() => buildOrder({ purpose: 'seva', sevaDate: '2099-01-01', sevas: ['off'], customer, details }, cat), /not available/);
  assert.throws(() => buildOrder({ purpose: 'seva', sevaDate: '2000-01-01', sevas: ['pushpa'], customer, details }, cat), /date/);
  assert.throws(() => buildOrder({ purpose: 'seva', sevaDate: '2099-01-01', sevas: ['pushpa'], customer, details }, { ...cat, open: false }), /closed/);
  assert.throws(() => buildOrder({ purpose: 'seva', sevaDate: '2099-01-01', sevas: ['pushpa'], customer, details: {} }, cat), /name/);
});

test('donation limits', () => {
  assert.strictEqual(buildOrder({ purpose: 'donation', amount: 1001.9, customer, details: { purpose: 'Annadana' } }).amount, 1001);
  assert.throws(() => buildOrder({ purpose: 'donation', amount: 0, customer }), /amount/);
  assert.throws(() => buildOrder({ purpose: 'donation', amount: 600000, customer }), /amount/);
  assert.strictEqual(buildOrder({ purpose: 'donation', amount: 10, customer, details: { purpose: 'hack' } }).details.donationPurpose, 'General donation');
});

test('bad phone / email rejected', () => {
  assert.throws(() => buildOrder({ purpose: 'donation', amount: 10, customer: { ...customer, phone: '12345' } }), /mobile/);
  assert.throws(() => buildOrder({ purpose: 'donation', amount: 10, customer: { ...customer, email: 'x' } }), /email/);
});

test('order id and IST date', () => {
  assert.match(newOrderId(new Date('2026-11-10T05:00:00Z')), /^MSMPST-20261110-[A-F0-9]{10}$/);
  assert.strictEqual(todayIST(new Date('2026-11-10T20:00:00Z')), '2026-11-11');
});

test('webhook signature', () => {
  const body = Buffer.from('{"type":"PAYMENT_SUCCESS_WEBHOOK"}');
  const ts = '1731220000';
  const sig = crypto.createHmac('sha256', 'secret').update(ts + body.toString()).digest('base64');
  assert.ok(verifyWebhook(body, ts, sig, 'secret'));
  assert.ok(!verifyWebhook(body, ts, sig, 'wrong'));
  assert.ok(!verifyWebhook(body, '1', sig, 'secret'));
});

test('public view hides phone and email', () => {
  const v = publicView({ orderId: 'X', status: 'PAID', customer, items: [], details: {} }, 'Trust');
  assert.ok(!JSON.stringify(v).includes('9876543210'));
  assert.ok(!JSON.stringify(v).toLowerCase().includes('example.com'));
});
