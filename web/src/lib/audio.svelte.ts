type Accent = 'us' | 'uk';

class AudioPlayer {
  playing = $state<{ id: string; accent: Accent } | null>(null);
  private audio: HTMLAudioElement | null = null;

  play(id: string, accent: Accent, url: string | null) {
    if (!url) return;

    this.audio?.pause();
    if (this.playing?.id === id && this.playing?.accent === accent) {
      this.playing = null;
      this.audio = null;
      return;
    }

    const a = new Audio(url);
    this.audio = a;
    this.playing = { id, accent };
    a.play().catch(() => (this.playing = null));
    a.onended = () => {
      this.playing = null;
      this.audio = null;
    };
  }

  stop() {
    this.audio?.pause();
    this.playing = null;
    this.audio = null;
  }

  isPlaying(id: string, accent: Accent) {
    return this.playing?.id === id && this.playing?.accent === accent;
  }
}

export const player = new AudioPlayer();
