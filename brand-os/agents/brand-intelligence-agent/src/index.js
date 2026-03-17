'use strict';

const { Kafka } = require('kafkajs');
require('dotenv').config();

const AGENT_ID = 'brand-intelligence-agent';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPICS = {
  IN: 'agent.brand-intelligence.in',
  OUT: 'agent.brand-intelligence.out',
};

class BrandIntelligenceAgent {
  constructor() {
    this.kafka = new Kafka({ clientId: AGENT_ID, brokers: KAFKA_BROKERS });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: `${AGENT_ID}-group` });
  }

  async start() {
    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: TOPICS.IN, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const payload = JSON.parse(message.value.toString());
        console.log(`[${AGENT_ID}] received:`, payload.intent);
        const result = await this.process(payload);
        if (result) await this.emit(result);
      },
    });

    console.log(`[${AGENT_ID}] running`);
  }

  async process(message) {
    const { intent, payload } = message;
    switch (intent) {
      case 'analyze_trends':
        return this.analyzeTrends(payload);
      case 'competitor_scan':
        return this.scanCompetitors(payload);
      default:
        console.warn(`[${AGENT_ID}] unknown intent: ${intent}`);
        // Return null to skip emit rather than publishing an invalid protocol message
        return null;
    }
  }

  async analyzeTrends(payload) {
    const trendAnalyzer = require('./analyzers/trend-analyzer');
    const clusters = await trendAnalyzer.analyze(payload);
    return {
      agent: AGENT_ID,
      intent: 'trends_analyzed',
      payload: { clusters },
      priority: 'normal',
      timestamp: new Date().toISOString(),
    };
  }

  async scanCompetitors(payload) {
    const competitorAnalyzer = require('./analyzers/competitor-analyzer');
    const signals = await competitorAnalyzer.scan(payload);
    return {
      agent: AGENT_ID,
      intent: 'competitors_scanned',
      payload: { signals },
      priority: 'normal',
      timestamp: new Date().toISOString(),
    };
  }

  async emit(message) {
    await this.producer.send({
      topic: TOPICS.OUT,
      messages: [{ value: JSON.stringify(message) }],
    });
  }

  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }
}

const agent = new BrandIntelligenceAgent();
agent.start().catch(console.error);

process.on('SIGTERM', () => agent.stop().then(() => process.exit(0)));
process.on('SIGINT', () => agent.stop().then(() => process.exit(0)));

module.exports = BrandIntelligenceAgent;
