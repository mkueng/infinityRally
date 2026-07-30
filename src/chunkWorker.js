import { chunkSize, segments } from "./constants.js";
import { groundHeight, rand, roadDistance, setWorldSeed } from "./terrain.js?v=titan-wide-plateaus";

const waterLevel=-20;
const underwaterVisualDropBase=1.55;
const underwaterVisualDropScale=0.62;
const underwaterVisualDropMax=10.5;
const underwaterLargePondDropMax=16;
let terrainLocalX=null;
let terrainLocalZ=null;

function waterSmoothstep01(value){
  value=Math.max(0,Math.min(1,value));
  return value*value*(3-2*value);
}

function underwaterVisualHeight(baseHeight,shoreDistance=0){
  if(baseHeight>=waterLevel) return baseHeight;
  let depth=waterLevel-baseHeight;
  let pondScale=waterSmoothstep01((shoreDistance-24)/210);
  let visualDrop=underwaterVisualDropBase
    +Math.min(underwaterVisualDropMax,depth*underwaterVisualDropScale)
    +pondScale*Math.min(underwaterLargePondDropMax,2.2+depth*0.74);
  return Math.min(baseHeight,waterLevel-visualDrop);
}

function waterShoreDistances(waterMask){
  let gridSize=segments+1;
  let vertexCount=waterMask.length;
  let distances=new Float32Array(vertexCount);
  let large=1000000;
  let straight=chunkSize/segments;
  let diagonal=straight*Math.SQRT2;
  let hasDry=false;

  for(let i=0;i<vertexCount;i++){
    if(waterMask[i]){
      distances[i]=large;
    }else{
      distances[i]=0;
      hasDry=true;
    }
  }

  if(!hasDry){
    distances.fill(chunkSize*0.75);
    return distances;
  }

  for(let z=0;z<gridSize;z++){
    for(let x=0;x<gridSize;x++){
      let i=z*gridSize+x;
      let d=distances[i];
      if(x>0) d=Math.min(d,distances[i-1]+straight);
      if(z>0) d=Math.min(d,distances[i-gridSize]+straight);
      if(x>0 && z>0) d=Math.min(d,distances[i-gridSize-1]+diagonal);
      if(x<gridSize-1 && z>0) d=Math.min(d,distances[i-gridSize+1]+diagonal);
      distances[i]=d;
    }
  }

  for(let z=gridSize-1;z>=0;z--){
    for(let x=gridSize-1;x>=0;x--){
      let i=z*gridSize+x;
      let d=distances[i];
      if(x<gridSize-1) d=Math.min(d,distances[i+1]+straight);
      if(z<gridSize-1) d=Math.min(d,distances[i+gridSize]+straight);
      if(x<gridSize-1 && z<gridSize-1) d=Math.min(d,distances[i+gridSize+1]+diagonal);
      if(x>0 && z<gridSize-1) d=Math.min(d,distances[i+gridSize-1]+diagonal);
      distances[i]=d;
    }
  }

  return distances;
}

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

function mixColorComponents(a,b,amount){
  let t=Math.max(0,Math.min(1,amount));
  return [
    a[0]+(b[0]-a[0])*t,
    a[1]+(b[1]-a[1])*t,
    a[2]+(b[2]-a[2])*t
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
  let shoreline=message.shoreline || {};
  let lowColor=colorComponents(envColors.low ?? 0x8b3852);
  let midColor=colorComponents(envColors.mid ?? 0x5a3b70);
  let highColor=colorComponents(envColors.high ?? 0x3f3456);
  let shoreColor=colorComponents(envColors.shore ?? 0xd6b25a);
  let waterColor=colorComponents(envColors.water ?? 0x20ffd4);
  let shoreInnerHeight=Number.isFinite(shoreline.innerHeight) ? shoreline.innerHeight : 1.8;
  let shoreOuterHeight=Number.isFinite(shoreline.outerHeight) ? shoreline.outerHeight : 12;
  let shoreInnerBlend=Number.isFinite(shoreline.innerShoreBlend) ? shoreline.innerShoreBlend : 0.35;
  let shoreTransitionHeight=Math.max(0.1,shoreOuterHeight-shoreInnerHeight);
  let wetWaterMix=Number.isFinite(shoreline.wetWaterMix) ? shoreline.wetWaterMix : 0.2;
  let terrainShoreStrength=Number.isFinite(shoreline.terrainShoreStrength) ? Math.max(0,Math.min(1,shoreline.terrainShoreStrength)) : 1;
  let wetShoreColor=mixColorComponents(shoreColor,waterColor,wetWaterMix);
  let underwaterColor=colorComponents(envColors.underwater ?? 0x8f5a6c);
  let holeColor=colorComponents(0x09070a);

  let cityDistrictChance=Number.isFinite(message.cityDistrictChance) ? message.cityDistrictChance : 0.075;
  let localHoles=holesForChunk(cx,cz,!!message.cityMode);
  let terrainHoles=terrainHolesForChunk(cx,cz,cityDistrictChance);
  let vertexCount=terrainLocalX.length;
  let heights=new Float32Array(vertexCount);
  let holeAmounts=new Float32Array(vertexCount);
  let waterMask=new Uint8Array(vertexCount);
  let waterDepths=new Float32Array(vertexCount);
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

    let waterDepth=waterLevel-baseH;
    if(waterDepth>0){
      chunkHasWater=true;
      waterMask[index]=1;
      waterDepths[index]=waterDepth;
    }

    heights[index]=h;
    holeAmounts[index]=holeAmount;
  }

  let shoreDistances=chunkHasWater ? waterShoreDistances(waterMask) : null;
  if(shoreDistances){
    for(let index=0;index<vertexCount;index++){
      if(waterMask[index]) heights[index]=underwaterVisualHeight(heights[index],shoreDistances[index]);
    }
  }

  for(let index=0;index<vertexCount;index++){
    let h=heights[index];
    let holeAmount=holeAmounts[index];
    if(holeAmount>0){
      let wallShade=0.18+Math.min(0.82,holeAmount)*0.22;
      writeColor(colors,index,holeColor,lowColor,wallShade);
    }else if(h<waterLevel) writeColor(colors,index,underwaterColor);
    else if(h<waterLevel+shoreInnerHeight){
      let t=waterSmoothstep01((h-waterLevel)/shoreInnerHeight);
      let targetColor=mixColorComponents(wetShoreColor,shoreColor,t*shoreInnerBlend);
      writeColor(colors,index,lowColor,targetColor,terrainShoreStrength);
    }
    else if(h<waterLevel+shoreOuterHeight){
      let t=waterSmoothstep01((h-(waterLevel+shoreInnerHeight))/shoreTransitionHeight);
      let targetColor=mixColorComponents(wetShoreColor,lowColor,t);
      writeColor(colors,index,lowColor,targetColor,terrainShoreStrength);
    }
    else if(h<15) writeColor(colors,index,lowColor);
    else if(h<30) writeColor(colors,index,midColor);
    else writeColor(colors,index,highColor);
  }

  return {heights,colors,holes:localHoles,terrainHoles,chunkHasWater,waterDepths};
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
      chunkHasWater:result.chunkHasWater,
      waterDepths:result.waterDepths
    },[result.heights.buffer,result.colors.buffer,result.waterDepths.buffer]);
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
