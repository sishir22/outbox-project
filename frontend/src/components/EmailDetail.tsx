'use client';

import React from 'react';
import { ArrowLeft, Star, Trash2, Archive, ExternalLink } from 'lucide-react';
import { EmailRecord } from '../lib/api';

interface EmailDetailProps {
  email: EmailRecord;
  onBack: () => void;
}

export const EmailDetail: React.FC<EmailDetailProps> = ({ email, onBack }) => {
  const senderName = email.sender?.displayName || 'ReachInbox Outreach';
  const senderEmail = email.sender?.email || 'sender@domain.io';

  const formatDetailTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-white overflow-hidden">
      {/* Detail View Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-600"
            title="Back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 truncate">{email.subject}</h2>
        </div>
        <div className="flex items-center space-x-2 text-gray-400">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <Star className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <Trash2 className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Email Thread Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Sender Info Bar */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#00aa55] text-white flex items-center justify-center font-bold text-sm">
              {senderName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-baseline space-x-2">
                <span className="font-semibold text-sm text-gray-900">{senderName}</span>
                <span className="text-xs text-gray-400">&lt;{senderEmail}&gt;</span>
              </div>
              <p className="text-xs text-gray-500">to {email.recipientEmail}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400">
              {formatDetailTime(email.sentAt || email.scheduledAt)}
            </span>
            <div className="mt-1">
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  email.status === 'SENT'
                    ? 'bg-green-100 text-green-700'
                    : email.status === 'SCHEDULED'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {email.status}
              </span>
            </div>
          </div>
        </div>

        {/* Ethereal Fake SMTP Preview Banner */}
        {email.previewUrl && (
          <div className="mb-6 p-3 bg-[#e8f8f0] border border-[#b2e5cc] rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-[#008844]">
              <span className="font-bold">Ethereal SMTP Inbox:</span>
              <span>This email was captured by Ethereal fake SMTP server.</span>
            </div>
            <a
              href={email.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-[#00aa55] hover:bg-[#009248] text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition"
            >
              <span>View Live HTML</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Email Content */}
        <div
          className="prose max-w-none text-sm text-gray-800 leading-relaxed font-normal"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />
      </div>
    </div>
  );
};
