import { THREE } from "./three.js";
import { carRadius, chunkSize, segments, viewDistance } from "./constants.js";
import { groundHeight, rand, roadCenterX, roadDistance } from "./terrain.js?v=no-ramps";
import { makeGroundTexture } from "./textures.js?v=alien-planet";
import { makeSheep } from "./sheep.js";

export function createWorld(scene){
  let chunkQueue=[];
  let removalQueue=[];
  let neededChunks=new Set();
  let chunks=new Map();
  let lastChunkBuildTime=0;

let landMat=new THREE.MeshStandardMaterial({
  map:makeGroundTexture(),
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
  grassWindShader=shader;
  shader.vertexShader=shader.vertexShader.replace(
    "#include <common>",
    [
      "#include <common>",
      "uniform float windTime;"
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
      "float gust=0.18+sin(windTime*1.35)*0.07+sin(windTime*2.1)*0.035;",
      "float windBend=bladeHeight*bladeHeight*gust;",
      "transformed+=windLocal*windBend;"
    ].join("\n")
  );
};
let rockMat=new THREE.MeshStandardMaterial({color:0x3f334b,roughness:1,metalness:0.12});
let buildingWallMat=new THREE.MeshStandardMaterial({color:0x5a526d,roughness:0.9,metalness:0.16});
let buildingRoofMat=new THREE.MeshStandardMaterial({color:0x322b45,roughness:0.92,metalness:0.18});
let windowMat=new THREE.MeshStandardMaterial({color:0x8dfff2,emissive:0x0bd1c4,emissiveIntensity:0.72,roughness:0.18});
let doorMat=new THREE.MeshStandardMaterial({color:0x241b2b,roughness:0.9,metalness:0.08});
let chimneyMat=new THREE.MeshStandardMaterial({color:0x494058,roughness:1,metalness:0.12});
let houseTrimMat=new THREE.MeshStandardMaterial({color:0xa78fbd,roughness:0.78,metalness:0.08});
let brickWallMat=new THREE.MeshStandardMaterial({color:0x714060,roughness:0.95,metalness:0.05});

let trunkGeo=new THREE.CylinderGeometry(.28,1.08,10.5,6);
let crownGeo=new THREE.IcosahedronGeometry(2.35,1);
let podGeo=new THREE.SphereGeometry(.72,8,6);
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

let hiddenInstanceMatrix=new THREE.Matrix4().makeScale(0,0,0);

function hideInstance(mesh,index){
  if(!mesh || index==null || index<0) return;
  mesh.setMatrixAt(index,hiddenInstanceMatrix);
  mesh.instanceMatrix.needsUpdate=true;
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
  let pcx=Math.floor(toX/chunkSize);
  let pcz=Math.floor(toZ/chunkSize);
  let sx=toX-fromX;
  let sy=toY-fromY;
  let sz=toZ-fromZ;
  let segLenSq=Math.max(0.0001,sx*sx+sy*sy+sz*sz);
  let best=null;
  let bestDist=Infinity;

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.colliders) continue;

      for(let obstacle of chunk.colliders){
        if(obstacle.destroyed || obstacle.type==="treeCluster") continue;

        let obstacleY=groundHeight(obstacle.x,obstacle.z)+Math.max(0.6,obstacle.r*0.45);
        let t=((obstacle.x-fromX)*sx+(obstacleY-fromY)*sy+(obstacle.z-fromZ)*sz)/segLenSq;
        t=Math.max(0,Math.min(1,t));

        let cx=fromX+sx*t;
        let cy=fromY+sy*t;
        let cz=fromZ+sz*t;
        let radius=Math.max(1.2,obstacle.r*0.72)+padding;
        let verticalRadius=Math.max(1.0,obstacle.r*0.65)+padding;
        let distSq=(cx-obstacle.x)*(cx-obstacle.x)
          + ((cy-obstacleY)/Math.max(0.001,verticalRadius/radius))*((cy-obstacleY)/Math.max(0.001,verticalRadius/radius))
          + (cz-obstacle.z)*(cz-obstacle.z);

        if(distSq<radius*radius && distSq<bestDist){
          best=obstacle;
          bestDist=distSq;
        }
      }
    }
  }

  return best;
}

function destroyObstacle(obstacle){
  if(!obstacle || obstacle.destroyed) return false;
  obstacle.destroyed=true;

  if(obstacle.instances){
    for(let item of obstacle.instances){
      hideInstance(item.mesh,item.index);
    }
  }

  return true;
}

function makeChunk(cx,cz){
  let colors=[];
  let colliders=[];
  let sheep=[];
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

    if(h<-20) color.set(0x8f5a6c);
    else if(h<15) color.set(0x8b3852);
    else if(h<30) color.set(0x5a3b70);
    else color.set(0x3f3456);

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
  water.position.set(cx*chunkSize,waterLevel,cz*chunkSize);
  water.renderOrder=2;
  scene.add(water);

  let clusterCount=2;
  let treesPerCluster=8;
  let clusterRadius=25;
  let maxTrees=clusterCount*treesPerCluster;

  let trunks=new THREE.InstancedMesh(trunkGeo,barkMat,maxTrees);
  let crowns=new THREE.InstancedMesh(crownGeo,leafMat,maxTrees*7);
  let pods=new THREE.InstancedMesh(podGeo,podMat,maxTrees*4);

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

      let treeCollider={x:wx,z:wz,r:2.4,type:"tree",instances:[]};
      colliders.push(treeCollider);

      let scale=.55+rand(i+cx+c,cz-i)*.9;
      let rot=rand(i,cx+cz+c)*Math.PI*2;
      let leanX=(rand(cx*13+i,cz*19+c)-0.5)*0.18;
      let leanZ=(rand(cx*23-i,cz*29-c)-0.5)*0.18;
      let trunkHeightScale=1+rand(cx*31+i,cz*41-c)*0.34;
      let trunkWidthScale=0.72+rand(cx*43-i,cz*47+c)*0.34;

      dummy.position.set(wx,wy+5.25*scale*trunkHeightScale,wz);
      dummy.rotation.set(leanX,rot,leanZ);
      dummy.scale.set(scale*trunkWidthScale,scale*trunkHeightScale,scale*trunkWidthScale);
      dummy.updateMatrix();
      trunks.setMatrixAt(treeUsed,dummy.matrix);
      treeCollider.instances.push({mesh:trunks,index:treeUsed});

      let crownStart=crownUsed;
      for(let j=0;j<7;j++){
        let crownScale=scale*(1.25-j*.08);
        let angle=rot+j*2.38+rand(i+j*11,c*17)*0.9;
        let radius=j===0 ? 0 : (1.1+rand(i*7+j,cx-cz)*2.4)*scale;
        let lift=(9.1+Math.sin(j*1.7)*0.8+j*0.28)*scale*trunkHeightScale;

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
          crownScale*(0.95+rand(j+cx,i)*0.45),
          crownScale*(0.48+rand(j+cz,i+c)*0.34),
          crownScale*(0.9+rand(j-cx,i-c)*0.5)
        );
        dummy.updateMatrix();

        crowns.setMatrixAt(crownUsed,dummy.matrix);
        crownUsed++;
      }

      for(let k=crownStart;k<crownUsed;k++){
        treeCollider.instances.push({mesh:crowns,index:k});
      }

      let podStart=podUsed;
      for(let j=0;j<4;j++){
        let podScale=scale*(0.42+rand(i*19+j,cx+cz)*0.34);
        let angle=rot+j*Math.PI*0.5+rand(c*29+j,i)*0.65;
        let radius=(1.4+rand(i*31-j,cz)*1.8)*scale;

        dummy.position.set(
          wx+Math.cos(angle)*radius,
          wy+(7.1+rand(j+cx,c-i)*1.6)*scale*trunkHeightScale,
          wz+Math.sin(angle)*radius
        );
        dummy.rotation.set(0,angle,0);
        dummy.scale.set(podScale,podScale*1.35,podScale);
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
  scene.add(trunks,crowns,pods);

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

    colliders.push({
      x:wx,
      z:wz,
      r:2.1+scale*0.55,
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

    let housesInVillage=12+Math.floor(r01(cx+v*7,cz-v*5)*10);
    let villageRadius=20+(r01(cx-v*3,cz+v*9)*24);
    villageCenters.push({x:centerX,z:centerZ,y:centerY,r:villageRadius});
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

      colliders.push({x:wx,z:wz,r:Math.max(1.2,segLen*0.32),type:"wall",instances:[{mesh:villageWalls,index:wallUsed-1}]});
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

      let buildingCollider={x:wx,z:wz,r:Math.max(width,depth)*0.78,type:"building",instances:[]};
      let buildingIndex=buildingUsed;
      let windowStart=windowUsed;
      let doorStart=doorUsed;
      let chimneyStart=chimneyUsed;
      let trimStart=trimUsed;
      let porchStart=porchUsed;

      let yaw=r01(i+v*13,cx-cz)*Math.PI*2;
      dummy.position.set(wx,wy+height*0.5,wz);
      dummy.rotation.set(0,yaw,0);
      dummy.scale.set(width,height,depth);
      dummy.updateMatrix();
      buildingBodies.setMatrixAt(buildingUsed,dummy.matrix);
      buildingCollider.instances.push({mesh:buildingBodies,index:buildingIndex});

      let roofHeight=1.4+r01(i+99+v,cx+cz)*1.3;
      let roofScale=Math.max(width,depth)*0.72;
      dummy.position.set(wx,wy+height+roofHeight*0.5,wz);
      dummy.rotation.set(0,yaw+Math.PI*0.25,0);
      dummy.scale.set(roofScale,roofHeight,roofScale);
      dummy.updateMatrix();
      buildingRoofs.setMatrixAt(buildingUsed,dummy.matrix);
      buildingCollider.instances.push({mesh:buildingRoofs,index:buildingIndex});

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

      for(let k=windowStart;k<windowUsed;k++) buildingCollider.instances.push({mesh:buildingWindows,index:k});
      for(let k=doorStart;k<doorUsed;k++) buildingCollider.instances.push({mesh:buildingDoors,index:k});
      for(let k=chimneyStart;k<chimneyUsed;k++) buildingCollider.instances.push({mesh:buildingChimneys,index:k});
      for(let k=trimStart;k<trimUsed;k++) buildingCollider.instances.push({mesh:buildingTrims,index:k});
      for(let k=porchStart;k<porchUsed;k++) buildingCollider.instances.push({mesh:buildingPorches,index:k});
      colliders.push(buildingCollider);

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

      let collider={x:wx,z:wz,r:1.85,type:"sheep"};
      let animal=makeSheep(wx,wz,cx*10000+cz*97+i*31,collider);
      collider.r=Math.max(1.85,animal.userData.size*2.2);
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

  return {land,road,water,trunks,crowns,pods,grasses,rocks,buildingBodies,buildingRoofs,buildingWindows,buildingDoors,buildingChimneys,buildingTrims,buildingPorches,villageWalls,villageCenters,sheep,colliders};
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
    chunk.pods,
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
    ...chunk.sheep
  );

  chunk.land.geometry.dispose();
  if(chunk.road.geometry) chunk.road.geometry.dispose();
  chunk.water.geometry.dispose();
  chunk.trunks.dispose();
  chunk.crowns.dispose();
  chunk.pods.dispose();
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

function updateWind(time){
  if(grassWindShader) grassWindShader.uniforms.windTime.value=time*0.001;
}

  return {
    chunks,
    collidesWithObstacles,
    obstacleAt,
    obstacleAlongSegment,
    obstacleAlongSegment3D,
    destroyObstacle,
    updateChunks,
    updateChunksForCenters,
    updateWind,
    processChunkQueue
  };
}
