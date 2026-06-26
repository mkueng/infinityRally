import { THREE } from "./three.js";
import { gravityStrength, jumpBaseBoost, jumpSlopeBoost, chunkSize } from "./constants.js";
import { carSurfaceHeight, groundHeight, roadCenterX, roadDistance } from "./terrain.js?v=no-ramps";
import { createInput } from "./input.js";
import { createHud } from "./hud.js";
import { createBirds, createCarShadow, createClouds, createDust, createWheelTracks } from "./effects.js?v=alien-planet-world";
import { createWorld } from "./world.js?v=alien-planet";
import { createMotorAudio } from "./audio.js?v=alien-planet-world";
import { loadCarModel, makeMechModel } from "./models.js?v=walking-mech";
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
let waterLevel=-20;
let mechGroundMaxSpeed=0.58;
let mechAirMaxSpeed=1.15;
let morphedCarSpeedMultiplier=3;
let mechStrideLength=2.35;
let rocketSpeed=1.75;
let rocketCooldownFrames=34;
let rocketTurnRate=0.075;
let rocketAimYOffset=-4.2;
let rockets=[];
let rocketBodyGeo=new THREE.CylinderGeometry(0.11,0.13,0.8,12);
let rocketNoseGeo=new THREE.ConeGeometry(0.16,0.34,12);
let rocketFinGeo=new THREE.BoxGeometry(0.08,0.18,0.22);
let rocketBodyMat=new THREE.MeshStandardMaterial({color:0x30363b,roughness:0.48,metalness:0.55});
let rocketNoseMat=new THREE.MeshStandardMaterial({color:0xff6633,emissive:0x8f2108,emissiveIntensity:0.55,roughness:0.38,metalness:0.35});
let rocketFlameMat=new THREE.MeshStandardMaterial({color:0xfff0a0,emissive:0xff7a12,emissiveIntensity:1.2,roughness:0.28});
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
    mechModel:null,
    carModel:null,
    aimCross:null,
    aimOffsetX:0,
    aimOffsetY:0,
    lastRocketButton:false,
    rocketCooldown:0,
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
  getCarStates:()=>activeCars().map(car=>({
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
  for(let other of activeCars()){
    if(other===car) continue;
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

function aimTargetForCar(car){
  let target=new THREE.Vector3(
    car.x+Math.sin(car.angle)*72,
    car.y+3.15,
    car.z+Math.cos(car.angle)*72
  );

  if(car.aimCross){
    car.aimCross.getWorldPosition(target);
    target.y+=rocketAimYOffset;
  }

  return target;
}

function updateAimCross(car){
  if(!car.aimCross) return;

  let aim=input.getGamepadAim(car.gamepadIndex);
  car.aimOffsetX=clamp(car.aimOffsetX-aim.x*0.42,-11,11);
  car.aimOffsetY=clamp(car.aimOffsetY-aim.y*0.32,-4.5,7.5);
  car.aimCross.position.set(car.aimOffsetX,3.15+car.aimOffsetY,32);
}

function rocketLaunchPointForCar(car){
  let point=new THREE.Vector3(
    car.x+Math.sin(car.angle)*2.35+Math.cos(car.angle)*0.9,
    car.y+2.1,
    car.z+Math.cos(car.angle)*2.35-Math.sin(car.angle)*0.9
  );

  let cannon=car.mechModel && car.mechModel.userData.walkParts
    ? car.mechModel.userData.walkParts.right.cannon
    : null;

  if(cannon){
    cannon.getWorldPosition(point);
    point.x+=Math.sin(car.angle)*0.84;
    point.y+=0.05;
    point.z+=Math.cos(car.angle)*0.84;
  }

  return point;
}

function fireRocket(car){
  if(gameOver || car.health<=0 || car.rocketCooldown>0) return;
  if(car.morphed || car.morphProgress>0.22) return;

  let mesh=makeRocketMesh();
  let launchPoint=rocketLaunchPointForCar(car);
  let startX=launchPoint.x;
  let startY=launchPoint.y;
  let startZ=launchPoint.z;
  let aimPoint=aimTargetForCar(car);
  let aimX=aimPoint.x-startX;
  let aimY=aimPoint.y-startY;
  let aimZ=aimPoint.z-startZ;
  let aimLen=Math.max(0.001,Math.hypot(aimX,aimY,aimZ));
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
    vx:(aimX/aimLen)*rocketSpeed,
    vz:(aimZ/aimLen)*rocketSpeed,
    vy:(aimY/aimLen)*rocketSpeed,
    age:0,
    life:115
  });

  car.rocketCooldown=rocketCooldownFrames;
}

function rattleCar(car,amount=1){
  car.hitRattle=Math.max(car.hitRattle,amount);
  car.hitRattleSeed=Math.random()*Math.PI*2;
}

function updateRocketInput(car){
  if(car.rocketCooldown>0) car.rocketCooldown--;

  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let pressedB=buttons.b && !car.lastRocketButton;
  if(pressedB) fireRocket(car);
  car.lastRocketButton=buttons.b;
}

function removeRocket(index){
  let rocket=rockets[index];
  scene.remove(rocket.mesh);
  rockets.splice(index,1);
}

function clearRockets(){
  for(let rocket of rockets){
    scene.remove(rocket.mesh);
  }
  rockets=[];
  clearExplosions();
}

function updateRockets(){
  for(let i=rockets.length-1;i>=0;i--){
    let rocket=rockets[i];
    rocket.age++;
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
    let hitCar=null;
    if(rocket.age>4){
      for(let car of activeCars()){
        if(car===rocket.owner) continue;
        let dx=rocket.x-car.x;
        let dz=rocket.z-car.z;
        if(dx*dx+dz*dz<4.2*4.2 && Math.abs(rocket.y-car.y)<4.2){
          hitCar=car;
          break;
        }
      }
    }

    let hitObstacle=world.obstacleAlongSegment(prevX,prevZ,rocket.x,rocket.z,1.35);
    let hit=rocket.y<=surfaceY+0.35 || hitObstacle || hitCar;

    if(hit || rocket.age>rocket.life){
      if(hit){
        spawnRocketExplosion(rocket.x,Math.max(rocket.y,surfaceY+0.5),rocket.z);
        if(hitObstacle) world.destroyObstacle(hitObstacle);
        if(hitCar){
          damageCar(hitCar,18);
          rattleCar(hitCar,1);
        }
      }
      removeRocket(i);
    }
  }
}

function settleTrickAngle(value,amount){
  return value+normalizeAngle(-value)*amount;
}

function updateAirTricks(car,airborne){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let pressedY=buttons.y && !car.lastTrickButtons.y;

  if(airborne && !gameOver && car.health>0){
    if(pressedY) car.trickPitchVel-=0.145;

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

function updateMorphInput(car){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let pressedA=buttons.a && !car.lastMorphButton;

  if(pressedA && !gameOver && car.health>0) car.morphed=!car.morphed;
  car.lastMorphButton=buttons.a;
}

function updateFlightThrust(car,surfaceY){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  if(!buttons.x || gameOver || car.health<=0) return false;

  let altitude=car.y-surfaceY;
  if(altitude<0.12){
    car.y=surfaceY+0.12;
    car.vy=Math.max(car.vy,0.18);
  }

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

function updateMorphVisual(car){
  let target=car.morphed ? 1 : 0;
  car.morphProgress+=(target-car.morphProgress)*0.16;
  if(Math.abs(target-car.morphProgress)<0.003) car.morphProgress=target;

  let p=car.morphProgress;
  let eased=p*p*(3-2*p);

  if(car.mechModel){
    let baseY=car.mechModel.userData.baseY || 0.72;
    let scale=1.05*(1-eased*0.78);
    car.mechModel.visible=p<0.99;
    car.mechModel.scale.set(scale,scale,scale);
    car.mechModel.position.y=baseY*(1-eased)+0.18*eased;
    car.mechModel.rotation.z=eased*0.12;
  }

  if(car.carModel){
    let baseY=car.carModel.userData.baseY || 0.04;
    let baseScale=car.carModel.userData.baseScale || new THREE.Vector3(1,1,1);
    let scale=0.18+eased*0.82;
    car.carModel.visible=p>0.01;
    car.carModel.scale.set(baseScale.x*scale,baseScale.y*scale,baseScale.z*scale);
    car.carModel.position.y=baseY+(1-eased)*0.72;
    car.carModel.rotation.x=(1-eased)*0.16;
  }

  if(car.aimCross){
    car.aimCross.scale.setScalar(1+Math.sin(performance.now()*0.004)*0.035);
  }
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

  let aheadX=car.x+Math.sin(car.velAngle)*6;
  let aheadZ=car.z+Math.cos(car.velAngle)*6;
  let aheadY=drivingSurfaceHeight(aheadX,aheadZ);
  let slope=aheadY-surfaceY;

  if(!gameOver && !carDisabled && car.y<=surfaceY+0.03 && car.speed>0.36 && slope>3.7){
    car.vy=Math.max(car.vy,slope*jumpSlopeBoost+jumpBaseBoost);
  }
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

  setAimCrossForRender(playerCar);
  renderer.setViewport(0,0,halfWidth,height);
  renderer.setScissor(0,0,halfWidth,height);
  renderer.render(scene,playerCamera);

  setAimCrossForRender(secondCar);
  renderer.setViewport(halfWidth,0,width-halfWidth,height);
  renderer.setScissor(halfWidth,0,width-halfWidth,height);
  renderer.render(scene,secondCamera);
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
  updateRockets();
  if(healthDamageCooldown>0) healthDamageCooldown--;

  dust.update();
  updateExplosions();
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
  car.lastMorphButton=false;
  car.aimOffsetX=0;
  car.aimOffsetY=0;
  if(car.aimCross) car.aimCross.position.set(0,3.15,32);
  car.lastRocketButton=false;
  car.rocketCooldown=0;
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
