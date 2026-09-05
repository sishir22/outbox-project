import { redisClient } from '../config/redis';
import { config } from '../config/env';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfterMs?: number;
  shouldAlertSlack?: boolean;
}

export class RateLimiterService {
  /**
   * Generates a string key representing the current 1-hour window (e.g. "2026-09-04T20")
   */
  public static getHourWindowKey(date: Date = new Date()): string {
    return date.toISOString().substring(0, 13);
  }

  /**
   * Calculates milliseconds remaining until the top of the next hour
   */
  public static getMsUntilNextHour(date: Date = new Date()): number {
    const nextHour = new Date(date);
    nextHour.setMinutes(60, 0, 0); // Next :00:00 mark
    return Math.max(1000, nextHour.getTime() - date.getTime());
  }

  /**
   * Checks whether a sender has remaining quota for the current hour.
   * If quota is available, atomically increments the counter.
   * If quota is exceeded, calculates the delay until the next hour.
   */
  public static async checkAndIncrementSenderLimit(
    senderId: string,
    hourlyLimit: number = config.scheduler.defaultMaxEmailsPerHour
  ): Promise<RateLimitCheckResult> {
    const hourKey = this.getHourWindowKey();
    const redisKey = `ratelimit:sender:${senderId}:${hourKey}`;

    // Atomically increment counter
    const currentCount = await redisClient.incr(redisKey);

    // If first request in this hour, set 2-hour TTL
    if (currentCount === 1) {
      await redisClient.expire(redisKey, 7200);
    }

    if (currentCount > hourlyLimit) {
      // Exceeded limit. Check if we should alert Slack (deduplicated per hour)
      const alertLockKey = `ratelimit:alerted:sender:${senderId}:${hourKey}`;
      const shouldAlertSlack = Boolean(
        await redisClient.set(alertLockKey, '1', 'EX', 3600, 'NX')
      );

      const retryAfterMs = this.getMsUntilNextHour();

      return {
        allowed: false,
        currentCount,
        limit: hourlyLimit,
        retryAfterMs,
        shouldAlertSlack,
      };
    }

    return {
      allowed: true,
      currentCount,
      limit: hourlyLimit,
    };
  }

  /**
   * Gets current usage count for a sender in the current hour window
   */
  public static async getSenderCurrentUsage(senderId: string): Promise<number> {
    const hourKey = this.getHourWindowKey();
    const redisKey = `ratelimit:sender:${senderId}:${hourKey}`;
    const count = await redisClient.get(redisKey);
    return count ? parseInt(count, 10) : 0;
  }
}
