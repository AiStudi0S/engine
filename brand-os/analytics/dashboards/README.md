# Analytics Dashboards

## Overview

Brand OS provides real-time analytics dashboards powered by ClickHouse queries
served via the `analytics-service`.

## Dashboard Definitions

### 1. Campaign Performance Dashboard

**Panels:**
- Impressions over time (line chart)
- CTR by platform (bar chart)
- Conversions funnel (funnel chart)
- ROI by campaign (table)
- Spend vs. Revenue (dual-axis line)

**ClickHouse Query — Daily Metrics:**
```sql
SELECT
    date,
    campaign_id,
    platform,
    sum(impressions) AS impressions,
    sum(clicks)      AS clicks,
    sum(conversions) AS conversions,
    sum(revenue)     AS revenue,
    sum(spend)       AS spend,
    if(sum(impressions) > 0, sum(clicks) / sum(impressions), 0) AS ctr,
    if(sum(spend) > 0, (sum(revenue) - sum(spend)) / sum(spend), 0) AS roi
FROM brandos.campaign_metrics_daily
WHERE date >= today() - 30
GROUP BY date, campaign_id, platform
ORDER BY date DESC;
```

---

### 2. Influence Network Dashboard

**Panels:**
- Active personas count
- Posts published per day
- Engagement rate per persona
- Top-performing personas (table)
- Platform distribution (pie chart)

---

### 3. Lead & CRM Dashboard

**Panels:**
- New leads per day
- Lead score distribution (histogram)
- Conversion rate by source
- Pipeline value by stage
- Follow-up completion rate

---

### 4. RL Optimization Dashboard

**Panels:**
- Average reward per cycle
- Actions taken by type (bar chart)
- CTR improvement over time
- A/B test results (table with statistical significance)
- Budget reallocation history

---

## Embedding Dashboards

Dashboards are rendered in the frontend using:
- **Grafana** (internal ops) — connects directly to ClickHouse
- **Custom Next.js components** (user-facing) — queries `analytics-service` REST API
