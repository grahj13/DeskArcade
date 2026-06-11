const { Redis } = require('@upstash/redis');

const TOP_N = 10;

const GAME_META = {
  keystorm:     { higher: true },
  snake:        { higher: true },
  shockline:    { higher: false },
  neonreels:    { higher: true },
  reacto:       { higher: false },
  perfect10:    { higher: false },
  lanedash:     { higher: true },
  neonsearch:   { higher: false },
  fracture:     { higher: true },
  signalscan:   { higher: true },
  wordforge:    { higher: true },
  runexe:       { higher: true },
  perfecttrace: { higher: true },
  pixelglide:   { higher: true },
  wordtrap:     { higher: true },
  ghostpixel:   { higher: true }
};

const redis = Redis.fromEnv();

function redisKey(game, boardKey) {
  return `lb:${game}:${boardKey}`;
}

function rankScore(higher, score) {
  return higher ? score : -score;
}

function normalizeScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function parseMember(member) {
  const parts = String(member).split(':');
  if (parts.length < 3) return null;
  const initials = parts[0];
  const rawScore = Number(parts[1]);
  const ts = Number(parts[2]);
  if (!/^[A-Z0-9]{3}$/.test(initials) || !Number.isFinite(rawScore)) return null;
  return {
    initials,
    score: rawScore,
    created_at: Number.isFinite(ts) ? new Date(ts).toISOString() : null
  };
}

function parseZrangeWithScores(rows) {
  const entries = [];
  for (let i = 0; i < rows.length; i += 2) {
    const parsed = parseMember(rows[i]);
    if (parsed) entries.push(parsed);
  }
  return entries;
}

async function fetchTop10(game, boardKey) {
  const meta = GAME_META[game];
  if (!meta) return [];

  const key = redisKey(game, boardKey);
  const rows = await redis.zrange(key, 0, TOP_N - 1, { rev: true, withScores: true });
  return parseZrangeWithScores(rows);
}

async function scoreQualifies(game, boardKey, score) {
  const meta = GAME_META[game];
  if (!meta) return false;

  const key = redisKey(game, boardKey);
  const count = await redis.zcard(key);
  if (count < TOP_N) return true;

  const rows = await redis.zrange(key, TOP_N - 1, TOP_N - 1, { rev: true, withScores: true });
  if (rows.length < 2) return true;

  const tenthRankScore = Number(rows[1]);
  const newRank = rankScore(meta.higher, score);
  return newRank > tenthRankScore;
}

async function submitScore(game, boardKey, initials, score) {
  const meta = GAME_META[game];
  if (!meta) return { ok: false, error: 'unknown_game' };
  if (!/^[A-Z0-9]{3}$/.test(initials)) return { ok: false, error: 'invalid_initials' };

  const ok = await scoreQualifies(game, boardKey, score);
  if (!ok) return { ok: false, error: 'not_qualified' };

  const key = redisKey(game, boardKey);
  const member = `${initials}:${score}:${Date.now()}`;
  await redis.zadd(key, { score: rankScore(meta.higher, score), member });

  const count = await redis.zcard(key);
  if (count > TOP_N) {
    await redis.zremrangebyrank(key, 0, count - TOP_N - 1);
  }

  return { ok: true };
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return res.status(503).json({ error: 'leaderboard_unconfigured' });
    }

    if (req.method === 'GET') {
      const game = req.query.game;
      const boardKey = req.query.board || 'default';
      if (!game || !GAME_META[game]) {
        return res.status(400).json({ error: 'invalid_game' });
      }
      const entries = await fetchTop10(game, boardKey);
      return res.status(200).json({ entries });
    }

    if (req.method === 'POST') {
      const body = readBody(req);
      const game = body.game;
      const boardKey = body.boardKey || 'default';
      const score = normalizeScore(body.score);

      if (!game || !GAME_META[game] || score === null) {
        return res.status(400).json({ error: 'invalid_request' });
      }

      if (body.action === 'qualifies') {
        const qualifies = await scoreQualifies(game, boardKey, score);
        return res.status(200).json({ qualifies });
      }

      if (body.action === 'submit') {
        const initials = String(body.initials || '').toUpperCase();
        const result = await submitScore(game, boardKey, initials, score);
        return res.status(result.ok ? 200 : 400).json(result);
      }

      return res.status(400).json({ error: 'invalid_action' });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('leaderboard error', err);
    return res.status(500).json({ error: 'server_error' });
  }
};
