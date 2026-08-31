import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'Due Passi · Команда ресторана',
  description: 'Меню, обучение и проверка знаний команды ресторана Due Passi',
  openGraph: {
    title: 'Due Passi · Команда ресторана',
    description: 'Меню · Обучение · Гостеприимство',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Due Passi · Команда ресторана' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Due Passi · Команда ресторана',
    description: 'Меню · Обучение · Гостеприимство',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><script src="https://telegram.org/js/telegram-web-app.js?63" /></head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
