/**
 * Demo handoff state machine shared by the assistant and client workspaces.
 * These transitions change ownership/status, never send emails or grant approval.
 * The activity trail is stored with each conversation in browser localStorage.
 */
const maxNote = 400;

export function applyHandoffAction(email, action, { note = '', at = new Date().toISOString() } = {}) {
  if (!email || typeof email !== 'object') throw new Error('Conversation not found.');
  const cleanNote = String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, maxNote);
  const previous = Array.isArray(email.handoffHistory) ? email.handoffHistory : [];

  const clientActions = ['delegate', 'handled'];
  if (clientActions.includes(action) && (email.group !== 'client' || email.completed || email.archived)) {
    throw new Error('This conversation is no longer awaiting Alex.');
  }
  if (action === 'return' && (email.group !== 'assistant' || email.handoff?.status !== 'delegated' || email.completed)) {
    throw new Error('This conversation is not currently delegated to Maya.');
  }
  if (action === 'recall' && (email.group !== 'assistant' || email.handoff?.status !== 'delegated' || email.completed)) {
    throw new Error('This conversation can no longer be recalled.');
  }
  if (action === 'reopen' && (!email.completed || email.handoff?.status !== 'handled')) {
    throw new Error('Only a client-handled conversation can be reopened here.');
  }
  if (!['delegate', 'handled', 'return', 'recall', 'reopen'].includes(action)) {
    throw new Error('Unknown handoff action.');
  }

  const actor = ['return'].includes(action) ? 'Maya (Assistant)' : 'Alex Morgan';
  const event = { id: `${email.id}-${action}-${at}-${previous.length}`, action, actor, at, note:cleanNote };
  const common = {
    handoff: { status: action === 'delegate' ? 'delegated' : action === 'handled' ? 'handled' : action, actor, at, note:cleanNote },
    handoffHistory: [...previous, event],
    override: true,
    confidence: 100, // display as a manual assignment, NOT an AI probability
    waiting: false,
    draft: '',
    draftSource: 'demo',
  };

  if (action === 'delegate') {
    return {
      ...email, ...common, group: 'assistant', completed:false, unread:true,
      reason:'Alex delegated coordination and follow-up to Maya. Any personal approval still requires Alex.',
      actionItems:[cleanNote ? `Alex’s note: ${cleanNote}` : 'Maya should coordinate the next step and follow up with the sender.',
        'Ask Alex before making any personal or sensitive decision.'],
    };
  }
  if (action === 'handled') {
    return {
      ...email, ...common, group:'client', completed:true, unread:false,
      reason:'Alex marked this conversation as handled. No additional response is currently needed.',
      actionItems:[],
    };
  }
  if (action === 'return') {
    return {
      ...email, ...common, group:'client', completed:false, unread:true,
      reason:'Maya returned this conversation to Alex for a personal decision.',
      actionItems:[cleanNote ? `Maya’s note: ${cleanNote}` : 'Alex should review this request and make the necessary decision.'],
    };
  }
  if (action === 'recall') {
    return {
      ...email, ...common, group:'client', completed:false, unread:true,
      reason:'Alex recalled this conversation from Maya and will handle it personally.',
      actionItems:['Alex should review the request and respond personally.'],
    };
  }
  return {
    ...email, ...common, group:'client', completed:false, unread:true,
    reason:'Alex reopened this previously handled conversation.',
    actionItems:['Alex should review the reopened conversation.'],
  };
}

export function isDelegatedToAssistant(email) {
  return email?.group === 'assistant' && !email.completed && !email.archived && email.handoff?.status === 'delegated';
}

export const handoffLabels = {
  delegated:'Delegated to Maya',
  handled:'Marked handled',
  return:'Returned to Alex',
  recall:'Recalled by Alex',
  reopen:'Reopened by Alex',
  replied:'Maya replied (demo)',
};
