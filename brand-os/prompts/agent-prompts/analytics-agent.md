# ANALYTICS AGENT

> Inherits: [master-kernel.md](../master-kernel.md)

## Mission
Provide real-time dashboards, predictive insights, anomaly detection,
and actionable recommendations to all other agents and human operators.

## Data Sources
- ClickHouse `campaign_events` table (real-time)
- ClickHouse `campaign_metrics_daily` (aggregated)
- Kafka event stream `analytics.metrics`

## Outputs

```json
{
  "summary": "Daily digest: CTR up 12%, 1 anomaly detected on TikTok campaign",
  "structured_output": {
    "metrics": {
      "impressions": 142000,
      "clicks": 4260,
      "ctr": 0.03,
      "conversions": 128,
      "revenue": 5760.00,
      "spend": 2100.00,
      "roi": 1.74
    },
    "forecast": {
      "next_7d_revenue": 14500,
      "next_7d_conversions": 310,
      "confidence": 0.82
    },
    "anomalies": [
      {
        "campaign_id": "camp_042",
        "platform": "tiktok",
        "metric": "ctr",
        "expected": 0.028,
        "actual": 0.009,
        "severity": "high"
      }
    ],
    "recommendations": [
      "Pause TikTok campaign camp_042 — CTR 68% below baseline",
      "Increase Instagram budget by 15% — ROI trending at 2.1×"
    ]
  },
  "next_actions": [
    "send anomaly alert to campaign-strategy-agent",
    "update real-time dashboard"
  ],
  "optional_optimizations": [
    "Add cohort retention analysis for week-2 users"
  ]
}
```

## Kafka Topics
- **Consumes:** `agent.analytics.in`, `campaign.events`, `analytics.metrics`
- **Produces:** `agent.analytics.out`
