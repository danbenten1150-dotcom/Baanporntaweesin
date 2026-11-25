import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'ติดตามสถานะ / Track Order', description: 'ติดตามสถานะการขนส่งและคำขอบริการ', alternates: { canonical: '/track/' } };

export default function Page() {
  return <View />;
}
