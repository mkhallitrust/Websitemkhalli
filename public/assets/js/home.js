    (function () {
        'use strict';

        const $ = (s, r) => (r || document).querySelector(s);
        const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        const easeOut = (k) => 1 - Math.pow(1 - k, 3);
        const root = document.documentElement;
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        // ---- phones get lighter effects; weak phones get the calm "lite" version ----
        const phone = !finePointer && Math.min(screen.width || 9999, screen.height || 9999) < 900;
        const conn = navigator.connection || {};
        const weakDevice = (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
                           (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
                           conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
        const forceFull = /[?&]full\b/.test(location.search);       // ?full  = always the full effects (for testing)
        let lite = !forceFull && (prefersReduced || (phone && weakDevice) || /[?&]lite\b/.test(location.search));
        const reduceMotion = prefersReduced;         // the fully static version of every effect
        const liteHooks = [];                        // run when a phone is switched to lite while browsing
        if (phone) root.classList.add('fx-phone');
        if (lite) root.classList.add('fx-lite');
        const pinMQ = window.matchMedia('(min-width: 1024px) and (min-height: 600px)');
        const isSmall = () => window.innerWidth < 768;
        const pageHome = $('#page-home');
        if (!pageHome) return;

        /* =========================================================
           Scroll engine — one requestAnimationFrame per scroll
           ========================================================= */
        const scrollFns = [];
        const measured = new Set();                 // elements measured once per frame, before any style is written
        const frameRects = new Map();
        const measure_ = (el) => { if (el) measured.add(el); return el; };
        const rectOf = (el) => frameRects.get(el) || el.getBoundingClientRect();
        let scrollTicking = false, docH = 0;
        const syncDocH = () => { docH = root.scrollHeight; };
        function runScroll() {
            scrollTicking = false;
            if (pageHome.classList.contains('hidden')) return;          // homepage hidden
            const vh = window.innerHeight;
            frameRects.clear();
            measured.forEach((el) => frameRects.set(el, el.getBoundingClientRect()));   // one layout read per frame
            if (!docH) syncDocH();
            for (let i = 0; i < scrollFns.length; i++) scrollFns[i](vh);
        }
        if ('ResizeObserver' in window) new ResizeObserver(syncDocH).observe(document.body);
        window.addEventListener('resize', syncDocH);
        function requestScroll() { if (!scrollTicking) { scrollTicking = true; requestAnimationFrame(runScroll); } }
        window.addEventListener('scroll', requestScroll, { passive: true });
        window.addEventListener('resize', requestScroll);
        // re-sync after switching back to the homepage from another page
        document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.page-nav-link')) setTimeout(requestScroll, 80); });
        // progress while an element travels through the viewport: 0 = entering at bottom, 1 = leaving at top
        const passP = (r, vh) => clamp((vh - r.top) / (vh + r.height), 0, 1);
        const onScreen = (r, vh) => r.bottom > -80 && r.top < vh + 80;

        /* ---------- reveal once ---------- */
        const revealIO = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        $$('.fx-reveal').forEach((el) => revealIO.observe(el));

        /* ---------- 3D tilt (mouse) ---------- */
        function initTilt(el) {
            const max = parseFloat(el.dataset.tilt) || 10;
            let raf = 0;
            el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') el.classList.add('is-tilting'); });
            el.addEventListener('pointermove', (e) => {
                if (e.pointerType !== 'mouse') return;
                const r = el.getBoundingClientRect();
                const px = clamp((e.clientX - r.left) / r.width, 0, 1);
                const py = clamp((e.clientY - r.top) / r.height, 0, 1);
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => {
                    el.style.setProperty('--ry', ((px - 0.5) * 2 * max).toFixed(2) + 'deg');
                    el.style.setProperty('--rx', ((0.5 - py) * 2 * max).toFixed(2) + 'deg');
                    el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
                    el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
                });
            });
            el.addEventListener('pointerleave', () => {
                cancelAnimationFrame(raf);
                el.classList.remove('is-tilting');
                el.style.setProperty('--rx', '0deg');
                el.style.setProperty('--ry', '0deg');
            });
        }
        /* tilt: handled by depth.js */

        /* ---------- counting numbers ---------- */
        function countUp(el) {
            if (el.dataset.done) return;
            el.dataset.done = '1';
            const end = parseInt(el.dataset.count, 10), dur = 1700, t0 = performance.now();
            const step = (now) => {
                const k = Math.min(1, (now - t0) / dur);
                el.textContent = Math.round(end * easeOut(k));
                if (k < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }
        if (!reduceMotion) $$('[data-count]').forEach((el) => { el.textContent = '0'; });

        /* =========================================================
           Stats — cards stand up in 3D as they scroll in
           ========================================================= */
        const statsSec = $('#fx-stats');
        const statCards = statsSec ? $$('.fx-stat', statsSec) : [];
        if (statsSec && !reduceMotion) scrollFns.push((vh) => {
            if (lite) return;
            const r = rectOf(measure_(statsSec));
            if (!onScreen(r, vh)) return;
            const p = passP(r, vh);
            statCards.forEach((c, i) => {
                const k = easeOut(clamp((p - 0.05 - i * 0.07) / 0.32, 0, 1));
                c.style.setProperty('--k', k.toFixed(4));
                if (k > 0.75) { const n = $('[data-count]', c); if (n) countUp(n); }
            });
        });

        /* =========================================================
           Welcome — portrait layers separate and settle with scroll
           ========================================================= */
        const welcome = $('#fx-welcome');
        if (welcome && !reduceMotion) scrollFns.push((vh) => {
            if (lite) return;
            const r = rectOf(measure_(welcome));
            if (!onScreen(r, vh)) return;
            const p = passP(r, vh);
            const d = clamp((p - 0.5) * 2.2, -1, 1);
            welcome.style.setProperty('--sp', p.toFixed(4));
            welcome.style.setProperty('--d', d.toFixed(4));
            welcome.style.setProperty('--ex', Math.abs(d).toFixed(4));
        });

        /* =========================================================
           Sri Vyasaraja — 732 points of light, lit one by one as you scroll
           ========================================================= */
        (function initSpiral() {
            const sec = $('#fx-vyasa');
            const cv = $('#fx-spiral');
            if (!sec || !cv || !cv.getContext) return;
            const ctx = cv.getContext('2d');
            const numEl = $('#fx-vcount-num');
            const N = 732, GA = Math.PI * (3 - Math.sqrt(5));   // golden angle
            const OURS = 486;                                   // illustrative spot for Mavinakayinahalli
            let size = 0, dpr = 1, k = reduceMotion ? 1 : 0, lit = reduceMotion ? N : 0, running = false, lastDraw = 0;

            const sprite = document.createElement('canvas');
            sprite.width = sprite.height = 64;
            (function () {
                const g = sprite.getContext('2d');
                const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
                rg.addColorStop(0, 'rgba(255,248,222,1)');
                rg.addColorStop(0.22, 'rgba(244,207,87,.95)');
                rg.addColorStop(0.55, 'rgba(212,150,40,.28)');
                rg.addColorStop(1, 'rgba(212,150,40,0)');
                g.fillStyle = rg;
                g.fillRect(0, 0, 64, 64);
            })();

            function pill(text, x, y, align, fs) {
                ctx.font = '600 ' + fs + 'px "Noto Sans Kannada", "Zalando Sans SemiExpanded", sans-serif';
                const w = ctx.measureText(text).width + fs * 1.3, h = fs * 2;
                let bx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
                bx = clamp(bx, 4, size - w - 4);
                const by = clamp(y - h / 2, 4, size - h - 4);
                ctx.fillStyle = 'rgba(20,4,4,.82)';
                ctx.strokeStyle = 'rgba(244,207,87,.7)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(bx, by, w, h, h / 2); else ctx.rect(bx, by, w, h);
                ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#F4CF57';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.fillText(text, bx + w / 2, by + h / 2 + 1);
            }

            function draw(t) {
                if (!size) return;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, size, size);
                const c = size / 2, maxR = size * 0.44, sc = maxR / Math.sqrt(N), u = size / 520;
                const rot = (1 - k) * -1.1 + t * 0.015;
                let ox = 0, oy = 0;
                for (let i = 0; i < N; i++) {
                    const r = sc * Math.sqrt(i + 0.5), a = i * GA + rot;
                    const x = c + r * Math.cos(a), y = c + r * Math.sin(a);
                    if (i === OURS) { ox = x; oy = y; }
                    if (i < lit) {
                        const tw = 0.72 + 0.28 * Math.sin(t * 2 + i * 1.7);
                        const s = (i === 0 ? 30 : 8.5) * tw * u;
                        ctx.globalAlpha = 1;
                        ctx.drawImage(sprite, x - s, y - s, s * 2, s * 2);
                    } else {
                        ctx.globalAlpha = 0.2;
                        ctx.fillStyle = '#F4CF57';
                        ctx.fillRect(x - 1.1 * u, y - 1.1 * u, 2.2 * u, 2.2 * u);
                    }
                }
                ctx.globalAlpha = 1;
                const kn = document.documentElement.lang === 'kn';
                const fs = Math.max(10, Math.round(12.5 * u));
                if (lit > 0) pill(kn ? 'ಯಂತ್ರೋದ್ಧಾರಕ · ಮೊದಲನೆಯದು' : 'Yantroddharaka · the first', c, c + 34 * u, 'center', fs);
                if (lit > OURS) {
                    const pulse = (t * 0.8) % 1;
                    ctx.strokeStyle = 'rgba(255,240,190,' + (1 - pulse).toFixed(3) + ')';
                    ctx.lineWidth = 2 * u;
                    ctx.beginPath(); ctx.arc(ox, oy, (6 + pulse * 22) * u, 0, 6.2832); ctx.stroke();
                    ctx.fillStyle = '#fff6d6';
                    ctx.beginPath(); ctx.arc(ox, oy, 4.5 * u, 0, 6.2832); ctx.fill();
                    const right = ox < c;
                    pill(kn ? 'ಮಾವಿನಕಾಯಿನಹಳ್ಳಿ' : 'Mavinakayinahalli', ox + (right ? 14 : -14) * u, oy, right ? 'left' : 'right', fs);
                }
            }

            function resize() {
                const r = cv.getBoundingClientRect();
                const w = cv.offsetWidth || r.width;
                if (!w) return;
                dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2);
                size = w;
                cv.width = Math.round(w * dpr);
                cv.height = Math.round(w * dpr);
                draw(performance.now() / 1000);
            }
            function loop(now) {
                if (!running) return;
                if (lite) { running = false; return; }
                if (now - lastDraw > (phone ? 50 : isSmall() ? 33 : 16)) { draw(now / 1000); lastDraw = now; }
                requestAnimationFrame(loop);
            }
            new IntersectionObserver((entries) => {
                const vis = entries[0].isIntersecting;
                if (vis && !running && !reduceMotion) { running = true; requestAnimationFrame(loop); }
                if (!vis) running = false;
                if (vis) resize();
            }, { threshold: 0 }).observe(cv);
            if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv);
            else window.addEventListener('resize', resize);
            const ls = document.getElementById('lang-switcher');
            if (ls) ls.addEventListener('click', () => setTimeout(() => draw(performance.now() / 1000), 30));

            if (numEl) numEl.textContent = String(lit);
            liteHooks.push(() => { running = false; k = 1; lit = N; if (numEl) numEl.textContent = String(N); draw(performance.now() / 1000); });
            if (reduceMotion) { sec.style.setProperty('--k', '1'); return; }
            const wrap = cv.parentElement;
            scrollFns.push((vh) => {
                if (lite) return;
                const r = rectOf(measure_(wrap));
                if (!onScreen(r, vh)) return;
                // starts as the spiral enters the screen, completes when its centre reaches ~45% of the screen height
                const start = vh * 0.95, end = vh * 0.45 - r.height / 2;
                const t = clamp((start - r.top) / Math.max(1, start - end), 0, 1);
                k = t * t * (3 - 2 * t);
                sec.style.setProperty('--k', k.toFixed(4));
                const n = Math.round(k * N);
                if (n !== lit) { lit = n; if (numEl) numEl.textContent = String(lit); }
            });
        })();

        /* =========================================================
           Milestones — pinned 3D spiral driven by scroll
           ========================================================= */
        (function initMilestones() {
            const ms = $('#fx-ms');
            if (!ms) return;
            const ring = $('#fx-ms-ring', ms);
            const cards = $$('.fx-ms-card', ms);
            const n = cards.length;
            if (!n) return;
            const idxEl = $('#fx-ms-idx'), totalEl = $('#fx-ms-total'), barFill = $('#fx-ms-barfill');
            const bgYear = $('#fx-ms-bgyear'), yearList = $('#fx-ms-years');
            const pad = (v) => String(v).padStart(2, '0');
            ms.style.setProperty('--n', n);
            if (totalEl) totalEl.textContent = '/ ' + pad(n);

            // clickable year list
            const yearBtns = cards.map((c, i) => {
                const li = document.createElement('li');
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = c.dataset.year || '';
                b.addEventListener('click', () => {
                    const r = ms.getBoundingClientRect();
                    const span = ms.offsetHeight - window.innerHeight;
                    window.scrollTo({ top: window.scrollY + r.top + span * (i / Math.max(1, n - 1)) + 2, behavior: 'smooth' });
                });
                li.appendChild(b);
                if (yearList) yearList.appendChild(li);
                return b;
            });

            if (reduceMotion) return;          // keep the plain, readable list
            ms.classList.add('is-3d');

            let geo = { th: 28, R: 520, h: 150 };
            function layoutCards() {
                if (lite) return;
                const small = window.innerWidth < 1024;
                const cw = cards[0].offsetWidth || 360;
                // vertical step is taller than the tallest card, so neighbouring cards never overlap
                const tallest = Math.max.apply(null, cards.map((c) => c.offsetHeight || 0)) || 200;
                geo = { th: small ? 30 : 27, R: Math.round(cw * (small ? 0.95 : 1.2)), h: tallest + (small ? 28 : 36) };
                cards.forEach((c, i) => {
                    c.style.transform = 'rotateY(' + (i * geo.th) + 'deg) translateZ(' + geo.R + 'px) translateY(' + (i * geo.h) + 'px) translate(-50%, -50%)';
                });
            }
            let last = -1, swapTimer = 0;
            function setActive(a) {
                if (a === last) return;
                last = a;
                if (idxEl) idxEl.textContent = pad(a + 1);
                yearBtns.forEach((b, i) => b.classList.toggle('is-active', i === a));
                if (bgYear) {
                    clearTimeout(swapTimer);
                    bgYear.classList.add('is-out');
                    swapTimer = setTimeout(() => {
                        const y = cards[a].dataset.year || '';
                        bgYear.textContent = y;
                        bgYear.classList.toggle('is-long', y.length > 4);
                        bgYear.classList.remove('is-out');
                    }, 200);
                }
            }
            liteHooks.push(() => {
                ms.classList.remove('is-3d');
                ring.style.transform = '';
                cards.forEach((c) => { c.style.transform = ''; c.style.opacity = ''; c.style.removeProperty('--dim'); c.classList.remove('is-active'); });
            });
            scrollFns.push((vh) => {
                if (lite) return;
                const r = rectOf(measure_(ms));
                if (!onScreen(r, vh)) return;
                const p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
                const f = p * (n - 1);
                ring.style.transform = 'translateZ(' + (-geo.R) + 'px) rotateY(' + (-f * geo.th).toFixed(2) + 'deg) translateY(' + (-f * geo.h).toFixed(1) + 'px)';
                cards.forEach((c, i) => {
                    const a = Math.abs(i - f);
                    c.style.opacity = (a < 1 ? 1 : Math.max(0, 1 - (a - 1) * 0.6)).toFixed(3);
                    c.style.setProperty('--dim', Math.min(0.62, a * 0.5).toFixed(3));
                    c.classList.toggle('is-active', a < 0.5);
                });
                if (barFill) barFill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
                setActive(Math.round(f));
            });
            layoutCards();
            if ('ResizeObserver' in window) new ResizeObserver(() => { layoutCards(); requestScroll(); }).observe(ms);
            else window.addEventListener('resize', () => { layoutCards(); requestScroll(); });
            setActive(0);
        })();

        /* =========================================================
           Gallery — cards deal out of a 3D stack
           ========================================================= */
        const moments = $('#fx-moments');
        const momentWraps = moments ? $$('.fx-moment-wrap', moments) : [];
        momentWraps.forEach(measure_);
        if (moments && !reduceMotion) scrollFns.push((vh) => {
            if (lite) return;
            const r = rectOf(measure_(moments));
            if (!onScreen(r, vh)) return;
            if (window.innerWidth >= 768) {
                momentWraps.forEach((w) => w.style.removeProperty('--k'));
                const k = easeOut(clamp((passP(r, vh) - 0.1) / 0.3, 0, 1));
                moments.style.setProperty('--k', k.toFixed(4));
            } else {
                momentWraps.forEach((w) => {
                    const rr = rectOf(w);
                    w.style.setProperty('--k', easeOut(clamp((vh - rr.top) / (vh * 0.6), 0, 1)).toFixed(4));
                });
            }
        });

        /* =========================================================
           Events — carousel tilts up into place
           ========================================================= */
        const eventsSec = $('#fx-events');
        if (eventsSec && !reduceMotion) scrollFns.push((vh) => {
            if (lite) return;
            const r = rectOf(measure_(eventsSec));
            if (!onScreen(r, vh)) return;
            eventsSec.style.setProperty('--k', easeOut(clamp((passP(r, vh) - 0.08) / 0.3, 0, 1)).toFixed(4));
        });

        /* =========================================================
           CTA + contact depth
           ========================================================= */
        const cta = $('#fx-cta');
        const ctaBg = cta ? $('.fx-cta-bg', cta) : null;
        if (cta && !reduceMotion) {
            scrollFns.push((vh) => {
                if (lite) return;
                const r = rectOf(measure_(cta));
                if (!onScreen(r, vh)) return;
                cta.style.setProperty('--sp', passP(r, vh).toFixed(4));
            });
            if (finePointer) {
                cta.addEventListener('mousemove', (e) => {
                    const r = cta.getBoundingClientRect();
                    ctaBg.style.setProperty('--px', (((e.clientX - r.left) / r.width - 0.5) * -34).toFixed(1) + 'px');
                    ctaBg.style.setProperty('--py', (((e.clientY - r.top) / r.height - 0.5) * -24).toFixed(1) + 'px');
                });
                cta.addEventListener('mouseleave', () => { ctaBg.style.setProperty('--px', '0px'); ctaBg.style.setProperty('--py', '0px'); });
            }
        }
        const contact = $('#contact');
        if (contact && !reduceMotion) scrollFns.push((vh) => {
            if (lite) return;
            const r = rectOf(measure_(contact));
            if (!onScreen(r, vh)) return;
            contact.style.setProperty('--k', easeOut(clamp((passP(r, vh) - 0.05) / 0.3, 0, 1)).toFixed(4));
        });

        /* =========================================================
           Reading progress + section dots
           ========================================================= */
        const progressBar = $('#fx-progress-bar');
        const dotBtns = $$('#fx-dots button');
        const dotTargets = dotBtns.map((b) => document.getElementById(b.dataset.target));
        const dotsShown = dotBtns.length && window.innerWidth >= 1200;
        if (dotsShown) dotTargets.forEach(measure_);
        scrollFns.push((vh) => {
            const max = docH - vh;
            if (progressBar) progressBar.style.transform = 'scaleX(' + (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0).toFixed(4) + ')';
            if (!dotsShown) return;
            let active = 0;
            dotTargets.forEach((t, i) => { if (t && rectOf(t).top <= vh * 0.45) active = i; });
            dotBtns.forEach((b, i) => b.classList.toggle('is-active', i === active));
        });
        dotBtns.forEach((b, i) => b.addEventListener('click', () => {
            const t = dotTargets[i];
            if (!t) return;
            const top = i === 0 ? 0 : t.getBoundingClientRect().top + window.scrollY - 60;
            window.scrollTo({ top, behavior: 'smooth' });
        }));

        /* =========================================================
           Poster lightbox
           ========================================================= */
        const lb = $('#fx-lightbox');
        const lbImg = lb ? $('img', lb) : null;
        let lbOpen = false, lbReturnFocus = null;
        function openLightbox(img) {
            if (!lb) return;
            lbImg.src = img.currentSrc || img.src;
            lbImg.alt = img.alt || '';
            lb.classList.add('open');
            lb.setAttribute('aria-hidden', 'false');
            document.documentElement.style.overflow = 'hidden';
            lbReturnFocus = document.activeElement;
            lbOpen = true;
            $('.fx-lb-close', lb).focus();
        }
        function closeLightbox() {
            if (!lbOpen) return;
            lb.classList.remove('open');
            lb.setAttribute('aria-hidden', 'true');
            document.documentElement.style.overflow = '';
            lbOpen = false;
            if (lbReturnFocus && lbReturnFocus.focus) lbReturnFocus.focus();
        }
        if (lb) {
            lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.fx-lb-close')) closeLightbox(); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
        }

        /* =========================================================
           Map of Sri Vyasaraja's Pranadevaru (Leaflet, loaded on demand)
           ========================================================= */
        (function initPranadevaruMap() {
            const sec = $('#fx-pmap');
            if (!sec) return;
            const shell = $('#fx-pm-shell');
            const mapEl = $('#fx-pm-map');
            const card = $('#fx-pm-card');
            const qInput = $('#fx-pm-q');
            const distSel = $('#fx-pm-dist');
            const countEl = $('#fx-pm-n');
            const emptyEl = $('#fx-pm-empty');
            const shieldBtn = $('#fx-pm-shield');
            const chips = $$('.fx-pm-chips button', sec);
            const PHOTO = 'https://vyasarajamutt.org/uploads/pranadevara/';
            const MATHA = 'https://vyasarajamatha.org/pranadevara.php?lang=en';
            const OURS_ID = 161;
            const L_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            const L_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

            // ---- read the list that is already in the page
            const groups = $$('.fx-pm-grp', sec).map((g) => ({ el: g, state: g.dataset.s, dist: g.dataset.d, items: [] }));
            const items = [];
            groups.forEach((g) => {
                $$('li', g.el).forEach((li) => {
                    const ll = li.dataset.ll.split(',').map(Number);
                    const it = {
                        id: +li.dataset.i, lat: ll[0], lon: ll[1], prec: li.dataset.p, img: li.dataset.img,
                        name: $('button > b', li).textContent, addr: $('button > span', li).textContent, dist: g.dist, state: g.state, li, group: g, show: true
                    };
                    it.hay = (it.name + ' ' + it.addr + ' ' + it.dist).toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
                    g.items.push(it); items.push(it);
                });
            });
            const byId = {};
            items.forEach((it) => { byId[it.id] = it; });

            const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
            const precNote = (p) => ({
                exact: ['Exact location', 'ನಿಖರ ಸ್ಥಳ'],
                village: ['Pin marks the village', 'ಗುರುತು ಗ್ರಾಮವನ್ನು ಸೂಚಿಸುತ್ತದೆ'],
                town: ['Pin marks the town', 'ಗುರುತು ಪಟ್ಟಣವನ್ನು ಸೂಚಿಸುತ್ತದೆ'],
                approx: ['Approximate — use Directions', 'ಅಂದಾಜು ಸ್ಥಳ — ಮಾರ್ಗ ಬಳಸಿ']
            }[p] || ['', '']);
            const bi = (pair) => '<span data-lang="en">' + pair[0] + '</span><span data-lang="kn">' + pair[1] + '</span>';
            const dirUrl = (it) => it.prec === 'exact'
                ? 'https://www.google.com/maps/dir/?api=1&destination=' + it.lat + ',' + it.lon
                : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(it.name + ', ' + it.addr);

            // ---- filtering
            let fState = '', fDist = '', fQuery = '';
            function applyFilter(fit) {
                const q = fQuery.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
                let n = 0;
                groups.forEach((g) => {
                    let vis = 0;
                    g.items.forEach((it) => {
                        it.show = (!fState || g.state === fState) && (!fDist || g.dist === fDist) && q.every((w) => it.hay.indexOf(w) !== -1);
                        it.li.hidden = !it.show;
                        if (it.show) vis++;
                    });
                    g.el.hidden = vis === 0;
                    n += vis;
                });
                countEl.textContent = n;
                emptyEl.hidden = n > 0;
                if (map) { recluster(); if (fit) fitVisible(); }
            }
            let qTimer = 0;
            qInput.addEventListener('input', () => {
                clearTimeout(qTimer);
                qTimer = setTimeout(() => { fQuery = qInput.value; applyFilter(true); }, 180);
            });
            chips.forEach((b) => b.addEventListener('click', () => {
                chips.forEach((c) => c.classList.toggle('is-on', c === b));
                fState = b.dataset.s;
                if (fDist && !groups.some((g) => g.dist === fDist && (!fState || g.state === fState))) { fDist = ''; distSel.value = ''; }
                applyFilter(true);
            }));
            distSel.addEventListener('change', () => { fDist = distSel.value; applyFilter(true); });
            const lsw = document.getElementById('lang-switcher');
            const setPh = () => {
                const kn = document.documentElement.lang === 'kn';
                qInput.placeholder = kn ? 'ಗ್ರಾಮ, ಪಟ್ಟಣ ಅಥವಾ ಜಿಲ್ಲೆ ಹುಡುಕಿ…' : 'Search village, town or district…';
                distSel.options[0].textContent = kn ? 'ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು' : 'All districts';
            };
            if (lsw) lsw.addEventListener('click', () => setTimeout(setPh, 30));
            setPh();

            // ---- selected-temple card
            function showCard(it) {
                card.hidden = false;
                card.innerHTML =
                    '<button type="button" class="fx-pm-card-img" aria-label="View photo"><img src="' + PHOTO + esc(it.img) + '" alt="' + esc(it.name) + ', ' + esc(it.addr) + '" loading="lazy"></button>' +
                    '<div><h5>' + esc(it.name) + '</h5><p>' + esc(it.addr) + '</p><small>' + bi(precNote(it.prec)) + '</small>' +
                    '<div class="fx-pm-card-actions"><a href="' + dirUrl(it) + '" target="_blank" rel="noopener"><ion-icon name="navigate"></ion-icon>' + bi(['Directions', 'ಮಾರ್ಗ']) + '</a>' +
                    '<a class="alt" href="' + MATHA + '" target="_blank" rel="noopener">' + bi(['Matha page', 'ಮಠದ ಪುಟ']) + '</a></div></div>' +
                    '<button type="button" class="fx-pm-card-x" aria-label="Close"><ion-icon name="close"></ion-icon></button>';
                const img = $('img', card);
                img.addEventListener('error', () => { img.parentNode.style.display = 'none'; card.style.gridTemplateColumns = '1fr'; }, { once: true });
                $('.fx-pm-card-img', card).addEventListener('click', () => openLightbox(img));
                $('.fx-pm-card-x', card).addEventListener('click', () => { card.hidden = true; setActive(null); if (map) map.closePopup(); });
            }
            let activeLi = null;
            function setActive(it) {
                if (activeLi) activeLi.classList.remove('is-active');
                activeLi = it ? it.li : null;
                if (activeLi) {
                    activeLi.classList.add('is-active');
                    const list = $('#fx-pm-list');
                    const r = activeLi.getBoundingClientRect(), lr = list.getBoundingClientRect();
                    if (r.top < lr.top + 40 || r.bottom > lr.bottom) list.scrollTop += r.top - lr.top - lr.height / 3;
                }
            }

            // ---- list clicks
            $('#fx-pm-list').addEventListener('click', (e) => {
                const li = e.target.closest('li[data-i]');
                if (!li) return;
                select(byId[+li.dataset.i], true);
            });
            $('#fx-pm-ours').addEventListener('click', () => {
                const it = byId[OURS_ID];
                if (!it) return;
                const top = shell.getBoundingClientRect().top + window.scrollY - 90;
                window.scrollTo({ top, behavior: 'smooth' });
                select(it, true);
            });

            function select(it, fly) {
                if (!it) return;
                setActive(it);
                showCard(it);
                if (!map) { pendingSelect = it; loadLeaflet(); return; }
                if (window.innerWidth < 1024 && fly) {
                    const r = mapEl.getBoundingClientRect();
                    if (r.top < 60 || r.bottom > window.innerHeight) window.scrollTo({ top: r.top + window.scrollY - 80, behavior: 'smooth' });
                }
                const open = () => L.popup({ offset: [0, -6], autoPanPadding: [30, 60] }).setLatLng([it.lat, it.lon]).setContent(popupHtml(it)).openOn(map);
                if (fly) {
                    const z = Math.max(map.getZoom(), it.prec === 'approx' ? 11 : 13);
                    map.flyTo([it.lat, it.lon], z, { duration: 1.1 });
                    map.once('moveend', open);
                } else open();
            }

            function popupHtml(it) {
                return '<button type="button" class="fx-pop-img" data-pop-img aria-label="View photo"><img src="' + PHOTO + esc(it.img) + '" alt="' + esc(it.name) + '" loading="lazy" onerror="this.parentNode.classList.add(\'noimg\');this.remove()"></button>' +
                    '<div class="fx-pop-body"><b>' + esc(it.name) + '</b><p>' + esc(it.addr) + '</p><small>' + bi(precNote(it.prec)) + '</small>' +
                    '<div class="fx-pop-actions"><a href="' + dirUrl(it) + '" target="_blank" rel="noopener">' + bi(['Directions', 'ಮಾರ್ಗ']) + '</a>' +
                    '<a class="alt" href="' + MATHA + '" target="_blank" rel="noopener">' + bi(['Matha page', 'ಮಠದ ಪುಟ']) + '</a></div></div>';
            }
            function groupHtml(list) {
                const place = list[0].addr.split(',').slice(0, 2).join(',');
                return '<div class="fx-pop-group"><h6>' + list.length + ' ' + bi(['Pranadevaru here', 'ಪ್ರಾಣದೇವರು ಇಲ್ಲಿ']) + '</h6>' +
                    list.map((it) => '<button type="button" data-pick="' + it.id + '"><b>' + esc(it.name) + '</b>' + esc(it.addr) + '</button>').join('') + '</div>';
            }

            // ---- Leaflet (loaded only when the visitor gets close)
            let map = null, layer = null, oursMarker = null, pendingSelect = null, loading = false;
            function loadLeaflet() {
                if (loading || map) return;
                loading = true;
                const css = document.createElement('link');
                css.rel = 'stylesheet'; css.href = L_CSS;
                document.head.appendChild(css);
                const s = document.createElement('script');
                s.src = L_JS; s.async = true;
                s.onload = initMap;
                s.onerror = () => { $('#fx-pm-loading').textContent = 'Map could not load — the list below still works.'; };
                document.head.appendChild(s);
            }
            new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadLeaflet(); }, { rootMargin: '700px 0px' }).observe(sec);

            const touch = !finePointer;
            function initMap() {
                if (!window.L) return;
                map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false, minZoom: 5, maxZoom: 18, zoomSnap: 0.5, worldCopyJump: false, dragging: !touch, tap: true });
                // Base map: free tiles, no API key needed.
                // OpenStreetMap on the live website; Esri street map when the file is opened
                // straight from a computer (OSM refuses requests without a website address)
                // or if OSM tiles fail to load for any reason.
                const OSM = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin',
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }];
                const ESRI = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                    maxZoom: 19, maxNativeZoom: 17,
                    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }];
                let base = null, tileFails = 0, tileOk = 0, fellBack = false;
                const useBase = (def) => {
                    if (base) map.removeLayer(base);
                    base = L.tileLayer(def[0], def[1]).addTo(map);
                    base.on('tileload', () => { tileOk++; });
                    base.on('tileerror', () => {
                        if (fellBack || ++tileFails < 4 || tileOk > tileFails) return;
                        fellBack = true; useBase(ESRI);
                    });
                };
                if (location.protocol === 'file:') { fellBack = true; useBase(ESRI); } else useBase(OSM);
                layer = L.layerGroup().addTo(map);

                const ours = byId[OURS_ID];
                if (ours) {
                    oursMarker = L.marker([ours.lat, ours.lon], {
                        zIndexOffset: 2000, keyboard: true, title: 'Mavinakayinahalli',
                        icon: L.divIcon({ className: 'fx-pin-ours', html: '<b></b><i></i><span>Mavinakayinahalli</span>', iconSize: [24, 24] })
                    }).addTo(map).on('click', () => select(ours, false));
                }
                // wheel-zoom only after the visitor clicks the map, so page scrolling is never hijacked
                map.on('click focus', () => map.scrollWheelZoom.enable());
                mapEl.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());
                map.on('zoomend', recluster);
                map.on('popupopen', (e) => {
                    const el = e.popup.getElement();
                    const im = el && el.querySelector('[data-pop-img]');
                    if (im) im.addEventListener('click', () => { const i = im.querySelector('img'); if (i) openLightbox(i); });
                    el && el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => select(byId[+b.dataset.pick], false)));
                });
                if (shieldBtn) shieldBtn.addEventListener('click', () => { sec.classList.add('is-live'); map.dragging.enable(); });
                new IntersectionObserver((entries) => {
                    if (!entries[0].isIntersecting && touch && map) { sec.classList.remove('is-live'); map.dragging.disable(); }
                }, { threshold: 0 }).observe(mapEl);
                if ('ResizeObserver' in window) new ResizeObserver(() => map.invalidateSize()).observe(mapEl);

                sec.classList.add('is-map');
                applyFilter(false);
                fitVisible(true);
                if (pendingSelect) { const p = pendingSelect; pendingSelect = null; setTimeout(() => select(p, true), 300); }
            }

            function fitVisible(initial) {
                const vis = items.filter((it) => it.show);
                if (!vis.length) return;
                if (vis.length === 1) { map.setView([vis[0].lat, vis[0].lon], 13); return; }
                const b = L.latLngBounds(vis.map((it) => [it.lat, it.lon]));
                map.fitBounds(b, { padding: [36, 36], maxZoom: 13, animate: !initial });
            }

            // ---- grouping: nearby pins merge into a numbered bubble; tap to zoom in
            function recluster() {
                if (!map) return;
                layer.clearLayers();
                const z = map.getZoom();
                // greedy grouping by on-screen distance, so bubbles never pile on top of each other
                const R = 54;
                const pts = items.filter((it) => it.show && it.id !== OURS_ID).map((it) => ({ it, p: map.project([it.lat, it.lon], z), used: false }));
                pts.sort((a, b) => a.p.x - b.p.x);
                const buckets = [];
                for (let i = 0; i < pts.length; i++) {
                    if (pts[i].used) continue;
                    const seed = pts[i], list = [seed.it];
                    seed.used = true;
                    for (let k = i + 1; k < pts.length && pts[k].p.x - seed.p.x <= R; k++) {
                        const q = pts[k];
                        if (!q.used && Math.abs(q.p.y - seed.p.y) <= R && Math.hypot(q.p.x - seed.p.x, q.p.y - seed.p.y) <= R) { q.used = true; list.push(q.it); }
                    }
                    buckets.push(list);
                }
                buckets.forEach((list) => {
                    if (list.length === 1) {
                        const it = list[0];
                        L.marker([it.lat, it.lon], {
                            title: it.name + ', ' + it.addr,
                            icon: L.divIcon({ className: 'fx-pin p-' + it.prec, html: '<i></i>', iconSize: [18, 18] })
                        }).on('click', () => select(it, false)).addTo(layer);
                        return;
                    }
                    let la = 0, lo = 0;
                    list.forEach((it) => { la += it.lat; lo += it.lon; });
                    la /= list.length; lo /= list.length;
                    const samePlace = list.every((it) => Math.abs(it.lat - list[0].lat) < 1e-4 && Math.abs(it.lon - list[0].lon) < 1e-4);
                    const size = list.length < 10 ? 34 : list.length < 50 ? 42 : 50;
                    L.marker([la, lo], {
                        title: list.length + ' Pranadevaru',
                        icon: L.divIcon({ className: 'fx-cl' + (samePlace ? ' is-place' : ''), html: '<div>' + list.length + '</div>', iconSize: [size, size] })
                    }).on('click', () => {
                        if (samePlace || z >= 15) {
                            L.popup({ offset: [0, -size / 2] }).setLatLng([la, lo]).setContent(groupHtml(list)).openOn(map);
                        } else {
                            map.flyToBounds(L.latLngBounds(list.map((it) => [it.lat, it.lon])), { padding: [60, 60], maxZoom: 15, duration: 0.9 });
                        }
                    }).addTo(layer);
                });
            }

            // ---- 3D entrance while scrolling in
            if (!reduceMotion) {
                liteHooks.push(() => shell.classList.add('is-flat'));
                scrollFns.push((vh) => {
                    if (lite) return;
                    const r = rectOf(measure_(sec));
                    if (!onScreen(r, vh)) return;
                    const k = easeOut(clamp((vh - rectOf(measure_(shell)).top) / (vh * 0.7), 0, 1));
                    sec.style.setProperty('--k', k.toFixed(4));
                    shell.classList.toggle('is-flat', k > 0.995);
                });
            } else {
                shell.classList.add('is-flat');
            }
        })();

        // in-page "scroll to section" buttons
        document.addEventListener('click', (e) => {
            const b = e.target.closest && e.target.closest('[data-fx-scroll]');
            if (!b) return;
            const t = document.getElementById(b.dataset.fxScroll);
            if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
        });

        /* =========================================================
           3D coverflow for event posters
           ========================================================= */
        (function initCoverflow() {
            const root = $('#fx-cf');
            if (!root) return;
            const stage = $('.fx-cf-stage', root);
            const items = $$('.fx-cf-item', root);
            const caps = $$('.fx-cf-cap');
            const dotsWrap = $('#fx-cf-dots');
            const n = items.length;
            if (!n) return;

            let active = 0, drag = 0, startX = 0, startY = 0, pointerId = null;
            let pressed = false, moved = false, hovering = false, inView = false, timer = null;
            const prev = items.map(() => 0);
            const wrap = (o) => o - n * Math.floor((o + n / 2) / n);
            const mod = (i) => ((i % n) + n) % n;
            const spacing = () => items[0].offsetWidth * (root.offsetWidth < 640 ? 0.6 : 0.78);

            const dots = items.map((_, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'fx-cf-dot';
                b.setAttribute('aria-label', 'Poster ' + (i + 1));
                b.addEventListener('click', () => { go(i); restart(); });
                if (dotsWrap) dotsWrap.appendChild(b);
                return b;
            });

            function place(it, off) {
                const small = root.offsetWidth < 640;
                const sp = spacing();
                const a = Math.abs(off), s = Math.sign(off);
                const x = s * (Math.min(a, 1) * sp + Math.max(a - 1, 0) * sp * 0.5);
                const z = -Math.min(a, 2.2) * (small ? 130 : 180);
                const ry = -s * Math.min(a, 1) * (small ? 40 : 44);
                const op = a >= 1.85 ? 0 : a > 1 ? 1 - (a - 1) / 0.85 : 1;
                it.style.transform = 'translateX(-50%) translateX(' + x.toFixed(1) + 'px) translateZ(' + z.toFixed(1) + 'px) rotateY(' + ry.toFixed(1) + 'deg)';
                it.style.opacity = op.toFixed(3);
                it.style.zIndex = String(100 - Math.round(a * 10));
                it.style.pointerEvents = op < 0.1 ? 'none' : '';
                it.classList.toggle('is-active', a < 0.5);
                it.tabIndex = a < 0.5 ? 0 : -1;
                it.setAttribute('aria-hidden', op < 0.1 ? 'true' : 'false');
            }

            function layout() {
                if (!items[0].offsetWidth) return;
                const d = drag / spacing();
                const offs = items.map((_, i) => wrap(i - active + d));
                if (!pressed) {
                    const jumped = [];
                    items.forEach((it, i) => {
                        if (Math.abs(offs[i] - prev[i]) > 1.5) {
                            it.style.transition = 'none';
                            place(it, prev[i] + n * Math.round((offs[i] - prev[i]) / n));
                            jumped.push(it);
                        }
                    });
                    if (jumped.length) { void root.offsetWidth; jumped.forEach((it) => { it.style.transition = ''; }); }
                }
                items.forEach((it, i) => { place(it, offs[i]); prev[i] = offs[i]; });
                const cur = mod(Math.round(active - d));
                dots.forEach((b, i) => b.classList.toggle('is-active', i === cur));
                caps.forEach((c, i) => c.classList.toggle('is-active', i === cur));
            }

            function go(i) { active = mod(i); layout(); }
            const next = () => go(active + 1);
            const prevItem = () => go(active - 1);
            function stop() { clearInterval(timer); timer = null; }
            function restart() {
                stop();
                if (reduceMotion) return;
                timer = setInterval(() => {
                    if (!hovering && !pressed && inView && !document.hidden && !lbOpen) next();
                }, 4800);
            }

            $('.fx-cf-nav.next', root).addEventListener('click', () => { next(); restart(); });
            $('.fx-cf-nav.prev', root).addEventListener('click', () => { prevItem(); restart(); });
            root.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') { e.preventDefault(); next(); restart(); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); prevItem(); restart(); }
            });
            root.addEventListener('mouseenter', () => { hovering = true; });
            root.addEventListener('mouseleave', () => { hovering = false; });

            items.forEach((it, i) => it.addEventListener('click', (e) => {
                if (moved) { e.preventDefault(); return; }
                if (Math.abs(wrap(i - active)) < 0.5) openLightbox($('img', it));
                else { go(i); restart(); }
            }));
            // some browsers hit-test 3D layers imprecisely: a tap that lands on the stage but inside
            // the front poster still opens it
            stage.addEventListener('click', (e) => {
                if (moved || e.target !== stage) return;
                const it = items[mod(active)], r = it.getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) openLightbox($('img', it));
            });

            stage.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                pressed = true; moved = false; drag = 0;
                startX = e.clientX; startY = e.clientY; pointerId = e.pointerId;
            });
            window.addEventListener('pointermove', (e) => {
                if (!pressed || e.pointerId !== pointerId) return;
                const dx = e.clientX - startX, dy = e.clientY - startY;
                if (!moved) {
                    if (Math.abs(dx) < 8) return;
                    if (Math.abs(dy) > Math.abs(dx)) { pressed = false; return; }
                    moved = true;
                    root.classList.add('is-dragging');
                }
                drag = dx;
                layout();
            });
            const endDrag = () => {
                if (!pressed) return;
                pressed = false;
                if (moved) {
                    const sp = spacing();
                    let steps = Math.round(-drag / sp);
                    if (!steps && Math.abs(drag) > 40) steps = drag < 0 ? 1 : -1;
                    active = mod(active + steps);
                    drag = 0;
                    root.classList.remove('is-dragging');
                    items.forEach((it, i) => { prev[i] = wrap(i - active); });
                    layout();
                    restart();
                    setTimeout(() => { moved = false; }, 60);
                }
            };
            window.addEventListener('pointerup', endDrag);
            window.addEventListener('pointercancel', endDrag);

            new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; }, { threshold: 0.3 }).observe(root);
            if ('ResizeObserver' in window) new ResizeObserver(layout).observe(root);
            else window.addEventListener('resize', layout);
            items.forEach((it, i) => { prev[i] = wrap(i - active); });
            layout();
            restart();
        })();

        /* =========================================================
           3D HERO
           ========================================================= */
        const hero = $('#hero3d');
        if (!hero) { requestScroll(); return; }
        const stageEl = $('#fx-arch-stage');
        const arch3d = $('#fx-arch-3d');
        const canvas = $('#hero-canvas');
        const showerEl = $('#fx-shower');
        const blessing = $('#fx-blessing');

        const target = { x: 0, y: 0 };
        const cur = { x: 0, y: 0 };
        let heroSP = 0, heroMV = 0, lastInput = -1e9, running = false, gl3d = null, flare = 0, lastT = 0;
        const t0 = performance.now();
        const nowT = () => (performance.now() - t0) / 1000;

        hero.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            target.x = clamp((e.clientX / window.innerWidth - 0.5) * 2, -1, 1);
            target.y = clamp(-(e.clientY / window.innerHeight - 0.5) * 2, -1, 1);
            lastInput = performance.now();
        });
        hero.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });
        // Android phones: tilt the phone to look around (iPhone asks permission, so it uses a gentle sway)
        if (!finePointer && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
            window.addEventListener('deviceorientation', (e) => {
                if (e.gamma == null || e.beta == null) return;
                target.x = clamp(e.gamma / 25, -1, 1);
                target.y = clamp((50 - e.beta) / 25, -1, 1);
                lastInput = performance.now();
            }, { passive: true });
        }

        // scroll progress of the hero (pinned on computers, normal on phones)
        scrollFns.push((vh) => {
            if (lite) return;
            const r = rectOf(measure_(hero));
            const pinned = pinMQ.matches && !reduceMotion;
            const sp = pinned ? clamp(-r.top / Math.max(1, r.height - vh), 0, 1)
                              : clamp(-r.top / Math.max(1, r.height * 0.85), 0, 1);
            if (Math.abs(sp - heroSP) < 0.0005 && hero.style.getPropertyValue('--sp')) return;
            heroSP = reduceMotion ? 0 : sp;
            // on computers the arch glides to the centre while the text lifts away
            const k = clamp((heroSP - 0.08) / 0.75, 0, 1);
            heroMV = pinned ? k * k * (3 - 2 * k) : 0;
            hero.style.setProperty('--sp', heroSP.toFixed(4));
            hero.style.setProperty('--mv', heroMV.toFixed(4));
            if (!running) applyArch();
            if (!running && gl3d) gl3d.render(nowT(), 0, cur, flare, heroSP, heroMV);
        });

        function measure() {
            const hr = hero.firstElementChild.getBoundingClientRect();     // the sticky viewport
            const sr = stageEl.getBoundingClientRect();
            if (!hr.width || !sr.width) return null;
            const archH = sr.height;      // the stage itself is never transformed, so this is exact
            const m = { w: hr.width, h: hr.height, cx: sr.left - hr.left + sr.width / 2, cy: sr.top - hr.top + sr.height / 2 - archH * 0.08, archH };
            hero.style.setProperty('--hx', m.cx.toFixed(0) + 'px');
            hero.style.setProperty('--hy', m.cy.toFixed(0) + 'px');
            hero.style.setProperty('--acx', (m.w / 2 - m.cx).toFixed(0) + 'px');
            return m;
        }
        function syncSize() {
            const m = measure();
            if (m && gl3d) { gl3d.resize(m); if (!running) gl3d.render(nowT(), 0, cur, flare, heroSP, heroMV); }
        }
        function applyArch() {
            hero.style.setProperty('--bgx', (-cur.x * 18).toFixed(1) + 'px');
            hero.style.setProperty('--bgy', (cur.y * 12).toFixed(1) + 'px');
            arch3d.style.setProperty('--ry', (cur.x * 14).toFixed(2) + 'deg');
            arch3d.style.setProperty('--rx', (cur.y * 10 + Math.sin(heroSP * Math.PI) * 16).toFixed(2) + 'deg');
        }

        function frame(now) {
            if (!running || lite) { running = false; return; }
            if (pageHome.classList.contains('hidden')) { running = false; return; }
            if (phone && now - lastT < 30) { requestAnimationFrame(frame); return; }   // phones: ~30 fps is plenty
            const dt = Math.min(0.05, (now - lastT) / 1000);
            lastT = now;
            const t = (now - t0) / 1000;
            let tx = target.x, ty = target.y;
            if (now - lastInput > 2600) { tx = Math.sin(t * 0.45) * 0.45; ty = Math.sin(t * 0.33 + 1) * 0.3; }
            const k = Math.min(1, dt * 3.2);
            cur.x += (tx - cur.x) * k;
            cur.y += (ty - cur.y) * k;
            applyArch();
            flare *= Math.pow(0.35, dt);
            if (gl3d) gl3d.render(t, dt, cur, flare, heroSP, heroMV);
            requestAnimationFrame(frame);
        }
        function start() {
            if (running || reduceMotion || lite || document.hidden) return;
            running = true;
            lastT = performance.now();
            syncSize();
            requestScroll();
            requestAnimationFrame(frame);
        }
        const stopLoop = () => { running = false; };

        new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) start(); else stopLoop();
        }, { threshold: 0 }).observe(hero.firstElementChild);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stopLoop(); else if (!pageHome.classList.contains('hidden')) start();
        });
        if ('ResizeObserver' in window) new ResizeObserver(syncSize).observe(hero.firstElementChild);
        else window.addEventListener('resize', syncSize);
        setTimeout(syncSize, 1300);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncSize);

        const hint = $('#fx-scroll-hint');
        if (hint) hint.addEventListener('click', () => {
            const s = $('#fx-stats');
            if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' });
        });

        /* ---- Pushparchane: offer flowers to Pranadevaru ---- */
        const petalColors = [['#ffb703', '#fb8500'], ['#ffd166', '#f4a261'], ['#fff8e7', '#f1e3c6'], ['#ff9f1c', '#e85d04'], ['#ffe066', '#f9c74f']];
        let blessTimer = null;
        function offerFlowers() {
            flare = 1;
            stageEl.classList.add('is-blessed');
            setTimeout(() => stageEl.classList.remove('is-blessed'), 2600);
            if (blessing) {
                blessing.classList.add('show');
                clearTimeout(blessTimer);
                blessTimer = setTimeout(() => blessing.classList.remove('show'), 3600);
            }
            if (!running && gl3d) gl3d.render(nowT(), 0, cur, 1, heroSP, heroMV);
            if (reduceMotion || !showerEl || showerEl.childElementCount > 140) return;
            const hr = hero.firstElementChild.getBoundingClientRect();
            const sr = stageEl.getBoundingClientRect();
            const cx = sr.left - hr.left + sr.width / 2;
            const landing = sr.bottom - hr.top;
            const count = isSmall() ? 28 : 42;
            for (let i = 0; i < count; i++) {
                const p = document.createElement('span');
                const c = petalColors[i % petalColors.length];
                p.className = 'fx-petal';
                p.style.left = (cx + (Math.random() - 0.5) * sr.width * 1.5).toFixed(0) + 'px';
                p.style.setProperty('--c1', c[0]);
                p.style.setProperty('--c2', c[1]);
                p.style.setProperty('--s', (9 + Math.random() * 10).toFixed(1) + 'px');
                p.style.setProperty('--t', (2.6 + Math.random() * 1.8).toFixed(2) + 's');
                p.style.setProperty('--delay', (Math.random() * 1.1).toFixed(2) + 's');
                p.style.setProperty('--dx', ((Math.random() - 0.5) * 140).toFixed(0) + 'px');
                p.style.setProperty('--fy', (landing + 10 + Math.random() * 140).toFixed(0) + 'px');
                p.style.setProperty('--rx', (360 + Math.random() * 540).toFixed(0) + 'deg');
                p.style.setProperty('--ry', (180 + Math.random() * 360).toFixed(0) + 'deg');
                p.style.setProperty('--rz', ((Math.random() - 0.5) * 360).toFixed(0) + 'deg');
                p.addEventListener('animationend', () => p.remove());
                showerEl.appendChild(p);
            }
        }
        const offerBtn = $('#fx-offer');
        if (offerBtn) offerBtn.addEventListener('click', offerFlowers);
        const archBtn = $('#fx-arch');
        if (archBtn) archBtn.addEventListener('click', offerFlowers);

        /* ---- WebGL scene: golden prabhavali halo, rising embers, drifting petals ---- */
        function createHeroGL(cv) {
            let gl = null;
            try { gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' }); } catch (err) { gl = null; }
            if (!gl) return null;

            const VS = [
                'attribute vec3 aPos; attribute float aSize; attribute vec4 aColor; attribute vec3 aShape;',
                'uniform mat4 uModel; uniform mat4 uProj; uniform float uCamZ; uniform float uScale;',
                'varying vec4 vColor; varying vec3 vShape;',
                'void main(){',
                '  vec4 w = uModel * vec4(aPos, 1.0);',
                '  vec4 v = vec4(w.xyz - vec3(0.0, 0.0, uCamZ), 1.0);',
                '  gl_Position = uProj * v;',
                '  gl_PointSize = aSize * uScale / max(0.1, -v.z);',
                '  vColor = aColor; vShape = aShape;',
                '}'
            ].join('\n');
            const FS = [
                'precision mediump float;',
                'varying vec4 vColor; varying vec3 vShape;',
                'void main(){',
                '  vec2 p = gl_PointCoord * 2.0 - 1.0; p.y = -p.y;',
                '  float a = 0.0; vec3 col = vColor.rgb;',
                '  if (vShape.x < 0.5) {',
                '    float d = length(p); a = 1.0 - smoothstep(0.0, 1.0, d); a *= a;',
                '    col = mix(col, vec3(1.0), a * 0.45);',
                '  } else {',
                '    float c = cos(vShape.y), s = sin(vShape.y);',
                '    vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);',
                '    if (vShape.x < 1.5) {',
                '      float t = (q.y + 0.75) / 1.6;',
                '      float w = 0.46 * sin(3.14159 * pow(clamp(t, 0.0, 1.0), 0.55));',
                '      float e = 1.0 - abs(q.x) / max(w, 0.001);',
                '      a = smoothstep(0.0, 0.55, e) * step(0.0, t) * step(t, 1.0);',
                '      col = mix(col, vec3(1.0, 0.97, 0.86), clamp(e * (1.0 - t) * 1.2, 0.0, 1.0));',
                '    } else {',
                '      float sq = max(0.12, vShape.z); q.x /= sq;',
                '      float y = q.y / 0.95;',
                '      float w = 0.5 * pow(max(0.0, 1.0 - y * y), 0.65);',
                '      a = smoothstep(0.0, 0.08, w - abs(q.x)) * step(abs(y), 1.0);',
                '      float rib = smoothstep(0.0, w + 0.001, abs(q.x));',
                '      col = col * (0.78 + 0.22 * rib) * (0.62 + 0.38 * sq);',
                '    }',
                '  }',
                '  a *= vColor.a;',
                '  if (a < 0.004) discard;',
                '  gl_FragColor = vec4(col * a, a);',
                '}'
            ].join('\n');

            function compile(type, src) {
                const s = gl.createShader(type);
                gl.shaderSource(s, src);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
                return s;
            }
            const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
            if (!vs || !fs) return null;
            const prog = gl.createProgram();
            gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
            gl.useProgram(prog);

            const loc = {
                pos: gl.getAttribLocation(prog, 'aPos'), size: gl.getAttribLocation(prog, 'aSize'),
                color: gl.getAttribLocation(prog, 'aColor'), shape: gl.getAttribLocation(prog, 'aShape'),
                model: gl.getUniformLocation(prog, 'uModel'), proj: gl.getUniformLocation(prog, 'uProj'),
                camZ: gl.getUniformLocation(prog, 'uCamZ'), scale: gl.getUniformLocation(prog, 'uScale')
            };
            const STRIDE = 11;
            const maxPoint = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) || [1, 64])[1];
            const low = phone || isSmall() || (navigator.hardwareConcurrency || 8) <= 4;
            const FOV = 45 * Math.PI / 180, CAMZ = 10, TAN = Math.tan(FOV / 2);
            let W = 1, H = 1, aspect = 1, haloX = 0, haloY = 0, haloS = 1, haloDX = 0, ready = false;

            function makeLayer(count) { return { data: new Float32Array(count * STRIDE), buf: gl.createBuffer(), n: 0, cap: count }; }
            function put(L, x, y, z, size, r, g, b, a, kind, ang, sq) {
                if (L.n >= L.cap) return;
                const o = L.n * STRIDE, d = L.data;
                d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = size;
                d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a;
                d[o + 8] = kind; d[o + 9] = ang; d[o + 10] = sq;
                L.n++;
            }

            const RING = low ? 120 : 190, DASH = 60, DASHPTS = 4, FAINT = low ? 140 : 220, FLAMES = low ? 22 : 30, ORBS = 8, OUTER = low ? 90 : 150;
            const ringJit = Array.from({ length: RING }, () => [(Math.random() - 0.5) * 0.035, (Math.random() - 0.5) * 0.06, 0.6 + Math.random() * 0.4]);
            const haloL = makeLayer(RING + DASH * DASHPTS + FAINT + FLAMES + ORBS + OUTER);

            const DUST = low ? 90 : 210, EMB = low ? 22 : 46, PET = low ? 12 : 24;
            const dust = [], emb = [], pet = [];
            const halfH = (z) => (CAMZ - z) * TAN;
            const halfW = (z) => halfH(z) * aspect;
            function spawnDust(o, initial) {
                o.z = -6 + Math.random() * 8.5;
                o.x = (Math.random() * 2 - 1) * (halfW(o.z) + 0.6);
                o.y = initial ? (Math.random() * 2 - 1) * halfH(o.z) : -halfH(o.z) - 0.3;
                o.v = 0.12 + Math.random() * 0.4;
                o.ph = Math.random() * 6.283;
                return o;
            }
            const petalPal = [[1, .62, .11], [1, .75, .28], [1, .96, .86], [.97, .5, .05], [1, .82, .4]];
            function spawnPetal(o, initial) {
                o.z = -5 + Math.random() * 6;
                o.x = (Math.random() * 2 - 1) * (halfW(o.z) + 0.4);
                o.y = initial ? (Math.random() * 2 - 1) * halfH(o.z) : halfH(o.z) + 0.5;
                o.v = 0.28 + Math.random() * 0.3;
                o.s = 0.2 + Math.random() * 0.16;
                o.rot = Math.random() * 6.283; o.vr = (Math.random() - 0.5) * 1.4;
                o.tum = Math.random() * 6.283; o.vt = 0.9 + Math.random() * 1.6;
                o.ph = Math.random() * 6.283;
                o.c = petalPal[Math.floor(Math.random() * petalPal.length)];
                return o;
            }
            const bgL = makeLayer(DUST + EMB);
            const petL = makeLayer(PET);

            const proj = new Float32Array(16);
            function setProj() {
                const f = 1 / TAN, nr = 0.1, fr = 100;
                proj.fill(0);
                proj[0] = f / aspect; proj[5] = f;
                proj[10] = (fr + nr) / (nr - fr); proj[11] = -1;
                proj[14] = (2 * fr * nr) / (nr - fr);
            }
            // M = T * Ry * Rx * S  (column-major)
            function modelTRS(tx, ty, tz, rx, ry, s) {
                const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
                return new Float32Array([
                    cy * s, 0, -sy * s, 0,
                    sy * sx * s, cx * s, cy * sx * s, 0,
                    sy * cx * s, -sx * s, cy * cx * s, 0,
                    tx, ty, tz, 1
                ]);
            }
            function upload(L) {
                gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
                gl.bufferData(gl.ARRAY_BUFFER, L.data.subarray(0, L.n * STRIDE), gl.DYNAMIC_DRAW);
                const B = 4 * STRIDE;
                gl.enableVertexAttribArray(loc.pos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, B, 0);
                gl.enableVertexAttribArray(loc.size); gl.vertexAttribPointer(loc.size, 1, gl.FLOAT, false, B, 12);
                gl.enableVertexAttribArray(loc.color); gl.vertexAttribPointer(loc.color, 4, gl.FLOAT, false, B, 16);
                gl.enableVertexAttribArray(loc.shape); gl.vertexAttribPointer(loc.shape, 3, gl.FLOAT, false, B, 32);
            }
            function draw(L, model, additive) {
                if (!L.n) return;
                upload(L);
                gl.uniformMatrix4fv(loc.model, false, model);
                if (additive) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                gl.drawArrays(gl.POINTS, 0, L.n);
            }

            function resize(m) {
                const dpr = Math.min(window.devicePixelRatio || 1, phone ? 1 : low ? 1.5 : 2);
                W = m.w; H = m.h; aspect = W / H;
                cv.width = Math.max(1, Math.round(W * dpr));
                cv.height = Math.max(1, Math.round(H * dpr));
                gl.viewport(0, 0, cv.width, cv.height);
                setProj();
                const pxToWorld = (2 * TAN * CAMZ) / H;
                haloX = (m.cx - W / 2) * pxToWorld;
                haloY = -(m.cy - H / 2) * pxToWorld;
                haloDX = (W / 2 - m.cx) * pxToWorld;
                haloS = m.archH * (W < 768 ? 0.5 : 0.54) * pxToWorld;
                if (!ready) {
                    for (let i = 0; i < DUST + EMB; i++) (i < DUST ? dust : emb).push(spawnDust({}, true));
                    for (let i = 0; i < PET; i++) pet.push(spawnPetal({}, true));
                    ready = true;
                }
            }

            function render(t, dt, c, fl, sp, mv) {
                if (!ready) return;
                sp = sp || 0; mv = mv || 0;
                const S = haloS;
                const cap = (v) => Math.min(v, maxPoint / (cv.height / (2 * TAN)) * (CAMZ - 1.5));
                const glow = 1 + fl * 0.8 + sp * 0.35;

                // halo layers separate in depth as you scroll (unit radius; drawn with its own matrix)
                const zA = -0.4 * sp, zF = 0.35 * sp, zFl = 0.7 * sp, zO = 1.0 * sp, zOut = -0.8 * sp;
                haloL.n = 0;
                const a1 = t * 0.08;
                for (let i = 0; i < RING; i++) {
                    const th = i / RING * 6.2832 + a1, j = ringJit[i];
                    const r = 1 + j[0];
                    const tw = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.37);
                    put(haloL, Math.cos(th) * r, Math.sin(th) * r, j[1] + zA, 0.05 * S * j[2], 1, .84, .5, Math.min(1, .85 * tw * glow), 0, 0, 1);
                }
                const a2 = -t * 0.12;
                for (let i = 0; i < DASH; i++) {
                    for (let k = 0; k < DASHPTS; k++) {
                        const th = (i + k * 0.12) / DASH * 6.2832 + a2;
                        put(haloL, Math.cos(th) * 1.13, Math.sin(th) * 1.13, 0, 0.022 * S, 1, .8, .35, .55 * glow, 0, 0, 1);
                    }
                }
                for (let i = 0; i < FAINT; i++) {
                    const th = i / FAINT * 6.2832;
                    put(haloL, Math.cos(th) * 1.24, Math.sin(th) * 1.24, zF, 0.018 * S, 1, .85, .55, .35 * glow, 0, 0, 1);
                }
                const a3 = t * 0.03;
                for (let i = 0; i < FLAMES; i++) {
                    const th = i / FLAMES * 6.2832 + a3;
                    const fk = 1 + 0.16 * Math.sin(t * 6 + i * 1.7) + 0.08 * Math.sin(t * 11.3 + i);
                    put(haloL, Math.cos(th) * 1.37, Math.sin(th) * 1.37, zFl, cap(0.27 * S * fk * (1 - sp * 0.4)), 1, .58, .16, Math.min(1, .8 * glow), 1, th - 1.5708, 1);
                }
                const a4 = t * 0.16;
                for (let i = 0; i < ORBS; i++) {
                    const th = i / ORBS * 6.2832 + a4;
                    put(haloL, Math.cos(th) * 1.58, Math.sin(th) * 1.58, zO, cap(0.2 * S * (1 + fl * 0.6)), 1, .9, .65, 1, 0, 0, 1);
                }
                for (let i = 0; i < OUTER; i++) {
                    const th = i / OUTER * 6.2832 - a4 * 0.5;
                    put(haloL, Math.cos(th) * 1.58, Math.sin(th) * 1.58, zOut, 0.016 * S, 1, .82, .5, .3 + sp * .2, 0, 0, 1);
                }

                // embers + dust
                bgL.n = 0;
                for (let i = 0; i < dust.length; i++) {
                    const o = dust[i];
                    o.y += o.v * dt * 0.6;
                    o.x += Math.sin(t * 0.7 + o.ph) * dt * 0.08;
                    if (o.y > halfH(o.z) + 0.3) spawnDust(o, false);
                    const tw = 0.5 + 0.5 * Math.sin(t * 2.5 + o.ph * 3);
                    put(bgL, o.x, o.y, o.z, 0.055, 1, .87, .6, .25 + .45 * tw, 0, 0, 1);
                }
                for (let i = 0; i < emb.length; i++) {
                    const o = emb[i];
                    o.y += o.v * dt * 1.1;
                    o.x += Math.sin(t * 1.1 + o.ph) * dt * 0.15;
                    if (o.y > halfH(o.z) + 0.3) spawnDust(o, false);
                    const fk = 0.55 + 0.45 * Math.sin(t * 4 + o.ph * 5);
                    put(bgL, o.x, o.y, o.z, 0.14, 1, .58, .18, .9 * fk, 0, 0, 1);
                }
                petL.n = 0;
                for (let i = 0; i < pet.length; i++) {
                    const o = pet[i];
                    o.y -= o.v * dt;
                    o.x += Math.sin(t * 0.6 + o.ph) * dt * 0.35;
                    o.rot += o.vr * dt; o.tum += o.vt * dt;
                    if (o.y < -halfH(o.z) - 0.5) spawnPetal(o, false);
                    put(petL, o.x, o.y, o.z, o.s, o.c[0], o.c[1], o.c[2], .82, 2, o.rot, Math.abs(Math.cos(o.tum)));
                }

                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.enable(gl.BLEND);
                gl.disable(gl.DEPTH_TEST);
                gl.uniformMatrix4fv(loc.proj, false, proj);
                gl.uniform1f(loc.camZ, CAMZ);
                gl.uniform1f(loc.scale, cv.height / (2 * TAN));
                // scrolling pushes the particle field toward you (a gentle dolly-in)
                const bgModel = modelTRS(-c.x * 0.45, -c.y * 0.3, sp * 3.2, 0, 0, 1);
                draw(petL, bgModel, false);
                draw(bgL, bgModel, true);
                // the halo tilts back into a 3D ring as you scroll
                draw(haloL, modelTRS(haloX + haloDX * mv, haloY, 0, -c.y * 0.2 - sp * 1.05, c.x * 0.26 + sp * 0.2, S * (1 + sp * 0.5)), true);
            }

            return { resize, render };
        }

        const bootGL = () => {
            gl3d = createHeroGL(canvas);
            if (!gl3d) return;
            const m = measure();
            if (m) gl3d.resize(m);
            gl3d.render(nowT(), 0, cur, 0, heroSP, heroMV);
            hero.classList.add('is-3d');
        };
        if (!lite) {
            if ('requestIdleCallback' in window) requestIdleCallback(bootGL, { timeout: 1200 });
            else setTimeout(bootGL, 300);
        }

        /* ---- switch to the calm version (used by slow phones) ---- */
        const SCROLL_VARS = ['--k', '--sp', '--mv', '--d', '--ex', '--dim', '--bgx', '--bgy', '--rx', '--ry'];
        function goLite(force) {
            if (lite && !force) return;
            lite = true;
            root.classList.add('fx-lite');
            stopLoop();
            hero.classList.remove('is-3d');
            $$('#page-home [style*="--"]').forEach((el) => SCROLL_VARS.forEach((v) => el.style.removeProperty(v)));
            liteHooks.forEach((f) => { try { f(); } catch (err) { /* keep going */ } });
            $$('#page-home [data-count]').forEach((el) => { el.dataset.done = '1'; el.textContent = el.dataset.count; });
            requestScroll();
        }

        if (lite && !reduceMotion) goLite(true);     // weak phone: set up normally, then calm everything down

        /* ---- watch the real frame rate on phones: if it stays low, go lite automatically ---- */
        if (phone && !lite && !forceFull && 'requestAnimationFrame' in window) {
            // every 1.5 s, look at the frames drawn in that time; two slow checks in a row = slow phone
            let samples = [], last = 0, slowChecks = 0, checks = 0, winStart = 0;
            const begin = performance.now() + 1500;
            const tick = (t) => {
                if (lite) return;
                if (document.hidden || pageHome.classList.contains('hidden')) { last = 0; winStart = 0; requestAnimationFrame(tick); return; }
                if (t > begin) {
                    if (last) samples.push(t - last);
                    if (!winStart) winStart = t;
                    if (t - winStart > 1500 && samples.length >= 6) {
                        samples.sort((a, b) => a - b);
                        const median = samples[samples.length >> 1];
                        slowChecks = median > 27 ? slowChecks + 1 : 0;      // slower than ~37 frames a second
                        samples = []; winStart = t; checks++;
                        if (slowChecks >= 2) { goLite(); return; }
                        if (checks >= 16) return;                          // ~25 s of watching is enough
                    }
                }
                last = t;
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }

        /* ---- phones: blurred photo backgrounds without the costly CSS blur filter
                (a tiny copy of the photo, stretched by the browser, looks the same) ---- */
        if (phone) $$('.fx-hero-bg, .fx-cta-bg').forEach((el) => {
            const m = /url\(["']?([^"')]+)["']?\)/.exec(el.style.backgroundImage || '');
            if (!m) return;
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => {
                const w = el.classList.contains('fx-cta-bg') ? 56 : 80;
                const h = Math.max(1, Math.round(w * img.naturalHeight / Math.max(1, img.naturalWidth)));
                const cv = document.createElement('canvas');
                cv.width = w; cv.height = h;
                cv.className = 'fx-bg-soft';
                cv.setAttribute('aria-hidden', 'true');
                try { cv.getContext('2d').drawImage(img, 0, 0, w, h); } catch (err) { return; }
                el.appendChild(cv);
                el.classList.add('has-soft');
            };
            img.onerror = () => el.classList.add('has-soft');
            img.src = m[1];
        });

        requestScroll();
    })();
    
