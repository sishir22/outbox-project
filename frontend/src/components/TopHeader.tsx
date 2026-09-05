'use client';

import React from 'react';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { User } from '../lib/api';

interface TopHeaderProps {
  user: User | null;
  onLogout?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ user, onLogout }) => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
    } catch {
      // Ignore if not signed in with firebase
    }
    localStorage.removeItem('reachinbox_user');
    if (onLogout) onLogout();
    router.push('/login');
  };

  return (
    <header className="h-14 border-b border-gray-100 bg-white px-6 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center space-x-2">
        <span className="text-xs font-semibold px-2.5 py-1 bg-green-50 text-[#00aa55] rounded-full border border-green-200">
          ● Scheduler Online
        </span>
      </div>

      {/* Top Header User Profile & Logout (Requirement: Show User Name, Email, Avatar, and simple Logout) */}
      <div className="flex items-center space-x-4">
        {user && (
          <div className="flex items-center space-x-3 bg-gray-50/80 border border-gray-100 px-3 py-1.5 rounded-full">
            <img
              src={
                user.avatarUrl ||
                'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&auto=format&fit=crop&q=80'
              }
              alt="Avatar"
              className="w-7 h-7 rounded-full object-cover border border-gray-200"
            />
            <div className="flex flex-col text-left pr-1">
              <span className="text-xs font-bold text-gray-800 leading-tight">{user.name}</span>
              <span className="text-[11px] text-gray-400 leading-tight">{user.email}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center space-x-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition font-medium"
          title="Logout"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
