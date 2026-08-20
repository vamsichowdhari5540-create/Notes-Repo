import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function loginWithError(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError) {
    return loginWithError(origin, providerError);
  }

  if (!code) {
    return loginWithError(origin, "Missing login code. Please try again.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginWithError(origin, error.message);
  }

  return NextResponse.redirect(`${origin}/browse`);
}
