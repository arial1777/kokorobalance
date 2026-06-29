import { AppNav } from '@/components/layout/app-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto pb-20">
      <main className="min-h-screen">{children}</main>
      <AppNav />
    </div>
  );
}
