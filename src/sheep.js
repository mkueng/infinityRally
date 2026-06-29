import { THREE } from "./three.js";
import { groundHeight, rand, roadDistance } from "./terrain.js?v=no-ramps";

let sheepCoreGeo=new THREE.CapsuleGeometry(0.55,1.35,8,18);
let sheepWoolGeo=new THREE.SphereGeometry(0.42,12,8);
let sheepHeadGeo=new THREE.SphereGeometry(0.34,14,10);
let sheepMuzzleGeo=new THREE.SphereGeometry(0.18,10,8);
let sheepLegGeo=new THREE.CylinderGeometry(0.07,0.12,0.78,7);
let sheepEarGeo=new THREE.ConeGeometry(0.1,0.34,6);
let sheepTailGeo=new THREE.SphereGeometry(0.16,8,6);
let sheepHornGeo=new THREE.ConeGeometry(0.08,0.42,7);
let sheepEyeGeo=new THREE.SphereGeometry(0.055,8,6);
let sheepWoolMat=new THREE.MeshStandardMaterial({color:0x86ffe6,emissive:0x0a7f72,emissiveIntensity:0.24,roughness:0.82});
let sheepWoolShadowMat=new THREE.MeshStandardMaterial({color:0x5b65b7,emissive:0x171b5f,emissiveIntensity:0.22,roughness:0.88});
let sheepFaceMat=new THREE.MeshStandardMaterial({color:0x29164d,emissive:0x100625,emissiveIntensity:0.18,roughness:0.78});
let sheepNoseMat=new THREE.MeshStandardMaterial({color:0xff6bcf,emissive:0xa81478,emissiveIntensity:0.45,roughness:0.6});
let sheepEyeMat=new THREE.MeshStandardMaterial({color:0xf7ff87,emissive:0xeaff2f,emissiveIntensity:1.1,roughness:0.3});
let sheepHornMat=new THREE.MeshStandardMaterial({color:0xb66cff,emissive:0x4d22a8,emissiveIntensity:0.35,roughness:0.62});

function makeSheepModel(seed){
  let sheep=new THREE.Group();

  let core=new THREE.Mesh(sheepCoreGeo,sheepWoolShadowMat);
  core.rotation.z=Math.PI/2;
  core.scale.set(1.16,0.96,0.86);
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
    puff.scale.set(woolPuffs[i][3]*0.86,woolPuffs[i][4]*0.72,woolPuffs[i][5]*1.12);
    sheep.add(puff);
  }

  let headGroup=new THREE.Group();
  headGroup.position.set(1.36,1.04,0);
  sheep.add(headGroup);

  let head=new THREE.Mesh(sheepHeadGeo,sheepFaceMat);
  head.scale.set(0.78,1.12,0.72);
  headGroup.add(head);

  let forehead=new THREE.Mesh(sheepWoolGeo,sheepWoolMat);
  forehead.position.set(-0.12,0.31,0);
  forehead.scale.set(0.42,0.26,0.36);
  headGroup.add(forehead);

  let muzzle=new THREE.Mesh(sheepMuzzleGeo,sheepNoseMat);
  muzzle.position.set(0.31,-0.08,0);
  muzzle.scale.set(0.92,0.55,0.66);
  headGroup.add(muzzle);

  for(let side of [-1,1]){
    let ear=new THREE.Mesh(sheepEarGeo,sheepFaceMat);
    ear.rotation.x=side*Math.PI*0.56;
    ear.rotation.z=-Math.PI*0.38;
    ear.position.set(-0.1,0.13,side*0.33);
    headGroup.add(ear);

    let horn=new THREE.Mesh(sheepHornGeo,sheepHornMat);
    horn.rotation.z=-Math.PI*0.25;
    horn.rotation.x=side*Math.PI*0.18;
    horn.position.set(-0.05,0.32,side*0.18);
    headGroup.add(horn);

    let eye=new THREE.Mesh(sheepEyeGeo,sheepEyeMat);
    eye.position.set(0.22,0.04,side*0.24);
    eye.scale.set(1.25,1,1);
    headGroup.add(eye);
  }

  let legs=[];
  for(let x of [-0.72,-0.05,0.62]){
    for(let z of [-0.32,0.32]){
      let leg=new THREE.Mesh(sheepLegGeo,sheepFaceMat);
      leg.position.set(x,0.34,z);
      leg.rotation.z=(x<0 ? -0.08 : 0.08);
      sheep.add(leg);
      legs.push(leg);
    }
  }

  let tail=new THREE.Mesh(sheepTailGeo,sheepNoseMat);
  tail.position.set(-1.26,1.08,0);
  tail.scale.set(0.72,0.72,0.72);
  sheep.add(tail);

  for(let i=0;i<3;i++){
    let spine=new THREE.Mesh(sheepHornGeo,sheepHornMat);
    spine.position.set(-0.56+i*0.46,1.66-i*0.03,0);
    spine.rotation.z=Math.PI;
    spine.scale.set(1.0-i*0.12,0.8-i*0.08,1.0-i*0.12);
    sheep.add(spine);
  }

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
    targetAngle:angle,
    turnEase:0.018+(rand(seed+37,seed+61)*0.5+0.5)*0.018,
    speed:0,
    targetSpeed:0.018+(rand(seed+23,seed-11)*0.5+0.5)*0.024,
    baseSpeed:0.018+(rand(seed+23,seed-11)*0.5+0.5)*0.024,
    phase:(rand(seed-31,seed+5)*0.5+0.5)*Math.PI*2,
    roamRadius:38+(rand(seed+7,seed+19)*0.5+0.5)*48,
    lineTimer:170+(rand(seed+13,seed+71)*0.5+0.5)*230,
    grazeTimer:160+(rand(seed+41,seed-29)*0.5+0.5)*300,
    grazeDuration:120+(rand(seed+83,seed-47)*0.5+0.5)*190,
    bobOffset:(rand(seed+17,seed+89)*0.5+0.5)*Math.PI*2,
    collider
  };
  return sheep;
}

function normalizeAngle(angle){
  while(angle>Math.PI) angle-=Math.PI*2;
  while(angle<-Math.PI) angle+=Math.PI*2;
  return angle;
}

export function updateSheep(chunks){
  for(let chunk of chunks.values()){
    if(!chunk.sheep) continue;

    for(let sheep of chunk.sheep){
      let data=sheep.userData;
      data.phase+=0.036+data.speed*0.9;
      data.grazeTimer-=1;
      data.lineTimer-=1;

      let x=sheep.position.x;
      let z=sheep.position.z;
      let dx=x-data.centerX;
      let dz=z-data.centerZ;
      let dist=Math.sqrt(dx*dx+dz*dz);
      let roadD=roadDistance(x,z);
      let grazing=data.grazeTimer<0;

      if(data.grazeTimer<-data.grazeDuration){
        grazing=false;
        data.grazeTimer=190+(rand(data.seed+data.phase,data.seed-3)*0.5+0.5)*360;
        data.grazeDuration=120+(rand(data.seed-data.phase,data.seed+43)*0.5+0.5)*210;
        data.lineTimer=120+(rand(data.seed-data.phase,data.seed+11)*0.5+0.5)*230;
        data.targetAngle+=((rand(data.seed+data.phase,data.seed+29)*0.5+0.5)-0.5)*Math.PI*0.8;
      }

      if(!grazing && (data.lineTimer<=0 || dist>data.roamRadius || roadD<42)){
        if(dist>data.roamRadius || roadD<42){
          data.targetAngle=Math.atan2(data.centerX-x,data.centerZ-z)
            + ((rand(data.seed+data.phase,data.seed+19)*0.5+0.5)-0.5)*0.45;
        }else{
          data.targetAngle+=((rand(data.seed+data.phase,data.seed-17)*0.5+0.5)-0.5)*Math.PI*0.72;
        }
        data.lineTimer=115+(rand(data.seed-data.phase,data.seed+53)*0.5+0.5)*260;
      }

      data.targetSpeed=grazing
        ? 0
        : data.baseSpeed*(0.72+Math.sin(data.phase*0.27+data.bobOffset)*0.18);
      data.speed+=(data.targetSpeed-data.speed)*0.045;

      let turnNoise=Math.sin(data.phase*0.19+data.seed)*0.012;
      data.angle+=normalizeAngle(data.targetAngle-data.angle)*(grazing ? 0.006 : data.turnEase)+turnNoise;

      let moveSpeed=data.speed;
      let nextX=x+Math.sin(data.angle)*moveSpeed;
      let nextZ=z+Math.cos(data.angle)*moveSpeed;
      let nextY=groundHeight(nextX,nextZ);

      if(nextY<-15 || nextY>30 || roadDistance(nextX,nextZ)<35){
        data.targetAngle=data.angle+Math.PI*0.68+((rand(data.seed+data.phase,data.seed+91)*0.5+0.5)-0.5)*0.55;
        data.speed*=0.25;
        data.lineTimer=100+(rand(data.seed+data.phase,data.seed+91)*0.5+0.5)*180;
        nextX=x;
        nextZ=z;
        nextY=groundHeight(x,z);
      }

      sheep.position.set(nextX,nextY,nextZ);
      sheep.rotation.y+=(normalizeAngle(data.angle-Math.PI/2-sheep.rotation.y))*0.12;
      sheep.rotation.z=Math.sin(data.phase*0.32+data.bobOffset)*0.015*(!grazing ? 1 : 0.35);
      sheep.rotation.x=Math.sin(data.phase*0.21+data.bobOffset)*0.012*(!grazing ? 1 : 0.25);

      if(data.head){
        data.head.rotation.z+=((grazing ? -0.58 : Math.sin(data.phase*0.08+data.bobOffset)*0.08)-data.head.rotation.z)*0.08;
        data.head.rotation.y=Math.sin(data.phase*0.11+data.bobOffset)*0.08;
      }

      if(data.legs){
        for(let i=0;i<data.legs.length;i++){
          data.legs[i].rotation.z=grazing ? 0 : Math.sin(data.phase*1.9+i*Math.PI+data.bobOffset)*0.18;
          data.legs[i].rotation.x=grazing ? 0 : Math.sin(data.phase*1.9+i*Math.PI*0.7)*0.05;
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
