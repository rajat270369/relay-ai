/**
 * Grounded, transparent demo inbox intelligence.
 * Answers are constructed ONLY from conversations currently visible in Relay's
 * local demo store. This is not an LLM and does not invent calendar dates.
 */
import { latestTime } from './helpers.js';

const textOf = e => [e.name, e.email, e.subject, e.summary, e.reason,
  ...(e.tags || []), ...(e.messages || []).map(m => m.body || '')].join(' ').toLowerCase();
const active = e => !e.archived && !e.completed;
const MAX_RESULTS = 7;

const urgency = e =>
  (e.group === 'client' ? 6 : e.group === 'review' ? 5 : e.group === 'assistant' ? 3 : 0) +
  (e.importance ? 4 : 0) + (e.unread ? 1 : 0) + (e.handoff?.status === 'delegated' ? 2 : 0);

function ordered(list) {
  return [...list].sort((a,b) => urgency(b)-urgency(a) ||
    (new Date(latestTime(b)).getTime() || 0) - (new Date(latestTime(a)).getTime() || 0));
}

export function getInboxSignals(emails) {
  const items = (emails || []).filter(active);
  return {
    active: items.length,
    client: items.filter(e => e.group === 'client').length,
    assistant: items.filter(e => e.group === 'assistant').length,
    review: items.filter(e => e.group === 'review').length,
    waiting: items.filter(e => e.waiting).length,
    delegated: items.filter(e => e.handoff?.status === 'delegated').length,
    priority: ordered(items.filter(e => e.group !== 'none' && (e.importance || e.group === 'review'))).slice(0,3),
  };
}

/** Return only explicit time/deadline phrases; never compute a date from 'Friday'. */
export function getTimeEvidence(email) {
  const inbound = (email?.messages || []).filter(m=>m.role==='external');
  const body = String(inbound.at(-1)?.body || '');
  const patterns = [
    /\b(?:by|before|due(?:\s+on)?|deadline(?:\s+is|\s+on)?)\s+(?:this\s+|next\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|today|\d{1,2}\s+[A-Za-z]+|[A-Za-z]+\s+\d{1,2})(?:\s+(?:at|by)\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)?/i,
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:morning|afternoon|evening|at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i,
    /\b(?:next|this)\s+(?:week|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+(?:morning|afternoon|evening))?/i,
    /\b(?:November|December|January|February|March|April|May|June|July|August|September|October)\s+\d{1,2}(?:[–-]\d{1,2})?/i,
  ];
  const result = patterns.map(p=>body.match(p)?.[0]).filter(Boolean);
  return [...new Set(result)].slice(0,2);
}

function summarize(e) {
  const hint = getTimeEvidence(e);
  return {
    id:e.id, name:e.name, subject:e.subject,
    category:e.group,
    summary: String(e.summary || (e.messages || []).at(-1)?.body || 'Open this conversation to review.').slice(0,230),
    reason: String(e.reason || '').slice(0,200),
    timeHint: hint.join(' · '),
    important:Boolean(e.importance),
    waiting:Boolean(e.waiting),
  };
}

const labels = {
  client: 'Needs Alex', assistant:'For Maya', review:'Needs review', none:'No reply',
};

function buildResult(title, answer, matches, intent, empty) {
  return {
    intent, title, answer:matches.length ? answer : empty,
    total:matches.length, results:ordered(matches).slice(0,MAX_RESULTS).map(summarize),
    source:'Rule-based demo · grounded in your current inbox',
  };
}

const STOP = new Set('a an the is are was were what which who me my our your show find list all emails email messages message conversations conversation about with from for in on of to please i do need needs does can you summarize tell help any recent this that reply replies pending send draft and or related regarding look give important'.split(' '));

function keywords(question) {
  return [...new Set(question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(t => t.length >= 3 && !STOP.has(t)))];
}

export function answerInboxQuestion(question, emails, selectedId = null) {
  const q=String(question || '').trim();
  const pool=(Array.isArray(emails) ? emails : []).filter(active);
  if (!q) return buildResult('Ask your inbox', '', [], 'empty','Try a suggested question or type a search.');
  const lower=q.toLowerCase();
  const selected=pool.find(e=>e.id===selectedId);

  if (/\b(why|explain)\b/.test(lower) && /\b(assign|client|alex|maya|classified|responsib)/.test(lower)) {
    if (selected) return buildResult('Why this responsibility?',
      `${selected.name}'s conversation is assigned to ${labels[selected.group] || 'review'}. ${selected.reason || 'Review the latest message to confirm the owner.'}`,
      [selected], 'why', 'Select a conversation first.');
    return buildResult('Why an email is assigned', '', [], 'why',
      'Open a conversation, then ask “Why was this assigned to the client?” for its explanation.');
  }

  if (/\b(summarize|summary|recap)\b/.test(lower) && /\b(this|current|selected|open)\b/.test(lower)) {
    if (selected) return buildResult('Conversation summary', selected.summary || 'Review the conversation for details.', [selected], 'summary', 'Select a conversation first.');
    return buildResult('Conversation summary', '', [], 'summary', 'Open a conversation first to summarize that thread.');
  }

  if (/\b(draft|prepare|write)\b.*\b(reply|response|email)\b/.test(lower)) {
    if (selected) return buildResult('Review a suggested draft',
      'Open this conversation and review the editable draft under Reply Assistance. No message is sent without approval.', [selected], 'draft', 'Select a conversation first.');
    return buildResult('Reply drafting', '', [], 'draft', 'Open an email first, then use Prepare reply.');
  }

  if (/\b(waiting|awaiting|pending response|no response|hear back)\b/.test(lower)) {
    const matches=pool.filter(e=>e.waiting);
    return buildResult('Waiting for a response',
      `${matches.length} active conversation${matches.length===1?' is':'s are'} marked as waiting. Open a thread to review the last exchange.`, matches,'waiting',
      'No active conversations are currently marked as waiting.');
  }

  if (/\b(deadlines?|due|overdue|time.sensitive|by friday|due date)\b/.test(lower)) {
    const matches=pool.filter(e=>getTimeEvidence(e).some(h=>/\b(by|before|due|deadline)\b/i.test(h)));
    return buildResult('Deadline signals',
      `Found ${matches.length} conversation${matches.length===1?'':'s'} with explicit deadline wording. Dates are shown as written; relative dates are not treated as confirmed calendar events.`,
      matches,'deadlines','No explicit deadline phrases found in active conversations.');
  }

  if (/\b(meeting|meetings|appointment|appointments|schedule|scheduling|calendar|interview)\b/.test(lower)) {
    const matches=pool.filter(e=>e.tags?.includes('Meetings') || /\b(meeting|interview|schedule|reschedule|appointment|calendar|call)\b/.test(textOf(e)));
    return buildResult('Meetings and scheduling',
      `${matches.length} active conversation${matches.length===1?' contains':'s contain'} scheduling requests or meeting references. Time phrases are shown as written, not confirmed bookings.`,
      matches,'meetings','No active scheduling or meeting conversations found.');
  }

  if (/\b(client|alex|approval|approve|signature|decision|sign.off|personally)\b/.test(lower)) {
    const matches=pool.filter(e=>e.group==='client');
    return buildResult('Needs Alex’s attention',
      `${matches.length} active conversation${matches.length===1?' is':'s are'} currently assigned to Alex for personal input. Delegated coordination does not grant Maya approval authority.`,
      matches,'client','Alex currently has no directly assigned conversations.');
  }

  if (/\b(review|uncertain|ambiguous|low confidence)\b/.test(lower)) {
    const matches=pool.filter(e=>e.group==='review');
    return buildResult('Needs manual review',
      `${matches.length} conversation${matches.length===1?' needs':'s need'} a human to decide who should respond.`,
      matches,'review','No active conversations are currently flagged for review.');
  }

  if (/\b(assistant|maya|delegated|delegation)\b/.test(lower)) {
    const delegated=/\b(delegat)/.test(lower);
    const matches=pool.filter(e=>delegated ? e.handoff?.status==='delegated' : e.group==='assistant');
    return buildResult(delegated?'Delegated to Maya':'Assigned to Maya',
      `${matches.length} conversation${matches.length===1?' is':'s are'} ${delegated?'delegated by Alex':'assigned to Maya'} for follow-up or coordination.`,
      matches,delegated?'delegated':'assistant',`No active ${delegated?'delegations':'assistant-assigned requests'} found.`);
  }

  if (/\b(priority|priorities|urgent|important|focus|attention|today|action required)\b/.test(lower)) {
    const matches=pool.filter(e=>e.group!=='none' && (e.importance || e.group==='review'));
    return buildResult('Your priority queue',
      `${matches.length} active conversation${matches.length===1?' needs':'s need'} attention based on the existing importance and responsibility labels. This is a suggested order, not an AI urgency prediction.`,
      matches,'priority','No active important or review-flagged conversations found.');
  }

  if (/\b(unread|not read)\b/.test(lower)) {
    const matches=pool.filter(e=>e.unread);
    return buildResult('Unread conversations',
      `${matches.length} conversation${matches.length===1?' is':'s are'} marked unread.`,matches,'unread','Everything in the active inbox is marked read.');
  }

  if (/\b(no reply|newsletter|informational|notification)\b/.test(lower)) {
    const matches=pool.filter(e=>e.group==='none' && !e.waiting);
    return buildResult('No reply needed',
      `${matches.length} active conversation${matches.length===1?' is':'s are'} classified as informational or needing no response.`,
      matches,'none','No active informational conversations found.');
  }

  if (/\b(summarize|summary|recap)\b/.test(lower)) {
    const s=getInboxSignals(pool);
    return buildResult('Your inbox briefing',
      `${s.active} active threads: ${s.client} for Alex, ${s.assistant} for Maya, ${s.review} needing review and ${s.waiting} marked waiting. Below are the most important threads.`,
      pool.filter(e=>e.group!=='none' && (e.importance || e.group==='review')),'summary','No active conversations to summarize.');
  }

  const terms=keywords(q);
  const matches=terms.length ? pool.filter(e=>terms.every(term=>textOf(e).includes(term))) : [];
  return buildResult('Inbox search results',
    `${matches.length} conversation${matches.length===1?' matches':'s match'} your keywords. Open a result to read its source conversation.`,
    matches,'search','No matching active conversations found. Try a sender, company, subject or shorter keywords.');
}
