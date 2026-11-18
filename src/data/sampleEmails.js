// Entirely fictional demo data. No user mailbox is accessed.
const ago = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const make = ({ id, name, email, subject, text, history, hours, group, summary, reason, importance = false, unread = true, waiting = false, tags = [], confidence = 92 }) => ({
  id, name, email, subject, messages: [
    ...(history ? [{ id: `${id}-h`, role: 'assistant', author: 'Maya (Assistant)', body: history, time: ago(hours + 22) }] : []),
    { id: `${id}-m`, role: 'external', author: name, body: text, time: ago(hours) }
  ],
  group, summary, reason, importance, unread, waiting, tags, confidence,
  archived: false, completed: false, override: false, draft: '',
});

export const sampleEmails = [
  make({ id:'m1', name:'Sophia Chen', email:'sophia@northstar.design', subject:'Confirming the strategy call for Thursday', hours:0.3, group:'assistant', tags:['Meetings'], importance:true,
    text:'Hi Maya, could you help coordinate a 30-minute strategy call with Alex this Thursday afternoon? Our team is available at 2:00 or 4:30 PM. Please send a calendar invite once confirmed. Thanks, Sophia.',
    history:'Hi Sophia, happy to coordinate. Please send the possible times and I will check Alex’s calendar.',
    summary:'Sophia is requesting a 30-minute strategy call on Thursday at either 2:00 or 4:30 PM.', reason:'This is a scheduling request that the assistant can coordinate without a personal decision.', confidence:97 }),
  make({ id:'m2', name:'Daniel Brooks', email:'daniel@meridian.vc', subject:'Approval needed — Q4 investment proposal', hours:1.1, group:'client', importance:true, tags:['Approvals'],
    text:'Hi Alex, attached is the updated Q4 investment proposal. We need your final approval on the allocation and proposed terms before Friday at 5 PM. Could you review and confirm whether you would like to proceed?',
    summary:'Daniel needs Alex to approve the updated Q4 investment allocation and terms before Friday, 5 PM.', reason:'Final investment approval is a financial decision requiring the client’s authority.', confidence:98 }),
  make({ id:'m3', name:'Product Weekly', email:'digest@productweekly.example', subject:'This week in product: 12 things worth reading', hours:2.2, group:'none', unread:false, tags:['Newsletter'],
    text:'Welcome to your weekly product digest. Read about design systems, team rituals, and the latest feature updates. You are receiving this newsletter because you subscribed. Unsubscribe anytime.',
    summary:'Weekly product and design newsletter with no action requested.', reason:'Informational newsletter; no reply is requested.', confidence:99 }),
  make({ id:'m4', name:'Olivia Martinez', email:'olivia@atlaspartners.co', subject:'Partnership terms — your personal input', hours:3.8, group:'client', importance:true, tags:['Partnerships'],
    text:'Alex, following our confidential conversation, we revised the partnership terms. I would value your personal opinion on the equity split and whether you approve the revised direction. Please keep this discussion between us.',
    summary:'Olivia requests confidential feedback and approval on revised partnership terms.', reason:'Confidential partnership terms and equity decisions require the client’s direct input.', confidence:96 }),
  make({ id:'m5', name:'Jordan Reed', email:'jordan@talentbridge.io', subject:'Reschedule the designer interview', hours:5.4, group:'assistant', tags:['Meetings'],
    text:'Hello! The candidate has a conflict with Tuesday’s interview. Can we reschedule it to Wednesday at 11 AM or Thursday at 10 AM? Please let us know what works for the calendar.',
    summary:'Jordan requests moving an interview to Wednesday 11 AM or Thursday 10 AM.', reason:'Routine interview rescheduling is an administrative task for the assistant.', confidence:95 }),
  make({ id:'m6', name:'Ava Thompson', email:'ava@thecovehotel.example', subject:'Reservation confirmation — The Cove Hotel', hours:7.3, group:'none', unread:false, tags:['Travel'],
    text:'Your booking has been confirmed for November 25–27. Reservation number CV-3145. Check-in begins at 3 PM. No action is required. Thank you for choosing The Cove Hotel.',
    summary:'Hotel booking confirmed for November 25–27; no additional action is needed.', reason:'This is a confirmed reservation notification.', confidence:98 }),
  make({ id:'m7', name:'Noah Patel', email:'noah@brightline.studio', subject:'Invoice question for the October project', hours:9.5, group:'assistant', tags:['Finance'],
    text:'Hi Maya, I wanted to follow up on our October invoice. Could you confirm the billing contact and the expected payment date? Happy to resend the PDF if useful.',
    summary:'Noah is following up on billing contact details and payment timing.', reason:'This is a routine administrative invoice follow-up.', confidence:91 }),
  make({ id:'m8', name:'Isabella Green', email:'isabella@legalwise.co', subject:'Contract requires final signature', hours:12.5, group:'client', importance:true, tags:['Approvals'],
    text:'Hi Alex, the consulting agreement is ready for your review. We require your signature and final sign-off before sharing with the external party. Please confirm your decision.',
    summary:'The consulting agreement is ready and requires Alex’s final signature.', reason:'Contract sign-off is a personal legal authorization reserved for the client.', confidence:97 }),
  make({ id:'m9', name:'Ethan Park', email:'ethan@momentumevents.com', subject:'Venue options for next month', hours:16, group:'assistant', tags:['Meetings'], unread:false,
    text:'Hi Maya, attached are three venue options for the company offsite next month. Would you be able to shortlist suitable dates and schedule a quick walkthrough?',
    summary:'Ethan sent three venue options and requests date coordination and a walkthrough.', reason:'Venue logistics and scheduling can be handled by the assistant.', confidence:94 }),
  make({ id:'m10', name:'Grace Wilson', email:'grace@clearwater.vc', subject:'Your decision on next quarter’s strategy', hours:21, group:'client', tags:['Strategy'], importance:true,
    text:'Alex, following our board discussion, could you personally share your decision on the strategic direction for next quarter? We need your perspective before preparing the presentation.',
    summary:'Grace requests Alex’s personal strategic decision for the upcoming board presentation.', reason:'The sender explicitly requests the client’s own strategic judgment.', confidence:96 }),
  make({ id:'m11', name:'System Updates', email:'notice@cloudops.example', subject:'Monthly account activity report', hours:26, group:'none', tags:['Notifications'], unread:false,
    text:'Your monthly activity report is now available. All services are operating normally. This is an automated notification only; no reply needed.',
    summary:'Automated monthly activity notice; services are normal.', reason:'Automated account report with no action request.', confidence:99 }),
  make({ id:'m12', name:'Liam Carter', email:'liam@capturestudio.co', subject:'Following up on the portrait session', hours:30, group:'assistant', tags:['Follow-ups'], waiting:true, unread:false,
    text:'Hi Maya, checking whether next Tuesday at 3 PM still works for Alex’s portrait session. If so, I can hold the studio. Please confirm the schedule.',
    summary:'Liam needs confirmation of next Tuesday’s 3 PM portrait appointment.', reason:'Scheduling confirmation can be handled by the assistant.', confidence:93 }),
  make({ id:'m13', name:'Emma Rivera', email:'emma@orbitresearch.io', subject:'Quick question about the new proposal', hours:34, group:'review', tags:['Needs review'],
    text:'Hi there, we have a quick question about the new proposal. Can you share your thoughts on the approach? Unsure whether the right person is Alex or Maya.',
    summary:'Emma requests feedback on a proposal but does not specify who should make the call.', reason:'The wording is ambiguous: it could be administrative feedback or the client’s decision.', confidence:54 }),
  make({ id:'m14', name:'Oliver Hayes', email:'oliver@archstone.co', subject:'Coffee next week?', hours:39, group:'assistant', tags:['Meetings'], unread:false,
    text:'Hi Maya, could you check Alex’s availability for coffee with the team next week? Monday or Wednesday morning would be great.',
    summary:'Oliver wants to arrange coffee next week, preferably Monday or Wednesday morning.', reason:'Checking the calendar is a standard assistant responsibility.', confidence:95 }),
  make({ id:'m15', name:'Nora Fields', email:'nora@dailybrief.example', subject:'Morning briefing: market overview', hours:44, group:'none', tags:['Newsletter'], unread:false,
    text:'Today’s market briefing covers technology, startup funding, and policy headlines. This is a daily digest delivered to your inbox.',
    summary:'Informational daily briefing with no direct action required.', reason:'Daily news digest; no response requested.', confidence:99 }),
];

export function createIncomingEmail(index) {
  const cases = [
    {name:'Harper West', email:'harper@elevateevents.co', subject:'Can you schedule a team introduction?', text:'Hi Maya, would you help arrange a 20-minute introduction call next week? I can make Monday at 10 AM or Tuesday at 3 PM. Please send a calendar invitation.', tags:['Meetings']},
    {name:'Marcus Lee', email:'marcus@foundation.vc', subject:'Please approve the revised funding terms', text:'Hi Alex, we require your personal approval on the revised funding terms. Please review the final numbers and confirm your decision by Friday.', tags:['Approvals']},
    {name:'Community Bulletin', email:'newsletter@community.example', subject:'Your monthly community newsletter', text:'Here is your monthly newsletter with events and articles. This message is informational, and no reply is needed.', tags:['Newsletter']},
  ];
  const item = cases[index % cases.length];
  return {id:`new-${Date.now()}-${index}`, name:item.name, email:item.email, subject:item.subject,
    messages:[{id:`msg-${Date.now()}-${index}`, role:'external', author:item.name, body:item.text, time:new Date().toISOString()}],
    group:'review', summary:'New message awaiting analysis.', reason:'Not yet analyzed.', importance:false,
    unread:true, waiting:false, tags:item.tags, confidence:0, archived:false, completed:false, override:false, draft:''};
}
