import test from 'node:test';
import assert from 'node:assert/strict';
import {liveConfig,safeThread,safeInbox,groqClassify,groqDraft,groqAsk} from '../server/groqAI.mjs';

const env={GROQ_API_KEY:'test-only-groq-key',GROQ_MODEL:'qwen/qwen3.8-27b'};
const email={id:'m1',name:'Jordan',email:'j@example.org',subject:'Meeting',group:'assistant',messages:[
  {role:'external',author:'Jordan',body:'Please schedule a call next Tuesday at 10.'},
]};
function mockResult(payload,{assertRequest=()=>{}}={}) {
  return async(url,init)=>{
    assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
    assert.match(init.headers.Authorization,/Bearer test-only-groq-key/);
    const request=JSON.parse(init.body);
    assert.equal(request.model,'qwen/qwen3.8-27b');
    assertRequest(request);
    return {ok:true,json:async()=>({choices:[{message:{content:typeof payload==='string'?payload:JSON.stringify(payload)}}]})};
  };
}
test('missing key uses fallback mode',()=>{
  assert.equal(liveConfig({}),null);
  assert.equal(liveConfig(env).provider,'GroqCloud');
});
test('sanitizes and limits conversation data before sending to AI',()=>{
  const input={...email,messages:Array.from({length:30},()=>({role:'external',body:'x'.repeat(3500)}))};
  const sanitized=safeThread(input);
  assert.equal(sanitized.messages.length,18);
  assert.equal(sanitized.messages[0].body.length,2100);
});
test('Groq classifies thread and returns clear live metadata',async()=>{
  const result=await groqClassify(email,{env,fetchImpl:mockResult({group:'assistant',reason:'Needs scheduling.',summary:'Jordan requests a call.',confidence:92,actionItems:['Check availability.']},
    {assertRequest:req=>assert.equal(req.response_format.type,'json_object')})});
  assert.equal(result.group,'assistant');
  assert.equal(result.aiSource,'live');
  assert.equal(result.aiProvider,'GroqCloud');
  assert.equal(result.actionItems[0],'Check availability.');
});
test('low-confidence model classification becomes Needs Review',async()=>{
  const result=await groqClassify(email,{env,fetchImpl:mockResult({group:'client',reason:'Maybe requires Alex.',summary:'An ambiguous request.',confidence:40})});
  assert.equal(result.group,'review');
  assert.equal(result.confidence,40);
});
test('invalid Groq response is rejected for a safe fallback at API layer',async()=>{
  await assert.rejects(groqClassify(email,{env,fetchImpl:mockResult({group:'owner',reason:'ok',summary:'ok',confidence:99})}),/Invalid classification/);
});
test('draft returns unsent plain text for human review',async()=>{
  const result=await groqDraft(email,{env,fetchImpl:mockResult('Hi Jordan,\nI will check availability.\nBest, Maya')});
  assert.equal(result.draftSource,'live');
  assert.match(result.draft,/check availability/);
});
test('Copilot only exposes valid source thread IDs',async()=>{
  const result=await groqAsk('Which meetings?', [email],null,{env,fetchImpl:mockResult({title:'Meetings',answer:'Jordan requests a call.',sourceIds:['m1','fake-mail-id','m1']})});
  assert.deepEqual(result.sourceIds,['m1']);
  assert.match(result.answer,/Jordan/);
});
test('Copilot excludes archived messages and unrelated threads from context',async()=>{
  const list=[email,{...email,id:'archived',archived:true}];
  const sanitized=safeInbox(list);
  assert.equal(sanitized.length,1);
  assert.equal(sanitized[0].id,'m1');
});
