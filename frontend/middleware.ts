import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login";
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/players") || pathname.startsWith("/injuries") || pathname.startsWith("/matches") || pathname.startsWith("/training") || pathname.startsWith("/tactical") || pathname.startsWith("/calendar") || pathname.startsWith("/wellness") || pathname.startsWith("/analytics") || pathname.startsWith("/predictions") || pathname.startsWith("/settings");

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
