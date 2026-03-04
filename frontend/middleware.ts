import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("aq_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/prediction/:path*",
    "/forecast/:path*",
    "/compare/:path*",
    "/analytics/:path*",
    "/watchlist/:path*",
    "/admin/:path*",
    "/settings/:path*",
  ],
};
