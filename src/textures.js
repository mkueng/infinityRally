import { THREE } from "./three.js";

export function makeSkyTexture(){
  let canvas=document.createElement("canvas");
  canvas.width=1024;
  canvas.height=512;
  let ctx=canvas.getContext("2d");
  let gradient=ctx.createLinearGradient(0,0,0,512);
  gradient.addColorStop(0,"#12072b");
  gradient.addColorStop(0.34,"#33145f");
  gradient.addColorStop(0.68,"#9c416f");
  gradient.addColorStop(0.88,"#f08c71");
  gradient.addColorStop(1,"#ffd3a5");
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,1024,512);

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
  canvas.height=384;
  let ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,512,384);

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

  let fade=ctx.createLinearGradient(0,0,0,384);
  fade.addColorStop(0,"rgba(255,255,255,0)");
  fade.addColorStop(0.18,"rgba(255,255,255,1)");
  fade.addColorStop(0.72,"rgba(255,255,255,1)");
  fade.addColorStop(1,"rgba(255,255,255,0)");
  ctx.globalCompositeOperation="destination-in";
  ctx.fillStyle=fade;
  ctx.fillRect(0,0,512,384);
  ctx.globalCompositeOperation="source-over";

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

  ctx.fillStyle="#6f2d46";
  ctx.fillRect(0,0,1024,1024);

  for(let i=0;i<800;i++){
    let size=Math.random()*60+30;
    let r=55+Math.random()*45;
    let g=20+Math.random()*18;
    let b=70+Math.random()*55;

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
    let r=150+Math.random()*65;
    let g=70+Math.random()*45;
    let b=55+Math.random()*40;

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
    ctx.strokeStyle=`rgba(104,255,213,${0.05+Math.random()*0.08})`;
    ctx.lineWidth=1+Math.random()*2.5;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+Math.cos(i*17.13)*length,y+Math.sin(i*9.71)*length);
    ctx.stroke();
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
