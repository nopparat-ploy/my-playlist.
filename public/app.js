// public/app.js — ฝั่งไคลเอนต์ เรียก REST API ของตัวเองผ่าน fetch()
const API = '/api/songs';

const $ = id => document.getElementById(id);
const form = $('songForm');
const list = $('songList');
const dialog = $('songDialog');

let activeGenre = '';
let current = [];        // รายการเพลงที่แสดงอยู่ตอนนี้
let nowId = null;        // id เพลงที่กำลัง "เล่น"
let searchTimer;

// ---------- ช่วยเหลือ ----------
function toast(msg) {
  const t = $('toast');
  $('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hueOf(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
// สีปกเพลง: เลือกจากชุดสีพาสเทลตามชื่อเพลง (ได้สีเดิมทุกครั้ง)
const PALETTE = ['#6fa8f5', '#7fd08a', '#f5c94e', '#e9545c', '#b58cf0', '#ff8fb8', '#52c7c0', '#ff9f5a'];
function colorOf(text) { return PALETTE[hueOf(text) % PALETTE.length]; }
function coverStyle(s) {
  const c = colorOf(s.artist + s.title);
  return `background:linear-gradient(145deg, ${c}, color-mix(in srgb, ${c} 82%, #000))`;
}
// ลิงก์ Spotify: ใช้ลิงก์ที่บันทึกไว้ ถ้าไม่มีจะเปิดหน้าค้นหาเพลงนั้นใน Spotify
// (เป็นแค่ลิงก์ให้ผู้ใช้กดไปฟัง ไม่ได้ดึงข้อมูลจาก API ภายนอก)
function spotifyLink(s) {
  return s.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(`${s.title} ${s.artist}`)}`;
}
function openSpotify(s) {
  window.open(spotifyLink(s), '_blank', 'noopener');
}

// ---------- READ ----------
async function loadSongs() {
  const params = new URLSearchParams();
  if (activeGenre) params.set('genre', activeGenre);
  if ($('search').value.trim()) params.set('q', $('search').value.trim());
  if ($('sort').value) params.set('sort', $('sort').value);

  const res = await fetch(`${API}?${params}`);
  current = await res.json();
  $('listCount').textContent = `${current.length} เพลง`;
  renderSongs(current);
}

async function loadGenres() {
  const genres = await fetch('/api/genres').then(r => r.json());
  const all = genres.reduce((n, g) => n + g.count, 0);
  if (activeGenre && !genres.some(g => g.name === activeGenre)) activeGenre = '';

  const items = [{ name: '', label: 'เพลงทั้งหมด', count: all }, ...genres.map(g => ({ ...g, label: g.name }))];
  $('folders').innerHTML = items.map(g => `
    <button class="folder ${activeGenre === g.name ? 'active' : ''}" data-genre="${escapeHtml(g.name)}" title="${escapeHtml(g.label)}">
      <span class="folder-art">${FOLDER_SVG}<span class="badge">${g.count}</span></span>
      <span class="folder-label">
        <span class="mini-cover" style="background:${g.name ? colorOf(g.name) : '#111'}">${g.name ? '♪' : '★'}</span>
        <span><b>${escapeHtml(g.label)}</b><small>${g.count} songs</small></span>
      </span>
    </button>`).join('');
  $('genreList').innerHTML = genres.map(g => `<option value="${escapeHtml(g.name)}">`).join('');

  $('plSub').textContent = `เพลงที่ฉันชอบ · Top ${all}`;
  $('listTitle').textContent = activeGenre || 'เพลงทั้งหมด';
  $('stats').textContent = `มีเพลงทั้งหมด ${all} เพลง ใน ${genres.length} แนวเพลง 🎧 เลือกโฟลเดอร์เพื่อกรองตามแนวเพลง`;
}

function renderSongs(songs) {
  $('empty').classList.toggle('hidden', songs.length > 0);
  list.innerHTML = songs.map((s, i) => `
    <li class="song ${s.id === nowId ? 'now' : ''}" data-id="${s.id}">
      <span class="num">${i + 1}</span>
      <div class="t-cell">
        <div class="cover" style="${coverStyle(s)}">${escapeHtml(s.title.charAt(0).toUpperCase())}</div>
        <div class="t-text">
          <h3><a href="${escapeHtml(spotifyLink(s))}" target="_blank" rel="noopener" title="ฟังใน Spotify">${escapeHtml(s.title)}</a></h3>
          <div class="artist">${escapeHtml(s.artist)}</div>
        </div>
      </div>
      <span class="tag">${escapeHtml(s.genre)}</span>
      <div class="acts">
        <a class="icon-btn sp" href="${escapeHtml(spotifyLink(s))}" target="_blank" rel="noopener" title="ฟังใน Spotify">▶</a>
        <button class="icon-btn" data-action="edit" title="แก้ไข">✎</button>
        <button class="icon-btn del" data-action="delete" title="ลบ">🗑</button>
      </div>
    </li>`).join('');
}

async function refresh() {
  try {
    await loadGenres();
    await loadSongs();
  } catch (err) {
    showServerError();
  }
}

// ถ้าเปิดไฟล์ index.html ตรง ๆ (file://) หรือยังไม่ได้รันเซิร์ฟเวอร์ จะดึงข้อมูลไม่ได้
function showServerError() {
  $('empty').classList.remove('hidden');
  $('empty').innerHTML = `
    <b>⚠ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</b><br>
    ต้องรันเซิร์ฟเวอร์ก่อน: เปิด command prompt ในโฟลเดอร์โปรเจกต์ แล้วพิมพ์
    <code>npm install</code> และ <code>npm run dev</code><br>
    จากนั้นเปิดเว็บที่ <a href="http://localhost:3000">http://localhost:3000</a>
    (อย่าดับเบิลคลิกเปิดไฟล์ index.html โดยตรง)`;
}

// ---------- CREATE / UPDATE ----------
function openAdd() {
  resetForm();
  dialog.showModal();
  $('title').focus();
}
$('openAdd').addEventListener('click', openAdd);

form.addEventListener('submit', async e => {
  e.preventDefault();
  clearInvalid();

  const body = {
    title: $('title').value,
    artist: $('artist').value,
    genre: $('genre').value,
    spotifyUrl: $('spotifyUrl').value.trim() || null,
  };
  const id = $('songId').value;

  const res = await fetch(id ? `${API}/${id}` : API, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!res.ok) {
    markInvalid(data.details || []);   // 400 → ไฮไลต์ช่องที่ยังไม่ได้กรอก / กรอกผิด
    return;
  }
  toast(id ? `แก้ไขเพลง "${data.title}" เรียบร้อยแล้ว ✎` : `เพิ่มเพลง "${data.title}" ลงใน playlist แล้ว 💚`);
  dialog.close();
  resetForm();
  if (data.id === nowId) setNowPlaying(data);
  refresh();
});

async function startEdit(id) {
  const s = await fetch(`${API}/${id}`).then(r => r.json());
  resetForm();
  $('songId').value = s.id;
  $('title').value = s.title;
  $('artist').value = s.artist;
  $('genre').value = s.genre;
  $('spotifyUrl').value = s.spotifyUrl ?? '';
  $('formTitle').textContent = 'แก้ไขเพลง';
  $('submitBtn').textContent = 'บันทึกการแก้ไข';
  dialog.showModal();
}

function resetForm() {
  form.reset();
  $('songId').value = '';
  clearInvalid();
  $('formTitle').textContent = 'เพิ่มเพลงใหม่';
  $('submitBtn').textContent = 'เพิ่มเพลง';
}
$('cancelBtn').addEventListener('click', () => dialog.close());
form.addEventListener('input', e => e.target.closest('label')?.classList.remove('invalid'));

// ไฮไลต์ช่องที่ผิดจากรายการ error ของเซิร์ฟเวอร์ เช่น "title (ชื่อเพลง) ห้ามว่าง" → ช่อง title
function markInvalid(details) {
  const fields = details.map(d => d.split(' ')[0]).filter(f => $(f));
  fields.forEach(f => $(f).closest('label').classList.add('invalid'));
  if (fields.length) $(fields[0]).focus();
  const box = form.querySelector('.group');
  box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
}
function clearInvalid() {
  form.querySelectorAll('.invalid').forEach(l => l.classList.remove('invalid'));
}

// ---------- ปุ่มในแต่ละแถว ----------
list.addEventListener('click', async e => {
  const li = e.target.closest('.song');
  if (!li) return;
  const id = Number(li.dataset.id);
  const song = current.find(s => s.id === id);
  const title = song.title;

  if (e.target.closest('a')) {                 // กดชื่อเพลง / ปุ่ม ▶ = ลิงก์ไป Spotify
    setNowPlaying(song);
    return;
  }
  const btn = e.target.closest('button[data-action]');
  if (!btn) {                                   // กดที่แถว = เปิดเพลงนี้ใน Spotify
    setNowPlaying(song);
    openSpotify(song);
    return;
  }
  if (btn.dataset.action === 'edit') startEdit(id);


  if (btn.dataset.action === 'delete') {
    if (!confirm(`ลบเพลง "${title}" ใช่ไหม?`)) return;
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    if (res.status === 204) {
      toast(`ลบเพลง "${title}" ออกจาก playlist แล้ว 🗑`);
      if (id === nowId) clearNowPlaying();
      refresh();
    }
  }
});

// ---------- ตัวกรอง (โฟลเดอร์แนวเพลง) ----------
$('folders').addEventListener('click', e => {
  const f = e.target.closest('.folder');
  if (f) { activeGenre = f.dataset.genre; refresh(); }
});
$('sort').addEventListener('change', loadSongs);
$('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadSongs, 250);
});

// ---------- แถบ Now playing: เพลงที่เลือกล่าสุด + ปุ่มเปิดใน Spotify ----------
function setNowPlaying(s) {
  if (!s) return;
  nowId = s.id;
  $('npTitle').textContent = s.title;
  $('npArtist').textContent = s.artist;
  $('npCover').textContent = s.title.charAt(0).toUpperCase();
  $('npCover').setAttribute('style', coverStyle(s) + ';color:#fff');
  $('spOpen').href = spotifyLink(s);
  $('spOpen').classList.remove('off');
  document.querySelectorAll('.song').forEach(li => li.classList.toggle('now', Number(li.dataset.id) === nowId));
}
function clearNowPlaying() {
  nowId = null;
  $('npTitle').textContent = 'เลือกเพลงที่อยากฟัง';
  $('npArtist').textContent = 'คลิกที่เพลงในรายการ';
  $('npCover').textContent = '♪'; $('npCover').removeAttribute('style');
  $('spOpen').href = '#'; $('spOpen').classList.add('off');
}
function step(dir) {                            // เลื่อนไปเพลงก่อนหน้า/ถัดไป (ยังไม่เปิด Spotify)
  if (!current.length) return;
  const i = current.findIndex(s => s.id === nowId);
  setNowPlaying(current[(i + dir + current.length) % current.length]);
}
const nowSong = () => current.find(s => s.id === nowId);
$('playBtn').addEventListener('click', () => {
  if (!nowSong() && current.length) setNowPlaying(current[0]);
  if (nowSong()) openSpotify(nowSong());
});
$('playAll').addEventListener('click', () => {
  if (!current.length) return;
  setNowPlaying(current[0]);
  openSpotify(current[0]);
});
$('shuffleBtn').addEventListener('click', () => {       // สุ่มเพลงแล้วเปิดใน Spotify
  if (!current.length) return;
  const s = current[Math.floor(Math.random() * current.length)];
  setNowPlaying(s);
  openSpotify(s);
});
$('nextBtn').addEventListener('click', () => step(1));
$('prevBtn').addEventListener('click', () => step(-1));

// ---------- ไอคอนโฟลเดอร์ (SVG) ----------
const FOLDER_SVG = `<svg viewBox="0 0 130 100" aria-hidden="true">
  <defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3a3a8"/><stop offset="1" stop-color="#6c6c71"/></linearGradient>
  <linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d8d92"/><stop offset="1" stop-color="#5d5d62"/></linearGradient></defs>
  <path d="M6 14a7 7 0 0 1 7-7h32l9 9h63a7 7 0 0 1 7 7v68a7 7 0 0 1-7 7H13a7 7 0 0 1-7-7z" fill="url(#fb)"/>
  <rect x="11" y="22" width="108" height="30" rx="3" fill="#fbfbfb"/>
  <path d="M3 34a7 7 0 0 1 7-7h110a7 7 0 0 1 7 7l-4 55a7 7 0 0 1-7 7H14a7 7 0 0 1-7-7z" fill="url(#fg)"/>
  <path d="M65 44l6.2 12.6 13.9 2-10 9.8 2.4 13.8L65 75.7l-12.5 6.5 2.4-13.8-10-9.8 13.9-2z" fill="#3c3c40" opacity=".85"/>
</svg>`;

// ---------- ลายโดเดิลด้านหลัง (ดาว หัวใจ จุด) ----------
function drawDoodles() {
  const W = window.innerWidth, H = window.innerHeight;
  const shapes = {
    star: c => `<path d="M12 2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 16.8 6.1 20.1l1.3-6.6L2.5 8.9l6.6-.8z" fill="${c}" stroke="${c}" stroke-width="2.4" stroke-linejoin="round"/>`,
    heart: c => `<path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z" fill="${c}"/>`,
    outline: () => `<path d="M12 1.5l3 6.8 7.4.7-5.6 5 1.7 7.3L12 17.5l-6.5 3.8 1.7-7.3-5.6-5 7.4-.7z" fill="none" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>`,
    burst: () => `<path d="M12 1l1.8 7 6.6-3.2-4.3 5.9 6.9 1.3-7 1.6 3.9 6-6-3.8L12 23l-1.9-7.2-6 3.8 3.9-6-7-1.6 6.9-1.3-4.3-5.9 6.6 3.2z" fill="#111"/>`,
    dot: c => `<circle cx="12" cy="12" r="5" fill="${c}"/>`,
  };
  const colors = { star: ['#6fa8f5', '#7fd08a', '#f5d94e', '#9cc2f7'], heart: ['#e9545c'], dot: ['#e9545c', '#6fa8f5', '#7fd08a', '#f5d94e', '#b58cf0'] };
  const kinds = ['star', 'star', 'star', 'heart', 'heart', 'outline', 'burst', 'dot', 'dot', 'dot'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);   // สุ่มแบบกำหนด seed ได้ลายเดิมทุกครั้ง
  const n = Math.round((W * H) / 26000);
  let html = '';
  for (let i = 0; i < n; i++) {
    const k = kinds[Math.floor(rnd() * kinds.length)];
    const pal = colors[k] || ['#111'];
    const c = pal[Math.floor(rnd() * pal.length)];
    const size = k === 'dot' ? 10 + rnd() * 6 : 18 + rnd() * 18;
    html += `<svg viewBox="0 0 24 24" style="left:${(rnd() * 100).toFixed(2)}%;top:${(rnd() * 100).toFixed(2)}%;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;transform:rotate(${Math.floor(rnd() * 60 - 30)}deg)">${shapes[k](c)}</svg>`;
  }
  $('doodles').innerHTML = html;
}

drawDoodles();
window.addEventListener('resize', () => { clearTimeout(drawDoodles.t); drawDoodles.t = setTimeout(drawDoodles, 200); });
refresh();
