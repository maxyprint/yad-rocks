export const config = { maxDuration: 30 };

async function instagramLookup(handle) {
  const key = process.env.RAPIDAPI_KEY;
  if (key) {
    try {
      const r = await fetch('https://instagram120.p.rapidapi.com/api/instagram/userInfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rapidapi-host': 'instagram120.p.rapidapi.com', 'x-rapidapi-key': key },
        body: JSON.stringify({ username: handle }),
        signal: AbortSignal.timeout(12000),
      });
      if (r.ok) {
        const d = await r.json();
        const user = d?.result?.[0]?.user ?? d?.data?.user ?? d?.user ?? null;
        if (user?.username) return { exists: true, followers: user.follower_count ?? null, posts: user.media_count ?? null };
      }
    } catch {}
  }
  try {
    const r = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`, {
      headers: { 'x-ig-app-id': '936619743392459', 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Referer': 'https://www.instagram.com/' },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const d = await r.json();
      const user = d?.data?.user;
      if (user) return { exists: true, followers: user.edge_followed_by?.count ?? null, posts: user.edge_owner_to_timeline_media?.count ?? null };
    }
  } catch {}
  return { exists: false };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { q, mode, country = 'DE', limit = '25', page_ids } = req.query;

  // ── Instagram lookup (no token needed) ───────────────────────────────────
  if (mode === 'instagram') {
    const handle = (q || '').replace(/^@/, '').trim();
    if (!handle) return res.status(400).json({ error: 'q required' });
    return res.status(200).json(await instagramLookup(handle));
  }

  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return res.status(200).json({ data: [] });

  // ── Token debug: show permissions ─────────────────────────────────────────
  if (mode === 'debug') {
    const r = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,permissions&access_token=${token}`);
    const d = await r.json();
    return res.status(200).json({ token_prefix: token.slice(0, 12), ...d });
  }

  // ── Page slug → ID + active ads with creatives ────────────────────────────
  if (mode === 'competitor') {
    // q = comma-separated slugs/names or page IDs to research
    const slugs = (q || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!slugs.length) return res.status(400).json({ error: 'q required' });

    const creativeFields = [
      'id','page_id','page_name',
      'ad_creative_bodies','ad_creative_link_titles',
      'ad_creative_link_descriptions','ad_creative_link_captions',
      'ad_delivery_start_time','ad_delivery_stop_time','ad_snapshot_url',
      'impressions','spend','currency',
    ].join(',');

    const results = [];
    for (const slug of slugs) {
      try {
        let pageId, pageName, fanCount, category;

        // If q is already a numeric page ID, skip the slug lookup
        if (/^\d+$/.test(slug)) {
          pageId = slug;
        } else {
          // 1. Resolve slug → page ID
          const pageRes  = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(slug)}?fields=id,name,fan_count,category&access_token=${token}`, { signal: AbortSignal.timeout(8000) });
          const pageData = await pageRes.json();
          if (pageData.error) { results.push({ slug, error: pageData.error.message }); continue; }
          pageId   = pageData.id;
          pageName = pageData.name;
          fanCount = pageData.fan_count;
          category = pageData.category;
        }

        // 2. Get active ads with creatives for this page
        const adsParams = new URLSearchParams({
          search_page_ids:  JSON.stringify([pageId]),
          ad_active_status: 'ALL',
          fields:           creativeFields,
          limit:            country === 'ALL' ? '50' : '25',
          access_token:     token,
        });
        if (country !== 'ALL') adsParams.set('ad_reached_countries', JSON.stringify([country]));

        const adsRes  = await fetch(`https://graph.facebook.com/v19.0/ads_archive?${adsParams}`, { signal: AbortSignal.timeout(12000) });
        const adsData = await adsRes.json();
        const ads = (adsData.data || []).map(ad => ({
          id: ad.id, started: ad.ad_delivery_start_time, stopped: ad.ad_delivery_stop_time,
          bodies: ad.ad_creative_bodies || [], titles: ad.ad_creative_link_titles || [],
          descriptions: ad.ad_creative_link_descriptions || [], captions: ad.ad_creative_link_captions || [],
          snapshot: ad.ad_snapshot_url, impressions: ad.impressions, spend: ad.spend,
        }));

        results.push({ slug, page_id: pageId, page_name: pageName, fans: fanCount, category, active_ads: ads.filter(a => !a.stopped).length, total_ads: ads.length, ads });
      } catch (e) {
        results.push({ slug, error: e.message });
      }
    }
    return res.status(200).json({ results });
  }

  // ── Ads Archive mode: search active ad creatives ──────────────────────────
  if (mode === 'ads') {
    if (!q && !page_ids) return res.status(400).json({ error: 'q or page_ids required' });
    const fields = [
      'id','page_id','page_name',
      'ad_creative_bodies','ad_creative_link_titles',
      'ad_creative_link_descriptions','ad_creative_link_captions',
      'ad_delivery_start_time','ad_delivery_stop_time',
      'ad_snapshot_url','impressions','spend','currency',
    ].join(',');
    const p = new URLSearchParams({
      ad_reached_countries: JSON.stringify([country]),
      ad_active_status:     'ACTIVE',
      ad_type:              'ALL',
      fields,
      limit:                String(Math.min(Number(limit), 50)),
      access_token:         token,
    });
    if (q)        p.set('search_terms', q.trim());
    if (page_ids) p.set('search_page_ids', page_ids);
    try {
      const r    = await fetch(`https://graph.facebook.com/v19.0/ads_archive?${p}`, { signal: AbortSignal.timeout(20000) });
      const data = await r.json();
      if (data.error) return res.status(200).json({ error: data.error.message, data: [] });
      const ads = (data.data || []).map(ad => ({
        id: ad.id, page_id: ad.page_id, page_name: ad.page_name,
        bodies: ad.ad_creative_bodies || [],
        titles: ad.ad_creative_link_titles || [],
        descriptions: ad.ad_creative_link_descriptions || [],
        captions: ad.ad_creative_link_captions || [],
        snapshot: ad.ad_snapshot_url,
        started: ad.ad_delivery_start_time,
        stopped: ad.ad_delivery_stop_time,
        impressions: ad.impressions,
        spend: ad.spend, currency: ad.currency,
      }));
      return res.status(200).json({ count: ads.length, query: q || page_ids, country, data: ads });
    } catch (err) {
      return res.status(200).json({ error: err.message, data: [] });
    }
  }

  // ── Original page search mode ──────────────────────────────────────────────
  if (!q || q.trim().length < 2) return res.status(200).json({ data: [] });

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
