// Tạo seed.sql để nạp vào Cloudflare D1 (file chứa dữ liệu cá nhân, không đưa lên git)
const fs = require('fs');
const q = v => v == null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`;
const rows = require('./parse')(process.argv[2]);
const cols = 'ma_pgd,ten_pgd,ten_xa,ten_dgd,ten_thon,ma_cif,ten_to_truong,dvut,vi_tri_to_truong,lat,lng,vi_tri_dgd,dgd_lat,dgd_lng';
fs.writeFileSync('seed.sql', fs.readFileSync('schema.sql', 'utf8') + rows.map(r => `INSERT INTO to_truong(${cols}) VALUES(${r.map(q).join(',')});\n`).join(''));
console.log(`seed.sql: ${rows.length} dòng`);
