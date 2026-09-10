import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

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
      <head><Script src="/telegram-web-app.js" strategy="beforeInteractive" /></head>
      <body>{children}</body>
    </html>
  );
}
