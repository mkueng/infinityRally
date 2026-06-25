import { THREE } from "./three.js";
import { gravityStrength, jumpBaseBoost, jumpSlopeBoost, roadMaxSpeed, chunkSize } from "./constants.js";
import { carSurfaceHeight, maxSpeedForRoadDistance, roadCenterX, roadDistance } from "./terrain.js";
import { createInput } from "./input.js";
import { createHud } from "./hud.js";
import { createCarShadow, createClouds, createDust } from "./effects.js";
import { createWorld } from "./world.js";
import { loadCarModel, loadGarageModel, loadGasStationModel, makeFallbackCarModel } from "./models.js?v=cars-folder";
import { updateSheep } from "./sheep.js";

let scene=new THREE.Scene();
let cam=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,1e6);
let renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
document.body.appendChild(renderer.domElement);
scene.background=new THREE.Color(0x87ceeb);
scene.fog=new THREE.FogExp2(0x87ceeb,0.0003);

scene.add(new THREE.HemisphereLight(0xbfdfff,0x445533,1.4));
let sun=new THREE.DirectionalLight(0xffffff,2.15);
sun.position.set(4,7,2.5);
scene.add(sun);

let keys=createInput();
let px=0,py=20,pz=0;
let carX=0,carY=20,carZ=0,carAngle=0,carVelAngle=0,carSpeed=0.5,carVy=0;
let carPitch=0;
let carHealth=100;
let gameOver=false;
let healthDamageCooldown=0;
let cameraFollowDistance=18;
let cameraFollowHeight=7.5;

function updateCameraProjection(){
  cam.aspect=innerWidth/innerHeight;

  let defaultVerticalFov=50;
  let minVerticalFov=38;
  let maxHorizontalFov=82;
  let horizontalFovRad=THREE.MathUtils.degToRad(maxHorizontalFov);
  let verticalFovForWidth=THREE.MathUtils.radToDeg(
    2*Math.atan(Math.tan(horizontalFovRad*0.5)/cam.aspect)
  );

  cam.fov=Math.max(minVerticalFov,Math.min(defaultVerticalFov,verticalFovForWidth));
  cam.updateProjectionMatrix();

  let zoomCompensation=Math.tan(THREE.MathUtils.degToRad(defaultVerticalFov*0.5))
    / Math.tan(THREE.MathUtils.degToRad(cam.fov*0.5));
  cameraFollowDistance=16*Math.min(1.2,zoomCompensation);
  cameraFollowHeight=7*Math.min(1.12,Math.sqrt(zoomCompensation));
}
updateCameraProjection();

let carGroup=new THREE.Group();
carGroup.rotation.order="YXZ";
scene.add(carGroup);

let world=createWorld(scene);
let carShadow=createCarShadow(scene);
let clouds=createClouds(scene,()=>({carX,carZ}));
let dust=createDust(scene);
let hud=createHud({
  getCarState:()=>({carX,carZ,carVelAngle,carSpeed,carHealth}),
  getChunks:()=>world.chunks
});

function showGameOver(){
  if(gameOver) return;
  gameOver=true;
  carHealth=0;
  carSpeed=0;
  carVy=0;
  hud.updateHealthHud();
  hud.showGameOverOverlay();
}

function damageCar(amount){
  if(healthDamageCooldown>0 || carHealth<=0) return;
  carHealth=Math.max(0,carHealth-amount);
  healthDamageCooldown=42;
  hud.updateHealthHud();
  if(carHealth<=0) showGameOver();
}

function landingDamageAmount(x,z,impactSpeed){
  let front=carSurfaceHeight(x+Math.sin(carVelAngle)*3,z+Math.cos(carVelAngle)*3);
  let back=carSurfaceHeight(x-Math.sin(carVelAngle)*3,z-Math.cos(carVelAngle)*3);
  let side=carSurfaceHeight(x+Math.cos(carVelAngle)*2.2,z-Math.sin(carVelAngle)*2.2);
  let roughness=Math.max(Math.abs(front-back),Math.abs(side-carSurfaceHeight(x,z)));
  let impactDamage=Math.max(0,impactSpeed-1.05)*7;
  let roughDamage=Math.max(0,roughness-2.0)*1.4;
  return Math.min(12,Math.round(impactDamage+roughDamage));
}

let lastCX=999999,lastCZ=999999;

function loop(){
  requestAnimationFrame(loop);

  let prevX=carX;
  let prevZ=carZ;
  let prevY=carY;

  let forward=0,turn=0;
  if(!gameOver){
    if(keys.w || keys.arrowup) forward=1;
    if(keys.s || keys.arrowdown) forward=-1;
    if(keys.a || keys.arrowleft) turn=1;
    if(keys.d || keys.arrowright) turn=-1;
  }

  let roadDist=roadDistance(carX,carZ);
  let localMaxSpeed=maxSpeedForRoadDistance(roadDist);

  if(gameOver){
    carSpeed=0;
    carVy=0;
  }else{
    carSpeed=Math.max(-localMaxSpeed,Math.min(localMaxSpeed,carSpeed+forward*0.01));
    carAngle+=turn*0.03;
  }

  let angleDiff=carAngle-carVelAngle;
  while(angleDiff>Math.PI) angleDiff-=Math.PI*2;
  while(angleDiff<-Math.PI) angleDiff+=Math.PI*2;
  let roadGrip=1-Math.min(1,Math.max(0,(roadDist-45)/80));
  let speedRatio=Math.min(1,Math.abs(carSpeed)/roadMaxSpeed);
  let speedDrift=speedRatio*speedRatio*(3-2*speedRatio);
  let onRoadAlign=0.24-speedDrift*0.2;
  let offRoadAlign=0.22;
  let velocityAlign=offRoadAlign*(1-roadGrip)+onRoadAlign*roadGrip;
  carVelAngle+=angleDiff*velocityAlign;

  if(!gameOver){
    carX+=Math.sin(carVelAngle)*carSpeed;
    carZ+=Math.cos(carVelAngle)*carSpeed;
  }

  roadDist=roadDistance(carX,carZ);
  localMaxSpeed=maxSpeedForRoadDistance(roadDist);
  carSpeed=Math.max(-localMaxSpeed,Math.min(localMaxSpeed,carSpeed));

  let surfaceY=carSurfaceHeight(carX,carZ);

  if(!gameOver && roadDist<60){
    let t=1-roadDist/60;
    t=t*t*(3-2*t);

    let center=roadCenterX(carZ);
    carX+=(center-carX)*0.02*t;
    surfaceY=carSurfaceHeight(carX,carZ);
  }

  let aheadX=carX+Math.sin(carVelAngle)*6;
  let aheadZ=carZ+Math.cos(carVelAngle)*6;
  let aheadY=carSurfaceHeight(aheadX,aheadZ);
  let slope=aheadY-surfaceY;

  if(!gameOver && carY<=surfaceY+0.03 && carSpeed>1.15 && slope>3.5){
    carVy=Math.max(carVy,slope*jumpSlopeBoost+jumpBaseBoost);
  }

  if(!gameOver && roadDist>60){
    carVelAngle+=Math.sin(carX*0.01+carZ*0.013)*0.003;
    carSpeed*=0.985;
  }

  if(!gameOver) carVy-=gravityStrength;
  let landingVy=carVy;
  carY+=carVy;

  if(carY<surfaceY){
    if(!gameOver && landingVy<-0.9){
      let landingDamage=landingDamageAmount(carX,carZ,-landingVy);
      if(landingDamage>0) damageCar(landingDamage);
    }
    carY=surfaceY;
    carVy=0;
  }

  if(!gameOver && world.collidesWithObstacles(carX,carZ)){
    carX=prevX;
    carZ=prevZ;
    carY=prevY;
    carSpeed*=0.15;
    carVelAngle+=Math.PI*0.5;
    damageCar(3);
  }
  if(healthDamageCooldown>0) healthDamageCooldown--;

  let emitDust=carY<=surfaceY+0.1 && Math.abs(carSpeed)>0.1;
  if(emitDust){
    let dustAmount=Math.ceil(Math.abs(carSpeed)*6);
    for(let i=0;i<dustAmount;i++){
      let side=(i%2===0 ? -1 : 1);
      let spread=(Math.random()-.5)*0.6;
      let offsetX=carX-Math.sin(carVelAngle)*1.15+Math.cos(carVelAngle)*(side*1.05+spread);
      let offsetZ=carZ-Math.cos(carVelAngle)*1.15-Math.sin(carVelAngle)*(side*1.05+spread);

      dust.spawnDustParticle(
        offsetX,
        surfaceY+0.4+Math.random()*0.3,
        offsetZ,
        (Math.random()-.5)*0.18,
        (Math.random()-.5)*0.18,
        Math.random()*1.8+0.9,
        2.0+Math.random()*1.6,
        0.22+Math.random()*0.22
      );
    }
  }

  dust.update();

  let pitchSampleDist=2.2;
  let frontX=carX+Math.sin(carVelAngle)*pitchSampleDist;
  let frontZ=carZ+Math.cos(carVelAngle)*pitchSampleDist;
  let backX=carX-Math.sin(carVelAngle)*pitchSampleDist;
  let backZ=carZ-Math.cos(carVelAngle)*pitchSampleDist;
  let frontY=carSurfaceHeight(frontX,frontZ);
  let backY=carSurfaceHeight(backX,backZ);
  let targetPitch=-Math.atan2(frontY-backY,pitchSampleDist*2);
  carPitch+=(targetPitch-carPitch)*0.18;

  carGroup.position.set(carX,carY,carZ);
  carGroup.rotation.y=carVelAngle;
  carGroup.rotation.x=carPitch;

  carShadow.update({carX,carZ,carY,surfaceY,carVelAngle});

  let camDist=cameraFollowDistance;
  let camHeight=cameraFollowHeight;
  px=carX-Math.sin(carAngle)*camDist;
  pz=carZ-Math.cos(carAngle)*camDist;
  py=carY+camHeight;

  let pcx=Math.floor(carX/chunkSize);
  let pcz=Math.floor(carZ/chunkSize);

  if(pcx!==lastCX || pcz!==lastCZ){
    lastCX=pcx;
    lastCZ=pcz;
    world.updateChunks(px,pz);
  }

  let lookAhead=16;
  cam.position.set(px,py,pz);
  cam.lookAt(
    carX+Math.sin(carVelAngle)*lookAhead,
    carY+3.8,
    carZ+Math.cos(carVelAngle)*lookAhead
  );

  clouds.update();
  updateSheep(world.chunks);
  hud.updateSpeedHud();
  hud.updateMapHud();
  world.processChunkQueue();
  renderer.render(scene,cam);
}

window.addEventListener("resize",()=>{
  updateCameraProjection();
  renderer.setSize(innerWidth,innerHeight);
});

loadCarModel()
  .then(model=>{
    carGroup.clear();
    carGroup.add(model);
  })
  .catch(error=>{
    console.error("Failed to load Tinkercad car model:",error);
    carGroup.clear();
    carGroup.add(makeFallbackCarModel());
  });
loadGasStationModel()
  .then(model=>{
    world.setGasStationTemplate(model);
    world.addGasStationsToExistingChunks();
  })
  .catch(error=>{
    console.error("Failed to load gas station model:",error);
  });
loadGarageModel()
  .then(model=>{
    world.setGarageTemplate(model);
    world.addGaragesToExistingChunks();
  })
  .catch(error=>{
    console.error("Failed to load garage model:",error);
  });

carX=0;
carZ=0;
carY=carSurfaceHeight(carX,carZ);

hud.init();
world.updateChunks(px,pz);
clouds.makeClouds();
loop();
