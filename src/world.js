import { THREE } from "./three.js";
import { carRadius, chunkSize, segments, viewDistance } from "./constants.js";
import { groundHeight, rand, roadCenterX, roadDistance, roadHeight } from "./terrain.js";
import { makeGroundTexture } from "./textures.js";
import { makeSheep } from "./sheep.js";

export function createWorld(scene){
  let chunkQueue=[];
  let removalQueue=[];
  let neededChunks=new Set();
  let chunks=new Map();
  let gasStationTemplate=null;
  let garageTemplate=null;
  let lastChunkBuildTime=0;

  function setGasStationTemplate(template){
    gasStationTemplate=template;
  }

  function setGarageTemplate(template){
    garageTemplate=template;
  }

  function cloneGasStation(){
    if(!gasStationTemplate) return null;
    return gasStationTemplate.clone(true);
  }

  function cloneGarage(){
    if(!garageTemplate) return null;
    return garageTemplate.clone(true);
  }

let landMat=new THREE.MeshStandardMaterial({
  map:makeGroundTexture(),
  vertexColors:true,
  roughness:0.8
});

let waterMat=new THREE.MeshStandardMaterial({
  color:0x3366cc,
  transparent:true,
  opacity:.45
});

let barkMat=new THREE.MeshStandardMaterial({color:0x5a321b});
let leafMat=new THREE.MeshStandardMaterial({color:0x1f6b2a});
let grassMat=new THREE.MeshStandardMaterial({color:0x2f8f35});
let rockMat=new THREE.MeshStandardMaterial({color:0x777777,roughness:1});
let buildingWallMat=new THREE.MeshStandardMaterial({color:0xe3ded3,roughness:0.9,metalness:0.02});
let buildingRoofMat=new THREE.MeshStandardMaterial({color:0x9e3f32,roughness:0.92,metalness:0.01});
let windowMat=new THREE.MeshStandardMaterial({color:0xa9d8ff,emissive:0x1a2d40,emissiveIntensity:0.4,roughness:0.25});
let doorMat=new THREE.MeshStandardMaterial({color:0x5f3b23,roughness:0.9});
let chimneyMat=new THREE.MeshStandardMaterial({color:0x6f6a66,roughness:1});
let houseTrimMat=new THREE.MeshStandardMaterial({color:0xf2efe8,roughness:0.78});
let brickWallMat=new THREE.MeshStandardMaterial({color:0x9f4e3e,roughness:0.95});

let trunkGeo=new THREE.CylinderGeometry(.45,.85,9,7);
let crownGeo=new THREE.ConeGeometry(4.2,5.4,9);
let grassGeo=new THREE.ConeGeometry(.04,1.2,2);
let rockGeo=new THREE.DodecahedronGeometry(1,0);
let buildingGeo=new THREE.BoxGeometry(1,1,1);
let buildingRoofGeo=new THREE.CylinderGeometry(1.05,1.25,1,4);
let windowGeo=new THREE.BoxGeometry(1,1,1);
let doorGeo=new THREE.BoxGeometry(1,1,1);
let chimneyGeo=new THREE.BoxGeometry(1,1,1);
let trimGeo=new THREE.BoxGeometry(1,1,1);
let porchGeo=new THREE.BoxGeometry(1,1,1);
let brickWallGeo=new THREE.BoxGeometry(1,1,1);

function chunkKey(cx,cz){
  return cx+","+cz;
}

function collidesWithObstacles(x,z){
  let pcx=Math.floor(x/chunkSize);
  let pcz=Math.floor(z/chunkSize);

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.colliders) continue;

      for(let obstacle of chunk.colliders){
        let ox=obstacle.x;
        let oz=obstacle.z;
        let r=obstacle.r+carRadius;
        let dist=x-ox;
        let distz=z-oz;

        if(dist*dist+distz*distz<r*r) return true;
      }
    }
  }

  return false;
}

function roadYawAt(z){
  return Math.atan2(roadCenterX(z+18)-roadCenterX(z-18),36);
}

function makeGasStationSpawn(cx,cz){
  let chance=0.152;
  if(Math.abs(cx)%4!==1 || Math.abs(cz)%4!==2) return null;
  if((rand(cx*827,cz*463)*0.5+0.5)>chance) return null;

  let r01=(a,b)=>rand(a,b)*0.5+0.5;
  let z=cz*chunkSize+(r01(cx*311,cz*907)-0.5)*chunkSize*0.7;
  let yaw=roadYawAt(z);
  let side=r01(cx*541,cz*167)<0.5 ? -1 : 1;
  let offset=48;
  let x=roadCenterX(z)+Math.cos(yaw)*side*offset;
  let placeZ=z-Math.sin(yaw)*side*offset;
  let y=groundHeight(x,placeZ);

  if(y<-12 || y>24) return null;

  return {
    x,
    z:placeZ,
    y,
    yaw:yaw+(side>0 ? -Math.PI/2 : Math.PI/2),
    r:24
  };
}

function addGasStationToChunk(chunk){
  if(!gasStationTemplate || !chunk.gasStationSpawn || chunk.gasStationAdded) return;

  let spawn=chunk.gasStationSpawn;
  if(gasStationBlocked(spawn,chunk.colliders)){
    chunk.gasStationSpawn=null;
    chunk.gasStationAdded=true;
    return;
  }
  let station=cloneGasStation();
  if(!station) return;

  station.position.set(spawn.x,spawn.y,spawn.z);
  station.rotation.y=spawn.yaw;
  scene.add(station);

  chunk.gasStations.push(station);
  chunk.colliders.push({x:spawn.x,z:spawn.z,r:spawn.r});
  chunk.gasStationAdded=true;
}

function addGasStationsToExistingChunks(){
  for(let chunk of chunks.values()){
    addGasStationToChunk(chunk);
  }
}

function gasStationBlocked(spawn,colliders){
  for(let obstacle of colliders){
    let dx=spawn.x-obstacle.x;
    let dz=spawn.z-obstacle.z;
    let gap=spawn.r+obstacle.r+4;
    if(dx*dx+dz*dz<gap*gap) return true;
  }
  return false;
}

function makeGarageSpawn(cx,cz){
  let chance=0.13;
  if(Math.abs(cx)%5!==3 || Math.abs(cz)%5!==1) return null;
  if((rand(cx*619,cz*1249)*0.5+0.5)>chance) return null;

  let r01=(a,b)=>rand(a,b)*0.5+0.5;
  let z=cz*chunkSize+(r01(cx*947,cz*313)-0.5)*chunkSize*0.72;
  let yaw=roadYawAt(z);
  let side=r01(cx*149,cz*1051)<0.5 ? -1 : 1;
  let offset=42;
  let x=roadCenterX(z)+Math.cos(yaw)*side*offset;
  let placeZ=z-Math.sin(yaw)*side*offset;
  let y=groundHeight(x,placeZ);

  if(y<-12 || y>26) return null;

  return {
    x,
    z:placeZ,
    y,
    yaw:yaw+(side>0 ? -Math.PI/2 : Math.PI/2),
    r:17
  };
}

function addGarageToChunk(chunk){
  if(!garageTemplate || !chunk.garageSpawn || chunk.garageAdded) return;

  let spawn=chunk.garageSpawn;
  if(gasStationBlocked(spawn,chunk.colliders)){
    chunk.garageSpawn=null;
    chunk.garageAdded=true;
    return;
  }
  let garage=cloneGarage();
  if(!garage) return;

  garage.position.set(spawn.x,spawn.y,spawn.z);
  garage.rotation.y=spawn.yaw;
  scene.add(garage);

  chunk.garages.push(garage);
  chunk.colliders.push({x:spawn.x,z:spawn.z,r:spawn.r});
  chunk.garageAdded=true;
}

function addGaragesToExistingChunks(){
  for(let chunk of chunks.values()){
    addGarageToChunk(chunk);
  }
}

function makeChunk(cx,cz){
  let colors=[];
  let colliders=[];
  let sheep=[];
  let gasStations=[];
  let gasStationSpawn=makeGasStationSpawn(cx,cz);
  let gasStationAdded=false;
  let garages=[];
  let garageSpawn=makeGarageSpawn(cx,cz);
  let garageAdded=false;
  let geo=new THREE.PlaneGeometry(chunkSize,chunkSize,segments,segments);
  geo.rotateX(-Math.PI/2);

  let pos=geo.attributes.position;

  for(let i=0;i<pos.count;i++){
    let wx=pos.getX(i)+cx*chunkSize;
    let wz=pos.getZ(i)+cz*chunkSize;
    let h=groundHeight(wx,wz);

    let d=roadDistance(wx,wz);
    let shoulder=55;

    if(d<shoulder){
      let t=Math.min(1,d/shoulder);
      t=t*t*(3-2*t);

      let rh=roadHeight(wx,wz);
      h=rh*(1-t)+h*t;
    }

    pos.setY(i,h);

    let color=new THREE.Color();

    if(d<18) color.set(0x8b6f47);
    else if(h<-20) color.set(0xc2b280);
    else if(h<15) color.set(0x55aa44);
    else if(h<30) color.set(0x667744);
    else color.set(0x888888);

    colors.push(color.r,color.g,color.b);
  }

  geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();

  let land=new THREE.Mesh(geo,landMat);
  land.position.set(cx*chunkSize,0,cz*chunkSize);
  scene.add(land);

  let road=new THREE.Object3D();

  let water=new THREE.Mesh(
    new THREE.PlaneGeometry(chunkSize,chunkSize),
    waterMat
  );
  water.rotation.x=-Math.PI/2;
  water.position.set(cx*chunkSize,-20,cz*chunkSize);
  scene.add(water);

  let clusterCount=2;
  let treesPerCluster=8;
  let clusterRadius=25;
  let maxTrees=clusterCount*treesPerCluster;

  let trunks=new THREE.InstancedMesh(trunkGeo,barkMat,maxTrees);
  let crowns=new THREE.InstancedMesh(crownGeo,leafMat,maxTrees*5);

  let dummy=new THREE.Object3D();
  let treeUsed=0;
  let crownUsed=0;

  for(let c=0;c<clusterCount;c++){
    let crx=rand(cx*91+c,cz*37-c);
    let crz=rand(cx*53-c,cz*79+c);

    let centerX=cx*chunkSize+(crx-.5)*chunkSize;
    let centerZ=cz*chunkSize+(crz-.5)*chunkSize;
    let centerY=groundHeight(centerX,centerZ);

    if(centerY<-15 || centerY>32) continue;
    if(roadDistance(centerX,centerZ)<70) continue;

    colliders.push({x:centerX,z:centerZ,r:6});

    for(let i=0;i<treesPerCluster;i++){
      let a=rand(cx*999+c*17+i,cz*777-i)*Math.PI*2;
      let r=Math.pow(rand(cx*333+i,cz*555+c),.6)*clusterRadius;

      let wx=centerX+Math.cos(a)*r;
      let wz=centerZ+Math.sin(a)*r;
      let wy=groundHeight(wx,wz);

      if(wy<-15 || wy>32) continue;
      if(roadDistance(wx,wz)<45) continue;

      colliders.push({x:wx,z:wz,r:2.4});

      let scale=.55+rand(i+cx+c,cz-i)*.9;
      let rot=rand(i,cx+cz+c)*Math.PI*2;

      dummy.position.set(wx,wy+4.5*scale,wz);
      dummy.rotation.set(0,rot,0);
      dummy.scale.set(scale,scale,scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(treeUsed,dummy.matrix);

      for(let j=0;j<5;j++){
        let crownScale=scale*(1-j*.1);

        dummy.position.set(wx,wy+(7+j*2.1)*scale,wz);
        dummy.rotation.set(0,rot+rand(i+j,c)*Math.PI*2,0);
        dummy.scale.set(crownScale,scale,crownScale);
        dummy.updateMatrix();

        crowns.setMatrixAt(crownUsed,dummy.matrix);
        crownUsed++;
      }

      treeUsed++;
    }
  }

  trunks.count=treeUsed;
  crowns.count=crownUsed;
  trunks.instanceMatrix.needsUpdate=true;
  crowns.instanceMatrix.needsUpdate=true;
  scene.add(trunks,crowns);

  let grassClusterCount=20;
  let grassPerCluster=400;
  let grassClusterRadius=10;
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
  scene.add(grasses);

  let rockCount=30;
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

    colliders.push({x:wx,z:wz,r:2.1+scale*0.55});


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
  scene.add(rocks);

  let maxBuildings=120;
  let buildingBodies=new THREE.InstancedMesh(buildingGeo,buildingWallMat,maxBuildings);
  let buildingRoofs=new THREE.InstancedMesh(buildingRoofGeo,buildingRoofMat,maxBuildings);
  let buildingWindows=new THREE.InstancedMesh(windowGeo,windowMat,maxBuildings*8);
  let buildingDoors=new THREE.InstancedMesh(doorGeo,doorMat,maxBuildings);
  let buildingChimneys=new THREE.InstancedMesh(chimneyGeo,chimneyMat,maxBuildings);
  let buildingTrims=new THREE.InstancedMesh(trimGeo,houseTrimMat,maxBuildings*2);
  let buildingPorches=new THREE.InstancedMesh(porchGeo,houseTrimMat,maxBuildings);
  let villagesPerChunk=1;
  let villageSpawnChance=0.45;
  let villageWalls=new THREE.InstancedMesh(brickWallGeo,brickWallMat,villagesPerChunk*18);
  let buildingUsed=0;
  let windowUsed=0;
  let doorUsed=0;
  let chimneyUsed=0;
  let trimUsed=0;
  let porchUsed=0;
  let wallUsed=0;
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

    if(centerY<-12 || centerY>30) continue;
    if(centerRoadD<24) continue;

    villageCenters.push({x:centerX,z:centerZ,y:centerY});

    let housesInVillage=12+Math.floor(r01(cx+v*7,cz-v*5)*10);
    let villageRadius=20+(r01(cx-v*3,cz+v*9)*24);
    let placed=[];

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

      colliders.push({x:wx,z:wz,r:Math.max(1.2,segLen*0.32)});
    }

    for(let i=0;i<housesInVillage && buildingUsed<maxBuildings;i++){
      let angle=(i/housesInVillage)*Math.PI*2 + r01(i+v*31,cx-cz)*0.9;
      let dist=(0.2+r01(i+cx*3,cz+v)*0.8)*villageRadius;

      let wx=centerX+Math.cos(angle)*dist;
      let wz=centerZ+Math.sin(angle)*dist;
      let wy=groundHeight(wx,wz);
      let roadD=roadDistance(wx,wz);

      if(wy<-12 || wy>30) continue;
      if(roadD<20) continue;

      let width=8+r01(i+cx*5,cz+v*2)*8;
      let depth=8+r01(i+cz*6,cx-v*2)*8;
      let height=4.8+r01(cx-i,cz+i+v*17)*5.6;
      let minGap=Math.max(width,depth)*1.35;

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

      colliders.push({x:wx,z:wz,r:Math.max(width,depth)*0.62});

      let yaw=r01(i+v*13,cx-cz)*Math.PI*2;
      dummy.position.set(wx,wy+height*0.5,wz);
      dummy.rotation.set(0,yaw,0);
      dummy.scale.set(width,height,depth);
      dummy.updateMatrix();
      buildingBodies.setMatrixAt(buildingUsed,dummy.matrix);

      let roofHeight=1.4+r01(i+99+v,cx+cz)*1.3;
      let roofScale=Math.max(width,depth)*0.72;
      dummy.position.set(wx,wy+height+roofHeight*0.5,wz);
      dummy.rotation.set(0,yaw+Math.PI*0.25,0);
      dummy.scale.set(roofScale,roofHeight,roofScale);
      dummy.updateMatrix();
      buildingRoofs.setMatrixAt(buildingUsed,dummy.matrix);

      // Details: front door, four windows, and a roof chimney.
      let fwdX=Math.sin(yaw),fwdZ=Math.cos(yaw);
      let rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);
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

      if(porchUsed<maxBuildings){
        dummy.position.set(frontX,wy+0.25,frontZ);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(Math.max(1.8,width*0.3),0.45,1.1);
        dummy.updateMatrix();
        buildingPorches.setMatrixAt(porchUsed,dummy.matrix);
        porchUsed++;
      }

      if(trimUsed<maxBuildings*2){
        dummy.position.set(wx,wy+height+0.05,wz);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(width*1.02,0.24,depth*1.02);
        dummy.updateMatrix();
        buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
        trimUsed++;
      }
      if(trimUsed<maxBuildings*2){
        dummy.position.set(wx,wy+0.35,wz);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(width*1.03,0.24,depth*1.03);
        dummy.updateMatrix();
        buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
        trimUsed++;
      }

      for(let w=0;w<6 && windowUsed<maxBuildings*8;w++){
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
        for(let row=0;row<2 && windowUsed<maxBuildings*8;row++){
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

      if(chimneyUsed<maxBuildings){
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
  buildingBodies.instanceMatrix.needsUpdate=true;
  buildingRoofs.instanceMatrix.needsUpdate=true;
  buildingWindows.instanceMatrix.needsUpdate=true;
  buildingDoors.instanceMatrix.needsUpdate=true;
  buildingChimneys.instanceMatrix.needsUpdate=true;
  buildingTrims.instanceMatrix.needsUpdate=true;
  buildingPorches.instanceMatrix.needsUpdate=true;
  villageWalls.instanceMatrix.needsUpdate=true;
  scene.add(buildingBodies,buildingRoofs,buildingWindows,buildingDoors,buildingChimneys,buildingTrims,buildingPorches,villageWalls);

  if(gasStationTemplate && gasStationSpawn && !gasStationBlocked(gasStationSpawn,colliders)){
    let station=cloneGasStation();
    if(station){
      station.position.set(gasStationSpawn.x,gasStationSpawn.y,gasStationSpawn.z);
      station.rotation.y=gasStationSpawn.yaw;
      scene.add(station);
      gasStations.push(station);
      colliders.push({x:gasStationSpawn.x,z:gasStationSpawn.z,r:gasStationSpawn.r});
      gasStationAdded=true;
    }
  }else if(gasStationTemplate && gasStationSpawn){
    gasStationSpawn=null;
    gasStationAdded=true;
  }

  if(garageTemplate && garageSpawn && !gasStationBlocked(garageSpawn,colliders)){
    let garage=cloneGarage();
    if(garage){
      garage.position.set(garageSpawn.x,garageSpawn.y,garageSpawn.z);
      garage.rotation.y=garageSpawn.yaw;
      scene.add(garage);
      garages.push(garage);
      colliders.push({x:garageSpawn.x,z:garageSpawn.z,r:garageSpawn.r});
      garageAdded=true;
    }
  }else if(garageTemplate && garageSpawn){
    garageSpawn=null;
    garageAdded=true;
  }

  let herdChance=0.18;
  if((rand(cx*421,cz*733)*0.5+0.5)<herdChance){
    let herdRand=(a,b)=>rand(a,b)*0.5+0.5;
    let centerZ=cz*chunkSize+(herdRand(cx*617,cz*1543)-.5)*chunkSize*0.78;
    let side=herdRand(cx*271,cz*643)<0.5 ? -1 : 1;
    let offset=58+herdRand(cx*1201,cz*811)*86;
    let centerX=roadCenterX(centerZ)+side*offset;
    let centerY=groundHeight(centerX,centerZ);
    if(centerY<-12 || centerY>28){
      centerX=roadCenterX(centerZ)-side*offset;
      centerY=groundHeight(centerX,centerZ);
    }
    let herdSize=2+Math.floor(herdRand(cx*991,cz*379)*3);
    let herdHeading=herdRand(cx*233,cz*887)*Math.PI*2;

    if(centerY<-12 || centerY>28 || roadDistance(centerX,centerZ)<52){
      herdSize=0;
    }

    for(let i=0;i<herdSize;i++){
      let angle=herdRand(cx*1709+i*31,cz*1301-i*17)*Math.PI*2;
      let radius=Math.sqrt(herdRand(cx*1877-i*11,cz*2221+i*13))*20;
      let wx=centerX+Math.cos(angle)*radius;
      let wz=centerZ+Math.sin(angle)*radius;
      let wy=groundHeight(wx,wz);

      if(wy<-12 || wy>28) continue;
      if(roadDistance(wx,wz)<42) continue;
      let blocked=false;
      for(let obstacle of colliders){
        let dx=wx-obstacle.x;
        let dz=wz-obstacle.z;
        let gap=obstacle.r+3.5;
        if(dx*dx+dz*dz<gap*gap){
          blocked=true;
          break;
        }
      }
      if(blocked) continue;

      let collider={x:wx,z:wz,r:0.95};
      let animal=makeSheep(wx,wz,cx*10000+cz*97+i*31,collider);
      collider.r=animal.userData.size*1.55;
      animal.userData.centerX=centerX;
      animal.userData.centerZ=centerZ;
      animal.userData.angle=herdHeading+(herdRand(cx*307+i*7,cz*509-i*5)-0.5)*0.5;
      animal.userData.targetAngle=animal.userData.angle;
      animal.userData.roamRadius=34+herdSize*4;
      animal.rotation.y=animal.userData.angle-Math.PI/2;
      sheep.push(animal);
      colliders.push(collider);
      scene.add(animal);
    }
  }

  return {land,road,water,trunks,crowns,grasses,rocks,buildingBodies,buildingRoofs,buildingWindows,buildingDoors,buildingChimneys,buildingTrims,buildingPorches,villageWalls,gasStations,gasStationSpawn,gasStationAdded,garages,garageSpawn,garageAdded,sheep,colliders};
}

function updateChunksForCenters(centers){
  let chunkCenters=centers.map(center=>({
    cx:Math.floor(center.x/chunkSize),
    cz:Math.floor(center.z/chunkSize)
  }));

  neededChunks.clear();
  chunkQueue=[];
  let queuedChunks=new Set();

  for(let center of chunkCenters){
    for(let x=-viewDistance;x<=viewDistance;x++){
      for(let z=-viewDistance;z<=viewDistance;z++){
        let cx=center.cx+x;
        let cz=center.cz+z;
        let key=chunkKey(cx,cz);

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
    }
  }
}

function updateChunks(px,pz){
  updateChunksForCenters([{x:px,z:pz}]);
}

function disposeChunk(chunk){
  scene.remove(
    chunk.land,
    chunk.road,
    chunk.water,
    chunk.trunks,
    chunk.crowns,
    chunk.grasses,
    chunk.rocks,
    chunk.buildingBodies,
    chunk.buildingRoofs,
    chunk.buildingWindows,
    chunk.buildingDoors,
    chunk.buildingChimneys,
    chunk.buildingTrims,
    chunk.buildingPorches,
    chunk.villageWalls,
    ...chunk.gasStations,
    ...chunk.garages,
    ...chunk.sheep
  );

  chunk.land.geometry.dispose();
  if(chunk.road.geometry) chunk.road.geometry.dispose();
  chunk.water.geometry.dispose();
  chunk.trunks.dispose();
  chunk.crowns.dispose();
  chunk.grasses.dispose();
  chunk.rocks.dispose();
  chunk.buildingBodies.dispose();
  chunk.buildingRoofs.dispose();
  chunk.buildingWindows.dispose();
  chunk.buildingDoors.dispose();
  chunk.buildingChimneys.dispose();
  chunk.buildingTrims.dispose();
  chunk.buildingPorches.dispose();
  chunk.villageWalls.dispose();
}

function processChunkQueue(){
  if(chunkQueue.length>0){
    let now=performance.now();
    if(now-lastChunkBuildTime<35) return;
    lastChunkBuildTime=now;

    let item=chunkQueue.shift();

    if(!chunks.has(item.key)){
      chunks.set(item.key,makeChunk(item.cx,item.cz));
    }
    return;
  }

  if(removalQueue.length>0) disposeChunk(removalQueue.shift());
}

  return {
    chunks,
    setGasStationTemplate,
    setGarageTemplate,
    addGasStationsToExistingChunks,
    addGaragesToExistingChunks,
    collidesWithObstacles,
    updateChunks,
    updateChunksForCenters,
    processChunkQueue
  };
}
