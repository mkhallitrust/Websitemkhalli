/* =====================================================================
   DEPTH ENGINE — one smooth 3D tilt for every [data-tilt] card on every page.
   Replaces the two older tilt scripts (home + inner pages), which jumped
   straight to the cursor. This one follows the cursor with a spring, lifts
   the card toward you, moves a soft light across it, and settles back.
   Optional: data-tilt="8" sets the maximum angle in degrees (default 7).
   ===================================================================== */
(function () {
    'use strict';
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduce || !fine || root.classList.contains('fx-lite')) return;

    const cards = Array.from(document.querySelectorAll('[data-tilt]'));
    if (cards.length) root.classList.add('fx-depth');

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const active = new Set();
    let raf = 0, last = 0;

    function setup(el) {
        const s = {
            el, max: parseFloat(el.dataset.tilt) || 7,
            rx: 0, ry: 0, gx: 50, gy: 50, lift: 0,          // current
            trx: 0, tr_y: 0, tgx: 50, tgy: 50, tlift: 0,   // target
        };
        if (!el.querySelector('.fx-glare')) {
            const g = document.createElement('span');
            g.className = 'fx-glare';
            g.setAttribute('aria-hidden', 'true');
            el.appendChild(g);
        }
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

        el.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            const r = el.getBoundingClientRect();
            const px = clamp((e.clientX - r.left) / r.width, 0, 1);
            const py = clamp((e.clientY - r.top) / r.height, 0, 1);
            s.tr_y = (px - 0.5) * 2 * s.max;
            s.trx = (0.5 - py) * 2 * s.max;
            s.tgx = px * 100; s.tgy = py * 100; s.tlift = 1;
            wake(s);
        });
        el.addEventListener('pointerleave', () => {
            s.trx = 0; s.tr_y = 0; s.tgx = 50; s.tgy = 50; s.tlift = 0;
            wake(s);
        });
        // keyboard users get the lift too
        el.addEventListener('focusin', () => { s.tlift = 0.6; wake(s); });
        el.addEventListener('focusout', () => { s.tlift = 0; wake(s); });
    }

    function wake(s) {
        if (!active.has(s)) {
            active.add(s);
            s.el.classList.add('is-tilting');
        }
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }

    function tick(now) {
        // frame-rate independent easing (same feel at 60 Hz and 120 Hz)
        const dt = Math.min(64, now - last); last = now;
        const k = 1 - Math.pow(1 - 0.14, dt / 16.67);
        const kl = 1 - Math.pow(1 - 0.10, dt / 16.67);
        active.forEach((s) => {
            s.rx += (s.trx - s.rx) * k;
            s.ry += (s.tr_y - s.ry) * k;
            s.gx += (s.tgx - s.gx) * k;
            s.gy += (s.tgy - s.gy) * k;
            s.lift += (s.tlift - s.lift) * kl;
            const st = s.el.style;
            st.setProperty('--rx', s.rx.toFixed(2) + 'deg');
            st.setProperty('--ry', s.ry.toFixed(2) + 'deg');
            st.setProperty('--gx', s.gx.toFixed(1) + '%');
            st.setProperty('--gy', s.gy.toFixed(1) + '%');
            st.setProperty('--lift', s.lift.toFixed(3));
            const settled = Math.abs(s.trx - s.rx) < 0.02 && Math.abs(s.tr_y - s.ry) < 0.02 && Math.abs(s.tlift - s.lift) < 0.004;
            if (settled && s.tlift === 0) {
                st.setProperty('--rx', '0deg'); st.setProperty('--ry', '0deg'); st.setProperty('--lift', '0');
                s.rx = s.ry = s.lift = 0;
                s.el.classList.remove('is-tilting');
                active.delete(s);
            }
        });
        raf = active.size ? requestAnimationFrame(tick) : 0;
    }

    cards.forEach(setup);
    // for cards added later (e.g. the seva list, which loads from the server)
    window.mkDepthAttach = (el) => { root.classList.add('fx-depth'); if (!el.dataset.depthOn) { el.dataset.depthOn = '1'; setup(el); } };
})();
