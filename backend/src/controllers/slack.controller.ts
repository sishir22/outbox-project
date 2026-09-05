import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import { SlackService } from '../services/slack.service';
import { AuthController } from './auth.controller';

export class SlackController {
  /**
   * GET /api/slack/status
   */
  public static async getStatus(req: Request, res: Response) {
    try {
      const user = await AuthController.getOrCreateDefaultUser();
      const integration = await prisma.slackIntegration.findFirst({
        where: { userId: user.id, connected: true },
      });

      return res.json({
        success: true,
        connected: Boolean(integration),
        teamName: integration?.teamName || null,
        channel: integration?.channel || null,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/slack/auth-url
   */
  public static getAuthUrl(req: Request, res: Response) {
    if (!config.slack.clientId) {
      return res.status(400).json({
        success: false,
        message: 'Slack Client ID is not configured in .env',
      });
    }

    const scopes = ['incoming-webhook', 'chat:write'].join(',');
    const url = `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(
      config.slack.redirectUri
    )}`;

    return res.json({ success: true, url });
  }

  /**
   * GET /api/slack/callback
   */
  public static async callback(req: Request, res: Response) {
    const code = req.query.code as string;
    if (!code) {
      return res.redirect(`${config.frontendUrl}/dashboard?slack=error_no_code`);
    }

    try {
      const user = await AuthController.getOrCreateDefaultUser();
      await SlackService.exchangeOAuthCode(code, user.id);
      return res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
    } catch (error: any) {
      console.error('[SlackController] Callback error:', error.message);
      return res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
    }
  }

  /**
   * POST /api/slack/disconnect
   */
  public static async disconnect(req: Request, res: Response) {
    try {
      const user = await AuthController.getOrCreateDefaultUser();
      await prisma.slackIntegration.updateMany({
        where: { userId: user.id },
        data: { connected: false },
      });

      return res.json({ success: true, message: 'Slack disconnected' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/slack/test
   * Tests sending a live rate-limit alert to verify Slack connectivity
   */
  public static async sendTestNotification(req: Request, res: Response) {
    try {
      const user = await AuthController.getOrCreateDefaultUser();
      const sender = user.senders[0];

      const sent = await SlackService.notifyRateLimitHit({
        userId: user.id,
        senderEmail: sender?.email || 'oliver.brown@domain.io',
        senderName: sender?.displayName || 'Oliver Brown',
        hourlyLimit: 100,
        rescheduledTime: new Date(Date.now() + 3600000),
      });

      return res.json({
        success: sent,
        message: sent ? 'Live Slack alert delivered successfully!' : 'Slack not connected or delivery failed.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
