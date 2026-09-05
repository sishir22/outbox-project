'use client';

import React, { useState } from 'react';
import { Slack, X, CheckCircle2, AlertTriangle, Send, Link2, Trash2 } from 'lucide-react';
import { getSlackAuthUrl, testSlackNotification } from '../lib/api';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  connected: boolean;
  onConnectionChange: (connected: boolean) => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  connected,
  onConnectionChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Real OAuth redirect flow
  const handleOAuthConnect = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getSlackAuthUrl();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setErrorMsg(
        data?.message ||
          'SLACK_CLIENT_ID is not configured in backend/.env. Use Instant Demo Connect below to simulate Slack integration.'
      );
    } catch {
      setErrorMsg(
        'Backend server is not reachable on this hosted URL (Mixed Content). Use Instant Demo Connect below to enable Slack alerts for this session.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Instant Demo Connect (ideal for Vercel preview & Loom demo)
  const handleInstantConnect = () => {
    localStorage.setItem('reachinbox_slack_connected', 'true');
    onConnectionChange(true);
    setErrorMsg('');
  };

  // Disconnect
  const handleDisconnect = () => {
    localStorage.removeItem('reachinbox_slack_connected');
    onConnectionChange(false);
    setTestSent(false);
  };

  // Test Alert
  const handleTestAlert = async () => {
    setLoading(true);
    setTestSent(false);
    try {
      await testSlackNotification();
    } catch {
      // If backend is offline, simulate client-side delivery
    }
    setTestSent(true);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#4A154B] flex items-center justify-center text-white shadow-sm">
              <Slack className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Slack Integration</h2>
              <p className="text-xs text-gray-400">Automated Rate-Limit Quota Alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-xl transition text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              connected
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              {connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold">
                  {connected ? 'Slack Workspace Connected' : 'Slack Not Connected'}
                </p>
                <p className="text-[11px] text-gray-500">
                  {connected
                    ? 'Alerts will be sent when senders reach hourly email limits.'
                    : 'Connect Slack to receive real-time notifications when rate limits are reached.'}
                </p>
              </div>
            </div>

            {connected && (
              <button
                onClick={handleDisconnect}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-xl transition flex items-center space-x-1 font-medium"
                title="Disconnect"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Explanation Box */}
          <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
            <h4 className="text-xs font-bold text-gray-700 mb-1">How Rate-Limit Alerts Work:</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              When a sender exceeds their hourly sending limit (e.g. 100 emails/hr), the BullMQ worker automatically reschedules remaining emails to the top of the next hour and posts a formatted alert block to your Slack channel.
            </p>
          </div>

          {/* Simulated Slack Message Preview */}
          {testSent && (
            <div className="bg-[#1a1d21] text-white p-4 rounded-2xl border border-gray-800 space-y-2 text-xs animate-in fade-in duration-200">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulated Slack Block Dispatched</span>
              </div>
              <div className="bg-[#222529] p-3 rounded-xl border border-gray-700 space-y-1 text-[11px]">
                <p className="text-amber-400 font-bold">⚠️ Outreach Rate Limit Alert</p>
                <p className="text-gray-300">
                  <span className="text-gray-400">Sender:</span> Sishir Molleti &lt;sishir.molleti02@gmail.com&gt;
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-400">Hourly Quota:</span> 100 emails / hour
                </p>
                <p className="text-gray-400 mt-1">
                  <span className="text-white">Status:</span> Quota reached. Remaining emails have been automatically delayed and rescheduled to the next hour. No emails were dropped.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {!connected ? (
              <div className="space-y-2">
                <button
                  onClick={handleOAuthConnect}
                  disabled={loading}
                  className="w-full bg-[#4A154B] hover:bg-[#3d113e] text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition flex items-center justify-center space-x-2 disabled:opacity-50 shadow-xs"
                >
                  <Slack className="w-4 h-4" />
                  <span>Connect with Slack OAuth</span>
                </button>

                <button
                  onClick={handleInstantConnect}
                  className="w-full bg-[#e8f8f0] hover:bg-[#d5f5e4] text-[#008844] py-2.5 px-4 rounded-xl text-sm font-semibold transition flex items-center justify-center space-x-2"
                >
                  <Link2 className="w-4 h-4" />
                  <span>Instant Demo Connect (Preview Mode)</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleTestAlert}
                disabled={loading}
                className="w-full bg-[#00aa55] hover:bg-[#009248] text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition flex items-center justify-center space-x-2 disabled:opacity-50 shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Sending...' : 'Send Test Rate Limit Alert'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
