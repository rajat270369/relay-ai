import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, createDraft } from './ai.js';

const email = {
  id: 'test-1', name: 'Jordan Reed', email: 'jordan@example.com',
  subject: 'Reschedule meeting', group: 'review', tags: ['Meetings'],
  messages: [{role:'external',author:'Jordan Reed',body:'Could you schedule a quick meeting?',time:new Date().toISOString()}],
};

test('no API key: transparent demo classifier', async () => {
  const old = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const result=await classify(email);
    assert.equal(result.aiSource,'demo');
    assert.equal(result.group,'assistant');
    const reply=await createDraft(email);
    assert.equal(reply.draftSource,'demo');
    assert.match(reply.draft,/Hi Jordan/);
  } finally { if (old) process.env.OPENAI_API_KEY=old; }
});

test('mocked API: parses live model output and respects low-confidence review', async () => {
  const oldKey=process.env.OPENAI_API_KEY;
  const oldFetch=globalThis.fetch;
  process.env.OPENAI_API_KEY='unit-test-secret';
  globalThis.fetch = async (url, options) => {
    assert.equal(url,'https://api.openai.com/v1/responses');
    assert.equal(JSON.parse(options.body).store,false);
    return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({group:'client',reason:'Requires approval.',summary:'Needs client approval.',confidence:52})}]}]})};
  };
  try {
    const result=await classify(email);
    assert.equal(result.aiSource,'live');
    assert.equal(result.group,'review');
    assert.equal(result.confidence,52);
  } finally { globalThis.fetch=oldFetch; if(oldKey)process.env.OPENAI_API_KEY=oldKey;else delete process.env.OPENAI_API_KEY; }
});

test('failed API call: falls back safely and labels the result', async () => {
  const oldKey=process.env.OPENAI_API_KEY;
  const oldFetch=globalThis.fetch;
  process.env.OPENAI_API_KEY='unit-test-secret';
  globalThis.fetch=async()=>({ok:false,status:429});
  try {
    const result=await classify(email);
    assert.equal(result.aiSource,'demo');
    assert.match(result.aiIssue,/Live AI unavailable/);
  } finally { globalThis.fetch=oldFetch; if(oldKey)process.env.OPENAI_API_KEY=oldKey;else delete process.env.OPENAI_API_KEY; }
});
