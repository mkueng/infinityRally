import { chunkSize } from "./constants.js";
import { carSurfaceHeight } from "./terrain.js?v=no-ramps";

export function createHud({getCarStates,getChunks,getEnemyStates=()=>[],getStationState=()=>null,getPerformanceMode=()=>"full",getEnvironment=()=>({})}){
  let panels=[];
  let gameOverOverlay;
  let mapUpdateFrame=0;
  let compassUpdateFrame=0;

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
      "height:214px",
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
      "left:12px",
      "right:12px",
      "top:104px",
      "display:flex",
      "flex-direction:column",
      "gap:5px",
      "font-size:14px",
      "font-weight:900",
      "line-height:1",
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
    let maxSpeed=120;
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
    ctx.fillText("120",100,66);
    if(panel.ammoLabel){
      let ammoRows=[
        {icon:"rocket",value:state.rocketAmmo ?? 0,color:"#e36b44"},
        {icon:"cannon",value:state.cannonAmmo ?? 0,color:"#75d7e8"},
        {icon:"bomb",value:state.clusterBombAmmo ?? 0,color:"#d8aa4c"},
        {icon:"carRocket",value:state.carRocketAmmo ?? 0,color:"#ff9a4d"}
      ];
      panel.ammoLabel.innerHTML=[
        ...ammoRows.map(row=>[
          `<span style="display:flex;align-items:center;justify-content:space-between;height:18px">`,
          ammoIcon(row.icon,row.color),
          `<span>${row.value}</span>`,
          `</span>`
        ].join(""))
      ].join("");
    }
    if(panel.boostFill){
      let boostPct=Math.max(0,Math.min(100,state.boostCharge ?? 0));
      panel.boostFill.style.width=boostPct+"%";
    }
  }

  function ammoIcon(kind,color){
    if(kind==="rocket"){
      return [
        `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">`,
        `<path d="M9.8 1.5l4.4 2.6 1.2 3.8-4.9 5.2-5.6-5.4 4.9-6.2z" fill="#26313b"/>`,
        `<path d="M10.2 3.2l2.6 1.5 0.6 2.1-3.2 3.5-3.1-3 3.1-4.1z" fill="${color}"/>`,
        `<path d="M4.3 8.2l5.3 5.1-3.1 1.6-3.8-3.7 1.6-3z" fill="#51606c"/>`,
        `<path d="M2.8 12.2l1.6 1.6-2.4 1.1 0.8-2.7z" fill="#b9f4ff"/>`,
        `</svg>`
      ].join("");
    }
    if(kind==="cannon"){
      return [
        `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">`,
        `<path d="M2.2 9.1h8.7l1.2-1.6h3.6v3.1h-3.6l-1.2 1.5H2.2V9.1z" fill="#2b3942"/>`,
        `<path d="M4.1 9.8h6.3v1.6H4.1V9.8z" fill="${color}"/>`,
        `<path d="M2.9 12.2h3.1l1.2 2.1H4.1l-1.2-2.1z" fill="#64717a"/>`,
        `<path d="M13.2 8.3h2.8v1.2h-2.8V8.3z" fill="#d8f8ff"/>`,
        `</svg>`
      ].join("");
    }
    if(kind==="carRocket"){
      return [
        `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">`,
        `<path d="M2.2 12.3h13.6v2H2.2v-2z" fill="#30383f"/>`,
        `<path d="M4.1 10.1h9.8l1.2 2.2H2.9l1.2-2.2z" fill="#4c5961"/>`,
        `<path d="M5.4 6.7h2.2v3.7H5.4V6.7z" fill="#26313b"/>`,
        `<path d="M10.4 6.7h2.2v3.7h-2.2V6.7z" fill="#26313b"/>`,
        `<path d="M6.5 2.3l1.5 1.3 0.3 2.9H4.8l0.3-2.9 1.4-1.3z" fill="${color}"/>`,
        `<path d="M11.5 2.3l1.5 1.3 0.3 2.9H9.8l0.3-2.9 1.4-1.3z" fill="${color}"/>`,
        `<path d="M5.6 7.5h1.8v1.3H5.6V7.5zM10.6 7.5h1.8v1.3h-1.8V7.5z" fill="#d8f8ff"/>`,
        `</svg>`
      ].join("");
    }
    return [
      `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">`,
      `<path d="M5.2 6.2h6.2l2.4 3.6-1.8 5H4.6l-1.8-5 2.4-3.6z" fill="#2d3338"/>`,
      `<path d="M6.3 7.4h4.1l1.7 2.6-1.1 3.2H5.7L4.6 10l1.7-2.6z" fill="${color}"/>`,
      `<path d="M8.2 3.1h3.9v1.7H8.2V3.1z" fill="#6e7a82"/>`,
      `<path d="M11.4 2.2h3.2v1.1h-3.2V2.2z" fill="#b9f4ff"/>`,
      `</svg>`
    ].join("");
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

    let scoreLabel=document.createElement("div");
    scoreLabel.style.cssText=[
      "position:fixed",
      "top:138px",
      `left:${panel.side==="full" ? "50%" : panel.side==="left" ? "25%" : "75%"}`,
      "transform:translateX(-50%)",
      "z-index:11",
      "font-family:\"Microgramma D Extended\",\"Eurostile Extended\",\"Bank Gothic\",\"Copperplate\",\"Arial Black\",Arial,sans-serif",
      "font-size:22px",
      "font-weight:900",
      "letter-spacing:0.1em",
      "color:rgba(245,255,249,0.94)",
      "text-shadow:0 0 6px rgba(103,244,255,0.58),0 3px 0 rgba(0,0,0,0.68)",
      "text-transform:uppercase",
      "pointer-events:none"
    ].join(";");
    document.body.appendChild(scoreLabel);

    panel.compassCanvas=compassCanvas;
    panel.compassCtx=compassCtx;
    panel.scoreLabel=scoreLabel;
  }

  function mapToCanvas(wx,wz,cx,cz,radius,size){
    return {
      x:(wx-(cx-radius))/(radius*2)*size,
      y:(wz-(cz-radius))/(radius*2)*size
    };
  }

  function hexToRgb(color,fallback=0xffffff){
    let value=Number.isFinite(color) ? color : fallback;
    return {
      r:(value>>16)&255,
      g:(value>>8)&255,
      b:value&255
    };
  }

  function rgba(color,alpha,fallback=0xffffff){
    let {r,g,b}=hexToRgb(color,fallback);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function mapPalette(){
    let environment=getEnvironment() || {};
    let colors=environment.colors || {};
    return {
      water:rgba(colors.water,0.5,0x20ffd4),
      low:rgba(colors.low,0.95,0x8b3852),
      mid:rgba(colors.mid,0.96,0x5a3b70),
      high:rgba(colors.high,0.96,0x3f3456),
      border:rgba(colors.water || colors.trim,0.26,0x8dfff2),
      outline:rgba(colors.trim || colors.water,0.95,0x8dfff2),
      villageFill:rgba(colors.shore || colors.wall,0.24,0xd6b25a),
      villageStroke:rgba(colors.trim || colors.shore,0.82,0xffe26f),
      bossFill:rgba(colors.pod || colors.trim,0.28,0xff5c36),
      bossStroke:rgba(colors.podEmissive || colors.pod,0.92,0xff6a42),
      stationFill:rgba(colors.trim || colors.water,0.36,0x8dfff2),
      stationStroke:rgba(colors.water || colors.trim,0.96,0xb9f4ff),
      clearedFill:rgba(colors.grass || colors.leaf,0.18,0x7cff78),
      clearedStroke:rgba(colors.grass || colors.leaf,0.72,0x7cff78)
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
    let palette=mapPalette();

    mapCtx.clearRect(0,0,size,size);
    let cells=getPerformanceMode()==="split" ? 32 : 48;
    let cellSize=size/cells;
    for(let gy=0;gy<cells;gy++){
      for(let gx=0;gx<cells;gx++){
        let wx=centerX-radius+((gx+0.5)/cells)*radius*2;
        let wz=centerZ-radius+((gy+0.5)/cells)*radius*2;
        let h=carSurfaceHeight(wx,wz);
        if(h<-20) mapCtx.fillStyle=palette.water;
        else if(h<15) mapCtx.fillStyle=palette.low;
        else if(h<30) mapCtx.fillStyle=palette.mid;
        else mapCtx.fillStyle=palette.high;
        mapCtx.fillRect(gx*cellSize,gy*cellSize,cellSize+1,cellSize+1);
      }
    }

    mapCtx.strokeStyle=palette.border;
    mapCtx.lineWidth=1;
    mapCtx.strokeRect(0.5,0.5,size-1,size-1);

    drawVillages(mapCtx,centerX,centerZ,radius,size,palette);
    drawStationMarker(mapCtx,getStationState(),centerX,centerZ,radius,size,palette);
    drawEnemyDots(mapCtx,enemies,centerX,centerZ,radius,size);
    drawOtherCars(mapCtx,state,states,centerX,centerZ,radius,size,palette);

    mapCtx.save();
    mapCtx.translate(size*0.5,size*0.5);
    mapCtx.rotate(-state.carVelAngle+Math.PI);
    mapCtx.fillStyle=panel.color;
    mapCtx.strokeStyle=palette.outline;
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

  function drawVillages(mapCtx,centerX,centerZ,radius,size,palette){
    let chunks=getChunks();
    if(!chunks) return;

    for(let chunk of chunks.values()){
      if(!chunk.villageCenters) continue;
      for(let village of chunk.villageCenters){
        let p=mapToCanvas(village.x,village.z,centerX,centerZ,radius,size);
        let villageSize=Math.max(12,Math.min(36,((village.r || 28)/(radius*2))*size*2));
        let halfVillageSize=villageSize*0.5;
        if(p.x<-halfVillageSize || p.x>size+halfVillageSize || p.y<-halfVillageSize || p.y>size+halfVillageSize) continue;

        let cleared=!!(village.buildings && village.buildings.length>0 && village.buildings.every(building=>building.destroyed));
        let boss=!!village.bossVillage;
        mapCtx.fillStyle=cleared ? palette.clearedFill : boss ? palette.bossFill : palette.villageFill;
        mapCtx.strokeStyle=cleared ? palette.clearedStroke : boss ? palette.bossStroke : palette.villageStroke;
        mapCtx.lineWidth=1.3;
        mapCtx.fillRect(p.x-halfVillageSize,p.y-halfVillageSize,villageSize,villageSize);
        mapCtx.strokeRect(p.x-halfVillageSize+0.5,p.y-halfVillageSize+0.5,villageSize-1,villageSize-1);

        mapCtx.fillStyle=cleared ? palette.clearedStroke : boss ? palette.bossStroke : palette.villageStroke;
        mapCtx.fillRect(p.x-2.5,p.y-2.5,5,5);
      }
    }
  }

  function drawStationMarker(mapCtx,station,centerX,centerZ,radius,size,palette){
    if(!station) return;

    let p=mapToCanvas(station.x,station.z,centerX,centerZ,radius,size);
    if(p.x<-14 || p.x>size+14 || p.y<-14 || p.y>size+14) return;

    let pulse=0.5+0.5*Math.sin(performance.now()*0.004);
    let outer=7.5+pulse*1.6;
    mapCtx.save();
    mapCtx.translate(p.x,p.y);
    mapCtx.strokeStyle=palette.stationStroke;
    mapCtx.fillStyle=palette.stationFill;
    mapCtx.lineWidth=1.8;
    mapCtx.beginPath();
    mapCtx.arc(0,0,outer,0,Math.PI*2);
    mapCtx.fill();
    mapCtx.stroke();

    mapCtx.strokeStyle=`rgba(245,255,249,${0.58+pulse*0.3})`;
    mapCtx.lineWidth=1.4;
    mapCtx.beginPath();
    mapCtx.moveTo(-outer-3,0);
    mapCtx.lineTo(-3,0);
    mapCtx.moveTo(3,0);
    mapCtx.lineTo(outer+3,0);
    mapCtx.moveTo(0,-outer-3);
    mapCtx.lineTo(0,-3);
    mapCtx.moveTo(0,3);
    mapCtx.lineTo(0,outer+3);
    mapCtx.stroke();

    mapCtx.fillStyle=palette.stationStroke;
    mapCtx.fillRect(-2.5,-2.5,5,5);
    mapCtx.restore();
  }

  function drawOtherCars(mapCtx,state,states,centerX,centerZ,radius,size,palette){
    for(let other of states){
      if(!other || other.id===state.id) continue;

      let p=mapToCanvas(other.carX,other.carZ,centerX,centerZ,radius,size);
      if(p.x<-8 || p.x>size+8 || p.y<-8 || p.y>size+8) continue;

      mapCtx.fillStyle=other.color;
      mapCtx.strokeStyle=palette.outline;
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

  function drawCompassStationMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette){
    let station=getStationState();
    if(!station) return;

    let dx=station.x-state.carX;
    let dz=station.z-state.carZ;
    if(dx*dx+dz*dz<1) return;

    let heading=state.carVelAngle || 0;
    let stationAngle=Math.atan2(dx,dz);
    let delta=normalizeAngle(stationAngle-heading);
    let inView=Math.abs(delta)<=viewHalf;
    let t=Math.max(-1,Math.min(1,delta/viewHalf));
    let theta=-Math.PI/2+t*arcHalf;
    let markerRadius=radius-42;
    let x=cx+Math.cos(theta)*markerRadius;
    let y=cy+Math.sin(theta)*markerRadius;
    let pulse=0.5+0.5*Math.sin(performance.now()*0.006);
    let alpha=inView ? 0.76+pulse*0.22 : 0.42+pulse*0.18;
    let outer=inView ? 6.2+pulse*1.2 : 6.2;

    ctx.save();
    ctx.translate(x,y);
    ctx.strokeStyle=palette.stationStroke;
    ctx.fillStyle=inView ? palette.stationFill : `rgba(245,255,249,${alpha*0.22})`;
    ctx.lineWidth=1.8;

    ctx.beginPath();
    ctx.arc(0,0,outer,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle=`rgba(245,255,249,${alpha})`;
    ctx.lineWidth=1.35;
    ctx.beginPath();
    ctx.moveTo(-outer-3,0);
    ctx.lineTo(-3,0);
    ctx.moveTo(3,0);
    ctx.lineTo(outer+3,0);
    ctx.moveTo(0,-outer-3);
    ctx.lineTo(0,-3);
    ctx.moveTo(0,3);
    ctx.lineTo(0,outer+3);
    ctx.stroke();

    ctx.fillStyle=palette.stationStroke;
    ctx.fillRect(-2.2,-2.2,4.4,4.4);

    ctx.restore();
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
    let palette=mapPalette();

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

    drawCompassStationMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette);

    ctx.strokeStyle="rgba(255,255,255,0.92)";
    ctx.fillStyle="rgba(255,255,255,0.92)";
    ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(cx,13);
    ctx.lineTo(cx-5,24);
    ctx.lineTo(cx+5,24);
    ctx.closePath();
    ctx.fill();

    if(panel.scoreLabel){
      panel.scoreLabel.textContent=`Score ${Math.max(0,Math.round(state.score ?? 0))}`;
    }
  }

  function makeGameOverOverlay(){
    gameOverOverlay=document.createElement("div");
    gameOverOverlay.textContent="Game Over";
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
    let interval=getPerformanceMode()==="split" ? 12 : 6;
    if(!force && mapUpdateFrame++%interval!==0) return;
    let states=getCarStates();
    let enemies=getEnemyStates();
    for(let i=0;i<panels.length;i++){
      drawMapHud(panels[i],states[i],states,enemies);
    }
  }

  function updateCompassHud(){
    if(getPerformanceMode()==="split" && compassUpdateFrame++%2!==0) return;
    let states=getCarStates();
    for(let i=0;i<panels.length;i++){
      drawCompassHud(panels[i],states[i]);
    }
  }

  function showGameOverOverlay(label="Game Over"){
    if(gameOverOverlay){
      gameOverOverlay.textContent=label;
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
