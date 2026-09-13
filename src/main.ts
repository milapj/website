import * as Phaser from 'phaser';
import { GridEngine } from 'grid-engine';
import { WorldScene } from './scenes/WorldScene';

const config: Phaser.Types.Core.GameConfig = {
  title: 'Dr. Milap Jhumkhawala',
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05060f',
  pixelArt: true,
  render: { antialias: false, roundPixels: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1024,
    height: 768,
  },
  scene: [WorldScene],
  plugins: {
    scene: [{ key: 'gridEngine', plugin: GridEngine, mapping: 'gridEngine' }],
  },
};

/** Start once the pixel font is ready so the first dialog renders with it. */
async function start(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts) {
    try {
      await Promise.race([
        fonts.load('16px "Press Start 2P"'),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {
      // fall back to the system monospace font
    }
  }
  const game = new Phaser.Game(config);
  // Handy for poking at the running game from the browser console.
  (window as unknown as { game: Phaser.Game }).game = game;
}

void start();
