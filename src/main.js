import { THREE } from "./three.js";
import { gravityStrength, jumpBaseBoost, jumpSlopeBoost, chunkSize } from "./constants.js";
import { carSurfaceHeight, groundHeight, roadCenterX, roadDistance, setWorldSeed } from "./terrain.js?v=no-ramps";
import { createInput } from "./input.js";
import { createHud } from "./hud.js";
import { createBirds, createCarShadow, createClouds, createDust, createWheelTracks } from "./effects.js?v=alien-planet-world";
import { createWorld } from "./world.js?v=alien-planet";
import { createMotorAudio } from "./audio.js?v=alien-planet-world";
import { loadCarModel, makeMechModel } from "./models.js?v=transformer-morph";
import { updateSheep } from "./sheep.js";
import { makeSkyTexture } from "./textures.js?v=alien-planet";

let scene=new THREE.Scene();
let playerCamera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,1e6);
let secondCamera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,1e6);
let renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);
scene.background=makeSkyTexture();
scene.fog=new THREE.FogExp2(0x7b4771,0.00024);

scene.add(new THREE.HemisphereLight(0xffb8d4,0x21484d,1.35));
let sun=new THREE.DirectionalLight(0xffd29b,2.05);
sun.position.set(-3.5,6.5,2.2);
scene.add(sun);

let input=createInput();
let px=0,py=20,pz=0;
let gameOver=false;
let healthDamageCooldown=0;
let cameraFollowDistance=18;
let cameraFollowHeight=7.5;
let cars=[];
let gameStarted=false;
let gameMode="single";
let enemies=[];
let enemyWaveDelay=0;
let enemyPatrolDelay=900;
let enemySpawnSerial=0;
let waterLevel=-20;
let mechGroundMaxSpeed=0.58;
let mechAirMaxSpeed=1.15;
let morphedCarSpeedMultiplier=3;
let mechStrideLength=2.35;
let rocketSpeed=1.75;
let rocketCooldownFrames=34;
let rocketTurnRate=0.075;
let rocketAimYOffset=-4.2;
let initialRocketAmmo=30;
let initialCannonAmmo=200;
let maxBoostCharge=100;
let rocketSupplyAmount=6;
let cannonSupplyAmount=40;
let healthSupplyAmount=35;
let boostSupplyAmount=45;
let rockets=[];
let supplyBoxes=[];
let supplySpawnKeys=new Set();
let rocketBodyGeo=new THREE.CylinderGeometry(0.11,0.13,0.8,12);
let rocketNoseGeo=new THREE.ConeGeometry(0.16,0.34,12);
let rocketFinGeo=new THREE.BoxGeometry(0.08,0.18,0.22);
let rocketBodyMat=new THREE.MeshStandardMaterial({color:0x30363b,roughness:0.48,metalness:0.55});
let rocketNoseMat=new THREE.MeshStandardMaterial({color:0xff6633,emissive:0x8f2108,emissiveIntensity:0.55,roughness:0.38,metalness:0.35});
let rocketFlameMat=new THREE.MeshStandardMaterial({color:0xfff0a0,emissive:0xff7a12,emissiveIntensity:1.2,roughness:0.28});
let cannonSpeed=3.35;
let cannonCooldownFrames=12;
let cannonBolts=[];
let cannonBodyGeo=new THREE.CylinderGeometry(0.044,0.064,0.56,12);
let cannonCoreGeo=new THREE.SphereGeometry(0.088,14,10);
let cannonGlowGeo=new THREE.SphereGeometry(0.16,16,10);
let cannonBodyMat=new THREE.MeshBasicMaterial({
  color:0xffffff,
  transparent:true,
  opacity:0.86,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let cannonCoreMat=new THREE.MeshBasicMaterial({
  color:0xffffff,
  transparent:true,
  opacity:0.95,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let cannonGlowMat=new THREE.MeshBasicMaterial({
  color:0x9fd8ff,
  transparent:true,
  opacity:0.34,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let mouseAimRaycaster=new THREE.Raycaster();
let mouseAimPointer=new THREE.Vector2();
let mouseAimPlane=new THREE.Plane();
let mouseAimPlanePoint=new THREE.Vector3();
let mouseAimPlaneNormal=new THREE.Vector3();
let mouseAimHitPoint=new THREE.Vector3();
let explosionBursts=[];
let explosionFlashGeo=new THREE.SphereGeometry(1,18,12);
let explosionRingGeo=new THREE.TorusGeometry(1,0.045,8,64);
let explosionFlashMat=new THREE.MeshBasicMaterial({
  color:0xffd27a,
  transparent:true,
  opacity:0.9,
  depthWrite:false,
  depthTest:true,
  blending:THREE.AdditiveBlending
});
let explosionRingMat=new THREE.MeshBasicMaterial({
  color:0x8dfff2,
  transparent:true,
  opacity:0.8,
  depthWrite:false,
  depthTest:true,
  blending:THREE.AdditiveBlending
});
let rockDebris=[];
let rockDebrisGeo=new THREE.DodecahedronGeometry(1,0);
let rockDebrisMat=new THREE.MeshStandardMaterial({color:0x4c3a5b,roughness:0.96,metalness:0.08});
let buildingDebrisGeo=new THREE.BoxGeometry(1,1,1);
let buildingDebrisMat=new THREE.MeshStandardMaterial({color:0x5a526d,roughness:0.9,metalness:0.12});
let enemyTrimMat=new THREE.MeshStandardMaterial({color:0xb8ff37,roughness:0.42,metalness:0.45});
let enemyEyeMat=new THREE.MeshStandardMaterial({
  color:0xff3a24,
  emissive:0xff2200,
  emissiveIntensity:1.2,
  roughness:0.18,
  metalness:0.12
});
let supplyBoxGeo=new THREE.BoxGeometry(2.4,1.15,2.4);
let supplyLidGeo=new THREE.BoxGeometry(2.65,0.22,2.65);
let supplyBandGeo=new THREE.BoxGeometry(2.75,0.16,0.28);
let rocketSupplyMat=new THREE.MeshStandardMaterial({color:0x763627,roughness:0.72,metalness:0.18});
let cannonSupplyMat=new THREE.MeshStandardMaterial({color:0x23516b,roughness:0.68,metalness:0.2});
let healthSupplyMat=new THREE.MeshStandardMaterial({color:0x275f38,roughness:0.66,metalness:0.16});
let boostSupplyMat=new THREE.MeshStandardMaterial({color:0x5f4b18,roughness:0.62,metalness:0.2});
let supplyLidMat=new THREE.MeshStandardMaterial({color:0x161c1e,roughness:0.82,metalness:0.3});
let rocketSupplyBandMat=new THREE.MeshStandardMaterial({color:0xff7a32,emissive:0x742000,emissiveIntensity:0.28,roughness:0.48,metalness:0.12});
let cannonSupplyBandMat=new THREE.MeshStandardMaterial({color:0x7ff8ff,emissive:0x115e66,emissiveIntensity:0.36,roughness:0.38,metalness:0.1});
let healthSupplyBandMat=new THREE.MeshStandardMaterial({color:0x7cff78,emissive:0x116b21,emissiveIntensity:0.38,roughness:0.42,metalness:0.08});
let boostSupplyBandMat=new THREE.MeshStandardMaterial({color:0xffe46f,emissive:0x7a5b00,emissiveIntensity:0.42,roughness:0.34,metalness:0.1});

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function smoothStep(value){
  value=clamp(value,0,1);
  return value*value*(3-2*value);
}

function waterDepthAt(x,z){
  return waterLevel-groundHeight(x,z);
}

function drivingSurfaceHeight(x,z){
  let surfaceY=carSurfaceHeight(x,z);
  return waterDepthAt(x,z)>0.15 ? Math.max(surfaceY,waterLevel-0.34) : surfaceY;
}

function normalizeAngle(angle){
  while(angle>Math.PI) angle-=Math.PI*2;
  while(angle<-Math.PI) angle+=Math.PI*2;
  return angle;
}

function roadYawAt(z){
  return Math.atan2(roadCenterX(z+18)-roadCenterX(z-18),36);
}

function updateCameraProjection(){
  let splitAspect=Math.max(0.1,(gameMode==="single" ? innerWidth : innerWidth*0.5)/innerHeight);

  let defaultVerticalFov=50;
  let minVerticalFov=38;
  let maxHorizontalFov=82;
  let horizontalFovRad=THREE.MathUtils.degToRad(maxHorizontalFov);
  let verticalFovForWidth=THREE.MathUtils.radToDeg(
    2*Math.atan(Math.tan(horizontalFovRad*0.5)/splitAspect)
  );

  let fov=Math.max(minVerticalFov,Math.min(defaultVerticalFov,verticalFovForWidth));
  playerCamera.aspect=splitAspect;
  playerCamera.fov=fov;
  playerCamera.updateProjectionMatrix();
  secondCamera.aspect=splitAspect;
  secondCamera.fov=fov;
  secondCamera.updateProjectionMatrix();

  let zoomCompensation=Math.tan(THREE.MathUtils.degToRad(defaultVerticalFov*0.5))
    / Math.tan(THREE.MathUtils.degToRad(fov*0.5));
  cameraFollowDistance=16*Math.min(1.2,zoomCompensation);
  cameraFollowHeight=7*Math.min(1.12,Math.sqrt(zoomCompensation));
}
updateCameraProjection();

function activeCars(){
  return gameMode==="single" ? [playerCar] : cars;
}

function displayCars(){
  return gameMode==="single" ? [playerCar] : [secondCar,playerCar];
}

function activeEnemies(){
  return enemies.filter(enemy=>enemy.active && enemy.health>0);
}

function combatActors(){
  return [...activeCars(),...activeEnemies()];
}

function createCarState(id,lateralOffset,controls,camera,gamepadIndex){
  let group=new THREE.Group();
  group.rotation.order="YXZ";
  scene.add(group);

  return {
    id,
    controls,
    gamepadIndex,
    camera,
    cameraYaw:0,
    group,
    shadow:createCarShadow(scene),
    x:0,
    y:20,
    z:0,
    angle:0,
    velAngle:0,
    speed:0,
    throttleInput:0,
    surfaceDistance:0,
    slipAmount:0,
    onGround:false,
    airborne:false,
    vy:0,
    pitch:0,
    trickPitch:0,
    trickRoll:0,
    trickYaw:0,
    trickPitchVel:0,
    trickRollVel:0,
    trickYawVel:0,
    lastTrickButtons:{a:false,b:false,x:false,y:false},
    lastMorphButton:false,
    morphed:false,
    morphProgress:0,
    lastMorphProgress:0,
    mechModel:null,
    carModel:null,
    aimCross:null,
    aimOffsetX:0,
    aimOffsetY:0,
    lastRocketButton:false,
    rocketCooldown:0,
    rocketAmmo:initialRocketAmmo,
    lastCannonButton:false,
    cannonCooldown:0,
    cannonAmmo:initialCannonAmmo,
    boostCharge:maxBoostCharge,
    hitRattle:0,
    hitRattleSeed:0,
    walkCycle:0,
    lastWalkX:0,
    lastWalkZ:0,
    health:100,
    lateralOffset
  };
}

let playerCar=createCarState("car1",-4.2,{up:"w",down:"s",left:"a",right:"d"},playerCamera,0);
let secondCar=createCarState("car2",4.2,{up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright"},secondCamera,1);
cars=[playerCar,secondCar];
secondCar.group.visible=false;
secondCar.shadow.setVisible(false);

let world=createWorld(scene);
let clouds=createClouds(scene,()=>({carX:playerCar.x,carZ:playerCar.z}));
let birds=createBirds(scene,()=>({carX:playerCar.x,carZ:playerCar.z}));
let dust=createDust(scene);
let wheelTracks=createWheelTracks(scene);
let motorAudio=createMotorAudio(cars);
let hud=createHud({
  getCarStates:()=>displayCars().map(car=>({
    id:car.id,
    label:car.id==="car1" ? "P1" : "P2",
    color:car.id==="car1" ? "#d62f2f" : "#3d6ee8",
    carX:car.x,
    carZ:car.z,
    carVelAngle:car.velAngle,
    carSpeed:car.speed,
    carHealth:car.health,
    rocketAmmo:car.rocketAmmo,
    cannonAmmo:car.cannonAmmo,
    boostCharge:car.boostCharge
  })),
  getEnemyStates:()=>activeEnemies().map(enemy=>({
    id:enemy.id,
    x:enemy.x,
    z:enemy.z,
    health:enemy.health
  })),
  getChunks:()=>world.chunks
});

function showGameOver(){
  if(gameOver) return;
  gameOver=true;
  for(let car of activeCars()){
    car.speed=0;
    car.vy=0;
  }
  hud.updateHealthHud();
  hud.showGameOverOverlay();
}

function damageCar(car,amount){
  if(healthDamageCooldown>0 || car.health<=0) return;
  car.health=Math.max(0,car.health-amount);
  healthDamageCooldown=42;
  hud.updateHealthHud();
  if(activeCars().every(item=>item.health<=0)) showGameOver();
}

function damageEnemy(enemy,amount){
  if(!enemy.active || enemy.health<=0) return;
  enemy.health=Math.max(0,enemy.health-amount);
  enemy.hitRattle=Math.max(enemy.hitRattle,0.75);
  enemy.hitRattleSeed=Math.random()*Math.PI*2;

  if(enemy.health<=0){
    enemy.active=false;
    enemy.group.visible=false;
    if(enemy.shadow){
      enemy.shadow.dispose();
      enemy.shadow=null;
    }
    scene.remove(enemy.group);
    spawnRocketExplosion(enemy.x,enemy.y+2.2,enemy.z);
  }
}

function damageActor(actor,amount){
  if(actor.isEnemy) damageEnemy(actor,amount);
  else damageCar(actor,amount);
}

function rattleActor(actor,amount=1){
  if(!actor || actor.health<=0) return;
  actor.hitRattle=Math.max(actor.hitRattle,amount);
  actor.hitRattleSeed=Math.random()*Math.PI*2;
}

function landingDamageAmount(car,x,z,impactSpeed){
  let front=carSurfaceHeight(x+Math.sin(car.velAngle)*3,z+Math.cos(car.velAngle)*3);
  let back=carSurfaceHeight(x-Math.sin(car.velAngle)*3,z-Math.cos(car.velAngle)*3);
  let side=carSurfaceHeight(x+Math.cos(car.velAngle)*2.2,z-Math.sin(car.velAngle)*2.2);
  let roughness=Math.max(Math.abs(front-back),Math.abs(side-carSurfaceHeight(x,z)));
  let impactDamage=Math.max(0,impactSpeed-1.05)*7;
  let roughDamage=Math.max(0,roughness-2.0)*1.4;
  return Math.min(12,Math.round(impactDamage+roughDamage));
}

function controlsFor(car){
  let forward=0;
  let turn=0;

  if(!gameOver){
    if(input.keys[car.controls.up]) forward=1;
    if(input.keys[car.controls.down]) forward=-1;
    if(input.keys[car.controls.left]) turn=1;
    if(input.keys[car.controls.right]) turn=-1;

    let gamepadControls=input.getGamepadControls(car.gamepadIndex);
    if(Math.abs(gamepadControls.forward)>Math.abs(forward)){
      forward=gamepadControls.forward;
    }
    if(Math.abs(gamepadControls.turn)>Math.abs(turn)){
      turn=-gamepadControls.turn;
    }
  }

  return {forward,turn};
}

function collidesWithOtherCars(car,nextX,nextZ){
  for(let other of combatActors()){
    if(other===car) continue;
    if(!other.active && other.isEnemy) continue;
    let dx=nextX-other.x;
    let dz=nextZ-other.z;
    let minGap=3.6;
    if(dx*dx+dz*dz<minGap*minGap) return other;
  }
  return null;
}

function movementCollision(car,fromX,fromZ,toX,toZ){
  let dx=toX-fromX;
  let dz=toZ-fromZ;
  let distance=Math.hypot(dx,dz);
  let steps=Math.max(1,Math.min(24,Math.ceil(distance/0.45)));
  let safeX=fromX;
  let safeZ=fromZ;

  for(let i=1;i<=steps;i++){
    let t=i/steps;
    let x=fromX+dx*t;
    let z=fromZ+dz*t;
    let otherCar=collidesWithOtherCars(car,x,z);

    if(world.collidesWithObstacles(x,z) || otherCar){
      return {hit:true,otherCar,safeX,safeZ};
    }

    safeX=x;
    safeZ=z;
  }

  return {hit:false,otherCar:null,safeX:toX,safeZ:toZ};
}

function makeRocketMesh(){
  let group=new THREE.Group();

  let body=new THREE.Mesh(rocketBodyGeo,rocketBodyMat);
  body.rotation.x=Math.PI/2;
  group.add(body);

  let nose=new THREE.Mesh(rocketNoseGeo,rocketNoseMat);
  nose.rotation.x=Math.PI/2;
  nose.position.z=0.55;
  group.add(nose);

  let flame=new THREE.Mesh(rocketNoseGeo,rocketFlameMat);
  flame.rotation.x=-Math.PI/2;
  flame.position.z=-0.55;
  flame.scale.set(0.72,0.72,0.72);
  group.add(flame);

  for(let side of [-1,1]){
    let fin=new THREE.Mesh(rocketFinGeo,rocketNoseMat);
    fin.position.set(side*0.16,-0.02,-0.26);
    fin.rotation.z=side*0.2;
    group.add(fin);
  }

  group.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
    }
  });

  return group;
}

function spawnRocketExplosion(x,y,z){
  motorAudio.playExplosion();

  let flash=new THREE.Mesh(explosionFlashGeo,explosionFlashMat.clone());
  flash.position.set(x,y,z);
  flash.scale.setScalar(0.35);
  scene.add(flash);

  let ring=new THREE.Mesh(explosionRingGeo,explosionRingMat.clone());
  ring.position.set(x,y+0.05,z);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(0.55);
  scene.add(ring);

  explosionBursts.push({flash,ring,age:0,life:0.42});

  for(let i=0;i<24;i++){
    let angle=Math.random()*Math.PI*2;
    let speed=2.4+Math.random()*5.4;
    dust.spawnThrusterParticle(
      x,
      y,
      z,
      Math.cos(angle)*speed,
      Math.sin(angle)*speed,
      1.4+Math.random()*4.2,
      0.24+Math.random()*0.22,
      0.12+Math.random()*0.12
    );
  }
}

function clearExplosions(){
  for(let burst of explosionBursts){
    scene.remove(burst.flash,burst.ring);
    burst.flash.material.dispose();
    burst.ring.material.dispose();
  }
  explosionBursts=[];
}

function updateExplosions(){
  for(let i=explosionBursts.length-1;i>=0;i--){
    let burst=explosionBursts[i];
    burst.age+=0.016;
    let t=Math.min(1,burst.age/burst.life);
    let flashScale=0.35+Math.sin(t*Math.PI)*3.4;
    let ringScale=0.55+t*6.8;

    burst.flash.scale.setScalar(flashScale);
    burst.ring.scale.setScalar(ringScale);
    burst.flash.material.opacity=0.9*Math.pow(1-t,1.6);
    burst.ring.material.opacity=0.8*Math.pow(1-t,1.2);

    if(t>=1){
      scene.remove(burst.flash,burst.ring);
      burst.flash.material.dispose();
      burst.ring.material.dispose();
      explosionBursts.splice(i,1);
    }
  }
}

function spawnRockDebris(x,y,z,obstacle){
  let building=obstacle.type==="building" || obstacle.type==="wall";
  let count=building ? 22 : (obstacle.type==="smallRock" ? 7 : 13);
  let baseScale=building
    ? Math.max(0.75,Math.min(2.1,(obstacle.r || 5)*0.16))
    : Math.max(0.22,Math.min(0.82,(obstacle.r || 3)*0.14));

  for(let i=0;i<count;i++){
    let piece=new THREE.Mesh(
      building ? buildingDebrisGeo : rockDebrisGeo,
      (building ? buildingDebrisMat : rockDebrisMat).clone()
    );
    let angle=(i/count)*Math.PI*2+Math.random()*0.55;
    let speed=building ? 0.2+Math.random()*0.42 : 0.16+Math.random()*0.28;
    let scale=baseScale*(0.45+Math.random()*0.8);

    piece.position.set(
      x+(Math.random()-0.5)*(building ? 4.8 : 0.8),
      y+0.3+Math.random()*(building ? 3.2 : 0.9),
      z+(Math.random()-0.5)*(building ? 4.8 : 0.8)
    );
    piece.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    piece.scale.set(
      scale*(building ? 0.8+Math.random()*1.4 : 1),
      scale*(building ? 0.45+Math.random()*1.0 : 0.65+Math.random()*0.6),
      scale*(building ? 0.8+Math.random()*1.4 : 1)
    );
    piece.castShadow=true;
    piece.receiveShadow=true;
    scene.add(piece);

    rockDebris.push({
      piece,
      vx:Math.cos(angle)*speed,
      vz:Math.sin(angle)*speed,
      vy:(building ? 0.34 : 0.2)+Math.random()*(building ? 0.54 : 0.34),
      rx:(Math.random()-0.5)*0.18,
      ry:(Math.random()-0.5)*0.18,
      rz:(Math.random()-0.5)*0.18,
      age:0,
      life:(building ? 2.2 : 1.5)+Math.random()*(building ? 0.75 : 0.55)
    });
  }
}

function clearRockDebris(){
  for(let item of rockDebris){
    scene.remove(item.piece);
    item.piece.material.dispose();
  }
  rockDebris=[];
}

function updateRockDebris(){
  for(let i=rockDebris.length-1;i>=0;i--){
    let item=rockDebris[i];
    item.age+=0.016;
    item.vy-=0.018;
    item.vx*=0.988;
    item.vz*=0.988;
    item.piece.position.x+=item.vx;
    item.piece.position.y+=item.vy;
    item.piece.position.z+=item.vz;
    item.piece.rotation.x+=item.rx;
    item.piece.rotation.y+=item.ry;
    item.piece.rotation.z+=item.rz;

    let groundY=drivingSurfaceHeight(item.piece.position.x,item.piece.position.z)+0.08;
    if(item.piece.position.y<groundY){
      item.piece.position.y=groundY;
      item.vy*=-0.28;
      item.vx*=0.72;
      item.vz*=0.72;
    }

    let t=Math.min(1,item.age/item.life);
    item.piece.scale.multiplyScalar(1-0.012*t);
    item.piece.material.opacity=1-t;
    item.piece.material.transparent=true;

    if(t>=1){
      scene.remove(item.piece);
      item.piece.material.dispose();
      rockDebris.splice(i,1);
    }
  }
}

function hash01(a,b){
  let value=Math.sin(a*127.1+b*311.7)*43758.5453;
  return value-Math.floor(value);
}

function makeSupplyBox(type){
  let group=new THREE.Group();
  let baseMat=type==="rocket" ? rocketSupplyMat : type==="health" ? healthSupplyMat : type==="boost" ? boostSupplyMat : cannonSupplyMat;
  let bandMat=type==="rocket" ? rocketSupplyBandMat : type==="health" ? healthSupplyBandMat : type==="boost" ? boostSupplyBandMat : cannonSupplyBandMat;
  let body=new THREE.Mesh(supplyBoxGeo,baseMat);
  let lid=new THREE.Mesh(supplyLidGeo,supplyLidMat);
  let bandA=new THREE.Mesh(supplyBandGeo,bandMat);
  let bandB=new THREE.Mesh(supplyBandGeo,bandMat);

  body.castShadow=true;
  body.receiveShadow=true;
  lid.castShadow=true;
  lid.receiveShadow=true;
  bandA.castShadow=true;
  bandB.castShadow=true;
  lid.position.y=0.69;
  bandA.position.y=0.18;
  bandA.position.z=1.23;
  bandB.position.y=0.18;
  bandB.position.x=1.23;
  bandB.rotation.y=Math.PI/2;

  group.add(body,lid,bandA,bandB);
  group.userData.type=type;
  group.userData.baseY=0;
  return group;
}

function supplyKeyForVillage(village,type){
  return `${Math.round(village.x)}:${Math.round(village.z)}:${type}`;
}

function supplyPointForVillage(village,type,index){
  let baseA=Math.round(village.x*0.37+index*19);
  let typeOffset=type==="rocket" ? 7 : type==="health" ? 31 : type==="boost" ? 47 : 23;
  let baseB=Math.round(village.z*0.41+typeOffset);
  let villageRadius=village.r || 32;

  for(let attempt=0;attempt<9;attempt++){
    let angle=(hash01(baseA+attempt*13,baseB-attempt*5)+attempt*0.23)*Math.PI*2;
    let dist=villageRadius*(0.16+hash01(baseA-attempt*3,baseB+attempt*11)*0.48);
    let x=village.x+Math.cos(angle)*dist;
    let z=village.z+Math.sin(angle)*dist;
    let y=drivingSurfaceHeight(x,z);

    if(
      Number.isFinite(y)
      && waterDepthAt(x,z)<0.7
      && roadDistance(x,z)>18
      && !world.collidesWithObstacles(x,z)
    ){
      return {x,y,z,angle};
    }
  }

  let fallbackAngle=(type==="rocket" ? 0.3 : type==="health" ? 0.72 : type==="boost" ? 0.95 : 1.15)*Math.PI;
  let x=village.x+Math.cos(fallbackAngle)*villageRadius*0.22;
  let z=village.z+Math.sin(fallbackAngle)*villageRadius*0.22;
  return {x,y:drivingSurfaceHeight(x,z),z,angle:fallbackAngle};
}

function spawnVillageSupplyBoxes(){
  for(let chunk of world.chunks.values()){
    if(!chunk.villageCenters) continue;
    for(let village of chunk.villageCenters){
      if(!world.isVillageCleared(village)) continue;

      let supplySets=gameMode==="double" ? 2 : 1;
      for(let set=0;set<supplySets;set++){
        for(let type of ["rocket","cannon","health","boost"]){
          let key=supplyKeyForVillage(village,`${type}-${set}`);
          if(supplySpawnKeys.has(key)) continue;

          let typeIndex=type==="rocket" ? 0 : type==="cannon" ? 1 : type==="health" ? 2 : 3;
          let point=supplyPointForVillage(village,type,typeIndex+set*4);
          let box=makeSupplyBox(type);
          box.position.set(point.x,point.y+0.68,point.z);
          box.rotation.y=point.angle;
          box.userData.baseY=box.position.y;
          box.userData.key=key;
          scene.add(box);
          supplyBoxes.push(box);
          supplySpawnKeys.add(key);
        }
      }
    }
  }
}

function collectSupplyBox(box,car){
  let type=box.userData.type;

  if(type==="rocket"){
    if(car.rocketAmmo>=initialRocketAmmo) return false;
    car.rocketAmmo=Math.min(initialRocketAmmo,car.rocketAmmo+rocketSupplyAmount);
  }else if(type==="cannon"){
    if(car.cannonAmmo>=initialCannonAmmo) return false;
    car.cannonAmmo=Math.min(initialCannonAmmo,car.cannonAmmo+cannonSupplyAmount);
  }else if(type==="boost"){
    if(car.boostCharge>=maxBoostCharge) return false;
    car.boostCharge=Math.min(maxBoostCharge,car.boostCharge+boostSupplyAmount);
  }else{
    if(car.health>=100) return false;
    car.health=Math.min(100,car.health+healthSupplyAmount);
    hud.updateHealthHud();
  }

  for(let i=0;i<10;i++){
    dust.spawnThrusterParticle(
      box.position.x,
      box.position.y+0.6,
      box.position.z,
      (Math.random()-0.5)*1.2,
      (Math.random()-0.5)*1.2,
      0.7+Math.random()*1.6,
      0.14+Math.random()*0.08,
      0.045+Math.random()*0.035
    );
  }

  scene.remove(box);
  return true;
}

function updateSupplyBoxes(){
  spawnVillageSupplyBoxes();

  let now=performance.now();
  for(let i=supplyBoxes.length-1;i>=0;i--){
    let box=supplyBoxes[i];
    box.position.y=box.userData.baseY+Math.sin(now*0.003+i)*0.12;
    box.rotation.y+=0.006;

    for(let car of activeCars()){
      if(car.health<=0) continue;
      let dx=box.position.x-car.x;
      let dz=box.position.z-car.z;
      if(dx*dx+dz*dz<5.4*5.4 && Math.abs(box.position.y-car.y)<4.2){
        if(collectSupplyBox(box,car)){
          supplyBoxes.splice(i,1);
          hud.updateSpeedHud();
          break;
        }
      }
    }
  }
}

function clearSupplyBoxes(){
  for(let box of supplyBoxes){
    scene.remove(box);
  }
  supplyBoxes=[];
  supplySpawnKeys.clear();
}

function aimTargetForCar(car){
  if(car.isEnemy && car.aiTarget){
    return new THREE.Vector3(
      car.aiTarget.x,
      car.aiTarget.y+2.15,
      car.aiTarget.z
    );
  }

  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);

  return new THREE.Vector3(
    car.x+forwardX*72+rightX*car.aimOffsetX*2.25,
    car.y+3.15+car.aimOffsetY*2.25+rocketAimYOffset,
    car.z+forwardZ*72+rightZ*car.aimOffsetX*2.25
  );
}

function updateAimCross(car){
  if(!car.aimCross) return;

  if(gameMode==="single" && car===playerCar && input.mouse.hasPosition){
    mouseAimPointer.set(
      (input.mouse.x/innerWidth)*2-1,
      -(input.mouse.y/innerHeight)*2+1
    );
    mouseAimRaycaster.setFromCamera(mouseAimPointer,car.camera);
    mouseAimPlanePoint.set(0,3.15,32);
    car.group.localToWorld(mouseAimPlanePoint);
    mouseAimPlaneNormal.set(0,0,1).applyQuaternion(car.group.quaternion).normalize();
    mouseAimPlane.setFromNormalAndCoplanarPoint(mouseAimPlaneNormal,mouseAimPlanePoint);

    if(mouseAimRaycaster.ray.intersectPlane(mouseAimPlane,mouseAimHitPoint)){
      car.group.worldToLocal(mouseAimHitPoint);
      car.aimOffsetX=clamp(mouseAimHitPoint.x,-11,11);
      car.aimOffsetY=clamp(mouseAimHitPoint.y-3.15,-4.5,7.5);
    }
  }else{
    let aim=input.getGamepadAim(car.gamepadIndex);
    car.aimOffsetX=clamp(car.aimOffsetX-aim.x*0.42,-11,11);
    car.aimOffsetY=clamp(car.aimOffsetY-aim.y*0.32,-4.5,7.5);
  }

  car.aimCross.position.set(car.aimOffsetX,3.15+car.aimOffsetY,32);
  let locked=!!nearbyRocketTargetForCar(car);
  let ring=car.aimCross.userData.ring;
  let cross=car.aimCross.userData.cross;
  let ringColor=locked ? car.aimCross.userData.lockColor : car.aimCross.userData.baseRingColor;
  let crossColor=locked ? car.aimCross.userData.lockColor : car.aimCross.userData.baseCrossColor;
  if(ring && ring.material) ring.material.color.copy(ringColor);
  if(cross && cross.material) cross.material.color.copy(crossColor);
}

function rocketLaunchPointForCar(car){
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);

  return new THREE.Vector3(
    car.x+forwardX*2.6+rightX*1.75,
    car.y+2.25,
    car.z+forwardZ*2.6+rightZ*1.75
  );
}

function nearbyRocketTargetForCar(car){
  if(car.isEnemy) return null;

  let best=null;
  let bestScore=Infinity;
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let minLockRange=100;
  let maxLockRange=350;

  for(let enemy of activeEnemies()){
    let dx=enemy.x-car.x;
    let dz=enemy.z-car.z;
    let distSq=dx*dx+dz*dz;
    if(distSq<minLockRange*minLockRange || distSq>maxLockRange*maxLockRange) continue;

    let dist=Math.max(0.001,Math.sqrt(distSq));
    let alignment=(dx*forwardX+dz*forwardZ)/dist;
    let anglePenalty=alignment<0 ? 48 : (1-alignment)*28;
    let score=dist+anglePenalty;

    if(score<bestScore){
      best=enemy;
      bestScore=score;
    }
  }

  return best;
}

function rocketTargetPoint(target){
  return new THREE.Vector3(target.x,target.y+2.2,target.z);
}

function fireRocket(car){
  if(gameOver || car.health<=0 || car.rocketCooldown>0) return;
  if(car.morphed || car.morphProgress>0.22) return;
  if(!car.isEnemy && car.rocketAmmo<=0) return;

  let mesh=makeRocketMesh();
  let launchPoint=rocketLaunchPointForCar(car);
  let startX=launchPoint.x;
  let startY=launchPoint.y;
  let startZ=launchPoint.z;
  let targetActor=nearbyRocketTargetForCar(car);
  let aimPoint=targetActor ? rocketTargetPoint(targetActor) : aimTargetForCar(car);
  let aimX=aimPoint.x-startX;
  let aimY=aimPoint.y-startY;
  let aimZ=aimPoint.z-startZ;
  let aimLen=Math.max(0.001,Math.hypot(aimX,aimY,aimZ));
  let rocketLife=targetActor ? Math.min(300,Math.max(115,Math.ceil(aimLen/rocketSpeed)+80)) : 115;
  let target={
    x:startX+(aimX/aimLen)*180,
    y:startY+(aimY/aimLen)*180,
    z:startZ+(aimZ/aimLen)*180
  };
  mesh.position.set(startX,startY,startZ);
  mesh.rotation.y=Math.atan2(aimX,aimZ);
  mesh.rotation.x=-Math.asin(clamp(aimY/aimLen,-1,1));
  scene.add(mesh);

  rockets.push({
    owner:car,
    mesh,
    x:startX,
    y:startY,
    z:startZ,
    angle:Math.atan2(aimX,aimZ),
    targetX:target.x,
    targetY:target.y,
    targetZ:target.z,
    targetActor,
    vx:(aimX/aimLen)*rocketSpeed,
    vz:(aimZ/aimLen)*rocketSpeed,
    vy:(aimY/aimLen)*rocketSpeed,
    age:0,
    life:rocketLife
  });

  motorAudio.playRocketLaunch(car);
  car.rocketCooldown=rocketCooldownFrames;
  if(!car.isEnemy) car.rocketAmmo=Math.max(0,car.rocketAmmo-1);
}

function rattleCar(car,amount=1){
  car.hitRattle=Math.max(car.hitRattle,amount);
  car.hitRattleSeed=Math.random()*Math.PI*2;
}

function updateRocketInput(car){
  if(car.rocketCooldown>0) car.rocketCooldown--;

  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let pressedB=buttons.b && !car.lastRocketButton;
  let mouseRocket=gameMode==="single" && car===playerCar && input.mouse.left;
  let pressedMouse=mouseRocket && !car.lastRocketButton;
  if(pressedB || pressedMouse) fireRocket(car);
  car.lastRocketButton=buttons.b || mouseRocket;
}

function makeCannonBoltMesh(){
  let group=new THREE.Group();
  let body=new THREE.Mesh(cannonBodyGeo,cannonBodyMat);
  body.rotation.x=Math.PI/2;
  group.add(body);

  let core=new THREE.Mesh(cannonCoreGeo,cannonCoreMat);
  core.position.z=0.25;
  group.add(core);

  let glow=new THREE.Mesh(cannonGlowGeo,cannonGlowMat);
  glow.position.z=0.25;
  group.add(glow);

  return group;
}

function cannonLaunchPointForCar(car){
  let parts=car.mechModel && car.mechModel.userData ? car.mechModel.userData.walkParts : null;
  let hand=parts && parts.left ? parts.left.hand : null;

  if(hand){
    hand.updateWorldMatrix(true,false);
    return hand.localToWorld(new THREE.Vector3(0,0,0.36));
  }

  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);
  return new THREE.Vector3(
    car.x+forwardX*2.2-rightX*2.15,
    car.y+2.85,
    car.z+forwardZ*2.2-rightZ*2.15
  );
}

function fireCannon(car){
  if(gameOver || car.health<=0 || car.cannonCooldown>0) return false;
  if(car.morphed || car.morphProgress>0.35) return false;
  if(!car.isEnemy && car.cannonAmmo<=0) return false;

  let mesh=makeCannonBoltMesh();
  let launchPoint=cannonLaunchPointForCar(car);
  let startX=launchPoint.x;
  let startY=launchPoint.y;
  let startZ=launchPoint.z;
  let aimPoint=aimTargetForCar(car);
  let aimX=aimPoint.x-startX;
  let aimY=aimPoint.y-startY;
  let aimZ=aimPoint.z-startZ;
  let aimLen=Math.max(0.001,Math.hypot(aimX,aimY,aimZ));

  mesh.position.set(startX,startY,startZ);
  mesh.rotation.y=Math.atan2(aimX,aimZ);
  mesh.rotation.x=-Math.asin(clamp(aimY/aimLen,-1,1));
  scene.add(mesh);

  cannonBolts.push({
    owner:car,
    mesh,
    x:startX,
    y:startY,
    z:startZ,
    vx:(aimX/aimLen)*cannonSpeed,
    vy:(aimY/aimLen)*cannonSpeed,
    vz:(aimZ/aimLen)*cannonSpeed,
    age:0,
    life:72
  });

  for(let i=0;i<7;i++){
    dust.spawnThrusterParticle(
      startX,
      startY,
      startZ,
      -(aimX/aimLen)*(1.2+Math.random()*1.8)+(Math.random()-0.5)*0.7,
      -(aimZ/aimLen)*(1.2+Math.random()*1.8)+(Math.random()-0.5)*0.7,
      (Math.random()-0.5)*0.9,
      0.12,
      0.055+Math.random()*0.035
    );
  }

  motorAudio.playCannonFire(car);
  car.cannonCooldown=cannonCooldownFrames;
  if(!car.isEnemy) car.cannonAmmo=Math.max(0,car.cannonAmmo-1);
  return true;
}

function updateCannonInput(car){
  if(car.cannonCooldown>0) car.cannonCooldown--;

  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let mouseShot=gameMode==="single" && car===playerCar && input.mouse.right;
  let cannonButton=buttons.y || mouseShot;
  if(cannonButton) fireCannon(car);
  car.lastCannonButton=cannonButton;
}

function removeRocket(index){
  let rocket=rockets[index];
  scene.remove(rocket.mesh);
  rockets.splice(index,1);
}

function removeCannonBolt(index){
  let bolt=cannonBolts[index];
  scene.remove(bolt.mesh);
  cannonBolts.splice(index,1);
}

function clearRockets(){
  for(let rocket of rockets){
    scene.remove(rocket.mesh);
  }
  rockets=[];
  for(let bolt of cannonBolts){
    scene.remove(bolt.mesh);
  }
  cannonBolts=[];
  clearExplosions();
  clearRockDebris();
}

function updateRockets(){
  for(let i=rockets.length-1;i>=0;i--){
    let rocket=rockets[i];
    rocket.age++;

    if(rocket.targetActor && rocket.targetActor.active && rocket.targetActor.health>0){
      let targetPoint=rocketTargetPoint(rocket.targetActor);
      rocket.targetX=targetPoint.x;
      rocket.targetY=targetPoint.y;
      rocket.targetZ=targetPoint.z;
    }

    let dx=rocket.targetX-rocket.x;
    let dy=rocket.targetY-rocket.y;
    let dz=rocket.targetZ-rocket.z;
    let desiredLen=Math.max(0.001,Math.hypot(dx,dy,dz));
    let desiredVx=(dx/desiredLen)*rocketSpeed;
    let desiredVy=(dy/desiredLen)*rocketSpeed;
    let desiredVz=(dz/desiredLen)*rocketSpeed;
    rocket.vx+=(desiredVx-rocket.vx)*rocketTurnRate;
    rocket.vy+=(desiredVy-rocket.vy)*rocketTurnRate;
    rocket.vz+=(desiredVz-rocket.vz)*rocketTurnRate;
    let velocityLen=Math.max(0.001,Math.hypot(rocket.vx,rocket.vy,rocket.vz));
    rocket.vx=(rocket.vx/velocityLen)*rocketSpeed;
    rocket.vy=(rocket.vy/velocityLen)*rocketSpeed;
    rocket.vz=(rocket.vz/velocityLen)*rocketSpeed;
    rocket.angle=Math.atan2(rocket.vx,rocket.vz);

    let prevX=rocket.x;
    let prevY=rocket.y;
    let prevZ=rocket.z;
    rocket.x+=rocket.vx;
    rocket.y+=rocket.vy;
    rocket.z+=rocket.vz;
    rocket.mesh.position.set(rocket.x,rocket.y,rocket.z);
    rocket.mesh.rotation.y=rocket.angle;
    rocket.mesh.rotation.x=-Math.asin(clamp(rocket.vy/rocketSpeed,-1,1));
    rocket.mesh.rotation.z=Math.sin(rocket.age*0.45)*0.05;

    if(rocket.age%2===0){
      dust.spawnThrusterParticle(
        rocket.x-Math.sin(rocket.angle)*0.62,
        rocket.y,
        rocket.z-Math.cos(rocket.angle)*0.62,
        -Math.sin(rocket.angle)*2.4+(Math.random()-0.5)*0.8,
        -Math.cos(rocket.angle)*2.4+(Math.random()-0.5)*0.8,
        (Math.random()-0.5)*0.8,
        0.18,
        0.07+Math.random()*0.04
      );
    }

    let surfaceY=drivingSurfaceHeight(rocket.x,rocket.z);
    let hitActor=null;
    if(rocket.age>4){
      for(let actor of combatActors()){
        if(actor===rocket.owner) continue;
        if(rocket.owner.isEnemy && actor.isEnemy) continue;
        let dx=rocket.x-actor.x;
        let dz=rocket.z-actor.z;
        if(dx*dx+dz*dz<4.2*4.2 && Math.abs(rocket.y-actor.y)<4.2){
          hitActor=actor;
          break;
        }
      }
    }

    let hitObstacle=world.obstacleAlongSegment3D(prevX,prevY,prevZ,rocket.x,rocket.y,rocket.z,1.25);
    let hit=rocket.y<=surfaceY+0.35 || hitObstacle || hitActor;

    if(hit || rocket.age>rocket.life){
      if(hit){
        let explosionX=hitObstacle ? hitObstacle.x : rocket.x;
        let explosionZ=hitObstacle ? hitObstacle.z : rocket.z;
        let explosionY=hitObstacle
          ? Math.max(groundHeight(hitObstacle.x,hitObstacle.z)+Math.max(0.8,hitObstacle.r*0.45),surfaceY+0.5)
          : Math.max(rocket.y,surfaceY+0.5);
        spawnRocketExplosion(explosionX,explosionY,explosionZ);
        if(hitObstacle){
          if(hitObstacle.type==="rock" || hitObstacle.type==="smallRock" || hitObstacle.type==="building" || hitObstacle.type==="wall"){
            spawnRockDebris(hitObstacle.x,explosionY,hitObstacle.z,hitObstacle);
          }
          world.destroyObstacle(hitObstacle);
        }
        if(hitActor){
          damageActor(hitActor,18);
          rattleActor(hitActor,1);
        }
      }
      removeRocket(i);
    }
  }
}

function updateCannonBolts(){
  for(let i=cannonBolts.length-1;i>=0;i--){
    let bolt=cannonBolts[i];
    bolt.age++;

    let prevX=bolt.x;
    let prevY=bolt.y;
    let prevZ=bolt.z;
    bolt.x+=bolt.vx;
    bolt.y+=bolt.vy;
    bolt.z+=bolt.vz;

    let angle=Math.atan2(bolt.vx,bolt.vz);
    bolt.mesh.position.set(bolt.x,bolt.y,bolt.z);
    bolt.mesh.rotation.y=angle;
    bolt.mesh.rotation.x=-Math.asin(clamp(bolt.vy/cannonSpeed,-1,1));
    bolt.mesh.scale.setScalar(1+Math.sin(bolt.age*0.7)*0.08);

    if(bolt.age%2===0){
      dust.spawnThrusterParticle(
        bolt.x-bolt.vx*0.18,
        bolt.y,
        bolt.z-bolt.vz*0.18,
        -bolt.vx*0.42+(Math.random()-0.5)*0.55,
        -bolt.vz*0.42+(Math.random()-0.5)*0.55,
        (Math.random()-0.5)*0.55,
        0.13,
        0.045+Math.random()*0.025
      );
    }

    let surfaceY=drivingSurfaceHeight(bolt.x,bolt.z);
    let hitActor=null;
    if(bolt.age>2){
      for(let actor of combatActors()){
        if(actor===bolt.owner) continue;
        if(bolt.owner.isEnemy && actor.isEnemy) continue;
        let dx=bolt.x-actor.x;
        let dz=bolt.z-actor.z;
        if(dx*dx+dz*dz<3.6*3.6 && Math.abs(bolt.y-actor.y)<4.0){
          hitActor=actor;
          break;
        }
      }
    }

    let hitObstacle=world.obstacleAlongSegment3D(prevX,prevY,prevZ,bolt.x,bolt.y,bolt.z,0.9);
    let hit=bolt.y<=surfaceY+0.22 || hitObstacle || hitActor;

    if(hit || bolt.age>bolt.life){
      if(hit){
        let explosionX=hitObstacle ? hitObstacle.x : bolt.x;
        let explosionZ=hitObstacle ? hitObstacle.z : bolt.z;
        let explosionY=hitObstacle
          ? Math.max(groundHeight(hitObstacle.x,hitObstacle.z)+Math.max(0.55,hitObstacle.r*0.35),surfaceY+0.4)
          : Math.max(bolt.y,surfaceY+0.45);
        spawnRocketExplosion(explosionX,explosionY,explosionZ);
        if(hitObstacle){
          if(hitObstacle.type==="rock" || hitObstacle.type==="smallRock" || hitObstacle.type==="building" || hitObstacle.type==="wall"){
            spawnRockDebris(hitObstacle.x,explosionY,hitObstacle.z,hitObstacle);
          }
          world.destroyObstacle(hitObstacle);
        }
        if(hitActor){
          damageActor(hitActor,9);
          rattleActor(hitActor,0.72);
        }
      }
      removeCannonBolt(i);
    }
  }
}

function nearestActivePlayer(enemy){
  let best=null;
  let bestDist=Infinity;

  for(let car of activeCars()){
    if(car.health<=0 || !car.group.visible) continue;
    let dx=car.x-enemy.x;
    let dz=car.z-enemy.z;
    let distSq=dx*dx+dz*dz;
    if(distSq<bestDist){
      best=car;
      bestDist=distSq;
    }
  }

  return best;
}

function playerSpawnDistanceSq(x,z){
  let best=Infinity;
  for(let car of activeCars()){
    if(car.health<=0) continue;
    let dx=x-car.x;
    let dz=z-car.z;
    best=Math.min(best,dx*dx+dz*dz);
  }
  return best;
}

function playerDistanceSqForEnemy(enemy){
  let best=Infinity;
  for(let car of activeCars()){
    if(car.health<=0 || !car.group.visible) continue;
    let dx=enemy.x-car.x;
    let dz=enemy.z-car.z;
    best=Math.min(best,dx*dx+dz*dz);
  }
  return best;
}

function villageSpawnCenters(center){
  let villages=[];

  for(let chunk of world.chunks.values()){
    if(!chunk.villageCenters) continue;
    for(let village of chunk.villageCenters){
      if((village.enemyRemaining ?? 0)<=0) continue;
      let dx=village.x-center.x;
      let dz=village.z-center.z;
      let distSq=dx*dx+dz*dz;
      if(distSq<130*130 || distSq>620*620) continue;
      villages.push({village,distSq});
    }
  }

  villages.sort((a,b)=>a.distSq-b.distSq);
  return villages;
}

function enemySpawnPointForVillage(village,index){
  for(let attempt=0;attempt<24;attempt++){
    let angle=Math.random()*Math.PI*2;
    let radius=(village.r || 32)*(1.25+Math.random()*0.65)+index*5;
    let x=village.x+Math.cos(angle)*radius+(Math.random()-0.5)*12;
    let z=village.z+Math.sin(angle)*radius+(Math.random()-0.5)*12;
    let h=drivingSurfaceHeight(x,z);

    if(
      Number.isFinite(h)
      && playerSpawnDistanceSq(x,z)>120*120
      && waterDepthAt(x,z)<1.4
      && roadDistance(x,z)>18
      && !world.collidesWithObstacles(x,z)
    ){
      return {x,z};
    }
  }

  return null;
}

function enemySpawnVillage(){
  let players=activeCars().filter(car=>car.health>0);
  let center=players.length
    ? players.reduce((acc,car)=>({x:acc.x+car.x/players.length,z:acc.z+car.z/players.length}),{x:0,z:0})
    : {x:playerCar.x,z:playerCar.z};
  let villages=villageSpawnCenters(center);

  if(villages.length===0) return null;
  return villages[Math.floor(Math.random()*Math.min(villages.length,4))].village;
}

function enemyPatrolSpawnPoint(index){
  let players=activeCars().filter(car=>car.health>0);
  let center=players.length
    ? players.reduce((acc,car)=>({x:acc.x+car.x/players.length,z:acc.z+car.z/players.length}),{x:0,z:0})
    : {x:playerCar.x,z:playerCar.z};

  for(let attempt=0;attempt<18;attempt++){
    let angle=Math.random()*Math.PI*2;
    let distance=520+Math.random()*190+index*24;
    let x=center.x+Math.cos(angle)*distance+(Math.random()-0.5)*28;
    let z=center.z+Math.sin(angle)*distance+(Math.random()-0.5)*28;
    let h=drivingSurfaceHeight(x,z);

    if(
      Number.isFinite(h)
      && waterDepthAt(x,z)<1.4
      && roadDistance(x,z)>22
      && !world.collidesWithObstacles(x,z)
    ){
      return {x,z};
    }
  }

  return null;
}

function spawnEnemyWave(){
  let village=enemySpawnVillage();
  if(!village) return false;

  let count=Math.min(village.enemyRemaining ?? 0,Math.random()<0.75 ? 1 : 2);
  if(count<=0) return false;

  for(let i=0;i<count;i++){
    let point=enemySpawnPointForVillage(village,i);
    if(!point) continue;
    let enemy=createEnemyState(++enemySpawnSerial,point.x,point.z);
    enemy.spawnVillage=village;
    enemy.guardX=point.x;
    enemy.guardZ=point.z;
    enemy.guardPhase=Math.random()*Math.PI*2;
    enemy.angle=roadYawAt(point.z)+Math.PI+(Math.random()-0.5)*0.8;
    enemy.velAngle=enemy.angle;
    enemy.group.position.set(enemy.x,enemy.y,enemy.z);
    enemy.group.rotation.y=enemy.angle;
    enemy.shadow.update({carX:enemy.x,carZ:enemy.z,carY:enemy.y,surfaceY:enemy.y,carVelAngle:enemy.angle});
    enemies.push(enemy);
    village.enemyRemaining=Math.max(0,(village.enemyRemaining ?? 0)-1);
  }
  return true;
}

function spawnEnemyPatrol(){
  for(let i=0;i<2;i++){
    let point=enemyPatrolSpawnPoint(i);
    if(!point) return false;
    let enemy=createEnemyState(++enemySpawnSerial,point.x,point.z);
    enemy.isPatrol=true;
    enemy.angle=roadYawAt(point.z)+Math.PI+(Math.random()-0.5)*1.4;
    enemy.velAngle=enemy.angle;
    enemy.group.position.set(enemy.x,enemy.y,enemy.z);
    enemy.group.rotation.y=enemy.angle;
    enemy.shadow.update({carX:enemy.x,carZ:enemy.z,carY:enemy.y,surfaceY:enemy.y,carVelAngle:enemy.angle});
    enemies.push(enemy);
  }
  return true;
}

function clearEnemies(){
  for(let enemy of enemies){
    enemy.active=false;
    enemy.group.visible=false;
    if(enemy.shadow){
      enemy.shadow.dispose();
      enemy.shadow=null;
    }
    scene.remove(enemy.group);
  }
  enemies=[];
  enemyWaveDelay=0;
  enemyPatrolDelay=900;
}

function updateEnemy(enemy){
  if(!enemy.active || enemy.health<=0) return;
  if(enemy.cannonCooldown>0) enemy.cannonCooldown--;

  let target=nearestActivePlayer(enemy);
  if(!target){
    enemy.speed*=0.9;
    return;
  }

  enemy.aiTarget=target;
  let dx=target.x-enemy.x;
  let dz=target.z-enemy.z;
  let distance=Math.max(0.001,Math.hypot(dx,dz));
  let targetAngle=Math.atan2(dx,dz);
  let desiredAngle=targetAngle;
  let desiredSpeed;

  if(enemy.spawnVillage && !enemy.isPatrol){
    let homeX=Number.isFinite(enemy.guardX) ? enemy.guardX : enemy.spawnVillage.x;
    let homeZ=Number.isFinite(enemy.guardZ) ? enemy.guardZ : enemy.spawnVillage.z;
    let homeDx=homeX-enemy.x;
    let homeDz=homeZ-enemy.z;
    let homeDistance=Math.hypot(homeDx,homeDz);
    let homeAngle=Math.atan2(homeDx,homeDz);

    if(distance>74 && homeDistance<18){
      desiredAngle=targetAngle;
      desiredSpeed=0.035;
    }else if(homeDistance>24){
      desiredAngle=homeAngle;
      desiredSpeed=0.16;
    }else if(homeDistance>10){
      desiredAngle=homeAngle;
      desiredSpeed=0.055;
    }else{
      desiredAngle=targetAngle+enemy.aiStrafe*0.18*Math.sin(performance.now()*0.0015+enemy.guardPhase);
      desiredSpeed=0.012*Math.sin(performance.now()*0.002+enemy.guardPhase);
    }
  }else{
    if(distance<48){
      desiredAngle+=enemy.aiStrafe*clamp((48-distance)/28,0,1)*0.68;
    }
    desiredSpeed=distance>58 ? 0.38 : distance>30 ? 0.18 : -0.08;
  }

  let turn=clamp(normalizeAngle(desiredAngle-enemy.angle),-0.045,0.045);
  enemy.angle=normalizeAngle(enemy.angle+turn);

  enemy.speed+=clamp(desiredSpeed-enemy.speed,-0.012,0.012);
  let maxEnemySpeed=enemy.spawnVillage && !enemy.isPatrol ? 0.18 : 0.42;
  enemy.speed=clamp(enemy.speed,-0.14,maxEnemySpeed);

  let prevX=enemy.x;
  let prevZ=enemy.z;
  if(!gameOver){
    enemy.x+=Math.sin(enemy.angle)*enemy.speed;
    enemy.z+=Math.cos(enemy.angle)*enemy.speed;
  }

  let collision=movementCollision(enemy,prevX,prevZ,enemy.x,enemy.z);
  if(collision.hit){
    enemy.x=collision.safeX;
    enemy.z=collision.safeZ;
    enemy.speed*=-0.25;
    enemy.angle=normalizeAngle(enemy.angle+(Math.random()<0.5 ? -1 : 1)*0.55);
    enemy.aiStrafe*=-1;
  }

  let surfaceY=drivingSurfaceHeight(enemy.x,enemy.z);
  enemy.y=surfaceY;
  enemy.onGround=true;
  enemy.airborne=false;
  enemy.velAngle=enemy.angle;
  enemy.group.position.set(enemy.x,enemy.y,enemy.z);
  enemy.group.rotation.y=enemy.angle;
  enemy.group.rotation.x=enemy.pitch;
  enemy.group.rotation.z=0;
  updateMechAnimation(enemy);

  if(distance<82 && Math.abs(normalizeAngle(targetAngle-enemy.angle))<0.52){
    if(fireCannon(enemy)){
      enemy.cannonCooldown=78+Math.floor(Math.random()*58);
    }
  }

  if(enemy.hitRattle>0){
    let shake=enemy.hitRattle;
    let t=performance.now()*0.04+enemy.hitRattleSeed;
    enemy.group.rotation.x+=Math.sin(t*1.7)*0.08*shake;
    enemy.group.rotation.z+=Math.cos(t*2.1)*0.11*shake;
    enemy.group.position.x+=Math.sin(t*2.6)*0.14*shake;
    enemy.group.position.y+=Math.abs(Math.sin(t*3.1))*0.12*shake;
    enemy.group.position.z+=Math.cos(t*2.3)*0.14*shake;
    enemy.hitRattle=Math.max(0,enemy.hitRattle-0.055);
  }

  enemy.shadow.update({carX:enemy.x,carZ:enemy.z,carY:enemy.y,surfaceY,carVelAngle:enemy.angle});
}

function updateEnemies(){
  for(let enemy of enemies){
    updateEnemy(enemy);
    if(enemy.active && playerDistanceSqForEnemy(enemy)>720*720){
      enemy.active=false;
      enemy.group.visible=false;
      if(enemy.shadow){
        enemy.shadow.dispose();
        enemy.shadow=null;
      }
      scene.remove(enemy.group);
    }
  }
  enemies=enemies.filter(enemy=>enemy.active);

  if(activeEnemies().length<=1){
    if(enemyWaveDelay>0) enemyWaveDelay--;
    else{
      if(spawnEnemyWave()){
        enemyWaveDelay=420;
      }else{
        enemyWaveDelay=90;
      }
    }
  }

  if(enemyPatrolDelay>0) enemyPatrolDelay--;
  else{
    if(activeEnemies().length<8 && spawnEnemyPatrol()){
      enemyPatrolDelay=1500+Math.floor(Math.random()*1200);
    }else{
      enemyPatrolDelay=360;
    }
  }
}

function settleTrickAngle(value,amount){
  return value+normalizeAngle(-value)*amount;
}

function updateAirTricks(car,airborne){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);

  car.lastTrickButtons={...buttons};
  car.trickPitchVel=clamp(car.trickPitchVel,-0.19,0.19);
  car.trickRollVel=clamp(car.trickRollVel,-0.21,0.21);
  car.trickYawVel=clamp(car.trickYawVel,-0.18,0.18);

  car.trickPitch=normalizeAngle(car.trickPitch+car.trickPitchVel);
  car.trickRoll=normalizeAngle(car.trickRoll+car.trickRollVel);
  car.trickYaw=normalizeAngle(car.trickYaw+car.trickYawVel);

  if(airborne){
    car.trickPitchVel*=0.972;
    car.trickRollVel*=0.972;
    car.trickYawVel*=0.972;
  }else{
    car.trickPitchVel*=0.76;
    car.trickRollVel*=0.76;
    car.trickYawVel*=0.76;
    car.trickPitch=settleTrickAngle(car.trickPitch,0.24);
    car.trickRoll=settleTrickAngle(car.trickRoll,0.24);
    car.trickYaw=settleTrickAngle(car.trickYaw,0.18);

    if(Math.abs(car.trickPitch)<0.004) car.trickPitch=0;
    if(Math.abs(car.trickRoll)<0.004) car.trickRoll=0;
    if(Math.abs(car.trickYaw)<0.004) car.trickYaw=0;
  }
}

function updateMorphInput(car){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let keyboardMorph=gameMode==="single" && car===playerCar && input.keys.t;
  let morphButton=buttons.a || keyboardMorph;
  let pressedMorph=morphButton && !car.lastMorphButton;

  if(pressedMorph && !gameOver && car.health>0) car.morphed=!car.morphed;
  car.lastMorphButton=morphButton;
}

function updateFlightThrust(car,surfaceY){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let keyboardFlight=gameMode==="single" && car===playerCar && input.keys[" "];
  if(!(buttons.x || keyboardFlight) || gameOver || car.health<=0) return false;
  if(car.boostCharge<=0) return false;

  let altitude=car.y-surfaceY;
  if(altitude<0.12){
    car.y=surfaceY+0.12;
    car.vy=Math.max(car.vy,0.18);
  }

  car.boostCharge=Math.max(0,car.boostCharge-(altitude<18 ? 0.34 : 0.18));
  let altitudeLift=altitude<18 ? 0.052 : 0.018;
  car.vy=clamp(car.vy+altitudeLift,-0.08,0.62);
  car.onGround=false;
  return true;
}

function emitFlightExhaust(car){
  let speedAbs=Math.abs(car.speed || 0);
  for(let side of [-1,1]){
    let footX=car.x+Math.cos(car.angle)*side*0.72-Math.sin(car.angle)*0.08;
    let footZ=car.z-Math.sin(car.angle)*side*0.72-Math.cos(car.angle)*0.08;

    for(let i=0;i<3;i++){
      let lateral=(Math.random()-.5)*0.24;
      let rear=(Math.random()-.5)*0.18;
      let px=footX+Math.cos(car.angle)*lateral-Math.sin(car.angle)*rear;
      let pz=footZ-Math.sin(car.angle)*lateral-Math.cos(car.angle)*rear;

      dust.spawnThrusterParticle(
        px,
        car.y+0.12+Math.random()*0.12,
        pz,
        (Math.random()-.5)*0.24-Math.sin(car.angle)*speedAbs*0.28,
        (Math.random()-.5)*0.24-Math.cos(car.angle)*speedAbs*0.28,
        -2.2-Math.random()*1.8,
        0.28+Math.random()*0.18,
        0.12+Math.random()*0.08
      );
    }
  }
}

function resetMechPart(part){
  if(!part || !part.userData.basePosition || !part.userData.baseRotation) return;
  part.position.copy(part.userData.basePosition);
  part.rotation.copy(part.userData.baseRotation);
  if(part.userData.baseScale) part.scale.copy(part.userData.baseScale);
}

function morphStage(progress,start,end){
  return smoothStep((progress-start)/(end-start));
}

function morphPulse(progress,center,width){
  return clamp(1-Math.abs(progress-center)/width,0,1);
}

function crossedMorphStage(previous,current,stage){
  return (previous<stage && current>=stage) || (previous>stage && current<=stage);
}

function emitMorphSparks(car,count=12){
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);

  for(let i=0;i<count;i++){
    let side=i%2===0 ? -1 : 1;
    let lateral=side*(0.65+Math.random()*1.55);
    let longitudinal=-1.45+Math.random()*3.5;
    let height=0.7+Math.random()*2.6;
    let burst=1.1+Math.random()*2.4;

    dust.spawnThrusterParticle(
      car.x+rightX*lateral+forwardX*longitudinal,
      car.y+height,
      car.z+rightZ*lateral+forwardZ*longitudinal,
      rightX*side*burst+forwardX*(Math.random()-0.5)*1.8,
      rightZ*side*burst+forwardZ*(Math.random()-0.5)*1.8,
      0.6+Math.random()*2.2,
      0.16+Math.random()*0.12,
      0.045+Math.random()*0.035
    );
  }
}

function applyTransformerFold(model,progress){
  let parts=model && model.userData ? model.userData.walkParts : null;
  if(!parts) return;

  let unlock=morphStage(progress,0.02,0.2);
  let crouch=morphStage(progress,0.08,0.38);
  let fold=morphStage(progress,0.2,0.56);
  let tuck=morphStage(progress,0.36,0.72);
  let lock=morphStage(progress,0.62,0.94);
  let jitter=morphPulse(progress,0.48,0.32)*Math.sin(performance.now()*0.055)*0.028;

  if(parts.pelvis){
    parts.pelvis.position.y-=0.26*crouch+0.62*tuck;
    parts.pelvis.position.z+=0.34*fold+0.42*lock;
    parts.pelvis.rotation.x+=0.38*fold+0.22*lock;
    parts.pelvis.scale.y*=1-0.22*tuck;
  }
  if(parts.torso){
    parts.torso.position.y-=0.54*crouch+0.76*fold;
    parts.torso.position.z+=0.26*fold+0.38*lock;
    parts.torso.rotation.x+=0.62*fold-0.16*lock+jitter;
    parts.torso.scale.y*=1-0.24*fold;
    parts.torso.scale.z*=1+0.26*tuck;
  }
  if(parts.chestPlate){
    parts.chestPlate.position.y-=0.58*crouch+0.92*fold;
    parts.chestPlate.position.z+=0.2*fold+0.72*lock;
    parts.chestPlate.rotation.x+=0.72*fold-0.24*lock;
    parts.chestPlate.scale.x*=1+0.16*lock;
  }
  if(parts.cockpit){
    parts.cockpit.position.y-=0.72*crouch+1.06*fold;
    parts.cockpit.position.z+=0.38*fold+0.96*lock;
    parts.cockpit.rotation.x+=0.82*fold-0.28*lock;
    parts.cockpit.scale.x*=1+0.32*lock;
    parts.cockpit.scale.y*=1-0.16*lock;
  }
  if(parts.reactorPack){
    parts.reactorPack.position.y-=0.36*crouch+0.48*fold;
    parts.reactorPack.position.z-=0.32*fold+0.78*tuck;
    parts.reactorPack.rotation.x-=0.7*fold;
    parts.reactorPack.scale.z*=1+0.42*lock;
  }
  if(parts.neck){
    parts.neck.position.y-=0.86*fold;
    parts.neck.scale.y*=1-0.72*fold;
  }
  if(parts.head){
    parts.head.position.y-=0.9*crouch+1.18*fold;
    parts.head.position.z-=0.22*fold+0.34*tuck;
    parts.head.rotation.x+=1.12*fold;
    let headScale=1-0.34*fold;
    parts.head.scale.multiplyScalar(headScale);
  }
  if(parts.visor){
    parts.visor.position.y-=0.92*crouch+1.2*fold;
    parts.visor.position.z-=0.2*fold+0.36*tuck;
    parts.visor.rotation.x+=1.12*fold;
    parts.visor.scale.multiplyScalar(1-0.2*fold);
  }
  if(parts.antenna){
    parts.antenna.position.y-=0.86*fold;
    parts.antenna.position.z-=0.2*fold;
    parts.antenna.rotation.x+=1.45*fold;
    parts.antenna.rotation.z-=0.55*fold;
  }

  for(let sideName of ["left","right"]){
    let side=sideName==="left" ? -1 : 1;
    let sideParts=parts[sideName];
    if(!sideParts) continue;

    if(sideParts.shoulder){
      sideParts.shoulder.position.x+=side*(0.24*unlock+0.54*tuck);
      sideParts.shoulder.position.y-=0.42*crouch+0.74*fold;
      sideParts.shoulder.position.z-=0.48*fold;
      sideParts.shoulder.rotation.z+=side*(0.42*fold+0.92*tuck);
      sideParts.shoulder.rotation.x-=0.24*fold;
    }
    if(sideParts.upperArm){
      sideParts.upperArm.position.x+=side*(0.18*unlock+0.42*tuck);
      sideParts.upperArm.position.y-=0.5*crouch+0.42*fold;
      sideParts.upperArm.position.z-=0.22*fold+0.24*lock;
      sideParts.upperArm.rotation.x-=0.78*fold+0.42*tuck;
      sideParts.upperArm.rotation.z+=side*(0.3*fold+0.72*tuck);
      sideParts.upperArm.scale.y*=1-0.18*lock;
    }
    if(sideParts.elbow){
      sideParts.elbow.position.x+=side*(0.2*unlock+0.46*tuck);
      sideParts.elbow.position.y-=0.42*crouch+0.38*fold;
      sideParts.elbow.position.z-=0.12*fold+0.18*lock;
    }
    if(sideParts.forearm){
      sideParts.forearm.position.x+=side*(0.24*unlock+0.62*tuck);
      sideParts.forearm.position.y-=0.38*crouch+0.12*fold;
      sideParts.forearm.position.z+=0.18*fold+0.72*lock;
      sideParts.forearm.rotation.x-=0.62*fold;
      sideParts.forearm.rotation.z+=side*(0.5*fold+1.08*tuck);
      sideParts.forearm.scale.y*=1-0.28*lock;
    }
    if(sideParts.hand){
      sideParts.hand.position.x+=side*(0.26*unlock+0.76*tuck);
      sideParts.hand.position.y-=0.32*crouch;
      sideParts.hand.position.z+=0.36*fold+0.9*lock;
      sideParts.hand.rotation.z+=side*1.12*tuck;
      sideParts.hand.scale.y*=1-0.34*lock;
    }
    if(sideParts.cannon){
      sideParts.cannon.position.x+=side*(0.28*unlock+0.76*tuck);
      sideParts.cannon.position.y-=0.32*crouch+0.2*fold;
      sideParts.cannon.position.z+=0.72*fold+1.05*lock;
      sideParts.cannon.rotation.y+=side*0.26*lock;
      sideParts.cannon.rotation.z+=side*0.36*tuck;
    }
    if(sideParts.cannonShroud){
      sideParts.cannonShroud.position.x+=side*(0.28*unlock+0.72*tuck);
      sideParts.cannonShroud.position.y-=0.36*crouch+0.28*fold;
      sideParts.cannonShroud.position.z+=0.52*fold+0.88*lock;
      sideParts.cannonShroud.rotation.z+=side*0.86*tuck;
    }

    if(sideParts.hip){
      sideParts.hip.position.y-=0.28*crouch+0.54*fold;
      sideParts.hip.position.z+=0.22*fold+0.24*lock;
      sideParts.hip.rotation.x+=side*0.18*tuck;
    }
    if(sideParts.upperLeg){
      sideParts.upperLeg.position.x+=side*0.12*tuck;
      sideParts.upperLeg.position.y+=0.1*crouch-0.36*fold+0.42*tuck;
      sideParts.upperLeg.position.z+=0.24*fold+0.52*lock;
      sideParts.upperLeg.rotation.x-=0.88*fold+0.42*tuck;
      sideParts.upperLeg.scale.y*=1-0.22*lock;
    }
    if(sideParts.knee){
      sideParts.knee.position.x+=side*0.18*tuck;
      sideParts.knee.position.y+=0.24*tuck;
      sideParts.knee.position.z+=0.38*fold+0.62*lock;
    }
    if(sideParts.kneePlate){
      sideParts.kneePlate.position.x+=side*0.18*tuck;
      sideParts.kneePlate.position.y+=0.26*tuck;
      sideParts.kneePlate.position.z+=0.54*fold+0.82*lock;
      sideParts.kneePlate.rotation.x-=0.42*lock;
    }
    if(sideParts.shin){
      sideParts.shin.position.x+=side*0.2*tuck;
      sideParts.shin.position.y+=0.72*tuck;
      sideParts.shin.position.z+=0.62*fold+1.02*lock;
      sideParts.shin.rotation.x+=0.72*fold-0.36*lock;
      sideParts.shin.scale.y*=1-0.28*lock;
    }
    if(sideParts.foot){
      sideParts.foot.position.x+=side*(0.18*tuck+0.34*lock);
      sideParts.foot.position.y+=0.9*tuck;
      sideParts.foot.position.z+=0.88*fold+1.48*lock;
      sideParts.foot.rotation.x-=0.2*fold+0.16*lock;
      sideParts.foot.rotation.z+=side*0.16*lock;
      sideParts.foot.scale.z*=1+0.28*lock;
      sideParts.foot.scale.y*=1-0.22*lock;
    }
    if(sideParts.toePlate){
      sideParts.toePlate.position.x+=side*(0.18*tuck+0.34*lock);
      sideParts.toePlate.position.y+=0.9*tuck;
      sideParts.toePlate.position.z+=1.02*fold+1.74*lock;
      sideParts.toePlate.rotation.x-=0.36*fold+0.08*lock;
      sideParts.toePlate.scale.z*=1+0.34*lock;
    }

    if(sideParts.frontWheel){
      sideParts.frontWheel.position.x+=side*(0.18*unlock+0.6*tuck);
      sideParts.frontWheel.position.y-=0.74*crouch+0.92*fold;
      sideParts.frontWheel.position.z+=0.68*fold+1.34*lock;
      sideParts.frontWheel.rotation.x+=progress*8;
      sideParts.frontWheel.scale.multiplyScalar(1+0.18*lock);
    }
    if(sideParts.frontHub){
      sideParts.frontHub.position.x+=side*(0.18*unlock+0.6*tuck);
      sideParts.frontHub.position.y-=0.74*crouch+0.92*fold;
      sideParts.frontHub.position.z+=0.68*fold+1.34*lock;
      sideParts.frontHub.rotation.x+=progress*8;
      sideParts.frontHub.scale.multiplyScalar(1+0.18*lock);
    }
    if(sideParts.rearWheel){
      sideParts.rearWheel.position.x+=side*(0.2*tuck+0.46*lock);
      sideParts.rearWheel.position.y+=0.92*tuck;
      sideParts.rearWheel.position.z+=0.58*fold+1.12*lock;
      sideParts.rearWheel.rotation.x+=progress*8;
      sideParts.rearWheel.scale.multiplyScalar(1+0.22*lock);
    }
    if(sideParts.rearHub){
      sideParts.rearHub.position.x+=side*(0.2*tuck+0.46*lock);
      sideParts.rearHub.position.y+=0.92*tuck;
      sideParts.rearHub.position.z+=0.58*fold+1.12*lock;
      sideParts.rearHub.rotation.x+=progress*8;
      sideParts.rearHub.scale.multiplyScalar(1+0.22*lock);
    }
  }
}

function makeAimCross(accentColor){
  let group=new THREE.Group();
  group.position.set(0,3.15,32);

  let material=new THREE.MeshBasicMaterial({
    color:accentColor,
    transparent:true,
    opacity:0.72,
    depthWrite:false,
    depthTest:false
  });
  let lineMaterial=new THREE.LineBasicMaterial({
    color:0x8dfff2,
    transparent:true,
    opacity:0.86,
    depthWrite:false,
    depthTest:false
  });

  let ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,0.032,8,56),material);
  ring.renderOrder=20;
  group.add(ring);

  let points=[
    -1.55,0,0, -0.78,0,0,
    0.78,0,0, 1.55,0,0,
    0,-1.55,0, 0,-0.78,0,
    0,0.78,0, 0,1.55,0
  ];
  let crossGeo=new THREE.BufferGeometry();
  crossGeo.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
  let cross=new THREE.LineSegments(crossGeo,lineMaterial);
  cross.renderOrder=21;
  group.add(cross);
  group.userData.ring=ring;
  group.userData.cross=cross;
  group.userData.baseRingColor=material.color.clone();
  group.userData.baseCrossColor=lineMaterial.color.clone();
  group.userData.lockColor=new THREE.Color(0x42ff68);

  return group;
}

function setupMorphModels(car,accentColor){
  let mech=makeMechModel(accentColor);
  let aimCross=makeAimCross(accentColor);

  car.group.clear();
  car.group.add(mech,aimCross);
  car.mechModel=mech;
  car.carModel=null;
  car.aimCross=aimCross;
}

function setMorphCarModel(car,model){
  if(car.carModel) car.group.remove(car.carModel);
  model.visible=false;
  car.carModel=model;
  car.group.add(model);
  updateMorphVisual(car);
}

function makeEnemyMechModel(seed=0){
  let mech=makeMechModel(seed%2===0 ? 0x9cff2f : 0xff5a2f);
  mech.name="enemy-mech";
  mech.scale.set(1.18,0.96,1.1);

  mech.traverse(child=>{
    if(!child.isMesh) return;
    child.material=child.material.clone();
    if(child.name.includes("cockpit") || child.name.includes("visor")){
      child.material=enemyEyeMat.clone();
    }else if(child.name.includes("plate") || child.name.includes("shroud")){
      child.material=enemyTrimMat.clone();
    }else if(child.name.includes("torso") || child.name.includes("shoulder") || child.name.includes("forearm") || child.name.includes("upper-leg") || child.name.includes("foot")){
      child.material.color.set(seed%2===0 ? 0x25372f : 0x3a2d35);
      child.material.roughness=0.72;
      child.material.metalness=0.62;
    }else{
      child.material.color.set(0x111514);
    }
  });

  function addEnemyPart(mesh){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    mesh.userData.basePosition=mesh.position.clone();
    mesh.userData.baseRotation=mesh.rotation.clone();
    mesh.userData.baseScale=mesh.scale.clone();
    mech.add(mesh);
  }

  let eye=new THREE.Mesh(new THREE.BoxGeometry(0.92,0.18,0.1),enemyEyeMat.clone());
  eye.name="enemy-red-eye";
  eye.position.set(0,4.56,0.58);
  addEnemyPart(eye);

  for(let side of [-1,1]){
    let horn=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.72,5),enemyTrimMat.clone());
    horn.name=side<0 ? "enemy-left-horn" : "enemy-right-horn";
    horn.position.set(side*0.42,4.96,0.06);
    horn.rotation.z=-side*0.28;
    addEnemyPart(horn);

    let shoulderSpike=new THREE.Mesh(new THREE.ConeGeometry(0.18,0.84,5),enemyTrimMat.clone());
    shoulderSpike.name=side<0 ? "enemy-left-shoulder-spike" : "enemy-right-shoulder-spike";
    shoulderSpike.position.set(side*1.72,3.92,-0.04);
    shoulderSpike.rotation.z=-side*Math.PI/2;
    addEnemyPart(shoulderSpike);
  }

  return mech;
}

function createEnemyState(index,x,z){
  let group=new THREE.Group();
  group.rotation.order="YXZ";
  scene.add(group);

  let mech=makeEnemyMechModel(index);
  group.add(mech);

  return {
    id:`enemy-${index}`,
    isEnemy:true,
    active:true,
    group,
    shadow:createCarShadow(scene),
    mechModel:mech,
    carModel:null,
    aimCross:null,
    x,
    y:drivingSurfaceHeight(x,z),
    z,
    angle:Math.random()*Math.PI*2,
    velAngle:0,
    speed:0,
    onGround:true,
    airborne:false,
    vy:0,
    pitch:0,
    trickPitch:0,
    trickRoll:0,
    trickYaw:0,
    trickPitchVel:0,
    trickRollVel:0,
    trickYawVel:0,
    lastTrickButtons:{a:false,b:false,x:false,y:false},
    morphed:false,
    morphProgress:0,
    lastMorphProgress:0,
    aimOffsetX:0,
    aimOffsetY:0,
    lastRocketButton:false,
    rocketCooldown:0,
    lastCannonButton:false,
    cannonCooldown:60+Math.floor(Math.random()*70),
    hitRattle:0,
    hitRattleSeed:0,
    walkCycle:0,
    lastWalkX:x,
    lastWalkZ:z,
    health:36,
    aiTarget:null,
    aiStrafe:Math.random()<0.5 ? -1 : 1,
    aiThink:0,
    lateralOffset:0
  };
}

function updateMorphVisual(car){
  let target=car.morphed ? 1 : 0;
  let previous=car.morphProgress;
  car.morphProgress+=(target-car.morphProgress)*0.16;
  if(Math.abs(target-car.morphProgress)<0.003) car.morphProgress=target;

  let p=car.morphProgress;
  let bodyFold=morphStage(p,0.08,0.62);
  let vehicleReveal=morphStage(p,0.3,0.82);
  let lockIn=morphStage(p,0.64,0.96);
  let transformShake=morphPulse(p,0.5,0.32);

  if(car.mechModel){
    let baseY=car.mechModel.userData.baseY || 0.72;
    let finalHide=morphStage(p,0.82,1);
    let scaleX=1.05*(1+0.12*bodyFold-0.72*finalHide);
    let scaleY=1.05*(1-0.38*bodyFold-0.42*finalHide);
    let scaleZ=1.05*(1+0.28*bodyFold-0.68*finalHide);

    car.mechModel.visible=p<0.995;
    car.mechModel.scale.set(scaleX,scaleY,scaleZ);
    car.mechModel.position.y=car.mechModel.position.y*(1-bodyFold)+((baseY*0.28)+0.2)*bodyFold;
    car.mechModel.rotation.x+=-0.22*bodyFold+Math.sin(performance.now()*0.07)*0.02*transformShake;
    car.mechModel.rotation.z+=Math.sin(performance.now()*0.049)*0.035*transformShake;
    applyTransformerFold(car.mechModel,p);
  }

  if(car.carModel){
    let baseY=car.carModel.userData.baseY || 0.04;
    let baseScale=car.carModel.userData.baseScale || new THREE.Vector3(1,1,1);
    let wheelDrop=morphStage(p,0.18,0.48);
    let scale=0.28+vehicleReveal*0.72;
    let widthSnap=1+0.18*wheelDrop*(1-lockIn);
    let heightSquash=1-0.22*lockIn*(1-vehicleReveal);

    car.carModel.visible=p>0.12;
    car.carModel.scale.set(baseScale.x*scale*widthSnap,baseScale.y*scale*heightSquash,baseScale.z*scale);
    car.carModel.position.y=baseY+(1-vehicleReveal)*0.86+Math.sin(p*Math.PI*5)*0.06*transformShake;
    car.carModel.rotation.x=(1-vehicleReveal)*0.34-0.08*wheelDrop*(1-lockIn);
    car.carModel.rotation.z=Math.sin(performance.now()*0.061)*0.028*transformShake*(1-lockIn);
  }

  if(car.aimCross){
    car.aimCross.scale.setScalar(1+Math.sin(performance.now()*0.004)*0.035);
  }

  if(car.group.visible && car.health>0 && !gameOver && previous!==p){
    if(crossedMorphStage(previous,p,0.22)) emitMorphSparks(car,10);
    if(crossedMorphStage(previous,p,0.48)) emitMorphSparks(car,16);
    if(crossedMorphStage(previous,p,0.78)) emitMorphSparks(car,12);
  }
  car.lastMorphProgress=p;
}

function updateMechAnimation(car){
  let model=car.mechModel || car.group.children[0];
  let parts=model && model.userData ? model.userData.walkParts : null;
  if(!model || !parts) return;

  model.traverse(child=>{
    if(child.isMesh) resetMechPart(child);
  });

  let speedAbs=Math.abs(car.speed || 0);
  let previousWalkX=Number.isFinite(car.lastWalkX) ? car.lastWalkX : car.x;
  let previousWalkZ=Number.isFinite(car.lastWalkZ) ? car.lastWalkZ : car.z;
  let groundDistance=Math.hypot(car.x-previousWalkX,car.z-previousWalkZ);
  car.lastWalkX=car.x;
  car.lastWalkZ=car.z;

  let moving=car.onGround && car.health>0 && !gameOver && groundDistance>0.002 && speedAbs>0.01 && car.morphProgress<0.35;
  let runAmount=moving ? smoothStep((speedAbs-0.2)/0.34) : 0;
  let intensity=moving ? clamp(groundDistance/mechGroundMaxSpeed,0.16,1.1+runAmount*0.35) : 0;
  let direction=car.speed<0 ? -1 : 1;

  if(moving){
    let strideLength=mechStrideLength*(1+runAmount*2.4);
    car.walkCycle+=direction*groundDistance*(Math.PI*2/strideLength)*(1+runAmount*0.16);
  }else{
    car.walkCycle*=0.88;
  }

  let phase=car.walkCycle;
  let flightPulse=Math.pow(Math.max(0,Math.sin(phase*2)),2)*runAmount;
  let bob=Math.abs(Math.sin(phase))*0.12*intensity+flightPulse*0.22;
  let torsoSway=Math.sin(phase)*0.04*intensity*(1+runAmount*0.35);
  let headCounter=Math.sin(phase)*0.025*intensity*(1+runAmount*0.25);
  let forwardLean=runAmount*0.16*direction;

  model.position.y=(model.userData.baseY || 0)+bob;
  model.rotation.z=torsoSway;
  model.rotation.x=-0.035*intensity-forwardLean;

  if(parts.torso) parts.torso.rotation.z+=torsoSway*0.45;
  if(parts.pelvis) {
    parts.pelvis.rotation.z-=torsoSway*0.8;
    parts.pelvis.rotation.x+=forwardLean*0.35;
  }
  if(parts.head) {
    parts.head.rotation.z-=headCounter;
    parts.head.rotation.x+=forwardLean*0.42;
  }
  if(parts.reactorPack) parts.reactorPack.rotation.x+=Math.sin(phase*2)*0.025*intensity+forwardLean*0.45;

  for(let sideName of ["left","right"]){
    let side=sideName==="left" ? -1 : 1;
    let sideParts=parts[sideName];
    let sidePhase=phase+(sideName==="left" ? 0 : Math.PI);
    let swing=Math.sin(sidePhase)*intensity;
    let planted=Math.max(0,Math.cos(sidePhase))*intensity;
    let lifted=Math.max(0,-Math.cos(sidePhase))*intensity;
    let lifted01=smoothStep(lifted/Math.max(0.001,intensity));
    let planted01=smoothStep(planted/Math.max(0.001,intensity));
    let stride=1+runAmount*1.75;
    let lift=1+runAmount*1.15;
    let kneeDrive=runAmount*lifted01;
    let footPlant=runAmount*planted01;

    if(sideParts.upperLeg){
      sideParts.upperLeg.rotation.x+=swing*0.88*stride+kneeDrive*0.72;
      sideParts.upperLeg.position.z+=swing*0.24*stride+kneeDrive*0.28-footPlant*0.12;
    }
    if(sideParts.shin){
      sideParts.shin.rotation.x+=(-swing*0.5*stride-lifted*0.34*lift-kneeDrive*0.9);
      sideParts.shin.position.z+=swing*0.2*stride+kneeDrive*0.46;
    }
    if(sideParts.knee){
      sideParts.knee.position.y+=lifted*0.08+kneeDrive*0.58;
      sideParts.knee.position.z+=swing*0.1+kneeDrive*0.5;
    }
    if(sideParts.kneePlate){
      sideParts.kneePlate.position.y+=lifted*0.08+kneeDrive*0.58;
      sideParts.kneePlate.position.z+=swing*0.1+kneeDrive*0.5;
    }
    if(sideParts.foot){
      sideParts.foot.position.y+=lifted*0.34*lift+kneeDrive*0.98;
      sideParts.foot.position.z+=swing*0.62*stride-planted*0.22+kneeDrive*0.92-footPlant*0.28;
      sideParts.foot.rotation.x+=-swing*0.34*stride+lifted*0.16*lift+kneeDrive*0.62-footPlant*0.18;
    }
    if(sideParts.toePlate){
      sideParts.toePlate.position.y+=lifted*0.34*lift+kneeDrive*0.98;
      sideParts.toePlate.position.z+=swing*0.62*stride-planted*0.22+kneeDrive*0.92-footPlant*0.28;
      sideParts.toePlate.rotation.x+=-swing*0.4*stride+lifted*0.22*lift+kneeDrive*0.72-footPlant*0.24;
    }
    if(sideParts.upperArm){
      sideParts.upperArm.rotation.x+=-swing*(0.24+runAmount*0.7);
      sideParts.upperArm.rotation.z+=side*0.04*intensity;
    }
    if(sideParts.forearm){
      sideParts.forearm.rotation.x+=-swing*(0.16+runAmount*0.42);
    }
    if(sideParts.hand){
      sideParts.hand.position.z+=-swing*(0.06+runAmount*0.22);
    }
    if(sideParts.cannon){
      sideParts.cannon.rotation.x+=-swing*(0.06+runAmount*0.14);
    }
    if(sideParts.shoulder){
      sideParts.shoulder.rotation.z+=side*0.025*intensity;
    }
  }
}

function updateCar(car){
  let prevX=car.x;
  let prevZ=car.z;
  let prevY=car.y;
  let {forward,turn}=controlsFor(car);
  updateMorphInput(car);
  updateAimCross(car);
  updateRocketInput(car);
  car.throttleInput=forward;
  let roadDist=roadDistance(car.x,car.z);
  let localMaxSpeed=mechGroundMaxSpeed;
  let morphSpeedMultiplier=car.morphProgress>0.65 ? morphedCarSpeedMultiplier : 1;
  let airborneMovement=car.airborne || !car.onGround;
  let carDisabled=car.health<=0;

  if(gameOver || carDisabled){
    car.speed=0;
    car.slipAmount=0;
    car.vy=0;
  }else{
    let speedAbs=Math.abs(car.speed);
    let speedRatio=clamp(speedAbs/mechGroundMaxSpeed,0,1);
    let throttle=forward>0;
    let brakeOrReverse=forward<0;
    let throttlePower=Math.abs(forward);

    if(throttle){
      let airThrust=airborneMovement ? 1.85 : 1;
      car.speed+=0.0032*airThrust*throttlePower*(1-speedRatio*0.35);
    }else if(brakeOrReverse){
      car.speed+=(car.speed>0.03 ? -0.02 : -0.0045)*throttlePower;
    }else{
      car.speed*=car.onGround ? 0.965 : 0.985;
      if(Math.abs(car.speed)<0.008) car.speed=0;
    }

    let forwardMaxSpeed=airborneMovement ? mechAirMaxSpeed*morphSpeedMultiplier : localMaxSpeed*morphSpeedMultiplier;
    car.speed=clamp(car.speed,-localMaxSpeed*0.42,forwardMaxSpeed);

    let movingSteer=clamp(speedAbs/0.34,0,1);
    let highSpeedCalm=1-clamp((speedAbs-0.32)/0.32,0,0.18);
    let steeringResponse=(0.52+movingSteer*0.54)*highSpeedCalm;
    let reverseSteer=car.speed< -0.04 ? -1 : 1;
    car.angle+=turn*reverseSteer*0.031*steeringResponse;

    car.velAngle=car.angle;
    car.slipAmount=0;
  }

  if(!gameOver && !carDisabled){
    car.x+=Math.sin(car.angle)*car.speed;
    car.z+=Math.cos(car.angle)*car.speed;
  }

  roadDist=roadDistance(car.x,car.z);
  car.surfaceDistance=roadDist;
  localMaxSpeed=mechGroundMaxSpeed;
  morphSpeedMultiplier=car.morphProgress>0.65 ? morphedCarSpeedMultiplier : 1;
  airborneMovement=car.airborne || !car.onGround;
  car.speed=Math.max(
    -localMaxSpeed*0.42,
    Math.min((airborneMovement ? mechAirMaxSpeed : localMaxSpeed)*morphSpeedMultiplier,car.speed)
  );

  let surfaceY=drivingSurfaceHeight(car.x,car.z);

  let flying=updateFlightThrust(car,surfaceY);
  if(flying) emitFlightExhaust(car);

  let waterDrag=clamp(waterDepthAt(car.x,car.z)/3.5,0,1);
  if(!gameOver && !carDisabled && waterDrag>0){
    car.speed*=1-0.12*waterDrag;
  }

  if(!gameOver && !carDisabled) car.vy-=flying ? gravityStrength*0.22 : gravityStrength;
  let landingVy=car.vy;
  car.y+=car.vy;

  if(car.y<surfaceY){
    if(!gameOver && landingVy<-0.9){
      let landingDamage=landingDamageAmount(car,car.x,car.z,-landingVy);
      if(landingDamage>0) damageCar(car,landingDamage);
    }
    car.y=surfaceY;
    car.vy=0;
  }

  let collision=movementCollision(car,prevX,prevZ,car.x,car.z);
  if(!gameOver && !carDisabled && collision.hit){
    car.x=collision.safeX;
    car.z=collision.safeZ;
    car.y=prevY;
    car.speed=0;
    car.angle+=collision.otherCar ? Math.PI*0.12 : Math.PI*0.18;
    car.velAngle=car.angle;
    damageCar(car,collision.otherCar ? 1 : 3);
    surfaceY=drivingSurfaceHeight(car.x,car.z);
    if(car.y<surfaceY) car.y=surfaceY;
  }

  let waterDepth=waterDepthAt(car.x,car.z);
  let inWater=waterDepth>0.15 && car.y<=waterLevel+1.1;
  let emitSplash=!carDisabled && inWater && car.y<=waterLevel+1.1 && Math.abs(car.speed)>0.08;
  car.onGround=car.y<=surfaceY+0.18;
  wheelTracks.addCarTracks(car,surfaceY,inWater);
  if(emitSplash){
    let speedAbs=Math.abs(car.speed);
    let splashAmount=Math.ceil(speedAbs*18);
    for(let i=0;i<splashAmount;i++){
      let side=(i%2===0 ? -1 : 1);
      let spread=(Math.random()-.5)*0.55;
      let rear=1.15+Math.random()*1.3;
      let lateral=side*(0.75+Math.random()*0.55)+spread;
      let offsetX=car.x-Math.sin(car.velAngle)*rear+Math.cos(car.velAngle)*lateral;
      let offsetZ=car.z-Math.cos(car.velAngle)*rear-Math.sin(car.velAngle)*lateral;
      let wakePush=Math.max(0.22,speedAbs)*2.7;
      let sideSpray=side*(0.7+Math.random()*1.2)*speedAbs;

      dust.spawnSplashParticle(
        offsetX,
        waterLevel+0.08+Math.random()*0.12,
        offsetZ,
        -Math.sin(car.velAngle)*wakePush+Math.cos(car.velAngle)*sideSpray+(Math.random()-.5)*0.5,
        -Math.cos(car.velAngle)*wakePush-Math.sin(car.velAngle)*sideSpray+(Math.random()-.5)*0.5,
        3.2+Math.random()*3.8+speedAbs*0.9,
        0.2+Math.random()*0.16,
        0.035+Math.random()*0.055
      );
    }
  }

  let airborne=car.y>surfaceY+0.35;
  car.airborne=airborne;
  updateAirTricks(car,airborne);

  let pitchSampleDist=2.2;
  let frontX=car.x+Math.sin(car.angle)*pitchSampleDist;
  let frontZ=car.z+Math.cos(car.angle)*pitchSampleDist;
  let backX=car.x-Math.sin(car.angle)*pitchSampleDist;
  let backZ=car.z-Math.cos(car.angle)*pitchSampleDist;
  let frontY=drivingSurfaceHeight(frontX,frontZ);
  let backY=drivingSurfaceHeight(backX,backZ);
  let targetPitch=-Math.atan2(frontY-backY,pitchSampleDist*2);
  car.pitch+=(targetPitch-car.pitch)*0.18;

  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle+car.trickYaw;
  car.group.rotation.x=car.pitch+car.trickPitch;
  car.group.rotation.z=car.trickRoll;
  updateMechAnimation(car);
  updateMorphVisual(car);
  updateCannonInput(car);
  if(car.hitRattle>0){
    let shake=car.hitRattle;
    let t=performance.now()*0.04+car.hitRattleSeed;
    car.group.rotation.x+=Math.sin(t*1.7)*0.08*shake;
    car.group.rotation.z+=Math.cos(t*2.1)*0.11*shake;
    car.group.position.x+=Math.sin(t*2.6)*0.18*shake;
    car.group.position.y+=Math.abs(Math.sin(t*3.1))*0.16*shake;
    car.group.position.z+=Math.cos(t*2.3)*0.18*shake;
    car.hitRattle=Math.max(0,car.hitRattle-0.055);
  }
  car.shadow.update({carX:car.x,carZ:car.z,carY:car.y,surfaceY,carVelAngle:car.angle});
}

function updateCameraForCar(car){
  car.cameraYaw+=normalizeAngle(car.velAngle-car.cameraYaw)*0.075;

  let camDist=cameraFollowDistance;
  let camHeight=cameraFollowHeight;
  let camX=car.x-Math.sin(car.cameraYaw)*camDist;
  let camZ=car.z-Math.cos(car.cameraYaw)*camDist;
  let camY=car.y+camHeight;
  let lookAhead=16;

  car.camera.position.set(camX,camY,camZ);
  car.camera.lookAt(
    car.x+Math.sin(car.cameraYaw)*lookAhead,
    car.y+3.8,
    car.z+Math.cos(car.cameraYaw)*lookAhead
  );
}

function updateCameras(){
  updateCameraForCar(playerCar);
  if(gameMode==="double") updateCameraForCar(secondCar);

  if(gameMode==="single"){
    px=playerCar.x;
    py=playerCar.y+cameraFollowHeight;
    pz=playerCar.z;
  }else{
    px=(playerCar.x+secondCar.x)*0.5;
    py=(playerCar.y+secondCar.y)*0.5+cameraFollowHeight;
    pz=(playerCar.z+secondCar.z)*0.5;
  }
}

function aimCrossVisibleFor(car){
  return car.aimCross && car.morphProgress<0.35 && car.health>0 && !gameOver && car.group.visible;
}

function setAimCrossForRender(focusedCar){
  for(let car of cars){
    if(!car.aimCross) continue;
    car.aimCross.visible=car===focusedCar && aimCrossVisibleFor(car);
  }
}

function renderGame(){
  let width=innerWidth;
  let height=innerHeight;

  if(gameMode==="single"){
    setAimCrossForRender(playerCar);
    renderer.setViewport(0,0,width,height);
    renderer.setScissor(0,0,width,height);
    renderer.render(scene,playerCamera);
    setAimCrossForRender(null);
    return;
  }

  let halfWidth=Math.floor(width*0.5);

  let leftCar=displayCars()[0];
  let rightCar=displayCars()[1];

  setAimCrossForRender(leftCar);
  renderer.setViewport(0,0,halfWidth,height);
  renderer.setScissor(0,0,halfWidth,height);
  renderer.render(scene,leftCar.camera);

  setAimCrossForRender(rightCar);
  renderer.setViewport(halfWidth,0,width-halfWidth,height);
  renderer.setScissor(halfWidth,0,width-halfWidth,height);
  renderer.render(scene,rightCar.camera);
  setAimCrossForRender(null);
}

let lastChunkSignature="";

function chunkSignatureForCars(){
  return activeCars()
    .map(car=>Math.floor(car.x/chunkSize)+","+Math.floor(car.z/chunkSize))
    .join("|");
}

function loop(){
  requestAnimationFrame(loop);

  if(!gameStarted){
    updateCameras();
    world.processChunkQueue();
    renderGame();
    return;
  }

  for(let car of activeCars()){
    updateCar(car);
  }
  updateEnemies();
  updateSupplyBoxes();
  updateRockets();
  updateCannonBolts();
  if(healthDamageCooldown>0) healthDamageCooldown--;

  dust.update();
  updateExplosions();
  updateRockDebris();
  world.updateWind(performance.now());
  motorAudio.update();
  updateCameras();

  let chunkSignature=chunkSignatureForCars();

  if(chunkSignature!==lastChunkSignature){
    lastChunkSignature=chunkSignature;
    world.updateChunksForCenters(activeCars().map(car=>({x:car.x,z:car.z})));
  }

  clouds.update();
  birds.update();
  updateSheep(world.chunks);
  hud.updateSpeedHud();
  hud.updateMapHud();
  hud.updateCompassHud();
  world.processChunkQueue();
  renderGame();
}

window.addEventListener("resize",()=>{
  updateCameraProjection();
  renderer.setSize(innerWidth,innerHeight);
});

function setCarActive(car,active){
  car.group.visible=active;
  car.shadow.setVisible(active);
}

function startGame(mode){
  gameMode=mode;
  gameStarted=true;
  document.body.classList.toggle("single-player",mode==="single");
  document.body.classList.toggle("double-player",mode==="double");

  clearRockets();
  clearEnemies();
  clearSupplyBoxes();
  setWorldSeed(Math.random()*100000);
  world.resetChunks();
  playerCar.lateralOffset=mode==="single" ? 0 : -4.2;
  secondCar.lateralOffset=4.2;
  placeCarOnRoad(playerCar,0);
  placeCarOnRoad(secondCar,0);
  setCarActive(playerCar,true);
  setCarActive(secondCar,mode==="double");
  playerCar.cameraYaw=playerCar.angle;
  secondCar.cameraYaw=secondCar.angle;
  updateCameraProjection();
  updateCameras();

  let startScreen=document.getElementById("startScreen");
  if(startScreen) startScreen.style.display="none";

  hud.init();
  lastChunkSignature=chunkSignatureForCars();
  world.updateChunksForCenters(activeCars().map(car=>({x:car.x,z:car.z})));
  enemyWaveDelay=90;
  enemyPatrolDelay=900+Math.floor(Math.random()*420);
}

let startScreen=document.getElementById("startScreen");
if(startScreen){
  startScreen.addEventListener("click",event=>{
    let button=event.target.closest("[data-mode]");
    if(!button || gameStarted) return;
    startGame(button.dataset.mode==="double" ? "double" : "single");
  });
}

setupMorphModels(playerCar,0xb83a32);
setupMorphModels(secondCar,0x2f66d8);
setCarActive(playerCar,true);
setCarActive(secondCar,false);

loadCarModel()
  .then(model=>{
    setMorphCarModel(playerCar,model.clone(true));
    setMorphCarModel(secondCar,model.clone(true));
  })
  .catch(error=>{
    console.error("Failed to load car model:",error);
  });

function placeCarOnRoad(car,z){
  let yaw=roadYawAt(z);
  let centerX=roadCenterX(z);
  car.x=centerX+Math.cos(yaw)*car.lateralOffset;
  car.z=z-Math.sin(yaw)*car.lateralOffset;
  car.angle=yaw;
  car.velAngle=yaw;
  car.speed=0;
  car.throttleInput=0;
  car.surfaceDistance=roadDistance(car.x,car.z);
  car.slipAmount=0;
  car.onGround=true;
  car.airborne=false;
  car.vy=0;
  car.trickPitch=0;
  car.trickRoll=0;
  car.trickYaw=0;
  car.trickPitchVel=0;
  car.trickRollVel=0;
  car.trickYawVel=0;
  car.morphed=false;
  car.morphProgress=0;
  car.lastMorphProgress=0;
  car.lastMorphButton=false;
  car.aimOffsetX=0;
  car.aimOffsetY=0;
  if(car.aimCross) car.aimCross.position.set(0,3.15,32);
  car.lastRocketButton=false;
  car.rocketCooldown=0;
  car.rocketAmmo=initialRocketAmmo;
  car.lastCannonButton=false;
  car.cannonCooldown=0;
  car.cannonAmmo=initialCannonAmmo;
  car.boostCharge=maxBoostCharge;
  car.hitRattle=0;
  car.hitRattleSeed=0;
  car.walkCycle=0;
  car.lastWalkX=car.x;
  car.lastWalkZ=car.z;
  car.y=drivingSurfaceHeight(car.x,car.z);
  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle;
  car.group.rotation.x=0;
  car.group.rotation.z=0;
  updateMechAnimation(car);
  updateMorphVisual(car);
}

placeCarOnRoad(playerCar,0);
placeCarOnRoad(secondCar,0);
playerCar.cameraYaw=playerCar.angle;
secondCar.cameraYaw=secondCar.angle;
updateCameras();

lastChunkSignature=chunkSignatureForCars();
world.updateChunksForCenters(activeCars().map(car=>({x:car.x,z:car.z})));
clouds.makeClouds();
birds.makeBirds();
loop();
