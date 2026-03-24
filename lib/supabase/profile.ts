import type { SupabaseClient, User } from "@supabase/supabase-js";

type SupabaseErrorLike = {
  message?: string;
  code?: string;
};

const EMAIL_COLUMN_MISSING = /column .*email.* does not exist/i;
const RELATION_MISSING = /relation .* does not exist/i;
const PERMISSION_DENIED = /permission denied/i;
const DUPLICATE_KEY = /duplicate key/i;

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
  const profileById = await findProfileIdById(supabase, user.id);
  if (profileById.error) {
    return profileById.error;
  }

  if (profileById.profileId) {
    return { profileId: profileById.profileId, error: null, status: 200 };
  }

  const profileByEmail = await findProfileIdByEmailWithStatus(supabase, user);
  if (profileByEmail.error) {
    return profileByEmail.error;
  }

  if (profileByEmail.profileId) {
    return { profileId: profileByEmail.profileId, error: null, status: 200 };
  }

  const createResult = await createProfileForUser(supabase, user);
  if (createResult.error) {
    return createResult.error;
  }

  return { profileId: createResult.profileId, error: null, status: 200 };
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

async function findProfileIdById(
  supabase: SupabaseClient,
  profileId: string
): Promise<
  | { profileId: string | null; error: null }
  | { profileId: null; error: ProfileLookupResult }
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    if (isMissingProfilesRelation(error) || isPermissionDenied(error)) {
      return {
        profileId: null,
        error: {
          profileId: null,
          error: "Unable to access profiles for this user.",
          status: 500,
        },
      };
    }

    return {
      profileId: null,
      error: {
        profileId: null,
        error: error.message ?? "Failed to resolve profile.",
        status: 500,
      },
    };
  }

  return { profileId: data?.id ?? null, error: null };
}

async function findProfileIdByEmailWithStatus(
  supabase: SupabaseClient,
  user: User
): Promise<
  | { profileId: string | null; error: null }
  | { profileId: null; error: ProfileLookupResult }
> {
  if (!user.email) {
    return { profileId: null, error: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  if (error) {
    if (isMissingEmailColumn(error)) {
      return { profileId: null, error: null };
    }

    if (isMissingProfilesRelation(error) || isPermissionDenied(error)) {
      return {
        profileId: null,
        error: {
          profileId: null,
          error: "Unable to access profiles for this user.",
          status: 500,
        },
      };
    }

    return {
      profileId: null,
      error: {
        profileId: null,
        error: error.message ?? "Failed to resolve profile.",
        status: 500,
      },
    };
  }

  return { profileId: data?.id ?? null, error: null };
}

async function createProfileForUser(
  supabase: SupabaseClient,
  user: User
): Promise<
  | { profileId: string; error: null }
  | { profileId: null; error: ProfileLookupResult }
> {
  const baseInsertPayload = { id: user.id };
  const insertPayload =
    user.email &&
    (await canWriteProfileEmail(supabase, user.id))
      ? { ...baseInsertPayload, email: user.email }
      : baseInsertPayload;

  const { error } = await supabase.from("profiles").insert(insertPayload);

  if (error) {
    if (isDuplicateKey(error)) {
      const existingProfile = await findProfileIdById(supabase, user.id);
      if (existingProfile.error) {
        return { profileId: null, error: existingProfile.error };
      }
      if (existingProfile.profileId) {
        return { profileId: existingProfile.profileId, error: null };
      }
    }

    if (isMissingProfilesRelation(error) || isPermissionDenied(error)) {
      return {
        profileId: null,
        error: {
          profileId: null,
          error: "Unable to create a profile for this user.",
          status: 500,
        },
      };
    }

    return {
      profileId: null,
      error: {
        profileId: null,
        error: error.message ?? "Failed to create profile.",
        status: 500,
      },
    };
  }

  return { profileId: user.id, error: null };
}

async function canWriteProfileEmail(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .select("id,email")
    .eq("id", userId)
    .maybeSingle();

  if (!error) {
    return true;
  }

  if (isMissingEmailColumn(error)) {
    return false;
  }

  if (isMissingProfilesRelation(error) || isPermissionDenied(error)) {
    return false;
  }

  return true;
}

function isDuplicateKey(error: SupabaseErrorLike): boolean {
  if (error.code === "23505") {
    return true;
  }
  return Boolean(error.message && DUPLICATE_KEY.test(error.message));
}
