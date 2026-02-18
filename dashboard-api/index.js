const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = '/data/guardrail.db';

function getDb() {
  const db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = WAL');
  return db;
}

// List all monitored repos with latest scan summary
app.get('/api/repos', (req, res) => {
  const db = getDb();
  const repos = db.prepare(`
    SELECT r.name, r.url, r.last_scanned,
      s.total_critical, s.total_high, s.total_medium, s.total_low
    FROM monitored_repos r
    LEFT JOIN scans s ON s.id = (
      SELECT id FROM scans WHERE repo_name = r.name ORDER BY scan_timestamp DESC LIMIT 1
    )
    WHERE r.active = 1
  `).all();
  db.close();
  res.json(repos);
});

// All findings for a specific repo
app.get('/api/repos/:name/findings', (req, res) => {
  const db = getDb();
  const { severity } = req.query;
  let query = `
    SELECT f.* FROM findings f
    JOIN scans s ON f.scan_id = s.id
    WHERE s.repo_name = ? AND s.id = (
      SELECT id FROM scans WHERE repo_name = ? ORDER BY scan_timestamp DESC LIMIT 1
    )
  `;
  const params = [req.params.name, req.params.name];
  if (severity) {
    query += ` AND f.severity = ?`;
    params.push(severity.toUpperCase());
  }
  const findings = db.prepare(query).all(...params);
  db.close();
  res.json(findings);
});

// Recent findings across all repos
app.get('/api/findings/recent', (req, res) => {
  const db = getDb();
  const findings = db.prepare(`
    SELECT f.*, s.repo_name, s.scan_timestamp
    FROM findings f
    JOIN scans s ON f.scan_id = s.id
    ORDER BY f.first_detected DESC
    LIMIT 50
  `).all();
  db.close();
  res.json(findings);
});

// Aggregate stats
app.get('/api/stats', (req, res) => {
  const db = getDb();
  const totals = db.prepare(`
    SELECT 
      COUNT(DISTINCT repo_name) as total_repos,
      SUM(total_critical) as critical,
      SUM(total_high) as high,
      SUM(total_medium) as medium,
      SUM(total_low) as low
    FROM scans
    WHERE id IN (
      SELECT MAX(id) FROM scans GROUP BY repo_name
    )
  `).get();
  const history = db.prepare(`
    SELECT repo_name, scan_timestamp, total_critical, total_high, total_medium, total_low
    FROM scans ORDER BY scan_timestamp DESC LIMIT 20
  `).all();
  db.close();
  res.json({ totals, history });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3002, () => console.log('Dashboard API running on port 3002'));
