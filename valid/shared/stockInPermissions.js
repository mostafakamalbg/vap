import { CHAIRMAN_ROLE, MD_ROLE, isSuperAdminRole } from './roles.js';

export function canEditStockInDirectly(user, hasSuperAdminAccess = false) {
  return Boolean(
    hasSuperAdminAccess
    || user?.isSuperAdmin
    || isSuperAdminRole(user?.role)
    || [MD_ROLE, CHAIRMAN_ROLE].includes(user?.role)
  );
}
