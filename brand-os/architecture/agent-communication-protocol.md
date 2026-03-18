# Agent Communication Protocol

All Brand OS agents communicate via Apache Kafka using a standard JSON message format.

## Message Schema

```json
{
  "agent": "brand-intelligence-agent",
  "intent": "analyze_trends",
  "payload": {
    "keywords": ["AI marketing", "automation"],
    "platforms": ["google", "tiktok"]
  },
  "priority": "normal",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "correlation_id": "uuid-optional"
}
```

## Priority Levels

| Priority | Use Case |
|---|---|
| critical | Budget exceeded, compliance violation, API failure |
| high | Time-sensitive scheduling, trending opportunity |
| normal | Standard campaign operations |
| low | Background optimization, analytics aggregation |

## Standard Intents

### Brand Intelligence Agent
- `analyze_trends` → `trends_analyzed`
- `competitor_scan` → `competitors_scanned`

### Content Studio Agent
- `generate_article` → `article_generated`
- `generate_social_copy` → `social_copy_generated`

### Campaign Strategy Agent
- `plan_campaign` → `campaign_planned`
- `optimize_budget` → `budget_optimized`

### Distribution Agent
- `publish_content` → `content_published`
- `retry_failed` → `retry_result`

### Compliance Agent
- `check_content` → `compliance_result`
- `check_spend` → `spend_result`
