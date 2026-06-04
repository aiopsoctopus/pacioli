"use client";
/**
 * UserStorageProvider
 *
 * Runs the one-time localStorage migration (un-prefixed → userId-prefixed keys)
 * as soon as we know the Clerk userId. Renders nothing visible.
 *
 * Place this inside ClerkProvider, inside the dashboard layout.
 */
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { migrateLocalStorageToUser } from "@/lib/storage";

export default function UserStorageProvider({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && userId) {
      migrateLocalStorageToUser(userId);
      // Default new users to light mode — don't inherit a stale dark preference
      if (!localStorage.getItem("hfos-theme")) {
        localStorage.setItem("hfos-theme", "light");
        document.documentElement.setAttribute("data-theme", "light");
      }
    }
  }, [isLoaded, userId]);

  return <>{children}</>;
}
