/** Grounded action radar for fictional email conversations.
 * Detects wording and existing ownership labels. Does NOT infer an absolute date
 * from a relative phrase, create events, or claim a reminder was scheduled.
 */
import { getTimeEvidence } from './inboxCopilot.js';
import { latestTime } from './helpers.js';

const active = e => Boolean(e && !e.archived && !e.completed);
const scheduling = e => (e.tags || []).includes('Meetings') ||
  /\b(schedule|reschedule|meeting|appointment|interview|calendar|walkthrough|strategy call)\b/i.test(
    [e.subject,...(e.messages||[]).filter(m=>m.role==='external').map(m=>m.body)].join(' '));
const deadline = e => getTimeEvidence(e).find(t=>/\b(by|before|due|deadline)\b/i.test(t));

export function getFollowUpSignals(emails) {
  const pool=(Array.isArray(emails)?emails:[]).filter(active);
  const counts={total:0,waiting:0,decisions:0,meetings:0,deadlines:0,review:0};
  const items=pool.flatMap(email=>{
    const due=deadline(email);
    const meeting=scheduling(email);
    const decision=email.group==='client';
    const waiting=Boolean(email.waiting);
    const review=email.group==='review';
    if(due)counts.deadlines++;
    if(meeting)counts.meetings++;
    if(decision)counts.decisions++;
    if(waiting)counts.waiting++;
    if(review)counts.review++;
    if(!(due||meeting||decision||waiting||review))return [];
    let kind,label,detail,priority;
    if(due){kind='deadline';label='Deadline mentioned';detail=`In the email: “${due}”`;priority=8;}
    else if(decision){kind='decision';label='Client approval';detail='Alex needs to make a personal decision';priority=7;}
    else if(review){kind='review';label='Check responsibility';detail='The reply owner needs human review';priority=6;}
    else if(waiting){kind='waiting';label='Awaiting a response';detail='Check whether a follow-up is appropriate';priority=4;}
    else {kind='meeting';label='Scheduling request';detail=getTimeEvidence(email).join(' · ')||'Check available times in this email';priority=3;}
    return [{id:email.id,kind,label,detail,priority,subject:email.subject,
      sender:email.name,unread:Boolean(email.unread),time:latestTime(email)}];
  });
  items.sort((a,b)=>b.priority-a.priority||Number(b.unread)-Number(a.unread)||
    (Date.parse(b.time)||0)-(Date.parse(a.time)||0));
  counts.total=items.length;
  return {counts,items};
}

export const isFollowUpConversation=email=>getFollowUpSignals([email]).items.length>0;
