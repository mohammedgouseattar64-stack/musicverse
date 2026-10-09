import express from 'express';
const app = express();
const KEY = process.env.JAMENDO_CLIENT_ID;
const cache = new Map();
const fail = (code, msg) => Object.assign(new Error(msg), { code });

async function get(url, ttl = 600000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.d;
  const r = await fetch(url, { headers: { 'User-Agent': 'MusicVerse/1.0' } });
  if (r.status === 429) throw fail(429, 'The music provider is rate-limiting requests. Try again in a minute.');
  if (!r.ok) throw fail(502, `Music provider returned ${r.status}.`);
  const d = await r.json();
  cache.set(url, { t: Date.now(), d });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return d;
}
const wrap = fn => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (e) { res.status(e.code || 500).json({ error: e.message }); }
};

// Jamendo: Creative Commons catalog, full-length streaming allowed with a free client id.
app.get('/api/tracks', wrap(async req => {
  if (!KEY) throw fail(503, 'Server is missing JAMENDO_CLIENT_ID. See README.');
  const p = new URLSearchParams({ client_id: KEY, format: 'json', limit: Math.min(+req.query.limit || 24, 50),
    imagesize: 300, audioformat: 'mp32', include: 'musicinfo', order: req.query.order || 'popularity_week' });
  for (const k of ['search', 'tags', 'lang', 'artist_name', 'album_name'])
    if (req.query[k]) p.set(k, String(req.query[k]).slice(0, 80));
  const d = await get('https://api.jamendo.com/v3.0/tracks/?' + p);
  if (d.headers?.status !== 'success') throw fail(502, d.headers?.error_message || 'Provider error');
  return d.results.filter(t => t.audio).map(t => ({
    id: 'j' + t.id, title: t.name, artist: t.artist_name, album: t.album_name,
    cover: t.album_image || t.image, src: t.audio, date: t.releasedate, source: 'Jamendo (Creative Commons)' }));
}));

// Internet Archive: only items that declare a license URL.
app.get('/api/archive', wrap(async req => {
  const q = String(req.query.q || '').slice(0, 80).replace(/[()"]/g, '');
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
}));

app.use(express.static('public'));
app.listen(process.env.PORT || 3000, () => console.log('MusicVerse on :' + (process.env.PORT || 3000)));
