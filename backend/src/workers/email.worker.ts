import { Worker, Job } from 'bullmq';
import { redisOptions } from '../config/redis';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import { EMAIL_QUEUE_NAME, EmailJobData, scheduleEmailJob } from '../queues/email.queue';
import { RateLimiterService } from '../services/rate-limiter.service';
import { SlackService } from '../services/slack.service';
import { SearchService } from '../services/search.service';
import { sendEmailViaSmtp } from '../config/smtp';

export function setupEmailWorker() {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId } = job.data;
      console.log(`[Worker] Processing email job ${job.id} for email ID: ${emailId}`);

      // 1. Fetch current authoritative state from MySQL
      const email = await prisma.email.findUnique({
        where: { id: emailId },
        include: {
          sender: {
            include: { user: true },
          },
          batch: true,
        },
      });

      if (!email) {
        console.warn(`[Worker] Email ${emailId} not found in database. Skipping.`);
        return { skipped: true, reason: 'NOT_FOUND' };
      }

      // 2. Idempotency & cancellation check
      if (email.status === 'SENT') {
        console.log(`[Worker] Email ${emailId} already marked as SENT. Skipping (idempotent).`);
        return { skipped: true, reason: 'ALREADY_SENT' };
      }

      if (email.status === 'CANCELLED') {
        console.log(`[Worker] Email ${emailId} was CANCELLED by user. Skipping.`);
        return { skipped: true, reason: 'CANCELLED' };
      }

      const sender = email.sender;
      const effectiveHourlyLimit = Math.min(
        sender.hourlyLimit,
        email.batch?.hourlyLimit || config.scheduler.defaultMaxEmailsPerHour
      );

      // 3. Rate Limit Check (Atomic Redis Counter)
      const rateCheck = await RateLimiterService.checkAndIncrementSenderLimit(
        sender.id,
        effectiveHourlyLimit
      );

      if (!rateCheck.allowed) {
        const retryAfterMs = rateCheck.retryAfterMs || 3600000;
        const rescheduledTime = new Date(Date.now() + retryAfterMs);

        console.warn(
          `[Worker] Rate limit reached for sender ${sender.email} (${rateCheck.currentCount}/${effectiveHourlyLimit}). Rescheduling ${emailId} to ${rescheduledTime.toISOString()}`
        );

        // A. Reschedule in MySQL
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: 'SCHEDULED',
            scheduledAt: rescheduledTime,
            attemptCount: { increment: 1 },
          },
        });

        // B. Re-enqueue in BullMQ
        await scheduleEmailJob(email.id, retryAfterMs);

        // C. Update Elasticsearch
        await SearchService.updateEmailStatus(email.id, 'SCHEDULED', null, rescheduledTime);

        // D. Trigger Slack Alert if needed (deduplicated per hour)
        if (rateCheck.shouldAlertSlack) {
          console.log(`[Worker] Dispatching Slack alert for sender ${sender.email}`);
          await SlackService.notifyRateLimitHit({
            userId: sender.userId,
            senderEmail: sender.email,
            senderName: sender.displayName,
            hourlyLimit: effectiveHourlyLimit,
            rescheduledTime,
          });
        }

        return { rescheduled: true, nextAttempt: rescheduledTime };
      }

      // 4. Transition to PROCESSING state
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'PROCESSING',
          processingStartedAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });

      try {
        // 5. Send via Ethereal SMTP
        console.log(`[Worker] Sending email to ${email.recipientEmail} via ${sender.email}...`);
        const sendResult = await sendEmailViaSmtp(
          {
            from: `"${sender.displayName}" <${sender.email}>`,
            to: email.recipientEmail,
            subject: email.subject,
            html: email.body,
          },
          sender.smtpUser && sender.smtpPass
            ? {
                user: sender.smtpUser,
                pass: sender.smtpPass,
                host: sender.smtpHost,
                port: sender.smtpPort,
              }
            : undefined
        );

        const sentAt = new Date();

        // 6. Record success in MySQL
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: 'SENT',
            sentAt,
            providerMessageId: sendResult.messageId,
            previewUrl: sendResult.previewUrl ? String(sendResult.previewUrl) : null,
          },
        });

        // Update batch sent count if part of a batch
        if (email.batchId) {
          await prisma.emailBatch.update({
            where: { id: email.batchId },
            data: { sentCount: { increment: 1 } },
          });
        }

        // 7. Update Elasticsearch index
        await SearchService.updateEmailStatus(email.id, 'SENT', sentAt);

        console.log(`[Worker] Successfully sent email ${emailId}! Preview: ${sendResult.previewUrl}`);

        return {
          success: true,
          messageId: sendResult.messageId,
          previewUrl: sendResult.previewUrl,
        };
      } catch (sendError: any) {
        console.error(`[Worker] Failed to send email ${emailId}:`, sendError.message);

        // Record failure in MySQL
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: 'FAILED',
            errorMessage: sendError.message,
          },
        });

        if (email.batchId) {
          await prisma.emailBatch.update({
            where: { id: email.batchId },
            data: { failedCount: { increment: 1 } },
          });
        }

        await SearchService.updateEmailStatus(email.id, 'FAILED');

        throw sendError; // BullMQ records job failure
      }
    },
    {
      connection: redisOptions,
      concurrency: config.scheduler.workerConcurrency, // Configurable worker concurrency
    }
  );

  worker.on('ready', () => {
    console.log(`[Worker] BullMQ worker initialized with concurrency: ${config.scheduler.workerConcurrency}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
  });

  return worker;
}

// Standalone execution if started directly via "npm run worker"
if (require.main === module) {
  setupEmailWorker();
}
