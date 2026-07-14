import { chunkSize } from "./constants.js";
import { groundHeight, rand, roadDistance, setWorldSeed } from "./terrain.js?v=no-ramps";

const waterLevel=-20;
let terrainLocalX=null;
let terrainLocalZ=null;

function r01(a,b){
  return rand(a,b)*0.5+0.5;
}

function colorComponents(hex){
  let value=Number.isFinite(hex) ? hex : 0;
  return [
    ((value>>16)&255)/255,
    ((value>>8)&255)/255,
    (value&255)/255
  ];
}

function writeColor(colors,index,base,target=null,amount=0){
  let offset=index*3;
  if(target){
    let t=Math.max(0,Math.min(1,amount));
    colors[offset]=base[0]+(target[0]-base[0])*t;
    colors[offset+1]=base[1]+(target[1]-base[1])*t;
    colors[offset+2]=base[2]+(target[2]-base[2])*t;
  }else{
    colors[offset]=base[0];
    colors[offset+1]=base[1];
    colors[offset+2]=base[2];
  }
}

function terrainPatchOk(x,z,radius,maxHeight=38,maxRange=5.5){
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

function holeDepthAt(hole,x,z){
  if(!hole) return 0;
  let dx=x-hole.x;
  let dz=z-hole.z;
  let dist=Math.hypot(dx,dz);
  if(dist>=hole.r) return 0;

  let inner=hole.innerR || hole.r*0.34;
  if(dist<=inner) return hole.depth;

  let t=(dist-inner)/Math.max(0.001,hole.r-inner);
  let rim=t*t*(3-2*t);
  return hole.depth*(1-rim);
}

function pointInHole(holes,x,z,padding=0){
  if(!holes) return null;
  for(let hole of holes){
    let radius=(hole.r || 0)+padding;
    let dx=x-hole.x;
    let dz=z-hole.z;
    if(dx*dx+dz*dz<radius*radius) return hole;
  }
  return null;
}

function holesForChunk(cx,cz,cityMode=false){
  let holes=[];
  let firstRoll=r01(cx*1229+19,cz*1697-31);
  let targetCount=cityMode
    ? (firstRoll>0.72 ? 1 : 0)
    : firstRoll>0.84 ? 3 : firstRoll>0.34 ? 2 : 1;

  for(let i=0;i<targetCount;i++){
    for(let attempt=0;attempt<18;attempt++){
      let rx=r01(cx*2381+i*101+attempt*17,cz*997-i*67-attempt*11);
      let rz=r01(cx*1471-i*53-attempt*23,cz*2063+i*83+attempt*13);
      let x=cx*chunkSize+(rx-0.5)*chunkSize;
      let z=cz*chunkSize+(rz-0.5)*chunkSize;
      let y=groundHeight(x,z);
      let sizeRoll=r01(cx*421+i*37+attempt,cz*733-i*19);
      let radius=32+Math.pow(sizeRoll,1.28)*58;

      if(y<waterLevel+4 || y>42) continue;
      if(roadDistance(x,z)<44+radius*0.55) continue;
      if(!terrainPatchOk(x,z,radius*0.92,50,14.5)) continue;
      if(pointInHole(holes,x,z,radius*1.65)) continue;

      let maxDepth=Math.max(3,y-waterLevel-2.2);
      let depthRoll=r01(cx*887-i*7,cz*569+attempt*29);
      let depth=Math.min(maxDepth,10+depthRoll*12+(radius-32)*0.12);
      holes.push({
        x,
        z,
        y,
        r:radius,
        innerR:radius*(0.34+r01(cx+i*5,cz-attempt*3)*0.16),
        depth,
        type:"hole"
      });
      break;
    }
  }

  return holes;
}

function chunkHasCityDistrict(cx,cz,chance){
  return r01(cx*37,cz*53)<=chance;
}

function terrainHolesForChunk(cx,cz,cityDistrictChance){
  let holes=[];
  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let hx=cx+dx;
      let hz=cz+dz;
      holes.push(...holesForChunk(hx,hz,chunkHasCityDistrict(hx,hz,cityDistrictChance)));
    }
  }
  return holes;
}

function buildTerrainChunk(message){
  setWorldSeed(message.seed,message.terrainProfile || {});
  if(!terrainLocalX || !terrainLocalZ || terrainLocalX.length!==terrainLocalZ.length){
    throw new Error("Chunk worker has no terrain vertex template.");
  }

  let cx=message.cx;
  let cz=message.cz;
  let envColors=message.colors || {};
  let lowColor=colorComponents(envColors.low ?? 0x8b3852);
  let midColor=colorComponents(envColors.mid ?? 0x5a3b70);
  let highColor=colorComponents(envColors.high ?? 0x3f3456);
  let shoreColor=colorComponents(envColors.shore ?? 0xd6b25a);
  let underwaterColor=colorComponents(envColors.underwater ?? 0x8f5a6c);
  let holeColor=colorComponents(0x09070a);

  let cityDistrictChance=Number.isFinite(message.cityDistrictChance) ? message.cityDistrictChance : 0.075;
  let localHoles=holesForChunk(cx,cz,!!message.cityMode);
  let terrainHoles=terrainHolesForChunk(cx,cz,cityDistrictChance);
  let vertexCount=terrainLocalX.length;
  let heights=new Float32Array(vertexCount);
  let colors=new Float32Array(vertexCount*3);
  let chunkHasWater=false;

  for(let index=0;index<vertexCount;index++){
    let wx=terrainLocalX[index]+cx*chunkSize;
    let wz=terrainLocalZ[index]+cz*chunkSize;
    let baseH=groundHeight(wx,wz);
    let h=baseH;
    let holeAmount=0;

    for(let hole of terrainHoles){
      let depth=holeDepthAt(hole,wx,wz);
      if(depth>0){
        h-=depth;
        holeAmount=Math.max(holeAmount,depth/Math.max(0.001,hole.depth));
      }
    }

    if(baseH<waterLevel){
      chunkHasWater=true;
      h=Math.min(h,waterLevel-0.55);
    }

    heights[index]=h;

    if(holeAmount>0){
      let wallShade=0.18+Math.min(0.82,holeAmount)*0.22;
      writeColor(colors,index,holeColor,lowColor,wallShade);
    }else if(h<waterLevel) writeColor(colors,index,underwaterColor);
    else if(h<waterLevel+2.7) writeColor(colors,index,shoreColor);
    else if(h<waterLevel+5.4){
      let t=(h-(waterLevel+2.7))/2.7;
      writeColor(colors,index,shoreColor,lowColor,t);
    }
    else if(h<15) writeColor(colors,index,lowColor);
    else if(h<30) writeColor(colors,index,midColor);
    else writeColor(colors,index,highColor);
  }

  return {heights,colors,holes:localHoles,terrainHoles,chunkHasWater};
}

self.onmessage=event=>{
  let message=event.data || {};
  if(message.type==="setTerrainTemplate"){
    terrainLocalX=message.localX;
    terrainLocalZ=message.localZ;
    return;
  }
  if(message.type!=="buildTerrain") return;

  try{
    let result=buildTerrainChunk(message);
    self.postMessage({
      type:"terrainBuilt",
      id:message.id,
      key:message.key,
      generation:message.generation,
      heights:result.heights,
      colors:result.colors,
      holes:result.holes,
      terrainHoles:result.terrainHoles,
      chunkHasWater:result.chunkHasWater
    },[result.heights.buffer,result.colors.buffer]);
  }catch(error){
    self.postMessage({
      type:"terrainError",
      id:message.id,
      key:message.key,
      generation:message.generation,
      message:error && error.message ? error.message : String(error)
    });
  }
};
