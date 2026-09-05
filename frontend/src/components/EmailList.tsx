'use client';

import React from 'react';
import { Search, SlidersHorizontal, RotateCw, Star, Clock, ExternalLink } from 'lucide-react';
import { EmailRecord } from '../lib/api';

interface EmailListProps {
  emails: EmailRecord[];
  activeTab: 'scheduled' | 'sent';
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  onSelectEmail: (email: EmailRecord) => void;
  selectedEmailId: string | null;
  loading: boolean;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  activeTab,
  searchQuery,
  onSearchChange,
  onRefresh,
  onSelectEmail,
  selectedEmailId,
  loading,
}) => {
  const formatScheduledTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-white overflow-hidden">
      {/* Top Search Bar */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>
        <div className="flex items-center space-x-2 text-gray-400 ml-4">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button onClick={onRefresh} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Refresh">
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Email Rows List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mb-2"></div>
            <p>Loading emails...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <p className="text-sm">No {activeTab} emails found.</p>
            {searchQuery && <p className="text-xs text-gray-300 mt-1">Try clearing your search query.</p>}
          </div>
        ) : (
          emails.map((email) => {
            const isSelected = selectedEmailId === email.id;
            return (
              <div
                key={email.id}
                onClick={() => onSelectEmail(email)}
                className={`flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/80 cursor-pointer transition-colors ${
                  isSelected ? 'bg-green-50/40' : ''
                }`}
              >
                {/* Left Part: Recipient + Badge + Subject snippet */}
                <div className="flex items-center space-x-3 overflow-hidden flex-1 pr-4">
                  {/* Recipient */}
                  <span className="text-sm font-semibold text-gray-800 whitespace-nowrap min-w-[140px] truncate">
                    To: {email.recipientEmail.split('@')[0]}
                  </span>

                  {/* Status / Scheduled Time Badge */}
                  {activeTab === 'scheduled' ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#fff2e8] text-[#d46b08] border border-[#ffd591] flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{formatScheduledTime(email.scheduledAt)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 flex-shrink-0">
                      Sent
                    </span>
                  )}

                  {/* Subject & snippet */}
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-sm font-medium text-gray-900 truncate">{email.subject}</span>
                    <span className="text-sm text-gray-400 truncate">
                      - {email.body.replace(/<[^>]*>?/gm, '').substring(0, 70)}
                    </span>
                  </div>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center space-x-3 text-gray-300 flex-shrink-0">
                  {email.previewUrl && (
                    <a
                      href={email.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-green-600 hover:underline flex items-center space-x-1"
                      title="View Ethereal Email Preview"
                    >
                      <span>Ethereal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button className="hover:text-yellow-400 transition" onClick={(e) => e.stopPropagation()}>
                    <Star className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
