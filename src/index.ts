/**
 * Webhook Relay Service - Entry Point
 */

import { startServer } from './server';
import { ConfigSchema } from './types';

const config = ConfigSchema.parse({
  port: parseInt(process.env.PORT || '3000'),
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  routes: [],
});

startServer(config);
