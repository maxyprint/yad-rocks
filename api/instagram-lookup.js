export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const handle = (req.query.handle || '').replace(/^@/, '').trim();
  if (!handle) return res.status(400).json({ error: 'handle required' });

  try {
    const r = await fetch(`https://www.instagram.com/${handle}/`, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_useragent.php)',
        'Accept':     'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (r.status === 404) return res.status(200).json({ exists: false });
    if (!r.ok)           return res.status(200).json({ exists: true, followers: null, posts: null });

    const html = await r.text();

    // Login-Redirect = kein Profil gefunden
    if (!html.includes('og:description') && html.includes('login')) {
      return res.status(200).json({ exists: true, followers: null, posts: null });
    }

    // og:description: "700 Follower, 50 folge ich, 110 Beiträge – …"
    // EN-Format:      "700 Followers, 50 Following, 110 Posts – …"
    const desc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
              || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i)?.[1];

    if (!desc) return res.status(200).json({ exists: true, followers: null, posts: null });

    return res.status(200).json({
      exists:    true,
      followers: parseIgNum(desc.match(/([\d.,]+)\s*(Follower[s]?)/i)?.[1]),
      posts:     parseIgNum(desc.match(/([\d.,]+)\s*(Post[s]?|Beiträge|Beitrag)/i)?.[1]),
    });

  } catch {
    return res.status(200).json({ exists: false });
  }
}

function parseIgNum(str) {
  if (!str) return null;
  const n = parseInt(str.replace(/[.,]/g, ''), 10);
  return isNaN(n) ? null : n;
}
