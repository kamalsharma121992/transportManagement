import { redirect } from 'next/navigation';

export default function RoutesPage() {
  redirect('/trips?tab=routes');
}
