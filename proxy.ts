import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Route Guard for /dashboard and its subroutes
  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get("bizmate_token")?.value;

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Pass request and apply comprehensive HTTP security headers
  const response = NextResponse.next();

  // Prevent Clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME-sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Control referrer information sent in HTTP requests
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict browser features and hardware APIs
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );

  // Cross-Origin policies
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, icons)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
