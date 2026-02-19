# GuardRail

Autonomous Software Composition Analysis (SCA) platform that continuously monitors JavaScript/TypeScript repositories for known vulnerabilities and deprecated dependencies. Unlike reactive CI/CD checks, GuardRail operates as a persistent sentinel — polling threat intelligence feeds, triggering scans, and surfacing findings through a live web dashboard.

**Live dashboard:** https://grscan.duckdns.org
<img width="1918" height="585" alt="image" src="https://github.com/user-attachments/assets/42e670f8-c51d-4167-8162-cda35fe7118b" />
<img width="417" height="175" alt="image" src="https://github.com/user-attachments/assets/4ae9ca94-ff37-4052-85b9-676a05ede646" /><img width="1233" height="351" alt="image" src="https://github.com/user-attachments/assets/2b31bea2-3021-4795-b501-9c3c61da7c5c" />


---

## Architecture
(Diagram via Claude)
```
┌────────────────────────────────────────────────────────┐
│                   n8n (Orchestrator)                   │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ CVE Polling  │  │ Repo Scanner │  │   Results    │  │
│  │ Workflow     │  │ Workflow     │  │   Processor  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │
          ▼                 ▼                 ▼
   ┌────────────┐   ┌────────────┐     ┌────────────┐
   │ NVD API /  │   │   Trivy    │     │   SQLite   │
   │ GitHub     │   │  Scanner   │     │ Database   │
   │ Advisories │   │ Microserv. │     │            │
   └────────────┘   └────────────┘     └─────┬──────┘
                                             │
                                             ▼
                                      ┌────────────┐
                                      │  Dashboard │
                                      │   (React)  │
                                      └────────────┘
```

### Request Flow
1. n8n polls NVD API every 6 hours for new higher-rated CVEs affecting npm packages
2. When found, n8n triggers the scanner microservice
3. Scanner clones monitored repos (shallow), runs Trivy vulnerability analysis, stores results
4. Dashboard API serves normalized findings from SQLite
5. React dashboard displays findings by repo with severity breakdown and NVD links

---

## Tech Stack
```
+==================+===================================+
| Layer            | Technology                        |
|==================+===================================|
| Orchestration    | n8n (self-hosted)                 |
| Scanning Engine  | Trivy                             |
| Backend API      | Express.js + better-sqlite3       |
| Frontend         | React + TypeScript + Tailwind CSS |
| Reverse Proxy    | Caddy (automatic HTTPS)           |
| Database         | SQLite (→ PostgreSQL in Tier 2)   |
| Infrastructure   | AWS EC2 t3.micro                  |
| Containerization | Docker Compose                    |
+==================+===================================+
```
---

## API Endpoints
```
+========+=============================+===================================================+
| Method | Endpoint                    | Description                                       |
|========+=============================+===================================================|
| `POST` | `:3001/scan`                | Trigger a repo scan (requires `x-api-key` header) |
| `GET`  | `/api/repos`                | All monitored repos with latest scan summary      |
| `GET`  | `/api/repos/:name/findings` | Findings for a specific repo                      |
| `GET`  | `/api/findings/recent`      | 50 most recent findings across all repos          |
| `GET`  | `/api/stats`                | Aggregate stats and scan history                  |
+========+=============================+===================================================+
```
---

## Local Development

### Prerequisites
- Docker and Docker Compose
- Node.js 20+

### Setup
```bash
git clone https://github.com/JoelIndurkar/GuardRail.git
cd GuardRail
cp .env.example .env
# Fill in your values in .env
docker compose up -d
```

Dashboard available at `http://localhost:80`

### Trigger a scan manually
```bash
curl -X POST http://localhost:3001/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SCAN_API_KEY" \
  -d '{"name": "express", "url": "https://github.com/expressjs/express"}'
```

### Access n8n (via SSH tunnel on EC2)
```bash
ssh -i ~/.ssh/guardrail-key.pem -L 5678:localhost:5678 ubuntu@<ec2-ip>
# Then visit http://localhost:5678
```

---

## Deployment (AWS EC2)
```bash
# SSH into EC2
ssh -i ~/.ssh/guardrail-key.pem ubuntu@<ec2-ip>

# Clone and configure
git clone https://github.com/JoelIndurkar/GuardRail.git
cd GuardRail
cp .env.example .env
nano .env  # fill in secrets

# Start stack
docker compose up -d
```

Caddy automatically provisions TLS certificates via Let's Encrypt on first boot.

---

## Security

- Scanner endpoint requires API key authentication (`x-api-key` header)
- n8n admin interface is not publicly exposed — accessible only via SSH tunnel
- Internal services (scanner, dashboard API) have no public ports
- Dashboard API rate limited to 100 requests per 15 minutes per IP
- All secrets managed via `.env` — never committed to version control

---

## Roadmap

## Roadmap

**Tier 2 (In Progress)**
- PostgreSQL migration (replacing SQLite) on AWS RDS
- GitHub webhook integration for real-time scanning on push events
- S3 report storage and HTML report generation
- Dashboard v2: trend charts, scan history diff, dependency blast-radius view
- Integration tests for API endpoints
- SSRF protection on scanner endpoint (GitHub URL whitelist)
- Sandbox isolation for `/tmp` clone directory (prevent malicious repo escapes)
- Restart policies and health checks for all containers
- n8n workflow error handling and failure notifications
- Trivy output validation and malformed JSON handling
- CloudWatch logging and uptime alerting
- Dashboard basic auth

**Tier 3 (Planned)**
- Custom Rust-based AST scanner (SWC) — traces vulnerable dependencies to exact code paths
- Redis job queue for horizontal scaling
- Secrets scanning integration (Gitleaks) — detect committed credentials in monitored repos
- Dashboard v3: code path visualization, contextual migration guidance
- Backup strategy for PostgreSQL

**Tier 4 (Stretch)**
- LLM-powered remediation suggestions via Claude API
- Multi-user authentication system
- Per-user repo management — users monitor and view only their own repositories
- Role-based access control
- Oracle Cloud migration for always-free long-term hosting

---

## License

MIT
