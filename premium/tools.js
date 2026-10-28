/* Monibas Capital Premium — herramientas exclusivas y modo examen.
   Este archivo NO está en /public: el servidor solo lo entrega (GET /api/premium/tools.js) a suscriptores activos.
   Todo se calcula en el navegador; los textos llegan del contenido Premium del idioma activo (P). */
(function () {
  'use strict';
  var H = window.Interactive && window.Interactive.helpers;
  if (!H) return;
  var S = H.S, clamp = H.clamp;

  function translator(P) {
    return function tt(key, vars) {
      var v = key.split('.').reduce(function (o, k) { return o && o[k] !== undefined ? o[k] : undefined; }, P);
      if (typeof v !== 'string') return key;
      return vars ? v.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; }) : v;
    };
  }
  function numField(api, id, label, value, step, onInput) {
    var input = api.el('input', { class: 'input', type: 'number', id: id, inputmode: 'decimal', step: String(step), value: String(value) });
    input.addEventListener('input', function () {
      var x = parseFloat(String(input.value).replace(',', '.'));
      onInput(isFinite(x) ? clamp(x, -1e9, 1e9) : 0);
    });
    return api.el('div', { class: 'field' }, api.el('label', { for: id, text: label }), input);
  }
  function svgBox(box) { return Math.max(280, Math.min(900, (box.clientWidth || 640) - 36)); }

  /* ---------- Simulación Monte Carlo de trading ---------- */
  function montecarlo(host, api, P) {
    var tt = translator(P), el = api.el;
    var v = { win: 45, rr: 2, risk: 1, trades: 200 };
    var pct0 = function (x) { return H.fmtNum(api, x, 0) + ' %'; };
    var fields = [
      H.slider(api, { id: 'mc-win', label: tt('tools.montecarlo.winRate'), min: 20, max: 80, step: 1, value: v.win, fmt: pct0, onInput: function (x) { v.win = x; run(); } }),
      H.slider(api, { id: 'mc-rr', label: tt('tools.montecarlo.rr'), min: 0.5, max: 5, step: 0.1, value: v.rr, fmt: function (x) { return H.fmtNum(api, x, 1); }, onInput: function (x) { v.rr = x; run(); } }),
      H.slider(api, { id: 'mc-risk', label: tt('tools.montecarlo.risk'), min: 0.25, max: 5, step: 0.25, value: v.risk, fmt: function (x) { return H.fmtNum(api, x, 2) + ' %'; }, onInput: function (x) { v.risk = x; run(); } }),
      H.slider(api, { id: 'mc-trades', label: tt('tools.montecarlo.trades'), min: 50, max: 500, step: 10, value: v.trades, fmt: function (x) { return String(x); }, onInput: function (x) { v.trades = x; run(); } })
    ];
    var kE = H.kpi(api, tt('tools.montecarlo.expectancy'), 'total'), kM = H.kpi(api, tt('tools.montecarlo.median')), kL = H.kpi(api, tt('tools.montecarlo.lossProb'));
    var kD = H.kpi(api, tt('tools.montecarlo.ddMedian')), kR = H.kpi(api, tt('tools.montecarlo.ruin'));
    var box = el('div', { class: 'figure-frame sim-chart' }), msg = el('p', { class: 'fee-summary' });
    var again = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: function () { run(); } }, api.icon('refresh'), tt('tools.montecarlo.run'));
    host.appendChild(H.toolHead(api, tt('tools.montecarlo.h'), tt('tools.montecarlo.p')));
    host.appendChild(el('div', { class: 'panel' }, el('div', { class: 'sim-grid' },
      el('div', { class: 'sim-controls' }, fields.map(function (f) { return f.node; }), again),
      el('div', { class: 'sim-output' }, el('div', { class: 'kpis mc-kpis' }, kE.node, kM.node, kL.node, kD.node, kR.node), msg,
        el('figure', { class: 'figure' }, box, el('div', { class: 'legend' },
          el('span', null, el('i', { class: 'l-bull' }), tt('tools.montecarlo.best')), el('span', null, el('i', { class: 'l-cobalt' }), tt('tools.montecarlo.medianLine')), el('span', null, el('i', { class: 'l-bear' }), tt('tools.montecarlo.worst')))),
        el('p', { class: 'sim-note', text: tt('tools.montecarlo.note') })))));
    var paths = [];
    function run() {
      var p = v.win / 100, r = v.risk / 100, N = 100;
      paths = [];
      for (var k = 0; k < N; k++) {
        var eq = 100, peak = 100, dd = 0, ruined = false, curve = [100];
        for (var i = 0; i < v.trades; i++) {
          eq *= Math.random() < p ? 1 + r * v.rr : 1 - r;
          if (eq > peak) peak = eq;
          dd = Math.max(dd, 1 - eq / peak);
          if (eq <= 50) ruined = true;
          curve.push(eq);
        }
        paths.push({ curve: curve, final: eq, dd: dd, ruined: ruined });
      }
      var finals = paths.map(function (x) { return x.final; }).sort(function (a, b) { return a - b; });
      var dds = paths.map(function (x) { return x.dd; }).sort(function (a, b) { return a - b; });
      var exp = p * v.rr - (1 - p);
      kE.value.textContent = (exp > 0 ? '+' : '') + H.fmtNum(api, exp, 2) + ' R';
      kM.value.textContent = H.fmtPct(api, finals[N / 2] / 100 - 1, 0);
      kL.value.textContent = H.fmtPct(api, finals.filter(function (f) { return f < 100; }).length / N, 0);
      kD.value.textContent = H.fmtPct(api, dds[N / 2], 0);
      kR.value.textContent = H.fmtPct(api, paths.filter(function (x) { return x.ruined; }).length / N, 0);
      msg.textContent = exp > 0 ? tt('tools.montecarlo.positive') : tt('tools.montecarlo.negative');
      msg.classList.toggle('is-neg', exp <= 0);
      draw();
    }
    function draw() {
      if (!paths.length) return;
      var W = Math.round(svgBox(box)), Hh = W < 480 ? 250 : 320, L = W < 480 ? 50 : 62, R = 12, T = 12, B = 30, n = v.trades;
      var all = paths.reduce(function (a, x) { return a.concat([Math.min.apply(null, x.curve), Math.max.apply(null, x.curve)]); }, []);
      var lo = Math.max(1, Math.min.apply(null, all) * 0.9), hi = Math.max.apply(null, all) * 1.1;
      var LLo = Math.log(lo), LHi = Math.log(Math.max(hi, lo * 1.5));
      function X(i) { return L + i / n * (W - L - R); }
      function Y(val) { return Hh - B - (Math.log(Math.max(val, 1e-6)) - LLo) / (LHi - LLo) * (Hh - B - T); }
      var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': tt('tools.montecarlo.chartLabel') });
      [5, 10, 25, 50, 100, 200, 400, 1000, 3000, 10000, 100000].filter(function (x) { return x >= lo && x <= hi; }).forEach(function (val) {
        svg.appendChild(S('line', { x1: L, x2: W - R, y1: Y(val), y2: Y(val), class: val === 100 ? 'chart-axis' : 'chart-grid' }));
        svg.appendChild(S('text', { x: L - 6, y: Y(val) + 4, 'text-anchor': 'end', class: 'chart-label' }, (val >= 100 ? '+' : '') + H.fmtPct(api, val / 100 - 1, 0).replace('+', '')));
      });
      var step = n > 250 ? 100 : 50;
      for (var i = 0; i <= n; i += step) svg.appendChild(S('text', { x: X(i), y: Hh - 10, 'text-anchor': 'middle', class: 'chart-label' }, String(i)));
      var sorted = paths.slice().sort(function (a, b) { return a.final - b.final; });
      function line(x, cls) {
        var pts = [], stride = Math.max(1, Math.floor(n / 160));
        for (var k = 0; k <= n; k += stride) pts.push(X(k).toFixed(1) + ',' + Y(x.curve[k]).toFixed(1));
        pts.push(X(n).toFixed(1) + ',' + Y(x.curve[n]).toFixed(1));
        svg.appendChild(S('polyline', { points: pts.join(' '), class: cls }));
      }
      sorted.forEach(function (x) { line(x, x.final >= 100 ? 'mc-path mc-up' : 'mc-path mc-down'); });
      line(sorted[sorted.length - 1], 'mc-best'); line(sorted[0], 'mc-worst'); line(sorted[Math.floor(sorted.length / 2)], 'mc-median');
      box.replaceChildren(svg);
    }
    run(); requestAnimationFrame(draw); H.onResize(box, draw);
  }

  /* ---------- Matemática de las pérdidas ---------- */
  function drawdown(host, api, P) {
    var tt = translator(P), el = api.el;
    var v = { loss: 30, r: 7 };
    var fields = [
      H.slider(api, { id: 'dd-loss', label: tt('tools.drawdown.loss'), min: 5, max: 90, step: 1, value: v.loss, fmt: function (x) { return '−' + x + ' %'; }, onInput: function (x) { v.loss = x; update(); } }),
      H.slider(api, { id: 'dd-r', label: tt('tools.drawdown.annual'), min: 1, max: 15, step: 0.5, value: v.r, fmt: function (x) { return H.fmtNum(api, x, 1) + ' %'; }, onInput: function (x) { v.r = x; update(); } })
    ];
    var kN = H.kpi(api, tt('tools.drawdown.need'), 'total'), kY = H.kpi(api, tt('tools.drawdown.years'));
    var box = el('div', { class: 'figure-frame sim-chart' }), msg = el('p', { class: 'fee-summary' });
    host.appendChild(H.toolHead(api, tt('tools.drawdown.h'), tt('tools.drawdown.p')));
    host.appendChild(el('div', { class: 'panel' }, el('div', { class: 'sim-grid' },
      el('div', { class: 'sim-controls' }, fields.map(function (f) { return f.node; })),
      el('div', { class: 'sim-output' }, el('div', { class: 'kpis dd-kpis' }, kN.node, kY.node), msg, el('figure', { class: 'figure' }, box)))));
    function update() {
      var L = v.loss / 100, need = 1 / (1 - L) - 1, years = Math.log(1 / (1 - L)) / Math.log(1 + v.r / 100);
      kN.value.textContent = '+' + H.fmtPct(api, need, 1);
      kY.value.textContent = tt('tools.drawdown.yearsVal', { n: H.fmtNum(api, years, 1) });
      msg.textContent = tt('tools.drawdown.explain', { loss: H.fmtPct(api, L, 0), need: H.fmtPct(api, need, 1), r: H.fmtPct(api, v.r / 100, 1), n: H.fmtNum(api, years, 1) });
      draw();
    }
    function draw() {
      var W = Math.round(svgBox(box)), Hh = W < 480 ? 230 : 280, Lm = W < 480 ? 48 : 58, R = 14, T = 14, B = 34, MAX = 9;
      function X(l) { return Lm + l / 0.9 * (W - Lm - R); }
      function Y(g) { return Hh - B - Math.min(g, MAX) / MAX * (Hh - B - T); }
      var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': tt('tools.drawdown.chartLabel') });
      [0, 1, 3, 5, 9].forEach(function (g) {
        svg.appendChild(S('line', { x1: Lm, x2: W - R, y1: Y(g), y2: Y(g), class: 'chart-grid' }));
        svg.appendChild(S('text', { x: Lm - 6, y: Y(g) + 4, 'text-anchor': 'end', class: 'chart-label' }, '+' + H.fmtPct(api, g, 0)));
      });
      [0, 0.3, 0.5, 0.75, 0.9].forEach(function (l) { svg.appendChild(S('text', { x: X(l), y: Hh - 12, 'text-anchor': 'middle', class: 'chart-label' }, '−' + H.fmtPct(api, l, 0))); });
      var pts = [];
      for (var l = 0; l <= 0.9001; l += 0.01) pts.push(X(l).toFixed(1) + ',' + Y(1 / (1 - l) - 1).toFixed(1));
      svg.appendChild(S('polyline', { points: pts.join(' '), class: 'chart-line-bear' }));
      var cur = v.loss / 100, g = 1 / (1 - cur) - 1;
      svg.appendChild(S('line', { x1: X(cur), x2: X(cur), y1: Y(0), y2: Y(g), class: 'chart-dash-cobalt' }));
      svg.appendChild(S('circle', { cx: X(cur), cy: Y(g), r: 6.5, class: 'chart-dot' }));
      svg.appendChild(S('text', { x: Math.min(X(cur) + 10, W - 70), y: Math.max(Y(g) - 10, 24), class: 'chart-label-strong' }, '+' + H.fmtPct(api, g, 0)));
      box.replaceChildren(svg);
    }
    update(); requestAnimationFrame(draw); H.onResize(box, draw);
  }

  /* ---------- Independencia financiera ---------- */
  function fire(host, api, P) {
    var tt = translator(P), el = api.el;
    var v = { expenses: 24000, rate: 4, capital: 20000, saving: 500, real: 4 };
    var fields = [
      H.slider(api, { id: 'fi-exp', label: tt('tools.fire.expenses'), min: 6000, max: 80000, step: 500, value: v.expenses, fmt: api.money, onInput: function (x) { v.expenses = x; update(); } }),
      H.slider(api, { id: 'fi-rate', label: tt('tools.fire.rate'), min: 2.5, max: 6, step: 0.1, value: v.rate, fmt: function (x) { return H.fmtNum(api, x, 1) + ' %'; }, onInput: function (x) { v.rate = x; update(); } }),
      H.slider(api, { id: 'fi-cap', label: tt('tools.fire.capital'), min: 0, max: 1000000, step: 5000, value: v.capital, fmt: api.money, onInput: function (x) { v.capital = x; update(); } }),
      H.slider(api, { id: 'fi-sav', label: tt('tools.fire.saving'), min: 0, max: 5000, step: 50, value: v.saving, fmt: api.money, onInput: function (x) { v.saving = x; update(); } }),
      H.slider(api, { id: 'fi-real', label: tt('tools.fire.real'), min: 0, max: 8, step: 0.5, value: v.real, fmt: function (x) { return H.fmtNum(api, x, 1) + ' %'; }, onInput: function (x) { v.real = x; update(); } })
    ];
    var kT = H.kpi(api, tt('tools.fire.target')), kY = H.kpi(api, tt('tools.fire.years'), 'total'), kI = H.kpi(api, tt('tools.fire.monthlyIncome'));
    var box = el('div', { class: 'figure-frame sim-chart' }), msg = el('p', { class: 'fee-summary' }), last = null;
    host.appendChild(H.toolHead(api, tt('tools.fire.h'), tt('tools.fire.p')));
    host.appendChild(el('div', { class: 'panel' }, el('div', { class: 'sim-grid' },
      el('div', { class: 'sim-controls' }, fields.map(function (f) { return f.node; })),
      el('div', { class: 'sim-output' }, el('div', { class: 'kpis' }, kT.node, kY.node, kI.node), msg,
        el('figure', { class: 'figure' }, box), el('p', { class: 'sim-note', text: tt('tools.fire.note') })))));
    function update() {
      var target = v.expenses / (v.rate / 100), r = Math.pow(1 + v.real / 100, 1 / 12) - 1, bal = v.capital, m = 0, yearly = [bal];
      while (bal < target && m < 720) { bal = bal * (1 + r) + v.saving; m++; if (m % 12 === 0) yearly.push(bal); }
      var reached = bal >= target, years = m / 12;
      if (m % 12 !== 0) yearly.push(bal);
      kT.value.textContent = api.money(target);
      kY.value.textContent = reached ? tt('tools.fire.yearsVal', { n: H.fmtNum(api, years, 1) }) : tt('tools.fire.never');
      kI.value.textContent = api.money(v.expenses / 12);
      msg.textContent = tt('tools.fire.progress', { p: H.fmtPct(api, Math.min(1, v.capital / target), 0) });
      if (yearly.length < 2) yearly.push(bal);
      last = { values: yearly, target: target };
      draw();
    }
    function draw() {
      if (!last) return;
      H.lineChart(box, [{ values: last.values, cls: 'chart-line', label: tt('tools.fire.capital') }, { values: last.values.map(function () { return last.target; }), cls: 'chart-dash-amber', label: tt('tools.fire.targetLine') }], api,
        { label: tt('tools.fire.chartLabel'), xLabel: function (i) { return api.t('ui.sim.tipYear', { n: i }); } });
    }
    update(); requestAnimationFrame(draw); H.onResize(box, draw);
  }

  /* ---------- Calculadora DCF ---------- */
  function dcfValue(o) {
    var r = o.discount / 100, g = o.growth / 100, tg = o.terminal / 100;
    if (!(r > tg) || o.shares <= 0) return null;
    var f = o.fcf, pv = 0;
    for (var y = 1; y <= 5; y++) { f *= 1 + g; pv += f / Math.pow(1 + r, y); }
    var tv = f * (1 + tg) / (r - tg), pvtv = tv / Math.pow(1 + r, 5), ev = pv + pvtv;
    return { perShare: (ev - o.debt) / o.shares, tvShare: pvtv / ev };
  }
  function dcf(host, api, P) {
    var tt = translator(P), el = api.el, icon = api.icon;
    var v = { fcf: 100, growth: 8, terminal: 2.5, discount: 9, debt: 300, shares: 50, price: 25 };
    function f(key, step) { return numField(api, 'dcf-' + key, tt('tools.dcf.' + key), v[key], step, function (x) { v[key] = x; update(); }); }
    var kV = H.kpi(api, tt('tools.dcf.value'), 'total'), kM = H.kpi(api, tt('tools.dcf.margin')), kT = H.kpi(api, tt('tools.dcf.tvShare'));
    var msg = el('div', { 'aria-live': 'polite' }), sens = el('div', { class: 'dcf-sens' });
    var priceF = new Intl.NumberFormat(api.locale(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
    host.appendChild(H.toolHead(api, tt('tools.dcf.h'), tt('tools.dcf.p')));
    host.appendChild(el('div', { class: 'panel' }, el('div', { class: 'sim-grid' },
      el('div', { class: 'sim-controls dcf-fields' }, f('fcf', 1), f('growth', 0.5), f('terminal', 0.1), f('discount', 0.1), f('debt', 1), f('shares', 0.1), f('price', 0.01)),
      el('div', { class: 'sim-output' }, el('div', { class: 'kpis' }, kV.node, kM.node, kT.node), msg, sens,
        el('p', { class: 'sim-note' }, icon('info'), ' ' + tt('tools.dcf.note'))))));
    function update() {
      var res = dcfValue(v);
      if (!res) {
        kV.value.textContent = '—'; kM.value.textContent = '—'; kT.value.textContent = '—';
        msg.replaceChildren(el('p', { class: 'ps-msg is-err' }, icon('alert'), tt('tools.dcf.errRate')));
        sens.replaceChildren(); return;
      }
      var margin = res.perShare > 0 ? 1 - v.price / res.perShare : null;
      kV.value.textContent = priceF.format(res.perShare);
      kM.value.textContent = margin === null ? '—' : H.fmtPct(api, margin, 0);
      kT.value.textContent = H.fmtPct(api, res.tvShare, 0);
      var under = res.perShare > v.price;
      msg.replaceChildren(el('p', { class: 'ps-msg ' + (under ? 'is-ok' : 'is-warn') }, icon(under ? 'check' : 'alert'), tt(under ? 'tools.dcf.under' : 'tools.dcf.over')));
      var rates = [-2, -1, 0, 1, 2].map(function (d) { return Math.round((v.discount + d) * 10) / 10; });
      var gs = [-1, -0.5, 0, 0.5, 1].map(function (d) { return Math.round((v.terminal + d) * 10) / 10; });
      var pctL = function (x) { return H.fmtNum(api, x, 1) + ' %'; };
      sens.replaceChildren(el('p', { class: 'pf-range-title', text: tt('tools.dcf.sensTitle') }),
        el('div', { class: 'table-wrap' }, el('table', { class: 'data dcf-table' },
          el('thead', null, el('tr', null, [el('th', { scope: 'col', text: '' })].concat(gs.map(function (g) { return el('th', { scope: 'col', text: pctL(g) }); })))),
          el('tbody', null, rates.map(function (r, ri) {
            return el('tr', null, [el('th', { scope: 'row', text: pctL(r) })].concat(gs.map(function (g, gi) {
              var x = dcfValue({ fcf: v.fcf, growth: v.growth, terminal: g, discount: r, debt: v.debt, shares: v.shares });
              var cls = x === null ? 'na' : (x.perShare > v.price ? 'up' : 'down') + (ri === 2 && gi === 2 ? ' cur' : '');
              return el('td', { class: cls, text: x === null ? '—' : priceF.format(x.perShare) });
            })));
          })))));
    }
    update();
  }

  /* ---------- Modo examen ---------- */
  function exam(host, api, P) {
    var tt = translator(P), el = api.el, icon = api.icon, N = 20, SECONDS = 20 * 60;
    var panel = el('div', { class: 'panel tool-panel' });
    host.appendChild(H.toolHead(api, tt('exam.h'), tt('exam.p')));
    host.appendChild(panel);
    var st = null, timer = null;
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
    function pool() {
      var out = [];
      api.levels().forEach(function (lv, i) { lv.quiz.forEach(function (q) { out.push({ q: q, topic: api.t('ui.route.levelN', { n: i }) + ' · ' + lv.title }); }); });
      (P.modules || []).forEach(function (m, i) { m.quiz.forEach(function (q) { out.push({ q: q, topic: tt('exam.pro') + ' ' + (i + 1) + ' · ' + m.title }); }); });
      return out;
    }
    function intro() {
      stop();
      panel.replaceChildren(el('div', { class: 'ch-intro' },
        el('span', { class: 'ch-intro-icon' }, icon('trophy')),
        el('p', { text: tt('exam.rules') }),
        el('button', { class: 'btn btn-primary', type: 'button', onclick: start }, icon('play'), tt('exam.start'))));
    }
    function start() {
      var picked = shuffle(pool()).slice(0, N).map(function (x) {
        var order = shuffle([0, 1, 2, 3]);
        return { text: x.q.q, opts: order.map(function (k) { return x.q.o[k]; }), correct: order.indexOf(x.q.a), e: x.q.e, topic: x.topic };
      });
      st = { qs: picked, ans: picked.map(function () { return null; }), cur: 0, left: SECONDS, done: false };
      timer = setInterval(function () {
        if (!host.isConnected) return stop();
        st.left--; paintTime();
        if (st.left <= 0) { stop(); grade(true); }
      }, 1000);
      paint();
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    var timeEl = null;
    function fmtTime(s) { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function paintTime() { if (timeEl) { timeEl.textContent = fmtTime(st.left); timeEl.parentNode.classList.toggle('is-low', st.left <= 120); } }
    function paint() {
      var q = st.qs[st.cur], name = 'ex-q';
      timeEl = el('b', { text: fmtTime(st.left) });
      var answered = st.ans.filter(function (a) { return a !== null; }).length;
      var bar = el('span'); bar.style.width = Math.round(answered / N * 100) + '%';
      var head = el('div', { class: 'quiz-meter ex-head' },
        el('span', { text: tt('exam.question', { n: st.cur + 1, total: N }) }), el('div', { class: 'bar' }, bar),
        el('span', { class: 'ex-time', 'aria-label': tt('exam.time') }, icon('clock'), timeEl));
      var nav = el('div', { class: 'ex-nav', 'aria-hidden': 'true' }, st.qs.map(function (x, i) {
        return el('button', { type: 'button', tabindex: '-1', class: (i === st.cur ? 'cur ' : '') + (st.ans[i] !== null ? 'done' : ''), onclick: function () { st.cur = i; paint(); } }, String(i + 1));
      }));
      var card = el('fieldset', { class: 'q-card' },
        el('legend', null, el('span', { class: 'qn', text: String(st.cur + 1) }), el('span', { text: q.text })),
        el('small', { class: 'ex-topic', text: q.topic }),
        el('div', { class: 'opts' }, q.opts.map(function (o, oi) {
          var input = el('input', { type: 'radio', name: name, value: String(oi) });
          if (st.ans[st.cur] === oi) input.checked = true;
          input.addEventListener('change', function () { st.ans[st.cur] = oi; paint(); });
          return el('label', { class: 'opt' }, input, el('span', { text: o }));
        })));
      var actions = el('div', { class: 'quiz-actions' },
        el('button', { class: 'btn btn-ghost', type: 'button', disabled: st.cur === 0 ? true : null, onclick: function () { st.cur--; paint(); } }, icon('left'), tt('exam.prev')),
        st.cur < N - 1 ? el('button', { class: 'btn btn-primary', type: 'button', onclick: function () { st.cur++; paint(); } }, tt('exam.next'), icon('right')) : null,
        el('button', { class: 'btn ' + (st.cur === N - 1 ? 'btn-primary' : 'btn-ghost'), type: 'button', onclick: finish }, icon('check'), tt('exam.finish')));
      panel.replaceChildren(head, nav, card, actions);
    }
    function finish() {
      var missing = st.ans.filter(function (a) { return a === null; }).length;
      if (!missing) { stop(); return grade(false); }
      api.confirm(tt('exam.unanswered', { n: missing }), tt('exam.finish')).then(function (ok) { if (ok) { stop(); grade(false); } });
    }
    function grade(timeUp) {
      st.done = true;
      var c = 0, topics = {};
      st.qs.forEach(function (q, i) {
        var ok = st.ans[i] === q.correct; if (ok) c++;
        topics[q.topic] = topics[q.topic] || { ok: 0, n: 0 }; topics[q.topic].n++; if (ok) topics[q.topic].ok++;
      });
      var pct = c / N;
      var rows = Object.keys(topics).sort(function (a, b) { return topics[a].ok / topics[a].n - topics[b].ok / topics[b].n; }).map(function (k) {
        var x = topics[k], bar = el('span'); bar.style.width = Math.round(x.ok / x.n * 100) + '%';
        return el('li', { class: x.ok === x.n ? 'good' : x.ok === 0 ? 'bad' : '' }, el('span', { class: 'ex-tname', text: k }), el('span', { class: 'ex-tbar' }, bar), el('b', { text: x.ok + '/' + x.n }));
      });
      var wrong = st.qs.map(function (q, i) { return { q: q, a: st.ans[i] }; }).filter(function (x) { return x.a !== x.q.correct; });
      panel.replaceChildren(el('div', { class: 'ex-result' },
        timeUp ? el('p', { class: 'ps-msg is-warn' }, icon('clock'), tt('exam.timeUp')) : null,
        el('div', { class: 'ch-big' }, el('b', { text: String(c) }), el('span', { text: '/ ' + N })),
        el('h3', { text: tt('exam.result', { c: c, q: N, p: H.fmtPct(api, pct, 0) }) }),
        el('p', { class: 'ch-verdict', text: pct >= 0.7 ? tt('exam.pass') : tt('exam.fail') }),
        el('h4', { text: tt('exam.byTopic') }), el('ul', { class: 'ex-topics' }, rows),
        wrong.length ? el('h4', { text: tt('exam.review') }) : null,
        wrong.length ? el('ol', { class: 'ex-review' }, wrong.map(function (x) {
          return el('li', null, el('b', { text: x.q.text }),
            el('span', { class: 'ex-yours', text: tt('exam.yourAns', { a: x.a === null ? tt('exam.noAnswer') : x.q.opts[x.a] }) }),
            el('span', { class: 'ex-right', text: tt('exam.correctAns', { a: x.q.opts[x.q.correct] }) }),
            el('small', { text: x.q.e }));
        })) : null,
        el('button', { class: 'btn btn-primary', type: 'button', onclick: intro }, icon('refresh'), tt('exam.again'))));
      if (pct >= 0.7 && api.celebrate) api.celebrate(panel);
    }
    intro();
  }

  window.PremiumTools = { montecarlo: montecarlo, drawdown: drawdown, fire: fire, dcf: dcf, exam: exam, _dcfValue: dcfValue };
})();
