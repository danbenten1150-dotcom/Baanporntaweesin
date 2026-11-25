import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ / Log in', description: 'เข้าสู่ระบบลูกค้า', alternates: { canonical: '/login/' }, robots: { index: false } };

export default function Page() {
  return <View />;
}
