import { Character } from './Character';
import type { Projectile } from './Character';
import type { VoiceCommand } from '../voice/CommandParser';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  public player: Character;
  public ai: Character;
  public projectiles: Projectile[] = [];
  
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isGameOver: boolean = false;
  private winner: 'player1' | 'player2' | null = null;
  
  private groundY: number = 340;
  private animationFrameId: number | null = null;

  // Keyboard state
  private keys: { [key: string]: boolean } = {};

  // Voice movement helper timers (to turn momentary voice events into smooth movements)
  private voiceMoveTimer: number = 0;
  private voiceMoveDir: 'left' | 'right' | null = null;
  private voiceBlockTimer: number = 0;

  // Callback to log occurrences back to UI
  private onGameLog: (msg: string, type: 'info' | 'success' | 'warning' | 'danger') => void;

  constructor(canvas: HTMLCanvasElement, onGameLog: (msg: string, type: 'info' | 'success' | 'warning' | 'danger') => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get Canvas 2D Context');
    this.ctx = context;
    this.onGameLog = onGameLog;

    // Initialize fighters
    this.player = new Character(150, 100, 'player1', true);
    this.ai = new Character(600, 100, 'player2', false);

    this.initKeyboardListeners();
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.isGameOver = false;
    this.winner = null;
    
    // Reset characters
    this.player = new Character(150, 100, 'player1', true);
    this.ai = new Character(600, 100, 'player2', false);
    this.projectiles = [];
    this.voiceMoveTimer = 0;
    this.voiceBlockTimer = 0;

    this.onGameLog('MATCH INITIATED. NEURAL INTERFACE ONLINE.', 'info');
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public setPause(paused: boolean) {
    if (!this.isRunning || this.isGameOver) return;
    this.isPaused = paused;
    if (paused) {
      this.onGameLog('SYSTEM INVOCATION PAUSED.', 'warning');
    } else {
      this.onGameLog('SYSTEM INVOCATION RESUMED.', 'success');
    }
  }

  public triggerVoiceAction(command: VoiceCommand) {
    if (this.isGameOver) {
      if (command === 'start') {
        this.start();
      }
      return;
    }

    if (!this.isRunning) {
      if (command === 'start') {
        this.start();
      }
      return;
    }

    if (command === 'pause') {
      this.setPause(true);
      return;
    } else if (command === 'resume') {
      this.setPause(false);
      return;
    }

    if (this.isPaused) return;

    switch (command) {
      case 'left':
        this.voiceMoveDir = 'left';
        this.voiceMoveTimer = 25; // Move left for 25 frames (~400ms)
        this.onGameLog('VOICE: COMMAND "LEFT" - INITIATING IMPULSE', 'info');
        break;
      case 'right':
        this.voiceMoveDir = 'right';
        this.voiceMoveTimer = 25; // Move right for 25 frames
        this.onGameLog('VOICE: COMMAND "RIGHT" - INITIATING IMPULSE', 'info');
        break;
      case 'jump':
        this.player.jump();
        this.onGameLog('VOICE: COMMAND "JUMP" - THRUST ACTIVATED', 'info');
        break;
      case 'attack':
        if (this.player.attack()) {
          this.onGameLog('VOICE: COMMAND "ATTACK" - SLASH TRACE', 'success');
        }
        break;
      case 'fire':
        const proj = this.player.createProjectile();
        if (proj) {
          this.projectiles.push(proj);
          this.onGameLog('VOICE: COMMAND "FIRE" - PHONETIC BURST', 'success');
        }
        break;
      case 'defend':
        this.voiceBlockTimer = 35; // Block for 35 frames (~600ms)
        this.player.block(true);
        this.onGameLog('VOICE: COMMAND "DEFEND" - SHIELD DEPLOYED', 'info');
        break;
      case 'special':
        if (this.player.triggerSpecial()) {
          this.onGameLog('VOICE: COMMAND "SPECIAL" - OVERDRIVE ENABLED!', 'warning');
        } else {
          this.onGameLog('VOICE: "SPECIAL" FAIL - INSUFFICIENT ENERGY', 'danger');
        }
        break;
    }
  }

  private initKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      
      // Momentary triggers (prevents rapid firing on hold)
      if (this.isRunning && !this.isPaused && !this.isGameOver) {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
          this.player.jump();
        }
        if (e.code === 'Space') {
          if (this.player.attack()) {
            this.onGameLog('KEYBOARD: MELEE STRIKE', 'info');
          }
        }
        if (e.code === 'KeyF' || e.code === 'KeyQ') {
          const proj = this.player.createProjectile();
          if (proj) {
            this.projectiles.push(proj);
            this.onGameLog('KEYBOARD: LASER DISCHARGE', 'info');
          }
        }
        if (e.code === 'ShiftLeft' || e.code === 'KeyE') {
          if (this.player.triggerSpecial()) {
            this.onGameLog('KEYBOARD: OVERDRIVE SYSTEM ENGAGED', 'warning');
          }
        }
      }
      
      // Control keys
      if (e.code === 'Enter') {
        if (this.isGameOver || !this.isRunning) {
          this.start();
        }
      }
      if (e.code === 'KeyP') {
        this.setPause(!this.isPaused);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  private handleKeyboardMovement() {
    if (this.isPaused || this.isGameOver) return;

    // Movement fallback
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      this.player.move('left');
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      this.player.move('right');
    }
    
    // Block fallback
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      this.player.block(true);
    } else if (this.voiceBlockTimer <= 0) {
      // Release block if not held and voice timer is finished
      this.player.block(false);
    }
  }

  private handleVoiceMovement() {
    if (this.isPaused || this.isGameOver) return;

    if (this.voiceMoveTimer > 0 && this.voiceMoveDir) {
      this.player.move(this.voiceMoveDir);
      this.voiceMoveTimer--;
      if (this.voiceMoveTimer <= 0) {
        this.voiceMoveDir = null;
      }
    }

    if (this.voiceBlockTimer > 0) {
      this.player.block(true);
      this.voiceBlockTimer--;
      if (this.voiceBlockTimer <= 0) {
        // Block is released once voice timer expires, unless keyboard is holding it
        const isKeyboardBlocking = this.keys['KeyS'] || this.keys['ArrowDown'];
        if (!isKeyboardBlocking) {
          this.player.block(false);
        }
      }
    }
  }

  private handleOpponentAI() {
    if (this.isPaused || this.isGameOver) return;

    const ai = this.ai;
    const player = this.player;

    // Simple automated FSM AI
    const distanceX = player.x - ai.x;
    const absDistanceX = Math.abs(distanceX);
    
    // Face player
    ai.isFacingRight = distanceX > 0;

    // 1. Defend against projectiles
    const activeProjectiles = this.projectiles.filter(p => p.owner === 'player1');
    let projectileThreat = false;
    for (const p of activeProjectiles) {
      const isApproaching = (p.vx > 0 && p.x < ai.x) || (p.vx < 0 && p.x > ai.x);
      if (isApproaching && Math.abs(p.x - ai.x) < 220) {
        projectileThreat = true;
        break;
      }
    }

    if (projectileThreat) {
      // 40% chance to jump over it, 60% chance to block
      if (Math.random() < 0.04 && !ai.isJumping) {
        ai.jump();
      } else if (Math.random() < 0.1) {
        ai.block(true);
      }
    } else {
      // Normally do not block randomly unless close
      if (ai.isBlocking && Math.random() < 0.08) {
        ai.block(false);
      }
    }

    // 2. Special Overdrive trigger
    if (ai.specialEnergy >= ai.maxSpecialEnergy && !ai.isSpecialActive) {
      if (Math.random() < 0.05) {
        ai.triggerSpecial();
        this.onGameLog('OPPONENT: OVERDRIVE ENGAGED!', 'danger');
      }
    }

    // 3. Movement
    if (!ai.isBlocking && !ai.isAttacking) {
      if (absDistanceX > 180) {
        // Move towards player
        ai.move(distanceX > 0 ? 'right' : 'left');
      } else if (absDistanceX < 80) {
        // Back away slightly to prepare strike
        ai.move(distanceX > 0 ? 'left' : 'right');
      } else {
        // Circle/wobble
        if (Math.random() < 0.05) {
          ai.move(Math.random() < 0.5 ? 'left' : 'right');
        }
      }
    }

    // 4. Attack behaviors
    if (absDistanceX < 70 && ai.attackCooldown === 0 && !ai.isBlocking) {
      // Close range melee attack
      if (Math.random() < 0.15) {
        ai.attack();
      }
    } else if (absDistanceX > 150 && ai.attackCooldown === 0 && !ai.isBlocking) {
      // Ranged projectile attack
      if (Math.random() < 0.015) {
        const proj = ai.createProjectile();
        if (proj) {
          this.projectiles.push(proj);
        }
      }
    }
  }

  private updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;

      // Check bounds
      if (p.x < 0 || p.x > this.canvas.width) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check hit Player 1
      if (p.owner === 'player2') {
        const hit = this.checkCollision(p, this.player);
        if (hit) {
          const direct = this.player.takeDamage(p.damage);
          this.projectiles.splice(i, 1);
          if (direct) {
            this.onGameLog('OPPONENT LANDED PROJECTILE IMPACT!', 'danger');
          } else {
            this.onGameLog('DEFENDED: PROJECTILE ABSORBED BY SHIELD', 'info');
          }
          this.checkMatchOver();
          continue;
        }
      }

      // Check hit Player 2 (AI)
      if (p.owner === 'player1') {
        const hit = this.checkCollision(p, this.ai);
        if (hit) {
          const direct = this.ai.takeDamage(p.damage);
          this.projectiles.splice(i, 1);
          if (direct) {
            this.onGameLog('PLAYER LANDED PROJECTILE IMPACT!', 'success');
          } else {
            this.onGameLog('OPPONENT BLOCKED LASER BURST', 'info');
          }
          this.checkMatchOver();
          continue;
        }
      }
    }
  }

  private checkMeleeCollisions() {
    if (this.isPaused || this.isGameOver) return;

    // Check Player 1 attack AI
    if (this.player.isAttacking && this.player.attackCooldown === (this.player.isSpecialActive ? 14 : 24)) {
      // Melee box is offset in facing direction
      const attackRange = 65;
      const attackBox = {
        x: this.player.isFacingRight ? this.player.x + this.player.width : this.player.x - attackRange,
        y: this.player.y,
        width: attackRange,
        height: this.player.height
      };

      if (this.checkRectIntersection(attackBox, this.ai)) {
        const direct = this.ai.takeDamage(this.player.isSpecialActive ? 25 : 15);
        if (direct) {
          this.onGameLog('DIRECT STRIKE INFLICTED!', 'success');
        } else {
          this.onGameLog('OPPONENT MELEE DEFLECTED', 'info');
        }
        this.checkMatchOver();
      }
    }

    // Check AI attack Player 1
    if (this.ai.isAttacking && this.ai.attackCooldown === (this.ai.isSpecialActive ? 14 : 24)) {
      const attackRange = 65;
      const attackBox = {
        x: this.ai.isFacingRight ? this.ai.x + this.ai.width : this.ai.x - attackRange,
        y: this.ai.y,
        width: attackRange,
        height: this.ai.height
      };

      if (this.checkRectIntersection(attackBox, this.player)) {
        const direct = this.player.takeDamage(this.ai.isSpecialActive ? 25 : 15);
        if (direct) {
          this.onGameLog('CRITICAL CLOSE-CONTACT DAMAGE INFLICTED!', 'danger');
        } else {
          this.onGameLog('SHIELD REFLECTED MELEE THRUST', 'info');
        }
        this.checkMatchOver();
      }
    }
  }

  private checkCollision(p: Projectile, char: Character): boolean {
    return p.x < char.x + char.width &&
           p.x + p.width > char.x &&
           p.y < char.y + char.height &&
           p.y + p.height > char.y;
  }

  private checkRectIntersection(r1: {x:number, y:number, width:number, height:number}, r2: {x:number, y:number, width:number, height:number}): boolean {
    return r1.x < r2.x + r2.width &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height &&
           r1.y + r1.height > r2.y;
  }

  private checkMatchOver() {
    if (this.player.health <= 0) {
      this.isGameOver = true;
      this.winner = 'player2';
      this.onGameLog('VOCAL COMPILER HALTED. DEFEAT ENCOUNTERED.', 'danger');
    } else if (this.ai.health <= 0) {
      this.isGameOver = true;
      this.winner = 'player1';
      this.onGameLog('VOCAL MEDIATED EXECUTION SYSTEM TRIUMPHANT!', 'success');
    }
  }

  private loop = () => {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(this.loop);
    
    this.update();
    this.render();
  };

  private update() {
    if (this.isPaused || this.isGameOver) return;

    // Movement updates
    this.handleKeyboardMovement();
    this.handleVoiceMovement();
    this.handleOpponentAI();

    // Physics updates
    this.player.update(this.canvas.width, this.groundY);
    this.ai.update(this.canvas.width, this.groundY);

    // Combat updates
    this.updateProjectiles();
    this.checkMeleeCollisions();
  }

  private render() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Background clearing
    this.ctx.fillStyle = '#070a13';
    this.ctx.fillRect(0, 0, width, height);

    // Draw Cybernetic Grid Lines
    this.ctx.strokeStyle = 'rgba(27, 34, 52, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    // Vertical grid lines
    for (let x = 0; x < width; x += 40) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.groundY);
    }
    // Horizontal grid lines
    for (let y = 0; y < this.groundY; y += 40) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
    }
    this.ctx.stroke();

    // Draw Ground Platform Line
    this.ctx.strokeStyle = 'rgba(189, 0, 255, 0.4)';
    this.ctx.lineWidth = 4;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#bd00ff';
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.groundY);
    this.ctx.lineTo(width, this.groundY);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Draw Ground Fill
    this.ctx.fillStyle = '#0b0f19';
    this.ctx.fillRect(0, this.groundY, width, height - this.groundY);

    // Draw Ground Grid Pattern
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x < width; x += 30) {
      this.ctx.moveTo(x, this.groundY);
      this.ctx.lineTo(x - 50, height);
    }
    this.ctx.stroke();

    // Draw Projectiles
    this.projectiles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color;
      this.ctx.fillRect(p.x, p.y, p.width, p.height);
    });
    this.ctx.shadowBlur = 0;

    // Draw Characters
    this.player.draw(this.ctx);
    this.ai.draw(this.ctx);

    // Draw HUD Health / Shield / Energy bars inside the Canvas
    this.renderHUD();

    // Game Over / Pause Screens
    if (this.isPaused) {
      this.renderOverlay('SYSTEM PAUSED', 'Press P or Speak "RESUME" to continue');
    } else if (this.isGameOver) {
      const winnerName = this.winner === 'player1' ? 'NEURAL OPERATOR WINS' : 'ROGUE INSTANCE WINS';
      this.renderOverlay(winnerName, 'Press Enter or Speak "START" to restart');
    }
  }

  private renderHUD() {
    const width = this.canvas.width;

    // Player 1 HUD (Left)
    this.drawHUDBar(20, 20, 200, 15, this.player.health / this.player.maxHealth, '#00ff66', 'HP: ' + Math.ceil(this.player.health));
    this.drawHUDBar(20, 40, 160, 8, this.player.shield / this.player.maxShield, '#00f0ff', 'SHD: ' + Math.ceil(this.player.shield));
    this.drawHUDBar(20, 53, 140, 6, this.player.specialEnergy / this.player.maxSpecialEnergy, '#bd00ff', 'SYS: ' + Math.ceil(this.player.specialEnergy));

    // Player 2 HUD (Right)
    this.drawHUDBar(width - 220, 20, 200, 15, this.ai.health / this.ai.maxHealth, '#ff3b30', 'HP: ' + Math.ceil(this.ai.health), true);
    this.drawHUDBar(width - 180, 40, 160, 8, this.ai.shield / this.ai.maxShield, '#00f0ff', 'SHD: ' + Math.ceil(this.ai.shield), true);
    this.drawHUDBar(width - 160, 53, 140, 6, this.ai.specialEnergy / this.ai.maxSpecialEnergy, '#bd00ff', 'SYS: ' + Math.ceil(this.ai.specialEnergy), true);

    // Character Labels
    this.ctx.font = '12px "Share Tech Mono"';
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillText('OPERATOR (P1)', 20, 15);
    this.ctx.fillStyle = '#ff3b30';
    this.ctx.fillText('ROGUE_AI (P2)', width - 100, 15);
  }

  private drawHUDBar(x: number, y: number, w: number, h: number, fillPercent: number, color: string, label: string, alignRight: boolean = false) {
    this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeRect(x, y, w, h);

    const barFillW = w * fillPercent;
    const barX = alignRight ? x + (w - barFillW) : x;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(barX, y, barFillW, h);

    // Label Text
    this.ctx.font = '9px "Share Tech Mono"';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(label, alignRight ? x + 5 : x + w - 50, y + h - 2);
  }

  private renderOverlay(title: string, subtitle: string) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.fillStyle = 'rgba(6, 10, 20, 0.8)';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.strokeStyle = 'rgba(189, 0, 255, 0.4)';
    this.ctx.strokeRect(50, 50, w - 100, h - 100);

    this.ctx.font = '36px "Share Tech Mono"';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#bd00ff';
    this.ctx.fillText(title, w / 2, h / 2 - 20);

    this.ctx.font = '14px "Space Grotesk"';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.shadowBlur = 0;
    this.ctx.fillText(subtitle, w / 2, h / 2 + 25);
    this.ctx.textAlign = 'start'; // Reset
  }
}
