import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role =
    profile?.role === "admin" ? "admin" : profile?.role === "faculty" ? "faculty" : "student";

  if (pathname.startsWith("/admin") && role !== "admin") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = role === "faculty" ? "/dashboard" : "/student/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  // Admins may legitimately browse /dashboard or /student while in View As
  // mode. Authorization for admin-only actions is still based on this real
  // role, never on the view-as cookie.
  if (role === "admin") {
    return response;
  }

  if (pathname.startsWith("/dashboard") && role !== "faculty") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/student/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith("/student") && role === "faculty") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/student/:path*", "/admin/:path*"],
};
