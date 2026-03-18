# Brand OS — AI Marketing Operating System

> Autonomous 2026–2028 AI Marketing OS that scans opportunities, launches micro-campaigns,
> optimizes continuously, and compounds growth autonomously.

## System Architecture

```
User Dashboard (Next.js / React Native)
        ↓
API Gateway (Kong / NGINX)
        ↓
Microservices Layer (Node.js + FastAPI)
        ↓
AI Automation Engine (LLM + Vision + Predictive)
        ↓
Distribution Connectors (Official Platform APIs)
        ↓
Data Warehouse + Analytics (ClickHouse + Kafka)
        ↓
Autonomous Optimization Layer (A/B + ML + RL)
        ↓
Human Oversight Layer (Approvals, Budgets, Brand Rules)
```

## Quick Start

```bash
cp brand-os/infra/docker/.env.example .env
# Edit .env with your API keys
docker compose up -d
```

## Repository Structure

```
/brand-os
  /architecture     — System diagrams and protocol docs
  /services         — Microservices (Node.js + FastAPI)
  /agents           — Multi-agent swarm
  /connectors       — Platform API connectors
  /infra            — Docker, Kubernetes configs
  /analytics        — ClickHouse schema + Kafka topics
  /prompts          — Agent system prompts
  /specs            — OpenAPI spec, agent protocol, persona schema
  /docs             — Developer documentation
```

## Services

| Service | Port | Tech |
|---|---|---|
| auth-service | 3001 | Node.js + Express |
| campaign-service | 3002 | Node.js + Express |
| scheduler-service | 3003 | Node.js + BullMQ |
| analytics-service | 3004 | Node.js + ClickHouse |
| ai-engine | 8000 | Python + FastAPI |
| distribution-service | 3005 | Node.js + Express |
| notification-service | 3006 | Node.js + Express |
| crm-service | 3007 | Node.js + Express |

## Documentation

- [Getting Started](brand-os/docs/getting-started.md)
- [Architecture](brand-os/docs/architecture.md)
- [Agent Swarm](brand-os/docs/agents.md)
- [Deployment](brand-os/docs/deployment.md)

## License

MIT © 2026 AiStudi0S
