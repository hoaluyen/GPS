// Cloudflare Worker: API + D1. Giao diện tĩnh nằm trong ./public
const toDms = (v, p, n) => { const h = v >= 0 ? p : n; v = Math.abs(v); const d = Math.floor(v), m = Math.floor((v - d) * 60); return `${d}°${m}'${((v - d - m / 60) * 3600).toFixed(1)}"${h}`; };
const json = (o, status = 200) => Response.json(o, { status });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!env.ACCESS_KEY || req.headers.get('x-update-key') !== env.ACCESS_KEY) return json({ error: 'Sai mã truy cập' }, 401);

    if (url.pathname === '/api/xa')
      return json((await env.DB.prepare('SELECT DISTINCT ten_xa FROM to_truong ORDER BY ten_xa').all()).results.map(r => r.ten_xa));

    if (url.pathname === '/api/to-truong' && req.method === 'GET') {
      const xa = url.searchParams.get('xa'), q = url.searchParams.get('q');
      let sql = 'SELECT * FROM to_truong WHERE lat IS NOT NULL'; const args = [];
      if (xa) { sql += ' AND ten_xa=?'; args.push(xa); }
      if (q) { sql += ' AND (ten_to_truong LIKE ? OR ten_thon LIKE ? OR ma_cif LIKE ?)'; args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
      return json((await env.DB.prepare(sql).bind(...args).all()).results);
    }

    const m = url.pathname.match(/^\/api\/to-truong\/(\d+)\/vi-tri$/);
    if (m && req.method === 'PUT') {
      const { lat, lng } = await req.json().catch(() => ({}));
      if (!(lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110)) return json({ error: 'Tọa độ nằm ngoài Việt Nam' }, 400);
      const text = toDms(lat, 'N', 'S') + ' ' + toDms(lng, 'E', 'W');
      const r = await env.DB.prepare('UPDATE to_truong SET lat=?,lng=?,vi_tri_to_truong=? WHERE id=?').bind(lat, lng, text, m[1]).run();
      return r.meta.changes ? json({ ok: true, lat, lng, vi_tri_to_truong: text }) : json({ error: 'Không tìm thấy' }, 404);
    }
    return json({ error: 'Not found' }, 404);
  },
};
