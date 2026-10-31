import { db, ws, json, error, requireAuth } from '@appdeploy/sdk';

const SUBSCRIPTIONS_TABLE = 'entity_subscriptions';

export type SubscriptionRecord = {
  id: string;
  entity_type: string;
  entity_id: string;
  connection_id: string;
  user_id: string;
  created_at: number;
};

async function listSubscriptions(): Promise<SubscriptionRecord[]> {
  const { items } = await db.list(SUBSCRIPTIONS_TABLE, { limit: 1000 });
  return items as SubscriptionRecord[];
}

export async function removeSubscriptionsByConnection(connectionId: string) {
  const items = await listSubscriptions();
  const matchIds = items
    .filter(item => item.connection_id === connectionId)
    .map(item => item.id);
  if (matchIds.length > 0) {
    await db.delete(SUBSCRIPTIONS_TABLE, matchIds);
  }
}

export async function addSubscription(
  entityType: string,
  entityId: string,
  connectionId: string,
  userId: string
) {
  // Keep one subscription per user/connection/entity tuple.
  const items = await listSubscriptions();
  const existing = items.find(item =>
    item.entity_type === entityType &&
    item.entity_id === entityId &&
    item.connection_id === connectionId &&
    item.user_id === userId
  );
  if (existing) return;
  await db.add(SUBSCRIPTIONS_TABLE, [
    {
      entity_type: entityType,
      entity_id: entityId,
      connection_id: connectionId,
      user_id: userId,
      created_at: Date.now(),
    },
  ]);
}

export async function removeSubscriptions(
  entityType: string,
  entityId: string,
  connectionId: string,
  userId: string
) {
  const items = await listSubscriptions();
  const matchIds = items
    .filter(
      item =>
        item.entity_type === entityType &&
        item.entity_id === entityId &&
        item.connection_id === connectionId &&
        item.user_id === userId
    )
    .map(item => item.id);
  if (matchIds.length > 0) {
    await db.delete(SUBSCRIPTIONS_TABLE, matchIds);
  }
}

export async function notifySubscribers(
  entityType: string,
  entityId: string,
  payload: unknown,
  excludeConnectionId?: string
) {
  const items = await listSubscriptions();
  const targets = items
    .filter(
      item => item.entity_type === entityType && item.entity_id === entityId
    )
    .map(item => item.connection_id)
    .filter(id => id !== excludeConnectionId);
  const targetConnectionIds = Array.from(new Set(targets));

  if (targetConnectionIds.length === 0) {
    return;
  }

  await ws.send(targetConnectionIds, {
    v: 1,
    type: 'entity.update',
    payload: {
      entity_type: entityType,
      entity_id: entityId,
      data: payload,
    },
  });
}

async function canAccessJobChat(entityId: string, userId: string) {
  const [job] = await db.get<{
    customerId: string;
    workerId?: string | null;
    workerIds?: string[];
  }>('opportunities', [entityId]);
  if (!job) return false;
  return [job.customerId, job.workerId, ...(job.workerIds ?? [])]
    .filter(Boolean)
    .includes(userId);
}

export const realtimeSubscriptionRoutes = {
  'POST /api/subscriptions': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const { entity_type, entity_id, connection_id } = (body || {}) as Record<
        string,
        string
      >;
      if (!entity_type || !entity_id || !connection_id) {
        return error('entity_type, entity_id, connection_id are required', 400);
      }
      // This app currently uses realtime subscriptions only for job conversations.
      if (entity_type !== 'job-chat') {
        return error('Unsupported subscription type.', 400);
      }
      if (!(await canAccessJobChat(entity_id, currentUser.userId))) {
        return error('You do not have access to this conversation.', 403);
      }
      await addSubscription(entity_type, entity_id, connection_id, currentUser.userId);
      return json({ ok: true });
    },
  ],

  'POST /api/subscriptions/remove': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const { entity_type, entity_id, connection_id } = (body || {}) as Record<
        string,
        string
      >;
      if (!entity_type || !entity_id || !connection_id) {
        return error('entity_type, entity_id, connection_id are required', 400);
      }
      if (entity_type !== 'job-chat') {
        return error('Unsupported subscription type.', 400);
      }
      await removeSubscriptions(entity_type, entity_id, connection_id, currentUser.userId);
      return json({ ok: true });
    },
  ],
};
