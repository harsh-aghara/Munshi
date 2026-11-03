import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Munshi (मुंशी) — Multilingual Writing Assistant',
  description:
    'Boliye, dikhaiye, likhiye. Speak it, show it, write it. Real writing assistant for official letters, emails, grievances, and creative writing.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-munshi-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
