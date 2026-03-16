# Deployment Guide

## Docker Compose (Development / Staging)

```bash
docker compose up -d
docker compose ps
docker compose logs -f ai-engine
```

## Kubernetes (Production)

```bash
# Create namespace
kubectl apply -f brand-os/infra/kubernetes/namespace.yaml

# Create secrets
kubectl create secret generic brand-os-secrets \
  --from-literal=jwt-secret="$(openssl rand -base64 32)" \
  --from-literal=database-url="postgresql://brandos:password@postgres:5432/brandos" \
  --from-literal=redis-url="redis://redis:6379" \
  --from-literal=openai-api-key="sk-..." \
  --from-literal=anthropic-api-key="sk-ant-..." \
  -n brand-os

# Deploy services
kubectl apply -f brand-os/infra/kubernetes/services/
kubectl get pods -n brand-os
```

## Scaling

```bash
# Scale campaign-service to handle more load
kubectl scale deployment campaign-service --replicas=5 -n brand-os

# Scale micro-creator agents
kubectl scale deployment micro-creator-agent --replicas=20 -n brand-os
```

## Health Checks

All services expose `/health` endpoints returning:
```json
{ "status": "ok", "service": "service-name" }
```
