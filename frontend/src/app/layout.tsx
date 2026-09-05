import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReachInbox Email Scheduler',
  description: 'Production-grade full-stack email scheduler dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  );
}
