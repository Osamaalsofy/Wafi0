import type { Metadata } from 'next';
import './styles.css';
import '../features/public-site/public-site.css';
import '../features/public-site/homepage-reference.css';
import 'maplibre-gl/dist/maplibre-gl.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'WAFI | Transportation Operations, Connected', template: '%s | WAFI' },
  description: 'WAFI is a logistics and transportation operating system built for Saudi operations.',
  openGraph: {
    siteName: 'WAFI',
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'ar_SA',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
