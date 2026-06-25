import { chunkSize } from "./constants.js";
import { carSurfaceHeight, roadCenterX } from "./terrain.js";

export function createHud({getCarState,getChunks}){
  let healthFill,healthLabel,healthHud,speedCanvas,speedCtx,speedLabel,speedHud,mapCanvas,mapCtx,mapHud,gameOverOverlay;

function makeHealthHud(){
  healthHud=document.createElement("div");
  healthHud.style.cssText=[
    "position:fixed",
    "top:18px",
    "left:50%",
    "transform:translateX(-50%)",
    "width:min(420px,70vw)",
    "height:22px",
    "background:rgba(20,28,34,0.38)",
    "box-shadow:0 4px 14px rgba(0,0,0,0.24)",
    "z-index:10",
    "overflow:hidden",
    "font-family:Arial,sans-serif"
  ].join(";");

  healthFill=document.createElement("div");
  healthFill.style.cssText=[
    "height:100%",
    "width:100%",
    "background:linear-gradient(90deg,#2fd36b,#a8e85d)",
    "transition:width 160ms ease,background 160ms ease"
  ].join(";");

  healthLabel=document.createElement("div");
  healthLabel.style.cssText=[
    "position:absolute",
    "inset:0",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font-size:12px",
    "font-weight:700",
    "letter-spacing:0",
    "color:white",
    "text-shadow:0 1px 2px rgba(0,0,0,0.6)",
    "pointer-events:none"
  ].join(";");

  healthHud.appendChild(healthFill);
  healthHud.appendChild(healthLabel);
  document.body.appendChild(healthHud);
  updateHealthHud();
}

function makeSpeedHud(){
  speedHud=document.createElement("div");
  speedHud.style.cssText=[
    "position:fixed",
    "top:18px",
    "left:18px",
    "width:136px",
    "height:112px",
    "background:rgba(20,28,34,0.38)",
    "box-shadow:0 4px 14px rgba(0,0,0,0.2)",
    "z-index:10",
    "overflow:hidden",
    "font-family:Arial,sans-serif",
    "letter-spacing:0",
    "color:white",
    "pointer-events:none"
  ].join(";");

  speedCanvas=document.createElement("canvas");
  speedCanvas.width=136;
  speedCanvas.height=112;
  speedCanvas.style.cssText="display:block;width:136px;height:112px";
  speedCtx=speedCanvas.getContext("2d");

  speedLabel=document.createElement("div");
  speedLabel.style.cssText=[
    "position:absolute",
    "left:0",
    "right:0",
    "bottom:13px",
    "text-align:center",
    "font-size:18px",
    "font-weight:800",
    "line-height:1",
    "text-shadow:0 1px 2px rgba(0,0,0,0.7)"
  ].join(";");

  speedHud.appendChild(speedCanvas);
  speedHud.appendChild(speedLabel);
  document.body.appendChild(speedHud);
  updateSpeedHud();
}

function updateSpeedHud(){
  if(!speedCtx || !speedLabel) return;

  let {carSpeed}=getCarState();
    let speed=Math.round(Math.abs(carSpeed)*50);
  let maxSpeed=80;
  let pct=Math.max(0,Math.min(1,speed/maxSpeed));
  let start=Math.PI*0.82;
  let end=Math.PI*2.18;
  let angle=start+(end-start)*pct;
  let cx=68;
  let cy=62;
  let radius=46;

  speedCtx.clearRect(0,0,speedCanvas.width,speedCanvas.height);
  speedCtx.lineCap="round";

  speedCtx.strokeStyle="rgba(255,255,255,0.18)";
  speedCtx.lineWidth=8;
  speedCtx.beginPath();
  speedCtx.arc(cx,cy,radius,start,end);
  speedCtx.stroke();

  speedCtx.strokeStyle="#68d96e";
  speedCtx.lineWidth=8;
  speedCtx.beginPath();
  speedCtx.arc(cx,cy,radius,start,angle);
  speedCtx.stroke();

  for(let i=0;i<=8;i++){
    let t=i/8;
    let tickAngle=start+(end-start)*t;
    let inner=radius-(i%2===0 ? 13 : 9);
    let outer=radius-2;
    speedCtx.strokeStyle=i%2===0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.42)";
    speedCtx.lineWidth=i%2===0 ? 2 : 1.5;
    speedCtx.beginPath();
    speedCtx.moveTo(cx+Math.cos(tickAngle)*inner,cy+Math.sin(tickAngle)*inner);
    speedCtx.lineTo(cx+Math.cos(tickAngle)*outer,cy+Math.sin(tickAngle)*outer);
    speedCtx.stroke();
  }

  speedCtx.strokeStyle="#f1f4f0";
  speedCtx.lineWidth=3;
  speedCtx.beginPath();
  speedCtx.moveTo(cx,cy);
  speedCtx.lineTo(cx+Math.cos(angle)*(radius-16),cy+Math.sin(angle)*(radius-16));
  speedCtx.stroke();

  speedCtx.fillStyle="#f1f4f0";
  speedCtx.beginPath();
  speedCtx.arc(cx,cy,4,0,Math.PI*2);
  speedCtx.fill();

  speedCtx.fillStyle="rgba(255,255,255,0.72)";
  speedCtx.font="700 9px Arial";
  speedCtx.textAlign="center";
  speedCtx.fillText("0",25,74);
  speedCtx.fillText("80",111,74);

  speedLabel.textContent=speed;
}

function makeMapHud(){
  mapHud=document.createElement("div");
  mapHud.style.cssText=[
    "position:fixed",
    "top:18px",
    "right:18px",
    "width:240px",
    "height:240px",
    "background:rgba(20,28,34,0.38)",
    "box-shadow:0 4px 14px rgba(0,0,0,0.2)",
    "z-index:10",
    "overflow:hidden",
    "pointer-events:none"
  ].join(";");

  mapCanvas=document.createElement("canvas");
  mapCanvas.width=240;
  mapCanvas.height=240;
  mapCanvas.style.cssText="display:block;width:240px;height:240px";
  mapCtx=mapCanvas.getContext("2d");
  mapHud.appendChild(mapCanvas);
  document.body.appendChild(mapHud);
  updateMapHud();
}

function mapToCanvas(wx,wz,cx,cz,radius,size){
  return {
    x:(wx-(cx-radius))/(radius*2)*size,
    y:(wz-(cz-radius))/(radius*2)*size
  };
}

function updateMapHud(){
  if(!mapCtx) return;

  let size=mapCanvas.width;
  let {carX,carZ,carVelAngle}=getCarState();
  let centerX=carX;
  let centerZ=carZ;
  let radius=chunkSize*2.3;

  mapCtx.clearRect(0,0,size,size);
  let cells=40;
  let cellSize=size/cells;
  for(let gy=0;gy<cells;gy++){
    for(let gx=0;gx<cells;gx++){
      let wx=centerX-radius+((gx+0.5)/cells)*radius*2;
      let wz=centerZ-radius+((gy+0.5)/cells)*radius*2;
      let h=carSurfaceHeight(wx,wz);
      if(h>34) mapCtx.fillStyle="rgba(118,122,113,0.95)";
      else if(h>22) mapCtx.fillStyle="rgba(88,106,80,0.95)";
      else if(h>8) mapCtx.fillStyle="rgba(58,121,78,0.94)";
      else if(h>-19) mapCtx.fillStyle="rgba(48,112,80,0.92)";
      else mapCtx.fillStyle="rgba(55,101,128,0.9)";
      mapCtx.fillRect(gx*cellSize,gy*cellSize,cellSize+1,cellSize+1);
    }
  }

  mapCtx.strokeStyle="rgba(255,255,255,0.12)";
  mapCtx.lineWidth=1;
  mapCtx.strokeRect(0.5,0.5,size-1,size-1);

  mapCtx.lineCap="round";
  mapCtx.lineJoin="round";
  mapCtx.strokeStyle="rgba(94,72,47,0.92)";
  mapCtx.lineWidth=6;
  mapCtx.beginPath();
  for(let i=0;i<=80;i++){
    let z=centerZ-radius+(i/80)*radius*2;
    let x=roadCenterX(z);
    let p=mapToCanvas(x,z,centerX,centerZ,radius,size);
    if(i===0) mapCtx.moveTo(p.x,p.y);
    else mapCtx.lineTo(p.x,p.y);
  }
  mapCtx.stroke();

  mapCtx.strokeStyle="rgba(218,196,145,0.9)";
  mapCtx.lineWidth=1.5;
  mapCtx.beginPath();
  for(let i=0;i<=80;i++){
    let z=centerZ-radius+(i/80)*radius*2;
    let x=roadCenterX(z);
    let p=mapToCanvas(x,z,centerX,centerZ,radius,size);
    if(i===0) mapCtx.moveTo(p.x,p.y);
    else mapCtx.lineTo(p.x,p.y);
  }
  mapCtx.stroke();

  mapCtx.fillStyle="#f2d04e";
  mapCtx.strokeStyle="rgba(20,28,34,0.82)";
  mapCtx.lineWidth=1.5;
  for(let chunk of getChunks().values()){
    if(!chunk.gasStationAdded || !chunk.gasStationSpawn) continue;
    let spawn=chunk.gasStationSpawn;
    let p=mapToCanvas(spawn.x,spawn.z,centerX,centerZ,radius,size);
    if(p.x<-8 || p.x>size+8 || p.y<-8 || p.y>size+8) continue;

    mapCtx.beginPath();
    mapCtx.rect(p.x-4,p.y-5,8,10);
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.beginPath();
    mapCtx.moveTo(p.x+4,p.y-2);
    mapCtx.lineTo(p.x+7,p.y+1);
    mapCtx.lineTo(p.x+7,p.y+5);
    mapCtx.stroke();
  }

  mapCtx.fillStyle="#d9edf2";
  mapCtx.strokeStyle="rgba(20,28,34,0.82)";
  mapCtx.lineWidth=1.5;
  for(let chunk of getChunks().values()){
    if(!chunk.garageAdded || !chunk.garageSpawn) continue;
    let spawn=chunk.garageSpawn;
    let p=mapToCanvas(spawn.x,spawn.z,centerX,centerZ,radius,size);
    if(p.x<-8 || p.x>size+8 || p.y<-8 || p.y>size+8) continue;

    mapCtx.beginPath();
    mapCtx.moveTo(p.x-5,p.y-1);
    mapCtx.lineTo(p.x,p.y-6);
    mapCtx.lineTo(p.x+5,p.y-1);
    mapCtx.lineTo(p.x+5,p.y+5);
    mapCtx.lineTo(p.x-5,p.y+5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.beginPath();
    mapCtx.moveTo(p.x-2.5,p.y+5);
    mapCtx.lineTo(p.x-2.5,p.y+1);
    mapCtx.lineTo(p.x+2.5,p.y+1);
    mapCtx.lineTo(p.x+2.5,p.y+5);
    mapCtx.stroke();
  }

  mapCtx.save();
  mapCtx.translate(size*0.5,size*0.5);
  mapCtx.rotate(-carVelAngle+Math.PI);
  mapCtx.fillStyle="#d62f2f";
  mapCtx.strokeStyle="white";
  mapCtx.lineWidth=2;
  mapCtx.beginPath();
  mapCtx.moveTo(0,-8);
  mapCtx.lineTo(6,7);
  mapCtx.lineTo(0,4);
  mapCtx.lineTo(-6,7);
  mapCtx.closePath();
  mapCtx.fill();
  mapCtx.stroke();
  mapCtx.restore();
}

function makeGameOverOverlay(){
  gameOverOverlay=document.createElement("div");
  gameOverOverlay.textContent="GAME OVER";
  gameOverOverlay.style.cssText=[
    "position:fixed",
    "inset:0",
    "display:none",
    "align-items:center",
    "justify-content:center",
    "z-index:20",
    "font-family:Arial,sans-serif",
    "font-size:clamp(52px,10vw,140px)",
    "font-weight:900",
    "letter-spacing:0",
    "color:white",
    "background:rgba(0,0,0,0.32)",
    "text-shadow:0 6px 22px rgba(0,0,0,0.72)",
    "pointer-events:none"
  ].join(";");
  document.body.appendChild(gameOverOverlay);
}

function updateHealthHud(){
  if(!healthFill || !healthLabel) return;
  let {carHealth}=getCarState();
    let pct=Math.max(0,Math.min(100,carHealth));
  healthFill.style.width=pct+"%";
  healthFill.style.background=pct>55
    ? "linear-gradient(90deg,#2fd36b,#a8e85d)"
    : pct>25
      ? "linear-gradient(90deg,#f0b83f,#f4df65)"
      : "linear-gradient(90deg,#d83a34,#f0715c)";
  healthLabel.textContent="Health "+Math.round(pct)+"%";
}

  function showGameOverOverlay(){
    if(gameOverOverlay){
      gameOverOverlay.style.display="flex";
    }
  }

  function init(){
    makeHealthHud();
    makeSpeedHud();
    makeMapHud();
    makeGameOverOverlay();
  }

  return {
    init,
    updateHealthHud,
    updateSpeedHud,
    updateMapHud,
    showGameOverOverlay
  };
}
