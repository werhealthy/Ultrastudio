import { NextRequest, NextResponse } from "next/server";

const USERNAME = process.env.BASIC_AUTH_USER || "havas";
const PASSWORD = process.env.BASIC_AUTH_PASSWORD || "timhavas";

function isAuthorized(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;

  try {
    const encoded = authHeader.split(" ")[1];
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return username === USERNAME && password === PASSWORD;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="UltraStudio"',
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/figma|demo|icons|logo-ultrastudio.png).*)",
  ],
};
