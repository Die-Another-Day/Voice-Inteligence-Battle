import { SpeechTransducer } from '../voice/Transducer';
import { SpectralAnalyzer } from '../voice/SpectralAnalyzer';
import { CommandParser } from '../voice/CommandParser';
import type { VoiceCommand } from '../voice/CommandParser';
import { GameEngine } from '../game/GameEngine';

export class Dashboard {
  private transducer: SpeechTransducer;
  private analyzer: SpectralAnalyzer | null = null;
  private parser: CommandParser;
  private game: GameEngine | null = null;

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
          <div class="header-glitch">VI-B // NEURAL COMBAT SIMULATOR</div>
          <div class="system-status status-danger" id="system-status">STATUS: STANDBY (OFFLINE)</div>
        </header>

        <div class="dashboard-grid">
          <!-- Column 1: Voice Transduction & Spectrometer -->
          <div class="panel control-panel">
            <div class="panel-header">
              <h3 class="panel-title">ACOUSTIC PHONETIC TRANSDUCER</h3>
              <span class="panel-decor">// SEC-1A</span>
            </div>
            
            <div class="visualizer-container">
              <canvas id="spec-canvas" width="300" height="110"></canvas>
            </div>
            
            <div class="controls-row">
              <button id="btn-activate" class="vib-btn primary">ACTIVATE TRANSDUCER</button>
              <button id="btn-terminate" class="vib-btn secondary" disabled>TERMINATE</button>
            </div>

            <div class="transcript-monitor">
              <div class="monitor-label">REAL-TIME PHONETIC FEED:</div>
              <div id="transcript-feed" class="transcript-box">... waiting for operator activation ...</div>
            </div>

            <div class="log-panel-inline">
              <div class="monitor-label">TRANSDUCTION LOG:</div>
              <div class="log-container-inline">
                <ul id="transaction-log" class="transaction-list">
                  <li class="log-placeholder">Log awaiting vocal inputs...</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Column 2: 2D Battle Arena Simulator -->
          <div class="panel game-panel">
            <div class="panel-header">
              <h3 class="panel-title">TACTICAL combat arena</h3>
              <span class="panel-decor">// 60 FPS HOLOGRAPHIC RENDERING</span>
            </div>
            <div class="game-canvas-container">
              <canvas id="game-canvas" width="800" height="400"></canvas>
            </div>
            <div class="game-controls-help">
              <span><strong>KEYBOARD CONTROL FALLBACK:</strong> [A,D / ArrowKeys] Move | [W / ArrowUp] Jump | [S / ArrowDown] Shield | [Space] Melee | [F] Fire | [E / Shift] Overdrive</span>
            </div>
          </div>

          <!-- Column 3: Intent Glossary & Lexicon -->
          <div class="panel mappings-panel">
            <div class="panel-header">
              <h3 class="panel-title">COMPUTATIONAL INVOCATION GRID</h3>
              <span class="panel-decor">// NEURAL MAPS</span>
            </div>
            <div class="command-grid" id="command-grid"></div>
            
            <div class="glossary-section">
              <div class="monitor-label">VOCAL INVOCATION GLOSSARY:</div>
              <div class="glossary-list">
                <div class="glossary-item"><strong>START/RESUME:</strong> begins/resumes battlefield execution</div>
                <div class="glossary-item"><strong>PAUSE:</strong> halts computation instantly</div>
                <div class="glossary-item"><strong>LEFT/RIGHT:</strong> shifts character positions in vector space</div>
                <div class="glossary-item"><strong>JUMP:</strong> triggers vertical vector impulse</div>
                <div class="glossary-item"><strong>ATTACK/FIRE:</strong> engages weapon configurations</div>
                <div class="glossary-item"><strong>DEFEND:</strong> deploys holographic spherical shield</div>
                <div class="glossary-item"><strong>SPECIAL:</strong> activates overdrive overdrive mode</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Instantiate SpectralAnalyzer
    const specCanvas = this.container.querySelector('#spec-canvas') as HTMLCanvasElement;
    if (specCanvas) {
      this.analyzer = new SpectralAnalyzer(specCanvas);
    }

    // Bind elements
    this.micButton = this.container.querySelector('#btn-activate') as HTMLButtonElement;
    this.stopButton = this.container.querySelector('#btn-terminate') as HTMLButtonElement;
    this.statusText = this.container.querySelector('#system-status') as HTMLElement;
    this.transcriptText = this.container.querySelector('#transcript-feed') as HTMLElement;
    this.logList = this.container.querySelector('#transaction-log') as HTMLElement;

    // Build command grid
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

    // Initialize Game Engine
    const gameCanvas = this.container.querySelector('#game-canvas') as HTMLCanvasElement;
    if (gameCanvas) {
      this.game = new GameEngine(gameCanvas, (msg, type) => {
        this.addLogEntry(msg, null, 0, type);
      });
      this.game.start();
    }
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
        this.transcriptText.innerText = '[System listening for command feed...]';
        this.transcriptText.classList.add('listening');
      } else {
        this.updateStatus('TRANSDUCER OFFLINE', 'danger');
        this.micButton.disabled = false;
        this.stopButton.disabled = true;
        this.transcriptText.innerText = '[Transducer offline]';
        this.transcriptText.classList.remove('listening');
      }
    });

    this.transducer.addEventListener('transcript', (text, isFinal, resultIndex) => {
      this.transcriptText.innerText = text;
      
      if (isFinal) {
        this.transcriptText.classList.remove('interim');
      } else {
        this.transcriptText.classList.add('interim');
      }
      this.processAcousticSpeech(text, isFinal, resultIndex);
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

  private commandCooldowns: { [key in VoiceCommand]?: number } = {};
  private lastTriggeredIndex: number = -1;
  private lastTriggeredCommand: string = '';

  private processAcousticSpeech(text: string, isFinal: boolean, resultIndex: number) {
    const result = this.parser.parse(text);

    if (result.command) {
      // Prevent double-triggering the same command in the same speech segment
      if (resultIndex === this.lastTriggeredIndex && result.command === this.lastTriggeredCommand) {
        return;
      }

      const now = Date.now();
      const lastTrigger = this.commandCooldowns[result.command] || 0;
      
      // Cooldown of 600ms per command to prevent rapid double-firing
      if (now - lastTrigger > 600) {
        this.commandCooldowns[result.command] = now;
        this.lastTriggeredIndex = resultIndex;
        this.lastTriggeredCommand = result.command;

        // 1. Flash command UI cell
        this.triggerCommandPulse(result.command, true);

        // 2. Feed voice action to Game Engine
        if (this.game) {
          this.game.triggerVoiceAction(result.command);
        }

        // 3. Add to UI log
        this.addLogEntry(
          `TRANSDUCED: "${result.rawText}"`,
          result.command.toUpperCase(),
          result.confidence,
          'success'
        );
      }
    } else if (isFinal) {
      // Log unmapped speech only on final transcripts to keep logs clean
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
export default Dashboard;
