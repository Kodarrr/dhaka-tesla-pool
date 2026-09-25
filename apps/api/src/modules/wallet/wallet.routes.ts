import { FastifyInstance } from 'fastify';
import { getWallet, topUpWallet, WalletError } from './wallet.service.js';

export default async function walletRoutes(fastify: FastifyInstance) {
  const requireAuth = [fastify.authenticate];

  fastify.get('/', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const data = await getWallet(req.user.sub);
      return reply.code(200).send(data);
    } catch (err) {
      if (err instanceof WalletError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  fastify.post('/topup', { preHandler: requireAuth }, async (req, reply) => {
    const { amountPaisa } = (req.body as any) || {};
    if (typeof amountPaisa !== 'number') {
      return reply.code(400).send({ error: 'amountPaisa must be a number' });
    }
    try {
      const data = await topUpWallet(req.user.sub, amountPaisa);
      return reply.code(200).send(data);
    } catch (err) {
      if (err instanceof WalletError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
