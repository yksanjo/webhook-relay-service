# Webhook Relay Service

Generic webhook relay service with routing and transformation capabilities.

## Features

- Route webhooks to multiple destinations
- Payload transformation
- Retry logic with exponential backoff
- Queue-based processing with BullMQ

## Usage

```bash
# Install dependencies
npm install

# Build
npm run build

# Start
npm start
```

## API

- `POST /relay/:source/:event` - Relay webhook
- `GET /routes` - List routes
- `POST /routes` - Add route
- `GET /stats` - Queue statistics
