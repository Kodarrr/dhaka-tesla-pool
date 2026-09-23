import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma';
import { SignupInput, LoginInput } from './auth.schema';

const SALT_ROUNDS = 12;

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AuthError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: input.role },
  });

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AuthError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError(401, 'Invalid email or password');
  }

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
