-- Brand OS ClickHouse Analytics Schema

CREATE DATABASE IF NOT EXISTS brandos;

CREATE TABLE IF NOT EXISTS brandos.campaign_events
(
    event_id     UUID DEFAULT generateUUIDv4(),
    campaign_id  String,
    event_type   LowCardinality(String),  -- impression, click, conversion, revenue
    platform     LowCardinality(String),
    persona_id   String,
    user_id      String,
    value        Float64 DEFAULT 0,
    metadata     String DEFAULT '{}',     -- JSON
    occurred_at  DateTime64(3) DEFAULT now64()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (campaign_id, platform, occurred_at)
TTL occurred_at + INTERVAL 2 YEAR;

CREATE TABLE IF NOT EXISTS brandos.campaign_metrics_daily
(
    date         Date,
    campaign_id  String,
    platform     LowCardinality(String),
    impressions  UInt64 DEFAULT 0,
    clicks       UInt64 DEFAULT 0,
    conversions  UInt64 DEFAULT 0,
    revenue      Float64 DEFAULT 0,
    spend        Float64 DEFAULT 0,
    ctr          Float64 MATERIALIZED if(impressions > 0, clicks / impressions, 0),
    roi          Float64 MATERIALIZED if(spend > 0, (revenue - spend) / spend, 0)
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, campaign_id, platform);

CREATE TABLE IF NOT EXISTS brandos.leads
(
    lead_id      UUID DEFAULT generateUUIDv4(),
    campaign_id  String,
    email        String,
    phone        String DEFAULT '',
    source       LowCardinality(String),
    score        UInt8 DEFAULT 0,
    status       LowCardinality(String) DEFAULT 'new',
    metadata     String DEFAULT '{}',
    created_at   DateTime64(3) DEFAULT now64()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (campaign_id, score, created_at);

CREATE MATERIALIZED VIEW IF NOT EXISTS brandos.funnel_analysis
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, campaign_id, platform)
AS SELECT
    toDate(occurred_at) AS date,
    campaign_id,
    platform,
    countIf(event_type = 'impression') AS impressions,
    countIf(event_type = 'click') AS clicks,
    countIf(event_type = 'conversion') AS conversions,
    sumIf(value, event_type = 'revenue') AS revenue
FROM brandos.campaign_events
GROUP BY date, campaign_id, platform;
