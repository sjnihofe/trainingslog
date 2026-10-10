import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Home() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  redirect(`/tag/${today}`);
}
