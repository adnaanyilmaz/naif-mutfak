import { describe, expect, it } from 'vitest';
import { classifyAiError, extractModelText, parseModelJson, stripFence } from './model-output';

describe('extractModelText', () => {
  it('reads chat-completions and legacy response shapes', () => {
    expect(extractModelText({ choices: [{ message: { content: 'hi' } }] })).toBe('hi');
    expect(extractModelText({ response: 'hi' })).toBe('hi');
    expect(extractModelText({ response: { a: 1 } })).toBe('{"a":1}');
    expect(extractModelText({})).toBeNull();
    expect(extractModelText(null)).toBeNull();
  });
});

describe('parseModelJson', () => {
  it('recovers one JSON object from chatty or fenced output', () => {
    expect(parseModelJson({ response: 'Sure!\n```json\n{"title":"Bread"}\n```\nDone.' })).toEqual({ title: 'Bread' });
    expect(parseModelJson({ response: { title: 'Bread' } })).toEqual({ title: 'Bread' });
    expect(parseModelJson({ choices: [{ message: { content: '{"issues":[]}' } }] })).toEqual({ issues: [] });
  });

  it('returns null when no complete object exists', () => {
    expect(parseModelJson({ response: 'no json here' })).toBeNull();
    expect(parseModelJson({ response: '{"title": "Bre' })).toBeNull();
  });
});

describe('stripFence', () => {
  it('removes one wrapping fence only', () => {
    expect(stripFence('```markdown\n# A\n```')).toBe('# A');
    expect(stripFence('```\n# A\n```\n')).toBe('# A');
    expect(stripFence('# A')).toBe('# A');
    expect(stripFence('# A\n\n```js\nx\n```')).toBe('# A\n\n```js\nx\n```');
  });
});

describe('classifyAiError', () => {
  it('separates the daily quota from capacity and other failures', () => {
    expect(classifyAiError(new Error('3036: You have used up your daily free allocation of 10,000 neurons'))).toBe('quota');
    expect(classifyAiError(new Error('4006: you have used up your daily free allocation of 10,000 neurons'))).toBe('quota');
    expect(classifyAiError(new Error('429 Too Many Requests'))).toBe('quota');
    expect(classifyAiError(new Error('3040: Capacity temporarily exceeded, please try again.'))).toBe('ai_unavailable');
    expect(classifyAiError(new Error('3040: out of capacity'))).toBe('ai_unavailable');
    expect(classifyAiError('boom')).toBe('ai_unavailable');
  });
});
