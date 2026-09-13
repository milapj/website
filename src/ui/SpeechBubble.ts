import * as Phaser from 'phaser';
import { PIXEL_FONT } from './DialogBox';

/**
 * A small comic-style speech bubble that floats above a sprite in world
 * space. Used for Myra's treat requests.
 */
export class SpeechBubble {
  private readonly container: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private target?: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene) {
    this.frame = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', {
      fontFamily: PIXEL_FONT,
      fontSize: '9px',
      color: '#1b2140',
    });
    this.container = scene.add.container(0, 0, [this.frame, this.text]);
    this.container.setDepth(950).setVisible(false);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  show(message: string, target: Phaser.GameObjects.Sprite): void {
    this.target = target;
    this.text.setText(message);
    const w = this.text.width + 16;
    const h = this.text.height + 12;
    this.frame.clear();
    this.frame.fillStyle(0x0b0d1c, 1).fillRect(-w / 2 - 2, -h - 12, w + 4, h + 4);
    this.frame.fillStyle(0xffffff, 1).fillRect(-w / 2, -h - 10, w, h);
    this.frame.fillStyle(0x0b0d1c, 1).fillTriangle(-6, -8, 6, -8, 0, 0);
    this.frame.fillStyle(0xffffff, 1).fillTriangle(-4, -10, 4, -10, 0, -4);
    this.text.setPosition(-w / 2 + 8, -h - 4);
    this.container.setVisible(true);
    this.follow();
  }

  hide(): void {
    this.container.setVisible(false);
    this.target = undefined;
  }

  /** Call every frame so the bubble tracks the sprite while it walks. */
  follow(): void {
    if (!this.target || !this.container.visible) return;
    this.container.setPosition(
      this.target.x,
      this.target.y - this.target.displayHeight * 0.55
    );
  }
}
