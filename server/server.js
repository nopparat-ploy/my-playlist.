// server/server.js — REST API สำหรับจัดการ "เพลงที่ฉันชอบ"
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'songs.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- จัดการข้อมูล (อ่าน/เขียนไฟล์ JSON) ----------
function loadSongs() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}
function saveSongs(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}
let songs = loadSongs();
const nextId = () => (songs.length ? Math.max(...songs.map(s => s.id)) + 1 : 1);

// ---------- ตรวจสอบข้อมูล ----------
function validateSong(body, partial = false) {
  const errors = [];
  const has = k => body[k] !== undefined;

  if (!partial || has('title')) {
    if (typeof body.title !== 'string' || !body.title.trim()) errors.push('title (ชื่อเพลง) ห้ามว่าง');
  }
  if (!partial || has('artist')) {
    if (typeof body.artist !== 'string' || !body.artist.trim()) errors.push('artist (ศิลปิน) ห้ามว่าง');
  }
  if (!partial || has('genre')) {
    if (typeof body.genre !== 'string' || !body.genre.trim()) errors.push('genre (แนวเพลง) ห้ามว่าง');
  }
  if (has('spotifyUrl') && body.spotifyUrl) {
    if (typeof body.spotifyUrl !== 'string' || !/^https:\/\/open\.spotify\.com\//.test(body.spotifyUrl.trim()))
      errors.push('spotifyUrl ต้องเป็นลิงก์ที่ขึ้นต้นด้วย https://open.spotify.com/');
  }
  return errors;
}

function pickFields(body) {
  const out = {};
  if (body.title !== undefined) out.title = String(body.title).trim();
  if (body.artist !== undefined) out.artist = String(body.artist).trim();
  if (body.genre !== undefined) out.genre = String(body.genre).trim();
  if (body.spotifyUrl !== undefined) out.spotifyUrl = body.spotifyUrl ? String(body.spotifyUrl).trim() : null;
  return out;
}

// ---------- Routes ----------

// GET /api/songs — ดึงทั้งหมด รองรับ ?genre= ?artist= ?q= ?sort=
app.get('/api/songs', (req, res) => {
  const { genre, artist, q, sort } = req.query;
  let result = [...songs];

  if (genre) result = result.filter(s => s.genre.toLowerCase() === String(genre).toLowerCase());
  if (artist) result = result.filter(s => s.artist.toLowerCase().includes(String(artist).toLowerCase()));
  if (q) {
    const kw = String(q).toLowerCase();
    result = result.filter(s => s.title.toLowerCase().includes(kw) || s.artist.toLowerCase().includes(kw));
  }
  // เรียงตามตัวอักษร ไม่สนตัวพิมพ์เล็ก/ใหญ่ และเรียงตัวเลขตามค่า
  const byText = key => (a, b) => a[key].localeCompare(b[key], 'en', { sensitivity: 'base', numeric: true });
  if (sort === 'artist') result.sort(byText('artist'));
  if (sort === 'title') result.sort(byText('title'));

  res.json(result);
});

// GET /api/genres — รายชื่อแนวเพลงทั้งหมดพร้อมจำนวนเพลง (endpoint เสริม)
app.get('/api/genres', (req, res) => {
  const counts = {};
  songs.forEach(s => { counts[s.genre] = (counts[s.genre] || 0) + 1; });
  res.json(Object.entries(counts).map(([name, count]) => ({ name, count })));
});

// GET /api/songs/:id — ดึงเพลงเดียว
app.get('/api/songs/:id', (req, res) => {
  const song = songs.find(s => s.id === Number(req.params.id));
  if (!song) return res.status(404).json({ error: `ไม่พบเพลง id ${req.params.id}` });
  res.json(song);
});

// POST /api/songs — เพิ่มเพลงใหม่
app.post('/api/songs', (req, res) => {
  const errors = validateSong(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'ข้อมูลไม่ครบหรือไม่ถูกต้อง', details: errors });

  const song = { id: nextId(), spotifyUrl: null, ...pickFields(req.body) };
  songs.push(song);
  saveSongs(songs);
  res.status(201).json(song);
});

// PATCH /api/songs/:id — แก้ไขบางส่วน
app.patch('/api/songs/:id', (req, res) => {
  const idx = songs.findIndex(s => s.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: `ไม่พบเพลง id ${req.params.id}` });

  const errors = validateSong(req.body || {}, true);
  if (errors.length) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง', details: errors });

  songs[idx] = { ...songs[idx], ...pickFields(req.body) };
  saveSongs(songs);
  res.json(songs[idx]);
});

// DELETE /api/songs/:id — ลบเพลง
app.delete('/api/songs/:id', (req, res) => {
  const idx = songs.findIndex(s => s.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: `ไม่พบเพลง id ${req.params.id}` });
  songs.splice(idx, 1);
  saveSongs(songs);
  res.status(204).end();
});

// API path ที่ไม่มีอยู่
app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ endpoint นี้' }));

// JSON ผิดรูปแบบ
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON ไม่ถูกต้อง' });
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
});

app.listen(PORT, () => console.log(`🎵 Music API พร้อมใช้งานที่ http://localhost:${PORT}`));
