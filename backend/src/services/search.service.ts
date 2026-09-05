import { esClient, EMAIL_INDEX } from '../config/elasticsearch';

export interface EmailSearchDoc {
  id: string;
  userId: string;
  batchId?: string | null;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
}

export class SearchService {
  /**
   * Index or update an email document in Elasticsearch
   */
  public static async indexEmail(email: EmailSearchDoc): Promise<void> {
    try {
      await esClient.index({
        index: EMAIL_INDEX,
        id: email.id,
        document: email,
      });
    } catch (error: any) {
      console.error(`[SearchService] Error indexing email ${email.id}:`, error.message);
    }
  }

  /**
   * Update an email's status & sentAt in Elasticsearch
   */
  public static async updateEmailStatus(
    emailId: string,
    status: string,
    sentAt?: Date | null,
    scheduledAt?: Date | null
  ): Promise<void> {
    try {
      const doc: any = { status };
      if (sentAt !== undefined) doc.sentAt = sentAt ? sentAt.toISOString() : null;
      if (scheduledAt !== undefined) doc.scheduledAt = scheduledAt ? scheduledAt.toISOString() : null;

      await esClient.update({
        index: EMAIL_INDEX,
        id: emailId,
        doc,
      });
    } catch (error: any) {
      console.error(`[SearchService] Error updating status in ES for ${emailId}:`, error.message);
    }
  }

  /**
   * Search emails across recipient, subject, and body for a given user & status
   */
  public static async searchEmails(params: {
    userId: string;
    query?: string;
    status?: string;
    from?: number;
    size?: number;
  }): Promise<{ total: number; emails: any[] }> {
    const { userId, query, status, from = 0, size = 50 } = params;

    const mustConditions: any[] = [{ term: { userId } }];

    if (status) {
      mustConditions.push({ term: { status } });
    }

    if (query && query.trim()) {
      mustConditions.push({
        multi_match: {
          query: query.trim(),
          fields: ['subject^3', 'recipientEmail^2', 'body'],
          fuzziness: 'AUTO',
        },
      });
    }

    try {
      const response = await esClient.search({
        index: EMAIL_INDEX,
        from,
        size,
        query: {
          bool: {
            must: mustConditions,
          },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
      });

      const hits = response.hits.hits;
      const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0;

      return {
        total,
        emails: hits.map((hit) => hit._source),
      };
    } catch (error: any) {
      console.error('[SearchService] Error searching Elasticsearch:', error.message);
      return { total: 0, emails: [] };
    }
  }
}
