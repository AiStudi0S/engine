# Brand OS — System Architecture

## Overview

Brand OS is a 2026–2028 AI Marketing Operating System that operates as a
multi-agent swarm to autonomously generate, publish, optimize, and scale
marketing campaigns across all major platforms.

## System Layers

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

## Services

| Service | Port | Description |
|---|---|---|
| auth-service | 3001 | JWT auth, RBAC, OAuth 2.0 |
| campaign-service | 3002 | Campaign CRUD, lifecycle management |
| scheduler-service | 3003 | BullMQ job scheduling |
| analytics-service | 3004 | Metrics ingestion and reporting |
| ai-engine | 8000 | FastAPI LLM + prediction models |
| distribution-service | 3005 | Multi-platform publishing |
| notification-service | 3006 | Push/email/SMS notifications |
| crm-service | 3007 | Lead management, scoring, follow-ups |

## Agent Swarm

All agents communicate via Apache Kafka using the Agent Message Protocol
defined in `/specs/agent-protocol.json`.

| Agent | Input Topic | Output Topic |
|---|---|---|
| brand-intelligence-agent | agent.brand-intelligence.in | agent.brand-intelligence.out |
| content-studio-agent | agent.content-studio.in | agent.content-studio.out |
| campaign-strategy-agent | agent.campaign-strategy.in | agent.campaign-strategy.out |
| distribution-agent | agent.distribution.in | agent.distribution.out |
| audience-growth-agent | agent.audience-growth.in | agent.audience-growth.out |
| revenue-optimization-agent | agent.revenue-optimization.in | agent.revenue-optimization.out |
| analytics-agent | agent.analytics.in | agent.analytics.out |
| compliance-agent | agent.compliance.in | agent.compliance.out |
| persona-creator-agent | agent.persona-creator.in | agent.persona-creator.out |
| micro-creator-agent | agent.micro-creator.in | agent.micro-creator.out |

## Data Flow

```
Create Campaign
    → AI Engine generates copy + targeting
    → Campaign Strategy Agent selects platforms + budget
    → Scheduler queues posts
    → Distribution Agent publishes to platforms
    → Analytics Agent collects metrics
    → Optimization loop: A/B test → engage → refine
```
