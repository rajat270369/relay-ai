import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleEmails } from '../src/data/sampleEmails.js';
import { answerInboxQuestion, getInboxSignals, getTimeEvidence } from '../src/lib/inboxCopilot.js';

const ask = (q, emails = sampleEmails, selected = null) => answerInboxQuestion(q, emails, selected);


test('briefing counts assigned clients, assistant work, review and waiting', () => {
  const signals=getInboxSignals(sampleEmails);
  assert.equal(signals.client, 4);
  assert.equal(signals.assistant, 6);
  assert.equal(signals.review, 1);
  assert.equal(signals.waiting, 1);
  assert.equal(signals.active, 15);
});

test('Alex approval question links client-owned threads, not all assistant requests', () => {
  const result=ask('Which emails need Alex’s approval?');
  assert.equal(result.intent,'client');
  assert.equal(result.total,4);
  assert.ok(result.results.some(e=>e.id==='m2'));
  assert.ok(result.results.every(e=>e.category==='client'));
});

test('waiting means explicitly marked waiting, not all unresponded messages', () => {
  const result=ask('What am I waiting for?');
  assert.equal(result.intent,'waiting');
  assert.deepEqual(result.results.map(e=>e.id),['m12']);
});

test('review highlights ambiguous messages', () => {
  const result=ask('Which conversations need review?');
  assert.equal(result.total,1);
  assert.equal(result.results[0].id,'m13');
});

test('priority counts only important or review flagged actionable conversations', () => {
  const result=ask('What should I focus on today?');
  assert.equal(result.intent,'priority');
  assert.ok(result.total>=4);
  assert.ok(result.results.every(r=>r.category!=='none'));
});

test('time evidence quotes existing message phrases without date inference', () => {
  const evidence=getTimeEvidence(sampleEmails.find(e=>e.id==='m2'));
  assert.ok(evidence.some(t=>t.toLowerCase().includes('before friday at 5 pm')));
  assert.ok(evidence.every(t=>!t.includes('2027')));
});

test('deadline search only includes explicit deadline wording', () => {
  const result=ask('What deadlines are mentioned?');
  assert.equal(result.intent,'deadlines');
  assert.ok(result.results.some(e=>e.id==='m2'));
  assert.ok(!result.results.some(e=>e.id==='m3'));
});

test('meeting search includes scheduling, with source conversation links', () => {
  const result=ask('Show meetings and scheduling');
  assert.equal(result.intent,'meetings');
  assert.ok(result.results.some(e=>e.id==='m1'));
  assert.ok(result.results.some(e=>e.id==='m5'));
  assert.ok(result.results.every(e=>e.id && e.subject));
});

test('explain selected email uses its current reason', () => {
  const result=ask('Why was this assigned to the client?', sampleEmails, 'm2');
  assert.equal(result.intent,'why');
  assert.match(result.answer, /financial decision/i);
  assert.equal(result.results[0].id,'m2');
});

test('explain with no selected email guides user without fabricated explanation', () => {
  const result=ask('Why assigned to Alex?');
  assert.equal(result.total,0);
  assert.match(result.answer,/Open a conversation/);
});

test('generic search matches sender and subject, not hallucinated content', () => {
  const result=ask('Sophia');
  assert.equal(result.intent,'search');
  assert.ok(result.results.some(e=>e.id==='m1'));
});

test('unknown search is grounded as no matches', () => {
  const result=ask('quantum mango');
  assert.equal(result.total,0);
  assert.match(result.answer,/No matching/);
});

test('after a manual reassignment, counts and answers change', () => {
  const revised=sampleEmails.map(e=>e.id==='m2'?{...e,group:'assistant'}:e);
  assert.equal(ask('Which emails need Alex?',revised).total,3);
});

test('archived and completed conversations are not reported as active', () => {
  const revised=sampleEmails.map(e=>e.group==='client'?{...e,completed:true}:e);
  assert.equal(ask('Which emails need Alex?',revised).total,0);
});

test('draft requests require a selected thread and never send mail', () => {
  assert.match(ask('Draft a reply to this conversation').answer,/Open an email first/);
  const r=ask('Draft a reply to this conversation',sampleEmails,'m1');
  assert.equal(r.results[0].id,'m1');
  assert.match(r.answer,/No message is sent without approval/);
});

test('summaries can use selected email and inbox-wide statuses', () => {
  const single=ask('Summarize this conversation', sampleEmails, 'm1');
  assert.equal(single.intent,'summary');
  assert.match(single.answer,/Thursday/);
  const all=ask('Summarize my inbox');
  assert.equal(all.intent,'summary');
  assert.match(all.answer,/active threads/);
});
