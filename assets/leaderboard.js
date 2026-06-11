/**
 * DeskArcade — shared TOP 10 leaderboard (Supabase)
 *
 * Usage in a game page:
 *   <link rel="stylesheet" href="../../assets/leaderboard.css">
 *   <script src="../../assets/deskarcade-config.js"></script>
 *   <script src="../../assets/leaderboard.js"></script>
 *
 *   DeskArcadeLeaderboard.mountPanel(document.getElementById('lbMount'), 'snake');
 *
 *   // When the player finishes with a score:
 *   await DeskArcadeLeaderboard.trySubmit('snake', rawScore, { boardKey: 'default' });
 */
(function (global) {
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

  function formatMs(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  function getConfig() {
    return global.DESK_ARCADE_CONFIG || null;
  }

  function isEnabled() {
    const cfg = getConfig();
    return !!(cfg && cfg.supabaseUrl && cfg.supabaseAnonKey);
  }

  function headers() {
    const cfg = getConfig();
    return {
      'Content-Type': 'application/json',
      apikey: cfg.supabaseAnonKey,
      Authorization: 'Bearer ' + cfg.supabaseAnonKey
    };
  }

  function rpc(name, body) {
    const cfg = getConfig();
    return fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    }).then(r => r.json());
  }

  function normalizeScore(gameSlug, rawScore, meta) {
    const n = Number(rawScore);
    if (!Number.isFinite(n)) return null;
    if (meta.higher) return Math.max(0, Math.round(n));
    return Math.max(0, Math.round(n));
  }

  async function fetchTop10(gameSlug, boardKey = 'default') {
    if (!isEnabled()) return [];

    const meta = GAME_META[gameSlug];
    if (!meta) return [];

    const cfg = getConfig();
    const order = meta.higher ? 'score.desc' : 'score.asc';
    const params = new URLSearchParams({
      select: 'initials,score,created_at',
      game_slug: 'eq.' + gameSlug,
      board_key: 'eq.' + boardKey,
      order: order,
      limit: '10'
    });

    const res = await fetch(
      cfg.supabaseUrl + '/rest/v1/game_leaderboard_entries?' + params.toString(),
      { headers: headers() }
    );

    if (!res.ok) return [];
    return res.json();
  }

  async function qualifies(gameSlug, score, boardKey = 'default') {
    const meta = GAME_META[gameSlug];
    if (!meta || !isEnabled()) return false;

    const result = await rpc('leaderboard_qualifies', {
      p_game_slug: gameSlug,
      p_board_key: boardKey,
      p_score: score,
      p_higher_is_better: meta.higher
    });

    return result === true;
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
        const result = await rpc('submit_leaderboard_score', {
          p_game_slug: gameSlug,
          p_board_key: boardKey,
          p_initials: initials,
          p_score: score,
          p_higher_is_better: meta.higher
        });
        submitBtn.disabled = false;

        if (result && result.ok) close({ initials, score });
        else close(null);
      };
    });
  }

  function renderPanel(container, rows, gameSlug) {
    const meta = GAME_META[gameSlug];
    if (!container) return;

    if (!isEnabled()) {
      container.innerHTML = `
        <div class="da-lb-panel">
          <div class="da-lb-head">
            <span class="da-lb-title">Top 10</span>
          </div>
          <div class="da-lb-offline">Leaderboard offline — add deskarcade-config.js to enable.</div>
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
      const rows = await fetchTop10(gameSlug, boardKey);
      renderPanel(container, rows, gameSlug);
    } catch (_) {
      renderPanel(container, [], gameSlug);
    }
  }

  async function refreshPanel(container) {
    if (!container || !container.dataset.lbGame) return;
    await mountPanel(container, container.dataset.lbGame, container.dataset.lbBoard || 'default');
  }

  /**
   * Check qualification, prompt for initials if needed, submit, refresh panel.
   * rawScore: game-native value (will be normalized to integer for storage)
   */
  async function trySubmit(gameSlug, rawScore, options = {}) {
    const meta = GAME_META[gameSlug];
    if (!meta || !isEnabled()) return false;

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
