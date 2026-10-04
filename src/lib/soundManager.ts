type SoundEvent =
  | 'move'
  | 'capture'
  | 'check'
  | 'checkmate'
  | 'promote'
  | 'gameStart'
  | 'gameEnd'
  | 'select'
  | 'blast'
  | 'modal';

const BASE = import.meta.env.BASE_URL || '/';
const SOUNDS_PATH = `${BASE}sounds/`;
const PREFS_KEY = 'gochess-sound-settings';

class SoundManager {
  private sounds: Map<string, HTMLAudioElement[]> = new Map();
  private enabled: boolean = true;
  private volume: number = 1;
  private unlocked: boolean = false;

  constructor() {
    this.loadPreferences();
    this.init();
    this.unlockOnInteraction();
  }

  private loadPreferences() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const state = JSON.parse(raw)?.state;
      if (!state) return;
      if (typeof state.enabled === 'boolean') this.enabled = state.enabled;
      if (typeof state.volume === 'number') {
        this.volume = Math.min(1, Math.max(0, state.volume / 100));
      }
    } catch {}
  }

  private unlockOnInteraction() {
    const unlock = () => {
      if (this.unlocked) return;
      // Play a silent sound to unlock iOS AudioContext
      const silent = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      silent.play().then(() => { this.unlocked = true; }).catch(() => {});
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
  }

  private init() {
    this.loadSound('select', ['select.mp3']);
    this.loadSound('modal', ['modal.mp3']);
    this.loadSound('move', ['move-1.mp3', 'move-2.mp3', 'move-3.mp3', 'move-4.mp3']);
    this.loadSound('capture', ['capture-default-1.mp3', 'capture-default-2.mp3']);
    this.loadSound('check', ['check-1.mp3', 'check-2.mp3', 'check-3.mp3']);
    this.loadSound('checkmate', ['checkmate-1.mp3']);
    this.loadSound('promote', ['promotion-1.mp3', 'promotion-2.mp3']);
    this.loadSound('blast', ['hegrenade-1.wav']);
  }

  private loadSound(event: SoundEvent, files: string[]) {
    const audioElements = files.map(file => {
      const audio = new Audio(`${SOUNDS_PATH}${file}`);
      audio.preload = 'auto';
      audio.volume = this.volume;
      return audio;
    });
    this.sounds.set(event, audioElements);
  }

  public play(event: SoundEvent) {
    if (!this.enabled || this.volume <= 0) return;

    const variants = this.sounds.get(event);
    if (!variants || variants.length === 0) return;

    const sound = variants[Math.floor(Math.random() * variants.length)];
    sound.currentTime = 0;
    sound.play().catch(e => console.warn(`[SoundManager] Could not play sound ${event}:`, e));
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stopAll();
  }

  public setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.sounds.forEach(variants => {
      variants.forEach(audio => { audio.volume = this.volume; });
    });
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getVolume(): number {
    return this.volume;
  }

  private stopAll() {
    this.sounds.forEach(variants => {
      variants.forEach(audio => {
        if (audio.paused) return;
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {}
      });
    });
  }
}

export const soundManager = new SoundManager();
