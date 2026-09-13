export async function loadChatAvailability(request = fetch, signal) {
  try {
    const response = await request('/api/chat-session', { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    const result = await response.json();
    if (typeof result?.available !== 'boolean') throw new Error('Unavailable');
    return { available: result.available, publicDemo: result.publicDemo === true,
      message: result.available ? '' : 'Chat is not available on this version yet. You can still explore your forecast.' };
  } catch {
    return { available: false, publicDemo: false, message: 'We couldn’t check chat availability. Try again when your connection is ready.' };
  }
}
