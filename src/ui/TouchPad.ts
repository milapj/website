import * as Phaser from 'phaser';
import { Direction } from 'grid-engine';

/**
 * On-screen controls for touch devices: a four-way D-pad and an action
 * button, drawn in semi-transparent white and pinned to the bottom-right of
 * the camera. Holding a pad button walks like holding a key; the action
 * button does what SPACE does. Hidden when the device has no touch screen.
 */
export class TouchPad {
  /** Direction currently held on the pad, or null. */
  held: Direction | null = null;

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly onAction: () => void;

  constructor(scene: Phaser.Scene, onAction: () => void) {
    this.scene = scene;
    this.onAction = onAction;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(950);
    this.build();
    this.layout();
    scene.scale.on('resize', this.layout, this);
    this.container.setVisible(TouchPad.isTouchDevice());
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
      const zone = this.button(b.x, b.y, size, (g) => {
        // arrow head
        g.fillStyle(0xffffff, 0.9);
        g.fillTriangle(10, 0, -6, -12, -6, 12);
      });
      zone.rotation = b.rot;
      zone.on('pointerdown', () => (this.held = b.dir));
      const release = () => {
        if (this.held === b.dir) this.held = null;
      };
      zone.on('pointerup', release);
      zone.on('pointerout', release);
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
    action.on('pointerdown', () => this.onAction());
  }

  /** A translucent white rounded square with an icon, wrapped in a hit zone. */
  private button(
    x: number,
    y: number,
    size: number,
    icon: (g: Phaser.GameObjects.Graphics) => void
  ): Phaser.GameObjects.Container {
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(-size / 2, -size / 2, size, size, 12);
    g.lineStyle(3, 0xffffff, 0.7).strokeRoundedRect(-size / 2, -size / 2, size, size, 12);
    icon(g);
    const wrap = this.scene.add.container(x, y, [g]);
    wrap.setSize(size, size);
    wrap.setInteractive(new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size), Phaser.Geom.Rectangle.Contains);
    g.setAlpha(0.8);
    wrap.on('pointerdown', () => g.setAlpha(1));
    const up = () => g.setAlpha(0.8);
    wrap.on('pointerup', up);
    wrap.on('pointerout', up);
    this.container.add(wrap);
    return wrap;
  }

  private layout(): void {
    const cam = this.scene.cameras.main;
    // pad centre sits a comfortable thumb's reach from the bottom-right corner
    this.container.setPosition(cam.width - 230, cam.height - 120);
  }
}
