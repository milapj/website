import * as Phaser from 'phaser';
import { Direction, GridEngine, GridEngineConfig, Position } from 'grid-engine';
import { DialogBox, PIXEL_FONT } from '../ui/DialogBox';
import { SpeechBubble } from '../ui/SpeechBubble';
import { WellForm } from '../ui/WellForm';
import { TouchPad } from '../ui/TouchPad';
import { INTERACTIONS, INTRO_DIALOG, MYRA_BUBBLES, type Dialog } from '../content';

export const TILE = 16;
export const SCALE = 3;
const TILE_PX = TILE * SCALE;

const PLAYER = 'player';
const MYRA = 'myra';

/** Frames of the floating-rocks sheet (16x48 cells, 3 frames per row). */
const PROP_ROWS: Record<string, number> = {
  'crystal-tall': 0,
  'crystal-small': 1,
  'rock-a': 2,
  'rock-b': 3,
};

/** Head centre inside each character's frame (frame pixels), per facing. */
const HEAD_OFFSETS: Record<string, Record<string, [number, number]>> = {
  [PLAYER]: { down: [25, 23], up: [25, 21], left: [22, 23], right: [28, 23] },
  [MYRA]: { down: [16, 9], up: [16, 6], left: [8, 10], right: [24, 9] },
};

interface Portal {
  target: Position;
  face: Direction;
}

export class WorldScene extends Phaser.Scene {
  private gridEngine!: GridEngine;
  private dialog!: DialogBox;
  private bubble!: SpeechBubble;
  private well!: WellForm;
  private pad!: TouchPad;
  private banner!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

  private signs = new Map<string, string>();
  private portals = new Map<string, Portal>();
  private regions: { name: string; subtitle: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  private subtitle!: Phaser.GameObjects.Text;
  private doorsteps = new Map<string, Phaser.GameObjects.Sprite>();
  private spawns = new Map<string, Position>();

  private myraSprite!: Phaser.GameObjects.Sprite;
  private bubbleIndex = 0;
  private currentRegion: string | null = null;
  private teleporting = false;
  private bumpLock = false;
  private diving = false;
  private helmets: { id: string; sprite: Phaser.GameObjects.Sprite; dome: Phaser.GameObjects.Graphics; radius: number; tint: number }[] = [];
  private breathTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'World' });
  }

  preload(): void {
    this.load.image('cloud-tiles', 'assets/cloud_tileset.png');
    this.load.image('dark-tiles', 'assets/dark_dimension_tileset.png');
    this.load.image('ash-tiles', 'assets/ashlands_tileset.png');
    this.load.image('atlantis-tiles', 'assets/atlantis_tileset.png');
    this.load.image('blocker', 'assets/blocker.png');
    this.load.tilemapTiledJSON('world', 'assets/world.json');
    this.load.spritesheet(PLAYER, 'assets/characters.png', { frameWidth: 52, frameHeight: 72 });
    this.load.spritesheet(MYRA, 'assets/cat.png', { frameWidth: 32, frameHeight: 34 });
    this.load.spritesheet('door', 'assets/dark_dimension_doorA.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('floaters', 'assets/dark_dimension_floating_rocks.png', { frameWidth: 16, frameHeight: 48 });
    this.load.spritesheet('plaques', 'assets/plaques.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('flame', 'assets/flame.png', { frameWidth: 12, frameHeight: 20 });
    this.load.spritesheet('trophies', 'assets/trophies.png', { frameWidth: 16, frameHeight: 16 });
    this.load.image('trophy-big', 'assets/trophy_big.png');
    this.load.image('statue', 'assets/statue.png');
    this.load.spritesheet('bubbles', 'assets/atlantis_bubbles.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('ash-sheet', 'assets/ashlands_tileset.png', { frameWidth: 16, frameHeight: 16 });
  }

  create(): void {
    const map = this.make.tilemap({ key: 'world' });
    const tilesets = [
      map.addTilesetImage('Cloud City', 'cloud-tiles'),
      map.addTilesetImage('Dark Dimension', 'dark-tiles'),
      map.addTilesetImage('Ashlands', 'ash-tiles'),
      map.addTilesetImage('Atlantis', 'atlantis-tiles'),
      map.addTilesetImage('Blocker', 'blocker'),
    ].filter((t): t is Phaser.Tilemaps.Tileset => t !== null);
    for (const layerData of map.layers) {
      map.createLayer(layerData.name, tilesets, 0, 0)?.setScale(SCALE);
    }

    this.createAnimations();
    this.readObjects(map);

    const playerSprite = this.add.sprite(0, 0, PLAYER).setScale(1.5);
    this.myraSprite = this.add.sprite(0, 0, MYRA).setScale(2);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels * SCALE, map.heightInPixels * SCALE);
    cam.startFollow(playerSprite, true);
    cam.setRoundPixels(true);

    const config: GridEngineConfig = {
      characters: [
        {
          id: PLAYER,
          sprite: playerSprite,
          walkingAnimationMapping: 4,
          startPosition: this.spawns.get('spawn-player') ?? { x: 46, y: 40 },
          collides: { collisionGroups: ['cg1'] },
        },
        {
          id: MYRA,
          sprite: this.myraSprite,
          walkingAnimationMapping: {
            up: { leftFoot: 30, standing: 31, rightFoot: 32 },
            down: { leftFoot: 3, standing: 4, rightFoot: 5 },
            left: { leftFoot: 12, standing: 13, rightFoot: 14 },
            right: { leftFoot: 21, standing: 22, rightFoot: 23 },
          },
          startPosition: this.spawns.get('spawn-myra') ?? { x: 48, y: 41 },
          speed: 3,
          collides: { collisionGroups: ['cg1'] },
        },
      ],
    };
    this.gridEngine.create(map, config);
    this.gridEngine.follow(MYRA, PLAYER, 1, true);
    this.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
      if (charId === PLAYER) this.onPlayerArrived(enterTile.x, enterTile.y);
    });

    this.startBubbles();
    this.helmets = [
      { id: PLAYER, sprite: playerSprite, dome: this.add.graphics().setVisible(false), radius: 21, tint: 0x7d9fe0 },
      { id: MYRA, sprite: this.myraSprite, dome: this.add.graphics().setVisible(false), radius: 14, tint: 0xa9c8ff },
    ];
    // helmets are placed after Grid Engine has moved the sprites this frame
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.diving) this.followHelmets();
    });
    this.setupInput();
    this.dialog = new DialogBox(this);
    this.bubble = new SpeechBubble(this);
    this.well = new WellForm(this);
    this.pad = new TouchPad(this, () => this.tryInteract());
    this.addHud();

    this.dialog.open(INTRO_DIALOG);
  }

  update(): void {
    this.bubble.follow();
    this.updateMyraBubble();
    if (this.dialog.isOpen || this.teleporting || this.well.isOpen) return;
    const c = this.cursors;
    const k = this.wasd;
    let dir: Direction | null = null;
    if (c.left.isDown || k.left.isDown) dir = Direction.LEFT;
    else if (c.right.isDown || k.right.isDown) dir = Direction.RIGHT;
    else if (c.up.isDown || k.up.isDown) dir = Direction.UP;
    else if (c.down.isDown || k.down.isDown) dir = Direction.DOWN;
    else if (this.pad.held) dir = this.pad.held;
    if (!dir) {
      this.bumpLock = false;
      return;
    }

    // Walking into a sign or plaque reads it straight away. The lock stops it
    // reopening until the key is released.
    if (!this.gridEngine.isMoving(PLAYER)) {
      const pos = this.gridEngine.getPosition(PLAYER);
      const ahead = step(pos, dir);
      const signId = this.signs.get(key(ahead.x, ahead.y));
      if (signId) {
        this.gridEngine.turnTowards(PLAYER, dir);
        if (!this.bumpLock) {
          this.bumpLock = true;
          this.say(INTERACTIONS[signId], signId);
        }
        return;
      }
    }
    this.gridEngine.move(PLAYER, dir);
  }

  // ------------------------------------------------------------------ setup

  private createAnimations(): void {
    for (const [kind, row] of Object.entries(PROP_ROWS)) {
      const f = row * 3;
      this.anims.create({
        key: `float-${kind}`,
        frames: [f, f + 1, f + 2, f + 1].map((frame) => ({ key: 'floaters', frame })),
        frameRate: 4,
        repeat: -1,
      });
    }
    this.anims.create({ key: 'flame', frames: this.anims.generateFrameNumbers('flame', { start: 0, end: 3 }), frameRate: 9, repeat: -1 });
    // RPG Maker door sheet: rows are opening stages, middle column of each
    this.anims.create({
      key: 'door-open',
      frames: [1, 4, 7, 10].map((frame) => ({ key: 'door', frame })),
      frameRate: 8,
    });
  }

  /** Object layer written by tools/build_map.py. */
  private readObjects(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('interactions');
    for (const o of layer?.objects ?? []) {
      const x = Math.round((o.x ?? 0) / TILE);
      const y = Math.round((o.y ?? 0) / TILE);
      const name = o.name ?? '';
      const props: Record<string, string | number> = {};
      for (const p of (o.properties ?? []) as { name: string; value: string | number }[]) {
        props[p.name] = p.value;
      }
      switch (o.type) {
        case 'spawn':
          this.spawns.set(name, { x, y });
          break;
        case 'sign':
          this.signs.set(key(x, y), name);
          if (props.medal) this.addMedal(String(props.medal), x, y);
          if (props.fire && props.anchor !== 'no') this.addFire(String(props.fire), x, y, props.big === 'yes');
          if (props.trophy && props.anchor !== 'no') this.addTrophy(String(props.trophy), props.big === 'yes', x, y);
          break;
        case 'region':
          this.regions.push({
            name: String(props.title ?? name),
            subtitle: String(props.subtitle ?? ''),
            x0: x,
            y0: y,
            x1: x + Math.round((o.width ?? TILE) / TILE) - 1,
            y1: y + Math.round((o.height ?? TILE) / TILE) - 1,
          });
          break;
        case 'portal':
          this.portals.set(key(x, y), {
            target: { x: Number(props.tx), y: Number(props.ty) },
            face: String(props.face) === 'down' ? Direction.DOWN : Direction.UP,
          });
          break;
        case 'prop':
          this.addProp(String(props.kind ?? name), x, y);
          break;
        case 'statue':
          // 2x3 angel statue whose bottom-left tile is (x, y), nudged down `dy` px
          this.add
            .image((x + 1) * TILE_PX + Number(props.dx ?? 0) * SCALE, (y + 1) * TILE_PX + Number(props.dy ?? 0) * SCALE, 'statue')
            .setOrigin(0.5, 1)
            .setScale(SCALE)
            .setDepth(4);
          break;
        case 'door':
          this.addDoor(x, y, Number(props.cols ?? 2), Number(props.rows ?? 3));
          break;
      }
    }
  }

  private addProp(kind: string, x: number, y: number): void {
    const s = this.add
      .sprite((x + 0.5) * TILE_PX, (y + 1) * TILE_PX, 'floaters')
      .setOrigin(0.5, 1)
      .setScale(SCALE)
      .setDepth(4);
    s.play({ key: `float-${kind}`, startFrame: Phaser.Math.Between(0, 3) });
    s.anims.msPerFrame = 250 + Phaser.Math.Between(-60, 60);
  }

  /** Underwater both characters wear diving gear: a glass helmet dome over
   *  the head, a wetsuit tint, and a trickle of breath bubbles. */
  private setDiving(on: boolean): void {
    if (on === this.diving) return;
    this.diving = on;
    for (const h of this.helmets) {
      if (on) h.sprite.setTint(h.tint);
      else h.sprite.clearTint();
      h.dome.setVisible(on);
    }
    this.breathTimer?.remove();
    this.breathTimer = undefined;
    if (on) {
      this.followHelmets();
      this.breathTimer = this.time.addEvent({
        delay: 650,
        loop: true,
        callback: () => {
          const h = Phaser.Math.RND.pick(this.helmets);
          this.spawnBubble(h.dome.x + h.radius * 0.6, h.dome.y - h.radius * 0.4, true);
        },
      });
    }
  }

  private followHelmets(): void {
    for (const h of this.helmets) {
      const dir = this.gridEngine.getFacingDirection(h.id);
      const [hx, hy] = HEAD_OFFSETS[h.id][dir] ?? HEAD_OFFSETS[h.id].down;
      const r = h.radius;
      h.dome
        .setPosition(h.sprite.x + hx * h.sprite.scaleX, h.sprite.y + hy * h.sprite.scaleY)
        .setDepth(h.sprite.depth + 1);
      h.dome.clear();
      h.dome.fillStyle(0xa8ecff, 0.28).fillCircle(0, 0, r);
      h.dome.lineStyle(3, 0xeaffff, 0.9).strokeCircle(0, 0, r);
      h.dome.fillStyle(0xffffff, 0.75).fillCircle(-r * 0.4, -r * 0.45, r * 0.16);
      h.dome.fillStyle(0x3a4a66, 1).fillRect(-r * 0.55, r * 0.75, r * 1.1, 5);
    }
  }

  /** Bubbles rise everywhere underwater: the Sunken City and the vault. Only
   *  the part of a region inside the camera view spawns them. */
  private startBubbles(): void {
    const water = this.regions.filter((r) => r.name === 'PERSONAL PROJECTS' || r.name === 'SIDE PROJECTS');
    if (water.length === 0) return;
    this.time.addEvent({
      delay: 130,
      loop: true,
      callback: () => {
        const view = this.cameras.main.worldView;
        for (const r of water) {
          const x0 = Math.max(r.x0 * TILE_PX, view.x - 48);
          const x1 = Math.min((r.x1 + 1) * TILE_PX, view.right + 48);
          const y0 = Math.max(r.y0 * TILE_PX + 96, view.y + 48);
          const y1 = Math.min((r.y1 + 1) * TILE_PX, view.bottom + 48);
          if (x1 <= x0 || y1 <= y0) continue;
          this.spawnBubble(Phaser.Math.Between(x0, x1), Phaser.Math.Between(y0, y1));
        }
      },
    });
  }

  private spawnBubble(x: number, y: number, breath = false): void {
    // single bubbles (cols 0 and 3) pop at the top; clusters (cols 6 and 9) fade
    const single = breath || Math.random() < 0.7;
    const col = breath ? 0 : single ? Phaser.Math.RND.pick([0, 3]) : Phaser.Math.RND.pick([6, 9]);
    const row = breath ? 1 : Phaser.Math.Between(1, 3);
    const b = this.add
      .sprite(x, y, 'bubbles', row * 12 + col)
      .setScale(SCALE)
      .setDepth(20)
      .setAlpha(0.85);
    this.tweens.add({
      targets: b,
      x: x + Phaser.Math.Between(-12, 12),
      duration: Phaser.Math.Between(600, 1100),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: b,
      y: y - Phaser.Math.Between(150, 280),
      duration: Phaser.Math.Between(2200, 3600),
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (!single) {
          this.tweens.add({ targets: b, alpha: 0, duration: 250, onComplete: () => b.destroy() });
          return;
        }
        b.setFrame(6 * 12 + col);
        this.time.delayedCall(90, () => {
          b.setFrame(7 * 12 + col);
          this.time.delayedCall(90, () => b.destroy());
        });
      },
    });
  }

  /** A trophy on a shelf: gold ones glow and sparkle, silver ones gleam, the
   *  big ones stand 2x2 in the showcase. */
  private addTrophy(tier: string, big: boolean, x: number, y: number): void {
    const frame = { gold: 0, silver: 1, bronze: 2 }[tier] ?? 1;
    const px = big ? (x + 1) * TILE_PX : (x + 0.5) * TILE_PX;
    const py = (y + 1) * TILE_PX;
    const make = () =>
      big
        ? this.add.image(px, py, 'trophy-big').setOrigin(0.5, 1).setScale(SCALE)
        : this.add.sprite(px, py, 'trophies', frame).setOrigin(0.5, 1).setScale(SCALE);
    make().setDepth(4);
    if (tier === 'bronze') return;
    const glow = make().setDepth(4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.05, to: tier === 'gold' ? 0.55 : 0.25 },
      duration: tier === 'gold' ? 1000 : 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    if (tier !== 'gold') return;
    const spread = big ? 40 : 18;
    const height = big ? 90 : 42;
    const sparkle = this.add.graphics().setDepth(5).setScale(0);
    sparkle.fillStyle(0xffffff, 1);
    sparkle.fillRect(-1.5, -7, 3, 14);
    sparkle.fillRect(-7, -1.5, 14, 3);
    sparkle.fillRect(-3, -3, 6, 6);
    this.time.addEvent({
      delay: (big ? 700 : 1300) + Phaser.Math.Between(0, 900),
      loop: true,
      callback: () => {
        sparkle.setPosition(px + Phaser.Math.Between(-spread, spread), py - Phaser.Math.Between(10, height));
        this.tweens.add({ targets: sparkle, scale: { from: 0, to: big ? 1.6 : 1 }, duration: 260, yoyo: true, ease: 'Sine.easeOut' });
      },
    });
  }

  /** A stone plaque that is either burning (current job) or ashen and
   *  smouldering (a previous job): dim embers, faint red glow, rising smoke. */
  private addFire(kind: string, x: number, y: number, big = false): void {
    const k = big ? 2 : 1; // big plaques are 2x2 tiles
    const px = (x + 0.5 * k) * TILE_PX;
    const py = (y + 1) * TILE_PX;
    const top = (y + 1 - k) * TILE_PX + 6 * k;
    const smoldering = kind === 'smoldering';
    const plaque = this.add.sprite(px, py, 'ash-sheet', 75).setOrigin(0.5, 1).setScale(SCALE * k).setDepth(4);
    if (smoldering) plaque.setTint(0x7a7378);

    for (const [dx, phase] of [[-15 * k, 0], [15 * k, 2]] as const) {
      const f = this.add
        .sprite(px + dx, top + 10 * k, 'flame')
        .setOrigin(0.5, 1)
        .setScale((smoldering ? SCALE * 0.5 : SCALE) * k)
        .setDepth(5);
      f.play({ key: 'flame', startFrame: phase });
      if (smoldering) {
        f.setAlpha(0.75).setTint(0xff9a4a);
        f.anims.msPerFrame = 220;
        this.tweens.add({ targets: f, alpha: { from: 0.35, to: 0.8 }, duration: 700 + phase * 150, yoyo: true, repeat: -1 });
      } else {
        this.tweens.add({ targets: f, scaleX: SCALE * 0.85 * k, duration: 180 + phase * 40, yoyo: true, repeat: -1 });
      }
    }

    const glow = this.add.graphics().setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(smoldering ? 0xb0301a : 0xff7a1a, smoldering ? 0.12 : 0.18).fillEllipse(px, top + 30 * k, 96 * k, 50 * k);
    this.tweens.add({ targets: glow, alpha: { from: 0.4, to: 1 }, duration: smoldering ? 1300 : 420, yoyo: true, repeat: -1 });

    if (smoldering) {
      // wisps of smoke drifting up and fading
      this.time.addEvent({
        delay: 420,
        loop: true,
        callback: () => {
          const puff = this.add.graphics().setDepth(6).setAlpha(0.5);
          puff.fillStyle(0x9a9aa0, 1).fillCircle(0, 0, Phaser.Math.Between(4, 7));
          puff.setPosition(px + Phaser.Math.Between(-14 * k, 14 * k), top + 4);
          this.tweens.add({
            targets: puff,
            y: top - Phaser.Math.Between(50, 80) * k,
            x: puff.x + Phaser.Math.Between(-10, 10),
            alpha: 0,
            scale: 1.8,
            duration: Phaser.Math.Between(1400, 2000),
            ease: 'Sine.easeOut',
            onComplete: () => puff.destroy(),
          });
        },
      });
    }
  }

  /** A gold / silver / bronze plaque that glows and sparkles. */
  private addMedal(medal: string, x: number, y: number): void {
    const frame = { gold: 0, silver: 1, bronze: 2 }[medal] ?? 0;
    const px = (x + 0.5) * TILE_PX;
    const py = (y + 1) * TILE_PX;
    this.add.sprite(px, py, 'plaques', frame).setOrigin(0.5, 1).setScale(SCALE).setDepth(4);
    const glow = this.add
      .sprite(px, py, 'plaques', frame)
      .setOrigin(0.5, 1)
      .setScale(SCALE)
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.05, to: 0.5 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // a four-point sparkle that pops up at a random spot on the plaque
    const sparkle = this.add.graphics().setDepth(5).setScale(0);
    sparkle.fillStyle(0xffffff, 1);
    sparkle.fillRect(-1.5, -7, 3, 14);
    sparkle.fillRect(-7, -1.5, 14, 3);
    sparkle.fillRect(-3, -3, 6, 6);
    this.time.addEvent({
      delay: 1300 + Phaser.Math.Between(0, 900),
      loop: true,
      callback: () => {
        sparkle.setPosition(px + Phaser.Math.Between(-18, 18), py - Phaser.Math.Between(14, 40));
        this.tweens.add({ targets: sparkle, scale: { from: 0, to: 1 }, duration: 260, yoyo: true, ease: 'Sine.easeOut' });
      },
    });
  }

  /** The animated castle door covering a `cols` x `rows` doorway whose top-left
   *  tile is (x, y). It opens when the player steps onto the doorstep below. */
  private addDoor(x: number, y: number, cols: number, rows: number): void {
    const sprite = this.add
      .sprite((x + cols / 2) * TILE_PX, (y + rows) * TILE_PX, 'door', 1)
      .setOrigin(0.5, 1)
      .setScale(SCALE)
      .setDepth(4);
    for (let i = -1; i <= cols; i++) {
      this.doorsteps.set(key(x + i, y + rows), sprite);
    }
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error('Keyboard input is unavailable');
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    kb.on('keydown-SPACE', () => this.tryInteract());
    kb.on('keydown-ENTER', () => this.tryInteract());
  }

  private addHud(): void {
    this.add
      .text(14, 12, TouchPad.isTouchDevice() ? 'D-PAD: walk   BUTTON: read / talk' : 'ARROWS / WASD: walk   SPACE: read / talk', {
        fontFamily: PIXEL_FONT,
        fontSize: '10px',
        color: '#dfe3ff',
        stroke: '#0b0d1c',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(900);
    this.subtitle = this.add
      .text(this.cameras.main.width / 2, 62, '', {
        fontFamily: PIXEL_FONT,
        fontSize: '13px',
        color: '#ffe066',
        stroke: '#0b0d1c',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(900)
      .setAlpha(0);
    this.banner = this.add
      .text(this.cameras.main.width / 2, 92, '', {
        fontFamily: PIXEL_FONT,
        fontSize: '26px',
        color: '#ffe066',
        stroke: '#0b0d1c',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(900)
      .setAlpha(0);
  }

  // ------------------------------------------------------------ interaction

  /** SPACE while facing a sign or plaque reads it; facing Myra talks to her. */
  private tryInteract(): void {
    if (this.dialog.isOpen || this.dialog.justClosed || this.teleporting || this.well.isOpen) return;
    if (this.gridEngine.isMoving(PLAYER)) return;

    const facing = this.gridEngine.getFacingPosition(PLAYER);
    const signId = this.signs.get(key(facing.x, facing.y));
    if (signId) {
      this.say(INTERACTIONS[signId], signId);
      return;
    }
    const myra = this.gridEngine.getPosition(MYRA);
    if (myra.x === facing.x && myra.y === facing.y) {
      this.gridEngine.turnTowards(MYRA, opposite(this.gridEngine.getFacingDirection(PLAYER)));
      this.say(INTERACTIONS.myra);
    }
  }

  private onPlayerArrived(x: number, y: number): void {
    const k = key(x, y);

    const portal = this.portals.get(k);
    if (portal) {
      this.teleport(portal);
      return;
    }

    const door = this.doorsteps.get(k);
    if (door && door.anims.currentAnim?.key !== 'door-open') door.play('door-open');

    this.updateRegion(x, y);
  }

  /** Banner + persistent label when the player crosses into another land. */
  private updateRegion(x: number, y: number): void {
    const here = this.regions.find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    const name = here?.name ?? null;
    if (name === this.currentRegion) return;
    this.currentRegion = name;
    if (here) this.showBanner(here.name, here.subtitle);
    else this.hideBanner();
    this.setDiving(name === 'PERSONAL PROJECTS' || name === 'SIDE PROJECTS');
  }

  private teleport(portal: Portal): void {
    this.teleporting = true;
    const cam = this.cameras.main;
    cam.fadeOut(180, 5, 6, 15);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const { x, y } = portal.target;
      this.gridEngine.setPosition(PLAYER, { x, y });
      this.gridEngine.turnTowards(PLAYER, portal.face);
      // Myra reappears beside the player, never on the doorway itself
      this.gridEngine.setPosition(MYRA, { x: x + 1, y });
      this.gridEngine.turnTowards(MYRA, portal.face);
      this.updateRegion(x, y);
      cam.fadeIn(220, 5, 6, 15);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.teleporting = false;
      });
    });
  }

  /** The land's name stays on screen while the player is inside it. */
  private showBanner(title: string, subtitle: string): void {
    this.banner.setText(title);
    this.subtitle.setText(subtitle);
    const targets = [this.banner, this.subtitle];
    this.tweens.killTweensOf(targets);
    this.tweens.add({ targets, alpha: 1, duration: 300 });
  }

  private hideBanner(): void {
    const targets = [this.banner, this.subtitle];
    this.tweens.killTweensOf(targets);
    this.tweens.add({ targets, alpha: 0, duration: 300 });
  }

  /** Myra asks for treats whenever she and the player face each other or
   *  she catches up right next to the player. */
  private updateMyraBubble(): void {
    const player = this.gridEngine.getPosition(PLAYER);
    const myra = this.gridEngine.getPosition(MYRA);
    const playerFacing = this.gridEngine.getFacingPosition(PLAYER);
    const myraFacing = this.gridEngine.getFacingPosition(MYRA);
    const meeting =
      !this.dialog.isOpen &&
      !this.gridEngine.isMoving(MYRA) &&
      ((playerFacing.x === myra.x && playerFacing.y === myra.y) ||
        (myraFacing.x === player.x && myraFacing.y === player.y));

    if (meeting && !this.bubble.visible) {
      const line = MYRA_BUBBLES[this.bubbleIndex % MYRA_BUBBLES.length];
      this.bubbleIndex += 1;
      this.bubble.show(line, this.myraSprite);
    } else if (!meeting && this.bubble.visible) {
      this.bubble.hide();
    }
  }

  private say(pages: Dialog | undefined, id?: string): void {
    if (!pages) return;
    this.bubble.hide();
    // the well's dialog leads straight into its form
    this.dialog.open(pages, id === 'fountain' ? () => this.well.open() : undefined);
  }
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function step(p: Position, d: Direction): Position {
  switch (d) {
    case Direction.UP:
      return { x: p.x, y: p.y - 1 };
    case Direction.DOWN:
      return { x: p.x, y: p.y + 1 };
    case Direction.LEFT:
      return { x: p.x - 1, y: p.y };
    case Direction.RIGHT:
      return { x: p.x + 1, y: p.y };
    default:
      return p;
  }
}

function opposite(d: Direction): Direction {
  switch (d) {
    case Direction.UP:
      return Direction.DOWN;
    case Direction.DOWN:
      return Direction.UP;
    case Direction.LEFT:
      return Direction.RIGHT;
    case Direction.RIGHT:
      return Direction.LEFT;
    default:
      return Direction.DOWN;
  }
}
