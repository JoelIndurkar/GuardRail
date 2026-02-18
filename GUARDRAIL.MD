# GuardRail: Project Objectives & Deliverables

## Overview

**GuardRail** is an autonomous Software Composition Analysis (SCA) platform that monitors JavaScript/TypeScript codebases for deprecated components and known vulnerabilities. Unlike reactive CI/CD checks, GuardRail operates as a continuous sentinel — polling threat intelligence feeds, triggering scans, and surfacing findings through a web dashboard.

---

## Design Constraints

| Constraint | Decision |
|---|---|
| **Language ecosystem** | JavaScript/TypeScript only (`package.json`, `package-lock.json`, `yarn.lock`) |
| **Scanning engine (Tier 1-2)** | Open-source tools (Trivy and/or Grype) — replaced by custom Rust scanner in Tier 3 |
| **Orchestration** | n8n, self-hosted |
| **Output** | Web dashboard UI |
| **Test targets** | Popular open-source JS/TS repos in active development (e.g., `next.js`, `express`, `fastify`) |
| **Budget** | AWS Free Tier wherever possible. Expect $0-10/month for Tier 1, up to $20-30/month for Tier 2+. |
| **Docker proficiency** | Intermediate — used in coursework, not production |

---

## Architecture Overview (All Tiers)

```
┌─────────────────────────────────────────────────────────┐
│                     n8n (Orchestrator)                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ CVE Polling   │  │ Repo Scanner │  │ Results       │  │
│  │ Workflow      │  │ Workflow     │  │ Processor     │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                  │          │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │                  │
          ▼                 ▼                  ▼
   ┌────────────┐   ┌────────────┐     ┌────────────┐
   │ NVD API /  │   │ Trivy /    │     │ PostgreSQL │
   │ GitHub     │   │ Grype /    │     │ (or SQLite │
   │ Advisories │   │ Rust (T3)  │     │  in Tier 1)│
   └────────────┘   └────────────┘     └─────┬──────┘
                                             │
                                             ▼
                                      ┌────────────┐
                                      │ Dashboard  │
                                      │ (React)    │
                                      └────────────┘
```

---

# Tier 1: n8n Automation Core

## Goal
Build a working automated vulnerability monitoring system using n8n as the orchestration brain, existing open-source scanners as the detection engine, and a minimal web dashboard to view results.

## Timeline: 3-4 weeks

## What "Done" Looks Like
A running system where: a new CVE is published for a JS/TS dependency → n8n detects it within its polling interval → n8n triggers a scan of monitored repos → findings are stored in a database → findings appear on a web dashboard with severity and affected repos. You can demo this end-to-end to someone in under 5 minutes.

---

### Subtier 1: n8n Setup & Learning

**Objective**: Get n8n running, understand the workflow model, and build foundational workflows.

#### Deliverables

- [X] **n8n running locally via Docker Compose**
  - `docker-compose.yml` with n8n service and a SQLite volume for persistence
  - Accessible at `localhost:5678`
  - local first, deploy to EC2 in Subtier 3

- [X] **CVE Polling Workflow (v1)**
  - **Trigger**: Cron schedule (every 6 hours is reasonable; NVD rate limits apply)
  - **Steps**:
    1. HTTP Request node → query [NVD API 2.0](https://nvd.nist.gov/developers/vulnerabilities) with `pubStartDate` / `pubEndDate` filtering for JS/TS ecosystem CVEs (keyword filter: `npm`, `node`, `javascript`, `typescript`)
    2. Parse response → extract CVE ID, severity (CVSS score), affected package name, affected version ranges, description
    3. Filter node → only keep CVEs with CVSS ≥ 7.0 (High/Critical)
    4. Store results → write to a local JSON file or SQLite database via n8n's built-in SQLite node
    5. Log output for debugging
  - **NVD API note**: The NVD API is free but rate-limited (5 requests per 30 seconds without API key, 50 with key). Request a free API key at https://nvd.nist.gov/developers/request-an-api-key early in the week.
  - **Success criteria**: Workflow runs on schedule, pulls real CVE data, filters correctly, and persists results.

---

### Subtier 2: Scanning Engine & Results Pipeline

**Objective**: Integrate an actual vulnerability scanner and build the workflow that connects threat detection to repo scanning.

#### Deliverables

- [X] **Trivy installed and working locally**
  - Install [Trivy](https://github.com/aquasecurity/trivy) CLI
  - Confirm it can scan a `package-lock.json` file and produce JSON output: `trivy fs --scanners vuln --format json --output results.json /path/to/repo`
  - Test against 2-3 popular repos by cloning them locally (`express`, `fastify`)
  - *Why Trivy over Grype*: Trivy has better JS/TS ecosystem support and more active maintenance. Can swap later if needed.

- [X] **Repo Scanner Workflow**
  - **Trigger**: Called by CVE Polling Workflow when new high-severity CVEs are found (use n8n's "Execute Workflow" node), OR on a daily cron schedule independently
  - **Steps**:
    1. For each monitored repo (maintain a list — can be hardcoded JSON for now):
       a. Execute shell command via n8n's "Execute Command" node: `git clone --depth 1 <repo_url> /tmp/<repo_name>` (shallow clone for speed)
       b. Execute Trivy scan: `trivy fs --scanners vuln --format json /tmp/<repo_name>`
       c. Parse JSON output
       d. Clean up: `rm -rf /tmp/<repo_name>`
    2. Aggregate all findings
    3. Pass to Results Processor
  - **Monitored repos config**: Start with a simple JSON array stored in n8n's static data or a config file:
    ```json
    [
      {"name": "express", "url": "https://github.com/expressjs/express"},
      {"name": "next.js", "url": "https://github.com/vercel/next.js"},
      {"name": "fastify", "url": "https://github.com/fastify/fastify"}
    ]
    ```
  - **Success criteria**: Workflow clones repos, scans them, produces structured vulnerability data.

- [X] **Results Processor Workflow**
  - **Trigger**: Called by Repo Scanner with scan results
  - **Steps**:
    1. Normalize Trivy output into a consistent schema:
       ```json
       {
         "repo": "express",
         "scan_timestamp": "2026-02-15T10:00:00Z",
         "findings": [
           {
             "cve_id": "CVE-2024-XXXXX",
             "package": "lodash",
             "installed_version": "4.17.15",
             "fixed_version": "4.17.21",
             "severity": "HIGH",
             "cvss_score": 7.4,
             "description": "..."
           }
         ],
         "summary": {
           "critical": 0,
           "high": 3,
           "medium": 12,
           "low": 5
         }
       }
       ```
    2. Write normalized results to SQLite database
    3. Compare against previous scan — flag NEW findings vs. previously known
  - **Success criteria**: Clean, queryable data in SQLite after each scan run.

- [ ] **SQLite database schema**
  ```sql
  CREATE TABLE scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_name TEXT NOT NULL,
    scan_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_critical INTEGER DEFAULT 0,
    total_high INTEGER DEFAULT 0,
    total_medium INTEGER DEFAULT 0,
    total_low INTEGER DEFAULT 0
  );

  CREATE TABLE findings (
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
    status TEXT DEFAULT 'open'  -- open, acknowledged, resolved
  );

  CREATE TABLE monitored_repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    last_scanned DATETIME,
    active BOOLEAN DEFAULT 1
  );
  ```

---

### Subtier 3: Dashboard & Deployment

**Objective**: Build a minimal but functional web dashboard and deploy the full system to AWS.

#### Deliverables

- [ ] **Dashboard backend (Express.js API)**
  - Endpoints:
    - `GET /api/repos` — list all monitored repos with latest scan summary
    - `GET /api/repos/:name/findings` — all findings for a repo, filterable by severity
    - `GET /api/findings/recent` — newest findings across all repos
    - `GET /api/stats` — aggregate stats (total repos, total findings by severity, scan history)
  - Reads from the same SQLite database n8n writes to
  - *Keep this minimal*. No auth, no complex middleware. Express + `better-sqlite3` package.

- [ ] **Dashboard frontend (React)**
  - Single-page application with:
    - **Overview page**: Cards showing each monitored repo with severity counts (color-coded: red/orange/yellow/gray for critical/high/medium/low), last scan timestamp
    - **Repo detail page**: Table of findings for selected repo, sortable by severity/package name, with CVE links to NVD
    - **Recent findings feed**: Chronological list of newly detected vulnerabilities across all repos
  - Tech: React + TypeScript (you know this stack). Use a minimal UI library — Shadcn/ui or even just clean CSS. Don't spend days on styling.
  - *Success criteria*: You can open the dashboard, see which repos have vulnerabilities, drill into details, and identify what needs fixing.

- [ ] **Docker Compose for full local stack**
  - Services:
    - `n8n` (workflow engine)
    - `dashboard-api` (Express backend)
    - `dashboard-ui` (React frontend, served via nginx or Vite preview)
  - Shared SQLite volume between n8n and dashboard-api
  - Single `docker-compose up` starts everything
  - *This is your development environment going forward and your Tier 2 starting point.*

- [ ] **Deploy to AWS EC2 (Free Tier)**
  - `t2.micro` instance (750 free hours/month for 12 months)
  - Install Docker and Docker Compose on the instance
  - Run the same `docker-compose.yml` on EC2
  - Configure security groups to expose:
    - Port 5678 (n8n) — restrict to your IP for security
    - Port 3000 or 80 (dashboard) — can be public for demo purposes
  - *Note*: t2.micro has 1 GB RAM. n8n + Express + React is tight but workable. If it's too constrained, Tier 2 addresses this with proper infrastructure.
  - **Success criteria**: Someone can visit `http://<your-ec2-ip>:3000` and see the dashboard with real scan data.

- [ ] **README.md (v1)**
  - Project description (2-3 sentences — what it does, why it exists)
  - Architecture diagram (the ASCII one above or a cleaner version)
  - Setup instructions (local Docker Compose + AWS deployment)
  - Screenshots of the dashboard
  - *This is what recruiters and interviewers see first. Make it clean from day one.*

#### Tier 1 Completion Criteria
All of the following must be true:
1. n8n polls NVD for new CVEs on a schedule and filters for high-severity JS/TS vulnerabilities
2. When triggered, the system clones monitored repos, scans them with Trivy, and stores normalized results
3. The web dashboard displays findings by repo with severity breakdown and drill-down capability
4. The full stack runs on AWS EC2 via Docker Compose
5. The GitHub repo has a clean README with setup instructions and screenshots

---

# Tier 2: Cloud Infrastructure & Production Hardening

## Goal
Migrate from a single EC2 instance running Docker Compose to a properly architected AWS deployment. Replace SQLite with PostgreSQL, add S3 for report storage, containerize properly, and significantly improve the dashboard.

## Timeline: 4-5 weeks

## What "Done" Looks Like
The system runs on properly separated AWS services. The dashboard is polished enough to demo without caveats. The infrastructure is documented and reproducible. GitHub webhooks enable real-time monitoring of repos (not just scheduled scans).

## Prerequisites
- Tier 1 fully complete and running on EC2
- AWS Free Tier account with billing alerts set up (set a $25 alert so you don't get surprised)

---

### Deliverables

- [ ] **PostgreSQL migration**
  - Replace SQLite with Amazon RDS PostgreSQL (free tier: `db.t3.micro`, 750 hrs/month, 20GB storage)
  - Migrate schema from Tier 1 (expand where needed):
    - Add `dependency_graph` table mapping repos → packages → versions
    - Add `cve_alerts` table tracking which CVEs triggered scans
    - Add indexes for common query patterns
  - Update n8n workflows to write to PostgreSQL (n8n has a native Postgres node)
  - Update Express API to query PostgreSQL (`pg` package)
  - *Why this matters*: SQLite doesn't handle concurrent writes well (n8n and API both accessing it). PostgreSQL is what you'd use in production and it's a skill gap to fill.

- [ ] **S3 integration**
  - Store detailed scan reports as JSON files in S3 (free tier: 5GB)
  - Generate HTML summary reports after each scan run and store in S3
  - Dashboard links to full reports in S3
  - *Purpose*: Demonstrates AWS service integration beyond just compute.

- [ ] **GitHub webhook integration**
  - Add endpoint in Express API: `POST /api/webhooks/github`
  - Configure webhook on monitored repos (or your own test repos) to fire on `push` events to main/master
  - n8n workflow triggered by webhook: scan the updated repo immediately rather than waiting for scheduled scan
  - *Why this matters*: Shifts from purely scheduled scanning to event-driven — a meaningfully different architecture pattern and more realistic for production use.

- [ ] **Dashboard v2**
  - **Enhanced overview**: Trend charts showing vulnerability counts over time (use Recharts — you know React)
  - **Dependency graph view**: Visual showing which packages appear across multiple repos (shared vulnerable dependencies = higher blast radius)
  - **Scan history**: Timeline of scans with diff view (what changed between scans)
  - **Filtering & search**: Filter findings by severity, package name, CVE ID, date range
  - **Export**: Download findings as CSV
  - *Keep it functional, not beautiful. A clean data-dense dashboard impresses more than a polished but shallow one.*

- [ ] **Proper Docker setup**
  - Individual Dockerfiles for each service (not just Docker Compose relying on local code)
  - Multi-stage builds for React frontend (build stage → nginx serve stage)
  - Environment variable configuration (no hardcoded connection strings)
  - Docker Compose for local dev, separate deployment config for AWS

- [ ] **Infrastructure documentation**
  - Architecture diagram showing AWS services and data flow
  - Cost breakdown (what's free tier, what costs money, estimated monthly spend)
  - Deployment runbook (step-by-step to recreate from scratch)
  - Add to README

#### Tier 2 Completion Criteria
1. System runs across multiple AWS services (EC2, RDS, S3) rather than monolithic Docker Compose
2. PostgreSQL stores all data with proper schema and indexing
3. GitHub webhooks trigger real-time scans on code pushes
4. Dashboard shows trends, dependency relationships, and scan history
5. Infrastructure is documented and reproducible
6. Full stack can be torn down and redeployed from documentation alone

---

# Tier 3: Custom Rust Scanner & Scale (Stretch)

## Goal
Replace the off-the-shelf Trivy scanner with a custom Rust-based static analysis tool that can do things Trivy cannot — specifically, tracing code paths to vulnerable function calls rather than just flagging vulnerable package versions. Add LLM-powered remediation suggestions and (optionally) explore Kubernetes deployment.

## Timeline: 6+ weeks

## What "Done" Looks Like
GuardRail's scanner doesn't just say "you have lodash 4.17.15 which has a known CVE." It says "you import `lodash.get` in `src/utils/config.js:42`, and the vulnerable code path is reachable from your Express route handler in `src/routes/api.js:18`." LLM integration provides migration guidance. The system is architecturally ready for horizontal scaling.

## Prerequisites
- Tier 2 fully complete
- Willingness to invest significant time in learning Rust (expect 2 weeks of friction before productivity)

---

### Deliverables

- [ ] **Rust AST scanner for JS/TS**
  - Use [SWC](https://swc.rs/) (Speedy Web Compiler) as the parsing foundation — it's Rust-native and designed for JS/TS
  - Core capability: parse JS/TS files, build import graph, identify which vulnerable packages are actually used (not just installed) and trace the call path
  - Output: JSON report mapping `CVE → package → import location → usage locations`
  - CLI interface: `guardrail-scan --repo /path/to/repo --format json`
  - *This is the technically hardest component. Start with parsing `import` and `require` statements, then expand to call-path tracing.*

- [ ] **Integration with n8n**
  - Replace Trivy scan step in Repo Scanner workflow with the custom Rust binary
  - n8n executes `guardrail-scan` via Execute Command node
  - Results processor updated to handle the richer output format

- [ ] **LLM-powered remediation**
  - After scan identifies vulnerable code paths, send context to Claude API (or Gemini):
    - The vulnerable code snippet
    - The CVE description
    - The package's changelog/migration guide (if available)
  - LLM generates:
    - Explanation of the vulnerability's impact on this specific codebase
    - Suggested code changes to migrate away from the vulnerable function
    - Alternative packages if applicable
  - Display remediation suggestions on the dashboard alongside findings
  - *Budget consideration*: Claude/Gemini API costs money per call. Cache aggressively — same CVE + same package + same usage pattern should return cached guidance.

- [ ] **Horizontal scaling preparation**
  - Redis (ElastiCache free tier or self-hosted) as job queue between n8n and scanner workers
  - n8n enqueues scan jobs → Redis → scanner workers pull and process
  - This decouples orchestration from compute, allowing multiple scanner instances
  - *If staying free tier*: Run Redis in Docker on the same EC2 instance. The architecture supports scaling even if you don't scale yet.

- [ ] **Kubernetes deployment (optional — costs money)/ Oracle deployment (free - long term solution)**
  - If you choose to pursue this:
    - Use k3s (lightweight Kubernetes) on a single EC2 instance rather than EKS ($72/month for EKS control plane alone)
    - Helm charts for each service
    - Demonstrates Kubernetes knowledge without the cost
  - If skipping: Document how the architecture would deploy to Kubernetes. A well-written "Infrastructure Scaling Plan" in the README shows you understand it even if you didn't implement it.

- [ ] **Dashboard v3**
  - Code path visualization: Show the trace from import to usage for vulnerable dependencies
  - Remediation panel: Display LLM-generated migration guidance per finding
  - Scan comparison: Side-by-side diff between scan runs

#### Tier 3 Completion Criteria
1. Custom Rust scanner identifies not just vulnerable packages but actual code-path usage
2. LLM integration provides contextual remediation guidance per finding
3. Job queue architecture decouples scanning from orchestration
4. Dashboard displays code paths and remediation suggestions
5. System is either deployed on Kubernetes or has a documented scaling plan

---

# Cross-Cutting Requirements (All Tiers)

### Documentation
- [ ] README updated at the end of every tier with current architecture, setup instructions, and screenshots
- [ ] `CHANGELOG.md` tracking what was built each week
- [ ] `docs/` folder with architecture decisions (brief — 1 paragraph per major decision explaining what you chose and why)

### Development Practices
- [ ] Git history is clean and tells a story (meaningful commit messages, no "fix stuff" commits)
- [ ] Branches per feature/tier, merged via PR (even if you're the only contributor — this shows discipline)
- [ ] `.env.example` file documenting all required environment variables
- [ ] No secrets committed to the repo. Ever. Use `.gitignore` and environment variables.

### Testing
- [ ] Tier 1: Manual testing is acceptable. Document test scenarios in a `TESTING.md` file.
- [ ] Tier 2: Add at least basic integration tests for the Express API endpoints (Jest or Vitest — you know both)
- [ ] Tier 3: Unit tests for the Rust scanner (Rust has built-in testing — `cargo test`)

### Learning Journal
- [ ] Maintain a `journal/` directory with weekly entries
- [ ] Each entry: what you built, what you struggled with, what you learned, key decisions made
- [ ] *This is interview gold.* When someone asks "tell me about a technical challenge," you'll have specific, detailed, recent examples.

---

# Desired Deliverable Outcomes

**After Tier 1:**
> **GuardRail** — Autonomous vulnerability monitoring platform using n8n workflow automation to orchestrate Trivy scans across JS/TS repositories, with real-time CVE detection via NVD API and a React dashboard for findings visualization. Deployed on AWS EC2.

**After Tier 2:**
> **GuardRail** — Automated SCA platform using n8n orchestration, Trivy scanning, and GitHub webhooks for real-time vulnerability detection across JS/TS codebases. Built with React/TypeScript dashboard, PostgreSQL dependency graph, and S3 report storage on AWS. Features trend analysis, dependency blast-radius mapping, and scan diffing.

**After Tier 3:**
> **GuardRail** — Autonomous SCA platform featuring a custom Rust-based AST scanner (SWC) that traces vulnerable dependency usage to exact code paths, with LLM-powered remediation. Orchestrated via n8n, deployed on AWS with Redis job queuing for horizontal scaling. React/TypeScript dashboard with code-path visualization and contextual migration guidance.

---

