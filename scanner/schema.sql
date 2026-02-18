CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_name TEXT NOT NULL,
  scan_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_critical INTEGER DEFAULT 0,
  total_high INTEGER DEFAULT 0,
  total_medium INTEGER DEFAULT 0,
  total_low INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER REFERENCES scans(id),
  cve_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  installed_version TEXT,
  fixed_version TEXT,
  severity TEXT NOT NULL,
  cvss_score REAL,
  description TEXT,
  first_detected DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS monitored_repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  last_scanned DATETIME,
  active BOOLEAN DEFAULT 1
);
