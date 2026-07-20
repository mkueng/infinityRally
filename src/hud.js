import { chunkSize } from "./constants.js";

const gameFontFamily="\"Astor\", Arial, sans-serif";
const mapHudSize=259;
const healthHudFullWidth="min(430px,58vw)";
const healthHudSplitWidth="min(300px,40vw)";
const compassFullCanvasWidth=430;
const compassSplitCanvasWidth=300;
const speedHudScale=1.2;
const speedHudWidth=mapHudSize/speedHudScale;
const laserHudFrames=300;

export function createHud({getCarStates,getChunks,getEnemyStates=()=>[],getStationState=()=>null,getNearestTradingOutpost=()=>null,getNearestBossBase=()=>null,getScannedBossBases=()=>[],getScannedTradingOutposts=()=>[],getScannedRadarOutposts=()=>[],getScannedLandingSpaces=()=>[],getScannedPortals=()=>[],getPerformanceMode=()=>"full",getEnvironment=()=>({}),getTerrainHeight=()=>0}){
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
      `width:${panel.side==="full" ? healthHudFullWidth : healthHudSplitWidth}`,
      "height:22px",
      "background:rgba(18,7,43,0.1)",
      "box-shadow:0 4px 14px rgba(0,0,0,0.08)",
      "z-index:10",
      "overflow:hidden",
      `font-family:${gameFontFamily}`
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
      `transform:scale(${speedHudScale})`,
      "transform-origin:top left",
      `width:${speedHudWidth}px`,
      "height:228px",
      "z-index:10",
      "overflow:hidden",
      `font-family:${gameFontFamily}`,
      "letter-spacing:0",
      "color:white",
      "pointer-events:none"
    ].join(";");

    let ammoLabel=document.createElement("div");
    ammoLabel.style.cssText=[
      "position:absolute",
      "left:12px",
      "right:12px",
      "top:12px",
      "display:flex",
      "flex-direction:column",
      "gap:3px",
      "font-size:15px",
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
      "bottom:22px",
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

    let laserTrack=document.createElement("div");
    laserTrack.style.cssText=[
      "position:absolute",
      "left:10px",
      "right:10px",
      "top:112px",
      "height:12px",
      "background:rgba(255,63,47,0.14)",
      "border:1px solid rgba(255,155,88,0.26)",
      "box-shadow:0 0 10px rgba(255,63,47,0.18)",
      "box-sizing:border-box",
      "overflow:hidden"
    ].join(";");

    let laserFill=document.createElement("div");
    laserFill.style.cssText=[
      "height:100%",
      "width:100%",
      "background:linear-gradient(90deg,#7a120b,#ff3f2f,#fff0c8)",
      "box-shadow:0 0 12px rgba(255,63,47,0.72)",
      "transition:width 80ms linear,opacity 120ms linear"
    ].join(";");
    laserTrack.appendChild(laserFill);

    let fuelTrack=document.createElement("div");
    fuelTrack.style.cssText=[
      "position:absolute",
      "left:10px",
      "right:10px",
      "bottom:8px",
      "height:8px",
      "background:rgba(255,255,255,0.16)",
      "overflow:hidden"
    ].join(";");

    let fuelFill=document.createElement("div");
    fuelFill.style.cssText=[
      "height:100%",
      "width:100%",
      "background:linear-gradient(90deg,#2fd36b,#7ff8ff)",
      "transition:width 100ms linear"
    ].join(";");
    fuelTrack.appendChild(fuelFill);
    speedHud.appendChild(ammoLabel);
    speedHud.appendChild(laserTrack);
    speedHud.appendChild(boostTrack);
    speedHud.appendChild(fuelTrack);
    document.body.appendChild(speedHud);
    panel.ammoLabel=ammoLabel;
    panel.laserFill=laserFill;
    panel.laserTrack=laserTrack;
    panel.boostFill=boostFill;
    panel.fuelFill=fuelFill;
  }

  function drawSpeedHud(panel,state){
    if(panel.ammoLabel){
      let ammoRows=[
        {icon:"rocket",value:state.rocketAmmo ?? 0,color:"#e36b44"},
        {icon:"cannon",value:state.cannonAmmo ?? 0,color:"#75d7e8"},
        {icon:"bomb",value:state.clusterBombAmmo ?? 0,color:"#d8aa4c"},
        {icon:"carRocket",value:state.carRocketAmmo ?? 0,color:"#ff9a4d"}
      ];
      panel.ammoLabel.innerHTML=[
        ...ammoRows.map(row=>[
          `<span style="display:flex;align-items:center;justify-content:space-between;height:22px;gap:8px">`,
          ammoIcon(row.icon,row.color),
          `<span style="min-width:38px;text-align:right">${row.value}</span>`,
          `</span>`
        ].join(""))
      ].join("");
    }
    if(panel.boostFill){
      let boostPct=Math.max(0,Math.min(100,state.boostCharge ?? 0));
      panel.boostFill.style.width=boostPct+"%";
    }
    if(panel.laserFill){
      let laserFire=Math.max(0,Math.min(laserHudFrames,state.laserFireFrames ?? 0));
      let laserCooldown=Math.max(0,Math.min(laserHudFrames,state.laserCooldown ?? 0));
      let laserPct=100;
      if(laserFire>0) laserPct=(laserFire/laserHudFrames)*100;
      else if(laserCooldown>0) laserPct=(1-laserCooldown/laserHudFrames)*100;
      panel.laserFill.style.width=Math.max(0,Math.min(100,laserPct))+"%";
      panel.laserFill.style.opacity=laserFire>0 ? "1" : laserCooldown>0 ? "0.78" : "0.94";
      if(panel.laserTrack) panel.laserTrack.style.opacity=laserPct<=0.5 ? "0.62" : "1";
    }
    if(panel.fuelFill){
      let fuelPct=Math.max(0,Math.min(100,state.fuel ?? 100));
      panel.fuelFill.style.width=fuelPct+"%";
    }
  }

  function ammoIcon(kind,color){
    if(kind==="rocket"){
      return [
        `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 24px;filter:drop-shadow(0 0 5px ${color}) drop-shadow(0 2px 1px rgba(0,0,0,0.7))">`,
        `<path d="M13.4 1.8l5.9 3.5 1.7 5.1-6.9 7.2-7.4-7.2 6.7-8.6z" fill="#1b232b" stroke="#d8f8ff" stroke-opacity="0.32" stroke-width="0.7"/>`,
        `<path d="M13.8 4.2l3.5 2.1 0.9 2.9-4.5 4.8-4.3-4.1 4.4-5.7z" fill="${color}"/>`,
        `<path d="M6 10.9l7.1 6.8-4.3 2.2-5.1-5 2.3-4z" fill="#56636d"/>`,
        `<path d="M3.9 16.3l2.2 2.1-3.7 1.8 1.5-3.9z" fill="#b9f4ff"/>`,
        `<path d="M15.4 6.7l1.4 0.9 0.4 1.2-2 2.2-1.7-1.7 1.9-2.6z" fill="#fff6cb" opacity="0.68"/>`,
        `</svg>`
      ].join("");
    }
    if(kind==="cannon"){
      return [
        `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 24px;filter:drop-shadow(0 0 5px ${color}) drop-shadow(0 2px 1px rgba(0,0,0,0.7))">`,
        `<path d="M2.5 12h12l1.8-2.2h5.1v4.2h-5.1l-1.8 2.1h-12V12z" fill="#202b33" stroke="#d8f8ff" stroke-opacity="0.24" stroke-width="0.7"/>`,
        `<path d="M5.1 13h8.8v2H5.1v-2z" fill="${color}"/>`,
        `<path d="M3.5 16.2h4.2l1.8 3H5.2l-1.7-3z" fill="#64717a"/>`,
        `<path d="M16.9 10.7h4.1v1.5h-4.1v-1.5z" fill="#d8f8ff"/>`,
        `<path d="M19.8 9.2l2.1-0.9-0.7 2.4-1.4-1.5z" fill="#fff6cb"/>`,
        `<path d="M8.3 10.1h5.8l-1.3 1.4H8.3v-1.4z" fill="#5a6973"/>`,
        `</svg>`
      ].join("");
    }
    if(kind==="carRocket"){
      return [
        `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 24px;filter:drop-shadow(0 0 5px ${color}) drop-shadow(0 2px 1px rgba(0,0,0,0.7))">`,
        `<path d="M2.8 16.5h18.4v2.7H2.8v-2.7z" fill="#2d363e"/>`,
        `<path d="M5.1 13.3h13.8l1.7 3.2H3.4l1.7-3.2z" fill="#4c5961" stroke="#d8f8ff" stroke-opacity="0.18" stroke-width="0.6"/>`,
        `<path d="M6.9 9h3.2v5H6.9V9zM13.9 9h3.2v5h-3.2V9z" fill="#202b33"/>`,
        `<path d="M8.5 2.5l2 1.8 0.4 4.2H5.8l0.5-4.2 2.2-1.8z" fill="${color}"/>`,
        `<path d="M15.5 2.5l2.1 1.8 0.4 4.2h-5.2l0.5-4.2 2.2-1.8z" fill="${color}"/>`,
        `<path d="M7.2 10.1h2.5v1.8H7.2v-1.8zM14.2 10.1h2.5v1.8h-2.5v-1.8z" fill="#d8f8ff"/>`,
        `<path d="M5.2 19.4h2.8l-1 2.1H4.4l0.8-2.1zM16 19.4h2.8l0.8 2.1H17l-1-2.1z" fill="#ffcf6a"/>`,
        `</svg>`
      ].join("");
    }
    return [
      `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 24px;filter:drop-shadow(0 0 5px ${color}) drop-shadow(0 2px 1px rgba(0,0,0,0.7))">`,
      `<path d="M6.4 8.2h8.4l3.2 4.9-2.4 6.7H5.4L3 13.1l3.4-4.9z" fill="#252d33" stroke="#d8f8ff" stroke-opacity="0.24" stroke-width="0.7"/>`,
      `<path d="M7.7 9.7h5.7l2.2 3.5-1.5 4.2H7l-1.5-4.2 2.2-3.5z" fill="${color}"/>`,
      `<path d="M10.6 4h5.1v2.3h-5.1V4z" fill="#6e7a82"/>`,
      `<path d="M14.8 2.8h4.4v1.6h-4.4V2.8z" fill="#b9f4ff"/>`,
      `<path d="M15.9 2.2l2.8-1.2-0.9 2.3-1.9-1.1z" fill="#fff6cb"/>`,
      `<path d="M8 12.5h2.2v2.2H8v-2.2zM11.3 12.5h2.2v2.2h-2.2v-2.2z" fill="#2a2417" opacity="0.55"/>`,
      `</svg>`
    ].join("");
  }

  function makeMapHud(panel){
    let mapHud=document.createElement("div");
    mapHud.style.cssText=[
      "position:fixed",
      "top:50px",
      `right:${panel.side==="left" ? "calc(50% + 18px)" : "18px"}`,
      `width:${mapHudSize}px`,
      `height:${mapHudSize}px`,
      "border-radius:50%",
      "background:rgba(20,28,34,0.42)",
      "box-shadow:0 4px 14px rgba(0,0,0,0.2)",
      "z-index:10",
      "overflow:hidden",
      "pointer-events:none"
    ].join(";");

    let mapCanvas=document.createElement("canvas");
    mapCanvas.width=mapHudSize;
    mapCanvas.height=mapHudSize;
    mapCanvas.style.cssText=`display:block;width:${mapHudSize}px;height:${mapHudSize}px;border-radius:50%`;
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
      `width:${panel.side==="full" ? healthHudFullWidth : healthHudSplitWidth}`,
      "height:74px",
      "z-index:11",
      "pointer-events:none"
    ].join(";");

    let compassCanvas=document.createElement("canvas");
    compassCanvas.width=panel.side==="full" ? compassFullCanvasWidth : compassSplitCanvasWidth;
    compassCanvas.height=74;
    compassCanvas.style.cssText="display:block;width:100%;height:74px";
    let compassCtx=compassCanvas.getContext("2d");
    compassHud.appendChild(compassCanvas);
    document.body.appendChild(compassHud);

    let unitsLabel=document.createElement("div");
    unitsLabel.style.cssText=[
      "position:fixed",
      "top:138px",
      `left:${panel.side==="full" ? "50%" : panel.side==="left" ? "25%" : "75%"}`,
      "transform:translateX(-50%)",
      "z-index:11",
      `font-family:${gameFontFamily}`,
      "font-size:22px",
      "font-weight:900",
      "letter-spacing:0.1em",
      "color:rgba(245,255,249,0.94)",
      "text-shadow:0 0 6px rgba(103,244,255,0.58),0 3px 0 rgba(0,0,0,0.68)",
      "text-transform:uppercase",
      "pointer-events:none"
    ].join(";");
    document.body.appendChild(unitsLabel);

    panel.compassCanvas=compassCanvas;
    panel.compassCtx=compassCtx;
    panel.unitsLabel=unitsLabel;
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
      scannedBossFill:rgba(colors.pod || colors.trim,0.34,0xff5c36),
      scannedBossStroke:rgba(colors.podEmissive || colors.pod,0.98,0xff6a42),
      scannedOutpostFill:rgba(colors.shore || colors.wall,0.38,0xffb84d),
      scannedOutpostStroke:rgba(colors.shore || colors.trim,0.98,0xfff17a),
      scannedRadarFill:rgba(colors.water || colors.trim,0.36,0x7ff8ff),
      scannedRadarStroke:rgba(colors.waterEmissive || colors.water || colors.trim,0.98,0x8dfff2),
      scannedLandingFill:rgba(colors.grass || colors.low,0.34,0x7cff78),
      scannedLandingStroke:rgba(colors.trim || colors.grass,0.96,0xd9ff7a),
      scannedPortalFill:rgba(colors.trim || colors.water,0.26,0xd6a8ff),
      scannedPortalStroke:rgba(colors.waterEmissive || colors.trim,0.98,0xe8ddff),
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
    let radius=chunkSize*3.312;
    let palette=mapPalette();

    mapCtx.clearRect(0,0,size,size);
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(size*0.5,size*0.5,size*0.5,0,Math.PI*2);
    mapCtx.clip();
    let cells=getPerformanceMode()==="split" ? 32 : 48;
    let cellSize=size/cells;
    for(let gy=0;gy<cells;gy++){
      for(let gx=0;gx<cells;gx++){
        let wx=centerX-radius+((gx+0.5)/cells)*radius*2;
        let wz=centerZ-radius+((gy+0.5)/cells)*radius*2;
        let h=getTerrainHeight(wx,wz);
        if(h<-20) mapCtx.fillStyle=palette.water;
        else if(h<15) mapCtx.fillStyle=palette.low;
        else if(h<30) mapCtx.fillStyle=palette.mid;
        else mapCtx.fillStyle=palette.high;
        mapCtx.fillRect(gx*cellSize,gy*cellSize,cellSize+1,cellSize+1);
      }
    }

    drawVillages(mapCtx,centerX,centerZ,radius,size,palette);
    drawScannedLandingSpaces(mapCtx,getScannedLandingSpaces(),centerX,centerZ,radius,size,palette);
    drawScannedBossBases(mapCtx,getScannedBossBases(),centerX,centerZ,radius,size,palette);
    drawScannedRadarOutposts(mapCtx,getScannedRadarOutposts(),centerX,centerZ,radius,size,palette);
    drawScannedPortals(mapCtx,getScannedPortals(),centerX,centerZ,radius,size,palette);
    drawEnemyDots(mapCtx,enemies,centerX,centerZ,radius,size);
    drawOtherCars(mapCtx,state,states,centerX,centerZ,radius,size,palette);
    drawStationMarker(mapCtx,getStationState(),centerX,centerZ,radius,size,palette);

    mapCtx.save();
    mapCtx.translate(size*0.5,size*0.5);
    mapCtx.rotate(-state.carVelAngle+Math.PI);
    mapCtx.fillStyle=panel.color;
    mapCtx.strokeStyle=palette.outline;
    mapCtx.lineWidth=1.6;
    mapCtx.beginPath();
    mapCtx.moveTo(0,-11);
    mapCtx.lineTo(8,9);
    mapCtx.lineTo(0,5.5);
    mapCtx.lineTo(-8,9);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
    drawScannedTradingOutposts(mapCtx,getScannedTradingOutposts(),centerX,centerZ,radius,size,palette);
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

  function drawScannedBossBases(mapCtx,bases,centerX,centerZ,radius,size,palette){
    if(!bases || !bases.length) return;

    let pulse=0.5+0.5*Math.sin(performance.now()*0.007);
    for(let base of bases){
      if(!base || base.health<=0 || base.active===false) continue;

      let p=mapToCanvas(base.x,base.z,centerX,centerZ,radius,size);
      let margin=13;
      let offMap=p.x<margin || p.x>size-margin || p.y<margin || p.y>size-margin;
      if(offMap){
        p.x=Math.max(margin,Math.min(size-margin,p.x));
        p.y=Math.max(margin,Math.min(size-margin,p.y));
      }

      let markerSize=13+pulse*2.5;
      let half=markerSize*0.5;
      mapCtx.save();
      mapCtx.translate(p.x,p.y);
      mapCtx.rotate(Math.PI*0.25);
      mapCtx.globalAlpha=offMap ? 0.72 : 1;
      mapCtx.fillStyle=palette.scannedBossFill;
      mapCtx.strokeStyle=palette.scannedBossStroke;
      mapCtx.lineWidth=2;
      mapCtx.fillRect(-half,-half,markerSize,markerSize);
      mapCtx.strokeRect(-half+0.5,-half+0.5,markerSize-1,markerSize-1);
      mapCtx.restore();

      mapCtx.strokeStyle=`rgba(255,245,210,${0.42+pulse*0.36})`;
      mapCtx.lineWidth=1.2;
      mapCtx.beginPath();
      mapCtx.arc(p.x,p.y,10+pulse*4,0,Math.PI*2);
      mapCtx.stroke();

      mapCtx.fillStyle=palette.scannedBossStroke;
      mapCtx.fillRect(p.x-2.5,p.y-2.5,5,5);
    }
  }

  function drawScannedTradingOutposts(mapCtx,outposts,centerX,centerZ,radius,size,palette){
    if(!outposts || !outposts.length) return;

    let pulse=0.5+0.5*Math.sin(performance.now()*0.006);
    for(let outpost of outposts){
      if(!outpost) continue;

      let p=mapToCanvas(outpost.x,outpost.z,centerX,centerZ,radius,size);
      let margin=12;
      let offMap=p.x<margin || p.x>size-margin || p.y<margin || p.y>size-margin;
      if(offMap){
        p.x=Math.max(margin,Math.min(size-margin,p.x));
        p.y=Math.max(margin,Math.min(size-margin,p.y));
      }

      let markerHeight=16+pulse*1.8;
      let topWidth=14+pulse*1.4;
      let topHeight=4.4;
      let stemWidth=5;
      let halfTop=topWidth*0.5;
      let halfStem=stemWidth*0.5;
      let topY=-markerHeight*0.5;
      let barBottom=topY+topHeight;
      let bottomY=markerHeight*0.5;
      mapCtx.save();
      mapCtx.translate(p.x,p.y);
      mapCtx.globalAlpha=offMap ? 0.7 : 1;
      mapCtx.shadowColor=palette.scannedOutpostStroke;
      mapCtx.shadowBlur=5+pulse*5;
      mapCtx.strokeStyle=palette.scannedOutpostStroke;
      mapCtx.fillStyle=palette.scannedOutpostFill;
      mapCtx.lineWidth=1.8;
      mapCtx.beginPath();
      mapCtx.moveTo(-halfTop,topY);
      mapCtx.lineTo(halfTop,topY);
      mapCtx.lineTo(halfTop,barBottom);
      mapCtx.lineTo(halfStem,barBottom);
      mapCtx.lineTo(halfStem,bottomY);
      mapCtx.lineTo(-halfStem,bottomY);
      mapCtx.lineTo(-halfStem,barBottom);
      mapCtx.lineTo(-halfTop,barBottom);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.stroke();
      mapCtx.shadowBlur=0;

      mapCtx.strokeStyle=`rgba(245,255,249,${0.38+pulse*0.32})`;
      mapCtx.lineWidth=1.15;
      mapCtx.beginPath();
      mapCtx.moveTo(-halfTop-2,topY-2);
      mapCtx.lineTo(halfTop+2,topY-2);
      mapCtx.moveTo(-halfStem-2,bottomY+2);
      mapCtx.lineTo(halfStem+2,bottomY+2);
      mapCtx.stroke();

      mapCtx.fillStyle=palette.scannedOutpostStroke;
      mapCtx.fillRect(-1.8,barBottom+1,3.6,3.6);

      mapCtx.strokeStyle=`rgba(255,255,255,${0.48+pulse*0.28})`;
      mapCtx.lineWidth=1.2;
      mapCtx.beginPath();
      mapCtx.moveTo(-halfTop-3,barBottom+1);
      mapCtx.lineTo(-halfTop-3,topY+1);
      mapCtx.moveTo(halfTop+3,barBottom+1);
      mapCtx.lineTo(halfTop+3,topY+1);
      mapCtx.stroke();
      mapCtx.restore();
    }
  }

  function drawScannedRadarOutposts(mapCtx,outposts,centerX,centerZ,radius,size,palette){
    if(!outposts || !outposts.length) return;

    let pulse=0.5+0.5*Math.sin(performance.now()*0.0065);
    for(let outpost of outposts){
      if(!outpost) continue;

      let p=mapToCanvas(outpost.x,outpost.z,centerX,centerZ,radius,size);
      let margin=12;
      let offMap=p.x<margin || p.x>size-margin || p.y<margin || p.y>size-margin;
      if(offMap){
        p.x=Math.max(margin,Math.min(size-margin,p.x));
        p.y=Math.max(margin,Math.min(size-margin,p.y));
      }

      let dishRadius=7.2+pulse*1.2;
      mapCtx.save();
      mapCtx.translate(p.x,p.y);
      mapCtx.globalAlpha=offMap ? 0.7 : 1;
      mapCtx.shadowColor=palette.scannedRadarStroke;
      mapCtx.shadowBlur=5+pulse*5;
      mapCtx.strokeStyle=palette.scannedRadarStroke;
      mapCtx.fillStyle=palette.scannedRadarFill;
      mapCtx.lineWidth=1.7;
      mapCtx.beginPath();
      mapCtx.arc(0,-1,dishRadius,Math.PI*1.05,Math.PI*1.95);
      mapCtx.lineTo(0,-1);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.stroke();

      mapCtx.shadowBlur=0;
      mapCtx.beginPath();
      mapCtx.moveTo(0,-1);
      mapCtx.lineTo(0,8);
      mapCtx.moveTo(-5,8);
      mapCtx.lineTo(5,8);
      mapCtx.stroke();

      mapCtx.strokeStyle=`rgba(245,255,249,${0.34+pulse*0.3})`;
      mapCtx.lineWidth=1.05;
      for(let i=0;i<3;i++){
        let wave=dishRadius+3+i*3+pulse*2;
        mapCtx.beginPath();
        mapCtx.arc(0,-1,wave,Math.PI*1.16,Math.PI*1.84);
        mapCtx.stroke();
      }
      mapCtx.restore();
    }
  }

  function drawScannedLandingSpaces(mapCtx,landingSpaces,centerX,centerZ,radius,size,palette){
    if(!landingSpaces || !landingSpaces.length) return;

    let pulse=0.5+0.5*Math.sin(performance.now()*0.0055);
    for(let landingSpace of landingSpaces){
      if(!landingSpace) continue;

      let p=mapToCanvas(landingSpace.x,landingSpace.z,centerX,centerZ,radius,size);
      let margin=11;
      let offMap=p.x<margin || p.x>size-margin || p.y<margin || p.y>size-margin;
      if(offMap){
        p.x=Math.max(margin,Math.min(size-margin,p.x));
        p.y=Math.max(margin,Math.min(size-margin,p.y));
      }

      let markerSize=10+pulse*1.8;
      mapCtx.save();
      mapCtx.translate(p.x,p.y);
      mapCtx.globalAlpha=offMap ? 0.68 : 1;
      mapCtx.fillStyle=palette.scannedLandingFill;
      mapCtx.strokeStyle=palette.scannedLandingStroke;
      mapCtx.lineWidth=1.7;
      mapCtx.beginPath();
      mapCtx.moveTo(0,-markerSize*0.55);
      mapCtx.lineTo(markerSize*0.58,markerSize*0.46);
      mapCtx.lineTo(-markerSize*0.58,markerSize*0.46);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.stroke();

      mapCtx.strokeStyle=`rgba(245,255,249,${0.36+pulse*0.28})`;
      mapCtx.lineWidth=1.1;
      mapCtx.beginPath();
      mapCtx.moveTo(-markerSize*0.72,markerSize*0.66);
      mapCtx.lineTo(markerSize*0.72,markerSize*0.66);
      mapCtx.stroke();

      mapCtx.fillStyle=palette.scannedLandingStroke;
      mapCtx.fillRect(-1.8,-1.8,3.6,3.6);
      mapCtx.restore();
    }
  }

  function drawScannedPortals(mapCtx,portals,centerX,centerZ,radius,size,palette){
    if(!portals || !portals.length) return;

    let pulse=0.5+0.5*Math.sin(performance.now()*0.0075);
    for(let portal of portals){
      if(!portal) continue;

      let p=mapToCanvas(portal.x,portal.z,centerX,centerZ,radius,size);
      let margin=14;
      let offMap=p.x<margin || p.x>size-margin || p.y<margin || p.y>size-margin;
      if(offMap){
        p.x=Math.max(margin,Math.min(size-margin,p.x));
        p.y=Math.max(margin,Math.min(size-margin,p.y));
      }

      let outer=6.2+pulse*1.6;
      let inner=outer*0.42;
      let glow=outer+3.2+pulse*2.2;
      mapCtx.save();
      mapCtx.translate(p.x,p.y);
      mapCtx.globalAlpha=offMap ? 0.7 : 1;

      function starPath(outerRadius,innerRadius,points=8,rotation=-Math.PI*0.5){
        mapCtx.beginPath();
        for(let i=0;i<points*2;i++){
          let angle=rotation+i*Math.PI/points;
          let r=i%2===0 ? outerRadius : innerRadius;
          let x=Math.cos(angle)*r;
          let y=Math.sin(angle)*r;
          if(i===0) mapCtx.moveTo(x,y);
          else mapCtx.lineTo(x,y);
        }
        mapCtx.closePath();
      }

      mapCtx.shadowColor=palette.scannedPortalStroke;
      mapCtx.shadowBlur=7+pulse*5;
      mapCtx.strokeStyle=palette.scannedPortalStroke;
      mapCtx.fillStyle=palette.scannedPortalFill;
      mapCtx.lineWidth=1.8;
      starPath(outer,inner,8,Math.PI*0.125-Math.PI*0.5);
      mapCtx.fill();
      mapCtx.stroke();

      mapCtx.shadowBlur=5+pulse*5;
      mapCtx.strokeStyle=`rgba(245,255,249,${0.34+pulse*0.36})`;
      mapCtx.lineWidth=1.05;
      mapCtx.beginPath();
      mapCtx.arc(0,0,glow,0,Math.PI*2);
      mapCtx.stroke();

      mapCtx.strokeStyle=`rgba(232,221,255,${0.28+pulse*0.3})`;
      mapCtx.lineWidth=0.9;
      starPath(outer+2.8,inner+1.4,8,Math.PI*0.125-Math.PI*0.5);
      mapCtx.stroke();

      mapCtx.shadowBlur=6;
      mapCtx.fillStyle=palette.scannedPortalStroke;
      mapCtx.beginPath();
      mapCtx.arc(0,0,1.7+pulse*0.45,0,Math.PI*2);
      mapCtx.fill();
      mapCtx.shadowBlur=0;
      mapCtx.restore();
    }
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
    let markerRadius=radius-10;
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

  function drawCompassTradingOutpostMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette){
    let outpost=getNearestTradingOutpost(state);
    if(!outpost) return;

    let dx=outpost.x-state.carX;
    let dz=outpost.z-state.carZ;
    if(dx*dx+dz*dz<1) return;

    let heading=state.carVelAngle || 0;
    let outpostAngle=Math.atan2(dx,dz);
    let delta=normalizeAngle(outpostAngle-heading);
    let inView=Math.abs(delta)<=viewHalf;
    let t=Math.max(-1,Math.min(1,delta/viewHalf));
    let theta=-Math.PI/2+t*arcHalf;
    let markerRadius=radius-10;
    let x=cx+Math.cos(theta)*markerRadius;
    let y=cy+Math.sin(theta)*markerRadius;
    let pulse=0.5+0.5*Math.sin(performance.now()*0.0065);
    let alpha=inView ? 0.8+pulse*0.18 : 0.46+pulse*0.16;

    ctx.save();
    ctx.translate(x,y);
    ctx.font=`900 ${inView ? 18 : 16}px "Astor", Arial`;
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.strokeStyle="rgba(18,7,43,0.84)";
    ctx.lineWidth=4;
    ctx.strokeText("T",0,0);
    ctx.fillStyle=inView ? palette.scannedOutpostStroke : `rgba(239,207,114,${alpha})`;
    ctx.fillText("T",0,0);
    ctx.strokeStyle=`rgba(239,207,114,${alpha*0.72})`;
    ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.arc(0,0,9+pulse*1.4,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  function drawCompassBossBaseMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette){
    let base=getNearestBossBase(state);
    if(!base) return;

    let dx=base.x-state.carX;
    let dz=base.z-state.carZ;
    if(dx*dx+dz*dz<1) return;

    let heading=state.carVelAngle || 0;
    let baseAngle=Math.atan2(dx,dz);
    let delta=normalizeAngle(baseAngle-heading);
    let inView=Math.abs(delta)<=viewHalf;
    let t=Math.max(-1,Math.min(1,delta/viewHalf));
    let theta=-Math.PI/2+t*arcHalf;
    let markerRadius=radius-10;
    let x=cx+Math.cos(theta)*markerRadius;
    let y=cy+Math.sin(theta)*markerRadius;
    let pulse=0.5+0.5*Math.sin(performance.now()*0.0078);
    let alpha=inView ? 0.82+pulse*0.16 : 0.48+pulse*0.16;

    ctx.save();
    ctx.translate(x,y);
    ctx.font=`900 ${inView ? 17 : 15}px "Astor", Arial`;
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.strokeStyle="rgba(18,7,43,0.88)";
    ctx.lineWidth=4;
    ctx.strokeText("B",0,0);
    ctx.fillStyle=inView ? palette.scannedBossStroke : `rgba(255,96,183,${alpha})`;
    ctx.fillText("B",0,0);
    ctx.strokeStyle=`rgba(255,96,183,${alpha*0.68})`;
    ctx.lineWidth=1.3;
    ctx.beginPath();
    ctx.moveTo(0,-10-pulse*1.2);
    ctx.lineTo(3.2,-3.2);
    ctx.lineTo(10+pulse*1.2,0);
    ctx.lineTo(3.2,3.2);
    ctx.lineTo(0,10+pulse*1.2);
    ctx.lineTo(-3.2,3.2);
    ctx.lineTo(-10-pulse*1.2,0);
    ctx.lineTo(-3.2,-3.2);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawCompassPlayerMarker(ctx,state,allStates,cx,cy,radius,arcHalf,viewHalf){
    if(!state || !Array.isArray(allStates) || allStates.length<2) return;

    let heading=state.carVelAngle || 0;
    for(let other of allStates){
      if(!other || other.id===state.id || other.carHealth<=0) continue;

      let dx=other.carX-state.carX;
      let dz=other.carZ-state.carZ;
      let distSq=dx*dx+dz*dz;
      if(distSq<4) continue;

      let playerAngle=Math.atan2(dx,dz);
      let delta=normalizeAngle(playerAngle-heading);
      let inView=Math.abs(delta)<=viewHalf;
      let t=Math.max(-1,Math.min(1,delta/viewHalf));
      let theta=-Math.PI/2+t*arcHalf;
      let markerRadius=radius-24;
      let x=cx+Math.cos(theta)*markerRadius;
      let y=cy+Math.sin(theta)*markerRadius;
      let pulse=0.5+0.5*Math.sin(performance.now()*0.0085);
      let color=other.color || "#ffffff";
      let alpha=inView ? 0.86+pulse*0.12 : 0.52+pulse*0.12;

      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(theta+Math.PI/2);
      ctx.globalAlpha=alpha;
      ctx.fillStyle=color;
      ctx.strokeStyle="rgba(18,7,43,0.9)";
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(0,-10-pulse*1.1);
      ctx.lineTo(7,7);
      ctx.lineTo(0,3.5);
      ctx.lineTo(-7,7);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x,y+14);
      ctx.font=`900 ${inView ? 11 : 10}px "Astor", Arial`;
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.strokeStyle="rgba(18,7,43,0.92)";
      ctx.lineWidth=3;
      ctx.strokeText(other.label || "P",0,0);
      ctx.fillStyle=color;
      ctx.globalAlpha=alpha;
      ctx.fillText(other.label || "P",0,0);
      ctx.restore();
    }
  }

  function drawCompassHud(panel,state,allStates=[]){
    if(!panel.compassCtx || !state) return;

    let ctx=panel.compassCtx;
    let canvas=panel.compassCanvas;
    let width=canvas.width;
    let height=canvas.height;
    let cx=width*0.5;
    let arcHalf=0.54;
    let radius=(width-26)/(2*Math.sin(arcHalf));
    let cy=radius+12;
    let viewHalf=Math.PI*0.82;
    let heading=state.carVelAngle || 0;
    let palette=mapPalette();

    ctx.clearRect(0,0,width,height);

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
      let inner=radius-(major ? 7 : 4);
      let outer=radius+2;
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
      let x=cx+Math.cos(theta)*(radius-10);
      let y=cy+Math.sin(theta)*(radius-10);
      let alpha=1-Math.pow(Math.abs(t),1.8)*0.58;
      let scale=1.12-Math.abs(t)*0.22;

      ctx.font=`800 ${Math.round(18*scale)}px "Astor", Arial`;
      ctx.fillStyle=`rgba(245,255,249,${alpha})`;
      ctx.strokeStyle=`rgba(18,7,43,${0.78*alpha})`;
      ctx.lineWidth=3;
      ctx.strokeText(dir.label,x,y);
      ctx.fillText(dir.label,x,y);
    }

    drawCompassStationMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette);
    drawCompassBossBaseMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette);
    drawCompassTradingOutpostMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette);
    drawCompassPlayerMarker(ctx,state,allStates,cx,cy,radius,arcHalf,viewHalf);

    ctx.strokeStyle="rgba(255,255,255,0.92)";
    ctx.fillStyle="rgba(255,255,255,0.92)";
    ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(cx,13);
    ctx.lineTo(cx-5,24);
    ctx.lineTo(cx+5,24);
    ctx.closePath();
    ctx.fill();

    if(panel.unitsLabel){
      panel.unitsLabel.textContent=`Units ${Math.max(0,Math.round(state.units ?? 0))}`;
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
      `font-family:${gameFontFamily}`,
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
      drawCompassHud(panels[i],states[i],states);
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
