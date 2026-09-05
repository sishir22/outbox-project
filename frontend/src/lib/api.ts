const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000/api';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  senders: Sender[];
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  hourlyLimit: number;
  isDefault: boolean;
}

export interface EmailRecord {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduledAt: string;
  sentAt?: string | null;
  previewUrl?: string | null;
  errorMessage?: string | null;
  sender?: Sender;
  createdAt: string;
}

export interface EmailCounts {
  scheduled: number;
  sent: number;
}

export async function fetchMe(): Promise<{ success: boolean; user: User }> {
  const res = await fetch(`${API_BASE}/auth/me`, { cache: 'no-store' });
  return res.json();
}

export async function syncUserWithBackend(userData: {
  email: string;
  name?: string;
  avatarUrl?: string;
  googleId?: string;
}): Promise<{ success: boolean; user: User }> {
  const res = await fetch(`${API_BASE}/auth/sync-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  return res.json();
}

export function getAuthHeaders(): Record<string, string> {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('reachinbox_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u?.id) return { 'x-user-id': u.id };
      } catch {}
    }
  }
  return {};
}

export async function fetchCounts(): Promise<{ success: boolean; data: EmailCounts }> {
  const res = await fetch(`${API_BASE}/emails/counts`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  return res.json();
}

export async function fetchScheduledEmails(page = 1, limit = 50): Promise<{
  success: boolean;
  data: EmailRecord[];
  pagination: any;
}> {
  const res = await fetch(`${API_BASE}/emails/scheduled?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  return res.json();
}

export async function fetchSentEmails(page = 1, limit = 50): Promise<{
  success: boolean;
  data: EmailRecord[];
  pagination: any;
}> {
  const res = await fetch(`${API_BASE}/emails/sent?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  return res.json();
}

export async function searchEmails(query: string, status?: string): Promise<{
  success: boolean;
  data: EmailRecord[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (status) params.append('status', status);

  const res = await fetch(`${API_BASE}/emails/search?${params.toString()}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  return res.json();
}

export async function fetchEmailById(id: string): Promise<{
  success: boolean;
  data: EmailRecord;
}> {
  const res = await fetch(`${API_BASE}/emails/${id}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  return res.json();
}

export async function scheduleEmailBatch(payload: {
  userId?: string;
  senderId?: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}) {
  const res = await fetch(`${API_BASE}/emails/schedule`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function parseLeads(content: string): Promise<{
  success: boolean;
  count: number;
  emails: string[];
}> {
  const res = await fetch(`${API_BASE}/emails/parse-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

export async function fetchSlackStatus(): Promise<{
  success: boolean;
  connected: boolean;
  teamName?: string;
  channel?: string;
}> {
  const res = await fetch(`${API_BASE}/slack/status`, { cache: 'no-store' });
  return res.json();
}

export async function testSlackNotification() {
  const res = await fetch(`${API_BASE}/slack/test`, { method: 'POST' });
  return res.json();
}

export async function getSlackAuthUrl(): Promise<{ success: boolean; url?: string; message?: string }> {
  const res = await fetch(`${API_BASE}/slack/auth-url`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  return res.json();
}
