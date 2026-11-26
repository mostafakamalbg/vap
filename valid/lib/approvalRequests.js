import { randomUUID } from 'node:crypto';
import { BusinessRecord } from './models.js';

export async function createApprovalRequest({
  requestType,
  targetId,
  original,
  originalUpdatedAt = null,
  proposed,
  user
}) {
  const conflictingTypes = ['stock_in_update', 'stock_in_delete'].includes(requestType)
    ? ['stock_in_update', 'stock_in_delete']
    : [requestType];
  const pendingRequest = await BusinessRecord.findOne({
    type: 'approvalRequests',
    'data.requestType': { $in: conflictingTypes },
    'data.targetId': targetId,
    'data.status': 'pending_super_admin_approval'
  }).select('recordId').lean();
  if (pendingRequest) {
    const error = new Error('এই রেকর্ডের একটি পরিবর্তন ইতোমধ্যে অনুমোদনের অপেক্ষায় আছে।');
    error.statusCode = 409;
    throw error;
  }

  const id = `APR-${randomUUID()}`;
  const data = {
    id,
    requestType,
    targetId,
    status: 'pending_super_admin_approval',
    original,
    originalUpdatedAt,
    proposed,
    submittedBy: String(user.name || ''),
    submittedByRole: String(user.role || ''),
    submittedAt: new Date()
  };
  await BusinessRecord.create({ type: 'approvalRequests', recordId: id, data });
  return data;
}
