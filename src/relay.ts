/**
 * Webhook Relay Service - Core Relay Logic
 */

import axios, { AxiosInstance } from 'axios';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { WebhookRoute, WebhookPayload, RelayJobData, Config } from './types';

const QUEUE_NAME = 'webhook-relay';

export class WebhookRelayService {
  private redis: Redis;
  private queue: Queue;
  private worker: Worker;
  private routes: Map<string, WebhookRoute> = new Map();
  private httpClient: AxiosInstance;

  constructor(private config: Config) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue(QUEUE_NAME, { connection: this.redis });

    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Initialize routes
    config.routes.forEach(route => {
      this.routes.set(route.id, route);
    });
  }

  /**
   * Add a new route
   */
  addRoute(route: WebhookRoute): void {
    this.routes.set(route.id, route);
  }

  /**
   * Remove a route
   */
  removeRoute(routeId: string): void {
    this.routes.delete(routeId);
  }

  /**
   * Get all routes
   */
  getRoutes(): WebhookRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Relay a webhook to configured destinations
   */
  async relay(source: string, event: string, data: unknown, headers?: Record<string, string>): Promise<string[]> {
    const payload: WebhookPayload = {
      id: uuidv4(),
      source,
      event,
      timestamp: new Date().toISOString(),
      data: data as Record<string, unknown>,
      headers,
    };

    // Find matching routes
    const matchingRoutes = this.getMatchingRoutes(source, event);
    
    if (matchingRoutes.length === 0) {
      console.log(`No routes found for ${source}:${event}`);
      return [];
    }

    // Queue relay jobs
    const jobIds: string[] = [];
    for (const route of matchingRoutes) {
      const jobId = await this.queue.add('relay', {
        routeId: route.id,
        payload,
        attemptNumber: 1,
      });
      jobIds.push(jobId.id as string);
    }

    return jobIds;
  }

  /**
   * Get routes matching source and event
   */
  private getMatchingRoutes(source: string, event: string): WebhookRoute[] {
    return Array.from(this.routes.values()).filter(route => {
      if (!route.enabled) return false;
      
      // Check if route matches source and event
      const sourceMatch = route.sourceEvent.startsWith(source) || 
                         route.sourceEvent === '*';
      const eventMatch = route.sourceEvent.endsWith(event) || 
                        route.sourceEvent.split(':').pop() === '*';
      
      return sourceMatch && eventMatch;
    });
  }

  /**
   * Start the worker to process relay jobs
   */
  startWorker(): void {
    this.worker = new Worker<RelayJobData>(
      QUEUE_NAME,
      async (job) => {
        const { routeId, payload, attemptNumber } = job.data;
        const route = this.routes.get(routeId);

        if (!route) {
          throw new Error(`Route ${routeId} not found`);
        }

        try {
          // Apply transformation if configured
          let transformedPayload = payload;
          if (route.transformation) {
            transformedPayload = this.applyTransformation(payload, route.transformation);
          }

          // Send to destination
          await this.httpClient.post(route.destinationUrl, transformedPayload);
          
          console.log(`Successfully relayed webhook ${payload.id} to ${route.destinationUrl}`);
        } catch (error) {
          // Retry if possible
          if (route.retryConfig && attemptNumber < route.retryConfig.maxAttempts) {
            const delay = route.retryConfig.delayMs * Math.pow(2, attemptNumber - 1);
            await this.queue.add('relay', {
              routeId,
              payload,
              attemptNumber: attemptNumber + 1,
            }, { delay });
          }
          
          throw error;
        }
      },
      { connection: this.redis, concurrency: 10 }
    );

    console.log('Worker started');
  }

  /**
   * Apply transformation to payload
   */
  private applyTransformation(payload: WebhookPayload, transformation: Record<string, unknown>): WebhookPayload {
    // Simple key mapping transformation
    const transformed = { ...payload };
    
    if (transformation['mapKeys']) {
      const keyMap = transformation['mapKeys'] as Record<string, string>;
      const mappedData: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(payload.data)) {
        const newKey = keyMap[key] || key;
        mappedData[newKey] = value;
      }
      
      transformed.data = mappedData;
    }

    return transformed;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{ waiting: number; active: number; completed: number }> {
    const [waiting, active, completed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
    ]);

    return { waiting, active, completed };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.redis.quit();
  }
}
