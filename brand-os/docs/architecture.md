# Architecture Reference

See [system-overview.md](../architecture/system-overview.md) for the full system diagram.

## Technology Stack

### Frontend
- Next.js 14
- React 18
- Tailwind CSS
- React Native (mobile)

### Backend Services
- Node.js 20 + Express 4
- Python 3.11 + FastAPI

### Databases
- PostgreSQL 15 (transactional data)
- Redis 7 (caching, queues, sessions)
- ClickHouse (analytics warehouse)

### Message Broker
- Apache Kafka + Zookeeper

### Job Queue
- BullMQ (backed by Redis)

### AI/ML
- OpenAI GPT-4o (primary LLM)
- Anthropic Claude (fallback LLM)
- Custom predictive models (performance prediction)

### Infrastructure
- Docker + Docker Compose (local/staging)
- Kubernetes (production)
- AWS / GCP / Cloudflare

## Security

- JWT (HS256) for service authentication (upgrade to RS256 with asymmetric keys when deploying to production)
- OAuth 2.0 for platform connectors
- Rate limiting on all public endpoints
- Secrets via Kubernetes Secrets / AWS Secrets Manager
- RBAC for user authorization
- Audit logging for all state-changing operations

## Monetization

| Plan | Price | Features |
|---|---|---|
| Starter | $19/mo | 3 platforms, 10 campaigns/mo, basic analytics |
| Pro | $79/mo | All platforms, unlimited campaigns, advanced analytics, AI optimization |
| Agency | $299/mo | Multi-brand, white-label, API access, dedicated support |
