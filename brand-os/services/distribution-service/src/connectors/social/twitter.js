'use strict';

// Re-export the shared Twitter connector to avoid duplication.
// See brand-os/connectors/social/twitter.js for the canonical implementation.
const TwitterConnector = require('../../../../../connectors/social/twitter');

module.exports = TwitterConnector;
