export async function authRequest(path, body) {
  let response;
  try {
    response=await fetch(`/api/auth/${path}`,{
      method:body===undefined?'GET':'POST',
      credentials:'same-origin',
      headers:body===undefined?{}:{'Content-Type':'application/json','X-Relay-Request':'1'},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    });
  } catch {
    throw new Error('Cannot reach the Relay API. Start npm run api in another terminal.');
  }
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||'Authentication request failed.');
  return payload;
}
export const readAccount=()=>authRequest('me');
export const registerAccount=details=>authRequest('signup',details);
export const signInAccount=details=>authRequest('login',details);
export const signOutAccount=()=>authRequest('logout',{});
export const connectAccount=provider=>authRequest('connect',{provider});
export const disconnectAccount=()=>authRequest('disconnect',{});

/** Only unlinked client accounts may opt into the assistant experience. */
export const switchToAssistantAccount=()=>authRequest('switch-to-assistant',{});

/** Fix older assistant accounts which have no workspace ID. */
export const ensureAssistantWorkspaceAccount=()=>authRequest('ensure-assistant-workspace',{});
