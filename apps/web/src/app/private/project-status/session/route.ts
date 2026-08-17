import { NextResponse } from "next/server";
import {
  createProjectStatusSessionToken,
  PROJECT_STATUS_COOKIE,
  PROJECT_STATUS_SESSION_MAX_AGE,
  verifyProjectStatusPassword
} from "@/lib/project-status-auth";

export const runtime = "nodejs";

function privateStatusUrl(request: Request, error?: string): URL {
  const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const url = new URL("/private/project-status", publicOrigin);
  if (error) url.searchParams.set("error", error);
  return url;
}

function expireSession(response: NextResponse): void {
  response.cookies.set(PROJECT_STATUS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/private/project-status",
    maxAge: 0
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  if (formData.get("intent") === "logout") {
    const response = NextResponse.redirect(privateStatusUrl(request), 303);
    expireSession(response);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const candidate = formData.get("password");
  if (typeof candidate !== "string" || !verifyProjectStatusPassword(candidate)) {
    const response = NextResponse.redirect(privateStatusUrl(request, "invalid"), 303);
    expireSession(response);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const token = createProjectStatusSessionToken();
  if (!token) {
    return new NextResponse("Private status access is not configured.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  const response = NextResponse.redirect(privateStatusUrl(request), 303);
  response.cookies.set(PROJECT_STATUS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/private/project-status",
    maxAge: PROJECT_STATUS_SESSION_MAX_AGE,
    priority: "high"
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
