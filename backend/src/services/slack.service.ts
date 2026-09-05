import axios from 'axios';
import { prisma } from '../config/prisma';
import { config } from '../config/env';

export class SlackService {
  /**
   * Exchanges authorization code for Slack access token & webhook
   */
  public static async exchangeOAuthCode(code: string, userId: string) {
    try {
      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          code,
          redirect_uri: config.slack.redirectUri,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const data = response.data;
      if (!data.ok) {
        throw new Error(data.error || 'Failed to exchange Slack OAuth code');
      }

      const teamId = data.team?.id || data.team_id || 'unknown_team';
      const teamName = data.team?.name || 'My Workspace';
      const accessToken = data.access_token;
      const incomingWebhookUrl = data.incoming_webhook?.url;
      const channel = data.incoming_webhook?.channel;
      const channelId = data.incoming_webhook?.channel_id;

      // Upsert in database
      const integration = await prisma.slackIntegration.upsert({
        where: {
          userId_teamId: {
            userId,
            teamId,
          },
        },
        create: {
          userId,
          teamId,
          teamName,
          accessToken,
          incomingWebhookUrl,
          channel,
          channelId,
          connected: true,
        },
        update: {
          teamName,
          accessToken,
          incomingWebhookUrl,
          channel,
          channelId,
          connected: true,
        },
      });

      return integration;
    } catch (error: any) {
      console.error('[SlackService] Error in OAuth exchange:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Dispatches a notification to Slack when a sender hits the hourly limit.
   * Gracefully handles users who have not connected Slack.
   */
  public static async notifyRateLimitHit(params: {
    userId: string;
    senderEmail: string;
    senderName: string;
    hourlyLimit: number;
    rescheduledTime: Date;
  }): Promise<boolean> {
    const { userId, senderEmail, senderName, hourlyLimit, rescheduledTime } = params;

    const integration = await prisma.slackIntegration.findFirst({
      where: { userId, connected: true },
    });

    if (!integration) {
      // User hasn't connected Slack - assignment requires no crash
      console.log(`[SlackService] User ${userId} has not connected Slack. Skipping notification.`);
      return false;
    }

    const messagePayload = {
      text: `⚠️ *Hourly Rate Limit Reached* for sender \`${senderEmail}\``,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Outreach Rate Limit Alert',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n${senderName} (<mailto:${senderEmail}|${senderEmail}>)`,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Quota:*\n${hourlyLimit} emails / hour`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Status:* Quota reached. Remaining emails have been automatically delayed and rescheduled to start at *${rescheduledTime.toLocaleTimeString()}*. No emails were dropped.`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `ReachInbox Email Job Scheduler • Timestamp: ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    try {
      if (integration.incomingWebhookUrl) {
        await axios.post(integration.incomingWebhookUrl, messagePayload);
        console.log(`[SlackService] Sent webhook alert to Slack for sender ${senderEmail}`);
        return true;
      } else if (integration.accessToken && integration.channelId) {
        await axios.post(
          'https://slack.com/api/chat.postMessage',
          {
            channel: integration.channelId,
            ...messagePayload,
          },
          {
            headers: {
              Authorization: `Bearer ${integration.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log(`[SlackService] Sent chat.postMessage alert to Slack for sender ${senderEmail}`);
        return true;
      }
    } catch (err: any) {
      console.error('[SlackService] Failed to send Slack alert:', err.response?.data || err.message);
    }

    return false;
  }
}
