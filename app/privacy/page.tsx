import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'นโยบายความเป็นส่วนตัว / Privacy Policy', description: 'นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)', alternates: { canonical: '/privacy/' } };

export default function Page() {
  return <View />;
}
