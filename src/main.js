import { THREE } from "./three.js";
import { gravityStrength, jumpBaseBoost, jumpSlopeBoost, roadMaxSpeed, chunkSize } from "./constants.js";
import { carSurfaceHeight, maxSpeedForRoadDistance, roadCenterX, roadDistance } from "./terrain.js";
import { createInput } from "./input.js";
import { createHud } from "./hud.js";
import { createBirds, createCarShadow, createClouds, createDust } from "./effects.js";
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
let cameraYaw=0;

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function normalizeAngle(angle){
  while(angle>Math.PI) angle-=Math.PI*2;
  while(angle<-Math.PI) angle+=Math.PI*2;
  return angle;
}

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
let birds=createBirds(scene,()=>({carX,carZ}));
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
    let speedAbs=Math.abs(carSpeed);
    let speedRatio=clamp(speedAbs/roadMaxSpeed,0,1);
    let grip=1-clamp((roadDist-42)/95,0,1);
    let throttle=forward>0;
    let brakeOrReverse=forward<0;

    if(throttle){
      carSpeed+=0.018*(1-speedRatio*0.42);
    }else if(brakeOrReverse){
      carSpeed+=carSpeed>0.08 ? -0.04 : -0.014;
    }else{
      carSpeed*=grip>0.45 ? 0.992 : 0.982;
      if(Math.abs(carSpeed)<0.004) carSpeed=0;
    }

    carSpeed=clamp(carSpeed,-localMaxSpeed*0.42,localMaxSpeed);

    let movingSteer=clamp(speedAbs/0.65,0,1);
    let highSpeedCalm=1-clamp((speedAbs-1.05)/0.85,0,0.28);
    let steeringResponse=(0.42+movingSteer*0.63)*highSpeedCalm;
    let reverseSteer=carSpeed< -0.04 ? -1 : 1;
    carAngle+=turn*reverseSteer*0.045*steeringResponse;

    let angleDiff=normalizeAngle(carAngle-carVelAngle);
    let slipAngle=Math.abs(angleDiff);
    let brakingSlide=brakeOrReverse && speedAbs>0.45 ? 0.052 : 0;
    let throttleSlide=throttle && turn!==0 && speedAbs>0.55 ? 0.052 : 0;
    let surfaceAlign=(0.072+grip*0.095)-speedRatio*0.068-brakingSlide-throttleSlide;
    let velocityAlign=clamp(surfaceAlign,0.022,0.155);
    carVelAngle+=angleDiff*velocityAlign;

    let slipDrag=clamp(slipAngle*speedRatio*(grip>0.5 ? 0.008 : 0.018),0,0.03);
    carSpeed*=1-slipDrag;
  }

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
      carX+=(center-carX)*0.006*t;
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
    carVelAngle+=Math.sin(carX*0.01+carZ*0.013)*0.0018;
    carSpeed*=0.992;
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
  let frontX=carX+Math.sin(carAngle)*pitchSampleDist;
  let frontZ=carZ+Math.cos(carAngle)*pitchSampleDist;
  let backX=carX-Math.sin(carAngle)*pitchSampleDist;
  let backZ=carZ-Math.cos(carAngle)*pitchSampleDist;
  let frontY=carSurfaceHeight(frontX,frontZ);
  let backY=carSurfaceHeight(backX,backZ);
  let targetPitch=-Math.atan2(frontY-backY,pitchSampleDist*2);
  carPitch+=(targetPitch-carPitch)*0.18;

  carGroup.position.set(carX,carY,carZ);
  carGroup.rotation.y=carAngle;
  carGroup.rotation.x=carPitch;

  carShadow.update({carX,carZ,carY,surfaceY,carVelAngle:carAngle});

  cameraYaw+=normalizeAngle(carVelAngle-cameraYaw)*0.075;

  let camDist=cameraFollowDistance;
  let camHeight=cameraFollowHeight;
  px=carX-Math.sin(cameraYaw)*camDist;
  pz=carZ-Math.cos(cameraYaw)*camDist;
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
    carX+Math.sin(cameraYaw)*lookAhead,
    carY+3.8,
    carZ+Math.cos(cameraYaw)*lookAhead
  );

  clouds.update();
  birds.update();
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
birds.makeBirds();
loop();
