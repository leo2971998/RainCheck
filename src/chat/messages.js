// ElevenLabs sends streamed parts followed by a complete message with the same event ID.
// Replace that message in place so a response never appears twice.
export function receiveMessage(messages, { event_id, text = '', type = 'complete' }) {
  const id = `agent-${event_id ?? 'greeting'}`;
  const found = messages.find(m => m.id === id);
  if (!text && !found) return messages;
  if (!text && type === 'complete') return messages;
  const message = { id, role: 'assistant', text: type === 'complete' ? text : (found?.text || '') + text, streaming: type !== 'complete' && type !== 'stop' };
  return found ? messages.map(m => m.id === id ? message : m) : [...messages, message];
}
