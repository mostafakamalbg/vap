import { CHAIRMAN_ROLE, MD_ROLE, SUPER_ADMIN_ROLE } from './roles.js';

export function canEditStockInDirectly(user, hasSuperAdminAccess = false) {
  return Boolean(
    hasSuperAdminAccess
    || user?.isSuperAdmin
    || [SUPER_ADMIN_ROLE, MD_ROLE, CHAIRMAN_ROLE].includes(user?.role)
  );
}
