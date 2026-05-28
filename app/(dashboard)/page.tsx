"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The root / now belongs to the marketing landing page (app/page.tsx).
// Anyone who lands on the dashboard group root gets bounced to /zoom-out.
export default function DashboardRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/zoom-out"); }, [router]);
  return null;
}
