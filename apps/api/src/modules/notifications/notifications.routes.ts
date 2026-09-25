import { FastifyInstance } from 'fastify';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from './notifications.service.js';

export default async function notificationRoutes(fastify: FastifyInstance) {
  const requireAuth = [fastify.authenticate];

  fastify.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const { unreadOnly } = (req.query as { unreadOnly?: string }) || {};
    const data = await getNotifications(req.user.sub, unreadOnly === 'true');
    return reply.code(200).send(data);
  });

  fastify.post('/read-all', { preHandler: requireAuth }, async (req, reply) => {
    const data = await markAllNotificationsRead(req.user.sub);
    return reply.code(200).send(data);
  });

  fastify.post('/:id/read', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const n = await markNotificationRead(req.user.sub, id);
    if (!n) return reply.code(404).send({ error: 'Notification not found' });
    return reply.code(200).send(n);
  });
}
