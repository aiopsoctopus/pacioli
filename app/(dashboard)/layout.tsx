import Nav from "@/components/nav";
import DemoBanner from "@/components/demo-banner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pacioli-bg-base pacioli-text-primary">
      <DemoBanner />
      <div className="flex flex-1 min-h-0">
        <Nav />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
