/**
 * DeskArcade — shared TOP 10 leaderboard (Upstash Redis via /api/leaderboard)
 *
 * Usage in a game page:
 *   <link rel="stylesheet" href="../../assets/leaderboard.css">
 *   <script src="../../assets/leaderboard.js"></script>
 *
 *   DeskArcadeLeaderboard.mountPanel(document.getElementById('lbMount'), 'snake');
 *
 *   await DeskArcadeLeaderboard.trySubmit('snake', rawScore, { boardKey: 'default' });
 */
(function (global) {
  const API = '/api/leaderboard';

  const GAME_META = {
    keystorm:     { label: 'KeyStorm',      higher: true,  format: v => String(v) },
    snake:        { label: 'Grid Viper',    higher: true,  format: v => String(v) },
    shockline:    { label: 'Shockline',     higher: false, format: v => (v / 1000).toFixed(2) + 's' },
    neonreels:    { label: 'NeonReels',     higher: true,  format: v => '£' + v },
    reacto:       { label: 'Reacto',        higher: false, format: v => (v / 1000).toFixed(3) + 's' },
    perfect10:    { label: 'Perfect 10',    higher: false, format: v => (v / 1000).toFixed(3) + 's off' },
    lanedash:     { label: 'Lane Dash',     higher: true,  format: v => String(v) },
    neonsearch:   { label: 'Neon Search',   higher: false, format: v => formatMs(v) },
    fracture:     { label: 'Fracture',      higher: true,  format: v => String(v) },
    signalscan:   { label: 'Signal Scan',   higher: true,  format: v => 'Round ' + v },
    wordforge:    { label: 'Word Forge',    higher: true,  format: v => String(v) },
    runexe:       { label: 'Run.exe',       higher: true,  format: v => String(v).padStart(5, '0') },
    perfecttrace: { label: 'Perfect Trace', higher: true,  format: v => v + '%' },
    pixelglide:   { label: 'Pixel Glide',   higher: true,  format: v => String(v) },
    wordtrap:     { label: 'Word Trap',     higher: true,  format: v => String(v) },
    ghostpixel:   { label: 'Ghost Pixel',   higher: true,  format: v => String(v) }
  };

  let apiAvailable = null;

  function formatMs(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  function isLocalPreview() {
    return global.location.protocol === 'file:';
  }

  function isEnabled() {
    return !isLocalPreview();
  }

  async function checkApi() {
    if (apiAvailable !== null) return apiAvailable;
    if (!isEnabled()) {
      apiAvailable = false;
      return false;
    }
    try {
      const res = await fetch(API + '?game=snake&board=default');
      apiAvailable = res.ok || res.status === 400;
    } catch (_) {
      apiAvailable = false;
    }
    return apiAvailable;
  }

  async function apiPost(body) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  function normalizeScore(gameSlug, rawScore, meta) {
    const n = Number(rawScore);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n));
  }

  async function fetchTop10(gameSlug, boardKey = 'default') {
    if (!(await checkApi())) return [];

    const meta = GAME_META[gameSlug];
    if (!meta) return [];

    const params = new URLSearchParams({
      game: gameSlug,
      board: boardKey
    });

    const res = await fetch(API + '?' + params.toString());
    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data.entries) ? data.entries : [];
  }

  async function qualifies(gameSlug, score, boardKey = 'default') {
    const meta = GAME_META[gameSlug];
    if (!meta || !(await checkApi())) return false;

    const result = await apiPost({
      action: 'qualifies',
      game: gameSlug,
      boardKey,
      score
    });

    return result.qualifies === true;
  }

  function ensureModal() {
    let modal = document.getElementById('daLbModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'daLbModal';
    modal.className = 'da-lb-modal';
    modal.innerHTML = `
      <div class="da-lb-modal-card" role="dialog" aria-modal="true" aria-labelledby="daLbTitle">
        <h3 id="daLbTitle">TOP 10!</h3>
        <p id="daLbPrompt">Enter your 3-character arcade name.</p>
        <div class="da-lb-initials">
          <input maxlength="1" aria-label="Initial 1" data-idx="0" />
          <input maxlength="1" aria-label="Initial 2" data-idx="1" />
          <input maxlength="1" aria-label="Initial 3" data-idx="2" />
        </div>
        <div class="da-lb-modal-actions">
          <button type="button" class="da-btn" id="daLbSubmit">Enter</button>
          <button type="button" class="da-btn-ghost" id="daLbSkip">Skip</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function promptInitials(gameSlug, score, boardKey) {
    const meta = GAME_META[gameSlug];
    const modal = ensureModal();
    const inputs = [...modal.querySelectorAll('.da-lb-initials input')];
    const title = modal.querySelector('#daLbTitle');
    const prompt = modal.querySelector('#daLbPrompt');
    const submitBtn = modal.querySelector('#daLbSubmit');
    const skipBtn = modal.querySelector('#daLbSkip');

    title.textContent = 'TOP 10!';
    prompt.textContent = meta
      ? `You scored ${meta.format(score)}. Enter 3 letters for the ${meta.label} board.`
      : 'Enter your 3-character arcade name.';

    inputs.forEach(i => { i.value = ''; });
    modal.classList.add('open');
    inputs[0].focus();

    inputs.forEach((input, idx) => {
      input.oninput = () => {
        input.value = input.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (input.value && idx < 2) inputs[idx + 1].focus();
      };
      input.onkeydown = (e) => {
        if (e.key === 'Backspace' && !input.value && idx > 0) inputs[idx - 1].focus();
        if (e.key === 'Enter') submitBtn.click();
        if (e.key === 'Escape') skipBtn.click();
      };
    });

    return new Promise(resolve => {
      const close = (result) => {
        modal.classList.remove('open');
        submitBtn.onclick = null;
        skipBtn.onclick = null;
        resolve(result);
      };

      skipBtn.onclick = () => close(null);

      submitBtn.onclick = async () => {
        const initials = inputs.map(i => i.value).join('');
        if (!/^[A-Z0-9]{3}$/.test(initials)) {
          prompt.textContent = 'Use exactly 3 letters or numbers (A–Z, 0–9).';
          return;
        }

        submitBtn.disabled = true;
        const result = await apiPost({
          action: 'submit',
          game: gameSlug,
          boardKey,
          initials,
          score
        });
        submitBtn.disabled = false;

        if (result && result.ok) close({ initials, score });
        else close(null);
      };
    });
  }

  function renderPanel(container, rows, gameSlug, offline) {
    const meta = GAME_META[gameSlug];
    if (!container) return;

    if (offline) {
      container.innerHTML = `
        <div class="da-lb-panel">
          <div class="da-lb-head">
            <span class="da-lb-title">Top 10</span>
          </div>
          <div class="da-lb-offline">Leaderboard offline — deploy to Vercel with Upstash to enable.</div>
        </div>`;
      return;
    }

    let body = '';
    if (!rows.length) {
      body = '<div class="da-lb-empty">No scores yet. Be the first.</div>';
    } else {
      body = `<table class="da-lb-table"><thead><tr>
        <th>#</th><th>Name</th><th style="text-align:right">Score</th>
      </tr></thead><tbody>` +
        rows.map((row, i) => `<tr>
          <td class="da-lb-rank">${i + 1}</td>
          <td class="da-lb-name">${row.initials}</td>
          <td class="da-lb-score">${meta ? meta.format(row.score) : row.score}</td>
        </tr>`).join('') +
        '</tbody></table>';
    }

    container.innerHTML = `
      <div class="da-lb-panel">
        <div class="da-lb-head">
          <span class="da-lb-title">Top 10</span>
          <span class="da-lb-sub">Arcade board</span>
        </div>
        ${body}
      </div>`;
  }

  async function mountPanel(container, gameSlug, boardKey = 'default') {
    if (!container) return;
    container.dataset.lbGame = gameSlug;
    container.dataset.lbBoard = boardKey;
    try {
      const offline = !(await checkApi());
      const rows = offline ? [] : await fetchTop10(gameSlug, boardKey);
      renderPanel(container, rows, gameSlug, offline);
    } catch (_) {
      renderPanel(container, [], gameSlug, true);
    }
  }

  async function refreshPanel(container) {
    if (!container || !container.dataset.lbGame) return;
    await mountPanel(container, container.dataset.lbGame, container.dataset.lbBoard || 'default');
  }

  async function trySubmit(gameSlug, rawScore, options = {}) {
    const meta = GAME_META[gameSlug];
    if (!meta || !(await checkApi())) return false;

    const boardKey = options.boardKey || 'default';
    const score = normalizeScore(gameSlug, rawScore, meta);
    if (score === null) return false;

    const ok = await qualifies(gameSlug, score, boardKey);
    if (!ok) return false;

    const entry = await promptInitials(gameSlug, score, boardKey);
    if (!entry) return false;

    if (options.panel) await refreshPanel(options.panel);
    return true;
  }

  global.DeskArcadeLeaderboard = {
    GAME_META,
    isEnabled,
    mountPanel,
    refreshPanel,
    trySubmit,
    fetchTop10,
    qualifies
  };
})(window);
