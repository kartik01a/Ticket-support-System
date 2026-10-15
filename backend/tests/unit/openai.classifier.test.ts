import { OpenAiClassifier } from '../../src/services/ai/openai.classifier';
import { ClassifierError } from '../../src/services/ai/types';

const input = { title: 'Cannot log in', description: 'Error 500' };

/** A stand-in for the OpenAI SDK client: no network, no key. */
function fakeClient(create: jest.Mock) {
  return { chat: { completions: { create } } } as unknown as ConstructorParameters<typeof OpenAiClassifier>[0]['client'];
}
const make = (create: jest.Mock) => new OpenAiClassifier({ apiKey: 'sk-test', model: 'test-model', timeoutMs: 1000, client: fakeClient(create) });
const reply = (content: string | null, refusal: string | null = null) => ({ choices: [{ message: { content, refusal } }] });

describe('OpenAiClassifier', () => {
  it('sends the model, a strict JSON schema and delimited ticket text', async () => {
    const create = jest.fn().mockResolvedValue(reply('{"category":"Technical","priority":"High"}'));
    const result = await make(create).classify(input);

    expect(result).toEqual({ category: 'Technical', priority: 'High' });
    const [body] = create.mock.calls[0];
    expect(body.model).toBe('test-model');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.properties.priority.enum).toEqual(['Low', 'Medium', 'High']);
    expect(body.messages[1].content).toContain('<ticket>');
    expect(body.messages[1].content).toContain('Cannot log in');
  });

  it('passes the abort signal to the SDK', async () => {
    const create = jest.fn().mockResolvedValue(reply('{"category":"General","priority":"Low"}'));
    const controller = new AbortController();
    await make(create).classify(input, controller.signal);
    expect(create.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it.each([
    ['non-JSON text', reply('Sure! It is a technical issue.')],
    ['empty content', reply(null)],
    ['an invalid priority', reply('{"category":"Technical","priority":"Critical"}')],
    ['no choices', { choices: [] }],
    ['a refusal', reply(null, 'I cannot help with that')],
  ])('throws invalid_response for %s', async (_label, response) => {
    const create = jest.fn().mockResolvedValue(response);
    await expect(make(create).classify(input)).rejects.toMatchObject({ reason: 'invalid_response' });
  });

  it('maps SDK timeouts to reason "timeout"', async () => {
    const err = new Error('Request timed out.');
    err.name = 'APIConnectionTimeoutError';
    await expect(make(jest.fn().mockRejectedValue(err)).classify(input)).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('maps an aborted signal to reason "timeout"', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(make(jest.fn().mockRejectedValue(new Error('aborted'))).classify(input, controller.signal)).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('maps other SDK errors to "ai_error" without leaking the upstream message', async () => {
    const create = jest.fn().mockRejectedValue(Object.assign(new Error('401 Incorrect API key provided: sk-live-abc'), { name: 'AuthenticationError' }));
    const promise = make(create).classify(input);
    await expect(promise).rejects.toBeInstanceOf(ClassifierError);
    await expect(promise).rejects.toMatchObject({ reason: 'ai_error', message: 'OpenAI request failed (AuthenticationError)' });
  });
});
