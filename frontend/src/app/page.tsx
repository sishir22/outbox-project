'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/Sidebar';
import { TopHeader } from '../components/TopHeader';
import { EmailList } from '../components/EmailList';
import { EmailDetail } from '../components/EmailDetail';
import { ComposeModal } from '../components/ComposeModal';
import {
  User,
  EmailRecord,
  EmailCounts,
  fetchMe,
  fetchCounts,
  fetchScheduledEmails,
  fetchSentEmails,
  searchEmails,
  fetchSlackStatus,
} from '../lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [counts, setCounts] = useState<EmailCounts>({ scheduled: 0, sent: 0 });
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);

  // Initial auth guard & load
  useEffect(() => {
    const savedUser = localStorage.getItem('reachinbox_user');
    if (!savedUser) {
      router.push('/login');
      return;
    }

    try {
      setUser(JSON.parse(savedUser));
    } catch {
      localStorage.removeItem('reachinbox_user');
      router.push('/login');
      return;
    }

    fetchSlackStatus().then((res) => {
      if (res.success) setSlackConnected(res.connected);
    });
  }, [router]);

  const refreshCounts = useCallback(async () => {
    const res = await fetchCounts();
    if (res.success) {
      setCounts(res.data);
    }
  }, []);

  // Fallback items matching Figma design when backend is offline/local
  const fallbackScheduled: EmailRecord[] = [
    {
      id: 'sched_1',
      recipientEmail: 'john.smith@example.com',
      subject: 'Meeting follow-up',
      body: '<p>Hi John, just wanted to follow up on our meeting...</p>',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sched_2',
      recipientEmail: 'olive@example.com',
      subject: "Ramit, great to meet you - you'll love it",
      body: '<p>Hi Olive, just wanted to follow up on our meeting... Looking forward to collaborating!</p>',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 172800000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  const fallbackSent: EmailRecord[] = [
    {
      id: 'sent_1',
      recipientEmail: 'sarah.wilson@example.com',
      subject: 'Re: Project Update',
      body: '<p>Thanks for the update, Sarah. Looks good!</p>',
      status: 'SENT',
      scheduledAt: new Date(Date.now() - 3600000).toISOString(),
      sentAt: new Date(Date.now() - 3500000).toISOString(),
      previewUrl: 'https://ethereal.email',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sent_2',
      recipientEmail: 'support@example.com',
      subject: 'Issue with login',
      body: '<p>I am having trouble logging in to the dashboard...</p>',
      status: 'SENT',
      scheduledAt: new Date(Date.now() - 7200000).toISOString(),
      sentAt: new Date(Date.now() - 7100000).toISOString(),
      previewUrl: 'https://ethereal.email',
      createdAt: new Date().toISOString(),
    },
  ];

  // Load email list based on active tab and search query
  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const res = await searchEmails(searchQuery, activeTab.toUpperCase());
        if (res?.success && res.data) setEmails(res.data);
      } else if (activeTab === 'scheduled') {
        const res = await fetchScheduledEmails();
        if (res?.success && res.data) setEmails(res.data);
      } else {
        const res = await fetchSentEmails();
        if (res?.success && res.data) setEmails(res.data);
      }
      refreshCounts();
    } catch (err) {
      console.warn('Backend API unreachable (using offline preview data):', err);
      if (activeTab === 'scheduled') {
        setEmails(fallbackScheduled);
      } else {
        setEmails(fallbackSent);
      }
      setCounts({ scheduled: fallbackScheduled.length, sent: fallbackSent.length });
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, refreshCounts]);

  useEffect(() => {
    loadEmails();
    const interval = setInterval(loadEmails, 5000); // Poll every 5s for live job transitions
    return () => clearInterval(interval);
  }, [loadEmails]);

  // Connect Slack flow
  const handleConnectSlack = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/slack/auth-url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Please configure SLACK_CLIENT_ID in backend/.env to connect live Slack.');
      }
    } catch {
      alert('Error fetching Slack OAuth URL');
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Left Sidebar matching Figma design */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedEmail(null);
          setIsComposeOpen(false);
        }}
        onComposeClick={() => {
          setIsComposeOpen(true);
          setSelectedEmail(null);
        }}
        counts={counts}
        slackConnected={slackConnected}
        onConnectSlack={handleConnectSlack}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header with User name, email, avatar, and Logout */}
        <TopHeader user={user} onLogout={() => setUser(null)} />

        <main className="flex-1 flex flex-col overflow-hidden">
          {isComposeOpen ? (
            <ComposeModal
              user={user}
              onClose={() => setIsComposeOpen(false)}
              onScheduled={() => {
                loadEmails();
                refreshCounts();
              }}
            />
          ) : selectedEmail ? (
            <EmailDetail
              email={selectedEmail}
              onBack={() => setSelectedEmail(null)}
            />
          ) : (
            <EmailList
              emails={emails}
              activeTab={activeTab}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefresh={loadEmails}
              onSelectEmail={(email) => setSelectedEmail(email)}
              selectedEmailId={selectedEmail ? (selectedEmail as EmailRecord).id : null}
              loading={loading}
            />
          )}
        </main>
      </div>
    </div>
  );
}
