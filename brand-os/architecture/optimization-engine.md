# Optimization Engine

## Overview

The Brand OS Optimization Engine combines A/B testing, ML-based performance
prediction, and Reinforcement Learning to continuously improve every campaign,
persona, and funnel.

## Three Optimization Layers

### Layer 1 — A/B Testing
Deterministic split-testing for content variations.

- **Minimum:** 2 variants per campaign
- **Split:** 50/50 by default (configurable)
- **Significance threshold:** p < 0.05 (two-tailed)
- **Minimum sample:** 500 impressions per variant
- **Auto-winner:** Winning variant scales to 100% on significance

### Layer 2 — Predictive ML (Performance Prediction)
Pre-launch forecasting using historical campaign data.

- **Model:** Gradient boosted trees (XGBoost) trained on `campaign_metrics_daily`
- **Features:** Platform, audience segment, content type, time-of-day, budget
- **Outputs:** Predicted CTR, conversions, ROI, confidence interval
- **Retraining:** Weekly on new 30-day rolling window
- **Served by:** `ai-engine` `/api/performance/predict`

### Layer 3 — Reinforcement Learning (Continuous Optimization)
Post-launch reward-driven adjustment loop.

See `/specs/rl-optimization-loop.md` for the full RL spec.

```
State:   [CTR, engagement, conversion, platform, time_slot, content_type]
Action:  [change_headline, change_media, change_time, change_cta, change_budget]
Reward:  w1×CTR + w2×engagement + w3×conversion − w4×cost
Policy:  ε-greedy with decaying exploration (ε₀=0.3, decay=0.95/cycle)
```

## Optimization Triggers

| Trigger | Action | Agent |
|---|---|---|
| CTR < 0.8% after 1,000 impressions | Pause + generate new variant | campaign-strategy-agent |
| ROI > 150% for 7 days | Scale budget +20% (human approval) | revenue-optimization-agent |
| Engagement anomaly detected | Alert + investigate | analytics-agent |
| Trend score rises > 0.8 | Launch opportunistic campaign | campaign-strategy-agent |
| Compliance violation | Immediate pause | compliance-agent |

## Feedback Loop

```
Campaign Launch
    → Real-time metrics (ClickHouse + Kafka)
    → Analytics Agent observes state
    → RL Agent evaluates reward
    → Strategy Agent adjusts parameters
    → Content Studio generates variant
    → Compliance checks variant
    → Distribution publishes variant
    → (loop repeats)
```

## Data Storage

| Data | Storage | TTL |
|---|---|---|
| Raw events | ClickHouse `campaign_events` | 2 years |
| Daily metrics | ClickHouse `campaign_metrics_daily` | 5 years |
| ML training data | ClickHouse export → S3 | Indefinite |
| RL episode history | Redis (hot) + ClickHouse (cold) | 90 days hot |
