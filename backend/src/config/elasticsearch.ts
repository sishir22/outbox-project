import { Client } from '@elastic/elasticsearch';
import { config } from './env';

export const esClient = new Client({
  node: config.elasticsearch.node,
});

export const EMAIL_INDEX = 'emails';

export async function initElasticsearch(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      console.log(`[Elasticsearch] Index "${EMAIL_INDEX}" does not exist. Creating...`);
      await esClient.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            batchId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text', analyzer: 'standard' },
            body: { type: 'text', analyzer: 'standard' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      console.log(`[Elasticsearch] Index "${EMAIL_INDEX}" created successfully.`);
    } else {
      console.log(`[Elasticsearch] Index "${EMAIL_INDEX}" already exists.`);
    }
  } catch (error: any) {
    console.error('[Elasticsearch] Initialization error:', error.message);
  }
}
