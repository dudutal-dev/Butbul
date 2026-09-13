/* ספר אזכרה – לוגיקת האפליקציה */
(function () {
  'use strict';

  const STORAGE_KEY = 'azkara.settings.v1';
  const IMG_PREFIX = 'azkara.img.';

  const DEFAULTS = {
    familyTitle: 'לְעִלּוּי נִשְׁמַת הוֹרֵינוּ הַיְּקָרִים',
    homeDedication: '',
    father: { name: 'עמרם', gender: 'בן', mother: 'רחל', dedication: '' },
    mother: { name: '', gender: 'בת', mother: '', dedication: '' },
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
  function imgOrPlaceholder(key, icon, text) {
    const src = getImage(key);
    return src ? `<img src="${src}" alt="">` : placeholder(icon, text);
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
    const [name, arg] = route.split('/');
    if (history[history.length - 1] !== route) history.push(route);
    if (history.length > 40) history.shift();
    switch (name) {
      case 'parent': renderParent(arg === 'mother' ? 'mother' : 'father'); break;
      case 'read': renderRead(arg === 'mother' ? 'mother' : 'father'); break;
      case 'tehillim': renderTehillim(); break;
      case 'psalm': renderPsalm(parseInt(arg, 10) || 1); break;
      case 'kaddish': renderKaddish(); break;
      case 'settings': renderSettings(); break;
      default: renderHome();
    }
  }

  /* ---------- מסך ראשי ---------- */
  function renderHome() {
    $('#home-cover').innerHTML = imgOrPlaceholder('cover', 'i-candle', 'תמונת שער – ניתן להוסיף בהגדרות');
    $('#home-title').textContent = settings.familyTitle || '';
    $('#home-dedication').textContent = settings.homeDedication || '';
    for (const k of ['father', 'mother']) {
      $('#home-avatar-' + k).innerHTML = imgOrPlaceholder(k, 'i-person');
      $('#home-name-' + k).textContent = nameLine(settings[k]) || 'הוסיפו שם בהגדרות';
    }
    showScreen('home');
  }

  /* ---------- עמוד הורה ---------- */
  function renderParent(key) {
    const p = settings[key];
    const role = key === 'father' ? 'אבא' : 'אמא';
    $('#parent-title').textContent = role;
    $('#parent-hero').innerHTML = imgOrPlaceholder(key, 'i-person', 'ניתן להוסיף תמונה בהגדרות');
    $('#parent-role').textContent = key === 'father' ? 'אבינו היקר' : 'אמנו היקרה';
    $('#parent-name').textContent = nameLine(p) || 'יש להזין שם בהגדרות';
    const ded = $('#parent-dedication');
    ded.textContent = p.dedication || 'כאן ניתן לכתוב הקדשה אישית (בהגדרות)';
    ded.classList.toggle('empty', !p.dedication);

    const groups = letterGroups(p);
    $('#parent-letters').innerHTML = groups.map((g, i) =>
      (i ? '<span class="letter-chip sep">·</span>' : '') +
      g.letters.map((l) => `<span class="letter-chip">${l}</span>`).join('')
    ).join('');
    $('#parent-start').onclick = () => go('read/' + key);
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

  function renderRead(key) {
    const p = settings[key];
    const role = key === 'father' ? 'אבא' : 'אמא';
    $('#read-title').textContent = nameLine(p) || role;
    const groups = letterGroups(p);
    const sections = [];

    if (settings.customChapters) {
      window.CUSTOM_CHAPTERS.forEach((n) => {
        sections.push({
          title: `פרק ${hebNum(n)}`, short: `פרק ${hebNum(n)}`,
          html: `<div class="section-head"><div class="kicker">תהילים</div><h2>פֶּרֶק ${hebNum(n)}</h2></div>
                 <div class="card"><ol class="verses">${versesHtml(n - 1)}</ol></div>`
        });
      });
    }

    if (groups.length) {
      const total = groups.reduce((s, g) => s + g.letters.length, 0);
      let count = 0;
      groups.forEach((g) => {
        g.letters.forEach((l, li) => {
          count++;
          const idx = window.ALEF_BET.indexOf(l);
          const first = li === 0;
          sections.push({
            title: `אות ${l}׳ – ${g.label}`, short: `אות ${l}׳`,
            html: `${first ? `<div class="group-label"><span>${esc(g.label)}</span></div>` : ''}
              <div class="card">
                <div class="letter-head">
                  <span class="big">${l}</span>
                  <div class="meta">
                    <div class="lname">${esc(window.LETTER_NAMES[l])}</div>
                    <div class="lof">מזמור קי"ט · אות ${count} מתוך ${total}</div>
                  </div>
                </div>
                <ol class="verses">${versesHtml(118, idx * 8, idx * 8 + 8)}</ol>
              </div>`
          });
        });
      });
    } else {
      sections.push({
        title: 'חסר שם', short: 'המשך',
        html: `<div class="card" style="text-align:center;color:var(--muted)">לא הוזן שם. יש להזין שם פרטי ושם האם במסך ההגדרות.</div>`
      });
    }

    sections.push({
      title: 'קדיש יתום', short: 'קדיש',
      html: `<div class="section-head"><div class="kicker">${esc(window.KADDISH.subtitle)}</div><h2>${esc(window.KADDISH.title)}</h2></div>${kaddishHtml()}`
    });

    const body = $('#read-body');
    body.innerHTML = sections.map((s, i) => `<div class="section" id="sec-${i}" data-title="${esc(s.title)}" data-short="${esc(s.short || s.title)}">${s.html}</div>`).join('') +
      `<div class="end-note">תְּהֵא נִשְׁמָת${p.gender === 'בת' ? 'הּ' : 'וֹ'} צְרוּרָה בִּצְרוֹר הַחַיִּים<br>ת.נ.צ.ב.ה</div>`;

    setupReadNav(sections.length);
    showScreen('read');
  }

  function setupReadNav(n) {
    const fab = $('#read-next');
    const prog = $('#read-progress');
    let current = 0;
    const update = () => {
      const secs = $$('#read-body .section');
      const top = 80;
      current = 0;
      secs.forEach((s, i) => { if (s.getBoundingClientRect().top <= top + 10) current = i; });
      prog.style.width = ((current + 1) / n * 100) + '%';
      const last = current >= n - 1;
      fab.classList.toggle('show', !last);
      fab.textContent = last ? '' : (secs[current + 1] ? 'המשך – ' + secs[current + 1].dataset.short + ' ↓' : 'המשך ↓');
    };
    window.onscroll = () => { if ($('#screen-read').classList.contains('active')) update(); };
    fab.onclick = () => {
      const next = $('#sec-' + (current + 1));
      if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    setTimeout(update, 50);
  }

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
    if (e.target.closest('[data-back]')) { back(); return; }
    const f = e.target.closest('[data-font]');
    if (f) { settings.fontSize = f.dataset.font; saveSettings(); applyFont(); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) { pickImage(pick.dataset.pick); return; }
    const clr = e.target.closest('[data-clear]');
    if (clr) { if (getImage(clr.dataset.clear) && confirm('להסיר את התמונה?')) { setImage(clr.dataset.clear, null); refreshThumbs(); } return; }
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
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
