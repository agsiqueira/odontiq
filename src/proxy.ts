import { clerkMiddleware } from "@clerk/nextjs/server";

const publicRoutes = new Set([
  "/",
  "/api/health",
  "/api/readiness",
]);

function isPublicRoute(pathname: string) {
  return (
    publicRoutes.has(pathname) ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/__clerk" ||
    pathname.startsWith("/__clerk/")
  );
}

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request.nextUrl.pathname)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/login", request.url).toString(),
    });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
