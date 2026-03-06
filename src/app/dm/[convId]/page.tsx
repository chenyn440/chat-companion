import { Metadata } from 'next';
import DmPageClient from './DmPageClient';

export const metadata: Metadata = { title: '私信' };

export default async function DmPage({ params }: { params: Promise<{ convId: string }> }) {
  const { convId } = await params;
  return <DmPageClient convId={convId} />;
}
