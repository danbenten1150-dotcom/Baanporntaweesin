import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'ข้อกำหนดการใช้บริการ / Terms of Service', description: 'ข้อกำหนดและเงื่อนไขการใช้บริการ', alternates: { canonical: '/terms/' } };

export default function Page() {
  return <View />;
}
