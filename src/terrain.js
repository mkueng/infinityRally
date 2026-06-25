import { offroadMaxSpeed, roadMaxSpeed } from "./constants.js";

export function rand(x,z){
  return Math.sin(x*127.1+z*311.7)*43355.5453%1;
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

  return continent*14
    + hills*5
    + mountains*40*mountainMask
    - 14;
}

export function groundHeight(x,z){
  return height(x,z);
}

export function roadCenterX(z){
  return Math.sin(z*.002)*220
    + Math.sin(z*.006)*80
    + Math.sin(z*.013)*25;
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
  let y=groundHeight(x,z);
  let d=roadDistance(x,z);

  if(d<60){
    let t=1-d/60;
    t=t*t*(3-2*t);
    y=y*(1-t)+roadHeight(x,z)*t;
  }

  return y;
}
