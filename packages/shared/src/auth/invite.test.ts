import { describe, expect, it } from 'vitest';
import {
  APP_FULL_NAME,
  APP_NAME,
  DEFAULT_INVITER,
  buildInviteMetadata,
} from './invite.js';
import { roleLabel } from '../types/enums.js';

describe('roleLabel', () => {
  it('maps known roles to human-readable labels', () => {
    expect(roleLabel('admin')).toBe('Administrator');
    expect(roleLabel('technician')).toBe('Technician');
    expect(roleLabel('requester')).toBe('Requester');
    expect(roleLabel('trustee')).toBe('Trustee');
    expect(roleLabel('vendor')).toBe('Vendor');
  });

  it('falls back to the raw value for unknown roles', () => {
    expect(roleLabel('superuser')).toBe('superuser');
  });
});

describe('buildInviteMetadata', () => {
  it('includes app name, facility, role label, and inviter', () => {
    const meta = buildInviteMetadata({
      facilityName: 'Midway PCA',
      role: 'technician',
      inviterName: 'Pat Trustee',
      inviterEmail: 'pat@midwaypca.org',
    });
    expect(meta.app_name).toBe(APP_NAME);
    expect(meta.app_full_name).toBe(APP_FULL_NAME);
    expect(meta.facility_name).toBe('Midway PCA');
    expect(meta.role_label).toBe('Technician');
    expect(meta.invited_by).toBe('Pat Trustee');
  });

  it('falls back to inviter email when no name is set', () => {
    const meta = buildInviteMetadata({
      facilityName: 'Oak Ridge Chapel',
      role: 'requester',
      inviterName: null,
      inviterEmail: 'admin@oakridge.org',
    });
    expect(meta.invited_by).toBe('admin@oakridge.org');
  });

  it('falls back to a generic inviter when neither name nor email is known', () => {
    const meta = buildInviteMetadata({ facilityName: 'Midway PCA', role: 'admin' });
    expect(meta.invited_by).toBe(DEFAULT_INVITER);
  });

  it('treats a blank/whitespace name as missing', () => {
    const meta = buildInviteMetadata({
      facilityName: 'Midway PCA',
      role: 'admin',
      inviterName: '   ',
      inviterEmail: 'a@b.org',
    });
    expect(meta.invited_by).toBe('a@b.org');
  });

  it('omits logo_url when not provided, includes it when present', () => {
    expect(buildInviteMetadata({ facilityName: 'F', role: 'admin' }).logo_url).toBeUndefined();
    expect(
      buildInviteMetadata({ facilityName: 'F', role: 'admin', logoUrl: 'https://x/l.png' })
        .logo_url,
    ).toBe('https://x/l.png');
  });

  it('does not hardcode any church-specific value (facility is passed through)', () => {
    const meta = buildInviteMetadata({ facilityName: 'Some Other Church', role: 'trustee' });
    expect(meta.facility_name).toBe('Some Other Church');
    // The only hardcoded identity is the product name, not the church.
    expect(meta.app_name).toBe('CMC');
  });
});
