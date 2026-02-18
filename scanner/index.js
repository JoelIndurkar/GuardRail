const express = require('express');
const { execSync } = require('child_process');
const app = express();
app.use(express.json());

app.post('/scan', (req, res) => {
  const { name, url } = req.body;
  
  try {
    execSync(`rm -rf /tmp/${name} && git clone --depth 1 ${url} /tmp/${name}`, { stdio: 'pipe' });
    execSync(`cd /tmp/${name} && npm install --package-lock --legacy-peer-deps 2>/dev/null || true`, { stdio: 'pipe' });
    const result = execSync(`/usr/local/bin/trivy fs --scanners vuln --format json /tmp/${name}`, { stdio: 'pipe' });
    res.json(JSON.parse(result.toString()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    try { execSync(`rm -rf /tmp/${name}`, { stdio: 'pipe' }); } catch {}
  }
});

app.listen(3001, () => console.log('Scanner running on port 3001'));
