import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import axios from 'axios';

export class AuthController {
  /**
   * Returns default user (Oliver Brown from the Figma mockup) or creates it if not exists.
   * Useful for immediate demo and testing.
   */
  public static async getOrCreateDefaultUser() {
    let user = await prisma.user.findFirst({
      where: { email: 'oliver.brown@domain.io' },
      include: { senders: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Oliver Brown',
          email: 'oliver.brown@domain.io',
          avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&auto=format&fit=crop&q=80',
          senders: {
            create: [
              {
                email: 'oliver.brown@domain.io',
                displayName: 'Oliver Brown',
                smtpHost: 'smtp.ethereal.email',
                smtpPort: 587,
                smtpUser: config.ethereal.user || '',
                smtpPass: config.ethereal.pass || '',
                hourlyLimit: 100,
                isDefault: true,
              },
              {
                email: 'growth@domain.io',
                displayName: 'ReachInbox Growth',
                smtpHost: 'smtp.ethereal.email',
                smtpPort: 587,
                smtpUser: config.ethereal.user || '',
                smtpPass: config.ethereal.pass || '',
                hourlyLimit: 50,
                isDefault: false,
              },
            ],
          },
        },
        include: { senders: true },
      });
    }

    return user;
  }

  /**
   * GET /api/auth/me
   */
  public static async getMe(req: Request, res: Response) {
    try {
      const user = await AuthController.getOrCreateDefaultUser();
      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          senders: user.senders,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/auth/google/url
   * Generates Google OAuth consent URL
   */
  public static getGoogleAuthUrl(req: Request, res: Response) {
    if (!config.google.clientId) {
      return res.status(400).json({
        success: false,
        message: 'Google Client ID is not configured in .env',
      });
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: config.google.callbackUrl,
      client_id: config.google.clientId,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
    };

    const qs = new URLSearchParams(options).toString();
    return res.json({ url: `${rootUrl}?${qs}` });
  }

  /**
   * GET /api/auth/google/callback
   */
  public static async googleCallback(req: Request, res: Response) {
    const code = req.query.code as string;
    if (!code) {
      return res.redirect(`${config.frontendUrl}/login?error=no_code`);
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.callbackUrl,
        grant_type: 'authorization_code',
      });

      const { id_token, access_token } = tokenResponse.data;

      // Fetch user profile from Google
      const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const profile = profileResponse.data;

      // Upsert user in database
      const user = await prisma.user.upsert({
        where: { email: profile.email },
        create: {
          googleId: profile.id,
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          avatarUrl: profile.picture,
          senders: {
            create: {
              email: profile.email,
              displayName: profile.name || profile.email,
              smtpHost: 'smtp.ethereal.email',
              smtpPort: 587,
              smtpUser: config.ethereal.user || '',
              smtpPass: config.ethereal.pass || '',
              hourlyLimit: 100,
              isDefault: true,
            },
          },
        },
        update: {
          googleId: profile.id,
          name: profile.name,
          avatarUrl: profile.picture,
        },
      });

      // Redirect to frontend dashboard
      return res.redirect(`${config.frontendUrl}/dashboard?userId=${user.id}`);
    } catch (err: any) {
      console.error('[AuthController] Google login error:', err.response?.data || err.message);
      return res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
    }
  }

  /**
   * POST /api/auth/sync-user
   * Synchronizes Firebase user details with MySQL and ensures a sender exists
   */
  public static async syncUser(req: Request, res: Response) {
    try {
      const { email, name, avatarUrl, googleId } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name: name || email.split('@')[0],
          avatarUrl:
            avatarUrl ||
            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&auto=format&fit=crop&q=80',
          googleId: googleId || null,
          senders: {
            create: {
              email,
              displayName: name || email.split('@')[0],
              smtpHost: 'smtp.ethereal.email',
              smtpPort: 587,
              smtpUser: config.ethereal.user || '',
              smtpPass: config.ethereal.pass || '',
              hourlyLimit: 100,
              isDefault: true,
            },
          },
        },
        update: {
          name: name || undefined,
          avatarUrl: avatarUrl || undefined,
          googleId: googleId || undefined,
        },
        include: { senders: true },
      });

      return res.json({ success: true, user });
    } catch (error: any) {
      console.error('[AuthController] Error syncing user:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
