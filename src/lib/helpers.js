export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0,2).map(s => s[0]).join('').toUpperCase();
export const timeLabel = iso => {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'Now';
  if (diff < 60) return `${diff}m`;
  if (diff < 24 * 60) return `${Math.floor(diff / 60)}h`;
  if (diff < 48 * 60) return 'Yesterday';
  return d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
};
export const fullDate = iso => new Date(iso).toLocaleString('en-US',{month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'});
export const latestTime = email => email.messages[email.messages.length - 1]?.time || '';
export const lastPreview = email => email.messages[email.messages.length - 1]?.body || '';
export const colorClass = id => `avatar-${[...id].reduce((n,c) => n + c.charCodeAt(0), 0) % 6}`;
