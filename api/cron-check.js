// api/cron-check.js
// Vercel Cron Job — runs every 6 hours
// Checks watchlists for on-sale changes + scans for new shows per user

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TM_KEY = process.env.TM_API_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || "https://showup-amber.vercel.app";

// ── Supabase helper ───────────────────────────────────────────────────────────
async function db(path, method = "GET", body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": method === "PATCH" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

// ── Ticketmaster helper ───────────────────────────────────────────────────────
async function tmFetch(url) {
  try {
    const res = await fetch(url);
    return res.ok ? res.json() : null;
  } catch { return null; }
}

function tmStatus(e) {
  const code = e.dates?.status?.code || "";
  const onSale = e.sales?.public?.startDateTime;
  if (code === "onsale" || (onSale && new Date(onSale) <= new Date())) return "on_sale";
  if (code === "offsale") return "sold_out";
  return "announced";
}

// ── Email sender ──────────────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: "ShowUp <alerts@showup-amber.vercel.app>",
        to,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch { return false; }
}

function onSaleEmail(show) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; background: #07070f; color: #e2e2f0; padding: 32px; border-radius: 12px;">
      <div style="font-size: 20px; font-weight: 800; letter-spacing: 4px; color: #fff; margin-bottom: 24px;">SHOWUP</div>
      <div style="background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.3); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <div style="font-size: 11px; color: #4ade80; letter-spacing: 2px; margin-bottom: 8px;">🎟 TICKETS ON SALE NOW</div>
        <div style="font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 4px;">${show.artist}</div>
        <div style="font-size: 14px; color: #888;">${show.venue}${show.event_date ? ` · ${new Date(show.event_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}` : ""}</div>
        ${show.price ? `<div style="font-size: 13px; color: #666; margin-top: 6px;">${show.price}</div>` : ""}
      </div>
      ${show.ticket_url ? `<a href="${show.ticket_url}" style="display: inline-block; background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.4); color: #4ade80; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Get Tickets →</a>` : ""}
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.07); font-size: 11px; color: #444;">
        <a href="${APP_URL}" style="color: #555;">Open ShowUp</a> · You're receiving this because you set an alert for ${show.artist}.
      </div>
    </div>
  `;
}

function newShowEmail(shows, city) {
  const showList = shows.map(s => `
    <div style="border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 14px; margin-bottom: 8px;">
      <div style="font-size: 15px; font-weight: 600; color: #f0f0f8;">${s.name}</div>
      <div style="font-size: 13px; color: #888; margin-top: 3px;">${s._embedded?.venues?.[0]?.name || ""}${s.dates?.start?.localDate ? ` · ${new Date(s.dates.start.localDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}</div>
      ${s.url ? `<a href="${s.url}" style="font-size: 12px; color: #a78bfa; text-decoration: none; margin-top: 6px; display: inline-block;">View Tickets →</a>` : ""}
    </div>
  `).join("");

  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; background: #07070f; color: #e2e2f0; padding: 32px; border-radius: 12px;">
      <div style="font-size: 20px; font-weight: 800; letter-spacing: 4px; color: #fff; margin-bottom: 24px;">SHOWUP</div>
      <div style="font-size: 11px; color: #a78bfa; letter-spacing: 2px; margin-bottom: 16px;">🎵 NEW SHOWS IN ${city.toUpperCase()}</div>
      <div style="font-size: 15px; color: #aaa; margin-bottom: 20px;">${shows.length} new show${shows.length !== 1 ? "s" : ""} announced for artists you follow:</div>
      ${showList}
      <div style="margin-top: 24px;">
        <a href="${APP_URL}" style="display: inline-block; background: rgba(167,139,250,0.15); border: 1px solid rgba(167,139,250,0.4); color: #c4b5fd; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Open ShowUp →</a>
      </div>
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.07); font-size: 11px; color: #444;">
        You're receiving this because you follow artists on ShowUp.
      </div>
    </div>
  `;
}

// ── Main cron handler ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Verify this is called by Vercel cron (or manually with secret)
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const results = { checked: 0, onSaleAlerts: 0, newShowAlerts: 0, errors: [] };

  try {
    // Get all users with emails
    const users = await db("/users?select=*");
    if (!Array.isArray(users)) {
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    for (const user of users) {
      try {
        results.checked++;
        const today = new Date().toISOString().split("T")[0] + "T00:00:00Z";
        const future = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0] + "T00:00:00Z";

        // ── 1. Check watchlist for on-sale changes ──────────────────────────
        const watchlist = await db(`/watchlist?user_id=eq.${user.id}&alerted_on_sale=eq.false`);

        if (Array.isArray(watchlist)) {
          for (const item of watchlist) {
            // Fetch current TM status for this event
            const tmData = await tmFetch(
              `https://app.ticketmaster.com/discovery/v2/events/${item.tm_event_id.replace("tm_", "")}.json?apikey=${TM_KEY}`
            );
            if (!tmData || tmData.fault) continue;

            const currentStatus = tmStatus(tmData);
            if (currentStatus === "on_sale" && item.last_status !== "on_sale") {
              // Send on-sale alert
              const sent = await sendEmail(
                user.email,
                `🎟 Tickets on sale: ${item.artist}`,
                onSaleEmail({
                  ...item,
                  price: tmData.priceRanges?.[0]?.min ? `From $${Math.round(tmData.priceRanges[0].min)}` : item.price,
                  ticket_url: tmData.url || item.ticket_url,
                })
              );
              if (sent) {
                await db(`/watchlist?id=eq.${item.id}`, "PATCH", {
                  last_status: "on_sale",
                  alerted_on_sale: true,
                  price: tmData.priceRanges?.[0]?.min ? `From $${Math.round(tmData.priceRanges[0].min)}` : item.price,
                });
                results.onSaleAlerts++;
              }
            }
          }
        }

        // ── 2. Check for new shows for followed artists ─────────────────────
        const artists = user.artists || [];
        if (artists.length === 0) continue;

        // Get existing watchlist event IDs to avoid re-alerting
        const existing = await db(`/watchlist?user_id=eq.${user.id}&select=tm_event_id,alerted_announced`);
        const alertedIds = new Set(
          Array.isArray(existing)
            ? existing.filter(e => e.alerted_announced).map(e => e.tm_event_id)
            : []
        );

        const newShows = [];
        for (const artist of artists.slice(0, 8)) {
          const data = await tmFetch(
            `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}&keyword=${encodeURIComponent(artist)}&city=${encodeURIComponent(user.city)}&startDateTime=${today}&endDateTime=${future}&size=3&sort=date,asc`
          );
          if (!data?._embedded?.events) continue;
          for (const e of data._embedded.events) {
            if (!alertedIds.has("tm_" + e.id)) {
              newShows.push(e);
              // Add to watchlist silently so we don't re-alert
              await db("/watchlist", "POST", {
                user_id: user.id,
                tm_event_id: "tm_" + e.id,
                artist: e.name,
                venue: e._embedded?.venues?.[0]?.name || "",
                event_date: e.dates?.start?.localDate || "",
                last_status: tmStatus(e),
                ticket_url: e.url || "",
                alerted_announced: true,
                alerted_on_sale: tmStatus(e) === "on_sale",
              }).catch(() => {});
            }
          }
        }

        if (newShows.length > 0) {
          const sent = await sendEmail(
            user.email,
            `🎵 ${newShows.length} new show${newShows.length !== 1 ? "s" : ""} announced in ${user.city}`,
            newShowEmail(newShows, user.city)
          );
          if (sent) results.newShowAlerts++;
        }

      } catch (userErr) {
        results.errors.push(`User ${user.email}: ${userErr.message}`);
      }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json(results);
}
