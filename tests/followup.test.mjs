import test from 'node:test';
import assert from 'node:assert/strict';
import { getFollowUpSignals, isFollowUpConversation } from '../src/lib/followupRadar.js';
import { sampleEmails } from '../src/data/sampleEmails.js';

test('Follow-up Radar identifies grounded categories without inventing due dates',()=>{
  const {items,counts}=getFollowUpSignals(sampleEmails);
  assert.ok(counts.total>=7);
  assert.ok(counts.decisions>=3);
  assert.ok(counts.meetings>=3);
  assert.ok(counts.waiting>=1);
  assert.ok(counts.deadlines>=1);
  const approval=items.find(i=>i.id==='m2');
  assert.ok(approval);
  assert.match(approval.detail,/before Friday/i);
  assert.doesNotMatch(approval.detail,/2026|2027/);
  assert.equal(items.some(e=>e.id==='m3'),false);
});

test('Radar excludes archived/completed threads and respects thread updates',()=>{
  const emails=structuredClone(sampleEmails);
  const m2=emails.find(e=>e.id==='m2');m2.completed=true;
  const results=getFollowUpSignals(emails);
  assert.equal(results.items.some(i=>i.id==='m2'),false);
  assert.equal(isFollowUpConversation(m2),false);
  assert.equal(isFollowUpConversation(emails.find(e=>e.id==='m5')),true);
});
