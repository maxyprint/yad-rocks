import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { studioName, websiteUrl, city, email, googleUrl, instagramAccounts } = req.body;

  if (!studioName || !websiteUrl || !city || !email || !instagramAccounts?.length) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }

  const { data: analysis, error: dbError } = await supabase
    .from('analyses')
    .insert({
      studio_name:         studioName,
      website_url:         websiteUrl,
      city,
      email,
      google_url:          googleUrl || null,
      instagram_accounts:  instagramAccounts,
      status:              'pending',
      paid:                false,
    })
    .select('id')
    .single();

  if (dbError) {
    console.error('Supabase insert error:', dbError);
    return res.status(500).json({ error: 'Datenbankfehler.' });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode:                 'payment',
    customer_email:       email,
    line_items: [{
      price_data: {
        currency:     'eur',
        unit_amount:  2000,
        product_data: {
          name:        'Tattoo Studio Selbstcheck',
          description: `KI-Wachstumsanalyse für ${studioName}`,
        },
      },
      quantity: 1,
    }],
    metadata:    { analysis_id: analysis.id },
    success_url: `https://yad.rocks/bericht?id=${analysis.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `https://yad.rocks/selbstcheck`,
    locale:      'de',
  });

  return res.status(200).json({ checkoutUrl: session.url, _debug_id: analysis.id });
}
