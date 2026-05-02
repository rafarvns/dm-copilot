const listeners = new Map();

export const EventBus = {
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
  },

  off(event, handler) {
    listeners.get(event)?.delete(handler);
  },

  emit(event, data) {
    listeners.get(event)?.forEach((handler) => handler(data));
  },
};
