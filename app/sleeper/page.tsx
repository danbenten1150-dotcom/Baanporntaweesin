import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = {
  title: 'จองตั๋วเรือนอน ชุมพร ⇄ เกาะเต่า / Sleeper Boat Tickets',
  description: 'จองตั๋วเรือนอน ชุมพร → เกาะเต่า ทุกวันอังคาร พฤหัสบดี เสาร์ และ เกาะเต่า → ชุมพร ทุกวันจันทร์ พุธ ศุกร์',
  alternates: { canonical: '/sleeper/' },
};

export default function Page() {
  return <View />;
}
