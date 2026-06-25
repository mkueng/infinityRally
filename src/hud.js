import { chunkSize } from "./constants.js";
import { carSurfaceHeight, roadCenterX } from "./terrain.js";

export function createHud({getCarStates,getChunks}){
  let panels=[];
  let gameOverOverlay;
  let mapUpdateFrame=0;

  function panelOffset(panel){
    return panel.side==="left" ? 0 : "50%";
  }

  function makeHealthHud(panel){
    let healthHud=document.createElement("div");
    healthHud.style.cssText=[
      "position:fixed",
      "top:18px",
      `left:${panel.side==="left" ? "25%" : "75%"}`,
      "transform:translateX(-50%)",
      "width:min(320px,34vw)",
      "height:22px",
      "background:rgba(20,28,34,0.42)",
      "box-shadow:0 4px 14px rgba(0,0,0,0.24)",
      "z-index:10",
      "overflow:hidden",
      "font-family:Arial,sans-serif"
    ].join(";");

    let healthFill=document.createElement("div");
    healthFill.style.cssText=[
      "height:100%",
      "width:100%",
      "background:linear-gradient(90deg,#2fd36b,#a8e85d)",
      "transition:width 160ms ease,background 160ms ease"
    ].join(";");

    let healthLabel=document.createElement("div");
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
    panel.healthFill=healthFill;
    panel.healthLabel=healthLabel;
  }

  function makeSpeedHud(panel){
    let speedHud=document.createElement("div");
    speedHud.style.cssText=[
      "position:fixed",
      "top:50px",
      `left:calc(${panelOffset(panel)} + 18px)`,
      "width:122px",
      "height:100px",
      "background:rgba(20,28,34,0.42)",
      "box-shadow:0 4px 14px rgba(0,0,0,0.2)",
      "z-index:10",
      "overflow:hidden",
      "font-family:Arial,sans-serif",
      "letter-spacing:0",
      "color:white",
      "pointer-events:none"
    ].join(";");

    let speedCanvas=document.createElement("canvas");
    speedCanvas.width=122;
    speedCanvas.height=100;
    speedCanvas.style.cssText="display:block;width:122px;height:100px";
    let speedCtx=speedCanvas.getContext("2d");

    let speedLabel=document.createElement("div");
    speedLabel.style.cssText=[
      "position:absolute",
      "left:0",
      "right:0",
      "bottom:11px",
      "text-align:center",
      "font-size:17px",
      "font-weight:800",
      "line-height:1",
      "text-shadow:0 1px 2px rgba(0,0,0,0.7)"
    ].join(";");

    speedHud.appendChild(speedCanvas);
    speedHud.appendChild(speedLabel);
    document.body.appendChild(speedHud);
    panel.speedCanvas=speedCanvas;
    panel.speedCtx=speedCtx;
    panel.speedLabel=speedLabel;
  }

  function drawSpeedHud(panel,state){
    if(!panel.speedCtx || !panel.speedLabel) return;

    let speed=Math.round(Math.abs(state.carSpeed)*50);
    let maxSpeed=80;
    let pct=Math.max(0,Math.min(1,speed/maxSpeed));
    let start=Math.PI*0.82;
    let end=Math.PI*2.18;
    let angle=start+(end-start)*pct;
    let cx=61;
    let cy=55;
    let radius=40;
    let ctx=panel.speedCtx;

    ctx.clearRect(0,0,panel.speedCanvas.width,panel.speedCanvas.height);
    ctx.lineCap="round";

    ctx.strokeStyle="rgba(255,255,255,0.18)";
    ctx.lineWidth=7;
    ctx.beginPath();
    ctx.arc(cx,cy,radius,start,end);
    ctx.stroke();

    ctx.strokeStyle=panel.color;
    ctx.lineWidth=7;
    ctx.beginPath();
    ctx.arc(cx,cy,radius,start,angle);
    ctx.stroke();

    for(let i=0;i<=8;i++){
      let t=i/8;
      let tickAngle=start+(end-start)*t;
      let inner=radius-(i%2===0 ? 12 : 8);
      let outer=radius-2;
      ctx.strokeStyle=i%2===0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.42)";
      ctx.lineWidth=i%2===0 ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(tickAngle)*inner,cy+Math.sin(tickAngle)*inner);
      ctx.lineTo(cx+Math.cos(tickAngle)*outer,cy+Math.sin(tickAngle)*outer);
      ctx.stroke();
    }

    ctx.strokeStyle="#f1f4f0";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(angle)*(radius-14),cy+Math.sin(angle)*(radius-14));
    ctx.stroke();

    ctx.fillStyle="#f1f4f0";
    ctx.beginPath();
    ctx.arc(cx,cy,4,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle="rgba(255,255,255,0.72)";
    ctx.font="700 9px Arial";
    ctx.textAlign="center";
    ctx.fillText("0",22,66);
    ctx.fillText("80",100,66);
    panel.speedLabel.textContent=speed;
  }

  function makeMapHud(panel){
    let mapHud=document.createElement("div");
    mapHud.style.cssText=[
      "position:fixed",
      "top:50px",
      `right:${panel.side==="left" ? "calc(50% + 18px)" : "18px"}`,
      "width:180px",
      "height:180px",
      "background:rgba(20,28,34,0.42)",
      "box-shadow:0 4px 14px rgba(0,0,0,0.2)",
      "z-index:10",
      "overflow:hidden",
      "pointer-events:none"
    ].join(";");

    let mapCanvas=document.createElement("canvas");
    mapCanvas.width=180;
    mapCanvas.height=180;
    mapCanvas.style.cssText="display:block;width:180px;height:180px";
    let mapCtx=mapCanvas.getContext("2d");
    mapHud.appendChild(mapCanvas);
    document.body.appendChild(mapHud);
    panel.mapCanvas=mapCanvas;
    panel.mapCtx=mapCtx;
  }

  function mapToCanvas(wx,wz,cx,cz,radius,size){
    return {
      x:(wx-(cx-radius))/(radius*2)*size,
      y:(wz-(cz-radius))/(radius*2)*size
    };
  }

  function drawMapHud(panel,state,states){
    if(!panel.mapCtx) return;

    let mapCtx=panel.mapCtx;
    let mapCanvas=panel.mapCanvas;
    let size=mapCanvas.width;
    let centerX=state.carX;
    let centerZ=state.carZ;
    let radius=chunkSize*2.3;

    mapCtx.clearRect(0,0,size,size);
    let cells=32;
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
    mapCtx.lineWidth=5;
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
    mapCtx.lineWidth=1.3;
    mapCtx.beginPath();
    for(let i=0;i<=80;i++){
      let z=centerZ-radius+(i/80)*radius*2;
      let x=roadCenterX(z);
      let p=mapToCanvas(x,z,centerX,centerZ,radius,size);
      if(i===0) mapCtx.moveTo(p.x,p.y);
      else mapCtx.lineTo(p.x,p.y);
    }
    mapCtx.stroke();

    drawMapBuildings(mapCtx,centerX,centerZ,radius,size);
    drawOtherCars(mapCtx,state,states,centerX,centerZ,radius,size);

    mapCtx.save();
    mapCtx.translate(size*0.5,size*0.5);
    mapCtx.rotate(-state.carVelAngle+Math.PI);
    mapCtx.fillStyle=panel.color;
    mapCtx.strokeStyle="white";
    mapCtx.lineWidth=1.6;
    mapCtx.beginPath();
    mapCtx.moveTo(0,-7);
    mapCtx.lineTo(5,6);
    mapCtx.lineTo(0,3.5);
    mapCtx.lineTo(-5,6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
  }

  function drawOtherCars(mapCtx,state,states,centerX,centerZ,radius,size){
    for(let other of states){
      if(!other || other.id===state.id) continue;

      let p=mapToCanvas(other.carX,other.carZ,centerX,centerZ,radius,size);
      if(p.x<-8 || p.x>size+8 || p.y<-8 || p.y>size+8) continue;

      mapCtx.fillStyle=other.color;
      mapCtx.strokeStyle="white";
      mapCtx.lineWidth=1.5;
      mapCtx.beginPath();
      mapCtx.arc(p.x,p.y,4.5,0,Math.PI*2);
      mapCtx.fill();
      mapCtx.stroke();
    }
  }

  function drawMapBuildings(mapCtx,centerX,centerZ,radius,size){
    mapCtx.fillStyle="#f2d04e";
    mapCtx.strokeStyle="rgba(20,28,34,0.82)";
    mapCtx.lineWidth=1.3;
    for(let chunk of getChunks().values()){
      if(!chunk.gasStationAdded || !chunk.gasStationSpawn) continue;
      let spawn=chunk.gasStationSpawn;
      let p=mapToCanvas(spawn.x,spawn.z,centerX,centerZ,radius,size);
      if(p.x<-8 || p.x>size+8 || p.y<-8 || p.y>size+8) continue;

      mapCtx.beginPath();
      mapCtx.rect(p.x-3.5,p.y-4.5,7,9);
      mapCtx.fill();
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(p.x+3.5,p.y-2);
      mapCtx.lineTo(p.x+6,p.y+1);
      mapCtx.lineTo(p.x+6,p.y+4.5);
      mapCtx.stroke();
    }

    mapCtx.fillStyle="#d9edf2";
    mapCtx.strokeStyle="rgba(20,28,34,0.82)";
    mapCtx.lineWidth=1.3;
    for(let chunk of getChunks().values()){
      if(!chunk.garageAdded || !chunk.garageSpawn) continue;
      let spawn=chunk.garageSpawn;
      let p=mapToCanvas(spawn.x,spawn.z,centerX,centerZ,radius,size);
      if(p.x<-8 || p.x>size+8 || p.y<-8 || p.y>size+8) continue;

      mapCtx.beginPath();
      mapCtx.moveTo(p.x-4.5,p.y-1);
      mapCtx.lineTo(p.x,p.y-5.5);
      mapCtx.lineTo(p.x+4.5,p.y-1);
      mapCtx.lineTo(p.x+4.5,p.y+4.5);
      mapCtx.lineTo(p.x-4.5,p.y+4.5);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.stroke();
    }
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
    let states=getCarStates();
    for(let i=0;i<panels.length;i++){
      let panel=panels[i];
      let state=states[i];
      if(!panel.healthFill || !panel.healthLabel || !state) continue;

      let pct=Math.max(0,Math.min(100,state.carHealth));
      panel.healthFill.style.width=pct+"%";
      panel.healthFill.style.background=pct>55
        ? "linear-gradient(90deg,#2fd36b,#a8e85d)"
        : pct>25
          ? "linear-gradient(90deg,#f0b83f,#f4df65)"
          : "linear-gradient(90deg,#d83a34,#f0715c)";
      panel.healthLabel.textContent=state.label+" Health "+Math.round(pct)+"%";
    }
  }

  function updateSpeedHud(){
    let states=getCarStates();
    for(let i=0;i<panels.length;i++){
      drawSpeedHud(panels[i],states[i]);
    }
  }

  function updateMapHud(force=false){
    if(!force && mapUpdateFrame++%6!==0) return;
    let states=getCarStates();
    for(let i=0;i<panels.length;i++){
      drawMapHud(panels[i],states[i],states);
    }
  }

  function showGameOverOverlay(){
    if(gameOverOverlay){
      gameOverOverlay.style.display="flex";
    }
  }

  function init(){
    panels=[
      {side:"left",label:"P1",color:"#d62f2f"},
      {side:"right",label:"P2",color:"#3d6ee8"}
    ];

    for(let panel of panels){
      makeHealthHud(panel);
      makeSpeedHud(panel);
      makeMapHud(panel);
    }
    makeGameOverOverlay();
    updateHealthHud();
    updateSpeedHud();
    updateMapHud(true);
  }

  return {
    init,
    updateHealthHud,
    updateSpeedHud,
    updateMapHud,
    showGameOverOverlay
  };
}
