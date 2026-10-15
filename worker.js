// Cloudflare Worker: API + D1. Giao diện tĩnh nằm trong ./public
const toDms = (v, p, n) => { const h = v >= 0 ? p : n; v = Math.abs(v); const d = Math.floor(v), m = Math.floor((v - d) * 60); return `${d}°${m}'${((v - d - m / 60) * 3600).toFixed(1)}"${h}`; };
const json = (o, status = 200) => Response.json(o, { status });

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
      if (z < 5 || z > 19 || x >= 2 ** z || y >= 2 ** z) return json({ error: 'Bad tile' }, 400);
      const key = new Request(`https://tiles.local/${z}/${x}/${y}.png`);
      let res = await caches.default.match(key);
      if (!res) {
        const up = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, { headers: { 'User-Agent': 'gps-simacai/1.0 (NHCSXH Si Ma Cai internal map)' } });
        if (!up.ok) return new Response('Tile error', { status: 502 });
        res = new Response(up.body, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' } });
        await caches.default.put(key, res.clone());
      }
      return res;
    }

    if (url.pathname === '/api/xa')
      return json((await env.DB.prepare('SELECT DISTINCT ten_xa FROM to_truong ORDER BY ten_xa').all()).results.map(r => r.ten_xa));

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
        `SELECT ${col} ten, COUNT(*) tong, COALESCE(SUM(lat IS NOT NULL),0) da_ghim, COALESCE(SUM(ngay_ghim LIKE ?),0) trong_ky FROM to_truong ${where} GROUP BY ${col} ORDER BY ${col}`
      ).bind(pref ? pref + '%' : '\0', ...args).all()).results;
      const ngay = (await env.DB.prepare(
        `SELECT substr(ngay_ghim,1,10) ngay, COUNT(*) so FROM to_truong ${where} AND ngay_ghim LIKE ? GROUP BY 1 ORDER BY 1`
      ).bind(...args, (pref || '') + '%').all()).results;
      return json({ rows, ngay });
    }

    const m = url.pathname.match(/^\/api\/to-truong\/(\d+)\/vi-tri$/);
    if (url.pathname === '/api/auth') return authed ? json({ ok: true }) : json({ error: 'Sai mã truy cập' }, 401);

    if (m && req.method === 'PUT') {
      if (!authed) return json({ error: 'Sai mã truy cập' }, 401);
      const { lat, lng } = await req.json().catch(() => ({}));
      if (!(lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110)) return json({ error: 'Tọa độ nằm ngoài Việt Nam' }, 400);
      const text = toDms(lat, 'N', 'S') + ' ' + toDms(lng, 'E', 'W');
      const r = await env.DB.prepare("UPDATE to_truong SET lat=?,lng=?,vi_tri_to_truong=?,ngay_ghim=datetime('now','+7 hours') WHERE id=?").bind(lat, lng, text, m[1]).run();
      return r.meta.changes ? json({ ok: true, lat, lng, vi_tri_to_truong: text }) : json({ error: 'Không tìm thấy' }, 404);
    }
    return json({ error: 'Not found' }, 404);
  },
};
