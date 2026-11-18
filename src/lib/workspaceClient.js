/** Browser-to-server workspace requests; no localStorage is used for inbox data. */
export async function workspaceRequest(path='',{method='GET',body}={}){
  let response;
  try {
    response=await fetch(`/api/workspace${path}`,{
      method,credentials:'same-origin',
      headers:method==='GET'?{}:{'Content-Type':'application/json','X-Relay-Request':'1'},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    });
  } catch {throw new Error('Cannot reach the Relay workspace server. Start npm run api.');}
  const result=await response.json().catch(()=>({}));
  if(!response.ok){const err=new Error(result.error||'Workspace request failed');err.status=response.status;throw err;}
  return result;
}
export const createWorkspaceInvite=()=>workspaceRequest('/invite',{method:'POST',body:{}});
export const joinSharedWorkspace=code=>workspaceRequest('/join',{method:'POST',body:{code}});
