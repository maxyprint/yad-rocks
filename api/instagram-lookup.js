export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const handle = (req.query.handle || '').replace(/^@/, '').trim();
  if (!handle) return res.status(400).json({ error: 'handle required' });

  // 1. Interne Instagram API (gibt echte Follower-Zahlen)
  const fromApi = await fetchViaInternalApi(handle);
  if (fromApi) return res.status(200).json(fromApi);

  // 2. Fallback: OG-Tag Scraping
  const fromOg = await fetchViaOgTags(handle);
  if (fromOg) return res.status(200).json(fromOg);

  return res.status(200).json({ exists: false });
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
      followers: user.edge_followed_by?.count              ?? null,
      posts:     user.edge_owner_to_timeline_media?.count  ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchViaOgTags(username) {
  try {
    const r = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_useragent.php)',
        'Accept':     'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    if (!html.includes('og:description')) return { exists: true, followers: null, posts: null };

    const desc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
              || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i)?.[1];
    if (!desc) return { exists: true, followers: null, posts: null };

    return {
      exists:    true,
      followers: parseIgNum(desc.match(/([\d.,]+)\s*(Follower[s]?)/i)?.[1]),
      posts:     parseIgNum(desc.match(/([\d.,]+)\s*(Post[s]?|Beiträge|Beitrag)/i)?.[1]),
    };
  } catch {
    return null;
  }
}

function parseIgNum(str) {
  if (!str) return null;
  const n = parseInt(str.replace(/[.,]/g, ''), 10);
  return isNaN(n) ? null : n;
}
