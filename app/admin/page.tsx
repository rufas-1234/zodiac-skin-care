import { redirect } from 'next/navigation';

import { AdminDashboard } from '@/components/admin-dashboard';
import { getCurrentUser } from '@/lib/auth';

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    redirect('/admin/login');
  }

  return <AdminDashboard user={user} />;
}
