(() => {
  'use strict';

  const { extractCode, decodeCrosshairCode, toCommands } = window.CrosshairCode;

  const codeEl     = document.getElementById('code');
  const pasteBtn   = document.getElementById('paste');
  const stateEl    = document.getElementById('state');
  const resultEl   = document.getElementById('result');
  const cmdsEl     = document.getElementById('commands');
  const copyBtn    = document.getElementById('copy');
  const settingsEl = document.getElementById('settings');
  const canvas     = document.getElementById('canvas');
  const zoomEl     = document.getElementById('zoom');
  const layoutBtns = Array.from(document.querySelectorAll('[data-layout]'));

  const EMPTY_MSG = 'Paste a crosshair share code to convert it.';

  const STYLES = {
    0: 'Default',
    1: 'Default static',
    2: 'Classic',
    3: 'Classic dynamic',
    4: 'Classic static',
    5: 'Legacy',
  };

  const BOOLS = new Set([
    'cl_crosshair_recoil',
    'cl_crosshair_drawoutline',
    'cl_crosshairdot',
    'cl_crosshair_t',
  ]);

  let settings = null;
  let layout = 'line';   // 'line' (one line, "; "-joined) | 'lines' (one per line, for autoexec.cfg)

  function commandsText() {
    return layout === 'lines'
      ? toCommands(settings, ';\n') + ';'
      : toCommands(settings, '; ');
  }

  function showState(msg, isError) {
    stateEl.textContent = msg;
    stateEl.classList.toggle('error', !!isError);
    stateEl.hidden = false;
    resultEl.hidden = true;
    codeEl.classList.toggle('invalid', !!isError);
    settings = null;
  }

  function convert(raw, { updateHash = true } = {}) {
    const text = raw.trim();

    if (!text) {
      showState(EMPTY_MSG, false);
      if (updateHash) history.replaceState(null, '', location.pathname);
      return;
    }

    const code = extractCode(text);

    try {
      settings = decodeCrosshairCode(code || text);
    } catch (err) {
      showState(`Invalid code: ${err.message}.`, true);
      return;
    }

    codeEl.classList.remove('invalid');
    stateEl.hidden = true;
    resultEl.hidden = false;
    if (updateHash && code) history.replaceState(null, '', '#' + code);

    renderCommands();
    renderSettings();
    renderPreview();
  }

  function renderCommands() {
    cmdsEl.textContent = commandsText();
  }

  function renderSettings() {
    const frag = document.createDocumentFragment();
    const s = settings;

    for (const [name, value] of Object.entries(s)) {
      const tr = document.createElement('tr');
      const k = document.createElement('td');
      const v = document.createElement('td');
      k.textContent = name;

      if (name === 'cl_crosshaircolor_r') {
        const sw = document.createElement('span');
        sw.className = 'swatch';
        sw.style.background = `rgba(${s.cl_crosshaircolor_r}, ${s.cl_crosshaircolor_g}, ${s.cl_crosshaircolor_b}, ${s.cl_crosshaircolor_a / 255})`;
        v.append(sw);
      }
      v.append(String(value));

      let hint = '';
      if (name === 'cl_crosshairstyle') hint = STYLES[value] || '';
      else if (BOOLS.has(name)) hint = value ? 'on' : 'off';
      if (hint) {
        const h = document.createElement('span');
        h.className = 'hint';
        h.textContent = hint;
        v.append(h);
      }

      tr.append(k, v);
      frag.append(tr);
    }

    settingsEl.replaceChildren(frag);
  }

  // Draws the static crosshair shape. Geometry is in native screen pixels,
  // centred on the origin, then blown up by an integer zoom so it stays crisp.
  function renderPreview() {
    const s = settings;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const mid = size / 2;

    // Checkerboard so both dark and bright colours (and alpha) stay visible.
    const cell = 12;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        ctx.fillStyle = ((x + y) / cell) % 2 ? '#3b4148' : '#434a52';
        ctx.fillRect(x, y, cell, cell);
      }
    }

    const t = s.cl_crosshair_thickness;
    const gap = s.cl_crosshair_gap;
    const len = s.cl_crosshair_length;
    const lo = -Math.floor(t / 2);   // thickness band is [lo, hi)
    const hi = lo + t;

    // Rects as [x0, y0, x1, y1), half-open.
    const rects = [];
    if (t > 0 && len > 0) {
      rects.push([hi + gap, lo, hi + gap + len, hi]);          // right
      rects.push([lo - gap - len, lo, lo - gap, hi]);          // left
      rects.push([lo, hi + gap, hi, hi + gap + len]);          // bottom
      if (!s.cl_crosshair_t) rects.push([lo, lo - gap - len, hi, lo - gap]); // top
    }
    if (s.cl_crosshairdot && t > 0) rects.push([lo, lo, hi, hi]);

    const outline = s.cl_crosshair_drawoutline ? 1 : 0;
    const extent = Math.max(1, hi + gap + len + outline);
    const zoom = Math.max(1, Math.min(12, Math.floor((mid - 10) / extent)));
    zoomEl.textContent = rects.length ? `${zoom}× zoom` : 'nothing to draw';

    const alpha = s.cl_crosshaircolor_a / 255;
    const draw = ([x0, y0, x1, y1], grow) => {
      ctx.fillRect(
        mid + (x0 - grow) * zoom,
        mid + (y0 - grow) * zoom,
        (x1 - x0 + 2 * grow) * zoom,
        (y1 - y0 + 2 * grow) * zoom,
      );
    };

    // Outlines first so neighbouring shapes' outlines don't cover their fills.
    if (outline) {
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      rects.forEach((r) => draw(r, 1));
    }
    ctx.fillStyle = `rgba(${s.cl_crosshaircolor_r}, ${s.cl_crosshaircolor_g}, ${s.cl_crosshaircolor_b}, ${alpha})`;
    rects.forEach((r) => draw(r, 0));
  }

  function flash(btn, label) {
    const orig = btn.dataset.label || (btn.dataset.label = btn.textContent);
    btn.textContent = label;
    btn.classList.add('done');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('done');
    }, 1200);
  }

  copyBtn.addEventListener('click', async () => {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(commandsText());
      flash(copyBtn, 'Copied');
    } catch {
      // Clipboard API unavailable: select the text so ctrl+c works.
      const range = document.createRange();
      range.selectNodeContents(cmdsEl);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      flash(copyBtn, 'Press Ctrl+C');
    }
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      codeEl.value = extractCode(text) || text.trim();
      convert(codeEl.value);
    } catch {
      codeEl.focus();
      codeEl.select();
    }
  });

  layoutBtns.forEach((btn) => btn.addEventListener('click', () => {
    layout = btn.dataset.layout;
    layoutBtns.forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    if (settings) renderCommands();
  }));

  codeEl.addEventListener('input', () => convert(codeEl.value));

  // Share links: crosshair.laine.lol/#CSGO-xxxxx-...
  function loadHash() {
    let hash = location.hash.slice(1);
    try { hash = decodeURIComponent(hash); } catch { /* malformed %-escape: use as-is */ }
    const code = extractCode(hash);
    if (!code) return;
    codeEl.value = code;
    convert(code, { updateHash: false });
  }
  window.addEventListener('hashchange', loadHash);
  loadHash();
})();
