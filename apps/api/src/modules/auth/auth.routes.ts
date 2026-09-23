import { FastifyInstance } from 'fastify';
import { signupSchema, loginSchema } from './auth.schema';
import { signup, login, AuthError } from './auth.service';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/auth/signup', async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    try {
      const user = await signup(parsed.data);
      return reply.code(201).send(user);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({ error: 'auth_error', message: err.message });
      }
      throw err;
    }
  });

  fastify.post('/api/v1/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    try {
      const user = await login(parsed.data);
      const token = fastify.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: '12h' });
      return reply.send({ access_token: token, token_type: 'bearer', user });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({ error: 'auth_error', message: err.message });
      }
      throw err;
    }
  });
}
