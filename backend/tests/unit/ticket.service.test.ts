import { openDatabase } from '../../src/db/connection';
import { createTicketRepository } from '../../src/repositories/ticket.repository';
import { createClassifierError, type TicketClassifier } from '../../src/services/ai/types';
import { createUnavailableClassifier } from '../../src/services/ai/unavailable.classifier';
import { createTicketService } from '../../src/services/ticket.service';
import { isTimeoutError, withTimeout } from '../../src/utils/with-timeout';
import { createFakeClassifier, fakeFailing, fakeReturning } from '../helpers/fake-classifier';

const input = { title: 'T', description: 'D', customerEmail: 'a@b.com' };

const make = (classifier: TicketClassifier, aiTimeoutMs = 100) => {
  const repository = createTicketRepository(openDatabase(':memory:'));
  const warn = jest.fn();
  return { service: createTicketService({ repository, classifier, aiTimeoutMs, logger: { warn } }), repository, warn };
};

describe('TicketService.createTicket', () => {
  it('stores the AI classification', async () => {
    const { service, repository } = make(fakeReturning({ category: 'Billing', priority: 'High' }));
    const ticket = await service.createTicket(input);
    expect(ticket).toMatchObject({ category: 'Billing', priority: 'High', aiStatus: 'classified', aiFallbackReason: null });
    expect(repository.count()).toBe(1);
  });

  it('uses the fallback with reason "timeout" and aborts the AI call', async () => {
    let signal: AbortSignal | undefined;
    const { service, warn } = make(createFakeClassifier(async (_i, s) => { signal = s; return new Promise(() => undefined); }), 30);
    const ticket = await service.createTicket(input);
    expect(ticket).toMatchObject({ category: 'General', priority: 'Medium', aiStatus: 'fallback', aiFallbackReason: 'timeout' });
    expect(signal?.aborted).toBe(true);
    expect(warn).toHaveBeenCalledWith('AI classification failed, using fallback', expect.objectContaining({ reason: 'timeout' }));
  });

  it.each(['ai_error', 'invalid_response', 'ai_unavailable'] as const)('maps ClassifierError(%s) to the fallback reason', async (reason) => {
    const { service } = make(fakeFailing(createClassifierError(reason, 'x')));
    expect((await service.createTicket(input)).aiFallbackReason).toBe(reason);
  });

  it('treats unknown errors as ai_error', async () => {
    const { service } = make(fakeFailing(new Error('network')));
    expect((await service.createTicket(input)).aiFallbackReason).toBe('ai_error');
  });

  it('re-validates classifier output even if the classifier lied about its type', async () => {
    const { service } = make(fakeReturning({ category: 'Technical', priority: 'Urgent' }));
    expect(await service.createTicket(input)).toMatchObject({ priority: 'Medium', aiFallbackReason: 'invalid_response' });
  });

  it('works without a logger', async () => {
    const repository = createTicketRepository(openDatabase(':memory:'));
    const service = createTicketService({ repository, classifier: fakeFailing(new Error('x')), aiTimeoutMs: 50 });
    expect((await service.createTicket(input)).aiStatus).toBe('fallback');
  });

  it('UnavailableClassifier (no API key) always yields the ai_unavailable fallback', async () => {
    const { service } = make(createUnavailableClassifier());
    expect(await service.createTicket(input)).toMatchObject({ aiStatus: 'fallback', aiFallbackReason: 'ai_unavailable' });
  });
});

describe('TicketService.listTickets', () => {
  it('computes totalPages', () => {
    const { service, repository } = make(fakeReturning({ category: 'General', priority: 'Low' }));
    for (let i = 0; i < 5; i++) repository.create({ ...input, category: 'General', priority: 'Low', aiStatus: 'classified', aiFallbackReason: null });
    expect(service.listTickets({ sort: 'newest', page: 1, limit: 2 }).pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
  });
});

describe('withTimeout', () => {
  it('resolves with the task result', async () => {
    await expect(withTimeout(async () => 42, 50)).resolves.toBe(42);
  });
  it('rejects with TimeoutError when the task hangs', async () => {
    const error = await withTimeout(() => new Promise(() => undefined), 20).catch((e: unknown) => e);
    expect(isTimeoutError(error)).toBe(true);
    expect((error as Error).name).toBe('TimeoutError');
  });
  it('propagates task errors', async () => {
    await expect(withTimeout(async () => { throw new Error('nope'); }, 50)).rejects.toThrow('nope');
  });
});
