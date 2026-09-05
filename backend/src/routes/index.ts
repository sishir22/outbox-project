import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { EmailController } from '../controllers/email.controller';
import { SlackController } from '../controllers/slack.controller';

const router = Router();

// Auth Routes
router.get('/auth/me', AuthController.getMe);
router.post('/auth/sync-user', AuthController.syncUser);
router.get('/auth/google/url', AuthController.getGoogleAuthUrl);
router.get('/auth/google/callback', AuthController.googleCallback);

// Email Routes
router.post('/emails/schedule', EmailController.scheduleEmails);
router.get('/emails/counts', EmailController.getEmailCounts);
router.get('/emails/scheduled', EmailController.getScheduledEmails);
router.get('/emails/sent', EmailController.getSentEmails);
router.get('/emails/search', EmailController.searchEmails);
router.post('/emails/parse-leads', EmailController.parseLeads);
router.get('/emails/:id', EmailController.getEmailById);

// Slack Routes
router.get('/slack/status', SlackController.getStatus);
router.get('/slack/auth-url', SlackController.getAuthUrl);
router.get('/slack/callback', SlackController.callback);
router.post('/slack/disconnect', SlackController.disconnect);
router.post('/slack/test', SlackController.sendTestNotification);

export default router;
