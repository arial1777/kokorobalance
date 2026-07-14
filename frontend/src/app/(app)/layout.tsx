import { AppNav } from '@/components/layout/app-nav';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { OnboardingGuard } from '@/components/layout/onboarding-guard';
import { PwaSetup } from '@/components/pwa-setup';
import { Toaster } from '@/components/ui/toaster';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background md:flex md:h-screen md:overflow-hidden">
      <OnboardingGuard />
      <AppSidebar />
      <div className="flex-1 min-w-0 md:overflow-y-auto">
        <div className="max-w-2xl mx-auto pb-24 md:pb-8">
          <main>{children}</main>
        </div>
      </div>
      <AppNav />
      <PwaSetup />
      <Toaster />
    </div>
  );
}
