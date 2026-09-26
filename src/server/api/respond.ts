import { NextResponse } from "next/server";
import type { z } from "zod";

// Every API route returns { data, error, meta } per docs/02 section 5.

export type ApiError = { code: string; message: string; fields?: Record<string, string[]> };

export function ok<T>(data: T, meta: Record<string, unknown> = {}, init?: ResponseInit) {
  return NextResponse.json({ data, error: null, meta }, init);
}

export function fail(status: number, error: ApiError) {
  return NextResponse.json({ data: null, error, meta: {} }, { status });
}

export function invalid(err: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (fields[key] ??= []).push(issue.message);
  }
  return fail(400, { code: "invalid_input", message: "Some fields need attention.", fields });
}

export const unauthorized = () => fail(401, { code: "unauthorized", message: "Sign in to continue." });
export const forbidden = () => fail(403, { code: "forbidden", message: "You do not have access to this." });
