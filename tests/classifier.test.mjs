import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEmail } from '../src/lib/demoAI.js';
import { sampleEmails, createIncomingEmail } from '../src/data/sampleEmails.js';

for (const email of sampleEmails) {
  test(`seed conversation ${email.id}: ${email.group}`, () => {
    const result = analyzeEmail(email);
    assert.equal(result.group, email.group);
    assert.ok(result.reason);
    assert.ok(result.summary);
    assert.equal(result.aiSource, 'demo');
  });
}
for (let index = 0; index < 3; index++) {
  test(`new incoming email ${index}`, () => {
    const expected = ['assistant', 'client', 'none'][index];
    assert.equal(analyzeEmail(createIncomingEmail(index)).group, expected);
  });
}

test('a newer personal approval overrides an older scheduling subject', () => {
  const original = sampleEmails[0];
  const revised = {...original, messages: [...original.messages, {
    role:'external',author:original.name,
    body:'Alex, this now needs your personal approval on the final funding terms. Please confirm your decision.',
  }]};
  assert.equal(analyzeEmail(revised).group, 'client');
});
test('a newer scheduling request overrides an old approval subject', () => {
  const original = sampleEmails[1];
  const revised = {...original, messages: [...original.messages, {
    role:'external',author:original.name,
    body:'Maya, please schedule a 20 minute call next Monday morning and send the calendar invite.',
  }]};
  assert.equal(analyzeEmail(revised).group, 'assistant');
});
test('uncertain request routes to human review', () => {
  const result = analyzeEmail({subject:'Hello',messages:[{role:'external',body:'Could someone look at this sometime?'}]});
  assert.equal(result.group,'review');
  assert.ok(result.confidence < 65);
});
test('negative: explicit no action is not a reply request', () => {
  const result = analyzeEmail({subject:'Notice',messages:[{role:'external',body:'Your booking has been confirmed. No action is required.'}]});
  assert.equal(result.group,'none');
});
