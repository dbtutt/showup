// api/watch.js
// Adds or removes a show from a user's alert watchlist

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text), status: res.status }; }
  catch { return { ok: res.ok, data: text, status: res.status }; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { userId, show, action } = req.body;
  if (!userId || !show) return res.status(400).json({ error: "userId and show are required" });

  if (action === "remove") {
    const result = await supabase(
      `/watchlist?user_id=eq.${userId}&tm_event_id=eq.${encodeURIComponent(show.id)}`,
      "DELETE"
    );
    return res.status(result.ok ? 200 : 500).json(result.ok ? { success: true } : { error: "Failed to remove" });
  }

  // Add to watchlist
  const result = await supabase("/watchlist", "POST", {
    user_id: userId,
    tm_event_id: show.id,
    artist: show.artist,
    venue: show.venue || "",
    event_date: show.date || "",
    last_status: show.ticketStatus || "announced",
    ticket_url: show.ticketUrl || "",
    price: show.price || "",
    alerted_on_sale: show.ticketStatus === "on_sale",
    alerted_announced: true,
  });

  if (!result.ok) {
    // Might already exist — that's fine
    if (result.status === 409) return res.status(200).json({ success: true, note: "already watching" });
    return res.status(500).json({ error: "Failed to add to watchlist" });
  }

  return res.status(200).json({ success: true });
}
