// Shared API logic used by both the production Express server (server.js)
// and the Vite dev-server middleware. Kept framework-agnostic: each route
// returns a plain object or throws { code, message }.
//
// SECURITY: JAMENDO_CLIENT_ID is read server-side only and never exposed to
// the browser. The frontend calls /api/* routes, which proxy to Jamendo with
// the key appended here. Load .env so local dev picks it up automatically.
import 'dotenv/config';
const key = () => process.env.JAMENDO_CLIENT_ID;
const cache = new Map();
const fail = (code, msg) => Object.assign(new Error(msg), { code });

// Jamendo's free tier intermittently returns empty result sets (HTTP 200,
// status=success, zero results) when requests arrive too quickly. Serialize
// outbound calls and retry up to twice on an empty filtered response.
let chain = Promise.resolve();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function jamendoFetch(url, { expectResults = false } = {}) {
  let d = await get(url);
  if (expectResults) {
    for (let i = 0; i < 2 && d.results && d.results.length === 0 && d.headers?.status === 'success'; i++) {
      await sleep(1500);
      d = await get(url, { force: true });
    }
  }
  return d;
}

async function get(url, ttl = 600000, { force = false } = {}) {
  if (!force) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.t < ttl) return hit.d;
  }
  const next = chain.then(() => fetch(url, { headers: { 'User-Agent': 'MusicVerse/1.0' } }));
  chain = next.then(() => sleep(800), () => sleep(800));
  const r = await next;
  if (r.status === 429) throw fail(429, 'The music provider is rate-limiting requests. Try again in a minute.');
  if (!r.ok) throw fail(502, `Music provider returned ${r.status}.`);
  const d = await r.json();
  // Only cache non-empty Jamendo responses; empty ones are usually transient
  // rate-limit artifacts that should not be served on retry.
  if (!d.results || d.results.length > 0) cache.set(url, { t: Date.now(), d });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return d;
}

// Jamendo: Creative Commons catalog, full-length streaming allowed with a free client id.
async function tracks(query) {
  const KEY = key();
  if (!KEY) throw fail(503, 'Server is missing JAMENDO_CLIENT_ID. See README.');
  const p = new URLSearchParams({ client_id: KEY, format: 'json', limit: Math.min(+query.limit || 24, 50),
    imagesize: 300, audioformat: 'mp32', include: 'musicinfo', order: query.order || 'popularity_week' });
  for (const k of ['search', 'tags', 'artist_name', 'album_name'])
    if (query[k]) p.set(k, String(query[k]).slice(0, 80));
  // Jamendo filters by vocal language via 'vocallanguage', not 'lang'. The
  // frontend sends 'lang' (e.g. 'hi', 'pa', 'en'); map it through here so the
  // existing home/explore chips keep working.
  if (query.lang) p.set('vocallanguage', String(query.lang).slice(0, 80));
  const filtered = Boolean(query.search || query.tags || query.lang || query.artist_name || query.album_name || query.order);
  const d = await jamendoFetch('https://api.jamendo.com/v3.0/tracks/?' + p, { expectResults: filtered });
  if (d.headers?.status !== 'success') throw fail(502, d.headers?.error_message || 'Provider error');
  return d.results.filter(t => t.audio).map(t => ({
    id: 'j' + t.id, title: t.name, artist: t.artist_name, album: t.album_name,
    cover: t.album_image || t.image, src: t.audio, date: t.releasedate, source: 'Jamendo (Creative Commons)' }));
}

// Internet Archive: only items that declare a license URL.
async function archive(query) {
  const q = String(query.q || '').slice(0, 80).replace(/[()"]/g, '');
  const s = await get('https://archive.org/advancedsearch.php?output=json&rows=6&fl[]=identifier&fl[]=title&fl[]=creator&q=' +
    encodeURIComponent(`${q} AND mediatype:audio AND licenseurl:*`));
  const out = await Promise.all((s.response?.docs || []).map(async d => {
    try {
      const m = await get('https://archive.org/metadata/' + d.identifier, 3600000);
      const f = (m.files || []).find(f => /mp3$/i.test(f.name) && /MP3/i.test(f.format || ''));
      if (!f) return null;
      return { id: 'a' + d.identifier, title: d.title, artist: [].concat(d.creator || 'Unknown')[0], album: '',
        cover: 'https://archive.org/services/img/' + d.identifier,
        src: `https://archive.org/download/${d.identifier}/${encodeURIComponent(f.name)}`,
        date: m.metadata?.date, source: 'Internet Archive (licensed)' };
    } catch { return null; }
  }));
  return out.filter(Boolean);
}

// Route table: path -> handler(query) => JSON
export const routes = {
  '/api/tracks': tracks,
  '/api/archive': archive,
};

// Helper used by both Express and the Vite middleware to send a JSON response.
export async function sendJson(handler, query, res) {
  try { res.status(200).json(await handler(query)); }
  catch (e) { res.status(e.code || 500).json({ error: e.message }); }
}
