import { offroadMaxSpeed, roadMaxSpeed } from "./constants.js";

let worldSeed=0;
const defaultTerrainProfile={
  heightScale:1,
  hillScale:1,
  mountainScale:1,
  baseHeight:0,
  roadWave1:220,
  roadWave2:80,
  roadWave3:25,
  roadFrequencyScale:1,
  roadPhase:0
};
let terrainProfile={...defaultTerrainProfile};

export function setWorldSeed(seed,profile={}){
  worldSeed=Number.isFinite(seed) ? seed : 0;
  terrainProfile={...defaultTerrainProfile,...profile};
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
