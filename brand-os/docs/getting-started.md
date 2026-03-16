# Getting Started with Brand OS

## Prerequisites
- Docker 24+
- Docker Compose v2
- Node.js 20+
- Python 3.11+

## Quick Start

1. Clone the repository and navigate to it:
   ```bash
   git clone https://github.com/AiStudi0S/engine.git
   cd engine
   ```

2. Copy the environment template:
   ```bash
   cp brand-os/infra/docker/.env.example .env
   ```
   Edit `.env` with your API keys and secrets.

3. Start the full stack:
   ```bash
   docker compose up -d
   ```

4. Verify services are running:
   ```bash
   curl http://localhost:3001/health  # auth-service
   curl http://localhost:8000/health  # ai-engine
   ```

## Service Ports

| Service | Port |
|---|---|
| auth-service | 3001 |
| campaign-service | 3002 |
| scheduler-service | 3003 |
| analytics-service | 3004 |
| ai-engine | 8000 |
| distribution-service | 3005 |
| notification-service | 3006 |
| crm-service | 3007 |

## Running Individual Services

```bash
# Run auth-service in dev mode
cd brand-os/services/auth-service
npm install
npm run dev

# Run ai-engine in dev mode
cd brand-os/services/ai-engine
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```
