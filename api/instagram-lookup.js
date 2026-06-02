export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const handle = (req.query.handle || '').replace(/^@/, '').trim();
  if (!handle) return res.status(400).json({ error: 'handle required' });

  // RapidAPI (primär)
  const fromRapid = await fetchViaRapidApi(handle);
  if (fromRapid) return res.status(200).json(fromRapid);

  // Fallback: interne Instagram API
  const fromInternal = await fetchViaInternalApi(handle);
  if (fromInternal) return res.status(200).json(fromInternal);

  return res.status(200).json({ exists: false });
}

async function fetchViaRapidApi(username) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;

  try {
    const r = await fetch('https://instagram120.p.rapidapi.com/api/instagram/userInfo', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-rapidapi-host': 'instagram120.p.rapidapi.com',
        'x-rapidapi-key':  key,
      },
      body:   JSON.stringify({ username }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const d = await r.json();

    // instagram120: result[0].user
    const user = d?.result?.[0]?.user ?? d?.data?.user ?? d?.user ?? null;
    if (!user?.username) return null;

    return {
      exists:    true,
      followers: user.follower_count ?? null,
      posts:     user.media_count    ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchViaInternalApi(username) {
  try {
    const r = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      {
        headers: {
          'x-ig-app-id':     '936619743392459',
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept':          '*/*',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Referer':         'https://www.instagram.com/',
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const user = data?.data?.user;
    if (!user) return null;
    return {
      exists:    true,
      followers: user.edge_followed_by?.count             ?? null,
      posts:     user.edge_owner_to_timeline_media?.count ?? null,
    };
  } catch {
    return null;
  }
}
