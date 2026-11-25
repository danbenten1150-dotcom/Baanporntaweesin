import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'เช่าเครื่องจักร / Machinery Rental', description: 'เช่ารถดัมพ์ รถเครน รถแบคโฮ และเครื่องจักรหนัก', alternates: { canonical: '/machinery/' } };

export default function Page() {
  return <View />;
}
