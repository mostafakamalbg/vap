import { User } from './models.js';
import { createHierarchyScope } from '../shared/hierarchy.js';
import { HIERARCHY_ROLE_VALUES, isAdminRole } from '../shared/roles.js';

const ACTIVE_STATUSES = ['active', 'একটিভ', 'এডমিন', 'সুপার এডমিন'];

export async function resolveHierarchyScope(user) {
  if (!user) throw new Error('A signed-in user is required to resolve hierarchy access.');
  if (isAdminRole(user.role)) {
    return createHierarchyScope(user, []);
  }
  const users = await User.find({
    role: { $in: HIERARCHY_ROLE_VALUES },
    status: { $in: ACTIVE_STATUSES }
  }).select('_id role officerId officerCode name territory rsmId asmId').lean();
  return createHierarchyScope(user, users);
}
