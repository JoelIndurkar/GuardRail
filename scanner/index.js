const express = require('express');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.path === '/health') return next()
  const key = req.headers['x-api-key']
  if (!key || key !== process.env.SCAN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

const DB_PATH = '/data/guardrail.db';
const SCHEMA_PATH = '/app/schema.sql';

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

function initDb() {
  const db = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  db.close();
  console.log('Database initialized');
}

initDb();

app.post('/scan', (req, res) => {
  const { name, url } = req.body;
  try {
    execSync(`rm -rf /tmp/${name} && git clone --depth 1 ${url} /tmp/${name}`, { stdio: 'pipe' });
    execSync(`cd /tmp/${name} && npm install --package-lock --legacy-peer-deps 2>/dev/null || true`, { stdio: 'pipe' });
    const result = execSync(`/usr/local/bin/trivy fs --scanners vuln --format json /tmp/${name}`, { stdio: 'pipe' });
    const trivyOutput = JSON.parse(result.toString());

    const findings = [];
    if (trivyOutput.Results) {
      for (const target of trivyOutput.Results) {
        if (target.Vulnerabilities) {
          for (const vuln of target.Vulnerabilities) {
            findings.push({
              cve_id: vuln.VulnerabilityID,
              package_name: vuln.PkgName,
              installed_version: vuln.InstalledVersion || '',
              fixed_version: vuln.FixedVersion || 'none',
              severity: vuln.Severity,
              cvss_score: vuln.CVSS?.nvd?.V3Score || 0,
              description: vuln.Description || ''
            });
          }
        }
      }
    }

    const summary = {
      critical: findings.filter(f => f.severity === 'CRITICAL').length,
      high: findings.filter(f => f.severity === 'HIGH').length,
      medium: findings.filter(f => f.severity === 'MEDIUM').length,
      low: findings.filter(f => f.severity === 'LOW').length
    };

    const db = getDb();

    const scanInsert = db.prepare(`
      INSERT INTO scans (repo_name, scan_timestamp, total_critical, total_high, total_medium, total_low)
      VALUES (?, datetime('now'), ?, ?, ?, ?)
    `);

    const findingInsert = db.prepare(`
      INSERT INTO findings (scan_id, cve_id, package_name, installed_version, fixed_version, severity, cvss_score, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const repoUpsert = db.prepare(`
      INSERT INTO monitored_repos (name, url, last_scanned, active)
      VALUES (?, ?, datetime('now'), 1)
      ON CONFLICT(name) DO UPDATE SET last_scanned = datetime('now')
    `);

    const insertAll = db.transaction(() => {
      const scan = scanInsert.run(name, summary.critical, summary.high, summary.medium, summary.low);
      for (const f of findings) {
        findingInsert.run(scan.lastInsertRowid, f.cve_id, f.package_name, f.installed_version, f.fixed_version, f.severity, f.cvss_score, f.description);
      }
      repoUpsert.run(name, url);
    });

    insertAll();
    db.close();

    console.log(`Scanned ${name}: ${findings.length} findings`);
    res.json({ repo: name, summary, findings });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { execSync(`rm -rf /tmp/${name}`, { stdio: 'pipe' }); } catch {}
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3001, () => console.log('Scanner running on port 3001'));
