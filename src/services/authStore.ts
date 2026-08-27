type AuthListener = () => void;

class AuthStore {
  private isAdminMode: boolean = false;
  private listeners: Set<AuthListener> = new Set();

  // Timestamp buffer for triple-click / triple-touch detection
  private clickTimestamps: number[] = [];
  private readonly TRIPLE_CLICK_WINDOW_MS = 800; // 3 clicks/touches within 800ms

  public get isAdmin(): boolean {
    return this.isAdminMode;
  }

  public get ready(): boolean {
    return true;
  }

  public setAdminMode(enabled: boolean): void {
    if (this.isAdminMode !== enabled) {
      this.isAdminMode = enabled;
      this.notify();
    }
  }

  public enableAdminMode(): boolean {
    if (!this.isAdminMode) {
      this.isAdminMode = true;
      this.notify();
      return true;
    }
    return false;
  }

  public disableAdminMode(): void {
    if (this.isAdminMode) {
      this.isAdminMode = false;
      this.notify();
    }
  }

  /**
   * Called when "독립서점" text or brand area is clicked/tapped.
   * Returns true if the 3rd rapid click just activated admin mode.
   */
  public handleTripleClickTrigger(): boolean {
    const now = Date.now();
    // Keep only timestamps within the window
    this.clickTimestamps = this.clickTimestamps.filter((t) => now - t <= this.TRIPLE_CLICK_WINDOW_MS);
    this.clickTimestamps.push(now);

    if (this.clickTimestamps.length >= 3) {
      this.clickTimestamps = []; // Reset after trigger
      this.isAdminMode = true;
      this.notify();
      return true;
    }
    return false;
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Auth listener error:', e);
      }
    });
  }
}

export const authStore = new AuthStore();
