'use strict';
// The menu's Backups dialog: save every game's progress to a file or a code, check a
// backup before restoring it (what's in it, next to what you have now), and undo the
// last restore or game reset.

(() => {
  const $ = id => document.getElementById(id);
  const box = $('backups'), opener = $('btn-backups');
  let pending = null;   // a checked backup waiting for "Restore"
  // Shown inside another site (a preview, an embed), the browser may block downloads without a word.
  const framed = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();

  const MESSAGES = {
    'not-backup': "That isn't a Solarian Arcade backup.",
    broken: 'That code is incomplete or damaged. Copy all of it, from SOLARIAN-SAVE to the very end.',
    newer: 'That backup comes from a newer version of the arcade. Update the arcade first.',
    'old-browser': "This browser can't read backup codes. Use a backup file instead.",
    empty: 'That backup has nothing in it.',
    'too-big': "That's too big to be an arcade backup.",
    'no-room': "This browser's storage is full or blocked, so nothing was changed.",
    failed: "This browser's storage is full or blocked, so nothing was changed.",
  };

  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
    const d = Math.round(h / 24);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  const when = t => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const say = (id, text, tone = '') => { const el = $(id); el.textContent = text; el.className = 'bk-msg' + (tone ? ' ' + tone : ''); };

  // ---- Showing what's there ----------------------------------------------------------
  function refresh() {
    const last = Saves.lastSaved();
    $('bk-last').textContent = last ? `LAST SAVED ${ago(last).toUpperCase()}` : 'NEVER SAVED';
    const u = Saves.readUndo();
    $('bk-undo-sec').classList.toggle('hidden', !u);
    if (u) $('bk-undo-what').textContent = `Bring back your progress from ${u.label} (${ago(u.at)}).`;
  }

  function preview(res) {
    if (!res.ok) { pending = null; $('bk-preview').classList.add('hidden'); say('bk-load-msg', MESSAGES[res.error] || MESSAGES.broken, 'bad'); return; }
    pending = res;
    const now = Saves.summary(Saves.collect()), then = Saves.summary(res.keys);
    $('bk-from').textContent = res.saved ? `Backup from ${when(res.saved)}` : 'Backup';
    const rows = [['Coins', 'coins'], ['Road Rush best', 'rr'], ['Traffic Control stars', 'tc'], ['Boom Run best', 'br'], ['Hall of Art explored', 'ha']];
    const body = $('bk-rows');
    body.textContent = '';
    for (const [name, k] of rows) {
      const tr = document.createElement('tr'), th = document.createElement('th'), a = document.createElement('td'), b = document.createElement('td');
      th.scope = 'row';
      th.textContent = name;
      a.textContent = now[k].toLocaleString();
      b.textContent = then[k].toLocaleString();
      if (then[k] < now[k]) b.className = 'less'; // you'd lose some
      tr.append(th, a, b);
      body.appendChild(tr);
    }
    const r = $('bk-restore');
    delete r.dataset.armed;
    r.textContent = 'Restore this backup';
    $('bk-preview').classList.remove('hidden');
    const n = res.skipped;
    say('bk-load-msg', n ? `${n} thing${n === 1 ? ' in it isn\u2019t an arcade save' : 's in it aren\u2019t arcade saves'} and will be left out.` : '');
    $('bk-preview').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function changed() { dispatchEvent(new Event('arcade-saves')); refresh(); }

  // ---- Buttons -------------------------------------------------------------------------
  $('bk-download').addEventListener('click', () => {
    Saves.download();
    if (framed) { say('bk-save-msg', 'Downloading. No file? This page is inside another site that blocks downloads: use Copy as a code instead.'); return; }
    Saves.markSaved();
    say('bk-save-msg', 'Saved. Keep the file somewhere safe: a USB stick, a cloud drive, an email to yourself.', 'good');
    refresh();
  });

  $('bk-copy').addEventListener('click', async () => {
    const out = $('bk-code-out'), code = await Saves.encode();
    out.value = code;
    out.classList.remove('hidden');
    const copied = await copyText(code, out);
    Saves.markSaved();
    const long = code.length > 8000 ? ' It’s a long one: a backup file is easier to keep.' : '';
    say('bk-save-msg', (copied ? 'Copied. Paste it somewhere safe, like a note or an email to yourself.' : 'Select the code above and copy it.') + long, 'good');
    refresh();
  });

  const file = $('bk-file');
  $('bk-open').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (f) preview(await Saves.readFile(f));
  });
  // drop a backup file anywhere on the dialog
  box.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  box.addEventListener('drop', async e => {
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    preview(await Saves.readFile(f));
  });

  $('bk-check').addEventListener('click', async () => {
    const text = $('bk-code-in').value;
    if (!text.trim()) { say('bk-load-msg', 'Paste a backup code into the box first.', 'bad'); return; }
    preview(await Saves.decode(text));
  });

  $('bk-cancel').addEventListener('click', () => { pending = null; $('bk-preview').classList.add('hidden'); say('bk-load-msg', ''); });

  $('bk-restore').addEventListener('click', () => {
    const r = $('bk-restore');
    if (!pending) return;
    if (!r.dataset.armed) { r.dataset.armed = '1'; r.textContent = 'Tap again to replace your progress'; return; }
    const result = Saves.restore(pending.keys);
    if (result !== 'ok') { say('bk-load-msg', MESSAGES[result], 'bad'); return; }
    pending = null;
    $('bk-preview').classList.add('hidden');
    $('bk-code-in').value = '';
    say('bk-load-msg', 'Restored. Every game now has the backup’s progress.', 'good');
    changed();
  });

  $('bk-undo').addEventListener('click', () => {
    const result = Saves.undo();
    if (result === 'ok') say('bk-load-msg', 'Done: your earlier progress is back.', 'good');
    else say('bk-load-msg', result === 'none' ? 'There’s nothing to undo.' : MESSAGES[result], 'bad');
    changed();
  });

  // ---- Opening and closing ---------------------------------------------------------------
  function open() {
    pending = null;
    $('bk-preview').classList.add('hidden');
    $('bk-code-out').classList.add('hidden');
    say('bk-save-msg', '');
    say('bk-load-msg', '');
    refresh();
    box.classList.remove('hidden');
    document.body.classList.add('modal-open');
    $('bk-download').focus();
  }
  function close() {
    if (box.classList.contains('hidden')) return;
    box.classList.add('hidden');
    document.body.classList.remove('modal-open');
    opener.focus();
  }
  opener.addEventListener('click', open);
  $('bk-done').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box) close(); }); // the dimmed backdrop
  addEventListener('keydown', e => {
    if (box.classList.contains('hidden')) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return; // keep Tab inside the dialog
    const all = [...box.querySelectorAll('button, textarea, [href], input:not(.hidden)')].filter(el => !el.disabled && el.offsetParent !== null);
    if (!all.length) return;
    const first = all[0], last = all[all.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();
