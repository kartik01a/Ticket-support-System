import { openDatabase } from '../../src/db/connection';
import { TicketRepository } from '../../src/repositories/ticket.repository';
import { ClassifierError } from '../../src/services/ai/types';
import { UnavailableClassifier } from '../../src/services/ai/unavailable.classifier';
import { TicketService } from '../../src/services/ticket.service';
import { withTimeout, TimeoutError } from '../../src/utils/with-timeout';
import { FakeClassifier } from '../helpers/fake-classifier';

const input = { title: 'T', description: 'D', customerEmail: 'a@b.com' };

const make = (classifier: ConstructorParameters<typeof TicketService>[0]['classifier'], aiTimeoutMs = 100) => {
  const repository = new TicketRepository(openDatabase(':memory:'));
  const warn = jest.fn();
  return { service: new TicketService({ repository, classifier, aiTimeoutMs, logger: { warn } }), repository, warn };
};

describe('TicketService.createTicket', () => {
  it('stores the AI classification', async () => {
    const { service, repository } = make(FakeClassifier.returning({ category: 'Billing', priority: 'High' }));
    const ticket = await service.createTicket(input);
    expect(ticket).toMatchObject({ category: 'Billing', priority: 'High', aiStatus: 'classified', aiFallbackReason: null });
    expect(repository.count()).toBe(1);
  });

  it('uses the fallback with reason "timeout" and aborts the AI call', async () => {
    let signal: AbortSignal | undefined;
    const { service, warn } = make(new FakeClassifier(async (_i, s) => { signal = s; return new Promise(() => undefined); }), 30);
    const ticket = await service.createTicket(input);
    expect(ticket).toMatchObject({ category: 'General', priority: 'Medium', aiStatus: 'fallback', aiFallbackReason: 'timeout' });
    expect(signal?.aborted).toBe(true);
    expect(warn).toHaveBeenCalledWith('AI classification failed, using fallback', expect.objectContaining({ reason: 'timeout' }));
  });

  it.each(['ai_error', 'invalid_response', 'ai_unavailable'] as const)('maps ClassifierError(%s) to the fallback reason', async (reason) => {
    const { service } = make(FakeClassifier.failing(new ClassifierError(reason, 'x')));
    expect((await service.createTicket(input)).aiFallbackReason).toBe(reason);
  });

  it('treats unknown errors as ai_error', async () => {
    const { service } = make(FakeClassifier.failing(new Error('network')));
    expect((await service.createTicket(input)).aiFallbackReason).toBe('ai_error');
  });

  it('re-validates classifier output even if the classifier lied about its type', async () => {
    const { service } = make(FakeClassifier.returning({ category: 'Technical', priority: 'Urgent' }));
    expect(await service.createTicket(input)).toMatchObject({ priority: 'Medium', aiFallbackReason: 'invalid_response' });
  });

  it('works without a logger', async () => {
    const repository = new TicketRepository(openDatabase(':memory:'));
    const service = new TicketService({ repository, classifier: FakeClassifier.failing(new Error('x')), aiTimeoutMs: 50 });
    expect((await service.createTicket(input)).aiStatus).toBe('fallback');
  });

  it('UnavailableClassifier (no API key) always yields the ai_unavailable fallback', async () => {
    const { service } = make(new UnavailableClassifier());
    expect(await service.createTicket(input)).toMatchObject({ aiStatus: 'fallback', aiFallbackReason: 'ai_unavailable' });
  });
});

describe('TicketService.listTickets', () => {
  it('computes totalPages', () => {
    const { service, repository } = make(FakeClassifier.returning({ category: 'General', priority: 'Low' }));
    for (let i = 0; i < 5; i++) repository.create({ ...input, category: 'General', priority: 'Low', aiStatus: 'classified', aiFallbackReason: null });
    expect(service.listTickets({ sort: 'newest', page: 1, limit: 2 }).pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
  });
});

describe('withTimeout', () => {
  it('resolves with the task result', async () => {
    await expect(withTimeout(async () => 42, 50)).resolves.toBe(42);
  });
  it('rejects with TimeoutError when the task hangs', async () => {
    await expect(withTimeout(() => new Promise(() => undefined), 20)).rejects.toBeInstanceOf(TimeoutError);
  });
  it('propagates task errors', async () => {
    await expect(withTimeout(async () => { throw new Error('nope'); }, 50)).rejects.toThrow('nope');
  });
});
