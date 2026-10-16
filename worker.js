// Cloudflare Worker: API + D1. Giao diện tĩnh nằm trong ./public
const toDms = (v, p, n) => { const h = v >= 0 ? p : n; v = Math.abs(v); const d = Math.floor(v), m = Math.floor((v - d) * 60); return `${d}°${m}'${((v - d - m / 60) * 3600).toFixed(1)}"${h}`; };
const json = (o, status = 200) => Response.json(o, { status });
// Lỗi theo mẫu V2.1 §19.4: {code, message, request_id, details?}
const fail = (status, code, message, details) => json({ code, message, request_id: crypto.randomUUID(), ...(details ? { details } : {}) }, status);
const km = (a, b, c, d) => { const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r * Math.cos((a + c) * r / 2); return 6371 * Math.hypot(x, y); };
const ACCURACY_WARN_M = 50, AREA_WARN_KM = 15; // GPS-V02, GPS-V03 (ngưỡng cấu hình, chờ ngân hàng chốt)

// Nhật ký tọa độ bất biến: giữ bản cũ, nguồn, sai số, lý do (V2.0 §4.1, §4.2)
let logReady;
const initLog = env => logReady || (logReady = env.DB.prepare(
  `CREATE TABLE IF NOT EXISTS gps_log(id INTEGER PRIMARY KEY AUTOINCREMENT, to_truong_id INTEGER NOT NULL,
   lat_cu REAL, lng_cu REAL, lat REAL, lng REAL, do_chinh_xac INTEGER, nguon TEXT, ly_do TEXT, canh_bao TEXT, ip TEXT, thoi_gian TEXT)`
).run().catch(e => { logReady = null; throw e; }));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    const authed = !!env.ACCESS_KEY && req.headers.get('x-update-key') === env.ACCESS_KEY;
    // Công khai: chỉ xem, ẩn mã CIF. Có mã: xem đầy đủ và cập nhật.
    const pub = r => { if (authed) return r; const { ma_cif, vi_tri_dgd, ...rest } = r; return rest; };

    // Tải hộ ô bản đồ OSM (cho máy bị chặn kết nối trực tiếp tới OSM), có lưu đệm
    const t = url.pathname.match(/^\/api\/tile\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.png$/);
    if (t) {
      const [z, x, y] = t.slice(1).map(Number);
      if (z < 5 || z > 19 || x >= 2 ** z || y >= 2 ** z) return fail(400, 'BAD_TILE', 'Ô bản đồ không hợp lệ');
      const key = new Request(`https://tiles.local/${z}/${x}/${y}.png`);
      let res = await caches.default.match(key);
      if (!res) {
        const up = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, { headers: { 'User-Agent': 'gps-simacai/1.0 (NHCSXH Si Ma Cai internal map)' } });
        if (!up.ok) return fail(502, 'PROVIDER_UNAVAILABLE', 'Không tải được ô bản đồ');
        res = new Response(up.body, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' } });
        await caches.default.put(key, res.clone());
      }
      return res;
    }

    if (url.pathname === '/api/xa')
      return json((await env.DB.prepare('SELECT DISTINCT ten_xa FROM to_truong ORDER BY ten_xa').all()).results.map(r => r.ten_xa));

    // Kiểm tra sức khỏe dịch vụ (chỉ người có mã)
    if (url.pathname === '/api/health') {
      if (!authed) return fail(401, 'UNAUTHORIZED', 'Sai mã truy cập');
      const t0 = Date.now();
      try { await env.DB.prepare('SELECT 1').first(); } catch (e) { return fail(503, 'DB_UNAVAILABLE', 'Không truy cập được cơ sở dữ liệu'); }
      return json({ ok: true, db_ms: Date.now() - t0 });
    }

    if (url.pathname === '/api/to-truong' && req.method === 'GET') {
      const xa = url.searchParams.get('xa'), q = url.searchParams.get('q');
      let sql = 'SELECT * FROM to_truong WHERE lat IS NOT NULL'; const args = [];
      if (xa) { sql += ' AND ten_xa=?'; args.push(xa); }
      if (q) { sql += authed ? ' AND (ten_to_truong LIKE ? OR ten_thon LIKE ? OR ma_cif LIKE ?)' : ' AND (ten_to_truong LIKE ? OR ten_thon LIKE ?)'; args.push(`%${q}%`, `%${q}%`); if (authed) args.push(`%${q}%`); }
      return json((await env.DB.prepare(sql).bind(...args).all()).results.map(pub));
    }

    if (url.pathname === '/api/thong-ke') {
      const xa = url.searchParams.get('xa'), thang = +url.searchParams.get('thang') || 0, nam = +url.searchParams.get('nam') || 0;
      const col = { xa: 'ten_xa', thon: 'ten_thon', dgd: 'ten_dgd' }[url.searchParams.get('pham_vi')] || 'ten_xa';
      const where = xa ? 'WHERE ten_xa=?' : 'WHERE 1=1', args = xa ? [xa] : [];
      const pref = nam ? (thang ? `${nam}-${String(thang).padStart(2, '0')}` : `${nam}`) : '';
      const rows = (await env.DB.prepare(
        `SELECT ${col} ten, COUNT(*) tong, COALESCE(SUM(lat IS NOT NULL),0) da_ghim, COALESCE(SUM(ngay_ghim LIKE ?),0) trong_ky,
         COALESCE(SUM(ngay_ghim >= datetime('now','+7 hours','-30 days')),0) ba_muoi FROM to_truong ${where} GROUP BY ${col} ORDER BY ${col}`
      ).bind(pref ? pref + '%' : '\0', ...args).all()).results;
      const ngay = (await env.DB.prepare(
        `SELECT substr(ngay_ghim,1,10) ngay, COUNT(*) so FROM to_truong ${where} AND ngay_ghim LIKE ? GROUP BY 1 ORDER BY 1`
      ).bind(...args, (pref || '') + '%').all()).results;
      return json({ rows, ngay, as_of: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ') });
    }

    if (url.pathname === '/api/auth') return authed ? json({ ok: true }) : fail(401, 'UNAUTHORIZED', 'Sai mã truy cập');

    const h = url.pathname.match(/^\/api\/to-truong\/(\d+)\/lich-su$/);
    if (h && req.method === 'GET') {
      if (!authed) return fail(401, 'UNAUTHORIZED', 'Sai mã truy cập');
      await initLog(env);
      return json((await env.DB.prepare('SELECT lat_cu,lng_cu,lat,lng,do_chinh_xac,nguon,ly_do,canh_bao,thoi_gian FROM gps_log WHERE to_truong_id=? ORDER BY id DESC LIMIT 10').bind(h[1]).all()).results);
    }

    const m = url.pathname.match(/^\/api\/to-truong\/(\d+)\/vi-tri$/);
    if (m && req.method === 'PUT') {
      if (!authed) return fail(401, 'UNAUTHORIZED', 'Sai mã truy cập');
      const b = await req.json().catch(() => ({}));
      const lat = +b.lat, lng = +b.lng;
      if (!(lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110)) return fail(400, 'GPS_OUT_OF_RANGE', 'Tọa độ nằm ngoài Việt Nam');
      const nguon = b.source === 'MANUAL' ? 'MANUAL' : 'DEVICE_GPS'; // nhập tay phải gắn nguồn và lý do (V2.0 §4.1)
      const lyDo = String(b.ly_do || '').trim().slice(0, 300);
      if (nguon === 'MANUAL' && !lyDo) return fail(400, 'GPS_REASON_REQUIRED', 'Chọn vị trí thủ công cần nhập lý do');
      const acc = b.accuracy != null && Number.isFinite(+b.accuracy) ? Math.round(+b.accuracy) : null;
      const cur = await env.DB.prepare('SELECT id,ten_xa,lat,lng FROM to_truong WHERE id=?').bind(m[1]).first();
      if (!cur) return fail(404, 'NOT_FOUND', 'Không tìm thấy');

      // Cảnh báo (không tự kết luận sai): sai số lớn, trùng tọa độ, lệch khỏi địa bàn xã
      const warns = [];
      if (nguon === 'DEVICE_GPS' && acc != null && acc > ACCURACY_WARN_M)
        warns.push({ code: 'GPS_ACCURACY_REVIEW_REQUIRED', message: `Sai số GPS lớn (~${acc}m, ngưỡng ${ACCURACY_WARN_M}m)` });
      const dup = (await env.DB.prepare('SELECT ten_to_truong FROM to_truong WHERE id!=? AND abs(lat-?)<0.000005 AND abs(lng-?)<0.000005').bind(cur.id, lat, lng).all()).results;
      if (dup.length) warns.push({ code: 'GPS_DUPLICATE', message: 'Trùng tọa độ với: ' + dup.slice(0, 3).map(r => r.ten_to_truong).join(', ') + (dup.length > 3 ? '…' : '') });
      const c = await env.DB.prepare('SELECT AVG(lat) a, AVG(lng) o, COUNT(*) n FROM to_truong WHERE ten_xa=? AND id!=? AND lat IS NOT NULL').bind(cur.ten_xa, cur.id).first();
      if (c && c.n >= 3) { const d = km(lat, lng, c.a, c.o); if (d > AREA_WARN_KM) warns.push({ code: 'GPS_OUT_OF_AREA', message: `Cách trung tâm xã ${cur.ten_xa} khoảng ${Math.round(d)} km` }); }
      if (warns.length && !b.force) return fail(409, 'GPS_WARNING', 'Tọa độ cần xác nhận trước khi lưu', warns);

      await initLog(env);
      const text = toDms(lat, 'N', 'S') + ' ' + toDms(lng, 'E', 'W');
      await env.DB.batch([
        env.DB.prepare("UPDATE to_truong SET lat=?,lng=?,vi_tri_to_truong=?,ngay_ghim=datetime('now','+7 hours') WHERE id=?").bind(lat, lng, text, cur.id),
        env.DB.prepare("INSERT INTO gps_log(to_truong_id,lat_cu,lng_cu,lat,lng,do_chinh_xac,nguon,ly_do,canh_bao,ip,thoi_gian) VALUES(?,?,?,?,?,?,?,?,?,?,datetime('now','+7 hours'))")
          .bind(cur.id, cur.lat, cur.lng, lat, lng, acc, nguon, lyDo || null, warns.map(w => w.code).join(',') || null, req.headers.get('cf-connecting-ip')),
      ]);
      return json({ ok: true, lat, lng, vi_tri_to_truong: text });
    }
    return fail(404, 'NOT_FOUND', 'Không tìm thấy');
  },
};
