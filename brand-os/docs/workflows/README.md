# Workflows

## Overview

Brand OS workflows define the end-to-end automated processes that run across
the agent swarm, services, and connectors.

## Workflow 1 — New Campaign Launch

```
1. User creates campaign in dashboard (campaign-service)
2. campaign-service emits `campaign.created` event to Kafka
3. brand-intelligence-agent is triggered → scans for relevant trends
4. campaign-strategy-agent designs platform allocation + schedule
5. content-studio-agent generates content variations
6. compliance-agent reviews all content
7. scheduler-service queues posts via BullMQ
8. distribution-agent publishes on schedule
9. analytics-agent begins tracking
10. RL loop starts after first 48h
```

## Workflow 2 — Trend Opportunity Capture

```
1. brand-intelligence-agent detects rising trend (opportunity_score > 0.85)
2. Emits `trend_opportunity` event with high priority
3. campaign-strategy-agent designs opportunistic micro-campaign
4. content-studio-agent fast-tracks content (< 2h turnaround)
5. compliance-agent expedited review
6. distribution-agent publishes within 4h of trend detection
```

## Workflow 3 — Persona Onboarding

```
1. Operator requests new persona via dashboard
2. persona-creator-agent generates persona schema
3. Persona stored in PostgreSQL registry
4. micro-creator-agent-template instance provisioned (Kubernetes)
5. Content calendar generated for first 4 weeks
6. First post scheduled within 24h
```

## Workflow 4 — RL Optimization Cycle

```
1. scheduler-service triggers RL cycle (every 6h in first 48h, then 24h)
2. analytics-agent computes current state + reward
3. If reward < threshold:
   a. campaign-strategy-agent generates new variant parameters
   b. content-studio-agent creates new content variant
   c. compliance-agent reviews
   d. distribution-agent deploys at next scheduled slot
4. Metrics logged to ClickHouse for next cycle
```

## Workflow 5 — Compliance Rejection Handling

```
1. compliance-agent returns compliance_status: "rejected"
2. Distribution blocked automatically
3. Human operator notified via notification-service
4. Operator reviews in dashboard
5. If approved with changes: content-studio-agent regenerates
6. If rejected: campaign paused pending review
```
