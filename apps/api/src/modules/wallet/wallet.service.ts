import { prisma } from '../../lib/prisma.js';

export class WalletError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export async function getWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teslaPayBalancePaisa: true },
  });
  if (!user) throw new WalletError(404, 'User not found');

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return { teslaPayBalancePaisa: user.teslaPayBalancePaisa, transactions };
}

export async function topUpWallet(userId: string, amountPaisa: number) {
  if (amountPaisa <= 0) throw new WalletError(400, 'Amount must be positive');
  if (amountPaisa > 5_000_000) throw new WalletError(400, 'Top-up capped at ৳50,000');

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { teslaPayBalancePaisa: { increment: amountPaisa } },
      select: { teslaPayBalancePaisa: true },
    });
    const txn = await tx.walletTransaction.create({
      data: { userId, amountPaisa, type: 'TOPUP' },
    });
    return { teslaPayBalancePaisa: user.teslaPayBalancePaisa, transaction: txn };
  });
}
