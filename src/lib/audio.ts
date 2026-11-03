export interface AudioRecorderOptions {
  maxDurationMs?: number;
  onLevelChange?: (level: number) => void; // 0 to 1
  onTimeout?: () => void;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private mimeType: string = '';
  private timeoutId: NodeJS.Timeout | null = null;

  public static getSupportedMimeType(): string {
    if (typeof window === 'undefined' || !window.MediaRecorder) {
      return '';
    }

    const candidateTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=opus',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ];

    for (const type of candidateTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return '';
  }

  public async start(options: AudioRecorderOptions = {}): Promise<void> {
    const { maxDurationMs = 300000, onLevelChange, onTimeout } = options;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission was denied. Please allow microphone access in your browser settings.');
      }
      if (err.name === 'NotFoundError') {
        throw new Error('No microphone device found on your system.');
      }
      throw new Error(`Microphone access error: ${err.message || err.name}`);
    }

    this.mimeType = VoiceRecorder.getSupportedMimeType();
    const recorderOptions = this.mimeType ? { mimeType: this.mimeType } : undefined;
    this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    // Set up audio analyser for level meter
    if (onLevelChange) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1, avg / 128); // 0.0 to 1.0
          onLevelChange(normalized);
          this.animFrameId = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (e) {
        console.warn('AudioContext level meter setup failed:', e);
      }
    }

    this.mediaRecorder.start(250); // Slice data every 250ms

    if (maxDurationMs > 0) {
      this.timeoutId = setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          if (onTimeout) onTimeout();
          this.stop();
        }
      }, maxDurationMs);
    }
  }

  public async stop(): Promise<Blob> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {
        console.warn(e);
      }
      this.audioContext = null;
      this.analyser = null;
    }

    return new Promise<Blob>((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('MediaRecorder is not initialized'));
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' });
        this.cleanupStream();
        resolve(blob);
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else {
        const blob = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' });
        this.cleanupStream();
        resolve(blob);
      }
    });
  }

  public cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.chunks = [];
    this.cleanupStream();
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}

/**
 * Controller for managing TTS audio playback with instant cancel/stop support.
 */
export class AudioPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private isStopped: boolean = false;

  public async playBase64Chunks(chunks: string[]): Promise<boolean> {
    this.stop();
    this.isStopped = false;

    for (const chunk of chunks) {
      if (this.isStopped) return false;

      const audio = new Audio(`data:audio/wav;base64,${chunk}`);
      this.currentAudio = audio;

      const finished = await new Promise<boolean>((resolve) => {
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);
        audio.play().catch(() => resolve(false));
      });

      this.currentAudio = null;
      if (!finished || this.isStopped) return false;
    }

    return !this.isStopped;
  }

  public stop(): void {
    this.isStopped = true;
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }
  }

  public isPlaying(): boolean {
    return !this.isStopped && this.currentAudio !== null;
  }
}

export const globalAudioPlayer = new AudioPlayer();

