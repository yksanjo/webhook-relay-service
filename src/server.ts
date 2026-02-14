/**
 * Webhook Relay Service - Express Server
 */

import express, { Request, Response } from 'express';
import { WebhookRelayService } from './relay';
import { Config, ConfigSchema, WebhookRouteSchema } from './types';

const app = express();
app.use(express.json());

let relayService: WebhookRelayService;

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy' });
});

// Get routes
app.get('/routes', (_req: Request, res: Response) => {
  const routes = relayService.getRoutes();
  res.json(routes);
});

// Add route
app.post('/routes', async (req: Request, res: Response) => {
  const route = WebhookRouteSchema.parse(req.body);
  relayService.addRoute(route);
  res.status(201).json(route);
});

// Delete route
app.delete('/routes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  relayService.removeRoute(id);
  res.status(204).send();
});

// Relay webhook
app.post('/relay/:source/:event', async (req: Request, res: Response) => {
  const { source, event } = req.params;
  const data = req.body;
  const headers = req.headers as Record<string, string>;
  
  const jobIds = await relayService.relay(source, event, data, headers);
  res.json({ queued: jobIds.length, jobIds });
});

// Get stats
app.get('/stats', async (_req: Request, res: Response) => {
  const stats = await relayService.getStats();
  res.json(stats);
});

export function startServer(config: Config): void {
  relayService = new WebhookRelayService(config);
  relayService.startWorker();
  
  app.listen(config.port, () => {
    console.log(`Webhook Relay Service started on port ${config.port}`);
  });
}

export { app };
