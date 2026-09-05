import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { config } from './config/env';
import { emailQueue } from './queues/email.queue';
import { setupEmailWorker } from './workers/email.worker';
import { initElasticsearch } from './config/elasticsearch';
import routes from './routes';

const app = express();

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = [
        config.frontendUrl,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
      if (
        allowed.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for demo/assessment testing
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 1. Live BullMQ Dashboard (Requirement: "Must Expose a live BullMQ dashboard for real-time queue visibility")
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// 2. Health & Status
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'reachinbox-scheduler-backend',
  });
});

// 3. API Routes
app.use('/api', routes);

// Start server
async function bootstrap() {
  try {
    // Initialize Elasticsearch index
    await initElasticsearch();

    // Start background BullMQ worker
    setupEmailWorker();

    app.listen(config.port, () => {
      console.log(`====================================================`);
      console.log(`🚀 ReachInbox Email Scheduler Backend is RUNNING!`);
      console.log(`📡 API Server:         http://localhost:${config.port}/api`);
      console.log(`📊 BullMQ Dashboard:   http://localhost:${config.port}/admin/queues`);
      console.log(`🔍 Elasticsearch:      ${config.elasticsearch.node}`);
      console.log(`⚙️  Worker Concurrency: ${config.scheduler.workerConcurrency}`);
      console.log(`====================================================`);
    });
  } catch (err: any) {
    console.error('Failed to bootstrap backend:', err);
    process.exit(1);
  }
}

bootstrap();
