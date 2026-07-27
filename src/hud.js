import { chunkSize } from "./constants.js";

const gameFontFamily="\"Astor\", Arial, sans-serif";
const mapHudSize=259;
const mapHudSplitCssSize="min(224px,calc(50vw - 42px))";
const healthHudFullWidth="min(430px,58vw)";
const healthHudSplitWidth="min(300px,40vw)";
const compassFullCanvasWidth=430;
const compassSplitCanvasWidth=300;
const speedHudScale=1.2;
const speedHudSplitScale=1;
const speedHudWidth=340;
const speedHudSplitWidth="min(200px,calc(50vw - 72px))";
const laserHudFrames=300;
const displayBarFill="linear-gradient(90deg,rgba(128,137,140,0.72),rgba(178,187,188,0.86),rgba(229,234,232,0.72))";
const displayBarShadow="0 0 12px rgba(210,220,220,0.24),inset 0 0 12px rgba(255,255,255,0.18)";
const compassArcStroke="rgba(178,187,188,0.62)";
const compassArcMajorStroke="rgba(216,222,222,0.78)";
const compassArcMinorStroke="rgba(178,187,188,0.42)";

export function createHud({getCarStates,getChunks,getEnemyStates=()=>[],getStationState=()=>null,getNearestTradingOutpost=()=>null,getNearestBossBase=()=>null,getCompassRadarOutposts=()=>[],getScannedBossBases=()=>[],getScannedTradingOutposts=()=>[],getScannedRadarOutposts=()=>[],getScannedLandingSpaces=()=>[],getScannedPortals=()=>[],getPerformanceMode=()=>"full",getPerformanceStressLevel=()=>0,getFirstPersonMode=()=>false,getEnvironment=()=>({}),getTerrainHeight=()=>0}){
  let panels=[];
  let gameOverOverlay;
  let mapUpdateFrame=0;
  let compassUpdateFrame=0;
  let navigationLayoutSignature="";
  let displayPaletteCacheSignature="";
  let displayPaletteCache=null;

  function panelOffset(panel){
    if(panel.side==="full") return "0%";
    return panel.side==="left" ? 0 : "50%";
  }

  function speedHudWidthFor(panel){
    return panel.side==="full" ? `${speedHudWidth}px` : speedHudSplitWidth;
  }

  function speedHudScaleFor(panel){
    return panel.side==="full" ? speedHudScale : speedHudSplitScale;
  }

  function speedHudInset(panel){
    return panel.side==="full" ? "20px" : panel.side==="left" ? "58px" : "28px";
  }

  function mapHudCssSizeFor(panel){
    return panel.side==="full" ? `${mapHudSize}px` : mapHudSplitCssSize;
  }

  function panelCenterLeft(panel){
    return panel.side==="full" ? "50%" : panel.side==="left" ? "25%" : "75%";
  }

  function sideTilt(panel){
    if(panel.side==="full") return "rotateY(10deg) rotateX(0.8deg) rotateZ(-0.2deg)";
    if(panel.side==="left" || panel.side==="right") return "";
    return "rotateX(7deg)";
  }

  function speedHudTransform(panel){
    let scale=`scale(${speedHudScaleFor(panel)})`;
    if(panel.side==="left" || panel.side==="right") return scale;
    return `perspective(430px) ${sideTilt(panel)} ${scale}`;
  }

  function sideTransformOrigin(panel){
    if(panel.side==="full") return "left center";
    if(panel.side==="left" || panel.side==="right") return "top left";
    return "top center";
  }

  function sidePanelClip(panel){
    if(panel.side==="full") return "polygon(0 0,100% 5%,100% 95%,0 100%)";
    if(panel.side==="left" || panel.side==="right") return "polygon(0 0,100% 0,100% 100%,0 100%)";
    return "polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,18px 100%,0 calc(100% - 18px))";
  }

  function barClip(panel,inset=7){
    return `polygon(${inset}px 0,100% 0,100% 100%,0 100%)`;
  }

  function removeNode(node){
    if(node && node.parentNode) node.parentNode.removeChild(node);
  }

  function clearHudNodes(){
    for(let panel of panels){
      removeNode(panel.speedHud);
      removeNode(panel.mapHud);
      removeNode(panel.compassHud);
    }
    panels=[];
    navigationLayoutSignature="";
    removeNode(gameOverOverlay);
    gameOverOverlay=null;
  }

  function makeHealthHud(panel){
    let healthHud=document.createElement("div");
    healthHud.style.cssText=[
      "position:fixed",
      "top:18px",
      `left:${panel.side==="full" ? "50%" : panel.side==="left" ? "25%" : "75%"}`,
      "transform:translateX(-50%) perspective(620px) rotateX(8deg)",
      "transform-origin:50% 0",
      `width:${panel.side==="full" ? healthHudFullWidth : healthHudSplitWidth}`,
      "height:34px",
      "padding:6px 8px",
      "border:1px solid rgba(141,255,242,0.34)",
      "background:linear-gradient(135deg,rgba(12,22,28,0.58),rgba(39,18,54,0.26) 56%,rgba(214,178,90,0.16))",
      "box-shadow:0 16px 28px rgba(0,0,0,0.28),inset 0 0 22px rgba(103,244,255,0.12),0 0 18px rgba(103,244,255,0.14)",
      "z-index:10",
      "overflow:hidden",
      "clip-path:polygon(18px 0,100% 0,calc(100% - 18px) 100%,0 100%)",
      "box-sizing:border-box",
      `font-family:${gameFontFamily}`,
      "pointer-events:none"
    ].join(";");

    let healthFill=document.createElement("div");
    healthFill.style.cssText=[
      "height:100%",
      "width:100%",
      `background:${displayBarFill}`,
      `box-shadow:${displayBarShadow}`,
      "clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)",
      "transition:width 160ms ease,background 160ms ease,box-shadow 160ms ease"
    ].join(";");

    let healthGrid=document.createElement("div");
    healthGrid.style.cssText=[
      "position:absolute",
      "inset:6px 8px",
      "background:repeating-linear-gradient(90deg,rgba(255,255,255,0.16) 0 1px,transparent 1px 18px)",
      "mix-blend-mode:screen",
      "opacity:0.34",
      "pointer-events:none"
    ].join(";");

    let healthLabel=document.createElement("div");
    healthLabel.style.cssText=[
      "position:absolute",
      "inset:0",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-size:13px",
      "font-weight:900",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:rgba(245,255,249,0.96)",
      "text-shadow:0 0 8px rgba(103,244,255,0.5),0 2px 0 rgba(0,0,0,0.72)",
      "pointer-events:none"
    ].join(";");

    healthHud.appendChild(healthFill);
    healthHud.appendChild(healthGrid);
    healthHud.appendChild(healthLabel);
    document.body.appendChild(healthHud);
    panel.healthFill=healthFill;
    panel.healthLabel=healthLabel;
  }

  function makeSpeedHud(panel){
    let palette=displayPalette();
    let speedHud=document.createElement("div");
    speedHud.style.cssText=[
      "position:fixed",
      "top:58px",
      `left:calc(${panelOffset(panel)} + ${speedHudInset(panel)})`,
      `transform:${speedHudTransform(panel)}`,
      `transform-origin:${sideTransformOrigin(panel)}`,
      `width:${speedHudWidthFor(panel)}`,
      "height:268px",
      "z-index:10",
      "overflow:hidden",
      `font-family:${gameFontFamily}`,
      "letter-spacing:0",
      "color:white",
      "pointer-events:none",
      "box-sizing:border-box",
      "padding:14px 14px 16px",
      "border:0",
      "background:transparent",
      "box-shadow:none",
      `clip-path:${sidePanelClip(panel)}`,
      "backdrop-filter:none"
    ].join(";");

    let panelSheen=document.createElement("div");
    panelSheen.style.cssText=[
      "position:absolute",
      "inset:0",
      `background:${palette.panelSheen}`,
      "opacity:0.44",
      "pointer-events:none"
    ].join(";");

    let healthTrack=document.createElement("div");
    healthTrack.style.cssText=[
      "position:absolute",
      "left:16px",
      "right:16px",
      "top:44px",
      "height:28px",
      `background:${palette.trackBackground}`,
      `border:${palette.border}`,
      `box-shadow:${palette.trackShadow}`,
      "overflow:hidden",
      `clip-path:${barClip(panel,9)}`
    ].join(";");

    let healthFill=document.createElement("div");
    healthFill.style.cssText=[
      "height:100%",
      "width:100%",
      `background:${palette.barFill}`,
      `box-shadow:${palette.barShadow}`,
      "transition:width 160ms ease,background 160ms ease,box-shadow 160ms ease"
    ].join(";");

    let healthGrid=document.createElement("div");
    healthGrid.style.cssText=[
      "position:absolute",
      "inset:0",
      `background:${palette.grid}`,
      "opacity:0.34",
      "pointer-events:none"
    ].join(";");

    let healthLabel=document.createElement("div");
    healthLabel.style.cssText=[
      "position:absolute",
      "inset:0",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-size:12px",
      "font-weight:900",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:rgba(245,255,249,0.96)",
      `text-shadow:${palette.textGlow}`,
      "pointer-events:none"
    ].join(";");
    healthTrack.appendChild(healthFill);
    healthTrack.appendChild(healthGrid);
    healthTrack.appendChild(healthLabel);

    let ammoLabel=document.createElement("div");
    ammoLabel.style.cssText=[
      "position:absolute",
      "left:16px",
      "right:16px",
      "top:82px",
      "display:flex",
      "flex-direction:column",
      "gap:4px",
      "font-size:15px",
      "font-weight:900",
      "line-height:1",
      "color:rgba(245,255,249,0.92)",
      `text-shadow:${palette.textGlow}`
    ].join(";");

    let boostTrack=document.createElement("div");
    boostTrack.style.cssText=[
      "position:absolute",
      "left:16px",
      "right:16px",
      "bottom:34px",
      "height:13px",
      `background:${palette.trackBackground}`,
      `border:${palette.border}`,
      `box-shadow:${palette.trackShadow}`,
      "overflow:hidden",
      `clip-path:${barClip(panel)}`
    ].join(";");

    let boostFill=document.createElement("div");
    boostFill.style.cssText=[
      "height:100%",
      "width:100%",
      `background:${palette.barFill}`,
      `box-shadow:${palette.barShadow}`,
      "transition:width 100ms linear"
    ].join(";");
    let boostLabel=document.createElement("div");
    boostLabel.textContent="Boost";
    boostLabel.style.cssText=[
      "position:absolute",
      "inset:0 8px",
      "display:flex",
      "align-items:center",
      "justify-content:flex-start",
      "font-size:9px",
      "font-weight:900",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:rgba(245,255,249,0.92)",
      `text-shadow:${palette.smallTextGlow}`,
      "pointer-events:none"
    ].join(";");
    boostTrack.appendChild(boostFill);
    boostTrack.appendChild(boostLabel);

    let laserTrack=document.createElement("div");
    laserTrack.style.cssText=[
      "position:absolute",
      "left:16px",
      "right:16px",
      "top:198px",
      "height:15px",
      `background:${palette.trackBackground}`,
      `border:${palette.dangerBorder}`,
      `box-shadow:${palette.trackShadow}`,
      "box-sizing:border-box",
      "overflow:hidden",
      `clip-path:${barClip(panel)}`
    ].join(";");

    let laserFill=document.createElement("div");
    laserFill.style.cssText=[
      "height:100%",
      "width:100%",
      `background:${palette.barFill}`,
      `box-shadow:${palette.barShadow}`,
      "transition:width 80ms linear,opacity 120ms linear"
    ].join(";");
    let laserLabel=document.createElement("div");
    laserLabel.textContent="Laser";
    laserLabel.style.cssText=[
      "position:absolute",
      "inset:0 8px",
      "display:flex",
      "align-items:center",
      "justify-content:flex-start",
      "font-size:9px",
      "font-weight:900",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:rgba(245,255,249,0.92)",
      `text-shadow:${palette.smallTextGlow}`,
      "pointer-events:none"
    ].join(";");
    laserTrack.appendChild(laserFill);
    laserTrack.appendChild(laserLabel);

    let unitsLabel=document.createElement("div");
    unitsLabel.style.cssText=[
      "position:absolute",
      "left:16px",
      "right:16px",
      "top:14px",
      "height:24px",
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "padding:0 9px",
      "box-sizing:border-box",
      "font-size:13px",
      "font-weight:900",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:rgba(245,255,249,0.96)",
      `border:${palette.softBorder}`,
      `background:${palette.unitBackground}`,
      `clip-path:${barClip(panel)}`,
      `text-shadow:${palette.textGlow}`
    ].join(";");

    let fuelTrack=document.createElement("div");
    fuelTrack.style.cssText=[
      "position:absolute",
      "left:16px",
      "right:16px",
      "bottom:14px",
      "height:13px",
      `background:${palette.trackBackground}`,
      `border:${palette.fuelBorder}`,
      `box-shadow:${palette.fuelShadow}`,
      "overflow:hidden",
      `clip-path:${barClip(panel)}`
    ].join(";");

    let fuelFill=document.createElement("div");
    fuelFill.style.cssText=[
      "height:100%",
      "width:100%",
      `background:${palette.barFill}`,
      `box-shadow:${palette.barShadow}`,
      "transition:width 100ms linear"
    ].join(";");
    let fuelLabel=document.createElement("div");
    fuelLabel.textContent="Fuel";
    fuelLabel.style.cssText=[
      "position:absolute",
      "inset:0 8px",
      "display:flex",
      "align-items:center",
      "justify-content:flex-start",
      "font-size:9px",
      "font-weight:900",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:rgba(245,255,249,0.92)",
      `text-shadow:${palette.smallTextGlow}`,
      "pointer-events:none"
    ].join(";");
    fuelTrack.appendChild(fuelFill);
    fuelTrack.appendChild(fuelLabel);
    speedHud.appendChild(healthTrack);
    speedHud.appendChild(ammoLabel);
    speedHud.appendChild(laserTrack);
    speedHud.appendChild(unitsLabel);
    speedHud.appendChild(boostTrack);
    speedHud.appendChild(fuelTrack);
    document.body.appendChild(speedHud);
    panel.speedHud=speedHud;
    panel.panelSheen=panelSheen;
    panel.healthTrack=healthTrack;
    panel.healthGrid=healthGrid;
    panel.ammoLabel=ammoLabel;
    panel.unitsLabel=unitsLabel;
    panel.healthFill=healthFill;
    panel.healthLabel=healthLabel;
    panel.laserFill=laserFill;
    panel.laserTrack=laserTrack;
    panel.laserLabel=laserLabel;
    panel.boostTrack=boostTrack;
    panel.boostLabel=boostLabel;
    panel.boostFill=boostFill;
    panel.fuelTrack=fuelTrack;
    panel.fuelLabel=fuelLabel;
    panel.fuelFill=fuelFill;
  }

  function applyDisplayPalette(panel){
    let palette=displayPalette();
    if(panel.displayPaletteSignature===palette.signature) return palette;
    panel.displayPaletteSignature=palette.signature;

    if(panel.panelSheen) panel.panelSheen.style.background=palette.panelSheen;
    if(panel.healthTrack){
      panel.healthTrack.style.background=palette.trackBackground;
      panel.healthTrack.style.border=palette.border;
      panel.healthTrack.style.boxShadow=palette.trackShadow;
    }
    if(panel.healthGrid) panel.healthGrid.style.background=palette.grid;
    if(panel.healthFill){
      panel.healthFill.style.background=palette.barFill;
      panel.healthFill.style.boxShadow=palette.barShadow;
    }
    if(panel.healthLabel) panel.healthLabel.style.textShadow=palette.textGlow;
    if(panel.ammoLabel) panel.ammoLabel.style.textShadow=palette.textGlow;
    if(panel.boostTrack){
      panel.boostTrack.style.background=palette.trackBackground;
      panel.boostTrack.style.border=palette.border;
      panel.boostTrack.style.boxShadow=palette.trackShadow;
    }
    if(panel.boostFill){
      panel.boostFill.style.background=palette.barFill;
      panel.boostFill.style.boxShadow=palette.barShadow;
    }
    if(panel.boostLabel) panel.boostLabel.style.textShadow=palette.smallTextGlow;
    if(panel.laserTrack){
      panel.laserTrack.style.background=palette.trackBackground;
      panel.laserTrack.style.border=palette.dangerBorder;
      panel.laserTrack.style.boxShadow=palette.trackShadow;
    }
    if(panel.laserFill){
      panel.laserFill.style.background=palette.barFill;
      panel.laserFill.style.boxShadow=palette.barShadow;
    }
    if(panel.laserLabel) panel.laserLabel.style.textShadow=palette.smallTextGlow;
    if(panel.unitsLabel){
      panel.unitsLabel.style.border=palette.softBorder;
      panel.unitsLabel.style.background=palette.unitBackground;
      panel.unitsLabel.style.textShadow=palette.textGlow;
    }
    if(panel.fuelTrack){
      panel.fuelTrack.style.background=palette.trackBackground;
      panel.fuelTrack.style.border=palette.fuelBorder;
      panel.fuelTrack.style.boxShadow=palette.fuelShadow;
    }
    if(panel.fuelFill){
      panel.fuelFill.style.background=palette.barFill;
      panel.fuelFill.style.boxShadow=palette.barShadow;
    }
    if(panel.fuelLabel) panel.fuelLabel.style.textShadow=palette.smallTextGlow;
    return palette;
  }

  function drawSpeedHud(panel,state){
    if(!state) return;
    let palette=applyDisplayPalette(panel);
    if(panel.ammoLabel){
      let ammoRows=[
        {icon:"rocket",value:state.rocketAmmo ?? 0},
        {icon:"cannon",value:state.cannonAmmo ?? 0},
        {icon:"bomb",value:state.clusterBombAmmo ?? 0},
        {icon:"carRocket",value:state.carRocketAmmo ?? 0}
      ];
      let ammoSignature=palette.signature+"|"+ammoRows.map(row=>row.value).join("|");
      if(panel.ammoSignature!==ammoSignature){
        panel.ammoSignature=ammoSignature;
        let rowClip=barClip(panel);
        panel.ammoLabel.innerHTML=[
          ...ammoRows.map(row=>[
            `<span style="display:flex;align-items:center;justify-content:space-between;height:24px;gap:8px;padding:0 7px;border:${palette.softBorder};background:${palette.unitBackground};clip-path:${rowClip}">`,
            ammoIcon(row.icon,palette),
            `<span style="min-width:38px;text-align:right;color:rgba(245,255,249,0.96);text-shadow:${palette.textGlow}">${row.value}</span>`,
            `</span>`
          ].join(""))
        ].join("");
      }
    }
    if(panel.boostFill){
      let boostPct=Math.max(0,Math.min(100,state.boostCharge ?? 0));
      let boostWidth=boostPct+"%";
      if(panel.boostFill.style.width!==boostWidth) panel.boostFill.style.width=boostWidth;
    }
    if(panel.unitsLabel){
      let unitsText=String(Math.max(0,Math.round(state.units ?? 0)));
      if(panel.unitsSignature!==unitsText){
        panel.unitsSignature=unitsText;
        panel.unitsLabel.innerHTML=`<span>Units</span><span>${unitsText}</span>`;
      }
    }
    if(panel.laserFill){
      let laserFire=Math.max(0,Math.min(laserHudFrames,state.laserFireFrames ?? 0));
      let laserCooldown=Math.max(0,Math.min(laserHudFrames,state.laserCooldown ?? 0));
      let laserVisible=!!state.laserAvailable || laserFire>0 || laserCooldown>0;
      if(panel.laserTrack) panel.laserTrack.style.display=laserVisible ? "block" : "none";
      if(laserVisible){
        let laserPct=100;
        if(laserFire>0) laserPct=(laserFire/laserHudFrames)*100;
        else if(laserCooldown>0) laserPct=(1-laserCooldown/laserHudFrames)*100;
        let laserWidth=Math.max(0,Math.min(100,laserPct))+"%";
        let laserOpacity=laserFire>0 ? "1" : laserCooldown>0 ? "0.78" : "0.94";
        if(panel.laserFill.style.width!==laserWidth) panel.laserFill.style.width=laserWidth;
        if(panel.laserFill.style.opacity!==laserOpacity) panel.laserFill.style.opacity=laserOpacity;
        if(panel.laserTrack){
          let trackOpacity=laserPct<=0.5 ? "0.62" : "1";
          if(panel.laserTrack.style.opacity!==trackOpacity) panel.laserTrack.style.opacity=trackOpacity;
        }
      }
    }
    if(panel.fuelFill){
      let fuelPct=Math.max(0,Math.min(100,state.fuel ?? 100));
      let fuelWidth=fuelPct+"%";
      if(panel.fuelFill.style.width!==fuelWidth) panel.fuelFill.style.width=fuelWidth;
    }
  }

  function ammoIcon(kind,palette=displayPalette()){
    let color=rgba(palette.text,0.96,0xb9f4ff);
    let glow=rgba(palette.accentGlow,0.62,0x67f4ff);
    if(kind==="rocket"){
      return [
        `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 24px;color:${color};filter:drop-shadow(0 0 5px ${glow}) drop-shadow(0 2px 1px rgba(0,0,0,0.7))">`,
        `<path d="M13.4 1.8l5.9 3.5 1.7 5.1-6.9 7.2-7.4-7.2 6.7-8.6z" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-opacity="0.44" stroke-width="0.7"/>`,
        `<path d="M13.8 4.2l3.5 2.1 0.9 2.9-4.5 4.8-4.3-4.1 4.4-5.7z" fill="currentColor" fill-opacity="0.82"/>`,
        `<path d="M6 10.9l7.1 6.8-4.3 2.2-5.1-5 2.3-4z" fill="currentColor" fill-opacity="0.38"/>`,
        `<path d="M3.9 16.3l2.2 2.1-3.7 1.8 1.5-3.9z" fill="currentColor" fill-opacity="0.72"/>`,
        `<path d="M15.4 6.7l1.4 0.9 0.4 1.2-2 2.2-1.7-1.7 1.9-2.6z" fill="currentColor" fill-opacity="0.92"/>`,
        `</svg>`
      ].join("");
    }
    if(kind==="cannon"){
      return [
        `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 24px;color:${color};filter:drop-shadow(0 0 5px ${glow}) drop-shadow(0 2px 1px rgba(0,0,0,0.7))">`,
        `<path d="M2.5 12h12l1.8-2.2h5.1v4.2h-5.1l-1.8 2.1h-12V12z" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-opacity="0.38" stroke-width="0.7"/>`,
        `<path d="M5.1 13h8.8v2H5.1v-2z" fill="currentColor" fill-opacity="0.86"/>`,
        `<path d="M3.5 16.2h4.2l1.8 3H5.2l-1.7-3z" fill="currentColor" fill-opacity="0.38"/>`,
        `<path d="M16.9 10.7h4.1v1.5h-4.1v-1.5z" fill="currentColor" fill-opacity="0.78"/>`,
        `<path d="M19.8 9.2l2.1-0.9-0.7 2.4-1.4-1.5z" fill="currentColor" fill-opacity="0.94"/>`,
        `<path d="M8.3 10.1h5.8l-1.3 1.4H8.3v-1.4z" fill="currentColor" fill-opacity="0.34"/>`,
        `</svg>`
      ].join("");
    }
    if(kind==="carRocket"){
      return [
        `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 24px;color:${color};filter:drop-shadow(0 0 5px ${glow}) drop-shadow(0 2px 1px rgba(0,0,0,0.7))">`,
        `<path d="M2.8 16.5h18.4v2.7H2.8v-2.7z" fill="currentColor" fill-opacity="0.18"/>`,
        `<path d="M5.1 13.3h13.8l1.7 3.2H3.4l1.7-3.2z" fill="currentColor" fill-opacity="0.34" stroke="currentColor" stroke-opacity="0.28" stroke-width="0.6"/>`,
        `<path d="M6.9 9h3.2v5H6.9V9zM13.9 9h3.2v5h-3.2V9z" fill="currentColor" fill-opacity="0.14"/>`,
        `<path d="M8.5 2.5l2 1.8 0.4 4.2H5.8l0.5-4.2 2.2-1.8z" fill="currentColor" fill-opacity="0.84"/>`,
        `<path d="M15.5 2.5l2.1 1.8 0.4 4.2h-5.2l0.5-4.2 2.2-1.8z" fill="currentColor" fill-opacity="0.84"/>`,
        `<path d="M7.2 10.1h2.5v1.8H7.2v-1.8zM14.2 10.1h2.5v1.8h-2.5v-1.8z" fill="currentColor" fill-opacity="0.76"/>`,
        `<path d="M5.2 19.4h2.8l-1 2.1H4.4l0.8-2.1zM16 19.4h2.8l0.8 2.1H17l-1-2.1z" fill="currentColor" fill-opacity="0.58"/>`,
        `</svg>`
      ].join("");
    }
    return [
      `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 24px;color:${color};filter:drop-shadow(0 0 5px ${glow}) drop-shadow(0 2px 1px rgba(0,0,0,0.7))">`,
      `<path d="M6.4 8.2h8.4l3.2 4.9-2.4 6.7H5.4L3 13.1l3.4-4.9z" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-opacity="0.38" stroke-width="0.7"/>`,
      `<path d="M7.7 9.7h5.7l2.2 3.5-1.5 4.2H7l-1.5-4.2 2.2-3.5z" fill="currentColor" fill-opacity="0.82"/>`,
      `<path d="M10.6 4h5.1v2.3h-5.1V4z" fill="currentColor" fill-opacity="0.34"/>`,
      `<path d="M14.8 2.8h4.4v1.6h-4.4V2.8z" fill="currentColor" fill-opacity="0.72"/>`,
      `<path d="M15.9 2.2l2.8-1.2-0.9 2.3-1.9-1.1z" fill="currentColor" fill-opacity="0.94"/>`,
      `<path d="M8 12.5h2.2v2.2H8v-2.2zM11.3 12.5h2.2v2.2h-2.2v-2.2z" fill="currentColor" fill-opacity="0.28"/>`,
      `</svg>`
    ].join("");
  }

  function makeMapHud(panel){
    let mapHud=document.createElement("div");
    mapHud.style.cssText=[
      "position:fixed",
      "top:112px",
      `--map-size:${mapHudCssSizeFor(panel)}`,
      `left:${panelCenterLeft(panel)}`,
      "width:var(--map-size)",
      "height:var(--map-size)",
      "border-radius:50%",
      "background:transparent",
      "border:1px solid rgba(141,255,242,0.09)",
      "box-shadow:none",
      "z-index:10",
      "overflow:hidden",
      "pointer-events:none",
      "transform:translateX(-50%)",
      "transform-origin:center center"
    ].join(";");

    let mapRing=document.createElement("div");
    mapRing.style.cssText=[
      "position:absolute",
      "inset:9px",
      "border-radius:50%",
      "border:1px solid rgba(232,248,255,0.045)",
      "box-shadow:none",
      "background:repeating-conic-gradient(from 0deg,rgba(141,255,242,0.035) 0deg 1deg,transparent 1deg 12deg)",
      "mask:radial-gradient(circle,transparent 0 69%,#000 70% 100%)",
      "-webkit-mask:radial-gradient(circle,transparent 0 69%,#000 70% 100%)",
      "pointer-events:none"
    ].join(";");

    let mapGlass=document.createElement("div");
    mapGlass.style.cssText=[
      "position:absolute",
      "inset:0",
      "border-radius:50%",
      "background:linear-gradient(140deg,rgba(255,255,255,0.07),transparent 24%,transparent 62%,rgba(103,244,255,0.04)),radial-gradient(circle at 35% 25%,rgba(255,255,255,0.06),transparent 28%)",
      "pointer-events:none",
      "mix-blend-mode:screen"
    ].join(";");

    let mapCanvas=document.createElement("canvas");
    mapCanvas.width=mapHudSize;
    mapCanvas.height=mapHudSize;
    mapCanvas.style.cssText="position:absolute;inset:14px;display:block;width:calc(var(--map-size) - 28px);height:calc(var(--map-size) - 28px);border-radius:50%;opacity:0.78;filter:saturate(1.2) contrast(1.08)";
    let mapCtx=mapCanvas.getContext("2d");
    mapHud.appendChild(mapRing);
    mapHud.appendChild(mapCanvas);
    mapHud.appendChild(mapGlass);
    document.body.appendChild(mapHud);
    panel.mapHud=mapHud;
    panel.mapCanvas=mapCanvas;
    panel.mapCtx=mapCtx;
  }

  function makeCompassHud(panel){
    let compassHud=document.createElement("div");
    compassHud.style.cssText=[
      "position:fixed",
      "top:42px",
      `left:${panelCenterLeft(panel)}`,
      "transform:translateX(-50%) perspective(760px) rotateX(9deg)",
      "transform-origin:50% 0",
      `width:${panel.side==="full" ? healthHudFullWidth : healthHudSplitWidth}`,
      "height:74px",
      "z-index:11",
      "pointer-events:none",
      "filter:drop-shadow(0 12px 16px rgba(0,0,0,0.32))"
    ].join(";");

    let compassCanvas=document.createElement("canvas");
    compassCanvas.width=panel.side==="full" ? compassFullCanvasWidth : compassSplitCanvasWidth;
    compassCanvas.height=74;
    compassCanvas.style.cssText="display:block;width:100%;height:74px;filter:drop-shadow(0 0 8px rgba(103,244,255,0.18))";
    let compassCtx=compassCanvas.getContext("2d");
    compassHud.appendChild(compassCanvas);
    document.body.appendChild(compassHud);

    panel.compassHud=compassHud;
    panel.compassCanvas=compassCanvas;
    panel.compassCtx=compassCtx;
  }

  function firstPersonMapRight(panel){
    if(panel.side==="full") return "calc(9vw + 24px)";
    return panel.side==="left" ? "calc(50vw + 4.5vw + 18px)" : "calc(4.5vw + 18px)";
  }

  function firstPersonSpeedLeft(panel){
    if(panel.side==="full") return "calc(9vw + 24px)";
    return panel.side==="left" ? "calc(4.5vw + 18px)" : "calc(50vw + 4.5vw + 18px)";
  }

  function thirdPersonSpeedLeft(panel){
    if(panel.side==="full") return "calc(50vw - 551px)";
    return panel.side==="left" ? "8px" : "calc(50vw + 8px)";
  }

  function thirdPersonSpeedTransform(panel){
    if(panel.side==="full") return `perspective(430px) ${sideTilt(panel)} scale(0.96)`;
    return "scale(0.96)";
  }

  function thirdPersonMapLeft(panel){
    if(panel.side==="full") return "calc(50vw + 250px)";
    return panel.side==="left" ? "calc(25vw + 176px)" : "calc(75vw + 176px)";
  }

  function thirdPersonMapTop(panel){
    return panel.side==="full" ? "18px" : "72px";
  }

  function thirdPersonMapSizeFor(panel){
    if(panel.side==="full") return mapHudCssSizeFor(panel);
    return "clamp(132px,calc(50vw - 336px),184px)";
  }

  function applyNavigationHudLayout(){
    let firstPerson=!!getFirstPersonMode();
    let signature=(firstPerson ? "fp" : "tp")+"|"+panels.map(panel=>panel.side).join(",");
    if(signature===navigationLayoutSignature) return;
    navigationLayoutSignature=signature;

    for(let panel of panels){
      if(panel.speedHud){
        panel.speedHud.style.top=firstPerson ? "auto" : (panel.side==="full" ? "18px" : "66px");
        panel.speedHud.style.bottom=firstPerson ? "calc(8vh + 18px)" : "auto";
        panel.speedHud.style.left=firstPerson ? firstPersonSpeedLeft(panel) : thirdPersonSpeedLeft(panel);
        panel.speedHud.style.right="auto";
        panel.speedHud.style.transform=firstPerson
          ? "scale(1.104)"
          : thirdPersonSpeedTransform(panel);
        panel.speedHud.style.transformOrigin=sideTransformOrigin(panel);
        panel.speedHud.style.zIndex=firstPerson ? "76" : "10";
        panel.speedHud.style.opacity=firstPerson ? "0.94" : "1";
      }
      if(panel.mapHud){
        panel.mapHud.style.setProperty("--map-size",firstPerson
          ? (panel.side==="full" ? "333px" : "min(288px,calc(50vw - 52px))")
          : thirdPersonMapSizeFor(panel)
        );
        panel.mapHud.style.top=firstPerson ? "auto" : thirdPersonMapTop(panel);
        panel.mapHud.style.bottom=firstPerson ? "calc(8vh + 18px)" : "auto";
        panel.mapHud.style.left=firstPerson ? "auto" : thirdPersonMapLeft(panel);
        panel.mapHud.style.right=firstPerson ? firstPersonMapRight(panel) : "auto";
        panel.mapHud.style.transform="none";
        panel.mapHud.style.zIndex=firstPerson ? "76" : "10";
        panel.mapHud.style.opacity=firstPerson ? "0.92" : "1";
      }
      if(panel.compassHud){
        panel.compassHud.style.top=firstPerson ? "calc(7vh + 6px)" : "42px";
        panel.compassHud.style.left=panelCenterLeft(panel);
        panel.compassHud.style.width=firstPerson
          ? (panel.side==="full" ? "min(360px,46vw)" : "min(260px,38vw)")
          : (panel.side==="full" ? healthHudFullWidth : healthHudSplitWidth);
        panel.compassHud.style.transform=firstPerson
          ? "translateX(-50%)"
          : "translateX(-50%) perspective(760px) rotateX(9deg)";
        panel.compassHud.style.zIndex=firstPerson ? "76" : "11";
        panel.compassHud.style.opacity=firstPerson ? "0.94" : "1";
      }
    }
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

  function displayPalette(){
    let environment=getEnvironment() || {};
    let colors=environment.colors || {};
    let accent=colors.trim || colors.water || colors.shore || 0x8dfff2;
    let accentGlow=colors.water || colors.trim || 0x8dfff2;
    let low=colors.low || colors.wall || 0x687064;
    let mid=colors.mid || colors.rock || low;
    let high=colors.high || colors.trim || mid;
    let shadow=colors.underwater || colors.rock || 0x041018;
    let danger=colors.pod || colors.shore || 0xff6a42;
    let fuel=colors.grass || colors.leaf || accent;
    let text=colors.trim || colors.water || 0xf5fff9;
    let signature=[accent,accentGlow,low,mid,high,shadow,danger,fuel,text].join("|");
    if(displayPaletteCache && displayPaletteCacheSignature===signature) return displayPaletteCache;

    displayPaletteCacheSignature=signature;
    displayPaletteCache={
      signature,
      accent,
      accentGlow,
      text,
      trackBackground:rgba(shadow,0.28,0x041018),
      panelSheen:`linear-gradient(115deg,${rgba(accent,0.16,0x8dfff2)},transparent 24%,transparent 68%,${rgba(accentGlow,0.1,0x67f4ff)}),repeating-linear-gradient(0deg,${rgba(accent,0.07,0x8dfff2)} 0 1px,transparent 1px 18px)`,
      barFill:`linear-gradient(90deg,${rgba(low,0.58,0x687064)},${rgba(mid,0.78,0x8c9696)},${rgba(high,0.64,0xdde8e6)})`,
      barShadow:`inset 0 0 12px ${rgba(accentGlow,0.22,0x67f4ff)},0 0 9px ${rgba(accentGlow,0.2,0x67f4ff)}`,
      grid:`repeating-linear-gradient(90deg,${rgba(accent,0.16,0x8dfff2)} 0 1px,transparent 1px 16px)`,
      border:"0",
      softBorder:"0",
      trackShadow:`inset 0 0 10px rgba(0,0,0,0.24),0 0 10px ${rgba(accentGlow,0.1,0x67f4ff)}`,
      textGlow:`0 0 7px ${rgba(accentGlow,0.46,0x67f4ff)},0 2px 0 rgba(0,0,0,0.72)`,
      smallTextGlow:`0 0 6px ${rgba(accentGlow,0.58,0x67f4ff)},0 1px 0 rgba(0,0,0,0.8)`,
      unitBackground:`linear-gradient(90deg,${rgba(accent,0.08,0x8dfff2)},${rgba(high,0.05,0xffffff)})`,
      dangerTrack:rgba(danger,0.08,0xff6a42),
      dangerBorder:"0",
      dangerShadow:`inset 0 0 10px rgba(0,0,0,0.22),0 0 10px ${rgba(danger,0.14,0xff6a42)}`,
      fuelBorder:"0",
      fuelShadow:`inset 0 0 10px rgba(0,0,0,0.24),0 0 10px ${rgba(fuel,0.12,0x2fd36b)}`
    };
    return displayPaletteCache;
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

      let markerScale=outpost.missionId ? 1.55 : 1.18;
      let dishRadius=(7.2+pulse*1.2)*markerScale;
      mapCtx.save();
      mapCtx.translate(p.x,p.y);
      mapCtx.globalAlpha=offMap ? 0.7 : 1;
      mapCtx.shadowColor=palette.scannedRadarStroke;
      mapCtx.shadowBlur=(5+pulse*5)*markerScale;
      mapCtx.strokeStyle=palette.scannedRadarStroke;
      mapCtx.fillStyle=palette.scannedRadarFill;
      mapCtx.lineWidth=1.7*markerScale;
      mapCtx.beginPath();
      mapCtx.arc(0,-1,dishRadius,Math.PI*1.05,Math.PI*1.95);
      mapCtx.lineTo(0,-1);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.stroke();

      mapCtx.shadowBlur=0;
      mapCtx.beginPath();
      mapCtx.moveTo(0,-1);
      mapCtx.lineTo(0,8*markerScale);
      mapCtx.moveTo(-5*markerScale,8*markerScale);
      mapCtx.lineTo(5*markerScale,8*markerScale);
      mapCtx.stroke();

      mapCtx.strokeStyle=`rgba(245,255,249,${0.34+pulse*0.3})`;
      mapCtx.lineWidth=1.05*markerScale;
      for(let i=0;i<3;i++){
        let wave=dishRadius+(3+i*3+pulse*2)*markerScale;
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

  function compassArcT(delta,viewHalf){
    return Math.max(-1,Math.min(1,delta/viewHalf));
  }

  function compassBearing(dx,dz){
    return Math.atan2(dx,dz);
  }

  function formatCompassDistance(distance){
    if(!Number.isFinite(distance)) return "";
    if(distance>=1000){
      let value=distance/1000;
      return `${value>=10 ? Math.round(value) : value.toFixed(1)}ku`;
    }
    return `${Math.max(1,Math.round(distance))}u`;
  }

  function drawCompassMarkerDistance(ctx,x,y,distance,alpha=1,color="rgba(232,255,247,0.86)"){
    let label=formatCompassDistance(distance);
    if(!label) return;

    ctx.save();
    ctx.translate(x,y);
    ctx.font=`900 15px "Astor", Arial`;
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.globalAlpha=Math.max(0.34,Math.min(1,alpha));
    ctx.strokeStyle="rgba(18,7,43,0.88)";
    ctx.lineWidth=3.8;
    ctx.strokeText(label,0,0);
    ctx.fillStyle=color;
    ctx.fillText(label,0,0);
    ctx.restore();
  }

  function drawCompassStationMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette){
    let station=getStationState();
    if(!station) return;

    let dx=station.x-state.carX;
    let dz=station.z-state.carZ;
    let distSq=dx*dx+dz*dz;
    if(distSq<1) return;
    let distance=Math.sqrt(distSq);

    let heading=state.carVelAngle || 0;
    let stationAngle=compassBearing(dx,dz);
    let delta=normalizeAngle(stationAngle-heading);
    let inView=Math.abs(delta)<=viewHalf;
    let t=compassArcT(delta,viewHalf);
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
    drawCompassMarkerDistance(ctx,x,y+17,distance,alpha);
  }

  function drawCompassTradingOutpostMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette){
    let outpost=getNearestTradingOutpost(state);
    if(!outpost) return;

    let dx=outpost.x-state.carX;
    let dz=outpost.z-state.carZ;
    let distSq=dx*dx+dz*dz;
    if(distSq<1) return;
    let distance=Math.sqrt(distSq);

    let heading=state.carVelAngle || 0;
    let outpostAngle=compassBearing(dx,dz);
    let delta=normalizeAngle(outpostAngle-heading);
    let inView=Math.abs(delta)<=viewHalf;
    let t=compassArcT(delta,viewHalf);
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
    drawCompassMarkerDistance(ctx,x,y+17,distance,alpha,`rgba(239,207,114,${Math.min(0.9,alpha)})`);
  }

  function drawCompassBossBaseMarker(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette){
    let base=getNearestBossBase(state);
    if(!base) return;

    let dx=base.x-state.carX;
    let dz=base.z-state.carZ;
    let distSq=dx*dx+dz*dz;
    if(distSq<1) return;
    let distance=Math.sqrt(distSq);

    let heading=state.carVelAngle || 0;
    let baseAngle=compassBearing(dx,dz);
    let delta=normalizeAngle(baseAngle-heading);
    let inView=Math.abs(delta)<=viewHalf;
    let t=compassArcT(delta,viewHalf);
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
    drawCompassMarkerDistance(ctx,x,y+18,distance,alpha,`rgba(255,142,207,${Math.min(0.9,alpha)})`);
  }

  function drawCompassRadarOutpostMarkers(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette){
    let outposts=getCompassRadarOutposts(state);
    if(!outposts || !outposts.length) return;

    let heading=state.carVelAngle || 0;
    let pulse=0.5+0.5*Math.sin(performance.now()*0.0072);
    for(let outpost of outposts){
      if(!outpost) continue;

      let dx=outpost.x-state.carX;
      let dz=outpost.z-state.carZ;
      let distSq=dx*dx+dz*dz;
      if(distSq<1) continue;
      let distance=Math.sqrt(distSq);

      let outpostAngle=compassBearing(dx,dz);
      let delta=normalizeAngle(outpostAngle-heading);
      let inView=Math.abs(delta)<=viewHalf;
      let t=compassArcT(delta,viewHalf);
      let theta=-Math.PI/2+t*arcHalf;
      let markerRadius=radius-22;
      let x=cx+Math.cos(theta)*markerRadius;
      let y=cy+Math.sin(theta)*markerRadius;
      let scale=outpost.missionId ? 1.16 : 1;
      let alpha=inView ? 0.82+pulse*0.16 : 0.46+pulse*0.16;
      let dishRadius=(7+pulse*1.2)*scale;

      ctx.save();
      ctx.translate(x,y);
      ctx.globalAlpha=alpha;
      ctx.shadowColor=palette.scannedRadarStroke;
      ctx.shadowBlur=5+pulse*6;
      ctx.strokeStyle=palette.scannedRadarStroke;
      ctx.fillStyle=palette.scannedRadarFill;
      ctx.lineWidth=1.7*scale;
      ctx.beginPath();
      ctx.arc(0,-3*scale,dishRadius,Math.PI*1.06,Math.PI*1.94);
      ctx.lineTo(0,-3*scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur=0;

      ctx.beginPath();
      ctx.moveTo(0,-3*scale);
      ctx.lineTo(0,8*scale);
      ctx.moveTo(-5.2*scale,8*scale);
      ctx.lineTo(5.2*scale,8*scale);
      ctx.stroke();

      ctx.strokeStyle=`rgba(245,255,249,${0.34+pulse*0.34})`;
      ctx.lineWidth=1.05*scale;
      for(let i=0;i<2;i++){
        let wave=dishRadius+(3+i*3+pulse*2)*scale;
        ctx.beginPath();
        ctx.arc(0,-3*scale,wave,Math.PI*1.18,Math.PI*1.82);
        ctx.stroke();
      }
      ctx.restore();
      drawCompassMarkerDistance(ctx,x,y+18*scale,distance,alpha,`rgba(108,255,180,${Math.min(0.92,alpha)})`);
    }
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
      let distance=Math.sqrt(distSq);

      let playerAngle=compassBearing(dx,dz);
      let delta=normalizeAngle(playerAngle-heading);
      let inView=Math.abs(delta)<=viewHalf;
      let t=compassArcT(delta,viewHalf);
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
      drawCompassMarkerDistance(ctx,x,y+27,distance,alpha,`rgba(245,255,249,${Math.min(0.9,alpha)})`);
    }
  }

  function drawCompassHud(panel,state,allStates=[]){
    if(!panel.compassCtx || !state) return;

    let ctx=panel.compassCtx;
    let canvas=panel.compassCanvas;
    let width=canvas.width;
    let height=canvas.height;
    let cx=width*0.5;
    let arcHalf=0.768;
    let radius=(width-26)/(2*Math.sin(arcHalf));
    let cy=radius+12;
    let viewHalf=Math.PI*0.82;
    let heading=state.carVelAngle || 0;
    let palette=mapPalette();

    ctx.clearRect(0,0,width,height);

    ctx.lineCap="round";
    ctx.strokeStyle=compassArcStroke;
    ctx.lineWidth=2.4;
    ctx.beginPath();
    ctx.arc(cx,cy,radius,-Math.PI/2-arcHalf,-Math.PI/2+arcHalf);
    ctx.stroke();

    for(let i=-4;i<=4;i++){
      let t=i/4;
      let theta=-Math.PI/2+t*arcHalf;
      let major=i===0 || Math.abs(i)===4;
      let inner=radius-(major ? 7 : 4);
      let outer=radius+2;
      ctx.strokeStyle=major ? compassArcMajorStroke : compassArcMinorStroke;
      ctx.lineWidth=major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(theta)*inner,cy+Math.sin(theta)*inner);
      ctx.lineTo(cx+Math.cos(theta)*outer,cy+Math.sin(theta)*outer);
      ctx.stroke();
    }

    let cardinals=[
      {label:"N",angle:0},
      {label:"E",angle:-Math.PI/2},
      {label:"S",angle:Math.PI},
      {label:"W",angle:Math.PI/2}
    ];

    ctx.textAlign="center";
    ctx.textBaseline="middle";
    for(let dir of cardinals){
      let delta=normalizeAngle(dir.angle-heading);
      if(Math.abs(delta)>viewHalf) continue;

      let t=compassArcT(delta,viewHalf);
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
    drawCompassRadarOutpostMarkers(ctx,state,cx,cy,radius,arcHalf,viewHalf,palette);
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
      applyDisplayPalette(panel);
      let healthWidth=pct+"%";
      if(panel.healthFill.style.width!==healthWidth) panel.healthFill.style.width=healthWidth;
      let healthLabel=state.label+" Health "+Math.round(pct)+"%";
      if(panel.healthLabel.textContent!==healthLabel) panel.healthLabel.textContent=healthLabel;
    }
  }

  function updateSpeedHud(){
    applyNavigationHudLayout();
    let states=getCarStates();
    for(let i=0;i<panels.length;i++){
      drawSpeedHud(panels[i],states[i]);
    }
  }

  function updateMapHud(force=false){
    applyNavigationHudLayout();
    let stressLevel=Math.max(0,Math.min(3,Math.floor(getPerformanceStressLevel() || 0)));
    let interval=getPerformanceMode()==="split" ? 24 : 12;
    if(stressLevel>=3) interval*=4;
    else if(stressLevel>=2) interval*=3;
    else if(stressLevel>=1) interval*=2;
    if(!force && mapUpdateFrame++%interval!==0) return;
    let states=getCarStates();
    let enemies=getEnemyStates();
    for(let i=0;i<panels.length;i++){
      drawMapHud(panels[i],states[i],states,enemies);
    }
  }

  function updateCompassHud(){
    applyNavigationHudLayout();
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
    clearHudNodes();
    let states=getCarStates();
    panels=states.map((state,index)=>({
      side:states.length<=1 ? "full" : index===0 ? "left" : "right",
      label:state.label,
      color:state.color
    }));

    for(let panel of panels){
      makeSpeedHud(panel);
      makeMapHud(panel);
      makeCompassHud(panel);
    }
    makeGameOverOverlay();
    updateHealthHud();
    updateSpeedHud();
    applyNavigationHudLayout();
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
