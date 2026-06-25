import { THREE } from "./three.js";
import { groundHeight, rand, roadDistance } from "./terrain.js";

let sheepCoreGeo=new THREE.CapsuleGeometry(0.55,1.35,8,18);
let sheepWoolGeo=new THREE.SphereGeometry(0.42,12,8);
let sheepHeadGeo=new THREE.SphereGeometry(0.34,14,10);
let sheepMuzzleGeo=new THREE.SphereGeometry(0.18,10,8);
let sheepLegGeo=new THREE.CylinderGeometry(0.09,0.11,0.72,8);
let sheepEarGeo=new THREE.ConeGeometry(0.09,0.24,6);
let sheepTailGeo=new THREE.SphereGeometry(0.16,8,6);
let sheepWoolMat=new THREE.MeshStandardMaterial({color:0xf1eee2,roughness:0.96});
let sheepWoolShadowMat=new THREE.MeshStandardMaterial({color:0xd8d3c5,roughness:0.98});
let sheepFaceMat=new THREE.MeshStandardMaterial({color:0x1d1b18,roughness:0.9});
let sheepNoseMat=new THREE.MeshStandardMaterial({color:0x3a312b,roughness:0.92});

function makeSheepModel(seed){
  let sheep=new THREE.Group();

  let core=new THREE.Mesh(sheepCoreGeo,sheepWoolShadowMat);
  core.rotation.z=Math.PI/2;
  core.scale.set(1.08,1.05,0.9);
  core.position.y=0.95;
  sheep.add(core);

  let woolPuffs=[
    [-0.9,1.08,-0.28,0.82,0.7,0.7],
    [-0.45,1.22,-0.34,0.88,0.78,0.74],
    [0.02,1.25,-0.36,0.92,0.82,0.74],
    [0.5,1.2,-0.32,0.86,0.74,0.7],
    [0.92,1.04,-0.24,0.72,0.62,0.62],
    [-0.95,1.05,0.28,0.82,0.7,0.7],
    [-0.48,1.24,0.34,0.9,0.78,0.74],
    [0.02,1.3,0.36,0.94,0.84,0.76],
    [0.5,1.22,0.32,0.86,0.74,0.7],
    [0.92,1.04,0.24,0.72,0.62,0.62],
    [-0.45,1.48,0,0.86,0.62,0.72],
    [0.12,1.55,0,0.98,0.66,0.78],
    [0.7,1.38,0,0.78,0.58,0.66]
  ];

  for(let i=0;i<woolPuffs.length;i++){
    let puff=new THREE.Mesh(sheepWoolGeo,i%3===0 ? sheepWoolShadowMat : sheepWoolMat);
    let jitter=(rand(seed+i*19,seed-i*23)*0.5+0.5-0.5)*0.08;
    puff.position.set(woolPuffs[i][0]+jitter,woolPuffs[i][1],woolPuffs[i][2]-jitter);
    puff.scale.set(woolPuffs[i][3],woolPuffs[i][4],woolPuffs[i][5]);
    sheep.add(puff);
  }

  let headGroup=new THREE.Group();
  headGroup.position.set(1.34,1.0,0);
  sheep.add(headGroup);

  let head=new THREE.Mesh(sheepHeadGeo,sheepFaceMat);
  head.scale.set(0.82,1.02,0.78);
  headGroup.add(head);

  let forehead=new THREE.Mesh(sheepWoolGeo,sheepWoolMat);
  forehead.position.set(-0.12,0.28,0);
  forehead.scale.set(0.48,0.32,0.42);
  headGroup.add(forehead);

  let muzzle=new THREE.Mesh(sheepMuzzleGeo,sheepNoseMat);
  muzzle.position.set(0.29,-0.1,0);
  muzzle.scale.set(1.0,0.7,0.75);
  headGroup.add(muzzle);

  for(let side of [-1,1]){
    let ear=new THREE.Mesh(sheepEarGeo,sheepFaceMat);
    ear.rotation.x=side*Math.PI*0.52;
    ear.rotation.z=-Math.PI*0.48;
    ear.position.set(-0.04,0.1,side*0.34);
    headGroup.add(ear);
  }

  let legs=[];
  for(let x of [-0.65,0.62]){
    for(let z of [-0.3,0.3]){
      let leg=new THREE.Mesh(sheepLegGeo,sheepFaceMat);
      leg.position.set(x,0.34,z);
      sheep.add(leg);
      legs.push(leg);
    }
  }

  let tail=new THREE.Mesh(sheepTailGeo,sheepWoolMat);
  tail.position.set(-1.24,1.05,0);
  tail.scale.set(0.9,0.75,0.75);
  sheep.add(tail);

  sheep.userData.legs=legs;
  sheep.userData.head=headGroup;
  sheep.userData.tail=tail;
  let size=0.5+(rand(seed+101,seed-73)*0.5+0.5)*0.28;
  sheep.scale.set(size,size,size);
  sheep.userData.size=size;
  return sheep;
}

export function makeSheep(x,z,seed,collider){
  let sheep=makeSheepModel(seed);
  let y=groundHeight(x,z);
  let angle=(rand(seed,seed+17)*0.5+0.5)*Math.PI*2;
  sheep.position.set(x,y,z);
  sheep.rotation.y=angle-Math.PI/2;
  sheep.userData={
    ...sheep.userData,
    seed,
    centerX:x,
    centerZ:z,
    angle,
    speed:0.022+(rand(seed+23,seed-11)*0.5+0.5)*0.018,
    phase:(rand(seed-31,seed+5)*0.5+0.5)*Math.PI*2,
    roamRadius:38+(rand(seed+7,seed+19)*0.5+0.5)*48,
    lineTimer:170+(rand(seed+13,seed+71)*0.5+0.5)*230,
    grazeTimer:220+(rand(seed+41,seed-29)*0.5+0.5)*330,
    collider
  };
  return sheep;
}

export function updateSheep(chunks){
  for(let chunk of chunks.values()){
    if(!chunk.sheep) continue;

    for(let sheep of chunk.sheep){
      let data=sheep.userData;
      data.phase+=0.045;
      data.grazeTimer-=1;
      data.lineTimer-=1;

      let x=sheep.position.x;
      let z=sheep.position.z;
      let dx=x-data.centerX;
      let dz=z-data.centerZ;
      let dist=Math.sqrt(dx*dx+dz*dz);
      let roadD=roadDistance(x,z);
      let grazing=data.grazeTimer<0;

      if(data.grazeTimer<-170){
        grazing=false;
        data.grazeTimer=240+(rand(data.seed+data.phase,data.seed-3)*0.5+0.5)*340;
        data.lineTimer=170+(rand(data.seed-data.phase,data.seed+11)*0.5+0.5)*230;
        data.angle+=((rand(data.seed+data.phase,data.seed+29)*0.5+0.5)-0.5)*Math.PI*0.75;
      }

      if(!grazing && (data.lineTimer<=0 || dist>data.roamRadius || roadD<42)){
        if(dist>data.roamRadius || roadD<42){
          data.angle=Math.atan2(data.centerX-x,data.centerZ-z);
        }else{
          data.angle+=((rand(data.seed+data.phase,data.seed-17)*0.5+0.5)-0.5)*Math.PI*0.7;
        }
        data.lineTimer=160+(rand(data.seed-data.phase,data.seed+53)*0.5+0.5)*280;
      }

      let moveSpeed=grazing ? 0 : data.speed;
      let nextX=x+Math.sin(data.angle)*moveSpeed;
      let nextZ=z+Math.cos(data.angle)*moveSpeed;
      let nextY=groundHeight(nextX,nextZ);

      if(nextY<-15 || nextY>30 || roadDistance(nextX,nextZ)<35){
        data.angle+=Math.PI*0.74;
        data.lineTimer=140+(rand(data.seed+data.phase,data.seed+91)*0.5+0.5)*190;
        nextX=x;
        nextZ=z;
        nextY=groundHeight(x,z);
      }

      sheep.position.set(nextX,nextY,nextZ);
      sheep.rotation.y=data.angle-Math.PI/2;
      sheep.rotation.z=Math.sin(data.phase*0.32)*0.01;

      if(data.head){
        data.head.rotation.z=grazing ? -0.58 : Math.sin(data.phase*0.08)*0.04;
      }

      if(data.legs){
        for(let i=0;i<data.legs.length;i++){
          data.legs[i].rotation.z=grazing ? 0 : Math.sin(data.phase*1.5+i*Math.PI)*0.22;
        }
      }

      if(data.tail){
        data.tail.rotation.x=Math.sin(data.phase*0.35)*0.12;
      }

      if(data.collider){
        data.collider.x=nextX;
        data.collider.z=nextZ;
      }
    }
  }
}
