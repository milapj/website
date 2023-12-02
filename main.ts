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

    const catNpcSprite = this.add.sprite(0,0,'cat')
    catNpcSprite.scale = 2;
  
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
          walkingAnimationMapping: 4,
          startPosition: { x: 3, y: 3 },
          collides: {
            collisionGroups: ['cg1','cg2']
          }
        },
        {
          id: "npc0",
          sprite: catNpcSprite,
          walkingAnimationMapping: {
            up: {
              leftFoot: 30,
              standing: 31,
              rightFoot: 32
            },
            down: {
              leftFoot: 3,
              standing: 4,
              rightFoot: 5
            },
            left: {
              leftFoot: 12,
              standing: 13,
              rightFoot: 14
            },
            right: {
              leftFoot: 21,
              standing: 22,
              rightFoot: 23
            },
          },
          startPosition: { x: 5, y: 5 },
          speed: 3,
          collides: {
            collisionGroups: ['cg2']
          }
        },
      ],
    };
    
    this.gridEngine.create(cloudCityTilemap, gridEngineConfig);
    // this.gridEngine.moveRandomly("npc0", 1000, 3);
    this.gridEngine.follow('npc0', 'player', 1, true);
    const dialogTextGreet = this.add.text(
      10, // X position
      0, // Y position
      "", // Initial text
      {
        fontSize: '48px',
        wordWrap: { width: this.cameras.main.width - 32 },
        color: '#ffffff',
        // strokeThickness: 30,
      }
    );

    const myraDialogBox = this.add.text(
      1*48,
      1*48,
      "",
      {
        fontSize: '20px',
        wordWrap: { width: this.cameras.main.width - 32 },
        color: '#000000',
        strokeThickness: 10,
      }
    );

    const dialogTextKubePost = this.add.text(
      5*48, // X position
      5*48, // Y position
      "", // Initial text
      {
        fontSize: '32px',
        wordWrap: { width: this.cameras.main.width - 32 },
        color: '#000000',
        strokeThickness: 30,
      }
    );

    this.gridEngine 
      .positionChangeFinished()
      .subscribe(({ charId, enterTile, exitTile }) => {
        // console.log("subscribe result" + enterTile)
        // enterTile.y = enterTile.y - 1
        console.log("myra=" + this.gridEngine.getFacingPosition('npc0').x + this.gridEngine.getFacingPosition('npc0').y)
        if (this.gridEngine.getFacingDirection('player') == 'down'&&
            this.gridEngine.getFacingPosition('player').y >
            this.gridEngine.getFacingPosition('npc0').y && 
            this.gridEngine.getFacingPosition('player').x == 
            this.gridEngine.getFacingPosition('npc0').x) {
              setMyraDialogBox(myraDialogBox, this.gridEngine.getFacingPosition('npc0').x*48, this.gridEngine.getFacingPosition('npc0').y*48)    
        }
        else if(this.gridEngine.getFacingDirection('player') == 'right' && 
                this.gridEngine.getFacingPosition('player').x >
                this.gridEngine.getFacingPosition('npc0').x && 
                this.gridEngine.getFacingPosition('player').y == 
                this.gridEngine.getFacingPosition('npc0').y) {
                  setMyraDialogBox(myraDialogBox, this.gridEngine.getFacingPosition('npc0').x*48, this.gridEngine.getFacingPosition('npc0').y*48)
                }
        else if(this.gridEngine.getFacingDirection('player') == 'left' && 
                this.gridEngine.getFacingPosition('player').x <
                this.gridEngine.getFacingPosition('npc0').x && 
                this.gridEngine.getFacingPosition('player').y == 
                this.gridEngine.getFacingPosition('npc0').y) {
                  setMyraDialogBox(myraDialogBox, this.gridEngine.getFacingPosition('npc0').x*48, this.gridEngine.getFacingPosition('npc0').y*48)
        }
        else if(this.gridEngine.getFacingDirection('player') == 'up' && 
        this.gridEngine.getFacingPosition('player').y <
        this.gridEngine.getFacingPosition('npc0').y && 
        this.gridEngine.getFacingPosition('player').x == 
        this.gridEngine.getFacingPosition('npc0').x) {
          setMyraDialogBox(myraDialogBox, this.gridEngine.getFacingPosition('npc0').x*48, this.gridEngine.getFacingPosition('npc0').y*48)

        }
        else {
          myraDialogBox.visible = false;
        }
      })

    this.gridEngine
      .positionChangeFinished()
      .subscribe(({ charId, enterTile, exitTile }) => {
        // Check if the player has entered tile (3, 6) and hide the dialog
        enterTile.y = enterTile.y - 1
        // console.log(enterTile.x, enterTile.y)
        console.log(this.gridEngine.getFacingDirection('player'))
        console.log("user" + this.gridEngine.getFacingPosition('player').x + this.gridEngine.getFacingPosition('player').y)
        // console.log(enterTile.y)
        if(hasTrigger(cloudCityTilemap, enterTile) && 
        !isKubeHousePost(cloudCityTilemap, enterTile.x, enterTile.y) &&
        this.gridEngine.getFacingPosition('player').y == enterTile.y) {
          const dialogMessage = "Hi, I'm Milap!";
          dialogTextGreet.text = dialogMessage
          dialogTextGreet.setShadowFill(true)
          dialogTextGreet.visible = true;
        }
        else {
          dialogTextGreet.visible = false;
        }
      });

      this.gridEngine
      .positionChangeFinished()
      .subscribe(({ charId, enterTile, exitTile }) => {
        // Check if the player has entered tile (3, 6) and hide the dialog
        // enterTile.y = enterTile.y + 1
        // console.log(enterTile.x, enterTile.y)
        console.log(this.gridEngine.getFacingDirection('player'))
        console.log(this.gridEngine.getFacingPosition('player').y)
        console.log(enterTile.y)
        console.log("ispostKube" + isKubeHousePost(cloudCityTilemap, enterTile.x, enterTile.y))
        if(isKubeHousePost(cloudCityTilemap, enterTile.x, enterTile.y)) {
          const dialogMessageKubePost = "House of Kubernetes"
          dialogTextKubePost.text = dialogMessageKubePost
          dialogTextKubePost.setDepth(3)
          dialogTextKubePost.setShadowFill(true)
          dialogTextKubePost.visible = true;
        }
        else {
          dialogTextKubePost.visible = false;
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
  }


  preload() {
    this.load.image("tiles", "assets/cloud_tileset.png");
    this.load.tilemapTiledJSON("cloud-city-map", "assets/cloud_city.json");

    this.load.spritesheet("player", "assets/characters.png", {
      frameWidth: 52,
      frameHeight: 72,
    });
    
    this.load.spritesheet("cat", "assets/cat.png", {
      frameWidth: 32,
      frameHeight: 34,
    })
  }
}

function hasTrigger(tilemap, position) {
  return tilemap.layers.some((layer) => {
    const tile = tilemap.getTileAt(position.x, position.y, false, layer.name);
    return tile?.properties?.interactive
  });
}

function isKubeHousePost(tilemap, position_x, position_y) {
  return tilemap.layers.some((layer) => {
    const tile = tilemap.getTileAt(position_x, position_y, false, layer.name);
    return tile?.properties?.postKube
  });
}

function setMyraDialogBox(myraDialogBox, x_myraDialogBox, y_myraDialogBox) {
  const myraDialog = "Myra: Do you have any treats??"      
  myraDialogBox.text = myraDialog
  myraDialogBox.setDepth(3)
  myraDialogBox.setShadowFill(true)
  myraDialogBox.visible = true;
  myraDialogBox.setX(x_myraDialogBox - 50)
  myraDialogBox.setY(y_myraDialogBox - 10)
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

export const game = new Phaser.Game(gameConfig)

