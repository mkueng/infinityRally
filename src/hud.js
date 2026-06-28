import { chunkSize } from "./constants.js";
import { carSurfaceHeight } from "./terrain.js";

export function createHud({getCarStates,getChunks,getEnemyStates=()=>[]}){
  let panels=[];
  let gameOverOverlay;
  let mapUpdateFrame=0;

  function panelOffset(panel){
    if(panel.side==="full") return "0%";
    return panel.side==="left" ? 0 : "50%";
  }

  function makeHealthHud(panel){
    let healthHud=document.createElement("div");
    healthHud.style.cssText=[
      "position:fixed",
      "top:18px",
      `left:${panel.side==="full" ? "50%" : panel.side==="left" ? "25%" : "75%"}`,
      "transform:translateX(-50%)",
      `width:${panel.side==="full" ? "min(430px,58vw)" : "min(300px,40vw)"}`,
      "height:22px",
      "background:rgba(18,7,43,0.1)",
      "box-shadow:0 4px 14px rgba(0,0,0,0.08)",
      "z-index:10",
      "overflow:hidden",
      "font-family:Arial,sans-serif"
    ].join(";");

    let healthFill=document.createElement("div");
    healthFill.style.cssText=[
      "height:100%",
      "width:100%",
      "background:linear-gradient(90deg,rgba(47,211,107,0.46),rgba(168,232,93,0.46))",
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
      "height:154px",
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

    let ammoLabel=document.createElement("div");
    ammoLabel.style.cssText=[
      "position:absolute",
      "left:8px",
      "right:8px",
      "bottom:25px",
      "display:grid",
      "grid-template-columns:1fr 1fr",
      "gap:6px",
      "font-size:14px",
      "font-weight:900",
      "line-height:1",
      "text-align:center",
      "color:rgba(245,255,249,0.92)",
      "text-shadow:0 1px 2px rgba(0,0,0,0.72)"
    ].join(";");

    let boostTrack=document.createElement("div");
    boostTrack.style.cssText=[
      "position:absolute",
      "left:10px",
      "right:10px",
      "bottom:8px",
      "height:8px",
      "background:rgba(255,255,255,0.16)",
      "overflow:hidden"
    ].join(";");

    let boostFill=document.createElement("div");
    boostFill.style.cssText=[
      "height:100%",
      "width:100%",
      "background:linear-gradient(90deg,#7ff8ff,#d6b25a)",
      "transition:width 100ms linear"
    ].join(";");
    boostTrack.appendChild(boostFill);

    speedHud.appendChild(speedCanvas);
    speedHud.appendChild(ammoLabel);
    speedHud.appendChild(boostTrack);
    document.body.appendChild(speedHud);
    panel.speedCanvas=speedCanvas;
    panel.speedCtx=speedCtx;
    panel.ammoLabel=ammoLabel;
    panel.boostFill=boostFill;
  }

  function drawSpeedHud(panel,state){
    if(!panel.speedCtx) return;

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
    if(panel.ammoLabel){
      panel.ammoLabel.innerHTML=[
        `<span>R ${state.rocketAmmo ?? 0}</span>`,
        `<span>C ${state.cannonAmmo ?? 0}</span>`
      ].join("");
    }
    if(panel.boostFill){
      let boostPct=Math.max(0,Math.min(100,state.boostCharge ?? 0));
      panel.boostFill.style.width=boostPct+"%";
    }
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

  function makeCompassHud(panel){
    let compassHud=document.createElement("div");
    compassHud.style.cssText=[
      "position:fixed",
      "top:44px",
      `left:${panel.side==="full" ? "50%" : panel.side==="left" ? "25%" : "75%"}`,
      "transform:translateX(-50%)",
      `width:${panel.side==="full" ? "min(430px,58vw)" : "min(300px,40vw)"}`,
      "height:74px",
      "z-index:11",
      "pointer-events:none"
    ].join(";");

    let compassCanvas=document.createElement("canvas");
    compassCanvas.width=430;
    compassCanvas.height=74;
    compassCanvas.style.cssText="display:block;width:100%;height:74px";
    let compassCtx=compassCanvas.getContext("2d");
    compassHud.appendChild(compassCanvas);
    document.body.appendChild(compassHud);
    panel.compassCanvas=compassCanvas;
    panel.compassCtx=compassCtx;
  }

  function mapToCanvas(wx,wz,cx,cz,radius,size){
    return {
      x:(wx-(cx-radius))/(radius*2)*size,
      y:(wz-(cz-radius))/(radius*2)*size
    };
  }

  function drawMapHud(panel,state,states,enemies){
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
        if(h>34) mapCtx.fillStyle="rgba(63,52,86,0.96)";
        else if(h>22) mapCtx.fillStyle="rgba(90,59,112,0.96)";
        else if(h>8) mapCtx.fillStyle="rgba(139,56,82,0.95)";
        else if(h>-19) mapCtx.fillStyle="rgba(111,45,70,0.94)";
        else mapCtx.fillStyle="rgba(32,255,212,0.5)";
        mapCtx.fillRect(gx*cellSize,gy*cellSize,cellSize+1,cellSize+1);
      }
    }

    mapCtx.strokeStyle="rgba(141,255,242,0.22)";
    mapCtx.lineWidth=1;
    mapCtx.strokeRect(0.5,0.5,size-1,size-1);

    drawEnemyDots(mapCtx,enemies,centerX,centerZ,radius,size);
    drawOtherCars(mapCtx,state,states,centerX,centerZ,radius,size);

    mapCtx.save();
    mapCtx.translate(size*0.5,size*0.5);
    mapCtx.rotate(-state.carVelAngle+Math.PI);
    mapCtx.fillStyle=panel.color;
    mapCtx.strokeStyle="rgba(141,255,242,0.95)";
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
      mapCtx.strokeStyle="rgba(141,255,242,0.95)";
      mapCtx.lineWidth=1.5;
      mapCtx.beginPath();
      mapCtx.arc(p.x,p.y,4.5,0,Math.PI*2);
      mapCtx.fill();
      mapCtx.stroke();
    }
  }

  function drawEnemyDots(mapCtx,enemies,centerX,centerZ,radius,size){
    let blink=0.5+0.5*Math.sin(performance.now()*0.008);
    let dotRadius=3.2+blink*2.4;

    for(let enemy of enemies){
      if(!enemy || enemy.health<=0) continue;

      let p=mapToCanvas(enemy.x,enemy.z,centerX,centerZ,radius,size);
      if(p.x<-8 || p.x>size+8 || p.y<-8 || p.y>size+8) continue;

      mapCtx.fillStyle=`rgba(255,58,36,${0.45+blink*0.45})`;
      mapCtx.strokeStyle=`rgba(255,245,190,${0.38+blink*0.42})`;
      mapCtx.lineWidth=1.4;
      mapCtx.beginPath();
      mapCtx.arc(p.x,p.y,dotRadius,0,Math.PI*2);
      mapCtx.fill();
      mapCtx.stroke();

      mapCtx.fillStyle="rgba(255,255,255,0.82)";
      mapCtx.beginPath();
      mapCtx.arc(p.x,p.y,1.6,0,Math.PI*2);
      mapCtx.fill();
    }
  }

  function normalizeAngle(angle){
    while(angle>Math.PI) angle-=Math.PI*2;
    while(angle<-Math.PI) angle+=Math.PI*2;
    return angle;
  }

  function drawCompassHud(panel,state){
    if(!panel.compassCtx || !state) return;

    let ctx=panel.compassCtx;
    let canvas=panel.compassCanvas;
    let width=canvas.width;
    let height=canvas.height;
    let cx=width*0.5;
    let cy=112;
    let radius=99;
    let arcHalf=Math.PI*0.36;
    let viewHalf=Math.PI*0.82;
    let heading=state.carVelAngle || 0;

    ctx.clearRect(0,0,width,height);

    let gradient=ctx.createLinearGradient(0,0,0,height);
    gradient.addColorStop(0,"rgba(18,7,43,0.08)");
    gradient.addColorStop(0.55,"rgba(51,20,95,0.2)");
    gradient.addColorStop(1,"rgba(18,7,43,0)");
    ctx.fillStyle=gradient;
    ctx.fillRect(0,0,width,height);

    ctx.lineCap="round";
    ctx.strokeStyle="rgba(141,255,242,0.34)";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(cx,cy,radius,-Math.PI/2-arcHalf,-Math.PI/2+arcHalf);
    ctx.stroke();

    ctx.strokeStyle="rgba(240,140,113,0.45)";
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.arc(cx,cy,radius-12,-Math.PI/2-arcHalf*0.88,-Math.PI/2+arcHalf*0.88);
    ctx.stroke();

    for(let i=-4;i<=4;i++){
      let t=i/4;
      let theta=-Math.PI/2+t*arcHalf;
      let major=i===0 || Math.abs(i)===4;
      let inner=radius-(major ? 16 : 10);
      let outer=radius-1;
      ctx.strokeStyle=major ? "rgba(141,255,242,0.78)" : "rgba(141,255,242,0.38)";
      ctx.lineWidth=major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(theta)*inner,cy+Math.sin(theta)*inner);
      ctx.lineTo(cx+Math.cos(theta)*outer,cy+Math.sin(theta)*outer);
      ctx.stroke();
    }

    let cardinals=[
      {label:"N",angle:0},
      {label:"E",angle:Math.PI/2},
      {label:"S",angle:Math.PI},
      {label:"W",angle:-Math.PI/2}
    ];

    ctx.textAlign="center";
    ctx.textBaseline="middle";
    for(let dir of cardinals){
      let delta=normalizeAngle(dir.angle-heading);
      if(Math.abs(delta)>viewHalf) continue;

      let t=delta/viewHalf;
      let theta=-Math.PI/2+t*arcHalf;
      let x=cx+Math.cos(theta)*(radius-25);
      let y=cy+Math.sin(theta)*(radius-25);
      let alpha=1-Math.pow(Math.abs(t),1.8)*0.58;
      let scale=1.12-Math.abs(t)*0.22;

      ctx.font=`800 ${Math.round(18*scale)}px Arial`;
      ctx.fillStyle=`rgba(245,255,249,${alpha})`;
      ctx.strokeStyle=`rgba(18,7,43,${0.78*alpha})`;
      ctx.lineWidth=3;
      ctx.strokeText(dir.label,x,y);
      ctx.fillText(dir.label,x,y);
    }

    ctx.strokeStyle="rgba(255,255,255,0.92)";
    ctx.fillStyle="rgba(255,255,255,0.92)";
    ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(cx,13);
    ctx.lineTo(cx-5,24);
    ctx.lineTo(cx+5,24);
    ctx.closePath();
    ctx.fill();
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
        ? "linear-gradient(90deg,rgba(47,211,107,0.46),rgba(168,232,93,0.46))"
        : pct>25
          ? "linear-gradient(90deg,rgba(240,184,63,0.46),rgba(244,223,101,0.46))"
          : "linear-gradient(90deg,rgba(216,58,52,0.46),rgba(240,113,92,0.46))";
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
    let enemies=getEnemyStates();
    for(let i=0;i<panels.length;i++){
      drawMapHud(panels[i],states[i],states,enemies);
    }
  }

  function updateCompassHud(){
    let states=getCarStates();
    for(let i=0;i<panels.length;i++){
      drawCompassHud(panels[i],states[i]);
    }
  }

  function showGameOverOverlay(){
    if(gameOverOverlay){
      gameOverOverlay.style.display="flex";
    }
  }

  function init(){
    let states=getCarStates();
    panels=states.map((state,index)=>({
      side:states.length<=1 ? "full" : index===0 ? "left" : "right",
      label:state.label,
      color:state.color
    }));

    for(let panel of panels){
      makeHealthHud(panel);
      makeSpeedHud(panel);
      makeMapHud(panel);
      makeCompassHud(panel);
    }
    makeGameOverOverlay();
    updateHealthHud();
    updateSpeedHud();
    updateMapHud(true);
    updateCompassHud();
  }

  return {
    init,
    updateHealthHud,
    updateSpeedHud,
    updateMapHud,
    updateCompassHud,
    showGameOverOverlay
  };
}
