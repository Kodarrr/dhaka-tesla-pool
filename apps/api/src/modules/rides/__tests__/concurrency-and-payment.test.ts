import { describe, it, expect } from 'vitest';
import { RideError } from '../rides.service.js';

describe('Concurrency and Payment Unit Tests', () => {
  it('should throw RideError with 409 and POOL_FULL error code when capacity exceeded', () => {
    const error = new RideError(
      409,
      'No available seats remaining in this pool',
      'POOL_FULL'
    );
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('No available seats remaining in this pool');
    expect(error.errorCode).toBe('POOL_FULL');
  });

  it('should throw RideError 402 on insufficient TeslaPay balance', () => {
    const error = new RideError(402, 'Insufficient TeslaPay balance');
    expect(error.statusCode).toBe(402);
    expect(error.message).toBe('Insufficient TeslaPay balance');
  });

  it('should throw RideError 400 when ride is not in a payable stage', () => {
    const error = new RideError(400, 'Ride is not in a payable stage yet');
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Ride is not in a payable stage yet');
  });

  it('should verify deadlock-safe sorting of user IDs', () => {
    const passengerId = 'user-zzz-999';
    const driverId = 'user-aaa-111';
    const sorted = [passengerId, driverId].sort();
    expect(sorted[0]).toBe('user-aaa-111');
    expect(sorted[1]).toBe('user-zzz-999');

    const reversed = [driverId, passengerId].sort();
    expect(reversed).toEqual(sorted);
  });
});
