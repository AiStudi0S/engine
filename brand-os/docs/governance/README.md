# Governance

## Overview

Brand OS governance defines the human oversight layer, approval workflows,
audit requirements, and operational policies.

## Human Oversight Layer

The following actions always require human approval:

| Action | Trigger | Approver |
|---|---|---|
| Budget increase > 20% | ROI > 150% for 7 days | Campaign owner |
| New platform activation | campaign-strategy-agent recommendation | Marketing lead |
| Campaign scale-up | RL recommendation | Campaign owner |
| Compliance override | compliance-agent rejection | Compliance officer |
| Persona creation at scale (>10) | Operator request | Admin |

## Approval Workflow

```
1. Agent emits approval_required event (priority: high)
2. notification-service alerts human operator
3. Operator reviews in dashboard (approval_requests panel)
4. Operator approves / rejects / requests changes
5. Agent receives decision event and proceeds accordingly
```

## Audit Trail

All state-changing operations are logged to ClickHouse `audit_log` table:

```sql
CREATE TABLE IF NOT EXISTS brandos.audit_log
(
    event_id     UUID DEFAULT generateUUIDv4(),
    actor        String,       -- agent ID or user ID
    action       String,
    resource     String,
    resource_id  String,
    metadata     String DEFAULT '{}',
    occurred_at  DateTime64(3) DEFAULT now64()
)
ENGINE = MergeTree()
ORDER BY (occurred_at, actor);
```

## RBAC Roles

| Role | Permissions |
|---|---|
| viewer | Read-only access to dashboards |
| operator | Create/edit campaigns, view analytics |
| admin | Full access including persona management and budget controls |
| compliance | Review and approve/reject compliance flags |

## Budget Controls

- Daily spend caps configurable per campaign
- Global monthly budget hard limit enforced in campaign-service
- Automatic pause when 90% of budget consumed
- Emergency stop available to all admin users
