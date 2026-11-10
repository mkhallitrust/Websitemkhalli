/** Pure helpers (no Firebase) so they can be unit-tested. */
const crypto = require('crypto');
const seed = require('./catalog');

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Today's date in India as YYYY-MM-DD */
function todayIST(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
/** 2027-02-20 -> 20-02-2027 */
const dmy = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('-') : iso || '');

/**
 * What devotees may book right now.
 * sevas: array of Firestore seva docs; booking: settings/booking doc.
 */
function publicCatalog(sevas, booking, now = new Date()) {
  const today = todayIST(now);
  const b = booking || {};
  return {
    open: b.open !== false,
    note: clean(b.note, 400),
    sevas: (sevas || [])
      .filter((s) => s && s.active !== false && Number(s.amount) > 0)
      .sort((a, c) => (a.order ?? 999) - (c.order ?? 999) || a.amount - c.amount)
      .map((s) => ({ id: s.id, name: s.name, kn: s.kn || '', amount: Number(s.amount), icon: s.icon || 'flower-outline', desc: s.desc || '' })),
    dates: (Array.isArray(b.dates) ? b.dates : [])
      .filter((d) => d && d.open !== false && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date >= today)
      .sort((a, c) => a.date.localeCompare(c.date))
      .map((d) => ({ date: d.date, label: d.label || '', kn: d.kn || '' })),
  };
}

/** Check the browser's request against the live catalog and build the order. Throws Error(user-safe message). */
function buildOrder(body, catalog) {
  if (!body || typeof body !== 'object') throw new Error('Invalid request');
  const c = body.customer || {};
  const name = clean(c.name, 80);
  const phone = clean(c.phone, 10).replace(/\D/g, '');
  const email = clean(c.email, 100).toLowerCase();
  if (name.length < 2) throw new Error('Please enter your name.');
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Please enter a valid 10-digit mobile number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Please enter a valid email address.');
  const d = body.details || {};

  if (body.purpose === 'seva') {
    if (!catalog || !catalog.open) throw new Error('Online seva booking is closed at the moment.');
    const day = catalog.dates.find((x) => x.date === body.sevaDate);
    if (!day) throw new Error('This seva date is not available any more. Please choose another date.');
    const ids = Array.isArray(body.sevas) ? [...new Set(body.sevas)].slice(0, 20) : [];
    if (!ids.length) throw new Error('Please choose at least one seva.');
    const items = ids.map((id) => {
      const s = catalog.sevas.find((x) => x.id === id);
      if (!s) throw new Error('One of the sevas is not available any more. Please reload the page.');
      return { id: s.id, name: s.name, amount: s.amount };
    });
    const family = (Array.isArray(d.familyMembers) ? d.familyMembers : []).slice(0, 15).map((m) => ({
      name: clean(m && m.name, 60), gotra: clean(m && m.gotra, 40), nakshatra: clean(m && m.nakshatra, 40), rashi: clean(m && m.rashi, 40),
    })).filter((m) => m.name);
    if (!family.length) throw new Error('Please enter at least one name for the sankalpa.');
    return {
      purpose: 'seva',
      items,
      amount: items.reduce((s, i) => s + i.amount, 0),
      sevaDate: day.date,
      customer: { name, phone, email },
      details: {
        sevaDate: day.date,
        sevaDateLabel: day.label || '',
        persons: Math.max(1, Math.min(50, parseInt(d.persons, 10) || 1)),
        familyMembers: family,
        place: clean(d.place, 80),
        specialRequest: clean(d.specialRequest, 300),
      },
      note: `Seva ${dmy(day.date)}: ${items.map((i) => i.name).join(', ')}`.slice(0, 200),
    };
  }

  if (body.purpose === 'donation') {
    const amount = Math.floor(Number(body.amount));
    if (!Number.isFinite(amount) || amount < seed.donationMin || amount > seed.donationMax) {
      throw new Error(`Please enter an amount between ₹${seed.donationMin} and ₹${seed.donationMax.toLocaleString('en-IN')}.`);
    }
    const purpose = seed.donationPurposes.includes(d.purpose) ? d.purpose : 'General donation';
    return {
      purpose: 'donation',
      items: [{ id: 'donation', name: `Donation – ${purpose}`, amount }],
      amount,
      sevaDate: '',
      customer: { name, phone, email },
      details: { donationPurpose: purpose, address: clean(d.address, 200) },
      note: `Donation: ${purpose}`,
    };
  }
  throw new Error('Invalid request');
}

/** MSMPST-20261110-7F3K9Q2A1B  (Cashfree allows letters, numbers, - and _ ; max 45) */
function newOrderId(now = new Date()) {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `MSMPST-${ymd}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

/** Cashfree webhook signature: base64( HMAC-SHA256( timestamp + rawBody, clientSecret ) ) */
function verifyWebhook(rawBody, timestamp, signature, secret) {
  if (!rawBody || !timestamp || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(String(timestamp) + rawBody.toString('utf8')).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** What the browser may see about an order (no phone/email). */
function publicView(o, payee) {
  const d = o.details || {};
  return {
    orderId: o.orderId,
    status: o.status,
    purpose: o.purpose,
    amount: o.amount,
    items: (o.items || []).map((i) => ({ name: i.name, amount: i.amount })),
    name: o.customer && o.customer.name,
    sevaDate: o.sevaDate ? dmy(o.sevaDate) : '',
    sevaDateLabel: d.sevaDateLabel || '',
    names: o.purpose === 'seva' ? (d.familyMembers || []).map((m) => m.name) : [],
    donationPurpose: d.donationPurpose,
    receiptNo: o.receiptNo || null,
    paidAt: o.paidAt || null,
    paymentRef: (o.payment && o.payment.bankReference) || null,
    payee,
  };
}

/** Receipt email, in the format the Firebase "Trigger Email" extension reads from the `mail` collection. */
function receiptMail(o, trust) {
  const d = o.details || {};
  const rows = (o.items || []).map((i) => `<tr><td style="padding:6px 0">${esc(i.name)}</td><td style="padding:6px 0;text-align:right">₹${Number(i.amount).toLocaleString('en-IN')}</td></tr>`).join('');
  const names = (d.familyMembers || []).map((m) => esc(m.name) + (m.gotra ? ` (${esc(m.gotra)})` : '') + (m.nakshatra ? ` – ${esc(m.nakshatra)}` : '')).join('<br>');
  const line = (k, v) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#6b5a50">${k}</td><td style="padding:4px 0"><b>${v}</b></td></tr>` : '');
  const kind = o.purpose === 'seva' ? 'Seva booking' : 'Donation';
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2b1d1d">
  <div style="background:#800000;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
    <div style="font-size:12px;letter-spacing:2px;color:#f4cf57">RECEIPT</div>
    <div style="font-size:20px;font-weight:bold">${esc(trust.name)}</div>
    <div style="font-size:12px;opacity:.85">Reg. No. ${esc(trust.regNo)} · ${esc(trust.address)}</div>
  </div>
  <div style="border:1px solid #e8d29f;border-top:0;padding:18px 22px;border-radius:0 0 12px 12px">
    <p>Namaskara ${esc(o.customer.name)},</p>
    <p>Thank you. Your ${kind.toLowerCase()} is confirmed.</p>
    <table style="font-size:14px">${line('Receipt No.', esc(o.receiptNo))}${line('Order ID', esc(o.orderId))}${line('Date paid', esc(new Date(o.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })))}${line('Seva date', o.sevaDate ? esc(dmy(o.sevaDate)) + (d.sevaDateLabel ? ' – ' + esc(d.sevaDateLabel) : '') : '')}${line('Sankalpa names', names)}${line('Purpose', esc(d.donationPurpose))}${line('Bank reference', esc(o.payment && o.payment.bankReference))}</table>
    <table style="width:100%;font-size:14px;border-top:1px solid #eee;margin-top:12px">${rows}
      <tr><td style="padding:8px 0;border-top:1px solid #eee"><b>Total paid</b></td><td style="padding:8px 0;border-top:1px solid #eee;text-align:right;font-size:18px;color:#800000"><b>₹${Number(o.amount).toLocaleString('en-IN')}</b></td></tr></table>
    <p style="font-size:13px;color:#6b5a50">View or print this receipt: <a href="${esc(trust.site)}/payment-status/?order_id=${encodeURIComponent(o.orderId)}">${esc(trust.site)}/payment-status/</a><br>Questions: ${esc(trust.email)} · ${esc(trust.phone)}</p>
  </div></div>`;
  const text = `${trust.name}\nReceipt ${o.receiptNo}\n${kind} – ₹${o.amount}\nOrder ${o.orderId}${o.sevaDate ? '\nSeva date ' + dmy(o.sevaDate) : ''}\n${trust.site}/payment-status/?order_id=${o.orderId}`;
  return {
    to: [o.customer.email],
    bcc: trust.email ? [trust.email] : [],
    message: { subject: `Receipt ${o.receiptNo} – ${kind} – ${trust.name}`, html, text },
  };
}

module.exports = { buildOrder, newOrderId, verifyWebhook, publicView, publicCatalog, receiptMail, todayIST, dmy, clean };
