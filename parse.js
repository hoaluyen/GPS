// Đọc SIMACAI.xlsx -> mảng bản ghi, đổi tọa độ DMS sang số thập phân
const X = require('xlsx');

function dms(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)°(\d+)'([\d.]+)"?\s*([NS])\s+(\d+)°(\d+)'([\d.]+)"?\s*([EW])/i);
  if (!m) return null;
  const f = (d, mi, se, h) => (+d + mi / 60 + se / 3600) * (/[SW]/i.test(h) ? -1 : 1);
  return { lat: f(m[1], m[2], m[3], m[4]), lng: f(m[5], m[6], m[7], m[8]) };
}

module.exports = function readRows(file = 'Data/SIMACAI.xlsx') {
  const rows = X.utils.sheet_to_json(X.readFile(file).Sheets.Sheet1, { header: 1 });
  return rows.slice(7).filter(r => r[5]).map(r => {
    const p = dms(r[8]), d = dms(r[9]);
    return [r[0], r[1], r[2], r[3], r[4], String(r[5]), r[6], r[7], r[8] ?? null, p?.lat ?? null, p?.lng ?? null, r[9] ?? null, d?.lat ?? null, d?.lng ?? null];
  });
};
