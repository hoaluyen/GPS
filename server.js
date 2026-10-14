const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.DB_PATH || 'gps.db');
const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use('/api', (req, res, next) => (!process.env.UPDATE_KEY || req.get('x-update-key') === process.env.UPDATE_KEY) ? next() : res.status(401).json({ error: 'Sai mã truy cập' }));
const toDms = (v, p, n) => { const h = v >= 0 ? p : n; v = Math.abs(v); const d = Math.floor(v), m = Math.floor((v - d) * 60); return `${d}°${m}'${((v - d - m / 60) * 3600).toFixed(1)}"${h}`; };
// Cập nhật vị trí tổ trưởng (đặt UPDATE_KEY để yêu cầu mã khi cập nhật)
app.put('/api/to-truong/:id/vi-tri', (req, res) => {
  const lat = +req.body.lat, lng = +req.body.lng;
  if (!(lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110)) return res.status(400).json({ error: 'Tọa độ nằm ngoài Việt Nam' });
  const text = toDms(lat, 'N', 'S') + ' ' + toDms(lng, 'E', 'W');
  const r = db.prepare('UPDATE to_truong SET lat=?,lng=?,vi_tri_to_truong=? WHERE id=?').run(lat, lng, text, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json({ ok: true, lat, lng, vi_tri_to_truong: text });
});
app.get('/api/to-truong', (req, res) => {
  const { xa, q } = req.query;
  let sql = 'SELECT * FROM to_truong WHERE lat IS NOT NULL';
  const args = [];
  if (xa) { sql += ' AND ten_xa=?'; args.push(xa); }
  if (q) { sql += ' AND (ten_to_truong LIKE ? OR ten_thon LIKE ? OR ma_cif LIKE ?)'; args.push(...Array(3).fill(`%${q}%`)); }
  res.json(db.prepare(sql).all(...args));
});
app.get('/api/xa', (req, res) =>
  res.json(db.prepare('SELECT DISTINCT ten_xa FROM to_truong ORDER BY ten_xa').all().map(r => r.ten_xa)));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('http://localhost:3000'));
