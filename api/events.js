// api/events.js — Vercel serverless function
// Proxies Ticketmaster Discovery API to avoid CORS issues in the browser

const TM_KEY = process.env.TM_API_KEY;

const GENRE_TO_SEGMENT = {
  "Electronic / Techno":  { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAvF" },
  "House / Deep House":   { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAvF" },
  "Melodic Bass / EDM":   { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAvt" },
  "Hip-Hop / Rap":        { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAv1" },
  "R&B / Soul":           { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAee" },
  "Indie / Alternative":  { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAvd" },
  "Rock / Metal":         { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAeA" },
  "Pop":                  { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAev" },
  "Jazz / Blues":         { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAvE" },
  "Classical":            { segmentId: "KZFzniwnSyZfZ7v7v6J", genreId: null },
  "Folk / Americana":     { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAeJ" },
  "Punk / Hardcore":      { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAeA" },
  "Reggae / Afrobeats":   { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: "KnvZfZ7vAev" },
  "Other":                { segmentId: "KZFzniwnSyZfZ7v7nJ", genreId: null },
};

function normaliseEvent(e) {
  const now = new Date();
  const statusCode = e.dates?.status?.code || "";
  const onSaleStr = e.sales?.public?.startDateTime;
  let ticketStatus = "announced";
  if (statusCode === "onsale" || (onSaleStr && new Date(onSaleStr) <= now)) ticketStatus = "on_sale";
  else if (statusCode === "offsale") ticketStatus = "sold_out";

  return {
    id: "tm_" + e.id,
    artist: e.name || "",
    venue: e._embedded?.venues?.[0]?.name || "",
    date: e.dates?.start?.localDate || "",
    time: (e.dates?.start?.localTime || "").slice(0, 5),
    price: e.priceRanges?.[0]?.min ? `From $${Math.round(e.priceRanges[0].min)}` : "",
    ticketUrl: e.url || "",
    ticketStatus,
    notes: "",
    saved: false,
    fromTM: true,
  };
}

export default async function handler(req, res) {
  // CORS headers — allow any origin so the deployed app can call this
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { city, genres: genresRaw, artists: artistsRaw } = req.query;

  if (!city) return res.status(400).json({ error: "city is required" });
  if (!TM_KEY) return res.status(500).json({ error: "TM_API_KEY not configured" });

  const genres = genresRaw ? JSON.parse(genresRaw) : [];
  const artists = artistsRaw ? JSON.parse(artistsRaw) : [];

  const today = new Date().toISOString().split("T")[0] + "T00:00:00Z";
  const future = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0] + "T00:00:00Z";

  const fetches = [];

  // Per-artist keyword searches
  for (const artist of artists.slice(0, 5)) {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}&keyword=${encodeURIComponent(artist)}&city=${encodeURIComponent(city)}&startDateTime=${today}&endDateTime=${future}&size=5&sort=date,asc`;
    fetches.push(fetch(url).then(r => r.json()).catch(() => null));
  }

  // Genre segment searches (deduped)
  const seenSegs = new Set();
  for (const genre of genres) {
    const mapping = GENRE_TO_SEGMENT[genre];
    if (!mapping) continue;
    const key = mapping.segmentId + (mapping.genreId || "");
    if (seenSegs.has(key)) continue;
    seenSegs.add(key);
    let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}&segmentId=${mapping.segmentId}&city=${encodeURIComponent(city)}&startDateTime=${today}&endDateTime=${future}&size=15&sort=date,asc`;
    if (mapping.genreId) url += `&genreId=${mapping.genreId}`;
    fetches.push(fetch(url).then(r => r.json()).catch(() => null));
  }

  const responses = await Promise.all(fetches);

  const seen = new Set();
  const events = [];

  for (const data of responses) {
    if (!data?._embedded?.events) continue;
    for (const e of data._embedded.events) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      events.push(normaliseEvent(e));
    }
  }

  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  return res.status(200).json({ events });
}
