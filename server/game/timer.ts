const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function setRoomTimer(
  roomCode: string,
  key: string,
  callback: () => void,
  ms: number
): void {
  const id = `${roomCode}:${key}`;
  clearRoomTimer(roomCode, key);
  timers.set(id, setTimeout(() => {
    try {
      callback();
    } catch (err) {
      console.error(`[timer] error in ${id}:`, err);
    }
  }, ms));
}

export function clearRoomTimer(roomCode: string, key: string): void {
  const id = `${roomCode}:${key}`;
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

export function clearAllRoomTimers(roomCode: string): void {
  for (const [id, t] of timers) {
    if (id.startsWith(`${roomCode}:`)) {
      clearTimeout(t);
      timers.delete(id);
    }
  }
}
