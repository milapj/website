import { Direction, GridEngine } from "grid-engine";
import * as Phaser from "phaser";
import * as React from 'react'

const sceneConfig: Phaser.Types.Scenes.SettingsConfig = {
  active: false,
  visible: false,
  key: "Game",
};

export class GameScene extends Phaser.Scene {
  private gridEngine!: GridEngine;
  private dialogText!: Phaser.GameObjects.Text;

  constructor() {
    super(sceneConfig);
  }

 
  create() {
    const cloudCityTilemap = this.make.tilemap({ key: "cloud-city-map" });
    cloudCityTilemap.addTilesetImage("Cloud City", "tiles");
    for (let i = 0; i < cloudCityTilemap.layers.length; i++) {
      const layer = cloudCityTilemap.createLayer(i, "Cloud City", 0, 0);
      layer.scale = 3;
    }
    const playerSprite = this.add.sprite(0, 0, "player");
    playerSprite.scale = 1.5;
  
    this.cameras.main.startFollow(playerSprite, true);
    this.cameras.main.setFollowOffset(
      -playerSprite.width,
      -playerSprite.height
    );

    this.cameras.main.setFollowOffset(-playerSprite.width, -playerSprite.height);

    console.log('Camera position:', this.cameras.main.scrollX, this.cameras.main.scrollY);

    const gridEngineConfig = {
      characters: [
        {
          id: "player",
          sprite: playerSprite,
          walkingAnimationMapping: 6,
          startPosition: { x: 3, y: 3 },
        },
      ],
    };
    
    this.gridEngine.create(cloudCityTilemap, gridEngineConfig);

    const dialogText = this.add.text(
      1*48, // X position
      4*48, // Y position
      "", // Initial text
      {
        fontSize: '48px',
        wordWrap: { width: this.cameras.main.width - 32 },
        color: '#000000'
      }
    );

    this.gridEngine
      .positionChangeFinished()
      .subscribe(({ charId, enterTile, exitTile }) => {
        // Check if the player has entered tile (3, 6) and hide the dialog
        enterTile.y = enterTile.y - 1
        // console.log(enterTile.x, enterTile.y)
        console.log(this.gridEngine.getFacingDirection('player'))
        console.log(this.gridEngine.getFacingPosition('player').y)
        console.log(enterTile.y)
        if(hasTrigger(cloudCityTilemap, enterTile) && 
        this.gridEngine.getFacingPosition('player').y == enterTile.y) {
          const dialogMessage = "Hi, I'm Milap!";
          dialogText.text = dialogMessage
          dialogText.visible = true;
        }
        else {
          dialogText.visible = false;
        }
      });
  }

  public update() {
    const cursors = this.input.keyboard.createCursorKeys();
    if (cursors.left.isDown) {
      this.gridEngine.move("player", Direction.LEFT);
    } else if (cursors.right.isDown) {
      this.gridEngine.move("player", Direction.RIGHT);
    } else if (cursors.up.isDown) {
      this.gridEngine.move("player", Direction.UP);
    } else if (cursors.down.isDown) {
      this.gridEngine.move("player", Direction.DOWN);
    }
    
    // const title = this.add.text(16, 16, '', { fontFamily: 'Arial', fontSize: 64, color: '#00ff00' });
    // dialogText.setScrollFactor(0);

    // if(this.gridEngine.getPosition('player').x == 3 && this.gridEngine.getPosition('player').y == 6) {
    //   this.input.keyboard.once('keydown-ENTER', () => {
    //     const dialogMessage = "Hi I'm Milap!";
    //     dialogText.text = dialogMessage
    //   });
    // }
    

    // this.gridEngine
    //   .positionChangeFinished()
    //   .subscribe(({ charId, enterTile }) => {
    //     // Check if the player has entered tile (3, 6) and hide the dialog
    //     if (charId === 'player' && enterTile.x != 3 || enterTile.y != 6) {
    //       // console.log('not in hit box')
    //       dialogText.visible = false;
          
          
    //     }
    //   });
  }


  preload() {
    this.load.image("tiles", "assets/cloud_tileset.png");
    this.load.tilemapTiledJSON("cloud-city-map", "assets/cloud_city.json");

    this.load.spritesheet("player", "assets/characters.png", {
      frameWidth: 52,
      frameHeight: 72,
    });
  }
}

function hasTrigger(tilemap, position) {
  return tilemap.layers.some((layer) => {
    const tile = tilemap.getTileAt(position.x, position.y, false, layer.name);
    return tile?.properties?.interactive
  });
}


const gameConfig: Phaser.Types.Core.GameConfig = {
  title: "Sample",
  render: {
    antialias: false,
  },
  type: Phaser.AUTO,
  scene: GameScene,
  scale: {
    width: 1000,
    height: 800,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  plugins: {
    scene: [
      {
        key: "gridEngine",
        plugin: GridEngine,
        mapping: "gridEngine",
      },
    ],
  },
  parent: "game",
};

export const game = new Phaser.Game(gameConfig);
