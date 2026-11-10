    (function () {
        'use strict';
        const $ = (s, r) => (r || document).querySelector(s);
        const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const root = document.documentElement;
        const isKn = () => root.lang === 'kn';
        const shown = (el) => !!(el && el.offsetParent !== null);

        /* ---------- small notice ---------- */
        const toastEl = $('#pg-toast');
        let toastT = 0;
        window.pgToast = function (msg, kind) {
            if (!toastEl) return;
            toastEl.textContent = msg;
            toastEl.classList.toggle('is-error', kind === 'error');
            toastEl.classList.add('is-show');
            clearTimeout(toastT);
            toastT = setTimeout(() => toastEl.classList.remove('is-show'), kind === 'error' ? 4200 : 2600);
        };

        /* ---------- placeholders follow the language ---------- */
        function applyPlaceholders(scope) {
            $$('[data-ph-en]', scope).forEach((el) => {
                const v = isKn() ? (el.dataset.phKn || el.dataset.phEn) : el.dataset.phEn;
                if (el.placeholder !== v) el.placeholder = v;
            });
        }
        window.pgApplyPlaceholders = applyPlaceholders;
        new MutationObserver(() => applyPlaceholders(document)).observe(root, { attributes: true, attributeFilter: ['lang'] });
        applyPlaceholders(document);

        /* ---------- scroll engine (one frame per scroll) ---------- */
        const navbar = $('#navbar');
        let topPx = 72;
        function syncTop() {
            const b = navbar ? Math.max(0, Math.round(navbar.getBoundingClientRect().bottom)) : 0;
            if (b !== topPx) { topPx = b; root.style.setProperty('--pg-top', b + 'px'); }
        }
        const fns = [];
        let ticking = false;
        const homeSec = document.getElementById('page-home');
        function run() {
            ticking = false;
            if (homeSec && !homeSec.classList.contains('hidden')) return;   // homepage has its own scroll engine
            syncTop();
            const vh = window.innerHeight;
            for (let i = 0; i < fns.length; i++) fns[i](vh);
        }
        function req() { if (!ticking) { ticking = true; requestAnimationFrame(run); } }
        window.addEventListener('scroll', req, { passive: true });
        window.addEventListener('resize', req);
        document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.page-nav-link')) { setTimeout(req, 60); setTimeout(req, 400); } });
        // the header slides for 300ms after scrolling, keep sticky bars glued to it
        let followT = 0;
        window.addEventListener('scroll', () => { clearTimeout(followT); followT = setTimeout(req, 320); }, { passive: true });

        function jumpTo(el, extra) {
            if (!el) return;
            const y = el.getBoundingClientRect().top + window.scrollY - (topPx || 72) - (extra == null ? 16 : extra);
            window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
        }

        /* ---------- reveal once ---------- */
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
        $$('.pg-reveal').forEach((el) => (reduce ? el.classList.add('is-in') : io.observe(el)));

        /* ---------- 3D tilt ---------- */
        /* tilt: handled by depth.js */ if (false) $$('.pg-page [data-tilt]').forEach((el) => {
            const max = 7;
            let raf = 0;
            el.addEventListener('pointerenter', () => el.classList.add('is-tilting'));
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                const px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => {
                    el.style.setProperty('--ry', ((px - 0.5) * 2 * max).toFixed(2) + 'deg');
                    el.style.setProperty('--rx', ((0.5 - py) * 2 * max).toFixed(2) + 'deg');
                });
            });
            el.addEventListener('pointerleave', () => {
                cancelAnimationFrame(raf);
                el.classList.remove('is-tilting');
                el.style.setProperty('--rx', '0deg');
                el.style.setProperty('--ry', '0deg');
            });
        });

        /* ---------- page heroes: parallax on scroll + mouse ---------- */
        const heroes = $$('.pg-hero');
        if (!reduce) {
            fns.push(() => {
                heroes.forEach((h) => {
                    if (!shown(h)) return;
                    const r = h.getBoundingClientRect();
                    if (r.bottom < 0) return;
                    h.style.setProperty('--p', clamp(-r.top / r.height, 0, 1).toFixed(4));
                });
            });
            if (fine) heroes.forEach((h) => {
                const bg = $('.pg-hero-bg', h);
                h.addEventListener('mousemove', (e) => {
                    const r = h.getBoundingClientRect();
                    bg.style.setProperty('--hx', (((e.clientX - r.left) / r.width - 0.5) * -26).toFixed(1) + 'px');
                    bg.style.setProperty('--hy', (((e.clientY - r.top) / r.height - 0.5) * -18).toFixed(1) + 'px');
                });
                h.addEventListener('mouseleave', () => { bg.style.setProperty('--hx', '0px'); bg.style.setProperty('--hy', '0px'); });
            });
        }

        /* ---------- sticky bars get a shadow once they stick ---------- */
        const bars = $$('.pg-page .pg-bar');
        fns.push(() => bars.forEach((b) => { if (shown(b)) b.classList.toggle('is-stuck', b.getBoundingClientRect().top <= topPx + 1); }));

        /* ---------- photos: fade in when loaded ---------- */
        function watchImg(fig) {
            const img = $('img', fig);
            if (!img) return;
            const done = () => fig.classList.add('is-loaded');
            if (img.complete && img.naturalWidth) done();
            else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
        }
        $$('.pg-page .pg-ph').forEach(watchImg);

        /* =========================================================
           Photo viewer (lightbox)
           ========================================================= */
        const lb = $('#pg-lb');
        const lbImg = lb ? $('.pg-lb-img', lb) : null;
        const lbCap = $('#pg-lb-cap'), lbCount = $('#pg-lb-count'), lbThumbs = $('#pg-lb-thumbs');
        let lbItems = [], lbIdx = 0, lbOpen = false, lbFocus = null;
        const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        function lbShow(i) {
            const n = lbItems.length;
            if (!n) return;
            lbIdx = (i + n) % n;
            const it = lbItems[lbIdx];
            lb.classList.remove('is-ready');
            lbImg.classList.remove('is-loaded');
            lbImg.onload = () => { lbImg.classList.add('is-loaded'); lb.classList.add('is-ready'); };
            lbImg.onerror = () => lb.classList.add('is-ready');
            lbImg.src = it.src;
            lbImg.alt = it.alt || '';
            lbCap.innerHTML = it.en ? '<span data-lang="en">' + esc(it.en) + '</span><span data-lang="kn">' + esc(it.kn || it.en) + '</span>' : '';
            lbCount.textContent = n > 1 ? (lbIdx + 1) + ' / ' + n : '';
            $$('button', lbThumbs).forEach((b, k) => b.classList.toggle('is-on', k === lbIdx));
            const on = lbThumbs.children[lbIdx];
            if (on) lbThumbs.scrollTo({ left: on.offsetLeft - lbThumbs.clientWidth / 2 + on.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
            [1, -1].forEach((d) => { const p = lbItems[(lbIdx + d + n) % n]; if (p) { const im = new Image(); im.src = p.src; } });
        }
        function lbOpenList(items, start) {
            if (!lb || !items.length) return;
            lbItems = items;
            lb.classList.toggle('is-single', items.length < 2);
            lbThumbs.innerHTML = items.length > 1 ? items.map((it, k) => '<button type="button" aria-label="Photo ' + (k + 1) + '"><img src="' + esc(it.src) + '" alt="" loading="lazy"></button>').join('') : '';
            lbFocus = document.activeElement;
            lb.classList.add('is-open');
            lb.setAttribute('aria-hidden', 'false');
            root.style.overflow = 'hidden';
            lbOpen = true;
            lbShow(start || 0);
            $('.pg-lb-close', lb).focus({ preventScroll: true });
        }
        function lbClose() {
            if (!lbOpen) return;
            lbOpen = false;
            lb.classList.remove('is-open');
            lb.setAttribute('aria-hidden', 'true');
            root.style.overflow = '';
            if (lbFocus && lbFocus.focus) lbFocus.focus({ preventScroll: true });
        }
        window.pgLightbox = { open: lbOpenList, close: lbClose };
        if (lb) {
            lb.addEventListener('click', (e) => {
                if (e.target.closest('.pg-lb-close')) return lbClose();
                if (e.target.closest('.pg-lb-nav.prev')) return lbShow(lbIdx - 1);
                if (e.target.closest('.pg-lb-nav.next')) return lbShow(lbIdx + 1);
                const t = e.target.closest('.pg-lb-thumbs button');
                if (t) return lbShow(Array.prototype.indexOf.call(lbThumbs.children, t));
                if (e.target === lb || e.target.classList.contains('pg-lb-stage')) lbClose();
            });
            document.addEventListener('keydown', (e) => {
                if (!lbOpen) return;
                if (e.key === 'Escape') lbClose();
                else if (e.key === 'ArrowRight') lbShow(lbIdx + 1);
                else if (e.key === 'ArrowLeft') lbShow(lbIdx - 1);
            });
            let sx = 0, sy = 0, down = false;
            const stage = $('.pg-lb-stage', lb);
            stage.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; });
            stage.addEventListener('pointerup', (e) => {
                if (!down) return;
                down = false;
                const dx = e.clientX - sx, dy = e.clientY - sy;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && lbItems.length > 1) lbShow(lbIdx + (dx < 0 ? 1 : -1));
            });
        }
        function itemFromFig(fig, fallbackEn, fallbackKn) {
            const b = $('button', fig), img = $('img', fig);
            return {
                src: (b && b.dataset.src) || (img && img.src),
                alt: img ? img.alt : '',
                en: fig.dataset.capEn || fallbackEn || '',
                kn: fig.dataset.capKn || fallbackKn || ''
            };
        }

        /* =========================================================
           Gallery — albums filter + viewer
           ========================================================= */
        const gal = $('#page-gallery');
        if (gal) {
            const chips = $$('.pg-chip', gal);
            const groups = $$('.pg-gal-group', gal);
            const bar = $('.pg-bar', gal);
            chips.forEach((c) => c.addEventListener('click', () => {
                const f = c.dataset.f;
                chips.forEach((x) => { const on = x === c; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
                groups.forEach((g) => {
                    const show = f === 'all' || g.dataset.g === f;
                    g.hidden = !show;
                    g.classList.remove('is-enter');
                    if (show && !reduce) { void g.offsetWidth; g.classList.add('is-enter'); }
                    if (show) $$('.pg-reveal', g).forEach((el) => el.classList.add('is-in'));
                });
                c.parentElement.scrollTo({ left: c.offsetLeft - 40, behavior: reduce ? 'auto' : 'smooth' });
                const firstShown = groups.find((g) => !g.hidden);
                if (firstShown && bar && bar.getBoundingClientRect().top <= topPx + 2) jumpTo(firstShown, (bar.offsetHeight || 60) - 10);
            }));
            gal.addEventListener('click', (e) => {
                const btn = e.target.closest('.pg-ph > button');
                if (!btn) return;
                const figs = $$('.pg-gal-group:not([hidden]) .pg-ph', gal);
                const fig = btn.parentElement;
                const items = figs.map((f) => { const g = f.closest('.pg-gal-group'); return itemFromFig(f, g.dataset.tEn, g.dataset.tKn); });
                lbOpenList(items, figs.indexOf(fig));
            });
        }

        /* =========================================================
           Events — timeline fills as you scroll, year chips follow
           ========================================================= */
        const evPage = $('#page-events');
        if (evPage) {
            const wrap = $('.pg-ev-wrap', evPage);
            const line = $('.pg-ev-line span', evPage);
            const items = $$('.pg-ev-item', evPage);
            const yearBtns = $$('.pg-year', evPage);
            const yearBar = $('.pg-years', evPage);
            let activeYear = null;
            function setYear(y) {
                if (y === activeYear) return;
                activeYear = y;
                yearBtns.forEach((b) => {
                    const on = b.dataset.y === y;
                    b.classList.toggle('is-on', on);
                    if (on && yearBar) yearBar.scrollTo({ left: b.offsetLeft - yearBar.clientWidth / 2 + b.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
                });
            }
            fns.push((vh) => {
                if (!shown(wrap)) return;
                const mark = vh * 0.55;
                const r = wrap.getBoundingClientRect();
                const p = clamp((mark - r.top) / r.height, 0, 1);
                if (line) line.style.setProperty('--ev', reduce ? 1 : p.toFixed(4));
                let cur = items[0] ? items[0].dataset.y : null;
                items.forEach((it) => {
                    const lit = reduce || it.getBoundingClientRect().top < mark;
                    it.classList.toggle('is-lit', lit);
                    if (it.getBoundingClientRect().top < mark) cur = it.dataset.y;
                });
                setYear(cur);
            });
            yearBtns.forEach((b) => b.addEventListener('click', () => {
                const t = document.getElementById('ev-' + b.dataset.y);
                const barH = ($('.pg-bar', evPage) || {}).offsetHeight || 60;
                jumpTo(t, barH + 6);
            }));
            evPage.addEventListener('click', (e) => {
                const btn = e.target.closest('.pg-ph > button');
                if (!btn) return;
                const figs = $$('.pg-ev-item .pg-ph', evPage);
                const list = figs.map((f) => {
                    const it = f.closest('.pg-ev-item');
                    const y = it.dataset.y;
                    const capEn = y + ' · ' + it.dataset.tEn + (f.dataset.capEn ? ' — ' + f.dataset.capEn : '');
                    const capKn = y + ' · ' + it.dataset.tKn + (f.dataset.capKn ? ' — ' + f.dataset.capKn : '');
                    const o = itemFromFig(f); o.en = capEn; o.kn = capKn; return o;
                });
                lbOpenList(list, figs.indexOf(btn.parentElement));
            });
        }

        /* =========================================================
           About — chapter contents, guru parampara lights up, 732 count
           ========================================================= */
        const about = $('#page-about');
        if (about) {
            const links = $$('.pg-toc a[data-jump]', about);
            const chapters = links.map((a) => document.getElementById(a.dataset.jump));
            const main = $('.pg-about-main', about);
            const track = $('.pg-toc-track', about);
            const tocList = $('.pg-toc ol', about);
            let activeCh = -1;
            links.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); jumpTo(chapters[i], window.innerWidth < 1024 ? 70 : 24); }));
            const chains = $$('[data-lineage]', about).map((box) => ({ box, lis: $$('.pg-chain li', box) }));
            fns.push((vh) => {
                if (!shown(main)) return;
                let a = 0;
                chapters.forEach((c, i) => { if (c && c.getBoundingClientRect().top < vh * 0.4) a = i; });
                if (a !== activeCh) {
                    activeCh = a;
                    links.forEach((l, i) => l.classList.toggle('is-on', i === a));
                    const on = links[a];
                    if (on && tocList && window.innerWidth < 1024) tocList.scrollTo({ left: on.parentElement.offsetLeft - 20, behavior: reduce ? 'auto' : 'smooth' });
                }
                const mr = main.getBoundingClientRect();
                if (track) track.style.setProperty('--tp', clamp((vh * 0.4 - mr.top) / mr.height, 0, 1).toFixed(4));
                chains.forEach(({ box, lis }) => {
                    const r = box.getBoundingClientRect();
                    if (r.bottom < -50 || r.top > vh + 50) return;
                    const p = reduce ? 1 : clamp((vh * 0.82 - r.top) / (r.height * 0.9), 0, 1);
                    const lit = Math.round(p * lis.length);
                    lis.forEach((li, k) => li.classList.toggle('is-lit', k < lit));
                });
            });
            const num = $('.pg-732 [data-pg-count]', about);
            if (num && !reduce) {
                num.textContent = '0';
                const cio = new IntersectionObserver((en) => {
                    if (!en[0].isIntersecting) return;
                    cio.disconnect();
                    const t0 = performance.now(), end = 732;
                    const step = (now) => { const k = Math.min(1, (now - t0) / 1600); num.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
                    requestAnimationFrame(step);
                }, { threshold: 0.6 });
                cio.observe(num);
            }
        }

        /* =========================================================
           Trust — stacked photo decks
           ========================================================= */
        $$('[data-deck]').forEach((deck) => {
            const cards = $$('.pg-deck-card', deck);
            const n = cards.length;
            const stage = $('.pg-deck-stage', deck);
            const countB = $('.pg-deck-count b', deck);
            const dur = 4500;
            let idx = 0, timer = 0, visible = false, hover = false;
            deck.dataset.cards = n;
            deck.style.setProperty('--deck-t', dur + 'ms');
            function load(c) {
                if (c.dataset.loaded) return;
                c.dataset.loaded = '1';
                const img = $('img', c);
                img.addEventListener('load', () => { c.style.animation = 'none'; c.style.background = '#e6d9bf'; }, { once: true });
                img.src = c.dataset.src;
            }
            function render() {
                cards.forEach((c, i) => {
                    let d = (i - idx + n) % n;
                    if (n > 2 && d === n - 1) d = -1;
                    const pos = (d >= -1 && d <= 2) ? String(d) : 'x';
                    c.dataset.pos = pos;
                    if (pos !== 'x' && pos !== '-1') load(c);
                    c.setAttribute('aria-hidden', pos === '0' ? 'false' : 'true');
                });
                if (countB) countB.textContent = String(idx + 1).padStart(2, '0');
            }
            function go(k) { idx = (k + n) % n; render(); restart(); }
            function stop() { clearTimeout(timer); timer = 0; deck.classList.remove('is-playing'); }
            function restart() {
                stop();
                if (reduce || !visible || hover || n < 2 || !shown(deck)) return;
                void deck.offsetWidth;
                deck.classList.add('is-playing');
                timer = setTimeout(() => go(idx + 1), dur);
            }
            render();
            $$('.pg-deck-btn', deck).forEach((b) => b.addEventListener('click', () => go(idx + Number(b.dataset.dir))));
            const openAll = (start) => {
                const items = cards.map((c) => ({ src: c.dataset.src, alt: $('img', c).alt, en: deck.dataset.capEn, kn: deck.dataset.capKn }));
                lbOpenList(items, start);
            };
            stage.addEventListener('click', (e) => { if (!moved && e.target.closest('.pg-deck-card[data-pos="0"]')) openAll(idx); });
            $('.pg-deck-all', deck).addEventListener('click', () => openAll(idx));
            stage.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
                else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
                else if (e.key === 'Enter') openAll(idx);
            });
            let sx = 0, sy = 0, moved = false, isDown = false;
            stage.addEventListener('pointerdown', (e) => { isDown = true; moved = false; sx = e.clientX; sy = e.clientY; });
            stage.addEventListener('pointerup', (e) => {
                if (!isDown) return;
                isDown = false;
                const dx = e.clientX - sx, dy = e.clientY - sy;
                if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { moved = true; go(idx + (dx < 0 ? 1 : -1)); setTimeout(() => { moved = false; }, 50); }
            });
            deck.addEventListener('mouseenter', () => { hover = true; stop(); });
            deck.addEventListener('mouseleave', () => { hover = false; restart(); });
            new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) restart(); else stop(); }, { threshold: 0.35 }).observe(deck);
            document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.page-nav-link')) setTimeout(restart, 120); });
        });

        /* in-page jump links (Trust pillars) */
        $$('.pg-page a[data-jump]').forEach((a) => {
            if (a.closest('.pg-toc')) return;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                jumpTo(document.getElementById(a.dataset.jump), 20);
                const f = a.dataset.flash && document.getElementById(a.dataset.flash);
                if (f) setTimeout(() => {
                    f.classList.remove('is-flash'); void f.offsetWidth; f.classList.add('is-flash');
                    setTimeout(() => f.classList.remove('is-flash'), 2200);
                }, reduce ? 0 : 650);
            });
        });

        /* =========================================================
           Copy buttons (bank details, UPI ID)
           ========================================================= */
        function copyText(text) {
            if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
            return new Promise((res, rej) => {
                const ta = document.createElement('textarea');
                ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy') ? res() : rej(); } catch (err) { rej(err); }
                ta.remove();
            });
        }
        document.addEventListener('click', (e) => {
            const b = e.target.closest && e.target.closest('[data-copy], [data-copy-target]');
            if (!b) return;
            const t = b.dataset.copyTarget ? document.getElementById(b.dataset.copyTarget) : null;
            const text = b.dataset.copy || (t ? t.textContent.trim() : '');
            if (!text) return;
            copyText(text).then(() => {
                b.classList.add('is-copied');
                setTimeout(() => b.classList.remove('is-copied'), 1600);
                window.pgToast((isKn() ? 'ನಕಲಿಸಲಾಗಿದೆ: ' : 'Copied: ') + (text.length > 40 ? text.split('\n')[0].slice(0, 40) + '…' : text));
            }).catch(() => window.pgToast(isKn() ? 'ನಕಲಿಸಲು ಆಗಲಿಲ್ಲ — ಕೈಯಿಂದ ಆಯ್ಕೆಮಾಡಿ' : 'Could not copy — please select it manually', 'error'));
        });

        requestAnimationFrame(run);
        setTimeout(req, 600);
    })();
    
