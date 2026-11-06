import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, utilisateurDuJeton } from "@/lib/session";

/** Toute l'application est réservée aux utilisateurs connectés, sauf la page de connexion. */
export async function proxy(request: NextRequest) {
  const u = await utilisateurDuJeton(request.cookies.get(COOKIE)?.value);
  if (u) return NextResponse.next();
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Connexion requise", { status: 401 });
  }
  const url = new URL("/connexion", request.url);
  const suite = request.nextUrl.pathname + request.nextUrl.search;
  if (suite !== "/") url.searchParams.set("suite", suite);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!connexion|_next/static|_next/image|brand/|icon.png|apple-icon.png|favicon.ico).*)"],
};
