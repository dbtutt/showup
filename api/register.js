// api/register.js
// Creates or updates a user profile + email for alerts

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": method === "POST" ? "resolution=merge-duplicates,return=representation" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text), status: res.status }; }
  catch { return { ok: res.ok, data: text, status: res.status }; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, city, genres, artists, pushSubscription } = req.body;

  if (!email || !city) return res.status(400).json({ error: "email and city are required" });

  const result = await supabase("/users", "POST", {
    email: email.toLowerCase().trim(),
    city,
    genres: genres || [],
    artists: artists || [],
    push_subscription: pushSubscription || null,
    updated_at: new Date().toISOString(),
  });

  if (!result.ok) {
    console.error("Supabase error:", result.data);
    return res.status(500).json({ error: "Failed to save user" });
  }

  const user = Array.isArray(result.data) ? result.data[0] : result.data;
  return res.status(200).json({ userId: user.id, email: user.email });
}
