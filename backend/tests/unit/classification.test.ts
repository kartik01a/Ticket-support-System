import { classificationSchema, parseClassification, validateClassification } from '../../src/services/ai/classification';
import { isClassifierError, type ClassifierError } from '../../src/services/ai/types';
import { expectClassifierError } from '../helpers/classifier-error';

describe('parseClassification (AI output is untrusted)', () => {
  it.each([
    ['Technical', 'High'],
    ['Billing', 'Medium'],
    ['General', 'Low'],
  ])('accepts %s / %s', (category, priority) => {
    expect(parseClassification(JSON.stringify({ category, priority }))).toEqual({ category, priority });
  });

  it.each([
    ['Urgent'],
    ['Critical'],
    ['high'],
    ['HIGH'],
    [' High'],
    [''],
    [1],
    [null],
    [['High']],
  ])('rejects invalid priority %p', (priority) => {
    expectClassifierError(() => parseClassification(JSON.stringify({ category: 'Technical', priority })));
  });

  it.each([['Sales'], ['technical'], [''], [null]])('rejects invalid category %p', (category) => {
    expectClassifierError(() => parseClassification(JSON.stringify({ category, priority: 'High' })));
  });

  it('rejects extra keys, missing keys, and non-object JSON', () => {
    expectClassifierError(() => parseClassification('{"category":"Technical","priority":"High","admin":true}'));
    expectClassifierError(() => parseClassification('{"category":"Technical"}'));
    expectClassifierError(() => parseClassification('"Technical"'));
    expectClassifierError(() => parseClassification('[]'));
  });

  it.each([[undefined], [null], [''], ['not json'], ['{"category": "Tech']])('rejects empty/non-JSON output %p', (raw) => {
    expect.assertions(2);
    try {
      parseClassification(raw as string | null | undefined);
    } catch (err) {
      expect(isClassifierError(err)).toBe(true);
      expect((err as ClassifierError).reason).toBe('invalid_response');
    }
  });

  it('validateClassification returns only the allowlisted fields', () => {
    expect(validateClassification({ category: 'Billing', priority: 'Low' })).toEqual({ category: 'Billing', priority: 'Low' });
    expect(classificationSchema.safeParse({ category: 'Billing', priority: 'Low' }).success).toBe(true);
  });
});
