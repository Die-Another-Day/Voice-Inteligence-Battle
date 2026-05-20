export interface TransducerEventMap {
  transcript: (text: string, isFinal: boolean, resultIndex: number) => void;
  error: (error: string) => void;
  listeningChange: (listening: boolean) => void;
  permissionGranted: (granted: boolean) => void;
}

export class SpeechTransducer {
  private recognition: any = null;
  private isListeningActive: boolean = false;
  private listeners: { [key in keyof TransducerEventMap]?: Function[] } = {};

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.emit('error', 'Web Speech API is not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.emit('listeningChange', true);
    };

    this.recognition.onend = () => {
      this.emit('listeningChange', false);
      // Auto-restart if active listening was intended
      if (this.isListeningActive) {
        try {
          this.recognition.start();
        } catch (e) {
          console.warn('[Transducer] Auto-restart failed, retrying...', e);
          setTimeout(() => {
            if (this.isListeningActive) {
              try {
                this.recognition.start();
              } catch (err) {
                console.error('[Transducer] Retry start failed:', err);
              }
            }
          }, 1000);
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('[Transducer] Speech recognition error:', event.error);
      this.emit('error', `Acoustic Error: ${event.error}`);
      if (event.error === 'not-allowed') {
        this.isListeningActive = false;
        this.emit('permissionGranted', false);
      }
    };

    this.recognition.onresult = (event: any) => {
      const resultIndex = event.resultIndex;
      const latestResult = event.results[resultIndex];
      if (!latestResult) return;

      const text = latestResult[0].transcript.trim();
      const isFinal = latestResult.isFinal;

      if (text) {
        this.emit('transcript', text, isFinal, resultIndex);
      }
    };
  }

  public async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop streams immediately as we only want to query permission
      stream.getTracks().forEach(track => track.stop());
      this.emit('permissionGranted', true);
      return true;
    } catch (err) {
      console.error('[Transducer] Microphone permission denied:', err);
      this.emit('error', 'Acoustic permission denied by system.');
      this.emit('permissionGranted', false);
      return false;
    }
  }

  public start() {
    if (!this.recognition) {
      this.emit('error', 'Speech recognition not initialized.');
      return;
    }
    if (this.isListeningActive) return;
    this.isListeningActive = true;
    try {
      this.recognition.start();
    } catch (e) {
      console.error('[Transducer] Failed to start recognition:', e);
      this.emit('error', 'Failed to start acoustic transducer.');
    }
  }

  public stop() {
    this.isListeningActive = false;
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch (e) {
      console.error('[Transducer] Failed to stop recognition:', e);
    }
  }

  public getIsListening(): boolean {
    return this.isListeningActive;
  }

  public addEventListener<K extends keyof TransducerEventMap>(event: K, callback: TransducerEventMap[K]) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(callback);
  }

  private emit<K extends keyof TransducerEventMap>(event: K, ...args: Parameters<TransducerEventMap[K]>) {
    const list = this.listeners[event];
    if (list) {
      list.forEach(cb => cb(...args));
    }
  }
}
