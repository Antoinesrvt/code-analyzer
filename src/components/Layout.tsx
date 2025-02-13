import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <main>
        <Outlet />
      </main>
    </div>
  );
} 