"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authenticate, endSession } from "@/lib/auth/operations";
import type { AuthState } from "@/lib/auth/forms";

export async function login(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const result = await authenticate("login", form, createClient);
  if (result.status === "success") revalidatePath("/", "layout");
  return result;
}

export async function signup(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const result = await authenticate("signup", form, createClient);
  if (result.status === "success") revalidatePath("/", "layout");
  return result;
}

export async function logout(): Promise<AuthState> {
  const result = await endSession(createClient);
  if (result.status === "success") revalidatePath("/", "layout");
  return result;
}
