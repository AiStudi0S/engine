'use strict';

const { Kafka } = require('kafkajs');
require('dotenv').config();

const AGENT_ID = 'compliance-agent';
const AGENT_KEY = 'compliance';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC_IN = `agent.${AGENT_KEY}.in`;
const TOPIC_OUT = `agent.${AGENT_KEY}.out`;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PROHIBITED_TERMS = [
  'guaranteed returns', 'get rich quick', 'risk free', '100% profit', 'no risk',
  'make money fast', 'unlimited income', 'financial freedom guaranteed',
];

const RESTRICTED_CATEGORIES = [
  'firearms', 'weapons', 'drugs', 'illegal', 'tobacco', 'gambling',
];

async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a compliance officer. Analyze content for policy violations. Respond with JSON: { violations: [], risk_level: "low|medium|high", approved: boolean }' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error(`[${AGENT_ID}] OpenAI error:`, err.message);
    return null;
  }
}

function ruleBasedCheck(content) {
  const violations = [];
  const lowerContent = (content || '').toLowerCase();

  PROHIBITED_TERMS.forEach((term) => {
    if (lowerContent.includes(term)) {
      violations.push({ type: 'prohibited_claim', term, severity: 'high', message: `Prohibited claim detected: "${term}"` });
    }
  });

  RESTRICTED_CATEGORIES.forEach((cat) => {
    if (lowerContent.includes(cat)) {
      violations.push({ type: 'restricted_category', category: cat, severity: 'medium', message: `Restricted category reference: "${cat}"` });
    }
  });

  if (/\b\d+%\s*(guaranteed|sure|certain)\b/i.test(content)) {
    violations.push({ type: 'false_claim', severity: 'high', message: 'Percentage-based guarantee claim detected' });
  }

  return violations;
}

class Agent {
  constructor() {
    this.kafka = new Kafka({ clientId: AGENT_ID, brokers: KAFKA_BROKERS });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: `${AGENT_ID}-group` });
    this.violations = [];
  }

  async start() {
    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: TOPIC_IN, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        let payload;
        try {
          payload = JSON.parse(message.value.toString());
        } catch (parseErr) {
          console.error(`[${AGENT_ID}] failed to parse message:`, parseErr.message);
          return;
        }
        console.log(`[${AGENT_ID}] received:`, payload.intent);
        const result = await this.process(payload);
        await this.producer.send({ topic: TOPIC_OUT, messages: [{ value: JSON.stringify(result) }] });
      },
    });
    console.log(`[${AGENT_ID}] running`);
  }

  async process(message) {
    const { intent, payload, correlation_id } = message;
    const base = { agent: AGENT_ID, intent, correlation_id, priority: 'high', timestamp: new Date().toISOString() };

    try {
      switch (intent) {
        case 'check_content':
          return { ...base, payload: await this.checkContent(payload) };
        case 'check_spend':
          return { ...base, payload: this.checkSpend(payload) };
        case 'audit_campaign':
          return { ...base, payload: await this.auditCampaign(payload) };
        case 'flag_violation':
          return { ...base, payload: this.flagViolation(payload) };
        default:
          console.warn(`[${AGENT_ID}] unhandled intent: ${intent}`);
          return { ...base, intent: 'error', payload: { error: `unknown intent: ${intent}` } };
      }
    } catch (err) {
      console.error(`[${AGENT_ID}] process error:`, err.message);
      return { ...base, intent: 'error', payload: { error: err.message } };
    }
  }

  async checkContent({ content, platform, contentType = 'ad_copy' }) {
    if (!content) throw new Error('content is required');

    const ruleViolations = ruleBasedCheck(content);
    let aiResult = null;

    if (OPENAI_API_KEY) {
      aiResult = await callOpenAI(`Check this ${contentType} for policy violations on ${platform || 'all platforms'}:\n\n"${content}"\n\nConsider: false claims, prohibited products, inappropriate language, misleading statements.`);
    }

    const allViolations = [...ruleViolations];
    if (aiResult?.violations) allViolations.push(...aiResult.violations);

    const highSeverity = allViolations.filter((v) => v.severity === 'high');
    const approved = highSeverity.length === 0;
    const riskLevel = highSeverity.length > 0 ? 'high' : allViolations.length > 0 ? 'medium' : 'low';

    return { content: content.slice(0, 100), platform, approved, riskLevel, violations: allViolations, checkedAt: new Date().toISOString() };
  }

  checkSpend({ campaignId, budget, spent, warningThreshold = 0.8 }) {
    if (!campaignId || budget === undefined || spent === undefined) {
      throw new Error('campaignId, budget, and spent are required');
    }
    const spendRatio = spent / budget;
    const withinBudget = spent <= budget;
    const warningTriggered = spendRatio >= warningThreshold;
    const violations = [];
    if (!withinBudget) violations.push({ type: 'budget_exceeded', severity: 'critical', message: `Spend ($${spent}) exceeds budget ($${budget})` });
    if (warningTriggered && withinBudget) violations.push({ type: 'budget_warning', severity: 'medium', message: `Spend at ${Math.round(spendRatio * 100)}% of budget` });
    return { campaignId, budget, spent, spendRatio: Math.round(spendRatio * 100) / 100, withinBudget, warningTriggered, violations, checkedAt: new Date().toISOString() };
  }

  async auditCampaign({ campaignId, content, budget, spent, platforms = [] }) {
    if (!campaignId) throw new Error('campaignId is required');
    const auditResults = [];

    if (content) {
      const contentCheck = await this.checkContent({ content, platform: platforms[0] });
      auditResults.push({ check: 'content_compliance', ...contentCheck });
    }

    if (budget !== undefined && spent !== undefined) {
      const spendCheck = this.checkSpend({ campaignId, budget, spent });
      auditResults.push({ check: 'budget_compliance', ...spendCheck });
    }

    const overallApproved = auditResults.every((r) => r.approved !== false && r.withinBudget !== false);
    const totalViolations = auditResults.reduce((sum, r) => sum + (r.violations?.length || 0), 0);

    return {
      campaignId, approved: overallApproved, totalViolations,
      auditResults, auditedAt: new Date().toISOString(),
      recommendation: overallApproved ? 'Campaign is compliant and approved' : 'Review and resolve violations before publishing',
    };
  }

  flagViolation({ campaignId, type, description, severity = 'medium', metadata = {} }) {
    if (!campaignId || !type || !description) throw new Error('campaignId, type, and description are required');
    const violation = { id: `viol_${Date.now()}`, campaignId, type, description, severity, metadata, flaggedAt: new Date().toISOString() };
    this.violations.push(violation);
    console.warn(`[${AGENT_ID}] VIOLATION FLAGGED:`, violation);
    return { flagged: true, violation };
  }

  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }
}

const agent = new Agent();
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop().then(() => process.exit(0)));
process.on('SIGINT', () => agent.stop().then(() => process.exit(0)));
module.exports = Agent;
