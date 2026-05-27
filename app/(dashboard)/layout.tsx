import Nav from "@/components/nav";
import DemoBanner from "@/components/demo-banner";
import OnboardingBanner from "@/components/onboarding-banner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pacioli-bg-base pacioli-text-primary">
      <DemoBanner />
      <div className="flex flex-1 min-h-0">
        <Nav />
        <main className="flex-1 overflow-y-auto">
          <OnboardingBanner />
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
