export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.status(200).json({ data: [] });

  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return res.status(200).json({ data: [] });

  try {
    // 1. Facebook-Seiten suchen
    const searchParams = new URLSearchParams({
      type:         'page',
      q:            q.trim(),
      fields:       'id,name,fan_count,category',
      limit:        '6',
      access_token: token,
    });

    const searchRes = await fetch(
      `https://graph.facebook.com/v19.0/search?${searchParams}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const searchData = await searchRes.json();

    if (searchData.error) {
      console.error('FB search error:', searchData.error.message);
      return res.status(200).json({ data: [] });
    }

    const pages = searchData.data || [];
    if (!pages.length) return res.status(200).json({ data: [] });

    // 2. Prüfen welche dieser Seiten aktive Ads haben (ein einziger API-Call)
    const pageIds = pages.map(p => p.id);
    let activeAdPageIds = new Set();

    try {
      const adsParams = new URLSearchParams({
        search_page_ids:  JSON.stringify(pageIds),
        ad_active_status: 'ACTIVE',
        fields:           'page_id',
        limit:            '50',
        access_token:     token,
      });

      const adsRes = await fetch(
        `https://graph.facebook.com/v19.0/ads_archive?${adsParams}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const adsData = await adsRes.json();

      if (!adsData.error && adsData.data) {
        activeAdPageIds = new Set(adsData.data.map(a => a.page_id));
      }
    } catch {}

    // 3. Ergebnisse anreichern
    const enriched = pages.map(p => ({
      ...p,
      has_active_ads: activeAdPageIds.has(p.id),
    }));

    return res.status(200).json({ data: enriched });

  } catch {
    return res.status(200).json({ data: [] });
  }
}
