const { kv } = require('@vercel/kv');
const LB_KEY = 'lb:sentient:v1';
const USERS_HASH = 'lb:sentient:users';

const unpack = (score) => {
  const matches = Math.floor(score / 1000);
  const timeLeft = score - (matches * 1000);
  return { matches, timeLeft };
};

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const limit = Math.min(50, Number(req.query.limit || 10));
    const raw = await kv.zrange(LB_KEY, -limit, -1, { withScores: true });
    const pairs = [];
    for (let i = 0; i < raw.length; i += 2) {
      pairs.push({ handle: raw[i], score: Number(raw[i + 1]) });
    }
    pairs.reverse();

    const handles = pairs.map(p => p.handle);
    const metas = handles.length ? await kv.hmget(USERS_HASH, ...handles) : [];
    const items = pairs.map((p, idx) => {
      const meta = metas[idx] ? JSON.parse(metas[idx]) : {};
      return {
        rank: idx + 1,
        handle: p.handle,
        score: p.score,
        ...unpack(p.score),
        avatar: meta.avatar || ''
      };
    });

    return res.status(200).json({ items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
