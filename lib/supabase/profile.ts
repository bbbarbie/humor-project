import type { SupabaseClient, User } from "@supabase/supabase-js";

type SupabaseErrorLike = {
  message?: string;
  code?: string;
};

const EMAIL_COLUMN_MISSING = /column .*email.* does not exist/i;
const RELATION_MISSING = /relation .* does not exist/i;
const PERMISSION_DENIED = /permission denied/i;

type ProfileLookupResult = {
  profileId: string | null;
  error: string | null;
  status: number;
};

export async function findProfileIdByEmail(
  supabase: SupabaseClient,
  user: User
): Promise<string | null> {
  if (!user.email) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  if (error) {
    if (
      isMissingEmailColumn(error) ||
      isMissingProfilesRelation(error) ||
      isPermissionDenied(error)
    ) {
      return null;
    }
    console.warn("findProfileIdByEmail failed", error);
    return null;
  }

  return data?.id ?? null;
}

export async function resolveProfileIdByUserEmail(
  supabase: SupabaseClient,
  user: User
): Promise<ProfileLookupResult> {
  if (!user.email) {
    return {
      profileId: null,
      error: "No email found for this user.",
      status: 400,
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  if (error) {
    if (
      isMissingEmailColumn(error) ||
      isMissingProfilesRelation(error) ||
      isPermissionDenied(error)
    ) {
      return {
        profileId: null,
        error: "Unable to access profiles for this user.",
        status: 500,
      };
    }

    return {
      profileId: null,
      error: error.message ?? "Failed to resolve profile.",
      status: 500,
    };
  }

  if (!data?.id) {
    return {
      profileId: null,
      error: "No profile found for this user.",
      status: 404,
    };
  }

  return { profileId: data.id, error: null, status: 200 };
}

export function isMissingProfileRow(error: unknown): boolean {
  const err = error as SupabaseErrorLike | null;
  if (!err) {
    return false;
  }
  if (err.code === "23503") {
    return true;
  }
  if (err.message && /foreign key|profile_id|profiles/i.test(err.message)) {
    return true;
  }
  return false;
}

function isMissingEmailColumn(error: SupabaseErrorLike): boolean {
  return Boolean(error.message && EMAIL_COLUMN_MISSING.test(error.message));
}

function isMissingProfilesRelation(error: SupabaseErrorLike): boolean {
  if (error.code === "42P01") {
    return true;
  }
  return Boolean(error.message && RELATION_MISSING.test(error.message));
}

function isPermissionDenied(error: SupabaseErrorLike): boolean {
  if (error.code === "42501") {
    return true;
  }
  return Boolean(error.message && PERMISSION_DENIED.test(error.message));
}
