import { THREE } from "./three.js";

function pick(list,index,fallback){
  return list && list[index] ? list[index] : fallback;
}

function boostedSkyStop(color,index){
  let boosted=new THREE.Color(color);
  if(index<=1){
    boosted.lerp(new THREE.Color(0x000000),index===0 ? 0.26 : 0.16);
  }else if(index>=3){
    boosted.lerp(new THREE.Color(0xffffff),index===4 ? 0.2 : 0.13);
  }
  return `#${boosted.getHexString()}`;
}

function randomChannel(base,spread){
  return Math.max(0,Math.min(255,base+Math.random()*spread));
}

export function makeSkyTexture(environment={}){
  let sky=environment.sky || ["#12072b","#33145f","#9c416f","#f08c71","#ffd3a5"];
  let canvas=document.createElement("canvas");
  canvas.width=1024;
  canvas.height=512;
  let ctx=canvas.getContext("2d");
  let gradient=ctx.createLinearGradient(0,0,0,512);
  gradient.addColorStop(0,boostedSkyStop(pick(sky,0,"#12072b"),0));
  gradient.addColorStop(0.24,boostedSkyStop(pick(sky,1,"#33145f"),1));
  gradient.addColorStop(0.58,boostedSkyStop(pick(sky,2,"#9c416f"),2));
  gradient.addColorStop(0.84,boostedSkyStop(pick(sky,3,"#f08c71"),3));
  gradient.addColorStop(1,boostedSkyStop(pick(sky,4,"#ffd3a5"),4));
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,1024,512);

  let tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=false;
  return tex;
}

export function makeDistantPlanetHazeTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=512;
  canvas.height=512;
  let ctx=canvas.getContext("2d");
  let cx=256;
  let cy=256;

  ctx.clearRect(0,0,512,512);

  let body=ctx.createRadialGradient(cx,cy,0,cx,cy,194);
  body.addColorStop(0,"rgba(255,238,210,0.26)");
  body.addColorStop(0.34,"rgba(250,205,204,0.2)");
  body.addColorStop(0.68,"rgba(194,214,228,0.12)");
  body.addColorStop(0.9,"rgba(150,188,214,0.035)");
  body.addColorStop(0.98,"rgba(150,188,214,0.006)");
  body.addColorStop(1,"rgba(150,188,214,0)");
  ctx.fillStyle=body;
  ctx.beginPath();
  ctx.arc(cx,cy,194,0,Math.PI*2);
  ctx.fill();

  let atmosphere=ctx.createRadialGradient(cx,cy,190,cx,cy,203);
  atmosphere.addColorStop(0,"rgba(184,222,240,0)");
  atmosphere.addColorStop(0.42,"rgba(186,226,246,0.032)");
  atmosphere.addColorStop(0.72,"rgba(178,222,246,0.072)");
  atmosphere.addColorStop(0.92,"rgba(178,222,246,0.012)");
  atmosphere.addColorStop(1,"rgba(178,222,246,0)");
  ctx.fillStyle=atmosphere;
  ctx.beginPath();
  ctx.arc(cx,cy,203,0,Math.PI*2);
  ctx.fill();

  let tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=false;
  return tex;
}

export function makeDistantPlanetLightTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=512;
  canvas.height=512;
  let ctx=canvas.getContext("2d");
  let cx=256;
  let cy=256;
  let radius=188;

  ctx.clearRect(0,0,512,512);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx,cy,radius,0,Math.PI*2);
  ctx.clip();

  let shadow=ctx.createLinearGradient(cx-radius,cy,cx+radius,cy);
  shadow.addColorStop(0,"rgba(1,4,14,0.9)");
  shadow.addColorStop(0.34,"rgba(3,7,19,0.76)");
  shadow.addColorStop(0.56,"rgba(9,16,31,0.52)");
  shadow.addColorStop(0.72,"rgba(24,34,52,0.22)");
  shadow.addColorStop(0.86,"rgba(255,255,255,0)");
  shadow.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=shadow;
  ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);

  let shine=ctx.createRadialGradient(cx+radius*0.48,cy-radius*0.24,0,cx+radius*0.48,cy-radius*0.24,radius*0.82);
  shine.addColorStop(0,"rgba(255,246,218,0.34)");
  shine.addColorStop(0.34,"rgba(255,232,204,0.18)");
  shine.addColorStop(0.7,"rgba(255,232,204,0.045)");
  shine.addColorStop(1,"rgba(255,232,204,0)");
  ctx.fillStyle=shine;
  ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);

  let terminator=ctx.createLinearGradient(cx-radius*0.1,cy,cx+radius*0.58,cy);
  terminator.addColorStop(0,"rgba(4,8,19,0.46)");
  terminator.addColorStop(0.52,"rgba(4,8,19,0.2)");
  terminator.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=terminator;
  ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);

  ctx.restore();

  let tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=false;
  return tex;
}

export function makeDistantPlanetVeilTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=512;
  canvas.height=512;
  let ctx=canvas.getContext("2d");
  let cx=256;
  let cy=256;
  let radius=190;

  ctx.clearRect(0,0,512,512);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx,cy,radius,0,Math.PI*2);
  ctx.clip();

  let veil=ctx.createRadialGradient(cx+radius*0.12,cy-radius*0.1,0,cx,cy,radius);
  veil.addColorStop(0,"rgba(228,236,238,0.095)");
  veil.addColorStop(0.22,"rgba(214,226,232,0.085)");
  veil.addColorStop(0.46,"rgba(184,210,224,0.048)");
  veil.addColorStop(0.62,"rgba(144,178,204,0.018)");
  veil.addColorStop(1,"rgba(144,178,204,0.007)");
  ctx.fillStyle=veil;
  ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);

  let wash=ctx.createLinearGradient(cx-radius,cy-radius,cx+radius,cy+radius);
  wash.addColorStop(0,"rgba(248,220,204,0.012)");
  wash.addColorStop(0.42,"rgba(248,220,204,0.022)");
  wash.addColorStop(0.56,"rgba(214,232,236,0.064)");
  wash.addColorStop(1,"rgba(172,210,228,0.05)");
  ctx.fillStyle=wash;
  ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);

  ctx.restore();

  let tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=false;
  return tex;
}

export function makeDustTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=128;
  canvas.height=128;
  let ctx=canvas.getContext("2d");
  let gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,"rgba(255,255,255,0.95)");
  gradient.addColorStop(0.35,"rgba(255,255,255,0.7)");
  gradient.addColorStop(0.7,"rgba(255,255,255,0.18)");
  gradient.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,128,128);

  let tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=false;
  return tex;
}

export function makeCarShadowTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=256;
  canvas.height=256;
  let ctx=canvas.getContext("2d");
  let gradient=ctx.createRadialGradient(128,128,12,128,128,124);
  gradient.addColorStop(0,"rgba(0,0,0,0.72)");
  gradient.addColorStop(0.42,"rgba(0,0,0,0.4)");
  gradient.addColorStop(0.78,"rgba(0,0,0,0.12)");
  gradient.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,256,256);

  let tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=false;
  return tex;
}

export function makeCloudTexture(variant=0){
  let canvas=document.createElement("canvas");
  canvas.width=512;
  canvas.height=256;
  let ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,512,256);
  let seed=variant*37.17+11.3;

  function cloudHash(n){
    return Math.sin(n*127.1+seed*311.7)*43758.5453%1;
  }

  function cloudRand(n){
    let value=cloudHash(n);
    return value<0 ? value+1 : value;
  }

  function puff(x,y,r,alpha){
    let gradient=ctx.createRadialGradient(x,y,0,x,y,r);
    gradient.addColorStop(0,`rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.5,`rgba(255,255,255,${alpha*0.54})`);
    gradient.addColorStop(0.86,`rgba(255,255,255,${alpha*0.16})`);
    gradient.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=gradient;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();
  }

  let puffCount=8+Math.floor(cloudRand(1)*5);
  let centerLift=(cloudRand(2)-0.5)*18;
  let stretch=0.82+cloudRand(3)*0.46;
  for(let i=0;i<puffCount;i++){
    let t=puffCount<=1 ? 0.5 : i/(puffCount-1);
    let arch=Math.sin(t*Math.PI);
    let x=58+t*392+(cloudRand(i*5+4)-0.5)*58;
    let y=142+centerLift-arch*(24+cloudRand(i*5+5)*28)+(cloudRand(i*5+6)-0.5)*34;
    let radius=(50+arch*52+cloudRand(i*5+7)*48)*stretch;
    let alpha=(0.34+arch*0.44+cloudRand(i*5+8)*0.18)*(0.86+cloudRand(i*5+9)*0.22);
    puff(x,y,radius,alpha);
  }

  let underPuffCount=3+Math.floor(cloudRand(41)*4);
  for(let i=0;i<underPuffCount;i++){
    let t=(i+0.5)/underPuffCount;
    let x=82+t*344+(cloudRand(i*7+43)-0.5)*74;
    let y=152+(cloudRand(i*7+44)-0.5)*28;
    let radius=68+cloudRand(i*7+45)*74;
    let alpha=0.18+cloudRand(i*7+46)*0.22;
    puff(x,y,radius,alpha);
  }

  let tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=false;
  return tex;
}

export function makeHazeTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=512;
  canvas.height=512;
  let ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,512,512);

  let center=ctx.createRadialGradient(256,256,0,256,256,246);
  center.addColorStop(0,"rgba(255,255,255,0.42)");
  center.addColorStop(0.28,"rgba(255,255,255,0.28)");
  center.addColorStop(0.62,"rgba(255,255,255,0.11)");
  center.addColorStop(0.86,"rgba(255,255,255,0.035)");
  center.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=center;
  ctx.beginPath();
  ctx.arc(256,256,246,0,Math.PI*2);
  ctx.fill();

  for(let i=0;i<18;i++){
    let x=140+Math.random()*232;
    let y=150+Math.random()*212;
    let radius=72+Math.random()*105;
    let alpha=0.045+Math.random()*0.055;
    let puff=ctx.createRadialGradient(x,y,0,x,y,radius);
    puff.addColorStop(0,`rgba(255,255,255,${alpha})`);
    puff.addColorStop(0.72,`rgba(255,255,255,${alpha*0.26})`);
    puff.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=puff;
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fill();
  }

  let tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=false;
  return tex;
}

export function makeGroundTexture(environment={}){
  let ground=environment.groundTexture || {
    base:"#6f2d46",
    dark:[55,20,70],
    bright:[150,70,55],
    streak:"104,255,213"
  };
  let canvas=document.createElement("canvas");
  canvas.width=1024;
  canvas.height=1024;

  let ctx=canvas.getContext("2d");

  ctx.fillStyle=ground.base || "#6f2d46";
  ctx.fillRect(0,0,1024,1024);

  let dark=ground.dark || [55,20,70];
  let bright=ground.bright || [150,70,55];

  for(let i=0;i<9000;i++){
    let size=0.7+Math.random()*2.8;
    let useBright=Math.random()>0.55;
    let source=useBright ? bright : dark;
    let spread=useBright ? 38 : 30;
    let r=randomChannel(source[0],spread);
    let g=randomChannel(source[1],spread*0.72);
    let b=randomChannel(source[2],spread);

    ctx.fillStyle=`rgba(${r},${g},${b},${0.08+Math.random()*0.16})`;
    ctx.fillRect(
      Math.random()*1024,
      Math.random()*1024,
      size,
      size
    );
  }

  for(let i=0;i<800;i++){
    let size=Math.random()*60+30;
    let r=randomChannel(dark[0],45);
    let g=randomChannel(dark[1],24);
    let b=randomChannel(dark[2],55);

    ctx.fillStyle=`rgba(${r},${g},${b},0.12)`;
    ctx.fillRect(
      Math.random()*1024,
      Math.random()*1024,
      size,
      size
    );
  }

  for(let i=0;i<600;i++){
    let size=Math.random()*50+25;
    let r=randomChannel(bright[0],65);
    let g=randomChannel(bright[1],45);
    let b=randomChannel(bright[2],40);

    ctx.fillStyle=`rgba(${r},${g},${b},0.08)`;
    ctx.fillRect(
      Math.random()*1024,
      Math.random()*1024,
      size,
      size
    );
  }

  for(let i=0;i<140;i++){
    let x=Math.random()*1024;
    let y=Math.random()*1024;
    let length=45+Math.random()*160;
    ctx.strokeStyle=`rgba(${ground.streak || "104,255,213"},${0.05+Math.random()*0.08})`;
    ctx.lineWidth=1+Math.random()*2.5;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+Math.cos(i*17.13)*length,y+Math.sin(i*9.71)*length);
    ctx.stroke();
  }

  for(let i=0;i<420;i++){
    let x=Math.random()*1024;
    let y=Math.random()*1024;
    let length=8+Math.random()*36;
    let angle=Math.random()*Math.PI*2;
    ctx.strokeStyle=`rgba(${ground.streak || "104,255,213"},${0.025+Math.random()*0.055})`;
    ctx.lineWidth=0.7+Math.random()*1.6;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+Math.cos(angle)*length,y+Math.sin(angle)*length);
    ctx.stroke();
  }

  let tex=new THREE.CanvasTexture(canvas);
  tex.wrapS=THREE.RepeatWrapping;
  tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(7,7);

  return tex;
}

export function makeRoadTexture(){

  let canvas=document.createElement("canvas");
  canvas.width=512;
  canvas.height=512;

  let ctx=canvas.getContext("2d");

  ctx.fillStyle="#2b2232";
  ctx.fillRect(0,0,512,512);

  for(let i=0;i<8000;i++){

    let size=Math.random()*8+2;

    let r=72+Math.random()*80;
    let g=48+Math.random()*42;
    let b=78+Math.random()*70;

    ctx.fillStyle=
      `rgba(${r},${g},${b},0.42)`;

    ctx.fillRect(
      Math.random()*512,
      Math.random()*512,
      size,
      size
    );
  }

  for(let i=0;i<2000;i++){

    let c=35+Math.random()*38;

    ctx.fillStyle=
      `rgba(${c*1.25},${c},${c*1.5},0.28)`;

    ctx.fillRect(
      Math.random()*512,
      Math.random()*512,
      2,
      2
    );
  }

  let tex=new THREE.CanvasTexture(canvas);

  tex.wrapS=THREE.RepeatWrapping;
  tex.wrapT=THREE.RepeatWrapping;

  tex.repeat.set(2,30);

  return tex;
}
