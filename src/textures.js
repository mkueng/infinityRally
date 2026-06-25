import { THREE } from "./three.js";

export function makeSkyTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=16;
  canvas.height=512;
  let ctx=canvas.getContext("2d");
  let gradient=ctx.createLinearGradient(0,0,0,512);
  gradient.addColorStop(0,"#2f69b5");
  gradient.addColorStop(0.42,"#66a9dc");
  gradient.addColorStop(0.78,"#bfe5fb");
  gradient.addColorStop(1,"#eef8ff");
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,16,512);

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

export function makeCloudTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=512;
  canvas.height=256;
  let ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,512,256);

  function puff(x,y,r,alpha){
    let gradient=ctx.createRadialGradient(x,y,0,x,y,r);
    gradient.addColorStop(0,`rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.55,`rgba(255,255,255,${alpha*0.48})`);
    gradient.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=gradient;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();
  }

  puff(120,145,78,0.82);
  puff(190,112,92,0.9);
  puff(270,132,104,0.84);
  puff(360,142,82,0.72);
  puff(250,160,150,0.48);

  let tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=false;
  return tex;
}

export function makeGroundTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=1024;
  canvas.height=1024;

  let ctx=canvas.getContext("2d");

  // Base grass color
  ctx.fillStyle="#3a7d44";
  ctx.fillRect(0,0,1024,1024);

  // Subtle darker patches
  for(let i=0;i<800;i++){
    let size=Math.random()*60+30;
    let c=40+Math.random()*30;

    ctx.fillStyle=`rgba(${c*0.7},${c*1.2},${c*0.6},0.08)`;
    ctx.fillRect(
      Math.random()*1024,
      Math.random()*1024,
      size,
      size
    );
  }

  // Subtle lighter patches
  for(let i=0;i<600;i++){
    let size=Math.random()*50+25;
    let c=120+Math.random()*40;

    ctx.fillStyle=`rgba(${c},${c*1.1},${c*0.9},0.07)`;
    ctx.fillRect(
      Math.random()*1024,
      Math.random()*1024,
      size,
      size
    );
  }


  let tex=new THREE.CanvasTexture(canvas);
  tex.wrapS=THREE.RepeatWrapping;
  tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(4,4);

  return tex;
}

export function makeRoadTexture(){

  let canvas=document.createElement("canvas");
  canvas.width=512;
  canvas.height=512;

  let ctx=canvas.getContext("2d");

  ctx.fillStyle="#8b6f47";
  ctx.fillRect(0,0,512,512);

  for(let i=0;i<8000;i++){

    let size=Math.random()*8+2;

    let c=90+Math.random()*80;

    ctx.fillStyle=
      `rgba(${c},${c*0.8},${c*0.5},0.4)`;

    ctx.fillRect(
      Math.random()*512,
      Math.random()*512,
      size,
      size
    );
  }

  for(let i=0;i<2000;i++){

    let c=40+Math.random()*30;

    ctx.fillStyle=
      `rgba(${c},${c},${c},0.25)`;

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
