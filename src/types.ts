/**
 * Webhook Relay Service - Types
 */

import { z } from 'zod';

// Webhook route configuration
export const WebhookRouteSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  sourceEvent: z.string().min(1),
  destinationUrl: z.string().url(),
  enabled: z.boolean().default(true),
  transformation: z.record(z.unknown()).optional(),
  retryConfig: z.object({
    maxAttempts: z.number().min(1).max(10).default(3),
    delayMs: z.number().min(100).default(1000),
  }).optional(),
});

export type WebhookRoute = z.infer<typeof WebhookRouteSchema>;

// Webhook payload
export const WebhookPayloadSchema = z.object({
  id: z.string().uuid(),
  source: z.string().min(1),
  event: z.string().min(1),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()),
  headers: z.record(z.string()).optional(),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// Relay job data
export interface RelayJobData {
  routeId: string;
  payload: WebhookPayload;
  attemptNumber: number;
}

// Configuration
export const ConfigSchema = z.object({
  port: z.number().min(1).max(65535).default(3000),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
  }),
  routes: z.array(WebhookRouteSchema).default([]),
});

export type Config = z.infer<typeof ConfigSchema>;
