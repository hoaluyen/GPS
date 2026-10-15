DROP TABLE IF EXISTS to_truong;
CREATE TABLE to_truong(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ma_pgd TEXT, ten_pgd TEXT, ten_xa TEXT, ten_dgd TEXT, ten_thon TEXT,
  ma_cif TEXT, ten_to_truong TEXT, dvut TEXT,
  vi_tri_to_truong TEXT, lat REAL, lng REAL,
  vi_tri_dgd TEXT, dgd_lat REAL, dgd_lng REAL,
  ngay_ghim TEXT);
