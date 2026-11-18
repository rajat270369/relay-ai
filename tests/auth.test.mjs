import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAuthService } from '../server/auth.mjs';

async function fixture(t) {
  const dir=await mkdtemp(path.join(tmpdir(),'relay-auth-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=path.join(dir,'auth.json');
  const auth=createAuthService({file});
  await auth.ready;
  return {file,auth};
}
const newAssistant={name:'Maya Patel',email:'Maya@Example.com',password:'correct-horse-password',role:'assistant'};

test('creates a real assistant account with salted password hash, never plaintext',async t=>{
  const {file,auth}=await fixture(t);
  const {user,token}=await auth.signup(newAssistant);
  assert.equal(user.email,'maya@example.com');
  assert.equal(user.role,'assistant');
  assert.equal(user.connection,null);
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  const stored=await readFile(file,'utf8');
  assert.ok(!stored.includes(newAssistant.password));
  assert.ok(!stored.includes(token));
  assert.equal((await auth.getSession(token)).id,user.id);
});

test('login verifies password and does not let sign-in select a new role',async t=>{
  const {auth}=await fixture(t);
  await auth.signup(newAssistant);
  await assert.rejects(auth.login({email:newAssistant.email,password:'wrongpassword'}),/Incorrect email or password/);
  const {user}=await auth.login({email:newAssistant.email,password:newAssistant.password,role:'client'});
  assert.equal(user.role,'assistant');
});

test('duplicate emails and weak passwords are rejected',async t=>{
  const {auth}=await fixture(t);
  await assert.rejects(auth.signup({...newAssistant,password:'small'}),/10–128/);
  await auth.signup(newAssistant);
  await assert.rejects(auth.signup({...newAssistant,email:'maya@example.com'}),/already exists/);
});

test('sessions persist across server service restart, and logout revokes them',async t=>{
  const {file,auth}=await fixture(t);
  const {token}=await auth.signup(newAssistant);
  const reloaded=createAuthService({file});
  await reloaded.ready;
  assert.equal((await reloaded.getSession(token)).email,'maya@example.com');
  await reloaded.logout(token);
  assert.equal(await reloaded.getSession(token),null);
});

test('sample provider choice persists for assistants, remains explicitly simulated',async t=>{
  const {file,auth}=await fixture(t);
  const {token}=await auth.signup(newAssistant);
  const connected=await auth.setConnection(token,'Gmail');
  assert.equal(connected.connection.provider,'Gmail');
  assert.equal(connected.connection.simulated,true);
  const reloaded=createAuthService({file});await reloaded.ready;
  assert.equal((await reloaded.getSession(token)).connection.provider,'Gmail');
  assert.equal((await reloaded.disconnect(token)).connection,null);
});

test('client accounts cannot connect assistant mailbox',async t=>{
  const {auth}=await fixture(t);
  const {token,user}=await auth.signup({...newAssistant,email:'alex@example.com',role:'client'});
  assert.equal(user.role,'client');
  await assert.rejects(auth.setConnection(token,'Gmail'),/Only assistants/);
});

test('invalid role and provider do not grant access',async t=>{
  const {auth}=await fixture(t);
  await assert.rejects(auth.signup({...newAssistant,role:'admin'}),/Choose an assistant/);
  const {token}=await auth.signup(newAssistant);
  await assert.rejects(auth.setConnection(token,'Not Gmail'),/Unknown provider/);
  assert.equal(await auth.getSession('made-up-token'),null);
});
