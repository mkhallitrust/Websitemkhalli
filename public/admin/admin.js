/* Seva Admin — Firestore + Google sign-in.
   The Firebase config is read from /__/firebase/init.json, which Firebase Hosting serves
   automatically for this project (nothing to paste). */
const V = '10.14.1';
const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
const { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const dmy = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('-') : iso || '');
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
let toastT;
const toast = (m, bad) => { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 3200); };

/* ---------- Firebase ---------- */
let config = window.MK_FIREBASE_CONFIG;
if (!config) {
  try { const r = await fetch('/__/firebase/init.json'); if (r.ok) config = await r.json(); } catch (e) {}
}
if (!config) {
  $('#v-signin').innerHTML = '<ion-icon name="cloud-offline-outline" class="big"></ion-icon><h1>Firebase is not connected</h1><p>Open this page on the Firebase website (after <code>firebase deploy</code>) or with <code>firebase emulators:start</code>.</p>';
  throw new Error('no firebase config');
}
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

let me = '';
let orders = [];
let unsubOrders = null;

$('#signin').onclick = async () => {
  $('#signin-err').textContent = '';
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { $('#signin-err').textContent = e.code === 'auth/popup-closed-by-user' ? '' : 'Sign-in failed: ' + e.message; }
};
$('#signout').onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (unsubOrders) { unsubOrders(); unsubOrders = null; }
  if (!user) return show('signin');
  me = (user.email || '').toLowerCase();
  let ok = false;
  try { ok = (await getDoc(doc(db, 'admins', me))).exists(); } catch (e) { ok = false; }
  if (!ok) {
    $('#signin-err').innerHTML = `<b>${esc(me)}</b> is not an admin. Ask a Trust admin to add you, then sign in again.`;
    await signOut(auth);
    return;
  }
  $('#who-email').textContent = me;
  show('bookings');
  watchOrders();
});

function show(view) {
  const signed = view !== 'signin';
  $('#tabs').hidden = !signed; $('#who').hidden = !signed;
  $$('main > .panel').forEach((p) => (p.hidden = p.id !== 'v-' + view));
  $$('#tabs button').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === view));
  if (view === 'sevas') loadSevas();
  if (view === 'dates') loadDates();
  if (view === 'admins') loadAdmins();
  if (view === 'sheet') renderSheet();
}
$$('#tabs button').forEach((b) => (b.onclick = () => show(b.dataset.tab)));

/* ---------- bookings ---------- */
function watchOrders() {
  unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(2000)), (snap) => {
    orders = snap.docs.map((d) => ({ ...d.data(), _id: d.id }));
    fillDateFilters();
    renderOrders();
    if (!$('#v-sheet').hidden) renderSheet();
  }, (e) => toast('Could not load bookings: ' + e.message, true));
}

function fillDateFilters() {
  const dates = [...new Set(orders.filter((o) => o.sevaDate).map((o) => o.sevaDate))].sort().reverse();
  for (const sel of [$('#f-date'), $('#s-date')]) {
    const keep = sel.value;
    const first = sel.id === 'f-date' ? '<option value="">All seva dates</option>' : '';
    sel.innerHTML = first + dates.map((d) => `<option value="${d}">${dmy(d)}</option>`).join('');
    if (dates.includes(keep)) sel.value = keep;
  }
}

function filtered() {
  const p = $('#f-purpose').value, st = $('#f-status').value, dt = $('#f-date').value, pf = $('#f-performed').value;
  const q = $('#f-q').value.trim().toLowerCase();
  return orders.filter((o) => (!p || o.purpose === p) && (!st || o.status === st) && (!dt || o.sevaDate === dt)
    && (!pf || (pf === 'yes') === !!o.performed)
    && (!q || [o.customer?.name, o.customer?.phone, o.customer?.email, o.orderId, o.receiptNo, ...(o.details?.familyMembers || []).map((m) => m.name)].join(' ').toLowerCase().includes(q)));
}

function renderOrders() {
  const list = filtered();
  const paid = list.filter((o) => o.status === 'PAID');
  const sum = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
  const sevas = paid.filter((o) => o.purpose === 'seva').length;
  $('#stats').innerHTML = `
    <div><small>Collected (shown)</small><b>₹${fmt(sum)}</b></div>
    <div><small>Paid seva bookings</small><b>${sevas}</b></div>
    <div><small>Paid donations</small><b>${paid.length - sevas}</b></div>
    <div><small>Sevas still to perform</small><b>${paid.filter((o) => o.purpose === 'seva' && !o.performed).length}</b></div>`;
  $('#tbl tbody').innerHTML = list.map((o) => `
    <tr data-id="${esc(o._id)}">
      <td><b>${esc(o.receiptNo || '—')}</b><small>${esc(o.orderId)}</small></td>
      <td>${esc(when(o.paidAt || o.createdAt))}</td>
      <td>${esc(o.customer?.name)}${o.details?.place ? `<small>${esc(o.details.place)}</small>` : ''}</td>
      <td><a href="tel:+91${esc(o.customer?.phone)}">${esc(o.customer?.phone)}</a></td>
      <td>${esc(dmy(o.sevaDate))}</td>
      <td>${o.purpose === 'seva' ? esc((o.items || []).map((i) => i.name).join(', ')) : `<span class="tag">Donation</span> ${esc(o.details?.donationPurpose)}`}</td>
      <td class="r"><b>₹${fmt(o.amount)}</b></td>
      <td><span class="st st-${esc(o.status)}">${esc(o.status === 'ACTIVE' ? 'NOT PAID' : o.status)}</span></td>
      <td>${o.purpose === 'seva' && o.status === 'PAID' ? `<input type="checkbox" class="done" ${o.performed ? 'checked' : ''} aria-label="Seva performed">` : ''}</td>
    </tr>`).join('');
  $('#tbl-empty').hidden = list.length > 0;
}
['#f-purpose', '#f-status', '#f-date', '#f-performed'].forEach((s) => $(s).addEventListener('change', renderOrders));
$('#f-q').addEventListener('input', renderOrders);

$('#tbl tbody').addEventListener('click', async (e) => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const o = orders.find((x) => x._id === tr.dataset.id); if (!o) return;
  if (e.target.classList.contains('done')) {
    try {
      await updateDoc(doc(db, 'orders', o._id), { performed: e.target.checked, performedAt: new Date().toISOString(), performedBy: me });
      toast(e.target.checked ? 'Marked as performed' : 'Marked as not performed');
    } catch (err) { e.target.checked = !e.target.checked; toast('Could not save: ' + err.message, true); }
    return;
  }
  if (e.target.closest('a')) return;
  openDetail(o);
});

function openDetail(o) {
  const d = o.details || {};
  const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');
  $('#detail-body').innerHTML = `
    <h2>${o.purpose === 'seva' ? 'Seva booking' : 'Donation'} <span class="st st-${esc(o.status)}">${esc(o.status)}</span></h2>
    <dl class="dl">
      ${row('Receipt', esc(o.receiptNo))}${row('Order ID', `<code>${esc(o.orderId)}</code>`)}
      ${row('Booked', esc(when(o.createdAt)))}${row('Paid', esc(when(o.paidAt)))}
      ${row('Name', esc(o.customer?.name))}${row('Phone', `<a href="tel:+91${esc(o.customer?.phone)}">${esc(o.customer?.phone)}</a> · <a href="https://wa.me/91${esc(o.customer?.phone)}" target="_blank" rel="noopener">WhatsApp</a>`)}
      ${row('Email', `<a href="mailto:${esc(o.customer?.email)}">${esc(o.customer?.email)}</a>`)}
      ${row('Town', esc(d.place))}
      ${row('Seva date', esc(dmy(o.sevaDate)) + (d.sevaDateLabel ? ' – ' + esc(d.sevaDateLabel) : ''))}
      ${row('Sevas', (o.items || []).map((i) => `${esc(i.name)} – ₹${fmt(i.amount)}`).join('<br>'))}
      ${row('Sankalpa names', (d.familyMembers || []).map((m) => `${esc(m.name)}${m.gotra ? ' · ' + esc(m.gotra) : ''}${m.nakshatra ? ' · ' + esc(m.nakshatra) : ''}${m.rashi ? ' · ' + esc(m.rashi) : ''}`).join('<br>'))}
      ${row('People attending', esc(d.persons))}
      ${row('Purpose', esc(d.donationPurpose))}${row('Address', esc(d.address))}
      ${row('Special request', esc(d.specialRequest))}
      ${row('Amount', `<b>₹${fmt(o.amount)}</b>`)}
      ${row('Payment', esc([o.payment?.group, o.payment?.bankReference && 'ref ' + o.payment.bankReference, o.payment?.cfPaymentId && 'Cashfree ' + o.payment.cfPaymentId].filter(Boolean).join(' · ')))}
      ${row('Receipt email', o.receiptEmailQueued ? 'Sent to the email queue' : '')}
      ${row('Performed', o.performed ? `Yes – ${esc(when(o.performedAt))} by ${esc(o.performedBy)}` : '')}
    </dl>
    <label class="field">Admin note<textarea id="d-note" rows="2" maxlength="500">${esc(o.adminNote || '')}</textarea></label>
    <div class="actions"><button class="btn" id="d-save">Save note</button>${o.status === 'PAID' ? `<a class="btn ghost" href="/payment-status/?order_id=${encodeURIComponent(o.orderId)}" target="_blank" rel="noopener">Open receipt</a>` : ''}</div>`;
  $('#d-save').onclick = async () => {
    try { await updateDoc(doc(db, 'orders', o._id), { adminNote: $('#d-note').value.trim() }); toast('Note saved'); $('#detail').close(); }
    catch (e) { toast('Could not save: ' + e.message, true); }
  };
  $('#detail').showModal();
}

$('#export').onclick = () => {
  const rows = [['Receipt', 'Order ID', 'Status', 'Type', 'Booked', 'Paid', 'Name', 'Phone', 'Email', 'Town', 'Seva date', 'Sevas / purpose', 'Sankalpa names', 'People', 'Special request', 'Amount', 'Bank ref', 'Performed']];
  filtered().forEach((o) => {
    const d = o.details || {};
    rows.push([o.receiptNo, o.orderId, o.status, o.purpose, o.createdAt, o.paidAt, o.customer?.name, o.customer?.phone, o.customer?.email, d.place,
      dmy(o.sevaDate), o.purpose === 'seva' ? (o.items || []).map((i) => i.name).join('; ') : d.donationPurpose,
      (d.familyMembers || []).map((m) => [m.name, m.gotra, m.nakshatra, m.rashi].filter(Boolean).join(' / ')).join('; '),
      d.persons, d.specialRequest || d.address, o.amount, o.payment?.bankReference, o.performed ? 'yes' : '']);
  });
  const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/* ---------- priest list: names to read for each seva on a date ---------- */
function renderSheet() {
  const date = $('#s-date').value;
  const list = orders.filter((o) => o.purpose === 'seva' && o.status === 'PAID' && o.sevaDate === date);
  if (!date || !list.length) { $('#sheet').innerHTML = '<p class="empty">No paid seva bookings for this date yet.</p>'; return; }
  const by = new Map();
  list.forEach((o) => (o.items || []).forEach((i) => { if (!by.has(i.name)) by.set(i.name, []); by.get(i.name).push(o); }));
  $('#sheet').innerHTML = `<h2>Seva list – ${esc(dmy(date))}</h2><p class="hint">${list.length} bookings · printed ${esc(when(new Date().toISOString()))}</p>` +
    [...by.entries()].map(([seva, os]) => `
      <section class="sheet-seva"><h3>${esc(seva)} <small>${os.length}</small></h3>
      <table class="tbl"><thead><tr><th>#</th><th>Names (gotra · nakshatra · rashi)</th><th>Booked by</th><th>Receipt</th></tr></thead><tbody>
      ${os.map((o, i) => `<tr><td>${i + 1}</td><td>${(o.details?.familyMembers || []).map((m) => `<b>${esc(m.name)}</b>${m.gotra ? ' · ' + esc(m.gotra) : ''}${m.nakshatra ? ' · ' + esc(m.nakshatra) : ''}${m.rashi ? ' · ' + esc(m.rashi) : ''}`).join('<br>')}</td><td>${esc(o.customer?.name)}<small>${esc(o.customer?.phone)}</small></td><td>${esc(o.receiptNo)}</td></tr>`).join('')}
      </tbody></table></section>`).join('');
}
$('#s-date').addEventListener('change', renderSheet);
$('#s-print').onclick = () => window.print();

/* ---------- sevas & prices ---------- */
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
async function loadSevas() {
  try {
    const snap = await getDocs(collection(db, 'sevas'));
    const list = snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    $('#sevas tbody').innerHTML = list.map(sevaRow).join('') || '<tr><td colspan="8" class="empty">No sevas yet. They appear after the booking page is opened once, or add one.</td></tr>';
  } catch (e) { toast('Could not load sevas: ' + e.message, true); }
}
function sevaRow(s) {
  return `<tr data-id="${esc(s.id || '')}">
    <td><input type="number" class="s-order" value="${esc(s.order ?? '')}" min="0" max="999"></td>
    <td><input class="s-name" value="${esc(s.name)}" maxlength="80"></td>
    <td><input class="s-kn" value="${esc(s.kn)}" maxlength="80"></td>
    <td class="r"><input type="number" class="s-amount" value="${esc(s.amount)}" min="1" max="500000"></td>
    <td><input class="s-icon" value="${esc(s.icon || 'flower-outline')}" maxlength="40" title="Any icon name from ionic.io/ionicons"></td>
    <td><input class="s-desc" value="${esc(s.desc || '')}" maxlength="120"></td>
    <td><label class="switch"><input type="checkbox" class="s-active" ${s.active !== false ? 'checked' : ''}><span></span></label></td>
    <td><button class="btn sm s-save">Save</button></td></tr>`;
}
$('#seva-add').onclick = () => {
  const tb = $('#sevas tbody');
  if (tb.querySelector('.empty')) tb.innerHTML = '';
  tb.insertAdjacentHTML('beforeend', sevaRow({ name: '', kn: '', amount: '', order: tb.children.length + 1, active: true }));
  tb.lastElementChild.querySelector('.s-name').focus();
};
$('#sevas').addEventListener('click', async (e) => {
  if (!e.target.classList.contains('s-save')) return;
  const tr = e.target.closest('tr');
  const name = tr.querySelector('.s-name').value.trim();
  const amount = Math.round(Number(tr.querySelector('.s-amount').value));
  if (name.length < 2 || !(amount > 0)) return toast('Enter a name and a price above ₹0', true);
  const id = tr.dataset.id || slug(name);
  if (!id) return toast('Name needs English letters for the ID', true);
  try {
    await setDoc(doc(db, 'sevas', id), {
      name, kn: tr.querySelector('.s-kn').value.trim(), amount,
      icon: tr.querySelector('.s-icon').value.trim() || 'flower-outline',
      desc: tr.querySelector('.s-desc').value.trim(),
      order: Number(tr.querySelector('.s-order').value) || 0,
      active: tr.querySelector('.s-active').checked,
      updatedBy: me, updatedAt: new Date().toISOString(),
    }, { merge: true });
    tr.dataset.id = id;
    toast(`Saved “${name}”`);
  } catch (err) { toast('Could not save: ' + err.message, true); }
});

/* ---------- dates & booking settings ---------- */
async function loadDates() {
  try {
    const s = await getDoc(doc(db, 'settings', 'booking'));
    const b = s.exists() ? s.data() : { open: true, dates: [], note: '' };
    $('#b-open').checked = b.open !== false;
    $('#b-note').value = b.note || '';
    $('#dates tbody').innerHTML = (b.dates || []).sort((x, y) => x.date.localeCompare(y.date)).map(dateRow).join('');
  } catch (e) { toast('Could not load dates: ' + e.message, true); }
}
function dateRow(d) {
  return `<tr><td><input type="date" class="d-date" value="${esc(d.date || '')}"></td>
    <td><input class="d-label" value="${esc(d.label || '')}" maxlength="80" placeholder="e.g. Sri Hanuman Jayanti"></td>
    <td><input class="d-kn" value="${esc(d.kn || '')}" maxlength="80"></td>
    <td><label class="switch"><input type="checkbox" class="d-open" ${d.open !== false ? 'checked' : ''}><span></span></label></td>
    <td><button class="btn ghost sm d-del" aria-label="Remove date"><ion-icon name="trash-outline"></ion-icon></button></td></tr>`;
}
$('#date-add').onclick = () => $('#dates tbody').insertAdjacentHTML('beforeend', dateRow({ open: true }));
$('#dates').addEventListener('click', (e) => { const b = e.target.closest('.d-del'); if (b) b.closest('tr').remove(); });
$('#dates-save').onclick = async () => {
  const dates = $$('#dates tbody tr').map((tr) => ({
    date: tr.querySelector('.d-date').value, label: tr.querySelector('.d-label').value.trim(),
    kn: tr.querySelector('.d-kn').value.trim(), open: tr.querySelector('.d-open').checked,
  })).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));
  try {
    await setDoc(doc(db, 'settings', 'booking'), { open: $('#b-open').checked, note: $('#b-note').value.trim(), dates, updatedBy: me, updatedAt: new Date().toISOString() });
    $('#dates-saved').textContent = 'Saved ✓';
    setTimeout(() => ($('#dates-saved').textContent = ''), 3000);
  } catch (e) { toast('Could not save: ' + e.message, true); }
};

/* ---------- admins ---------- */
async function loadAdmins() {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    $('#admins').innerHTML = snap.docs.map((d) => `<li><ion-icon name="person-circle-outline"></ion-icon><span>${esc(d.id)}${d.id === me ? ' <small>(you)</small>' : ''}</span>${d.id === me ? '' : `<button class="btn ghost sm" data-rm="${esc(d.id)}">Remove</button>`}</li>`).join('');
  } catch (e) { toast('Could not load admins: ' + e.message, true); }
}
$('#admins').addEventListener('click', async (e) => {
  const em = e.target.dataset.rm; if (!em) return;
  if (!confirm(`Remove ${em} as admin?`)) return;
  try { await deleteDoc(doc(db, 'admins', em)); loadAdmins(); toast('Removed'); } catch (err) { toast(err.message, true); }
});
$('#admin-add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const em = $('#admin-email').value.trim().toLowerCase();
  try { await setDoc(doc(db, 'admins', em), { addedBy: me, addedAt: new Date().toISOString() }); $('#admin-email').value = ''; loadAdmins(); toast('Added ' + em); }
  catch (err) { toast(err.message, true); }
});
