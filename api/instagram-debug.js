export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  if (req.headers['x-analyze-secret'] !== process.env.ANALYZE_SECRET) {
    return res.status(401).end();
  }

  const handle   = (req.query.handle || '').replace(/^@/, '').trim();
  const endpoint = req.query.endpoint || 'userInfo';
  const key      = process.env.RAPIDAPI_KEY;

  if (!handle) return res.status(400).json({ error: 'handle required' });
  if (!key)    return res.status(400).json({ error: 'RAPIDAPI_KEY not set' });

  try {
    const r = await fetch(`https://instagram120.p.rapidapi.com/api/instagram/${endpoint}`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-rapidapi-host': 'instagram120.p.rapidapi.com',
        'x-rapidapi-key':  key,
      },
      body:   JSON.stringify({ username: handle, maxId: '' }),
      signal: AbortSignal.timeout(15000),
    });

    const raw = await r.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }

    return res.status(200).json({
      status:   r.status,
      endpoint,
      handle,
      raw:      raw.slice(0, 3000),
      parsed,
    });
  } catch (e) {
    return res.status(200).json({ error: e.message });
  }
}
