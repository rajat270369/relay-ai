const contains = (text, terms) => terms.some(term => text.includes(term));
const squeeze = value => String(value || '').replace(/\s+/g, ' ').trim();

export function analyzeEmail(email) {
  const messages = Array.isArray(email.messages) ? email.messages : [];
  const incoming = messages.filter(m => m.role === 'external');
  const last = incoming.at(-1);
  const content = squeeze(last?.body || '');
  const latest = content.toLowerCase();
  // If the latest message has actual text, it outranks the (possibly stale) subject.
  const t = latest || squeeze(email.subject).toLowerCase();
  const subject = squeeze(email.subject).toLowerCase();
  const from = squeeze(email.email).toLowerCase();
  const previous = squeeze(incoming.slice(0, -1).at(-1)?.body || '');

  const informational = contains(t, [
    'no reply needed', 'no response required', 'no action required',
    'no action is required', 'for your information', 'automated notification',
    'you are receiving this newsletter', 'unsubscribe anytime',
    'all services are operating normally', 'reservation has been confirmed',
    'booking has been confirmed', 'daily digest delivered',
  ]) || ((contains(subject, ['newsletter', 'digest', 'briefing', 'activity report']) ||
    contains(from, ['newsletter@', 'digest@', 'notice@'])) &&
    !contains(t, ['could you', 'please respond', 'please confirm', 'your approval', 'would you']));

  const personal = contains(t, [
    'your personal', 'personal opinion', 'personal approval', 'personally share',
    'your decision', 'confirm your decision', 'final approval', 'final sign-off',
    'final signature', 'your signature', 'require your signature', 'you approve',
    'whether you approve', 'equity split', 'funding terms', 'investment proposal',
    'allocation and proposed terms', 'strategic direction', 'confidential conversation',
    'sensitive discussion', 'board discussion', 'approve the revised',
  ]);
  const admin = contains(t, [
    'schedule', 'reschedule', 'calendar', 'availability', 'appointment',
    'confirm the schedule', 'calendar invite', 'calendar invitation',
    'meeting next week', 'interview', 'venue', 'billing contact',
    'invoice', 'payment date', 'shortlist suitable dates', 'book a call',
    'coordinate', 'arrange a', 'studio', 'walkthrough', 'reservation request',
  ]);
  const ambiguous = contains(t, [
    'share your thoughts', 'your thoughts on', 'question about the proposal',
    'unsure whether', 'can you take a look', 'let us know your thoughts',
  ]);

  let group, reason, confidence;
  if (informational && !personal && !admin) {
    group = 'none';
    reason = 'The latest message is an informational update, confirmation or newsletter, without a request that needs an answer.';
    confidence = 96;
  } else if (personal) {
    group = 'client';
    reason = 'The latest request involves a personal decision, approval, signature or sensitive judgment that belongs to Alex.';
    confidence = 94;
  } else if (admin) {
    group = 'assistant';
    reason = 'The newest request concerns scheduling, coordination, follow-up or routine administration that Maya can handle.';
    confidence = 92;
  } else if (ambiguous) {
    group = 'review';
    reason = 'The sender requests an opinion, but the conversation does not clearly show whether Alex or Maya should respond.';
    confidence = 51;
  } else {
    group = 'review';
    reason = 'There is not enough clear evidence to assign the reply. Maya should review this conversation.';
    confidence = 46;
  }

  const sentence = content.length > 220 ? `${content.slice(0, 217).trimEnd()}…` : content;
  const summary = incoming.length > 1 && previous
    ? `Latest: ${sentence || 'No new message text.'} Earlier: ${previous.slice(0, 100).trimEnd()}${previous.length > 100 ? '…' : ''}`
    : sentence || 'No incoming message text available.';

  const actionItems = group === 'none' ? [] : group === 'review'
    ? ['Review the request and decide who should respond.']
    : group === 'client'
      ? ['Ask Alex to review the request and make the final decision.']
      : ['Coordinate a response or the next administrative step.'];

  return { group, reason, confidence, summary, actionItems, aiSource: 'demo', override: false, lastAnalyzedAt: new Date().toISOString() };
}

export const responsibilities = {
  assistant: {label:'Assistant to reply', small:'Assistant', tone:'teal'},
  client: {label:'Client to reply', small:'Client', tone:'purple'},
  none: {label:'No reply needed', small:'No reply', tone:'slate'},
  review: {label:'Needs review', small:'Review', tone:'amber'},
};

export function draftReply(email) {
  const firstName = String(email.name || 'there').split(' ')[0];
  if (email.group === 'none') return `Hi ${firstName},\n\nThank you for the update.\n\nBest regards,\nMaya`;
  if (email.group === 'client') return `Hi ${firstName},\n\nThank you for sending this through. Alex will review the details and get back to you with a decision.\n\nBest regards,\nMaya`;
  if ((email.tags || []).includes('Meetings')) return `Hi ${firstName},\n\nThanks for reaching out. I'll review Alex's availability and get back to you shortly with a confirmed time.\n\nBest regards,\nMaya`;
  return `Hi ${firstName},\n\nThank you for your email. I'll look into this and follow up with the relevant details shortly.\n\nBest regards,\nMaya`;
}
