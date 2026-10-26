// Vercel serverless function. Stores emails in an Upstash Redis set (free, via Vercel Marketplace).
// POST /api/waitlist {email}            -> saves email
// GET  /api/waitlist?key=ADMIN_KEY      -> lists emails (set ADMIN_KEY env var; omit to disable)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'waitlist';

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}

export default async function handler(req, res) {
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'storage not configured' });
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const email = String(body.email || '').trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid email' });
      await redis(['SADD', KEY, email]);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET') {
      if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
      const emails = await redis(['SMEMBERS', KEY]);
      return res.status(200).json({ count: emails.length, emails });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
}
