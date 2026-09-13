import * as Phaser from 'phaser';
import type { Dialog } from '../content';

export const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';

const BOX_HEIGHT = 176;
const NARROW = 700; // canvases narrower than this get a taller box and smaller type
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
  private readonly linkButton: Phaser.GameObjects.Graphics;
  /** Link button bounds in game pixels, for canvas touch hit-testing. */
  private linkRect = new Phaser.Geom.Rectangle();
  private linkTouch: number | null = null;
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

    // a real button for links: big enough for a thumb, well inside the box
    this.linkButton = scene.add.graphics();
    this.linkHint = scene.add.text(0, 0, 'OPEN LINK  (or press O)', {
      fontFamily: PIXEL_FONT,
      fontSize: '11px',
      color: '#dff3ff',
    });
    this.linkButton.setVisible(false);
    this.linkHint.setVisible(false);
    this.linkHint.setInteractive({ useHandCursor: true });
    this.linkHint.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.wasTouch) return; // touches are handled on the canvas below
      this.openLink();
    });
    // touch: claim taps on the button before Phaser sees them (capture phase
    // on the document), otherwise Phaser's own touchstart advances/closes the
    // dialog first. The link opens on the matching touchend, a user gesture,
    // so the browser allows the new tab.
    const canvas = scene.game.canvas;
    const onLinkButton = (t: Touch): boolean => {
      if (!this.isOpen || !this.pages[this.pageIndex]?.link) return false;
      const r = canvas.getBoundingClientRect();
      const cam = scene.cameras.main;
      const gx = ((t.clientX - r.left) * cam.width) / r.width;
      const gy = ((t.clientY - r.top) * cam.height) / r.height;
      return this.linkRect.contains(gx, gy);
    };
    document.addEventListener(
      'touchstart',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (e.target === canvas && onLinkButton(t)) {
            this.linkTouch = t.identifier;
            e.preventDefault();
            e.stopPropagation();
          }
        }
      },
      { capture: true, passive: false }
    );
    document.addEventListener(
      'touchend',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier !== this.linkTouch) continue;
          this.linkTouch = null;
          e.preventDefault();
          e.stopPropagation();
          if (onLinkButton(t)) this.openLink();
        }
      },
      { capture: true, passive: false }
    );

    this.container = scene.add.container(0, 0, [
      this.frame,
      this.tab,
      this.speakerText,
      this.bodyText,
      this.cursor,
      this.linkButton,
      this.linkHint,
    ]);
    // pin every child to the camera too; hit-testing uses the child's own
    // scroll factor
    this.container.setScrollFactor(0, 0, true).setDepth(1000).setVisible(false);

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
    this.linkButton.setVisible(Boolean(page.link));

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

  private get boxHeight(): number {
    return this.scene.cameras.main.width < NARROW ? 250 : BOX_HEIGHT;
  }

  private layout(): void {
    const cam = this.scene.cameras.main;
    const narrow = cam.width < NARROW;
    const BOX_HEIGHT = this.boxHeight;
    this.bodyText.setFontSize(narrow ? 11 : 15);
    this.bodyText.setLineSpacing(narrow ? 8 : 11);
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
    const bw = this.linkHint.width + 32;
    const bh = 40;
    const bx = x + PADDING + 4;
    const by = y + BOX_HEIGHT - PADDING - bh - 2;
    this.linkRect.setTo(bx - 8, by - 8, bw + 16, bh + 16); // generous touch target
    this.linkButton.clear();
    this.linkButton.fillStyle(0x0b0d1c, 1).fillRoundedRect(bx - 3, by - 3, bw + 6, bh + 6, 8);
    this.linkButton.fillStyle(0x2c3570, 1).fillRoundedRect(bx, by, bw, bh, 6);
    this.linkButton.lineStyle(2, 0x8fd3ff, 1).strokeRoundedRect(bx, by, bw, bh, 6);
    this.linkHint.setPosition(bx + 16, by + (bh - this.linkHint.height) / 2);
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
    const y = cam.height - this.boxHeight - MARGIN - 22;
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
