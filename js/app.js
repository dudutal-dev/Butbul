/* ספר אזכרה – לוגיקת האפליקציה */
(function () {
  'use strict';

  const STORAGE_KEY = 'azkara.settings.v1';
  const IMG_PREFIX = 'azkara.img.';
  // תמונות ברירת מחדל המוטמעות באפליקציה (תמונה שמועלית בהגדרות מחליפה אותן)
  const DEFAULT_IMAGES = { cover: 'images/cover.jpg', father: 'images/father.jpg', mother: 'images/mother.jpg' };

  const DEFAULTS = {
    familyTitle: 'מרגרט ועמרם בוטבול',
    homeDedication: 'לְעִלּוּי נִשְׁמַת הוֹרֵינוּ הַיְּקָרִים',
    father: { name: 'עמרם', gender: 'בן', mother: 'רחל', dedication: '' },
    mother: { name: 'מרגרט', gender: 'בת', mother: 'רחל', dedication: '' },
    customChapters: false,
    keepAwake: true,
    fontSize: 'md'
  };

  let settings = loadSettings();
  let history = [];
  let wakeLock = null;

  /* ---------- כלי עזר ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      const s = JSON.parse(raw);
      return {
        ...DEFAULTS, ...s,
        father: { ...DEFAULTS.father, ...(s.father || {}) },
        mother: { ...DEFAULTS.mother, ...(s.mother || {}) }
      };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
  }
  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
  function getImage(key) { try { return localStorage.getItem(IMG_PREFIX + key); } catch (e) { return null; } }
  function setImage(key, dataUrl) {
    try {
      if (dataUrl) localStorage.setItem(IMG_PREFIX + key, dataUrl);
      else localStorage.removeItem(IMG_PREFIX + key);
      return true;
    } catch (e) {
      toast('אין מספיק מקום לשמירת התמונה. נסו תמונה קטנה יותר.');
      return false;
    }
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // מספר → אותיות בגימטריה (1–999)
  function hebNum(n) {
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
    let s = hundreds[Math.floor(n / 100)];
    const rem = n % 100;
    if (rem === 15) s += 'טו';
    else if (rem === 16) s += 'טז';
    else s += tens[Math.floor(rem / 10)] + ones[rem % 10];
    if (s.length === 1) return s + '׳';
    return s.slice(0, -1) + '״' + s.slice(-1);
  }

  // אותיות עבריות בלבד, אותיות סופיות → רגילות
  function lettersOf(str) {
    const out = [];
    for (const ch of String(str || '')) {
      const base = window.FINAL_MAP[ch] || ch;
      if (window.ALEF_BET.includes(base)) out.push(base);
    }
    return out;
  }

  function nameLine(p) {
    if (!p.name) return '';
    return p.mother ? `${p.name} ${p.gender} ${p.mother}` : p.name;
  }

  // רצף הקריאה: שם פרטי, בן/בת, שם האם, נשמה
  function letterGroups(p) {
    if (!lettersOf(p.name).length) return [];
    return [
      { label: p.name, letters: lettersOf(p.name) },
      { label: p.gender, letters: lettersOf(p.gender) },
      { label: p.mother, letters: lettersOf(p.mother) },
      { label: 'נשמה', letters: lettersOf('נשמה') }
    ].filter((g) => g.letters.length);
  }

  function placeholder(icon, text) {
    return `<div class="placeholder"><svg><use href="#${icon}"/></svg><span>${esc(text || '')}</span></div>`;
  }
  function imgOrPlaceholder(key, icon, text, alt) {
    const src = getImage(key) || DEFAULT_IMAGES[key];
    return src ? `<img src="${src}" alt="${esc(alt || '')}">` : placeholder(icon, text);
  }
  // תמונה בתוך מסגרת זהב, בגודלה המלא (ללא חיתוך)
  function framed(key, icon, text, alt) {
    const src = getImage(key) || DEFAULT_IMAGES[key];
    return src ? `<div class="frame"><img src="${src}" alt="${esc(alt || '')}"></div>` : `<div class="frame">${placeholder(icon, text)}</div>`;
  }

  /* ---------- ניווט ---------- */
  function go(route, replace) {
    if (!replace && location.hash.slice(1) !== route) {
      location.hash = route;
      return;
    }
    render(route);
  }
  function back() {
    if (history.length > 1) { history.pop(); location.hash = history.pop(); }
    else location.hash = 'home';
  }
  window.addEventListener('hashchange', () => render(location.hash.slice(1) || 'home'));

  function showScreen(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + id));
    window.scrollTo(0, 0);
    if (id === 'read' || id === 'psalm' || id === 'kaddish') requestWakeLock(); else releaseWakeLock();
  }

  function render(route) {
    const [name, arg, arg2] = route.split('/');
    if (history[history.length - 1] !== route) history.push(route);
    if (history.length > 40) history.shift();
    switch (name) {
      case 'parent': renderParent(arg === 'mother' ? 'mother' : 'father'); break;
      case 'read': renderRead(arg === 'mother' ? 'mother' : 'father', parseInt(arg2, 10) || 0); break;
      case 'tehillim': renderTehillim(); break;
      case 'psalm': renderPsalm(parseInt(arg, 10) || 1); break;
      case 'kaddish': renderKaddish(); break;
      case 'settings': renderSettings(); break;
      default: renderHome();
    }
  }

  /* ---------- מסך ראשי ---------- */
  function renderHome() {
    $('#home-cover').innerHTML = framed('cover', 'i-candle', 'תמונת שער – ניתן להוסיף בהגדרות', 'תמונת ההורים');
    $('#home-title').textContent = settings.familyTitle || '';
    $('#home-dedication').textContent = settings.homeDedication || '';
    for (const k of ['father', 'mother']) {
      $('#home-avatar-' + k).innerHTML = imgOrPlaceholder(k, 'i-person', '', k === 'father' ? 'אבא' : 'אמא');
      $('#home-name-' + k).textContent = nameLine(settings[k]) || 'הוסיפו שם בהגדרות';
    }
    showScreen('home');
  }

  /* ---------- עמוד הורה ---------- */
  function renderParent(key) {
    const p = settings[key];
    const role = key === 'father' ? 'אבא' : 'אמא';
    $('#parent-title').textContent = role;
    $('#parent-hero').innerHTML = framed(key, 'i-person', 'ניתן להוסיף תמונה בהגדרות', role);
    $('#parent-role').textContent = key === 'father' ? 'אבינו היקר' : 'אמנו היקרה';
    $('#parent-name').textContent = nameLine(p) || 'יש להזין שם בהגדרות';
    const ded = $('#parent-dedication');
    ded.textContent = p.dedication || 'כאן ניתן לכתוב הקדשה אישית (בהגדרות)';
    ded.classList.toggle('empty', !p.dedication);

    const steps = buildSteps(p);
    const map = $('#parent-letters');
    let html = '', i = 0, groupHtml = '', curGroup = null;
    const flush = () => { if (curGroup !== null) html += `<div class="letters-group"><div class="glabel">${esc(curGroup)}</div>${groupHtml}</div>`; groupHtml = ''; };
    steps.forEach((st, idx) => {
      if (st.group !== curGroup) { flush(); curGroup = st.group; }
      if (st.type === 'kaddish') groupHtml += `<button class="letter-chip kaddish" data-step="${idx}">קדיש</button>`;
      else groupHtml += `<button class="letter-chip" data-step="${idx}" aria-label="${esc(st.title)}">${esc(st.chip)}</button>`;
      i++;
    });
    flush();
    map.innerHTML = html;
    map.onclick = (e) => { const b = e.target.closest('[data-step]'); if (b) go(`read/${key}/${b.dataset.step}`); };
    $('#parent-start').onclick = () => go('read/' + key + '/0');
    showScreen('parent');
  }

  /* ---------- קריאה מלאה ---------- */
  function versesHtml(chapterIdx, from, to) {
    const ch = window.TEHILLIM[chapterIdx];
    const a = from == null ? 0 : from, b = to == null ? ch.length : to;
    let html = '';
    for (let i = a; i < b; i++) {
      html += `<li class="verse"><span class="num">${hebNum(i + 1)}</span>${esc(ch[i])}</li>`;
    }
    return html;
  }

  function kaddishHtml() {
    const k = window.KADDISH;
    return `<div class="card kaddish">
      ${k.paragraphs.map((p) => `<p class="${p.emphasis ? 'emph' : ''}">${esc(p.text)}${p.response ? `<span class="resp">(${esc(p.response)})</span>` : ''}</p>`).join('')}
      <div class="note">${esc(k.note)}</div>
    </div>`;
  }

  // בניית עמודי הקריאה: (פרקים מקובלים) → אותיות השם → נשמה → קדיש
  function buildSteps(p) {
    const steps = [];
    if (settings.customChapters) {
      window.CUSTOM_CHAPTERS.forEach((n) => steps.push({
        type: 'chapter', group: 'תהילים', chip: hebNum(n), title: `תהילים ${hebNum(n)}`,
        html: `<div class="section-head"><div class="kicker">תהילים</div><h2>פֶּרֶק ${hebNum(n)}</h2></div>
               <div class="card"><ol class="verses">${versesHtml(n - 1)}</ol></div>`
      }));
    }
    const groups = letterGroups(p);
    const total = groups.reduce((a, g) => a + g.letters.length, 0);
    let count = 0;
    groups.forEach((g) => {
      g.letters.forEach((l) => {
        count++;
        const idx = window.ALEF_BET.indexOf(l);
        steps.push({
          type: 'letter', group: g.label, chip: l, title: `אות ${l}׳ – ${g.label}`,
          html: `<div class="section-head"><div class="kicker">מזמור קי"ט</div><h2>${esc(g.label)}</h2></div>
            <div class="card">
              <div class="letter-head">
                <span class="big">${l}</span>
                <div class="meta">
                  <div class="lname">${esc(window.LETTER_NAMES[l])}</div>
                  <div class="lof">אות ${count} מתוך ${total}</div>
                </div>
              </div>
              <ol class="verses">${versesHtml(118, idx * 8, idx * 8 + 8)}</ol>
            </div>`
        });
      });
    });
    steps.push({
      type: 'kaddish', group: 'סיום', chip: 'קדיש', title: 'קדיש יתום',
      html: `<div class="section-head"><div class="kicker">${esc(window.KADDISH.subtitle)}</div><h2>${esc(window.KADDISH.title)}</h2></div>${kaddishHtml()}
             <div class="end-note">תְּהֵא נִשְׁמָת${p.gender === 'בת' ? 'הּ' : 'וֹ'} צְרוּרָה בִּצְרוֹר הַחַיִּים<br>ת.נ.צ.ב.ה</div>`
    });
    return steps;
  }

  let readCtx = null;
  function renderRead(key, idx) {
    const p = settings[key];
    const steps = buildSteps(p);
    if (!lettersOf(p.name).length) {
      steps.unshift({ type: 'empty', group: '', chip: '', title: 'חסר שם',
        html: `<div class="card" style="text-align:center;color:var(--muted)">לא הוזן שם. יש להזין שם פרטי ושם האם במסך ההגדרות.</div>` });
    }
    idx = Math.max(0, Math.min(steps.length - 1, idx || 0));
    readCtx = { key, idx, n: steps.length };
    const st = steps[idx];

    $('#read-title').textContent = st.title;
    $('#read-counter').textContent = `${nameLine(p) || (key === 'father' ? 'אבא' : 'אמא')} · עמוד ${idx + 1} מתוך ${steps.length}`;
    $('#read-progress').style.width = ((idx + 1) / steps.length * 100) + '%';
    const body = $('#read-body');
    body.innerHTML = st.html;
    body.classList.remove('page-enter'); void body.offsetWidth; body.classList.add('page-enter');

    const prev = $('#read-prev'), next = $('#read-next');
    prev.disabled = idx === 0;
    const last = idx === steps.length - 1;
    next.classList.toggle('finish', last);
    next.querySelector('span').textContent = last ? 'סיום' : (steps[idx + 1].type === 'kaddish' ? 'לקדיש' : 'הבא');
    prev.onclick = () => go(`read/${key}/${idx - 1}`);
    next.onclick = () => last ? go('parent/' + key) : go(`read/${key}/${idx + 1}`);

    const dots = $('#read-dots');
    if (steps.length <= 24) dots.innerHTML = steps.map((_, i) => `<i class="${i < idx ? 'done' : ''}${i === idx ? 'cur' : ''}"></i>`).join('');
    else dots.innerHTML = '';

    showScreen('read');
  }

  // דפדוף במקלדת ובהחלקת אצבע
  document.addEventListener('keydown', (e) => {
    if (!readCtx || !$('#screen-read').classList.contains('active')) return;
    if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); $('#read-next').click(); }
    if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); $('#read-prev').click(); }
  });
  let touchX = null, touchY = null;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; touchX = (t.clientX > 24 && t.clientX < window.innerWidth - 24) ? t.clientX : null; touchY = t.clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (touchX == null || !readCtx || !$('#screen-read').classList.contains('active')) return;
    const t = e.changedTouches[0], dx = t.clientX - touchX, dy = t.clientY - touchY;
    touchX = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx)) return;
    // בעברית: החלקה שמאלה = קדימה
    if (dx < 0) $('#read-next').click(); else if (!$('#read-prev').disabled) $('#read-prev').click();
  }, { passive: true });

  /* ---------- תהילים ---------- */
  function renderTehillim() {
    const grid = $('#chapters-grid');
    if (!grid.childElementCount) {
      grid.innerHTML = window.TEHILLIM.map((_, i) => `<button data-ch="${i + 1}">${hebNum(i + 1)}</button>`).join('');
      grid.onclick = (e) => {
        const b = e.target.closest('button[data-ch]');
        if (b) go('psalm/' + b.dataset.ch);
      };
      $('#chapter-go').onclick = openTyped;
      $('#chapter-input').onkeydown = (e) => { if (e.key === 'Enter') openTyped(); };
    }
    showScreen('tehillim');
  }
  function openTyped() {
    const n = parseInt($('#chapter-input').value, 10);
    if (n >= 1 && n <= 150) go('psalm/' + n); else toast('יש להזין מספר בין 1 ל-150');
  }

  function renderPsalm(n) {
    n = Math.min(150, Math.max(1, n));
    $('#psalm-title').textContent = `תהילים פרק ${hebNum(n)}`;
    $('#psalm-verses').innerHTML = versesHtml(n - 1);
    $('#psalm-prev').disabled = n <= 1;
    $('#psalm-next').disabled = n >= 150;
    $('#psalm-prev').onclick = () => go('psalm/' + (n - 1));
    $('#psalm-next').onclick = () => go('psalm/' + (n + 1));
    showScreen('psalm');
  }

  /* ---------- קדיש ---------- */
  function renderKaddish() {
    $('#kaddish-body').innerHTML = `<div class="section">
      <div class="section-head"><div class="kicker">${esc(window.KADDISH.subtitle)}</div><h2>${esc(window.KADDISH.title)}</h2></div>
      ${kaddishHtml()}</div>`;
    showScreen('kaddish');
  }

  /* ---------- הגדרות ---------- */
  function renderSettings() {
    $('#s-familyTitle').value = settings.familyTitle || '';
    $('#s-homeDedication').value = settings.homeDedication || '';
    for (const k of ['father', 'mother']) {
      $(`#s-${k}-name`).value = settings[k].name || '';
      $(`#s-${k}-gender`).value = settings[k].gender || (k === 'father' ? 'בן' : 'בת');
      $(`#s-${k}-mother`).value = settings[k].mother || '';
      $(`#s-${k}-dedication`).value = settings[k].dedication || '';
      updatePreview(k);
    }
    $('#s-customChapters').checked = !!settings.customChapters;
    $('#s-keepAwake').checked = !!settings.keepAwake;
    refreshThumbs();
    showScreen('settings');
  }
  function refreshThumbs() {
    for (const k of ['cover', 'father', 'mother']) {
      $('#thumb-' + k).innerHTML = imgOrPlaceholder(k, k === 'cover' ? 'i-candle' : 'i-person');
    }
  }
  function updatePreview(k) {
    const p = {
      name: $(`#s-${k}-name`).value.trim(),
      gender: $(`#s-${k}-gender`).value,
      mother: $(`#s-${k}-mother`).value.trim()
    };
    const letters = letterGroups(p).map((g) => g.letters.join(' ')).join(' · ');
    $('#preview-' + k).textContent = p.name ? `${nameLine(p)} — אותיות: ${letters}` : '';
  }
  function readSettingsForm() {
    settings.familyTitle = $('#s-familyTitle').value.trim();
    settings.homeDedication = $('#s-homeDedication').value.trim();
    for (const k of ['father', 'mother']) {
      settings[k] = {
        name: $(`#s-${k}-name`).value.trim(),
        gender: $(`#s-${k}-gender`).value,
        mother: $(`#s-${k}-mother`).value.trim(),
        dedication: $(`#s-${k}-dedication`).value.trim()
      };
    }
    settings.customChapters = $('#s-customChapters').checked;
    settings.keepAwake = $('#s-keepAwake').checked;
    saveSettings();
  }

  // תמונות: הקטנה ודחיסה לפני שמירה
  let pickTarget = null;
  function pickImage(key) {
    pickTarget = key;
    const inp = $('#file-input');
    inp.value = '';
    inp.click();
  }
  $('#file-input').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !pickTarget) return;
    const key = pickTarget;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = key === 'cover' ? 1400 : 1100;
        let w = img.width, h = img.height;
        const scale = Math.min(1, MAX / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        let q = 0.85, data = c.toDataURL('image/jpeg', q);
        while (data.length > 900000 && q > 0.4) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
        if (setImage(key, data)) { refreshThumbs(); toast('התמונה נשמרה'); }
      };
      img.onerror = () => toast('לא ניתן לקרוא את התמונה');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  /* ---------- גודל גופן ---------- */
  function applyFont() {
    document.body.classList.remove('font-lg', 'font-xl');
    if (settings.fontSize === 'lg') document.body.classList.add('font-lg');
    if (settings.fontSize === 'xl') document.body.classList.add('font-xl');
    $$('[data-font]').forEach((b) => b.classList.toggle('on', b.dataset.font === settings.fontSize));
  }

  /* ---------- מסך דולק ---------- */
  async function requestWakeLock() {
    if (!settings.keepAwake || !('wakeLock' in navigator) || wakeLock) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch (e) { wakeLock = null; }
  }
  function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && $('.screen.active') && ['screen-read', 'screen-psalm', 'screen-kaddish'].includes($('.screen.active').id)) requestWakeLock();
  });

  /* ---------- אירועים כלליים ---------- */
  document.addEventListener('click', (e) => {
    const goEl = e.target.closest('[data-go]');
    if (goEl) { go(goEl.dataset.go); return; }
    if (e.target.closest('[data-read-exit]')) { go('parent/' + (readCtx ? readCtx.key : 'father')); return; }
    if (e.target.closest('[data-back]')) { back(); return; }
    const f = e.target.closest('[data-font]');
    if (f) { settings.fontSize = f.dataset.font; saveSettings(); applyFont(); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) { pickImage(pick.dataset.pick); return; }
    const clr = e.target.closest('[data-clear]');
    if (clr) { if (getImage(clr.dataset.clear) && confirm('להסיר את התמונה שהועלתה ולחזור לתמונה המקורית?')) { setImage(clr.dataset.clear, null); refreshThumbs(); } return; }
  });
  ['father', 'mother'].forEach((k) => {
    ['name', 'gender', 'mother'].forEach((f) => $(`#s-${k}-${f}`).addEventListener('input', () => updatePreview(k)));
  });
  $('#settings-save').addEventListener('click', () => {
    readSettingsForm();
    toast('ההגדרות נשמרו');
    setTimeout(() => go('home'), 350);
  });

  /* ---------- אתחול ---------- */
  applyFont();
  render(location.hash.slice(1) || 'home');

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((reg) => { reg.update().catch(() => {}); }).catch(() => {}));
    // רענון אוטומטי פעם אחת כשגרסה חדשה של האפליקציה נכנסת לתוקף (לא בהתקנה הראשונה)
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return;
      reloaded = true; location.reload();
    });
  }
})();
