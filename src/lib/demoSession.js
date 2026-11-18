/**
 * Relay prototype sign-in state. This is NOT authentication or OAuth.
 * Store only non-sensitive demo identity metadata in sessionStorage.
 */
export const SESSION_KEY = 'relay-demo-session-v2';
export const PROVIDERS = ['Gmail', 'Outlook', 'Demo Workspace'];

export function identityFor(role = 'assistant') {
  return role === 'client'
    ? { role: 'client', name: 'Alex Morgan', email: 'alex@northstar.demo' }
    : { role: 'assistant', name: 'Maya Patel', email: 'maya@northstar.demo' };
}

export function createDemoSession({ role = 'assistant', email, name, pendingProvider = null } = {}) {
  if (!['assistant', 'client'].includes(role)) throw new Error('Choose an assistant or client demo identity.');
  const example = identityFor(role);
  const cleanEmail = String(email || example.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 160) {
    throw new Error('Enter a valid demo email address.');
  }
  const cleanName = String(name || example.name).trim().slice(0, 80);
  if (!cleanName) throw new Error('Enter a display name.');
  return {
    role, email: cleanEmail, name: cleanName,
    pendingProvider: PROVIDERS.includes(pendingProvider) ? pendingProvider : null,
    connection: null,
    signedInAt: new Date().toISOString(),
    demo: true,
  };
}

export function connectDemoProvider(session, provider, when = new Date().toISOString()) {
  if (!session || session.role !== 'assistant') throw new Error('Sign in as the assistant to connect a sample mailbox.');
  if (!PROVIDERS.includes(provider)) throw new Error('Unknown demo provider.');
  return {
    ...session,
    pendingProvider: null,
    connection: {
      provider,
      address: 'maya@northstar.demo',
      status: 'connected',
      simulated: true,
      connectedAt: when,
      lastSyncedAt: when,
    },
  };
}

export function disconnectDemoProvider(session) {
  return session ? {...session, connection: null, pendingProvider: null} : null;
}

export function readDemoSession(storage) {
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
    if (!value || value.demo !== true || !['client','assistant'].includes(value.role)) return null;
    if (typeof value.email !== 'string' || typeof value.name !== 'string') return null;
    if (value.connection && (!PROVIDERS.includes(value.connection.provider) || value.connection.simulated !== true)) return null;
    return value;
  } catch { return null; }
}
