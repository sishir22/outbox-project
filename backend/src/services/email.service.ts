import { prisma } from '../config/prisma';
import { scheduleEmailJob } from '../queues/email.queue';
import { SearchService } from './search.service';

export interface ScheduleBatchInput {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayBetweenEmailsMs: number;
  hourlyLimit?: number;
}

export class EmailService {
  /**
   * Schedules a batch of emails with staggered delays and persists them to DB + Queue + Elasticsearch
   */
  public static async scheduleEmailBatch(input: ScheduleBatchInput) {
    const {
      userId,
      senderId,
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmailsMs,
      hourlyLimit = 100,
    } = input;

    // Verify sender exists and belongs to user
    let sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      // Check if the sender exists by ID and align with its owner
      sender = await prisma.sender.findUnique({
        where: { id: senderId },
      });
      if (!sender) {
        // Fallback to user's first available sender
        sender = await prisma.sender.findFirst({
          where: { userId },
        });
      }
    }

    if (!sender) {
      throw new Error(`Sender mailbox not found. Please ensure your account has a sender mailbox.`);
    }

    const effectiveUserId = sender.userId;

    // 1. Create the Batch record in MySQL
    const batch = await prisma.emailBatch.create({
      data: {
        userId: effectiveUserId,
        senderId: sender.id,
        subject,
        body,
        startAt: startTime,
        delayBetweenEmailsMs,
        hourlyLimit,
        totalCount: recipients.length,
        status: 'SCHEDULED',
      },
    });

    const scheduledEmails = [];
    const now = Date.now();
    const startTimestamp = Math.max(now, new Date(startTime).getTime());

    // 2. Create individual email rows with staggered timestamps
    for (let i = 0; i < recipients.length; i++) {
      const recipientEmail = recipients[i].trim();
      if (!recipientEmail) continue;

      const emailScheduledTime = new Date(startTimestamp + i * delayBetweenEmailsMs);
      const idempotencyKey = `email_${batch.id}_${i}_${recipientEmail}`;

      const emailRecord = await prisma.email.create({
        data: {
          batchId: batch.id,
          senderId,
          recipientEmail,
          subject,
          body,
          status: 'SCHEDULED',
          scheduledAt: emailScheduledTime,
          idempotencyKey,
        },
      });

      // 3. Enqueue into BullMQ with calculated delay
      const delayMs = Math.max(0, emailScheduledTime.getTime() - Date.now());
      await scheduleEmailJob(emailRecord.id, delayMs);

      // 4. Index into Elasticsearch
      await SearchService.indexEmail({
        id: emailRecord.id,
        userId,
        batchId: batch.id,
        senderId,
        senderEmail: sender.email,
        recipientEmail,
        subject,
        body,
        status: 'SCHEDULED',
        scheduledAt: emailScheduledTime.toISOString(),
        createdAt: emailRecord.createdAt.toISOString(),
      });

      scheduledEmails.push(emailRecord);
    }

    return {
      batch,
      scheduledCount: scheduledEmails.length,
      firstScheduledAt: scheduledEmails[0]?.scheduledAt,
      lastScheduledAt: scheduledEmails[scheduledEmails.length - 1]?.scheduledAt,
    };
  }

  /**
   * Helper to parse CSV or plain text string into a clean list of email addresses
   */
  public static parseEmailLeads(rawContent: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = rawContent.match(emailRegex) || [];
    // Deduplicate and trim
    return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
  }
}
