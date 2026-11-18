import test from 'node:test';
import assert from 'node:assert/strict';
import { applyHandoffAction, isDelegatedToAssistant } from '../src/lib/handoff.js';
import { sampleEmails } from '../src/data/sampleEmails.js';

const seed = () => structuredClone(sampleEmails.find(e => e.id === 'm2'));
const at = '2026-11-17T12:00:00.000Z';

test('Alex delegates to Maya with optional instructions, without authorizing a personal decision', () => {
  const original = seed();
  const updated = applyHandoffAction(original, 'delegate', {note:'  Please schedule a call  but ask me before approving. ', at});
  assert.equal(updated.group, 'assistant');
  assert.equal(updated.unread, true);
  assert.equal(updated.completed, false);
  assert.equal(updated.override, true);
  assert.equal(updated.handoff.status, 'delegated');
  assert.equal(updated.handoff.note, 'Please schedule a call but ask me before approving.');
  assert.match(updated.reason, /approval still requires Alex/);
  assert.equal(updated.handoffHistory[0].actor, 'Alex Morgan');
  assert.equal(original.group, 'client');
  assert.equal(original.handoff, undefined);
  assert.ok(isDelegatedToAssistant(updated));
});

test('Alex marks a conversation handled without sending a message', () => {
  const original = seed();
  const updated = applyHandoffAction(original, 'handled', {at});
  assert.equal(updated.completed, true);
  assert.equal(updated.unread, false);
  assert.equal(updated.handoff.status, 'handled');
  assert.equal(updated.messages.length, original.messages.length);
  assert.equal(isDelegatedToAssistant(updated), false);
});

test('Maya can return a delegated request to Alex', () => {
  const delegated = applyHandoffAction(seed(), 'delegate', {at});
  const returned = applyHandoffAction(delegated, 'return', {at:'2026-11-17T12:05:00.000Z'});
  assert.equal(returned.group, 'client');
  assert.equal(returned.handoff.status, 'return');
  assert.equal(returned.handoffHistory.length, 2);
  assert.equal(returned.handoffHistory.at(-1).actor, 'Maya (Assistant)');
  assert.equal(returned.completed, false);
});

test('Alex can recall an outstanding delegation', () => {
  const delegated = applyHandoffAction(seed(), 'delegate', {at});
  const recalled = applyHandoffAction(delegated, 'recall', {at:'2026-11-17T12:06:00.000Z'});
  assert.equal(recalled.group, 'client');
  assert.equal(recalled.handoff.status, 'recall');
  assert.equal(isDelegatedToAssistant(recalled), false);
});

test('Alex can reopen a handled conversation', () => {
  const handled = applyHandoffAction(seed(), 'handled', {at});
  const reopened = applyHandoffAction(handled, 'reopen', {at:'2026-11-17T12:10:00.000Z'});
  assert.equal(reopened.completed, false);
  assert.equal(reopened.group, 'client');
  assert.equal(reopened.handoffHistory.length, 2);
});

test('invalid handoff transitions cannot reassign unrelated messages', () => {
  assert.throws(() => applyHandoffAction(sampleEmails.find(e => e.id === 'm1'), 'delegate'), /no longer awaiting/);
  assert.throws(() => applyHandoffAction(seed(), 'return'), /not currently delegated/);
  assert.throws(() => applyHandoffAction(seed(), 'reopen'), /Only a client-handled/);
  assert.throws(() => applyHandoffAction(seed(), 'unknown'), /Unknown/);
});

test('handoff history survives browser JSON persistence', () => {
  const delegated = applyHandoffAction(seed(), 'delegate', {at});
  const hydrated = JSON.parse(JSON.stringify(delegated));
  assert.equal(hydrated.handoff.at, at);
  assert.equal(hydrated.handoffHistory[0].action, 'delegate');
  assert.ok(isDelegatedToAssistant(hydrated));
});

test('delegation only applies to active assistant-owned threads', () => {
  const delegated = applyHandoffAction(seed(), 'delegate', {at});
  assert.equal(isDelegatedToAssistant({...delegated,archived:true}), false);
  assert.equal(isDelegatedToAssistant({...delegated,completed:true}), false);
  assert.equal(isDelegatedToAssistant({...delegated,group:'client'}), false);
});
