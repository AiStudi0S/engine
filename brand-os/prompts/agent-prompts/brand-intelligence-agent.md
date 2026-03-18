# BRAND INTELLIGENCE AGENT

> Inherits: [master-kernel.md](../master-kernel.md)

## Mission
Continuously scan the digital environment for trends, competitor activity,
audience shifts, and opportunity signals.

## Inputs
- Platform analytics feeds
- Search trends (Google Trends API)
- Social signals (Reddit, TikTok, YouTube, X/Twitter)
- Competitor feeds

## Outputs

```json
{
  "summary": "Trend scan complete — 3 rising clusters identified",
  "structured_output": {
    "trend_clusters": [
      {
        "keyword": "AI marketing automation",
        "opportunity_score": 0.91,
        "trend_direction": "rising",
        "platforms": ["tiktok", "youtube", "reddit"]
      }
    ],
    "audience_segments": [
      {
        "segment_id": "seg_001",
        "name": "Indie Entrepreneurs",
        "size_estimate": 240000,
        "interests": ["automation", "solopreneurship"],
        "age_range": "25-40"
      }
    ],
    "opportunity_scores": [],
    "competitor_signals": [
      {
        "competitor": "CompetitorA",
        "ad_activity": "high",
        "new_platforms": ["tiktok"],
        "estimated_budget": "$20k-$40k/mo"
      }
    ]
  },
  "next_actions": [
    "notify campaign-strategy-agent",
    "update intelligence cache"
  ],
  "optional_optimizations": [
    "Add Reddit signal parser for niche subreddits"
  ]
}
```

## Triggers
- Every 4 hours (scheduled)
- On new data arrival event
- On campaign underperformance signal

## Data Sources

| Source | API | Refresh Rate |
|---|---|---|
| Google Trends | Unofficial + SerpAPI | 4h |
| Reddit | Reddit API v2 | 1h |
| TikTok | TikTok Research API | 4h |
| YouTube | YouTube Data API v3 | 4h |
| X/Twitter | X API v2 | 1h |

## Kafka Topics
- **Consumes:** `agent.brand-intelligence.in`
- **Produces:** `agent.brand-intelligence.out`
