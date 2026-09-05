import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis';

export interface EmailJobData {
  emailId: string;
}

export const EMAIL_QUEUE_NAME = 'email-send-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    removeOnComplete: {
      count: 1000, // Keep last 1,000 completed jobs for dashboard inspection
      age: 24 * 3600, // Keep for 24 hours
    },
    removeOnFail: {
      count: 5000, // Keep failed jobs for debugging
    },
  },
});

/**
 * Adds an email job to the queue with a scheduled delay.
 * Uses emailId as the jobId to ensure queue-level uniqueness.
 */
export async function scheduleEmailJob(emailId: string, delayMs: number) {
  const safeDelay = Math.max(0, delayMs);
  return await emailQueue.add(
    'send-email',
    { emailId },
    {
      jobId: emailId,
      delay: safeDelay,
    }
  );
}

/**
 * Removes a job from the queue if the email was cancelled or deleted before execution.
 */
export async function cancelEmailJob(emailId: string) {
  const job = await emailQueue.getJob(emailId);
  if (job) {
    await job.remove();
    return true;
  }
  return false;
}
