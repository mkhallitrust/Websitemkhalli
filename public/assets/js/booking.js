/* =====================================================================
   SEVA BOOKING PORTAL  (/seva-booking/)
   Sevas, prices and dates come live from Firestore through /api/catalog
   (the Trust edits them in /admin/). Payment: Cashfree, via payments.js.
   ===================================================================== */
(function () {
    'use strict';
    const root = document.getElementById('bk');
    if (!root) return;

    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
    const isKn = () => document.documentElement.lang === 'kn';
    const T = (en, kn) => (isKn() && kn ? kn : en);
    const bi = (en, kn) => `<span data-lang="en">${en}</span><span data-lang="kn">${kn || en}</span>`;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const DAYS_KN = ['ಭಾನು', 'ಸೋಮ', 'ಮಂಗಳ', 'ಬುಧ', 'ಗುರು', 'ಶುಕ್ರ', 'ಶನಿ'];
    const toast = (m, k) => (window.pgToast ? window.pgToast(m, k) : alert(m));
    const DRAFT = 'mk-booking-contact';

    const state = { catalog: null, date: '', picked: new Set() };

    /* ---------- load sevas + dates ---------- */
    async function load() {
        try {
            const r = await fetch('/api/catalog', { cache: 'no-store' });
            if (!r.ok) throw new Error(r.status);
            state.catalog = await r.json();
            render();
        } catch (e) {
            root.classList.add('is-error');
            $('#bk-status').innerHTML = `<ion-icon name="cloud-offline-outline"></ion-icon><p>${bi('Online booking could not be loaded. Please try again in a minute, or call the Trust on <a href="tel:+919448076834">+91 94480 76834</a>.', 'ಆನ್‌ಲೈನ್ ಬುಕಿಂಗ್ ತೆರೆಯಲಾಗಲಿಲ್ಲ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ <a href="tel:+919448076834">+91 94480 76834</a> ಗೆ ಕರೆ ಮಾಡಿ.')}</p><button type="button" class="cf-btn cf-btn-ghost" id="bk-retry">${bi('Try again', 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ')}</button>`;
            $('#bk-retry').onclick = () => { root.classList.remove('is-error'); $('#bk-status').innerHTML = '<span class="sv-spin"></span>'; load(); };
        }
    }

    function render() {
        const c = state.catalog;
        root.classList.add('is-ready');
        if (!c.open || !c.dates.length || !c.sevas.length) {
            root.classList.add('is-closed');
            $('#bk-status').innerHTML = `<ion-icon name="calendar-clear-outline"></ion-icon><h2>${bi('Online seva booking will open soon', 'ಆನ್‌ಲೈನ್ ಸೇವಾ ಬುಕಿಂಗ್ ಶೀಘ್ರದಲ್ಲೇ ಆರಂಭವಾಗುತ್ತದೆ')}</h2><p>${c.note ? esc(c.note) + '<br>' : ''}${bi('For sevas now, please call <a href="tel:+919448076834">+91 94480 76834</a>.', 'ಈಗ ಸೇವೆಗಾಗಿ <a href="tel:+919448076834">+91 94480 76834</a> ಗೆ ಕರೆ ಮಾಡಿ.')}</p>`;
            return;
        }
        if (c.note) { const n = $('#bk-note'); n.textContent = c.note; n.hidden = false; }

        // dates
        $('#bk-dates').innerHTML = c.dates.map((d, i) => {
            const dt = new Date(d.date + 'T00:00:00');
            return `<button type="button" class="bk-date" role="radio" aria-checked="false" data-date="${d.date}" style="--i:${i}">
                <span class="bk-date-m">${MONTHS[dt.getMonth()]} ${dt.getFullYear()}</span>
                <span class="bk-date-d">${dt.getDate()}</span>
                <span class="bk-date-w">${bi(DAYS[dt.getDay()], DAYS_KN[dt.getDay()])}</span>
                ${d.label ? `<span class="bk-date-l">${bi(esc(d.label), esc(d.kn || d.label))}</span>` : ''}
            </button>`;
        }).join('');
        $$('#bk-dates .bk-date').forEach((b) => b.addEventListener('click', () => pickDate(b.dataset.date)));
        if (c.dates.length === 1) pickDate(c.dates[0].date);

        // sevas
        $('#bk-sevas').innerHTML = c.sevas.map((s, i) => `
            <button type="button" class="bk-seva" data-id="${esc(s.id)}" aria-pressed="false" data-tilt="6" style="--i:${i}">
                <span class="bk-seva-ic"><ion-icon name="${esc(s.icon)}"></ion-icon></span>
                <span class="bk-seva-name">${bi(esc(s.name), esc(s.kn || s.name))}</span>
                ${s.desc ? `<span class="bk-seva-desc">${esc(s.desc)}</span>` : ''}
                <span class="bk-seva-price">₹${fmt(s.amount)}</span>
                <span class="bk-seva-tick" aria-hidden="true"><ion-icon name="checkmark"></ion-icon></span>
            </button>`).join('');
        $$('#bk-sevas .bk-seva').forEach((b) => {
            b.addEventListener('click', () => toggleSeva(b.dataset.id));
            if (window.mkDepthAttach) window.mkDepthAttach(b);
        });
        update();
    }

    function pickDate(date) {
        state.date = date;
        $$('#bk-dates .bk-date').forEach((b) => b.setAttribute('aria-checked', b.dataset.date === date ? 'true' : 'false'));
        setErr('bk-err-date', '');
        update();
    }
    function toggleSeva(id) {
        if (state.picked.has(id)) state.picked.delete(id); else state.picked.add(id);
        const b = $(`#bk-sevas .bk-seva[data-id="${CSS.escape(id)}"]`);
        if (b) b.setAttribute('aria-pressed', state.picked.has(id) ? 'true' : 'false');
        setErr('bk-err-sevas', '');
        update();
    }

    /* ---------- names for the sankalpa ---------- */
    let rowN = 0;
    function addRow(focus) {
        rowN++;
        const first = !$('#bk-names .bk-name');
        const div = document.createElement('div');
        div.className = 'bk-name';
        div.innerHTML = `
            <input class="bk-in-name" maxlength="60" autocomplete="${first ? 'name' : 'off'}" aria-label="Name" placeholder="${T(first ? 'Name *' : 'Name', first ? 'ಹೆಸರು *' : 'ಹೆಸರು')}" data-ph-en="${first ? 'Name *' : 'Name'}" data-ph-kn="${first ? 'ಹೆಸರು *' : 'ಹೆಸರು'}">
            <input class="bk-in-gotra" maxlength="40" aria-label="Gotra" placeholder="${T('Gotra', 'ಗೋತ್ರ')}" data-ph-en="Gotra" data-ph-kn="ಗೋತ್ರ">
            <input class="bk-in-nak" maxlength="40" list="bk-nakshatras" aria-label="Nakshatra" placeholder="${T('Nakshatra', 'ನಕ್ಷತ್ರ')}" data-ph-en="Nakshatra" data-ph-kn="ನಕ್ಷತ್ರ">
            <input class="bk-in-rashi" maxlength="40" list="bk-rashis" aria-label="Rashi" placeholder="${T('Rashi', 'ರಾಶಿ')}" data-ph-en="Rashi" data-ph-kn="ರಾಶಿ">
            ${first ? '<span></span>' : `<button type="button" class="bk-name-x" aria-label="Remove"><ion-icon name="close"></ion-icon></button>`}`;
        $('#bk-names').appendChild(div);
        const x = $('.bk-name-x', div);
        if (x) x.onclick = () => { div.remove(); update(); };
        if (focus) $('.bk-in-name', div).focus();
    }

    /* ---------- summary ---------- */
    function selected() {
        const c = state.catalog;
        return c ? c.sevas.filter((s) => state.picked.has(s.id)) : [];
    }
    function update() {
        const items = selected();
        const total = items.reduce((s, i) => s + i.amount, 0);
        const d = state.catalog && state.catalog.dates.find((x) => x.date === state.date);
        $('#bk-sum-date').innerHTML = d ? `${esc(d.date.split('-').reverse().join('-'))}${d.label ? ' · ' + bi(esc(d.label), esc(d.kn || d.label)) : ''}` : bi('Choose a date', 'ದಿನಾಂಕ ಆರಿಸಿ');
        $('#bk-sum-list').innerHTML = items.length
            ? items.map((s) => `<li><span>${bi(esc(s.name), esc(s.kn || s.name))}</span><b>₹${fmt(s.amount)}</b><button type="button" data-rm="${esc(s.id)}" aria-label="Remove ${esc(s.name)}"><ion-icon name="close"></ion-icon></button></li>`).join('')
            : `<li class="bk-sum-empty">${bi('No sevas chosen yet', 'ಇನ್ನೂ ಸೇವೆ ಆರಿಸಿಲ್ಲ')}</li>`;
        $$('#bk-sum-list [data-rm]').forEach((b) => (b.onclick = () => toggleSeva(b.dataset.rm)));
        $$('.bk-total').forEach((el) => (el.textContent = fmt(total)));
        $('#bk-count').textContent = items.length;
        const step = !state.date || !items.length ? 1 : contactOk() ? 3 : 2;
        $$('#bk-steps li').forEach((li, i) => { li.classList.toggle('is-on', i === step - 1); li.classList.toggle('is-done', i < step - 1); });
        $('#bk-bar').classList.toggle('is-show', items.length > 0);
    }
    function contactOk() {
        return /^[6-9]\d{9}$/.test($('#bk-phone').value) && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($('#bk-email').value.trim()) && $('.bk-in-name').value.trim().length > 1;
    }

    /* ---------- validate + pay ---------- */
    function setErr(id, msg) { const e = document.getElementById(id); if (e) e.textContent = msg || ''; }
    async function pay(btn) {
        let first = null;
        ['bk-err-date', 'bk-err-sevas', 'bk-err-names', 'bk-err-phone', 'bk-err-email'].forEach((id) => setErr(id, ''));
        $$('#bk .is-bad').forEach((e) => e.classList.remove('is-bad'));
        const bad = (errId, msg, el) => { setErr(errId, msg); if (el) el.classList.add('is-bad'); first = first || el || document.getElementById(errId); };
        if (!state.date) bad('bk-err-date', T('Please choose a seva date.', 'ದಯವಿಟ್ಟು ಸೇವಾ ದಿನಾಂಕ ಆರಿಸಿ.'), $('#bk-dates'));
        if (!state.picked.size) bad('bk-err-sevas', T('Please choose at least one seva.', 'ದಯವಿಟ್ಟು ಕನಿಷ್ಠ ಒಂದು ಸೇವೆ ಆರಿಸಿ.'), $('#bk-sevas'));
        const names = $$('#bk-names .bk-name').map((r) => ({ name: $('.bk-in-name', r).value.trim(), gotra: $('.bk-in-gotra', r).value.trim(), nakshatra: $('.bk-in-nak', r).value.trim(), rashi: $('.bk-in-rashi', r).value.trim() })).filter((m) => m.name);
        if (!names.length) bad('bk-err-names', T('Please enter at least one name for the sankalpa.', 'ಸಂಕಲ್ಪಕ್ಕೆ ಕನಿಷ್ಠ ಒಂದು ಹೆಸರು ನಮೂದಿಸಿ.'), $('.bk-in-name'));
        const phone = $('#bk-phone'), email = $('#bk-email');
        if (!/^[6-9]\d{9}$/.test(phone.value)) bad('bk-err-phone', T('Please enter a valid 10-digit mobile number.', 'ಸರಿಯಾದ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.'), phone);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) bad('bk-err-email', T('Please enter a valid email. The receipt is sent there.', 'ಸರಿಯಾದ ಇಮೇಲ್ ನಮೂದಿಸಿ. ರಶೀದಿ ಅಲ್ಲಿಗೆ ಬರುತ್ತದೆ.'), email);
        if (first) {
            const top = first.getBoundingClientRect().top + scrollY - 130;
            scrollTo({ top, behavior: 'smooth' });
            toast(T('Please check the highlighted details.', 'ಗುರುತಿಸಿದ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.'), 'error');
            return;
        }
        try { localStorage.setItem(DRAFT, JSON.stringify({ phone: phone.value, email: email.value.trim(), place: $('#bk-place').value.trim() })); } catch (e) {}
        try {
            await window.mkPay({
                purpose: 'seva',
                sevaDate: state.date,
                sevas: [...state.picked],
                customer: { name: names[0].name, phone: phone.value, email: email.value.trim() },
                details: { familyMembers: names, persons: $('#bk-persons').value, place: $('#bk-place').value.trim(), specialRequest: $('#bk-note-in').value.trim() },
            }, btn);
        } catch (e) {
            setErr('bk-err-pay', e.message);
            toast(e.message, 'error');
            if (/date|seva/i.test(e.message)) load();      // catalog changed: refresh
        }
    }

    /* ---------- wire up ---------- */
    addRow(false);
    $('#bk-add').addEventListener('click', () => addRow(true));
    $('#bk-pay').addEventListener('click', (e) => pay(e.currentTarget));
    $('#bk-bar-pay').addEventListener('click', () => pay($('#bk-pay')));
    $$('.bk-step-btn').forEach((b) => b.addEventListener('click', () => { const el = document.getElementById(b.dataset.go); scrollTo({ top: el.getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' }); }));
    $('#bk-phone').addEventListener('input', (e) => { let v = e.target.value.replace(/\D/g, ''); if (v.length > 10 && v.startsWith('91')) v = v.slice(2); e.target.value = v.slice(0, 10); });
    $$('.bk-stepper button').forEach((b) => b.addEventListener('click', () => { const i = $('#bk-persons'); i.value = Math.max(1, Math.min(50, (parseInt(i.value, 10) || 1) + Number(b.dataset.step))); }));
    root.addEventListener('input', update);
    // placeholders follow the language switch
    new MutationObserver(() => $$('#bk [data-ph-en]').forEach((i) => (i.placeholder = T(i.dataset.phEn, i.dataset.phKn)))).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d) { $('#bk-phone').value = d.phone || ''; $('#bk-email').value = d.email || ''; $('#bk-place').value = d.place || ''; } } catch (e) {}
    // floating total on phones while the summary is off-screen
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => root.classList.toggle('sum-visible', e.isIntersecting)).observe($('#bk-pay'));
    load();
})();
