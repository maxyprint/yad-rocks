export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.status(200).json({ data: [] });

  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return res.status(200).json({ data: [] });

  try {
    const params = new URLSearchParams({
      type:         'page',
      q:            q.trim(),
      fields:       'id,name,fan_count,category',
      limit:        '6',
      access_token: token,
    });

    const r = await fetch(
      `https://graph.facebook.com/v19.0/search?${params}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();

    if (d.error) {
      console.error('FB search error:', d.error.message);
      return res.status(200).json({ data: [] });
    }

    return res.status(200).json({ data: d.data || [] });
  } catch {
    return res.status(200).json({ data: [] });
  }
}
