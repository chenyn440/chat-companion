import { Metadata } from 'next';
import SharePageClient from './SharePageClient';

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
};

export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  return <SharePageClient shareId={shareId} />;
}
