import { redirect } from 'next/navigation';

export default function RoutesPage() {
  redirect('/admin?tab=routes');
}
