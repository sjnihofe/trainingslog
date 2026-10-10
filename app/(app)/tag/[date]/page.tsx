import { redirect } from 'next/navigation';
import DayView from '@/components/DayView';

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) redirect('/');
  return <DayView key={date} date={date} />;
}
