import { SpeechTransducer } from '../voice/Transducer';
import { SpectralAnalyzer } from '../voice/SpectralAnalyzer';
import { CommandParser } from '../voice/CommandParser';
import type { VoiceCommand } from '../voice/CommandParser';

export class VoiceDashboard {
  private transducer: SpeechTransducer;
  private analyzer: SpectralAnalyzer | null = null;
  private parser: CommandParser;

  private container: HTMLElement;
  private micButton!: HTMLButtonElement;
  private stopButton!: HTMLButtonElement;
  private statusText!: HTMLElement;
  private transcriptText!: HTMLElement;
  private logList!: HTMLElement;
  private commandGridCells: { [key in VoiceCommand]?: HTMLElement } = {};

  constructor(parent: HTMLElement) {
    this.container = parent;
    this.transducer = new SpeechTransducer();
    this.parser = new CommandParser();
    this.buildUI();
    this.initEvents();
  }

  private buildUI() {
    this.container.innerHTML = `
      <div class="vib-dashboard">
        <header class="vib-header">
          <div class="header-glitch">VI-B // COGNITIVE VOCAL TRANSDUCER</div>
          <div class="system-status status-danger" id="system-status">STATUS: STANDBY (OFFLINE)</div>
        </header>

        <div class="dashboard-grid">
          <!-- Left Panel: Control and Visuals -->
          <div class="panel control-panel">
            <div class="panel-header">
              <h3 class="panel-title">ACOUSTIC SPECTROMETER</h3>
              <span class="panel-decor">// FX-300</span>
            </div>
            <div class="visualizer-container">
              <canvas id="spec-canvas" width="400" height="150"></canvas>
            </div>
            
            <div class="controls-row">
              <button id="btn-activate" class="vib-btn primary">ACTIVATE TRANSDUCER</button>
              <button id="btn-terminate" class="vib-btn secondary" disabled>TERMINATE</button>
            </div>

            <div class="transcript-monitor">
              <div class="monitor-label">REAL-TIME PHONETIC FEED:</div>
              <div id="transcript-feed" class="transcript-box">... waiting for transducer activation ...</div>
            </div>
          </div>

          <!-- Right Panel: Command Mappings and Grid -->
          <div class="panel mappings-panel">
            <div class="panel-header">
              <h3 class="panel-title">COMPUTATIONAL INVOCATION GRID</h3>
              <span class="panel-decor">// INTENT MAPS</span>
            </div>
            <div class="command-grid" id="command-grid"></div>
          </div>
        </div>

        <!-- Bottom Panel: Execution Log -->
        <div class="panel log-panel">
          <div class="panel-header">
            <h3 class="panel-title">REAL-TIME INVOCATION TRANSACTION LOG</h3>
            <span class="panel-decor">// TRANSACTION STREAM</span>
          </div>
          <div class="log-container">
            <ul id="transaction-log" class="transaction-list">
              <li class="log-placeholder">System calibrated. awaiting vocal transducer inputs...</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    // Instantiate SpectralAnalyzer
    const canvas = this.container.querySelector('#spec-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.analyzer = new SpectralAnalyzer(canvas);
    }

    // Bind elements
    this.micButton = this.container.querySelector('#btn-activate') as HTMLButtonElement;
    this.stopButton = this.container.querySelector('#btn-terminate') as HTMLButtonElement;
    this.statusText = this.container.querySelector('#system-status') as HTMLElement;
    this.transcriptText = this.container.querySelector('#transcript-feed') as HTMLElement;
    this.logList = this.container.querySelector('#transaction-log') as HTMLElement;

    // Build the command cells in the grid
    const grid = this.container.querySelector('#command-grid') as HTMLElement;
    const commands: VoiceCommand[] = [
      'start', 'pause', 'resume',
      'left', 'right', 'jump',
      'attack', 'defend', 'fire', 'special'
    ];

    commands.forEach(cmd => {
      const synonyms = this.parser.getSynonymList(cmd);
      const cell = document.createElement('div');
      cell.className = 'command-cell';
      cell.id = `cmd-${cmd}`;
      cell.innerHTML = `
        <div class="cmd-name">${cmd.toUpperCase()}</div>
        <div class="cmd-keywords">${synonyms.slice(0, 3).join(', ')}</div>
        <div class="cmd-pulse-indicator"></div>
      `;
      grid.appendChild(cell);
      this.commandGridCells[cmd] = cell;
    });
  }

  private initEvents() {
    this.micButton.addEventListener('click', async () => {
      this.updateStatus('PROMPTING MICROPHONE ACCESS...', 'warning');
      const granted = await this.transducer.requestPermission();
      if (granted) {
        this.transducer.start();
        if (this.analyzer) {
          await this.analyzer.start();
        }
      }
    });

    this.stopButton.addEventListener('click', () => {
      this.transducer.stop();
      if (this.analyzer) {
        this.analyzer.stop();
      }
    });

    this.transducer.addEventListener('listeningChange', (listening) => {
      if (listening) {
        this.updateStatus('TRANSDUCER ONLINE // LISTENING', 'success');
        this.micButton.disabled = true;
        this.stopButton.disabled = false;
        this.transcriptText.innerText = '[Acoustic capture active. Speak a command...]';
        this.transcriptText.classList.add('listening');
      } else {
        this.updateStatus('TRANSDUCER OFFLINE', 'danger');
        this.micButton.disabled = false;
        this.stopButton.disabled = true;
        this.transcriptText.innerText = '[Transducer offline]';
        this.transcriptText.classList.remove('listening');
      }
    });

    this.transducer.addEventListener('transcript', (text, isFinal) => {
      this.transcriptText.innerText = text;
      
      if (isFinal) {
        this.transcriptText.classList.remove('interim');
        this.processAcousticSpeech(text);
      } else {
        this.transcriptText.classList.add('interim');
      }
    });

    this.transducer.addEventListener('error', (err) => {
      this.updateStatus(`ERROR: ${err.toUpperCase()}`, 'danger');
      this.addLogEntry(`[SYSTEM ERROR]: ${err}`, null, 0, 'danger');
    });

    this.transducer.addEventListener('permissionGranted', (granted) => {
      if (!granted) {
        this.updateStatus('MIC PERMISSION DENIED', 'danger');
      }
    });
  }

  private processAcousticSpeech(text: string) {
    const result = this.parser.parse(text);

    if (result.command) {
      // Trigger grid feedback
      this.triggerCommandPulse(result.command, true);

      // Add to log list
      this.addLogEntry(
        `TRANSDUCED: "${result.rawText}"`,
        result.command.toUpperCase(),
        result.confidence,
        'success'
      );
    } else {
      // Unmapped speech
      this.addLogEntry(
        `UNMAPPED SPEECH PATTERN: "${result.rawText}"`,
        'NONE / UNRESOLVED',
        result.confidence,
        'warning'
      );

      // Flash feedback on transcript screen
      this.transcriptText.classList.add('flash-warning');
      setTimeout(() => this.transcriptText.classList.remove('flash-warning'), 500);
    }
  }

  private triggerCommandPulse(cmd: VoiceCommand, success: boolean) {
    const cell = this.commandGridCells[cmd];
    if (cell) {
      const pulseClass = success ? 'pulse-success' : 'pulse-fail';
      cell.classList.add(pulseClass);
      setTimeout(() => cell.classList.remove(pulseClass), 800);
    }
  }

  private updateStatus(text: string, type: 'success' | 'warning' | 'danger') {
    this.statusText.innerText = `STATUS: ${text}`;
    this.statusText.className = `system-status status-${type}`;
  }

  private addLogEntry(message: string, command: string | null, confidence: number, type: 'success' | 'warning' | 'danger' | 'info' = 'info') {
    // Clear placeholder
    const placeholder = this.logList.querySelector('.log-placeholder');
    if (placeholder) {
      this.logList.removeChild(placeholder);
    }

    const li = document.createElement('li');
    li.className = `log-entry entry-${type}`;

    const timestamp = new Date().toLocaleTimeString();

    let details = '';
    if (command) {
      details = ` <span class="log-cmd">// INVOKED: <strong>${command}</strong> (Conf: ${Math.round(confidence * 100)}%)</span>`;
    }

    li.innerHTML = `
      <span class="log-time">[${timestamp}]</span>
      <span class="log-msg">${message}</span>
      ${details}
    `;

    this.logList.insertBefore(li, this.logList.firstChild);

    // Keep log limited to 30 items
    while (this.logList.children.length > 30) {
      this.logList.removeChild(this.logList.lastChild!);
    }
  }
}
export default VoiceDashboard;
