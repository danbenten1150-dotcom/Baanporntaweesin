import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'ระบบผู้ดูแล / Admin', description: 'Admin dashboard', alternates: { canonical: '/admin/' }, robots: { index: false, follow: false } };

export default function Page() {
  return <View />;
}
