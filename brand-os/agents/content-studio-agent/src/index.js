'use strict';

const { Kafka } = require('kafkajs');
require('dotenv').config();

const AGENT_ID = 'content-studio-agent';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

class ContentStudioAgent {
  constructor() {
    this.kafka = new Kafka({ clientId: AGENT_ID, brokers: KAFKA_BROKERS });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: `${AGENT_ID}-group` });
  }

  async start() {
    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: `agent.${AGENT_ID}.in`, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const payload = JSON.parse(message.value.toString());
        const result = await this.process(payload);
        await this.producer.send({
          topic: `agent.${AGENT_ID}.out`,
          messages: [{ value: JSON.stringify(result) }],
        });
      },
    });

    console.log(`[${AGENT_ID}] running`);
  }

  async process(message) {
    const { intent, payload } = message;
    if (intent === 'generate_article') {
      const generator = require('./generators/article-generator');
      const article = await generator.generate(payload);
      return { agent: AGENT_ID, intent: 'article_generated', payload: article, priority: 'normal', timestamp: new Date().toISOString() };
    }
    if (intent === 'generate_social_copy') {
      const generator = require('./generators/social-copy-generator');
      const copy = await generator.generate(payload);
      return { agent: AGENT_ID, intent: 'social_copy_generated', payload: copy, priority: 'normal', timestamp: new Date().toISOString() };
    }
    return { agent: AGENT_ID, intent: 'noop', payload: {}, priority: 'low', timestamp: new Date().toISOString() };
  }

  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }
}

const agent = new ContentStudioAgent();
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop().then(() => process.exit(0)));
process.on('SIGINT', () => agent.stop().then(() => process.exit(0)));
module.exports = ContentStudioAgent;
