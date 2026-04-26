import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "./lib/supabase/server-client";

/**
 * Next.js 16 proxy entry point responsible for auth gating.
 *
 * Runtime: Node.js (not Edge), so the shared cookie store used by Supabase is
 * accessible via next/headers. Token refresh happens in Server Actions and
 * Route Handlers — the proxy only performs an optimistic auth check.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
