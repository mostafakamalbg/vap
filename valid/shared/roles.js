export const SUPER_ADMIN_ROLE = 'SuperAdmin';
export const ADMIN_ROLE = 'Admin';
export const OFFICER_ROLE = 'officer';
export const LEGACY_ADMIN_ROLE = 'admin';

export const ADMIN_ROLES = Object.freeze([SUPER_ADMIN_ROLE, ADMIN_ROLE]);
export const ADMIN_ROLE_VALUES = Object.freeze([
  ...ADMIN_ROLES,
  LEGACY_ADMIN_ROLE
]);
export const USER_ROLE_VALUES = Object.freeze([
  ...ADMIN_ROLE_VALUES,
  OFFICER_ROLE
]);
export const LEGACY_ACTIVE_STATUSES = Object.freeze([
  'একটিভ',
  'এডমিন',
  'সুপার এডমিন'
]);
export const USER_STATUS_VALUES = Object.freeze([
  'pending',
  'active',
  'rejected',
  ...LEGACY_ACTIVE_STATUSES
]);

export function isAdminRole(role) {
  return ADMIN_ROLE_VALUES.includes(role);
}

export function isSuperAdminRole(role) {
  return role === SUPER_ADMIN_ROLE;
}

export function normalizeAdminRole(role, isSuperAdmin = false) {
  if (!isAdminRole(role)) return role;
  return isSuperAdmin ? SUPER_ADMIN_ROLE : ADMIN_ROLE;
}

export function isActiveUserStatus(status) {
  return status === 'active' || LEGACY_ACTIVE_STATUSES.includes(status);
}

export function normalizeUserStatus(status) {
  return LEGACY_ACTIVE_STATUSES.includes(status) ? 'active' : status;
}

export function matchesExpectedRole(expectedRole, actualRole) {
  if (!expectedRole) return true;
  if (expectedRole === ADMIN_ROLE || expectedRole === LEGACY_ADMIN_ROLE) {
    return isAdminRole(actualRole);
  }
  return expectedRole === actualRole;
}
