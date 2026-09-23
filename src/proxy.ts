import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Proxy is this Next version's renamed middleware. It runs on the Node.js
// runtime (the `runtime` segment config is unavailable here and throws), but
// cookies are still read from and written to the request/response directly so
// the refreshed session propagates to the response.
//
// This is an optimistic auth check only. Entitlement is NOT checked here:
// proxy runs on every matched request including prefetches, and Next's auth
// guide is explicit that database reads belong in the page, not the proxy.
// The paywall lives in src/app/(app)/(paid)/layout.tsx.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/properties/:path*",
    "/settings/:path*",
    "/actions/:path*",
    // Previously missing: these four pages were never guarded here and relied
    // on each page returning null for a signed-out user, which renders a blank
    // page instead of redirecting to /signin.
    "/market/:path*",
    "/risk/:path*",
    "/plan/:path*",
    "/growth/:path*",
  ],
  // Note: "/actions/:path*" does not protect Server Actions. Actions POST to
  // the route they are invoked from, so they are covered by that route's
  // matcher entry, not this one.
};
