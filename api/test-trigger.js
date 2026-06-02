import { createClient } from '@supabase/supabase-js';
import { waitUntil }    from '@vercel/functions';

export const config = { maxDuration: 10 };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (req.headers['x-analyze-secret'] !== process.env.ANALYZE_SECRET) {
    return res.status(401).end();
  }

  const { studio_name, website_url, city, email, google_url, instagram_accounts, facebook_page_id, facebook_page_name } = req.body;
  if (!studio_name || !website_url || !city) {
    return res.status(400).json({ error: 'studio_name, website_url, city required' });
  }

  const { data, error } = await supabase
    .from('analyses')
    .insert({
      studio_name,
      website_url,
      city,
      email:               email || 'test@yad.rocks',
      google_url:          google_url          || null,
      instagram_accounts:  Array.isArray(instagram_accounts) ? instagram_accounts : [],
      facebook_page_id:    facebook_page_id    || null,
      facebook_page_name:  facebook_page_name  || null,
      paid:                true,
      status:              'pending',
    })
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  waitUntil(
    fetch('https://yad.rocks/api/analyze', {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-analyze-secret': process.env.ANALYZE_SECRET,
      },
      body: JSON.stringify({ analysis_id: data.id }),
    }).catch(() => {})
  );

  return res.status(200).json({ id: data.id });
}
