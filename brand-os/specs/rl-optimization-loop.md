# RL Optimization Loop

## Overview

The Brand OS RL (Reinforcement Learning) Optimization Loop continuously
improves campaign performance by observing outcomes, evaluating rewards,
and adjusting content and strategy.

## Loop Steps

```
1. Observe performance
        ↓
2. Evaluate reward
        ↓
3. Adjust content / strategy
        ↓
4. Deploy new variation
        ↓
5. Measure again
        ↓
   (back to 1)
```

## Reward Function

```
reward = w1 × CTR + w2 × Engagement + w3 × Conversion − w4 × Cost
```

Where default weights are:

| Weight | Default | Description |
|---|---|---|
| w1 | 0.30 | Click-through rate contribution |
| w2 | 0.20 | Engagement rate contribution |
| w3 | 0.40 | Conversion rate contribution |
| w4 | 0.10 | Cost penalty |

Weights are tunable per campaign objective (awareness vs. conversion).

## State Inputs

| Input | Source | Update Frequency |
|---|---|---|
| Platform impressions/clicks/conversions | analytics-agent | Real-time |
| Audience behavior patterns | brand-intelligence-agent | 4h |
| Content performance history | ClickHouse | 1h |
| Competitor activity | brand-intelligence-agent | 4h |
| Time-of-day/week signals | scheduler-service | Continuous |

## Actions

The RL agent can trigger these adjustments:

| Action | Trigger Condition | Approval Required |
|---|---|---|
| Change headline | CTR < baseline × 0.7 | No |
| Change media (thumbnail/creative) | CTR < baseline × 0.5 | No |
| Change posting time | Time-slot reward < 0.5 | No |
| Change CTA | Conversion < baseline × 0.6 | No |
| Change platform allocation | ROI delta > 30% | Yes (human) |
| Pause campaign | CTR < 0.8% after 1,000 impressions | No |
| Scale budget +20% | ROI > 150% for 7 consecutive days | Yes (human) |

## Implementation

The RL loop is implemented as a scheduled job in `scheduler-service`
with the following cycle time:

| Campaign Stage | Cycle Time |
|---|---|
| First 48h (exploration) | Every 6 hours |
| Days 3–14 (exploitation) | Every 24 hours |
| Day 15+ (steady state) | Every 48 hours |

## Integration Points

- **analytics-agent** → provides state observations
- **content-studio-agent** → generates new content variations
- **campaign-strategy-agent** → updates budget and targeting
- **distribution-agent** → deploys new variations
- **scheduler-service** → triggers the optimization cycle
