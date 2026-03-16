# Autonomous Scheduler Kernel

## Overview

The Autonomous Scheduler Kernel is the timing and orchestration backbone
of Brand OS. It triggers all agent cycles, campaign posts, optimization
loops, and retry jobs.

## Responsibilities

- Trigger campaign publishing at scheduled times
- Trigger micro-creator posts per content calendar
- Trigger RL optimization cycles
- Enforce platform rate limits
- Handle retries with exponential back-off
- Emit performance-based schedule adjustments

## Schedule Types

| Type | Mechanism | Example |
|---|---|---|
| Cron-based | BullMQ repeatable jobs | "Post at 08:00 daily" |
| Event-based | Kafka event trigger | "Publish when compliance_approved" |
| Performance-based | RL signal trigger | "Reschedule after CTR drops" |
| RL-triggered | Optimization loop output | "Post at new optimal time slot" |

## Job Output Schema

```json
{
  "task": "publish_post",
  "time": "2026-01-15T08:00:00Z",
  "agent": "distribution-agent",
  "payload": {
    "campaign_id": "camp_042",
    "platform": "tiktok",
    "asset_id": "asset_789",
    "persona_id": "persona_001"
  }
}
```

## Rate Limit Enforcement

| Platform | Limit | Scheduler Behavior |
|---|---|---|
| TikTok | 10 posts/day per account | Queue + spread |
| Instagram | 25 posts/day per account | Queue + spread |
| X/Twitter | 300 tweets/day per account | Queue + spread |
| YouTube | 100 uploads/day per channel | Queue + spread |
| Email | Per-provider hourly limits | Batch + throttle |

## Retry Logic

```
failed job
    → wait 5 min   → retry #1
    → wait 15 min  → retry #2
    → wait 1 hour  → retry #3
    → dead letter queue → alert human operator
```

## BullMQ Queue Names

| Queue | Description |
|---|---|
| `campaign:publish` | Content publication jobs |
| `analytics:collect` | Metrics collection jobs |
| `ai:optimize` | RL optimization cycle jobs |
| `crm:followup` | Lead follow-up and nurture jobs |
| `scheduler:retry` | Dead-letter retry queue |

## Implementation

- **Tech:** BullMQ (Redis-backed)
- **Service:** `brand-os/services/scheduler-service`
- **Kafka:** Listens to `campaign.publish` topic; emits completion events
