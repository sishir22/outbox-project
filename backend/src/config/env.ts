import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'mysql://reachinbox_user:reachinbox_password@localhost:3306/reachinbox_db',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  },
  scheduler: {
    defaultMaxEmailsPerHour: parseInt(process.env.DEFAULT_MAX_EMAILS_PER_HOUR || '100', 10),
    defaultMinDelaySeconds: parseInt(process.env.DEFAULT_MIN_DELAY_SECONDS || '2', 10),
    workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
  },
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/callback',
  },
  ethereal: {
    user: process.env.ETHEREAL_USER || '',
    pass: process.env.ETHEREAL_PASS || '',
  },
  jwtSecret: process.env.JWT_SECRET || 'reachinbox_jwt_secret_dev_key_2026',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
