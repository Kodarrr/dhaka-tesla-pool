import { FastifyInstance } from 'fastify';
import { getSystemConditions, updateSystemConditions } from './system.service.js';
import { updateConditionsSchema } from './system.schema.js';

export default async function systemRoutes(fastify: FastifyInstance) {
  // Public/all users can view current conditions and rates
  fastify.get('/conditions', async (_req, reply) => {
    const conditions = await getSystemConditions();
    return reply.code(200).send(conditions);
  });

  // Admin route to view conditions
  fastify.get(
    '/admin/conditions',
    { preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')] },
    async (_req, reply) => {
      const conditions = await getSystemConditions();
      return reply.code(200).send(conditions);
    }
  );

  // Admin route to toggle traffic jam and rain
  fastify.patch(
    '/admin/conditions',
    { preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')] },
    async (req, reply) => {
      const parsed = updateConditionsSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Invalid request body',
          details: parsed.error.issues,
        });
      }

      const updated = await updateSystemConditions(parsed.data);
      return reply.code(200).send(updated);
    }
  );

  // POST alias for convenience
  fastify.post(
    '/admin/conditions',
    { preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')] },
    async (req, reply) => {
      const parsed = updateConditionsSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Invalid request body',
          details: parsed.error.issues,
        });
      }

      const updated = await updateSystemConditions(parsed.data);
      return reply.code(200).send(updated);
    }
  );
}

