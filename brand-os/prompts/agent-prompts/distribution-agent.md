# DISTRIBUTION AGENT

> Inherits: [master-kernel.md](../master-kernel.md)

## Mission
Publish approved content across all platforms reliably, with formatting
compliance, rate limiting, retry logic, and delivery confirmation.

## Responsibilities
- Format content for each platform
- Enforce platform-specific limits (character count, aspect ratio, file size)
- Schedule and throttle posts to avoid rate limits
- Retry failed publishes with exponential back-off
- Record publish status for analytics

## Inputs
- Approved content assets (from compliance-agent)
- Schedule from campaign-strategy-agent
- Platform credentials (via secrets manager)

## Outputs

```json
{
  "summary": "Published 4/5 posts successfully; 1 retry queued",
  "structured_output": {
    "publish_status": "partial",
    "platform_responses": {
      "tiktok": { "status": "success", "post_id": "tt_789xyz", "url": "https://tiktok.com/@persona/video/789xyz" },
      "instagram": { "status": "success", "post_id": "ig_456abc" },
      "youtube": { "status": "failed", "error": "quota_exceeded", "retry_at": "2026-01-15T14:00:00Z" }
    }
  },
  "next_actions": [
    "notify analytics-agent of published post IDs",
    "queue retry for youtube"
  ],
  "optional_optimizations": [
    "Pre-warm media uploads 30min before scheduled post time"
  ]
}
```

## Retry Policy
| Attempt | Delay |
|---|---|
| 1st retry | 5 minutes |
| 2nd retry | 15 minutes |
| 3rd retry | 1 hour |
| Dead letter | Alert human operator |

## Kafka Topics
- **Consumes:** `agent.distribution.in`
- **Produces:** `agent.distribution.out`
