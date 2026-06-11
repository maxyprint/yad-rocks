import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { city = 'München', category = 'Restaurant', max = 20 } = req.body
  const maxResults = Math.min(parseInt(max), 60)

  const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  searchUrl.searchParams.set('query', `${category} ${city}`)
  searchUrl.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY)
  searchUrl.searchParams.set('language', 'de')

  const searchRes = await fetch(searchUrl.toString())
  const searchData = await searchRes.json()

  if (searchData.status !== 'OK') {
    return res.status(500).json({ error: searchData.status, details: searchData.error_message })
  }

  let inserted = 0
  let skipped = 0

  for (const place of searchData.results.slice(0, maxResults)) {
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    detailsUrl.searchParams.set('place_id', place.place_id)
    detailsUrl.searchParams.set('fields', 'name,formatted_phone_number,website,formatted_address')
    detailsUrl.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY)
    detailsUrl.searchParams.set('language', 'de')

    const detailsRes = await fetch(detailsUrl.toString())
    const detailsData = await detailsRes.json()
    const details = detailsData.result

    if (!details?.formatted_phone_number) {
      skipped++
      continue
    }

    const { error } = await supabase
      .from('coldcall_leads')
      .upsert(
        {
          business_name: details.name,
          phone: details.formatted_phone_number,
          address: details.formatted_address,
          city,
          category,
          website: details.website || null,
          google_place_id: place.place_id,
          status: 'pending'
        },
        { onConflict: 'google_place_id', ignoreDuplicates: true }
      )

    if (!error) inserted++

    // Google Maps API Rate Limit
    await new Promise(r => setTimeout(r, 120))
  }

  res.json({ success: true, inserted, skipped, total_found: searchData.results.length })
}
