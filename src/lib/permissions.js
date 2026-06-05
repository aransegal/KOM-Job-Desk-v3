/**
 * Centralized permission helpers for KOM Job Desk.
 *
 * Role model:
 *   admin       – full internal access
 *   dispatcher  – internal operations access
 *   vendor      – external vendor-company access
 *   worker      – future technician role (no pages yet)
 *   manager     – legacy; normalizes to dispatcher
 *   user        – legacy; normalizes to vendor
 *
 * IMPORTANT: unknown / empty roles do NOT default to any role.
 */

const ROLE_MAP = {
  manager: 'dispatcher',
  user: 'vendor',
};

/**
 * Normalizes legacy roles to their canonical equivalents.
 * Returns the role as-is if it is already canonical or unknown.
 */
export function normalizeRole(role) {
  if (!role) return null;
  return ROLE_MAP[role] ?? role;
}

function getRole(userOrRole) {
  if (!userOrRole) return null;
  const raw = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return normalizeRole(raw);
}

export function isAdmin(userOrRole) {
  return getRole(userOrRole) === 'admin';
}

export function isDispatcher(userOrRole) {
  return getRole(userOrRole) === 'dispatcher';
}

/** admin or dispatcher (internal staff) */
export function isInternal(userOrRole) {
  const r = getRole(userOrRole);
  return r === 'admin' || r === 'dispatcher';
}

export function isVendor(userOrRole) {
  return getRole(userOrRole) === 'vendor';
}

export function isWorker(userOrRole) {
  return getRole(userOrRole) === 'worker';
}

/** Can access admin/dispatcher operations (dashboard, schedule, customers, vendors) */
export function canAccessAdminOps(userOrRole) {
  return isInternal(userOrRole);
}

/** Can access the vendor portal and vendor-job pages */
export function canAccessVendorPortal(userOrRole) {
  return isVendor(userOrRole);
}

/** Only admins can invite users */
export function canAccessInviteUsers(userOrRole) {
  return isAdmin(userOrRole);
}

/** Jobs page: admin and dispatcher only (legacy manager normalizes to dispatcher) */
export function canAccessJobs(userOrRole) {
  return isInternal(userOrRole);
}