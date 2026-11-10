/* =====================================================================
   ONLINE PAYMENTS — Cashfree Payments checkout
   - window.mkPay(payload, button): asks our server (/api/orders) to create an
     order, then opens Cashfree's secure checkout.
   - Donate page: the online donation form.
   - /payment-status/: shows the result and the receipt.
   The amount for sevas is always worked out on the server.
   ===================================================================== */
(function () {
    'use strict';
    const API = '/api';
    const SDK = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    const isKn = () => document.documentElement.lang === 'kn';
    const T = (en, kn) => (isKn() && kn ? kn : en);
    const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (m, k) => (window.pgToast ? window.pgToast(m, k) : alert(m));

    let sdkPromise = null;
    function loadSdk() {
        if (window.Cashfree) return Promise.resolve(window.Cashfree);
        if (!sdkPromise) {
            sdkPromise = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = SDK; s.async = true;
                s.onload = () => (window.Cashfree ? resolve(window.Cashfree) : reject(new Error('Payment window did not load')));
                s.onerror = () => { sdkPromise = null; reject(new Error(T('Could not reach the payment service. Check your internet and try again.', 'ಪಾವತಿ ಸೇವೆ ತಲುಪಲಾಗಲಿಲ್ಲ. ಇಂಟರ್ನೆಟ್ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'))); };
                document.head.appendChild(s);
            });
        }
        return sdkPromise;
    }

    function busy(btn, on) {
        if (!btn) return;
        btn.disabled = on;
        btn.classList.toggle('is-busy', on);
        btn.setAttribute('aria-busy', on ? 'true' : 'false');
    }

    window.mkPay = async function (payload, btn) {
        busy(btn, true);
        try {
            loadSdk().catch(() => {});                     // start loading while the order is created
            const r = await fetch(API + '/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            let d = {};
            try { d = await r.json(); } catch (e) {}
            if (!r.ok || !d.paymentSessionId) throw new Error(d.error || T('Could not start the payment. Please try again.', 'ಪಾವತಿ ಆರಂಭಿಸಲು ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'));
            try { sessionStorage.setItem('mk-last-order', d.orderId); } catch (e) {}
            const Cashfree = await loadSdk();
            const cf = Cashfree({ mode: d.mode === 'production' ? 'production' : 'sandbox' });
            const res = await cf.checkout({ paymentSessionId: d.paymentSessionId, redirectTarget: '_self' });
            if (res && res.error) throw new Error(res.error.message || 'Payment was not completed');
        } finally {
            busy(btn, false);
        }
    };

    /* ---------------- Donate page form ---------------- */
    const form = document.getElementById('cf-donate');
    if (form) {
        const amt = document.getElementById('cf-amount');
        const labels = form.querySelectorAll('.cf-amt-label');
        const chips = form.querySelectorAll('[data-amt]');
        const err = document.getElementById('cf-err');
        const sync = () => {
            const v = Math.floor(Number(amt.value) || 0);
            labels.forEach((l) => { l.textContent = fmt(v); });
            chips.forEach((c) => c.classList.toggle('is-on', Number(c.dataset.amt) === v));
        };
        chips.forEach((c) => c.addEventListener('click', () => { amt.value = c.dataset.amt; sync(); }));
        amt.addEventListener('input', sync);
        const phone = document.getElementById('cf-phone');
        phone.addEventListener('input', () => { phone.value = phone.value.replace(/\D/g, '').slice(0, 10); });
        sync();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            err.textContent = '';
            const v = Math.floor(Number(amt.value) || 0);
            const name = document.getElementById('cf-name').value.trim();
            const email = document.getElementById('cf-email').value.trim();
            let msg = '';
            if (v < 1 || v > 500000) msg = T('Please enter an amount between ₹1 and ₹5,00,000.', 'ದಯವಿಟ್ಟು ₹1 ರಿಂದ ₹5,00,000 ವರೆಗಿನ ಮೊತ್ತ ನಮೂದಿಸಿ.');
            else if (name.length < 2) msg = T('Please enter your full name.', 'ದಯವಿಟ್ಟು ಪೂರ್ಣ ಹೆಸರು ನಮೂದಿಸಿ.');
            else if (!/^[6-9]\d{9}$/.test(phone.value)) msg = T('Please enter a valid 10-digit mobile number.', 'ದಯವಿಟ್ಟು ಸರಿಯಾದ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.');
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) msg = T('Please enter a valid email address for the receipt.', 'ರಶೀದಿಗಾಗಿ ಸರಿಯಾದ ಇಮೇಲ್ ನಮೂದಿಸಿ.');
            if (msg) { err.textContent = msg; return; }
            try {
                await window.mkPay({
                    purpose: 'donation',
                    amount: v,
                    customer: { name, phone: phone.value, email },
                    details: { purpose: document.getElementById('cf-purpose').value, address: document.getElementById('cf-address').value.trim() }
                }, document.getElementById('cf-donate-btn'));
            } catch (ex) {
                err.textContent = ex.message;
                toast(ex.message, 'error');
            }
        });
    }

    /* ---------------- /payment-status/ ---------------- */
    const ps = document.getElementById('ps');
    if (ps) {
        const q = new URLSearchParams(location.search);
        let orderId = q.get('order_id');
        if (!orderId) { try { orderId = sessionStorage.getItem('mk-last-order'); } catch (e) {} }
        if (!orderId || !/^MSMPST[-_A-Z0-9]{6,40}$/i.test(orderId)) {
            ps.innerHTML = '<div class="ps-card ps-bad"><h2>No payment found</h2><p>Open this page from the payment window, or <a href="/contact/">contact us</a> with your Order ID.</p></div>';
            return;
        }
        let tries = 0;
        const show = (d) => {
            const paid = d.status === 'PAID';
            const pending = d.status === 'ACTIVE' || d.status === 'PENDING';
            const items = (d.items || []).map((i) => `<tr><td>${esc(i.name)}</td><td class="r">₹${fmt(i.amount)}</td></tr>`).join('');
            ps.innerHTML = `
                <div class="ps-card ${paid ? 'ps-ok' : pending ? 'ps-wait2' : 'ps-bad'}">
                    <span class="ps-ic"><ion-icon name="${paid ? 'checkmark-circle' : pending ? 'time-outline' : 'close-circle'}"></ion-icon></span>
                    <h2>${paid ? T('Payment successful', 'ಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿದೆ') : pending ? T('Payment is being confirmed', 'ಪಾವತಿಯನ್ನು ದೃಢೀಕರಿಸಲಾಗುತ್ತಿದೆ') : T('Payment not completed', 'ಪಾವತಿ ಪೂರ್ಣಗೊಂಡಿಲ್ಲ')}</h2>
                    <p>${paid ? T('Thank you. Your receipt has been emailed to you.', 'ಧನ್ಯವಾದಗಳು. ರಶೀದಿಯನ್ನು ನಿಮಗೆ ಇಮೇಲ್ ಮಾಡಲಾಗಿದೆ.') : pending ? T('This can take a minute. This page will refresh by itself.', 'ಇದಕ್ಕೆ ಒಂದು ನಿಮಿಷ ಬೇಕಾಗಬಹುದು. ಪುಟ ತಾನಾಗಿಯೇ ನವೀಕರಿಸುತ್ತದೆ.') : T('No money was taken. If money was deducted, it will be returned by your bank in 5–7 working days.', 'ಹಣ ಕಡಿತವಾಗಿಲ್ಲ. ಕಡಿತವಾಗಿದ್ದರೆ 5–7 ಕೆಲಸದ ದಿನಗಳಲ್ಲಿ ಬ್ಯಾಂಕ್ ಹಿಂದಿರುಗಿಸುತ್ತದೆ.')}</p>
                    <dl class="ps-rows">
                        ${d.receiptNo ? `<div><dt>Receipt No.</dt><dd><b>${esc(d.receiptNo)}</b></dd></div>` : ''}
                        <div><dt>Order ID</dt><dd><code>${esc(d.orderId)}</code></dd></div>
                        <div><dt>${d.purpose === 'seva' ? 'Seva booking for' : 'Donation from'}</dt><dd>${esc(d.name)}</dd></div>
                        ${d.purpose === 'donation' && d.donationPurpose ? `<div><dt>Purpose</dt><dd>${esc(d.donationPurpose)}</dd></div>` : ''}
                        ${d.sevaDate ? `<div><dt>Seva date</dt><dd>${esc(d.sevaDate)}</dd></div>` : ''}
                        ${d.paidAt ? `<div><dt>Paid on</dt><dd>${esc(new Date(d.paidAt).toLocaleString('en-IN'))}</dd></div>` : ''}
                        ${d.paymentRef ? `<div><dt>Bank reference</dt><dd><code>${esc(d.paymentRef)}</code></dd></div>` : ''}
                        <div><dt>Received by</dt><dd>${esc(d.payee)}</dd></div>
                    </dl>
                    ${items ? `<table class="ps-items"><tbody>${items}</tbody></table>` : ''}
                    <p class="ps-total">${T('Total', 'ಒಟ್ಟು')} <b>₹${fmt(d.amount)}</b></p>
                    <div class="ps-actions">
                        ${paid ? `<button type="button" class="cf-btn" onclick="window.print()"><ion-icon name="print-outline"></ion-icon>${T('Print / Save receipt', 'ರಶೀದಿ ಮುದ್ರಿಸಿ')}</button>` : ''}
                        ${!paid && !pending ? `<a class="cf-btn" href="${d.purpose === 'seva' ? '/seva-booking/' : '/donate/'}"><ion-icon name="refresh-outline"></ion-icon>${T('Try again', 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ')}</a>` : ''}
                        <a class="cf-btn cf-btn-ghost" href="/">${T('Back to home', 'ಮುಖಪುಟಕ್ಕೆ')}</a>
                    </div>
                </div>`;
            if (pending && tries < 12) setTimeout(load, 5000);
        };
        const load = async () => {
            tries++;
            try {
                const r = await fetch(API + '/orders/' + encodeURIComponent(orderId), { cache: 'no-store' });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || 'Not found');
                show(d);
            } catch (e) {
                if (tries < 4) setTimeout(load, 3000);
                else ps.innerHTML = `<div class="ps-card ps-bad"><h2>Could not check this payment</h2><p>Please <a href="/contact/">contact us</a> with Order ID <code>${esc(orderId)}</code>.</p></div>`;
            }
        };
        load();
    }
})();
