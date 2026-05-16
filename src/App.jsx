import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";

// ── Storage (localStorage as write-through cache) ────────────────────────────
const STORAGE_KEYS = { profile: "showup-profile", shows: "showup-shows" };

function load(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ── Ticketmaster via /api/events proxy ───────────────────────────────────────
async function fetchTMEvents(city, genres, artists) {
  const params = new URLSearchParams({
    city,
    genres: JSON.stringify(genres || []),
    artists: JSON.stringify(artists || []),
  });
  const res = await fetch(`/api/events?${params}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.events || [];
}

// ── Alert registration helpers ────────────────────────────────────────────────
async function registerUser(email, profile) {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      city: profile.city,
      genres: profile.genres,
      artists: profile.artists,
    }),
  });
  if (!res.ok) throw new Error("Registration failed");
  return res.json();
}

async function watchShow(userId, show, action = "add") {
  const res = await fetch("/api/watch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, show, action }),
  });
  return res.ok;
}

// ── Supabase profile API ──────────────────────────────────────────────────────
async function fetchProfile(accessToken) {
  try {
    const res = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.profile || null;
  } catch {
    return null;
  }
}

async function pushProfile(accessToken, profile, shows) {
  try {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ ...profile, shows }),
    });
  } catch {}
}

// ── Constants ─────────────────────────────────────────────────────────────────
const GENRES = [
  "Electronic / Techno", "House / Deep House", "Melodic Bass / EDM",
  "Hip-Hop / Rap", "R&B / Soul", "Indie / Alternative",
  "Rock / Metal", "Pop", "Jazz / Blues", "Classical",
  "Folk / Americana", "Punk / Hardcore", "Reggae / Afrobeats", "Other",
];

const STATUS_CONFIG = {
  on_sale:      { label: "On Sale",      color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.25)" },
  selling_fast: { label: "Selling Fast", color: "#fb923c", bg: "rgba(251,146,60,0.1)",  border: "rgba(251,146,60,0.25)" },
  announced:    { label: "Announced",    color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)" },
  alert_set:    { label: "Alert Set",    color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  border: "rgba(56,189,248,0.25)" },
  sold_out:     { label: "Sold Out",     color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  tba:          { label: "TBA",          color: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.2)" },
};

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function daysAway(d) {
  if (!d) return "";
  const diff = Math.ceil(
    (new Date(d + "T12:00:00") - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  if (diff === 0) return "Today!";
  if (diff === 1) return "Tomorrow";
  return `${diff} days`;
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) setError(err.message);
    else setSent(true);
    setLoading(false);
  };

  return (
    <div style={s.onboardWrap}>
      <div style={s.onboardCard}>
        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={s.onboardLogo}>SHOWUP</div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
            <h2 style={{ ...s.onboardH2, marginBottom: 8 }}>Check your email</h2>
            <p style={s.onboardHint}>
              We sent a magic link to{" "}
              <strong style={{ color: "#c4b5fd" }}>{email}</strong>.<br />
              Click it to sign in — no password needed.
            </p>
            <button onClick={() => setSent(false)} style={{ ...s.ghostBtn, marginTop: 16 }}>
              Use a different email
            </button>
          </div>
        ) : (
          <div style={s.onboardStep}>
            <div style={s.onboardLogo}>SHOWUP</div>
            <p style={s.onboardSub}>
              Your personal concert radar.<br />Sign in to save your settings.
            </p>
            <div style={s.formGroup}>
              <label style={s.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="you@example.com"
                style={s.input}
                autoFocus
              />
            </div>
            {error && (
              <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>
                {error}
              </div>
            )}
            <button
              style={{ ...s.primaryBtn, opacity: email.trim() ? 1 : 0.4 }}
              onClick={send}
              disabled={loading || !email.trim()}
            >
              {loading ? "Sending..." : "Send Magic Link →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Spotify Import ────────────────────────────────────────────────────────────
function SpotifyUpload({ existing, onImport }) {
  const [found, setFound] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [parsed, setParsed] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const parseJson = (json) => {
    const artists = new Set();
    // StreamingHistory format: [{artistName, trackName, ...}]
    if (Array.isArray(json)) {
      for (const item of json) {
        if (item.artistName) artists.add(item.artistName);
      }
    }
    if (json && typeof json === "object" && !Array.isArray(json)) {
      // YourLibrary format: {tracks: [{artist}], followedArtists: [{name}]}
      for (const t of json.tracks || []) {
        if (t.artist) artists.add(t.artist);
      }
      for (const a of json.followedArtists || []) {
        if (a.name) artists.add(a.name);
      }
      // Playlist items
      for (const p of json.playlists || []) {
        for (const item of p.items || []) {
          if (item.track?.artistName) artists.add(item.track.artistName);
        }
      }
    }
    return [...artists].filter(Boolean).sort((a, b) => a.localeCompare(b));
  };

  const handleFiles = async (files) => {
    setError(null);
    const all = new Set();
    let parseError = null;
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        parseJson(json).forEach((a) => all.add(a));
      } catch {
        parseError = `Couldn't parse ${file.name}. Make sure it's a valid Spotify JSON export.`;
      }
    }
    if (parseError) setError(parseError);
    const existingLower = new Set(existing.map((a) => a.toLowerCase()));
    const newArtists = [...all].filter(
      (a) => !existingLower.has(a.toLowerCase())
    );
    setFound(newArtists);
    setSelected(new Set(newArtists));
    setParsed(true);
  };

  const toggle = (artist) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(artist)) next.delete(artist);
      else next.add(artist);
      return next;
    });
  };

  const reset = () => {
    setParsed(false);
    setFound([]);
    setSelected(new Set());
    setError(null);
  };

  return (
    <div style={s.spotifyBox}>
      <div style={s.spotifyHeader}>
        <span style={{ color: "#1ed760", marginRight: 6 }}>♫</span>
        Import from Spotify
      </div>
      {!parsed ? (
        <>
          <p style={s.spotifyHint}>
            Upload your Spotify data export JSON files to auto-populate your artist list.
            Download them at <strong>Spotify → Account → Privacy → Download your data</strong>.
            Supports <code>StreamingHistory*.json</code>, <code>YourLibrary.json</code>, and{" "}
            <code>Follow.json</code>.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: "none" }}
          />
          <button onClick={() => fileRef.current.click()} style={s.ghostBtn}>
            Choose Spotify JSON files…
          </button>
          {error && <div style={s.spotifyError}>{error}</div>}
        </>
      ) : found.length === 0 ? (
        <>
          <p style={s.spotifyHint}>
            No new artists found — you may already have them all.
          </p>
          <button onClick={reset} style={s.ghostBtn}>
            Try another file
          </button>
        </>
      ) : (
        <>
          <p style={s.spotifyHint}>
            Found <strong style={{ color: "#fff" }}>{found.length}</strong> new artists.
            Select which to add:
          </p>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button onClick={() => setSelected(new Set(found))} style={s.ghostBtn}>
              All
            </button>
            <button onClick={() => setSelected(new Set())} style={s.ghostBtn}>
              None
            </button>
          </div>
          <div style={{ ...s.genreGrid, maxHeight: 220, overflowY: "auto", marginBottom: 12 }}>
            {found.map((a) => (
              <button
                key={a}
                onClick={() => toggle(a)}
                style={{
                  ...s.genreChip,
                  ...(selected.has(a) ? s.genreChipActive : {}),
                }}
              >
                {a}
              </button>
            ))}
          </div>
          {error && <div style={s.spotifyError}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={reset} style={s.ghostBtn}>
              Cancel
            </button>
            <button
              onClick={() => {
                onImport([...selected]);
                reset();
              }}
              style={{ ...s.primaryBtn, opacity: selected.size ? 1 : 0.4 }}
              disabled={!selected.size}
            >
              Add {selected.size} artist{selected.size !== 1 ? "s" : ""} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Onboarding ───────────────────────────────────────────────────────────────
function Onboarding({ onComplete, userEmail }) {
  const [step, setStep] = useState(0);
  const [city, setCity] = useState("");
  const [genres, setGenres] = useState([]);
  const [artistInput, setArtistInput] = useState("");
  const [artists, setArtists] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const inputRef = useRef();

  const detectCity = () => {
    setDetecting(true);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const d = await r.json();
          setCity(d.address?.city || d.address?.town || d.address?.county || "");
        } catch {}
        setDetecting(false);
      },
      () => setDetecting(false)
    );
  };

  const toggleGenre = (g) =>
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );

  const addArtist = () => {
    const trimmed = artistInput.trim();
    if (trimmed && !artists.find((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setArtists((prev) => [...prev, trimmed]);
    }
    setArtistInput("");
    inputRef.current?.focus();
  };

  const removeArtist = (a) => setArtists((prev) => prev.filter((x) => x !== a));

  const finish = () => {
    const profile = { city, genres, artists, createdAt: Date.now() };
    onComplete(profile, []);
  };

  const steps = [
    <div key="welcome" style={s.onboardStep}>
      <div style={s.onboardLogo}>SHOWUP</div>
      <p style={s.onboardSub}>
        Your personal concert radar.<br />Track artists. Never miss a show.
      </p>
      {userEmail && (
        <p style={{ ...s.onboardHint, color: "#4ade80", marginBottom: 20 }}>
          Signed in as {userEmail}
        </p>
      )}
      <button style={s.primaryBtn} onClick={() => setStep(1)}>
        Get Started →
      </button>
    </div>,

    <div key="city" style={s.onboardStep}>
      <div style={s.stepNum}>1 / 2</div>
      <h2 style={s.onboardH2}>Where are you based?</h2>
      <p style={s.onboardHint}>We'll use this to find shows near you.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Amsterdam, New York, Berlin..."
          style={s.input}
          onKeyDown={(e) => e.key === "Enter" && city && setStep(2)}
          autoFocus
        />
        <button onClick={detectCity} style={s.ghostBtn}>
          {detecting ? "..." : "📍"}
        </button>
      </div>
      <button
        style={{ ...s.primaryBtn, opacity: city ? 1 : 0.4 }}
        onClick={() => city && setStep(2)}
      >
        Continue →
      </button>
    </div>,

    <div key="genres" style={s.onboardStep}>
      <div style={s.stepNum}>2 / 2</div>
      <h2 style={s.onboardH2}>What do you listen to?</h2>
      <p style={s.onboardHint}>
        Pick your genres — we'll find upcoming shows. You can add specific artists later.
      </p>
      <div style={s.genreGrid}>
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => toggleGenre(g)}
            style={{ ...s.genreChip, ...(genres.includes(g) ? s.genreChipActive : {}) }}
          >
            {g}
          </button>
        ))}
      </div>
      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <p style={{ ...s.onboardHint, marginBottom: 8 }}>
          Want to track specific artists?{" "}
          <span style={{ color: "#555" }}>(optional)</span>
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: artists.length ? 10 : 0,
          }}
        >
          <input
            ref={inputRef}
            value={artistInput}
            onChange={(e) => setArtistInput(e.target.value)}
            placeholder="Artist name..."
            style={s.input}
            onKeyDown={(e) =>
              e.key === "Enter" && artistInput.trim() && addArtist()
            }
          />
          <button
            onClick={addArtist}
            style={s.ghostBtn}
            disabled={!artistInput.trim()}
          >
            Add
          </button>
        </div>
        {artists.length > 0 && (
          <div style={s.artistPillContainer}>
            {artists.map((a) => (
              <div key={a} style={s.artistPill}>
                <span>{a}</span>
                <button onClick={() => removeArtist(a)} style={s.pillRemove}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button style={s.ghostBtn} onClick={() => setStep(1)}>
          ← Back
        </button>
        <button
          style={{
            ...s.primaryBtn,
            flex: 1,
            opacity: genres.length ? 1 : 0.4,
          }}
          onClick={() => genres.length && finish()}
        >
          Launch My Radar →
        </button>
      </div>
    </div>,
  ];

  return (
    <div style={s.onboardWrap}>
      <div style={s.onboardCard}>{steps[step]}</div>
    </div>
  );
}

// ── Add Show Modal ───────────────────────────────────────────────────────────
function AddShowModal({ artists, onAdd, onClose }) {
  const [form, setForm] = useState({
    artist: "", venue: "", date: "", time: "",
    price: "", ticketUrl: "", ticketStatus: "announced", notes: "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Add Show</span>
          <button onClick={onClose} style={s.modalClose}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={s.formGroup}>
            <label style={s.label}>Artist *</label>
            <input
              list="artist-list"
              value={form.artist}
              onChange={(e) => set("artist", e.target.value)}
              placeholder="Artist name"
              style={s.input}
              autoFocus
            />
            <datalist id="artist-list">
              {artists.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Venue</label>
            <input
              value={form.venue}
              onChange={(e) => set("venue", e.target.value)}
              placeholder="Venue"
              style={s.input}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={s.formGroup}>
              <label style={s.label}>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                style={s.input}
              />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
                style={s.input}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={s.formGroup}>
              <label style={s.label}>Price</label>
              <input
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="e.g. €35"
                style={s.input}
              />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Status</label>
              <select
                value={form.ticketStatus}
                onChange={(e) => set("ticketStatus", e.target.value)}
                style={s.select}
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Ticket URL</label>
            <input
              value={form.ticketUrl}
              onChange={(e) => set("ticketUrl", e.target.value)}
              placeholder="https://..."
              style={s.input}
            />
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Notes</label>
            <input
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="e.g. Open air, B2B..."
              style={s.input}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...s.ghostBtn, flex: 1 }}>
            Cancel
          </button>
          <button
            onClick={() => form.artist && form.date && onAdd(form)}
            style={{
              ...s.primaryBtn,
              flex: 2,
              opacity: form.artist && form.date ? 1 : 0.4,
            }}
          >
            Add Show
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Show Card ─────────────────────────────────────────────────────────────────
function ShowCard({ show, onSave, onAlert, onRemove }) {
  const st = STATUS_CONFIG[show.ticketStatus] || STATUS_CONFIG.tba;
  const past = new Date(show.date + "T23:59:00") < new Date();
  return (
    <div style={{ ...s.showCard, opacity: past ? 0.5 : 1 }}>
      <div style={s.showLeft}>
        <div style={s.showArtist}>{show.artist}</div>
        <div style={s.showMeta}>
          {show.venue && <span>{show.venue}</span>}
          {show.venue && show.date && <span style={s.dot}>·</span>}
          {show.date && (
            <span>
              {fmtDate(show.date)}
              {show.time ? ` · ${show.time}` : ""}
            </span>
          )}
          {show.date && (
            <span style={{ ...s.daysTag, color: past ? "#555" : "#a78bfa" }}>
              {daysAway(show.date)}
            </span>
          )}
        </div>
        {show.notes && <div style={s.showNotes}>{show.notes}</div>}
      </div>
      <div style={s.showRight}>
        <div
          style={{
            ...s.statusBadge,
            color: st.color,
            background: st.bg,
            border: `1px solid ${st.border}`,
          }}
        >
          <span style={{ ...s.statusDot, background: st.color }} />
          {st.label}
        </div>
        {show.price && <div style={s.price}>{show.price}</div>}
        <div style={s.showActions}>
          <button
            onClick={() => onSave(show.id)}
            style={{ ...s.actionBtn, color: show.saved ? "#f472b6" : "#555" }}
          >
            {show.saved ? "♥" : "♡"}
          </button>
          {["announced", "tba"].includes(show.ticketStatus) && (
            <button
              onClick={() => onAlert(show)}
              style={{
                ...s.actionBtn,
                color: show.ticketStatus === "alert_set" ? "#38bdf8" : "#666",
              }}
              title="Get notified when tickets go on sale"
            >
              🔔
            </button>
          )}
          {show.ticketUrl &&
            ["on_sale", "selling_fast"].includes(show.ticketStatus) && (
              <a
                href={show.ticketUrl}
                target="_blank"
                rel="noreferrer"
                style={{ ...s.actionBtn, ...s.buyBtn, textDecoration: "none" }}
              >
                Buy
              </a>
            )}
          <button
            onClick={() => onRemove(show.id)}
            style={{ ...s.actionBtn, color: "#333" }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]           = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [loading, setLoading]           = useState(true);
  const [profile, setProfile]           = useState(null);
  const [shows, setShows]               = useState([]);
  const [tab, setTab]                   = useState("shows");
  const [filter, setFilter]             = useState("all");
  const [search, setSearch]             = useState("");
  const [addOpen, setAddOpen]           = useState(false);
  const [aiQuery, setAiQuery]           = useState("");
  const [aiResult, setAiResult]         = useState(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newArtist, setNewArtist]       = useState("");
  const [tmEvents, setTmEvents]         = useState([]);
  const [tmLoading, setTmLoading]       = useState(false);
  const [tmError, setTmError]           = useState(null);
  const [alertModal, setAlertModal]     = useState(null);
  const [alertEmail, setAlertEmail]     = useState("");
  const [alertSaving, setAlertSaving]   = useState(false);
  const [alertDone, setAlertDone]       = useState(false);
  const [userId, setUserId]             = useState(() => load("showup-userid"));

  // ── Auth init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadUserData(s);
      else { setAuthLoading(false); setLoading(false); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s) loadUserData(s);
        else {
          setProfile(null);
          setShows([]);
          setAuthLoading(false);
          setLoading(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Pre-fill alert email from session
  useEffect(() => {
    if (session?.user?.email) setAlertEmail(session.user.email);
  }, [session]);

  const loadUserData = async (s) => {
    setAuthLoading(false);
    setLoading(true);
    try {
      const dbProfile = await fetchProfile(s.access_token);
      if (dbProfile) {
        const dbShows = dbProfile.shows || [];
        setProfile(dbProfile);
        setShows(dbShows);
        save(STORAGE_KEYS.profile, dbProfile);
        save(STORAGE_KEYS.shows, dbShows);
      } else {
        // First login — migrate localStorage data if present
        const localProfile = load(STORAGE_KEYS.profile);
        const localShows = load(STORAGE_KEYS.shows) || [];
        if (localProfile) {
          setProfile(localProfile);
          setShows(localShows);
          await pushProfile(s.access_token, localProfile, localShows);
        }
        // else: profile stays null → Onboarding renders
      }
    } catch {}
    setLoading(false);
  };

  const syncToCloud = useCallback(
    (nextProfile, nextShows, s = session) => {
      if (!s) return;
      pushProfile(s.access_token, nextProfile, nextShows);
    },
    [session]
  );

  // ── Profile helpers ─────────────────────────────────────────────────────────
  const handleOnboard = (p, sh) => {
    setProfile(p);
    setShows(sh);
    save(STORAGE_KEYS.profile, p);
    save(STORAGE_KEYS.shows, sh);
    syncToCloud(p, sh);
    loadTMEvents(p);
    setTab("find");
  };

  const updateProfile = (updates) => {
    const next = { ...profile, ...updates };
    setProfile(next);
    save(STORAGE_KEYS.profile, next);
    syncToCloud(next, shows);
  };

  // ── Show helpers ────────────────────────────────────────────────────────────
  const addShow = (form) => {
    const show = { ...form, id: Date.now(), saved: false };
    const next = [...shows, show];
    setShows(next);
    save(STORAGE_KEYS.shows, next);
    setAddOpen(false);
    syncToCloud(profile, next);
  };

  const toggleSave = (id) => {
    const next = shows.map((sh) => (sh.id === id ? { ...sh, saved: !sh.saved } : sh));
    setShows(next);
    save(STORAGE_KEYS.shows, next);
    syncToCloud(profile, next);
  };

  const setAlert = (id) => {
    const next = shows.map((sh) =>
      sh.id === id ? { ...sh, ticketStatus: "alert_set" } : sh
    );
    setShows(next);
    save(STORAGE_KEYS.shows, next);
    syncToCloud(profile, next);
  };

  const removeShow = (id) => {
    const next = shows.filter((sh) => sh.id !== id);
    setShows(next);
    save(STORAGE_KEYS.shows, next);
    syncToCloud(profile, next);
  };

  // ── Artist helpers ──────────────────────────────────────────────────────────
  const addArtist = () => {
    const a = newArtist.trim();
    if (!a || profile.artists.includes(a)) return;
    updateProfile({ artists: [...profile.artists, a] });
    setNewArtist("");
  };

  const removeArtist = (a) =>
    updateProfile({ artists: profile.artists.filter((x) => x !== a) });

  const importArtists = (newOnes) => {
    const merged = [...new Set([...profile.artists, ...newOnes])];
    updateProfile({ artists: merged });
  };

  // ── TM Events ───────────────────────────────────────────────────────────────
  const loadTMEvents = async (p) => {
    if (!p?.city) return;
    setTmLoading(true);
    setTmError(null);
    try {
      const events = await fetchTMEvents(p.city, p.genres, p.artists);
      setTmEvents(events);
      if (events.length === 0)
        setTmError(
          `No events found in ${p.city} for your genres. Try refreshing or updating your city in Settings.`
        );
    } catch {
      setTmError("Couldn't load events — check your connection and try again.");
    }
    setTmLoading(false);
  };

  // ── Alert / email flow ──────────────────────────────────────────────────────
  const saveAlert = async (show) => {
    if (!alertEmail.trim()) return;
    setAlertSaving(true);
    try {
      let uid = userId;
      if (!uid) {
        const result = await registerUser(alertEmail, profile);
        uid = result.userId;
        setUserId(uid);
        save("showup-userid", uid);
      }
      await watchShow(uid, show, "add");
      setAlert(show.id);
      setAlertDone(true);
      setTimeout(() => {
        setAlertModal(null);
        setAlertDone(false);
        setAlertEmail(session?.user?.email || "");
      }, 2000);
    } catch (e) {
      console.error(e);
    }
    setAlertSaving(false);
  };

  // ── AI ───────────────────────────────────────────────────────────────────────
  const askAI = async () => {
    if (!aiQuery.trim() || !profile) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const showCtx =
        shows
          .map((sh) => `${sh.artist} @ ${sh.venue}, ${sh.date} [${sh.ticketStatus}]`)
          .join("\n") || "None yet.";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are ShowUp, a concert assistant. User is in ${profile.city}. Taste: ${profile.genres.join(", ")}. Artists: ${profile.artists.join(", ") || "none yet"}. Tracked shows: ${showCtx}. Be direct, specific, practical. For finding events recommend: ra.co (electronic), Songkick/Bandsintown (all genres), local venue sites, Ticketmaster. Keep responses concise with line breaks.`,
          messages: [{ role: "user", content: aiQuery }],
        }),
      });
      const data = await res.json();
      setAiResult(
        data.content?.find((b) => b.type === "text")?.text || "No response."
      );
    } catch {
      setAiResult("Something went wrong. Try again.");
    }
    setAiLoading(false);
  };

  // ── Sign out ─────────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    setProfile(null);
    setShows([]);
    setUserId(null);
    setSettingsOpen(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const sorted = [...shows].sort((a, b) => new Date(a.date) - new Date(b.date));
  const filtered = sorted.filter((sh) => {
    if (filter === "saved" && !sh.saved) return false;
    if (filter === "on_sale" && !["on_sale", "selling_fast"].includes(sh.ticketStatus))
      return false;
    if (filter === "upcoming" && new Date(sh.date + "T23:59:00") < new Date())
      return false;
    if (
      search &&
      ![sh.artist, sh.venue, sh.notes]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const stats = {
    total: shows.length,
    saved: shows.filter((sh) => sh.saved).length,
    onSale: shows.filter((sh) =>
      ["on_sale", "selling_fast"].includes(sh.ticketStatus)
    ).length,
    upcoming: shows.filter(
      (sh) => new Date(sh.date + "T23:59:00") >= new Date()
    ).length,
  };

  // ── Render gates ─────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div
        style={{
          ...s.app,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ color: "#444", letterSpacing: 3, fontSize: 12 }}>
          LOADING...
        </div>
      </div>
    );
  }

  if (!session) return <LoginScreen />;
  if (!profile) return <Onboarding onComplete={handleOnboard} userEmail={session.user.email} />;

  return (
    <div style={s.app}>
      <div style={s.ambient} />

      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.logo}>SHOWUP</div>
          <div style={s.headerRight}>
            <span style={s.cityTag}>📍 {profile.city}</span>
            <button onClick={() => setSettingsOpen(true)} style={s.iconBtn}>
              ⚙
            </button>
          </div>
        </div>
      </header>

      <main style={s.main}>
        {/* Stats */}
        <div style={s.statsRow}>
          {[
            { label: "Tracked", val: stats.total },
            { label: "Upcoming", val: stats.upcoming, color: "#fff" },
            { label: "On Sale", val: stats.onSale, color: "#4ade80" },
            { label: "Saved", val: stats.saved, color: "#f472b6" },
          ].map((st) => (
            <div key={st.label} style={s.statCard}>
              <div style={{ ...s.statVal, color: st.color || "#aaa" }}>
                {st.val}
              </div>
              <div style={s.statLabel}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {[
            { id: "shows", label: "My Shows" },
            { id: "find", label: "Find Shows" },
            { id: "artists", label: "Artists" },
            { id: "ask", label: "Ask AI" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === "find" && tmEvents.length === 0 && !tmLoading)
                  loadTMEvents(profile);
              }}
              style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* MY SHOWS */}
        {tab === "shows" && (
          <div>
            <div style={s.toolbar}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search shows..."
                style={{ ...s.input, flex: 1 }}
              />
              <button onClick={() => setAddOpen(true)} style={s.primaryBtn}>
                + Add Show
              </button>
            </div>
            <div style={s.filterRow}>
              {[
                ["all", "All"],
                ["upcoming", "Upcoming"],
                ["on_sale", "On Sale"],
                ["saved", "Saved"],
              ].map(([f, l]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    ...s.filterChip,
                    ...(filter === f ? s.filterChipActive : {}),
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div style={s.empty}>
                <div style={s.emptyIcon}>🎵</div>
                <div style={s.emptyText}>No shows here yet</div>
                <div style={s.emptyHint}>
                  Use Find Shows to discover events, or add one manually
                </div>
                <button
                  onClick={() => setAddOpen(true)}
                  style={{ ...s.primaryBtn, marginTop: 16 }}
                >
                  + Add Show
                </button>
              </div>
            ) : (
              <div style={s.showList}>
                {filtered.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    onSave={toggleSave}
                    onAlert={setAlertModal}
                    onRemove={removeShow}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* FIND SHOWS */}
        {tab === "find" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <p style={s.discoverIntro}>
                Upcoming events in{" "}
                <strong style={{ color: "#fff" }}>{profile.city}</strong>{" "}
                matching your taste.
              </p>
              <button
                onClick={() => loadTMEvents(profile)}
                style={s.ghostBtn}
                disabled={tmLoading}
              >
                {tmLoading ? "Loading..." : "↻ Refresh"}
              </button>
            </div>
            {tmLoading && (
              <div style={s.empty}>
                <div style={{ color: "#555", letterSpacing: 2, fontSize: 12 }}>
                  SEARCHING...
                </div>
              </div>
            )}
            {!tmLoading && tmError && (
              <div style={s.empty}>
                <div style={s.emptyIcon}>⚠️</div>
                <div style={s.emptyText}>{tmError}</div>
              </div>
            )}
            {!tmLoading && !tmError && tmEvents.length === 0 && (
              <div style={s.empty}>
                <div style={s.emptyIcon}>🔍</div>
                <div style={s.emptyText}>No events found</div>
                <div style={s.emptyHint}>
                  Try updating your city or genres in Settings
                </div>
              </div>
            )}
            {!tmLoading && tmEvents.length > 0 && (
              <div style={s.showList}>
                {tmEvents.map((show) => {
                  const st = STATUS_CONFIG[show.ticketStatus] || STATUS_CONFIG.tba;
                  const tracked = shows.some(
                    (sh) =>
                      sh.id === show.id ||
                      (sh.artist === show.artist && sh.date === show.date)
                  );
                  return (
                    <div key={show.id} style={s.showCard}>
                      <div style={s.showLeft}>
                        <div style={s.showArtist}>{show.artist}</div>
                        <div style={s.showMeta}>
                          {show.venue && <span>{show.venue}</span>}
                          {show.venue && show.date && (
                            <span style={s.dot}>·</span>
                          )}
                          {show.date && (
                            <span>
                              {fmtDate(show.date)}
                              {show.time ? ` · ${show.time}` : ""}
                            </span>
                          )}
                          {show.date && (
                            <span style={{ ...s.daysTag, color: "#a78bfa" }}>
                              {daysAway(show.date)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={s.showRight}>
                        <div
                          style={{
                            ...s.statusBadge,
                            color: st.color,
                            background: st.bg,
                            border: `1px solid ${st.border}`,
                          }}
                        >
                          <span
                            style={{ ...s.statusDot, background: st.color }}
                          />
                          {st.label}
                        </div>
                        {show.price && <div style={s.price}>{show.price}</div>}
                        <div style={s.showActions}>
                          {tracked ? (
                            <span style={{ fontSize: 11, color: "#555" }}>
                              ✓ Tracked
                            </span>
                          ) : (
                            <button
                              onClick={() => addShow(show)}
                              style={{
                                ...s.actionBtn,
                                color: "#a78bfa",
                                borderColor: "rgba(167,139,250,0.3)",
                              }}
                            >
                              + Track
                            </button>
                          )}
                          {["announced", "tba"].includes(show.ticketStatus) && (
                            <button
                              onClick={() => setAlertModal(show)}
                              style={{ ...s.actionBtn, color: "#666" }}
                              title="Get notified when tickets go on sale"
                            >
                              🔔
                            </button>
                          )}
                          {show.ticketUrl && (
                            <a
                              href={show.ticketUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                ...s.actionBtn,
                                ...s.buyBtn,
                                textDecoration: "none",
                              }}
                            >
                              Tickets
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ARTISTS */}
        {tab === "artists" && (
          <div>
            <div style={s.toolbar}>
              <input
                value={newArtist}
                onChange={(e) => setNewArtist(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addArtist()}
                placeholder="Add an artist..."
                style={{ ...s.input, flex: 1 }}
                autoFocus
              />
              <button
                onClick={addArtist}
                style={s.primaryBtn}
                disabled={!newArtist.trim()}
              >
                Add
              </button>
            </div>

            <SpotifyUpload existing={profile.artists} onImport={importArtists} />

            {profile.artists.length === 0 ? (
              <div style={s.empty}>
                <div style={s.emptyIcon}>🎤</div>
                <div style={s.emptyText}>No artists yet</div>
                <div style={s.emptyHint}>
                  Add artists to track their upcoming shows specifically
                </div>
              </div>
            ) : (
              <div style={s.artistGrid}>
                {profile.artists.map((artist) => {
                  const aShows = shows.filter(
                    (sh) => sh.artist.toLowerCase() === artist.toLowerCase()
                  );
                  const next = aShows
                    .filter((sh) => new Date(sh.date + "T23:59:00") >= new Date())
                    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                  return (
                    <div key={artist} style={s.artistCard}>
                      <div style={s.artistCardTop}>
                        <div style={s.artistName}>{artist}</div>
                        <button
                          onClick={() => removeArtist(artist)}
                          style={{ ...s.actionBtn, color: "#333", fontSize: 12 }}
                        >
                          ✕
                        </button>
                      </div>
                      {next ? (
                        <div style={s.artistNext}>
                          <span
                            style={{
                              color:
                                STATUS_CONFIG[next.ticketStatus]?.color || "#555",
                            }}
                          >
                            ●
                          </span>{" "}
                          {next.venue || "TBA"} · {fmtDate(next.date)}
                        </div>
                      ) : (
                        <div style={s.artistNoShow}>No upcoming shows tracked</div>
                      )}
                      <div style={s.artistShowCount}>
                        {aShows.length} show{aShows.length !== 1 ? "s" : ""} tracked
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ASK AI */}
        {tab === "ask" && (
          <div>
            <p style={s.discoverIntro}>
              Ask anything about shows, venues, or artists in{" "}
              <strong style={{ color: "#fff" }}>{profile.city}</strong>.
            </p>
            <div style={s.chipRow}>
              {[
                `What shows should I check out in ${profile.city}?`,
                "Who should I discover based on what I like?",
                "Best venues for my taste?",
                "How do I not miss on-sale dates?",
                "What festivals are worth going to?",
              ].map((q) => (
                <button key={q} onClick={() => setAiQuery(q)} style={s.chip}>
                  {q}
                </button>
              ))}
            </div>
            <div style={s.toolbar}>
              <input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAI()}
                placeholder="Ask about shows, artists, venues..."
                style={{ ...s.input, flex: 1 }}
              />
              <button
                onClick={askAI}
                disabled={aiLoading}
                style={{ ...s.primaryBtn, minWidth: 80 }}
              >
                {aiLoading ? "..." : "Ask →"}
              </button>
            </div>
            {aiResult && (
              <div style={s.aiResult}>
                <div style={s.aiResultLabel}>SHOWUP AI</div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                  {aiResult}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {addOpen && (
        <AddShowModal
          artists={profile.artists}
          onAdd={addShow}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div
          style={s.modalOverlay}
          onClick={() => setSettingsOpen(false)}
        >
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>Settings</span>
              <button
                onClick={() => setSettingsOpen(false)}
                style={s.modalClose}
              >
                ×
              </button>
            </div>
            {session?.user?.email && (
              <div style={s.formGroup}>
                <label style={s.label}>Signed in as</label>
                <div style={{ fontSize: 13, color: "#a78bfa", padding: "6px 0" }}>
                  {session.user.email}
                </div>
              </div>
            )}
            <div style={s.formGroup}>
              <label style={s.label}>Your City</label>
              <input
                value={profile.city}
                onChange={(e) => updateProfile({ city: e.target.value })}
                style={s.input}
              />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Genres</label>
              <div style={s.genreGrid}>
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() =>
                      updateProfile({
                        genres: profile.genres.includes(g)
                          ? profile.genres.filter((x) => x !== g)
                          : [...profile.genres, g],
                      })
                    }
                    style={{
                      ...s.genreChip,
                      ...(profile.genres.includes(g) ? s.genreChipActive : {}),
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => loadTMEvents(profile)}
              style={{ ...s.primaryBtn, width: "100%", marginTop: 8 }}
            >
              Refresh Show Results
            </button>
            <button
              onClick={signOut}
              style={{
                ...s.ghostBtn,
                marginTop: 8,
                width: "100%",
                color: "#a78bfa",
                borderColor: "rgba(167,139,250,0.3)",
              }}
            >
              Sign Out
            </button>
            <button
              onClick={() => {
                if (window.confirm("Reset all data? This cannot be undone.")) {
                  signOut();
                }
              }}
              style={{
                ...s.ghostBtn,
                color: "#f87171",
                borderColor: "rgba(248,113,113,0.3)",
                marginTop: 8,
                width: "100%",
              }}
            >
              Reset All Data
            </button>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal && (
        <div
          style={s.modalOverlay}
          onClick={() => {
            setAlertModal(null);
            setAlertDone(false);
          }}
        >
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>🔔 Set Alert</span>
              <button onClick={() => setAlertModal(null)} style={s.modalClose}>
                ×
              </button>
            </div>
            {alertDone ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px 0",
                  color: "#4ade80",
                  fontSize: 15,
                }}
              >
                ✓ Alert set! We'll email you when tickets go on sale.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#fff",
                      marginBottom: 4,
                    }}
                  >
                    {alertModal.artist}
                  </div>
                  <div style={{ fontSize: 13, color: "#666" }}>
                    {alertModal.venue}
                    {alertModal.date ? ` · ${fmtDate(alertModal.date)}` : ""}
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "#666", margin: "0 0 16px" }}>
                  We'll notify you the moment tickets go on sale.
                </p>
                <div style={s.formGroup}>
                  <label style={s.label}>Email</label>
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && saveAlert(alertModal)
                    }
                    placeholder="you@example.com"
                    style={s.input}
                    autoFocus={!session?.user?.email}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setAlertModal(null)}
                    style={{ ...s.ghostBtn, flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveAlert(alertModal)}
                    disabled={alertSaving || !alertEmail.trim()}
                    style={{
                      ...s.primaryBtn,
                      flex: 2,
                      opacity: alertEmail.trim() ? 1 : 0.4,
                    }}
                  >
                    {alertSaving ? "Saving..." : "Notify Me →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = {
  app: { minHeight: "100vh", background: "#07070f", color: "#e2e2f0", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", position: "relative" },
  ambient: { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 70% 50% at 15% 0%, rgba(99,60,255,0.08) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 85% 100%, rgba(244,114,182,0.05) 0%, transparent 55%)" },
  header: { position: "sticky", top: 0, zIndex: 50, background: "rgba(7,7,15,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  headerInner: { maxWidth: 760, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 18, fontWeight: 800, letterSpacing: 4, color: "#fff" },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  cityTag: { fontSize: 12, color: "#555" },
  iconBtn: { background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: "4px 6px" },
  main: { maxWidth: 760, margin: "0 auto", padding: "24px 20px", position: "relative", zIndex: 1 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 },
  statCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" },
  statVal: { fontSize: 24, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 10, color: "#555", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 },
  tabs: { display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 },
  tabBtn: { background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500, padding: "10px 16px", color: "#555", borderBottom: "2px solid transparent", marginBottom: -1, transition: "color 0.15s" },
  tabActive: { color: "#fff", borderBottomColor: "#a78bfa" },
  toolbar: { display: "flex", gap: 8, marginBottom: 12, alignItems: "center" },
  filterRow: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  filterChip: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#555", padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontFamily: "inherit" },
  filterChipActive: { background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.35)", color: "#a78bfa" },
  showList: { display: "flex", flexDirection: "column", gap: 8 },
  showCard: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" },
  showLeft: { flex: 1, minWidth: 0 },
  showArtist: { fontSize: 15, fontWeight: 600, color: "#f0f0f8", marginBottom: 4 },
  showMeta: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, color: "#888" },
  dot: { color: "#333" },
  daysTag: { fontSize: 11, fontWeight: 500 },
  showNotes: { fontSize: 11, color: "#555", marginTop: 4, fontStyle: "italic" },
  showRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 },
  statusBadge: { display: "flex", alignItems: "center", gap: 5, borderRadius: 20, padding: "3px 9px", fontSize: 10, letterSpacing: 0.5, fontWeight: 500 },
  statusDot: { width: 5, height: 5, borderRadius: "50%", flexShrink: 0 },
  price: { fontSize: 12, color: "#666" },
  showActions: { display: "flex", gap: 4 },
  actionBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: 12, fontFamily: "inherit", lineHeight: 1 },
  buyBtn: { background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", fontSize: 11, fontWeight: 600 },
  empty: { textAlign: "center", padding: "60px 20px", color: "#444" },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#666", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#444" },
  artistGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 },
  artistCard: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" },
  artistCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  artistName: { fontSize: 14, fontWeight: 600, color: "#e8e8f8" },
  artistNext: { fontSize: 11, color: "#888", marginBottom: 4 },
  artistNoShow: { fontSize: 11, color: "#444", marginBottom: 4 },
  artistShowCount: { fontSize: 10, color: "#3a3a4a" },
  discoverIntro: { fontSize: 14, color: "#666", marginBottom: 16, lineHeight: 1.6 },
  chipRow: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 },
  chip: { background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.18)", color: "#7c6aaa", padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontFamily: "inherit" },
  aiResult: { background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: 10, padding: "16px 18px", marginTop: 12, fontSize: 13, color: "#ccc" },
  aiResultLabel: { fontSize: 9, letterSpacing: 2, color: "#a78bfa", marginBottom: 10, fontWeight: 600 },
  input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e2f0", padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  select: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e2f0", padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  primaryBtn: { background: "rgba(167,139,250,0.18)", border: "1px solid rgba(167,139,250,0.4)", color: "#c4b5fd", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap" },
  ghostBtn: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#666", padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  label: { display: "block", fontSize: 11, color: "#555", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  formGroup: { marginBottom: 12 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "22px", width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  modalTitle: { fontSize: 15, fontWeight: 700, color: "#fff" },
  modalClose: { background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 },
  onboardWrap: { minHeight: "100vh", background: "#07070f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" },
  onboardCard: { width: "100%", maxWidth: 440, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "36px 32px" },
  onboardStep: { display: "flex", flexDirection: "column" },
  onboardLogo: { fontSize: 32, fontWeight: 800, letterSpacing: 6, color: "#fff", marginBottom: 12 },
  onboardSub: { fontSize: 16, color: "#666", lineHeight: 1.6, margin: "0 0 28px" },
  onboardH2: { fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 6px" },
  onboardHint: { fontSize: 13, color: "#555", margin: "0 0 16px" },
  stepNum: { fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 16 },
  genreGrid: { display: "flex", flexWrap: "wrap", gap: 6 },
  genreChip: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#666", padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontFamily: "inherit" },
  genreChipActive: { background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "#c4b5fd" },
  artistPillContainer: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  artistPill: { display: "flex", alignItems: "center", gap: 6, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#c4b5fd", borderRadius: 20, padding: "4px 10px 4px 12px", fontSize: 13 },
  pillRemove: { background: "none", border: "none", color: "#7c6aaa", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 },
  spotifyBox: { background: "rgba(30,215,96,0.04)", border: "1px solid rgba(30,215,96,0.15)", borderRadius: 10, padding: "16px 18px", marginBottom: 20 },
  spotifyHeader: { fontSize: 13, fontWeight: 600, color: "#aaa", marginBottom: 10 },
  spotifyHint: { fontSize: 12, color: "#555", margin: "0 0 12px", lineHeight: 1.6 },
  spotifyError: { fontSize: 12, color: "#f87171", marginTop: 8 },
};
