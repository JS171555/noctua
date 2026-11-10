/** Sleep timer: fires `onEnd` after N minutes; exposes the end timestamp. */
export class SleepTimer {
  private handle: ReturnType<typeof setTimeout> | null = null;
  endsAt: number | null = null;

  start(minutes: number, onEnd: () => void) {
    this.cancel();
    this.endsAt = Date.now() + minutes * 60_000;
    this.handle = setTimeout(() => {
      this.handle = null;
      this.endsAt = null;
      onEnd();
    }, minutes * 60_000);
  }

  cancel() {
    if (this.handle) clearTimeout(this.handle);
    this.handle = null;
    this.endsAt = null;
  }
}

export function formatRemaining(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
