import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// All dashboard routes require auth — UNLESS the request carries ?demo=true
const isProtectedRoute = createRouteMatcher([
  "/zoom-out(.*)",
  "/net-worth(.*)",
  "/cash-flow(.*)",
  "/transactions(.*)",
  "/budget(.*)",
  "/sinking-funds(.*)",
  "/forecast(.*)",
  "/connect(.*)",
  "/getting-started(.*)",
  "/about(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow demo mode through without requiring sign-in.
  // Check both the URL param (?demo=true) and the demo cookie set by the app.
  const url = new URL(req.url);
  const isDemoParam = url.searchParams.get("demo") === "true";
  const isDemoCookie = req.cookies.get("pacioli-demo-mode")?.value === "true";

  if (isDemoParam || isDemoCookie) {
    // If URL has ?demo=true, set the cookie for subsequent navigation
    if (isDemoParam && !isDemoCookie) {
      const res = NextResponse.next();
      res.cookies.set("pacioli-demo-mode", "true", { path: "/", sameSite: "lax" });
      return res;
    }
    return NextResponse.next();
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes
    "/__clerk/(.*)",
  ],
};
