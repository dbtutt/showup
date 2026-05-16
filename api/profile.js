// api/profile.js — GET and PATCH the authenticated user's profile

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function verifyToken(token) {
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.email ? user : null;
}

async function db(path, method = "GET", body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer:
        method === "POST"
          ? "resolution=merge-duplicates,return=representation"
          : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { ok: res.ok, data: JSON.parse(text), status: res.status };
  } catch {
    return { ok: res.ok, data: text, status: res.status };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = req.headers.authorization?.replace("Bearer ", "");
  const authUser = await verifyToken(token);
  if (!authUser) return res.status(401).json({ error: "Unauthorized" });

  const email = authUser.email.toLowerCase().trim();

  if (req.method === "GET") {
    const result = await db(
      `/users?email=eq.${encodeURIComponent(email)}&limit=1`
    );
    if (!result.ok) return res.status(500).json({ error: "DB error" });
    const user = Array.isArray(result.data) ? result.data[0] : null;
    return res.status(200).json({ profile: user || null });
  }

  if (req.method === "PATCH") {
    const { city, genres, artists, shows } = req.body || {};
    const result = await db("/users", "POST", {
      email,
      city: city || "",
      genres: genres || [],
      artists: artists || [],
      shows: shows || [],
      updated_at: new Date().toISOString(),
    });
    if (!result.ok) return res.status(500).json({ error: "Failed to save" });
    const user = Array.isArray(result.data) ? result.data[0] : result.data;
    return res.status(200).json({ profile: user });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
