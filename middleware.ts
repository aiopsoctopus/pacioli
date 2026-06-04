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
  // Allow demo mode through without requiring sign-in
  const url = new URL(req.url);
  if (url.searchParams.get("demo") === "true") {
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
