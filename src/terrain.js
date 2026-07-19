import { offroadMaxSpeed, roadMaxSpeed } from "./constants.js";

let worldSeed=0;
const defaultTerrainProfile={
  heightScale:1,
  hillScale:1,
  mountainScale:1,
  broadMountainScale:1,
  broadMountainChance:0.26,
  baseHeight:0,
  roadWave1:220,
  roadWave2:80,
  roadWave3:25,
  roadFrequencyScale:1,
  roadPhase:0
};
let terrainProfile={...defaultTerrainProfile};
const broadMountainSpacing=1650;
const broadMountainCellCacheLimit=4096;
let broadMountainCellCache=new Map();

export function setWorldSeed(seed,profile={}){
  worldSeed=Number.isFinite(seed) ? seed : 0;
  terrainProfile={...defaultTerrainProfile,...profile};
  broadMountainCellCache.clear();
}

export function rand(x,z){
  return Math.sin((x+worldSeed)*127.1+(z-worldSeed)*311.7)*43355.5453%1;
}

export function smooth(t){
  return t*t*(3-2*t);
}

export function noise(x,z){
  let X=Math.floor(x),Z=Math.floor(z);
  let fx=x-X,fz=z-Z;

  let a=rand(X,Z);
  let b=rand(X+1,Z);
  let c=rand(X,Z+1);
  let d=rand(X+1,Z+1);

  fx=smooth(fx);
  fz=smooth(fz);

  return a+(b-a)*fx+(c-a)*fz+(a-b-c+d)*fx*fz;
}

export function fbm(x,z){
  let h=0,amp=1,freq=1;
  for(let i=0;i<5;i++){
    h+=noise(x*freq,z*freq)*amp;
    amp*=0.5;
    freq*=2;
  }
  return h;
}

function rand01(x,z){
  let value=rand(x,z);
  return value-Math.floor(value);
}

function smoothstep01(value){
  value=Math.max(0,Math.min(1,value));
  return value*value*(3-2*value);
}

function broadMountainCell(cellX,cellZ){
  let key=cellX+","+cellZ;
  let cached=broadMountainCellCache.get(key);
  if(cached) return cached;

  let angle=rand01(cellX*131.9+11.4,cellZ*97.2-6.8)*Math.PI*2;
  let cell={
    chanceRoll:rand01(cellX*31.7+19.3,cellZ*47.1-8.6),
    centerX:(cellX+0.18+rand01(cellX*91.3+2.1,cellZ*77.9-4.2)*0.64)*broadMountainSpacing,
    centerZ:(cellZ+0.18+rand01(cellX*57.6-3.7,cellZ*112.4+5.5)*0.64)*broadMountainSpacing,
    ca:Math.cos(angle),
    sa:Math.sin(angle),
    radiusX:300+rand01(cellX*181.1-9.1,cellZ*61.3+7.4)*280,
    radiusZ:220+rand01(cellX*43.5+13.8,cellZ*149.6-2.7)*260,
    peak:18+rand01(cellX*211.4-17.2,cellZ*35.8+9.1)*38
  };

  broadMountainCellCache.set(key,cell);
  if(broadMountainCellCache.size>broadMountainCellCacheLimit){
    broadMountainCellCache.delete(broadMountainCellCache.keys().next().value);
  }
  return cell;
}

function broadMountainHeight(x,z){
  let scale=(terrainProfile.broadMountainScale ?? 1)*terrainProfile.mountainScale;
  if(scale<=0) return 0;

  let gx=Math.floor(x/broadMountainSpacing);
  let gz=Math.floor(z/broadMountainSpacing);
  let total=0;

  for(let ix=-1;ix<=1;ix++){
    for(let iz=-1;iz<=1;iz++){
      let cellX=gx+ix;
      let cellZ=gz+iz;
      let cell=broadMountainCell(cellX,cellZ);
      if(cell.chanceRoll>terrainProfile.broadMountainChance) continue;

      let dx=x-cell.centerX;
      let dz=z-cell.centerZ;
      let lx=(dx*cell.ca-dz*cell.sa)/cell.radiusX;
      let lz=(dx*cell.sa+dz*cell.ca)/cell.radiusZ;
      let d=Math.hypot(lx,lz);
      if(d>=1) continue;

      let dome=1-smoothstep01(d);
      let ridge=0.72+0.28*fbm((x+cell.centerX)*0.004,(z-cell.centerZ)*0.004);
      total+=cell.peak*dome*dome*ridge*scale;
    }
  }

  let roadFade=smoothstep01((roadDistance(x,z)-115)/155);
  return total*roadFade;
}

export function height(x,z){
  let continent=fbm(x*.0012,z*.0012);
  let hills=fbm(x*.004,z*.004);
  let mountains=fbm(x*.006,z*.006);

  mountains=1-Math.abs(mountains*2-1);
  mountains=Math.pow(mountains,2);

  let mountainMask=Math.max(0,continent-.45)*2.2;
  mountainMask=Math.min(1,mountainMask);

  return continent*14*terrainProfile.heightScale
    + hills*5*terrainProfile.hillScale
    + mountains*40*mountainMask*terrainProfile.mountainScale
    + broadMountainHeight(x,z)
    - 14
    + terrainProfile.baseHeight;
}

export function groundHeight(x,z){
  return height(x,z);
}

export function roadCenterX(z){
  let phase=terrainProfile.roadPhase+worldSeed*0.0007;
  let frequencyScale=terrainProfile.roadFrequencyScale;
  return Math.sin(z*.002*frequencyScale+phase)*terrainProfile.roadWave1
    + Math.sin(z*.006*frequencyScale+phase*0.73)*terrainProfile.roadWave2
    + Math.sin(z*.013*frequencyScale+phase*1.31)*terrainProfile.roadWave3;
}

export function roadYawAt(z){
  return Math.atan2(roadCenterX(z+18)-roadCenterX(z-18),36);
}

export function roadDistance(x,z){
  return Math.abs(x-roadCenterX(z));
}

export function maxSpeedForRoadDistance(d){
  if(d<45) return roadMaxSpeed;
  let t=Math.min(1,(d-45)/55);
  t=t*t*(3-2*t);
  return roadMaxSpeed*(1-t)+offroadMaxSpeed*t;
}


export function roadHeight(x,z){
  let center=roadCenterX(z);
  return groundHeight(center,z)+.25;
}

export function carSurfaceHeight(x,z){
  return groundHeight(x,z);
}
