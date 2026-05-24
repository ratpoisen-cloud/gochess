type SoundEvent = 
  | 'move' 
  | 'capture' 
  | 'check' 
  | 'checkmate' 
  | 'promote' 
  | 'gameStart' 
  | 'gameEnd' 
  | 'select' 
  | 'modal';

const BASE = import.meta.env.BASE_URL || '/';
const SOUNDS_PATH = `${BASE}sounds/`;

class SoundManager {
  private sounds: Map<string, HTMLAudioElement[]> = new Map();
  private enabled: boolean = true;

  constructor() {
    this.init();
  }

  private init() {
    this.loadSound('select', ['select.mp3']);
    this.loadSound('modal', ['modal.mp3']);
    this.loadSound('move', ['move-1.mp3', 'move-2.mp3', 'move-3.mp3', 'move-4.mp3']);
    this.loadSound('capture', ['capture-default-1.mp3', 'capture-default-2.mp3']);
    this.loadSound('check', ['check-1.mp3', 'check-2.mp3', 'check-3.mp3']);
    this.loadSound('checkmate', ['checkmate-1.mp3']);
    this.loadSound('promote', ['promotion-1.mp3', 'promotion-2.mp3']);
  }

  private loadSound(event: SoundEvent, files: string[]) {
    const audioElements = files.map(file => {
      const audio = new Audio(`${SOUNDS_PATH}${file}`);
      audio.preload = 'auto';
      return audio;
    });
    this.sounds.set(event, audioElements);
  }

  public play(event: SoundEvent) {
    if (!this.enabled) return;
    
    const variants = this.sounds.get(event);
    if (!variants || variants.length === 0) return;

    const sound = variants[Math.floor(Math.random() * variants.length)];
    sound.currentTime = 0;
    sound.play().catch(e => console.warn(`[SoundManager] Could not play sound ${event}:`, e));
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const soundManager = new SoundManager();
