'use client';

import React from 'react';
import { Mail, Clock, Send, Plus, ChevronDown, ExternalLink, Slack } from 'lucide-react';
import { User, EmailCounts } from '../lib/api';

interface SidebarProps {
  user: User | null;
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onComposeClick: () => void;
  counts: EmailCounts;
  slackConnected: boolean;
  onConnectSlack: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onTabChange,
  onComposeClick,
  counts,
  slackConnected,
  onConnectSlack,
}) => {
  return (
    <aside className="w-64 bg-[#fbfbfb] border-r border-[#e5e7eb] flex flex-col h-screen select-none">
      {/* Top Brand Logo */}
      <div className="p-5 pb-3">
        <div className="flex items-center space-x-2">
          <span className="font-extrabold text-2xl tracking-tighter text-black">ONG</span>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="px-4 py-2">
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3 overflow-hidden">
            <img
              src={user?.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&auto=format&fit=crop&q=80'}
              alt="Avatar"
              className="w-9 h-9 rounded-full object-cover border border-gray-100"
            />
            <div className="truncate">
              <p className="font-semibold text-sm text-gray-800 truncate">{user?.name || 'Oliver Brown'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email || 'oliver.brown@domain.io'}</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>
      </div>

      {/* Compose Button */}
      <div className="px-4 py-3">
        <button
          onClick={onComposeClick}
          className="w-full border-2 border-[#00aa55] text-[#00aa55] hover:bg-[#e6f7ef] transition-colors font-semibold py-2 px-4 rounded-xl flex items-center justify-center space-x-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Compose</span>
        </button>
      </div>

      {/* Navigation Links */}
      <div className="px-4 py-2 flex-1">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">CORE</p>
        <nav className="space-y-1">
          <button
            onClick={() => onTabChange('scheduled')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === 'scheduled'
                ? 'bg-[#e8f8f0] text-[#00aa55] font-semibold'
                : 'text-gray-600 hover:bg-gray-100 font-medium'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Clock className="w-4 h-4" />
              <span>Scheduled</span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'scheduled' ? 'bg-[#c5eed9] text-[#008844] font-bold' : 'text-gray-400'
              }`}
            >
              {counts.scheduled}
            </span>
          </button>

          <button
            onClick={() => onTabChange('sent')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === 'sent'
                ? 'bg-[#e8f8f0] text-[#00aa55] font-semibold'
                : 'text-gray-600 hover:bg-gray-100 font-medium'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Send className="w-4 h-4" />
              <span>Sent</span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'sent' ? 'bg-[#c5eed9] text-[#008844] font-bold' : 'text-gray-400'
              }`}
            >
              {counts.sent}
            </span>
          </button>
        </nav>
      </div>

      {/* Footer Utilities (Slack & Bull Board) */}
      <div className="p-4 border-t border-gray-200 space-y-2 bg-gray-50/50">
        {/* Slack Connection Status */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-2.5">
          <div className="flex items-center space-x-2">
            <Slack className={`w-4 h-4 ${slackConnected ? 'text-[#4A154B]' : 'text-gray-400'}`} />
            <span className="text-xs font-medium text-gray-700">
              {slackConnected ? 'Slack Alert: ON' : 'Slack Alert: OFF'}
            </span>
          </div>
          {!slackConnected ? (
            <button
              onClick={onConnectSlack}
              className="text-[11px] bg-gray-900 text-white hover:bg-black font-semibold px-2 py-1 rounded"
            >
              Connect
            </button>
          ) : (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>

        {/* Live BullMQ Dashboard link */}
        <a
          href="http://localhost:5000/admin/queues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full text-xs text-gray-600 hover:text-black bg-white border border-gray-200 rounded-lg p-2.5 hover:bg-gray-50 transition"
        >
          <span className="font-medium">Live Queue Board</span>
          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
        </a>
      </div>
    </aside>
  );
};
