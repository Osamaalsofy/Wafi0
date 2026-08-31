import type { Metadata } from 'next';
import { HomePublicPage } from '../../features/public-site/public-pages';

export const metadata: Metadata = {
  title: 'Transportation Operations, Connected',
  description: 'Discover WAFI, the logistics and transportation operating system connecting missions, fleets, exceptions and performance in Saudi Arabia.',
  alternates: { canonical: '/' },
};
export default function HomePage() { return <HomePublicPage />; }
