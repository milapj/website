import * as Phaser from 'phaser';
import { Direction } from 'grid-engine';

interface PadButton {
  /** Hit rectangle in pad-local game pixels. */
  rect: Phaser.Geom.Rectangle;
  dir?: Direction;
  action?: boolean;
  gfx: Phaser.GameObjects.Graphics;
}

/**
 * On-screen controls for touch devices: a four-way D-pad and an action
 * button, drawn in semi-transparent white and pinned to the bottom-right of
 * the camera. Touches are read straight from the canvas (not through
 * Phaser's input plugin) so holding and multi-touch are reliable: one thumb
 * can hold a direction while the other taps the button. Mouse clicks still
 * go through Phaser's pointer events for desktop testing.
 */
export class TouchPad {
  /** Direction currently held on the pad, or null. */
  held: Direction | null = null;

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly onAction: () => void;
  private readonly buttons: PadButton[] = [];
  /** Active touch identifiers -> the direction they are holding. */
  private readonly touches = new Map<number, Direction>();

  constructor(scene: Phaser.Scene, onAction: () => void) {
    this.scene = scene;
    this.onAction = onAction;
    this.container = scene.add.container(0, 0).setDepth(950);
    this.build();
    // hit-testing uses each child's own scroll factor, so the camera pin has
    // to be pushed down to every button, not just the container
    this.container.setScrollFactor(0, 0, true);
    this.layout();
    scene.scale.on('resize', this.layout, this);
    this.container.setVisible(TouchPad.isTouchDevice());
    if (this.container.visible) this.listenToCanvas();
  }

  static isTouchDevice(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)
    );
  }

  get visible(): boolean {
    return this.container.visible;
  }

  // ---------------------------------------------------------------- drawing

  private build(): void {
    const size = 64; // one pad button
    const gap = 6;
    const pad = [
      { dir: Direction.UP, x: 0, y: -(size + gap), rot: -Math.PI / 2 },
      { dir: Direction.DOWN, x: 0, y: size + gap, rot: Math.PI / 2 },
      { dir: Direction.LEFT, x: -(size + gap), y: 0, rot: Math.PI },
      { dir: Direction.RIGHT, x: size + gap, y: 0, rot: 0 },
    ];
    for (const b of pad) {
      const btn = this.button(b.x, b.y, size, (g) => {
        g.fillStyle(0xffffff, 0.9);
        g.fillTriangle(10, 0, -6, -12, -6, 12);
      });
      btn.gfx.rotation = b.rot;
      btn.dir = b.dir;
    }
    // centre of the pad, purely decorative
    const centre = this.scene.add.graphics();
    centre.fillStyle(0xffffff, 0.15).fillRoundedRect(-size / 2, -size / 2, size, size, 10);
    this.container.add(centre);

    // action button, to the right of the pad and slightly lower
    const action = this.button(2 * (size + gap) + size * 0.6, size * 0.75, size * 1.15, (g) => {
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(0, 0, 9);
    });
    action.action = true;
  }

  /** A translucent white rounded square with an icon, registered as a button. */
  private button(x: number, y: number, size: number, icon: (g: Phaser.GameObjects.Graphics) => void): PadButton {
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(-size / 2, -size / 2, size, size, 12);
    g.lineStyle(3, 0xffffff, 0.7).strokeRoundedRect(-size / 2, -size / 2, size, size, 12);
    icon(g);
    g.setPosition(x, y).setAlpha(0.8);
    this.container.add(g);
    const btn: PadButton = { rect: new Phaser.Geom.Rectangle(x - size / 2, y - size / 2, size, size), gfx: g };
    this.buttons.push(btn);

    // mouse support (desktop testing): Phaser pointer events on a hit zone
    const zone = this.scene.add.zone(x, y, size, size).setInteractive();
    this.container.add(zone);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return; // touches are handled on the canvas directly
      this.press(btn);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      this.release(btn);
    };
    zone.on('pointerup', release);
    zone.on('pointerout', release);
    return btn;
  }

  private layout(): void {
    const cam = this.scene.cameras.main;
    // pad centre sits a comfortable thumb's reach from the bottom-right corner
    this.container.setPosition(cam.width - 230, cam.height - 120);
  }

  // ------------------------------------------------------------------ input

  private press(btn: PadButton): void {
    btn.gfx.setAlpha(1);
    if (btn.action) this.onAction();
    else if (btn.dir) this.held = btn.dir;
  }

  private release(btn: PadButton): void {
    btn.gfx.setAlpha(0.8);
    if (btn.dir && this.held === btn.dir && this.touches.size === 0) this.held = null;
  }

  /** Canvas client coordinates -> pad-local game pixels. */
  private toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = this.scene.game.canvas;
    const r = canvas.getBoundingClientRect();
    const cam = this.scene.cameras.main;
    const gx = ((clientX - r.left) * cam.width) / r.width;
    const gy = ((clientY - r.top) * cam.height) / r.height;
    return { x: gx - this.container.x, y: gy - this.container.y };
  }

  private hit(clientX: number, clientY: number): PadButton | null {
    const p = this.toLocal(clientX, clientY);
    return this.buttons.find((b) => b.rect.contains(p.x, p.y)) ?? null;
  }

  private listenToCanvas(): void {
    const canvas = this.scene.game.canvas;
    const opts = { passive: false } as AddEventListenerOptions;

    canvas.addEventListener(
      'touchstart',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          const b = this.hit(t.clientX, t.clientY);
          if (!b) continue;
          e.preventDefault();
          b.gfx.setAlpha(1);
          if (b.action) this.onAction();
          else if (b.dir) this.touches.set(t.identifier, b.dir);
        }
        this.recompute();
      },
      opts
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (!this.touches.has(t.identifier)) continue;
          e.preventDefault();
          const b = this.hit(t.clientX, t.clientY);
          if (b?.dir) this.touches.set(t.identifier, b.dir);
          else this.touches.delete(t.identifier);
        }
        this.recompute();
      },
      opts
    );

    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) this.touches.delete(t.identifier);
      this.recompute();
      // let the action button relax too
      window.setTimeout(() => this.buttons.forEach((b) => b.action && b.gfx.setAlpha(0.8)), 120);
    };
    canvas.addEventListener('touchend', end, opts);
    canvas.addEventListener('touchcancel', end, opts);
  }

  /** The most recently pressed direction wins while several are held. */
  private recompute(): void {
    let dir: Direction | null = null;
    for (const d of this.touches.values()) dir = d;
    this.held = dir;
    for (const b of this.buttons) {
      if (b.dir) b.gfx.setAlpha(this.held === b.dir ? 1 : 0.8);
    }
  }
}
