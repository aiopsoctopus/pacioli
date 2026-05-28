import Nav from "@/components/nav";
import DemoBanner from "@/components/demo-banner";
import SetupGuard from "@/components/setup-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pacioli-bg-base pacioli-text-primary">
      <DemoBanner />
      <SetupGuard />
      <div className="flex flex-1 min-h-0">
        <div className="sticky top-0 h-screen overflow-y-auto shrink-0">
          <Nav />
        </div>
        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 p-8">
            {children}
          </div>
          {/* Signature footer */}
          <footer className="px-8 py-5 border-t pacioli-border-subtle">
            <p className="text-xs pacioli-text-faint">
              Built by{" "}
              <a
                href="https://aiopsoctopus.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:pacioli-text-muted transition-colors"
              >
                Christina Moore
              </a>
              {" "}·{" "}
              <a
                href="https://aiopsoctopus.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:pacioli-text-muted transition-colors"
              >
                The AI Ops Octopus
              </a>
              {" "}·{" "}
              <a
                href="https://aiopsoctopus.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:pacioli-text-muted transition-colors"
              >
                aiopsoctopus.substack.com
              </a>
              {" "}🐙
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
