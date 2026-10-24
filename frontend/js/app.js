/* Gradewise SPA v2 - vanilla JS, hash routing, roles, i18n */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S = { me: null, health: {}, lang: localStorage.getItem('lang') || 'en' };
const isT = () => S.me?.role === 'teacher';

/* ------------------------------------------------------------------ i18n */
const I18N = {
  en: { home:'Home', review:'Review', batch:'Batch', history:'History', myresults:'My results', queue:'Teacher Queue', dashboard:'Dashboard', integrity:'Integrity', questions:'Questions', about:'Workflow',
    login:'Log in', register:'Create account', logout:'Log out', search:'Search...', reviewTitle:'Review an answer', reviewSub:'Choose a question, paste or upload an answer and get rubric-based feedback.',
    go:'Review answer', historyTitle:'Review history', myTitle:'My results', queueTitle:'Teacher review queue', dashTitle:'Dashboard', batchTitle:'Batch review', integrityTitle:'Integrity check', questionsTitle:'Questions and rubrics', aboutTitle:'How it works',
    welcome:'Review student answers in seconds, with the teacher in control.', heroSub:'Gradewise scores each answer against a rubric using an LLM, routes borderline results to a teacher queue, and traces every run in LangSmith.' },
  ur: { home:'ہوم', review:'جائزہ', batch:'بیچ ریویو', history:'ہسٹری', myresults:'میرے نتائج', queue:'ٹیچر قطار', dashboard:'ڈیش بورڈ', integrity:'کاپی چیک', questions:'سوالات', about:'ورک فلو',
    login:'لاگ اِن', register:'اکاؤنٹ بنائیں', logout:'لاگ آؤٹ', search:'تلاش...', reviewTitle:'جواب کا جائزہ', reviewSub:'سوال منتخب کریں، جواب لکھیں یا فائل اپلوڈ کریں اور رُبرک کے مطابق فیڈبیک لیں۔',
    go:'جائزہ لیں', historyTitle:'ریویو ہسٹری', myTitle:'میرے نتائج', queueTitle:'ٹیچر ریویو قطار', dashTitle:'ڈیش بورڈ', batchTitle:'بیچ ریویو', integrityTitle:'کاپی / مماثلت کی جانچ', questionsTitle:'سوالات اور رُبرک', aboutTitle:'یہ کیسے کام کرتا ہے',
    welcome:'طلبہ کے جوابات سیکنڈوں میں جانچیں، فیصلہ ٹیچر کے ہاتھ میں۔', heroSub:'گریڈوائز ہر جواب کو رُبرک کے مطابق اسکور کرتا ہے، درمیانے اسکور ٹیچر کو بھیجتا ہے اور ہر رن LangSmith میں ٹریس کرتا ہے۔' }
};
const t = k => I18N[S.lang]?.[k] ?? I18N.en[k] ?? k;
function applyLang() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ur' ? 'rtl' : 'ltr';
  $('#lang').textContent = S.lang === 'ur' ? 'EN' : 'اردو';
  $('#cmdk').firstChild.textContent = '\u{1F50D} ';
}

/* ------------------------------------------------------------------- api */
async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const res = await fetch('/api' + path, {
    ...opts,
    headers: opts.body && !isForm ? {'Content-Type': 'application/json'} : {},
    body: opts.body ? (isForm ? opts.body : JSON.stringify(opts.body)) : undefined
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) { S.me = null; renderNav(); if (!location.hash.startsWith('#/login')) location.hash = '#/login'; throw new Error('Please log in'); }
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = typeof j.detail === 'string' ? j.detail : (j.detail?.[0]?.msg || JSON.stringify(j.detail)); } catch {}
    throw new Error(msg);
  }
  return res.headers.get('content-type')?.includes('json') ? res.json() : res;
}
function toast(msg) { const x = $('#toast'); x.textContent = msg; x.hidden = false; clearTimeout(x._t); x._t = setTimeout(() => x.hidden = true, 3400); }
const tone = s => s >= 7 ? 'ok' : s >= 4 ? 'warn' : 'bad';
const color = s => ({ok:'#059669',warn:'#d97706',bad:'#dc2626'})[tone(s)];
const final = r => r.final_score ?? r.ai_score;
const SIM = 0.6;

function statusTag(r) {
  if (r.teacher_status === 'pending') return '<span class="tag t-warn">Awaiting teacher</span>';
  if (r.teacher_status === 'approved') return '<span class="tag t-ok">Approved</span>';
  if (r.teacher_status === 'overridden') return '<span class="tag t-info">Overridden</span>';
  return '<span class="tag t-ok">Feedback ready</span>';
}
function ring(score, size = 128, pct = null) {
  return `<div class="score-ring" data-score="${score}"${pct == null ? '' : ` data-pct="${pct}"`} style="--p:0;--c:${color(score)};width:${size}px;height:${size}px"><div style="width:${size - 28}px;height:${size - 28}px">0/10</div></div>`;
}
function animateRings(root = document) {
  $$('.score-ring[data-score]', root).forEach(el => {
    const target = +el.dataset.score, pct = el.dataset.pct == null ? null : +el.dataset.pct, inner = el.firstElementChild, t0 = performance.now();
    el.removeAttribute('data-score');
    const step = now => {
      const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3);
      el.style.setProperty('--p', target * 10 * e);
      inner.textContent = pct == null ? Math.round(target * e) + '/10' : Math.round(pct * e) + '%';
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  $$('.bar i[data-w]', root).forEach(b => { const w = b.dataset.w; b.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = 'width .8s ease'; b.style.width = w + '%'; })); });
}
function skeleton(n = 3) { return `<div class="card"><div class="row"><div class="sk sk-ring"></div><div class="sp"><div class="sk sk-line" style="width:50%"></div><div class="sk sk-line" style="width:30%"></div></div></div>${Array.from({length: n}, () => '<div class="sk sk-line" style="margin-top:18px"></div><div class="sk sk-bar"></div>').join('')}</div>`; }
const bar = (pct) => `<div class="bar"><i data-w="${Math.max(0, Math.min(100, pct))}" style="width:${pct}%"></i></div>`;

/* --------------------------------------------------------------- confetti */
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('#confetti'), ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#4f46e5', '#7c3aed', '#059669', '#d97706', '#0ea5e9', '#dc2626'];
  const ps = Array.from({length: 140}, () => ({x: innerWidth / 2, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 3, s: 5 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0], r: Math.random() * 6}));
  let f = 0;
  (function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); });
    if (++f < 130) requestAnimationFrame(loop); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ------------------------------------------------------- tooltips + clicks */
document.addEventListener('mousemove', e => {
  const el = e.target.closest?.('[data-tip]'), tip = $('#tip');
  if (!el) { tip.hidden = true; return; }
  tip.textContent = el.dataset.tip; tip.hidden = false;
  tip.style.left = Math.min(e.clientX + 14, innerWidth - 250) + 'px'; tip.style.top = (e.clientY + 16) + 'px';
});
document.addEventListener('click', async e => {
  const go = e.target.closest?.('[data-go]'); if (go) { location.hash = go.dataset.go; return; }
  const re = e.target.closest?.('[data-re]');
  if (re) {
    re.disabled = true; re.textContent = 'Re-evaluating...';
    try {
      const r = await api(`/reviews/${re.dataset.re}/reevaluate`, {method: 'POST'});
      const wrap = re.closest('.result-wrap'); wrap.outerHTML = resultView(r); animateRings(); toast(`New AI score: ${r.ai_score}/10 (was ${r.prev_score}/10)`); refreshBadge();
    } catch (err) { toast(err.message); re.disabled = false; re.textContent = 'Re-evaluate'; }
    return;
  }
  const pr = e.target.closest?.('[data-print]');
  if (pr) { $('#printArea').innerHTML = pr.closest('.result-wrap').outerHTML.replace(/class="score-ring"[^>]*>/, m => m); window.print(); }
});

/* ------------------------------------------------------------- result view */
function resultView(r) {
  const sc = final(r), sim = r.similarity || 0;
  return `<div class="result-wrap" data-id="${r.id}"><div class="row"><div>${ring(sc)}</div><div class="sp"><h2 style="margin:0">${esc(r.student_name)}</h2>
    <div style="margin:6px 0">${statusTag(r)} <span class="tag t-info">${r.mode === 'demo' ? 'Demo grader' : 'Groq'}</span></div>
    <small style="color:var(--mut)">${r.final_score != null && r.final_score !== r.ai_score ? `AI suggested ${r.ai_score}/10 &middot; ` : ''}Review #${r.id}${r.prev_score != null ? ` &middot; re-evaluated (was ${r.prev_score}/10)` : ''}</small></div></div>
  ${isT() && sim >= SIM ? `<div class="alert warn">&#9888; This answer is ${Math.round(sim * 100)}% similar to review #${r.similar_to}. <a href="#/integrity">Open integrity check</a></div>` : ''}
  <div style="margin-top:14px">${r.criteria_scores.map(c => `<div class="crit"><div class="row"><b>${esc(c.name)}</b><span class="sp"></span><b>${c.score}/${c.max}</b></div>${bar(c.max ? c.score / c.max * 100 : 0)}<small>${esc(c.comment)}</small></div>`).join('')}</div>
  <h3 style="margin-top:14px">Feedback</h3><p style="margin:0 0 10px">${esc(r.feedback)}</p>
  <h3>Suggested improvement</h3><p style="margin:0 0 14px">${esc(r.improvement)}</p>
  ${r.teacher_note ? `<h3>Teacher note</h3><p style="margin:0 0 14px">${esc(r.teacher_note)}</p>` : ''}
  <div class="row" data-hideprint><a class="btn sm" href="/api/reviews/${r.id}/pdf">Download PDF</a><button class="btn sm ghost" data-print>Print</button>
    ${isT() ? `<button class="btn sm sec" data-re="${r.id}">Re-evaluate</button>` : ''}<a class="btn sm sec" href="#/history">${t(isT() ? 'history' : 'myresults')}</a></div>
  <p class="sub" style="margin:12px 0 0;font-size:12px">Scores are suggestions; the teacher makes the final decision.</p></div>`;
}

/* ------------------------------------------------------------------ charts */
function barChart(vals, labels, o = {}) {
  const m = Math.max(...vals, 1), W = 520, H = 200, bw = W / vals.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H + 22}" preserveAspectRatio="none" role="img" aria-label="${esc(o.label || 'bar chart')}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#4f46e5"/></linearGradient></defs>${vals.map((v, i) => {
    const h = v / m * (H - 20), go = o.go ? ` data-go="${o.go(i)}"` : '';
    return `<rect x="${i * bw}" y="0" width="${bw}" height="${H}" fill="transparent" data-tip="${esc(o.tip ? o.tip(i, v) : v)}"${go}/><rect x="${i * bw + 5}" y="${H - h}" width="${bw - 10}" height="${h}" rx="5" fill="url(#g)" pointer-events="none"/><text x="${i * bw + bw / 2}" y="${H + 16}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">${labels[i]}</text>${v ? `<text x="${i * bw + bw / 2}" y="${H - h - 4}" text-anchor="middle" font-size="11" fill="currentColor">${v}</text>` : ''}`;
  }).join('')}</svg>`;
}
function lineChart(pts) {
  if (!pts.length) return '<div class="empty">No data yet.</div>';
  const W = 520, H = 200, step = pts.length > 1 ? (W - 30) / (pts.length - 1) : 0;
  const xy = pts.map((p, i) => [i * step + 15, H - p.score / 10 * (H - 10)]);
  return `<svg class="chart" viewBox="0 0 ${W} ${H + 10}" role="img" aria-label="recent scores"><polyline fill="none" stroke="#4f46e5" stroke-width="3" points="${xy.map(p => p.join(',')).join(' ')}"/>${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="${color(pts[i].score)}" data-tip="Review #${pts[i].id}: ${pts[i].score}/10" data-go="#/history?open=${pts[i].id}"/>`).join('')}</svg>`;
}
function agreeChart(pairs) {
  if (!pairs.length) return '<div class="empty">No teacher decisions yet.</div>';
  const W = 520, rowH = 26, H = pairs.length * rowH + 24, x = v => 20 + v / 10 * (W - 40);
  return `<svg class="chart" style="height:${Math.min(H, 340)}px" viewBox="0 0 ${W} ${H}" role="img" aria-label="AI versus teacher scores">${[0, 5, 10].map(v => `<text x="${x(v)}" y="12" text-anchor="middle" font-size="10" fill="currentColor" opacity=".5">${v}</text>`).join('')}${pairs.map((p, i) => {
    const y = 28 + i * rowH;
    return `<line x1="${x(p.ai)}" y1="${y}" x2="${x(p.final)}" y2="${y}" stroke="#a5b4fc" stroke-width="3"/><circle cx="${x(p.ai)}" cy="${y}" r="6" fill="none" stroke="#4f46e5" stroke-width="2.5" data-tip="#${p.id} AI: ${p.ai}/10"/><circle cx="${x(p.final)}" cy="${y}" r="6" fill="#7c3aed" data-tip="#${p.id} teacher: ${p.final}/10" data-go="#/history?open=${p.id}"/>`;
  }).join('')}</svg><small style="color:var(--mut)">Hollow dot = AI score, filled dot = teacher's final score.</small>`;
}

/* -------------------------------------------------------------- navigation */
const NAV_T = ['home', 'review', 'batch', 'history', 'queue', 'integrity', 'dashboard', 'questions', 'about'];
const NAV_S = ['home', 'review', 'history', 'about'];
const PAGE_LABEL = n => (n === 'history' && !isT()) ? t('myresults') : t(n);
const hashOf = n => n === 'home' ? '#/' : '#/' + n;
function renderNav() {
  const names = !S.me ? [] : isT() ? NAV_T : NAV_S;
  $('#links').innerHTML = names.map(n => `<a href="${hashOf(n)}" data-nav="${n}">${PAGE_LABEL(n)}${n === 'queue' ? ' <span id="qbadge" class="badge" hidden>0</span>' : ''}</a>`).join('');
  const u = $('#user');
  u.hidden = !S.me;
  if (S.me) { u.innerHTML = `<span title="${S.me.role}">${esc(S.me.display_name)}</span><button id="logout">${t('logout')}</button>`; $('#logout').onclick = logout; }
  $('#cmdk').hidden = !S.me; $('#help').hidden = !S.me;
  setActive();
}
function setActive() { const n = currentRoute().name; $$('#links a').forEach(a => a.classList.toggle('active', a.dataset.nav === n)); }
async function logout() { await api('/auth/logout', {method: 'POST'}).catch(() => {}); S.me = null; renderNav(); location.hash = '#/login'; }
async function refreshBadge() { if (!isT()) return; try { const q = await api('/queue'); const b = $('#qbadge'); if (b) { b.textContent = q.length; b.hidden = !q.length; } } catch {} }
function currentRoute() {
  const h = location.hash.replace(/^#\/?/, ''), [path, qs] = h.split('?');
  return {name: path.split('/')[0] || 'home', params: new URLSearchParams(qs || '')};
}

/* ----------------------------------------------- palette, help, shortcuts */
function closeOverlay() { const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; }
function openPalette() {
  if (!S.me) return;
  const o = $('#overlay'); o.hidden = false;
  o.innerHTML = `<div class="pal" role="dialog" aria-label="Quick search"><input id="pin" placeholder="${t('search')}" autocomplete="off"><ul id="plist"></ul></div>`;
  o.onclick = e => { if (e.target === o) closeOverlay(); };
  const names = isT() ? NAV_T : NAV_S;
  const base = [...names.map(n => ({label: PAGE_LABEL(n), hint: 'Go to page', run: () => location.hash = hashOf(n)})),
    {label: 'Toggle dark / light', hint: 'Theme', run: toggleTheme}, {label: S.lang === 'ur' ? 'Switch to English' : 'اردو میں تبدیل کریں', hint: 'Language', run: toggleLang},
    {label: 'Start guided tour', hint: 'Help', run: startTour}, {label: t('logout'), hint: 'Account', run: logout}];
  let items = base, sel = 0, timer;
  const draw = () => {
    $('#plist').innerHTML = items.length ? items.map((it, i) => `<li class="${i === sel ? 'sel' : ''}" data-i="${i}"><span>${esc(it.label)}</span><small>${esc(it.hint)}</small></li>`).join('') : '<li><small>No results</small></li>';
    $$('#plist li[data-i]').forEach(li => li.onclick = () => run(+li.dataset.i));
  };
  const run = i => { const it = items[i]; closeOverlay(); it?.run(); };
  const input = $('#pin');
  input.oninput = () => {
    const q = input.value.trim().toLowerCase(); sel = 0;
    items = base.filter(b => b.label.toLowerCase().includes(q)); draw();
    clearTimeout(timer);
    if (q.length >= 2) timer = setTimeout(async () => {
      try {
        const rs = await api('/reviews?limit=6&q=' + encodeURIComponent(q));
        if (input.value.trim().toLowerCase() !== q) return;
        items = [...items, ...rs.map(r => ({label: `#${r.id} ${r.student_name}`, hint: `${final(r)}/10`, run: () => location.hash = `#/history?open=${r.id}`}))]; draw();
      } catch {}
    }, 200);
  };
  input.onkeydown = e => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') run(sel);
  };
  draw(); input.focus();
}
function openHelp() {
  const o = $('#overlay'); o.hidden = false;
  o.innerHTML = `<div class="modal" role="dialog" aria-label="Help"><h2>Keyboard shortcuts</h2><div class="sc">
    <kbd>Ctrl K</kbd><span>Quick search and commands (also <kbd>/</kbd>)</span><kbd>?</kbd><span>This help</span>
    <kbd>g</kbd><span>then <kbd>h</kbd> home, <kbd>r</kbd> review, <kbd>y</kbd> history, <kbd>d</kbd> dashboard, <kbd>q</kbd> queue, <kbd>b</kbd> batch, <kbd>i</kbd> integrity, <kbd>w</kbd> workflow</span>
    <kbd>Esc</kbd><span>Close dialogs</span></div><div class="row"><button class="btn sm" id="tourbtn">Start guided tour</button><button class="btn sm ghost" id="closehelp">Close</button></div></div>`;
  o.onclick = e => { if (e.target === o) closeOverlay(); };
  $('#closehelp').onclick = closeOverlay; $('#tourbtn').onclick = () => { closeOverlay(); startTour(); };
}
let gPending = 0;
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (e.key === 'Escape') { closeOverlay(); endTour(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || !S.me) return;
  if (e.key === '/') { e.preventDefault(); openPalette(); return; }
  if (e.key === '?') { openHelp(); return; }
  if (gPending && Date.now() - gPending < 1200) {
    const map = {h: 'home', r: 'review', y: 'history', d: 'dashboard', q: 'queue', b: 'batch', i: 'integrity', w: 'about'};
    const n = map[e.key]; gPending = 0;
    if (n && (isT() ? NAV_T : NAV_S).includes(n)) location.hash = hashOf(n);
    return;
  }
  if (e.key === 'g') gPending = Date.now();
});

/* -------------------------------------------------------------------- tour */
const TOUR = [
  {sel: '#links', title: 'Navigation', text: 'Every page lives here. The Teacher Queue shows a red badge when answers need your decision.'},
  {sel: '#cmdk', title: 'Quick search', text: 'Press Ctrl+K anywhere to jump to a page or find a student or answer instantly.'},
  {sel: '#modepill', title: 'Live or demo', text: 'Live - Groq means the real model is scoring. Demo mode uses the offline keyword grader.'},
  {sel: '#lang', title: 'Language', text: 'Switch the interface between English and Urdu.'},
  {sel: '#theme', title: 'Theme', text: 'Light and dark mode. Press ? any time to see all shortcuts.'}];
let tourI = 0;
function startTour() { tourI = 0; showTour(); }
function showTour() {
  $$('.tour-hl').forEach(x => x.classList.remove('tour-hl'));
  const s = TOUR[tourI], box = $('#tour'); if (!s) return endTour();
  $(s.sel)?.classList.add('tour-hl');
  box.hidden = false;
  box.innerHTML = `<small style="color:var(--mut)">Step ${tourI + 1} of ${TOUR.length}</small><h3 style="margin:4px 0">${s.title}</h3><p style="margin:0 0 12px;color:var(--mut);font-size:14px">${s.text}</p>
    <div class="row"><button class="btn sm" id="tnext">${tourI === TOUR.length - 1 ? 'Done' : 'Next'}</button><button class="btn sm ghost" id="tskip">Skip</button></div>`;
  $('#tnext').onclick = () => { tourI++; showTour(); }; $('#tskip').onclick = endTour;
}
function endTour() { $$('.tour-hl').forEach(x => x.classList.remove('tour-hl')); $('#tour').hidden = true; localStorage.setItem('tour_done', '1'); }

/* ------------------------------------------------------------ theme + lang */
function toggleTheme() { const n = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; localStorage.setItem('theme', n); }
function toggleLang() { S.lang = S.lang === 'ur' ? 'en' : 'ur'; localStorage.setItem('lang', S.lang); applyLang(); renderNav(); route(); }

/* ------------------------------------------------------------------- pages */
const pages = {};
const head = (title, sub, extra = '') => `<div class="row"><div class="sp"><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${extra}</div>`;

pages.login = async () => {
  if (S.me) { location.hash = '#/'; return; }
  app.innerHTML = `<div class="auth card"><div class="tabs"><button class="on" data-tab="in">${t('login')}</button><button data-tab="up">${t('register')}</button></div>
    <div id="f-in"><label>Username</label><input id="lu" autocomplete="username"><label>Password</label><input id="lp" type="password" autocomplete="current-password">
      <button class="btn" id="bin" style="margin-top:18px;width:100%;justify-content:center">${t('login')}</button>
      <p class="sub" style="margin:14px 0 0;font-size:13px">Teachers sign in with the account set in <code>.env</code>. Students can create an account.</p></div>
    <div id="f-up" hidden><label>Full name</label><input id="rn"><label>Username</label><input id="ru" autocomplete="username"><label>Password (6+ characters)</label><input id="rp" type="password" autocomplete="new-password">
      <button class="btn" id="bup" style="margin-top:18px;width:100%;justify-content:center">${t('register')}</button></div></div>`;
  $$('.tabs button').forEach(b => b.onclick = () => { $$('.tabs button').forEach(x => x.classList.toggle('on', x === b)); $('#f-in').hidden = b.dataset.tab !== 'in'; $('#f-up').hidden = b.dataset.tab !== 'up'; });
  const done = async u => { S.me = u; renderNav(); refreshBadge(); location.hash = '#/'; if (!localStorage.getItem('tour_done')) setTimeout(startTour, 700); };
  const submit = async (btn, fn) => { btn.disabled = true; try { await done(await fn()); } catch (e) { toast(e.message); } btn.disabled = false; };
  $('#bin').onclick = e => submit(e.target, () => api('/auth/login', {method: 'POST', body: {username: $('#lu').value.trim(), password: $('#lp').value}}));
  $('#bup').onclick = e => submit(e.target, () => api('/auth/register', {method: 'POST', body: {username: $('#ru').value.trim(), display_name: $('#rn').value.trim(), password: $('#rp').value}}));
  $('#lp').onkeydown = e => { if (e.key === 'Enter') $('#bin').click(); };
};

pages.home = async () => {
  let cards;
  if (isT()) {
    const s = await api('/stats');
    cards = [[s.total, 'Reviews completed'], [s.average, 'Average score / 10'], [s.flagged, 'Flagged for teacher'], [s.pending, 'Pending decisions'], [s.similar, 'Similar answers'], [s.agreement.rate == null ? '-' : s.agreement.rate + '%', 'AI-teacher agreement']];
  } else {
    const rs = await api('/reviews'), avg = rs.length ? (rs.reduce((a, r) => a + final(r), 0) / rs.length).toFixed(1) : '-';
    cards = [[rs.length, 'My reviews'], [avg, 'My average / 10'], [rs.filter(r => r.teacher_status === 'pending').length, 'Awaiting teacher']];
  }
  app.innerHTML = `<section class="hero"><span class="pill" style="background:#ffffff26;color:#fff">LangChain &middot; LangGraph &middot; LangSmith</span>
    <h1>${t('welcome')}</h1><p>${t('heroSub')}</p>
    <div class="row" style="margin-top:22px"><a class="btn sec" href="#/review">${t('review')}</a>${isT() ? `<a class="btn ghost" style="color:#fff;border-color:#fff6" href="#/batch">${t('batch')}</a>` : ''}<a class="btn ghost" style="color:#fff;border-color:#fff6" href="#/about">${t('about')}</a></div></section>
  <div class="grid g3" style="margin-bottom:26px">${cards.map(c => `<div class="card stat"><b>${c[0]}</b><span>${c[1]}</span></div>`).join('')}</div>
  <h2>Everything in one place</h2><div class="grid g3">${[
    ['&#129302;', 'Rubric-based AI scoring', 'Every criterion is scored separately with a short comment, validated against its maximum.'],
    ['&#128101;', 'Teacher review queue', 'Scores 4-6 are flagged. Approve the AI score or override it with a note.'],
    ['&#128202;', 'Analytics and agreement', 'Distribution, trends, criteria strength and how often the teacher agrees with the AI.'],
    ['&#128230;', 'Batch review', 'Upload a CSV or many files and review a whole class with a live progress bar.'],
    ['&#128270;', 'Integrity check', 'Finds answers that are suspiciously similar to each other.'],
    ['&#128196;', 'Files, PDF and CSV', 'Read answers from PDF, DOCX or TXT; download result PDFs and CSV exports.']
  ].map(f => `<div class="card feat"><div class="ic">${f[0]}</div><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div>`;
};

pages.review = async () => {
  const qs = await api('/questions');
  app.innerHTML = head(t('reviewTitle'), t('reviewSub')) + `<div class="grid g2"><div class="card">
    <label>Question</label><select id="q">${qs.map(q => `<option value="${q.id}">${esc(q.title)}</option>`).join('')}</select>
    <div id="qtext" class="sub" style="margin:10px 0 0"></div>
    ${isT() ? '<label>Student name</label><input id="name" placeholder="e.g. Anushay Ayat">' : ''}
    <label>Answer <span id="count" style="color:var(--mut);font-weight:400"></span></label>
    <textarea id="ans" placeholder="Type or paste the answer..."></textarea>
    <div class="row" style="margin-top:16px"><button class="btn" id="go">${t('go')}</button><button class="btn ghost" id="upl">Upload file</button><button class="btn ghost" id="sample">Use sample</button>
      <input type="file" id="file" accept=".txt,.md,.pdf,.docx" hidden></div>
    <p class="sub" style="margin:14px 0 0;font-size:12px">PDF, DOCX or TXT up to 5 MB. ${S.health.tracing ? 'LangSmith tracing is ON: prompts and answers are recorded. Use fictional or consented submissions.' : 'LangSmith tracing is off.'}</p>
  </div><div id="out"><div class="card empty">The review will appear here.</div></div></div>`;
  const sel = $('#q'), show = () => { const q = qs.find(x => x.id == sel.value); $('#qtext').innerHTML = `<b>${esc(q.text)}</b><br>Rubric: ${q.criteria.map(c => `${esc(c.name)} (${c.max_points})`).join(' &middot; ')}`; };
  sel.onchange = show; show();
  const count = () => $('#count').textContent = `(${$('#ans').value.length} characters)`;
  $('#ans').oninput = count;
  $('#sample').onclick = () => { $('#ans').value = 'Supervised learning uses labeled data, such as emails labeled spam or not spam. Unsupervised learning finds patterns in unlabeled data, such as grouping customers by purchasing behavior.'; count(); };
  $('#upl').onclick = () => $('#file').click();
  $('#file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    try { const r = await api('/extract', {method: 'POST', body: fd}); $('#ans').value = r.text; count(); toast(r.truncated ? `Loaded ${f.name} (trimmed to 6000 of ${r.chars} characters)` : `Loaded ${f.name}`); }
    catch (err) { toast(err.message); }
    e.target.value = '';
  };
  $('#go').onclick = async e => {
    const answer = $('#ans').value.trim();
    if (answer.length < 3) return toast('Please enter an answer.');
    const b = e.target; b.disabled = true; b.innerHTML = '<span class="spin"></span> Reviewing...';
    $('#out').innerHTML = skeleton(4);
    try {
      const r = await api('/reviews', {method: 'POST', body: {question_id: +sel.value, student_name: ($('#name')?.value.trim()) || 'Anonymous', answer}});
      $('#out').innerHTML = `<div class="card">${resultView(r)}</div>`; animateRings($('#out'));
      if (final(r) === 10) confetti(); refreshBadge();
    } catch (err) { $('#out').innerHTML = `<div class="card empty" style="color:var(--bad)">${esc(err.message)}</div>`; }
    b.disabled = false; b.textContent = t('go');
  };
};

/* CSV parsing (quotes, commas and newlines inside quotes) */
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
const csvSafe = v => { v = String(v ?? ''); return /^[=+\-@]/.test(v) ? "'" + v : v; };
const csvCell = v => `"${csvSafe(v).replace(/"/g, '""')}"`;

pages.batch = async () => {
  const qs = await api('/questions'); let rows = [];
  app.innerHTML = head(t('batchTitle'), 'Review a whole class at once. Upload a CSV with columns <code>student_name,answer</code>, or drop several answer files (one file per student).') + `<div class="grid g2"><div class="card">
    <label>Question</label><select id="q">${qs.map(q => `<option value="${q.id}">${esc(q.title)}</option>`).join('')}</select>
    <label>CSV file</label><div class="drop" id="dcsv">Click to choose a CSV</div><input type="file" id="fcsv" accept=".csv,text/csv" hidden>
    <label>Or answer files (PDF, DOCX, TXT)</label><div class="drop" id="dfiles">Click to choose files</div><input type="file" id="ffiles" accept=".txt,.md,.pdf,.docx" multiple hidden>
    <div id="loaded" class="sub" style="margin:12px 0 0"></div>
    <div class="row" style="margin-top:14px"><button class="btn" id="run" disabled>Start batch review</button><button class="btn ghost" id="clear">Clear</button></div></div>
    <div class="card" id="panel"><div class="empty">Loaded answers and results appear here.</div></div></div>`;
  const upd = () => { $('#loaded').textContent = rows.length ? `${rows.length} answer(s) loaded.` : ''; $('#run').disabled = !rows.length; panel(); };
  const panel = (results = {}) => {
    if (!rows.length) { $('#panel').innerHTML = '<div class="empty">Loaded answers and results appear here.</div>'; return; }
    $('#panel').innerHTML = `<div id="progwrap" hidden><div class="row"><b id="ptxt">0 / ${rows.length}</b><span class="sp"></span><span id="psum" class="sub" style="margin:0"></span></div><div class="prog"><i id="pbar"></i></div></div>
      <div style="max-height:420px;overflow:auto"><table><tr><th>#</th><th>Student</th><th>Answer</th><th>Score</th><th>Status</th></tr>${rows.map((r, i) => {
        const res = results[i];
        return `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.answer.slice(0, 60))}${r.answer.length > 60 ? '...' : ''}</td><td>${res?.ok ? `<b style="color:${color(final(res.r))}">${final(res.r)}/10</b>` : res ? '-' : ''}</td>
        <td>${res ? (res.ok ? statusTag(res.r) + ((res.r.similarity || 0) >= SIM ? ' <span class="tag t-bad">Similar</span>' : '') : `<span class="tag t-bad">${esc(res.err)}</span>`) : '<span class="tag t-info">Queued</span>'}</td></tr>`;
      }).join('')}</table></div><div id="done"></div>`;
  };
  $('#dcsv').onclick = () => $('#fcsv').click(); $('#dfiles').onclick = () => $('#ffiles').click();
  $('#clear').onclick = () => { rows = []; upd(); };
  $('#fcsv').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const data = parseCSV(await f.text()); if (!data.length) return toast('The CSV is empty');
    const hdr = data[0].map(h => h.trim().toLowerCase()), hasHdr = hdr.includes('answer');
    const ai = hasHdr ? hdr.indexOf('answer') : 1, ni = hasHdr ? Math.max(hdr.indexOf('student_name'), hdr.indexOf('name')) : 0;
    const add = data.slice(hasHdr ? 1 : 0).map(r => ({name: (r[ni < 0 ? 0 : ni] || 'Anonymous').trim().slice(0, 80), answer: (r[ai] || '').trim().slice(0, 6000)})).filter(r => r.answer.length >= 3);
    rows = rows.concat(add).slice(0, 100); upd(); toast(`${add.length} rows read${rows.length === 100 ? ' (limit 100)' : ''}`); e.target.value = '';
  };
  $('#ffiles').onchange = async e => {
    for (const f of e.target.files) {
      try { const fd = new FormData(); fd.append('file', f); const r = await api('/extract', {method: 'POST', body: fd}); rows.push({name: f.name.replace(/\.[^.]+$/, '').slice(0, 80), answer: r.text}); }
      catch (err) { toast(`${f.name}: ${err.message}`); }
    }
    rows = rows.slice(0, 100); upd(); e.target.value = '';
  };
  $('#run').onclick = async () => {
    const qid = +$('#q').value, results = {}; let ok = 0, flagged = 0, sim = 0, sum = 0;
    $('#run').disabled = true; $('#progwrap').hidden = false;
    for (let i = 0; i < rows.length; i++) {
      try { const r = await api('/reviews', {method: 'POST', body: {question_id: qid, student_name: rows[i].name, answer: rows[i].answer}}); results[i] = {ok: true, r}; ok++; sum += final(r); if (r.needs_teacher) flagged++; if ((r.similarity || 0) >= SIM) sim++; }
      catch (err) { results[i] = {ok: false, err: err.message.slice(0, 50)}; }
      panel(results); $('#progwrap').hidden = false; $('#pbar').style.width = ((i + 1) / rows.length * 100) + '%'; $('#ptxt').textContent = `${i + 1} / ${rows.length}`;
    }
    $('#psum').textContent = `avg ${ok ? (sum / ok).toFixed(1) : '-'} / 10 - ${flagged} for teacher - ${sim} similar`;
    $('#done').innerHTML = `<div class="row" style="margin-top:14px"><button class="btn sm" id="dl">Download results CSV</button><a class="btn sm sec" href="#/queue">Open teacher queue</a><a class="btn sm sec" href="#/integrity">Integrity check</a></div>`;
    $('#dl').onclick = () => {
      const lines = ['student,ai_score,status,similarity_flag', ...rows.map((r, i) => { const x = results[i]; return [csvCell(r.name), x?.ok ? x.r.ai_score : '', csvCell(x?.ok ? x.r.status : x?.err), x?.ok && (x.r.similarity || 0) >= SIM ? 'yes' : 'no'].join(','); })];
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/csv'})); a.download = 'batch-results.csv'; a.click();
    };
    toast(`Batch finished: ${ok} of ${rows.length} reviewed`); refreshBadge(); $('#run').disabled = false;
  };
};

pages.history = async () => {
  const {params} = currentRoute(), qs = await api('/questions');
  const preset = {q: params.get('q') || '', status: params.get('status') || '', score: params.get('score') || ''};
  app.innerHTML = head(isT() ? t('historyTitle') : t('myTitle'), 'Search, filter and open any review.', isT() ? '<a class="btn sec" href="/api/export.csv">Export CSV</a>' : '') +
    `<div class="card"><div class="filters"><input id="s" placeholder="Search student or answer..." value="${esc(preset.q)}"><select id="st">
    <option value="">All statuses</option><option value="ready">Feedback ready</option><option value="flagged">Flagged</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="overridden">Overridden</option>${isT() ? '<option value="similar">Similar answers</option>' : ''}</select>
    <select id="qf"><option value="">All questions</option>${qs.map(q => `<option value="${q.id}">${esc(q.title)}</option>`).join('')}</select>
    <select id="sc"><option value="">Any score</option>${Array.from({length: 11}, (_, i) => `<option value="${i}">Score ${i}</option>`).join('')}</select></div>
    <div id="list"><div class="sk sk-line"></div><div class="sk sk-line"></div></div></div><div id="detail" style="margin-top:18px"></div>`;
  $('#st').value = preset.status; $('#sc').value = preset.score;
  const open = async id => { try { $('#detail').innerHTML = `<div class="card">${resultView(await api('/reviews/' + id))}</div>`; animateRings($('#detail')); $('#detail').scrollIntoView({behavior: 'smooth'}); } catch (e) { toast(e.message); } };
  const load = async () => {
    const p = new URLSearchParams({q: $('#s').value, status: $('#st').value}); if ($('#qf').value) p.set('question_id', $('#qf').value); if ($('#sc').value) p.set('score', $('#sc').value);
    const rows = await api('/reviews?' + p);
    $('#list').innerHTML = rows.length ? `<div style="overflow:auto"><table><tr><th>#</th><th>Student</th><th>Question</th><th>Score</th><th>Status</th><th>Date</th><th></th></tr>${rows.map(r =>
      `<tr><td>${r.id}</td><td>${esc(r.student_name)}</td><td>${esc((qs.find(q => q.id === r.question_id) || {}).title)}</td><td><b style="color:${color(final(r))}">${final(r)}/10</b></td><td>${statusTag(r)}${isT() && (r.similarity || 0) >= SIM ? ' <span class="tag t-bad" data-tip="Similar to #' + r.similar_to + '">Similar</span>' : ''}</td><td>${esc(r.created_at)}</td>
      <td><div class="row"><button class="btn sm sec" data-v="${r.id}">View</button>${isT() ? `<button class="btn sm ghost" data-d="${r.id}">Delete</button>` : ''}</div></td></tr>`).join('')}</table></div>` : '<div class="empty">No reviews match.</div>';
    $$('#list [data-v]').forEach(b => b.onclick = () => open(b.dataset.v));
    $$('#list [data-d]').forEach(b => b.onclick = async () => { if (confirm('Delete this review?')) { await api('/reviews/' + b.dataset.d, {method: 'DELETE'}); load(); refreshBadge(); } });
  };
  ['s', 'st', 'qf', 'sc'].forEach(id => $('#' + id).oninput = load);
  await load(); if (params.get('open')) open(params.get('open'));
};

pages.queue = async () => {
  const rows = await api('/queue');
  app.innerHTML = head(t('queueTitle'), `Borderline scores (${S.health.review_band?.[0]}-${S.health.review_band?.[1]}/10) wait here for a human decision.`) +
  (rows.length ? rows.map(r => `<div class="card" style="margin-bottom:18px" data-id="${r.id}">${resultView(r)}
    <hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h3>Student answer</h3><p style="white-space:pre-wrap">${esc(r.answer)}</p>
    <div class="grid g2"><div><label>Final score (for override)</label><input type="number" min="0" max="10" value="${r.ai_score}" class="fs"></div><div><label>Note</label><input class="nt" placeholder="Optional note for the student"></div></div>
    <div class="row" style="margin-top:14px"><button class="btn ok sm" data-a="approve">Approve AI score</button><button class="btn sm" data-a="override">Override with score</button></div></div>`).join('') : '<div class="card empty">Queue is empty. Nothing needs your attention.</div>');
  animateRings();
  $$('[data-a]').forEach(b => b.onclick = async () => {
    const card = b.closest('[data-id]');
    try { await api(`/reviews/${card.dataset.id}/decision`, {method: 'POST', body: {action: b.dataset.a, final_score: +card.querySelector('.fs').value, note: card.querySelector('.nt').value}}); toast('Decision saved'); refreshBadge(); pages.queue(); }
    catch (e) { toast(e.message); }
  });
};

pages.dashboard = async () => {
  const s = await api('/stats'), a = s.agreement;
  const stat = (v, l) => `<div class="card stat"><b>${v}</b><span>${l}</span></div>`;
  app.innerHTML = head(t('dashTitle'), 'How your class is doing. Hover bars for details, click a bar to see those reviews.') +
  `<div class="grid g4" style="margin-bottom:18px">${stat(s.total, 'Total reviews')}${stat(s.average, 'Average score')}${stat(s.flagged, 'Flagged')}${stat(s.similar, 'Similar answers')}</div>` +
  (s.total ? `<div class="grid g2"><div class="card"><h3>Score distribution</h3>${barChart(s.distribution, [...Array(11).keys()], {label: 'score distribution', tip: (i, v) => `${v} review(s) scored ${i}/10`, go: i => '#/history?score=' + i})}</div>
  <div class="card"><h3>Recent scores</h3>${lineChart(s.trend)}</div>
  <div class="card"><h3>AI vs teacher agreement</h3>${a.decided ? `<div class="row"><div>${ring(a.rate / 10, 128, a.rate)}</div><div class="sp"><b style="font-size:26px">${a.rate}%</b> agree<br><small style="color:var(--mut)">${a.decided} decided &middot; ${a.approved} approved &middot; ${a.overridden} overridden<br>Average change when overriding: ${a.mae} point(s)</small></div></div><div style="margin-top:14px">${agreeChart(a.pairs)}</div>` : '<div class="empty">Decisions made in the Teacher Queue will appear here.</div>'}</div>
  <div class="card"><h3>Average by question</h3>${s.by_question.map(q => `<div class="crit"><div class="row"><b>${esc(q.title)}</b><span class="sp"></span><b>${q.avg}/10</b></div>${bar(q.avg * 10)}<small>${q.count} reviews</small></div>`).join('')}</div>
  <div class="card"><h3>Criteria strength</h3>${s.criteria_strength.map(c => `<div class="crit"><div class="row"><b>${esc(c.name)}</b><span class="sp"></span><b>${c.pct}%</b></div>${bar(c.pct)}</div>`).join('')}</div></div>` : '<div class="card empty">Run a few reviews to see analytics.</div>');
  animateRings();
};

pages.integrity = async () => {
  app.innerHTML = head(t('integrityTitle'), 'Finds pairs of answers to the same question that share a lot of wording (word 3-gram overlap). A high match is a prompt to look closer, not proof of copying.') +
    `<div class="card" style="margin-bottom:18px"><label>Minimum similarity: <b id="tv">60%</b></label><input class="range" id="th" type="range" min="30" max="95" value="60"></div><div id="res"></div>`;
  let timer;
  const load = async () => {
    const th = +$('#th').value / 100; $('#tv').textContent = Math.round(th * 100) + '%';
    const ps = await api('/similarity?threshold=' + th);
    $('#res').innerHTML = ps.length ? ps.map(p => `<div class="card" style="margin-bottom:14px"><div class="row"><b>${esc(p.a.student)} &harr; ${esc(p.b.student)}</b>${p.same_student ? '<span class="tag t-info">Same student</span>' : ''}<span class="sp"></span><b style="color:var(--bad)">${Math.round(p.similarity * 100)}% similar</b></div>
      <div class="simbar" style="margin:8px 0"><i style="width:${p.similarity * 100}%"></i></div>
      <div class="side"><div><small>#${p.a.id} ${esc(p.a.student)}</small><pre>${esc(p.a.answer)}</pre></div><div><small>#${p.b.id} ${esc(p.b.student)}</small><pre>${esc(p.b.answer)}</pre></div></div></div>`).join('')
      : '<div class="card empty">No pairs reach this similarity. Lower the slider to look wider.</div>';
  };
  $('#th').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 150); }; load();
};

pages.questions = async () => {
  const qs = await api('/questions');
  app.innerHTML = head(t('questionsTitle'), 'Questions use weighted criteria. Scores are normalised to /10.') +
  `<div class="grid ${isT() ? 'g2' : ''}"><div class="card"><h2>Existing</h2>${qs.map(q => `<div class="crit"><div class="row"><b>${esc(q.title)}</b><span class="sp"></span>${isT() ? `<button class="btn sm ghost" data-del="${q.id}">Delete</button>` : ''}</div>
    <small>${esc(q.text)}</small><div style="margin-top:6px">${q.criteria.map(c => `<span class="tag t-info" style="margin:2px">${esc(c.name)} ${c.max_points}</span>`).join('')}</div></div>`).join('')}</div>
  ${isT() ? `<div class="card"><h2>New question</h2><label>Title</label><input id="nt"><label>Question text</label><textarea id="nx" style="min-height:90px"></textarea>
  <label>Rubric criteria</label><div id="cr"></div><div class="row" style="margin-top:8px"><button class="btn sm sec" id="addc">+ Add criterion</button></div>
  <button class="btn" id="save" style="margin-top:18px">Save question</button></div>` : ''}</div>`;
  if (!isT()) return;
  const cr = $('#cr'), add = (n = '', m = 3, d = '') => { const row = document.createElement('div'); row.className = 'crit-row';
    row.innerHTML = `<input placeholder="Criterion" value="${esc(n)}"><input type="number" min="1" max="20" value="${m}"><input placeholder="What a good answer includes" value="${esc(d)}"><button class="btn sm ghost">x</button>`;
    row.querySelector('button').onclick = () => row.remove(); cr.appendChild(row); };
  add(); add(); $('#addc').onclick = () => add();
  $('#save').onclick = async () => {
    const criteria = $$('.crit-row', cr).map(r => { const i = $$('input', r); return {name: i[0].value.trim(), max_points: +i[1].value, description: i[2].value.trim()}; }).filter(c => c.name);
    try { await api('/questions', {method: 'POST', body: {title: $('#nt').value.trim(), text: $('#nx').value.trim(), criteria}}); toast('Question saved'); pages.questions(); }
    catch (e) { toast('Could not save: check the title, text and at least one criterion'); }
  };
  $$('[data-del]').forEach(b => b.onclick = async () => { try { await api('/questions/' + b.dataset.del, {method: 'DELETE'}); pages.questions(); } catch (e) { toast(e.message); } });
};

pages.about = async () => {
  const w = await api('/workflow'), H = S.health;
  app.innerHTML = head(t('aboutTitle'), 'A LangGraph workflow, built from the teacher\'s original design.', '<button class="btn sec" id="tourgo">Start guided tour</button>') +
  `<div class="card"><div class="pipe"><div class="node on"><b>START</b><br><small>Student answer enters the graph</small></div><span class="arrow">&rarr;</span>
    <div class="node on"><b>1. ${w.nodes[0].label}</b><br><small>${esc(w.nodes[0].desc)}</small></div><span class="arrow">&rarr;</span>
    <div class="node"><b>2. ${w.nodes[1].label}</b><br><small>${esc(w.nodes[1].desc)}</small></div><span class="arrow">&rarr;</span>
    <div style="display:flex;flex-direction:column;gap:10px;flex:1"><div class="node"><b>3a. ${w.nodes[2].label}</b><br><small>${esc(w.nodes[2].desc)}</small></div><div class="node"><b>3b. ${w.nodes[3].label}</b><br><small>${esc(w.nodes[3].desc)}</small></div></div></div></div>
  <div class="grid g3" style="margin-top:18px"><div class="card"><h3>LangChain</h3><p class="sub" style="margin:0">Prompt template + Groq model with structured output (rubric scores, feedback, improvement).</p></div>
  <div class="card"><h3>LangGraph</h3><p class="sub" style="margin:0">State graph with a conditional edge: borderline scores go to teacher review.</p></div>
  <div class="card"><h3>LangSmith</h3><p class="sub" style="margin:0">${H.tracing ? `Tracing is ON (project <b>${esc(H.langsmith_project)}</b>).` : 'Tracing is OFF. Add LANGSMITH_API_KEY and set LANGSMITH_TRACING=true in .env.'} Teacher decisions are attached to runs as feedback.</p></div></div>
  <div class="card" style="margin-top:18px"><h3>Runtime</h3><p class="sub" style="margin:0">Mode: <b>${H.mode === 'demo' ? 'Demo grader (no GROQ_API_KEY)' : 'Groq - ' + esc(H.model)}</b></p></div>`;
  $('#tourgo').onclick = startTour;
};

/* ------------------------------------------------------------------ router */
const TEACHER_PAGES = new Set(['batch', 'queue', 'integrity', 'dashboard']);
async function route() {
  const {name} = currentRoute();
  if (!S.me && name !== 'login') { location.hash = '#/login'; return; }
  if (S.me && TEACHER_PAGES.has(name) && !isT()) { toast('That page is for teachers.'); location.hash = '#/'; return; }
  setActive();
  app.innerHTML = skeleton(2);
  try { await (pages[name] || pages.home)(); } catch (e) { if (e.message !== 'Please log in') app.innerHTML = `<div class="card empty" style="color:var(--bad)">${esc(e.message)}</div>`; }
  if (name !== 'history' || !currentRoute().params.get('open')) window.scrollTo(0, 0);
  animateRings(app);
}
(async () => {
  const th = localStorage.getItem('theme'); if (th) document.documentElement.dataset.theme = th;
  applyLang();
  $('#theme').onclick = toggleTheme; $('#lang').onclick = toggleLang; $('#cmdk').onclick = openPalette; $('#help').onclick = openHelp;
  try { S.health = await api('/health'); } catch {}
  const p = $('#modepill'); p.textContent = S.health.mode === 'groq' ? 'Live - Groq' : 'Demo mode'; p.className = 'pill ' + (S.health.mode === 'groq' ? 'live' : 'demo');
  try { S.me = await api('/auth/me'); } catch { S.me = null; }
  renderNav(); refreshBadge();
  window.addEventListener('hashchange', route); route();
})();
