import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { EmailService } from '../services/email.service';
import { SearchService } from '../services/search.service';
import { AuthController } from './auth.controller';

export class EmailController {
  /**
   * Helper to resolve the authenticated user from request header or query
   */
  public static async resolveUser(req: Request) {
    const userId =
      (req.headers['x-user-id'] as string) ||
      (req.query.userId as string) ||
      (req.body?.userId as string);

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { senders: true },
      });
      if (user) return user;
    }

    return await AuthController.getOrCreateDefaultUser();
  }

  /**
   * POST /api/emails/schedule
   */
  public static async scheduleEmails(req: Request, res: Response) {
    try {
      const user = await EmailController.resolveUser(req);
      const {
        senderId,
        subject,
        body,
        recipients,
        startTime,
        delayBetweenEmailsMs,
        hourlyLimit,
      } = req.body;

      if (!subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Subject, body, and at least one recipient email are required.',
        });
      }

      // Default to first sender if senderId not provided
      const targetSenderId = senderId || user.senders[0]?.id;
      if (!targetSenderId) {
        return res.status(400).json({ success: false, message: 'No sender mailbox found for user.' });
      }

      const result = await EmailService.scheduleEmailBatch({
        userId: user.id,
        senderId: targetSenderId,
        subject,
        body,
        recipients,
        startTime: startTime ? new Date(startTime) : new Date(),
        delayBetweenEmailsMs: delayBetweenEmailsMs ? parseInt(delayBetweenEmailsMs, 10) : 2000,
        hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : 100,
      });

      return res.status(201).json({
        success: true,
        message: `Successfully scheduled ${result.scheduledCount} email(s).`,
        data: result,
      });
    } catch (error: any) {
      console.error('[EmailController] Error scheduling emails:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/emails/counts
   * Returns counts for the sidebar badges: Scheduled & Sent
   */
  public static async getEmailCounts(req: Request, res: Response) {
    try {
      const user = await EmailController.resolveUser(req);

      const [scheduledCount, sentCount] = await Promise.all([
        prisma.email.count({
          where: {
            sender: { userId: user.id },
            status: { in: ['SCHEDULED', 'PROCESSING'] },
          },
        }),
        prisma.email.count({
          where: {
            sender: { userId: user.id },
            status: 'SENT',
          },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          scheduled: scheduledCount,
          sent: sentCount,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/emails/scheduled
   */
  public static async getScheduledEmails(req: Request, res: Response) {
    try {
      const user = await EmailController.resolveUser(req);
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const skip = (page - 1) * limit;

      const [emails, total] = await Promise.all([
        prisma.email.findMany({
          where: {
            sender: { userId: user.id },
            status: { in: ['SCHEDULED', 'PROCESSING'] },
          },
          include: { sender: true },
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limit,
        }),
        prisma.email.count({
          where: {
            sender: { userId: user.id },
            status: { in: ['SCHEDULED', 'PROCESSING'] },
          },
        }),
      ]);

      return res.json({
        success: true,
        data: emails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/emails/sent
   */
  public static async getSentEmails(req: Request, res: Response) {
    try {
      const user = await EmailController.resolveUser(req);
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const skip = (page - 1) * limit;

      const [emails, total] = await Promise.all([
        prisma.email.findMany({
          where: {
            sender: { userId: user.id },
            status: 'SENT',
          },
          include: { sender: true },
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.email.count({
          where: {
            sender: { userId: user.id },
            status: 'SENT',
          },
        }),
      ]);

      return res.json({
        success: true,
        data: emails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/emails/search
   * Uses Elasticsearch to search across subject, recipient, body
   */
  public static async searchEmails(req: Request, res: Response) {
    try {
      const user = await EmailController.resolveUser(req);
      const query = (req.query.q as string) || '';
      const status = req.query.status as string;

      const results = await SearchService.searchEmails({
        userId: user.id,
        query,
        status,
      });

      if (results.emails && results.emails.length > 0) {
        return res.json({
          success: true,
          data: results.emails,
          total: results.total,
          source: 'elasticsearch',
        });
      }

      // High-availability fallback: Query MySQL directly if ES returned 0 or is indexing
      if (query && query.trim()) {
        const dbEmails = await prisma.email.findMany({
          where: {
            sender: { userId: user.id },
            ...(status ? { status: status as any } : {}),
            OR: [
              { subject: { contains: query.trim() } },
              { recipientEmail: { contains: query.trim() } },
              { body: { contains: query.trim() } },
            ],
          },
          include: { sender: true },
          orderBy: { scheduledAt: 'desc' },
          take: 50,
        });

        return res.json({
          success: true,
          data: dbEmails,
          total: dbEmails.length,
          source: 'mysql_fallback',
        });
      }

      return res.json({
        success: true,
        data: [],
        total: 0,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/emails/:id
   */
  public static async getEmailById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const email = await prisma.email.findUnique({
        where: { id },
        include: {
          sender: true,
          batch: true,
          attachments: true,
        },
      });

      if (!email) {
        return res.status(404).json({ success: false, message: 'Email not found' });
      }

      return res.json({ success: true, data: email });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/emails/parse-leads
   * Parses CSV or raw string input and returns extracted email leads
   */
  public static parseLeads(req: Request, res: Response) {
    try {
      const { content } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ success: false, message: 'Content string is required' });
      }

      const emails = EmailService.parseEmailLeads(content);
      return res.json({
        success: true,
        count: emails.length,
        emails,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
