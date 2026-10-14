// Nhập Data/SIMACAI.xlsx vào gps.db (SQLite cục bộ)
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const rows = require('./parse')(process.argv[2]);
const db = new DatabaseSync(process.env.DB_PATH || 'gps.db');
db.exec(fs.readFileSync('schema.sql', 'utf8'));
const ins = db.prepare('INSERT INTO to_truong(ma_pgd,ten_pgd,ten_xa,ten_dgd,ten_thon,ma_cif,ten_to_truong,dvut,vi_tri_to_truong,lat,lng,vi_tri_dgd,dgd_lat,dgd_lng) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
rows.forEach(r => ins.run(...r));
console.log(`Đã nhập ${rows.length} dòng, ${rows.filter(r => r[9] == null).length} dòng thiếu/sai tọa độ`);
