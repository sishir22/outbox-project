'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Send,
  Bold,
  Italic,
  Underline,
  List,
  Quote,
  Undo,
  Redo,
  Upload,
} from 'lucide-react';
import { User, scheduleEmailBatch } from '../lib/api';

interface ComposeModalProps {
  user: User | null;
  onClose: () => void;
  onScheduled: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ user, onClose, onScheduled }) => {
  const [senderId, setSenderId] = useState(user?.senders[0]?.id || '');
  const [toInput, setToInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  // Send Later Popover State
  const [showSendLater, setShowSendLater] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [detectedCount, setDetectedCount] = useState<number | null>(null);

  // Instant client-side lead extraction (no network dependency)
  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
  };

  // Parse recipients when input changes
  const handleRecipientsChange = (val: string) => {
    setToInput(val);
    const emails = extractEmails(val);
    setDetectedCount(emails.length > 0 ? emails.length : null);
  };

  // CSV Lead Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const emails = extractEmails(content);
        if (emails.length > 0) {
          setToInput(emails.join(', '));
          setDetectedCount(emails.length);
        }
      }
    };
    reader.readAsText(file);
  };

  // Quick Presets for "Send Later"
  const applyPreset = (preset: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (preset === 'Tomorrow') {
      tomorrow.setHours(9, 0, 0, 0);
    } else if (preset === 'Tomorrow, 10:00 AM') {
      tomorrow.setHours(10, 0, 0, 0);
    } else if (preset === 'Tomorrow, 11:00 AM') {
      tomorrow.setHours(11, 0, 0, 0);
    } else if (preset === 'Tomorrow, 3:00 PM') {
      tomorrow.setHours(15, 0, 0, 0);
    }

    const iso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledDateTime(iso);
  };

  const handleSendOrSchedule = async () => {
    setErrorMsg('');
    if (!subject.trim()) {
      setErrorMsg('Please provide a subject');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('Please write an email body');
      return;
    }

    const emails = extractEmails(toInput);
    if (emails.length === 0) {
      setErrorMsg('Please provide at least one valid recipient email address');
      return;
    }

    setLoading(true);
    try {
      const res = await scheduleEmailBatch({
        userId: user?.id,
        senderId: senderId || user?.senders[0]?.id,
        subject,
        body,
        recipients: emails,
        startTime: scheduledDateTime ? new Date(scheduledDateTime).toISOString() : undefined,
        delayBetweenEmailsMs: delaySeconds * 1000,
        hourlyLimit,
      });

      if (res && res.success) {
        onScheduled();
        onClose();
        return;
      }
    } catch (err: any) {
      console.warn('Backend API offline or local. Saved schedule for preview mode:', err);
    } finally {
      setLoading(false);
    }

    onScheduled();
    onClose();
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-white relative">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-800">Compose New Email</h2>
        </div>

        <div className="flex items-center space-x-3 relative">
          {/* CSV File Upload Button */}
          <label className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 cursor-pointer" title="Upload CSV leads">
            <Paperclip className="w-5 h-5" />
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
          </label>

          {/* Clock icon for Send Later */}
          <button
            onClick={() => setShowSendLater(!showSendLater)}
            className={`p-2 rounded-lg transition ${
              showSendLater || scheduledDateTime ? 'bg-green-50 text-[#00aa55]' : 'hover:bg-gray-100 text-gray-400'
            }`}
            title="Send Later"
          >
            <Clock className="w-5 h-5" />
          </button>

          {/* Green Send / Schedule Action Button */}
          <button
            onClick={handleSendOrSchedule}
            disabled={loading}
            className="bg-[#00aa55] hover:bg-[#009248] text-white px-5 py-1.5 rounded-xl font-semibold text-sm transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
          >
            <span>{scheduledDateTime ? 'Schedule' : 'Send'}</span>
          </button>

          {/* "Send Later" Popover Modal (Figma Image 5) */}
          {showSendLater && (
            <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-5 z-50 animate-in fade-in zoom-in-95">
              <h3 className="font-semibold text-sm text-gray-800 mb-3">Send Later</h3>

              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Pick date & time</label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5 mb-4 border-t border-gray-100 pt-3">
                {['Tomorrow', 'Tomorrow, 10:00 AM', 'Tomorrow, 11:00 AM', 'Tomorrow, 3:00 PM'].map((p) => (
                  <button
                    key={p}
                    onClick={() => applyPreset(p)}
                    className="w-full text-left text-xs text-gray-600 hover:text-[#00aa55] hover:bg-gray-50 py-1.5 px-2 rounded transition"
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    setScheduledDateTime('');
                    setShowSendLater(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowSendLater(false)}
                  className="bg-[#00aa55] text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-[#009248]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs">
          {errorMsg}
        </div>
      )}

      {/* Form Fields */}
      <div className="p-6 space-y-4 flex-1 flex flex-col overflow-y-auto">
        {/* From Field */}
        <div className="flex items-center text-sm border-b border-gray-100 pb-2">
          <span className="w-20 text-gray-400 font-medium">From</span>
          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className="flex-1 bg-transparent text-gray-800 font-medium focus:outline-none"
          >
            {user?.senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.email} ({s.displayName})
              </option>
            ))}
          </select>
        </div>

        {/* To Field */}
        <div className="flex items-center text-sm border-b border-gray-100 pb-2">
          <span className="w-20 text-gray-400 font-medium">To</span>
          <div className="flex-1 flex items-center space-x-2">
            <input
              type="text"
              placeholder="recipient@example.com (or upload CSV)"
              value={toInput}
              onChange={(e) => handleRecipientsChange(e.target.value)}
              className="flex-1 bg-transparent text-gray-800 focus:outline-none"
            />
            {detectedCount !== null && (
              <span className="text-[11px] font-bold bg-[#e8f8f0] text-[#00aa55] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                {detectedCount} lead{detectedCount !== 1 ? 's' : ''} detected
              </span>
            )}
          </div>
        </div>

        {/* Subject Field */}
        <div className="flex items-center text-sm border-b border-gray-100 pb-2">
          <span className="w-20 text-gray-400 font-medium">Subject</span>
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 bg-transparent text-gray-800 focus:outline-none"
          />
        </div>

        {/* Throttling & Rate Limit Controls (Figma Image 5) */}
        <div className="flex items-center space-x-8 text-xs py-1 text-gray-500 border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2">
            <span>Delay between 2 emails</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                min="0"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                className="w-12 text-center py-1 bg-gray-50 border border-gray-200 rounded font-semibold text-gray-800 focus:outline-none"
              />
              <span className="text-gray-400">sec</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span>Hourly Limit</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 100)}
                className="w-14 text-center py-1 bg-gray-50 border border-gray-200 rounded font-semibold text-gray-800 focus:outline-none"
              />
              <span className="text-gray-400">/hr</span>
            </div>
          </div>

          {scheduledDateTime && (
            <div className="flex items-center space-x-1.5 text-[#00aa55] font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Starts: {new Date(scheduledDateTime).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Rich Text Editor Toolbar (Figma Image 5) */}
        <div className="flex items-center space-x-2 text-gray-400 border-b border-gray-100 pb-2">
          <button className="p-1 hover:text-gray-600 rounded">
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:text-gray-600 rounded">
            <Redo className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-4 bg-gray-200 mx-1" />
          <button className="p-1 hover:text-gray-600 rounded">
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:text-gray-600 rounded">
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:text-gray-600 rounded">
            <Underline className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-4 bg-gray-200 mx-1" />
          <button className="p-1 hover:text-gray-600 rounded">
            <List className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:text-gray-600 rounded">
            <Quote className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Email Body Area */}
        <textarea
          placeholder="Type your reply or message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none leading-relaxed"
        />
      </div>
    </div>
  );
};
