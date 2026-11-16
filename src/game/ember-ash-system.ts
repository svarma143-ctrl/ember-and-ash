/**
 * Ember & Ash - core survival loop.
 *
 * Keep the campfire alive through waves of wind until dawn.
 * Feed it (twigs/logs/resin), shield it with the bark shield when gusts
 * hit, and stoke it with the palm fan.
 */

import {
  BufferAttribute,
  BufferGeometry,
  AdditiveBlending,
  CanvasTexture,
  Color,
  Points,
  PointsMaterial,
  PointLight,
  Vector3,
} from 'three';
import {
  createSystem,
  Grabbed,
  UIKitMLAsset,
} from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { FanTool, FireItem, ShieldTool } from './components.js';
import { audio } from './audio.js';

const FIRE_POS = new Vector3(0, 0.25, -1.55);
const FEED_RADIUS = 0.55;
const SHIELD_RADIUS = 0.95;
const NIGHT_LENGTH = 75; // seconds
const EMBER_COUNT = 70;

const FUEL: Record<string, { flame: number; embers: number }> = {
  twig: { flame: 13, embers: 6 },
  log: { flame: 24, embers: 12 },
  resin: { flame: 16, embers: 18 },
};

type Phase = 'playing' | 'dawn' | 'out';

let emberSprite: CanvasTexture | null = null;

function createEmberSprite(): CanvasTexture {
  if (emberSprite != null) {
    return emberSprite;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx != null) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 240, 200, 1)');
    gradient.addColorStop(0.35, 'rgba(255, 190, 90, 0.9)');
    gradient.addColorStop(1, 'rgba(255, 120, 20, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  emberSprite = new CanvasTexture(canvas);
  return emberSprite;
}

interface UIKitMLElement {
  setProperties(properties: Record<string, unknown>): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export class EmberAshSystem extends createSystem({
  items: { required: [FireItem] },
  heldItems: { required: [FireItem, Grabbed] },
  heldFans: { required: [FanTool, Grabbed] },
  heldShields: { required: [ShieldTool, Grabbed] },
}) {
  private flame = 70;
  private night = 1;
  private embers = 0;
  private phase: Phase = 'playing';
  private nightTimer = NIGHT_LENGTH;
  private streak = 0;
  private bestStreak = 0;
  private resinTimer = 0;
  private gustState: 'idle' | 'warning' | 'active' = 'idle';
  private gustTimer = 7;
  private gustSide: -1 | 0 | 1 = 1;
  private gustActiveTimer = 0;
  private gustRewarded = false;
  private stokeEnergy = 0;
  private stokeSoundTimer = 0;
  private hudTimer = 0;
  private time = 0;
  private burstTime = 0;
  private xrActiveHold = 0;
  private panelImmersive: boolean | null = null;

  private homeTransforms = new Map<
    Entity,
    { position: Vector3; quaternion: import('three').Quaternion }
  >();
  private lastFanPos = new Vector3();
  private hasLastFanPos = false;

  private fireLight!: PointLight;
  private emberPoints!: Points;
  private particleVel: Float32Array = new Float32Array(EMBER_COUNT * 3);
  private particleLife: Float32Array = new Float32Array(EMBER_COUNT);
  private particleMax: Float32Array = new Float32Array(EMBER_COUNT);

  private hudPanel: UIKitMLAsset | null = null;
  private welcomePanel: UIKitMLAsset | null = null;
  private resultPanel: UIKitMLAsset | null = null;
  private hudNight: UIKitMLElement | null = null;
  private hudTimerEl: UIKitMLElement | null = null;
  private hudFlame: UIKitMLElement | null = null;
  private hudEmbers: UIKitMLElement | null = null;
  private hudGust: UIKitMLElement | null = null;
  private resultTitle: UIKitMLElement | null = null;
  private resultBody: UIKitMLElement | null = null;
  private nextLabel: UIKitMLElement | null = null;

  init(): void {
    this.bestStreak = Number(
      globalThis.localStorage?.getItem('emberash.best') ?? '0',
    );

    // Capture home transforms so fed/dropped items can return to the woodpile.
    for (const entity of this.queries.items.entities) {
      const obj = entity.object3D;
      if (obj == null) {
        continue;
      }
      this.homeTransforms.set(entity, {
        position: obj.position.clone(),
        quaternion: obj.quaternion.clone(),
      });
    }

    // Feeding: item released near the fire is consumed.
    this.cleanupFuncs.push(
      this.queries.heldItems.subscribe('disqualify', (entity) => {
        this.onItemReleased(entity);
      }),
    );

    // Panels
    this.welcomePanel =
      this.world.getSceneObject<UIKitMLAsset>('welcome-panel') ?? null;
    this.hudPanel =
      this.world.getSceneObject<UIKitMLAsset>('hud-panel') ?? null;
    this.resultPanel =
      this.world.getSceneObject<UIKitMLAsset>('result-panel') ?? null;
    this.hudNight = this.hudPanel?.getElementById('hud-night') ?? null;
    this.hudTimerEl = this.hudPanel?.getElementById('hud-timer') ?? null;
    this.hudFlame = this.hudPanel?.getElementById('hud-flame') ?? null;
    this.hudEmbers = this.hudPanel?.getElementById('hud-embers') ?? null;
    this.hudGust = this.hudPanel?.getElementById('hud-gust') ?? null;
    this.resultTitle = this.resultPanel?.getElementById('result-title') ?? null;
    this.resultBody = this.resultPanel?.getElementById('result-body') ?? null;
    this.nextLabel = this.resultPanel?.getElementById('next-label') ?? null;

    // Welcome panel wiring
    const xrButton = this.welcomePanel?.getElementById('xr-button');
    const exitButton = this.welcomePanel?.getElementById('exit-button');
    const launchXR = () => void this.world.launchXR();
    const exitXR = () => void this.world.exitXR();
    xrButton?.addEventListener('click', launchXR);
    exitButton?.addEventListener('click', exitXR);
    this.cleanupFuncs.push(() => {
      xrButton?.removeEventListener('click', launchXR);
      exitButton?.removeEventListener('click', exitXR);
    });

    // Result panel button: advance / retry
    const nextButton = this.resultPanel?.getElementById('next-button');
    const onNext = () => this.advanceAfterResult();
    nextButton?.addEventListener('click', onNext);
    this.cleanupFuncs.push(() =>
      nextButton?.removeEventListener('click', onNext),
    );

    // Panel visibility + simulation follow the XR session, driven from update().
    this.applyPanelVisibility(false);

    // Fire light - warm flicker layered over the cool moonlight
    this.fireLight = new PointLight(0xff8c3a, 18, 9, 1.8);
    this.fireLight.position.set(FIRE_POS.x, 1.05, FIRE_POS.z);
    this.scene.add(this.fireLight);

    this.createEmberParticles();
    this.updateHud(true);
  }

  /* ---------------- panels & flow ---------------- */

  private xrSessionActive(): boolean {
    const xr = this.input?.xr;
    if (xr == null) {
      return false;
    }
    return (
      xr.getPrimaryInputSource('left') != null ||
      xr.getPrimaryInputSource('right') != null ||
      xr.gamepads?.left != null ||
      xr.gamepads?.right != null
    );
  }

  private applyPanelVisibility(immersive: boolean): void {
    this.setPanelVisible(
      'welcome-panel',
      immersive ? null : [0, 2.0, -4.3],
    );
    this.setPanelVisible('hud-panel', immersive ? [0, 1.78, -2.5] : null);
    this.setPanelVisible(
      'result-panel',
      immersive && this.phase !== 'playing' ? [0, 1.55, -2.15] : null,
    );
    const exitButton = this.welcomePanel?.getElementById('exit-button');
    const xrButton = this.welcomePanel?.getElementById('xr-button');
    xrButton?.setProperties({ display: immersive ? 'none' : 'flex' });
    exitButton?.setProperties({ display: immersive ? 'flex' : 'none' });
  }

  private setPanelVisible(nodeId: string, position: [number, number, number] | null): void {
    const obj = this.world.getSceneObject(nodeId);
    if (obj != null) {
      if (position == null) {
        obj.position.set(0, -5, 0);
      } else {
        obj.position.set(position[0], position[1], position[2]);
      }
    }
  }

  private startNight(): void {
    this.phase = 'playing';
    this.flame = 70;
    this.nightTimer = NIGHT_LENGTH;
    this.resinTimer = 0;
    this.gustState = 'idle';
    this.gustTimer = 7;
    this.stokeEnergy = 0;
    this.setResultPanelVisible(false);
    this.updateHud(true);
  }

  private advanceAfterResult(): void {
    if (this.phase === 'dawn') {
      this.night += 1;
    } else {
      this.streak = 0; // streak lost with the fire; retry this night
    }
    this.startNight();
  }

  private onDawn(): void {
    this.phase = 'dawn';
    this.streak += 1;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    try {
      globalThis.localStorage?.setItem('emberash.best', String(this.bestStreak));
      globalThis.localStorage?.setItem(
        'emberash.total',
        String(
          Number(globalThis.localStorage.getItem('emberash.total') ?? '0') +
            this.embers,
        ),
      );
    } catch {
      /* storage unavailable - play on */
    }
    this.resultTitle?.setProperties({ text: `DAWN BREAKS ON NIGHT ${this.night}` });
    this.resultBody?.setProperties({
      text: `The fire held until first light. Streak: ${this.streak} night${this.streak === 1 ? '' : 's'} - Best: ${this.bestStreak} - Embers: ${this.embers}`,
    });
    this.nextLabel?.setProperties({ text: 'Stoke Another Night' });
    this.setResultPanelVisible(true);
    audio.chime(this.streak);
  }

  private onFireOut(): void {
    this.phase = 'out';
    this.streak = 0;
    this.resultTitle?.setProperties({ text: 'THE FIRE WENT OUT' });
    this.resultBody?.setProperties({
      text: `Nothing left but warm ash. Embers gathered: ${this.embers}. The mountain forgives - build it again.`,
    });
    this.nextLabel?.setProperties({ text: 'Try Again' });
    this.setResultPanelVisible(true);
    audio.doom();
  }

  private setResultPanelVisible(visible: boolean): void {
    this.setPanelVisible(
      'result-panel',
      visible ? [0, 1.55, -2.15] : null,
    );
  }

  /* ---------------- feeding ---------------- */

  private onItemReleased(entity: Entity): void {
    const obj = entity.object3D;
    if (obj == null) {
      return;
    }
    const dx = obj.position.x - FIRE_POS.x;
    const dz = obj.position.z - FIRE_POS.z;
    const dist = Math.hypot(dx, dz);
    if (dist < FEED_RADIUS && obj.position.y < 1.4 && this.phase === 'playing') {
      const kind = entity.getValue(FireItem, 'kind') as string;
      const fuel = FUEL[kind] ?? FUEL.twig;
      this.flame = Math.min(100, this.flame + fuel.flame);
      this.embers += fuel.embers;
      if (kind === 'resin') {
        this.resinTimer = 5;
        this.burstTime = 1.1;
        audio.hiss(0.5, 0.4, 1500);
      } else {
        this.burstTime = Math.max(this.burstTime, 0.45);
      }
      audio.pop(kind === 'log' ? 1.4 : 1);
    }
    // Feed or not, the woodpile reclaims what you let go of.
    const home = this.homeTransforms.get(entity);
    if (home != null) {
      obj.position.copy(home.position);
      obj.quaternion.copy(home.quaternion);
    }
  }

  /* ---------------- update loop ---------------- */

  update(delta: number, time: number): void {
    this.time = time;
    // Hysteresis: a dropped frame shouldn't pause the vigil.
    if (this.xrSessionActive()) {
      this.xrActiveHold = 1.5;
    } else {
      this.xrActiveHold = Math.max(0, this.xrActiveHold - delta);
    }
    const immersive = this.xrActiveHold > 0;
    if (immersive !== this.panelImmersive) {
      this.panelImmersive = immersive;
      this.applyPanelVisibility(immersive);
    }
    const playing = this.phase === 'playing' && immersive;

    // --- decay & survival timer ---
    if (playing) {
      let decay = 1.15 + (this.night - 1) * 0.28;
      if (this.resinTimer > 0) {
        decay *= 0.35;
        this.resinTimer -= delta;
      }
      if (this.gustState === 'active' && !this.isShieldBlocking()) {
        decay *= 2.7;
      }
      this.flame = Math.max(0, this.flame - decay * delta);
      this.nightTimer -= delta;
      if (this.nightTimer <= 0) {
        this.nightTimer = 0;
        this.onDawn();
      } else if (this.flame <= 0) {
        this.onFireOut();
      }
    }

    // --- gust state machine ---
    this.updateGusts(delta, playing);

    // --- fan stoking ---
    this.updateFan(delta, playing);

    // --- visuals (always on, so the menu scene breathes too) ---
    this.animateFlame(delta, time);
    this.updateEmberParticles(delta);
    this.burstTime = Math.max(0, this.burstTime - delta);

    // --- HUD refresh at ~7 Hz ---
    this.hudTimer -= delta;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.15;
      this.updateHud(false);
    }
  }

  private updateGusts(delta: number, playing: boolean): void {
    if (!playing) {
      return;
    }
    if (this.gustState === 'idle') {
      this.gustTimer -= delta;
      if (this.gustTimer <= 1.5 && this.gustTimer > 0) {
        this.gustState = 'warning';
        this.gustSide = this.pickGustSide();
        this.setGustBanner(this.gustWarningText());
      }
      if (this.gustTimer <= 0) {
        this.gustState = 'active';
        this.gustActiveTimer = 2.3;
        this.gustRewarded = false;
        audio.gust();
        this.setGustBanner('GUST! SHIELD THE FLAME');
      }
      return;
    }
    if (this.gustState === 'warning') {
      this.gustTimer -= delta;
      if (this.gustTimer <= 0) {
        this.gustState = 'active';
        this.gustActiveTimer = 2.3;
        this.gustRewarded = false;
        audio.gust();
        this.setGustBanner('GUST! SHIELD THE FLAME');
      }
      return;
    }
    // active
    this.gustActiveTimer -= delta;
    if (!this.gustRewarded && this.isShieldBlocking()) {
      this.gustRewarded = true;
      this.embers += 25;
      this.setGustBanner('BLOCKED! +25 EMBERS');
      audio.chime(1);
    }
    if (this.gustActiveTimer <= 0) {
      this.gustState = 'idle';
      const base = Math.max(4.2, 8.6 - this.night * 0.7);
      this.gustTimer = base * (0.75 + Math.random() * 0.5);
      this.setGustBanner(null);
    }
  }

  private pickGustSide(): -1 | 0 | 1 {
    const roll = Math.random();
    if (roll < 0.4) {
      return -1;
    }
    if (roll < 0.8) {
      return 1;
    }
    return 0;
  }

  private gustWarningText(): string {
    if (this.gustSide < 0) {
      return 'GUST FROM THE LEFT - RAISE THE SHIELD';
    }
    if (this.gustSide > 0) {
      return 'GUST FROM THE RIGHT - RAISE THE SHIELD';
    }
    return 'SWIRLING GUST - RAISE THE SHIELD';
  }

  private isShieldBlocking(): boolean {
    for (const entity of this.queries.heldShields.entities) {
      const p = entity.object3D?.position;
      if (p == null) {
        continue;
      }
      const dx = p.x - FIRE_POS.x;
      const dz = p.z - FIRE_POS.z;
      if (Math.hypot(dx, dz) < SHIELD_RADIUS) {
        return true;
      }
    }
    return false;
  }

  private updateFan(delta: number, playing: boolean): void {
    const fanEntity = [...this.queries.heldFans.entities][0];
    if (fanEntity == null || !playing) {
      this.hasLastFanPos = false;
      this.stokeSoundTimer = Math.max(0, this.stokeSoundTimer - delta);
      return;
    }
    const fan = fanEntity.object3D;
    if (fan == null) {
      this.hasLastFanPos = false;
      return;
    }
    if (this.hasLastFanPos) {
      const speed = fan.position.distanceTo(this.lastFanPos) / Math.max(delta, 1e-4);
      if (speed > 1.3) {
        this.stokeEnergy += speed * delta;
        this.stokeSoundTimer -= delta;
        if (this.stokeSoundTimer <= 0) {
          this.stokeSoundTimer = 0.16;
          audio.hiss(0.08, 0.1, 2400);
        }
        while (this.stokeEnergy >= 1.6) {
          this.stokeEnergy -= 1.6;
          this.flame = Math.min(100, this.flame + 3.4);
          this.embers += 1;
        }
      }
    }
    this.lastFanPos.copy(fan.position);
    this.hasLastFanPos = true;
  }

  /* ---------------- visuals ---------------- */

  private animateFlame(delta: number, time: number): void {
    const t = time;
    const level = this.flame / 100;
    const flick =
      Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3 + 1.7) * 0.3 + Math.sin(t * 23 + 4) * 0.15;
    const base = 0.22 + level * 1.05;
    const scale = Math.max(0.02, base * (1 + flick * 0.14));

    const flame = this.world.getSceneObject('flame');
    if (flame != null) {
      flame.scale.set(scale, scale * (1.2 + flick * 0.16), scale);
      flame.rotation.y += delta * 0.6;
    }
    const glow = this.world.getSceneObject('ember-glow');
    if (glow != null) {
      const pulse = 1 + Math.sin(t * 9.5) * 0.12 + level * 0.25;
      glow.scale.set(pulse, 1, pulse);
    }
    this.fireLight.intensity =
      (6 + level * 22) * (1 + flick * 0.22) * (this.burstTime > 0 ? 1.35 : 1);
  }

  private createEmberParticles(): void {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(EMBER_COUNT * 3);
    for (let i = 0; i < EMBER_COUNT; i++) {
      this.respawnParticle(positions, i, true);
    }
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      color: new Color(0xffb545),
      size: 0.05,
      map: createEmberSprite(),
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.emberPoints = new Points(geometry, material);
    this.emberPoints.frustumCulled = false;
    this.scene.add(this.emberPoints);
  }

  private respawnParticle(
    positions: Float32Array,
    i: number,
    randomizeAge = false,
  ): void {
    positions[i * 3] = FIRE_POS.x + (Math.random() - 0.5) * 0.34;
    positions[i * 3 + 1] = 0.28 + Math.random() * 0.1;
    positions[i * 3 + 2] = FIRE_POS.z + (Math.random() - 0.5) * 0.34;
    const burst = this.burstTime > 0;
    this.particleVel[i * 3] = (Math.random() - 0.5) * (burst ? 0.55 : 0.28);
    this.particleVel[i * 3 + 1] =
      (burst ? 1.15 : 0.55) + Math.random() * (burst ? 0.9 : 0.55);
    this.particleVel[i * 3 + 2] = (Math.random() - 0.5) * (burst ? 0.55 : 0.28);
    this.particleMax[i] = 0.8 + Math.random() * 0.9;
    this.particleLife[i] = randomizeAge ? Math.random() * this.particleMax[i] : 0;
  }

  private updateEmberParticles(delta: number): void {
    const positions = this.emberPoints.geometry.getAttribute(
      'position',
    ) as BufferAttribute;
    const arr = positions.array as Float32Array;
    const flameScale = 0.35 + (this.flame / 100) * 0.65;
    for (let i = 0; i < EMBER_COUNT; i++) {
      this.particleLife[i] += delta;
      if (this.particleLife[i] >= this.particleMax[i]) {
        this.respawnParticle(arr, i);
        continue;
      }
      const wobble = Math.sin(this.time * 3.1 + i * 2.4) * 0.12 * delta;
      arr[i * 3] += (this.particleVel[i * 3] + wobble) * delta;
      arr[i * 3 + 1] += this.particleVel[i * 3 + 1] * delta * (0.5 + flameScale);
      arr[i * 3 + 2] += this.particleVel[i * 3 + 2] * delta;
      this.particleVel[i * 3 + 1] -= 0.18 * delta; // gentle drag, not gravity
    }
    positions.needsUpdate = true;
  }

  /* ---------------- HUD ---------------- */

  private setGustBanner(text: string | null): void {
    if (this.hudGust != null) {
      if (text == null) {
        this.hudGust.setProperties({ display: 'none' });
      } else {
        this.hudGust.setProperties({ display: 'flex', text });
      }
    }
  }

  private updateHud(force: boolean): void {
    void force;
    const t = Math.max(0, Math.ceil(this.nightTimer));
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    const filled = Math.round(this.flame / 10);
    const bar = '#'.repeat(filled) + '-'.repeat(10 - filled);
    this.hudNight?.setProperties({ text: `NIGHT ${this.night}` });
    this.hudTimerEl?.setProperties({ text: `${mm}:${ss}` });
    this.hudFlame?.setProperties({
      text: `FLAME [${bar}] ${Math.round(this.flame)}`,
    });
    this.hudEmbers?.setProperties({
      text: `EMBERS ${this.embers}   BEST NIGHT ${this.bestStreak}`,
    });
  }
}
