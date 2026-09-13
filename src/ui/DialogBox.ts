import * as Phaser from 'phaser';
import type { Dialog } from '../content';

export const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';

const BOX_HEIGHT = 176;
const MARGIN = 24;
const PADDING = 26;
const TYPE_DELAY_MS = 22;

/**
 * Retro RPG dialog box, fixed to the camera. Pages are typed out one
 * character at a time; SPACE / ENTER / click finishes the page, then advances,
 * then closes. Emits nothing; call `open(pages, onClose)`.
 */
export class DialogBox {
  isOpen = false;

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly tab: Phaser.GameObjects.Graphics;
  private readonly speakerText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly cursor: Phaser.GameObjects.Graphics;
  private readonly linkHint: Phaser.GameObjects.Text;
  private cursorTween!: Phaser.Tweens.Tween;

  private pages: Dialog = [];
  private pageIndex = 0;
  private fullText = '';
  private typedChars = 0;
  private typeTimer?: Phaser.Time.TimerEvent;
  private onClose?: () => void;
  private closedAt = -Infinity;
  private openedAt = -Infinity;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.frame = scene.add.graphics();
    this.tab = scene.add.graphics();
    this.speakerText = scene.add.text(0, 0, '', {
      fontFamily: PIXEL_FONT,
      fontSize: '12px',
      color: '#ffe066',
    });
    this.bodyText = scene.add.text(0, 0, '', {
      fontFamily: PIXEL_FONT,
      fontSize: '15px',
      color: '#f4f4f8',
      lineSpacing: 11,
    });
    // "more" indicator: a small drawn triangle, so no font glyph is needed
    this.cursor = scene.add.graphics();
    this.cursor.fillStyle(0xffe066, 1).fillTriangle(0, 0, 14, 0, 7, 9);
    this.cursor.setVisible(false);

    this.linkHint = scene.add.text(0, 0, 'Letter O: open link', {
      fontFamily: PIXEL_FONT,
      fontSize: '10px',
      color: '#8fd3ff',
    });
    this.linkHint.setVisible(false);

    this.container = scene.add.container(0, 0, [
      this.frame,
      this.tab,
      this.speakerText,
      this.bodyText,
      this.cursor,
      this.linkHint,
    ]);
    this.container.setScrollFactor(0).setDepth(1000).setVisible(false);

    scene.input.keyboard?.on('keydown-SPACE', this.advance, this);
    scene.input.keyboard?.on('keydown-ENTER', this.advance, this);
    scene.input.on('pointerdown', this.advance, this);
    scene.input.keyboard?.on('keydown-O', this.openLink, this);
    scene.scale.on('resize', this.layout, this);
    this.layout();
  }

  /** True during the frame in which the box was closed, so the key press
   *  that closed it is not also treated as a new interaction. */
  get justClosed(): boolean {
    return Date.now() - this.closedAt < 120;
  }

  open(pages: Dialog, onClose?: () => void): void {
    if (pages.length === 0) return;
    this.pages = pages;
    this.pageIndex = 0;
    this.onClose = onClose;
    this.isOpen = true;
    this.openedAt = Date.now();
    this.container.setVisible(true);
    this.showPage();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.typeTimer?.remove();
    this.typeTimer = undefined;
    this.container.setVisible(false);
    this.cursor.setVisible(false);
    this.cursorTween.pause();
    this.closedAt = Date.now();
    const cb = this.onClose;
    this.onClose = undefined;
    cb?.();
  }

  /** Opens the current page's link, if it has one, in a new tab. */
  private openLink(): void {
    if (!this.isOpen) return;
    const link = this.pages[this.pageIndex]?.link;
    if (link) window.open(link, '_blank', 'noopener');
  }

  private advance(): void {
    if (!this.isOpen) return;
    // the key press that opened the box must not also skip the typing
    if (Date.now() - this.openedAt < 120) return;
    if (this.typedChars < this.fullText.length) {
      this.typedChars = this.fullText.length;
      this.bodyText.setText(this.fullText);
      this.finishTyping();
      return;
    }
    if (this.pageIndex + 1 < this.pages.length) {
      this.pageIndex += 1;
      this.showPage();
    } else {
      this.close();
    }
  }

  private showPage(): void {
    const page = this.pages[this.pageIndex];
    this.fullText = page.text;
    this.typedChars = 0;
    this.bodyText.setText('');
    this.cursor.setVisible(false);
    this.cursorTween.pause();
    this.drawTab(page.speaker ?? '');
    this.linkHint.setVisible(Boolean(page.link));

    this.typeTimer?.remove();
    this.typeTimer = this.scene.time.addEvent({
      delay: TYPE_DELAY_MS,
      loop: true,
      callback: () => {
        this.typedChars += 1;
        this.bodyText.setText(this.fullText.slice(0, this.typedChars));
        if (this.typedChars >= this.fullText.length) this.finishTyping();
      },
    });
  }

  private finishTyping(): void {
    this.typeTimer?.remove();
    this.typeTimer = undefined;
    this.cursor.setVisible(true);
    this.cursorTween.restart();
    this.cursorTween.resume();
  }

  private layout(): void {
    const cam = this.scene.cameras.main;
    const w = cam.width - MARGIN * 2;
    const x = MARGIN;
    const y = cam.height - BOX_HEIGHT - MARGIN;

    this.frame.clear();
    // outer dark rim, white bevel, deep blue panel, thin accent line
    this.frame.fillStyle(0x0b0d1c, 1).fillRect(x - 4, y - 4, w + 8, BOX_HEIGHT + 8);
    this.frame.fillStyle(0xf4f4f8, 1).fillRect(x, y, w, BOX_HEIGHT);
    this.frame.fillStyle(0x1b2140, 0.97).fillRect(x + 4, y + 4, w - 8, BOX_HEIGHT - 8);
    this.frame.lineStyle(2, 0x5865c9, 1).strokeRect(x + 9, y + 9, w - 18, BOX_HEIGHT - 18);

    this.bodyText.setPosition(x + PADDING, y + PADDING + 6);
    this.bodyText.setWordWrapWidth(w - PADDING * 2, true);
    this.linkHint.setPosition(x + PADDING, y + BOX_HEIGHT - PADDING - 4);
    const cursorX = x + w - PADDING - 14;
    const cursorY = y + BOX_HEIGHT - PADDING - 6;
    this.cursor.setPosition(cursorX, cursorY);
    // the bob tween needs absolute values, so rebuild it whenever we lay out
    this.cursorTween?.destroy();
    this.cursorTween = this.scene.tweens.add({
      targets: this.cursor,
      y: { from: cursorY, to: cursorY + 6 },
      duration: 380,
      yoyo: true,
      repeat: -1,
      paused: !this.cursor.visible,
    });
    this.drawTab(this.speakerText.text);
  }

  private drawTab(speaker: string): void {
    const cam = this.scene.cameras.main;
    const x = MARGIN + 18;
    const y = cam.height - BOX_HEIGHT - MARGIN - 22;
    this.speakerText.setText(speaker);
    this.tab.clear();
    if (!speaker) return;
    const w = this.speakerText.width + 28;
    const h = 30;
    this.tab.fillStyle(0x0b0d1c, 1).fillRect(x - 4, y - 4, w + 8, h + 8);
    this.tab.fillStyle(0xf4f4f8, 1).fillRect(x, y, w, h);
    this.tab.fillStyle(0x2c3570, 1).fillRect(x + 4, y + 4, w - 8, h - 8);
    this.speakerText.setPosition(x + 14, y + 9);
  }
}
