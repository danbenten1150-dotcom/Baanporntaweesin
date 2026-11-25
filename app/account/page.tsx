import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'บัญชีของฉัน / My Account', description: 'บัญชีลูกค้า', alternates: { canonical: '/account/' }, robots: { index: false } };

export default function Page() {
  return <View />;
}
