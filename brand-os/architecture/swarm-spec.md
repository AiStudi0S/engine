# Brand OS — Swarm Architecture Spec

## Overview

The Brand OS Agent Swarm is a multi-agent system where specialized AI agents
collaborate autonomously via Apache Kafka to run the full marketing lifecycle —
from trend detection through content creation, publishing, and optimization.

## Swarm Topology

```
                    ┌─────────────────────┐
                    │  Brand Intelligence │
                    │       Agent         │
                    └────────┬────────────┘
                             │ trends_analyzed
                             ▼
                    ┌─────────────────────┐
                    │  Campaign Strategy  │
                    │       Agent         │
                    └────────┬────────────┘
                             │ campaign_planned
                        ┌────┴─────┐
                        ▼          ▼
             ┌──────────────┐  ┌──────────────┐
             │Content Studio│  │ Audience     │
             │    Agent     │  │ Growth Agent │
             └──────┬───────┘  └──────────────┘
                    │ content_generated
                    ▼
             ┌──────────────┐
             │  Compliance  │
             │    Agent     │
             └──────┬───────┘
                    │ compliance_approved
                    ▼
             ┌──────────────┐
             │ Distribution │
             │    Agent     │
             └──────┬───────┘
                    │ content_published
                    ▼
             ┌──────────────┐      ┌────────────────────┐
             │  Analytics   │─────▶│ Revenue Optimization│
             │    Agent     │      │       Agent          │
             └──────┬───────┘      └────────────────────┘
                    │ optimization_signals
                    ▼
             ┌──────────────┐
             │  Scheduler   │ (RL loop trigger)
             │   Service    │
             └──────────────┘
```

## Agent Registry

| Agent | Role | Kafka In | Kafka Out |
|---|---|---|---|
| brand-intelligence-agent | Market scanning | agent.brand-intelligence.in | agent.brand-intelligence.out |
| content-studio-agent | Content generation | agent.content-studio.in | agent.content-studio.out |
| campaign-strategy-agent | Campaign planning | agent.campaign-strategy.in | agent.campaign-strategy.out |
| distribution-agent | Multi-platform publishing | agent.distribution.in | agent.distribution.out |
| audience-growth-agent | Audience expansion | agent.audience-growth.in | agent.audience-growth.out |
| revenue-optimization-agent | Funnel + revenue | agent.revenue-optimization.in | agent.revenue-optimization.out |
| analytics-agent | Metrics + forecasting | agent.analytics.in | agent.analytics.out |
| compliance-agent | Policy enforcement | agent.compliance.in | agent.compliance.out |
| persona-creator-agent | Persona generation | agent.persona-creator.in | agent.persona-creator.out |
| micro-creator-agent (×N) | Per-persona posting | agent.micro-creator.in | agent.micro-creator.out |

## Message Protocol
See `/specs/message-protocols/agent-protocol.json` for the full JSON Schema.

All messages follow:
```json
{
  "agent": "<sender-id>",
  "intent": "<action-or-result>",
  "payload": {},
  "priority": "normal|high|critical|low",
  "timestamp": "<ISO-8601>",
  "correlation_id": "<uuid>"
}
```

## Swarm Rules
1. No agent may directly call another agent's API — all communication via Kafka
2. No agent publishes content without the compliance-agent returning `compliance_status: "approved"` or `compliance_status: "approved_with_warnings"` (the `compliance_approved` intent in the Kafka message signals this state)
3. Budget mutations require human approval via the oversight layer
4. All agents log decisions to the audit trail in ClickHouse
