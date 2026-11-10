(function () {
  'use strict';
  function init(sec) {
  var D = JSON.parse(sec.querySelector('#vt-data').textContent);
  var root = document.documentElement;
  var KN = '೦೧೨೩೪೫೬೭೮೯';
  function knNum(n) { return String(n).replace(/\d/g, function (d) { return KN[+d]; }); }
  function esc(s) { return s; } // content is our own, already HTML-safe
  function T(o) { return '<span data-lang="en">' + esc(o[0]) + '</span><span data-lang="kn">' + esc(o[1]) + '</span>'; }
  function N(n) { return '<span data-lang="en">' + n + '</span><span data-lang="kn">' + knNum(n) + '</span>'; }
  function U(k) { return T(D.ui[k]); }
  function F(k, map) { // UI string with {placeholders}, both languages
    var o = D.ui[k];
    return T([o[0], o[1]].map(function (s, li) {
      return s.replace(/\{(\w+)\}/g, function (_, p) { var v = map[p]; return li ? knNum(v) : v; });
    }));
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- saved progress (this browser only) ---------- */
  var P = {};
  try { P = JSON.parse(localStorage.getItem('vyc-progress') || '{}') || {}; } catch (e) { P = {}; }
  P.quiz = P.quiz || {}; P.games = P.games || {};
  function save() { try { localStorage.setItem('vyc-progress', JSON.stringify(P)); } catch (e) {} refresh(); }

  /* ---------- reading progress + chapter dots ---------- */
  var bar = $('.vt-prog i', sec), ticking = false, chapters = $$('.vt-ch', sec), dots = $$('.vt-dot[data-ch]', sec), navbar = document.getElementById('navbar');
  function setTop() { var t = navbar ? Math.max(0, Math.round(navbar.getBoundingClientRect().bottom)) : 0; sec.style.setProperty('--vt-top', t + 'px'); }
  function onScroll() {
    if (ticking || sec.classList.contains('hidden')) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false; setTop();
      var top = sec.getBoundingClientRect().top + scrollY, h = sec.offsetHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.max(0, Math.min(1, (scrollY - top) / h)) : 0) + ')';
      var here = -1, mid = innerHeight * 0.35;
      for (var i = 0; i < chapters.length; i++) if (chapters[i].getBoundingClientRect().top < mid) here = i;
      dots.forEach(function (d, i) { d.classList.toggle('is-here', i === here); });
    });
  }
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
  if (navbar) navbar.addEventListener('transitionend', setTop);
  sec.vtRefresh = onScroll; onScroll();
  // links to other tabs inside this page (works even when this page was loaded later)
  sec.addEventListener('click', function (e) {
    var a = e.target.closest('a.page-nav-link[data-page]');
    if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1 || !window.__goPage) return;
    e.preventDefault(); window.__goPage(a.getAttribute('data-page'), a.getAttribute('data-scroll'));
  });

  /* ---------- quiz ---------- */
  function Quiz(el) {
    var key = el.getAttribute('data-quiz'), data = D.quiz[key], body = $('.qz-body', el), i = 0, score = 0, done = false;
    function q() {
      var it = data[i], order = shuffle(range(it.o.length)); done = false;
      body.innerHTML = '<p class="qz-count">' + F('qOf', { n: i + 1, t: data.length }) + '</p>' +
        '<div class="qz-bar"><i style="width:' + (i / data.length * 100) + '%"></i></div>' +
        '<p class="qz-q">' + T(it.q) + '</p><div class="qz-opts">' +
        order.map(function (k) { return '<button type="button" class="qz-opt" data-k="' + k + '">' + T(it.o[k]) + '</button>'; }).join('') +
        '</div><div class="qz-after" aria-live="polite"></div>';
    }
    function end() {
      var prev = P.quiz[key]; if (prev == null || score > prev) P.quiz[key] = score; save();
      var msg = score === data.length ? 'qzPerfect' : score >= 3 ? 'qzGood' : 'qzTry';
      body.innerHTML = '<div class="qz-end"><p class="qz-score">' + N(score) + ' / ' + N(data.length) + '</p><p>' + U(msg) + '</p>' +
        '<div class="vt-row" style="justify-content:center"><button type="button" class="vt-btn line qz-retry">' + U('again') + '</button>' +
        (el.getAttribute('data-next') ? '<a class="vt-btn" href="#' + el.getAttribute('data-next') + '">' + U(el.getAttribute('data-next') === 'games' ? 'toGames' : 'nextCh') + '</a>' : '') +
        '</div></div>';
    }
    body.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('qz-opt')) {
        if (done) return; done = true;
        var k = +b.getAttribute('data-k'), right = k === 0;
        if (right) score++;
        $$('.qz-opt', body).forEach(function (o) { o.disabled = true; if (o.getAttribute('data-k') === '0') o.classList.add('ok'); });
        if (!right) b.classList.add('bad');
        var last = i === data.length - 1;
        $('.qz-after', body).innerHTML = '<p class="qz-ex"><b>' + U(right ? 'right' : 'wrong') + '</b> ' + T(data[i].e) + '</p>' +
          '<div class="vt-row"><button type="button" class="vt-btn qz-next">' + U(last ? 'seeScore' : 'next') + '</button></div>';
        $('.qz-next', body).focus({ preventScroll: true });
      } else if (b.classList.contains('qz-next')) {
        if (i === data.length - 1) end(); else { i++; q(); $('.qz-opt', body).focus({ preventScroll: true }); }
      } else if (b.classList.contains('qz-retry')) { i = 0; score = 0; q(); }
    });
    q();
  }

  /* ---------- put in order ---------- */
  var GRIP = '<svg viewBox="0 0 14 20" aria-hidden="true"><g fill="currentColor"><circle cx="4" cy="4" r="1.8"/><circle cx="10" cy="4" r="1.8"/><circle cx="4" cy="10" r="1.8"/><circle cx="10" cy="10" r="1.8"/><circle cx="4" cy="16" r="1.8"/><circle cx="10" cy="16" r="1.8"/></g></svg>';
  var UP = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2 11 9H1z" fill="currentColor"/></svg>';
  var DN = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10 1 3h10z" fill="currentColor"/></svg>';
  function Order(el) {
    var key = el.getAttribute('data-order'), items = D.order[key], list = $('.or-list', el), fb = $('.vt-fb', el), seq;
    function fresh() { do { seq = shuffle(range(items.length)); } while (seq.every(function (v, i) { return v === i; })); }
    function draw(focusK, focusSel) {
      list.innerHTML = seq.map(function (k, pos) {
        return '<li class="or-item" data-k="' + k + '"><button type="button" class="or-grip" aria-hidden="true" tabindex="-1">' + GRIP + '</button>' +
          '<span class="or-num">' + N(pos + 1) + '</span><span class="or-txt">' + T(items[k]) + '</span><span class="or-btns">' +
          '<button type="button" class="or-up" ' + (pos === 0 ? 'disabled' : '') + ' aria-label="' + D.ui.up[0] + '">' + UP + '</button>' +
          '<button type="button" class="or-dn" ' + (pos === seq.length - 1 ? 'disabled' : '') + ' aria-label="' + D.ui.down[0] + '">' + DN + '</button></span></li>';
      }).join('');
      if (focusK != null) { var b = $('.or-item[data-k="' + focusK + '"] ' + focusSel, list); if (b && !b.disabled) b.focus(); else { b = $('.or-item[data-k="' + focusK + '"] button:not([disabled]):not(.or-grip)', list); b && b.focus(); } }
    }
    function clearMarks() { fb.className = 'vt-fb'; fb.innerHTML = ''; }
    list.addEventListener('click', function (e) {
      var b = e.target.closest('.or-up, .or-dn'); if (!b) return;
      var k = +b.closest('.or-item').getAttribute('data-k'), p = seq.indexOf(k), q = b.classList.contains('or-up') ? p - 1 : p + 1;
      if (q < 0 || q >= seq.length) return;
      seq[p] = seq[q]; seq[q] = k; clearMarks(); draw(k, b.classList.contains('or-up') ? '.or-up' : '.or-dn');
    });
    // drag by the grip (mouse or touch)
    var drag = null;
    list.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('.or-grip'); if (!g) return;
      var li = g.closest('.or-item'); e.preventDefault();
      g.setPointerCapture(e.pointerId);
      drag = { li: li, g: g, y0: e.clientY, id: e.pointerId }; li.classList.add('drag'); clearMarks();
    });
    list.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var li = drag.li, dy = e.clientY - drag.y0, nx = li.nextElementSibling, pv = li.previousElementSibling;
      if (nx && dy > nx.offsetHeight / 2 + 4) { list.insertBefore(nx, li); drag.y0 += nx.offsetHeight + 7; dy = e.clientY - drag.y0; }
      else if (pv && dy < -(pv.offsetHeight / 2 + 4)) { list.insertBefore(li, pv); drag.y0 -= pv.offsetHeight + 7; dy = e.clientY - drag.y0; }
      li.style.transform = 'translateY(' + dy + 'px)';
    });
    function drop() {
      if (!drag) return; drag.li.style.transform = ''; drag.li.classList.remove('drag');
      seq = $$('.or-item', list).map(function (x) { return +x.getAttribute('data-k'); }); drag = null; draw();
    }
    list.addEventListener('pointerup', drop); list.addEventListener('pointercancel', drop);
    $('.or-check', el).addEventListener('click', function () {
      var right = 0;
      $$('.or-item', list).forEach(function (li, pos) { var ok = +li.getAttribute('data-k') === pos; if (ok) right++; li.classList.toggle('ok', ok); li.classList.toggle('bad', !ok); });
      if (right === items.length) { fb.className = 'vt-fb good'; fb.innerHTML = U('orderAll'); P.games[key] = true; save(); }
      else { fb.className = 'vt-fb bad'; fb.innerHTML = F('orderSome', { n: right, t: items.length }); }
    });
    $('.or-shuffle', el).addEventListener('click', function () { fresh(); clearMarks(); draw(); });
    fresh(); draw();
  }

  /* ---------- match the pairs ---------- */
  function Match(el) {
    var rounds = D.match, tabs = $('.vtm-tabs', el), stage = $('.vtm-stage', el), fb = $('.vt-fb', el), r = 0, st;
    tabs.innerHTML = rounds.map(function (rd, i) { return '<button type="button" role="tab" class="vtm-tab" data-r="' + i + '">' + T(rd.name) + '</button>'; }).join('');
    function start(i) {
      r = i; st = { sel: { n: null, d: null }, done: {}, miss: 0, count: 0, nOrder: shuffle(range(5)), dOrder: shuffle(range(5)) };
      $$('.vtm-tab', tabs).forEach(function (t, j) { t.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      fb.className = 'vt-fb'; fb.innerHTML = U('matchHow'); draw();
    }
    function draw() {
      var pr = rounds[r].pairs;
      stage.innerHTML = '<div class="vtm-names">' + st.nOrder.map(function (k) {
        var d = st.done[k] != null; return '<button type="button" class="vtm-name' + (d ? ' done p' + st.done[k] : '') + (st.sel.n === k ? ' sel' : '') + '" data-k="' + k + '"' + (d ? ' disabled' : '') + ' aria-pressed="' + (st.sel.n === k) + '">' + T(pr[k][0]) + (d ? '<span class="vtm-badge">' + N(st.done[k] + 1) + '</span>' : '') + '</button>';
      }).join('') + '</div><div class="vtm-descs">' + st.dOrder.map(function (k) {
        var d = st.done[k] != null; return '<button type="button" class="vtm-desc' + (d ? ' done p' + st.done[k] : '') + (st.sel.d === k ? ' sel' : '') + '" data-k="' + k + '"' + (d ? ' disabled' : '') + ' aria-pressed="' + (st.sel.d === k) + '">' + (d ? '<span class="vtm-badge">' + N(st.done[k] + 1) + '</span>' : '') + '<span>' + T(pr[k][1]) + '</span></button>';
      }).join('') + '</div>';
    }
    tabs.addEventListener('click', function (e) { var t = e.target.closest('.vtm-tab'); if (t) start(+t.getAttribute('data-r')); });
    stage.addEventListener('click', function (e) {
      var b = e.target.closest('.vtm-name, .vtm-desc'); if (!b || b.disabled) return;
      var side = b.classList.contains('vtm-name') ? 'n' : 'd', k = +b.getAttribute('data-k');
      st.sel[side] = st.sel[side] === k ? null : k;
      if (st.sel.n != null && st.sel.d != null) {
        if (st.sel.n === st.sel.d) {
          st.done[k = st.sel.n] = st.count++; st.sel = { n: null, d: null }; draw();
          if (st.count === 5) {
            P.games['match' + r] = true; save();
            fb.className = 'vt-fb good'; fb.innerHTML = st.miss === 0 ? U('matchPerfect') : F('matchDone', { m: st.miss });
            var next = rounds.findIndex(function (_, j) { return !P.games['match' + j]; });
            if (next > -1) fb.innerHTML += ' <button type="button" class="vt-btn line vtm-next" data-r="' + next + '" style="margin-left:.4rem">' + U('nextSet') + '</button>';
          } else { fb.className = 'vt-fb good'; fb.innerHTML = U('matchYes'); }
        } else {
          st.miss++;
          var a = $('.vtm-name[data-k="' + st.sel.n + '"]', stage), c = $('.vtm-desc[data-k="' + st.sel.d + '"]', stage);
          [a, c].forEach(function (x) { x.classList.remove('no'); void x.offsetWidth; x.classList.add('no'); });
          fb.className = 'vt-fb bad'; fb.innerHTML = U('matchNo');
          st.sel = { n: null, d: null };
          setTimeout(function () { [a, c].forEach(function (x) { x.classList.remove('sel', 'no'); x.setAttribute('aria-pressed', 'false'); }); }, 400);
        }
      } else draw();
    });
    fb.addEventListener('click', function (e) { var b = e.target.closest('.vtm-next'); if (b) start(+b.getAttribute('data-r')); });
    start(0);
  }

  /* ---------- journey map ---------- */
  function Journey(el) {
    var J = D.journey, M = J.map, svgNS = 'http://www.w3.org/2000/svg', stops = J.stops, step = 0, miss = 0, wrongHere = 0;
    var LBL = { bannur: [-12, 22, 'end'], channapatna: [12, 18, 'start'], kanchi: [-6, -16, 'middle'], mulbagal: [-12, -10, 'end'], chandragiri: [10, -14, 'start'], hampi: [14, 5, 'start'] };
    var V = [165, 40, 420, 345], VR = V[0] + V[2], VB = V[1] + V[3]; // crop to the area of the journey
    var s = '<svg viewBox="' + V.join(' ') + '" role="group" aria-label="' + J.title[0] + '">';
    s += '<rect x="' + V[0] + '" y="' + V[1] + '" width="' + V[2] + '" height="' + V[3] + '" fill="#16324A"/>';
    s += M.land.map(function (p) { return '<path class="jr-land" d="' + p.d + '"/>'; }).join('');
    Object.keys(M.rivers).forEach(function (k) { s += '<path class="jr-river" d="' + M.rivers[k] + '"/>'; });
    var RL = { kaveri: ['Kaveri', 'ಕಾವೇರಿ'], tungabhadra: ['Tungabhadra', 'ತುಂಗಭದ್ರಾ'] };
    Object.keys(RL).forEach(function (k) { var p = M.riverLabels[k]; if (p) s += '<text class="jr-rl" x="' + p[0] + '" y="' + p[1] + '"><tspan data-lang="en">' + RL[k][0] + '</tspan><tspan data-lang="kn">' + RL[k][1] + '</tspan></text>'; });
    s += '<text class="jr-sea" text-anchor="end" x="' + (VR - 8) + '" y="' + (VB - 30) + '"><tspan data-lang="en">Bay of</tspan><tspan data-lang="kn">ಬಂಗಾಳ</tspan></text>';
    s += '<text class="jr-sea" text-anchor="end" x="' + (VR - 8) + '" y="' + (VB - 12) + '"><tspan data-lang="en">Bengal</tspan><tspan data-lang="kn">ಕೊಲ್ಲಿ</tspan></text>';
    var b = M.places.bengaluru;
    s += '<g class="jr-ref" aria-hidden="true"><circle cx="' + b[0] + '" cy="' + b[1] + '" r="3"/><text text-anchor="end" x="' + (b[0] - 5) + '" y="' + (b[1] + 15) + '"><tspan data-lang="en">Bengaluru (today)</tspan><tspan data-lang="kn">ಬೆಂಗಳೂರು (ಇಂದು)</tspan></text></g>';
    s += '<g class="jr-routes"></g>';
    // stops in a fixed, non-chronological drawing order so the order is not given away
    shuffle(range(stops.length)).forEach(function (i) {
      var st = stops[i], p = M.places[st.id], l = LBL[st.id];
      s += '<g class="jr-stop" data-i="' + i + '" tabindex="0" role="button" aria-label="' + st.name[0] + '"><circle class="hit" cx="' + p[0] + '" cy="' + p[1] + '" r="26"/>' +
        '<circle class="dot" cx="' + p[0] + '" cy="' + p[1] + '" r="8"/><text class="num" x="' + p[0] + '" y="' + p[1] + '"></text>' +
        '<text x="' + (p[0] + l[0]) + '" y="' + (p[1] + l[1]) + '" text-anchor="' + l[2] + '"><tspan data-lang="en">' + st.name[0] + '</tspan><tspan data-lang="kn">' + st.name[1] + '</tspan></text></g>';
    });
    s += '</svg>';
    var mapEl = $('.jr-map', el), card = $('.jr-card', el), fb = $('.vt-fb', el);
    mapEl.innerHTML = s;
    var routes = $('.jr-routes', mapEl);
    var ask = $('.jr-ask', el);
    function prompt() {
      ask.innerHTML = step >= stops.length ? U('jrComplete') : step === 0 ? U('jrFirst') : F('jrNext', { n: step + 1, t: stops.length });
    }
    function seg(a, c) {
      var p = M.places[stops[a].id], q = M.places[stops[c].id];
      var path = document.createElementNS(svgNS, 'path');
      path.setAttribute('class', 'jr-route'); path.setAttribute('d', 'M' + p[0] + ' ' + p[1] + 'L' + q[0] + ' ' + q[1]);
      routes.appendChild(path);
      if (!reduce && path.animate) {
        var len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        path.animate([{ strokeDashoffset: len, strokeDasharray: len + ' ' + len }, { strokeDashoffset: 0, strokeDasharray: len + ' ' + len }], { duration: 600, easing: 'ease-out' });
      }
    }
    function pick(g) {
      if (step >= stops.length) return;
      var i = +g.getAttribute('data-i');
      $$('.jr-stop.hint', mapEl).forEach(function (x) { x.classList.remove('hint'); });
      if (i === step) {
        g.classList.add('on'); g.classList.remove('wrong'); $('.dot', g).setAttribute('r', '11');
        $('.num', g).textContent = root.lang === 'kn' ? knNum(step + 1) : step + 1;
        g.setAttribute('data-n', step + 1);
        if (step > 0) seg(step - 1, step);
        card.innerHTML = '<b>' + T(stops[i].name) + '.</b> ' + T(stops[i].cap);
        step++; wrongHere = 0; fb.className = 'vt-fb'; fb.innerHTML = '';
        if (step === stops.length) {
          P.games.journey = true; save();
          fb.className = 'vt-fb good';
          fb.innerHTML = (miss === 0 ? U('jrPerfect') : F('jrDone', { m: miss })) + ' ' + F('jrKm', { km: M.km });
        }
        prompt();
      } else if (!g.classList.contains('on')) {
        miss++; wrongHere++;
        g.classList.add('wrong'); setTimeout(function () { g.classList.remove('wrong'); }, 700);
        fb.className = 'vt-fb bad'; fb.innerHTML = U('jrWrong');
        if (wrongHere >= 2) { var h = $('.jr-stop[data-i="' + step + '"]', mapEl); h && h.classList.add('hint'); fb.innerHTML = U('jrHint'); }
      }
    }
    mapEl.addEventListener('click', function (e) { var g = e.target.closest('.jr-stop'); if (g) pick(g); });
    mapEl.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.jr-stop')) { e.preventDefault(); pick(e.target.closest('.jr-stop')); } });
    // keep the visit numbers in the current language
    new MutationObserver(function () { $$('.jr-stop.on', mapEl).forEach(function (g) { var n = g.getAttribute('data-n'); $('.num', g).textContent = root.lang === 'kn' ? knNum(n) : n; }); }).observe(root, { attributes: true, attributeFilter: ['lang'] });
    $('.jr-reset', el).addEventListener('click', function () {
      step = 0; miss = 0; wrongHere = 0; routes.innerHTML = '';
      $$('.jr-stop', mapEl).forEach(function (g) { g.classList.remove('on', 'wrong', 'hint'); $('.dot', g).setAttribute('r', '8'); $('.num', g).textContent = ''; });
      fb.className = 'vt-fb'; fb.innerHTML = ''; card.innerHTML = ''; prompt();
    });
    prompt();
  }

  /* ---------- progress everywhere ---------- */
  var GAMES = ['kids', 'journey', 'match0', 'match1', 'match2', 'match3', 'life'];
  function refresh() {
    for (var c = 1; c <= 6; c++) {
      var done = P.quiz[c] != null;
      $$('[data-ch="' + c + '"]').forEach(function (x) { x.classList.toggle('is-done', done); });
      $$('.vt-jumps a[href="#quiz-' + c + '"]').forEach(function (x) { x.classList.toggle('done', done); });
    }
    GAMES.forEach(function (g) { $$('.vt-jumps a[data-g="' + g + '"]').forEach(function (x) { x.classList.toggle('done', !!P.games[g]); }); });
    $$('.vt-jumps a[data-g="match"]').forEach(function (x) { x.classList.toggle('done', [0, 1, 2, 3].every(function (j) { return P.games['match' + j]; })); });
    var tabs = $$('.vtm-tab'); tabs.forEach(function (t, j) { t.classList.toggle('done', !!P.games['match' + j]); });
    var qs = 0, qn = 0; Object.keys(D.quiz).forEach(function (k) { qn += D.quiz[k].length; if (P.quiz[k] != null) qs += P.quiz[k]; });
    var gs = GAMES.filter(function (g) { return P.games[g]; }).length;
    var res = $('#vt-result'); if (!res) return;
    var started = Object.keys(P.quiz).length + gs;
    if (!started) { res.innerHTML = '<p>' + U('resEmpty') + '</p>'; return; }
    var pct = (qs / qn) * 0.7 + (gs / GAMES.length) * 0.3;
    var rank = pct >= 0.85 ? 'rank3' : pct >= 0.5 ? 'rank2' : 'rank1';
    res.innerHTML = '<p>' + U('resTitle') + '</p><p class="rank">' + U(rank) + '</p>' +
      '<p>' + F('resLine', { q: qs, qt: qn, g: gs, gt: GAMES.length }) + '</p>' +
      '<div class="vt-row"><button type="button" class="vt-btn maroon vt-share">' + U('share') + '</button><button type="button" class="vt-btn line vt-copy">' + U('copy') + '</button></div>';
  }
  document.addEventListener('click', function (e) {
    var sh = e.target.closest('.vt-share'), cp = e.target.closest('.vt-copy');
    if (!sh && !cp) return;
    var url = location.origin + '/vyasatirtha/', txt = D.ui.shareText[root.lang === 'kn' ? 1 : 0];
    if (sh) {
      if (navigator.share) navigator.share({ title: document.title, text: txt, url: url }).catch(function () {});
      else window.open('https://wa.me/?text=' + encodeURIComponent(txt + ' ' + url), '_blank', 'noopener');
    } else {
      var done = function () { cp.innerHTML = U('copied'); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('', url); });
      else { window.prompt('', url); }
    }
  });

  $$('[data-quiz]', sec).forEach(Quiz);
  $$('[data-order]', sec).forEach(Order);
  $$('[data-match]', sec).forEach(Match);
  $$('[data-journey]', sec).forEach(Journey);
  refresh();
  var lv = $('.vt-leaves', sec); if (lv && !reduce) lv.classList.add('fan');
  }

  function ready(sec) { if (sec.getAttribute('data-vt-ready')) { sec.vtRefresh && sec.vtRefresh(); return; } sec.setAttribute('data-vt-ready', '1'); init(sec); }
  // On other pages the life story is not in the HTML; it is fetched the first time its tab opens.
  window.vtEnsure = function () {
    var sec = document.getElementById('page-vyasatirtha'); if (!sec) return;
    if (sec.querySelector('#vt-data')) { ready(sec); return; }
    if (sec.getAttribute('data-vt-loading')) return;
    sec.setAttribute('data-vt-loading', '1');
    fetch('/vyasatirtha/', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        var src = new DOMParser().parseFromString(html, 'text/html').getElementById('page-vyasatirtha');
        if (!src || !src.querySelector('#vt-data')) throw new Error('missing');
        sec.innerHTML = src.innerHTML; ready(sec);
      })
      .catch(function () { sec.removeAttribute('data-vt-loading'); location.href = '/vyasatirtha/'; });
  };
  function boot() { var sec = document.getElementById('page-vyasatirtha'); if (sec && sec.querySelector('#vt-data')) ready(sec); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

    
