import { classificationSchema, parseClassification, validateClassification } from '../../src/services/ai/classification';
import { ClassifierError } from '../../src/services/ai/types';

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
    expect(() => parseClassification(JSON.stringify({ category: 'Technical', priority }))).toThrow(ClassifierError);
  });

  it.each([['Sales'], ['technical'], [''], [null]])('rejects invalid category %p', (category) => {
    expect(() => parseClassification(JSON.stringify({ category, priority: 'High' }))).toThrow(ClassifierError);
  });

  it('rejects extra keys, missing keys, and non-object JSON', () => {
    expect(() => parseClassification('{"category":"Technical","priority":"High","admin":true}')).toThrow(ClassifierError);
    expect(() => parseClassification('{"category":"Technical"}')).toThrow(ClassifierError);
    expect(() => parseClassification('"Technical"')).toThrow(ClassifierError);
    expect(() => parseClassification('[]')).toThrow(ClassifierError);
  });

  it.each([[undefined], [null], [''], ['not json'], ['{"category": "Tech']])('rejects empty/non-JSON output %p', (raw) => {
    expect.assertions(2);
    try {
      parseClassification(raw as string | null | undefined);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifierError);
      expect((err as ClassifierError).reason).toBe('invalid_response');
    }
  });

  it('validateClassification returns only the allowlisted fields', () => {
    expect(validateClassification({ category: 'Billing', priority: 'Low' })).toEqual({ category: 'Billing', priority: 'Low' });
    expect(classificationSchema.safeParse({ category: 'Billing', priority: 'Low' }).success).toBe(true);
  });
});
