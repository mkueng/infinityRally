import { THREE } from "./three.js";
import { gravityStrength, jumpBaseBoost, jumpSlopeBoost, roadMaxSpeed, chunkSize } from "./constants.js";
import { carSurfaceHeight, maxSpeedForRoadDistance, roadCenterX, roadDistance } from "./terrain.js";
import { createInput } from "./input.js";
import { createHud } from "./hud.js";
import { createBirds, createCarShadow, createClouds, createDust } from "./effects.js";
import { createWorld } from "./world.js";
import { loadCarModel, loadGarageModel, loadGasStationModel, makeFallbackCarModel } from "./models.js?v=cars-folder";
import { updateSheep } from "./sheep.js";
import { makeSkyTexture } from "./textures.js";

let scene=new THREE.Scene();
let playerCamera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,1e6);
let secondCamera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,1e6);
let renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);
scene.background=makeSkyTexture();
scene.fog=new THREE.FogExp2(0x9fcbe6,0.00022);

scene.add(new THREE.HemisphereLight(0xbfdfff,0x445533,1.4));
let sun=new THREE.DirectionalLight(0xffffff,2.15);
sun.position.set(4,7,2.5);
scene.add(sun);

let input=createInput();
let px=0,py=20,pz=0;
let gameOver=false;
let healthDamageCooldown=0;
let cameraFollowDistance=18;
let cameraFollowHeight=7.5;
let cars=[];

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
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
  let splitAspect=Math.max(0.1,(innerWidth*0.5)/innerHeight);

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
    vy:0,
    pitch:0,
    trickPitch:0,
    trickRoll:0,
    trickYaw:0,
    trickPitchVel:0,
    trickRollVel:0,
    trickYawVel:0,
    lastTrickButtons:{a:false,b:false,x:false,y:false},
    health:100,
    lateralOffset
  };
}

let playerCar=createCarState("car1",-4.2,{up:"w",down:"s",left:"a",right:"d"},playerCamera,0);
let secondCar=createCarState("car2",4.2,{up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright"},secondCamera,1);
cars=[playerCar,secondCar];

let world=createWorld(scene);
let clouds=createClouds(scene,()=>({carX:playerCar.x,carZ:playerCar.z}));
let birds=createBirds(scene,()=>({carX:playerCar.x,carZ:playerCar.z}));
let dust=createDust(scene);
let hud=createHud({
  getCarStates:()=>cars.map(car=>({
    id:car.id,
    label:car.id==="car1" ? "P1" : "P2",
    color:car.id==="car1" ? "#d62f2f" : "#3d6ee8",
    carX:car.x,
    carZ:car.z,
    carVelAngle:car.velAngle,
    carSpeed:car.speed,
    carHealth:car.health
  })),
  getChunks:()=>world.chunks
});

function showGameOver(){
  if(gameOver) return;
  gameOver=true;
  for(let car of cars){
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
  if(cars.every(item=>item.health<=0)) showGameOver();
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
  for(let other of cars){
    if(other===car) continue;
    let dx=nextX-other.x;
    let dz=nextZ-other.z;
    let minGap=3.6;
    if(dx*dx+dz*dz<minGap*minGap) return other;
  }
  return null;
}

function settleTrickAngle(value,amount){
  return value+normalizeAngle(-value)*amount;
}

function updateAirTricks(car,airborne){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let pressedA=buttons.a && !car.lastTrickButtons.a;
  let pressedB=buttons.b && !car.lastTrickButtons.b;
  let pressedX=buttons.x && !car.lastTrickButtons.x;
  let pressedY=buttons.y && !car.lastTrickButtons.y;

  if(airborne && !gameOver && car.health>0){
    if(pressedA) car.trickRollVel+=0.16;
    if(pressedB) car.trickRollVel-=0.16;
    if(pressedX) car.trickYawVel+=0.14;
    if(pressedY) car.trickPitchVel-=0.145;

    if(buttons.a) car.trickRollVel+=0.0025;
    if(buttons.b) car.trickRollVel-=0.0025;
    if(buttons.x) car.trickYawVel+=0.002;
    if(buttons.y) car.trickPitchVel-=0.002;
  }

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

function updateCar(car){
  let prevX=car.x;
  let prevZ=car.z;
  let prevY=car.y;
  let {forward,turn}=controlsFor(car);
  let roadDist=roadDistance(car.x,car.z);
  let localMaxSpeed=maxSpeedForRoadDistance(roadDist);
  let carDisabled=car.health<=0;

  if(gameOver || carDisabled){
    car.speed=0;
    car.vy=0;
  }else{
    let speedAbs=Math.abs(car.speed);
    let speedRatio=clamp(speedAbs/roadMaxSpeed,0,1);
    let grip=1-clamp((roadDist-42)/95,0,1);
    let throttle=forward>0;
    let brakeOrReverse=forward<0;
    let throttlePower=Math.abs(forward);

    if(throttle){
      car.speed+=0.018*throttlePower*(1-speedRatio*0.42);
    }else if(brakeOrReverse){
      car.speed+=(car.speed>0.08 ? -0.04 : -0.014)*throttlePower;
    }else{
      car.speed*=grip>0.45 ? 0.992 : 0.982;
      if(Math.abs(car.speed)<0.004) car.speed=0;
    }

    car.speed=clamp(car.speed,-localMaxSpeed*0.42,localMaxSpeed);

    let movingSteer=clamp(speedAbs/0.65,0,1);
    let highSpeedCalm=1-clamp((speedAbs-1.05)/0.85,0,0.28);
    let steeringResponse=(0.42+movingSteer*0.63)*highSpeedCalm;
    let reverseSteer=car.speed< -0.04 ? -1 : 1;
    car.angle+=turn*reverseSteer*0.045*steeringResponse;

    let angleDiff=normalizeAngle(car.angle-car.velAngle);
    let slipAngle=Math.abs(angleDiff);
    let brakingSlide=brakeOrReverse && speedAbs>0.45 ? 0.052 : 0;
    let throttleSlide=throttle && turn!==0 && speedAbs>0.55 ? 0.052 : 0;
    let surfaceAlign=(0.072+grip*0.095)-speedRatio*0.068-brakingSlide-throttleSlide;
    let velocityAlign=clamp(surfaceAlign,0.022,0.155);
    car.velAngle+=angleDiff*velocityAlign;

    let slipDrag=clamp(slipAngle*speedRatio*(grip>0.5 ? 0.008 : 0.018),0,0.03);
    car.speed*=1-slipDrag;
  }

  if(!gameOver && !carDisabled){
    car.x+=Math.sin(car.velAngle)*car.speed;
    car.z+=Math.cos(car.velAngle)*car.speed;
  }

  roadDist=roadDistance(car.x,car.z);
  localMaxSpeed=maxSpeedForRoadDistance(roadDist);
  car.speed=Math.max(-localMaxSpeed,Math.min(localMaxSpeed,car.speed));

  let surfaceY=carSurfaceHeight(car.x,car.z);

  if(!gameOver && !carDisabled && roadDist<60 && Math.abs(car.speed)>0.05){
    let t=1-roadDist/60;
    t=t*t*(3-2*t);

    let center=roadCenterX(car.z);
    car.x+=(center-car.x)*0.006*t;
    surfaceY=carSurfaceHeight(car.x,car.z);
  }

  let aheadX=car.x+Math.sin(car.velAngle)*6;
  let aheadZ=car.z+Math.cos(car.velAngle)*6;
  let aheadY=carSurfaceHeight(aheadX,aheadZ);
  let slope=aheadY-surfaceY;

  if(!gameOver && !carDisabled && car.y<=surfaceY+0.03 && car.speed>1.15 && slope>3.5){
    car.vy=Math.max(car.vy,slope*jumpSlopeBoost+jumpBaseBoost);
  }

  if(!gameOver && !carDisabled && roadDist>60){
    car.velAngle+=Math.sin(car.x*0.01+car.z*0.013)*0.0018;
    car.speed*=0.992;
  }

  if(!gameOver && !carDisabled) car.vy-=gravityStrength;
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

  let otherCar=collidesWithOtherCars(car,car.x,car.z);
  if(!gameOver && !carDisabled && (world.collidesWithObstacles(car.x,car.z) || otherCar)){
    car.x=prevX;
    car.z=prevZ;
    car.y=prevY;
    car.speed*=0.15;
    car.velAngle+=otherCar ? Math.PI*0.35 : Math.PI*0.5;
    damageCar(car,otherCar ? 1 : 3);
  }

  let emitDust=!carDisabled && car.y<=surfaceY+0.1 && Math.abs(car.speed)>0.1;
  if(emitDust){
    let dustAmount=Math.ceil(Math.abs(car.speed)*6);
    for(let i=0;i<dustAmount;i++){
      let side=(i%2===0 ? -1 : 1);
      let spread=(Math.random()-.5)*0.6;
      let offsetX=car.x-Math.sin(car.velAngle)*1.15+Math.cos(car.velAngle)*(side*1.05+spread);
      let offsetZ=car.z-Math.cos(car.velAngle)*1.15-Math.sin(car.velAngle)*(side*1.05+spread);

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

  let airborne=car.y>surfaceY+0.35;
  updateAirTricks(car,airborne);

  let pitchSampleDist=2.2;
  let frontX=car.x+Math.sin(car.angle)*pitchSampleDist;
  let frontZ=car.z+Math.cos(car.angle)*pitchSampleDist;
  let backX=car.x-Math.sin(car.angle)*pitchSampleDist;
  let backZ=car.z-Math.cos(car.angle)*pitchSampleDist;
  let frontY=carSurfaceHeight(frontX,frontZ);
  let backY=carSurfaceHeight(backX,backZ);
  let targetPitch=-Math.atan2(frontY-backY,pitchSampleDist*2);
  car.pitch+=(targetPitch-car.pitch)*0.18;

  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle+car.trickYaw;
  car.group.rotation.x=car.pitch+car.trickPitch;
  car.group.rotation.z=car.trickRoll;
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
  updateCameraForCar(secondCar);

  px=(playerCar.x+secondCar.x)*0.5;
  py=(playerCar.y+secondCar.y)*0.5+cameraFollowHeight;
  pz=(playerCar.z+secondCar.z)*0.5;
}

function renderSplitScreen(){
  let width=innerWidth;
  let height=innerHeight;
  let halfWidth=Math.floor(width*0.5);

  renderer.setViewport(0,0,halfWidth,height);
  renderer.setScissor(0,0,halfWidth,height);
  renderer.render(scene,playerCamera);

  renderer.setViewport(halfWidth,0,width-halfWidth,height);
  renderer.setScissor(halfWidth,0,width-halfWidth,height);
  renderer.render(scene,secondCamera);
}

let lastChunkSignature="";

function chunkSignatureForCars(){
  return cars
    .map(car=>Math.floor(car.x/chunkSize)+","+Math.floor(car.z/chunkSize))
    .join("|");
}

function loop(){
  requestAnimationFrame(loop);

  updateCar(playerCar);
  updateCar(secondCar);
  if(healthDamageCooldown>0) healthDamageCooldown--;

  dust.update();
  updateCameras();

  let chunkSignature=chunkSignatureForCars();

  if(chunkSignature!==lastChunkSignature){
    lastChunkSignature=chunkSignature;
    world.updateChunksForCenters(cars.map(car=>({x:car.x,z:car.z})));
  }

  clouds.update();
  birds.update();
  updateSheep(world.chunks);
  hud.updateSpeedHud();
  hud.updateMapHud();
  world.processChunkQueue();
  renderSplitScreen();
}

window.addEventListener("resize",()=>{
  updateCameraProjection();
  renderer.setSize(innerWidth,innerHeight);
});

function tintSecondCar(model){
  model.traverse(child=>{
    if(!child.isMesh || !child.material) return;

    let materials=Array.isArray(child.material) ? child.material : [child.material];
    let cloned=materials.map(material=>{
      let next=material.clone();
      if(next.color){
        let brightness=next.color.r+next.color.g+next.color.b;
        if(brightness>0.75){
          next.color.lerp(new THREE.Color(0x2f66d8),0.55);
        }
      }
      return next;
    });

    child.material=Array.isArray(child.material) ? cloned : cloned[0];
  });
  return model;
}

function cloneCarModelFor(car,model,tint=false){
  car.group.clear();
  let clone=model.clone(true);
  car.group.add(tint ? tintSecondCar(clone) : clone);
}

function colorFallbackSecondCar(model){
  model.traverse(child=>{
    if(child.isMesh && child.material && child.material.color){
      child.material=child.material.clone();
      if(child.material.color.r>0.35 || child.material.color.g>0.35 || child.material.color.b>0.35){
        child.material.color.set(0x3d6ee8);
      }
    }
  });
  return model;
}

loadCarModel()
  .then(model=>{
    cloneCarModelFor(playerCar,model);
    cloneCarModelFor(secondCar,model,true);
  })
  .catch(error=>{
    console.error("Failed to load Tinkercad car model:",error);
    playerCar.group.clear();
    playerCar.group.add(makeFallbackCarModel());
    secondCar.group.clear();
    secondCar.group.add(colorFallbackSecondCar(makeFallbackCarModel()));
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

function placeCarOnRoad(car,z){
  let yaw=roadYawAt(z);
  let centerX=roadCenterX(z);
  car.x=centerX+Math.cos(yaw)*car.lateralOffset;
  car.z=z-Math.sin(yaw)*car.lateralOffset;
  car.angle=yaw;
  car.velAngle=yaw;
  car.speed=0;
  car.vy=0;
  car.trickPitch=0;
  car.trickRoll=0;
  car.trickYaw=0;
  car.trickPitchVel=0;
  car.trickRollVel=0;
  car.trickYawVel=0;
  car.y=carSurfaceHeight(car.x,car.z);
  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle;
  car.group.rotation.x=0;
  car.group.rotation.z=0;
}

placeCarOnRoad(playerCar,0);
placeCarOnRoad(secondCar,0);
playerCar.cameraYaw=playerCar.angle;
secondCar.cameraYaw=secondCar.angle;
updateCameras();

hud.init();
lastChunkSignature=chunkSignatureForCars();
world.updateChunksForCenters(cars.map(car=>({x:car.x,z:car.z})));
clouds.makeClouds();
birds.makeBirds();
loop();
