const { kv } = require('@vercel/kv');

const LB_KEY = 'lb:sentient:v1';        // ZSET: handle -> score
const USERS_HASH = 'lb:sentient:users'; // HSET: handle -> meta json
const calcScore = (matches, timeLeft) => (matches * 1000) + Math.max(0, timeLeft|0);

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { handle, avatar, matches, timeLeft } = req.body || {};
    const h = String(handle || '').replace(/^@/, '').trim().toLowerCase();
    if (!h || !Number.isFinite(matches) || !Number.isFinite(timeLeft)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const score = calcScore(matches, timeLeft);
    const prev = await kv.zscore(LB_KEY, h);
    if (prev == null || score > Number(prev)) {
      await kv.zadd(LB_KEY, { score, member: h });
    }
    await kv.hset(USERS_HASH, {
      [h]: JSON.stringify({ avatar: avatar || '', updatedAt: Date.now(), matches, timeLeft })
    });

    return res.status(200).json({ ok: true, score });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
