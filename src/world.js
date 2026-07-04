import { THREE } from "./three.js";
import { carRadius, chunkSize, segments, viewDistance } from "./constants.js";
import { groundHeight, rand, roadCenterX, roadDistance } from "./terrain.js?v=no-ramps";
import { makeGroundTexture } from "./textures.js?v=alien-planet";

export function createWorld(scene,options={}){
  let chunkQueue=[];
  let removalQueue=[];
  let neededChunks=new Set();
  let chunkDetails=new Map();
  let chunks=new Map();
  let bossBases=[];
  let bossBaseColliders=[];
  let lastChunkBuildTime=0;
  let getDifficulty=typeof options.getDifficulty==="function" ? options.getDifficulty : ()=>"medium";
  let defaultEnvironment={
    colors:{
      underwater:0x8f5a6c,
      shore:0xd6b25a,
      low:0x8b3852,
      mid:0x5a3b70,
      high:0x3f3456,
      water:0x20ffd4,
      waterEmissive:0x036f6d,
      bark:0x24133a,
      barkEmissive:0x12061f,
      leaf:0xb66cff,
      leafEmissive:0x5a22c9,
      pod:0xff6bd6,
      podEmissive:0xff2ca8,
      grass:0x9df58d,
      grassEmissive:0x173d18,
      rock:0x3f334b,
      wall:0x5a526d,
      roof:0x322b45,
      trim:0xa78fbd,
      brick:0x714060,
      street:0x1d1f25
    },
    city:false,
    vegetation:{
      treeClusters:2,
      treesPerCluster:8,
      treeClusterRadius:25,
      crownsPerTree:7,
      podsPerTree:4,
      trunkHeightBase:1,
      trunkHeightVariance:0.34,
      trunkWidthBase:0.72,
      trunkWidthVariance:0.34,
      leanAmount:0.18,
      crownBaseScale:1.25,
      crownScaleStep:0.08,
      crownSpreadBase:1.1,
      crownSpreadVariance:2.4,
      crownLiftBase:9.1,
      crownLiftStep:0.28,
      crownWidthScale:1,
      crownFlatness:1,
      crownDepthScale:1,
      podScaleBase:0.42,
      podScaleVariance:0.34,
      podLiftBase:7.1,
      podLiftVariance:1.6,
      podElongation:1.35,
      grassClusters:20,
      grassPerCluster:400,
      grassClusterRadius:10
    }
  };
  let currentEnvironment={...defaultEnvironment,...(options.getEnvironment ? options.getEnvironment() : {})};

let landMat=new THREE.MeshStandardMaterial({
  map:makeGroundTexture(currentEnvironment),
  vertexColors:true,
  roughness:0.92,
  metalness:0.04
});

let waterMat=new THREE.MeshStandardMaterial({
  color:0x20ffd4,
  emissive:0x036f6d,
  emissiveIntensity:0.38,
  transparent:true,
  opacity:.42,
  depthWrite:false
});
let waterLevel=-20;

let barkMat=new THREE.MeshStandardMaterial({color:0x24133a,emissive:0x12061f,emissiveIntensity:0.2,roughness:0.88});
let leafMat=new THREE.MeshStandardMaterial({color:0xb66cff,emissive:0x5a22c9,emissiveIntensity:0.48,roughness:0.64});
let podMat=new THREE.MeshStandardMaterial({color:0xff6bd6,emissive:0xff2ca8,emissiveIntensity:0.78,roughness:0.52});
let grassWindShader=null;
let grassMat=new THREE.MeshStandardMaterial({color:0x9df58d,emissive:0x173d18,emissiveIntensity:0.12,roughness:0.84});
grassMat.onBeforeCompile=shader=>{
  shader.uniforms.windTime={value:0};
  shader.uniforms.windStrength={value:1};
  grassWindShader=shader;
  shader.vertexShader=shader.vertexShader.replace(
    "#include <common>",
    [
      "#include <common>",
      "uniform float windTime;",
      "uniform float windStrength;"
    ].join("\n")
  );
  shader.vertexShader=shader.vertexShader.replace(
    "#include <begin_vertex>",
    [
      "#include <begin_vertex>",
      "float bladeHeight=clamp((position.y+0.6)/1.2,0.0,1.0);",
      "vec3 windWorld=normalize(vec3(0.86,0.0,0.5));",
      "#ifdef USE_INSTANCING",
      "vec3 instanceX=instanceMatrix[0].xyz;",
      "vec3 instanceY=instanceMatrix[1].xyz;",
      "vec3 instanceZ=instanceMatrix[2].xyz;",
      "vec3 windLocal=vec3(",
      "  dot(windWorld,normalize(instanceX))/max(length(instanceX),0.0001),",
      "  dot(windWorld,normalize(instanceY))/max(length(instanceY),0.0001),",
      "  dot(windWorld,normalize(instanceZ))/max(length(instanceZ),0.0001)",
      ");",
      "#else",
      "vec3 windLocal=windWorld;",
      "#endif",
      "float gust=(0.18+sin(windTime*1.35)*0.07+sin(windTime*2.1)*0.035)*windStrength;",
      "float windBend=bladeHeight*bladeHeight*gust;",
      "transformed+=windLocal*windBend;"
    ].join("\n")
  );
};
let rockMat=new THREE.MeshStandardMaterial({color:0x3f334b,roughness:1,metalness:0.12});
let gravelMat=new THREE.MeshStandardMaterial({color:0x5a5164,roughness:1,metalness:0.02});
let buildingWallMat=new THREE.MeshStandardMaterial({color:0x5a526d,roughness:0.9,metalness:0.16});
let buildingRoofMat=new THREE.MeshStandardMaterial({color:0x322b45,roughness:0.92,metalness:0.18});
let windowMat=new THREE.MeshStandardMaterial({color:0x8dfff2,emissive:0x0bd1c4,emissiveIntensity:0.72,roughness:0.18});
let doorMat=new THREE.MeshStandardMaterial({color:0x241b2b,roughness:0.9,metalness:0.08});
let chimneyMat=new THREE.MeshStandardMaterial({color:0x494058,roughness:1,metalness:0.12});
let houseTrimMat=new THREE.MeshStandardMaterial({color:0xa78fbd,roughness:0.78,metalness:0.08});
let brickWallMat=new THREE.MeshStandardMaterial({color:0x714060,roughness:0.95,metalness:0.05});
let cityStreetMat=new THREE.MeshStandardMaterial({color:0x1d1f25,roughness:0.86,metalness:0.08});
let bossBaseMat=new THREE.MeshStandardMaterial({color:0x191a24,emissive:0x19091f,emissiveIntensity:0.28,roughness:0.78,metalness:0.58});
let bossBaseTrimMat=new THREE.MeshStandardMaterial({color:0x7a2f68,emissive:0x4c123d,emissiveIntensity:0.52,roughness:0.5,metalness:0.4});
let bossBaseGlowMat=new THREE.MeshBasicMaterial({color:0xff4fc8,transparent:true,opacity:0.72});

let trunkGeo=new THREE.CylinderGeometry(.28,1.08,10.5,6);
let crownGeo=new THREE.IcosahedronGeometry(2.35,1);
let podGeo=new THREE.SphereGeometry(.72,8,6);
let grassGeo=new THREE.ConeGeometry(.04,1.2,2);
let rockGeo=new THREE.DodecahedronGeometry(1,0);
let gravelGeo=new THREE.DodecahedronGeometry(1,0);
let buildingGeo=new THREE.BoxGeometry(1,1,1);
let buildingRoofGeo=new THREE.CylinderGeometry(1.05,1.25,1,4);
let windowGeo=new THREE.BoxGeometry(1,1,1);
let doorGeo=new THREE.BoxGeometry(1,1,1);
let chimneyGeo=new THREE.BoxGeometry(1,1,1);
let trimGeo=new THREE.BoxGeometry(1,1,1);
let porchGeo=new THREE.BoxGeometry(1,1,1);
let brickWallGeo=new THREE.BoxGeometry(1,1,1);
let cityStreetGeo=new THREE.BoxGeometry(1,1,1);
let turretBaseGeo=new THREE.CylinderGeometry(1,1.25,1,8);
let turretHeadGeo=new THREE.BoxGeometry(1,1,1);
let turretBarrelGeo=new THREE.CylinderGeometry(0.16,0.2,2.4,10);
let bossBasePlatformGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseTowerGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseSpireGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseGateGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseRingGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseGlowGeo=new THREE.BoxGeometry(1,1,1);
let turretBaseMat=new THREE.MeshStandardMaterial({color:0x312a3e,roughness:0.82,metalness:0.42});
let turretHeadMat=new THREE.MeshStandardMaterial({color:0x554163,emissive:0x16091f,emissiveIntensity:0.22,roughness:0.72,metalness:0.48});
let turretBarrelMat=new THREE.MeshStandardMaterial({color:0x151923,emissive:0x06162d,emissiveIntensity:0.32,roughness:0.56,metalness:0.7});

function environmentColors(){
  return {...defaultEnvironment.colors,...(currentEnvironment.colors || {})};
}

function environmentVegetation(){
  return {...defaultEnvironment.vegetation,...(currentEnvironment.vegetation || {})};
}

function setMaterialColor(material,color,emissive=null){
  if(material.color && color!=null) material.color.set(color);
  if(material.emissive && emissive!=null) material.emissive.set(emissive);
}

function mixHexColor(a,b,amount){
  let color=new THREE.Color(a);
  color.lerp(new THREE.Color(b),Math.max(0,Math.min(1,amount)));
  return color.getHex();
}

function applyEnvironment(environment={}){
  currentEnvironment={
    ...defaultEnvironment,
    ...environment,
    colors:{...defaultEnvironment.colors,...(environment.colors || {})},
    vegetation:{...defaultEnvironment.vegetation,...(environment.vegetation || {})}
  };
  let colors=environmentColors();
  if(landMat.map) landMat.map.dispose();
  landMat.map=makeGroundTexture(currentEnvironment);
  landMat.needsUpdate=true;
  setMaterialColor(waterMat,colors.water,colors.waterEmissive);
  setMaterialColor(barkMat,colors.bark,colors.barkEmissive);
  setMaterialColor(leafMat,colors.leaf,colors.leafEmissive);
  setMaterialColor(podMat,colors.pod,colors.podEmissive);
  setMaterialColor(grassMat,colors.grass,colors.grassEmissive);
  setMaterialColor(rockMat,colors.rock);
  setMaterialColor(gravelMat,mixHexColor(colors.rock,colors.shore,0.36));
  setMaterialColor(buildingWallMat,colors.wall);
  setMaterialColor(buildingRoofMat,colors.roof);
  setMaterialColor(chimneyMat,colors.roof);
  setMaterialColor(houseTrimMat,colors.trim);
  setMaterialColor(brickWallMat,colors.brick);
  setMaterialColor(cityStreetMat,colors.street || mixHexColor(colors.roof,colors.rock,0.5));

  let bossHull=mixHexColor(colors.rock,colors.roof,0.56);
  let bossHullEmissive=mixHexColor(colors.barkEmissive || colors.bark,colors.rock,0.32);
  let bossTrim=colors.trim;
  let bossTrimEmissive=mixHexColor(colors.trim,colors.podEmissive || colors.pod || colors.water,0.42);
  let bossGlow=colors.podEmissive || colors.pod || colors.water;
  setMaterialColor(bossBaseMat,bossHull,bossHullEmissive);
  setMaterialColor(bossBaseTrimMat,bossTrim,bossTrimEmissive);
  if(bossBaseGlowMat.color) bossBaseGlowMat.color.set(bossGlow);
  setMaterialColor(turretBaseMat,mixHexColor(colors.rock,colors.wall,0.44));
  setMaterialColor(turretHeadMat,mixHexColor(colors.wall,colors.trim,0.36),bossHullEmissive);
  setMaterialColor(turretBarrelMat,mixHexColor(colors.roof,colors.rock,0.5),colors.waterEmissive || bossGlow);
}

applyEnvironment(currentEnvironment);

function chunkKey(cx,cz){
  return cx+","+cz;
}

function roadYawAt(z){
  return Math.atan2(roadCenterX(z+18)-roadCenterX(z-18),36);
}

function r01(a,b){
  return rand(a,b)*0.5+0.5;
}

function cityDistrictChance(){
  return currentEnvironment.city ? 0.28 : 0.075;
}

function chunkHasCityDistrict(cx,cz){
  return r01(cx*37,cz*53)<=cityDistrictChance();
}

function cityDistrictCandidate(cx,cz){
  if(!chunkHasCityDistrict(cx,cz)) return null;

  let rr1=r01(cx*701,cz*409);
  let rr2=r01(cx*157,cz*991);
  let centerX=cx*chunkSize+(rr1-.5)*chunkSize;
  let centerZ=cz*chunkSize+(rr2-.5)*chunkSize;
  let centerY=groundHeight(centerX,centerZ);
  let centerRoadD=roadDistance(centerX,centerZ);
  if(centerRoadD<12) return null;

  let villageRadius=86+r01(cx,cz+9)*34;
  if(!terrainPatchOk(centerX,centerZ,villageRadius*1.08,25,7.5)) return null;

  return {x:centerX,z:centerZ,y:centerY,r:villageRadius};
}

function findCityDistrictNearRoad(searchRadiusChunks=18){
  let best=null;
  for(let dz=0;dz<=searchRadiusChunks;dz++){
    for(let direction of (dz===0 ? [1] : [1,-1])){
      let cz=dz*direction;
      let roadCx=Math.floor(roadCenterX(cz*chunkSize)/chunkSize);
      for(let offset=-4;offset<=4;offset++){
        let cx=roadCx+offset;
        let city=cityDistrictCandidate(cx,cz);
        if(!city) continue;
        let roadDist=roadDistance(city.x,city.z);
        let score=Math.abs(cz)*0.8+Math.abs(offset)*1.2+Math.abs(roadDist-170)*0.015;
        if(!best || score<best.score) best={...city,score};
      }
    }
    if(best && dz>2) break;
  }

  return best;
}

let hiddenInstanceMatrix=new THREE.Matrix4().makeScale(0,0,0);

function freezeStaticObject(object){
  object.updateMatrix();
  object.matrixAutoUpdate=false;
  object.matrixWorldNeedsUpdate=true;
  return object;
}

function hideInstance(mesh,index){
  if(!mesh || index==null || index<0) return;
  mesh.setMatrixAt(index,hiddenInstanceMatrix);
  mesh.instanceMatrix.needsUpdate=true;
}

function makeTurret(x,y,z,angle){
  let group=new THREE.Group();
  let base=new THREE.Mesh(turretBaseGeo,turretBaseMat);
  let head=new THREE.Mesh(turretHeadGeo,turretHeadMat);
  let barrel=new THREE.Mesh(turretBarrelGeo,turretBarrelMat);

  base.position.y=0.5;
  head.position.y=1.45;
  head.scale.set(1.55,0.9,1.25);
  barrel.position.set(0,1.48,1.25);
  barrel.rotation.x=Math.PI/2;
  barrel.scale.set(1,1,1.15);

  for(let mesh of [base,head,barrel]){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    group.add(mesh);
  }

  group.position.set(x,y,z);
  group.rotation.y=angle;
  return group;
}

function makeBossBase(x,z,angle=0){
  let y=groundHeight(x,z);
  let group=new THREE.Group();
  group.position.set(x,y,z);
  group.rotation.y=angle;
  let turrets=[];
  let guardPoints=[];

  function addPart(geo,mat,px,py,pz,sx,sy,sz,rx=0,ry=0,rz=0){
    let mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(px,py,pz);
    mesh.scale.set(sx,sy,sz);
    mesh.rotation.set(rx,ry,rz);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
  }

  addPart(bossBasePlatformGeo,bossBaseMat,0,2.2,0,76,4.4,50,0,Math.PI*0.25,0);
  addPart(bossBasePlatformGeo,bossBaseMat,0,4.8,0,66,5.2,66,0,0,0);
  addPart(bossBasePlatformGeo,bossBaseTrimMat,0,7.6,0,58,3.4,14,0,Math.PI*0.25,0);
  addPart(bossBasePlatformGeo,bossBaseTrimMat,0,8.8,0,14,3.8,58,0,Math.PI*0.25,0);

  addPart(bossBaseTowerGeo,bossBaseMat,0,22,0,20,31,20,0,Math.PI*0.25,0);
  addPart(bossBaseTowerGeo,bossBaseTrimMat,0,27,0,24,5,24,0,Math.PI*0.25,0);
  addPart(bossBaseSpireGeo,bossBaseTrimMat,0,42,0,24,6,24,0,Math.PI*0.25,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,46,0,18,2,18,0,Math.PI*0.25,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,35.5,10.8,10,0.9,0.45,0,0,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,35.5,-10.8,10,0.9,0.45,0,0,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),10.8,35.5,0,0.45,0.9,10,0,0,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),-10.8,35.5,0,0.45,0.9,10,0,0,0);

  for(let side of [-1,1]){
    for(let level of [17,24,31]){
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),side*10.4,level,0,0.55,1.5,8,0,0,0);
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,level,side*10.4,8,1.5,0.55,0,0,0);
    }
    for(let band of [-1,1]){
      addPart(bossBaseGateGeo,bossBaseTrimMat,side*22,13,band*22,2.2,12,10,0,band*0.55,0);
    }
  }

  for(let side of [-1,1]){
    addPart(bossBaseGateGeo,bossBaseMat,0,9.5,side*34,24,8,5,0,0,0);
    addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,10.3,side*36.7,18,2.4,0.45,0,0,0);
    addPart(bossBaseGateGeo,bossBaseTrimMat,side*32,10,0,5,9,24,0,0,0);
    addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),side*36.7,10.8,0,0.45,2.4,18,0,0,0);
    addPart(bossBaseGateGeo,bossBaseMat,side*18,7.5,side*28,9,4,4,0,side*0.35,0);
    addPart(bossBaseGateGeo,bossBaseMat,-side*18,7.5,side*28,9,4,4,0,-side*0.35,0);
    for(let notch of [-1,0,1]){
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),notch*7.5,13.5,side*39.4,3.4,0.65,0.35,0,0,0);
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),side*39.4,13.5,notch*7.5,0.35,0.65,3.4,0,0,0);
    }
  }

  for(let i=0;i<8;i++){
    let a=(i/8)*Math.PI*2+Math.PI*0.125;
    let px=Math.cos(a)*36;
    let pz=Math.sin(a)*36;
    let bladeYaw=-a+Math.PI*0.5;
    let height=i%2===0 ? 24 : 18;
    addPart(bossBaseTowerGeo,bossBaseMat,px,height*0.5+5,pz,6,height,10,0,bladeYaw,0);
    addPart(bossBaseSpireGeo,bossBaseTrimMat,px,height+16,pz,8,6,12,0,bladeYaw+Math.PI*0.25,0);
    addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),px,height+7,pz,0.55,11,4,0,bladeYaw,0);
    addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),px,height*0.5+8,pz,0.65,1.4,7,0,bladeYaw,0);
    addPart(bossBaseGateGeo,bossBaseTrimMat,px*0.82,9.5,pz*0.82,7,3.6,1.2,0,bladeYaw,0);
    addPart(bossBaseGateGeo,bossBaseMat,px*0.64,15.5,pz*0.64,2.4,15,2.4,0,bladeYaw+Math.PI*0.25,0);
    if(i%2===0){
      let turret=makeTurret(0,0,0,bladeYaw);
      turret.position.set(px*0.92,14.8,pz*0.92);
      turret.scale.set(1.35,1.35,1.35);
      group.add(turret);
      turrets.push({
        object:turret,
        cooldown:50+i*13,
        localX:px*0.92,
        localY:14.8,
        localZ:pz*0.92
      });
    }
  }

  for(let i=0;i<12;i++){
    let a=(i/12)*Math.PI*2;
    let px=Math.cos(a)*48;
    let pz=Math.sin(a)*48;
    addPart(bossBaseSpireGeo,bossBaseTrimMat,px,7.4,pz,5.8,10,2.8,0,-a+Math.PI*0.5,0);
  }

  for(let i=0;i<16;i++){
    let a=(i/16)*Math.PI*2;
    let px=Math.cos(a)*40;
    let pz=Math.sin(a)*40;
    let yaw=-a+Math.PI*0.5;
    addPart(bossBaseGateGeo,bossBaseMat,px,4.4,pz,7.5,2.4,1.4,0,yaw,0);
    if(i%2===0){
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),px,6.1,pz,4.5,0.6,0.35,0,yaw,0);
    }
  }

  for(let i=0;i<20;i++){
    let a=(i/20)*Math.PI*2+Math.PI*0.05;
    let px=Math.cos(a)*29;
    let pz=Math.sin(a)*29;
    let yaw=-a+Math.PI*0.5;
    let panelHeight=i%3===0 ? 1.8 : 1.1;
    addPart(bossBaseGateGeo,bossBaseTrimMat,px,11.4+(i%4)*1.15,pz,3.2,panelHeight,0.75,0,yaw,0);
  }

  for(let i=0;i<5;i++){
    let a=angle+(i/5)*Math.PI*2+Math.PI*0.22;
    let dist=i===0 ? 62 : 72+(i%2)*10;
    guardPoints.push({
      x:x+Math.sin(a)*dist,
      z:z+Math.cos(a)*dist
    });
  }

  scene.add(group);

  return {
    group,
    x,
    y,
    z,
    angle,
    r:46,
    health:720,
    maxHealth:720,
    active:true,
    turrets,
    guardPoints,
    guardsSpawned:false
  };
}

function clearBossBases(){
  for(let base of bossBases){
    scene.remove(base.group);
  }
  bossBases.length=0;
  bossBaseColliders.length=0;
}

function placeTestBossBaseNearStart(startX,startZ,startAngle=0){
  clearBossBases();

  let minBossBaseStartDistance=3000;
  let forwardX=Math.sin(startAngle);
  let forwardZ=Math.cos(startAngle);
  let rightX=Math.cos(startAngle);
  let rightZ=-Math.sin(startAngle);
  let best=null;
  let offsets=[
    {forward:3100,side:920},
    {forward:3800,side:-1050},
    {forward:4500,side:600},
    {forward:5200,side:-1250},
    {forward:5900,side:950}
  ];

  for(let offset of offsets){
    for(let sideSign of [1,-1]){
      let side=offset.side*sideSign;
      let x=startX+forwardX*offset.forward+rightX*side;
      let z=startZ+forwardZ*offset.forward+rightZ*side;
      if(Math.hypot(x-startX,z-startZ)<minBossBaseStartDistance) continue;
      let y=groundHeight(x,z);
      if(y<waterLevel+3 || y>38) continue;
      if(roadDistance(x,z)<70) continue;
      if(collidesWithObstacles(x,z)) continue;
      best={x,z};
      break;
    }
    if(best) break;
  }

  if(!best){
    best={
      x:startX+forwardX*3600+rightX*900,
      z:startZ+forwardZ*3600+rightZ*900
    };
  }

  let base=makeBossBase(best.x,best.z,startAngle+Math.PI);
  bossBases.push(base);
  bossBaseColliders.push({
    x:base.x,
    baseY:base.y,
    y:base.y+18,
    z:base.z,
    r:base.r,
    height:48,
    visualRadius:base.r,
    visualHeight:54,
    type:"bossBase",
    base,
    indestructible:true,
    object:base.group
  });

  return base;
}

function damageBossBase(obstacle,amount=1){
  let base=obstacle && obstacle.base ? obstacle.base : obstacle;
  if(!base || !base.active || base.health<=0) return false;

  base.health=Math.max(0,base.health-amount);

  if(base.health<=0){
    base.active=false;
    base.group.visible=false;
    for(let collider of bossBaseColliders){
      if(collider.base===base) collider.destroyed=true;
    }
    return true;
  }

  return false;
}

function collidesWithObstacles(x,z){
  let pcx=Math.floor(x/chunkSize);
  let pcz=Math.floor(z/chunkSize);

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.colliders) continue;

      for(let obstacle of chunk.colliders){
        if(obstacle.destroyed) continue;
        if(obstacle.type==="smallRock") continue;

        let ox=obstacle.x;
        let oz=obstacle.z;
        let r=obstacle.r+carRadius;
        let dist=x-ox;
        let distz=z-oz;

        if(dist*dist+distz*distz<r*r) return true;
      }
    }
  }

  for(let obstacle of bossBaseColliders){
    if(obstacle.destroyed) continue;
    let r=obstacle.r+carRadius;
    let dist=x-obstacle.x;
    let distz=z-obstacle.z;
    if(dist*dist+distz*distz<r*r) return true;
  }

  return false;
}

function obstacleAt(x,z,padding=0){
  let pcx=Math.floor(x/chunkSize);
  let pcz=Math.floor(z/chunkSize);
  let best=null;
  let bestDist=Infinity;

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.colliders) continue;

      for(let obstacle of chunk.colliders){
        if(obstacle.destroyed || obstacle.type==="treeCluster") continue;

        let ox=obstacle.x;
        let oz=obstacle.z;
        let r=obstacle.r+padding;
        let distSq=(x-ox)*(x-ox)+(z-oz)*(z-oz);

        if(distSq<r*r && distSq<bestDist){
          best=obstacle;
          bestDist=distSq;
        }
      }
    }
  }

  for(let obstacle of bossBaseColliders){
    if(obstacle.destroyed) continue;
    let r=obstacle.r+padding;
    let distSq=(x-obstacle.x)*(x-obstacle.x)+(z-obstacle.z)*(z-obstacle.z);
    if(distSq<r*r && distSq<bestDist){
      best=obstacle;
      bestDist=distSq;
    }
  }

  return best;
}

function obstacleAlongSegment(fromX,fromZ,toX,toZ,padding=0){
  let dx=toX-fromX;
  let dz=toZ-fromZ;
  let distance=Math.hypot(dx,dz);
  let steps=Math.max(1,Math.min(24,Math.ceil(distance/0.35)));

  for(let i=0;i<=steps;i++){
    let t=i/steps;
    let obstacle=obstacleAt(fromX+dx*t,fromZ+dz*t,padding);
    if(obstacle) return obstacle;
  }

  return null;
}

function obstacleAlongSegment3D(fromX,fromY,fromZ,toX,toY,toZ,padding=0){
  let fromCx=Math.floor(fromX/chunkSize);
  let fromCz=Math.floor(fromZ/chunkSize);
  let toCx=Math.floor(toX/chunkSize);
  let toCz=Math.floor(toZ/chunkSize);
  let sx=toX-fromX;
  let sy=toY-fromY;
  let sz=toZ-fromZ;
  let segLenSq=Math.max(0.0001,sx*sx+sy*sy+sz*sz);
  let best=null;
  let bestT=Infinity;

  for(let cx=Math.min(fromCx,toCx)-1;cx<=Math.max(fromCx,toCx)+1;cx++){
    for(let cz=Math.min(fromCz,toCz)-1;cz<=Math.max(fromCz,toCz)+1;cz++){
      let chunk=chunks.get(chunkKey(cx,cz));
      if(!chunk || !chunk.colliders) continue;

      for(let obstacle of chunk.colliders){
        if(obstacle.destroyed || obstacle.type==="treeCluster") continue;

        let isRock=obstacle.type==="rock" || obstacle.type==="smallRock";
        let isBuilding=obstacle.type==="building" || obstacle.type==="wall" || obstacle.type==="turret";
        let isBossBase=obstacle.type==="bossBase";
        let obstacleY=isRock && Number.isFinite(obstacle.y)
          ? obstacle.y
          : isBossBase && Number.isFinite(obstacle.y)
          ? obstacle.y
          : isBuilding && Number.isFinite(obstacle.y)
          ? obstacle.y
          : groundHeight(obstacle.x,obstacle.z)+Math.max(0.6,obstacle.r*0.45);
        let t=((obstacle.x-fromX)*sx+(obstacleY-fromY)*sy+(obstacle.z-fromZ)*sz)/segLenSq;
        t=Math.max(0,Math.min(1,t));

        let closestX=fromX+sx*t;
        let closestY=fromY+sy*t;
        let closestZ=fromZ+sz*t;
        let radius=(isBossBase
          ? Math.max(4,obstacle.r)
          : isRock
          ? Math.max(2.0,(obstacle.visualRadius || obstacle.r)*1.15)
          : isBuilding
          ? Math.max(2.0,(obstacle.visualRadius || obstacle.r)*0.9)
          : Math.max(1.2,obstacle.r*0.72))+padding;
        let verticalRadius=(isBossBase
          ? Math.max(4,(obstacle.visualHeight || obstacle.height || obstacle.r)*0.52)
          : isRock
          ? Math.max(1.2,(obstacle.visualHeight || obstacle.height || obstacle.r)*0.72)
          : isBuilding
          ? Math.max(2.0,(obstacle.visualHeight || obstacle.height || obstacle.r)*0.52)
          : Math.max(1.0,obstacle.r*0.65))+padding;
        let verticalScale=Math.max(0.001,verticalRadius/radius);
        let distSq=(closestX-obstacle.x)*(closestX-obstacle.x)
          + ((closestY-obstacleY)/verticalScale)*((closestY-obstacleY)/verticalScale)
          + (closestZ-obstacle.z)*(closestZ-obstacle.z);

        if((isRock || isBuilding) && distSq>=radius*radius){
          let horizontalSegLenSq=Math.max(0.0001,sx*sx+sz*sz);
          let obstacleT=((obstacle.x-fromX)*sx+(obstacle.z-fromZ)*sz)/horizontalSegLenSq;
          obstacleT=Math.max(0,Math.min(1,obstacleT));
          let obstacleX=fromX+sx*obstacleT;
          let obstacleYAtT=fromY+sy*obstacleT;
          let obstacleZ=fromZ+sz*obstacleT;
          let horizontalDistSq=(obstacleX-obstacle.x)*(obstacleX-obstacle.x)+(obstacleZ-obstacle.z)*(obstacleZ-obstacle.z);
          let visualTop=(Number.isFinite(obstacle.baseY) ? obstacle.baseY : groundHeight(obstacle.x,obstacle.z))+(obstacle.visualHeight || obstacle.height || obstacle.r);
          let visualBottom=(Number.isFinite(obstacle.baseY) ? obstacle.baseY : groundHeight(obstacle.x,obstacle.z))-0.35;
          let verticalPad=padding+0.85;
          if(horizontalDistSq<radius*radius && obstacleYAtT>=visualBottom-verticalPad && obstacleYAtT<=visualTop+verticalPad){
            distSq=radius*radius*0.5;
            t=obstacleT;
          }
        }

        if(distSq<radius*radius && t<bestT){
          best=obstacle;
          bestT=t;
        }
      }
    }
  }

  for(let obstacle of bossBaseColliders){
    if(obstacle.destroyed) continue;

    let obstacleY=Number.isFinite(obstacle.y)
      ? obstacle.y
      : groundHeight(obstacle.x,obstacle.z)+Math.max(0.6,obstacle.r*0.45);
    let t=((obstacle.x-fromX)*sx+(obstacleY-fromY)*sy+(obstacle.z-fromZ)*sz)/segLenSq;
    t=Math.max(0,Math.min(1,t));

    let closestX=fromX+sx*t;
    let closestY=fromY+sy*t;
    let closestZ=fromZ+sz*t;
    let radius=Math.max(4,obstacle.r)+padding;
    let verticalRadius=Math.max(4,(obstacle.visualHeight || obstacle.height || obstacle.r)*0.52)+padding;
    let verticalScale=Math.max(0.001,verticalRadius/radius);
    let distSq=(closestX-obstacle.x)*(closestX-obstacle.x)
      + ((closestY-obstacleY)/verticalScale)*((closestY-obstacleY)/verticalScale)
      + (closestZ-obstacle.z)*(closestZ-obstacle.z);

    if(distSq<radius*radius && t<bestT){
      best=obstacle;
      bestT=t;
    }
  }

  return best;
}

function destroyObstacle(obstacle){
  if(!obstacle || obstacle.destroyed) return false;
  if(obstacle.indestructible) return false;
  obstacle.destroyed=true;

  if(obstacle.instances){
    for(let item of obstacle.instances){
      hideInstance(item.mesh,item.index);
    }
  }
  if(obstacle.object) obstacle.object.visible=false;

  return true;
}

function isVillageCleared(village){
  return !!(village && village.buildings && village.buildings.length>0
    && village.buildings.every(building=>building.destroyed));
}

function terrainPatchOk(x,z,radius,maxHeight=24,maxRange=7){
  let minH=Infinity;
  let maxH=-Infinity;
  let samples=[
    [0,0],
    [1,0],
    [-1,0],
    [0,1],
    [0,-1],
    [0.72,0.72],
    [-0.72,0.72],
    [0.72,-0.72],
    [-0.72,-0.72]
  ];

  for(let sample of samples){
    let h=groundHeight(x+sample[0]*radius,z+sample[1]*radius);
    minH=Math.min(minH,h);
    maxH=Math.max(maxH,h);
  }

  return minH>-12 && maxH<maxHeight && maxH-minH<maxRange;
}

function makeChunk(cx,cz){
  let envColors=environmentColors();
  let vegetation=environmentVegetation();
  let cityMode=chunkHasCityDistrict(cx,cz);
  let detail=chunkDetails.get(chunkKey(cx,cz)) || {treeDensity:1,partDensity:1,grassDensity:1};
  let colors=[];
  let colliders=[];
  let geo=new THREE.PlaneGeometry(chunkSize,chunkSize,segments,segments);
  geo.rotateX(-Math.PI/2);

  let pos=geo.attributes.position;

  for(let i=0;i<pos.count;i++){
    let wx=pos.getX(i)+cx*chunkSize;
    let wz=pos.getZ(i)+cz*chunkSize;
    let h=groundHeight(wx,wz);

    if(h<waterLevel){
      h=Math.min(h,waterLevel-0.55);
    }

    pos.setY(i,h);

    let color=new THREE.Color();

    if(h<waterLevel) color.set(envColors.underwater);
    else if(h<waterLevel+2.7) color.set(envColors.shore);
    else if(h<waterLevel+5.4){
      let t=(h-(waterLevel+2.7))/2.7;
      color.set(envColors.shore).lerp(new THREE.Color(envColors.low),t);
    }
    else if(h<15) color.set(envColors.low);
    else if(h<30) color.set(envColors.mid);
    else color.set(envColors.high);

    colors.push(color.r,color.g,color.b);
  }

  geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();

  let land=new THREE.Mesh(geo,landMat);
  land.position.set(cx*chunkSize,0,cz*chunkSize);
  freezeStaticObject(land);
  scene.add(land);

  let road=new THREE.Object3D();

  let water=new THREE.Mesh(
    new THREE.PlaneGeometry(chunkSize,chunkSize),
    waterMat
  );
  water.rotation.x=-Math.PI/2;
  water.position.set(cx*chunkSize,waterLevel,cz*chunkSize);
  water.renderOrder=2;
  freezeStaticObject(water);
  scene.add(water);

  let clusterCount=Math.max(0,Math.ceil(vegetation.treeClusters*detail.treeDensity));
  let treesPerCluster=Math.max(1,Math.ceil(vegetation.treesPerCluster*detail.treeDensity));
  let clusterRadius=vegetation.treeClusterRadius;
  let crownsPerTree=Math.max(1,Math.floor(vegetation.crownsPerTree*detail.partDensity));
  let podsPerTree=Math.max(0,Math.floor(vegetation.podsPerTree*detail.partDensity));
  let maxTrees=clusterCount*treesPerCluster;

  let trunks=new THREE.InstancedMesh(trunkGeo,barkMat,maxTrees);
  let crowns=new THREE.InstancedMesh(crownGeo,leafMat,maxTrees*crownsPerTree);
  let pods=new THREE.InstancedMesh(podGeo,podMat,maxTrees*podsPerTree);

  let dummy=new THREE.Object3D();
  let treeUsed=0;
  let crownUsed=0;
  let podUsed=0;

  for(let c=0;c<clusterCount;c++){
    let crx=rand(cx*91+c,cz*37-c);
    let crz=rand(cx*53-c,cz*79+c);

    let centerX=cx*chunkSize+(crx-.5)*chunkSize;
    let centerZ=cz*chunkSize+(crz-.5)*chunkSize;
    let centerY=groundHeight(centerX,centerZ);

    if(centerY<-15 || centerY>32) continue;
    if(roadDistance(centerX,centerZ)<70) continue;

    colliders.push({x:centerX,z:centerZ,r:6,type:"treeCluster"});

    for(let i=0;i<treesPerCluster;i++){
      let a=rand(cx*999+c*17+i,cz*777-i)*Math.PI*2;
      let r=Math.pow(rand(cx*333+i,cz*555+c),.6)*clusterRadius;

      let wx=centerX+Math.cos(a)*r;
      let wz=centerZ+Math.sin(a)*r;
      let wy=groundHeight(wx,wz);

      if(wy<-15 || wy>32) continue;
      if(roadDistance(wx,wz)<45) continue;

      let scale=.55+rand(i+cx+c,cz-i)*.9;
      let rot=rand(i,cx+cz+c)*Math.PI*2;
      let leanX=(rand(cx*13+i,cz*19+c)-0.5)*vegetation.leanAmount;
      let leanZ=(rand(cx*23-i,cz*29-c)-0.5)*vegetation.leanAmount;
      let trunkHeightScale=vegetation.trunkHeightBase+rand(cx*31+i,cz*41-c)*vegetation.trunkHeightVariance;
      let trunkWidthScale=vegetation.trunkWidthBase+rand(cx*43-i,cz*47+c)*vegetation.trunkWidthVariance;
      let rootRadius=Math.max(1.7,scale*trunkWidthScale*1.9);
      if(!terrainPatchOk(wx,wz,rootRadius,34,2.6)) continue;

      let treeCollider={x:wx,z:wz,r:2.4,type:"tree",instances:[]};
      colliders.push(treeCollider);
      let rootSink=0.45+Math.min(0.9,Math.abs(leanX)+Math.abs(leanZ));

      dummy.position.set(wx,wy+5.25*scale*trunkHeightScale-rootSink,wz);
      dummy.rotation.set(leanX,rot,leanZ);
      dummy.scale.set(scale*trunkWidthScale,scale*trunkHeightScale,scale*trunkWidthScale);
      dummy.updateMatrix();
      trunks.setMatrixAt(treeUsed,dummy.matrix);
      treeCollider.instances.push({mesh:trunks,index:treeUsed});

      let crownStart=crownUsed;
      for(let j=0;j<crownsPerTree;j++){
        let crownScale=scale*(vegetation.crownBaseScale-j*vegetation.crownScaleStep);
        let angle=rot+j*2.38+rand(i+j*11,c*17)*0.9;
        let radius=j===0 ? 0 : (vegetation.crownSpreadBase+rand(i*7+j,cx-cz)*vegetation.crownSpreadVariance)*scale;
        let lift=(vegetation.crownLiftBase+Math.sin(j*1.7)*0.8+j*vegetation.crownLiftStep)*scale*trunkHeightScale;

        dummy.position.set(
          wx+Math.cos(angle)*radius,
          wy+lift,
          wz+Math.sin(angle)*radius
        );
        dummy.rotation.set(
          rand(j+i,cx)*Math.PI,
          angle,
          rand(cz,j-c)*Math.PI
        );
        dummy.scale.set(
          crownScale*(0.95+rand(j+cx,i)*0.45)*vegetation.crownWidthScale,
          crownScale*(0.48+rand(j+cz,i+c)*0.34)*vegetation.crownFlatness,
          crownScale*(0.9+rand(j-cx,i-c)*0.5)*vegetation.crownDepthScale
        );
        dummy.updateMatrix();

        crowns.setMatrixAt(crownUsed,dummy.matrix);
        crownUsed++;
      }

      for(let k=crownStart;k<crownUsed;k++){
        treeCollider.instances.push({mesh:crowns,index:k});
      }

      let podStart=podUsed;
      for(let j=0;j<podsPerTree;j++){
        let podScale=scale*(vegetation.podScaleBase+rand(i*19+j,cx+cz)*vegetation.podScaleVariance);
        let angle=rot+j*Math.PI*0.5+rand(c*29+j,i)*0.65;
        let radius=(1.4+rand(i*31-j,cz)*1.8)*scale;

        dummy.position.set(
          wx+Math.cos(angle)*radius,
          wy+(vegetation.podLiftBase+rand(j+cx,c-i)*vegetation.podLiftVariance)*scale*trunkHeightScale,
          wz+Math.sin(angle)*radius
        );
        dummy.rotation.set(0,angle,0);
        dummy.scale.set(podScale,podScale*vegetation.podElongation,podScale);
        dummy.updateMatrix();

        pods.setMatrixAt(podUsed,dummy.matrix);
        podUsed++;
      }

      for(let k=podStart;k<podUsed;k++){
        treeCollider.instances.push({mesh:pods,index:k});
      }

      treeUsed++;
    }
  }

  trunks.count=treeUsed;
  crowns.count=crownUsed;
  pods.count=podUsed;
  trunks.instanceMatrix.needsUpdate=true;
  crowns.instanceMatrix.needsUpdate=true;
  pods.instanceMatrix.needsUpdate=true;
  freezeStaticObject(trunks);
  freezeStaticObject(crowns);
  freezeStaticObject(pods);
  scene.add(trunks,crowns,pods);

  let grassClusterCount=Math.max(0,Math.ceil(vegetation.grassClusters*detail.grassDensity));
  let grassPerCluster=Math.max(1,Math.ceil(vegetation.grassPerCluster*detail.grassDensity));
  let grassClusterRadius=vegetation.grassClusterRadius;
  let maxGrasses=grassClusterCount*grassPerCluster;

  let grasses=new THREE.InstancedMesh(grassGeo,grassMat,maxGrasses);
  let grassUsed=0;

  for(let c=0;c<grassClusterCount;c++){
    let crx=rand(cx*234+c,cz*567-c);
    let crz=rand(cx*890-c,cz*12+c);

    let centerX=cx*chunkSize+(crx-.5)*chunkSize;
    let centerZ=cz*chunkSize+(crz-.5)*chunkSize;
    let centerY=groundHeight(centerX,centerZ);

    if(centerY<-15 || centerY>28) continue;
    if(roadDistance(centerX,centerZ)<35) continue;

    for(let i=0;i<grassPerCluster;i++){
      let a=rand(cx*345+c*11+i,cz*678-i)*Math.PI*2;
      let r=Math.pow(rand(cx*901+i,cz*234+c),.5)*grassClusterRadius;

      let wx=centerX+Math.cos(a)*r;
      let wz=centerZ+Math.sin(a)*r;
      let wy=groundHeight(wx,wz);

      if(wy<-15 || wy>28) continue;
      if(roadDistance(wx,wz)<35) continue;

      let scale=.4+rand(i,cx-cz)*.8;

      dummy.position.set(wx,wy+1.2*scale,wz);
      dummy.rotation.set(0,rand(i*3,cx+cz)*Math.PI*2,0);
      dummy.scale.set(scale,.7+scale,scale);
      dummy.updateMatrix();

      grasses.setMatrixAt(grassUsed,dummy.matrix);
      grassUsed++;
    }
  }

  grasses.count=grassUsed;
  grasses.instanceMatrix.needsUpdate=true;
  freezeStaticObject(grasses);
  scene.add(grasses);

  let rockCount=cityMode ? 6 : 30;
  let rocks=new THREE.InstancedMesh(rockGeo,rockMat,rockCount);
  let rockUsed=0;

  for(let i=0;i<rockCount;i++){
    let rx=rand(cx*222+i,cz*888-i);
    let rz=rand(cx*444-i,cz*666+i);

    let wx=cx*chunkSize+(rx-.5)*chunkSize;
    let wz=cz*chunkSize+(rz-.5)*chunkSize;
    let wy=groundHeight(wx,wz);
    let scale=.8+rand(i+9,cx-cz)*3;

    if(wy<-18) continue;
    if(roadDistance(wx,wz)<40) continue;

    colliders.push({
      x:wx,
      baseY:wy,
      y:wy+scale*0.48,
      z:wz,
      r:2.1+scale*0.55,
      height:Math.max(1.0,scale*1.1),
      visualRadius:Math.max(scale,scale*0.8),
      visualHeight:Math.max(1.0,scale*1.6),
      type:scale<1.65 ? "smallRock" : "rock",
      instances:[{mesh:rocks,index:rockUsed}]
    });


    dummy.position.set(wx,wy+scale*.5,wz);
    dummy.rotation.set(
      rand(i,cx)*Math.PI,
      rand(i,cz)*Math.PI,
      rand(cx,cz+i)*Math.PI
    );
    dummy.scale.set(scale,scale*.55,scale*.8);
    dummy.updateMatrix();

    rocks.setMatrixAt(rockUsed,dummy.matrix);
    rockUsed++;
  }

  rocks.count=rockUsed;
  rocks.instanceMatrix.needsUpdate=true;
  freezeStaticObject(rocks);
  scene.add(rocks);

  let gravelCount=Math.max(0,Math.floor((cityMode ? 55 : 120)*detail.grassDensity));
  let gravel=new THREE.InstancedMesh(gravelGeo,gravelMat,gravelCount);
  let gravelUsed=0;

  for(let i=0;i<gravelCount;i++){
    let rx=rand(cx*712+i*13,cz*991-i*5);
    let rz=rand(cx*407-i*7,cz*533+i*17);
    let wx=cx*chunkSize+(rx-.5)*chunkSize;
    let wz=cz*chunkSize+(rz-.5)*chunkSize;
    let wy=groundHeight(wx,wz);
    let roadDist=roadDistance(wx,wz);

    if(wy<waterLevel+1.2 || wy>38) continue;
    if(roadDist<28) continue;
    if(cityMode && roadDist<76) continue;

    let scale=0.16+rand(i*5+11,cx-cz)*0.38;
    let flatness=0.035+rand(cx+i*3,cz-i*2)*0.055;

    dummy.position.set(wx,wy+0.035,wz);
    dummy.rotation.set(
      rand(i,cx+5)*0.24,
      rand(i*9,cz-3)*Math.PI*2,
      rand(cx-7,cz+i)*0.24
    );
    dummy.scale.set(scale*(0.9+rand(i+1,cx)*0.6),flatness,scale*(0.7+rand(i+2,cz)*0.8));
    dummy.updateMatrix();

    gravel.setMatrixAt(gravelUsed,dummy.matrix);
    gravelUsed++;
  }

  gravel.count=gravelUsed;
  gravel.instanceMatrix.needsUpdate=true;
  freezeStaticObject(gravel);
  scene.add(gravel);

  let maxBuildings=cityMode ? 70 : 120;
  let maxWindowInstances=maxBuildings*(cityMode ? 48 : 8);
  let buildingBodies=new THREE.InstancedMesh(buildingGeo,buildingWallMat,maxBuildings);
  let maxRoofInstances=cityMode ? maxBuildings*2 : maxBuildings;
  let maxTrimInstances=maxBuildings*(cityMode ? 5 : 2);
  let buildingRoofs=new THREE.InstancedMesh(buildingRoofGeo,buildingRoofMat,maxRoofInstances);
  let buildingWindows=new THREE.InstancedMesh(windowGeo,windowMat,maxWindowInstances);
  let buildingDoors=new THREE.InstancedMesh(doorGeo,doorMat,maxBuildings);
  let buildingChimneys=new THREE.InstancedMesh(chimneyGeo,chimneyMat,maxBuildings);
  let buildingTrims=new THREE.InstancedMesh(trimGeo,houseTrimMat,maxTrimInstances);
  let buildingPorches=new THREE.InstancedMesh(porchGeo,houseTrimMat,maxBuildings);
  let villagesPerChunk=1;
  let villageSpawnChance=cityMode ? 1 : 0.45;
  let villageWalls=new THREE.InstancedMesh(brickWallGeo,brickWallMat,villagesPerChunk*18);
  let cityStreets=new THREE.InstancedMesh(cityStreetGeo,cityStreetMat,cityMode ? villagesPerChunk*8 : 1);
  let buildingUsed=0;
  let windowUsed=0;
  let doorUsed=0;
  let chimneyUsed=0;
  let trimUsed=0;
  let porchUsed=0;
  let wallUsed=0;
  let streetUsed=0;
  let r01=(a,b)=>rand(a,b)*0.5+0.5;
  let villageCenters=[];

  for(let v=0;v<villagesPerChunk;v++){
    if(r01(cx*37+v*101,cz*53-v*17)>villageSpawnChance) continue;
    let rr1=r01(cx*701+v*13,cz*409-v*11);
    let rr2=r01(cx*157-v*19,cz*991+v*23);
    let centerX=cx*chunkSize+(rr1-.5)*chunkSize;
    let centerZ=cz*chunkSize+(rr2-.5)*chunkSize;
    let centerY=groundHeight(centerX,centerZ);
    let centerRoadD=roadDistance(centerX,centerZ);

    if(centerRoadD<(cityMode ? 12 : 24)) continue;

    let largeTown=cityMode || r01(cx*1291+v*43,cz*683-v*29)>0.78;
    let villageRadius=cityMode
      ? 86+r01(cx-v*3,cz+v*9)*34
      : 20+(r01(cx-v*3,cz+v*9)*24)+(largeTown ? 16+r01(cx*503-v*7,cz*211+v*5)*10 : 0);
    if(!terrainPatchOk(centerX,centerZ,villageRadius*(cityMode ? 1.08 : 1.28),largeTown ? 25 : 23,cityMode ? 7.5 : largeTown ? 8 : 6.5)) continue;

    let bossVillage=largeTown && r01(cx*1741+v*71,cz*927-v*37)>0.42;
    let enemyBudget=(cityMode ? 8 : 5)+Math.floor(r01(cx*811+v*31,cz*337-v*13)*(cityMode ? 10 : 7))+(bossVillage ? 5 : largeTown ? 2 : 0);
    let turretCount=getDifficulty()==="easy" ? 0 : bossVillage ? 3 : largeTown ? 1 : 0;
    let village={x:centerX,z:centerZ,y:centerY,r:villageRadius,buildings:[],turrets:[],enemyBudget,enemyRemaining:enemyBudget,bossVillage,bossSpawned:false,city:cityMode};
    villageCenters.push(village);
    let housesInVillage=cityMode
      ? 70
      : largeTown
      ? 26+Math.floor(r01(cx+v*7,cz-v*5)*12)
      : 12+Math.floor(r01(cx+v*7,cz-v*5)*10);
    let placed=[];

    if(cityMode){
      let cityYaw=roadYawAt(centerZ);
      let streetLength=villageRadius*2.25;
      let streetWidth=9.5;
      let streetSpacing=villageRadius*0.5;
      for(let axis=0;axis<2;axis++){
        let yaw=cityYaw+axis*Math.PI*0.5;
        let rightYaw=yaw+Math.PI*0.5;
        for(let offset of [-streetSpacing,0,streetSpacing]){
          if(streetUsed>=cityStreets.count) break;
          let wx=centerX+Math.sin(rightYaw)*offset;
          let wz=centerZ+Math.cos(rightYaw)*offset;
          let wy=groundHeight(wx,wz);
          dummy.position.set(wx,wy+0.05,wz);
          dummy.rotation.set(0,yaw,0);
          dummy.scale.set(streetLength,0.08,streetWidth);
          dummy.updateMatrix();
          cityStreets.setMatrixAt(streetUsed,dummy.matrix);
          streetUsed++;
        }
      }
    }else{
      // Brick wall ring around each village with a front opening toward the road.
      let gateAngle=roadCenterX(centerZ)>centerX ? 0 : Math.PI;
      let wallSegments=14;
      for(let s=0;s<wallSegments && wallUsed<villagesPerChunk*18;s++){
        let t=s/wallSegments;
        let a=t*Math.PI*2;
        let diff=Math.abs(Math.atan2(Math.sin(a-gateAngle),Math.cos(a-gateAngle)));
        if(diff<0.32) continue;

        let radius=villageRadius*1.22;
        let wx=centerX+Math.cos(a)*radius;
        let wz=centerZ+Math.sin(a)*radius;
        let wy=groundHeight(wx,wz);
        let segLen=Math.max(3.2,(Math.PI*2*radius)/wallSegments*0.9);

        dummy.position.set(wx,wy+1.1,wz);
        dummy.rotation.set(0,a+Math.PI*0.5,0);
        dummy.scale.set(segLen,2.2,0.55);
        dummy.updateMatrix();
        villageWalls.setMatrixAt(wallUsed,dummy.matrix);
        wallUsed++;

        colliders.push({x:wx,z:wz,r:Math.max(1.2,segLen*0.32),type:"wall",instances:[{mesh:villageWalls,index:wallUsed-1}]});
      }
    }

    for(let t=0;t<turretCount;t++){
      let angle=(t/turretCount)*Math.PI*2+r01(cx*3001+t*17,cz*2077-t*19)*0.9;
      let tx=centerX+Math.cos(angle)*villageRadius*0.82;
      let tz=centerZ+Math.sin(angle)*villageRadius*0.82;
      let ty=groundHeight(tx,tz);
      if(ty<waterLevel+0.3 || roadDistance(tx,tz)<20) continue;

      let turret=makeTurret(tx,ty,tz,Math.atan2(centerX-tx,centerZ-tz));
      scene.add(turret);
      let collider={x:tx,z:tz,r:3.2,type:"turret",village,object:turret};
      village.turrets.push(collider);
      colliders.push(collider);
    }

    for(let i=0;i<housesInVillage && buildingUsed<maxBuildings;i++){
      let angle=(i/housesInVillage)*Math.PI*2 + r01(i+v*31,cx-cz)*0.9;
      let dist=(0.2+r01(i+cx*3,cz+v)*0.8)*villageRadius;
      let wx=centerX+Math.cos(angle)*dist;
      let wz=centerZ+Math.sin(angle)*dist;
      let cityLocalX=0;
      let cityLocalZ=0;
      if(cityMode){
        let cols=Math.ceil(Math.sqrt(housesInVillage));
        let row=Math.floor(i/cols);
        let col=i%cols;
        let cityYaw=roadYawAt(centerZ);
        let rightX=Math.cos(cityYaw);
        let rightZ=-Math.sin(cityYaw);
        let forwardX=Math.sin(cityYaw);
        let forwardZ=Math.cos(cityYaw);
        let spacing=24+r01(cx*17+i,cz*23-v)*8;
        cityLocalX=(col-(cols-1)*0.5)*spacing+(r01(i*11+cx,cz)-0.5)*4;
        cityLocalZ=(row-(cols-1)*0.5)*spacing+(r01(i*13+cz,cx)-0.5)*4;
        let streetSpacing=villageRadius*0.5;
        let streetClearance=10.5;
        let nearStreetX=Math.min(Math.abs(cityLocalX),Math.abs(cityLocalX-streetSpacing),Math.abs(cityLocalX+streetSpacing));
        let nearStreetZ=Math.min(Math.abs(cityLocalZ),Math.abs(cityLocalZ-streetSpacing),Math.abs(cityLocalZ+streetSpacing));
        if(nearStreetX<streetClearance || nearStreetZ<streetClearance) continue;
        wx=centerX+rightX*cityLocalX+forwardX*cityLocalZ;
        wz=centerZ+rightZ*cityLocalX+forwardZ*cityLocalZ;
      }
      let wy=groundHeight(wx,wz);
      let roadD=roadDistance(wx,wz);

      if(roadD<(cityMode ? 10 : 20)) continue;

      let width=cityMode ? 9+r01(i+cx*5,cz+v*2)*8 : 8+r01(i+cx*5,cz+v*2)*8;
      let depth=cityMode ? 9+r01(i+cz*6,cx-v*2)*8 : 8+r01(i+cz*6,cx-v*2)*8;
      let height=cityMode
        ? 22+r01(cx-i,cz+i+v*17)*54+(i%7===0 ? 18+r01(cx+i*3,cz-v*5)*28 : 0)
        : 4.8+r01(cx-i,cz+i+v*17)*5.6;
      let minGap=Math.max(width,depth)*(cityMode ? 1.08 : largeTown ? 1.05 : 1.35);
      if(!terrainPatchOk(wx,wz,Math.max(width,depth)*0.62,cityMode ? 70 : 24,cityMode ? 5.8 : 4.5)) continue;

      let tooClose=false;
      for(let p of placed){
        let dx=wx-p.x;
        let dz=wz-p.z;
        let gap=minGap+p.r;
        if(dx*dx+dz*dz<gap*gap){
          tooClose=true;
          break;
        }
      }
      if(tooClose) continue;

      let roofHeight=cityMode ? 0.42+r01(i+99+v,cx+cz)*0.36 : 1.4+r01(i+99+v,cx+cz)*1.3;
      let buildingVisualHeight=height+roofHeight+Math.min(24,cityMode ? height*0.28 : roofHeight*0.7);
      let buildingCollider={
        x:wx,
        baseY:wy,
        y:wy+buildingVisualHeight*0.5,
        z:wz,
        r:Math.max(width,depth)*0.78,
        height:buildingVisualHeight,
        visualRadius:Math.max(width,depth)*0.72,
        visualHeight:buildingVisualHeight,
        type:"building",
        cityBuilding:cityMode,
        instances:[],
        village
      };
      let buildingIndex=buildingUsed;
      let windowStart=windowUsed;
      let doorStart=doorUsed;
      let chimneyStart=chimneyUsed;
      let trimStart=trimUsed;
      let porchStart=porchUsed;

      let yaw=cityMode
        ? roadYawAt(centerZ)+(r01(i+v*13,cx-cz)>0.5 ? Math.PI*0.5 : 0)
        : r01(i+v*13,cx-cz)*Math.PI*2;
      let fwdX=Math.sin(yaw),fwdZ=Math.cos(yaw);
      let rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);
      let crownOffset=cityMode ? (r01(i*31+cz,cx+v)-0.5)*Math.min(width,depth)*0.18 : 0;
      dummy.position.set(wx,wy+height*0.5,wz);
      dummy.rotation.set(0,yaw,0);
      dummy.scale.set(
        width*(cityMode ? 0.86+r01(i+cx*2,cz-v)*0.28 : 1),
        height,
        depth*(cityMode ? 0.86+r01(i+cz*2,cx+v)*0.28 : 1)
      );
      dummy.updateMatrix();
      buildingBodies.setMatrixAt(buildingUsed,dummy.matrix);
      buildingCollider.instances.push({mesh:buildingBodies,index:buildingIndex});

      let roofScale=Math.max(width,depth)*(cityMode ? 0.82 : 0.72);
      dummy.position.set(wx+rightX*crownOffset,wy+height+roofHeight*0.5,wz+rightZ*crownOffset);
      dummy.rotation.set(0,yaw+Math.PI*0.25,0);
      dummy.scale.set(
        roofScale*(cityMode ? 0.55+r01(i+71,cx-cz)*0.32 : 1),
        roofHeight,
        roofScale*(cityMode ? 0.55+r01(i+73,cz-cx)*0.32 : 1)
      );
      dummy.updateMatrix();
      buildingRoofs.setMatrixAt(buildingUsed,dummy.matrix);
      buildingCollider.instances.push({mesh:buildingRoofs,index:buildingIndex});

      // Details: front door, four windows, and a roof chimney.
      let frontX=wx+fwdX*(depth*0.5+0.02);
      let frontZ=wz+fwdZ*(depth*0.5+0.02);

      if(doorUsed<maxBuildings){
        dummy.position.set(frontX,wy+1.45,frontZ);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(Math.max(1.0,width*0.14),2.8,0.35);
        dummy.updateMatrix();
        buildingDoors.setMatrixAt(doorUsed,dummy.matrix);
        doorUsed++;
      }

      if(!cityMode && porchUsed<maxBuildings){
        dummy.position.set(frontX,wy+0.25,frontZ);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(Math.max(1.8,width*0.3),0.45,1.1);
        dummy.updateMatrix();
        buildingPorches.setMatrixAt(porchUsed,dummy.matrix);
        porchUsed++;
      }

      if(trimUsed<maxTrimInstances){
        dummy.position.set(wx,wy+height+0.05,wz);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(width*1.02,cityMode ? 0.38 : 0.24,depth*1.02);
        dummy.updateMatrix();
        buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
        trimUsed++;
      }
      if(trimUsed<maxTrimInstances){
        dummy.position.set(wx,wy+0.35,wz);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(width*1.03,cityMode ? 0.34 : 0.24,depth*1.03);
        dummy.updateMatrix();
        buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
        trimUsed++;
      }
      if(cityMode){
        for(let fin=0;fin<2 && trimUsed<maxTrimInstances;fin++){
          let side=fin===0 ? -1 : 1;
          dummy.position.set(
            wx+rightX*side*(width*0.52)+fwdX*(depth*0.08),
            wy+height*(0.48+r01(i+fin*17,cx-cz)*0.18),
            wz+rightZ*side*(width*0.52)+fwdZ*(depth*0.08)
          );
          dummy.rotation.set(0,yaw,side*0.08);
          dummy.scale.set(0.38,height*(0.38+r01(i+fin*23,cz)*0.18),Math.max(1.8,depth*0.16));
          dummy.updateMatrix();
          buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
          trimUsed++;
        }
        if(trimUsed<maxTrimInstances){
          dummy.position.set(wx+rightX*crownOffset,wy+height+roofHeight+Math.min(12,height*0.14),wz+rightZ*crownOffset);
          dummy.rotation.set(0,yaw,0);
          dummy.scale.set(0.42,Math.min(24,height*0.28),0.42);
          dummy.updateMatrix();
          buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
          trimUsed++;
        }
      }

      if(cityMode){
        let rows=Math.min(11,Math.max(4,Math.floor(height/6)));
        let columns=Math.min(4,Math.max(2,Math.floor(width/5)));
        for(let row=0;row<rows && windowUsed<maxWindowInstances;row++){
          let lift=wy+height*(0.16+(row+0.5)*(0.74/rows));
          for(let col=0;col<columns && windowUsed<maxWindowInstances;col++){
            let lateral=(col-(columns-1)*0.5)*(width/(columns+0.9));
            dummy.position.set(frontX+rightX*lateral,lift,frontZ+rightZ*lateral);
            dummy.rotation.set(0,yaw,0);
            dummy.scale.set(Math.max(0.7,width*0.1),0.85,0.16);
            dummy.updateMatrix();
            buildingWindows.setMatrixAt(windowUsed,dummy.matrix);
            windowUsed++;
          }
        }

        for(let sideSign of [-1,1]){
          let sideX=wx+rightX*(width*0.5+0.05)*sideSign;
          let sideZ=wz+rightZ*(width*0.5+0.05)*sideSign;
          for(let row=0;row<Math.min(rows,8) && windowUsed<maxWindowInstances;row++){
            let along=((row%3)-1)*depth*0.18;
            dummy.position.set(
              sideX+fwdX*along,
              wy+height*(0.2+(row+0.5)*(0.68/Math.min(rows,8))),
              sideZ+fwdZ*along
            );
            dummy.rotation.set(0,yaw+Math.PI*0.5,0);
            dummy.scale.set(Math.max(0.65,depth*0.09),0.78,0.16);
            dummy.updateMatrix();
            buildingWindows.setMatrixAt(windowUsed,dummy.matrix);
            windowUsed++;
          }
        }
      }else{
        for(let w=0;w<6 && windowUsed<maxWindowInstances;w++){
          let side=(w%2===0?-1:1);
          let row=(w<2?0:(w<4?1:2));
          let lift=height*(0.46+row*0.2);
          let lateral=(width*0.22)*side;
          dummy.position.set(
            frontX+rightX*lateral,
            wy+lift,
            frontZ+rightZ*lateral
          );
          dummy.rotation.set(0,yaw,0);
          dummy.scale.set(Math.max(0.9,width*0.13),1.1,0.2);
          dummy.updateMatrix();
          buildingWindows.setMatrixAt(windowUsed,dummy.matrix);
          windowUsed++;
        }

        // Side windows (two per side) to avoid flat facades.
        for(let sideSign of [-1,1]){
          for(let row=0;row<2 && windowUsed<maxWindowInstances;row++){
            let sideX=wx+rightX*(width*0.5+0.05)*sideSign;
            let sideZ=wz+rightZ*(width*0.5+0.05)*sideSign;
            let along=(row===0?-depth*0.18:depth*0.18);
            dummy.position.set(
              sideX+fwdX*along,
              wy+height*(0.52+row*0.18),
              sideZ+fwdZ*along
            );
            dummy.rotation.set(0,yaw+Math.PI*0.5,0);
            dummy.scale.set(Math.max(0.85,depth*0.11),0.95,0.2);
            dummy.updateMatrix();
            buildingWindows.setMatrixAt(windowUsed,dummy.matrix);
            windowUsed++;
          }
        }
      }

      if(!cityMode && chimneyUsed<maxBuildings){
        dummy.position.set(
          wx+rightX*(width*0.22)-fwdX*(depth*0.15),
          wy+height+roofHeight*0.7,
          wz+rightZ*(width*0.22)-fwdZ*(depth*0.15)
        );
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(0.6,1.6,0.6);
        dummy.updateMatrix();
        buildingChimneys.setMatrixAt(chimneyUsed,dummy.matrix);
        chimneyUsed++;
      }

      for(let k=windowStart;k<windowUsed;k++) buildingCollider.instances.push({mesh:buildingWindows,index:k});
      for(let k=doorStart;k<doorUsed;k++) buildingCollider.instances.push({mesh:buildingDoors,index:k});
      for(let k=chimneyStart;k<chimneyUsed;k++) buildingCollider.instances.push({mesh:buildingChimneys,index:k});
      for(let k=trimStart;k<trimUsed;k++) buildingCollider.instances.push({mesh:buildingTrims,index:k});
      for(let k=porchStart;k<porchUsed;k++) buildingCollider.instances.push({mesh:buildingPorches,index:k});
      colliders.push(buildingCollider);
      village.buildings.push(buildingCollider);

      placed.push({x:wx,z:wz,r:minGap*0.5});

      buildingUsed++;
    }
  }

  buildingBodies.count=buildingUsed;
  buildingRoofs.count=buildingUsed;
  buildingWindows.count=windowUsed;
  buildingDoors.count=doorUsed;
  buildingChimneys.count=chimneyUsed;
  buildingTrims.count=trimUsed;
  buildingPorches.count=porchUsed;
  villageWalls.count=wallUsed;
  cityStreets.count=streetUsed;
  buildingBodies.instanceMatrix.needsUpdate=true;
  buildingRoofs.instanceMatrix.needsUpdate=true;
  buildingWindows.instanceMatrix.needsUpdate=true;
  buildingDoors.instanceMatrix.needsUpdate=true;
  buildingChimneys.instanceMatrix.needsUpdate=true;
  buildingTrims.instanceMatrix.needsUpdate=true;
  buildingPorches.instanceMatrix.needsUpdate=true;
  villageWalls.instanceMatrix.needsUpdate=true;
  cityStreets.instanceMatrix.needsUpdate=true;
  freezeStaticObject(buildingBodies);
  freezeStaticObject(buildingRoofs);
  freezeStaticObject(buildingWindows);
  freezeStaticObject(buildingDoors);
  freezeStaticObject(buildingChimneys);
  freezeStaticObject(buildingTrims);
  freezeStaticObject(buildingPorches);
  freezeStaticObject(villageWalls);
  freezeStaticObject(cityStreets);
  scene.add(buildingBodies,buildingRoofs,buildingWindows,buildingDoors,buildingChimneys,buildingTrims,buildingPorches,villageWalls,cityStreets);

  return {land,road,water,trunks,crowns,pods,grasses,rocks,gravel,buildingBodies,buildingRoofs,buildingWindows,buildingDoors,buildingChimneys,buildingTrims,buildingPorches,villageWalls,cityStreets,villageCenters,colliders};
}

function updateChunksForCenters(centers){
  let chunkCenters=centers.map(center=>({
    cx:Math.floor(center.x/chunkSize),
    cz:Math.floor(center.z/chunkSize)
  }));

  neededChunks.clear();
  chunkQueue=[];
  let queuedChunks=new Set();

  function detailForDistanceSq(distanceSq){
    if(distanceSq<=8) return {treeDensity:1,partDensity:1,grassDensity:1};
    if(distanceSq<=24) return {treeDensity:0.58,partDensity:0.62,grassDensity:0.62};
    return {treeDensity:0.24,partDensity:0.42,grassDensity:0.34};
  }

  for(let center of chunkCenters){
    for(let x=-viewDistance;x<=viewDistance;x++){
      for(let z=-viewDistance;z<=viewDistance;z++){
        let cx=center.cx+x;
        let cz=center.cz+z;
        let key=chunkKey(cx,cz);
        let distanceSq=x*x+z*z;
        let currentDetail=chunkDetails.get(key);
        let nextDetail=detailForDistanceSq(distanceSq);
        let detailIncreased=!currentDetail
          || nextDetail.treeDensity>currentDetail.treeDensity
          || nextDetail.partDensity>currentDetail.partDensity
          || nextDetail.grassDensity>currentDetail.grassDensity;

        if(detailIncreased){
          chunkDetails.set(key,nextDetail);
          if(currentDetail && chunks.has(key)){
            removalQueue.push(chunks.get(key));
            chunks.delete(key);
          }
        }

        neededChunks.add(key);

        if(!chunks.has(key) && !queuedChunks.has(key)){
          queuedChunks.add(key);
          chunkQueue.push({cx,cz,key});
        }
      }
    }
  }

  chunkQueue.sort((a,b)=>{
    let ad=Infinity;
    let bd=Infinity;

    for(let center of chunkCenters){
      let adx=a.cx-center.cx;
      let adz=a.cz-center.cz;
      let bdx=b.cx-center.cx;
      let bdz=b.cz-center.cz;
      ad=Math.min(ad,adx*adx+adz*adz);
      bd=Math.min(bd,bdx*bdx+bdz*bdz);
    }

    return ad-bd;
  });

  for(let [key,chunk] of chunks){
    if(!neededChunks.has(key)){
      removalQueue.push(chunk);
      chunks.delete(key);
      chunkDetails.delete(key);
    }
  }
}

function updateChunks(px,pz){
  updateChunksForCenters([{x:px,z:pz}]);
}

function disposeChunk(chunk){
  let turretObjects=[];
  if(chunk.villageCenters){
    for(let village of chunk.villageCenters){
      if(!village.turrets) continue;
      for(let turret of village.turrets){
        if(turret.object) turretObjects.push(turret.object);
      }
    }
  }

  scene.remove(
    chunk.land,
    chunk.road,
    chunk.water,
    chunk.trunks,
    chunk.crowns,
    chunk.pods,
    chunk.grasses,
    chunk.rocks,
    chunk.gravel,
    chunk.buildingBodies,
    chunk.buildingRoofs,
    chunk.buildingWindows,
    chunk.buildingDoors,
    chunk.buildingChimneys,
    chunk.buildingTrims,
    chunk.buildingPorches,
    chunk.villageWalls,
    chunk.cityStreets,
    ...turretObjects
  );

  chunk.land.geometry.dispose();
  if(chunk.road.geometry) chunk.road.geometry.dispose();
  chunk.water.geometry.dispose();
  chunk.trunks.dispose();
  chunk.crowns.dispose();
  chunk.pods.dispose();
  chunk.grasses.dispose();
  chunk.rocks.dispose();
  if(chunk.gravel) chunk.gravel.dispose();
  chunk.buildingBodies.dispose();
  chunk.buildingRoofs.dispose();
  chunk.buildingWindows.dispose();
  chunk.buildingDoors.dispose();
  chunk.buildingChimneys.dispose();
  chunk.buildingTrims.dispose();
  chunk.buildingPorches.dispose();
  chunk.villageWalls.dispose();
  if(chunk.cityStreets) chunk.cityStreets.dispose();
}

function processChunkQueue(maxItems=1,immediate=false){
  let processed=0;

  while(chunkQueue.length>0 && processed<maxItems){
    let now=performance.now();
    if(!immediate && now-lastChunkBuildTime<35) return;
    lastChunkBuildTime=now;

    let item=chunkQueue.shift();

    if(!chunks.has(item.key)){
      chunks.set(item.key,makeChunk(item.cx,item.cz));
    }
    processed++;
  }

  while(removalQueue.length>0 && processed<maxItems){
    disposeChunk(removalQueue.shift());
    processed++;
  }
}

function updateWind(time,rainIntensity=0){
  if(!grassWindShader) return;
  let rain=Math.max(0,Math.min(1,rainIntensity));
  if(grassWindShader.uniforms.windTime) grassWindShader.uniforms.windTime.value=time*0.001*(1+rain*0.55);
  if(grassWindShader.uniforms.windStrength) grassWindShader.uniforms.windStrength.value=1+rain*2.4;
}

function resetChunks(){
  for(let chunk of chunks.values()){
    disposeChunk(chunk);
  }
  for(let chunk of removalQueue){
    disposeChunk(chunk);
  }
  chunks.clear();
  neededChunks.clear();
  chunkDetails.clear();
  chunkQueue=[];
  removalQueue=[];
  lastChunkBuildTime=0;
  clearBossBases();
}

  return {
    chunks,
    bossBases,
    collidesWithObstacles,
    obstacleAt,
    obstacleAlongSegment,
    obstacleAlongSegment3D,
    destroyObstacle,
    damageBossBase,
    isVillageCleared,
    placeTestBossBaseNearStart,
    clearBossBases,
    findCityDistrictNearRoad,
    updateChunks,
    updateChunksForCenters,
    updateWind,
    processChunkQueue,
    setEnvironment:applyEnvironment,
    resetChunks
  };
}
