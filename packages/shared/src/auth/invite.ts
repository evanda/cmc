// Invite-email context (issue #56). A Supabase invite is otherwise a bare
// "you've been invited" with no app/facility/inviter context. We attach this
// metadata to the invited user (raw_user_meta_data) so the branded invite
// template (supabase/templates/invite.html) can render *what* CMC is, *which*
// facility they're joining, *who* invited them, and *what* role they'll have.
//
// This module is the source of truth for that payload's shape and copy. The
// invite-user edge function (Deno) builds the same payload — keep them in sync.

import { roleLabel } from '../types/enums.js';

/** Product name shown in the invite (not church-specific; safe to hardcode). */
export const APP_NAME = 'CMC';
/** Full product name / tagline for the invite header and footer. */
export const APP_FULL_NAME = 'CMC — Church Maintenance Coordinator';

/** Metadata attached to an invited user, consumed by the invite email template. */
export interface InviteMetadata {
  /** Product name, e.g. "CMC". */
  app_name: string;
  /** Full product name / tagline. */
  app_full_name: string;
  /** Facility the invitee is joining (from org_settings.facility_name). */
  facility_name: string;
  /** Optional facility logo URL (from org_settings.logo_url). */
  logo_url?: string;
  /** Human-readable label for the invitee's role, e.g. "Technician". */
  role_label: string;
  /** Display name of the inviting admin (name, else email, else "An administrator"). */
  invited_by: string;
}

export interface BuildInviteMetadataInput {
  facilityName: string;
  role: string;
  /** Inviting admin's display name, if known. */
  inviterName?: string | null;
  /** Inviting admin's email, used as a fallback when no name is set. */
  inviterEmail?: string | null;
  /** Facility logo URL, if configured. */
  logoUrl?: string | null;
}

/** Friendly fallback when the inviter has no name or email on record. */
export const DEFAULT_INVITER = 'An administrator';

/**
 * Build the metadata payload for an invite email. Pure and church-agnostic:
 * every church-specific value (facility name, logo, inviter) is passed in;
 * nothing is hardcoded except the product name.
 */
export function buildInviteMetadata(input: BuildInviteMetadataInput): InviteMetadata {
  const invitedBy = input.inviterName?.trim() || input.inviterEmail?.trim() || DEFAULT_INVITER;
  const meta: InviteMetadata = {
    app_name: APP_NAME,
    app_full_name: APP_FULL_NAME,
    facility_name: input.facilityName.trim(),
    role_label: roleLabel(input.role),
    invited_by: invitedBy,
  };
  const logo = input.logoUrl?.trim();
  if (logo) meta.logo_url = logo;
  return meta;
}
