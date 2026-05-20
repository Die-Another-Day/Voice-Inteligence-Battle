export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  width: number;
  height: number;
  color: string;
  damage: number;
  owner: 'player1' | 'player2';
}

export class Character {
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public width: number = 50;
  public height: number = 70;
  
  public health: number = 100;
  public maxHealth: number = 100;
  public shield: number = 100;
  public maxShield: number = 100;
  public specialEnergy: number = 0;
  public maxSpecialEnergy: number = 100;
  
  public isFacingRight: boolean;
  public isJumping: boolean = false;
  public isBlocking: boolean = false;
  public isAttacking: boolean = false;
  public isSpecialActive: boolean = false;
  
  public attackCooldown: number = 0;
  public specialDuration: number = 0;
  public hitFlashDuration: number = 0;
  
  public particles: Particle[] = [];
  public id: 'player1' | 'player2';
  public colorNeon: string;
  public colorGlow: string;
  
  private gravity: number = 0.8;
  private friction: number = 0.85;
  private moveSpeed: number = 1.2;
  private jumpForce: number = 15;

  constructor(x: number, y: number, id: 'player1' | 'player2', isFacingRight: boolean) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.isFacingRight = isFacingRight;
    
    // Theme colors
    if (id === 'player1') {
      this.colorNeon = '#00f0ff'; // Cyber Cyan
      this.colorGlow = 'rgba(0, 240, 255, 0.4)';
    } else {
      this.colorNeon = '#ff3b30'; // Rogue Crimson
      this.colorGlow = 'rgba(255, 59, 48, 0.4)';
    }
  }

  public update(arenaWidth: number, groundY: number) {
    // 1. Cooldowns and Timers
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.hitFlashDuration > 0) this.hitFlashDuration--;
    
    if (this.isSpecialActive) {
      this.specialDuration--;
      if (this.specialDuration <= 0) {
        this.isSpecialActive = false;
        this.emitSparks(30, '#bd00ff'); // Blast ending special
      } else {
        // Emit faint special aura particles
        if (Math.random() < 0.3) {
          this.particles.push({
            x: this.x + Math.random() * this.width,
            y: this.y + Math.random() * this.height,
            vx: (Math.random() - 0.5) * 1,
            vy: -Math.random() * 2,
            color: '#bd00ff', // Violet aura
            size: Math.random() * 3 + 2,
            life: 25,
            maxLife: 25
          });
        }
      }
    }

    // 2. Shield regeneration
    if (!this.isBlocking && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + 0.15);
    }

    // 3. Movement and Physics
    this.vy += this.gravity;
    this.vx *= this.friction;
    
    this.x += this.vx;
    this.y += this.vy;

    // Ground Collision
    const feetY = this.y + this.height;
    if (feetY >= groundY) {
      this.y = groundY - this.height;
      this.vy = 0;
      this.isJumping = false;
    }

    // Arena Boundaries
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    } else if (this.x + this.width > arenaWidth) {
      this.x = arenaWidth - this.width;
      this.vx = 0;
    }

    // 4. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Jetpack flame particles when jumping and rising
    if (this.isJumping && this.vy < 0) {
      this.particles.push({
        x: this.x + this.width / 2 + (Math.random() - 0.5) * 10,
        y: this.y + this.height,
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 2,
        color: this.isSpecialActive ? '#bd00ff' : '#ffb700', // Jetpack fire
        size: Math.random() * 4 + 2,
        life: 15,
        maxLife: 15
      });
    }
  }

  public move(dir: 'left' | 'right') {
    const multiplier = this.isSpecialActive ? 1.5 : 1.0;
    if (dir === 'left') {
      this.vx -= this.moveSpeed * multiplier;
      this.isFacingRight = false;
    } else {
      this.vx += this.moveSpeed * multiplier;
      this.isFacingRight = true;
    }
  }

  public jump() {
    if (!this.isJumping) {
      const multiplier = this.isSpecialActive ? 1.2 : 1.0;
      this.vy = -this.jumpForce * multiplier;
      this.isJumping = true;
      // Landing/takeoff dust
      this.emitSparks(10, '#ffffff');
    }
  }

  public attack(): boolean {
    if (this.attackCooldown > 0 || this.isBlocking) return false;
    this.isAttacking = true;
    this.attackCooldown = this.isSpecialActive ? 15 : 25; // Faster in special

    // Emit slash particles in facing direction
    const slashX = this.isFacingRight ? this.x + this.width + 10 : this.x - 10;
    const slashY = this.y + this.height / 2;
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: slashX,
        y: slashY + (Math.random() - 0.5) * 40,
        vx: (this.isFacingRight ? 1 : -1) * (2 + Math.random() * 4),
        vy: (Math.random() - 0.5) * 3,
        color: this.isSpecialActive ? '#bd00ff' : this.colorNeon,
        size: Math.random() * 3 + 2,
        life: 20,
        maxLife: 20
      });
    }

    // Set a timeout to turn off the attack stance
    setTimeout(() => {
      this.isAttacking = false;
    }, 150);

    return true;
  }

  public block(active: boolean) {
    if (active && this.shield > 5) {
      this.isBlocking = true;
      this.vx *= 0.5; // Slow down when blocking
    } else {
      this.isBlocking = false;
    }
  }

  public triggerSpecial(): boolean {
    if (this.specialEnergy < this.maxSpecialEnergy || this.isSpecialActive) return false;
    this.specialEnergy = 0;
    this.isSpecialActive = true;
    this.specialDuration = 400; // ~6.5 seconds at 60 FPS
    
    // Massive energy blast visuals
    this.emitSparks(40, '#bd00ff');
    return true;
  }

  public createProjectile(): Projectile | null {
    if (this.attackCooldown > 0 || this.isBlocking) return null;
    this.attackCooldown = this.isSpecialActive ? 20 : 35;

    const bulletX = this.isFacingRight ? this.x + this.width + 5 : this.x - 15;
    const bulletY = this.y + this.height / 3;
    const speed = 12;

    return {
      x: bulletX,
      y: bulletY,
      vx: this.isFacingRight ? speed : -speed,
      width: 15,
      height: 6,
      color: this.isSpecialActive ? '#bd00ff' : this.colorNeon,
      damage: this.isSpecialActive ? 18 : 10,
      owner: this.id
    };
  }

  public takeDamage(amount: number): boolean {
    this.hitFlashDuration = 10; // Flash red/white for 10 frames
    this.emitSparks(8, this.isBlocking ? '#00f0ff' : '#ff3b30');

    if (this.isBlocking && this.shield > 0) {
      const shieldAbsorb = amount * 0.85; // 85% absorbed
      this.shield = Math.max(0, this.shield - amount * 0.7);
      this.health -= (amount - shieldAbsorb);
      
      // Gain a bit of special energy on block
      this.specialEnergy = Math.min(this.maxSpecialEnergy, this.specialEnergy + amount * 0.5);
      return false; // Not a direct clean hit
    } else {
      this.health = Math.max(0, this.health - amount);
      // Gain special energy when taking damage
      this.specialEnergy = Math.min(this.maxSpecialEnergy, this.specialEnergy + amount * 0.8);
      return true; // Clean hit
    }
  }

  public emitSparks(count: number, color: string) {
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 5;
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        size: Math.random() * 4 + 1,
        life: 15 + Math.random() * 15,
        maxLife: 30
      });
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    // 1. Draw active particles attached to this character
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = p.color === '#ffffff' ? 0 : 5;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;

    // Determine current line colors
    let mainColor = this.colorNeon;
    if (this.hitFlashDuration > 0) {
      mainColor = '#ffffff'; // White flash
    } else if (this.isSpecialActive) {
      mainColor = '#bd00ff'; // Violet special mode
    }

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = mainColor;

    // 2. Draw Fighter Body (Glowing Wireframe Cyber Style)
    ctx.beginPath();
    
    // Draw a detailed holographic frame instead of a rectangle
    // Rounded head
    ctx.arc(this.x + this.width / 2, this.y + 12, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    // Spine
    ctx.moveTo(this.x + this.width / 2, this.y + 22);
    ctx.lineTo(this.x + this.width / 2, this.y + 45);
    // Shoulders
    ctx.moveTo(this.x + this.width / 2 - 18, this.y + 25);
    ctx.lineTo(this.x + this.width / 2 + 18, this.y + 25);
    // Legs
    ctx.moveTo(this.x + this.width / 2, this.y + 45);
    ctx.lineTo(this.x + 10, this.y + this.height);
    ctx.moveTo(this.x + this.width / 2, this.y + 45);
    ctx.lineTo(this.x + this.width - 10, this.y + this.height);
    
    // Arms (Action positions)
    const armY = this.y + 25;
    if (this.isBlocking) {
      // Draw crossed arms in front
      ctx.moveTo(this.x + this.width / 2 - 18, armY);
      ctx.lineTo(this.x + this.width / 2, armY + 10);
      ctx.moveTo(this.x + this.width / 2 + 18, armY);
      ctx.lineTo(this.x + this.width / 2, armY + 10);
    } else if (this.isAttacking) {
      // Draw one arm thrusting forward
      const handX = this.isFacingRight ? this.x + this.width + 12 : this.x - 12;
      ctx.moveTo(this.x + this.width / 2 + (this.isFacingRight ? 10 : -10), armY);
      ctx.lineTo(handX, armY + 5);
      // Other arm back
      ctx.moveTo(this.x + this.width / 2 + (this.isFacingRight ? -10 : 10), armY);
      ctx.lineTo(this.x + this.width / 2 + (this.isFacingRight ? -22 : 22), armY + 12);
    } else {
      // Idle arms swinging slightly
      const wave = Math.sin(Date.now() / 200) * 3;
      ctx.moveTo(this.x + this.width / 2 - 18, armY);
      ctx.lineTo(this.x + 5, armY + 15 + wave);
      ctx.moveTo(this.x + this.width / 2 + 18, armY);
      ctx.lineTo(this.x + this.width - 5, armY + 15 - wave);
    }
    ctx.stroke();

    // 3. Draw Holographic Weapon Element
    if (this.isAttacking) {
      ctx.strokeStyle = this.isSpecialActive ? '#bd00ff' : '#ffb700';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const weaponEndX = this.isFacingRight ? this.x + this.width + 25 : this.x - 25;
      const weaponStartY = armY - 5;
      const weaponEndY = armY + 15;
      ctx.moveTo(this.isFacingRight ? this.x + this.width - 5 : this.x + 5, weaponStartY);
      ctx.lineTo(weaponEndX, weaponEndY);
      ctx.stroke();
    }

    // 4. Draw Block Shield Bubble
    if (this.isBlocking) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00f0ff';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    // 5. Draw Special Overdrive Aura Ring
    if (this.isSpecialActive) {
      ctx.strokeStyle = 'rgba(189, 0, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const auraRadius = 50 + Math.sin(Date.now() / 80) * 5;
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, auraRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }
}
