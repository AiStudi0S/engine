# Compliance Guide

## Overview

Brand OS enforces compliance at every stage of the content lifecycle.
The `compliance-agent` is the gatekeeper — no content is published
without a `compliance_approved` signal.

## Compliance Domains

### 1. Advertising Disclosure
- All paid/sponsored content must include `#ad`, `#sponsored`, or platform-native labels
- Auto-injection available via compliance-agent fix suggestions
- FTC guidelines enforced for US audiences
- ASA guidelines enforced for UK audiences

### 2. Platform Policies

| Platform | Key Rules |
|---|---|
| Meta (Instagram/Facebook) | No misleading claims, no prohibited categories |
| TikTok | No health claims without disclaimer, age-gating for applicable content |
| Google | No click-bait, no deceptive ads |
| X/Twitter | No synthetic media disclosure violations |
| YouTube | No spam, no misleading metadata |

### 3. Data Privacy
- GDPR: Consent required for EU audience targeting; DPA must be signed with all data processors
- CCPA: Opt-out list integration required for California audiences
- No PII in ad copy, creative assets, or targeting parameters
- Data retention: Campaign event data retained max 2 years (ClickHouse TTL enforced)

### 4. Brand Safety
- Placement exclusions configured per campaign
- Sensitive content categories blocked by default:
  - Political content
  - Violence/graphic content
  - Adult content
  - Misinformation

## Compliance Status Values

| Status | Meaning | Distribution Allowed |
|---|---|---|
| `approved` | Fully compliant | Yes |
| `approved_with_warnings` | Minor issues auto-fixed | Yes (after auto-fix) |
| `pending_review` | Requires human review | No |
| `rejected` | Non-compliant | No — human review required |

## Escalation

Any content flagged `rejected` triggers:
1. Automatic distribution block
2. Human operator notification (notification-service)
3. Mandatory compliance officer review before any retry
