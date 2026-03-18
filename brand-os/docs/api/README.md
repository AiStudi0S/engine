# API Documentation

## Base URLs

| Service | Local | Production |
|---|---|---|
| auth-service | http://localhost:3001 | https://api.brandos.ai/auth |
| campaign-service | http://localhost:3002 | https://api.brandos.ai/campaigns |
| ai-engine | http://localhost:8000 | https://api.brandos.ai/ai |
| crm-service | http://localhost:3007 | https://api.brandos.ai/crm |

## Authentication

The following endpoints are **unauthenticated** (no JWT required):
- `GET /health` (all services)
- `POST /api/auth/register`
- `POST /api/auth/login`

All other endpoints require a JWT Bearer token in production:

```
Authorization: Bearer <token>
```

Obtain a token via `POST /api/auth/login`.

> **Note:** In this scaffold, `campaign-service` and `crm-service` do not yet
> enforce JWT validation at the service level. JWT enforcement is intended to
> be handled at the API Gateway layer (Kong/NGINX) in production. Individual
> service-level auth middleware will be added in a future iteration.

## Full API Spec

See [`/specs/api-spec.yaml`](../../specs/api-spec.yaml) for the complete OpenAPI 3.1 specification.

## Key Endpoints

### Auth
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login, receive JWT
- `POST /api/auth/refresh` — Refresh JWT

### Campaigns
- `GET /api/campaigns` — List all campaigns
- `POST /api/campaigns` — Create campaign
- `GET /api/campaigns/:id` — Get campaign by ID
- `PATCH /api/campaigns/:id` — Update campaign (partial)
- `DELETE /api/campaigns/:id` — Delete campaign

### AI Engine
- `POST /api/copy/generate` — Generate ad copy variations
- `POST /api/audience/match` — Match campaign to audience segments
- `POST /api/performance/predict` — Predict campaign performance

### CRM
- `GET /api/leads` — List leads
- `POST /api/leads` — Create lead
- `GET /api/leads/:id` — Get lead by ID
- `PATCH /api/leads/:id` — Update lead (score, status, etc.)
