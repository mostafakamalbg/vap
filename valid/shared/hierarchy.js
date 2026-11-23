import { getOfficerCodeAliases, normalizeOfficerCode } from './codes.js';
import {
  ASM_ROLE,
  RSM_ROLE,
  isAdminRole,
  isSalesOfficerRole,
  SO_ROLE
} from './roles.js';

const userId = (user) => String(user?._id || user?.id || '');

export function getHierarchyUsers(user, users) {
  if (isAdminRole(user?.role)) return users;
  const byId = new Map(users.map((entry) => [userId(entry), entry]));
  const visible = new Map();
  const add = (entry) => {
    const id = userId(entry);
    if (id) visible.set(id, entry);
  };
  add(byId.get(userId(user)) || user);

  if (user?.role === RSM_ROLE) {
    const asmIds = new Set(users
      .filter((entry) => entry.role === ASM_ROLE && String(entry.rsmId || '') === userId(user))
      .map(userId));
    users.forEach((entry) => {
      if (asmIds.has(userId(entry))
        || ((isSalesOfficerRole(entry.role) || entry.role === SO_ROLE)
          && asmIds.has(String(entry.asmId || '')))) {
        add(entry);
      }
    });
  } else if (user?.role === ASM_ROLE) {
    users.forEach((entry) => {
      if (isSalesOfficerRole(entry.role) && String(entry.asmId || '') === userId(user)) add(entry);
    });
  }
  return [...visible.values()];
}

export function createHierarchyScope(user, users) {
  const global = isAdminRole(user?.role);
  const visibleUsers = global ? [] : getHierarchyUsers(user, users);
  const officerIds = new Set();
  const officerCodes = new Set();
  const officerNames = new Set();
  const territories = new Set();
  visibleUsers.forEach((entry) => {
    if (entry.officerId) officerIds.add(String(entry.officerId));
    getOfficerCodeAliases(entry.officerCode).forEach((alias) => officerCodes.add(alias));
    const normalizedCode = normalizeOfficerCode(entry.officerCode);
    const codeDigits = normalizedCode.match(/\d+$/)?.[0];
    if (codeDigits && normalizedCode.startsWith('SO-')) {
      officerCodes.add(codeDigits);
      officerCodes.add(`FSO-${codeDigits}`);
      officerIds.add(`OFF-${codeDigits}`);
      officerIds.add(`OFF-${codeDigits.padStart(2, '0')}`);
    }
    if (entry.name) officerNames.add(String(entry.name));
    if (entry.territory) territories.add(String(entry.territory));
  });
  return {
    global,
    users: visibleUsers,
    userIds: new Set(visibleUsers.map(userId).filter(Boolean)),
    officerIds,
    officerCodes,
    officerNames,
    territories
  };
}

export function buildOfficerOwnerFilter(scope, {
  idField = 'officerId',
  codeField = 'officerCode',
  nameField = 'officerName'
} = {}) {
  if (scope.global) return {};
  const conditions = [];
  if (scope.officerIds.size) conditions.push({ [idField]: { $in: [...scope.officerIds] } });
  [...scope.officerCodes].forEach((code) => {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({ [codeField]: { $regex: `^${escaped}$`, $options: 'i' } });
  });
  if (scope.officerNames.size) {
    conditions.push({
      [idField]: { $in: ['', null] },
      [codeField]: { $in: ['', null] },
      [nameField]: { $in: [...scope.officerNames] }
    });
  }
  return conditions.length ? { $or: conditions } : { _id: null };
}

export function matchesOfficerScope(record, scope) {
  if (scope.global) return true;
  const id = String(record?.officerId || '');
  const code = String(record?.officerCode || '').trim().toUpperCase();
  const name = String(record?.officerName || '').trim();
  return (id && scope.officerIds.has(id))
    || (code && scope.officerCodes.has(code))
    || (!id && !code && name && scope.officerNames.has(name));
}
