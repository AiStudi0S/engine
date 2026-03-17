'use strict';

const PERSONA_SCHEMA = Object.freeze({
  name: '',
  style: '',
  tone: '',
  niche: '',
  platforms: [],
  contentTypes: [],
  postingFrequency: '',
  engagementStyle: '',
  rlOptimizationEnabled: true,
});

function validatePersona(persona) {
  const required = ['name', 'niche', 'platforms', 'tone'];
  const missing = required.filter((k) => !persona[k] || (Array.isArray(persona[k]) && persona[k].length === 0));
  if (missing.length > 0) {
    throw new Error(`Persona missing required fields: ${missing.join(', ')}`);
  }
  return true;
}

function createPersona(overrides = {}) {
  return { ...PERSONA_SCHEMA, ...overrides, createdAt: new Date().toISOString() };
}

module.exports = { PERSONA_SCHEMA, validatePersona, createPersona };
