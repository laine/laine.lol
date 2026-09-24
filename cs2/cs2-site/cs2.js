(() => {
  'use strict';

  const filesEl  = document.getElementById('files');
  const stateEl  = document.getElementById('state');
  const statsEl  = document.getElementById('stats');
  const searchEl = document.getElementById('search');
  const sortBtns = Array.from(document.querySelectorAll('.sort [data-sort]'));

  // Matches  YYYY-MM-DD.7z  and  YYYY-MM-DD_HH-MM-SS.7z  (older builds: .zip)
  const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:_(\d{2})-(\d{2})-(\d{2}))?\.(?:7z|zip)$/i;
  const ARCHIVE_RE = /\.(?:7z|zip)$/i;

  // Named CS2 updates, keyed by build date (YYYY-MM-DD). Shown as a badge on any
  // build archived on that date; also searchable via the filter box.
  const LABELS = {
    '2023-09-27': 'Counter-Strike 2 Launch',
    '2024-02-07': 'Kilowatt Case Update',
    '2024-03-21': 'PGL Copenhagen Major',
    '2024-06-25': 'Community Maps Update',
    '2024-10-02': 'The Armory Update',
    '2024-11-14': 'Train Returns Update',
    '2024-12-19': 'Shanghai Major Capsule Update',
    '2025-01-29': 'Premier Season 2 Update',
    '2025-03-31': 'Spring Forward Update',
    '2025-05-08': 'Weekly Missions & Map Groups Update',
    '2025-07-16': 'Premier Season 3 Update',
    '2025-07-28': 'First-Person Animation Update',
    '2025-09-16': 'Genesis / Show Off Update',
    '2025-10-02': 'Armory Charms & Stickers Update',
    '2026-01-21': 'Harlequin & Chroma Armory Update',
    '2026-03-11': 'The Dead Hand Update',
    '2026-04-01': 'Animgraph 2 Beta Update',
    '2026-04-08': 'Thera Map & Weapon Balance Update',
    '2026-04-21': 'Animgraph 2 Live Update',
  };

  const dateFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  });

  let entries = [];
  let sortMode = 'date';   // 'date' (newest) | 'date-asc' (oldest)
  let filter = '';

  function fmtSize(bytes) {
    if (!Number.isFinite(bytes)) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let n = bytes, i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const dp = i === 0 ? 0 : (n < 100 ? 1 : 0);
    return `${n.toFixed(dp)} ${units[i]}`;
  }

  function parse(entry) {
    const m = NAME_RE.exec(entry.name);
    let date = null, hasTime = false, dateKey = null;
    if (m) {
      const [, Y, Mo, D, h, mi, s] = m;
      hasTime = h !== undefined;
      dateKey = `${Y}-${Mo}-${D}`;
      date = new Date(Date.UTC(+Y, +Mo - 1, +D, +(h || 0), +(mi || 0), +(s || 0)));
    }
    return {
      name: entry.name,
      size: typeof entry.size === 'number' ? entry.size : NaN,
      date,
      hasTime,
      dateKey,
      label: (dateKey && LABELS[dateKey]) || '',
      sortKey: entry.name,
    };
  }

  function render() {
    const f = filter.trim().toLowerCase();
    const list = entries.filter((e) => !f
      || e.name.toLowerCase().includes(f)
      || e.label.toLowerCase().includes(f));

    list.sort((a, b) => {
      if (sortMode === 'date-asc') return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
      return a.sortKey > b.sortKey ? -1 : a.sortKey < b.sortKey ? 1 : 0; // newest first
    });

    filesEl.replaceChildren();

    if (list.length === 0) {
      stateEl.textContent = entries.length === 0
        ? 'No files have been uploaded yet.'
        : 'No files match your filter.';
      stateEl.hidden = false;
      return;
    }
    stateEl.hidden = true;

    const frag = document.createDocumentFragment();
    for (const e of list) {
      const li = document.createElement('li');
      li.className = 'file';

      const info = document.createElement('div');
      info.className = 'info';

      const title = document.createElement('span');
      title.className = 'date';
      title.textContent = e.date
        ? (e.hasTime ? dateTimeFmt.format(e.date) : dateFmt.format(e.date))
        : e.name;

      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = `${e.name} · ${fmtSize(e.size)}`;

      const head = document.createElement('div');
      head.className = 'headline';
      head.append(title);
      if (e.label) {
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = e.label;
        head.append(label);
      }
      info.append(head, meta);

      const dl = document.createElement('a');
      dl.className = 'dl';
      dl.href = 'files/' + encodeURIComponent(e.name);
      dl.setAttribute('download', e.name);
      dl.rel = 'noopener';
      dl.textContent = 'Download';

      li.append(info, dl);
      frag.append(li);
    }
    filesEl.append(frag);
  }

  function updateStats() {
    const total = entries.reduce((s, e) => s + (Number.isFinite(e.size) ? e.size : 0), 0);
    statsEl.textContent = entries.length
      ? `${entries.length} file${entries.length === 1 ? '' : 's'} · ${fmtSize(total)} total`
      : '';
  }

  sortBtns.forEach((btn) => btn.addEventListener('click', () => {
    sortMode = btn.dataset.sort;
    sortBtns.forEach((b) => b.classList.toggle('active', b === btn));
    render();
  }));
  searchEl.addEventListener('input', () => { filter = searchEl.value; render(); });

  fetch('files/', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((data) => {
      entries = (Array.isArray(data) ? data : [])
        .filter((e) => e && e.type === 'file' && !e.name.startsWith('.') && ARCHIVE_RE.test(e.name))
        .map(parse);
      updateStats();
      render();
    })
    .catch((err) => {
      stateEl.textContent = 'Could not load the file list. Please try again later.';
      stateEl.hidden = false;
      console.error('cs2: failed to load listing', err);
    });
})();
