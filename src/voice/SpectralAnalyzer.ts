export class SpectralAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private isAnalyzing: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    this.drawIdleWave();
  }

  public async start(): Promise<boolean> {
    if (this.isAnalyzing) return true;
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      
      // Keep FFT size small for responsive graphic rendering
      this.analyser.fftSize = 128;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.analyser);

      this.isAnalyzing = true;
      this.animate();
      return true;
    } catch (err) {
      console.error('[SpectralAnalyzer] Failed to start audio context:', err);
      this.drawIdleWave();
      return false;
    }
  }

  public stop() {
    this.isAnalyzing = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      this.audioContext = null;
    }

    this.analyser = null;
    this.drawIdleWave();
  }

  private animate = () => {
    if (!this.isAnalyzing) return;
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.renderSpectrogram();
  };

  private drawIdleWave() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    // Draw a flat cyber line
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, height / 2);
    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
  }

  private renderSpectrogram() {
    if (!this.analyser) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDomainArray = new Uint8Array(bufferLength);

    this.analyser.getByteFrequencyData(dataArray);
    this.analyser.getByteTimeDomainData(timeDomainArray);

    this.ctx.clearRect(0, 0, width, height);

    // RENDER 1: Spectral Frequency Bars
    const barWidth = (width / bufferLength) * 0.8;
    let x = 0;

    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = 'rgba(189, 0, 255, 0.6)'; // Neon violet glow

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height * 0.7;

      // HSL gradient: Cyan -> Purple
      const hue = 180 + (i / bufferLength) * 100;
      this.ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.85)`;

      const y = (height - barHeight) / 2;
      
      this.ctx.beginPath();
      if ((this.ctx as any).roundRect) {
        (this.ctx as any).roundRect(x, y, barWidth - 1, barHeight, 3);
      } else {
        this.ctx.rect(x, y, barWidth - 1, barHeight);
      }
      this.ctx.fill();

      x += barWidth + 1;
    }

    // RENDER 2: Overlay Oscilloscope Line
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = '#00f0ff'; // Cyan glow
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let waveX = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeDomainArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        this.ctx.moveTo(waveX, y);
      } else {
        this.ctx.lineTo(waveX, y);
      }

      waveX += sliceWidth;
    }

    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
    
    // Reset shadow settings
    this.ctx.shadowBlur = 0;
  }
}
