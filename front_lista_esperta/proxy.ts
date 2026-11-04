import { NextResponse, type NextRequest } from "next/server";
import { serverApiUrl } from "@/lib/api/config";
import type { User } from "@/lib/api/types";

/**
 * Optimistic gate for signed-in areas. It asks the API who the cookie belongs
 * to (GET /auth/me); the API still enforces every rule on its own routes.
 *
 * The refresh cookie only travels to /api/v1/auth, so an expired access cookie
 * sends the person to /login?next=…, where the browser renews the session
 * silently and comes straight back.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const toLogin = (reason?: "unavailable") => {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    if (reason) url.searchParams.set("error", reason);
    return NextResponse.redirect(url);
  };

  if (!request.cookies.has("le_access")) return toLogin();

  let user: User | null;
  try {
    const response = await fetch(`${serverApiUrl()}/auth/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 401) return toLogin();
    if (!response.ok) return toLogin("unavailable");
    user = (await response.json()) as User;
  } catch {
    // Fail closed: without the API we cannot tell who is asking.
    return toLogin("unavailable");
  }

  if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/account?denied=admin", request.url));
  }
  if (pathname.startsWith("/merchant")) {
    if (user.role !== "MERCHANT" && user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/account?denied=merchant", request.url));
    }
    const onboarding = pathname.startsWith("/merchant/onboarding");
    if (user.role === "MERCHANT" && user.storeIds.length === 0 && !onboarding) {
      return NextResponse.redirect(new URL("/merchant/onboarding", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/merchant/:path*", "/admin/:path*", "/account/:path*"],
};
