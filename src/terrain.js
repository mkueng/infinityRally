import { offroadMaxSpeed } from "./constants.js";

let worldSeed=0;
const defaultTerrainProfile={
  heightScale:1,
  hillScale:1,
  mountainScale:1,
  ridgeMountainScale:null,
  mountainPeakPower:2,
  cragScale:1,
  cragFrequencyScale:1,
  terrainStructureScale:1,
  terrainStructureFrequencyScale:1,
  broadMountainScale:1,
  broadMountainChance:0.26,
  broadMountainSpacing:1650,
  broadMountainRadiusScale:1,
  broadMountainPlateau:0,
  broadMountainPlateauRadius:0.46,
  broadMountainRidgeStrength:0.28,
  mesaMountainScale:0,
  mesaMountainChance:0.24,
  mesaMountainSpacing:1800,
  mesaMountainRadiusScale:1,
  megaMountainScale:0,
  megaMountainSpacing:3000,
  megaPlateauHeight:70,
  megaValleyDepth:30,
  megaRidgeHeight:84,
  baseHeight:0,
  roadWave1:220,
  roadWave2:80,
  roadWave3:25,
  roadFrequencyScale:1,
  roadPhase:0
};
let terrainProfile={...defaultTerrainProfile};
const noRoadDistance=1000000000;
const broadMountainSpacing=1650;
const broadMountainCellCacheLimit=4096;
let broadMountainCellCache=new Map();
const mesaMountainCellCacheLimit=2048;
let mesaMountainCellCache=new Map();
const megaMountainCellCacheLimit=2048;
let megaMountainCellCache=new Map();
const heightCacheLimit=90000;
const heightCacheTrim=12000;
let heightCache=new Map();

export function setWorldSeed(seed,profile={}){
  worldSeed=Number.isFinite(seed) ? seed : 0;
  terrainProfile={...defaultTerrainProfile,...profile};
  broadMountainCellCache.clear();
  mesaMountainCellCache.clear();
  megaMountainCellCache.clear();
  heightCache.clear();
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

function noise01(x,z){
  let X=Math.floor(x),Z=Math.floor(z);
  let fx=x-X,fz=z-Z;

  let a=rand01(X,Z);
  let b=rand01(X+1,Z);
  let c=rand01(X,Z+1);
  let d=rand01(X+1,Z+1);

  fx=smooth(fx);
  fz=smooth(fz);

  return a+(b-a)*fx+(c-a)*fz+(a-b-c+d)*fx*fz;
}

function fbm01(x,z){
  let h=0,amp=0.5,freq=1,total=0;
  for(let i=0;i<5;i++){
    h+=noise01(x*freq,z*freq)*amp;
    total+=amp;
    amp*=0.5;
    freq*=2;
  }
  return total>0 ? h/total : 0;
}

function fbm01Fast(x,z){
  let h=0,amp=0.5,freq=1,total=0;
  for(let i=0;i<3;i++){
    h+=noise01(x*freq,z*freq)*amp;
    total+=amp;
    amp*=0.5;
    freq*=2;
  }
  return total>0 ? h/total : 0;
}

function rand01(x,z){
  let value=rand(x,z);
  return value-Math.floor(value);
}

function smoothstep01(value){
  value=Math.max(0,Math.min(1,value));
  return value*value*(3-2*value);
}

function broadMountainCell(cellX,cellZ,spacing,radiusScale){
  let key=cellX+","+cellZ+","+spacing+","+radiusScale;
  let cached=broadMountainCellCache.get(key);
  if(cached) return cached;

  let angle=rand01(cellX*131.9+11.4,cellZ*97.2-6.8)*Math.PI*2;
  let cell={
    chanceRoll:rand01(cellX*31.7+19.3,cellZ*47.1-8.6),
    centerX:(cellX+0.18+rand01(cellX*91.3+2.1,cellZ*77.9-4.2)*0.64)*spacing,
    centerZ:(cellZ+0.18+rand01(cellX*57.6-3.7,cellZ*112.4+5.5)*0.64)*spacing,
    ca:Math.cos(angle),
    sa:Math.sin(angle),
    radiusX:(300+rand01(cellX*181.1-9.1,cellZ*61.3+7.4)*280)*radiusScale,
    radiusZ:(220+rand01(cellX*43.5+13.8,cellZ*149.6-2.7)*260)*radiusScale,
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

  let spacing=Math.max(700,terrainProfile.broadMountainSpacing || broadMountainSpacing);
  let radiusScale=Math.max(0.2,terrainProfile.broadMountainRadiusScale || 1);
  let gx=Math.floor(x/spacing);
  let gz=Math.floor(z/spacing);
  let total=0;

  for(let ix=-1;ix<=1;ix++){
    for(let iz=-1;iz<=1;iz++){
      let cellX=gx+ix;
      let cellZ=gz+iz;
      let cell=broadMountainCell(cellX,cellZ,spacing,radiusScale);
      if(cell.chanceRoll>terrainProfile.broadMountainChance) continue;

      let dx=x-cell.centerX;
      let dz=z-cell.centerZ;
      let lx=(dx*cell.ca-dz*cell.sa)/cell.radiusX;
      let lz=(dx*cell.sa+dz*cell.ca)/cell.radiusZ;
      let d=Math.hypot(lx,lz);
      if(d>=1) continue;

      let dome=1-smoothstep01(d);
      let plateauAmount=Math.max(0,Math.min(1,terrainProfile.broadMountainPlateau ?? 0));
      if(plateauAmount>0){
        let plateauRadius=Math.max(0.05,Math.min(0.9,terrainProfile.broadMountainPlateauRadius ?? 0.46));
        let plateauDome=1-smoothstep01((d-plateauRadius)/(1-plateauRadius));
        dome=dome+(plateauDome-dome)*plateauAmount;
      }
      let ridgeStrength=Math.max(0,Math.min(1,terrainProfile.broadMountainRidgeStrength ?? 0.28));
      let ridge=1-ridgeStrength+ridgeStrength*fbm((x+cell.centerX)*0.004,(z-cell.centerZ)*0.004);
      total+=cell.peak*dome*dome*ridge*scale;
    }
  }

  let roadFade=smoothstep01((roadDistance(x,z)-115)/155);
  return total*roadFade;
}

function mesaMountainCell(cellX,cellZ,spacing,radiusScale){
  let key=cellX+","+cellZ+","+spacing+","+radiusScale;
  let cached=mesaMountainCellCache.get(key);
  if(cached) return cached;

  let angle=rand01(cellX*109.3-27.4,cellZ*191.7+8.9)*Math.PI*2;
  let cell={
    chanceRoll:rand01(cellX*167.8+9.2,cellZ*53.6-18.1),
    centerX:(cellX+0.16+rand01(cellX*41.5-6.2,cellZ*133.4+11.6)*0.68)*spacing,
    centerZ:(cellZ+0.16+rand01(cellX*97.7+15.8,cellZ*61.2-4.9)*0.68)*spacing,
    ca:Math.cos(angle),
    sa:Math.sin(angle),
    radiusX:(310+rand01(cellX*73.4+2.8,cellZ*151.1-9.7)*250)*radiusScale,
    radiusZ:(230+rand01(cellX*181.3-15.4,cellZ*87.6+5.1)*210)*radiusScale,
    height:58+rand01(cellX*211.9+13.7,cellZ*37.8-12.4)*52,
    capRadius:0.34+rand01(cellX*139.6-5.4,cellZ*223.1+18.2)*0.16,
    wallWidth:0.18+rand01(cellX*59.7+7.8,cellZ*173.9-21.4)*0.08,
    terraces:5+Math.floor(rand01(cellX*101.8+31.4,cellZ*79.3-14.8)*4)
  };

  mesaMountainCellCache.set(key,cell);
  if(mesaMountainCellCache.size>mesaMountainCellCacheLimit){
    mesaMountainCellCache.delete(mesaMountainCellCache.keys().next().value);
  }
  return cell;
}

function mesaMountainHeight(x,z){
  let scale=terrainProfile.mesaMountainScale || 0;
  if(scale<=0) return 0;

  let spacing=Math.max(900,terrainProfile.mesaMountainSpacing || 1800);
  let radiusScale=Math.max(0.25,terrainProfile.mesaMountainRadiusScale || 1);
  let chance=Math.max(0,Math.min(1,terrainProfile.mesaMountainChance ?? 0.24));
  let gx=Math.floor(x/spacing);
  let gz=Math.floor(z/spacing);
  let total=0;

  for(let ix=-1;ix<=1;ix++){
    for(let iz=-1;iz<=1;iz++){
      let cell=mesaMountainCell(gx+ix,gz+iz,spacing,radiusScale);
      if(cell.chanceRoll>chance) continue;

      let dx=x-cell.centerX;
      let dz=z-cell.centerZ;
      let lx=(dx*cell.ca-dz*cell.sa)/cell.radiusX;
      let lz=(dx*cell.sa+dz*cell.ca)/cell.radiusZ;
      let d=Math.hypot(lx,lz);
      if(d>=1.16) continue;

      let edgeNoise=(noise01(x*0.006+cell.centerX*0.0017,z*0.006-cell.centerZ*0.0013)-0.5)*0.085;
      let nd=Math.max(0,d+edgeNoise);
      let wallEnd=Math.min(0.98,cell.capRadius+cell.wallWidth);
      let wallT=Math.max(0,Math.min(1,(nd-cell.capRadius)/Math.max(0.001,0.98-cell.capRadius)));
      let steppedWallT=Math.floor(wallT*cell.terraces)/cell.terraces;
      let terracedWallT=wallT*0.38+steppedWallT*0.62;
      let terracedSide=1-smoothstep01(terracedWallT);
      let steepCap=1-smoothstep01((nd-cell.capRadius)/Math.max(0.001,wallEnd-cell.capRadius));
      let skirt=1-smoothstep01((nd-0.74)/0.36);
      let topMask=1-smoothstep01((nd-cell.capRadius*0.9)/0.14);
      let capNoise=(fbm01Fast(x*0.011+cell.centerX*0.002,z*0.011-cell.centerZ*0.002)-0.5)*4.4*topMask;
      let verticalFace=Math.max(steepCap,terracedSide*0.92);
      let mesa=(verticalFace*0.84+skirt*0.16)*cell.height+capNoise;
      total+=Math.max(0,mesa)*scale;
    }
  }

  let roadFade=smoothstep01((roadDistance(x,z)-145)/190);
  return total*roadFade;
}

function megaMountainCell(cellX,cellZ,spacing){
  let key=cellX+","+cellZ+","+spacing;
  let cached=megaMountainCellCache.get(key);
  if(cached) return cached;

  let angle=rand01(cellX*83.7-17.4,cellZ*151.9+29.2)*Math.PI*2;
  let cell={
    centerX:(cellX+0.16+rand01(cellX*71.2+4.8,cellZ*43.9-12.1)*0.68)*spacing,
    centerZ:(cellZ+0.16+rand01(cellX*39.4-8.7,cellZ*91.6+18.4)*0.68)*spacing,
    ca:Math.cos(angle),
    sa:Math.sin(angle),
    radiusX:spacing*(0.28+rand01(cellX*191.3+11.2,cellZ*67.8-3.4)*0.16),
    radiusZ:spacing*(0.22+rand01(cellX*53.6-19.8,cellZ*177.1+7.2)*0.18),
    plateau:terrainProfile.megaPlateauHeight*(0.78+rand01(cellX*227.4+31.1,cellZ*101.2-13.5)*0.48),
    valley:terrainProfile.megaValleyDepth*(0.72+rand01(cellX*137.6-15.2,cellZ*63.4+9.1)*0.62),
    ridge:terrainProfile.megaRidgeHeight*(0.8+rand01(cellX*89.1+23.7,cellZ*211.5-26.9)*0.46)
  };

  megaMountainCellCache.set(key,cell);
  if(megaMountainCellCache.size>megaMountainCellCacheLimit){
    megaMountainCellCache.delete(megaMountainCellCache.keys().next().value);
  }
  return cell;
}

function megaMountainHeight(x,z){
  let scale=terrainProfile.megaMountainScale || 0;
  if(scale<=0) return 0;

  let spacing=Math.max(900,terrainProfile.megaMountainSpacing || 3000);
  let gx=Math.floor(x/spacing);
  let gz=Math.floor(z/spacing);
  let total=0;

  for(let ix=-1;ix<=1;ix++){
    for(let iz=-1;iz<=1;iz++){
      let cell=megaMountainCell(gx+ix,gz+iz,spacing);
      let dx=x-cell.centerX;
      let dz=z-cell.centerZ;
      let lx=(dx*cell.ca-dz*cell.sa)/cell.radiusX;
      let lz=(dx*cell.sa+dz*cell.ca)/cell.radiusZ;
      let d=Math.hypot(lx,lz);
      if(d>=1.42) continue;

      let ridgeSoftness=Math.max(0.5,terrainProfile.megaRidgeSoftness || 1);
      let plateauMask=1-smoothstep01((d-0.72)/0.62);
      let valleyMask=1-smoothstep01(d/0.48);
      let innerWall=smoothstep01((d-0.38)/(0.18*ridgeSoftness));
      let outerWall=1-smoothstep01((d-0.86)/(0.3*ridgeSoftness));
      let ringMask=innerWall*outerWall;
      let terrace=0.86+smoothstep01(noise01(x*0.0022+cell.centerX*0.001,z*0.0022-cell.centerZ*0.001))*0.14;
      total+=(cell.plateau*plateauMask*terrace+cell.ridge*ringMask-cell.valley*valleyMask)*scale;
    }
  }

  let longValleys=1-Math.abs(fbm01Fast(x*0.00135+41.7,z*0.0011-25.8)*2-1);
  let valleyCut=smoothstep01((longValleys-0.62)/0.26)*(terrainProfile.megaValleyDepth || 30)*0.72*scale;
  return total-valleyCut;
}

function mountainCragHeight(x,z,mountainMask,broadHeight){
  let cragScale=terrainProfile.cragScale ?? 1;
  if(cragScale<=0) return 0;

  let broadMask=smoothstep01((broadHeight-5)/24);
  let detailMask=Math.max(mountainMask,broadMask);
  if(detailMask<=0.001) return 0;

  let roadFade=smoothstep01((roadDistance(x,z)-130)/170);
  if(roadFade<=0.001) return 0;

  let frequencyScale=terrainProfile.cragFrequencyScale ?? 1;
  let ridgeA=1-Math.abs(fbm01(x*0.016*frequencyScale+71.3,z*0.016*frequencyScale-43.8)*2-1);
  let ridgeB=1-Math.abs(fbm01(x*0.034*frequencyScale-18.7,z*0.028*frequencyScale+92.1)*2-1);
  let pitted=fbm01(x*0.072*frequencyScale+11.4,z*0.072*frequencyScale-26.8)-0.5;
  let breakup=fbm01(x*0.011*frequencyScale+81.2,z*0.019*frequencyScale-32.5)-0.5;
  let crags=(Math.pow(ridgeA,3.2)-0.28)*2.6+(Math.pow(ridgeB,2.4)-0.34)*1.45+pitted*0.95+breakup*0.7;

  return crags*detailMask*roadFade*terrainProfile.mountainScale*cragScale;
}

function terrainStructureHeight(x,z,continent,hills,mountainMask,broadHeight){
  let scale=(terrainProfile.terrainStructureScale ?? 1)*terrainProfile.heightScale;
  if(scale<=0) return 0;

  let roadFade=smoothstep01((roadDistance(x,z)-86)/145);
  if(roadFade<=0.001) return 0;

  let broadMask=smoothstep01((broadHeight-3)/30);
  let uplandMask=smoothstep01((continent-0.12)/0.42);
  let hillMask=smoothstep01((hills-0.18)/0.38);
  let structureMask=Math.max(mountainMask*0.78,broadMask,uplandMask*0.44,hillMask*0.32);
  if(structureMask<=0.001) return 0;

  let frequencyScale=terrainProfile.terrainStructureFrequencyScale ?? 1;
  let warpX=(noise01(x*0.0027*frequencyScale+19.4,z*0.0024*frequencyScale-33.8)-0.5)*82;
  let warpZ=(noise01(x*0.0023*frequencyScale-51.7,z*0.0029*frequencyScale+12.6)-0.5)*82;
  let sx=x+warpX;
  let sz=z+warpZ;

  let rolling=(fbm01Fast(sx*0.0042*frequencyScale+7.5,sz*0.0038*frequencyScale-18.2)-0.5)*4.2;
  let ribs=1-Math.abs(fbm01Fast(sx*0.013*frequencyScale+43.2,sz*0.0105*frequencyScale-61.4)*2-1);
  let ribBreakup=0.38+noise01(x*0.0061*frequencyScale-28.8,z*0.0053*frequencyScale+47.1)*0.62;
  let ribHeight=(Math.pow(ribs,3.7)-0.25)*6.2*ribBreakup;
  let gullies=1-Math.abs(fbm01Fast((x-warpZ*0.45)*0.018*frequencyScale-9.1,(z+warpX*0.45)*0.015*frequencyScale+77.3)*2-1);
  let gullyCut=smoothstep01((gullies-0.64)/0.28);
  gullyCut*=0.45+noise01(x*0.0087*frequencyScale+65.1,z*0.0079*frequencyScale-24.6)*0.55;

  return (rolling+ribHeight-gullyCut*6.2)*structureMask*roadFade*scale;
}

export function height(x,z){
  let continent=fbm(x*.0012,z*.0012);
  let hills=fbm(x*.004,z*.004);
  let mountains=fbm(x*.006,z*.006);

  mountains=1-Math.abs(mountains*2-1);
  mountains=Math.max(0,mountains);
  mountains=Math.pow(mountains,terrainProfile.mountainPeakPower ?? 2);

  let mountainMask=Math.max(0,continent-.45)*2.2;
  mountainMask=Math.min(1,mountainMask);
  let broadHeight=broadMountainHeight(x,z);
  let megaHeight=megaMountainHeight(x,z);
  let mesaHeight=mesaMountainHeight(x,z);
  let ridgeMountainScale=terrainProfile.ridgeMountainScale ?? terrainProfile.mountainScale;

  return continent*14*terrainProfile.heightScale
    + hills*5*terrainProfile.hillScale
    + mountains*40*mountainMask*ridgeMountainScale
    + broadHeight
    + mesaHeight
    + megaHeight
    + mountainCragHeight(x,z,mountainMask,broadHeight+mesaHeight+Math.max(0,megaHeight))
    + terrainStructureHeight(x,z,continent,hills,mountainMask,broadHeight+mesaHeight+Math.max(0,megaHeight))
    - 14
    + terrainProfile.baseHeight;
}

export function groundHeight(x,z){
  let key=x+","+z;
  let cached=heightCache.get(key);
  if(cached!==undefined) return cached;

  let value=height(x,z);
  heightCache.set(key,value);
  if(heightCache.size>heightCacheLimit){
    let trimmed=0;
    for(let oldKey of heightCache.keys()){
      heightCache.delete(oldKey);
      trimmed++;
      if(trimmed>=heightCacheTrim) break;
    }
  }
  return value;
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
  return noRoadDistance;
}

export function maxSpeedForRoadDistance(d){
  return offroadMaxSpeed;
}


export function roadHeight(x,z){
  return groundHeight(x,z)+.25;
}

export function carSurfaceHeight(x,z){
  return groundHeight(x,z);
}
