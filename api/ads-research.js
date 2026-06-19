export const config = { maxDuration: 30 };

// Searches Meta Ads Library for active ads by keyword or page name
// Fields: ad body, title, description, page name, snapshot URL, dates
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { q, country = 'DE', limit = '20', page_ids } = req.query;
  if (!q && !page_ids) return res.status(400).json({ error: 'q or page_ids required' });

  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'no token' });

  const fields = [
    'id',
    'page_id',
    'page_name',
    'ad_creative_bodies',
    'ad_creative_link_captions',
    'ad_creative_link_descriptions',
    'ad_creative_link_titles',
    'ad_delivery_start_time',
    'ad_delivery_stop_time',
    'ad_snapshot_url',
    'impressions',
    'spend',
    'currency',
    'ad_creative_link_button',
  ].join(',');

  try {
    const params = new URLSearchParams({
      ad_reached_countries: JSON.stringify([country]),
      ad_active_status:     'ACTIVE',
      ad_type:              'ALL',
      fields,
      limit:                String(Math.min(Number(limit), 50)),
      access_token:         token,
    });

    if (q)        params.set('search_terms', q.trim());
    if (page_ids) params.set('search_page_ids', page_ids); // comma-separated page IDs

    const url = `https://graph.facebook.com/v19.0/ads_archive?${params}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const data = await r.json();

    if (data.error) {
      console.error('Ads archive error:', data.error);
      return res.status(200).json({ error: data.error.message, data: [] });
    }

    // Clean & return
    const ads = (data.data || []).map(ad => ({
      id:          ad.id,
      page_id:     ad.page_id,
      page_name:   ad.page_name,
      bodies:      ad.ad_creative_bodies || [],
      titles:      ad.ad_creative_link_titles || [],
      descriptions:ad.ad_creative_link_descriptions || [],
      captions:    ad.ad_creative_link_captions || [],
      button:      ad.ad_creative_link_button,
      snapshot:    ad.ad_snapshot_url,
      started:     ad.ad_delivery_start_time,
      stopped:     ad.ad_delivery_stop_time,
      impressions: ad.impressions,
      spend:       ad.spend,
      currency:    ad.currency,
    }));

    return res.status(200).json({
      count: ads.length,
      query: q || `page_ids:${page_ids}`,
      country,
      data:  ads,
      next:  data.paging?.next || null,
    });

  } catch (err) {
    console.error(err);
    return res.status(200).json({ error: err.message, data: [] });
  }
}
