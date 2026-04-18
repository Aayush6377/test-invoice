// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "./lib/auth";
export default async function proxy(req: NextRequest) {
  const { nextUrl } = req;
  const isLoggedIn = !!(await getUser()).user;
  const isProtectedRoute = nextUrl.pathname.startsWith("/user");
  const isAuthRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register");

  if (!isLoggedIn && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/user", nextUrl));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/user/:path*", "/login", "/register"],
};