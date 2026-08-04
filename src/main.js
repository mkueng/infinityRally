import { THREE } from "./three.js";
import { carRadius, gravityStrength, jumpBaseBoost, jumpSlopeBoost, chunkSize, viewDistance, mothershipDropCount, mothershipDropInterval, mothershipDropLineSpacing, mothershipHoverDistance, mothershipHoverFrames, mothershipMinDelay, mothershipRandomDelay, mothershipRocketHits } from "./constants.js";
import { carSurfaceHeight, groundHeight, roadCenterX, roadDistance, setWorldSeed } from "./terrain.js?v=ember-mesa-mountains";
import { createInput } from "./input.js?v=progressive-pointer-aim";
import { createHud } from "./hud.js?v=larger-compass-unit-labels";
import { createAmbientMotes, createBirds, createCarShadow, createClouds, createDust, createLowHangingHaze, createStars, createWheelTracks } from "./effects.js?v=fullres-star-layer";
import { createWorld } from "./world.js?v=ember-mesa-strata";
import { createMotorAudio } from "./audio.js?v=mission-accomplished-voice";
import { worldEnvironments } from "./environments.js?v=ember-mesa-mountains";
import { difficultySettings } from "./gameConfig.js?v=ammo-caps";
import { addPatchyCarDust, enemyBuggyDustPatchOptions, loadBackPackModel, loadBaseStationModel, loadCarModel, loadEnemyBattleShipModel, loadEnemyBuggyModel, loadJetModel, loadLandingSpaceModel, loadTradingOutpostModel, loadTreasureChestModels, makeMechModel, robotDustPatchOptions } from "./models.js?v=very-dark-car-colors";
import { makeDistantPlanetHazeTexture, makeDistantPlanetLightTexture, makeDistantPlanetVeilTexture, makeSkyTexture } from "./textures.js?v=stronger-sky-gradient-2";
import { createPortalSystem } from "./portals.js";
import { approach, clamp, clamp01, hash01, randomRange, smoothStep } from "./utils.js";

const initialBaseFogNear=900;
const initialBaseFogFar=3600;
const gameFontFamily="\"Astor\", Arial, sans-serif";
const dayNightCycleMs=360000;
const dayNightPhaseOffset=0.18;
const dayNightSunHorizonOffset=0.32;
const dayNightTransitionRange=0.44;
const defaultRainIntensityRange=[0.2,0.55];
const weatherClearChanceFloor=0.08;
const weatherClearChanceBase=0.72;
const weatherClearWetnessScale=0.64;
const weatherDrizzleChanceMax=0.36;
const weatherDrizzleChanceBase=0.12;
const weatherDrizzleWetnessScale=0.28;
const weatherRainChanceMax=0.34;
const weatherRainChanceBase=0.08;
const weatherRainWetnessScale=0.26;
const weatherDrizzleIntensityScale=0.45;
const weatherRainIntensityScale=0.82;
const weatherStormIntensityScale=1.18;
const weatherChangeMinMs=18000;
const weatherChangeMaxMs=46000;
const weatherEase=0.006;
const playerRobotVisualLift=0.32;
const weatherSnapThreshold=0.003;
const stormSkyRainExponent=0.72;
const stormSkyBlend=0.82;
const dreamSkyBlend=0.92;
const nightSkyDarkness=0.88;
const nightFogDarkness=0.72;
const weatherSkyBucketSteps=24;
const dreamSkyBucketSteps=32;
const skyBucketChangeThreshold=0.001;
const rainLightDim=0.24;
const fogDreamBlend=0.9;
const dreamVisualThreshold=0.001;
const hemiDayColor=0xffffff;
const hemiGroundDayColor=0xffffff;
const hemiInitialIntensity=1.35;
const hemiBaseIntensity=0.1;
const hemiDayIntensityRange=1.25;
const hemiDreamIntensityBoost=0.28;
const hemiDreamColorBlend=0.82;
const hemiDreamGroundBlend=0.9;
const sunDayColor=0xffffff;
const sunInitialIntensity=2.05;
const sunInitialPosition=[-3.5,6.5,2.2];
const sunOrbitRadius=5.5;
const sunBaseHeight=1.2;
const sunLiftHeight=8.5;
const sunBaseIntensity=0.02;
const sunDayIntensityRange=2.03;
const sunDreamIntensityReduction=0.18;
const sunDreamColorBlend=0.86;
const rainFogNearReduction=120;
const rainFogFarReduction=650;
const jetFogFarReduction=700;
const minNormalFogNear=520;
const minNormalFogDepth=650;
const dreamFogNear=45;
const dreamFogFar=520;
const rareTradingOutpostChunkProbability=0.055;
const rareTradingOutpostMinSpacing=1800;
const renderSoftnessPixelRatioScale=0.82;

let currentEnvironment=worldEnvironments[Math.floor(Math.random()*worldEnvironments.length)];
let terrainSeed=Math.random()*100000;
let rainIntensity=0;
let weatherTargetIntensity=0;
let nextWeatherChange=0;
let startPlanetPreview=null;
let baseFogNear=initialBaseFogNear;
let baseFogFar=initialBaseFogFar;
let jetFogAmount=0;
let lastSkyWeatherIntensity=-1;
let lastSkyDreamAmount=-1;
let skyDome=null;
let skyDomeMat=null;
let hemiLight=null;
let sun=null;
let currentDayAmount=1;
let headlightNightAmount=0;
let dreamFogColor=new THREE.Color(0xdac6ff);
let dreamHemiColor=new THREE.Color(0xe6ceff);
let dreamGroundColor=new THREE.Color(0x2b1b4d);
let dreamSunColor=new THREE.Color(0xffd8f4);
const stormSkyStops=["#040711","#09121e","#172534","#2f3c45","#5f6660"];
const dreamSkyStops=["#100521","#38235f","#7f62bf","#d6aeff","#fff5ff"];
let portalSystem=null;

function dreamTransitionAmount(){
  return portalSystem ? portalSystem.getDreamTransition() : 0;
}

function inDreamDimension(){
  return portalSystem ? portalSystem.isDreamDimension() : false;
}

function dayNightState(now=performance.now()){
  let phase=(now/dayNightCycleMs+dayNightPhaseOffset)%1;
  let sunHeight=Math.sin(phase*Math.PI*2);
  let dayAmount=clamp01((sunHeight+dayNightSunHorizonOffset)/dayNightTransitionRange);
  dayAmount=dayAmount*dayAmount*(3-2*dayAmount);
  return {
    phase,
    sunHeight,
    dayAmount,
    nightAmount:1-dayAmount
  };
}

function randomRainIntensity(environment,scale=1){
  let range=environment.rainIntensity || defaultRainIntensityRange;
  return Math.max(0,Math.min(1,randomRange(range[0],range[1])*scale));
}

function chooseWeatherTarget(environment){
  return 0;
}

function scheduleNextWeatherChange(now=performance.now()){
  nextWeatherChange=now+randomRange(weatherChangeMinMs,weatherChangeMaxMs);
}

weatherTargetIntensity=chooseWeatherTarget(currentEnvironment);
rainIntensity=weatherTargetIntensity;
scheduleNextWeatherChange(0);

function blendHexColor(from,to,amount){
  let a=new THREE.Color(from);
  let b=new THREE.Color(to);
  a.lerp(b,Math.max(0,Math.min(1,amount)));
  return `#${a.getHexString()}`;
}

function updateDistantPlanetPalette(environment=currentEnvironment){
  if(!distantMoon || !distantPlanetHaze || !distantPlanetLight || !distantPlanetVeil) return;

  let colors=environment.colors || {};
  let fogColor=new THREE.Color(environment.fog || 0x7b4771);
  let sky=environment.sky || ["#12072b","#33145f","#9c416f","#f08c71","#ffd3a5"];
  let terrainMid=new THREE.Color(colors.mid ?? colors.low ?? environment.fog ?? 0x788fa8);
  let terrainHigh=new THREE.Color(colors.high ?? colors.rock ?? environment.fog ?? 0x9db0be);
  let accent=new THREE.Color(colors.water ?? colors.leaf ?? colors.trim ?? environment.fog ?? 0x78a8b8);
  let skyGlow=new THREE.Color(sky[3] || sky[2] || sky[sky.length-1] || 0xbccfe0);

  let planetColor=terrainMid.clone().lerp(terrainHigh,0.38).lerp(fogColor,0.22).lerp(accent,0.08);
  let hazeColor=planetColor.clone().lerp(skyGlow,0.42);
  let veilColor=planetColor.clone().lerp(new THREE.Color(0xffffff),0.48).lerp(skyGlow,0.18);
  let lightColor=skyGlow.clone().lerp(planetColor,0.35);

  distantMoon.material.color.copy(planetColor);
  distantPlanetHaze.material.color.copy(hazeColor);
  distantPlanetVeil.material.color.copy(veilColor);
  distantPlanetLight.material.color.copy(lightColor);
}

function updateDistantPlanetVisibility(dayAmount=0){
  if(!distantMoon || !distantPlanetHaze || !distantPlanetLight || !distantPlanetVeil) return;

  let daylightFade=1-clamp01(dayAmount)*0.7;
  distantMoon.material.opacity=0.22*daylightFade;
  distantPlanetLight.material.opacity=0.78*daylightFade;
  distantPlanetVeil.material.opacity=0.16*daylightFade;
  distantPlanetHaze.material.opacity=0.7*daylightFade;
}

function weatherSkyStops(){
  let sky=currentEnvironment.sky || ["#12072b","#33145f","#9c416f","#f08c71","#ffd3a5"];
  let stormAmount=Math.pow(Math.max(0,Math.min(1,rainIntensity)),stormSkyRainExponent)*stormSkyBlend;
  let weatherStops=sky.map((color,index)=>blendHexColor(color,stormSkyStops[index] || stormSkyStops[stormSkyStops.length-1],stormAmount));
  let dreamAmount=smoothStep(dreamTransitionAmount())*dreamSkyBlend;
  if(dreamAmount<=0.001) return weatherStops;
  return weatherStops.map((color,index)=>blendHexColor(color,dreamSkyStops[index] || dreamSkyStops[dreamSkyStops.length-1],dreamAmount));
}

function timeOfDaySkyStops(now=performance.now()){
  return weatherSkyStops();
}

function setWorldSkyTexture(texture){
  if(skyDomeMat){
    if(skyDomeMat.map && skyDomeMat.map.dispose) skyDomeMat.map.dispose();
    skyDomeMat.map=texture;
    skyDomeMat.needsUpdate=true;
    scene.background=null;
  }else{
    if(scene.background && scene.background.dispose) scene.background.dispose();
    scene.background=texture;
  }
}

function updateSkyForWeather(force=false,now=performance.now()){
  let weatherBucket=Math.round(rainIntensity*weatherSkyBucketSteps)/weatherSkyBucketSteps;
  let dreamBucket=Math.round(dreamTransitionAmount()*dreamSkyBucketSteps)/dreamSkyBucketSteps;
  if(!force
    && Math.abs(weatherBucket-lastSkyWeatherIntensity)<skyBucketChangeThreshold
    && Math.abs(dreamBucket-lastSkyDreamAmount)<skyBucketChangeThreshold) return;
  lastSkyWeatherIntensity=weatherBucket;
  lastSkyDreamAmount=dreamBucket;
  setWorldSkyTexture(makeSkyTexture({...currentEnvironment,sky:timeOfDaySkyStops(now)}));
}

function refreshSceneEnvironment(){
  lastSkyWeatherIntensity=-1;
  lastSkyDreamAmount=-1;
  baseFogNear=currentEnvironment.fogRange && Number.isFinite(currentEnvironment.fogRange.near)
    ? currentEnvironment.fogRange.near
    : initialBaseFogNear;
  baseFogFar=currentEnvironment.fogRange && Number.isFinite(currentEnvironment.fogRange.far)
    ? currentEnvironment.fogRange.far
    : initialBaseFogFar;
  updateSkyForWeather(true);
  updateDistantPlanetPalette();
  scene.fog=new THREE.Fog(currentEnvironment.fog || 0x7b4771,baseFogNear,baseFogFar);
}

function updateDayNight(now=performance.now(),forceSky=false){
  let state=dayNightState(now);
  let day=state.dayAmount;
  let night=state.nightAmount;
  currentDayAmount=day;
  let rainDim=1-rainIntensity*rainLightDim;
  headlightNightAmount=night;
  updateDistantPlanetVisibility(day);

  if(hemiLight){
    hemiLight.intensity=(hemiBaseIntensity+day*hemiDayIntensityRange)*rainDim;
    hemiLight.color.set(hemiDayColor);
    hemiLight.groundColor.set(hemiGroundDayColor);
    if(dreamTransitionAmount()>dreamVisualThreshold){
      let dreamLight=smoothStep(dreamTransitionAmount());
      hemiLight.intensity*=1+dreamLight*hemiDreamIntensityBoost;
      hemiLight.color.lerp(dreamHemiColor,dreamLight*hemiDreamColorBlend);
      hemiLight.groundColor.lerp(dreamGroundColor,dreamLight*hemiDreamGroundBlend);
    }
  }

  if(sun){
    let sunAngle=state.phase*Math.PI*2;
    let sunLift=Math.max(0,state.sunHeight);
    sun.position.set(Math.cos(sunAngle)*sunOrbitRadius,sunBaseHeight+sunLift*sunLiftHeight,Math.sin(sunAngle)*sunOrbitRadius);
    sun.intensity=(sunBaseIntensity+day*sunDayIntensityRange)*rainDim;
    sun.color.set(sunDayColor);
    if(dreamTransitionAmount()>dreamVisualThreshold){
      let dreamLight=smoothStep(dreamTransitionAmount());
      sun.intensity*=1-dreamLight*sunDreamIntensityReduction;
      sun.color.lerp(dreamSunColor,dreamLight*sunDreamColorBlend);
    }
  }

  if(scene.fog){
    let dreamFog=smoothStep(dreamTransitionAmount());
    scene.fog.color.set(currentEnvironment.fog || 0x7b4771).multiplyScalar(1-night*nightFogDarkness).lerp(dreamFogColor,dreamFog*fogDreamBlend);
    let fogNear=baseFogNear-rainIntensity*rainFogNearReduction;
    let fogFar=baseFogFar-rainIntensity*rainFogFarReduction-jetFogAmount*jetFogFarReduction;
    let fogClamp=currentEnvironment.fogRange || {};
    if(night>0.001){
      fogNear+=night*(fogClamp.nightNearBoost ?? 0);
      fogFar+=night*(fogClamp.nightFarBoost ?? 0);
    }
    let normalNear=Math.max(fogClamp.minNear ?? minNormalFogNear,fogNear);
    let normalFar=Math.max(normalNear+(fogClamp.minDepth ?? minNormalFogDepth),fogFar);
    scene.fog.near=normalNear+(dreamFogNear-normalNear)*dreamFog;
    scene.fog.far=normalFar+(dreamFogFar-normalFar)*dreamFog;
  }

  if(skyDomeMat && skyDomeMat.color){
    skyDomeMat.color.setScalar(1-night*nightSkyDarkness);
  }

  updateSkyForWeather(forceSky,now);
}

function updateWeather(){
  let now=performance.now();
  if(now>=nextWeatherChange){
    weatherTargetIntensity=chooseWeatherTarget(currentEnvironment);
    scheduleNextWeatherChange(now);
  }

  rainIntensity+=(weatherTargetIntensity-rainIntensity)*weatherEase;
  if(Math.abs(weatherTargetIntensity-rainIntensity)<weatherSnapThreshold) rainIntensity=weatherTargetIntensity;

  updateDayNight(now);
}

let scene=new THREE.Scene();
const worldRenderLayer=0;
const skyRenderLayer=1;
function assignRenderLayer(object,layer){
  if(!object) return object;
  object.traverse ? object.traverse(child=>child.layers.set(layer)) : object.layers.set(layer);
  return object;
}
let playerCamera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,1e6);
let secondCamera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,1e6);
let skyRenderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance"});
let renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance",alpha:true});
renderer.setClearColor(0x000000,0);
skyRenderer.setClearColor(0x000000,1);
let automaticFullscreenEnabled=false;
let fullscreenRequestBlocked=false;
let fullscreenTransitionOverlay=null;
let fullscreenTransitionTimer=null;

function currentFullscreenElement(){
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function requestBrowserFullscreen(){
  if(!automaticFullscreenEnabled) return;
  if(fullscreenRequestBlocked || currentFullscreenElement()) return;
  let target=document.documentElement || document.body;
  let request=target.requestFullscreen || target.webkitRequestFullscreen;
  if(!target || !request) return;
  showFullscreenTransitionOverlay();
  try{
    let result=request.call(target);
    if(result && result.catch){
      result.catch(()=>{
        fullscreenRequestBlocked=true;
        hideFullscreenTransitionOverlay(180);
      });
    }
  }catch(error){
    fullscreenRequestBlocked=true;
    hideFullscreenTransitionOverlay(180);
  }
}

document.addEventListener("fullscreenchange",()=>{
  if(currentFullscreenElement()) fullscreenRequestBlocked=false;
  scheduleRendererViewportRefresh();
});
document.addEventListener("webkitfullscreenchange",()=>{
  if(currentFullscreenElement()) fullscreenRequestBlocked=false;
  scheduleRendererViewportRefresh();
});
let distantMoonDirection=new THREE.Vector3(-0.34,0.42,-0.84).normalize();
let distantPlanetScale=56000;
let distantMoonTexture=new THREE.TextureLoader().load("./assets/planets/planet1.png?v=moon-planet1");
distantMoonTexture.minFilter=THREE.LinearFilter;
distantMoonTexture.magFilter=THREE.LinearFilter;
distantMoonTexture.generateMipmaps=false;
let distantMoon=new THREE.Sprite(new THREE.SpriteMaterial({
  map:distantMoonTexture,
  color:0x788fa8,
  transparent:true,
  opacity:0.22,
  depthWrite:false,
  depthTest:true,
  fog:false
}));
distantMoon.scale.set(distantPlanetScale,distantPlanetScale,1);
distantMoon.material.rotation=Math.PI*0.5;
distantMoon.renderOrder=-10;
distantMoon.frustumCulled=false;
assignRenderLayer(distantMoon,skyRenderLayer);
scene.add(distantMoon);
let distantPlanetLight=new THREE.Sprite(new THREE.SpriteMaterial({
  map:makeDistantPlanetLightTexture(),
  color:0xffffff,
  transparent:true,
  opacity:0.78,
  depthWrite:false,
  depthTest:true,
  fog:false
}));
distantPlanetLight.scale.set(distantPlanetScale,distantPlanetScale,1);
distantPlanetLight.renderOrder=-9.5;
distantPlanetLight.frustumCulled=false;
assignRenderLayer(distantPlanetLight,skyRenderLayer);
scene.add(distantPlanetLight);
let distantPlanetVeil=new THREE.Sprite(new THREE.SpriteMaterial({
  map:makeDistantPlanetVeilTexture(),
  color:0xdce8ec,
  transparent:true,
  opacity:0.16,
  depthWrite:false,
  depthTest:true,
  fog:false
}));
distantPlanetVeil.scale.set(distantPlanetScale,distantPlanetScale,1);
distantPlanetVeil.material.rotation=Math.PI*0.5;
distantPlanetVeil.renderOrder=-9.25;
distantPlanetVeil.frustumCulled=false;
assignRenderLayer(distantPlanetVeil,skyRenderLayer);
scene.add(distantPlanetVeil);
let distantPlanetHaze=new THREE.Sprite(new THREE.SpriteMaterial({
  map:makeDistantPlanetHazeTexture(),
  color:0xd6e7f1,
  transparent:true,
  opacity:0.7,
  depthWrite:false,
  depthTest:true,
  fog:false
}));
distantPlanetHaze.scale.set(distantPlanetScale*1.0027,distantPlanetScale*1.0027,1);
distantPlanetHaze.center.set(0.5,0.5);
distantPlanetHaze.material.rotation=Math.PI*0.5;
distantPlanetHaze.renderOrder=-9;
distantPlanetHaze.frustumCulled=false;
assignRenderLayer(distantPlanetHaze,skyRenderLayer);
scene.add(distantPlanetHaze);
let currentPixelRatio=0;
let lastPixelRatioUpdate=0;
function rendererQualityState(){
  let firstPerson=firstPersonViewActive();
  let jetView=gameStarted && cars.some(car=>car.group.visible && car.health>0 && chunkViewDistanceForCar(car)>viewDistance);
  let rainy=rainIntensity>0.18;
  let severeDrop=gameStarted && lastMeasuredFps<24;
  let moderateDrop=gameStarted && lastMeasuredFps<36;
  function softened(value){
    return value*renderSoftnessPixelRatioScale;
  }
  if(gameMode==="double"){
    if(currentFrameStressLevel>=3) return softened(0.3);
    if(currentFrameStressLevel>=2) return softened(0.42);
    if(severeDrop) return softened(0.44);
    if(moderateDrop) return softened(0.54);
    if(jetView && rainy) return softened(0.58);
    if(jetView || rainy) return softened(0.64);
    return softened(0.72);
  }
  if(firstPerson){
    if(currentFrameStressLevel>=3 || severeDrop) return softened(0.34);
    if(currentFrameStressLevel>=2 || moderateDrop) return softened(0.44);
    if(jetView && rainy) return softened(0.54);
    if(jetView || rainy) return softened(0.58);
    return softened(0.64);
  }
  if(currentFrameStressLevel>=3) return softened(0.32);
  if(currentFrameStressLevel>=2) return softened(0.48);
  if(severeDrop) return softened(0.42);
  if(moderateDrop) return softened(0.72);
  if(jetView && rainy) return softened(0.8);
  if(jetView || rainy) return softened(0.88);
  return softened(0.95);
}
function updateRendererPixelRatio(){
  let target=Math.min(window.devicePixelRatio || 1,rendererQualityState());
  if(Math.abs(target-currentPixelRatio)<0.01) return;
  currentPixelRatio=target;
  renderer.setPixelRatio(target);
}
currentPixelRatio=Math.min(window.devicePixelRatio || 1,0.95*renderSoftnessPixelRatioScale);
renderer.setPixelRatio(currentPixelRatio);
skyRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
skyRenderer.setSize(rendererViewportWidth(),rendererViewportHeight(),false);
renderer.setSize(rendererViewportWidth(),rendererViewportHeight(),false);
renderer.setScissorTest(true);
skyRenderer.setScissorTest(true);
applyRendererViewportStyle();
document.body.appendChild(skyRenderer.domElement);
document.body.appendChild(renderer.domElement);

function ensureFullscreenTransitionOverlay(){
  if(fullscreenTransitionOverlay) return fullscreenTransitionOverlay;
  fullscreenTransitionOverlay=document.createElement("div");
  fullscreenTransitionOverlay.style.cssText=[
    "position:fixed",
    "inset:0",
    "z-index:1000",
    "display:none",
    "background:#000",
    "opacity:1",
    "transition:none",
    "pointer-events:none"
  ].join(";");
  document.body.appendChild(fullscreenTransitionOverlay);
  return fullscreenTransitionOverlay;
}

function showFullscreenTransitionOverlay(duration=1500){
  let startScreen=document.getElementById("startScreen");
  document.body.classList.add("start-fullscreen-transition");
  if(startScreen) startScreen.classList.add("is-fullscreen-transition");
  let overlay=ensureFullscreenTransitionOverlay();
  overlay.style.display="block";
  overlay.style.transition="none";
  overlay.style.opacity="1";
  if(fullscreenTransitionTimer) clearTimeout(fullscreenTransitionTimer);
  fullscreenTransitionTimer=setTimeout(()=>{
    hideFullscreenTransitionOverlay();
  },duration);
}

function hideFullscreenTransitionOverlay(delay=0,fadeMs=620){
  if(fullscreenTransitionTimer) clearTimeout(fullscreenTransitionTimer);
  fullscreenTransitionTimer=setTimeout(()=>{
    if(!fullscreenTransitionOverlay) return;
    fullscreenTransitionOverlay.style.transition=`opacity ${fadeMs}ms ease`;
    fullscreenTransitionOverlay.style.opacity="0";
    document.body.classList.remove("start-fullscreen-transition");
    let startScreen=document.getElementById("startScreen");
    if(startScreen) startScreen.classList.remove("is-fullscreen-transition");
    fullscreenTransitionTimer=setTimeout(()=>{
      if(fullscreenTransitionOverlay) fullscreenTransitionOverlay.style.display="none";
    },fadeMs);
  },delay);
}

function rendererViewportWidth(){
  let visual=window.visualViewport && window.visualViewport.width;
  return Math.ceil(Math.max(window.innerWidth || 1,document.documentElement.clientWidth || 1,visual || 1));
}

function rendererViewportHeight(){
  let visual=window.visualViewport && window.visualViewport.height;
  return Math.ceil(Math.max(window.innerHeight || 1,document.documentElement.clientHeight || 1,visual || 1));
}

function applyRendererViewportStyle(){
  skyRenderer.domElement.style.position="fixed";
  skyRenderer.domElement.style.left="0";
  skyRenderer.domElement.style.right="0";
  skyRenderer.domElement.style.top="0";
  skyRenderer.domElement.style.bottom="0";
  skyRenderer.domElement.style.display="block";
  skyRenderer.domElement.style.width="100dvw";
  skyRenderer.domElement.style.height="100dvh";
  skyRenderer.domElement.style.minHeight="100dvh";
  skyRenderer.domElement.style.background="#000";
  skyRenderer.domElement.style.zIndex="0";
  skyRenderer.domElement.style.pointerEvents="none";
  skyRenderer.domElement.style.filter="";
  renderer.domElement.style.position="fixed";
  renderer.domElement.style.left="0";
  renderer.domElement.style.right="0";
  renderer.domElement.style.top="0";
  renderer.domElement.style.bottom="0";
  renderer.domElement.style.display="block";
  renderer.domElement.style.width="100dvw";
  renderer.domElement.style.height="100dvh";
  renderer.domElement.style.minHeight="100dvh";
  renderer.domElement.style.background="transparent";
  renderer.domElement.style.zIndex="1";
  renderer.domElement.style.filter="";
}

function resizeRendererToViewport(){
  updateRendererPixelRatio();
  skyRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
  updateCameraProjection();
  skyRenderer.setSize(rendererViewportWidth(),rendererViewportHeight(),false);
  renderer.setSize(rendererViewportWidth(),rendererViewportHeight(),false);
  applyRendererViewportStyle();
}

function scheduleRendererViewportRefresh(){
  requestAnimationFrame(resizeRendererToViewport);
  setTimeout(resizeRendererToViewport,80);
  setTimeout(resizeRendererToViewport,260);
  setTimeout(resizeRendererToViewport,900);
}

function showMissionStartTitle(delay=160){
  missionStartTitleAt=performance.now()+delay;
  if(!missionStartText) return;
  missionStartText.style.display="block";
  missionStartText.style.opacity="0";
  missionStartText.style.transform="translate(-50%,-50%) scale(0.96)";
}

function updateMissionStartTitle(timestamp){
  if(!missionStartText || missionStartTitleAt<0) return;
  let age=timestamp-missionStartTitleAt;
  if(age<0){
    missionStartText.style.opacity="0";
    return;
  }
  let fadeIn=smoothStep(age/680);
  let fadeOut=1-smoothStep((age-1850)/780);
  let opacity=clamp(fadeIn*fadeOut,0,1);
  let scale=0.96+0.04*smoothStep(clamp(age/980,0,1));
  missionStartText.style.opacity=String(opacity);
  missionStartText.style.transform=`translate(-50%,-50%) scale(${scale.toFixed(3)})`;
  if(age>2820){
    missionStartText.style.opacity="0";
    missionStartText.style.display="none";
    missionStartTitleAt=-1;
  }
}

let fpsDisplay=document.createElement("div");
fpsDisplay.style.cssText=[
  "position:fixed",
  "right:12px",
  "bottom:10px",
  "z-index:80",
  `font-family:${gameFontFamily}`,
  "font-size:13px",
  "font-weight:900",
  "line-height:1.18",
  "letter-spacing:0.06em",
  "color:rgba(82,255,154,0.92)",
  "text-align:right",
  "white-space:pre",
  "text-shadow:0 0 5px rgba(82,255,154,0.72),0 0 14px rgba(82,255,154,0.32),0 2px 0 rgba(0,0,0,0.72)",
  "filter:drop-shadow(0 0 5px rgba(82,255,154,0.18))",
  "pointer-events:none",
  "user-select:none"
].join(";");
fpsDisplay.textContent="-- FPS";
document.body.appendChild(fpsDisplay);
let planetNameDisplay=document.createElement("div");
planetNameDisplay.textContent="";
planetNameDisplay.style.cssText=[
  "position:fixed",
  "left:20px",
  "right:auto",
  "top:auto",
  "bottom:74px",
  "z-index:12",
  `font-family:${gameFontFamily}`,
  "font-size:clamp(18px,2.1vw,28px)",
  "font-weight:900",
  "line-height:1",
  "letter-spacing:0.08em",
  "color:rgba(82,255,154,0.9)",
  "text-align:left",
  "text-transform:uppercase",
  "text-shadow:0 0 7px rgba(82,255,154,0.72),0 0 18px rgba(82,255,154,0.34),0 2px 0 rgba(0,0,0,0.72)",
  "filter:drop-shadow(0 0 8px rgba(82,255,154,0.16))",
  "pointer-events:none",
  "user-select:none"
].join(";");
document.body.appendChild(planetNameDisplay);
let missionGoalDisplay=document.createElement("div");
missionGoalDisplay.textContent="";
missionGoalDisplay.style.cssText=[
  "position:fixed",
  "left:20px",
  "right:auto",
  "top:auto",
  "bottom:18px",
  "z-index:12",
  "max-width:min(420px,46vw)",
  `font-family:${gameFontFamily}`,
  "font-size:clamp(11px,1.15vw,15px)",
  "font-weight:900",
  "line-height:1.28",
  "letter-spacing:0.04em",
  "color:rgba(82,255,154,0.82)",
  "text-align:left",
  "text-transform:uppercase",
  "text-shadow:0 0 6px rgba(82,255,154,0.62),0 0 15px rgba(82,255,154,0.28),0 2px 0 rgba(0,0,0,0.72)",
  "filter:drop-shadow(0 0 6px rgba(82,255,154,0.14))",
  "pointer-events:none",
  "user-select:none",
  "display:none"
].join(";");
document.body.appendChild(missionGoalDisplay);
let objectiveHudLayoutSignature="";
function updatePlanetNameDisplay(){
  if(!planetNameDisplay) return;
  planetNameDisplay.textContent=(currentEnvironment && currentEnvironment.name) || "";
}
updatePlanetNameDisplay();
let firstPersonVisorOverlay=document.createElement("div");
firstPersonVisorOverlay.style.cssText=[
  "position:fixed",
  "inset:0",
  "z-index:72",
  "display:none",
  "pointer-events:none",
  "user-select:none",
  "overflow:hidden"
].join(";");
document.body.appendChild(firstPersonVisorOverlay);

function addVisorPart(parent,styles){
  let part=document.createElement("div");
  part.style.cssText=styles.join(";");
  parent.appendChild(part);
  return part;
}

function createFirstPersonVisorPane(left,width){
  let pane=document.createElement("div");
  pane.style.cssText=[
    "position:absolute",
    `left:${left}`,
    "top:0",
    `width:${width}`,
    "height:100%",
    "overflow:hidden",
    "display:block"
  ].join(";");

  let robotLayer=document.createElement("div");
  robotLayer.style.cssText=[
    "position:absolute",
    "inset:0"
  ].join(";");
  pane.appendChild(robotLayer);
  pane._robotLayer=robotLayer;

  let carLayer=document.createElement("div");
  carLayer.style.cssText=[
    "position:absolute",
    "inset:0",
    "opacity:0",
    "transition:opacity 160ms linear"
  ].join(";");
  pane.appendChild(carLayer);
  pane._carLayer=carLayer;

  addVisorPart(robotLayer,[
    "position:absolute",
    "inset:0",
    "background:radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 50%, rgba(3,16,13,0.1) 72%, rgba(0,0,0,0.72) 100%)"
  ]);
  addVisorPart(robotLayer,[
    "position:absolute",
    "left:-2%",
    "right:-2%",
    "top:0",
    "height:8%",
    "background:linear-gradient(180deg, rgba(1,4,5,0.94), rgba(5,10,10,0.86) 50%, rgba(0,0,0,0.08) 100%)",
    "clip-path:polygon(0 0, 100% 0, 100% 52%, 86% 52%, 82% 100%, 18% 100%, 14% 52%, 0 52%)",
    "box-shadow:0 6px 24px rgba(0,0,0,0.58)"
  ]);
  addVisorPart(robotLayer,[
    "position:absolute",
    "left:-2%",
    "right:-2%",
    "bottom:0",
    "height:11%",
    "background:linear-gradient(0deg, rgba(1,4,5,0.94), rgba(5,10,10,0.86) 54%, rgba(0,0,0,0.06) 100%)",
    "clip-path:polygon(0 22%, 13% 22%, 18% 0, 82% 0, 87% 22%, 100% 22%, 100% 100%, 0 100%)",
    "box-shadow:0 -8px 28px rgba(0,0,0,0.62)"
  ]);
  addVisorPart(robotLayer,[
    "position:absolute",
    "left:-2%",
    "top:4.8%",
    "bottom:6.8%",
    "width:17%",
    "background:linear-gradient(101deg, rgba(0,0,0,0.98), rgba(5,13,12,0.9) 54%, rgba(3,18,13,0.42) 80%, rgba(0,0,0,0))",
    "clip-path:polygon(0 0, 74% 0, 100% 8%, 76% 50%, 100% 92%, 72% 100%, 0 100%)",
    "box-shadow:10px 0 26px rgba(0,0,0,0.38)"
  ]);
  addVisorPart(robotLayer,[
    "position:absolute",
    "right:-2%",
    "top:4.8%",
    "bottom:6.8%",
    "width:17%",
    "background:linear-gradient(259deg, rgba(0,0,0,0.98), rgba(5,13,12,0.9) 54%, rgba(3,18,13,0.42) 80%, rgba(0,0,0,0))",
    "clip-path:polygon(26% 0, 100% 0, 100% 100%, 28% 100%, 0 92%, 24% 50%, 0 8%)",
    "box-shadow:-10px 0 26px rgba(0,0,0,0.38)"
  ]);
  addVisorPart(robotLayer,[
    "position:absolute",
    "left:14%",
    "right:14%",
    "top:5.4%",
    "bottom:6.6%",
    "border:2px solid rgba(82,255,154,0.42)",
    "box-shadow:inset 0 0 18px rgba(82,255,154,0.08), 0 0 18px rgba(82,255,154,0.28)",
    "clip-path:polygon(5% 0, 95% 0, 100% 8%, 100% 91%, 94% 100%, 6% 100%, 0 91%, 0 8%)"
  ]);
  addVisorPart(robotLayer,[
    "position:absolute",
    "left:14.6%",
    "top:7.1%",
    "width:2px",
    "height:36%",
    "background:rgba(82,255,154,0.94)",
    "box-shadow:0 0 10px rgba(82,255,154,0.9)",
    "transform:rotate(8deg)",
    "transform-origin:top"
  ]);
  addVisorPart(robotLayer,[
    "position:absolute",
    "right:14.6%",
    "top:7.1%",
    "width:2px",
    "height:36%",
    "background:rgba(82,255,154,0.94)",
    "box-shadow:0 0 10px rgba(82,255,154,0.9)",
    "transform:rotate(-8deg)",
    "transform-origin:top"
  ]);
  addVisorPart(robotLayer,[
    "position:absolute",
    "left:30%",
    "right:30%",
    "top:5.6%",
    "height:2px",
    "background:linear-gradient(90deg, rgba(82,255,154,0), rgba(82,255,154,0.78), rgba(82,255,154,0))",
    "box-shadow:0 0 10px rgba(82,255,154,0.7)"
  ]);
  addVisorPart(robotLayer,[
    "position:absolute",
    "left:23%",
    "right:23%",
    "bottom:7.8%",
    "height:2px",
    "background:linear-gradient(90deg, rgba(82,255,154,0), rgba(82,255,154,0.86) 18%, rgba(82,255,154,0.22) 50%, rgba(82,255,154,0.86) 82%, rgba(82,255,154,0))",
    "box-shadow:0 0 11px rgba(82,255,154,0.76)"
  ]);

  let reticle=addVisorPart(robotLayer,[
    "position:absolute",
    "left:50%",
    "top:52%",
    "width:78px",
    "height:58px",
    "transform:translate(-50%,-50%)",
    "filter:drop-shadow(0 0 7px rgba(82,255,154,0.7))"
  ]);
  addVisorPart(reticle,[
    "position:absolute",
    "left:28px",
    "top:18px",
    "width:22px",
    "height:22px",
    "border:2px solid rgba(82,255,154,0.82)",
    "border-radius:50%",
    "box-sizing:border-box"
  ]);
  addVisorPart(reticle,["position:absolute","left:0","top:28px","width:22px","height:2px","background:rgba(82,255,154,0.82)"]);
  addVisorPart(reticle,["position:absolute","right:0","top:28px","width:22px","height:2px","background:rgba(82,255,154,0.82)"]);
  addVisorPart(reticle,["position:absolute","left:38px","top:0","width:2px","height:16px","background:rgba(82,255,154,0.82)"]);
  addVisorPart(reticle,["position:absolute","left:38px","bottom:0","width:2px","height:16px","background:rgba(82,255,154,0.82)"]);

  addVisorPart(carLayer,[
    "position:absolute",
    "inset:0",
    "background:radial-gradient(ellipse at 50% 47%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.18) 83%, rgba(0,0,0,0.54) 100%)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:0",
    "right:0",
    "bottom:0",
    "height:21%",
    "background:linear-gradient(0deg, rgba(5,8,10,0.74), rgba(10,16,18,0.44) 58%, rgba(10,16,18,0.03) 100%)",
    "clip-path:polygon(0 58%, 10% 42%, 34% 35%, 50% 40%, 66% 35%, 90% 42%, 100% 58%, 100% 100%, 0 100%)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:5%",
    "right:5%",
    "top:6%",
    "height:5.4%",
    "background:linear-gradient(180deg, rgba(0,0,0,0.82), rgba(0,0,0,0.22), rgba(0,0,0,0))",
    "clip-path:polygon(3% 0, 97% 0, 100% 100%, 0 100%)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:3.5%",
    "top:7%",
    "bottom:17%",
    "width:13%",
    "background:linear-gradient(101deg, rgba(0,0,0,0.84), rgba(0,0,0,0.58) 45%, rgba(8,14,16,0.16) 78%, rgba(0,0,0,0))",
    "clip-path:polygon(0 0, 56% 0, 100% 100%, 0 100%)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "right:3.5%",
    "top:7%",
    "bottom:17%",
    "width:13%",
    "background:linear-gradient(259deg, rgba(0,0,0,0.84), rgba(0,0,0,0.58) 45%, rgba(8,14,16,0.16) 78%, rgba(0,0,0,0))",
    "clip-path:polygon(44% 0, 100% 0, 100% 100%, 0 100%)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:13%",
    "right:13%",
    "bottom:12.5%",
    "height:3.8%",
    "background:linear-gradient(90deg, rgba(16,26,29,0), rgba(20,30,34,0.82) 18%, rgba(42,54,54,0.76) 50%, rgba(20,30,34,0.82) 82%, rgba(16,26,29,0))",
    "clip-path:polygon(0 80%, 18% 28%, 50% 0, 82% 28%, 100% 80%, 100% 100%, 0 100%)",
    "box-shadow:0 -1px 8px rgba(174,230,228,0.06)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:12%",
    "right:12%",
    "top:9%",
    "bottom:8%",
    "border-top:1px solid rgba(183,231,225,0.22)",
    "border-left:1px solid rgba(183,231,225,0.16)",
    "border-right:1px solid rgba(183,231,225,0.16)",
    "clip-path:polygon(4% 0, 96% 0, 100% 100%, 0 100%)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:43%",
    "right:43%",
    "top:7%",
    "height:2.5%",
    "background:linear-gradient(180deg, rgba(0,0,0,0.72), rgba(18,26,28,0.64))",
    "border:1px solid rgba(200,234,232,0.18)",
    "box-shadow:0 2px 10px rgba(0,0,0,0.36)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:18%",
    "top:14%",
    "width:22%",
    "height:1px",
    "background:linear-gradient(90deg, rgba(210,255,249,0), rgba(210,255,249,0.16), rgba(210,255,249,0))",
    "transform:rotate(-17deg)",
    "opacity:0.72"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "right:18%",
    "top:17%",
    "width:18%",
    "height:1px",
    "background:linear-gradient(90deg, rgba(210,255,249,0), rgba(210,255,249,0.13), rgba(210,255,249,0))",
    "transform:rotate(15deg)",
    "opacity:0.62"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:50%",
    "bottom:-8.5%",
    "width:min(28%,230px)",
    "aspect-ratio:1",
    "transform:translateX(-50%)",
    "border:4px solid rgba(3,6,8,0.84)",
    "border-top-color:rgba(19,30,33,0.9)",
    "border-radius:50%",
    "box-shadow:inset 0 0 0 2px rgba(180,220,218,0.06), 0 0 18px rgba(0,0,0,0.42)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:50%",
    "bottom:2.8%",
    "width:min(9%,72px)",
    "height:2.2%",
    "transform:translateX(-50%)",
    "background:rgba(2,5,6,0.76)",
    "clip-path:polygon(12% 0, 88% 0, 100% 100%, 0 100%)",
    "box-shadow:0 0 8px rgba(0,0,0,0.32)"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:24%",
    "bottom:4.8%",
    "width:10%",
    "height:2.4%",
    "background:linear-gradient(90deg, rgba(0,0,0,0), rgba(13,21,24,0.52), rgba(0,0,0,0))",
    "clip-path:polygon(0 35%, 100% 0, 92% 100%, 8% 100%)",
    "opacity:0.86"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "right:24%",
    "bottom:4.8%",
    "width:10%",
    "height:2.4%",
    "background:linear-gradient(90deg, rgba(0,0,0,0), rgba(13,21,24,0.52), rgba(0,0,0,0))",
    "clip-path:polygon(0 0, 100% 35%, 92% 100%, 8% 100%)",
    "opacity:0.86"
  ]);
  addVisorPart(carLayer,[
    "position:absolute",
    "left:16%",
    "right:16%",
    "bottom:8.5%",
    "height:1px",
    "background:linear-gradient(90deg, rgba(183,231,225,0), rgba(183,231,225,0.25), rgba(183,231,225,0))",
    "opacity:0.55"
  ]);

  firstPersonVisorOverlay.appendChild(pane);
  return pane;
}

let firstPersonVisorPanes=[
  createFirstPersonVisorPane("0","100%"),
  createFirstPersonVisorPane("0","50%"),
  createFirstPersonVisorPane("50%","50%")
];

function firstPersonViewActive(){
  return firstPersonPerspective
    && gameStarted
    && !gameOver
    && !gamePaused
    && !terminalOverlayOpen()
    && !startSequence
    && !(terraformFinale && terraformFinale.active);
}

function updateObjectiveHudLayout(){
  if(!planetNameDisplay || !missionGoalDisplay) return;

  let firstPerson=firstPersonViewActive();
  let signature=(firstPerson ? "fp" : "tp")+"|"+gameMode;
  if(signature===objectiveHudLayoutSignature) return;
  objectiveHudLayoutSignature=signature;

  if(firstPerson){
    planetNameDisplay.style.left="auto";
    planetNameDisplay.style.right="18px";
    planetNameDisplay.style.top="14px";
    planetNameDisplay.style.bottom="auto";
    planetNameDisplay.style.textAlign="right";
    planetNameDisplay.style.maxWidth="min(420px,46vw)";

    missionGoalDisplay.style.left="auto";
    missionGoalDisplay.style.right="18px";
    missionGoalDisplay.style.top="46px";
    missionGoalDisplay.style.bottom="auto";
    missionGoalDisplay.style.textAlign="right";
    missionGoalDisplay.style.maxWidth="min(420px,46vw)";
    return;
  }

  planetNameDisplay.style.left=gameMode==="double" ? "18px" : "20px";
  planetNameDisplay.style.right="auto";
  planetNameDisplay.style.top="auto";
  planetNameDisplay.style.bottom=gameMode==="double" ? "70px" : "74px";
  planetNameDisplay.style.textAlign="left";
  planetNameDisplay.style.maxWidth=gameMode==="double" ? "min(360px,44vw)" : "min(520px,50vw)";

  missionGoalDisplay.style.left=gameMode==="double" ? "18px" : "20px";
  missionGoalDisplay.style.right="auto";
  missionGoalDisplay.style.top="auto";
  missionGoalDisplay.style.bottom=gameMode==="double" ? "16px" : "18px";
  missionGoalDisplay.style.textAlign="left";
  missionGoalDisplay.style.maxWidth=gameMode==="double" ? "min(360px,44vw)" : "min(520px,50vw)";
}

function firstPersonPaneCarAmount(paneIndex){
  let car=paneIndex===0
    ? playerCar
    : displayCars()[paneIndex-1];
  if(!car) return 0;

  let morphAmount=smoothStep(clamp((car.morphProgress-0.38)/0.36,0,1));
  let jetAmount=smoothStep(clamp((car.jetProgress-0.32)/0.36,0,1));
  return morphAmount*(1-jetAmount);
}

function updateFirstPersonVisorOverlay(){
  if(!firstPersonVisorOverlay) return;
  let visible=firstPersonViewActive();
  firstPersonVisorOverlay.style.display=visible ? "block" : "none";
  if(!visible) return;
  let split=gameMode==="double";
  firstPersonVisorPanes[0].style.display=split ? "none" : "block";
  firstPersonVisorPanes[1].style.display=split ? "block" : "none";
  firstPersonVisorPanes[2].style.display=split ? "block" : "none";
  for(let i=0;i<firstPersonVisorPanes.length;i++){
    let pane=firstPersonVisorPanes[i];
    let carAmount=firstPersonPaneCarAmount(i);
    if(pane._robotLayer) pane._robotLayer.style.opacity=String(1-carAmount);
    if(pane._carLayer) pane._carLayer.style.opacity=String(carAmount);
  }
}
let terraformFadeOverlay=document.createElement("div");
terraformFadeOverlay.style.cssText=[
  "position:fixed",
  "inset:0",
  "z-index:120",
  "background:#000",
  "opacity:0",
  "pointer-events:none",
  "transition:none"
].join(";");
document.body.appendChild(terraformFadeOverlay);
let terraformCompleteText=document.createElement("div");
terraformCompleteText.textContent="Mission: Accomplished";
terraformCompleteText.style.cssText=[
  "position:fixed",
  "left:50%",
  "top:50%",
  "transform:translate(-50%,-50%)",
  "z-index:121",
  `font-family:${gameFontFamily}`,
  "font-size:clamp(34px,7vw,92px)",
  "font-weight:900",
  "letter-spacing:0.08em",
  "text-transform:uppercase",
  "color:rgba(232,255,238,0.96)",
  "text-align:center",
  "text-shadow:0 0 22px rgba(125,255,113,0.5),0 4px 0 rgba(0,0,0,0.9)",
  "opacity:0",
  "pointer-events:none",
  "user-select:none",
  "white-space:nowrap"
].join(";");
document.body.appendChild(terraformCompleteText);
let missionCompleteOverlay=document.createElement("div");
missionCompleteOverlay.id="missionCompleteOverlay";
missionCompleteOverlay.style.cssText=[
  "position:fixed",
  "inset:0",
  "z-index:130",
  "display:none",
  "align-items:center",
  "justify-content:center",
  "background:rgba(0,0,0,0.86)",
  "pointer-events:auto",
  "user-select:none"
].join(";");
let missionCompleteText=document.createElement("div");
missionCompleteText.textContent="Mission: Accomplished";
missionCompleteText.style.cssText=[
  `font-family:${gameFontFamily}`,
  "font-size:clamp(36px,7vw,92px)",
  "font-weight:900",
  "letter-spacing:0.08em",
  "text-transform:uppercase",
  "color:rgba(232,255,238,0.98)",
  "text-align:center",
  "text-shadow:0 0 22px rgba(125,255,113,0.56),0 4px 0 rgba(0,0,0,0.9)",
  "opacity:0",
  "transform:scale(0.96)",
  "transition:opacity 520ms ease,transform 520ms ease",
  "white-space:nowrap"
].join(";");
let missionCompleteBackButton=document.createElement("button");
missionCompleteBackButton.type="button";
missionCompleteBackButton.textContent="Back to Main Menu";
missionCompleteBackButton.style.cssText=[
  "position:absolute",
  "left:50%",
  "bottom:52px",
  "transform:translateX(-50%)",
  "height:52px",
  "min-width:260px",
  "border:1px solid rgba(184,255,186,0.72)",
  "background:#64d968",
  "color:#071d10",
  `font-family:${gameFontFamily}`,
  "font-size:16px",
  "font-weight:900",
  "letter-spacing:0.04em",
  "text-transform:uppercase",
  "box-shadow:0 0 18px rgba(100,217,104,0.28)",
  "pointer-events:auto"
].join(";");
missionCompleteOverlay.appendChild(missionCompleteText);
missionCompleteOverlay.appendChild(missionCompleteBackButton);
document.body.appendChild(missionCompleteOverlay);
let missionStartText=document.createElement("div");
missionStartText.textContent="Mission: Initiated";
missionStartText.style.cssText=[
  "position:fixed",
  "left:50%",
  "top:50%",
  "transform:translate(-50%,-50%) scale(0.96)",
  "z-index:1001",
  `font-family:${gameFontFamily}`,
  "font-size:clamp(36px,6.4vw,86px)",
  "font-weight:900",
  "letter-spacing:0.06em",
  "color:rgba(82,255,154,0.96)",
  "text-align:center",
  "text-shadow:0 0 12px rgba(82,255,154,0.72),0 0 28px rgba(82,255,154,0.34),0 4px 0 rgba(0,0,0,0.86)",
  "opacity:0",
  "display:none",
  "pointer-events:none",
  "user-select:none",
  "white-space:nowrap"
].join(";");
document.body.appendChild(missionStartText);
let missionStartTitleAt=-1;
let fpsSampleStart=0;
let fpsSampleFrames=0;
let lastMeasuredFps=60;
let perfSampleFrames=0;
let perfSampleSimSteps=0;
let perfSample={
  sim:0,
  effects:0,
  chunks:0,
  render:0,
  maxFrame:0
};

function resetPerfSample(){
  perfSampleFrames=0;
  perfSampleSimSteps=0;
  perfSample.sim=0;
  perfSample.effects=0;
  perfSample.chunks=0;
  perfSample.render=0;
  perfSample.maxFrame=0;
}

function recordPerfBucket(bucket,ms){
  if(!Number.isFinite(ms) || ms<0 || perfSample[bucket]===undefined) return;
  perfSample[bucket]+=ms;
}

function recordPerfSim(ms,steps){
  if(!Number.isFinite(ms) || ms<0) return;
  perfSample.sim+=ms;
  perfSampleSimSteps+=Math.max(1,steps || 0);
}

function recordPerfFrame(frameMs){
  perfSampleFrames++;
  if(Number.isFinite(frameMs)) perfSample.maxFrame=Math.max(perfSample.maxFrame,frameMs);
}

function avgPerfMs(bucket){
  if(bucket==="sim") return perfSample[bucket]/Math.max(1,perfSampleSimSteps);
  return perfSample[bucket]/Math.max(1,perfSampleFrames);
}

function formatPerfMs(value){
  return value<10 ? value.toFixed(1) : Math.round(value).toString();
}

function updateFpsDisplay(timestamp){
  if(!Number.isFinite(timestamp)) return;
  if(fpsSampleStart<=0) fpsSampleStart=timestamp;
  fpsSampleFrames++;

  let elapsed=timestamp-fpsSampleStart;
  if(elapsed<250) return;

  let fps=Math.round((fpsSampleFrames*1000)/Math.max(1,elapsed));
  lastMeasuredFps=fps;
  fpsDisplay.textContent=[
    fps+" FPS",
    "SIM "+formatPerfMs(avgPerfMs("sim"))+"  FX "+formatPerfMs(avgPerfMs("effects")),
    "CHK "+formatPerfMs(avgPerfMs("chunks"))+"  REN "+formatPerfMs(avgPerfMs("render")),
    "MAX "+formatPerfMs(perfSample.maxFrame)
  ].join("\n");
  fpsSampleStart=timestamp;
  fpsSampleFrames=0;
  resetPerfSample();
}

skyDomeMat=new THREE.MeshBasicMaterial({
  side:THREE.BackSide,
  depthWrite:false,
  depthTest:false,
  fog:false,
  toneMapped:false
});
skyDome=new THREE.Mesh(new THREE.SphereGeometry(420000,32,16),skyDomeMat);
skyDome.frustumCulled=false;
skyDome.renderOrder=-1000;
assignRenderLayer(skyDome,skyRenderLayer);
scene.add(skyDome);

refreshSceneEnvironment();

hemiLight=new THREE.HemisphereLight(hemiDayColor,hemiGroundDayColor,hemiInitialIntensity);
scene.add(hemiLight);
sun=new THREE.DirectionalLight(sunDayColor,sunInitialIntensity);
sun.position.set(...sunInitialPosition);
scene.add(sun);
updateDayNight(performance.now(),true);

let input=createInput();
let px=0,py=20,pz=0;
let gameOver=false;
let gameWon=false;
let healthDamageCooldown=0;
const terrainHeightCacheScale=4;
const terrainHeightCacheLimit=24000;
const terrainHeightCacheTrim=4000;
let terrainHeightCache=new Map();
let cameraFollowDistance=18;
let cameraFollowHeight=7.5;
let cameraDownhillSampleDistance=30;
let cameraDownhillExtraHeight=9.5;
let cameraDownhillPullIn=4.5;
let cameraTerrainClearance=5.8;
let cameraYawTurnFollowRate=0.075;
let cameraYawRecenterFollowRate=0.034;
let jetCameraYawRecenterFollowRate=0.024;
let firstPersonPerspective=false;
let screenShakeAmount=0;
let screenShakeSeed=0;
let screenShakeOffset=new THREE.Vector3();
let terraformFinale=null;
let terraformFinaleTriggered=false;
let pendingBossFinale=null;
let testingTerraformFinaleAfterSpawn=false;
let testingTerraformFinaleDelayFrames=5*60;
let terraformMatrixDummy=new THREE.Object3D();

function finishTerraformGeometry(geometry){
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function deformTerraformGeometry(geometry,seed,options={}){
  let pos=geometry.attributes.position;
  let rough=options.rough ?? 0.22;
  let vertical=options.vertical ?? 0.08;
  let flatten=options.flatten ?? 1;
  for(let i=0;i<pos.count;i++){
    let x=pos.getX(i);
    let y=pos.getY(i);
    let z=pos.getZ(i);
    let l=Math.max(0.001,Math.hypot(x,y,z));
    let n1=hash01(x*13.7+seed,y*19.3-z*7.1)*2-1;
    let n2=hash01(z*17.1-seed,x*11.9+y*5.7)*2-1;
    let wobble=1+n1*rough+n2*rough*0.38;
    pos.setXYZ(
      i,
      x*wobble+n2*0.035,
      y*flatten+(n1+n2)*vertical*(0.35+Math.abs(y)/l),
      z*(1+n2*rough*0.72)+n1*0.035
    );
  }
  return finishTerraformGeometry(geometry);
}

function makeTerraformGrassGeometry(){
  let positions=[];
  for(let i=0;i<4;i++){
    let angle=i*Math.PI*0.5+hash01(i,4.7)*0.28;
    let rightX=Math.cos(angle)*0.055;
    let rightZ=-Math.sin(angle)*0.055;
    let leanX=Math.sin(angle)*(0.08+hash01(i,2.1)*0.08);
    let leanZ=Math.cos(angle)*(0.08+hash01(i,5.3)*0.08);
    let height=0.82+hash01(i,8.9)*0.34;
    positions.push(
      -rightX,0,-rightZ,
      rightX,0,rightZ,
      leanX,height,leanZ
    );
  }
  let geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  return finishTerraformGeometry(geometry);
}

function makeTerraformTrunkGeometry(seed=1,topRadius=0.13,bottomRadius=0.22){
  let geometry=new THREE.CylinderGeometry(topRadius,bottomRadius,1,7,6);
  let pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    let x=pos.getX(i);
    let y=pos.getY(i);
    let z=pos.getZ(i);
    let t=y+0.5;
    let bend=Math.sin(t*Math.PI)*(0.08+hash01(seed,2.7)*0.06);
    let twist=(hash01(seed+x*9.1,z*7.3)-0.5)*0.06;
    pos.setXYZ(
      i,
      x*(1+twist)+bend,
      y,
      z*(1-twist)+Math.sin(t*5.2+seed)*0.025
    );
  }
  return finishTerraformGeometry(geometry);
}

function makeTerraformFlowerGeometry(){
  let positions=[];
  for(let i=0;i<6;i++){
    let a=i*Math.PI/3;
    let next=a+Math.PI/6;
    let inner=0.04;
    let outer=0.18+(i%2)*0.035;
    positions.push(
      0,0,0,
      Math.sin(a)*inner,0.025,Math.cos(a)*inner,
      Math.sin(next)*outer,0.02,Math.cos(next)*outer
    );
  }
  positions.push(
    -0.04,0.015,-0.04,
    0.04,0.015,-0.04,
    0,0.07,0.04
  );
  let geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  return finishTerraformGeometry(geometry);
}

let terraformGrassGeo=makeTerraformGrassGeometry();
let terraformFernGeo=deformTerraformGeometry(new THREE.IcosahedronGeometry(0.55,1),3,{rough:0.34,vertical:0.08,flatten:1.35});
let terraformBushGeo=deformTerraformGeometry(new THREE.IcosahedronGeometry(0.9,2),5,{rough:0.28,vertical:0.1,flatten:0.78});
let terraformFlowerStemGeo=makeTerraformTrunkGeometry(7,0.025,0.038);
let terraformTrunkGeo=makeTerraformTrunkGeometry(11);
let terraformCrownGeo=deformTerraformGeometry(new THREE.IcosahedronGeometry(1,2),13,{rough:0.28,vertical:0.12,flatten:0.96});
let terraformConiferCrownGeo=deformTerraformGeometry(new THREE.IcosahedronGeometry(1,2),17,{rough:0.24,vertical:0.1,flatten:0.72});
let terraformBroadCrownGeo=deformTerraformGeometry(new THREE.SphereGeometry(1,12,8),19,{rough:0.2,vertical:0.08,flatten:0.58});
let terraformColumnCrownGeo=deformTerraformGeometry(new THREE.SphereGeometry(1,12,10),23,{rough:0.18,vertical:0.1,flatten:1.55});
let terraformFlowerGeo=makeTerraformFlowerGeometry();
let terraformGrassMat=new THREE.MeshStandardMaterial({color:0x7cff7a,emissive:0x123c12,emissiveIntensity:0.16,roughness:0.8});
let terraformFernMat=new THREE.MeshStandardMaterial({color:0x55d86f,emissive:0x0a3216,emissiveIntensity:0.18,roughness:0.82});
let terraformBushMat=new THREE.MeshStandardMaterial({color:0x38c85f,emissive:0x082f14,emissiveIntensity:0.2,roughness:0.78});
let terraformTrunkMat=new THREE.MeshStandardMaterial({color:0x6f4a2e,roughness:0.9,metalness:0.02});
let terraformCrownMat=new THREE.MeshStandardMaterial({color:0x4dff7a,emissive:0x0f4d1f,emissiveIntensity:0.28,roughness:0.72});
let terraformDarkCrownMat=new THREE.MeshStandardMaterial({color:0x1fbd58,emissive:0x063916,emissiveIntensity:0.2,roughness:0.78});
let terraformPaleCrownMat=new THREE.MeshStandardMaterial({color:0x9aff84,emissive:0x1c4d18,emissiveIntensity:0.22,roughness:0.7});
let terraformFlowerMat=new THREE.MeshBasicMaterial({color:0xfff0a8,transparent:true,opacity:0.94,depthWrite:false});
let terraformPinkFlowerMat=new THREE.MeshBasicMaterial({color:0xff7ccf,transparent:true,opacity:0.94,depthWrite:false});
let terraformBlueFlowerMat=new THREE.MeshBasicMaterial({color:0x76d9ff,transparent:true,opacity:0.94,depthWrite:false});
let terraformOrangeFlowerMat=new THREE.MeshBasicMaterial({color:0xffb55f,transparent:true,opacity:0.94,depthWrite:false});
let terraformStemMat=new THREE.MeshStandardMaterial({color:0x72e36b,emissive:0x0b3413,emissiveIntensity:0.14,roughness:0.82});
let terraformRingMat=new THREE.MeshBasicMaterial({color:0x8dff95,transparent:true,opacity:0.36,depthWrite:false,depthTest:true,side:THREE.DoubleSide});
let startSequence=null;
let startSequenceCameraPos=new THREE.Vector3();
let startSequenceLookAt=new THREE.Vector3();
let startSequenceNormalPos=new THREE.Vector3();
let startSequenceNormalQuat=new THREE.Quaternion();
let gameIntroAudioStarted=false;
let cars=[];
let gameStarted=false;
let gamePaused=false;
let controllerMenuButtonDown=false;
let missionCompleteControllerButtonDown=false;
let missionCompleteShownAt=0;
let missionCompleteInputReadyAt=0;
let tradingScreenOpen=false;
let missionScreenOpen=false;
let gameMode="single";
let gameDifficulty="medium";
const saveGameStorageKey="sol8.lastGameStatus.v1";
const saveGameVersion=1;
let enemies=[];
let enemyWaveDelay=0;
let enemyPatrolDelay=900;
let enemySpawnSerial=0;
let enemyBudgetRun=0;
let missionEnemyGraceMs=120000;
let missionEnemyGraceUntil=0;
let mothership=null;
let giantTestRobot=null;
let mothershipHoverAltitude=56;
let mothershipDelay=mothershipMinDelay+Math.floor(Math.random()*mothershipRandomDelay);
let baseStationModel=null;
let enemyShipModel=null;
let enemyBuggyModel=null;
let tradingOutpostModel=null;
let tradingOutpost=null;
let testingTradingOutpost=null;
let testingTradingOutpostEnabled=false;
let testingRadarOutpostEnabled=false;
let tradingOutpostCollision=null;
let tradingTerminalObject=null;
let tradingPlaceCollisions=[];
let currentStartInfo=null;
let currentGameFromSave=false;
let jetUnlocked=false;
let initialUnits=500;
let testingScannerAvailableFromStart=true;
let jetAvailableFromStart=true;
let testingRocketBuggiesAtStart=true;
let testingRocketBuggyStartCount=5;
let testingSkipIntro=false;
let units=initialUnits;
let lastBuildingExplosionSoundAt=0;
let buildingExplosionSoundCooldownMs=80;
let purchasedTradingItems=new Set();
let normalEnemyUnitAmount=20;
let giantEnemyUnitAmount=50;
let droneEnemyUnitAmount=70;
let crabEnemyUnitAmount=10;
let mothershipUnitAmount=150;
let mothershipBeamFrames=132;
let mothershipBeamOutFrames=118;
let bossBaseUnitAmount=650;
let bossBaseDamageMultiplier=0.38;
let bossBaseClusterBombHits=5;
let emberCommunicationMissionId="ember-communications";
let emberCommunicationOutpostCount=3;
let completedMissionsStorageKey="seed-completed-missions.v3";
let villageBuildingUnitAmount=50;
let villageClearedUnitAmount=100;
let cityClearedUnitAmount=1500;
let scoredVillages=new WeakSet();
let waterLevel=-20;
let scannedBossBases=new Set();
let rareTradingOutposts=new Map();
let rareTradingOutpostRejectedKeys=new Set();
let scannedTradingOutposts=new Map();
let scannedRadarOutposts=new Map();
let missionCommunicationOutposts=[];
let generatedPlanetMission=null;
let completedMissionIds=readCompletedMissionIds();
let refreshStartPlanetButtons=()=>{};
let scannedLandingSpaces=new Map();
let scannedPortals=new Map();
let scannerKeyDown=false;
let scannerCooldownMs=10000;
let scannerReadyAt=0;
let missionCompassScannerFired=false;
let robotDamageZoneNames=["head","torso","leftArm","rightArm","leftLeg","rightLeg"];
let mechGroundMaxSpeed=0.4;
let mechAirMaxSpeed=0.9;
let morphedCarSpeedMultiplier=4;
let morphTransitionRate=0.075;
let jetTransitionRate=0.075;
let jetMaxSpeed=2.4;
let jetHoverGroundClearance=28.8;
let jetHoverMinimumGroundClearance=13.2;
let jetHoverTerrainRiseFollow=0.12;
let jetHoverTerrainFallFollow=0.035;
let jetHoverSpring=0.075;
let jetHoverDamping=0.26;
let jetDriftAlignMin=0.012;
let jetDriftAlignMax=0.082;
let jetDriftTurnResponse=0.17;
let jetDriftSlipScale=2.8;
let jetExitGroundClearance=5.5;
let jetLandingMorphClearance=11.4;
let jetLandingBoosterLeadClearance=9.5;
let jetLandingBoosterSoftDescentSpeed=0.11;
let mechStrideLength=2.35;
let rocketSpeed=1.75;
let longRangeRocketSpeed=2.85;
let rocketCooldownFrames=34;
let rocketTurnRate=0.075;
let rocketAimYOffset=-4.2;
let aimOffsetYMin=-16;
let aimOffsetYMax=21;
let cameraAimPitchMin=-8.4;
let cameraAimPitchMax=8.8;
let initialClusterBombAmmo=10;
let rocketLauncherPurchaseAmmo=50;
let tradingCannonShotAmount=100;
let tradingRocketAmount=50;
let tradingBombAmount=1;
let jetPurchaseBombAmount=10;
let maxBoostCharge=100;
let hoverBoostRechargeRate=maxBoostCharge/(30*60);
let robotBoostFlightMaxAltitude=34;
let jetFlightMaxAltitude=92;
let maxFuel=100;
let carFuelDrainRate=0.003;
let jetFuelDrainRate=carFuelDrainRate*2;
let rocketSupplyAmount=6;
let carRocketSupplyAmount=3;
let cannonSupplyAmount=40;
let healthSupplyAmount=35;
let boostSupplyAmount=45;
let clusterBombSupplyAmount=20;
let rockets=[];
let supplyBoxes=[];
let supplyScanCooldown=0;
let supplySpawnKeys=new Set();
let rocketBodyGeo=new THREE.CylinderGeometry(0.11,0.13,0.8,12);
let rocketNoseGeo=new THREE.ConeGeometry(0.16,0.34,12);
let rocketFinGeo=new THREE.BoxGeometry(0.08,0.18,0.22);
let rocketBodyMat=new THREE.MeshStandardMaterial({color:0x30363b,roughness:0.48,metalness:0.55});
let rocketNoseMat=new THREE.MeshStandardMaterial({color:0xff6633,emissive:0x8f2108,emissiveIntensity:0.55,roughness:0.38,metalness:0.35});
let rocketFlameMat=new THREE.MeshStandardMaterial({color:0xfff0a0,emissive:0xff7a12,emissiveIntensity:1.2,roughness:0.28});
let ambientSpaceships=[];
let ambientSpaceshipCooldown=540+Math.floor(Math.random()*620);
let ambientSpaceshipMaxActive=2;
let testingAmbientSpaceshipFormationAtStart=true;
let testingAmbientSpaceshipFormationDelayFrames=30*60;
let ambientStartFormationDelay=0;
let ambientStartFormationSpawned=false;
let ambientSpaceshipBodyGeo=new THREE.CylinderGeometry(0.46,0.66,4.8,8);
let ambientSpaceshipNoseGeo=new THREE.ConeGeometry(0.66,1.55,8);
let ambientSpaceshipWingGeo=new THREE.BoxGeometry(2.8,0.16,1.25);
let ambientSpaceshipFinGeo=new THREE.BoxGeometry(0.22,0.92,0.95);
let ambientSpaceshipEngineGeo=new THREE.SphereGeometry(0.34,16,10);
let ambientSpaceshipTrailGeo=new THREE.CylinderGeometry(0.1,1.75,58,16,1,true);
let ambientSpaceshipBodyMat=new THREE.MeshStandardMaterial({color:0x25313a,emissive:0x07131c,emissiveIntensity:0.42,roughness:0.5,metalness:0.68});
let ambientSpaceshipWingMat=new THREE.MeshStandardMaterial({color:0x60717d,emissive:0x101a24,emissiveIntensity:0.3,roughness:0.46,metalness:0.62});
let ambientSpaceshipEngineMat=new THREE.MeshBasicMaterial({color:0xb8f3ff,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending});
let ambientSpaceshipTrailMat=new THREE.MeshBasicMaterial({color:0x7edcff,transparent:true,opacity:0.18,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
let cannonSpeed=3.35;
let cannonCooldownFrames=12;
let cannonBolts=[];
let cannonBodyGeo=new THREE.CylinderGeometry(0.044,0.064,0.56,12);
let cannonCoreGeo=new THREE.SphereGeometry(0.088,14,10);
let cannonGlowGeo=new THREE.SphereGeometry(0.16,16,10);
let cannonBodyMat=new THREE.MeshBasicMaterial({
  color:0xffffff,
  transparent:true,
  opacity:0.86,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let cannonCoreMat=new THREE.MeshBasicMaterial({
  color:0xffffff,
  transparent:true,
  opacity:0.95,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let cannonGlowMat=new THREE.MeshBasicMaterial({
  color:0x9fd8ff,
  transparent:true,
  opacity:0.34,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let giantFireballs=[];
let giantFireballCoreGeo=new THREE.SphereGeometry(1,24,16);
let giantFireballGlowGeo=new THREE.SphereGeometry(1,24,16);
let giantFireballCoreMat=new THREE.MeshBasicMaterial({
  color:0xfff0a0,
  transparent:true,
  opacity:0.96,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let giantFireballGlowMat=new THREE.MeshBasicMaterial({
  color:0xff5a16,
  transparent:true,
  opacity:0.34,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let surfaceScanPulses=[];
let surfaceScanRingSegments=168;
let surfaceScanSpokeCount=16;
let surfaceScanMat=new THREE.LineBasicMaterial({
  color:0x63ff8c,
  transparent:true,
  opacity:0.92,
  depthWrite:false,
  blending:THREE.AdditiveBlending,
  toneMapped:false
});
let surfaceScanGlowMat=new THREE.LineBasicMaterial({
  color:0xbaff72,
  transparent:true,
  opacity:0.58,
  depthWrite:false,
  blending:THREE.AdditiveBlending,
  toneMapped:false
});
let bossLaserMat=new THREE.LineBasicMaterial({
  color:0xff4fc8,
  transparent:true,
  opacity:1,
  linewidth:2,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let bossLaserGlowMat=new THREE.LineBasicMaterial({
  color:0xff91df,
  transparent:true,
  opacity:0.58,
  linewidth:8,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let playerLaserMat=new THREE.LineBasicMaterial({
  color:0xff3f2f,
  transparent:true,
  opacity:1,
  linewidth:3,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let playerLaserGlowMat=new THREE.LineBasicMaterial({
  color:0xff9b58,
  transparent:true,
  opacity:0.64,
  linewidth:10,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let playerLaserTubeGeo=new THREE.CylinderGeometry(1,1,1,18,1,true);
let playerLaserTubeMat=new THREE.MeshBasicMaterial({
  color:0xff3f2f,
  transparent:true,
  opacity:0.22,
  depthWrite:false,
  blending:THREE.AdditiveBlending,
  side:THREE.DoubleSide
});
let playerLaserOuterTubeMat=new THREE.MeshBasicMaterial({
  color:0xff6b2f,
  transparent:true,
  opacity:0.12,
  depthWrite:false,
  blending:THREE.AdditiveBlending,
  side:THREE.DoubleSide
});
let playerLaserImpactCoreGeo=new THREE.SphereGeometry(1,20,12);
let playerLaserImpactCoreMat=new THREE.MeshBasicMaterial({
  color:0xfff0c8,
  transparent:true,
  opacity:0.92,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let playerLaserImpactHaloMat=new THREE.MeshBasicMaterial({
  color:0xff3f2f,
  transparent:true,
  opacity:0.38,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let bossLaserBeams=[];
let bossLaserPointA=new THREE.Vector3();
let bossLaserPointB=new THREE.Vector3();
let playerLaserFireFrames=300;
let playerLaserCooldownFrames=300;
let playerLaserDamageInterval=12;
let playerLaserDamageAmount=28;
let playerLaserMothershipDamage=1.2;
let playerLaserPointA=new THREE.Vector3();
let playerLaserPointB=new THREE.Vector3();
let playerLaserYAxis=new THREE.Vector3(0,1,0);
let droneBodyMat=new THREE.MeshStandardMaterial({color:0x202935,emissive:0x061728,emissiveIntensity:0.35,roughness:0.56,metalness:0.7});
let droneWingMat=new THREE.MeshStandardMaterial({color:0x58657a,emissive:0x121827,emissiveIntensity:0.22,roughness:0.6,metalness:0.55});
let droneCoreMat=new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.78,depthWrite:false,blending:THREE.AdditiveBlending});
let boatHullMat=new THREE.MeshStandardMaterial({color:0x1a2630,emissive:0x06121a,emissiveIntensity:0.28,roughness:0.58,metalness:0.62});
let boatDeckMat=new THREE.MeshStandardMaterial({color:0x4f6172,emissive:0x101820,emissiveIntensity:0.16,roughness:0.52,metalness:0.58});
let boatMissileMat=new THREE.MeshStandardMaterial({color:0x7f2f25,emissive:0x2f0703,emissiveIntensity:0.42,roughness:0.4,metalness:0.5});
let buggyHullMat=new THREE.MeshStandardMaterial({color:0x0d1210,emissive:0x010302,emissiveIntensity:0.12,roughness:0.72,metalness:0.5});
let buggyArmorMat=new THREE.MeshStandardMaterial({color:0x201c17,emissive:0x030201,emissiveIntensity:0.08,roughness:0.66,metalness:0.64});
let buggyWheelMat=new THREE.MeshStandardMaterial({color:0x050607,roughness:0.9,metalness:0.12});
let buggyLauncherMat=new THREE.MeshStandardMaterial({color:0x33110d,emissive:0x090100,emissiveIntensity:0.26,roughness:0.52,metalness:0.58});
let buggyTrimMat=new THREE.MeshStandardMaterial({color:0x342d21,roughness:0.58,metalness:0.58});
let spiderBodyMat=new THREE.MeshStandardMaterial({color:0x151821,emissive:0x220912,emissiveIntensity:0.38,roughness:0.76,metalness:0.52});
let spiderLegMat=new THREE.MeshStandardMaterial({color:0x3a2334,emissive:0x120512,emissiveIntensity:0.26,roughness:0.68,metalness:0.48});
let mothershipHullMat=new THREE.MeshStandardMaterial({color:0x211c32,emissive:0x09051a,emissiveIntensity:0.42,roughness:0.72,metalness:0.58});
let mothershipGlowMat=new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.46,depthWrite:false,blending:THREE.AdditiveBlending});
let mothershipAuraMat=new THREE.MeshBasicMaterial({
  color:0x7fbaff,
  transparent:true,
  opacity:0.16,
  depthWrite:false,
  depthTest:true,
  blending:THREE.AdditiveBlending,
  side:THREE.BackSide
});
let mothershipAuraColorA=new THREE.Color(0x6fb7ff);
let mothershipAuraColorB=new THREE.Color(0xb18cff);
let mothershipAuraColorC=new THREE.Color(0x78f0e6);
let mothershipAuraColorTemp=new THREE.Color();
let mothershipHoverHazeGeo=new THREE.SphereGeometry(1,48,16);
let clusterBombRadius=300;
let clusterBombCooldownFrames=150;
let clusterBombInitialDropSpeed=0.22;
let clusterBombArcDistance=260;
let clusterBombArcDrop=58;
let clusterBombs=[];
let clusterBombBodyGeo=new THREE.DodecahedronGeometry(0.52,0);
let clusterBombFinGeo=new THREE.BoxGeometry(0.12,0.36,0.42);
let clusterBombBodyMat=new THREE.MeshStandardMaterial({color:0x1a2023,roughness:0.42,metalness:0.72});
let clusterBombBandMat=new THREE.MeshStandardMaterial({
  color:0xffc743,
  emissive:0x8a4a00,
  emissiveIntensity:0.42,
  roughness:0.36,
  metalness:0.28
});
let clusterBombGlowGeo=new THREE.SphereGeometry(0.82,18,12);
let clusterBombGlowMat=new THREE.MeshBasicMaterial({
  color:0xffd36a,
  transparent:true,
  opacity:0.34,
  depthWrite:false,
  blending:THREE.AdditiveBlending
});
let mouseAimRaycaster=new THREE.Raycaster();
let mouseAimPointer=new THREE.Vector2();
let terminalClickRaycaster=new THREE.Raycaster();
let terminalClickPointer=new THREE.Vector2();
let terminalFocusRaycaster=new THREE.Raycaster();
let terminalFocusPointer=new THREE.Vector2();
let terminalFocusOrigin=new THREE.Vector3();
let terminalFocusDirection=new THREE.Vector3();
let terminalFocusWorldPoint=new THREE.Vector3();
let mouseAimHitPoint=new THREE.Vector3();
let mouseAimRayPoint=new THREE.Vector3();
let mouseAimRayStart=new THREE.Vector3();
let mouseAimRayEnd=new THREE.Vector3();
let controllerAimLocalPoint=new THREE.Vector3();
let controllerAimWorldPoint=new THREE.Vector3();
let controllerAimOrigin=new THREE.Vector3();
let controllerAimDirection=new THREE.Vector3();
let aimCrossWorldPoint=new THREE.Vector3();
let aimCrossYawQuaternion=new THREE.Quaternion();
let aimCrossParentInverseQuaternion=new THREE.Quaternion();
let aimCrossYawAxis=new THREE.Vector3(0,1,0);
let mouseAimMaxDistance=430;
let mouseAimFallbackDistance=170;
let explosionBursts=[];
let explosionFlashGeo=new THREE.SphereGeometry(1,18,12);
let explosionRingGeo=new THREE.TorusGeometry(1,0.045,8,64);
let explosionFlashMat=new THREE.MeshBasicMaterial({
  color:0xffd27a,
  transparent:true,
  opacity:0.9,
  depthWrite:false,
  depthTest:true,
  blending:THREE.AdditiveBlending
});
let explosionRingMat=new THREE.MeshBasicMaterial({
  color:0x8dfff2,
  transparent:true,
  opacity:0.8,
  depthWrite:false,
  depthTest:true,
  blending:THREE.AdditiveBlending
});
let teleportEffects=[];
let treasurePickupEffects=[];
let teleportBeamGeo=new THREE.CylinderGeometry(1,1,1,96,1,true);
let teleportRingGeo=new THREE.TorusGeometry(1,0.032,18,128);
let teleportBeamMat=new THREE.MeshBasicMaterial({
  color:0xffe1a6,
  transparent:true,
  opacity:0.24,
  depthWrite:false,
  depthTest:true,
  side:THREE.DoubleSide,
  blending:THREE.AdditiveBlending
});
let teleportSparkMat=new THREE.PointsMaterial({
  color:0xfff1c8,
  size:0.16,
  transparent:true,
  opacity:0.95,
  depthWrite:false,
  depthTest:true,
  blending:THREE.AdditiveBlending
});
let rockDebris=[];
let rockDebrisGeo=new THREE.DodecahedronGeometry(1,0);
let rockDebrisMat=new THREE.MeshStandardMaterial({color:0x4c3a5b,roughness:0.96,metalness:0.08});
let buildingDebrisGeo=new THREE.BoxGeometry(1,1,1);
let buildingDebrisMat=new THREE.MeshStandardMaterial({color:0x5a526d,roughness:0.9,metalness:0.12});
let radarDebrisMat=new THREE.MeshStandardMaterial({
  color:0x7e929d,
  emissive:0x123644,
  emissiveIntensity:0.28,
  roughness:0.42,
  metalness:0.82
});
let enemyTrimMat=new THREE.MeshStandardMaterial({color:0x8f7d5c,roughness:0.5,metalness:0.58});
let enemyEyeMat=new THREE.MeshStandardMaterial({
  color:0xd88a54,
  emissive:0x5a2414,
  emissiveIntensity:0.62,
  roughness:0.24,
  metalness:0.22
});
let supplyBoxGeo=new THREE.BoxGeometry(2.4,1.15,2.4);
let supplyLidGeo=new THREE.BoxGeometry(2.65,0.22,2.65);
let supplyBandGeo=new THREE.BoxGeometry(2.75,0.16,0.28);
let rocketSupplyMat=new THREE.MeshStandardMaterial({color:0x763627,roughness:0.72,metalness:0.18});
let cannonSupplyMat=new THREE.MeshStandardMaterial({color:0x23516b,roughness:0.68,metalness:0.2});
let healthSupplyMat=new THREE.MeshStandardMaterial({color:0x275f38,roughness:0.66,metalness:0.16});
let boostSupplyMat=new THREE.MeshStandardMaterial({color:0x5f4b18,roughness:0.62,metalness:0.2});
let jetSupplyMat=new THREE.MeshStandardMaterial({color:0x22313c,roughness:0.5,metalness:0.38});
let supplyLidMat=new THREE.MeshStandardMaterial({color:0x161c1e,roughness:0.82,metalness:0.3});
let rocketSupplyBandMat=new THREE.MeshStandardMaterial({color:0xff7a32,emissive:0x742000,emissiveIntensity:0.28,roughness:0.48,metalness:0.12});
let cannonSupplyBandMat=new THREE.MeshStandardMaterial({color:0x7ff8ff,emissive:0x115e66,emissiveIntensity:0.36,roughness:0.38,metalness:0.1});
let healthSupplyBandMat=new THREE.MeshStandardMaterial({color:0x7cff78,emissive:0x116b21,emissiveIntensity:0.38,roughness:0.42,metalness:0.08});
let boostSupplyBandMat=new THREE.MeshStandardMaterial({color:0xffe46f,emissive:0x7a5b00,emissiveIntensity:0.42,roughness:0.34,metalness:0.1});
let jetSupplyBandMat=new THREE.MeshStandardMaterial({color:0x74e7ff,emissive:0x0e5e72,emissiveIntensity:0.62,roughness:0.24,metalness:0.12});
let jetLogoMat=new THREE.MeshStandardMaterial({color:0xe8fbff,emissive:0x2fcfff,emissiveIntensity:0.58,roughness:0.22,metalness:0.18});

function terrainHeightAt(x,z){
  let qx=Math.round(x*terrainHeightCacheScale);
  let qz=Math.round(z*terrainHeightCacheScale);
  let key=qx+","+qz;
  let cached=terrainHeightCache.get(key);
  if(cached!==undefined) return cached;

  let value=groundHeight(qx/terrainHeightCacheScale,qz/terrainHeightCacheScale);
  terrainHeightCache.set(key,value);
  if(terrainHeightCache.size>terrainHeightCacheLimit){
    let trimmed=0;
    for(let oldKey of terrainHeightCache.keys()){
      terrainHeightCache.delete(oldKey);
      trimmed++;
      if(trimmed>=terrainHeightCacheTrim) break;
    }
  }
  return value;
}

function clearTerrainHeightCache(){
  terrainHeightCache.clear();
}

function waterDepthAt(x,z){
  return waterLevel-terrainHeightAt(x,z);
}

function tradingOutpostSurfaceHeightAt(x,z,margin=0){
  margin=Math.max(0,margin || 0);
  let best=null;

  for(let collision of activeTradingOutpostCollisions()){
    let local=worldToTradingOutpostLocal(x,z,collision);
    if(!local || !collision.floor) continue;

    let floor=collision.floor;
    if(local.x<floor.minX-margin || local.x>floor.maxX+margin || local.z<floor.minZ-margin || local.z>floor.maxZ+margin) continue;

    let y=collision.y+floor.y;
    best=Number.isFinite(best) ? Math.max(best,y) : y;
  }

  return best;
}

function physicalSurfaceHeight(x,z,outpostMargin=0,terrainY=terrainHeightAt(x,z)){
  let surfaceY=terrainY;
  let holeSurfaceY=world && world.holeSurfaceHeightAt ? world.holeSurfaceHeightAt(x,z) : null;
  if(Number.isFinite(holeSurfaceY)) surfaceY=Math.min(surfaceY,holeSurfaceY);
  let landingSurfaceY=world && world.landingSurfaceHeightAt ? world.landingSurfaceHeightAt(x,z,true) : null;
  if(Number.isFinite(landingSurfaceY)) surfaceY=Math.max(surfaceY,landingSurfaceY);
  let tradingOutpostSurfaceY=tradingOutpostSurfaceHeightAt(x,z,outpostMargin);
  if(Number.isFinite(tradingOutpostSurfaceY)) surfaceY=tradingOutpostSurfaceY;
  return surfaceY;
}

function drivingSurfaceHeight(x,z,outpostMargin=0){
  let terrainY=terrainHeightAt(x,z);
  let surfaceY=physicalSurfaceHeight(x,z,outpostMargin,terrainY);
  return waterLevel-terrainY>0.15 ? Math.max(surfaceY,waterLevel-0.34) : surfaceY;
}

function playerGroundVehicleInDeepWater(actor,x,z){
  return actor
    && cars.includes(actor)
    && !actor.jetMode
    && (actor.jetProgress || 0)<0.35
    && waterDepthAt(x,z)>2.2;
}

function surfaceHeightForActor(actor,x,z){
  let actorRadius=actor && Number.isFinite(actor.collisionRadius)
    ? actor.collisionRadius
    : 2.35;
  let outpostMargin=Math.max(7.5,actorRadius*2.75);
  let waterDepth=waterDepthAt(x,z);
  if(playerGroundVehicleInDeepWater(actor,x,z)){
    let floorY=physicalSurfaceHeight(x,z,outpostMargin);
    let waterSurfaceY=drivingSurfaceHeight(x,z,outpostMargin);
    let submerge=clamp((waterDepth-2.2)/4.4,0,1);
    return waterSurfaceY+(floorY-waterSurfaceY)*smoothStep(submerge);
  }
  return drivingSurfaceHeight(x,z,outpostMargin);
}

function cameraClearanceSurfaceHeightForCar(car,x,z){
  return playerGroundVehicleInDeepWater(car,car.x,car.z) ? physicalSurfaceHeight(x,z) : drivingSurfaceHeight(x,z);
}

function landingSurfaceAt(x,z){
  return world && world.landingSurfaceAt ? world.landingSurfaceAt(x,z) : null;
}

function landingPadSurfaceAt(x,z){
  return world && world.landingSurfaceAt ? world.landingSurfaceAt(x,z,true) : null;
}

function groundHoleAt(x,z){
  return world && world.holeAt ? world.holeAt(x,z) : null;
}

function terrainSlopeAt(x,z){
  let sampleDistance=3.2;
  let center=drivingSurfaceHeight(x,z);
  let xSlope=Math.abs(drivingSurfaceHeight(x+sampleDistance,z)-drivingSurfaceHeight(x-sampleDistance,z))/(sampleDistance*2);
  let zSlope=Math.abs(drivingSurfaceHeight(x,z+sampleDistance)-drivingSurfaceHeight(x,z-sampleDistance))/(sampleDistance*2);
  let diagonalSlope=Math.abs(drivingSurfaceHeight(x+sampleDistance,z+sampleDistance)-drivingSurfaceHeight(x-sampleDistance,z-sampleDistance))/(sampleDistance*2.828);
  return Math.max(xSlope,zSlope,diagonalSlope,Math.abs(center-drivingSurfaceHeight(x+sampleDistance,z-sampleDistance))/(sampleDistance*1.414));
}

function terrainReliefAt(x,z){
  let center=drivingSurfaceHeight(x,z);
  let radius=20;
  let minNearby=center;
  for(let sample of [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]]){
    minNearby=Math.min(minNearby,drivingSurfaceHeight(x+sample[0]*radius,z+sample[1]*radius));
  }
  return Math.max(0,center-minNearby);
}

function mountainClimbProfile(car,fromX,fromZ,toX,toZ){
  let fromY=drivingSurfaceHeight(fromX,fromZ);
  let actuallyFlying=car.y>fromY+1.4 || car.jetMode || car.jetProgress>0.2;
  if(actuallyFlying) return {blocked:false,slowdown:0};

  let dx=toX-fromX;
  let dz=toZ-fromZ;
  let distance=Math.hypot(dx,dz);
  if(distance<0.01) return {blocked:false,slowdown:0};

  let maxGrade=0;
  let totalUphill=0;
  let previousX=fromX;
  let previousZ=fromZ;
  let previousY=fromY;
  let samples=Math.max(3,Math.ceil(distance/0.28));

  for(let i=1;i<=samples;i++){
    let t=i/samples;
    let sampleX=fromX+dx*t;
    let sampleZ=fromZ+dz*t;
    let sampleY=drivingSurfaceHeight(sampleX,sampleZ);
    let stepDistance=Math.hypot(sampleX-previousX,sampleZ-previousZ);
    let uphill=sampleY-previousY;

    if(uphill>0 && stepDistance>0.001){
      maxGrade=Math.max(maxGrade,uphill/stepDistance);
      totalUphill+=uphill;
    }

    previousX=sampleX;
    previousZ=sampleZ;
    previousY=sampleY;
  }

  let localSlope=terrainSlopeAt(toX,toZ);
  let localRelief=terrainReliefAt(toX,toZ);
  let averageUphill=totalUphill/Math.max(0.001,distance);
  let carMode=car.morphProgress>0.68 && car.jetProgress<0.35;

  if(carMode){
    if(totalUphill<=0.08) return {blocked:false,slowdown:0};

    let gradeSeverity=clamp((maxGrade-0.26)/0.42,0,1);
    let averageSeverity=clamp((averageUphill-0.1)/0.24,0,1);
    let slopeSeverity=clamp((localSlope-0.18)/0.32,0,1);
    let heightSeverity=clamp((localRelief-4)/14,0,1);
    let slowdown=Math.max(gradeSeverity,averageSeverity,slopeSeverity)*heightSeverity;
    let blocked=(localRelief>13 && totalUphill>0.34 && maxGrade>0.62 && localSlope>0.42)
      || (localRelief>18 && averageUphill>0.24 && localSlope>0.36);
    return {blocked,slowdown:blocked ? 1 : clamp(slowdown,0,0.82)};
  }

  let blocked=localRelief>17 && totalUphill>0.42 && maxGrade>0.95 && localSlope>0.85;
  return {blocked,slowdown:0};
}

function uphillGradeAlongSegment(fromX,fromZ,toX,toZ){
  let dx=toX-fromX;
  let dz=toZ-fromZ;
  let distance=Math.hypot(dx,dz);
  if(distance<0.01) return 0;

  let totalUphill=0;
  let previousX=fromX;
  let previousZ=fromZ;
  let previousY=drivingSurfaceHeight(fromX,fromZ);
  let samples=Math.max(2,Math.ceil(distance/0.45));

  for(let i=1;i<=samples;i++){
    let t=i/samples;
    let sampleX=fromX+dx*t;
    let sampleZ=fromZ+dz*t;
    let sampleY=drivingSurfaceHeight(sampleX,sampleZ);
    let stepDistance=Math.hypot(sampleX-previousX,sampleZ-previousZ);
    if(stepDistance>0.001){
      totalUphill+=Math.max(0,sampleY-previousY);
    }
    previousX=sampleX;
    previousZ=sampleZ;
    previousY=sampleY;
  }

  return totalUphill/distance;
}

function normalizeAngle(angle){
  while(angle>Math.PI) angle-=Math.PI*2;
  while(angle<-Math.PI) angle+=Math.PI*2;
  return angle;
}

function roadYawAt(z){
  return Math.atan2(roadCenterX(z+18)-roadCenterX(z-18),36);
}

function updateCameraProjection(){
  let width=rendererViewportWidth();
  let height=rendererViewportHeight();
  let splitAspect=Math.max(0.1,(gameMode==="single" ? width : width*0.5)/height);

  let defaultVerticalFov=50;
  let minVerticalFov=38;
  let maxHorizontalFov=82;
  let horizontalFovRad=THREE.MathUtils.degToRad(maxHorizontalFov);
  let verticalFovForWidth=THREE.MathUtils.radToDeg(
    2*Math.atan(Math.tan(horizontalFovRad*0.5)/splitAspect)
  );

  let fov=Math.max(minVerticalFov,Math.min(defaultVerticalFov,verticalFovForWidth));
  playerCamera.aspect=splitAspect;
  playerCamera.fov=fov;
  playerCamera.updateProjectionMatrix();
  secondCamera.aspect=splitAspect;
  secondCamera.fov=fov;
  secondCamera.updateProjectionMatrix();

  let zoomCompensation=Math.tan(THREE.MathUtils.degToRad(defaultVerticalFov*0.5))
    / Math.tan(THREE.MathUtils.degToRad(fov*0.5));
  cameraFollowDistance=16*Math.min(1.2,zoomCompensation);
  cameraFollowHeight=7*Math.min(1.12,Math.sqrt(zoomCompensation));
}
updateCameraProjection();

let singleActiveCarsCache=[];
function activeCars(){
  if(gameMode!=="single") return cars;
  singleActiveCarsCache[0]=playerCar;
  singleActiveCarsCache.length=1;
  return singleActiveCarsCache;
}

function displayCars(){
  return gameMode==="single" ? [playerCar] : [secondCar,playerCar];
}

function isPlayerActor(actor){
  return !!actor && cars.includes(actor);
}

let targetableCarsCacheFrame=-1;
let targetableCarsCache=null;

function playerInvisibleToEnemies(car){
  return inDreamDimension() && isPlayerActor(car);
}

function playerCombatSuppressed(actor){
  return isPlayerActor(actor) && (inDreamDimension() || playerAimingAtTradingTerminal(actor));
}

function enemyTargetableCars(){
  if(targetableCarsCacheFrame===fixedFrameIndex && targetableCarsCache){
    return targetableCarsCache;
  }
  if(inDreamDimension()) return [];
  targetableCarsCache=activeCars().filter(car=>car && car.health>0 && car.group && car.group.visible);
  targetableCarsCacheFrame=fixedFrameIndex;
  return targetableCarsCache;
}

function activeEnemies(){
  return enemies.filter(enemy=>enemy.active && enemy.health>0);
}

function missionEnemyGraceActive(now=performance.now()){
  return gameStarted && Number.isFinite(missionEnemyGraceUntil) && now<missionEnemyGraceUntil;
}

function enemyCountsTowardAmbientSpawn(enemy,targetableCars=enemyTargetableCars()){
  if(!enemy || !enemy.active || enemy.health<=0) return false;
  if(enemy.missionOutpost && !enemy.missionOutpost.destroyed){
    return playerDistanceSqForEnemy(enemy,targetableCars)<720*720;
  }
  return true;
}

function ambientEnemyCount(targetableCars=enemyTargetableCars()){
  let count=0;
  for(let enemy of enemies){
    if(enemyCountsTowardAmbientSpawn(enemy,targetableCars)) count++;
  }
  return count;
}

function combatActors(){
  return [...activeCars(),...activeEnemies()];
}

function cosmeticFrameInterval(base=1){
  let interval=Math.max(1,Math.floor(base));
  if(lastMeasuredFps<24) return interval*4;
  if(lastMeasuredFps<34) return interval*2;
  if(gameMode==="double") return Math.max(interval,Math.ceil(interval*1.5));
  return interval;
}

function cosmeticBurstCount(count){
  if(count<=1) return count;
  if(lastMeasuredFps<24) return 1;
  if(lastMeasuredFps<34) return Math.max(1,Math.ceil(count*0.5));
  if(gameMode==="double") return Math.max(1,Math.ceil(count*0.72));
  return count;
}

function currentDifficulty(){
  return difficultySettings[gameDifficulty] || difficultySettings.medium;
}

function maxCannonAmmo(){
  return currentDifficulty().cannonAmmo || difficultySettings.medium.cannonAmmo;
}

function maxRocketAmmo(){
  return currentDifficulty().rocketAmmo || difficultySettings.medium.rocketAmmo;
}

function maxCarRocketAmmo(){
  return currentDifficulty().carRocketAmmo || difficultySettings.medium.carRocketAmmo;
}

function tradingItemOwned(id){
  return purchasedTradingItems.has(id);
}

function applyDefaultStartItems(){
  purchasedTradingItems.add("rocket-launcher");
  purchasedTradingItems.add("laser-gun");
  if(testingScannerAvailableFromStart) purchasedTradingItems.add("scanner");
  if(jetAvailableFromStart){
    purchasedTradingItems.add("jet");
    jetUnlocked=true;
  }
}

function rocketLauncherUnlocked(){
  return tradingItemOwned("rocket-launcher");
}

function scannerUnlocked(){
  return tradingItemOwned("scanner");
}

function laserUnlocked(){
  return tradingItemOwned("laser-gun");
}

function shieldUnlocked(){
  return tradingItemOwned("shield");
}

function portalKeyUnlocked(){
  return tradingItemOwned("portal-key");
}

function updateUnlockedRandomPortals(){
  if(!portalSystem) return;
  if(!portalKeyUnlocked()){
    portalSystem.clearRandomPortals();
    scannedPortals.clear();
    return;
  }
  portalSystem.updateRandomPortals();
}

function scaledDelay(frames,scale){
  return Math.max(1,Math.round(frames*scale));
}

function actorObstacleRadius(actor){
  if(!actor) return carRadius;
  if(actor.isEnemy){
    return Number.isFinite(actor.collisionRadius) ? actor.collisionRadius : 2.35;
  }

  let jetAmount=clamp(actor.jetProgress || 0,0,1);
  let carAmount=clamp((actor.morphProgress || 0),0,1)*(1-jetAmount);
  let robotRadius=3.45;
  let vehicleRadius=3.25;
  let jetRadius=3.8;
  return robotRadius*(1-carAmount)*(1-jetAmount)
    + vehicleRadius*carAmount
    + jetRadius*jetAmount;
}

function actorObstacleVerticalBounds(actor,x=null,z=null){
  if(!actor) return null;
  let actorX=Number.isFinite(x) ? x : actor.x;
  let actorZ=Number.isFinite(z) ? z : actor.z;
  let surfaceY=drivingSurfaceHeight(actorX,actorZ);
  let baseY=Number.isFinite(actor.y) ? actor.y : surfaceY;
  let hitHeight=Number.isFinite(actor.hitHeight)
    ? actor.hitHeight
    : actor===giantTestRobot
    ? 46
    : actor.jetMode || (actor.jetProgress || 0)>0.35
    ? 4.8
    : (actor.morphProgress || 0)>0.65
    ? 3.6
    : 6.2;
  let footLift=actor===giantTestRobot
    ? 4.2
    : actor.onGround === false || actor.airborne || actor.jetMode || (actor.jetProgress || 0)>0.35
    ? 0.45
    : 0.12;
  let robotMode=(actor.morphProgress || 0)<0.35 && !(actor.jetMode || (actor.jetProgress || 0)>0.35);
  let carMode=(actor.morphProgress || 0)>0.65 && !(actor.jetMode || (actor.jetProgress || 0)>0.35);
  let stepHeight=actor===giantTestRobot
    ? 3.2
    : robotMode
    ? 1.05
    : carMode
    ? 0.7
    : actor.jetMode || (actor.jetProgress || 0)>0.35
    ? 1.35
    : 0.85;
  return {
    bottom:baseY+footLift,
    top:baseY+Math.max(0.8,hitHeight),
    surfaceY,
    stepHeight,
    clearance:0.16
  };
}

function updateScreenShakeFrame(){
  if(screenShakeAmount<=0.001){
    screenShakeAmount=0;
    screenShakeOffset.set(0,0,0);
    return;
  }

  let t=performance.now()*0.08+screenShakeSeed;
  screenShakeOffset.set(
    Math.sin(t*1.7)*screenShakeAmount*0.58,
    Math.cos(t*2.3)*screenShakeAmount*0.42,
    0
  );
  screenShakeAmount*=0.88;
}

function createCarState(id,lateralOffset,controls,camera,gamepadIndex){
  let group=new THREE.Group();
  group.rotation.order="YXZ";
  scene.add(group);

  return {
    id,
    controls,
    gamepadIndex,
    camera,
    cameraYaw:0,
    cameraDownhillAmount:0,
    group,
    shadow:createCarShadow(scene,{opacity:0.66,minOpacity:0.34}),
    x:0,
    y:20,
    renderY:20,
    z:0,
    collisionRadius:3.45,
    aimRadius:4.6,
    hitHeight:6.2,
    angle:0,
    velAngle:0,
    speed:0,
    throttleEase:0,
    turnInputEase:0,
    turnVelocity:0,
    speedDelta:0,
    movementCompression:0,
    movementLean:0,
    movementPitch:0,
    throttleInput:0,
    liftInput:0,
    surfaceDistance:0,
    slipAmount:0,
    onGround:false,
    airborne:false,
    vy:0,
    pitch:0,
    trickPitch:0,
    trickRoll:0,
    trickYaw:0,
    trickPitchVel:0,
    trickRollVel:0,
    trickYawVel:0,
    lastTrickButtons:{a:false,b:false,x:false,y:false},
    lastMorphButton:false,
    lastJetButton:false,
    morphed:false,
    morphProgress:0,
    lastMorphProgress:0,
    jetMode:false,
    jetProgress:0,
    jetBank:0,
    jetAltitudeTarget:20,
    jetHoverSurfaceY:null,
    jetLandingTransformLift:0,
    jetLandingTransformStartLift:0,
    landingReleaseFrames:0,
    landedOnPad:false,
    jetAutoLandToRobot:false,
    landingSequenceVoicePlayed:false,
    mechModel:null,
    jetModel:null,
    carModel:null,
    aimCross:null,
    aimOffsetX:0,
    aimOffsetY:0,
    aimDistance:32,
    headLookYaw:0,
    hasMouseAimPoint:false,
    hasGamepadAimPoint:false,
    controllerAimOffsetX:0,
    controllerAimOffsetY:0,
    mouseAimWorldX:0,
    mouseAimWorldY:0,
    mouseAimWorldZ:0,
    lastAimMouseVersion:-1,
    lastRocketButton:false,
    rocketLauncherSide:1,
    rocketCooldown:0,
    rocketAmmo:maxRocketAmmo(),
    carRocketAmmo:maxCarRocketAmmo(),
    lastCannonButton:false,
    cannonCooldown:0,
    cannonAmmo:maxCannonAmmo(),
    lastLaserButton:false,
    laserFireFrames:0,
    laserCooldown:0,
    laserDamageTick:0,
    laserBeam:null,
    laserSoundStop:null,
    clusterBombCooldown:0,
    clusterBombAmmo:initialClusterBombAmmo,
    boostCharge:maxBoostCharge,
    hoverInputActive:false,
    fuel:maxFuel,
    hitRattle:0,
    hitRattleSeed:0,
    holeDamageCooldown:0,
    walkCycle:0,
    lastWalkX:0,
    lastWalkZ:0,
    health:100,
    damageZones:createRobotDamageState(),
    damageFlashZones:createRobotDamageState(),
    lateralOffset
  };
}

let playerCar=createCarState("car1",-4.2,{up:"w",down:"s",left:"a",right:"d"},playerCamera,0);
let secondCar=createCarState("car2",4.2,{up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright"},secondCamera,1);
cars=[playerCar,secondCar];
secondCar.group.visible=false;
secondCar.shadow.setVisible(false);

let world=createWorld(scene,{getDifficulty:()=>gameDifficulty,getEnvironment:()=>currentEnvironment,getPerformanceMode:()=>gameMode==="double" ? "split" : "full"});
portalSystem=createPortalSystem({
  scene,
  waterLevel,
  cars:()=>cars,
  activeCars,
  fallbackCenter:()=>({x:px,z:pz}),
  drivingSurfaceHeight,
  waterDepthAt,
  surfaceHeightForActor,
  roadDistance,
  groundHoleAt,
  getWorld:()=>world,
  chunkViewDistanceForCar,
  chunkSignatureForCars,
  setLastChunkSignature:value=>{lastChunkSignature=value;},
  spawnRadiusExplosion,
  onDreamTransitionChange:()=>{lastSkyDreamAmount=-1;}
});
let clouds=createClouds(scene,()=>({carX:playerCar.x,carZ:playerCar.z}));
let stars=createStars(scene,()=>{
  let visibleCars=cars.filter(car=>car.group.visible && car.health>0);
  let active=visibleCars.length ? visibleCars : [playerCar];
  let x=0,y=0,z=0;
  for(let car of active){
    x+=car.camera.position.x;
    y+=car.camera.position.y;
    z+=car.camera.position.z;
  }
  return {x:x/active.length,y:y/active.length,z:z/active.length};
},()=>dayNightState().nightAmount,()=>rainIntensity);
assignRenderLayer(stars.object,skyRenderLayer);
let birds=createBirds(scene,()=>({carX:playerCar.x,carZ:playerCar.z}));
let lowHaze=createLowHangingHaze(scene,()=>({carX:px,carY:py,carZ:pz}),()=>currentEnvironment);
let ambientMotes=createAmbientMotes(scene,()=>({carX:px,carY:py,carZ:pz}),()=>rainIntensity);
let dust=createDust(scene);
let wheelTracks=createWheelTracks(scene);
let motorAudio=createMotorAudio(cars);

function setGameAudioAllowed(allowed){
  if(motorAudio.setPlaybackAllowed) motorAudio.setPlaybackAllowed(allowed);
  else{
    if(motorAudio.setSfxEnabled) motorAudio.setSfxEnabled(allowed);
    if(allowed && motorAudio.resume) motorAudio.resume();
  }
}

function startIntroAudio(){
  if(gameIntroAudioStarted) return;
  gameIntroAudioStarted=true;
  setGameAudioAllowed(true);
  motorAudio.setPaused(false);
  if(motorAudio.playMissionInitiatedVoice) motorAudio.playMissionInitiatedVoice();
}

function playMenuClickFeedback(){
  if(motorAudio.playMenuClick) motorAudio.playMenuClick();
}

function announceLandingSequence(car){
  if(!car || car.landingSequenceVoicePlayed) return;
  car.landingSequenceVoicePlayed=true;
  if(motorAudio.playLandingSequenceVoice) motorAudio.playLandingSequenceVoice();
}

function createPauseMenu(audio){
  let overlay=document.createElement("div");
  overlay.id="pauseMenuOverlay";
  overlay.style.cssText=[
    "position:fixed",
    "inset:0",
    "display:none",
    "z-index:30",
    "background:rgba(4,8,12,0.58)",
    "backdrop-filter:blur(3px)",
    `font-family:${gameFontFamily}`,
    "color:white",
    "pointer-events:auto"
  ].join(";");

  let modelPanel=document.createElement("div");
  modelPanel.style.cssText=[
    "position:absolute",
    "left:28px",
    "top:26px",
    "width:min(340px,34vw)",
    "height:min(430px,56vh)",
    "min-width:220px",
    "min-height:300px"
  ].join(";");

  let controls=document.createElement("div");
  controls.style.cssText=[
    "position:absolute",
    "right:32px",
    "top:34px",
    "width:min(360px,38vw)",
    "min-width:250px",
    "background:rgba(18,24,30,0.68)",
    "border:1px solid rgba(185,244,255,0.22)",
    "box-shadow:0 12px 34px rgba(0,0,0,0.36)",
    "padding:22px",
    "box-sizing:border-box"
  ].join(";");

  let title=document.createElement("div");
  title.textContent="Paused";
  title.style.cssText=[
    "font-size:28px",
    "font-weight:900",
    "letter-spacing:0",
    "margin-bottom:20px",
    "text-transform:uppercase",
    "text-shadow:0 2px 14px rgba(0,0,0,0.55)"
  ].join(";");
  controls.appendChild(title);

  function addSlider(label,setter,value){
    let row=document.createElement("label");
    row.style.cssText=[
      "display:block",
      "margin:18px 0",
      "font-size:13px",
      "font-weight:800",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:rgba(245,255,249,0.9)"
    ].join(";");

    let text=document.createElement("div");
    text.textContent=label;
    text.style.cssText="margin-bottom:9px";

    let input=document.createElement("input");
    input.type="range";
    input.min="0";
    input.max="1";
    input.step="0.01";
    input.value=String(value);
    input.style.cssText=[
      "width:100%",
      "accent-color:#8dfff2",
      "cursor:pointer"
    ].join(";");
    input.addEventListener("input",()=>setter(Number(input.value)));
    for(let eventName of ["pointerdown","mousedown","click"]){
      input.addEventListener(eventName,event=>event.stopPropagation());
    }

    row.appendChild(text);
    row.appendChild(input);
    controls.appendChild(row);
  }

  let volumes=audio.getVolumeSettings ? audio.getVolumeSettings() : {music:0.2,sfx:1};
  addSlider("Music",value=>audio.setMusicVolume(value),volumes.music);
  addSlider("SFX",value=>audio.setSfxVolume(value),volumes.sfx);

  let saveButton=document.createElement("button");
  saveButton.type="button";
  saveButton.textContent="Save Game";
  saveButton.style.cssText=[
    "width:100%",
    "height:46px",
    "margin-top:18px",
    "border:0",
    "background:#d6b25a",
    "color:#1c211f",
    `font-family:${gameFontFamily}`,
    "font-size:15px",
    "font-weight:900",
    "text-transform:uppercase",
    "cursor:pointer"
  ].join(";");
  let saveStatus=document.createElement("div");
  saveStatus.style.cssText=[
    "min-height:18px",
    "margin-top:9px",
    "font-size:12px",
    "font-weight:800",
    "color:rgba(245,255,249,0.74)"
  ].join(";");
  saveButton.addEventListener("click",event=>{
    event.stopPropagation();
    playMenuClickFeedback();
    let saved=saveGameStatus();
    saveStatus.textContent=saved ? "Saved" : "Save failed";
  });
  controls.appendChild(saveButton);
  controls.appendChild(saveStatus);

  overlay.appendChild(modelPanel);
  overlay.appendChild(controls);
  document.body.appendChild(overlay);

  let previewScene=new THREE.Scene();
  let previewCamera=new THREE.PerspectiveCamera(31,1,0.1,100);
  previewCamera.position.set(0,3.15,14.2);
  previewCamera.lookAt(0,2.55,0);
  let previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5));
  previewRenderer.setClearColor(0x000000,0);
  previewRenderer.domElement.style.cssText="width:100%;height:100%;display:block";
  modelPanel.appendChild(previewRenderer.domElement);

  let previewRobotPivot=new THREE.Group();
  let previewRobot=makeMechModel(0x8dfff2,{dust:true});
  previewRobot.scale.set(1.22,1.38,1.22);
  previewRobotPivot.add(previewRobot);
  previewScene.add(previewRobotPivot);

  let previewBox=new THREE.Box3();
  let previewCenter=new THREE.Vector3();
  let previewSize=new THREE.Vector3();

  function framePreviewRobot(){
    previewRobot.rotation.set(0,0,0);
    previewRobot.updateMatrixWorld(true);
    previewBox.setFromObject(previewRobot);
    previewBox.getCenter(previewCenter);
    previewBox.getSize(previewSize);
    previewRobot.position.sub(previewCenter);
    previewRobot.updateMatrixWorld(true);
    previewBox.setFromObject(previewRobot);
    previewBox.getSize(previewSize);

    let verticalSize=Math.max(1,previewSize.y);
    let horizontalSize=Math.max(1,previewSize.x,previewSize.z);
    let verticalDistance=(verticalSize*0.68)/Math.tan(THREE.MathUtils.degToRad(previewCamera.fov*0.5));
    let horizontalDistance=(horizontalSize*0.72)/Math.tan(THREE.MathUtils.degToRad(previewCamera.fov*0.5))*Math.max(1,1/previewCamera.aspect);
    let distance=Math.max(verticalDistance,horizontalDistance,10);
    previewCamera.position.set(0,verticalSize*0.06,distance);
    previewCamera.lookAt(0,0,0);
  }

  let previewHemi=new THREE.HemisphereLight(0xcafcff,0x18212b,1.65);
  let previewKey=new THREE.DirectionalLight(0xffffff,2.2);
  previewKey.position.set(4,7,6);
  previewScene.add(previewHemi,previewKey);

  function resizePreview(){
    let rect=modelPanel.getBoundingClientRect();
    let width=Math.max(1,Math.floor(rect.width));
    let height=Math.max(1,Math.floor(rect.height));
    previewRenderer.setSize(width,height,false);
    previewCamera.aspect=width/height;
    previewCamera.updateProjectionMatrix();
    framePreviewRobot();
  }

  function setVisible(visible){
    overlay.style.display=visible ? "block" : "none";
    if(visible) resizePreview();
  }

  function update(time){
    if(overlay.style.display==="none") return;
    let previewCar=activeCars().find(car=>car && car.group.visible && car.health>0) || playerCar;
    applyRobotDamageVisuals(previewRobot,previewCar.damageZones);
    previewRobotPivot.rotation.y=time*0.00042;
    previewRobotPivot.rotation.x=Math.sin(time*0.0012)*0.035;
    previewRenderer.render(previewScene,previewCamera);
  }

  window.addEventListener("resize",resizePreview);

  return {
    setVisible,
    update
  };
}

let pauseMenu=createPauseMenu(motorAudio);

function makeTerminalCloseButton(onClose){
  let button=document.createElement("button");
  button.type="button";
  button.textContent="X";
  button.setAttribute("aria-label","Close terminal");
  button.style.cssText=[
    "position:absolute",
    "top:12px",
    "right:12px",
    "width:34px",
    "height:34px",
    "border:1px solid rgba(154,248,255,0.36)",
    "background:rgba(6,12,15,0.72)",
    "color:#ecfbff",
    `font-family:${gameFontFamily}`,
    "font-size:18px",
    "font-weight:900",
    "line-height:1",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "box-shadow:0 0 16px rgba(38,226,255,0.16)",
    "cursor:pointer",
    "z-index:2"
  ].join(";");
  button.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();
    playMenuClickFeedback();
    onClose();
  });
  return button;
}

function activeCommunicationMissionOutposts(){
  return missionCommunicationOutposts.filter(outpost=>outpost && !outpost.destroyed);
}

function missionIdForEnvironment(environment){
  let planetName=((environment && environment.name) || "").toLowerCase();
  if(planetName==="ember badlands") return emberCommunicationMissionId;
  let slug=planetName.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"") || "planet";
  return `test-${slug}`;
}

function readCompletedMissionIds(){
  try{
    localStorage.removeItem("seed-completed-missions");
    localStorage.removeItem("seed-completed-missions.v2");
    let raw=localStorage.getItem(completedMissionsStorageKey);
    let items=JSON.parse(raw || "[]");
    return new Set(Array.isArray(items) ? items.filter(item=>typeof item==="string") : []);
  }catch(error){
    return new Set();
  }
}

function writeCompletedMissionIds(){
  try{
    localStorage.setItem(completedMissionsStorageKey,JSON.stringify(Array.from(completedMissionIds)));
  }catch(error){
    // Completion state is cosmetic; ignore storage failures.
  }
}

function markMissionCompleted(missionId){
  if(!missionId) return;
  completedMissionIds.add(missionId);
  writeCompletedMissionIds();
  refreshStartPlanetButtons();
}

function environmentMissionCompleted(environment){
  return completedMissionIds.has(missionIdForEnvironment(environment));
}

function isNeonCityEnvironment(environment){
  return ((environment && environment.name) || "").toLowerCase()==="neon city";
}

function neonCityUnlocked(){
  return worldEnvironments
    .filter(environment=>!isNeonCityEnvironment(environment))
    .every(environment=>environmentMissionCompleted(environment));
}

function planetSelectable(environment){
  return !isNeonCityEnvironment(environment) || neonCityUnlocked() || environmentMissionCompleted(environment);
}

function firstSelectablePlanetIndex(){
  let index=worldEnvironments.findIndex(environment=>planetSelectable(environment));
  return index>=0 ? index : 0;
}

function randomMissionTemplateForEnvironment(environment){
  let planetName=((environment && environment.name) || "").toLowerCase();
  if(planetName==="neon city"){
    return {
      type:"neonCity",
      target:3,
      cityTarget:2,
      bossTarget:1,
      title:"Collapse urban command",
      goal:"Destroy two complete cities and the boss base.",
      statusLabel:"Objectives",
      lines:[
        "Primary objective: destroy two complete cities and the boss base.",
        "Clear every structure in each city sector to confirm control collapse.",
        "Mission completion requires two city clears and one destroyed boss base."
      ]
    };
  }
  if(planetName==="titan highlands"){
    return {
      type:"relay",
      target:4,
      title:"Silence highland relays",
      goal:"Destroy four mountain relay outposts.",
      statusLabel:"Relays",
      lines:[
        "Primary objective: destroy the highland relay outposts.",
        "Scanner fire reveals relay bearings across the mountain basins.",
        "Mission completion requires four destroyed mountain relays."
      ]
    };
  }

  let templates=[
    {
      type:"enemy",
      target:24,
      title:"Suppress hostile patrols",
      goal:"Eliminate twenty-four hostile units.",
      statusLabel:"Hostiles",
      lines:[
        "Primary objective: eliminate hostile patrol units.",
        "Threat report: enemy waves and field patrols are active.",
        "Mission completion requires twenty-four confirmed takedowns."
      ]
    },
    {
      type:"treasure",
      target:10,
      title:"Recover field artifacts",
      goal:"Recover ten treasure caches.",
      statusLabel:"Caches",
      lines:[
        "Primary objective: recover field treasure caches.",
        "Scanner sweeps and exploration will reveal nearby opportunities.",
        "Mission completion requires ten recovered caches."
      ]
    },
    {
      type:"village",
      target:4,
      title:"Clear a hostile settlement",
      goal:"Clear four hostile villages or city sectors.",
      statusLabel:"Settlements",
      lines:[
        "Primary objective: clear four hostile settlements.",
        "Destroy the settlement structures to secure the area.",
        "Mission completion requires four confirmed settlement clears."
      ]
    },
    {
      type:"mothership",
      target:4,
      title:"Intercept mothership",
      goal:"Destroy four motherships.",
      statusLabel:"Motherships",
      lines:[
        "Primary objective: intercept and destroy four motherships.",
        "Mothership arrival cadence is accelerated for testing.",
        "Mission completion requires four mothership kills."
      ]
    },
    {
      type:"bossBase",
      target:1,
      title:"Destroy command base",
      goal:"Destroy the local command base.",
      statusLabel:"Bases",
      lines:[
        "Primary objective: destroy the local command base.",
        "The base will call in defenders once attacked.",
        "Mission completion requires one destroyed command base."
      ]
    },
    {
      type:"relay",
      target:5,
      title:"Disable signal relays",
      goal:"Destroy five signal relay outposts.",
      statusLabel:"Relays",
      lines:[
        "Primary objective: destroy signal relay outposts.",
        "Scanner fire reveals relay bearings on the compass.",
        "Mission completion requires five destroyed relay outposts."
      ]
    }
  ];
  let name=(environment && environment.name) || "planet";
  let seed=0;
  for(let i=0;i<name.length;i++) seed=(seed*31+name.charCodeAt(i))>>>0;
  let index=Math.floor(Math.random()*templates.length+seed)%templates.length;
  return templates[index];
}

function createGeneratedPlanetMission(environment){
  let template=randomMissionTemplateForEnvironment(environment);
  let mission={
    ...template,
    id:missionIdForEnvironment(environment),
    progress:0,
    completed:false
  };
  if(mission.type==="neonCity"){
    mission.cityProgress=0;
    mission.bossProgress=0;
  }
  return mission;
}

function generatedMissionDisplay(mission){
  let progress=mission.type==="neonCity"
    ? Math.min(mission.target || 1,(mission.cityProgress || 0)+(mission.bossProgress || 0))
    : Math.max(0,Math.min(mission.target || 1,mission.progress || 0));
  let target=Math.max(1,mission.target || 1);
  let statusValue=mission.type==="neonCity"
    ? `Cities ${mission.cityProgress || 0}/${mission.cityTarget || 2}  Base ${mission.bossProgress || 0}/${mission.bossTarget || 1}`
    : `${progress}/${target}`;
  return {
    id:mission.id,
    goal:mission.goal,
    statusLabel:mission.statusLabel,
    statusValue,
    progress,
    target,
    remaining:Math.max(0,target-progress),
    lines:mission.lines
  };
}

function advanceGeneratedPlanetMission(type,amount=1,context={}){
  if(!generatedPlanetMission || generatedPlanetMission.completed) return false;
  if(generatedPlanetMission.type==="neonCity"){
    if(type==="village"){
      if(context && context.city===false) return false;
      generatedPlanetMission.cityProgress=Math.min(
        generatedPlanetMission.cityTarget,
        (generatedPlanetMission.cityProgress || 0)+Math.max(0,amount || 0)
      );
    }else if(type==="bossBase"){
      generatedPlanetMission.bossProgress=Math.min(
        generatedPlanetMission.bossTarget,
        (generatedPlanetMission.bossProgress || 0)+Math.max(0,amount || 0)
      );
    }else{
      return false;
    }
    generatedPlanetMission.progress=(generatedPlanetMission.cityProgress || 0)+(generatedPlanetMission.bossProgress || 0);
  }else{
    if(generatedPlanetMission.type!==type) return false;

    generatedPlanetMission.progress=Math.min(
      generatedPlanetMission.target,
      (generatedPlanetMission.progress || 0)+Math.max(0,amount || 0)
    );
  }
  if(missionScreen) missionScreen.update();
  updateMissionGoalDisplay();
  if(generatedPlanetMission.progress<generatedPlanetMission.target) return false;

  generatedPlanetMission.completed=true;
  if(motorAudio && motorAudio.stopMusic) motorAudio.stopMusic();
  showMissionAccomplished(generatedPlanetMission.id);
  return true;
}

function currentPlanetMission(){
  if(missionIdForEnvironment(currentEnvironment)===emberCommunicationMissionId){
    let activeCount=missionCommunicationOutposts.length
      ? activeCommunicationMissionOutposts().length
      : emberCommunicationOutpostCount;
    let progress=Math.max(0,emberCommunicationOutpostCount-activeCount);
    return {
      id:emberCommunicationMissionId,
      goal:"Destroy all satellite communication outposts.",
      statusLabel:"Comms outposts",
      statusValue:`${activeCount}/${emberCommunicationOutpostCount}`,
      progress,
      target:emberCommunicationOutpostCount,
      remaining:activeCount,
      lines:[
        "Primary objective: destroy all satellite communication outposts.",
        "Mission area: three outposts within the local perimeter.",
        "Threat report: each outpost is protected by reinforced armored patrols."
      ]
    };
  }

  if(generatedPlanetMission) return generatedMissionDisplay(generatedPlanetMission);

  let activeBossBases=(world && world.bossBases ? world.bossBases : []).filter(base=>base && base.active).length;
  return {
    id:"boss-base",
    goal:"Locate and destroy all active boss bases.",
    statusLabel:"Boss bases",
    statusValue:String(activeBossBases),
    progress:0,
    target:Math.max(1,activeBossBases),
    remaining:activeBossBases,
    lines:[
      "Primary objective: locate and destroy active boss bases.",
      "Earn units by destroying hostile robots, collecting treasures, and clearing villages.",
      "Use field trading terminals to buy equipment and fuel."
    ]
  };
}

function updateMissionGoalDisplay(){
  if(!missionGoalDisplay) return;
  if(!gameStarted || gameOver){
    missionGoalDisplay.style.display="none";
    missionGoalDisplay.textContent="";
    return;
  }

  let mission=currentPlanetMission();
  if(!mission || !mission.goal){
    missionGoalDisplay.style.display="none";
    missionGoalDisplay.textContent="";
    return;
  }

  let progress=Math.max(0,Math.floor(mission.progress || 0));
  let target=Math.max(1,Math.floor(mission.target || Math.max(1,progress+(mission.remaining || 0))));
  let remaining=Math.max(0,Math.floor(Number.isFinite(mission.remaining) ? mission.remaining : target-progress));
  missionGoalDisplay.style.display="block";
  missionGoalDisplay.textContent=`${mission.goal}\nDone ${progress}/${target}  Remaining ${remaining}`;
}

function createMissionScreen(){
  let overlay=document.createElement("div");
  overlay.id="missionTerminalOverlay";
  overlay.style.cssText=[
    "position:fixed",
    "inset:0",
    "display:none",
    "z-index:31",
    "background:rgba(2,7,10,0.62)",
    "backdrop-filter:blur(4px)",
    `font-family:${gameFontFamily}`,
    "color:#ecfbff",
    "pointer-events:auto"
  ].join(";");

  let panel=document.createElement("div");
  panel.style.cssText=[
    "position:absolute",
    "left:50%",
    "top:50%",
    "transform:translate(-50%,-50%)",
    "width:min(780px,calc(100vw - 44px))",
    "max-height:calc(100vh - 48px)",
    "background:rgba(12,19,23,0.9)",
    "border:1px solid rgba(109,242,255,0.34)",
    "box-shadow:0 18px 52px rgba(0,0,0,0.48),0 0 34px rgba(38,226,255,0.12)",
    "box-sizing:border-box",
    "padding:24px",
    "overflow:auto"
  ].join(";");
  panel.appendChild(makeTerminalCloseButton(closeMissionScreen));

  let title=document.createElement("div");
  title.textContent="Mission Terminal";
  title.style.cssText=[
    "font-size:26px",
    "font-weight:900",
    "text-transform:uppercase",
    "letter-spacing:0.04em",
    "margin-bottom:18px",
    "color:#9af8ff",
    "text-shadow:0 0 16px rgba(69,235,255,0.48)"
  ].join(";");
  panel.appendChild(title);

  let subhead=document.createElement("div");
  subhead.textContent="Home base command uplink";
  subhead.style.cssText=[
    "font-size:12px",
    "font-weight:900",
    "text-transform:uppercase",
    "letter-spacing:0.12em",
    "color:rgba(236,251,255,0.58)",
    "margin-top:-10px",
    "margin-bottom:16px"
  ].join(";");
  panel.appendChild(subhead);

  let activeMission=currentPlanetMission();
  let goal=document.createElement("div");
  goal.style.cssText=[
    "border:1px solid rgba(154,248,255,0.2)",
    "background:rgba(8,16,20,0.66)",
    "padding:14px 16px",
    "box-sizing:border-box",
    "margin-bottom:16px"
  ].join(";");
  let goalLabel=document.createElement("div");
  goalLabel.textContent="Mission Goal";
  goalLabel.style.cssText="font-size:11px;font-weight:900;text-transform:uppercase;color:rgba(236,251,255,0.52);margin-bottom:7px";
  let goalText=document.createElement("div");
  goalText.textContent=activeMission.goal;
  goalText.style.cssText="font-size:18px;font-weight:900;text-transform:uppercase;color:#efcf72;line-height:1.25";
  goal.appendChild(goalLabel);
  goal.appendChild(goalText);
  panel.appendChild(goal);

  let status=document.createElement("div");
  status.style.cssText=[
    "display:grid",
    "grid-template-columns:repeat(3,minmax(0,1fr))",
    "gap:12px",
    "margin-bottom:18px"
  ].join(";");

  function addStatus(label,value){
    let cell=document.createElement("div");
    cell.style.cssText=[
      "border:1px solid rgba(154,248,255,0.18)",
      "background:rgba(6,12,15,0.58)",
      "padding:13px 14px",
      "box-sizing:border-box"
    ].join(";");
    let labelEl=document.createElement("div");
    labelEl.textContent=label;
    labelEl.style.cssText="font-size:11px;font-weight:900;text-transform:uppercase;color:rgba(236,251,255,0.52);margin-bottom:7px";
    let valueEl=document.createElement("div");
    valueEl.textContent=value;
    valueEl.style.cssText="font-size:20px;font-weight:900;color:#efcf72";
    cell.appendChild(labelEl);
    cell.appendChild(valueEl);
    status.appendChild(cell);
    return {labelEl,valueEl};
  }

  let unitsStatus=addStatus("Units",String(Math.max(0,Math.round(units || 0))));
  let objectiveStatus=addStatus(activeMission.statusLabel,activeMission.statusValue);
  let scannerStatus=addStatus("Scanner",scannerUnlocked() ? "Online" : "Locked");
  panel.appendChild(status);

  let list=document.createElement("div");
  list.style.cssText=[
    "border:1px solid rgba(154,248,255,0.18)",
    "background:rgba(8,16,20,0.62)",
    "padding:16px",
    "box-sizing:border-box",
    "display:flex",
    "flex-direction:column",
    "gap:12px"
  ].join(";");

  function setMissionLines(lines){
    while(list.firstChild) list.removeChild(list.firstChild);
    for(let text of lines){
      let row=document.createElement("div");
      row.textContent=text;
      row.style.cssText="font-size:15px;font-weight:900;text-transform:uppercase;color:rgba(236,251,255,0.88)";
      list.appendChild(row);
    }
  }
  setMissionLines(activeMission.lines);
  panel.appendChild(list);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function refresh(){
    let mission=currentPlanetMission();
    goalText.textContent=mission.goal;
    unitsStatus.valueEl.textContent=String(Math.max(0,Math.round(units || 0)));
    objectiveStatus.labelEl.textContent=mission.statusLabel;
    objectiveStatus.valueEl.textContent=mission.statusValue;
    scannerStatus.valueEl.textContent=scannerUnlocked() ? "Online" : "Locked";
    setMissionLines(mission.lines);
  }

  function setVisible(visible){
    overlay.style.display=visible ? "block" : "none";
    if(visible) refresh();
  }

  return {
    setVisible,
    update:refresh
  };
}

function createTradingScreen(){
  let overlay=document.createElement("div");
  overlay.id="tradingTerminalOverlay";
  overlay.style.cssText=[
    "position:fixed",
    "inset:0",
    "display:none",
    "z-index:31",
    "background:rgba(2,7,10,0.62)",
    "backdrop-filter:blur(4px)",
    `font-family:${gameFontFamily}`,
    "color:#ecfbff",
    "pointer-events:auto"
  ].join(";");

  let panel=document.createElement("div");
  panel.style.cssText=[
    "position:absolute",
    "left:50%",
    "top:50%",
    "transform:translate(-50%,-50%)",
    "width:min(880px,calc(100vw - 44px))",
    "max-height:calc(100vh - 48px)",
    "background:rgba(12,19,23,0.9)",
    "border:1px solid rgba(109,242,255,0.34)",
    "box-shadow:0 18px 52px rgba(0,0,0,0.48),0 0 34px rgba(38,226,255,0.12)",
    "box-sizing:border-box",
    "padding:24px",
    "overflow:auto"
  ].join(";");
  panel.appendChild(makeTerminalCloseButton(closeTradingScreen));

  let title=document.createElement("div");
  title.textContent="Trading Terminal";
  title.style.cssText=[
    "font-size:26px",
    "font-weight:900",
    "text-transform:uppercase",
    "letter-spacing:0.04em",
    "margin-bottom:18px",
    "color:#9af8ff",
    "text-shadow:0 0 16px rgba(69,235,255,0.48)"
  ].join(";");
  panel.appendChild(title);

  let subhead=document.createElement("div");
  subhead.textContent="Unit exchange queue";
  subhead.style.cssText=[
    "font-size:12px",
    "font-weight:900",
    "text-transform:uppercase",
    "letter-spacing:0.12em",
    "color:rgba(236,251,255,0.58)",
    "margin-top:-10px",
    "margin-bottom:16px"
  ].join(";");
  panel.appendChild(subhead);

  let unitBar=document.createElement("div");
  unitBar.style.cssText=[
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:16px",
    "border:1px solid rgba(154,248,255,0.18)",
    "background:rgba(6,12,15,0.58)",
    "padding:14px 16px",
    "box-sizing:border-box",
    "margin-bottom:16px"
  ].join(";");
  let unitLabel=document.createElement("div");
  unitLabel.textContent="Units available";
  unitLabel.style.cssText="font-size:12px;font-weight:900;text-transform:uppercase;color:rgba(236,251,255,0.58)";
  let unitsValue=document.createElement("div");
  unitsValue.textContent="0";
  unitsValue.style.cssText="font-size:28px;font-weight:900;color:#efcf72;text-shadow:0 0 14px rgba(239,207,114,0.32)";
  unitBar.appendChild(unitLabel);
  unitBar.appendChild(unitsValue);

  let tradeGrid=document.createElement("div");
  tradeGrid.style.cssText=[
    "display:grid",
    "grid-template-columns:minmax(260px,1.15fr) minmax(220px,0.85fr)",
    "gap:14px",
    "min-height:360px"
  ].join(";");

  function makeTradeColumn(titleText){
    let column=document.createElement("div");
    column.style.cssText=[
      "border:1px solid rgba(154,248,255,0.18)",
      "background:rgba(8,16,20,0.62)",
      "box-sizing:border-box",
      "min-height:360px",
      "display:flex",
      "flex-direction:column"
    ].join(";");
    let header=document.createElement("div");
    header.textContent=titleText;
    header.style.cssText=[
      "padding:13px 14px",
      "border-bottom:1px solid rgba(154,248,255,0.14)",
      "font-size:13px",
      "font-weight:900",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:#9af8ff"
    ].join(";");
    let body=document.createElement("div");
    body.style.cssText=[
      "padding:12px",
      "overflow:auto",
      "max-height:min(46vh,440px)",
      "display:flex",
      "flex-direction:column",
      "gap:10px",
      "box-sizing:border-box"
    ].join(";");
    column.appendChild(header);
    column.appendChild(body);
    tradeGrid.appendChild(column);
    return body;
  }

  let availableList=makeTradeColumn("Available");
  let boughtList=makeTradeColumn("Bought");
  let tradeItems=[
    {id:"rocket-launcher",name:"Rocket launcher",price:1000},
    {id:"laser-gun",name:"Laser gun",price:2500},
    {id:"scanner",name:"Scanner",price:1000},
    {id:"portal-key",name:"Portal key",price:5000},
    {id:"jet",name:"Jet",price:5000},
    {id:"cannon-shots",name:"Cannon shots x100",price:100,repeatable:true},
    {id:"rockets",name:"Rockets x50",price:200,repeatable:true},
    {id:"bombs",name:"Bombs x1",price:500,repeatable:true},
    {id:"shield",name:"Shield x1",price:5500},
    {id:"fuel",name:"Fuel",price:200,repeatable:true}
  ];
  let lastTradeRenderKey="";

  function fuelIsFull(){
    return activeCars().every(car=>!car || !car.group || !car.group.visible || car.health<=0 || (car.fuel ?? maxFuel)>=maxFuel-0.001);
  }

  function activeTradingCars(){
    return activeCars().filter(car=>car && car.group && car.group.visible && car.health>0);
  }

  function cannonAmmoIsFull(){
    let cap=maxCannonAmmo();
    let cars=activeTradingCars();
    return cars.length>0 && cars.every(car=>(car.cannonAmmo || 0)>=cap);
  }

  function rocketAmmoIsFull(){
    let rocketCap=maxRocketAmmo();
    let carRocketCap=maxCarRocketAmmo();
    let cars=activeTradingCars();
    return cars.length>0 && cars.every(car=>(car.rocketAmmo || 0)>=rocketCap && (car.carRocketAmmo || 0)>=carRocketCap);
  }

  function tradeItemUnavailable(item){
    if(!item) return true;
    if(item.id==="fuel") return fuelIsFull();
    if(item.id==="cannon-shots") return cannonAmmoIsFull();
    if(item.id==="rockets") return rocketAmmoIsFull();
    if(item.id==="bombs") return !jetUnlocked;
    return false;
  }

  function tradeRenderKey(){
    return [
      Math.max(0,Math.round(units || 0)),
      Array.from(purchasedTradingItems).sort().join(","),
      activeCars().map(car=>[
        Math.round(car && Number.isFinite(car.fuel) ? car.fuel : maxFuel),
        Math.round(car && Number.isFinite(car.cannonAmmo) ? car.cannonAmmo : maxCannonAmmo()),
        Math.round(car && Number.isFinite(car.rocketAmmo) ? car.rocketAmmo : maxRocketAmmo()),
        Math.round(car && Number.isFinite(car.carRocketAmmo) ? car.carRocketAmmo : maxCarRocketAmmo()),
        Math.round(car && Number.isFinite(car.clusterBombAmmo) ? car.clusterBombAmmo : initialClusterBombAmmo)
      ].join(":")).join(",")
    ].join("|");
  }

  function buyTradingItem(item){
    if(!item || (!item.repeatable && purchasedTradingItems.has(item.id)) || units<item.price) return;
    if(tradeItemUnavailable(item)) return;

    units=Math.max(0,units-item.price);
    if(!item.repeatable) purchasedTradingItems.add(item.id);
    if(item.id==="rocket-launcher"){
      for(let car of activeCars()){
        if(car && car.group && car.group.visible && car.health>0){
          car.rocketAmmo=rocketLauncherPurchaseAmmo;
          car.carRocketAmmo=rocketLauncherPurchaseAmmo;
        }
      }
    }
    if(item.id==="scanner") scannerReadyAt=0;
    if(item.id==="portal-key") updateUnlockedRandomPortals();
    if(item.id==="jet"){
      jetUnlocked=true;
      for(let car of activeCars()){
        if(car && car.group && car.group.visible && car.health>0){
          car.clusterBombAmmo=Math.max(0,(car.clusterBombAmmo || 0)+jetPurchaseBombAmount);
        }
      }
    }
    if(item.id==="cannon-shots"){
      let cannonAmmoCap=maxCannonAmmo();
      for(let car of activeCars()){
        if(car && car.group && car.group.visible && car.health>0){
          car.cannonAmmo=Math.min(cannonAmmoCap,(car.cannonAmmo || 0)+tradingCannonShotAmount);
        }
      }
    }
    if(item.id==="rockets"){
      let rocketAmmoCap=maxRocketAmmo();
      let carRocketAmmoCap=maxCarRocketAmmo();
      for(let car of activeCars()){
        if(car && car.group && car.group.visible && car.health>0){
          car.rocketAmmo=Math.min(rocketAmmoCap,(car.rocketAmmo || 0)+tradingRocketAmount);
          car.carRocketAmmo=Math.min(carRocketAmmoCap,(car.carRocketAmmo || 0)+tradingRocketAmount);
        }
      }
    }
    if(item.id==="bombs"){
      for(let car of activeCars()){
        if(car && car.group && car.group.visible && car.health>0){
          car.clusterBombAmmo=Math.max(0,(car.clusterBombAmmo || 0)+tradingBombAmount);
        }
      }
    }
    if(item.id==="fuel"){
      for(let car of activeCars()){
        if(car && car.group && car.group.visible && car.health>0) car.fuel=maxFuel;
      }
    }
    if(hud){
      hud.updateSpeedHud();
      hud.updateCompassHud();
    }
    renderTradeLists(true);
  }

  function renderTradeLists(force=false){
    let nextRenderKey=tradeRenderKey();
    if(!force && nextRenderKey===lastTradeRenderKey) return;
    lastTradeRenderKey=nextRenderKey;

    unitsValue.textContent=String(Math.max(0,Math.round(units || 0)));
    availableList.innerHTML="";
    boughtList.innerHTML="";

    for(let item of tradeItems){
      let owned=!item.repeatable && purchasedTradingItems.has(item.id);
      let unavailable=tradeItemUnavailable(item);
      let affordable=units>=item.price;
      let row=document.createElement("button");
      row.type="button";
      row.disabled=owned || unavailable || !affordable;
      row.style.cssText=[
        "width:100%",
        "display:grid",
        "grid-template-columns:1fr auto",
        "align-items:center",
        "gap:12px",
        "border:1px solid "+(owned ? "rgba(124,255,120,0.26)" : affordable && !unavailable ? "rgba(239,207,114,0.62)" : "rgba(154,248,255,0.12)"),
        "background:"+(owned ? "rgba(20,48,28,0.5)" : affordable && !unavailable ? "rgba(214,178,90,0.18)" : "rgba(45,54,58,0.36)"),
        "color:"+(owned ? "rgba(196,255,190,0.78)" : affordable && !unavailable ? "#ecfbff" : "rgba(236,251,255,0.34)"),
        `font-family:${gameFontFamily}`,
        "font-size:15px",
        "font-weight:900",
        "text-align:left",
        "padding:13px 14px",
        "box-sizing:border-box",
        "cursor:"+(owned || unavailable || !affordable ? "default" : "pointer"),
        "text-transform:uppercase"
      ].join(";");
      let name=document.createElement("span");
      name.textContent=owned
        ? item.name+" / Owned"
        : item.id==="bombs" && !jetUnlocked
        ? item.name+" / Jet required"
        : unavailable
        ? item.name+" / Full"
        : item.name;
      let price=document.createElement("span");
      price.textContent=item.price+" units";
      price.style.cssText="color:"+(affordable && !owned && !unavailable ? "#efcf72" : "inherit");
      row.appendChild(name);
      row.appendChild(price);
      row.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
        if(!row.disabled) playMenuClickFeedback();
        buyTradingItem(item);
      });
      availableList.appendChild(row);
    }

    let boughtItems=tradeItems.filter(item=>!item.repeatable && purchasedTradingItems.has(item.id));
    if(boughtItems.length===0){
      let empty=document.createElement("div");
      empty.textContent="No items bought";
      empty.style.cssText="padding:12px;color:rgba(236,251,255,0.42);font-size:14px;text-transform:uppercase";
      boughtList.appendChild(empty);
    }else{
      for(let item of boughtItems){
        let row=document.createElement("div");
        row.style.cssText=[
          "display:grid",
          "grid-template-columns:1fr auto",
          "gap:12px",
          "border:1px solid rgba(124,255,120,0.24)",
          "background:rgba(20,48,28,0.38)",
          "padding:13px 14px",
          "font-size:15px",
          "font-weight:900",
          "text-transform:uppercase"
        ].join(";");
        let name=document.createElement("span");
        name.textContent=item.name;
        let price=document.createElement("span");
        price.textContent=item.price+" units";
        price.style.cssText="color:rgba(196,255,190,0.72)";
        row.appendChild(name);
        row.appendChild(price);
        boughtList.appendChild(row);
      }
    }
  }

  panel.appendChild(unitBar);
  panel.appendChild(tradeGrid);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function setVisible(visible){
    overlay.style.display=visible ? "block" : "none";
    if(visible) renderTradeLists(true);
  }

  function update(){
    renderTradeLists(false);
  }

  return {
    setVisible,
    update
  };
}

let missionScreen=createMissionScreen();
let tradingScreen=createTradingScreen();

function visibleTradingOutpostsForMap(){
  let outposts=[];
  let seen=new Set();

  function add(key,x,z){
    if(seen.has(key) || !Number.isFinite(x) || !Number.isFinite(z)) return;
    seen.add(key);
    outposts.push({x,z});
  }

  for(let [key,outpost] of rareTradingOutposts){
    if(outpost) add(key,outpost.x,outpost.z);
  }
  if(testingTradingOutpost) add(testingTradingOutpost.key || "testing-home-trading-outpost",testingTradingOutpost.x,testingTradingOutpost.z);
  for(let [key,outpost] of scannedTradingOutposts){
    if(key==="station-trading-outpost") continue;
    if(outpost) add(key,outpost.x,outpost.z);
  }

  return outposts;
}

function nearestTradingOutpostForCompass(state){
  if(!state) return null;
  let nearest=null;
  let nearestDistSq=Infinity;

  for(let outpost of visibleTradingOutpostsForMap()){
    let dx=outpost.x-state.carX;
    let dz=outpost.z-state.carZ;
    let distSq=dx*dx+dz*dz;
    if(distSq<nearestDistSq){
      nearest=outpost;
      nearestDistSq=distSq;
    }
  }

  return nearest;
}

function nearestBossBaseForCompass(state){
  if(!state || !scannerUnlocked()) return null;

  let nearest=null;
  let nearestDistSq=Infinity;
  for(let base of scannedBossBases){
    if(!base || base.active===false || base.health<=0) continue;

    let dx=base.x-state.carX;
    let dz=base.z-state.carZ;
    let distSq=dx*dx+dz*dz;
    if(distSq<nearestDistSq){
      nearest=base;
      nearestDistSq=distSq;
    }
  }

  return nearest;
}

function communicationOutpostsForCompass(){
  if(!scannerUnlocked() || !missionCompassScannerFired) return [];
  return Array.from(scannedRadarOutposts.values()).filter(outpost=>{
    let activeMissionId=generatedPlanetMission && generatedPlanetMission.type==="relay"
      ? generatedPlanetMission.id
      : emberCommunicationMissionId;
    if(!outpost || outpost.missionId!==activeMissionId) return false;
    for(let activeOutpost of activeCommunicationMissionOutposts()){
      let dx=activeOutpost.x-outpost.x;
      let dz=activeOutpost.z-outpost.z;
      if(dx*dx+dz*dz<16) return true;
    }
    return false;
  });
}

let hud=createHud({
  getPerformanceMode:()=>gameMode==="double" ? "split" : "full",
  getPerformanceStressLevel:()=>currentFrameStressLevel,
  getFirstPersonMode:()=>firstPersonViewActive(),
  getEnvironment:()=>currentEnvironment,
  getCarStates:()=>displayCars().map(car=>({
    id:car.id,
    label:car.id==="car1" ? "P1" : "P2",
    color:car.id==="car1" ? "#d62f2f" : "#3d6ee8",
    carX:car.x,
    carZ:car.z,
    carVelAngle:car.velAngle,
    carSpeed:car.speed,
    carHealth:car.health,
    rocketAmmo:rocketLauncherUnlocked() ? car.rocketAmmo : 0,
    carRocketAmmo:rocketLauncherUnlocked() ? car.carRocketAmmo : 0,
    cannonAmmo:car.cannonAmmo,
    clusterBombAmmo:car.clusterBombAmmo,
    laserAvailable:laserUnlocked(),
    laserCooldown:car.laserCooldown,
    laserFireFrames:car.laserFireFrames,
    boostCharge:car.boostCharge,
    fuel:car.fuel,
    units
  })),
  getEnemyStates:()=>activeEnemies().map(enemy=>({
    id:enemy.id,
    x:enemy.x,
    z:enemy.z,
    health:enemy.health
  })),
  getScannedBossBases:()=>Array.from(scannedBossBases).filter(base=>base && base.active!==false && base.health>0),
  getScannedTradingOutposts:visibleTradingOutpostsForMap,
  getScannedRadarOutposts:()=>Array.from(scannedRadarOutposts.values()),
  getScannedLandingSpaces:()=>Array.from(scannedLandingSpaces.values()),
  getScannedPortals:()=>Array.from(scannedPortals.values()),
  getNearestTradingOutpost:nearestTradingOutpostForCompass,
  getNearestBossBase:nearestBossBaseForCompass,
  getCompassRadarOutposts:communicationOutpostsForCompass,
  getTerrainHeight:(x,z)=>carSurfaceHeight(x,z),
  getStationState:()=>tradingOutpost ? ({
    x:tradingOutpost.position.x,
    z:tradingOutpost.position.z
  }) : null,
  getChunks:()=>world.chunks
});

function showGameOver(){
  if(gameOver) return;
  gameOver=true;
  for(let car of activeCars()){
    car.speed=0;
    car.vy=0;
  }
  hud.updateHealthHud();
  hud.showGameOverOverlay();
}

function showGameWon(source=null){
  if(gameOver) return;
  gameOver=true;
  gameWon=true;
  for(let car of activeCars()){
    car.speed=0;
    car.vy=0;
  }
  hud.updateHealthHud();
  startTerraformFinale(source || playerCar);
}

function hideMissionCompleteOverlay(){
  if(!missionCompleteOverlay) return;
  missionCompleteOverlay.style.display="none";
  missionCompleteControllerButtonDown=false;
  missionCompleteShownAt=0;
  missionCompleteInputReadyAt=0;
  if(missionCompleteText){
    missionCompleteText.style.opacity="0";
    missionCompleteText.style.transform="scale(0.96)";
  }
}

function missionCompleteOverlayVisible(){
  return !!missionCompleteOverlay && missionCompleteOverlay.style.display!=="none";
}

function updateMissionCompleteReveal(now=performance.now()){
  if(!missionCompleteShownAt) return false;
  if(!missionCompleteOverlayVisible()){
    if(now-missionCompleteShownAt<3000) return true;
    gameOver=true;
    gameWon=true;
    freezeCarsForWin();
    clearRockets();
    clearEnemies();
    hud.updateHealthHud();
    if(motorAudio.stopMusic) motorAudio.stopMusic();
    setGameAudioAllowed(false);
    missionCompleteOverlay.style.display="flex";
    missionCompleteText.style.opacity="0";
    missionCompleteText.style.transform="scale(0.96)";
    missionCompleteInputReadyAt=now+450;
    missionCompleteControllerButtonDown=true;
    if(document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    if(motorAudio.playMissionAccomplishedVoice) motorAudio.playMissionAccomplishedVoice();
    return true;
  }
  if(missionCompleteText && missionCompleteText.style.opacity!=="1"){
    missionCompleteText.style.opacity="1";
    missionCompleteText.style.transform="scale(1)";
  }
  return true;
}

function returnToMainMenuAfterMission(){
  if(!missionCompleteOverlayVisible()) return;
  hideMissionCompleteOverlay();
  if(document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  if(motorAudio.stopMusic) motorAudio.stopMusic();
  setGameAudioAllowed(false);
  motorAudio.setPaused(false);
  gameStarted=false;
  gameOver=false;
  gameWon=false;
  gamePaused=false;
  tradingScreenOpen=false;
  missionScreenOpen=false;
  pauseMenu.setVisible(false);
  missionScreen.setVisible(false);
  tradingScreen.setVisible(false);
  clearStartWorldPreview();
  let startScreen=document.getElementById("startScreen");
  if(startScreen){
    startScreen.style.display="";
    startScreen.classList.remove("is-fullscreen-transition");
  }
  setupStartWorldPreview();
  refreshStartPlanetButtons();
  updateStartupLoadingState();
  updateLoadGameButton();
  resetSimulationClock();
  lastLoopTime=null;
}

function updateMissionCompleteInput(){
  if(!missionCompleteShownAt){
    missionCompleteControllerButtonDown=false;
    return false;
  }

  let now=performance.now();
  updateMissionCompleteReveal(now);
  if(!missionCompleteOverlayVisible()) return false;
  if(now<missionCompleteInputReadyAt) return true;

  let controllerButton=activeCars().some(car=>{
    let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
    return buttons.rightTrigger || buttons.rightBumper;
  });
  if(controllerButton && !missionCompleteControllerButtonDown){
    returnToMainMenuAfterMission();
  }
  missionCompleteControllerButtonDown=controllerButton;
  return true;
}

function showMissionAccomplished(missionId){
  if(gameOver || missionCompleteShownAt) return;
  markMissionCompleted(missionId);
  if(missionCompleteOverlay){
    let now=performance.now();
    missionCompleteShownAt=now;
    missionCompleteInputReadyAt=0;
    missionCompleteControllerButtonDown=true;
    missionCompleteOverlay.style.display="none";
    missionCompleteText.style.opacity="0";
    missionCompleteText.style.transform="scale(0.96)";
  }
}

missionCompleteOverlay.addEventListener("click",event=>{
  if(performance.now()<missionCompleteInputReadyAt) return;
  if(event.target && event.target.closest && event.target.closest("#missionCompleteOverlay button")) return;
  returnToMainMenuAfterMission();
});
missionCompleteBackButton.addEventListener("click",event=>{
  event.preventDefault();
  event.stopPropagation();
  playMenuClickFeedback();
  returnToMainMenuAfterMission();
});
window.addEventListener("pointerdown",event=>{
  if(!missionCompleteOverlayVisible() || event.button!==0) return;
  if(performance.now()<missionCompleteInputReadyAt) return;
  if(event.target && event.target.closest && event.target.closest("#missionCompleteOverlay button")) return;
  event.preventDefault();
  event.stopPropagation();
  returnToMainMenuAfterMission();
},true);

function freezeCarsForWin(){
  for(let car of activeCars()){
    car.speed=0;
    car.vy=0;
    car.throttleEase=0;
    car.turnInputEase=0;
  }
}

function scheduleBossFinale(source=null,delayFrames=210){
  if(gameWon || pendingBossFinale || terraformFinaleTriggered) return;
  gameOver=true;
  gameWon=true;
  terraformFinaleTriggered=true;
  freezeCarsForWin();
  hud.updateHealthHud();
  if(motorAudio.stopMusic) motorAudio.stopMusic();
  pendingBossFinale={
    source:source || playerCar,
    frames:Math.max(1,Math.floor(delayFrames))
  };
}

function updatePendingBossFinale(){
  if(!pendingBossFinale) return;
  pendingBossFinale.frames--;
  if(pendingBossFinale.frames>0) return;

  let source=pendingBossFinale.source || playerCar;
  pendingBossFinale=null;
  startTerraformFinale(source);
}

function finiteOr(value,fallback){
  return Number.isFinite(value) ? value : fallback;
}

function robotDamageSnapshot(state){
  let snapshot={};
  for(let zone of robotDamageZoneNames){
    snapshot[zone]=finiteOr(state && state[zone],0);
  }
  return snapshot;
}

function serializeCarStatus(car){
  return {
    id:car.id,
    active:!!(car.group && car.group.visible),
    x:car.x,
    y:car.y,
    z:car.z,
    angle:car.angle,
    velAngle:car.velAngle,
    speed:car.speed,
    vy:car.vy,
    cameraYaw:car.cameraYaw,
    health:car.health,
    morphed:!!car.morphed,
    morphProgress:car.morphProgress,
    jetMode:!!car.jetMode,
    jetProgress:car.jetProgress,
    jetBank:car.jetBank,
    jetAltitudeTarget:car.jetAltitudeTarget,
    landedOnPad:!!car.landedOnPad,
    jetAutoLandToRobot:!!car.jetAutoLandToRobot,
    rocketAmmo:car.rocketAmmo,
    carRocketAmmo:car.carRocketAmmo,
    cannonAmmo:car.cannonAmmo,
    clusterBombAmmo:car.clusterBombAmmo,
    laserAvailable:laserUnlocked(),
    laserCooldown:car.laserCooldown,
    laserFireFrames:car.laserFireFrames,
    boostCharge:car.boostCharge,
    fuel:car.fuel,
    damageZones:robotDamageSnapshot(car.damageZones),
    lateralOffset:car.lateralOffset
  };
}

function mapSnapshot(map){
  return Array.from(map.values()).map(item=>({
    x:item.x,
    z:item.z,
    r:item.r
  })).filter(item=>Number.isFinite(item.x) && Number.isFinite(item.z));
}

function formatSavedGameDate(savedAt){
  let date=new Date(savedAt);
  if(!Number.isFinite(date.getTime())) return "";

  try{
    return new Intl.DateTimeFormat(undefined,{
      dateStyle:"medium",
      timeStyle:"short"
    }).format(date);
  }catch(error){
    return date.toLocaleString();
  }
}

function saveGameStatus(){
  if(!gameStarted || gameOver) return false;

  let environmentIndex=worldEnvironments.indexOf(currentEnvironment);
  let savedAt=Date.now();
  let status={
    version:saveGameVersion,
    savedAt,
    savedAtText:formatSavedGameDate(savedAt),
    mode:gameMode,
    difficulty:gameDifficulty,
    terrainSeed,
    environmentName:currentEnvironment && currentEnvironment.name,
    environmentIndex:environmentIndex>=0 ? environmentIndex : 0,
    units,
    purchasedTradingItems:Array.from(purchasedTradingItems),
    jetUnlocked,
    enemyWaveDelay,
    enemyPatrolDelay,
    rainIntensity,
    weatherTargetIntensity,
    weatherChangeRemaining:Math.max(1000,finiteOr(nextWeatherChange,performance.now())-performance.now()),
    startInfo:currentStartInfo ? {
      z:currentStartInfo.z,
      angle:currentStartInfo.angle,
      fieldOffset:currentStartInfo.fieldOffset
    } : null,
    cars:cars.map(serializeCarStatus),
    scannedBossBases:Array.from(scannedBossBases).map(base=>({
      x:base && base.x,
      z:base && base.z,
      health:base && Number.isFinite(base.health) ? base.health : 1,
      active:base && base.active!==false
    })).filter(item=>Number.isFinite(item.x) && Number.isFinite(item.z)),
    scannedTradingOutposts:mapSnapshot(scannedTradingOutposts),
    scannedRadarOutposts:mapSnapshot(scannedRadarOutposts),
    scannedLandingSpaces:mapSnapshot(scannedLandingSpaces),
    scannedPortals:mapSnapshot(scannedPortals)
  };

  try{
    localStorage.setItem(saveGameStorageKey,JSON.stringify(status));
    updateLoadGameButton();
    return true;
  }catch(error){
    console.warn("Failed to save game status:",error);
    return false;
  }
}

function readSavedGameStatus(){
  try{
    let raw=localStorage.getItem(saveGameStorageKey);
    if(!raw) return null;

    let status=JSON.parse(raw);
    if(!status || status.version!==saveGameVersion) return null;
    if(status.mode!=="single" && status.mode!=="double") return null;
    if(!difficultySettings[status.difficulty]) status.difficulty="medium";
    if(!Array.isArray(status.cars) || !status.cars.length) return null;
    return status;
  }catch(error){
    console.warn("Failed to read saved game status:",error);
    return null;
  }
}

let startupAssetsReady=false;
let startupAssetSettled=0;
let startupAssetTotal=0;

function updateStartupLoadingState(){
  let screen=document.getElementById("startScreen");
  if(!screen) return;

  screen.classList.toggle("is-loading",!startupAssetsReady);
  screen.classList.toggle("is-ready",startupAssetsReady);

  let status=screen.querySelector("[data-loading-status]");
  if(status){
    status.textContent=startupAssetsReady
      ? "Ready"
      : startupAssetTotal>0
        ? `Loading assets ${startupAssetSettled}/${startupAssetTotal}`
        : "Loading assets";
  }

  for(let button of screen.querySelectorAll("[data-mode]")){
    button.disabled=!startupAssetsReady;
  }
}

function trackStartupAsset(promise){
  startupAssetTotal++;
  updateStartupLoadingState();
  return promise.finally(()=>{
    startupAssetSettled++;
    updateStartupLoadingState();
  });
}

function finishStartupAssetLoading(){
  startupAssetsReady=true;
  updateStartupLoadingState();
  updateLoadGameButton();
}

function updateLoadGameButton(){
  let button=document.querySelector("[data-load-game]");
  let dateEl=document.querySelector("[data-load-game-date]");
  if(!button) return;

  let status=readSavedGameStatus();
  button.disabled=!startupAssetsReady || !status;
  button.textContent=!startupAssetsReady ? "Loading Assets" : status ? "Load Last Save" : "No Saved Game";
  if(dateEl){
    let savedAtText=status ? (status.savedAtText || formatSavedGameDate(status.savedAt)) : "";
    dateEl.textContent=savedAtText ? `Saved ${savedAtText}` : "";
  }
}

function restoreDamageState(saved){
  let state=createRobotDamageState();
  for(let zone of robotDamageZoneNames){
    state[zone]=Math.max(0,finiteOr(saved && saved[zone],0));
  }
  return state;
}

function restoreCarStatus(car,saved){
  if(!car || !saved) return;

  car.x=finiteOr(saved.x,car.x);
  car.z=finiteOr(saved.z,car.z);
  car.y=finiteOr(saved.y,drivingSurfaceHeight(car.x,car.z));
  car.renderY=car.y;
  car.angle=finiteOr(saved.angle,car.angle);
  car.velAngle=finiteOr(saved.velAngle,car.angle);
  car.speed=finiteOr(saved.speed,0);
  car.vy=finiteOr(saved.vy,0);
  car.cameraYaw=finiteOr(saved.cameraYaw,car.angle);
  car.health=Math.max(0,Math.min(100,finiteOr(saved.health,100)));
  car.morphed=!!saved.morphed;
  car.morphProgress=Math.max(0,Math.min(1,finiteOr(saved.morphProgress,car.morphed ? 1 : 0)));
  car.lastMorphProgress=car.morphProgress;
  car.jetMode=!!saved.jetMode;
  car.jetProgress=Math.max(0,Math.min(1,finiteOr(saved.jetProgress,car.jetMode ? 1 : 0)));
  car.jetBank=finiteOr(saved.jetBank,0);
  car.jetAltitudeTarget=finiteOr(saved.jetAltitudeTarget,car.y+jetHoverGroundClearance);
  car.jetHoverSurfaceY=surfaceHeightForActor(car,car.x,car.z);
  car.jetLandingTransformLift=0;
  car.jetLandingTransformStartLift=0;
  car.landedOnPad=!!saved.landedOnPad;
  car.jetAutoLandToRobot=!!saved.jetAutoLandToRobot;
  if(car.jetAutoLandToRobot){
    car.jetMode=true;
    car.morphed=false;
  }
  car.rocketAmmo=Math.max(0,Math.min(maxRocketAmmo(),Math.floor(finiteOr(saved.rocketAmmo,maxRocketAmmo()))));
  car.carRocketAmmo=Math.max(0,Math.min(maxCarRocketAmmo(),Math.floor(finiteOr(saved.carRocketAmmo,maxCarRocketAmmo()))));
  car.cannonAmmo=Math.max(0,Math.min(maxCannonAmmo(),Math.floor(finiteOr(saved.cannonAmmo,maxCannonAmmo()))));
  car.clusterBombAmmo=Math.max(0,Math.floor(finiteOr(saved.clusterBombAmmo,initialClusterBombAmmo)));
  car.laserCooldown=Math.max(0,Math.floor(finiteOr(saved.laserCooldown,0)));
  car.laserFireFrames=Math.max(0,Math.min(playerLaserFireFrames,Math.floor(finiteOr(saved.laserFireFrames,0))));
  car.laserDamageTick=0;
  car.boostCharge=Math.max(0,Math.min(maxBoostCharge,finiteOr(saved.boostCharge,maxBoostCharge)));
  car.fuel=Math.max(0,Math.min(maxFuel,finiteOr(saved.fuel,maxFuel)));
  car.damageZones=restoreDamageState(saved.damageZones);
  car.damageFlashZones=createRobotDamageState();
  car.throttleEase=0;
  car.turnInputEase=0;
  car.turnVelocity=0;
  car.throttleInput=0;
  car.liftInput=0;
  car.surfaceDistance=roadDistance(car.x,car.z);
  car.onGround=!car.jetMode && car.jetProgress<0.65;
  car.airborne=car.jetMode || car.jetProgress>=0.65;
  car.lastWalkX=car.x;
  car.lastWalkZ=car.z;
  if(Number.isFinite(saved.lateralOffset)) car.lateralOffset=saved.lateralOffset;
  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle;
  car.group.rotation.x=0;
  car.group.rotation.z=0;
  applyRobotDamageVisuals(car.mechModel,car.damageZones);
  applyRobotHitFlashVisuals(car.mechModel,car.damageFlashZones);
  updateMorphVisual(car);
}

function restoreScannedMap(map,items){
  map.clear();
  if(!Array.isArray(items)) return;

  for(let i=0;i<items.length;i++){
    let item=items[i];
    if(!item || !Number.isFinite(item.x) || !Number.isFinite(item.z)) continue;
    map.set(`saved-${i}`,{
      x:item.x,
      z:item.z,
      r:item.r
    });
  }
}

function applySavedWorldSettings(status){
  if(!status) return;

  let environment=worldEnvironments.find(item=>item.name===status.environmentName)
    || worldEnvironments[status.environmentIndex]
    || currentEnvironment;
  currentEnvironment=environment;
  updatePlanetNameDisplay();
  terrainSeed=Number.isFinite(status.terrainSeed) ? status.terrainSeed : terrainSeed;
  setWorldSeed(terrainSeed,currentEnvironment.terrain || {});
  clearTerrainHeightCache();
  if(world.setWorkerTerrain) world.setWorkerTerrain(terrainSeed,currentEnvironment.terrain || {});
  if(world.setEnvironment) world.setEnvironment(currentEnvironment);
  refreshSceneEnvironment();
  if(world.resetChunks) world.resetChunks();
  clouds.makeClouds();
  birds.makeBirds();
}

function applyWorldEnvironment(environment,{resetChunks=true,refreshNature=true}={}){
  if(!environment) return;
  currentEnvironment=environment;
  updatePlanetNameDisplay();
  weatherTargetIntensity=chooseWeatherTarget(currentEnvironment);
  scheduleNextWeatherChange(performance.now());
  setWorldSeed(terrainSeed,currentEnvironment.terrain || {});
  clearTerrainHeightCache();
  if(world.setWorkerTerrain) world.setWorkerTerrain(terrainSeed,currentEnvironment.terrain || {});
  if(world.setEnvironment) world.setEnvironment(currentEnvironment);
  refreshSceneEnvironment();
  if(resetChunks && world.resetChunks) world.resetChunks();
  if(refreshNature){
    clouds.makeClouds();
    birds.makeBirds();
  }
}

function clearStartWorldPreview(){
  clearRockets();
  clearAmbientSpaceships();
  clearEnemies();
  clearSupplyBoxes();
  clearGiantTestRobot();
  clearTradingOutpost();
  clearTestingTradingOutpost();
  clearTestingRadarOutpost();
  missionCommunicationOutposts=[];
  generatedPlanetMission=null;
  if(world.clearMissionRadarOutposts) world.clearMissionRadarOutposts();
  updateMissionGoalDisplay();
  clearStartSequence();
  clearTerraformFinale();
  clearSurfaceScanPulses();
  clearRareTradingOutposts(true);
  portalSystem.clearRandomPortals();
  if(world.clearBossBases) world.clearBossBases();
}

function setupStartWorldPreview(){
  currentStartInfo=null;
  let initialStartInfo=findSafeFieldStart([playerCar.lateralOffset,0,secondCar.lateralOffset]);
  placeCarOnOpenField(playerCar,initialStartInfo);
  placeCarOnOpenField(secondCar,initialStartInfo);
  spawnGiantTestRobot(initialStartInfo);
  placeTradingOutpostNearStart(initialStartInfo);
  placeTestingTradingOutpostNearHomeBase();
  placeStartingCarsAtBaseEntrance("double",false);
  if(currentPlanetMission().id!==emberCommunicationMissionId){
    world.placeTestBossBaseNearStart(playerCar.x,playerCar.z,playerCar.angle,{nearStart:true});
  }
  playerCar.cameraYaw=playerCar.angle;
  secondCar.cameraYaw=secondCar.angle;
  updateCameras();

  lastChunkSignature=chunkSignatureForCars();
  world.updateChunksForCenters(chunkCentersForActiveCars());
  world.processChunkQueue(80,true);
  updateUnlockedRandomPortals();
  clouds.makeClouds();
  birds.makeBirds();
}

function disposePreviewObject(object){
  if(!object) return;
  object.traverse(child=>{
    if(child.geometry) child.geometry.dispose();
    if(child.material){
      if(Array.isArray(child.material)){
        for(let material of child.material) material.dispose();
      }else{
        child.material.dispose();
      }
    }
  });
}

function initStartPlanetPreview(){
  let host=document.querySelector("[data-planet-preview]");
  if(!host) return null;

  let previewScene=new THREE.Scene();
  let previewCamera=new THREE.PerspectiveCamera(34,1,0.1,80);
  previewCamera.position.set(0,4.8,10.4);
  previewCamera.lookAt(0,0.6,0);

  let previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
  previewRenderer.setClearColor(0x000000,0);
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.75));
  host.appendChild(previewRenderer.domElement);

  let keyLight=new THREE.DirectionalLight(0xffffff,2.1);
  keyLight.position.set(5,8,6);
  previewScene.add(keyLight);
  previewScene.add(new THREE.HemisphereLight(0xbdefff,0x172027,1.9));

  let worldGroup=new THREE.Group();
  previewScene.add(worldGroup);

  function envColor(environment,key,fallback){
    let colors=environment && environment.colors || {};
    return Number.isFinite(colors[key]) ? colors[key] : fallback;
  }

  function makeMat(color,roughness=0.72,metalness=0.08){
    return new THREE.MeshStandardMaterial({color,roughness,metalness});
  }

  function previewLocalY(worldY,baseY,heightScale){
    return clamp((worldY-baseY)*heightScale,-0.52,2.25);
  }

  function previewTerrainColor(environment,rawY,minY,maxY){
    let underwater=envColor(environment,"underwater",0x214b5b);
    let shore=envColor(environment,"shore",0xa89662);
    let low=envColor(environment,"low",0x556f43);
    let mid=envColor(environment,"mid",0x59704d);
    let high=envColor(environment,"high",0x8d8a75);
    let rock=envColor(environment,"rock",high);
    let range=Math.max(1,maxY-minY);
    let t=clamp01((rawY-minY)/range);

    if(rawY<waterLevel-0.4){
      return new THREE.Color(underwater).lerp(new THREE.Color(low),clamp01((rawY-waterLevel+8)/8)*0.34);
    }
    if(rawY<waterLevel+2.2){
      return new THREE.Color(shore).lerp(new THREE.Color(low),clamp01((rawY-waterLevel)/2.2));
    }
    if(t<0.48){
      return new THREE.Color(low).lerp(new THREE.Color(mid),t/0.48);
    }
    let mountainTone=new THREE.Color(high).lerp(new THREE.Color(rock),clamp01((t-0.72)/0.28)*0.45);
    return new THREE.Color(mid).lerp(mountainTone,(t-0.48)/0.52);
  }

  function buildPreviewTerrainGeometry(environment,centerX,centerZ,span,localSize=5.85,segments=58){
    let sampleCount=segments+1;
    let rawHeights=new Float32Array(sampleCount*sampleCount);
    let minY=Infinity;
    let maxY=-Infinity;

    for(let iz=0;iz<=segments;iz++){
      let v=iz/segments;
      let worldZ=centerZ+(v-0.5)*span;
      for(let ix=0;ix<=segments;ix++){
        let u=ix/segments;
        let worldX=centerX+(u-0.5)*span;
        let rawY=groundHeight(worldX,worldZ);
        rawHeights[iz*sampleCount+ix]=rawY;
        minY=Math.min(minY,rawY);
        maxY=Math.max(maxY,rawY);
      }
    }

    let baseY=Math.min(minY,waterLevel-4);
    let heightScale=clamp(1.72/Math.max(18,maxY-baseY),0.034,0.078);
    let positions=[];
    let colors=[];
    let indices=[];
    let color=new THREE.Color();

    for(let iz=0;iz<=segments;iz++){
      let v=iz/segments;
      let localZ=(v-0.5)*localSize;
      for(let ix=0;ix<=segments;ix++){
        let u=ix/segments;
        let localX=(u-0.5)*localSize;
        let rawY=rawHeights[iz*sampleCount+ix];
        positions.push(localX,previewLocalY(rawY,baseY,heightScale),localZ);
        color.copy(previewTerrainColor(environment,rawY,minY,maxY));
        colors.push(color.r,color.g,color.b);
      }
    }

    for(let iz=0;iz<segments;iz++){
      for(let ix=0;ix<segments;ix++){
        let a=iz*sampleCount+ix;
        let b=a+1;
        let c=a+sampleCount;
        let d=c+1;
        indices.push(a,c,b,b,c,d);
      }
    }

    let geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return {geometry,baseY,heightScale,minY,maxY,localSize,span,centerX,centerZ};
  }

  function addPreviewTerrainDetails(parent,sample,environment){
    let colors=environment && environment.colors || {};
    let detailCount=environment && environment.city ? 18 : 24;
    let wallMat=makeMat(envColor(environment,"wall",0x4c5966),0.7,0.12);
    let trimMat=makeMat(envColor(environment,"trim",0x92d8e8),0.48,0.16);
    let barkMat=makeMat(envColor(environment,"bark",0x2a2019),0.86,0.04);
    let leafMat=makeMat(envColor(environment,"leaf",0x56a85f),0.72,0.04);

    for(let i=0;i<detailCount;i++){
      let u=hash01(i+11,worldEnvironments.indexOf(environment)+3);
      let v=hash01(i+37,worldEnvironments.indexOf(environment)+19);
      let worldX=sample.centerX+(u-0.5)*sample.span*0.82;
      let worldZ=sample.centerZ+(v-0.5)*sample.span*0.82;
      let rawY=groundHeight(worldX,worldZ);
      if(rawY<waterLevel+0.8) continue;

      let localX=(worldX-sample.centerX)/sample.span*sample.localSize;
      let localZ=(worldZ-sample.centerZ)/sample.span*sample.localSize;
      let y=previewLocalY(rawY,sample.baseY,sample.heightScale);
      let worldScale=environment && environment.city ? 18+hash01(i,7)*18 : 10+hash01(i,13)*12;
      let scale=worldScale/sample.span*sample.localSize;

      if(environment && environment.city){
        let height=(1.8+hash01(i,23)*3.4)*scale;
        let footprint=(0.72+hash01(i,29)*0.45)*scale;
        let building=new THREE.Mesh(new THREE.BoxGeometry(footprint,height,footprint*0.86),wallMat);
        building.position.set(localX,y+height*0.5,localZ);
        building.rotation.y=(hash01(i,31)-0.5)*0.9;
        parent.add(building);
        if(colors.trim){
          let cap=new THREE.Mesh(new THREE.BoxGeometry(footprint*1.08,0.045,footprint*0.94),trimMat);
          cap.position.set(localX,y+height+0.025,localZ);
          cap.rotation.y=building.rotation.y;
          parent.add(cap);
        }
      }else{
        let trunkHeight=1.1*scale;
        let trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.12*scale,0.18*scale,trunkHeight,6),barkMat);
        trunk.position.set(localX,y+trunkHeight*0.5,localZ);
        trunk.rotation.z=(hash01(i,41)-0.5)*0.18;
        parent.add(trunk);

        let crown=new THREE.Mesh(new THREE.SphereGeometry(0.52*scale,9,7),leafMat);
        crown.scale.set(1.05+hash01(i,43)*0.55,0.72+hash01(i,47)*0.42,0.9+hash01(i,53)*0.5);
        crown.position.set(localX,y+trunkHeight+0.44*scale,localZ);
        parent.add(crown);
      }
    }
  }

  function rebuild(environment){
    disposePreviewObject(worldGroup);
    worldGroup.clear();
    setWorldSeed(terrainSeed,environment && environment.terrain || {});
    clearTerrainHeightCache();

    let water=envColor(environment,"water",0x3fc8ff);
    let rock=envColor(environment,"rock",envColor(environment,"high",0x687064));
    let colors=environment && environment.colors || {};
    let environmentIndex=Math.max(0,worldEnvironments.indexOf(environment));
    let centerZ=560+environmentIndex*290;
    let centerX=(hash01(environmentIndex+5,terrainSeed+17)-0.5)*(environment && environment.city ? 420 : 760);
    let span=environment && environment.city ? 360 : 620;
    let sample=buildPreviewTerrainGeometry(environment,centerX,centerZ,span);

    let base=new THREE.Mesh(
      new THREE.BoxGeometry(sample.localSize,0.36,sample.localSize),
      makeMat(rock,0.86,0.05)
    );
    base.position.y=-0.28;
    worldGroup.add(base);

    let terrainMesh=new THREE.Mesh(sample.geometry,new THREE.MeshStandardMaterial({
      vertexColors:true,
      roughness:0.82,
      metalness:0.035
    }));
    worldGroup.add(terrainMesh);

    if(sample.minY<waterLevel+7){
      let waterY=previewLocalY(waterLevel,sample.baseY,sample.heightScale)+0.018;
      let waterPlane=new THREE.Mesh(new THREE.PlaneGeometry(sample.localSize*1.04,sample.localSize*1.04,1,1),new THREE.MeshStandardMaterial({
        color:water,
        emissive:colors.waterEmissive || 0x000000,
        emissiveIntensity:0.16,
        transparent:true,
        opacity:0.46,
        roughness:0.18,
        metalness:0.16,
        side:THREE.DoubleSide
      }));
      waterPlane.rotation.x=-Math.PI/2;
      waterPlane.position.y=waterY;
      worldGroup.add(waterPlane);
    }

    addPreviewTerrainDetails(worldGroup,sample,environment);
  }

  function resize(){
    let rect=host.getBoundingClientRect();
    let width=Math.max(1,Math.floor(rect.width));
    let height=Math.max(1,Math.floor(rect.height));
    previewCamera.aspect=width/height;
    previewCamera.updateProjectionMatrix();
    previewRenderer.setSize(width,height,false);
  }

  let resizeObserver=new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  function animate(){
    requestAnimationFrame(animate);
    if(!host.isConnected) return;
    if(startScreen && startScreen.style.display==="none") return;
    worldGroup.rotation.y+=0.006;
    worldGroup.rotation.x=Math.sin(performance.now()*0.0007)*0.035;
    previewRenderer.render(previewScene,previewCamera);
  }
  requestAnimationFrame(animate);

  return {
    setEnvironment:rebuild,
    resize
  };
}

function selectStartEnvironment(index){
  if(gameStarted) return;
  let environment=worldEnvironments[index];
  if(!environment) return;
  if(!planetSelectable(environment)) return;
  clearStartWorldPreview();
  applyWorldEnvironment(environment,{resetChunks:true,refreshNature:false});
  setupStartWorldPreview();
  if(startPlanetPreview) startPlanetPreview.setEnvironment(environment);
}

function restoreSavedRuntimeStatus(status){
  units=Math.max(0,Math.floor(finiteOr(status.units,status.score ?? 0)));
  purchasedTradingItems=new Set(Array.isArray(status.purchasedTradingItems) ? status.purchasedTradingItems : []);
  applyDefaultStartItems();
  jetUnlocked=!!status.jetUnlocked || purchasedTradingItems.has("jet");
  if(jetUnlocked) purchasedTradingItems.add("jet");
  enemyWaveDelay=Math.max(0,Math.floor(finiteOr(status.enemyWaveDelay,enemyWaveDelay)));
  enemyPatrolDelay=Math.max(0,Math.floor(finiteOr(status.enemyPatrolDelay,enemyPatrolDelay)));
  rainIntensity=0;
  weatherTargetIntensity=Math.max(0,Math.min(1,finiteOr(status.weatherTargetIntensity,weatherTargetIntensity)));
  nextWeatherChange=performance.now()+Math.max(1000,finiteOr(status.weatherChangeRemaining,weatherChangeMinMs));
  scannedBossBases=new Set(Array.isArray(status.scannedBossBases) ? status.scannedBossBases.filter(item=>item && Number.isFinite(item.x) && Number.isFinite(item.z)) : []);
  restoreScannedMap(scannedTradingOutposts,status.scannedTradingOutposts);
  restoreScannedMap(scannedRadarOutposts,status.scannedRadarOutposts);
  restoreScannedMap(scannedLandingSpaces,status.scannedLandingSpaces);
  restoreScannedMap(scannedPortals,status.scannedPortals);
  updateUnlockedRandomPortals();
}

function setGamePaused(paused){
  if(!gameStarted || gameOver) paused=false;
  if(gamePaused===paused) return;
  gamePaused=paused;
  resetSimulationClock();
  lastLoopTime=null;
  motorAudio.setPaused(gamePaused || terminalOverlayOpen());
  pauseMenu.setVisible(gamePaused);
}

function terminalOverlayOpen(){
  return tradingScreenOpen || missionScreenOpen;
}

function stopActiveCarsForTerminal(){
  for(let car of activeCars()){
    car.speed=0;
    car.vy=0;
    car.throttleEase=0;
    car.turnInputEase=0;
    car.turnVelocity=0;
  }
  if(document.pointerLockElement && document.exitPointerLock){
    document.exitPointerLock();
  }
}

function setMissionScreenOpen(open){
  if(open && (!gameStarted || gameOver)) open=false;
  if(open && tradingScreenOpen) setTradingScreenOpen(false);
  if(missionScreenOpen===open) return;
  missionScreenOpen=open;
  resetSimulationClock();
  lastLoopTime=null;
  missionScreen.setVisible(missionScreenOpen);
  motorAudio.setPaused(gamePaused || terminalOverlayOpen());

  if(missionScreenOpen) stopActiveCarsForTerminal();
}

function setTradingScreenOpen(open){
  if(open && (!gameStarted || gameOver)) open=false;
  if(open && missionScreenOpen) setMissionScreenOpen(false);
  if(tradingScreenOpen===open) return;
  tradingScreenOpen=open;
  resetSimulationClock();
  lastLoopTime=null;
  tradingScreen.setVisible(tradingScreenOpen);
  motorAudio.setPaused(gamePaused || terminalOverlayOpen());

  if(tradingScreenOpen) stopActiveCarsForTerminal();
}

function closeTradingScreen(){
  setTradingScreenOpen(false);
}

function closeMissionScreen(){
  setMissionScreenOpen(false);
}

window.addEventListener("keydown",event=>{
  let key=(event.key || "").toLowerCase();
  if(key==="p" && !event.repeat){
    if(gameStarted && !gameOver && !terminalOverlayOpen()){
      firstPersonPerspective=!firstPersonPerspective;
      updateFirstPersonVisorOverlay();
      event.preventDefault();
    }
    return;
  }

  if(event.key!=="Escape") return;
  event.preventDefault();
  if(missionScreenOpen){
    closeMissionScreen();
    return;
  }
  if(tradingScreenOpen){
    closeTradingScreen();
    return;
  }
  if(!gameStarted || gameOver) return;
  setGamePaused(!gamePaused);
});

function updateControllerMenuInput(){
  let menuButton=gameStarted && activeCars().some(car=>{
    let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
    return buttons.y;
  });

  if(menuButton && !controllerMenuButtonDown){
    if(missionScreenOpen){
      closeMissionScreen();
    }else if(tradingScreenOpen){
      closeTradingScreen();
    }else if(!gameOver){
      setGamePaused(!gamePaused);
    }
  }

  controllerMenuButtonDown=menuButton;
}

function damageCar(car,amount,hitPoint=null){
  if(healthDamageCooldown>0 || car.health<=0) return;
  let shielded=shieldUnlocked();
  let reducedAmount=Math.max(1,Math.floor(amount*(shielded ? 0.08 : 0.2)));
  car.health=Math.max(0,car.health-reducedAmount);
  addRobotDamage(car,reducedAmount,hitPoint);
  healthDamageCooldown=shielded ? 84 : 42;
  hud.updateHealthHud();
  if(activeCars().some(item=>item.health<=0)) showGameOver();
}

function createRobotDamageState(){
  let state={};
  for(let zone of robotDamageZoneNames) state[zone]=0;
  return state;
}

function robotDamageZoneForMeshName(name=""){
  if(name.includes("head") || name.includes("visor") || name.includes("neck") || name.includes("antenna")) return "head";
  if(name.includes("torso") || name.includes("chest") || name.includes("cockpit") || name.includes("reactor") || name.includes("pelvis")) return "torso";
  if(name.startsWith("left-")){
    if(name.includes("shoulder") || name.includes("arm") || name.includes("elbow") || name.includes("forearm") || name.includes("hand") || name.includes("cannon")) return "leftArm";
    if(name.includes("hip") || name.includes("leg") || name.includes("knee") || name.includes("shin") || name.includes("foot") || name.includes("toe") || name.includes("wheel") || name.includes("hub")) return "leftLeg";
  }
  if(name.startsWith("right-")){
    if(name.includes("shoulder") || name.includes("arm") || name.includes("elbow") || name.includes("forearm") || name.includes("hand") || name.includes("cannon")) return "rightArm";
    if(name.includes("hip") || name.includes("leg") || name.includes("knee") || name.includes("shin") || name.includes("foot") || name.includes("toe") || name.includes("wheel") || name.includes("hub")) return "rightLeg";
  }
  return null;
}

function prepareRobotDamageMaterial(mesh){
  if(!mesh || !mesh.material || !mesh.material.color || mesh.userData.damageVisualReady) return;
  if(!mesh.material.userData || !mesh.material.userData.carDustApplied){
    mesh.material=mesh.material.clone();
  }
  mesh.userData.damageVisualReady=true;
  mesh.userData.damageBaseColor=mesh.material.color.clone();
  mesh.userData.damageBaseEmissive=mesh.material.emissive ? mesh.material.emissive.clone() : null;
  mesh.userData.damageBaseEmissiveIntensity=Number.isFinite(mesh.material.emissiveIntensity) ? mesh.material.emissiveIntensity : 0;
  mesh.userData.damageBaseRoughness=Number.isFinite(mesh.material.roughness) ? mesh.material.roughness : null;
  mesh.userData.damageBaseMetalness=Number.isFinite(mesh.material.metalness) ? mesh.material.metalness : null;
}

function applyRobotDamageVisuals(robot,zones){
  if(!robot || !zones) return;
  let scorch=new THREE.Color(0x130b08);
  let burn=new THREE.Color(0xff3d1f);

  robot.traverse(child=>{
    if(!child.isMesh) return;
    let zone=robotDamageZoneForMeshName(child.name || "");
    if(!zone) return;

    prepareRobotDamageMaterial(child);
    if(!child.userData.damageVisualReady) return;

    let amount=clamp((zones[zone] || 0)/100,0,1);
    child.material.color.copy(child.userData.damageBaseColor).lerp(scorch,amount*0.76);

    if(child.material.emissive && child.userData.damageBaseEmissive){
      child.material.emissive.copy(child.userData.damageBaseEmissive).lerp(burn,amount*0.42);
      child.material.emissiveIntensity=child.userData.damageBaseEmissiveIntensity+amount*0.38;
    }
    if(child.userData.damageBaseRoughness!==null){
      child.material.roughness=clamp(child.userData.damageBaseRoughness+amount*0.32,0,1);
    }
    if(child.userData.damageBaseMetalness!==null){
      child.material.metalness=clamp(child.userData.damageBaseMetalness-amount*0.16,0,1);
    }
  });
}

function applyRobotHitFlashVisuals(robot,zones){
  if(!robot || !zones) return;
  let flash=new THREE.Color(0xfff1c8);
  let flashEmissive=new THREE.Color(0xff6226);

  robot.traverse(child=>{
    if(!child.isMesh) return;
    let zone=robotDamageZoneForMeshName(child.name || "");
    if(!zone) return;

    prepareRobotDamageMaterial(child);
    if(!child.userData.damageVisualReady) return;

    let amount=clamp((zones[zone] || 0)/100,0,1);
    child.material.color.copy(child.userData.damageBaseColor).lerp(flash,amount*0.9);

    if(child.material.emissive && child.userData.damageBaseEmissive){
      child.material.emissive.copy(child.userData.damageBaseEmissive).lerp(flashEmissive,amount*0.8);
      child.material.emissiveIntensity=child.userData.damageBaseEmissiveIntensity+amount*1.35;
    }
    if(child.userData.damageBaseRoughness!==null){
      child.material.roughness=clamp(child.userData.damageBaseRoughness-amount*0.18,0,1);
    }
    if(child.userData.damageBaseMetalness!==null){
      child.material.metalness=child.userData.damageBaseMetalness;
    }
  });
}

function robotDamageZoneFromHit(car,x,y,z){
  if(!car) return "torso";
  if(!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return "torso";

  let rightX=Math.cos(car.angle || 0);
  let rightZ=-Math.sin(car.angle || 0);
  let lateral=(x-car.x)*rightX+(z-car.z)*rightZ;
  let height=clamp((y-car.y)/Math.max(4.8,car.hitHeight || 5.2),0,1);
  let side=lateral<0 ? "left" : "right";
  let sideHit=Math.abs(lateral)>1.12;

  if(height>0.78) return "head";
  if(height>0.46) return sideHit ? `${side}Arm` : "torso";
  return sideHit ? `${side}Leg` : "torso";
}

function addRobotDamage(car,amount,hitPoint=null){
  if(!car) return;
  if(!car.damageZones) car.damageZones=createRobotDamageState();
  if(!car.damageFlashZones) car.damageFlashZones=createRobotDamageState();
  let zone=hitPoint
    ? robotDamageZoneFromHit(car,hitPoint.x,hitPoint.y,hitPoint.z)
    : "torso";
  car.damageZones[zone]=clamp((car.damageZones[zone] || 0)+amount*2.2,0,100);
  car.damageFlashZones[zone]=100;
  if(car.mechModel) applyRobotHitFlashVisuals(car.mechModel,car.damageFlashZones);
}

function repairRobotDamage(car,amount){
  if(!car || !car.damageZones) return;
  for(let zone of robotDamageZoneNames){
    car.damageZones[zone]=Math.max(0,(car.damageZones[zone] || 0)-amount*1.25);
  }
}

function updateRobotDamageFlashes(car){
  if(!car || !car.mechModel) return;
  if(!car.damageFlashZones) car.damageFlashZones=createRobotDamageState();

  for(let zone of robotDamageZoneNames){
    car.damageFlashZones[zone]=Math.max(0,(car.damageFlashZones[zone] || 0)-5.2);
  }
  applyRobotHitFlashVisuals(car.mechModel,car.damageFlashZones);
}

function addUnits(amount){
  units+=amount;
  if(hud) hud.updateCompassHud();
}

function enemyUnitReward(enemy){
  if(!enemy) return 0;
  if(enemy.isSpider) return crabEnemyUnitAmount;
  if(enemy.isDrone) return droneEnemyUnitAmount;
  if(enemy.isGiant) return giantEnemyUnitAmount;
  return normalEnemyUnitAmount;
}

function treasureUnitAmount(type){
  return 200;
}

function updateTreasurePickups(){
  if(!world || !world.collectTreasureAt) return;

  for(let car of activeCars()){
    if(!car || !car.group.visible || car.health<=0) continue;

    let treasure=world.collectTreasureAt(car.x,car.z,car.collisionRadius || 2.35);
    if(!treasure) continue;

    spawnTreasurePickupEffect(treasure);
    addUnits(treasureUnitAmount(treasure.type));
    advanceGeneratedPlanetMission("treasure",1);
    hud.updateCompassHud();
  }
}

function playBuildingExplosionSound(obstacle){
  if(!obstacle || (obstacle.type!=="building" && obstacle.type!=="radarOutpost") || !motorAudio || !motorAudio.playExplosion) return;

  let now=performance.now();
  if(now-lastBuildingExplosionSoundAt<buildingExplosionSoundCooldownMs) return;
  lastBuildingExplosionSoundAt=now;

  let height=obstacle.visualHeight || obstacle.height || Math.max(8,(obstacle.r || 5)*1.4);
  let baseY=Number.isFinite(obstacle.baseY) ? obstacle.baseY : drivingSurfaceHeight(obstacle.x,obstacle.z);
  motorAudio.playExplosion({
    x:obstacle.x,
    y:baseY+height*0.42,
    z:obstacle.z
  },{volume:2.2});
}

function forgetScannedRadarOutpost(obstacle){
  if(!obstacle || obstacle.type!=="radarOutpost" || !scannedRadarOutposts) return;

  for(let [key,outpost] of scannedRadarOutposts){
    if(!outpost) continue;
    let dx=(outpost.x || 0)-obstacle.x;
    let dz=(outpost.z || 0)-obstacle.z;
    if(dx*dx+dz*dz<4){
      scannedRadarOutposts.delete(key);
    }
  }
}

function destroyWorldObstacle(obstacle){
  if(!world.destroyObstacle(obstacle)) return false;

  if(obstacle.village && obstacle.type==="building"){
    addUnits(villageBuildingUnitAmount);
  }

  playBuildingExplosionSound(obstacle);
  if(obstacle.type==="radarOutpost"){
    forgetScannedRadarOutpost(obstacle);
    if(hud) hud.updateMapHud(true);
    updatePlanetMissionAfterOutpostDestroyed(obstacle);
  }

  if(obstacle.village && world.isVillageCleared(obstacle.village) && !scoredVillages.has(obstacle.village)){
    scoredVillages.add(obstacle.village);
    addUnits(obstacle.village.city ? cityClearedUnitAmount : villageClearedUnitAmount);
    advanceGeneratedPlanetMission("village",1,{city:!!obstacle.village.city});
  }

  return true;
}

function obstacleMaxHealth(obstacle){
  if(obstacle && obstacle.type==="radarOutpost") return obstacle.missionId ? 520 : 92;
  if(!obstacle || obstacle.type!=="building") return 1;

  let height=obstacle.visualHeight || obstacle.height || 8;
  if(!obstacle.cityBuilding) return 30;

  let radius=obstacle.visualRadius || obstacle.r || 6;
  return Math.max(95,Math.ceil(height*1.85+radius*2.4));
}

function damageWorldObstacle(obstacle,amount=1){
  if(!obstacle || obstacle.destroyed) return false;
  if(obstacle.type!=="building" && obstacle.type!=="radarOutpost") return destroyWorldObstacle(obstacle);

  if(!Number.isFinite(obstacle.maxHealth)) obstacle.maxHealth=obstacleMaxHealth(obstacle);
  if(!Number.isFinite(obstacle.health)) obstacle.health=obstacle.maxHealth;

  if(obstacle.type==="radarOutpost"){
    requestMissionOutpostDefense(obstacle);
  }
  obstacle.health=Math.max(0,obstacle.health-amount);
  if(obstacle.health>0) return false;

  return destroyWorldObstacle(obstacle);
}

function rockNearImpact(x,y,z,radius=4.5){
  if(!world || !world.collidersInRadius) return null;

  let candidates=world.collidersInRadius(x,z,radius);
  let best=null;
  let bestDistSq=Infinity;

  for(let obstacle of candidates){
    if(!obstacle || obstacle.destroyed) continue;
    if(obstacle.type!=="rock" && obstacle.type!=="smallRock") continue;

    let obstacleRadius=obstacle.visualRadius || obstacle.r || 0;
    let reach=radius+obstacleRadius;
    let dx=x-obstacle.x;
    let dz=z-obstacle.z;
    let distSq=dx*dx+dz*dz;
    if(distSq>reach*reach || distSq>=bestDistSq) continue;

    let baseY=Number.isFinite(obstacle.bottomY)
      ? obstacle.bottomY
      : Number.isFinite(obstacle.baseY)
      ? obstacle.baseY-Math.max(1.2,(obstacle.visualHeight || obstacle.height || obstacle.r || 2)*0.32)
      : groundHeight(obstacle.x,obstacle.z)-1.2;
    let topY=Number.isFinite(obstacle.topY)
      ? obstacle.topY
      : (Number.isFinite(obstacle.baseY) ? obstacle.baseY : groundHeight(obstacle.x,obstacle.z))
        +(obstacle.visualHeight || obstacle.height || obstacle.r || 2);
    if(Number.isFinite(y) && (y<baseY-3.5 || y>topY+radius+2.0)) continue;

    best=obstacle;
    bestDistSq=distSq;
  }

  return best;
}

function spawnBossBaseImpact(base,x,y,z,amount=1){
  let baseX=base ? base.x : 0;
  let baseY=base ? base.y : 0;
  let baseZ=base ? base.z : 0;
  let rawX=Number.isFinite(x) ? x : baseX;
  let rawY=Number.isFinite(y) ? y : baseY+24;
  let rawZ=Number.isFinite(z) ? z : baseZ;
  let dx=rawX-baseX;
  let dz=rawZ-baseZ;
  let dist=Math.hypot(dx,dz);
  let angle=dist>0.001 ? Math.atan2(dx,dz) : Math.random()*Math.PI*2;
  let shellRadius=base && base.r ? base.r*0.86 : 40;
  let hitX=base ? baseX+Math.sin(angle)*shellRadius : rawX;
  let hitY=base ? clamp(rawY,baseY+12,baseY+50) : rawY;
  let hitZ=base ? baseZ+Math.cos(angle)*shellRadius : rawZ;
  let strength=Math.max(1.15,Math.min(2.8,amount/10));

  let flash=new THREE.Mesh(explosionFlashGeo,explosionFlashMat.clone());
  flash.position.set(hitX,hitY,hitZ);
  flash.scale.setScalar(0.56*strength);
  flash.material.color.set(0xffe1a8);
  flash.material.depthTest=false;
  flash.renderOrder=28;
  scene.add(flash);

  let ring=new THREE.Mesh(explosionRingGeo,explosionRingMat.clone());
  ring.position.set(hitX,hitY+0.08,hitZ);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(1.4*strength);
  ring.material.color.set(0xb9f7ff);
  ring.material.depthTest=false;
  ring.renderOrder=29;
  scene.add(ring);

  explosionBursts.push({
    flash,
    ring,
    age:0,
    life:0.38+0.08*strength,
    startFlashScale:0.56*strength,
    endFlashScale:3.4*strength,
    startRingScale:1.4*strength,
    endRingScale:8.5*strength,
    flashOpacity:0.95,
    ringOpacity:0.9
  });

  let sparkCount=18+Math.floor(strength*8);
  for(let i=0;i<sparkCount;i++){
    let angle=Math.random()*Math.PI*2;
    let speed=2.2+Math.random()*6.2;
    dust.spawnThrusterParticle(
      hitX,
      hitY,
      hitZ,
      Math.cos(angle)*speed,
      Math.sin(angle)*speed,
      0.9+Math.random()*4.4,
      0.18+Math.random()*0.16,
      0.08+Math.random()*0.08
    );
  }

  if(base){
    base.impactPulse=Math.max(base.impactPulse || 0,1);
    base.reinforcementCooldown=Math.min(base.reinforcementCooldown || 0,60);
  }
}

function damageBossBaseObstacle(obstacle,x,y,z,amount){
  if(!obstacle || obstacle.type!=="bossBase") return false;
  let base=obstacle.base || obstacle;
  spawnBossBaseImpact(base,x,y,z,amount);
  requestBossBaseReinforcements(base,3);
  let hardenedDamage=Math.max(1,amount*bossBaseDamageMultiplier);
  let destroyed=world.damageBossBase(obstacle,hardenedDamage);

  if(destroyed){
    if(motorAudio.stopMusic) motorAudio.stopMusic();
    spawnBossBaseDebris(base);
    spawnRadiusExplosion(base.x,base.y+18,base.z,156);
    spawnRadiusExplosion(base.x,base.y+9,base.z,96,false);
    for(let i=0;i<18;i++){
      let angle=(i/18)*Math.PI*2+Math.random()*0.28;
      let dist=14+Math.random()*62;
      spawnRocketExplosion(
        base.x+Math.cos(angle)*dist,
        base.y+8+Math.random()*46,
        base.z+Math.sin(angle)*dist
      );
    }
    for(let i=0;i<72;i++){
      let angle=Math.random()*Math.PI*2;
      let dist=Math.random()*88;
      dust.spawnThrusterParticle(
        base.x+Math.cos(angle)*dist,
        base.y+4+Math.random()*52,
        base.z+Math.sin(angle)*dist,
        Math.cos(angle)*(3+Math.random()*10),
        Math.sin(angle)*(3+Math.random()*10),
        2.2+Math.random()*9,
        0.32+Math.random()*0.22,
        0.14+Math.random()*0.12
      );
    }
    addUnits(bossBaseUnitAmount);
    if(!advanceGeneratedPlanetMission("bossBase",1)){
      scheduleBossFinale(base,210);
    }
  }

  return true;
}

function spawnBuildingAmmoImpact(obstacle,x,y,z,amount=1){
  if(!obstacle || (obstacle.type!=="building" && obstacle.type!=="wall")) return;

  let baseY=Number.isFinite(obstacle.baseY) ? obstacle.baseY : groundHeight(obstacle.x,obstacle.z);
  let hitX=Number.isFinite(x) ? x : obstacle.x;
  let hitY=Number.isFinite(y) ? y : baseY+Math.max(2,(obstacle.visualHeight || obstacle.height || 8)*0.45);
  let hitZ=Number.isFinite(z) ? z : obstacle.z;
  let dx=hitX-obstacle.x;
  let dz=hitZ-obstacle.z;
  let dist=Math.hypot(dx,dz);
  if(dist>0.001){
    let shellRadius=Math.max(2.6,(obstacle.visualRadius || obstacle.r || 5)*0.92);
    hitX=obstacle.x+(dx/dist)*shellRadius;
    hitZ=obstacle.z+(dz/dist)*shellRadius;
  }
  let maxY=baseY+(obstacle.visualHeight || obstacle.height || Math.max(5,obstacle.r || 5));
  hitY=clamp(hitY,baseY+1.2,maxY+0.8);
  let strength=Math.max(0.7,Math.min(1.8,amount/12));

  let flash=new THREE.Mesh(explosionFlashGeo,explosionFlashMat.clone());
  flash.position.set(hitX,hitY,hitZ);
  flash.scale.setScalar(0.24*strength);
  flash.material.color.set(0xffd09a);
  flash.material.depthTest=false;
  flash.renderOrder=26;
  scene.add(flash);

  let ring=new THREE.Mesh(teleportRingGeo,explosionRingMat.clone());
  ring.position.set(hitX,hitY+0.05,hitZ);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(0.62*strength);
  ring.material.color.set(0x9fd8ff);
  ring.material.depthTest=false;
  ring.renderOrder=27;
  scene.add(ring);

  explosionBursts.push({
    flash,
    ring,
    age:0,
    life:0.28+0.05*strength,
    startFlashScale:0.24*strength,
    endFlashScale:1.35*strength,
    startRingScale:0.62*strength,
    endRingScale:3.2*strength,
    flashOpacity:0.72,
    ringOpacity:0.58
  });

  for(let i=0;i<9+Math.floor(strength*5);i++){
    let angle=Math.random()*Math.PI*2;
    let speed=1.1+Math.random()*3.4;
    dust.spawnThrusterParticle(
      hitX,
      hitY,
      hitZ,
      Math.cos(angle)*speed,
      Math.sin(angle)*speed,
      0.45+Math.random()*2.4,
      0.14+Math.random()*0.12,
      0.045+Math.random()*0.055
    );
  }
}

function damageEnemy(enemy,amount,options={}){
  if(!enemy.active || enemy.health<=0) return;
  enemy.health=Math.max(0,enemy.health-amount);
  enemy.hitRattle=Math.max(enemy.hitRattle,0.75);
  enemy.hitRattleSeed=Math.random()*Math.PI*2;

  if(enemy.health<=0){
    enemy.active=false;
    enemy.group.visible=false;
    if(enemy.shadow){
      enemy.shadow.dispose();
      enemy.shadow=null;
    }
    scene.remove(enemy.group);
    if(!options.skipUnitReward) addUnits(enemyUnitReward(enemy));
    if(!options.skipUnitReward) advanceGeneratedPlanetMission("enemy",1);
    spawnRocketExplosion(enemy.x,enemy.y+(enemy.isGiant ? 5.8 : 2.2),enemy.z);
  }
}

function damageActor(actor,amount,hitPoint=null){
  if(actor.isEnemy) damageEnemy(actor,amount);
  else damageCar(actor,amount,hitPoint);
}

function rattleActor(actor,amount=1){
  if(!actor || actor.health<=0) return;
  actor.hitRattle=Math.max(actor.hitRattle,amount);
  actor.hitRattleSeed=Math.random()*Math.PI*2;
}

function landingDamageAmount(car,x,z,impactSpeed){
  let front=terrainHeightAt(x+Math.sin(car.velAngle)*3,z+Math.cos(car.velAngle)*3);
  let back=terrainHeightAt(x-Math.sin(car.velAngle)*3,z-Math.cos(car.velAngle)*3);
  let side=terrainHeightAt(x+Math.cos(car.velAngle)*2.2,z-Math.sin(car.velAngle)*2.2);
  let roughness=Math.max(Math.abs(front-back),Math.abs(side-terrainHeightAt(x,z)));
  let impactDamage=Math.max(0,impactSpeed-1.05)*7;
  let roughDamage=Math.max(0,roughness-2.0)*1.4;
  return Math.min(12,Math.round(impactDamage+roughDamage));
}

function controlsFor(car){
  let forward=0;
  let turn=0;
  let lift=0;
  let keyboardForward=0;

  if(!gameOver && !terminalOverlayOpen()){
    if(input.keys[car.controls.up]) keyboardForward=1;
    if(input.keys[car.controls.down]) keyboardForward=-1;
    forward=keyboardForward;
    if(input.keys[car.controls.left]) turn=1;
    if(input.keys[car.controls.right]) turn=-1;

    let gamepadControls=input.getGamepadControls(car.gamepadIndex);
    let jetControls=car.jetMode || car.jetProgress>0.35;
    let gamepadForward=jetControls
      ? Math.min(gamepadControls.dpadForward,gamepadControls.lift,0)
      : gamepadControls.forward;
    if(Math.abs(gamepadForward)>Math.abs(forward)){
      forward=gamepadForward;
    }
    if(Math.abs(gamepadControls.turn)>Math.abs(turn)){
      turn=-gamepadControls.turn;
    }
    let keyboardLift=jetControls ? keyboardForward : 0;
    lift=Math.abs(gamepadControls.lift)>Math.abs(keyboardLift) ? gamepadControls.lift : keyboardLift;
  }

  return {forward,turn,lift};
}

function collidesWithOtherCars(car,nextX,nextZ){
  for(let other of combatActors()){
    if(other===car) continue;
    if(!other.active && other.isEnemy) continue;
    if(playerInvisibleToEnemies(car) && other.isEnemy) continue;
    if(car.isEnemy && playerInvisibleToEnemies(other)) continue;
    let dx=nextX-other.x;
    let dz=nextZ-other.z;
    let minGap=(car.collisionRadius || 1.8)+(other.collisionRadius || 1.8);
    if(dx*dx+dz*dz<minGap*minGap) return other;
  }
  return null;
}

function activeTradingOutpostCollisions(){
  return [
    tradingOutpostCollision,
    ...tradingPlaceCollisions
  ].filter(collision=>collision && (!collision.object || collision.object.parent));
}

function worldToTradingOutpostLocal(x,z,collision=tradingOutpostCollision){
  if(!collision) return null;
  let dx=x-collision.x;
  let dz=z-collision.z;
  let c=Math.cos(collision.angle);
  let s=Math.sin(collision.angle);
  return {
    x:dx*c-dz*s,
    z:dx*s+dz*c
  };
}

function tradingOutpostLocalToWorld(local,collision=tradingOutpostCollision){
  if(!local || !collision) return null;

  let c=Math.cos(collision.angle);
  let s=Math.sin(collision.angle);
  return {
    x:collision.x+local.x*c+local.z*s,
    z:collision.z-local.x*s+local.z*c
  };
}

function tradingOutpostLocalVectorToWorld(localX,localZ,collision=tradingOutpostCollision){
  if(!collision) return {x:0,z:0};

  let c=Math.cos(collision.angle);
  let s=Math.sin(collision.angle);
  return {
    x:localX*c+localZ*s,
    z:-localX*s+localZ*c
  };
}

function tradingOutpostTerminalLocalInfo(bounds={}){
  let floorMinZ=Number.isFinite(bounds.floorMinZ) ? bounds.floorMinZ : -18;
  let floorMaxZ=Number.isFinite(bounds.floorMaxZ) ? bounds.floorMaxZ : 18;
  let floorMinX=Number.isFinite(bounds.floorMinX) ? bounds.floorMinX : -20;
  let floorMaxX=Number.isFinite(bounds.floorMaxX) ? bounds.floorMaxX : 20;
  let usableHalfX=Math.max(10,Math.min(Math.abs(floorMinX),Math.abs(floorMaxX)));
  let depth=Math.max(16,floorMaxZ-floorMinZ);
  let terminalStandOff=Math.min(18,Math.max(12,depth*0.28));
  let terminalInset=Number.isFinite(bounds.terminalInset) ? bounds.terminalInset : null;

  return {
    x:Math.min(usableHalfX-7,Math.max(-usableHalfX+7,-usableHalfX*0.36)),
    z:Number.isFinite(terminalInset)
      ? Math.min(floorMaxZ-10,floorMinZ+terminalInset)
      : floorMinZ-terminalStandOff,
    halfX:3.9,
    halfZ:3.1,
    interactionRadius:42
  };
}

function tradingTerminalViolation(local,actorRadius=0,collision=tradingOutpostCollision){
  let terminal=collision && collision.terminal;
  if(!terminal || !local) return 0;

  let dx=Math.abs(local.x-terminal.x)-(terminal.halfX+actorRadius);
  let dz=Math.abs(local.z-terminal.z)-(terminal.halfZ+actorRadius);
  if(dx>=0 || dz>=0) return 0;
  return Math.min(-dx,-dz);
}

function carNearTradingTerminal(car,collision=tradingOutpostCollision){
  let terminal=collision && collision.terminal;
  if(!terminal || !collision || !car || !car.group.visible || car.health<=0) return false;

  let local=worldToTradingOutpostLocal(car.x,car.z,collision);
  let dx=local.x-terminal.x;
  let dz=local.z-terminal.z;
  let radius=terminal.interactionRadius+(car.collisionRadius || 2.35);
  return dx*dx+dz*dz<=radius*radius;
}

function setTerminalFocusRayForCar(car){
  if(!car || !car.camera) return false;

  terminalFocusRaycaster.near=0;
  terminalFocusRaycaster.far=110;

  if(gameMode==="single" && car===playerCar && car.hasMouseAimPoint && input.mouse.hasPosition){
    let rect=renderer.domElement.getBoundingClientRect();
    let pointerX=clamp(input.mouse.x-rect.left,0,Math.max(1,rect.width));
    let pointerY=clamp(input.mouse.y-rect.top,0,Math.max(1,rect.height));
    terminalFocusPointer.set(
      (pointerX/Math.max(1,rect.width))*2-1,
      -(pointerY/Math.max(1,rect.height))*2+1
    );
    terminalFocusRaycaster.setFromCamera(terminalFocusPointer,car.camera);
    return true;
  }

  let aimDisplayDistance=car.aimDistance || 32;
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);

  terminalFocusOrigin.set(car.x,car.y+2.6,car.z);
  terminalFocusWorldPoint.set(
    car.x+forwardX*aimDisplayDistance+rightX*(car.aimOffsetX || 0),
    car.y+3.15+(car.aimOffsetY || 0),
    car.z+forwardZ*aimDisplayDistance+rightZ*(car.aimOffsetX || 0)
  );
  terminalFocusDirection.copy(terminalFocusWorldPoint).sub(terminalFocusOrigin);
  if(terminalFocusDirection.lengthSq()<0.001) return false;

  terminalFocusDirection.normalize();
  terminalFocusRaycaster.ray.origin.copy(terminalFocusOrigin);
  terminalFocusRaycaster.ray.direction.copy(terminalFocusDirection);
  return true;
}

function carAimFocusesTradingTerminal(car,collision){
  let terminal=collision && collision.terminal;
  if(!terminal) return false;
  if(!car || !isPlayerActor(car) || !car.group || !car.group.visible || car.health<=0) return false;
  if(!car.aimCross || car.jetMode || car.jetProgress>0.35) return false;

  if(collision.terminalObject && setTerminalFocusRayForCar(car)){
    let hits=terminalFocusRaycaster.intersectObject(collision.terminalObject,true);
    if(hits.length) return true;

    terminalFocusWorldPoint.copy(terminalFocusRaycaster.ray.direction)
      .multiplyScalar(terminalFocusRaycaster.far)
      .add(terminalFocusRaycaster.ray.origin);
    let rayStartLocal=worldToTradingOutpostLocal(
      terminalFocusRaycaster.ray.origin.x,
      terminalFocusRaycaster.ray.origin.z,
      collision
    );
    let rayEndLocal=worldToTradingOutpostLocal(
      terminalFocusWorldPoint.x,
      terminalFocusWorldPoint.z,
      collision
    );
    if(rayStartLocal && rayEndLocal){
      let focusReach=Math.max(terminal.halfX,terminal.halfZ)+5;
      let rayDistanceSq=distanceSqToLocalSegment(
        terminal.x,
        terminal.z,
        rayStartLocal.x,
        rayStartLocal.z,
        rayEndLocal.x,
        rayEndLocal.z
      );
      if(rayDistanceSq<=focusReach*focusReach) return true;
    }
  }

  let aimDisplayDistance=car.aimDistance || 32;
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);
  let aimX=car.x+forwardX*aimDisplayDistance+rightX*(car.aimOffsetX || 0);
  let aimZ=car.z+forwardZ*aimDisplayDistance+rightZ*(car.aimOffsetX || 0);
  let focusPadding=3.5;

  let local=worldToTradingOutpostLocal(aimX,aimZ,collision);
  if(!local) return false;

  let dx=Math.abs(local.x-terminal.x)-(terminal.halfX+focusPadding);
  let dz=Math.abs(local.z-terminal.z)-(terminal.halfZ+focusPadding);
  return dx<0 && dz<0;
}

function playerAimingAtTradingTerminal(car){
  for(let collision of activeTradingOutpostCollisions()){
    if(carAimFocusesTradingTerminal(car,collision)) return true;
  }

  return false;
}

function actorInsideBuilding(actor){
  if(!actor) return false;

  for(let collision of activeTradingOutpostCollisions()){
    let local=worldToTradingOutpostLocal(actor.x,actor.z,collision);
    if(!insideTradingOutpostFloor(local,0.35,collision)) continue;

    let surfaceY=collision.y+(collision.floor ? collision.floor.y : 0);
    if(actor.y<=surfaceY+8.5) return true;
  }

  return false;
}

function actorInsideHomeBase(actor){
  if(!actor || !tradingOutpostCollision || tradingOutpostCollision.terminalMode!=="mission") return false;

  let local=worldToTradingOutpostLocal(actor.x,actor.z,tradingOutpostCollision);
  if(!insideTradingOutpostFloor(local,0.35,tradingOutpostCollision)) return false;

  let surfaceY=tradingOutpostCollision.y+(tradingOutpostCollision.floor ? tradingOutpostCollision.floor.y : 0);
  return actor.y<=surfaceY+8.5;
}

function clickViewportForTradingTerminal(event){
  let rect=renderer.domElement.getBoundingClientRect();
  let pointerX=input.mouse.locked ? input.mouse.x : event.clientX;
  let pointerY=input.mouse.locked ? input.mouse.y : event.clientY;
  let x=clamp(pointerX-rect.left,0,Math.max(1,rect.width));
  let y=clamp(pointerY-rect.top,0,Math.max(1,rect.height));

  if(gameMode==="double"){
    let halfWidth=rect.width*0.5;
    let carsForView=displayCars();
    if(x<halfWidth){
      return {
        car:carsForView[0],
        nx:(x/Math.max(1,halfWidth))*2-1,
        ny:-(y/Math.max(1,rect.height))*2+1
      };
    }

    return {
      car:carsForView[1],
      nx:((x-halfWidth)/Math.max(1,rect.width-halfWidth))*2-1,
      ny:-(y/Math.max(1,rect.height))*2+1
    };
  }

  return {
    car:playerCar,
    nx:(x/Math.max(1,rect.width))*2-1,
    ny:-(y/Math.max(1,rect.height))*2+1
  };
}

function handleTradingTerminalClick(event){
  if(!gameStarted || gamePaused || gameOver || terminalOverlayOpen()) return false;

  let view=clickViewportForTradingTerminal(event);
  if(!view.car) return false;

  terminalClickPointer.set(view.nx,view.ny);
  terminalClickRaycaster.setFromCamera(terminalClickPointer,view.car.camera);
  terminalClickRaycaster.far=80;

  for(let collision of activeTradingOutpostCollisions()){
    if(!collision.terminalObject || !carNearTradingTerminal(view.car,collision)) continue;

    let hits=terminalClickRaycaster.intersectObject(collision.terminalObject,true);
    if(!hits.length) continue;

    event.preventDefault();
    event.stopPropagation();
    openTerminalScreen(collision);
    return true;
  }

  return false;
}

function openFocusedTradingTerminalForCar(car){
  if(!gameStarted || gamePaused || gameOver || terminalOverlayOpen()) return false;
  if(!car || !car.group || !car.group.visible || car.health<=0) return false;

  for(let collision of activeTradingOutpostCollisions()){
    if(!collision.terminalObject) continue;
    if(!carNearTradingTerminal(car,collision)) continue;
    if(!carAimFocusesTradingTerminal(car,collision)) continue;

    openTerminalScreen(collision);
    return true;
  }

  return false;
}

function openTerminalScreen(collision){
  if(motorAudio.playTerminalBleep) motorAudio.playTerminalBleep();
  if(collision && collision.terminalMode==="mission") setMissionScreenOpen(true);
  else setTradingScreenOpen(true);
}

function distanceSqToLocalSegment(px,pz,ax,az,bx,bz){
  let sx=bx-ax;
  let sz=bz-az;
  let lenSq=sx*sx+sz*sz;
  let t=lenSq>0.0001 ? ((px-ax)*sx+(pz-az)*sz)/lenSq : 0;
  t=Math.max(0,Math.min(1,t));
  let cx=ax+sx*t;
  let cz=az+sz*t;
  let dx=px-cx;
  let dz=pz-cz;
  return dx*dx+dz*dz;
}

function tradingOutpostRoomViolation(local,actorRadius,collision=tradingOutpostCollision){
  let room=collision && collision.room;
  if(!room || !local) return 0;

  let padding=actorRadius+room.wallRadius;
  let leftLimit=room.left+padding;
  let rightLimit=room.right-padding;
  let backLimit=room.back+padding;
  let frontLimit=room.front-padding;
  let doorwayHalfWidth=Math.max(0,room.entranceHalfWidth-actorRadius);
  let inDoorway=Math.abs(local.x)<=doorwayHalfWidth;

  return Math.max(
    0,
    leftLimit-local.x,
    local.x-rightLimit,
    backLimit-local.z,
    inDoorway ? 0 : local.z-frontLimit
  );
}

function localPointInsideShell(local,shell,padding=0){
  if(!local || !shell) return false;
  return local.x>=shell.left-padding
    && local.x<=shell.right+padding
    && local.z>=shell.back-padding
    && local.z<=shell.front+padding;
}

function shellCrossings(fromLocal,local,shell,padding=0){
  if(!fromLocal || !local || !shell) return [];

  let left=shell.left-padding;
  let right=shell.right+padding;
  let back=shell.back-padding;
  let front=shell.front+padding;
  let dx=local.x-fromLocal.x;
  let dz=local.z-fromLocal.z;
  let crossings=[];

  function addCrossing(side,t,crossX,crossZ){
    if(t<=0 || t>1) return;
    if(crossX<left-0.001 || crossX>right+0.001 || crossZ<back-0.001 || crossZ>front+0.001) return;
    crossings.push({side,t,x:crossX,z:crossZ});
  }

  if(Math.abs(dx)>0.0001){
    let t=(left-fromLocal.x)/dx;
    addCrossing("left",t,left,fromLocal.z+dz*t);
    t=(right-fromLocal.x)/dx;
    addCrossing("right",t,right,fromLocal.z+dz*t);
  }
  if(Math.abs(dz)>0.0001){
    let t=(back-fromLocal.z)/dz;
    addCrossing("back",t,fromLocal.x+dx*t,back);
    t=(front-fromLocal.z)/dz;
    addCrossing("front",t,fromLocal.x+dx*t,front);
  }

  crossings.sort((a,b)=>a.t-b.t);
  return crossings;
}

function collidesWithTradingOutpostShell(actor,local,fromLocal,collision=tradingOutpostCollision){
  let shell=collision && collision.solidShell;
  if(!shell || !local || !fromLocal) return false;
  if(actorCanClearTradingOutpostCollision(actor,collision)) return false;

  let actorRadius=actor && Number.isFinite(actor.collisionRadius)
    ? actor.collisionRadius
    : 2.35;
  let fromInside=localPointInsideShell(fromLocal,shell);
  let toInside=localPointInsideShell(local,shell);
  if(fromInside===toInside) return false;

  let doorwayHalfWidth=Math.max(0,shell.entranceHalfWidth-actorRadius*0.65);
  for(let crossing of shellCrossings(fromLocal,local,shell)){
    let throughEntrance=crossing.side==="front" && Math.abs(crossing.x)<=doorwayHalfWidth;
    if(!throughEntrance) return true;
  }

  return false;
}

function actorCanClearTradingOutpostCollision(actor,collision=tradingOutpostCollision){
  if(!actor || !collision) return false;
  let bounds=actorObstacleVerticalBounds(actor);
  if(!bounds) return false;
  let baseY=Number.isFinite(collision.y) ? collision.y : 0;
  let wallTop=baseY+12.5;
  return bounds.bottom>wallTop+0.25;
}

function insideTradingOutpostFloor(local,margin=0.5,collision=tradingOutpostCollision){
  let floor=collision && collision.floor;
  if(!floor || !local) return false;
  return local.x>=floor.minX-margin
    && local.x<=floor.maxX+margin
    && local.z>=floor.minZ-margin
    && local.z<=floor.maxZ+margin;
}

function localRectContainmentDepth(local,rect,padding=0){
  if(!local || !rect) return 0;

  let minX=rect.minX-padding;
  let maxX=rect.maxX+padding;
  let minZ=rect.minZ-padding;
  let maxZ=rect.maxZ+padding;
  if(local.x<minX || local.x>maxX || local.z<minZ || local.z>maxZ) return 0;

  return Math.min(local.x-minX,maxX-local.x,local.z-minZ,maxZ-local.z);
}

function collidesWithTradingOutpostFootprint(actor,x,z,fromX=null,fromZ=null,collision=tradingOutpostCollision){
  let floor=collision && collision.floor;
  if(!floor) return false;
  if(actorCanClearTradingOutpostCollision(actor,collision)) return false;

  let actorRadius=actor && Number.isFinite(actor.collisionRadius)
    ? actor.collisionRadius
    : 2.35;
  let local=worldToTradingOutpostLocal(x,z,collision);
  let depth=localRectContainmentDepth(local,floor,actorRadius);
  if(depth<=0) return false;

  let fromLocal=Number.isFinite(fromX) && Number.isFinite(fromZ)
    ? worldToTradingOutpostLocal(fromX,fromZ,collision)
    : null;
  let fromDepth=localRectContainmentDepth(fromLocal,floor,actorRadius);
  return !fromLocal || fromDepth<=0 || depth>fromDepth+0.03;
}

function collidesWithTradingOutpostWalls(actor,x,z,fromX=null,fromZ=null){
  for(let collision of activeTradingOutpostCollisions()){
    if(collidesWithSingleTradingOutpost(actor,x,z,fromX,fromZ,collision)) return true;
  }

  return false;
}

function collidesWithSingleTradingOutpost(actor,x,z,fromX=null,fromZ=null,collision=tradingOutpostCollision){
  if(!collision) return false;
  if(actorCanClearTradingOutpostCollision(actor,collision)) return false;
  if(actor && actor.blocksTradingOutpostFootprint && collidesWithTradingOutpostFootprint(actor,x,z,fromX,fromZ,collision)) return true;

  let local=worldToTradingOutpostLocal(x,z,collision);
  if(!local) return false;

  let actorRadius=actor && Number.isFinite(actor.collisionRadius)
    ? actor.collisionRadius
    : 2.35;
  let fromLocal=Number.isFinite(fromX) && Number.isFinite(fromZ)
    ? worldToTradingOutpostLocal(fromX,fromZ,collision)
    : null;
  if(collidesWithTradingOutpostShell(actor,local,fromLocal,collision)) return true;

  let useRoomBoundary=insideTradingOutpostFloor(local,0.5,collision) || insideTradingOutpostFloor(fromLocal,0.5,collision);
  let roomViolation=useRoomBoundary ? tradingOutpostRoomViolation(local,actorRadius,collision) : 0;
  if(roomViolation>0){
    let fromViolation=tradingOutpostRoomViolation(fromLocal,actorRadius,collision);
    if(roomViolation>fromViolation+0.03) return true;
  }

  let terminalViolation=tradingTerminalViolation(local,actorRadius,collision);
  if(terminalViolation>0){
    let fromViolation=tradingTerminalViolation(fromLocal,actorRadius,collision);
    if(fromViolation<=0 || terminalViolation>fromViolation+0.03) return true;
  }

  for(let wall of collision.walls){
    if(wall.kind==="rect"){
      let depth=localRectContainmentDepth(local,wall,actorRadius);
      if(depth>0){
        let fromDepth=localRectContainmentDepth(fromLocal,wall,actorRadius);
        if(fromDepth<=0 || depth>fromDepth+0.03) return true;
      }
      continue;
    }

    let radius=wall.r+actorRadius;
    let distanceSq=distanceSqToLocalSegment(local.x,local.z,wall.ax,wall.az,wall.bx,wall.bz);
    let radiusSq=radius*radius;
    if(distanceSq<radiusSq){
      let fromDistanceSq=fromLocal
        ? distanceSqToLocalSegment(fromLocal.x,fromLocal.z,wall.ax,wall.az,wall.bx,wall.bz)
        : Infinity;
      if(fromDistanceSq<radiusSq && distanceSq>=fromDistanceSq-0.03) continue;
      return true;
    }
  }

  return false;
}

function collidesWithLandingPad(actor,x,z,fromX=null,fromZ=null){
  if(!world || !world.landingSurfaceAt) return false;

  let surface=world.landingSurfaceAt(x,z,true);
  if(!surface) return false;
  let actorBounds=actorObstacleVerticalBounds(actor,x,z);
  if(actorBounds && actorBounds.bottom>surface.y+4.2) return false;

  let actorRadius=actor && Number.isFinite(actor.collisionRadius)
    ? actor.collisionRadius
    : 2.35;
  let radius=(surface.padR || surface.r || 0)+actorRadius;
  let dx=x-surface.x;
  let dz=z-surface.z;
  let distSq=dx*dx+dz*dz;
  if(distSq>=radius*radius) return false;

  let fromSurface=Number.isFinite(fromX) && Number.isFinite(fromZ)
    ? world.landingSurfaceAt(fromX,fromZ,true)
    : null;
  if(fromSurface!==surface) return true;

  let fromDx=fromX-surface.x;
  let fromDz=fromZ-surface.z;
  let fromDistSq=fromDx*fromDx+fromDz*fromDz;
  return distSq<fromDistSq-0.03;
}

function obstacleCollisionDamagesPlayer(obstacle){
  if(!obstacle) return true;
  return obstacle.type!=="building"
    && obstacle.type!=="wall"
    && obstacle.type!=="rock"
    && obstacle.type!=="smallRock";
}

function movementCollision(car,fromX,fromZ,toX,toZ){
  let dx=toX-fromX;
  let dz=toZ-fromZ;
  let distance=Math.hypot(dx,dz);
  let steps=Math.max(1,Math.min(24,Math.ceil(distance/0.45)));
  let safeX=fromX;
  let safeZ=fromZ;
  let obstacleRadius=actorObstacleRadius(car);
  let fromActorBounds=actorObstacleVerticalBounds(car,fromX,fromZ);
  let startingOverlap=world.obstacleCollisionInfo
    ? world.obstacleCollisionInfo(fromX,fromZ,obstacleRadius,fromActorBounds)
    : null;

  if(startingOverlap && startingOverlap.overlap>0.01){
    let awayX=startingOverlap.dx;
    let awayZ=startingOverlap.dz;
    let awayLen=Math.hypot(awayX,awayZ);
    if(awayLen<0.001){
      awayX=distance>0.001 ? -dx : -Math.sin(car.angle || 0);
      awayZ=distance>0.001 ? -dz : -Math.cos(car.angle || 0);
      awayLen=Math.max(0.001,Math.hypot(awayX,awayZ));
    }

    let push=startingOverlap.overlap+0.18;
    return {
      hit:true,
      otherCar:null,
      obstacle:startingOverlap.obstacle,
      damagesPlayer:false,
      safeX:fromX+(awayX/awayLen)*push,
      safeZ:fromZ+(awayZ/awayLen)*push
    };
  }

  for(let i=1;i<=steps;i++){
    let t=i/steps;
    let x=fromX+dx*t;
    let z=fromZ+dz*t;
    let actorBounds=actorObstacleVerticalBounds(car,x,z);
    let otherCar=collidesWithOtherCars(car,x,z);
    let obstacleInfo=world.obstacleCollisionInfo
      ? world.obstacleCollisionInfo(x,z,obstacleRadius,actorBounds)
      : null;
    let obstacleCollision=!!obstacleInfo;
    let obstacle=obstacleInfo && obstacleInfo.obstacle
      ? obstacleInfo.obstacle
      : obstacleCollision && world.obstacleAt
      ? world.obstacleAt(x,z,obstacleRadius,actorBounds)
      : null;
    let tradingCollision=collidesWithTradingOutpostWalls(car,x,z,safeX,safeZ);
    let landingCollision=collidesWithLandingPad(car,x,z,safeX,safeZ);

    if(obstacleCollision || tradingCollision || landingCollision || otherCar){
      return {
        hit:true,
        otherCar,
        obstacle,
        damagesPlayer:!!otherCar || (obstacleCollision && obstacleCollisionDamagesPlayer(obstacle)),
        safeX,
        safeZ
      };
    }

    safeX=x;
    safeZ=z;
  }

  return {hit:false,otherCar:null,obstacle:null,damagesPlayer:false,safeX:toX,safeZ:toZ};
}

function terrainCollisionAlongSegment(fromX,fromY,fromZ,toX,toY,toZ,clearance=1.15){
  let dx=toX-fromX;
  let dy=toY-fromY;
  let dz=toZ-fromZ;
  let distance=Math.max(Math.hypot(dx,dz),Math.abs(dy));
  let steps=Math.max(1,Math.min(32,Math.ceil(distance/0.45)));
  let safeX=fromX;
  let safeY=fromY;
  let safeZ=fromZ;

  for(let i=1;i<=steps;i++){
    let t=i/steps;
    let x=fromX+dx*t;
    let y=fromY+dy*t;
    let z=fromZ+dz*t;
    let surfaceY=drivingSurfaceHeight(x,z);

    if(y<=surfaceY+clearance){
      return {hit:true,safeX,safeY,safeZ,surfaceY};
    }

    safeX=x;
    safeY=y;
    safeZ=z;
  }

  return {hit:false,safeX:toX,safeY:toY,safeZ:toZ,surfaceY:drivingSurfaceHeight(toX,toZ)};
}

function makeRocketMesh(){
  let group=new THREE.Group();

  let body=new THREE.Mesh(rocketBodyGeo,rocketBodyMat);
  body.rotation.x=Math.PI/2;
  group.add(body);

  let nose=new THREE.Mesh(rocketNoseGeo,rocketNoseMat);
  nose.rotation.x=Math.PI/2;
  nose.position.z=0.55;
  group.add(nose);

  let flame=new THREE.Mesh(rocketNoseGeo,rocketFlameMat);
  flame.rotation.x=-Math.PI/2;
  flame.position.z=-0.55;
  flame.scale.set(0.72,0.72,0.72);
  group.add(flame);

  for(let side of [-1,1]){
    let fin=new THREE.Mesh(rocketFinGeo,rocketNoseMat);
    fin.position.set(side*0.16,-0.02,-0.26);
    fin.rotation.z=side*0.2;
    group.add(fin);
  }

  group.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
    }
  });

  return group;
}

function makeAmbientSpaceshipMesh(){
  let group=new THREE.Group();

  let body=new THREE.Mesh(ambientSpaceshipBodyGeo,ambientSpaceshipBodyMat);
  body.rotation.x=Math.PI/2;
  group.add(body);

  let nose=new THREE.Mesh(ambientSpaceshipNoseGeo,ambientSpaceshipWingMat);
  nose.rotation.x=Math.PI/2;
  nose.position.z=3.08;
  group.add(nose);

  for(let side of [-1,1]){
    let wing=new THREE.Mesh(ambientSpaceshipWingGeo,ambientSpaceshipWingMat);
    wing.position.set(side*1.72,-0.06,-0.55);
    wing.rotation.z=side*0.12;
    group.add(wing);

    let fin=new THREE.Mesh(ambientSpaceshipFinGeo,ambientSpaceshipBodyMat);
    fin.position.set(side*0.58,0.45,-2.05);
    fin.rotation.z=side*0.18;
    group.add(fin);
  }

  let engine=new THREE.Mesh(ambientSpaceshipEngineGeo,ambientSpaceshipEngineMat);
  engine.position.z=-2.72;
  engine.scale.set(1.25,1.25,1.8);
  group.add(engine);

  let trail=new THREE.Mesh(ambientSpaceshipTrailGeo,ambientSpaceshipTrailMat);
  trail.rotation.x=Math.PI/2;
  trail.position.z=-31;
  trail.renderOrder=2;
  group.add(trail);

  group.userData.engine=engine;
  group.userData.trail=trail;
  return group;
}

function ambientSpaceshipCenter(){
  let players=activeCars().filter(car=>car && car.group && car.group.visible && car.health>0);
  if(players.length===0) players=[playerCar];

  let x=0,z=0;
  for(let car of players){
    x+=car.x;
    z+=car.z;
  }

  return {x:x/players.length,z:z/players.length};
}

function scheduleNextAmbientSpaceship(){
  ambientSpaceshipCooldown=620+Math.floor(Math.random()*980);
}

function spawnAmbientSpaceshipAlongPath(startX,startZ,endX,endZ,options={}){
  if(ambientSpaceships.length>=ambientSpaceshipMaxActive) return false;

  let dx=endX-startX;
  let dz=endZ-startZ;
  let distance=Math.max(1,Math.hypot(dx,dz));
  let speed=options.speed || (5.1+Math.random()*2.2);
  let altitude=options.altitude || (190+Math.random()*115);
  let referenceX=Number.isFinite(options.referenceX) ? options.referenceX : (startX+endX)*0.5;
  let referenceZ=Number.isFinite(options.referenceZ) ? options.referenceZ : (startZ+endZ)*0.5;
  let y=Math.max(drivingSurfaceHeight(startX,startZ),drivingSurfaceHeight(referenceX,referenceZ))+altitude;

  let mesh=makeAmbientSpaceshipMesh();
  let scale=options.scale || (2.35+Math.random()*1.15);
  mesh.scale.setScalar(scale);
  mesh.position.set(startX,y,startZ);
  mesh.rotation.y=Math.atan2(dx,dz);
  mesh.rotation.z=(Math.random()-0.5)*0.08;
  scene.add(mesh);

  let sound=motorAudio && motorAudio.startAmbientSpaceshipFlyover
    ? motorAudio.startAmbientSpaceshipFlyover({x:startX,y,z:startZ},{
      gain:options.soundGain ?? 0.06,
      volume:options.soundVolume ?? 0.52
    })
    : null;

  ambientSpaceships.push({
    mesh,
    sound,
    x:startX,
    y,
    z:startZ,
    vx:(dx/distance)*speed,
    vz:(dz/distance)*speed,
    endX,
    endZ,
    startX,
    startZ,
    pathDistance:distance,
    age:0,
    life:Math.ceil(distance/speed)+90,
    altitude,
    phase:Math.random()*Math.PI*2,
    trailEvery:options.trailEvery || (3+Math.floor(Math.random()*2))
  });

  return true;
}

function spawnAmbientSpaceship(){
  if(ambientSpaceships.length>=ambientSpaceshipMaxActive) return false;

  let center=ambientSpaceshipCenter();
  let angle=Math.random()*Math.PI*2;
  let dirX=Math.sin(angle);
  let dirZ=Math.cos(angle);
  let rightX=Math.cos(angle);
  let rightZ=-Math.sin(angle);
  let halfRun=2100+Math.random()*1250;
  let lateral=(Math.random()-0.5)*1050;
  let startX=center.x-dirX*halfRun+rightX*lateral;
  let startZ=center.z-dirZ*halfRun+rightZ*lateral;
  let drift=(Math.random()-0.5)*560;
  let endX=center.x+dirX*halfRun+rightX*(lateral+drift);
  let endZ=center.z+dirZ*halfRun+rightZ*(lateral+drift);

  return spawnAmbientSpaceshipAlongPath(startX,startZ,endX,endZ,{
    referenceX:center.x,
    referenceZ:center.z
  });
}

function spawnTestingAmbientSpaceshipFormationOverHomeBase(){
  if(!testingAmbientSpaceshipFormationAtStart || ambientStartFormationSpawned || !gameStarted || !tradingOutpost) return;

  if(ambientSpaceships.length>0) clearAmbientSpaceships();
  ambientStartFormationSpawned=true;
  let homeX=tradingOutpost.position.x;
  let homeZ=tradingOutpost.position.z;
  let angle=tradingOutpost.rotation.y || 0;
  let dirX=Math.sin(angle);
  let dirZ=Math.cos(angle);
  let rightX=Math.cos(angle);
  let rightZ=-Math.sin(angle);
  let startDistance=760;
  let endDistance=2300;
  let altitude=220;
  let speed=4.0;
  let formation=[
    {side:-34,back:0,scale:3.05},
    {side:34,back:-56,scale:2.9}
  ];

  for(let ship of formation){
    let startX=homeX-dirX*(startDistance-ship.back)+rightX*ship.side;
    let startZ=homeZ-dirZ*(startDistance-ship.back)+rightZ*ship.side;
    let endX=homeX+dirX*endDistance+rightX*ship.side;
    let endZ=homeZ+dirZ*endDistance+rightZ*ship.side;
    spawnAmbientSpaceshipAlongPath(startX,startZ,endX,endZ,{
      referenceX:homeX,
      referenceZ:homeZ,
      altitude,
      speed,
      scale:ship.scale,
      trailEvery:2
    });
  }

  ambientSpaceshipCooldown=1300+Math.floor(Math.random()*700);
}

function scheduleTestingAmbientSpaceshipFormationOverHomeBase(){
  if(!testingAmbientSpaceshipFormationAtStart || ambientStartFormationSpawned || !gameStarted || !tradingOutpost) return;

  ambientStartFormationDelay=testingAmbientSpaceshipFormationDelayFrames;
  ambientSpaceshipCooldown=ambientStartFormationDelay+1300+Math.floor(Math.random()*700);
}

function clearAmbientSpaceships(){
  for(let ship of ambientSpaceships){
    if(ship.sound && motorAudio.stopAmbientSpaceshipFlyover) motorAudio.stopAmbientSpaceshipFlyover(ship.sound,true);
    scene.remove(ship.mesh);
  }
  ambientSpaceships=[];
  scheduleNextAmbientSpaceship();
}

function updateAmbientSpaceships(){
  if(!gameStarted || gameOver){
    if(ambientSpaceships.length>0) clearAmbientSpaceships();
    return;
  }

  if(ambientStartFormationDelay>0 && !ambientStartFormationSpawned){
    ambientStartFormationDelay--;
    if(ambientStartFormationDelay<=0) spawnTestingAmbientSpaceshipFormationOverHomeBase();
  }

  ambientSpaceshipCooldown--;
  if(ambientSpaceshipCooldown<=0){
    spawnAmbientSpaceship();
    scheduleNextAmbientSpaceship();
  }

  for(let i=ambientSpaceships.length-1;i>=0;i--){
    let ship=ambientSpaceships[i];
    ship.age++;
    ship.x+=ship.vx;
    ship.z+=ship.vz;

    let surfaceY=drivingSurfaceHeight(ship.x,ship.z);
    let targetY=surfaceY+ship.altitude+Math.sin(ship.age*0.025+ship.phase)*12;
    ship.y+=(targetY-ship.y)*0.018;
    ship.mesh.position.set(ship.x,ship.y,ship.z);

    let flightAngle=Math.atan2(ship.vx,ship.vz);
    ship.mesh.rotation.y=flightAngle;
    ship.mesh.rotation.x=Math.sin(ship.age*0.028+ship.phase)*0.018;
    ship.mesh.rotation.z=Math.sin(ship.age*0.021+ship.phase)*0.05;

    if(ship.mesh.userData.engine){
      let pulse=1+Math.sin(ship.age*0.34+ship.phase)*0.18;
      ship.mesh.userData.engine.scale.set(1.25*pulse,1.25*pulse,1.8*pulse);
    }
    if(ship.mesh.userData.trail){
      let trailPulse=0.92+Math.sin(ship.age*0.18+ship.phase)*0.08;
      ship.mesh.userData.trail.scale.set(trailPulse,trailPulse,1);
    }
    if(ship.sound && motorAudio.updateAmbientSpaceshipFlyover){
      let traveled=Math.hypot(ship.x-ship.startX,ship.z-ship.startZ);
      let progress=clamp(traveled/Math.max(1,ship.pathDistance),0,1);
      let fadeIn=smoothStep(0.04,0.34,progress);
      let fadeOut=1-smoothStep(0.64,0.98,progress);
      let flyoverEnvelope=fadeIn*fadeOut;
      motorAudio.updateAmbientSpaceshipFlyover(
        ship.sound,
        {x:ship.x,y:ship.y,z:ship.z},
        flyoverEnvelope*(0.72+Math.min(0.28,Math.hypot(ship.vx,ship.vz)*0.03))
      );
    }

    if(ship.age%ship.trailEvery===0){
      let speedLen=Math.max(0.001,Math.hypot(ship.vx,ship.vz));
      let backX=-ship.vx/speedLen;
      let backZ=-ship.vz/speedLen;
      for(let t=0;t<2;t++){
        let offset=7+t*5.5;
        dust.spawnJetExhaustParticle(
          ship.x+backX*offset+(Math.random()-0.5)*2.4,
          ship.y+(Math.random()-0.5)*1.2,
          ship.z+backZ*offset+(Math.random()-0.5)*2.4,
          backX*(10+Math.random()*3),
          backZ*(10+Math.random()*3),
          -0.5+Math.random()*1.1,
          0.85+Math.random()*0.35,
          2.4+Math.random()*1.8
        );
      }
    }

    let remainingDx=ship.endX-ship.x;
    let remainingDz=ship.endZ-ship.z;
    let passedTarget=remainingDx*ship.vx+remainingDz*ship.vz<0;
    if(ship.age>ship.life || passedTarget){
      if(ship.sound && motorAudio.stopAmbientSpaceshipFlyover) motorAudio.stopAmbientSpaceshipFlyover(ship.sound);
      scene.remove(ship.mesh);
      ambientSpaceships.splice(i,1);
    }
  }
}

function spawnRocketExplosion(x,y,z,playSound=true,soundType="rocket"){
  if(playSound){
    let soundPosition={x,y,z};
    if(soundType==="cannon" && motorAudio.playCannonImpact) motorAudio.playCannonImpact(soundPosition);
    else if(motorAudio.playRocketImpact) motorAudio.playRocketImpact(soundPosition);
    else motorAudio.playExplosion(soundPosition);
  }

  let flash=new THREE.Mesh(explosionFlashGeo,explosionFlashMat.clone());
  flash.position.set(x,y,z);
  flash.scale.setScalar(0.35);
  scene.add(flash);

  let ring=new THREE.Mesh(explosionRingGeo,explosionRingMat.clone());
  ring.position.set(x,y+0.05,z);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(0.55);
  scene.add(ring);

  explosionBursts.push({flash,ring,age:0,life:0.42});

  for(let i=0;i<24;i++){
    let angle=Math.random()*Math.PI*2;
    let speed=2.4+Math.random()*5.4;
    dust.spawnThrusterParticle(
      x,
      y,
      z,
      Math.cos(angle)*speed,
      Math.sin(angle)*speed,
      1.4+Math.random()*4.2,
      0.24+Math.random()*0.22,
      0.12+Math.random()*0.12
    );
  }
}

function spawnMothershipImpactBurst(x,y,z){
  if(!mothership) return;

  let shipY=mothership.group ? mothership.group.position.y : mothership.y;
  let normal=new THREE.Vector3(x-mothership.x,(y-shipY)*0.72,z-mothership.z);
  if(normal.lengthSq()<0.001) normal.set(0,1,0);
  normal.normalize();

  let rx=42;
  let ry=18;
  let rz=24;
  let surfaceDistance=1/Math.sqrt(
    (normal.x*normal.x)/(rx*rx)
    +(normal.y*normal.y)/(ry*ry)
    +(normal.z*normal.z)/(rz*rz)
  );
  let passedDistance=(x-mothership.x)*normal.x+(y-shipY)*normal.y+(z-mothership.z)*normal.z;
  let impactDistance=Math.max(surfaceDistance,passedDistance)+7.5;
  let impactX=mothership.x+normal.x*impactDistance;
  let impactY=shipY+normal.y*impactDistance;
  let impactZ=mothership.z+normal.z*impactDistance;

  let flash=new THREE.Mesh(explosionFlashGeo,explosionFlashMat.clone());
  flash.material.depthTest=false;
  flash.material.opacity=1;
  flash.position.set(impactX,impactY,impactZ);
  flash.scale.setScalar(1.45);
  flash.renderOrder=80;
  scene.add(flash);

  let ring=new THREE.Mesh(explosionRingGeo,explosionRingMat.clone());
  ring.material.depthTest=false;
  ring.material.opacity=1;
  ring.position.set(impactX,impactY,impactZ);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
  ring.scale.setScalar(1.7);
  ring.renderOrder=81;
  scene.add(ring);

  explosionBursts.push({
    flash,
    ring,
    age:0,
    life:0.72,
    startFlashScale:1.45,
    endFlashScale:8.4,
    startRingScale:1.7,
    endRingScale:13.5,
    flashOpacity:1,
    ringOpacity:0.95
  });

  let secondaryFlash=new THREE.Mesh(explosionFlashGeo,explosionFlashMat.clone());
  secondaryFlash.material.depthTest=false;
  secondaryFlash.material.color.set(0xfff1c8);
  secondaryFlash.position.set(
    impactX+normal.x*2.4,
    impactY+normal.y*2.4,
    impactZ+normal.z*2.4
  );
  secondaryFlash.scale.setScalar(0.75);
  secondaryFlash.renderOrder=82;
  scene.add(secondaryFlash);

  let secondaryRing=new THREE.Mesh(explosionRingGeo,explosionRingMat.clone());
  secondaryRing.material.depthTest=false;
  secondaryRing.material.color.set(0xff8c4a);
  secondaryRing.position.copy(secondaryFlash.position);
  secondaryRing.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
  secondaryRing.scale.setScalar(0.95);
  secondaryRing.renderOrder=83;
  scene.add(secondaryRing);

  explosionBursts.push({
    flash:secondaryFlash,
    ring:secondaryRing,
    age:0,
    life:0.42,
    startFlashScale:0.75,
    endFlashScale:4.8,
    startRingScale:0.95,
    endRingScale:7.2,
    flashOpacity:0.95,
    ringOpacity:0.85
  });

  for(let i=0;i<34;i++){
    let sideAngle=Math.random()*Math.PI*2;
    let sideSpeed=1.8+Math.random()*3.6;
    dust.spawnThrusterParticle(
      impactX,
      impactY,
      impactZ,
      normal.x*(4.2+Math.random()*5.2)+Math.cos(sideAngle)*sideSpeed,
      normal.z*(4.2+Math.random()*5.2)+Math.sin(sideAngle)*sideSpeed,
      normal.y*(3.6+Math.random()*5.4)+(Math.random()-0.25)*3.2,
      0.3+Math.random()*0.2,
      0.14+Math.random()*0.1
    );
  }
}

function spawnRadiusExplosion(x,y,z,radius,playSound=true){
  if(playSound) motorAudio.playExplosion({x,y,z});

  let flash=new THREE.Mesh(explosionFlashGeo,explosionFlashMat.clone());
  flash.position.set(x,y,z);
  flash.scale.setScalar(Math.max(4,radius*0.04));
  scene.add(flash);

  let ring=new THREE.Mesh(explosionRingGeo,explosionRingMat.clone());
  ring.position.set(x,y+0.08,z);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(Math.max(6,radius*0.08));
  scene.add(ring);

  explosionBursts.push({
    flash,
    ring,
    age:0,
    life:0.9,
    startFlashScale:Math.max(4,radius*0.04),
    endFlashScale:Math.max(20,radius*0.72),
    startRingScale:Math.max(6,radius*0.08),
    endRingScale:radius
  });
}

function clearExplosions(){
  for(let burst of explosionBursts){
    scene.remove(burst.flash,burst.ring);
    burst.flash.material.dispose();
    burst.ring.material.dispose();
  }
  explosionBursts=[];
}

function spawnEnemyTeleportEffect(enemy){
  if(!enemy || enemy.isBoat) return;

  let surfaceY=drivingSurfaceHeight(enemy.x,enemy.z);
  let spawnLift=Math.max(0,enemy.y-surfaceY);
  let height=Math.max(7,spawnLift+enemy.hitHeight+4);
  let radius=Math.max(2.8,enemy.collisionRadius*1.25);
  let beam=new THREE.Mesh(teleportBeamGeo,teleportBeamMat.clone());
  beam.position.set(enemy.x,surfaceY+height*0.5,enemy.z);
  beam.scale.set(radius,height,radius);
  beam.renderOrder=22;
  scene.add(beam);

  let columns=new THREE.Group();
  let columnMat=teleportBeamMat.clone();
  columnMat.opacity=0.46;
  let columnCount=7;
  for(let i=0;i<columnCount;i++){
    let angle=(i/columnCount)*Math.PI*2+(i%2)*0.18;
    let columnRadius=i===0 ? 0 : radius*(0.22+(i%3)*0.11);
    let column=new THREE.Mesh(teleportBeamGeo,columnMat);
    column.position.set(Math.cos(angle)*columnRadius,0,Math.sin(angle)*columnRadius);
    column.scale.set(i===0 ? 0.035 : 0.018,height*(0.84+Math.random()*0.16),i===0 ? 0.035 : 0.018);
    columns.add(column);
  }
  columns.position.set(enemy.x,surfaceY+height*0.5,enemy.z);
  columns.renderOrder=24;
  scene.add(columns);

  let ring=new THREE.Mesh(teleportRingGeo,explosionRingMat.clone());
  ring.position.set(enemy.x,surfaceY+0.12,enemy.z);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(radius*0.42);
  ring.renderOrder=23;
  scene.add(ring);

  let sparkCount=Math.min(140,Math.max(70,Math.ceil(height*5+radius*8)));
  let sparkPositions=new Float32Array(sparkCount*3);
  let sparkData=[];
  for(let i=0;i<sparkCount;i++){
    let angle=Math.random()*Math.PI*2;
    let ringBias=Math.pow(Math.random(),0.55);
    let r=radius*(0.08+ringBias*0.82);
    sparkPositions[i*3]=Math.cos(angle)*r;
    sparkPositions[i*3+1]=Math.random()*height-height*0.5;
    sparkPositions[i*3+2]=Math.sin(angle)*r;
    sparkData.push({
      angle,
      radius:r,
      phase:Math.random()*Math.PI*2,
      speed:0.55+Math.random()*1.35,
      lift:0.35+Math.random()*1.0
    });
  }
  let sparkGeo=new THREE.BufferGeometry();
  sparkGeo.setAttribute("position",new THREE.BufferAttribute(sparkPositions,3));
  let sparks=new THREE.Points(sparkGeo,teleportSparkMat.clone());
  sparks.position.set(enemy.x,surfaceY+height*0.5,enemy.z);
  sparks.renderOrder=25;
  scene.add(sparks);

  teleportEffects.push({
    beam,
    columns,
    columnMat,
    ring,
    sparks,
    sparkPositions,
    sparkData,
    enemy,
    age:0,
    life:1.05,
    radius,
    height
  });

  enemy.spawnMaterialize=0;
  enemy.group.scale.setScalar(0.04);

  for(let i=0;i<10;i++){
    let angle=Math.random()*Math.PI*2;
    let speed=0.7+Math.random()*2.8;
    dust.spawnThrusterParticle(
      enemy.x+Math.cos(angle)*radius*(0.15+Math.random()*0.35),
      surfaceY+Math.random()*height,
      enemy.z+Math.sin(angle)*radius*(0.15+Math.random()*0.35),
      Math.cos(angle)*speed,
      Math.sin(angle)*speed,
      0.6+Math.random()*2.2,
      0.08+Math.random()*0.11,
      0.08+Math.random()*0.1
    );
  }
}

function clearTeleportEffects(){
  for(let effect of teleportEffects){
    scene.remove(effect.beam,effect.columns,effect.ring,effect.sparks);
    effect.beam.material.dispose();
    if(effect.columnMat) effect.columnMat.dispose();
    effect.ring.material.dispose();
    if(effect.sparks){
      effect.sparks.geometry.dispose();
      effect.sparks.material.dispose();
    }
  }
  teleportEffects=[];
}

function updateTeleportEffects(){
  for(let i=teleportEffects.length-1;i>=0;i--){
    let effect=teleportEffects[i];
    effect.age+=0.016;
    let t=Math.min(1,effect.age/effect.life);
    let fade=Math.pow(1-t,1.55);
    let smooth=t*t*(3-2*t);
    let pulse=1+Math.sin(t*Math.PI*5)*0.025;

    effect.beam.scale.set(
      effect.radius*(0.95-smooth*0.48)*pulse,
      effect.height*(1+Math.sin(t*Math.PI)*0.04),
      effect.radius*(0.95-smooth*0.48)*pulse
    );
    effect.beam.material.opacity=0.18*fade;
    if(effect.columns){
      effect.columns.rotation.y+=0.012;
      effect.columns.scale.setScalar(1+Math.sin(t*Math.PI)*0.08);
    }
    if(effect.columnMat) effect.columnMat.opacity=0.46*fade;
    effect.ring.scale.setScalar(effect.radius*(0.34+smooth*1.45));
    effect.ring.material.color.set(0xffe7b8);
    effect.ring.material.opacity=0.42*fade;
    if(effect.sparks && effect.sparkPositions && effect.sparkData){
      for(let s=0;s<effect.sparkData.length;s++){
        let data=effect.sparkData[s];
        let drift=t*effect.height*data.lift;
        let y=((data.phase+drift)%(effect.height))-effect.height*0.5;
        let angle=data.angle+t*data.speed*1.7+Math.sin(t*10+data.phase)*0.08;
        let shimmer=0.74+Math.sin(t*34+data.phase)*0.26;
        effect.sparkPositions[s*3]=Math.cos(angle)*data.radius*shimmer;
        effect.sparkPositions[s*3+1]=y;
        effect.sparkPositions[s*3+2]=Math.sin(angle)*data.radius*shimmer;
      }
      effect.sparks.geometry.attributes.position.needsUpdate=true;
      effect.sparks.material.opacity=(0.18+Math.sin(t*Math.PI)*0.72)*fade;
      effect.sparks.material.size=0.1+Math.sin(t*Math.PI)*0.14;
    }

    if(effect.enemy && effect.enemy.active && effect.enemy.group){
      effect.enemy.spawnMaterialize=t;
      let bodyScale=0.04+smooth*0.96;
      effect.enemy.group.scale.setScalar(bodyScale);
    }

    if(t>=1){
      if(effect.enemy && effect.enemy.group) effect.enemy.group.scale.setScalar(1);
      scene.remove(effect.beam,effect.columns,effect.ring,effect.sparks);
      effect.beam.material.dispose();
      if(effect.columnMat) effect.columnMat.dispose();
      effect.ring.material.dispose();
      if(effect.sparks){
        effect.sparks.geometry.dispose();
        effect.sparks.material.dispose();
      }
      teleportEffects.splice(i,1);
    }
  }
}

function prepareTreasurePickupVisual(visual){
  if(!visual) return;
  visual.traverse(child=>{
    if(!child.isMesh || !child.material) return;
    child.material=Array.isArray(child.material)
      ? child.material.map(material=>material.clone())
      : child.material.clone();
    let materials=Array.isArray(child.material) ? child.material : [child.material];
    for(let material of materials){
      material.transparent=true;
      material.opacity=1;
      if(material.emissive){
        material.emissive.set(0xffd36a);
        material.emissiveIntensity=Math.max(material.emissiveIntensity || 0,0.34);
      }
    }
  });
}

function setTreasureVisualOpacity(visual,opacity){
  if(!visual) return;
  visual.traverse(child=>{
    if(!child.isMesh || !child.material) return;
    let materials=Array.isArray(child.material) ? child.material : [child.material];
    for(let material of materials) material.opacity=opacity;
  });
}

function disposeTreasureVisualMaterials(visual){
  if(!visual) return;
  visual.traverse(child=>{
    if(!child.isMesh || !child.material) return;
    let materials=Array.isArray(child.material) ? child.material : [child.material];
    for(let material of materials) material.dispose();
  });
}

function spawnTreasurePickupEffect(treasure){
  if(!treasure) return;
  let x=treasure.x || 0;
  let z=treasure.z || 0;
  let surfaceY=Number.isFinite(treasure.y) ? treasure.y : drivingSurfaceHeight(x,z)+0.8;
  let radius=Math.max(2.2,Math.min(5.6,(treasure.r || 3.2)*0.72));
  let height=8.5;

  let beamMat=teleportBeamMat.clone();
  beamMat.color.set(0xffd36a);
  beamMat.opacity=0.28;
  let beam=new THREE.Mesh(teleportBeamGeo,beamMat);
  beam.position.set(x,surfaceY+height*0.5,z);
  beam.scale.set(radius,height,radius);
  beam.renderOrder=32;
  scene.add(beam);

  let ringMat=explosionRingMat.clone();
  ringMat.color.set(0xffe7a8);
  ringMat.opacity=0.72;
  let ring=new THREE.Mesh(teleportRingGeo,ringMat);
  ring.position.set(x,surfaceY+0.12,z);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(radius*0.38);
  ring.renderOrder=33;
  scene.add(ring);

  let visual=null;
  if(treasure.visual){
    visual=new THREE.Group();
    visual.position.set(x,surfaceY,z);
    treasure.visual.position.set(-x,-surfaceY,-z);
    visual.add(treasure.visual);
    prepareTreasurePickupVisual(visual);
    scene.add(visual);
  }

  let sparkCount=42;
  let sparkPositions=new Float32Array(sparkCount*3);
  let sparkData=[];
  for(let i=0;i<sparkCount;i++){
    let angle=Math.random()*Math.PI*2;
    let r=radius*(0.18+Math.random()*0.78);
    sparkPositions[i*3]=Math.cos(angle)*r;
    sparkPositions[i*3+1]=Math.random()*height-height*0.42;
    sparkPositions[i*3+2]=Math.sin(angle)*r;
    sparkData.push({
      angle,
      radius:r,
      phase:Math.random()*Math.PI*2,
      speed:0.8+Math.random()*1.6
    });
  }
  let sparkGeo=new THREE.BufferGeometry();
  sparkGeo.setAttribute("position",new THREE.BufferAttribute(sparkPositions,3));
  let sparkMat=teleportSparkMat.clone();
  sparkMat.color.set(0xfff1a8);
  sparkMat.size=0.11;
  let sparks=new THREE.Points(sparkGeo,sparkMat);
  sparks.position.set(x,surfaceY+height*0.48,z);
  sparks.renderOrder=35;
  scene.add(sparks);

  treasurePickupEffects.push({
    visual,
    beam,
    ring,
    sparks,
    sparkPositions,
    sparkData,
    x,
    y:surfaceY,
    z,
    visualBaseY:surfaceY,
    radius,
    height,
    age:0,
    life:0.92
  });
}

function disposeTreasurePickupEffect(effect){
  if(!effect) return;
  if(effect.visual){
    scene.remove(effect.visual);
    disposeTreasureVisualMaterials(effect.visual);
  }
  scene.remove(effect.beam,effect.ring,effect.sparks);
  if(effect.beam && effect.beam.material) effect.beam.material.dispose();
  if(effect.ring && effect.ring.material) effect.ring.material.dispose();
  if(effect.sparks){
    effect.sparks.geometry.dispose();
    effect.sparks.material.dispose();
  }
}

function clearTreasurePickupEffects(){
  for(let effect of treasurePickupEffects) disposeTreasurePickupEffect(effect);
  treasurePickupEffects=[];
}

function updateTreasurePickupEffects(){
  for(let i=treasurePickupEffects.length-1;i>=0;i--){
    let effect=treasurePickupEffects[i];
    effect.age+=0.016;
    let t=clamp(effect.age/effect.life,0,1);
    let eased=smoothStep(t);
    let fade=Math.pow(1-t,1.45);
    let pulse=1+Math.sin(t*Math.PI*8)*0.035;

    effect.beam.scale.set(
      effect.radius*(0.9-eased*0.62)*pulse,
      effect.height*(1+Math.sin(t*Math.PI)*0.18),
      effect.radius*(0.9-eased*0.62)*pulse
    );
    effect.beam.material.opacity=0.28*fade;
    effect.ring.scale.setScalar(effect.radius*(0.38+eased*1.6));
    effect.ring.material.opacity=0.72*fade;

    if(effect.visual){
      effect.visual.position.y=effect.visualBaseY+eased*3.2;
      effect.visual.rotation.y+=0.035+eased*0.045;
      let scale=1-eased*0.82;
      effect.visual.scale.setScalar(Math.max(0.04,scale));
      setTreasureVisualOpacity(effect.visual,fade);
    }

    if(effect.sparks && effect.sparkPositions && effect.sparkData){
      for(let s=0;s<effect.sparkData.length;s++){
        let data=effect.sparkData[s];
        let lift=t*effect.height*1.25;
        let angle=data.angle+t*data.speed*2.8;
        let r=data.radius*(1-eased*0.55)*(0.82+Math.sin(t*24+data.phase)*0.18);
        effect.sparkPositions[s*3]=Math.cos(angle)*r;
        effect.sparkPositions[s*3+1]=((data.phase+lift)%effect.height)-effect.height*0.42;
        effect.sparkPositions[s*3+2]=Math.sin(angle)*r;
      }
      effect.sparks.geometry.attributes.position.needsUpdate=true;
      effect.sparks.material.opacity=(0.18+Math.sin(t*Math.PI)*0.78)*fade;
      effect.sparks.material.size=0.09+Math.sin(t*Math.PI)*0.16;
    }

    if(t>=1){
      disposeTreasurePickupEffect(effect);
      treasurePickupEffects.splice(i,1);
    }
  }
}

function updateExplosions(){
  for(let i=explosionBursts.length-1;i>=0;i--){
    let burst=explosionBursts[i];
    burst.age+=0.016;
    let t=Math.min(1,burst.age/burst.life);
    let flashScale=burst.startFlashScale!==undefined
      ? burst.startFlashScale+(burst.endFlashScale-burst.startFlashScale)*Math.sin(t*Math.PI*0.5)
      : 0.35+Math.sin(t*Math.PI)*3.4;
    let ringScale=burst.startRingScale!==undefined
      ? burst.startRingScale+(burst.endRingScale-burst.startRingScale)*t
      : 0.55+t*6.8;

    burst.flash.scale.setScalar(flashScale);
    burst.ring.scale.setScalar(ringScale);
    burst.flash.material.opacity=(burst.flashOpacity ?? 0.9)*Math.pow(1-t,1.6);
    burst.ring.material.opacity=(burst.ringOpacity ?? 0.8)*Math.pow(1-t,1.2);

    if(t>=1){
      scene.remove(burst.flash,burst.ring);
      burst.flash.material.dispose();
      burst.ring.material.dispose();
      explosionBursts.splice(i,1);
    }
  }
}

function spawnRockDebris(x,y,z,obstacle){
  let building=obstacle.type==="building" || obstacle.type==="wall";
  let buildingHeight=building ? (obstacle.visualHeight || obstacle.height || Math.max(8,(obstacle.r || 5)*1.4)) : 0;
  let buildingRadius=building ? (obstacle.visualRadius || obstacle.r || 5) : 0;
  let skyscraper=building && obstacle.cityBuilding;
  let count=building
    ? skyscraper
      ? Math.min(78,Math.max(34,Math.ceil(buildingHeight*0.42+buildingRadius*2.2)))
      : 22
    : (obstacle.type==="smallRock" ? 7 : 13);
  let baseScale=building
    ? skyscraper
      ? Math.max(1.05,Math.min(4.2,buildingRadius*0.23+buildingHeight*0.018))
      : Math.max(0.75,Math.min(2.1,(obstacle.r || 5)*0.16))
    : Math.max(0.22,Math.min(0.82,(obstacle.r || 3)*0.14));
  let buildingBaseY=building && Number.isFinite(obstacle.baseY)
    ? obstacle.baseY
    : y;

  for(let i=0;i<count;i++){
    let piece=new THREE.Mesh(
      building ? buildingDebrisGeo : rockDebrisGeo,
      (building ? buildingDebrisMat : rockDebrisMat).clone()
    );
    let angle=(i/count)*Math.PI*2+Math.random()*0.55;
    let heightT=building ? Math.random() : 0;
    let heightBand=skyscraper ? Math.floor(i/Math.max(1,Math.ceil(count/6)))/5 : heightT;
    let fragmentY=skyscraper
      ? buildingBaseY+1.2+Math.min(1,Math.max(0,heightBand*0.62+heightT*0.38))*buildingHeight
      : y+0.3+Math.random()*3.2;
    let outward=skyscraper ? 0.35+heightT*0.7 : 1;
    let speed=building
      ? skyscraper
        ? 0.34+Math.random()*0.78+outward*0.18
        : 0.2+Math.random()*0.42
      : 0.16+Math.random()*0.28;
    let scale=baseScale*(skyscraper ? 0.34+Math.random()*1.18 : 0.45+Math.random()*0.8);
    let scatter=building
      ? skyscraper
        ? buildingRadius*(0.35+Math.random()*1.35)
        : 4.8
      : 0.8;
    let flat=building && Math.random()<0.68;

    piece.position.set(
      x+Math.cos(angle)*scatter*(skyscraper ? 0.45+Math.random()*0.55 : Math.random()-0.5),
      building ? fragmentY : y+0.3+Math.random()*0.9,
      z+Math.sin(angle)*scatter*(skyscraper ? 0.45+Math.random()*0.55 : Math.random()-0.5)
    );
    piece.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    piece.scale.set(
      scale*(building ? (flat ? 1.7+Math.random()*2.4 : 0.8+Math.random()*1.4) : 1),
      scale*(building ? (flat ? 0.18+Math.random()*0.34 : 0.45+Math.random()*1.0) : 0.65+Math.random()*0.6),
      scale*(building ? (flat ? 0.75+Math.random()*1.65 : 0.8+Math.random()*1.4) : 1)
    );
    piece.castShadow=true;
    piece.receiveShadow=true;
    scene.add(piece);

    rockDebris.push({
      piece,
      vx:Math.cos(angle)*speed,
      vz:Math.sin(angle)*speed,
      vy:(building ? skyscraper ? 0.45+heightT*0.55 : 0.34 : 0.2)+Math.random()*(building ? skyscraper ? 0.95 : 0.54 : 0.34),
      rx:(Math.random()-0.5)*(skyscraper ? 0.24 : 0.18),
      ry:(Math.random()-0.5)*(skyscraper ? 0.24 : 0.18),
      rz:(Math.random()-0.5)*(skyscraper ? 0.24 : 0.18),
      age:0,
      life:(building ? skyscraper ? 3.0 : 2.2 : 1.5)+Math.random()*(building ? skyscraper ? 1.35 : 0.75 : 0.55)
    });
  }
}

function spawnRadarOutpostExplosion(x,y,z,obstacle){
  let baseY=Number.isFinite(obstacle.baseY) ? obstacle.baseY : drivingSurfaceHeight(x,z);
  let height=obstacle.visualHeight || obstacle.height || 22;
  let radius=obstacle.visualRadius || obstacle.r || 16;
  let coreY=Math.max(y,baseY+height*0.54);

  let flash=new THREE.Mesh(explosionFlashGeo,explosionFlashMat.clone());
  flash.position.set(x,coreY,z);
  flash.scale.setScalar(1.4);
  flash.material.color.set(0xd8fbff);
  flash.material.opacity=1;
  flash.material.depthTest=false;
  flash.renderOrder=42;
  scene.add(flash);

  let ring=new THREE.Mesh(explosionRingGeo,explosionRingMat.clone());
  ring.position.set(x,baseY+height*0.34,z);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(Math.max(2.4,radius*0.16));
  ring.material.color.set(0x8dfff2);
  ring.material.opacity=0.95;
  ring.material.depthTest=false;
  ring.renderOrder=43;
  scene.add(ring);

  explosionBursts.push({
    flash,
    ring,
    age:0,
    life:0.68,
    startFlashScale:1.4,
    endFlashScale:9.2,
    startRingScale:Math.max(2.4,radius*0.16),
    endRingScale:Math.max(22,radius*1.7),
    flashOpacity:1,
    ringOpacity:0.95
  });

  for(let i=0;i<2;i++){
    let signalRing=new THREE.Mesh(explosionRingGeo,explosionRingMat.clone());
    signalRing.position.set(x,baseY+height*(0.62+i*0.18),z);
    signalRing.rotation.set(Math.PI*0.5+(Math.random()-0.5)*0.28,Math.random()*Math.PI,Math.random()*Math.PI);
    signalRing.scale.setScalar(1.2+i*0.55);
    signalRing.material.color.set(i===0 ? 0xb9f7ff : 0x6bdcff);
    signalRing.material.opacity=0.86;
    signalRing.material.depthTest=false;
    signalRing.renderOrder=44+i;
    scene.add(signalRing);

    let signalFlash=new THREE.Mesh(explosionFlashGeo,explosionFlashMat.clone());
    signalFlash.position.copy(signalRing.position);
    signalFlash.scale.setScalar(0.28+i*0.18);
    signalFlash.material.color.set(0x8dfff2);
    signalFlash.material.opacity=0.65;
    signalFlash.material.depthTest=false;
    signalFlash.renderOrder=46+i;
    scene.add(signalFlash);

    explosionBursts.push({
      flash:signalFlash,
      ring:signalRing,
      age:0,
      life:0.55+i*0.12,
      startFlashScale:0.28+i*0.18,
      endFlashScale:2.4+i*1.2,
      startRingScale:1.2+i*0.55,
      endRingScale:radius*(1.15+i*0.62),
      flashOpacity:0.65,
      ringOpacity:0.86
    });
  }

  let count=30;
  for(let i=0;i<count;i++){
    let piece=new THREE.Mesh(buildingDebrisGeo,radarDebrisMat.clone());
    let angle=(i/count)*Math.PI*2+Math.random()*0.54;
    let heightT=Math.random();
    let fragmentY=baseY+1.8+heightT*height;
    let dist=radius*(0.12+Math.random()*0.42);
    let scale=0.42+Math.random()*1.35;
    let panel=Math.random()<0.78;

    piece.position.set(
      x+Math.cos(angle)*dist,
      fragmentY,
      z+Math.sin(angle)*dist
    );
    piece.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    piece.scale.set(
      scale*(panel ? 1.8+Math.random()*2.2 : 0.42+Math.random()*0.74),
      scale*(panel ? 0.08+Math.random()*0.18 : 0.28+Math.random()*0.48),
      scale*(panel ? 0.62+Math.random()*1.28 : 1.4+Math.random()*1.8)
    );
    piece.castShadow=true;
    piece.receiveShadow=true;
    scene.add(piece);

    let speed=0.46+Math.random()*1.15+heightT*0.34;
    rockDebris.push({
      piece,
      vx:Math.cos(angle)*speed,
      vz:Math.sin(angle)*speed,
      vy:0.68+Math.random()*1.15+heightT*0.55,
      rx:(Math.random()-0.5)*0.32,
      ry:(Math.random()-0.5)*0.36,
      rz:(Math.random()-0.5)*0.32,
      age:0,
      life:2.4+Math.random()*1.1
    });
  }

  for(let i=0;i<24;i++){
    let angle=Math.random()*Math.PI*2;
    let speed=2.6+Math.random()*7.2;
    dust.spawnThrusterParticle(
      x,
      baseY+height*(0.28+Math.random()*0.58),
      z,
      Math.cos(angle)*speed,
      Math.sin(angle)*speed,
      2.2+Math.random()*7.2,
      0.18+Math.random()*0.2,
      0.07+Math.random()*0.08
    );
  }
}

function spawnObstacleDestructionDebris(obstacle,y){
  if(!obstacle) return;
  if(obstacle.type==="radarOutpost"){
    spawnRadarOutpostExplosion(obstacle.x,y,obstacle.z,obstacle);
    return;
  }
  spawnRockDebris(obstacle.x,y,obstacle.z,obstacle);
}

function spawnBossBaseDebris(base){
  if(!base || !base.group) return;
  let sourceParts=[];
  base.group.traverse(child=>{
    if(child.isMesh && child.geometry && child.material){
      sourceParts.push(child);
    }
  });

  let count=Math.min(90,Math.max(42,sourceParts.length*2));
  for(let i=0;i<count;i++){
    let source=sourceParts.length ? sourceParts[i%sourceParts.length] : null;
    let material=source && source.material ? source.material.clone() : buildingDebrisMat.clone();
    let piece=new THREE.Mesh(buildingDebrisGeo,material);
    let angle=(i/count)*Math.PI*2+Math.random()*0.6;
    let dist=8+Math.random()*42;
    let height=3+Math.random()*34;
    let scale=1.3+Math.random()*4.8;
    let flat=Math.random()<0.65;

    piece.position.set(
      base.x+Math.cos(angle)*dist+(Math.random()-0.5)*8,
      base.y+height,
      base.z+Math.sin(angle)*dist+(Math.random()-0.5)*8
    );
    piece.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    piece.scale.set(
      scale*(flat ? 1.8+Math.random()*2.8 : 0.7+Math.random()*1.3),
      scale*(flat ? 0.22+Math.random()*0.42 : 0.55+Math.random()*1.0),
      scale*(flat ? 0.8+Math.random()*1.8 : 0.7+Math.random()*1.3)
    );
    piece.castShadow=true;
    piece.receiveShadow=true;
    scene.add(piece);

    let blast=0.55+Math.random()*1.15;
    rockDebris.push({
      piece,
      vx:Math.cos(angle)*blast,
      vz:Math.sin(angle)*blast,
      vy:0.75+Math.random()*1.25,
      rx:(Math.random()-0.5)*0.28,
      ry:(Math.random()-0.5)*0.28,
      rz:(Math.random()-0.5)*0.28,
      age:0,
      life:3.2+Math.random()*1.4
    });
  }
}

function clearRockDebris(){
  for(let item of rockDebris){
    scene.remove(item.piece);
    item.piece.material.dispose();
  }
  rockDebris=[];
}

function updateRockDebris(){
  for(let i=rockDebris.length-1;i>=0;i--){
    let item=rockDebris[i];
    item.age+=0.016;
    item.vy-=0.018;
    item.vx*=0.988;
    item.vz*=0.988;
    item.piece.position.x+=item.vx;
    item.piece.position.y+=item.vy;
    item.piece.position.z+=item.vz;
    item.piece.rotation.x+=item.rx;
    item.piece.rotation.y+=item.ry;
    item.piece.rotation.z+=item.rz;

    let groundY=drivingSurfaceHeight(item.piece.position.x,item.piece.position.z)+0.08;
    if(item.piece.position.y<groundY){
      item.piece.position.y=groundY;
      item.vy*=-0.28;
      item.vx*=0.72;
      item.vz*=0.72;
    }

    let t=Math.min(1,item.age/item.life);
    item.piece.scale.multiplyScalar(1-0.012*t);
    item.piece.material.opacity=1-t;
    item.piece.material.transparent=true;

    if(t>=1){
      scene.remove(item.piece);
      item.piece.material.dispose();
      rockDebris.splice(i,1);
    }
  }
}

function makeSupplyBox(type){
  let group=new THREE.Group();
  let baseMat=type==="rocket" ? rocketSupplyMat : type==="health" ? healthSupplyMat : type==="boost" ? boostSupplyMat : type==="jet" ? jetSupplyMat : type==="bomb" ? clusterBombBodyMat : cannonSupplyMat;
  let bandMat=type==="rocket" ? rocketSupplyBandMat : type==="health" ? healthSupplyBandMat : type==="boost" ? boostSupplyBandMat : type==="jet" ? jetSupplyBandMat : type==="bomb" ? clusterBombBandMat : cannonSupplyBandMat;
  let body=new THREE.Mesh(supplyBoxGeo,baseMat);
  let lid=new THREE.Mesh(supplyLidGeo,supplyLidMat);
  let bandA=new THREE.Mesh(supplyBandGeo,bandMat);
  let bandB=new THREE.Mesh(supplyBandGeo,bandMat);

  body.castShadow=true;
  body.receiveShadow=true;
  lid.castShadow=true;
  lid.receiveShadow=true;
  bandA.castShadow=true;
  bandB.castShadow=true;
  lid.position.y=0.69;
  bandA.position.y=0.18;
  bandA.position.z=1.23;
  bandB.position.y=0.18;
  bandB.position.x=1.23;
  bandB.rotation.y=Math.PI/2;

  group.add(body,lid,bandA,bandB);

  if(type==="jet"){
    let logoRoot=new THREE.Group();
    logoRoot.position.set(0,0.84,0);
    logoRoot.rotation.x=-Math.PI/2;

    let jetBody=new THREE.Mesh(new THREE.BoxGeometry(0.18,1.12,0.06),jetLogoMat);
    let jetNose=new THREE.Mesh(new THREE.ConeGeometry(0.14,0.34,3),jetLogoMat);
    let jetWing=new THREE.Mesh(new THREE.BoxGeometry(1.05,0.2,0.06),jetLogoMat);
    let jetTail=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.14,0.06),jetLogoMat);

    jetNose.rotation.z=-Math.PI/2;
    jetNose.position.y=0.72;
    jetWing.position.y=0.04;
    jetTail.position.y=-0.44;
    logoRoot.add(jetBody,jetNose,jetWing,jetTail);
    group.add(logoRoot);
  }else if(type==="bomb"){
    let logoRoot=new THREE.Group();
    logoRoot.position.set(0,0.88,0);
    logoRoot.rotation.x=-Math.PI/2;

    let bombBody=new THREE.Mesh(new THREE.SphereGeometry(0.26,12,8),clusterBombBandMat);
    let bombFin=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.36,0.08),clusterBombBandMat);
    let bombGlow=new THREE.Mesh(new THREE.RingGeometry(0.34,0.48,24),clusterBombGlowMat.clone());

    bombFin.position.y=-0.34;
    bombGlow.position.z=0.04;
    logoRoot.add(bombBody,bombFin,bombGlow);
    group.add(logoRoot);
  }

  group.userData.type=type;
  group.userData.baseY=0;
  return group;
}

function supplyKeyForVillage(village,type){
  return `${Math.round(village.x)}:${Math.round(village.z)}:${type}`;
}

function supplyPointForVillage(village,type,index){
  let baseA=Math.round(village.x*0.37+index*19);
  let typeOffset=type==="rocket" ? 7 : type==="health" ? 31 : type==="boost" ? 47 : type==="jet" ? 67 : type==="bomb" ? 83 : 23;
  let baseB=Math.round(village.z*0.41+typeOffset);
  let villageRadius=village.r || 32;

  for(let attempt=0;attempt<9;attempt++){
    let angle=(hash01(baseA+attempt*13,baseB-attempt*5)+attempt*0.23)*Math.PI*2;
    let dist=villageRadius*(0.16+hash01(baseA-attempt*3,baseB+attempt*11)*0.48);
    let x=village.x+Math.cos(angle)*dist;
    let z=village.z+Math.sin(angle)*dist;
    let y=drivingSurfaceHeight(x,z);

    if(
      Number.isFinite(y)
      && waterDepthAt(x,z)<0.7
      && roadDistance(x,z)>18
      && !world.collidesWithObstacles(x,z)
    ){
      return {x,y,z,angle};
    }
  }

  let fallbackAngle=(type==="rocket" ? 0.3 : type==="health" ? 0.72 : type==="boost" ? 0.95 : type==="jet" ? 1.32 : type==="bomb" ? 1.55 : 1.15)*Math.PI;
  let x=village.x+Math.cos(fallbackAngle)*villageRadius*0.22;
  let z=village.z+Math.sin(fallbackAngle)*villageRadius*0.22;
  return {x,y:drivingSurfaceHeight(x,z),z,angle:fallbackAngle};
}

function spawnSupplyBoxForVillage(village,type,index,key){
  let point=supplyPointForVillage(village,type,index);
  let box=makeSupplyBox(type);
  box.position.set(point.x,point.y+0.68,point.z);
  box.rotation.y=point.angle;
  box.userData.baseY=box.position.y;
  box.userData.key=key;
  scene.add(box);
  supplyBoxes.push(box);
  supplySpawnKeys.add(key);
}

function spawnVillageSupplyBoxes(){
  for(let village of world.activeVillages || []){
    if(!world.isVillageCleared(village)) continue;

    let supplySets=gameMode==="double" ? 2 : 1;
    for(let set=0;set<supplySets;set++){
      for(let type of ["rocket","cannon","health","boost"]){
        let key=supplyKeyForVillage(village,`${type}-${set}`);
        if(supplySpawnKeys.has(key)) continue;

        let typeIndex=type==="rocket" ? 0 : type==="cannon" ? 1 : type==="health" ? 2 : 3;
        spawnSupplyBoxForVillage(village,type,typeIndex+set*4,key);
      }

      if(village.city){
        let key=supplyKeyForVillage(village,`bomb-${set}`);
        if(!supplySpawnKeys.has(key)){
          spawnSupplyBoxForVillage(village,"bomb",8+set,key);
        }
      }
    }
  }
}

function collectSupplyBox(box,car){
  let type=box.userData.type;

  if(type==="rocket"){
    let rocketAmmoCap=maxRocketAmmo();
    let carRocketAmmoCap=maxCarRocketAmmo();
    if(car.rocketAmmo>=rocketAmmoCap && car.carRocketAmmo>=carRocketAmmoCap) return false;
    car.rocketAmmo=Math.min(rocketAmmoCap,car.rocketAmmo+rocketSupplyAmount);
    car.carRocketAmmo=Math.min(carRocketAmmoCap,car.carRocketAmmo+carRocketSupplyAmount);
  }else if(type==="cannon"){
    let cannonAmmoCap=maxCannonAmmo();
    if(car.cannonAmmo>=cannonAmmoCap) return false;
    car.cannonAmmo=Math.min(cannonAmmoCap,car.cannonAmmo+cannonSupplyAmount);
  }else if(type==="boost"){
    if(car.boostCharge>=maxBoostCharge) return false;
    car.boostCharge=Math.min(maxBoostCharge,car.boostCharge+boostSupplyAmount);
  }else if(type==="jet"){
    if(jetUnlocked) return false;
    jetUnlocked=true;
  }else if(type==="bomb"){
    car.clusterBombAmmo+=clusterBombSupplyAmount;
  }else{
    if(car.health>=100) return false;
    let previousHealth=car.health;
    car.health=Math.min(100,car.health+healthSupplyAmount);
    repairRobotDamage(car,car.health-previousHealth);
    hud.updateHealthHud();
  }

  for(let i=0;i<10;i++){
    dust.spawnThrusterParticle(
      box.position.x,
      box.position.y+0.6,
      box.position.z,
      (Math.random()-0.5)*1.2,
      (Math.random()-0.5)*1.2,
      0.7+Math.random()*1.6,
      0.14+Math.random()*0.08,
      0.045+Math.random()*0.035
    );
  }

  scene.remove(box);
  return true;
}

function updateSupplyBoxes(){
  if(supplyScanCooldown<=0){
    spawnVillageSupplyBoxes();
    supplyScanCooldown=30;
  }else{
    supplyScanCooldown--;
  }

  let now=performance.now();
  for(let i=supplyBoxes.length-1;i>=0;i--){
    let box=supplyBoxes[i];
    box.position.y=box.userData.baseY+Math.sin(now*0.003+i)*0.12;
    box.rotation.y+=0.006;

    for(let car of activeCars()){
      if(car.health<=0) continue;
      let dx=box.position.x-car.x;
      let dz=box.position.z-car.z;
      if(dx*dx+dz*dz<5.4*5.4 && Math.abs(box.position.y-car.y)<4.2){
        if(collectSupplyBox(box,car)){
          supplyBoxes.splice(i,1);
          hud.updateSpeedHud();
          break;
        }
      }
    }
  }
}

function clearSupplyBoxes(){
  for(let box of supplyBoxes){
    scene.remove(box);
  }
  supplyBoxes=[];
  supplyScanCooldown=0;
  supplySpawnKeys.clear();
}

function raySphereDistance(origin,direction,x,y,z,radius,minDistance=0){
  let ox=origin.x-x;
  let oy=origin.y-y;
  let oz=origin.z-z;
  let b=ox*direction.x+oy*direction.y+oz*direction.z;
  let c=ox*ox+oy*oy+oz*oz-radius*radius;
  let disc=b*b-c;
  if(disc<0) return null;

  let root=Math.sqrt(disc);
  let near=-b-root;
  if(near>=minDistance) return near;
  let far=-b+root;
  return far>=minDistance ? far : null;
}

function actorAimRadius(actor){
  if(actor.aimRadius) return actor.aimRadius;
  if(actor.isBoss) return 9.5;
  if(actor.isSpider) return 4.8;
  if(actor.isDrone) return 4.2;
  return actor.isEnemy ? 4.5 : 3.2;
}

function setBestAimPointFromRay(best,origin,direction,t){
  mouseAimRayPoint.copy(direction).multiplyScalar(t).add(origin);
  best.t=t;
  best.x=mouseAimRayPoint.x;
  best.y=mouseAimRayPoint.y;
  best.z=mouseAimRayPoint.z;
}

function aimWorldPointFromRay(car,origin,direction){
  let best={t:Infinity,x:0,y:0,z:0};
  let minDistance=5;

  for(let actor of combatActors()){
    if(actor===car) continue;
    if(actor.isEnemy && (!actor.active || actor.health<=0)) continue;
    let radius=actorAimRadius(actor);
    let t=raySphereDistance(origin,direction,actor.x,actor.y+2.0,actor.z,radius,minDistance);
    if(t!==null && t<best.t && t<mouseAimMaxDistance){
      setBestAimPointFromRay(best,origin,direction,t);
    }
  }

  if(mothership && mothership.health>0){
    let shipY=mothership.group ? mothership.group.position.y : mothership.y;
    let t=raySphereDistance(origin,direction,mothership.x,shipY,mothership.z,24,minDistance);
    if(t!==null && t<best.t && t<mouseAimMaxDistance){
      setBestAimPointFromRay(best,origin,direction,t);
    }
  }

  for(let box of supplyBoxes){
    let t=raySphereDistance(origin,direction,box.position.x,box.position.y,box.position.z,1.6,minDistance);
    if(t!==null && t<best.t && t<mouseAimMaxDistance){
      setBestAimPointFromRay(best,origin,direction,t);
    }
  }

  let previousT=minDistance;
  mouseAimRayStart.copy(direction).multiplyScalar(previousT).add(origin);
  let previousSurface=drivingSurfaceHeight(mouseAimRayStart.x,mouseAimRayStart.z)+0.15;
  let step=6;

  for(let t=minDistance+step;t<=mouseAimMaxDistance;t+=step){
    mouseAimRayEnd.copy(direction).multiplyScalar(t).add(origin);

    let obstacleHitInfo={};
    let obstacle=world.obstacleAlongSegment3D(
      mouseAimRayStart.x,
      mouseAimRayStart.y,
      mouseAimRayStart.z,
      mouseAimRayEnd.x,
      mouseAimRayEnd.y,
      mouseAimRayEnd.z,
      0.35,
      obstacleHitInfo
    );
    let exactRockHitInfo={};
    let exactRock=world.rockObstacleAlongSegmentExact
      ? world.rockObstacleAlongSegmentExact(
        mouseAimRayStart.x,
        mouseAimRayStart.y,
        mouseAimRayStart.z,
        mouseAimRayEnd.x,
        mouseAimRayEnd.y,
        mouseAimRayEnd.z,
        exactRockHitInfo
      )
      : null;
    if(obstacle){
      let obstacleY=Number.isFinite(obstacle.y)
        ? obstacle.y
        : groundHeight(obstacle.x,obstacle.z)+Math.max(0.6,obstacle.r*0.45);
      let obstacleT=Number.isFinite(obstacleHitInfo.distance)
        ? previousT+obstacleHitInfo.distance
        : (obstacle.x-origin.x)*direction.x+(obstacleY-origin.y)*direction.y+(obstacle.z-origin.z)*direction.z;
      obstacleT=clamp(obstacleT,minDistance,t);
      if(obstacleT<best.t){
        setBestAimPointFromRay(best,origin,direction,obstacleT);
      }
    }
    if(exactRock && Number.isFinite(exactRockHitInfo.distance)){
      let obstacleT=clamp(previousT+exactRockHitInfo.distance,minDistance,t);
      if(obstacleT<best.t){
        setBestAimPointFromRay(best,origin,direction,obstacleT);
      }
    }

    let surface=drivingSurfaceHeight(mouseAimRayEnd.x,mouseAimRayEnd.z)+0.15;
    if(mouseAimRayEnd.y<=surface && mouseAimRayStart.y>previousSurface){
      let low=previousT;
      let high=t;
      for(let i=0;i<7;i++){
        let mid=(low+high)*0.5;
        mouseAimRayPoint.copy(direction).multiplyScalar(mid).add(origin);
        if(mouseAimRayPoint.y<=drivingSurfaceHeight(mouseAimRayPoint.x,mouseAimRayPoint.z)+0.15) high=mid;
        else low=mid;
      }
      if(high<best.t){
        setBestAimPointFromRay(best,origin,direction,high);
      }
      break;
    }

    if(best.t<t) break;
    previousT=t;
    mouseAimRayStart.copy(mouseAimRayEnd);
    previousSurface=surface;
  }

  if(Number.isFinite(best.t)){
    mouseAimHitPoint.set(best.x,best.y,best.z);
  }else{
    mouseAimHitPoint.copy(direction).multiplyScalar(mouseAimFallbackDistance).add(origin);
  }

  return mouseAimHitPoint;
}

function mouseAimWorldPointFromRay(car){
  return aimWorldPointFromRay(car,mouseAimRaycaster.ray.origin,mouseAimRaycaster.ray.direction);
}

function gamepadAimWorldPointFromCross(car){
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);
  let offsetX=car.controllerAimOffsetX || 0;
  let offsetY=car.controllerAimOffsetY || 0;

  controllerAimWorldPoint.set(
    car.x+forwardX*32+rightX*offsetX,
    car.y+3.15+offsetY,
    car.z+forwardZ*32+rightZ*offsetX
  );
  controllerAimOrigin.set(car.x,car.y+2.6,car.z);
  controllerAimDirection.copy(controllerAimWorldPoint).sub(controllerAimOrigin);
  if(controllerAimDirection.lengthSq()<0.001){
    controllerAimDirection.set(forwardX,0,forwardZ);
  }else{
    controllerAimDirection.normalize();
  }
  return aimWorldPointFromRay(car,controllerAimOrigin,controllerAimDirection);
}

function aimTargetForCar(car){
  if(car.isEnemy && car.aiTarget){
    return new THREE.Vector3(
      car.aiTarget.x,
      car.aiTarget.y+2.15,
      car.aiTarget.z
    );
  }

  if(car.hasMouseAimPoint || car.hasGamepadAimPoint){
    return new THREE.Vector3(
      car.mouseAimWorldX,
      car.mouseAimWorldY,
      car.mouseAimWorldZ
    );
  }

  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);

  return new THREE.Vector3(
    car.x+forwardX*72+rightX*car.aimOffsetX*2.25,
    car.y+3.15+car.aimOffsetY*2.25+rocketAimYOffset,
    car.z+forwardZ*72+rightZ*car.aimOffsetX*2.25
  );
}

function updateAimCross(car){
  if(!car.aimCross) return;

  let aim=input.getGamepadAim(car.gamepadIndex);
  let gamepadAimActive=Math.abs(aim.x)>0.001 || Math.abs(aim.y)>0.001;
  let mouseMoved=input.mouse.hasPosition && input.mouse.version!==car.lastAimMouseVersion;

  if(gamepadAimActive){
    car.hasMouseAimPoint=false;
    car.hasGamepadAimPoint=true;
    car.controllerAimOffsetX=clamp((car.controllerAimOffsetX || 0)-aim.x*0.42,-11,11);
    car.controllerAimOffsetY=clamp((car.controllerAimOffsetY || 0)-aim.y*0.32,aimOffsetYMin,aimOffsetYMax);
  }else if(gameMode==="single" && car===playerCar && mouseMoved){
    car.hasGamepadAimPoint=false;
    mouseAimPointer.set(
      (input.mouse.x/innerWidth)*2-1,
      -(input.mouse.y/innerHeight)*2+1
    );
    mouseAimRaycaster.setFromCamera(mouseAimPointer,car.camera);
    let worldPoint=mouseAimWorldPointFromRay(car);
    car.mouseAimWorldX=worldPoint.x;
    car.mouseAimWorldY=worldPoint.y;
    car.mouseAimWorldZ=worldPoint.z;
    car.hasMouseAimPoint=true;
    car.lastAimMouseVersion=input.mouse.version;
  }

  if(!car.hasMouseAimPoint && !car.hasGamepadAimPoint){
    car.hasGamepadAimPoint=true;
  }

  if(car.hasGamepadAimPoint){
    let worldPoint=gamepadAimWorldPointFromCross(car);
    car.mouseAimWorldX=worldPoint.x;
    car.mouseAimWorldY=worldPoint.y;
    car.mouseAimWorldZ=worldPoint.z;
  }

  if(car.hasMouseAimPoint || car.hasGamepadAimPoint){
    mouseAimHitPoint.set(car.mouseAimWorldX,car.mouseAimWorldY,car.mouseAimWorldZ);
    let forwardX=Math.sin(car.angle);
    let forwardZ=Math.cos(car.angle);
    let rightX=Math.cos(car.angle);
    let rightZ=-Math.sin(car.angle);
    let dx=mouseAimHitPoint.x-car.x;
    let dz=mouseAimHitPoint.z-car.z;
    let localX=dx*rightX+dz*rightZ;
    let localZ=dx*forwardX+dz*forwardZ;
    let localY=mouseAimHitPoint.y-car.y;
    if(localZ>4){
      car.aimOffsetX=localX;
      car.aimOffsetY=localY-3.15;
      car.aimDistance=localZ;
    }else{
      car.hasMouseAimPoint=false;
      car.hasGamepadAimPoint=false;
      car.aimDistance=32;
    }
  }

  let jetBombAim=car.jetMode || car.jetProgress>0.35;
  if(jetBombAim){
    let impact=clusterBombImpactPointForCar(car);
    aimCrossWorldPoint.set(impact.x,impact.y,impact.z);
  }else{
    let aimDisplayDistance=car.aimDistance || 32;
    let forwardX=Math.sin(car.angle);
    let forwardZ=Math.cos(car.angle);
    let rightX=Math.cos(car.angle);
    let rightZ=-Math.sin(car.angle);
    aimCrossWorldPoint.set(
      car.x+forwardX*aimDisplayDistance+rightX*car.aimOffsetX,
      car.y+3.15+car.aimOffsetY,
      car.z+forwardZ*aimDisplayDistance+rightZ*car.aimOffsetX
    );
  }
  car.group.updateMatrixWorld(true);
  car.aimCross.position.copy(aimCrossWorldPoint);
  car.group.worldToLocal(car.aimCross.position);
  aimCrossYawQuaternion.setFromAxisAngle(aimCrossYawAxis,car.angle);
  aimCrossParentInverseQuaternion.copy(car.group.quaternion).invert();
  car.aimCross.quaternion.copy(aimCrossParentInverseQuaternion).multiply(aimCrossYawQuaternion);

  let locked=!!nearbyRocketTargetForCar(car);
  let ring=car.aimCross.userData.ring;
  let cross=car.aimCross.userData.cross;
  let ringColor=locked ? car.aimCross.userData.lockColor : car.aimCross.userData.baseRingColor;
  let crossColor=locked ? car.aimCross.userData.lockColor : car.aimCross.userData.baseCrossColor;
  if(ring && ring.material) ring.material.color.copy(ringColor);
  if(cross && cross.material) cross.material.color.copy(crossColor);
}

function rocketLaunchPointForCar(car){
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);
  let side=car.rocketLauncherSide || 1;
  car.rocketLauncherSide=-side;

  if(car.carModel){
    car.group.position.set(car.x,Number.isFinite(car.renderY) ? car.renderY : car.y,car.z);
    car.group.rotation.y=car.angle+car.trickYaw;
    car.group.rotation.x=car.pitch+car.trickPitch;
    car.group.rotation.z=car.trickRoll+(car.jetBank || 0);
    car.group.updateMatrixWorld(true);

    let launcherPoint=new THREE.Vector3(side*0.86,1.08,0.92);
    car.carModel.localToWorld(launcherPoint);
    return launcherPoint;
  }

  return new THREE.Vector3(
    car.x+forwardX*0.55+rightX*side*0.86,
    car.y+1.65,
    car.z+forwardZ*0.55+rightZ*side*0.86
  );
}

function rocketLaunchPointForRobot(car){
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);

  return new THREE.Vector3(
    car.x+forwardX*2.6+rightX*1.75,
    car.y+2.25,
    car.z+forwardZ*2.6+rightZ*1.75
  );
}

function nearbyRocketTargetForCar(car){
  if(car.isEnemy) return null;

  let best=null;
  let bestScore=Infinity;
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let minLockRange=100;
  let maxLockRange=350;

  for(let enemy of activeEnemies()){
    let dx=enemy.x-car.x;
    let dz=enemy.z-car.z;
    let distSq=dx*dx+dz*dz;
    if(distSq<minLockRange*minLockRange || distSq>maxLockRange*maxLockRange) continue;

    let dist=Math.max(0.001,Math.sqrt(distSq));
    let alignment=(dx*forwardX+dz*forwardZ)/dist;
    let anglePenalty=alignment<0 ? 48 : (1-alignment)*28;
    let score=dist+anglePenalty;

    if(score<bestScore){
      best=enemy;
      bestScore=score;
    }
  }

  return best;
}

function rocketTargetPoint(target){
  return new THREE.Vector3(target.x,target.y+2.2,target.z);
}

function fireRocket(car){
  if(gameOver || car.health<=0 || car.rocketCooldown>0) return;
  if(car.jetMode || car.jetProgress>0.35) return;
  if(!car.isEnemy && !rocketLauncherUnlocked()) return;
  if(playerCombatSuppressed(car)) return;
  if(!car.isEnemy && actorInsideBuilding(car)) return;

  let mesh=makeRocketMesh();
  let carRocketMode=car.morphed && car.morphProgress>=0.72;
  let robotRocketMode=!car.morphed && car.morphProgress<0.35;
  if(!carRocketMode && !robotRocketMode) return;
  if(!car.isEnemy && (carRocketMode ? car.carRocketAmmo<=0 : car.rocketAmmo<=0)) return;
  if(carRocketMode) mesh.scale.setScalar(1.22);
  let launchPoint=carRocketMode ? rocketLaunchPointForCar(car) : rocketLaunchPointForRobot(car);
  let startX=launchPoint.x;
  let startY=launchPoint.y;
  let startZ=launchPoint.z;
  let targetActor=nearbyRocketTargetForCar(car);
  let aimPoint=targetActor ? rocketTargetPoint(targetActor) : aimTargetForCar(car);
  let aimX=aimPoint.x-startX;
  let aimY=aimPoint.y-startY;
  let aimZ=aimPoint.z-startZ;
  let aimLen=Math.max(0.001,Math.hypot(aimX,aimY,aimZ));

  if(!carRocketMode){
    let rocketLife=targetActor
      ? Math.min(420,Math.max(150,Math.ceil(aimLen/rocketSpeed)+110))
      : Math.min(620,Math.max(180,Math.ceil(aimLen/rocketSpeed)+90));
    let targetDistance=targetActor ? 260 : Math.max(280,aimLen);
    let target={
      x:startX+(aimX/aimLen)*targetDistance,
      y:startY+(aimY/aimLen)*targetDistance,
      z:startZ+(aimZ/aimLen)*targetDistance
    };
    mesh.position.set(startX,startY,startZ);
    mesh.rotation.y=Math.atan2(aimX,aimZ);
    mesh.rotation.x=-Math.asin(clamp(aimY/aimLen,-1,1));
    scene.add(mesh);

    rockets.push({
      owner:car,
      mesh,
      x:startX,
      y:startY,
      z:startZ,
      angle:Math.atan2(aimX,aimZ),
      targetX:target.x,
      targetY:target.y,
      targetZ:target.z,
      targetActor,
      vx:(aimX/aimLen)*rocketSpeed,
      vz:(aimZ/aimLen)*rocketSpeed,
      vy:(aimY/aimLen)*rocketSpeed,
      age:0,
      life:rocketLife
    });

    motorAudio.playRocketLaunch(car);
    car.rocketCooldown=rocketCooldownFrames;
    if(!car.isEnemy) car.rocketAmmo=Math.max(0,car.rocketAmmo-1);
    return;
  }

  let projectileSpeed=longRangeRocketSpeed;
  let targetDistance=targetActor ? Math.max(420,aimLen+90) : Math.max(620,Math.min(aimLen,620));
  let target={
    x:startX+(aimX/aimLen)*targetDistance,
    y:startY+(aimY/aimLen)*targetDistance,
    z:startZ+(aimZ/aimLen)*targetDistance
  };
  if(targetActor){
    target.x=aimPoint.x;
    target.y=aimPoint.y;
    target.z=aimPoint.z;
  }else{
    target.y=Math.max(drivingSurfaceHeight(target.x,target.z)+1.2,target.y);
  }
  let targetDx=target.x-startX;
  let targetDz=target.z-startZ;
  let horizontalDistance=Math.max(1,Math.hypot(targetDx,targetDz));
  let gravity=0.0075;
  let flightTime=clamp(horizontalDistance/(projectileSpeed*1.55),55,160);
  let vx=targetDx/flightTime;
  let vz=targetDz/flightTime;
  let vy=(target.y-startY+0.5*gravity*flightTime*flightTime)/flightTime;
  let rocketLife=Math.ceil(flightTime)+45;
  mesh.position.set(startX,startY,startZ);
  mesh.rotation.y=Math.atan2(vx,vz);
  mesh.rotation.x=-Math.atan2(vy,Math.max(0.001,Math.hypot(vx,vz)));
  scene.add(mesh);

  rockets.push({
    owner:car,
    mesh,
    x:startX,
    y:startY,
    z:startZ,
    angle:Math.atan2(aimX,aimZ),
    targetX:target.x,
    targetY:target.y,
    targetZ:target.z,
    targetActor,
    vx,
    vz,
    vy,
    speed:projectileSpeed,
    longRange:true,
    trailEvery:1,
    trailScale:1.55,
    age:0,
    life:rocketLife,
    impactAge:Math.ceil(flightTime),
    ballistic:true,
    gravity,
    damage:24,
    blastRadius:18
  });

  for(let i=0;i<12;i++){
    dust.spawnThrusterParticle(
      startX,
      startY,
      startZ,
      -(aimX/aimLen)*(2.3+Math.random()*2.8)+(Math.random()-0.5)*1.2,
      -(aimZ/aimLen)*(2.3+Math.random()*2.8)+(Math.random()-0.5)*1.2,
      -(aimY/aimLen)*(1.0+Math.random()*1.6)+(Math.random()-0.5)*0.9,
      0.22+Math.random()*0.12,
      0.1+Math.random()*0.06
    );
  }

  motorAudio.playRocketLaunch(car);
  car.rocketCooldown=rocketCooldownFrames;
  if(!car.isEnemy) car.carRocketAmmo=Math.max(0,car.carRocketAmmo-1);
}

function fireBoatMissile(boat,target){
  if(gameOver || !boat || !target || boat.health<=0 || boat.cannonCooldown>0) return false;

  let forwardX=Math.sin(boat.angle);
  let forwardZ=Math.cos(boat.angle);
  let rightX=Math.cos(boat.angle);
  let rightZ=-Math.sin(boat.angle);
  let side=boat.missileSide || 1;
  boat.missileSide=-side;

  let startX=boat.x+forwardX*2.4+rightX*side*1.35;
  let startY=boat.y+2.15;
  let startZ=boat.z+forwardZ*2.4+rightZ*side*1.35;
  let targetX=target.x;
  let targetY=Math.max(target.y+1.4,waterLevel+1.4);
  let targetZ=target.z;
  let dx=targetX-startX;
  let dz=targetZ-startZ;
  let distance=Math.max(1,Math.hypot(dx,dz));
  let flightTime=clamp(distance/1.45,95,210);
  let gravity=0.018;
  let mesh=makeRocketMesh();
  mesh.scale.setScalar(1.28);
  mesh.position.set(startX,startY,startZ);
  scene.add(mesh);

  let vx=dx/flightTime;
  let vz=dz/flightTime;
  let vy=(targetY-startY+0.5*gravity*flightTime*flightTime)/flightTime;
  let angle=Math.atan2(vx,vz);
  mesh.rotation.y=angle;
  mesh.rotation.x=-Math.atan2(vy,Math.max(0.001,Math.hypot(vx,vz)));

  rockets.push({
    owner:boat,
    mesh,
    x:startX,
    y:startY,
    z:startZ,
    angle,
    targetX,
    targetY,
    targetZ,
    vx,
    vy,
    vz,
    age:0,
    life:Math.ceil(flightTime)+28,
    impactAge:Math.ceil(flightTime),
    ballistic:true,
    gravity,
    boatMissile:true,
    trailEvery:1,
    trailScale:1.45,
    damage:22,
    blastRadius:18
  });

  motorAudio.playRocketLaunch(boat);
  boat.cannonCooldown=scaledDelay(175+Math.floor(Math.random()*115),currentDifficulty().fireDelay);
  return true;
}

function buggyRocketLaunchPoint(buggy){
  let launcher=buggy.buggyModel && buggy.buggyModel.userData ? buggy.buggyModel.userData.launcher : null;
  if(launcher){
    buggy.group.updateMatrixWorld(true);
    launcher.updateWorldMatrix(true,false);
    let side=buggy.rocketLauncherSide || 1;
    buggy.rocketLauncherSide=-side;
    return launcher.localToWorld(new THREE.Vector3(side*0.34,0,1.74));
  }

  let forwardX=Math.sin(buggy.angle);
  let forwardZ=Math.cos(buggy.angle);
  let rightX=Math.cos(buggy.angle);
  let rightZ=-Math.sin(buggy.angle);
  return new THREE.Vector3(
    buggy.x+forwardX*1.6+rightX*(buggy.rocketLauncherSide || 1)*0.36,
    buggy.y+3.72,
    buggy.z+forwardZ*1.6+rightZ*(buggy.rocketLauncherSide || 1)*0.36
  );
}

function fireEnemyBuggyRocket(buggy,target){
  if(gameOver || !buggy || !target || buggy.health<=0 || buggy.cannonCooldown>0) return false;
  if(playerInvisibleToEnemies(target)) return false;

  let start=buggyRocketLaunchPoint(buggy);
  let targetSpeed=Number.isFinite(target.speed) ? target.speed : 0;
  let leadFrames=clamp(Math.hypot(target.x-start.x,target.z-start.z)/2.1,24,72);
  let targetX=target.x+Math.sin(target.velAngle || target.angle || 0)*targetSpeed*leadFrames;
  let targetZ=target.z+Math.cos(target.velAngle || target.angle || 0)*targetSpeed*leadFrames;
  let targetY=Math.max(target.y+1.4,drivingSurfaceHeight(targetX,targetZ)+1.2);
  let dx=targetX-start.x;
  let dz=targetZ-start.z;
  let distance=Math.max(1,Math.hypot(dx,dz));
  let flightTime=clamp(distance/1.62,84,180);
  let gravity=0.016;
  let vx=dx/flightTime;
  let vz=dz/flightTime;
  let vy=(targetY-start.y+0.5*gravity*flightTime*flightTime)/flightTime;
  let mesh=makeRocketMesh();

  mesh.scale.setScalar(1.16);
  mesh.position.copy(start);
  scene.add(mesh);

  let angle=Math.atan2(vx,vz);
  mesh.rotation.y=angle;
  mesh.rotation.x=-Math.atan2(vy,Math.max(0.001,Math.hypot(vx,vz)));

  rockets.push({
    owner:buggy,
    mesh,
    x:start.x,
    y:start.y,
    z:start.z,
    angle,
    targetX,
    targetY,
    targetZ,
    vx,
    vy,
    vz,
    age:0,
    life:Math.ceil(flightTime)+42,
    impactAge:Math.ceil(flightTime),
    ballistic:true,
    gravity,
    longRange:true,
    trailEvery:1,
    trailScale:1.24,
    damage:20,
    blastRadius:19
  });

  let aimLen=Math.max(0.001,Math.hypot(vx,vy,vz));
  for(let i=0;i<10;i++){
    dust.spawnThrusterParticle(
      start.x,
      start.y,
      start.z,
      -(vx/aimLen)*(2.1+Math.random()*2.2)+(Math.random()-0.5)*1.0,
      -(vz/aimLen)*(2.1+Math.random()*2.2)+(Math.random()-0.5)*1.0,
      -(vy/aimLen)*(1.0+Math.random()*1.4)+(Math.random()-0.5)*0.7,
      0.2+Math.random()*0.1,
      0.08+Math.random()*0.05
    );
  }

  if(motorAudio.playRocketLaunch) motorAudio.playRocketLaunch(buggy);
  buggy.cannonCooldown=scaledDelay(138+Math.floor(Math.random()*84),currentDifficulty().fireDelay);
  return true;
}

function rattleCar(car,amount=1){
  car.hitRattle=Math.max(car.hitRattle,amount);
  car.hitRattleSeed=Math.random()*Math.PI*2;
}

function updateRocketInput(car){
  if(car.rocketCooldown>0) car.rocketCooldown--;

  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let pressedRocketTrigger=buttons.leftTrigger && !car.lastRocketButton;
  let mouseRocket=gameMode==="single" && car===playerCar && input.mouse.right;
  let pressedMouse=mouseRocket && !car.lastRocketButton;
  if(pressedRocketTrigger || pressedMouse) fireRocket(car);
  car.lastRocketButton=buttons.leftTrigger || mouseRocket;
}

function makeCannonBoltMesh(){
  let group=new THREE.Group();
  let body=new THREE.Mesh(cannonBodyGeo,cannonBodyMat);
  body.rotation.x=Math.PI/2;
  group.add(body);

  let core=new THREE.Mesh(cannonCoreGeo,cannonCoreMat);
  core.position.z=0.25;
  group.add(core);

  let glow=new THREE.Mesh(cannonGlowGeo,cannonGlowMat);
  glow.position.z=0.25;
  group.add(glow);

  return group;
}

function makeClusterBombMesh(){
  let group=new THREE.Group();
  let body=new THREE.Mesh(clusterBombBodyGeo,clusterBombBodyMat);
  body.scale.set(1.7,1.7,2.35);
  group.add(body);

  let band=new THREE.Mesh(new THREE.TorusGeometry(0.86,0.09,8,22),clusterBombBandMat);
  band.rotation.x=Math.PI/2;
  band.position.z=0.04;
  group.add(band);

  for(let side of [-1,1]){
    let fin=new THREE.Mesh(clusterBombFinGeo,clusterBombBandMat);
    fin.scale.set(2.2,2.2,2.2);
    fin.position.set(side*0.86,0,-0.82);
    fin.rotation.z=side*0.35;
    group.add(fin);
  }

  let glow=new THREE.Mesh(clusterBombGlowGeo,clusterBombGlowMat.clone());
  glow.name="cluster-bomb-glow";
  group.add(glow);
  group.userData.glow=glow;

  group.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
    }
  });

  return group;
}

function cannonLaunchPointForCar(car){
  let parts=car.mechModel && car.mechModel.userData ? car.mechModel.userData.walkParts : null;
  let hand=parts && parts.left ? parts.left.hand : null;

  if(hand){
    hand.updateWorldMatrix(true,false);
    return hand.localToWorld(new THREE.Vector3(0,0,0.36));
  }

  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);
  return new THREE.Vector3(
    car.x+forwardX*2.2-rightX*2.15,
    car.y+2.85,
    car.z+forwardZ*2.2-rightZ*2.15
  );
}

function playerLaserLaunchPointForCar(car){
  let parts=car.mechModel && car.mechModel.userData ? car.mechModel.userData.walkParts : null;
  let cannon=parts && parts.right ? parts.right.cannon : null;

  if(cannon){
    cannon.updateWorldMatrix(true,false);
    return cannon.localToWorld(new THREE.Vector3(0,0.82,0));
  }

  return cannonLaunchPointForCar(car);
}

function stopPlayerLaserSound(car){
  if(!car || !car.laserSoundStop) return;
  car.laserSoundStop();
  car.laserSoundStop=null;
}

function playerLaserReloadFramesFromRemaining(car){
  let remaining=Math.max(0,Math.min(playerLaserFireFrames,car && car.laserFireFrames || 0));
  return Math.max(0,playerLaserFireFrames-remaining);
}

function clearPlayerLaserBeam(car){
  let beam=car && car.laserBeam;
  stopPlayerLaserSound(car);
  if(!beam) return;

  for(let layer of beam.layers || []){
    let object=layer.object || layer.line;
    if(object) scene.remove(object);
    if(layer.geometry && layer.disposeGeometry!==false) layer.geometry.dispose();
    if(layer.material) layer.material.dispose();
  }
  for(let impact of beam.impacts || []){
    scene.remove(impact.mesh);
    if(impact.material) impact.material.dispose();
  }
  car.laserBeam=null;
}

function ensurePlayerLaserBeam(car){
  if(car.laserBeam) return car.laserBeam;

  let layers=[];
  let configs=[
    {kind:"tube",material:playerLaserOuterTubeMat.clone(),renderOrder:28,radius:0.42,opacity:0.12},
    {kind:"tube",material:playerLaserTubeMat.clone(),renderOrder:29,radius:0.18,opacity:0.22},
    {kind:"line",material:playerLaserMat.clone(),renderOrder:32},
    {kind:"line",material:playerLaserGlowMat.clone(),renderOrder:31,opacity:0.72},
    {kind:"line",material:playerLaserGlowMat.clone(),renderOrder:30,opacity:0.44}
  ];

  for(let config of configs){
    let geometry;
    let object;
    if(config.kind==="tube"){
      geometry=playerLaserTubeGeo;
      object=new THREE.Mesh(geometry,config.material);
    }else{
      geometry=new THREE.BufferGeometry();
      geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(6),3));
      object=new THREE.Line(geometry,config.material);
    }
    object.renderOrder=config.renderOrder;
    object.frustumCulled=false;
    if(Number.isFinite(config.opacity)) config.material.opacity=config.opacity;
    scene.add(object);
    layers.push({
      kind:config.kind,
      object,
      line:config.kind==="line" ? object : null,
      geometry,
      material:config.material,
      radius:config.radius || 1,
      opacity:config.opacity,
      disposeGeometry:config.kind!=="tube"
    });
  }

  let impactCore=new THREE.Mesh(playerLaserImpactCoreGeo,playerLaserImpactCoreMat.clone());
  let impactHalo=new THREE.Mesh(playerLaserImpactCoreGeo,playerLaserImpactHaloMat.clone());
  impactCore.renderOrder=33;
  impactHalo.renderOrder=32;
  impactCore.frustumCulled=false;
  impactHalo.frustumCulled=false;
  impactCore.visible=false;
  impactHalo.visible=false;
  scene.add(impactHalo,impactCore);

  car.laserBeam={
    layers,
    impacts:[
      {mesh:impactHalo,material:impactHalo.material,baseScale:1.35,opacity:0.38},
      {mesh:impactCore,material:impactCore.material,baseScale:0.34,opacity:0.92}
    ]
  };
  return car.laserBeam;
}

function setPlayerLaserLayer(layer,from,to,offset){
  if(layer.kind==="tube"){
    let direction=to.clone().sub(from);
    let length=Math.max(0.01,direction.length());
    direction.normalize();
    layer.object.position.set(
      (from.x+to.x)*0.5+offset.x,
      (from.y+to.y)*0.5+offset.y,
      (from.z+to.z)*0.5+offset.z
    );
    layer.object.quaternion.setFromUnitVectors(playerLaserYAxis,direction);
    layer.object.scale.set(layer.radius,length,layer.radius);
    return;
  }

  let position=layer.geometry.attributes.position;
  position.setXYZ(0,from.x+offset.x,from.y+offset.y,from.z+offset.z);
  position.setXYZ(1,to.x+offset.x,to.y+offset.y,to.z+offset.z);
  position.needsUpdate=true;
  layer.geometry.computeBoundingSphere();
}

function updatePlayerLaserBeamVisual(car,from,to){
  let beam=ensurePlayerLaserBeam(car);
  let direction=to.clone().sub(from);
  if(direction.lengthSq()<0.001) direction.set(0,0,1);
  direction.normalize();
  let side=new THREE.Vector3(-direction.z,0,direction.x);
  if(side.lengthSq()<0.001) side.set(1,0,0);
  side.normalize();
  let up=new THREE.Vector3(0,1,0);
  let pulse=0.5+0.5*Math.sin(performance.now()*0.04);
  let offsets=[
    new THREE.Vector3(0,0,0),
    side.clone().multiplyScalar(0.16+pulse*0.06),
    up.clone().multiplyScalar(-0.12-pulse*0.04)
  ];

  for(let i=0;i<beam.layers.length;i++){
    let layer=beam.layers[i];
    setPlayerLaserLayer(layer,from,to,offsets[i] || offsets[0]);
    if(layer.kind==="tube"){
      layer.material.opacity=(layer.opacity || 0.16)+pulse*(i===0 ? 0.08 : 0.12);
      let radiusScale=1+pulse*(i===0 ? 0.24 : 0.18);
      layer.object.scale.x*=radiusScale;
      layer.object.scale.z*=radiusScale;
    }else{
      layer.material.opacity=(i===2 ? 0.9 : i===3 ? 0.56 : 0.34)+pulse*(i===2 ? 0.1 : 0.16);
    }
  }

  if(beam.impacts){
    for(let i=0;i<beam.impacts.length;i++){
      let impact=beam.impacts[i];
      let scale=impact.baseScale*(1+pulse*(i===0 ? 0.55 : 0.35));
      impact.mesh.position.copy(to);
      impact.mesh.scale.setScalar(scale);
      impact.material.opacity=impact.opacity*(0.76+pulse*0.24);
      impact.mesh.visible=true;
    }
  }
}

function playerLaserHitForCar(car,from,aimPoint){
  let direction=aimPoint.clone().sub(from);
  if(direction.lengthSq()<0.001) return {point:from.clone(),actor:null,obstacle:null,mothershipHit:null};
  direction.normalize();

  let maxDistance=560;
  let best={t:maxDistance,actor:null,obstacle:null,mothershipHit:null};

  for(let actor of combatActors()){
    if(actor===car) continue;
    if(!actor.isEnemy) continue;
    if(!actor.active || actor.health<=0) continue;
    if(playerInvisibleToEnemies(actor)) continue;
    let radius=Math.max(actorAimRadius(actor),actor.collisionRadius || 0);
    let t=raySphereDistance(from,direction,actor.x,actor.y+2.0,actor.z,radius,1);
    if(t!==null && t<best.t) best={t,actor,obstacle:null,mothershipHit:null};
  }

  if(mothership && mothership.health>0 && !mothership.beamingOut){
    let shipY=mothership.group ? mothership.group.position.y : mothership.y;
    let t=raySphereDistance(from,direction,mothership.x,shipY,mothership.z,24,1);
    if(t!==null && t<best.t){
      playerLaserPointB.copy(direction).multiplyScalar(t).add(from);
      best={t,actor:null,obstacle:null,mothershipHit:{x:playerLaserPointB.x,y:playerLaserPointB.y,z:playerLaserPointB.z}};
    }
  }

  let end=playerLaserPointB.copy(direction).multiplyScalar(maxDistance).add(from).clone();
  let obstacleHitInfo={};
  let obstacle=world.obstacleAlongSegment3D(from.x,from.y,from.z,end.x,end.y,end.z,0.8,obstacleHitInfo);
  let exactRockHitInfo={};
  let exactRock=world.rockObstacleAlongSegmentExact
    ? world.rockObstacleAlongSegmentExact(from.x,from.y,from.z,end.x,end.y,end.z,exactRockHitInfo)
    : null;
  if(obstacle){
    let obstacleY=Number.isFinite(obstacle.y)
      ? obstacle.y
      : groundHeight(obstacle.x,obstacle.z)+Math.max(0.6,obstacle.r*0.45);
    let t=Number.isFinite(obstacleHitInfo.distance)
      ? obstacleHitInfo.distance
      : (obstacle.x-from.x)*direction.x+(obstacleY-from.y)*direction.y+(obstacle.z-from.z)*direction.z;
    t=clamp(t,1,maxDistance);
    if(t<best.t) best={t,actor:null,obstacle,mothershipHit:null};
  }
  if(exactRock && Number.isFinite(exactRockHitInfo.distance)){
    let t=clamp(exactRockHitInfo.distance,1,maxDistance);
    if(t<best.t) best={t,actor:null,obstacle:exactRock,mothershipHit:null};
  }

  let previousPoint=playerLaserPointA.copy(direction).multiplyScalar(1).add(from).clone();
  for(let t=8;t<=best.t;t+=8){
    let point=playerLaserPointB.copy(direction).multiplyScalar(t).add(from);
    let surface=drivingSurfaceHeight(point.x,point.z)+0.2;
    if(point.y<=surface && previousPoint.y>drivingSurfaceHeight(previousPoint.x,previousPoint.z)+0.2){
      let nearRock=rockNearImpact(point.x,point.y,point.z,4.8);
      best={t,actor:null,obstacle:nearRock,mothershipHit:null};
      break;
    }
    previousPoint.copy(point);
  }

  let point=direction.clone().multiplyScalar(best.t).add(from);
  return {...best,point};
}

function applyPlayerLaserDamage(car,hit){
  if(!hit || playerCombatSuppressed(car)) return;

  let point=hit.point || {x:car.x,y:car.y,z:car.z};
  if(hit.actor){
    damageActor(hit.actor,playerLaserDamageAmount,{x:point.x,y:point.y,z:point.z});
    rattleActor(hit.actor,1.05);
  }
  if(hit.mothershipHit){
    damageMothership(point.x,point.y,point.z,playerLaserMothershipDamage);
  }
  if(hit.obstacle){
    if(hit.obstacle.type==="bossBase"){
      damageBossBaseObstacle(hit.obstacle,point.x,point.y,point.z,playerLaserDamageAmount*2.4);
    }else if(hit.obstacle.type==="building" || hit.obstacle.type==="wall"){
      spawnBuildingAmmoImpact(hit.obstacle,point.x,point.y,point.z,playerLaserDamageAmount*2);
      if(damageWorldObstacle(hit.obstacle,playerLaserDamageAmount*2.4)){
        spawnObstacleDestructionDebris(hit.obstacle,point.y);
      }
    }else if(hit.obstacle.type==="rock" || hit.obstacle.type==="smallRock" || hit.obstacle.type==="turret" || hit.obstacle.type==="radarOutpost"){
      if(damageWorldObstacle(hit.obstacle,playerLaserDamageAmount*2)){
        spawnObstacleDestructionDebris(hit.obstacle,point.y);
      }
    }
  }

  for(let i=0;i<3;i++){
    dust.spawnThrusterParticle(
      point.x,
      point.y,
      point.z,
      (Math.random()-0.5)*1.4,
      (Math.random()-0.5)*1.4,
      (Math.random()-0.5)*1.1,
      0.09+Math.random()*0.05,
      0.035+Math.random()*0.03
    );
  }
}

function updatePlayerLaserInput(car){
  if(car.laserCooldown>0) car.laserCooldown--;

  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let keyboardLaser=car===playerCar && input.keys.r;
  let laserButton=buttons.x || keyboardLaser;
  let pressedLaser=laserButton && !car.lastLaserButton;
  let canUseLaser=!gameOver
    && car.health>0
    && !car.isEnemy
    && laserUnlocked()
    && !car.morphed
    && car.morphProgress<0.35
    && !car.jetMode
    && car.jetProgress<0.35
    && !playerCombatSuppressed(car)
    && !actorInsideBuilding(car);

  if(pressedLaser && car.laserFireFrames>0){
    let reloadFrames=playerLaserReloadFramesFromRemaining(car);
    car.laserFireFrames=0;
    car.laserDamageTick=0;
    if(car.laserBeam) clearPlayerLaserBeam(car);
    else stopPlayerLaserSound(car);
    car.laserCooldown=reloadFrames;
    car.lastLaserButton=laserButton;
    return;
  }

  if(pressedLaser && canUseLaser && car.laserCooldown<=0 && car.laserFireFrames<=0){
    car.laserFireFrames=playerLaserFireFrames;
    car.laserDamageTick=0;
    stopPlayerLaserSound(car);
    if(motorAudio.playPlayerLaserFire){
      car.laserSoundStop=motorAudio.playPlayerLaserFire(
        playerLaserLaunchPointForCar(car),
        playerLaserFireFrames/60
      );
    }
  }

  if(car.laserFireFrames>0 && canUseLaser){
    car.laserFireFrames--;
    car.laserDamageTick--;

    let from=playerLaserLaunchPointForCar(car);
    let aimPoint=aimTargetForCar(car);
    let hit=playerLaserHitForCar(car,from,aimPoint);
    updatePlayerLaserBeamVisual(car,from,hit.point);

    if(car.laserDamageTick<=0){
      applyPlayerLaserDamage(car,hit);
      car.laserDamageTick=playerLaserDamageInterval;
    }
  }else{
    let interrupted=car.laserFireFrames>0;
    let reloadFrames=interrupted ? playerLaserReloadFramesFromRemaining(car) : playerLaserCooldownFrames;
    if(interrupted) car.laserFireFrames=0;
    if(car.laserBeam) clearPlayerLaserBeam(car);
    if(interrupted && car.laserCooldown<=0) car.laserCooldown=reloadFrames;
  }

  if(car.laserFireFrames<=0 && car.laserBeam){
    clearPlayerLaserBeam(car);
    car.laserCooldown=playerLaserCooldownFrames;
  }

  car.lastLaserButton=laserButton;
}

function fireCannon(car){
  if(gameOver || car.health<=0 || car.cannonCooldown>0) return false;
  if(car.morphed || car.morphProgress>0.35) return false;
  if(car.jetMode || car.jetProgress>0.35) return false;
  if(playerCombatSuppressed(car)) return false;
  if(!car.isEnemy && actorInsideBuilding(car)) return false;
  if(!car.isEnemy && car.cannonAmmo<=0) return false;

  let mesh=makeCannonBoltMesh();
  let launchPoint=cannonLaunchPointForCar(car);
  let startX=launchPoint.x;
  let startY=launchPoint.y;
  let startZ=launchPoint.z;
  let aimPoint=aimTargetForCar(car);
  let aimX=aimPoint.x-startX;
  let aimY=aimPoint.y-startY;
  let aimZ=aimPoint.z-startZ;
  let aimLen=Math.max(0.001,Math.hypot(aimX,aimY,aimZ));
  let boltLife=Math.min(150,Math.max(72,Math.ceil(aimLen/cannonSpeed)+12));

  mesh.position.set(startX,startY,startZ);
  mesh.rotation.y=Math.atan2(aimX,aimZ);
  mesh.rotation.x=-Math.asin(clamp(aimY/aimLen,-1,1));
  scene.add(mesh);

  cannonBolts.push({
    owner:car,
    mesh,
    x:startX,
    y:startY,
    z:startZ,
    vx:(aimX/aimLen)*cannonSpeed,
    vy:(aimY/aimLen)*cannonSpeed,
    vz:(aimZ/aimLen)*cannonSpeed,
    age:0,
    life:boltLife
  });

  for(let i=0;i<7;i++){
    dust.spawnThrusterParticle(
      startX,
      startY,
      startZ,
      -(aimX/aimLen)*(1.2+Math.random()*1.8)+(Math.random()-0.5)*0.7,
      -(aimZ/aimLen)*(1.2+Math.random()*1.8)+(Math.random()-0.5)*0.7,
      (Math.random()-0.5)*0.9,
      0.12,
      0.055+Math.random()*0.035
    );
  }

  motorAudio.playCannonFire(car);
  car.cannonCooldown=cannonCooldownFrames;
  if(!car.isEnemy) car.cannonAmmo=Math.max(0,car.cannonAmmo-1);
  return true;
}

function clusterBombImpactPointForCar(car){
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);
  let startX=car.x+forwardX*4.2+rightX*0.25;
  let startY=car.y-1.25;
  let startZ=car.z+forwardZ*4.2+rightZ*0.25;
  let carriedSpeed=Math.max(0,car.speed || 0);
  let impactX=startX;
  let impactY=startY;
  let impactZ=startZ;

  for(let age=1;age<=180;age++){
    let arcT=Math.min(1,age/118);
    let forwardTravel=clusterBombArcDistance*(1-Math.pow(1-arcT,1.55))+carriedSpeed*age;
    let downwardDrop=clusterBombArcDrop*arcT*arcT+clusterBombInitialDropSpeed*age;
    impactX=startX+forwardX*forwardTravel;
    impactZ=startZ+forwardZ*forwardTravel;
    impactY=startY-downwardDrop;

    let surfaceY=drivingSurfaceHeight(impactX,impactZ);
    if(impactY<=surfaceY+0.5 || impactY<=waterLevel+0.6){
      return {
        x:impactX,
        y:Math.max(surfaceY,waterLevel)+1.05,
        z:impactZ
      };
    }
  }

  return {
    x:impactX,
    y:Math.max(drivingSurfaceHeight(impactX,impactZ),waterLevel)+1.05,
    z:impactZ
  };
}

function fireClusterBomb(car){
  if(gameOver || car.health<=0 || car.clusterBombCooldown>0) return false;
  if(!(car.jetMode || car.jetProgress>0.65)) return false;
  if(playerCombatSuppressed(car)) return false;
  if(!car.isEnemy && actorInsideBuilding(car)) return false;
  if(!car.isEnemy && car.clusterBombAmmo<=0) return false;

  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);
  let mesh=makeClusterBombMesh();
  let startX=car.x+forwardX*4.2+rightX*0.25;
  let startY=car.y-1.25;
  let startZ=car.z+forwardZ*4.2+rightZ*0.25;

  mesh.position.set(startX,startY,startZ);
  mesh.rotation.y=car.angle;
  scene.add(mesh);

  clusterBombs.push({
    owner:car,
    mesh,
    startX,
    startY,
    startZ,
    forwardX,
    forwardZ,
    carriedSpeed:Math.max(0,car.speed || 0),
    x:startX,
    y:startY,
    z:startZ,
    age:0,
    life:180
  });

  car.clusterBombCooldown=clusterBombCooldownFrames;
  if(!car.isEnemy) car.clusterBombAmmo=Math.max(0,car.clusterBombAmmo-1);
  motorAudio.playRocketLaunch(car);
  return true;
}

function destroyObstaclesInRadius(x,z,radius){
  let destroyed=[];
  let candidates=world.collidersInRadius
    ? world.collidersInRadius(x,z,radius)
    : Array.from(world.chunks.values()).flatMap(chunk=>chunk.colliders || []);

  for(let obstacle of candidates){
    if(!obstacle || obstacle.destroyed) continue;
    let dx=obstacle.x-x;
    let dz=obstacle.z-z;
    let reach=radius+(obstacle.r || 0);
    if(dx*dx+dz*dz>reach*reach) continue;
    if(obstacle.type==="radarOutpost"){
      if(damageWorldObstacle(obstacle,160)) destroyed.push(obstacle);
    }else if(destroyWorldObstacle(obstacle)) destroyed.push(obstacle);
  }

  return destroyed;
}

function damageBossBasesInRadius(x,y,z,radius){
  for(let base of world.bossBases || []){
    if(!base || !base.active || base.health<=0) continue;
    let reach=radius+(base.r || 0);
    let dx=base.x-x;
    let dz=base.z-z;
    if(dx*dx+dz*dz>reach*reach) continue;

    let bombHitDamage=(base.maxHealth || 1200)/bossBaseClusterBombHits/bossBaseDamageMultiplier;
    damageBossBaseObstacle(
      {type:"bossBase",base},
      base.x,
      Math.max(y,base.y+12),
      base.z,
      bombHitDamage
    );
  }
}

function detonateClusterBomb(owner,x,y,z){
  spawnRadiusExplosion(x,y,z,clusterBombRadius,false);
  let suppressDamage=playerCombatSuppressed(owner);

  for(let i=0;i<12;i++){
    let angle=(i/12)*Math.PI*2+Math.random()*0.28;
    let dist=clusterBombRadius*(0.18+Math.random()*0.74);
    let bx=x+Math.cos(angle)*dist;
    let bz=z+Math.sin(angle)*dist;
    let by=drivingSurfaceHeight(bx,bz)+0.8+Math.random()*2.2;
    spawnRocketExplosion(bx,by,bz,false);
  }

  if(!suppressDamage){
    let destroyed=destroyObstaclesInRadius(x,z,clusterBombRadius);
    damageBossBasesInRadius(x,y,z,clusterBombRadius);
    let debrisCount=0;
    for(let obstacle of destroyed){
      if(debrisCount>=42) break;
      if(obstacle.type==="rock" || obstacle.type==="smallRock" || obstacle.type==="building" || obstacle.type==="wall" || obstacle.type==="turret" || obstacle.type==="radarOutpost"){
        spawnObstacleDestructionDebris(obstacle,drivingSurfaceHeight(obstacle.x,obstacle.z)+Math.max(0.8,(obstacle.r || 2)*0.35));
        debrisCount++;
      }
    }

    for(let enemy of activeEnemies()){
      let dx=enemy.x-x;
      let dz=enemy.z-z;
      if(dx*dx+dz*dz<=clusterBombRadius*clusterBombRadius){
        damageEnemy(enemy,enemy.health);
        rattleActor(enemy,1);
      }
    }

    for(let i=supplyBoxes.length-1;i>=0;i--){
      let box=supplyBoxes[i];
      let dx=box.position.x-x;
      let dz=box.position.z-z;
      if(dx*dx+dz*dz<=clusterBombRadius*clusterBombRadius){
        scene.remove(box);
        supplyBoxes.splice(i,1);
      }
    }
  }

  for(let i=0;i<80;i++){
    let angle=Math.random()*Math.PI*2;
    let speed=8+Math.random()*20;
    dust.spawnThrusterParticle(
      x+Math.cos(angle)*Math.random()*18,
      y+Math.random()*5,
      z+Math.sin(angle)*Math.random()*18,
      Math.cos(angle)*speed,
      Math.sin(angle)*speed,
      2+Math.random()*9,
      0.32+Math.random()*0.24,
      0.18+Math.random()*0.12
    );
  }

  if(motorAudio.playBombExplosion) motorAudio.playBombExplosion({x,y,z});
  else motorAudio.playExplosion({x,y,z});
}

function updateCannonInput(car){
  if(car.cannonCooldown>0) car.cannonCooldown--;
  if(car.clusterBombCooldown>0) car.clusterBombCooldown--;

  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let mouseShot=gameMode==="single" && car===playerCar && input.mouse.left;
  let cannonButton=buttons.rightTrigger || mouseShot;
  let pressedCannonButton=cannonButton && !car.lastCannonButton;
  let terminalFocused=playerAimingAtTradingTerminal(car);
  if(pressedCannonButton && buttons.rightTrigger && terminalFocused && openFocusedTradingTerminalForCar(car)){
    car.lastCannonButton=cannonButton;
    return;
  }
  if(terminalFocused){
    car.lastCannonButton=cannonButton;
    return;
  }
  if(cannonButton){
    if(car.jetMode || car.jetProgress>0.65) fireClusterBomb(car);
    else fireCannon(car);
  }
  car.lastCannonButton=cannonButton;
}

function removeRocket(index){
  let rocket=rockets[index];
  scene.remove(rocket.mesh);
  rockets.splice(index,1);
}

function removeCannonBolt(index){
  let bolt=cannonBolts[index];
  scene.remove(bolt.mesh);
  cannonBolts.splice(index,1);
}

function removeClusterBomb(index){
  let bomb=clusterBombs[index];
  scene.remove(bomb.mesh);
  clusterBombs.splice(index,1);
}

function clearRockets(){
  for(let car of cars) clearPlayerLaserBeam(car);
  for(let rocket of rockets){
    scene.remove(rocket.mesh);
  }
  rockets=[];
  for(let bolt of cannonBolts){
    scene.remove(bolt.mesh);
  }
  cannonBolts=[];
  for(let bomb of clusterBombs){
    scene.remove(bomb.mesh);
  }
  clusterBombs=[];
  clearGiantFireballs();
  clearExplosions();
  clearRockDebris();
  clearTeleportEffects();
  clearTreasurePickupEffects();
  clearBossLaserBeams();
}

function updateRockets(){
  let actors=combatActors();

  for(let i=rockets.length-1;i>=0;i--){
    let rocket=rockets[i];
    rocket.age++;
    let playerDamageSuppressed=playerCombatSuppressed(rocket.owner);

    if(!rocket.ballistic && rocket.targetActor && rocket.targetActor.active && rocket.targetActor.health>0){
      let targetPoint=rocketTargetPoint(rocket.targetActor);
      rocket.targetX=targetPoint.x;
      rocket.targetY=targetPoint.y;
      rocket.targetZ=targetPoint.z;
    }

    if(rocket.ballistic){
      rocket.vy-=rocket.gravity || 0.018;
      if(rocket.targetX!==undefined && rocket.age<rocket.life*0.62){
        let dx=rocket.targetX-rocket.x;
        let dz=rocket.targetZ-rocket.z;
        let desiredAngle=Math.atan2(dx,dz);
        let speedXZ=Math.max(0.001,Math.hypot(rocket.vx,rocket.vz));
        let steer=clamp(normalizeAngle(desiredAngle-Math.atan2(rocket.vx,rocket.vz)),-0.012,0.012);
        let steeredAngle=Math.atan2(rocket.vx,rocket.vz)+steer;
        rocket.vx=Math.sin(steeredAngle)*speedXZ;
        rocket.vz=Math.cos(steeredAngle)*speedXZ;
      }
    }else{
      let dx=rocket.targetX-rocket.x;
      let dy=rocket.targetY-rocket.y;
      let dz=rocket.targetZ-rocket.z;
      let desiredLen=Math.max(0.001,Math.hypot(dx,dy,dz));
      let rocketTravelSpeed=rocket.speed || rocketSpeed;
      let desiredVx=(dx/desiredLen)*rocketTravelSpeed;
      let desiredVy=(dy/desiredLen)*rocketTravelSpeed;
      let desiredVz=(dz/desiredLen)*rocketTravelSpeed;
      rocket.vx+=(desiredVx-rocket.vx)*rocketTurnRate;
      rocket.vy+=(desiredVy-rocket.vy)*rocketTurnRate;
      rocket.vz+=(desiredVz-rocket.vz)*rocketTurnRate;
      let velocityLen=Math.max(0.001,Math.hypot(rocket.vx,rocket.vy,rocket.vz));
      rocket.vx=(rocket.vx/velocityLen)*rocketTravelSpeed;
      rocket.vy=(rocket.vy/velocityLen)*rocketTravelSpeed;
      rocket.vz=(rocket.vz/velocityLen)*rocketTravelSpeed;
    }
    rocket.angle=Math.atan2(rocket.vx,rocket.vz);

    let prevX=rocket.x;
    let prevY=rocket.y;
    let prevZ=rocket.z;
    rocket.x+=rocket.vx;
    rocket.y+=rocket.vy;
    rocket.z+=rocket.vz;
    rocket.mesh.position.set(rocket.x,rocket.y,rocket.z);
    rocket.mesh.rotation.y=rocket.angle;
    let rocketVelocity=Math.max(0.001,Math.hypot(rocket.vx,rocket.vy,rocket.vz));
    rocket.mesh.rotation.x=-Math.asin(clamp(rocket.vy/rocketVelocity,-1,1));
    rocket.mesh.rotation.z=Math.sin(rocket.age*0.45)*0.05;

    let trailEvery=cosmeticFrameInterval(rocket.trailEvery || 2);
    if(rocket.age%trailEvery===0){
      let trailScale=rocket.trailScale || 1;
      let trailCount=cosmeticBurstCount(rocket.boatMissile ? 4 : rocket.longRange ? 2 : 1);
      let speedLen=Math.max(0.001,Math.hypot(rocket.vx,rocket.vy,rocket.vz));
      let backX=-rocket.vx/speedLen;
      let backY=-rocket.vy/speedLen;
      let backZ=-rocket.vz/speedLen;
      for(let t=0;t<trailCount;t++){
        let offset=rocket.boatMissile
          ? 0.78+t*0.54
          : 0.62+(rocket.longRange ? t*0.42 : 0);
        let sideSpread=rocket.boatMissile ? 0.34+0.12*t : 0.16;
        let wakeSpeed=rocket.boatMissile ? 3.6+trailScale*0.9+t*0.34 : 2.4+trailScale*0.75;
        dust.spawnThrusterParticle(
          rocket.x+backX*offset+(Math.random()-0.5)*sideSpread*trailScale,
          rocket.y+backY*offset+(Math.random()-0.5)*sideSpread*trailScale,
          rocket.z+backZ*offset+(Math.random()-0.5)*sideSpread*trailScale,
          backX*wakeSpeed+(Math.random()-0.5)*0.9*trailScale,
          backZ*wakeSpeed+(Math.random()-0.5)*0.9*trailScale,
          backY*wakeSpeed+(Math.random()-0.5)*1.1*trailScale,
          (rocket.boatMissile ? 0.24 : 0.18)*trailScale*(1+t*0.1),
          rocket.boatMissile ? 0.14+Math.random()*0.08+t*0.012 : 0.07+Math.random()*0.04+rocket.longRange*0.035
        );
      }
      if(rocket.boatMissile && rocket.age%cosmeticFrameInterval(2)===0 && lastMeasuredFps>=24){
        dust.spawnThrusterParticle(
          rocket.x+backX*2.4,
          rocket.y+backY*2.4,
          rocket.z+backZ*2.4,
          backX*2.2+(Math.random()-0.5)*0.5,
          backZ*2.2+(Math.random()-0.5)*0.5,
          backY*2.2+0.6+Math.random()*0.8,
          0.44*trailScale,
          0.22+Math.random()*0.08
        );
      }
    }

    let surfaceY=drivingSurfaceHeight(rocket.x,rocket.z);
    let hitActor=null;
    let mothershipHit=null;
    if(rocket.age>4){
      for(let actor of actors){
        if(actor===rocket.owner) continue;
        if(actor.health<=0 || (actor.active===false && actor.isEnemy)) continue;
        if(rocket.owner.isEnemy && actor.isEnemy) continue;
        if(rocket.owner.isEnemy && playerInvisibleToEnemies(actor)) continue;
        if(playerDamageSuppressed) continue;
        let hitRadius=actor.collisionRadius ? Math.max(4.2,actor.collisionRadius+1.1) : 4.2;
        let hitHeight=actor.hitHeight || 4.2;
        let dx=rocket.x-actor.x;
        let dz=rocket.z-actor.z;
        if(dx*dx+dz*dz<hitRadius*hitRadius && Math.abs(rocket.y-actor.y)<hitHeight){
          hitActor=actor;
          break;
        }
      }
      if(!rocket.owner.isEnemy && !playerDamageSuppressed){
        mothershipHit=mothershipHitAlongSegment(prevX,prevY,prevZ,rocket.x,rocket.y,rocket.z,1.6);
      }
    }

    let obstacleHitInfo={};
    let hitObstacle=world.obstacleAlongSegment3D(prevX,prevY,prevZ,rocket.x,rocket.y,rocket.z,1.25,obstacleHitInfo);
    let exactRockHitInfo={};
    let exactRock=world.rockObstacleAlongSegmentExact
      ? world.rockObstacleAlongSegmentExact(prevX,prevY,prevZ,rocket.x,rocket.y,rocket.z,exactRockHitInfo)
      : null;
    if(exactRock && (!hitObstacle || exactRockHitInfo.distance<obstacleHitInfo.distance)){
      hitObstacle=exactRock;
      obstacleHitInfo=exactRockHitInfo;
    }
    let targetImpact=false;
    if(rocket.ballistic && rocket.targetX!==undefined){
      let dx=rocket.x-rocket.targetX;
      let dz=rocket.z-rocket.targetZ;
      targetImpact=(rocket.age>=rocket.impactAge && dx*dx+dz*dz<28*28)
        || (dx*dx+dz*dz<12*12 && rocket.y<=rocket.targetY+14);
    }
    let terrainHit=rocket.y<=surfaceY+0.35;
    if(!hitObstacle && terrainHit) hitObstacle=rockNearImpact(rocket.x,rocket.y,rocket.z,4.5);
    let hit=terrainHit || hitObstacle || hitActor || mothershipHit || targetImpact;

    if(hit || rocket.age>rocket.life){
      let shouldExplode=hit || rocket.ballistic;
      if(shouldExplode){
        let explosionX=mothershipHit ? mothershipHit.x : hitObstacle && Number.isFinite(obstacleHitInfo.x) ? obstacleHitInfo.x : hitObstacle ? hitObstacle.x : targetImpact ? rocket.targetX : rocket.x;
        let explosionZ=mothershipHit ? mothershipHit.z : hitObstacle && Number.isFinite(obstacleHitInfo.z) ? obstacleHitInfo.z : hitObstacle ? hitObstacle.z : targetImpact ? rocket.targetZ : rocket.z;
        let explosionSurfaceY=drivingSurfaceHeight(explosionX,explosionZ);
        let explosionY=hitObstacle
          ? Math.max(Number.isFinite(obstacleHitInfo.y) ? obstacleHitInfo.y : groundHeight(hitObstacle.x,hitObstacle.z)+Math.max(0.8,hitObstacle.r*0.45),explosionSurfaceY+0.5)
          : mothershipHit
          ? mothershipHit.y
          : targetImpact
          ? Math.max(rocket.targetY,explosionSurfaceY+0.5)
          : Math.max(rocket.y,explosionSurfaceY+0.5);
        spawnRocketExplosion(explosionX,explosionY,explosionZ);
        if(!playerDamageSuppressed){
          if(mothershipHit) damageMothership(explosionX,explosionY,explosionZ,1);
          if(hitObstacle){
            if(hitObstacle.type==="bossBase"){
              damageBossBaseObstacle(hitObstacle,rocket.x,rocket.y,rocket.z,34);
            }else if(hitObstacle.type==="rock" || hitObstacle.type==="smallRock" || hitObstacle.type==="building" || hitObstacle.type==="wall" || hitObstacle.type==="turret" || hitObstacle.type==="radarOutpost"){
              if(hitObstacle.type==="building" || hitObstacle.type==="wall") spawnBuildingAmmoImpact(hitObstacle,rocket.x,rocket.y,rocket.z,34);
              if(damageWorldObstacle(hitObstacle,34)){
                spawnObstacleDestructionDebris(hitObstacle,explosionY);
              }
            }else{
              destroyWorldObstacle(hitObstacle);
            }
          }
          if(hitActor){
            damageActor(hitActor,rocket.damage || 18,{x:rocket.x,y:rocket.y,z:rocket.z});
            rattleActor(hitActor,1);
          }
          if(rocket.blastRadius){
            for(let actor of actors){
              if(actor===rocket.owner || actor===hitActor) continue;
              if(actor.health<=0 || (actor.active===false && actor.isEnemy)) continue;
              if(rocket.owner.isEnemy && actor.isEnemy) continue;
              if(rocket.owner.isEnemy && playerInvisibleToEnemies(actor)) continue;
              let dx=actor.x-explosionX;
              let dz=actor.z-explosionZ;
              if(dx*dx+dz*dz<rocket.blastRadius*rocket.blastRadius){
                damageActor(actor,Math.max(6,(rocket.damage || 18)*0.55),{x:explosionX,y:explosionY,z:explosionZ});
                rattleActor(actor,0.85);
              }
            }
          }
        }
      }
      removeRocket(i);
    }
  }
}

function updateCannonBolts(){
  let actors=combatActors();

  for(let i=cannonBolts.length-1;i>=0;i--){
    let bolt=cannonBolts[i];
    bolt.age++;
    let playerDamageSuppressed=playerCombatSuppressed(bolt.owner);

    let prevX=bolt.x;
    let prevY=bolt.y;
    let prevZ=bolt.z;
    bolt.x+=bolt.vx;
    bolt.y+=bolt.vy;
    bolt.z+=bolt.vz;

    let angle=Math.atan2(bolt.vx,bolt.vz);
    bolt.mesh.position.set(bolt.x,bolt.y,bolt.z);
    bolt.mesh.rotation.y=angle;
    bolt.mesh.rotation.x=-Math.asin(clamp(bolt.vy/cannonSpeed,-1,1));
    bolt.mesh.scale.setScalar(1+Math.sin(bolt.age*0.7)*0.08);

    if(bolt.age%cosmeticFrameInterval(2)===0){
      dust.spawnThrusterParticle(
        bolt.x-bolt.vx*0.18,
        bolt.y,
        bolt.z-bolt.vz*0.18,
        -bolt.vx*0.42+(Math.random()-0.5)*0.55,
        -bolt.vz*0.42+(Math.random()-0.5)*0.55,
        (Math.random()-0.5)*0.55,
        0.13,
        0.045+Math.random()*0.025
      );
    }

    let surfaceY=drivingSurfaceHeight(bolt.x,bolt.z);
    let hitActor=null;
    let mothershipHit=null;
    if(bolt.age>2){
      for(let actor of actors){
        if(actor===bolt.owner) continue;
        if(actor.health<=0 || (actor.active===false && actor.isEnemy)) continue;
        if(bolt.owner.isStationDefense && !actor.isEnemy) continue;
        if(bolt.owner.isEnemy && actor.isEnemy) continue;
        if(bolt.owner.isEnemy && playerInvisibleToEnemies(actor)) continue;
        if(playerDamageSuppressed) continue;
        let hitRadius=actor.collisionRadius ? Math.max(3.6,actor.collisionRadius+0.6) : 3.6;
        let hitHeight=actor.hitHeight || 4.0;
        let dx=bolt.x-actor.x;
        let dz=bolt.z-actor.z;
        if(dx*dx+dz*dz<hitRadius*hitRadius && Math.abs(bolt.y-actor.y)<hitHeight){
          hitActor=actor;
          break;
        }
      }
      if(!bolt.owner.isEnemy && !playerDamageSuppressed){
        mothershipHit=mothershipHitAlongSegment(prevX,prevY,prevZ,bolt.x,bolt.y,bolt.z,0.95);
      }
    }

    let obstacleHitInfo={};
    let hitObstacle=bolt.ignoreObstacleFrames && bolt.age<=bolt.ignoreObstacleFrames
      ? null
      : world.obstacleAlongSegment3D(prevX,prevY,prevZ,bolt.x,bolt.y,bolt.z,0.9,obstacleHitInfo);
    if(!(bolt.ignoreObstacleFrames && bolt.age<=bolt.ignoreObstacleFrames)){
      let exactRockHitInfo={};
      let exactRock=world.rockObstacleAlongSegmentExact
        ? world.rockObstacleAlongSegmentExact(prevX,prevY,prevZ,bolt.x,bolt.y,bolt.z,exactRockHitInfo)
        : null;
      if(exactRock && (!hitObstacle || exactRockHitInfo.distance<obstacleHitInfo.distance)){
        hitObstacle=exactRock;
        obstacleHitInfo=exactRockHitInfo;
      }
    }
    let terrainHit=bolt.y<=surfaceY+0.22;
    if(!hitObstacle && terrainHit) hitObstacle=rockNearImpact(bolt.x,bolt.y,bolt.z,3.25);
    let hit=terrainHit || hitObstacle || hitActor || mothershipHit;

    if(hit || bolt.age>bolt.life){
      if(hit){
        let explosionX=mothershipHit ? mothershipHit.x : hitObstacle && Number.isFinite(obstacleHitInfo.x) ? obstacleHitInfo.x : hitObstacle ? hitObstacle.x : bolt.x;
        let explosionZ=mothershipHit ? mothershipHit.z : hitObstacle && Number.isFinite(obstacleHitInfo.z) ? obstacleHitInfo.z : hitObstacle ? hitObstacle.z : bolt.z;
        let explosionY=hitObstacle
          ? Math.max(Number.isFinite(obstacleHitInfo.y) ? obstacleHitInfo.y : groundHeight(hitObstacle.x,hitObstacle.z)+Math.max(0.55,hitObstacle.r*0.35),surfaceY+0.4)
          : mothershipHit
          ? mothershipHit.y
          : Math.max(bolt.y,surfaceY+0.45);
        spawnRocketExplosion(explosionX,explosionY,explosionZ,true,"cannon");
        if(!playerDamageSuppressed){
          if(mothershipHit) damageMothership(explosionX,explosionY,explosionZ,0.4);
          if(hitObstacle){
            if(hitObstacle.type==="bossBase"){
              damageBossBaseObstacle(hitObstacle,bolt.x,bolt.y,bolt.z,13);
            }else if(hitObstacle.type==="rock" || hitObstacle.type==="smallRock" || hitObstacle.type==="building" || hitObstacle.type==="wall" || hitObstacle.type==="turret" || hitObstacle.type==="radarOutpost"){
              if(hitObstacle.type==="building" || hitObstacle.type==="wall") spawnBuildingAmmoImpact(hitObstacle,bolt.x,bolt.y,bolt.z,13);
              if(damageWorldObstacle(hitObstacle,13)){
                spawnObstacleDestructionDebris(hitObstacle,explosionY);
              }
            }else{
              destroyWorldObstacle(hitObstacle);
            }
          }
          if(hitActor){
            damageActor(hitActor,bolt.damage || 9,{x:bolt.x,y:bolt.y,z:bolt.z});
            rattleActor(hitActor,0.72);
          }
        }
      }
      removeCannonBolt(i);
    }
  }
}

function updateClusterBombs(){
  for(let i=clusterBombs.length-1;i>=0;i--){
    let bomb=clusterBombs[i];
    bomb.age++;

    let arcT=Math.min(1,bomb.age/118);
    let forwardTravel=clusterBombArcDistance*(1-Math.pow(1-arcT,1.55))+(bomb.carriedSpeed || 0)*bomb.age;
    let downwardDrop=clusterBombArcDrop*arcT*arcT+clusterBombInitialDropSpeed*bomb.age;
    bomb.x=bomb.startX+bomb.forwardX*forwardTravel;
    bomb.z=bomb.startZ+bomb.forwardZ*forwardTravel;
    bomb.y=bomb.startY-downwardDrop;

    bomb.mesh.position.set(bomb.x,bomb.y,bomb.z);
    bomb.mesh.rotation.x+=0.16;
    bomb.mesh.rotation.y+=0.08;
    bomb.mesh.rotation.z+=0.11;
    if(bomb.mesh.userData.glow){
      let pulse=1+Math.sin(bomb.age*0.42)*0.18;
      bomb.mesh.userData.glow.scale.setScalar(pulse);
      bomb.mesh.userData.glow.material.opacity=0.28+Math.sin(bomb.age*0.42)*0.08;
    }

    if(bomb.age%cosmeticFrameInterval(2)===0){
      let trailCount=cosmeticBurstCount(3);
      for(let t=0;t<trailCount;t++){
        dust.spawnThrusterParticle(
          bomb.x+(Math.random()-0.5)*0.8,
          bomb.y+0.35,
          bomb.z+(Math.random()-0.5)*0.8,
          (Math.random()-0.5)*1.4,
          (Math.random()-0.5)*1.4,
          1.2+Math.random()*1.4,
          0.18,
          0.11+Math.random()*0.05
        );
      }
    }

    let surfaceY=drivingSurfaceHeight(bomb.x,bomb.z);
    let hitGround=bomb.y<=surfaceY+0.5 || bomb.y<=waterLevel+0.6;
    if(hitGround || bomb.age>bomb.life){
      let detonationY=Math.max(surfaceY+0.8,Math.min(bomb.y,bomb.owner.y));
      detonateClusterBomb(bomb.owner,bomb.x,detonationY,bomb.z);
      removeClusterBomb(i);
    }
  }
}

function nearestActivePlayer(enemy,targetableCars=enemyTargetableCars()){
  let best=null;
  let bestDist=Infinity;

  for(let car of targetableCars){
    let dx=car.x-enemy.x;
    let dz=car.z-enemy.z;
    let distSq=dx*dx+dz*dz;
    if(distSq<bestDist){
      best=car;
      bestDist=distSq;
    }
  }

  return best;
}

function smartEnemyTarget(enemy,targetableCars=enemyTargetableCars()){
  if(!enemy || !targetableCars.length) return null;

  let current=enemy.aiTarget && targetableCars.includes(enemy.aiTarget) && enemy.aiTarget.health>0
    ? enemy.aiTarget
    : null;
  let currentScore=Infinity;
  let best=null;
  let bestScore=Infinity;

  for(let car of targetableCars){
    let dx=car.x-enemy.x;
    let dz=car.z-enemy.z;
    let distSq=dx*dx+dz*dz;
    let healthBias=clamp((100-(car.health || 100))/100,0,0.55);
    let score=distSq*(1-healthBias*0.18);
    if(car===current){
      score*=0.72;
      currentScore=score;
    }
    if(score<bestScore){
      best=car;
      bestScore=score;
    }
  }

  if(current && currentScore<bestScore*1.38) return current;
  return best;
}

function predictedTargetPointForEnemy(enemy,target,distance){
  let lead=enemy.isBuggy ? 26 : enemy.isDrone ? 14 : enemy.isGiant ? 10 : enemy.isGuard ? 12 : enemy.isBoss ? 12 : 8;
  lead*=clamp(distance/180,0.35,1.85);
  let moveAngle=Number.isFinite(target.velAngle) ? target.velAngle : target.angle || 0;
  let targetSpeed=Number.isFinite(target.speed) ? target.speed : 0;
  return {
    x:target.x+Math.sin(moveAngle)*targetSpeed*lead,
    z:target.z+Math.cos(moveAngle)*targetSpeed*lead
  };
}

function updateEnemyTacticalState(enemy,distance,targetAngle){
  enemy.aiThink=Math.max(0,(enemy.aiThink || 0)-1);
  if(enemy.aiThink<=0){
    enemy.aiThink=36+Math.floor(Math.random()*54);
    if(Math.random()<0.28) enemy.aiStrafe*=-1;
    enemy.aiAggression=0.82+Math.random()*0.42;
    enemy.aiPreferredRange=enemy.isBuggy
      ? 136+Math.random()*42
      : enemy.isDrone
      ? 76+Math.random()*28
      : enemy.isGiant
      ? 78+Math.random()*26
      : enemy.isGuard
      ? 58+Math.random()*24
      : 48+Math.random()*22;
  }

  if(enemy.blockedFrames>10){
    enemy.avoidFrames=Math.max(enemy.avoidFrames || 0,34+Math.floor(Math.random()*34));
    enemy.avoidAngle=normalizeAngle(enemy.angle+enemy.aiStrafe*(0.72+Math.random()*0.72));
    enemy.aiStrafe*=-1;
    enemy.blockedFrames=0;
  }

  if((enemy.avoidFrames || 0)>0){
    enemy.avoidFrames--;
    return enemy.avoidAngle;
  }

  return targetAngle;
}

function playerSpawnDistanceSq(x,z){
  let best=Infinity;
  for(let car of activeCars()){
    if(car.health<=0) continue;
    let dx=x-car.x;
    let dz=z-car.z;
    best=Math.min(best,dx*dx+dz*dz);
  }
  return best;
}

function playerDistanceSqForEnemy(enemy,targetableCars=enemyTargetableCars()){
  let best=Infinity;
  for(let car of targetableCars){
    let dx=enemy.x-car.x;
    let dz=enemy.z-car.z;
    best=Math.min(best,dx*dx+dz*dz);
  }
  return best;
}

function boatWaterPointValid(x,z){
  return waterDepthAt(x,z)>1.8
    && roadDistance(x,z)>54
    && !world.collidesWithObstacles(x,z);
}

function chooseBoatRoamPoint(enemy){
  let homeX=Number.isFinite(enemy.boatHomeX) ? enemy.boatHomeX : enemy.x;
  let homeZ=Number.isFinite(enemy.boatHomeZ) ? enemy.boatHomeZ : enemy.z;
  let baseAngle=Number.isFinite(enemy.boatRoamAngle) ? enemy.boatRoamAngle : enemy.angle;

  for(let attempt=0;attempt<30;attempt++){
    let sweep=attempt<14 ? enemy.aiStrafe*(0.35+attempt*0.24) : Math.random()*Math.PI*2;
    let angle=baseAngle+sweep+(Math.random()-0.5)*0.42;
    let radius=68+Math.random()*190;
    let x=homeX+Math.sin(angle)*radius;
    let z=homeZ+Math.cos(angle)*radius;
    if(boatWaterPointValid(x,z)){
      enemy.boatRoamX=x;
      enemy.boatRoamZ=z;
      enemy.boatRoamAngle=angle;
      enemy.boatRoamCooldown=90+Math.floor(Math.random()*120);
      return true;
    }
  }

  for(let attempt=0;attempt<18;attempt++){
    let angle=Math.random()*Math.PI*2;
    let radius=42+Math.random()*130;
    let x=enemy.x+Math.sin(angle)*radius;
    let z=enemy.z+Math.cos(angle)*radius;
    if(boatWaterPointValid(x,z)){
      enemy.boatRoamX=x;
      enemy.boatRoamZ=z;
      enemy.boatRoamAngle=angle;
      enemy.boatRoamCooldown=70+Math.floor(Math.random()*110);
      return true;
    }
  }

  enemy.boatRoamX=enemy.x+Math.sin(enemy.angle+enemy.aiStrafe*0.7)*90;
  enemy.boatRoamZ=enemy.z+Math.cos(enemy.angle+enemy.aiStrafe*0.7)*90;
  enemy.boatRoamCooldown=45;
  return false;
}

function updateBoatEnemy(enemy,target,distance,targetAngle,settings){
  if(!Number.isFinite(enemy.boatHomeX)){
    enemy.boatHomeX=enemy.x;
    enemy.boatHomeZ=enemy.z;
  }

  enemy.boatRoamCooldown=Math.max(0,(enemy.boatRoamCooldown || 0)-1);
  let roamDx=(enemy.boatRoamX ?? enemy.x)-enemy.x;
  let roamDz=(enemy.boatRoamZ ?? enemy.z)-enemy.z;
  let roamDistance=Math.hypot(roamDx,roamDz);
  if(!Number.isFinite(enemy.boatRoamX) || roamDistance<38 || enemy.boatRoamCooldown<=0 || !boatWaterPointValid(enemy.boatRoamX,enemy.boatRoamZ)){
    chooseBoatRoamPoint(enemy);
    roamDx=(enemy.boatRoamX ?? enemy.x)-enemy.x;
    roamDz=(enemy.boatRoamZ ?? enemy.z)-enemy.z;
    roamDistance=Math.hypot(roamDx,roamDz);
  }

  let desiredAngle=roamDistance>1
    ? Math.atan2(roamDx,roamDz)+Math.sin(performance.now()*0.00085+enemy.guardPhase)*0.08
    : enemy.angle+enemy.aiStrafe*0.18;
  let desiredSpeed=roamDistance>85 ? 0.2 : 0.12;

  let homeDistance=Math.hypot(enemy.x-enemy.boatHomeX,enemy.z-enemy.boatHomeZ);
  if(homeDistance>310 && boatWaterPointValid(enemy.boatHomeX,enemy.boatHomeZ)){
    desiredAngle=Math.atan2(enemy.boatHomeX-enemy.x,enemy.boatHomeZ-enemy.z);
    desiredSpeed=0.24;
  }

  let turn=clamp(normalizeAngle(desiredAngle-enemy.angle),-0.038,0.038);
  enemy.angle=normalizeAngle(enemy.angle+turn);
  enemy.speed+=clamp(desiredSpeed*settings.speed-enemy.speed,-0.009*settings.speed,0.009*settings.speed);
  enemy.speed=clamp(enemy.speed,0.04*settings.speed,0.26*settings.speed);

  let prevX=enemy.x;
  let prevZ=enemy.z;
  if(!gameOver){
    enemy.x+=Math.sin(enemy.angle)*enemy.speed;
    enemy.z+=Math.cos(enemy.angle)*enemy.speed;
  }

  if(waterDepthAt(enemy.x,enemy.z)<1.6 || world.collidesWithObstacles(enemy.x,enemy.z)){
    enemy.x=prevX;
    enemy.z=prevZ;
    enemy.speed*=0.25;
    enemy.angle=normalizeAngle(enemy.angle+enemy.aiStrafe*(0.8+Math.random()*0.45));
    enemy.aiStrafe*=-1;
    enemy.boatRoamCooldown=0;
    chooseBoatRoamPoint(enemy);
  }

  enemy.y=waterLevel+0.5+Math.sin(performance.now()*0.003+enemy.guardPhase)*0.12;
  enemy.pitch=Math.sin(performance.now()*0.002+enemy.guardPhase)*0.025;
  enemy.velAngle=enemy.angle;
  enemy.onGround=false;
  enemy.airborne=false;
  enemy.group.position.set(enemy.x,enemy.y,enemy.z);
  enemy.group.rotation.y=enemy.angle;
  enemy.group.rotation.x=enemy.pitch;
  enemy.group.rotation.z=Math.sin(performance.now()*0.0024+enemy.guardPhase)*0.035;

  if(enemy.boatModel && enemy.boatModel.userData.core){
    enemy.boatModel.userData.core.scale.setScalar(1+Math.sin(performance.now()*0.018+enemy.guardPhase)*0.12);
  }

  let aimError=target ? Math.abs(normalizeAngle(targetAngle-enemy.angle)) : Infinity;
  if(target && distance>130 && distance<430 && aimError<0.72){
    fireBoatMissile(enemy,target);
  }
}

function prepareVillageEnemyBudget(village){
  if(!village) return;
  if(village.enemyBudgetRun===enemyBudgetRun && village.enemyDifficulty===gameDifficulty) return;

  let settings=currentDifficulty();
  let baseBudget=village.enemyBudget || 7;
  village.enemyRemaining=gameDifficulty==="easy"
    ? Math.max(0,Math.round(baseBudget*settings.villageBudget))
    : Math.max(1,Math.round(baseBudget*settings.villageBudget));
  village.enemyBudgetRun=enemyBudgetRun;
  village.enemyDifficulty=gameDifficulty;
}

function villageSpawnCenters(center){
  let villages=[];

  for(let village of world.activeVillages || []){
    prepareVillageEnemyBudget(village);
    if((village.enemyRemaining ?? 0)<=0) continue;
    let dx=village.x-center.x;
    let dz=village.z-center.z;
    let distSq=dx*dx+dz*dz;
    if(distSq<130*130 || distSq>620*620) continue;
    villages.push({village,distSq});
  }

  villages.sort((a,b)=>a.distSq-b.distSq);
  return villages;
}

function enemySpawnPointForVillage(village,index){
  for(let attempt=0;attempt<24;attempt++){
    let angle=Math.random()*Math.PI*2;
    let radius=(village.r || 32)*(1.25+Math.random()*0.65)+index*5;
    let x=village.x+Math.cos(angle)*radius+(Math.random()-0.5)*12;
    let z=village.z+Math.sin(angle)*radius+(Math.random()-0.5)*12;
    let h=drivingSurfaceHeight(x,z);

    if(
      Number.isFinite(h)
      && playerSpawnDistanceSq(x,z)>120*120
      && waterDepthAt(x,z)<1.4
      && roadDistance(x,z)>18
      && !world.collidesWithObstacles(x,z)
    ){
      return {x,z};
    }
  }

  return null;
}

function enemySpawnVillage(){
  let players=activeCars().filter(car=>car.health>0);
  let center=players.length
    ? players.reduce((acc,car)=>({x:acc.x+car.x/players.length,z:acc.z+car.z/players.length}),{x:0,z:0})
    : {x:playerCar.x,z:playerCar.z};
  let villages=villageSpawnCenters(center);

  if(villages.length===0) return null;
  return villages[Math.floor(Math.random()*Math.min(villages.length,4))].village;
}

function enemyPatrolSpawnPoint(index){
  let players=activeCars().filter(car=>car.health>0);
  let center=players.length
    ? players.reduce((acc,car)=>({x:acc.x+car.x/players.length,z:acc.z+car.z/players.length}),{x:0,z:0})
    : {x:playerCar.x,z:playerCar.z};

  for(let attempt=0;attempt<18;attempt++){
    let angle=Math.random()*Math.PI*2;
    let distance=520+Math.random()*190+index*24;
    let x=center.x+Math.cos(angle)*distance+(Math.random()-0.5)*28;
    let z=center.z+Math.sin(angle)*distance+(Math.random()-0.5)*28;
    let h=drivingSurfaceHeight(x,z);

    if(
      Number.isFinite(h)
      && waterDepthAt(x,z)<1.4
      && roadDistance(x,z)>22
      && !world.collidesWithObstacles(x,z)
    ){
      return {x,z};
    }
  }

  return null;
}

function enemyBoatSpawnPoint(index){
  let center=playerCenter();

  for(let attempt=0;attempt<34;attempt++){
    let angle=Math.random()*Math.PI*2;
    let distance=300+Math.random()*420+index*35;
    let x=center.x+Math.cos(angle)*distance+(Math.random()-0.5)*36;
    let z=center.z+Math.sin(angle)*distance+(Math.random()-0.5)*36;

    if(
      waterDepthAt(x,z)>3.2
      && playerSpawnDistanceSq(x,z)>210*210
      && roadDistance(x,z)>70
      && !world.collidesWithObstacles(x,z)
    ){
      return {x,z};
    }
  }

  return null;
}

function testingRocketBuggyStartPoint(index,total){
  let center={x:playerCar.x,z:playerCar.z};
  let baseAngle=playerCar && Number.isFinite(playerCar.angle) ? playerCar.angle : 0;
  let spread=(index-(total-1)*0.5)*0.34;
  let relaxedFallback=null;

  for(let attempt=0;attempt<42;attempt++){
    let ring=Math.floor(attempt/total);
    let angle=baseAngle+spread+(Math.random()-0.5)*0.16+ring*0.18;
    let distance=72+index*12+ring*18+Math.random()*10;
    let x=center.x+Math.sin(angle)*distance;
    let z=center.z+Math.cos(angle)*distance;
    let h=drivingSurfaceHeight(x,z);
    let dry=waterDepthAt(x,z)<1.4;
    let clear=!world.collidesWithObstacles(x,z);

    if(
      Number.isFinite(h)
      && playerSpawnDistanceSq(x,z)>58*58
      && dry
      && clear
      && roadDistance(x,z)>10
    ){
      return {x,z};
    }

    if(!relaxedFallback && Number.isFinite(h) && playerSpawnDistanceSq(x,z)>52*52 && dry && clear){
      relaxedFallback={x,z};
    }
  }

  if(relaxedFallback) return relaxedFallback;

  let angle=baseAngle+spread;
  let distance=86+index*10;
  return {
    x:center.x+Math.sin(angle)*distance,
    z:center.z+Math.cos(angle)*distance
  };
}

function spawnTestingRocketBuggiesAtStart(){
  if(!testingRocketBuggiesAtStart) return;

  let count=Math.max(1,Math.floor(testingRocketBuggyStartCount || 1));
  for(let i=0;i<count;i++){
    let point=testingRocketBuggyStartPoint(i,count);
    if(!point) continue;

    let enemy=createEnemyState(++enemySpawnSerial,point.x,point.z,"buggy");
    enemy.isPatrol=true;
    enemy.guardPhase=Math.random()*Math.PI*2;
    enemy.angle=Math.atan2(playerCar.x-enemy.x,playerCar.z-enemy.z)+(Math.random()-0.5)*0.28;
    enemy.velAngle=enemy.angle;
    enemy.cannonCooldown=scaledDelay(34+i*18,currentDifficulty().fireDelay);
    enemy.group.position.set(enemy.x,enemy.y,enemy.z);
    enemy.group.rotation.y=enemy.angle;
    if(enemy.shadow) enemy.shadow.update({carX:enemy.x,carZ:enemy.z,carY:enemy.y,surfaceY:enemy.y,carVelAngle:enemy.angle});
    enemies.push(enemy);
    enemy.group.scale.setScalar(1);
  }
}

function spawnEnemyWave(){
  let village=enemySpawnVillage();
  if(!village) return false;

  let settings=currentDifficulty();
  let baseCount=Math.random()<0.75 ? 1 : 2;
  let count=Math.min(village.enemyRemaining ?? 0,Math.max(1,Math.round(baseCount*settings.waveCount)));
  if(count<=0) return false;

  for(let i=0;i<count;i++){
    let point=enemySpawnPointForVillage(village,i);
    if(!point) continue;
    let type="mech";
    if(village.bossVillage && !village.bossSpawned){
      type="boss";
      village.bossSpawned=true;
    }else if(Math.random()<(village.bossVillage ? 0.14 : 0.055)){
      type="giant";
    }else if(Math.random()<(village.bossVillage ? 0.38 : 0.22)){
      type="drone";
    }else if(Math.random()<(village.bossVillage ? 0.28 : 0.18)){
      type="buggy";
    }
    let enemy=createEnemyState(++enemySpawnSerial,point.x,point.z,type);
    enemy.spawnVillage=village;
    enemy.guardX=point.x;
    enemy.guardZ=point.z;
    enemy.guardPhase=Math.random()*Math.PI*2;
    enemy.angle=roadYawAt(point.z)+Math.PI+(Math.random()-0.5)*0.8;
    enemy.velAngle=enemy.angle;
    enemy.group.position.set(enemy.x,enemy.y,enemy.z);
    enemy.group.rotation.y=enemy.angle;
    if(enemy.shadow) enemy.shadow.update({carX:enemy.x,carZ:enemy.z,carY:enemy.y,surfaceY:enemy.y,carVelAngle:enemy.angle});
    enemies.push(enemy);
    spawnEnemyTeleportEffect(enemy);
    village.enemyRemaining=Math.max(0,(village.enemyRemaining ?? 0)-1);
  }
  return true;
}

function spawnEnemyPatrol(){
  let settings=currentDifficulty();
  let count=Math.max(1,Math.round(2*settings.waveCount));
  for(let i=0;i<count;i++){
    let boatPoint=Math.random()<0.38 ? enemyBoatSpawnPoint(i) : null;
    let point=boatPoint || enemyPatrolSpawnPoint(i);
    if(!point) return false;
    let roll=Math.random();
    let type=boatPoint ? "boat" : roll<0.08 ? "giant" : roll<0.34 ? "buggy" : roll<0.58 ? "drone" : "mech";
    let enemy=createEnemyState(++enemySpawnSerial,point.x,point.z,type);
    enemy.isPatrol=true;
    enemy.angle=boatPoint ? Math.random()*Math.PI*2 : roadYawAt(point.z)+Math.PI+(Math.random()-0.5)*1.4;
    enemy.velAngle=enemy.angle;
    enemy.group.position.set(enemy.x,enemy.y,enemy.z);
    enemy.group.rotation.y=enemy.angle;
    if(enemy.shadow) enemy.shadow.update({carX:enemy.x,carZ:enemy.z,carY:enemy.y,surfaceY:enemy.y,carVelAngle:enemy.angle});
    enemies.push(enemy);
    spawnEnemyTeleportEffect(enemy);
  }
  return true;
}

function playerCenter(){
  let players=activeCars().filter(car=>car.health>0);
  if(!players.length) return {x:playerCar.x,z:playerCar.z};
  return players.reduce((acc,car)=>({
    x:acc.x+car.x/players.length,
    z:acc.z+car.z/players.length
  }),{x:0,z:0});
}

function scheduleNextMothership(){
  mothershipDelay=mothershipMinDelay+Math.floor(Math.random()*mothershipRandomDelay);
}

function removeMothership(){
  if(!mothership) return;
  if(motorAudio.stopMothershipHum) motorAudio.stopMothershipHum();
  disposeMothershipBeam(mothership.beam);
  scene.remove(mothership.group);
  if(mothership.shadow){
    scene.remove(mothership.shadow);
    if(mothership.shadow.geometry) mothership.shadow.geometry.dispose();
    if(mothership.shadow.material) mothership.shadow.material.dispose();
  }
  mothership=null;
}

function createMothershipBeam(x,z,surfaceY,shipY,mode="in"){
  let height=Math.max(150,shipY-surfaceY+120);
  let radius=42;
  let beamMat=teleportBeamMat.clone();
  beamMat.color.set(0xa8e8ff);
  beamMat.opacity=0.34;
  let beam=new THREE.Mesh(teleportBeamGeo,beamMat);
  beam.position.set(x,surfaceY+height*0.5,z);
  beam.scale.set(radius,height,radius);
  beam.renderOrder=35;
  scene.add(beam);

  let coreMat=teleportBeamMat.clone();
  coreMat.color.set(0xffffff);
  coreMat.opacity=0.58;
  let core=new THREE.Mesh(teleportBeamGeo,coreMat);
  core.position.copy(beam.position);
  core.scale.set(5.4,height*1.04,5.4);
  core.renderOrder=37;
  scene.add(core);

  let ringMat=explosionRingMat.clone();
  ringMat.color.set(0x9fd8ff);
  ringMat.opacity=0.78;
  let ring=new THREE.Mesh(teleportRingGeo,ringMat);
  ring.position.set(x,surfaceY+0.18,z);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(radius*0.26);
  ring.renderOrder=36;
  scene.add(ring);

  let topRing=new THREE.Mesh(teleportRingGeo,ringMat.clone());
  topRing.position.set(x,shipY+12,z);
  topRing.rotation.x=Math.PI/2;
  topRing.scale.setScalar(radius*0.18);
  topRing.renderOrder=36;
  scene.add(topRing);

  return {
    beam,
    core,
    ring,
    topRing,
    height,
    radius,
    age:0,
    life:mode==="out" ? 1.95 : 2.2,
    mode
  };
}

function disposeMothershipBeam(beam){
  if(!beam) return;
  for(let object of [beam.beam,beam.core,beam.ring,beam.topRing]){
    if(!object) continue;
    scene.remove(object);
    if(object.geometry && object.geometry!==teleportBeamGeo && object.geometry!==teleportRingGeo) object.geometry.dispose();
    if(object.material) object.material.dispose();
  }
}

function updateMothershipBeam(beam,ship,deltaSeconds=0.016){
  if(!beam || !ship) return false;

  beam.age+=deltaSeconds;
  let t=clamp(beam.age/beam.life,0,1);
  let beamOut=beam.mode==="out";
  let materialize=beamOut ? Math.pow(1-t,2.2) : 1-Math.pow(1-t,2.2);
  let fade=beamOut ? Math.sin(t*Math.PI) : Math.pow(1-t,1.35);
  fade=Math.max(0,fade);
  let pulse=0.5+0.5*Math.sin(beam.age*11.5);
  let surfaceY=drivingSurfaceHeight(ship.x,ship.z);

  beam.beam.position.set(ship.x,surfaceY+beam.height*0.5,ship.z);
  beam.beam.scale.set(
    beam.radius*(0.9+pulse*0.08)*(1-t*0.28),
    beam.height*(1+Math.sin(t*Math.PI)*0.08),
    beam.radius*(0.9+pulse*0.08)*(1-t*0.28)
  );
  beam.beam.material.opacity=beamOut ? 0.12+0.34*fade : 0.28*fade+0.04*Math.sin(t*Math.PI);

  beam.core.position.copy(beam.beam.position);
  beam.core.scale.set(4.2+pulse*2.8,beam.height*(1.02+t*0.08),4.2+pulse*2.8);
  beam.core.material.opacity=(beamOut ? 0.68 : 0.45+0.16*pulse)*fade;

  beam.ring.position.set(ship.x,surfaceY+0.18,ship.z);
  beam.ring.scale.setScalar(beam.radius*(beamOut ? 1.25-materialize*0.92 : 0.22+materialize*1.15));
  beam.ring.material.opacity=(beamOut ? 0.82 : 0.66)*fade;

  beam.topRing.position.set(ship.x,ship.group.position.y+10,ship.z);
  beam.topRing.scale.setScalar(beam.radius*(beamOut ? 1.0-t*0.68 : 0.18+Math.sin(t*Math.PI)*0.72));
  beam.topRing.material.opacity=(beamOut ? 0.72 : 0.46)*fade;

  if(t>=1){
    disposeMothershipBeam(beam);
    return true;
  }

  return false;
}

function makeMothershipShadow(){
  let shadow=new THREE.Mesh(
    new THREE.CircleGeometry(1,64),
    new THREE.MeshBasicMaterial({
      color:0x000000,
      transparent:true,
      opacity:0.18,
      depthWrite:false,
      depthTest:true
    })
  );
  shadow.rotation.x=-Math.PI/2;
  shadow.scale.set(46,24,1);
  shadow.renderOrder=1;
  scene.add(shadow);
  return shadow;
}

function mothershipHitAlongSegment(fromX,fromY,fromZ,toX,toY,toZ,padding=0){
  if(!mothership || mothership.health<=0 || mothership.beamingOut) return null;

  let shipY=mothership.group ? mothership.group.position.y : mothership.y;
  let rx=34+padding;
  let ry=12+padding*0.55;
  let rz=18+padding;
  let ax=(fromX-mothership.x)/rx;
  let ay=(fromY-shipY)/ry;
  let az=(fromZ-mothership.z)/rz;
  let bx=(toX-fromX)/rx;
  let by=(toY-fromY)/ry;
  let bz=(toZ-fromZ)/rz;
  let a=bx*bx+by*by+bz*bz;
  let b=2*(ax*bx+ay*by+az*bz);
  let c=ax*ax+ay*ay+az*az-1;

  if(c<=0) return {x:fromX,y:fromY,z:fromZ};
  if(a<0.000001) return null;

  let disc=b*b-4*a*c;
  if(disc<0) return null;

  let root=Math.sqrt(disc);
  let t=(-b-root)/(2*a);
  if(t<0 || t>1) t=(-b+root)/(2*a);
  if(t<0 || t>1) return null;

  return {
    x:fromX+(toX-fromX)*t,
    y:fromY+(toY-fromY)*t,
    z:fromZ+(toZ-fromZ)*t
  };
}

function damageMothership(x,y,z,amount=1){
  if(!mothership || mothership.health<=0 || mothership.beamingOut) return;
  mothership.health-=amount;
  mothership.hitFlash=Math.max(mothership.hitFlash,10);
  spawnMothershipImpactBurst(x,y,z);

  for(let i=0;i<8;i++){
    dust.spawnThrusterParticle(
      x,
      y,
      z,
      (Math.random()-0.5)*2.4,
      (Math.random()-0.5)*2.4,
      (Math.random()-0.5)*2.2,
      0.18,
      0.08+Math.random()*0.06
    );
  }

  if(mothership.health<=0){
    let shipY=mothership.group ? mothership.group.position.y : mothership.y;
    spawnRadiusExplosion(mothership.x,shipY,mothership.z,96);
    for(let i=0;i<7;i++){
      let angle=(i/7)*Math.PI*2+Math.random()*0.25;
      let dist=12+Math.random()*26;
      spawnRocketExplosion(
        mothership.x+Math.cos(angle)*dist,
        shipY-4+Math.random()*12,
        mothership.z+Math.sin(angle)*dist
      );
    }
    addUnits(mothershipUnitAmount);
    advanceGeneratedPlanetMission("mothership",1);
    removeMothership();
    scheduleNextMothership();
  }
}

function spawnMothership(){
  if(mothership || gameOver || ambientEnemyCount()>10) return false;

  let center=playerCenter();
  let angle=Math.random()*Math.PI*2;
  let hoverX=center.x+Math.cos(angle)*mothershipHoverDistance;
  let hoverZ=center.z+Math.sin(angle)*mothershipHoverDistance;
  let exitX=center.x-Math.cos(angle)*(mothershipHoverDistance+520);
  let exitZ=center.z-Math.sin(angle)*(mothershipHoverDistance+520);
  let x=hoverX;
  let z=hoverZ;
  let dx=center.x-hoverX;
  let dz=center.z-hoverZ;
  let group=makeMothershipModel();
  let y=drivingSurfaceHeight(hoverX,hoverZ)+mothershipHoverAltitude-4+Math.random()*8;
  let surfaceY=drivingSurfaceHeight(x,z);

  group.position.set(x,y,z);
  group.rotation.y=Math.atan2(dx,dz);
  group.scale.setScalar(0.04);
  scene.add(group);
  if(motorAudio.startMothershipHum) motorAudio.startMothershipHum({x,y,z});

  mothership={
    group,
    shadow:makeMothershipShadow(),
    beam:null,
    x,
    y,
    z,
    hoverX,
    hoverZ,
    exitX,
    exitZ,
    vx:0,
    vz:0,
    age:0,
    health:mothershipRocketHits,
    hitFlash:0,
    hasReachedHover:true,
    hoverFrames:0,
    life:mothershipBeamFrames+mothershipHoverFrames+1280,
    dropTimer:70,
    dropsRemaining:mothershipDropCount,
    dropsDone:0,
    beamAge:0,
    beamFrames:mothershipBeamFrames,
    beamOutAge:0,
    beamOutFrames:mothershipBeamOutFrames,
    materializing:true,
    beamingOut:false,
    phase:Math.random()*Math.PI*2
  };
  mothership.beam=createMothershipBeam(x,z,surfaceY,y);
  return true;
}

function dropSpiderFromMothership(){
  if(!mothership || ambientEnemyCount()>14) return false;

  let rightX=Math.cos(mothership.group.rotation.y);
  let rightZ=-Math.sin(mothership.group.rotation.y);
  let forwardX=Math.sin(mothership.group.rotation.y);
  let forwardZ=Math.cos(mothership.group.rotation.y);
  let dropIndex=mothership.dropsDone || 0;
  let centerOffset=(dropIndex-(mothershipDropCount-1)*0.5)*mothershipDropLineSpacing;
  let x=mothership.hoverX+rightX*centerOffset;
  let z=mothership.hoverZ+rightZ*centerOffset;

  for(let attempt=0;attempt<5;attempt++){
    let testX=x+forwardX*attempt*12;
    let testZ=z+forwardZ*attempt*12;
    if(waterDepthAt(testX,testZ)<=1.2 && !world.collidesWithObstacles(testX,testZ)){
      x=testX;
      z=testZ;
      break;
    }
  }
  if(waterDepthAt(x,z)>1.2 || world.collidesWithObstacles(x,z)) return false;

  let spider=createEnemyState(++enemySpawnSerial,x,z,"spider");
  spider.isPatrol=true;
  let shipY=mothership.group ? mothership.group.position.y : mothership.y;
  spider.y=shipY-10;
  spider.group.position.set(spider.x,spider.y,spider.z);
  spider.angle=mothership.group.rotation.y+Math.PI+(Math.random()-0.5)*0.8;
  spider.velAngle=spider.angle;
  if(spider.shadow) spider.shadow.update({carX:spider.x,carZ:spider.z,carY:spider.y,surfaceY:drivingSurfaceHeight(x,z),carVelAngle:spider.angle});
  enemies.push(spider);
  spawnEnemyTeleportEffect(spider);

  for(let i=0;i<10;i++){
    dust.spawnThrusterParticle(
      x,
      shipY-9,
      z,
      (Math.random()-0.5)*0.8,
      (Math.random()-0.5)*0.8,
      -1.2-Math.random()*1.6,
      0.16,
      0.06+Math.random()*0.05
    );
  }
  mothership.dropsDone=dropIndex+1;
  return true;
}

function updateMothership(){
  if(!mothership){
    if(!gameOver && gameStarted && !missionEnemyGraceActive()){
      mothershipDelay--;
      if(mothershipDelay<=0 && !spawnMothership()) scheduleNextMothership();
    }
    return;
  }

  mothership.age++;
  let materializeScale=1;
  if(mothership.beamingOut){
    mothership.beamOutAge++;
    let t=clamp(mothership.beamOutAge/Math.max(1,mothership.beamOutFrames),0,1);
    materializeScale=Math.max(0.02,Math.pow(1-t,2.1));
    mothership.vx=0;
    mothership.vz=0;
  }else if(mothership.materializing){
    mothership.beamAge++;
    let t=clamp(mothership.beamAge/Math.max(1,mothership.beamFrames),0,1);
    materializeScale=0.04+(1-Math.pow(1-t,2.4))*0.96;
    mothership.x=mothership.hoverX;
    mothership.z=mothership.hoverZ;
    mothership.vx=0;
    mothership.vz=0;
    if(t>=1) mothership.materializing=false;
  }else{
    let hoverDx=mothership.hoverX-mothership.x;
    let hoverDz=mothership.hoverZ-mothership.z;
    let hoverDistance=Math.hypot(hoverDx,hoverDz);
    if(hoverDistance<18) mothership.hasReachedHover=true;
  }
  let hovering=!mothership.beamingOut && !mothership.materializing && mothership.hasReachedHover && mothership.hoverFrames<mothershipHoverFrames;

  if(hovering){
    mothership.hoverFrames++;
    mothership.x=mothership.hoverX+Math.sin(mothership.age*0.018+mothership.phase)*3.6;
    mothership.z=mothership.hoverZ+Math.cos(mothership.age*0.016+mothership.phase)*3.6;
  }else{
    if(!mothership.materializing && !mothership.beamingOut){
      let targetX=mothership.hoverFrames>=mothershipHoverFrames ? mothership.exitX : mothership.hoverX;
      let targetZ=mothership.hoverFrames>=mothershipHoverFrames ? mothership.exitZ : mothership.hoverZ;
      let dx=targetX-mothership.x;
      let dz=targetZ-mothership.z;
      let len=Math.max(0.001,Math.hypot(dx,dz));
      let speed=mothership.hoverFrames>=mothershipHoverFrames ? 1.12 : 2.45;
      mothership.vx=(dx/len)*speed;
      mothership.vz=(dz/len)*speed;
      mothership.x+=mothership.vx;
      mothership.z+=mothership.vz;
      mothership.group.rotation.y+=normalizeAngle(Math.atan2(dx,dz)-mothership.group.rotation.y)*0.04;
    }
  }
  let bob=Math.sin(mothership.age*0.025+mothership.phase)*4;
  if(mothership.hoverFrames<mothershipHoverFrames){
    let targetY=drivingSurfaceHeight(mothership.x,mothership.z)+mothershipHoverAltitude;
    mothership.y+=(targetY-mothership.y)*0.035;
  }
  mothership.group.position.set(mothership.x,mothership.y+bob,mothership.z);
  mothership.group.rotation.z=Math.sin(mothership.age*0.018+mothership.phase)*0.035;
  if(mothership.beam){
    if(updateMothershipBeam(mothership.beam,mothership)) mothership.beam=null;
  }
  if(motorAudio.updateMothershipHum){
    let beamIntensity=mothership.materializing || mothership.beamingOut ? materializeScale : 1;
    motorAudio.updateMothershipHum(beamIntensity,{x:mothership.x,y:mothership.group.position.y,z:mothership.z});
  }
  if(mothership.shadow){
    let surfaceY=drivingSurfaceHeight(mothership.x,mothership.z);
    let altitude=Math.max(1,mothership.group.position.y-surfaceY);
    let shadowScale=clamp(1.1-altitude*0.004,0.72,1);
    mothership.shadow.position.set(mothership.x,surfaceY+0.08,mothership.z);
    mothership.shadow.rotation.z=-mothership.group.rotation.y;
    mothership.shadow.scale.set(46*shadowScale,24*shadowScale,1);
    mothership.shadow.material.opacity=clamp(0.24-altitude*0.0014,0.12,0.2)*(mothership.materializing || mothership.beamingOut ? materializeScale : 1);
  }
  if(mothership.group.userData.bay){
    mothership.group.userData.bay.scale.setScalar(1+Math.sin(mothership.age*0.18)*0.08);
  }
  if(mothership.group.userData.hoverHazeLower){
    let pulse=0.5+0.5*Math.sin(mothership.age*0.11+mothership.phase);
    let flicker=0.5+0.5*Math.sin(mothership.age*0.37+mothership.phase*1.7);
    let lower=mothership.group.userData.hoverHazeLower;
    let upper=mothership.group.userData.hoverHazeUpper;
    let core=mothership.group.userData.hoverHazeCore;
    lower.material.opacity=lower.userData.baseOpacity*(0.72+pulse*0.42);
    lower.scale.set(
      lower.userData.baseScale.x*(0.94+pulse*0.12),
      lower.userData.baseScale.y*(0.82+flicker*0.18),
      lower.userData.baseScale.z*(0.94+pulse*0.12)
    );
    upper.material.opacity=upper.userData.baseOpacity*(0.78+flicker*0.46);
    upper.scale.set(
      upper.userData.baseScale.x*(0.9+flicker*0.16),
      upper.userData.baseScale.y*(0.82+pulse*0.18),
      upper.userData.baseScale.z*(0.9+flicker*0.16)
    );
    core.material.opacity=core.userData.baseOpacity*(0.7+flicker*0.55);
    core.scale.set(
      core.userData.baseScale.x*(0.86+pulse*0.22),
      core.userData.baseScale.y*(0.9+flicker*0.22),
      core.userData.baseScale.z*(0.86+pulse*0.22)
    );
  }
  if(mothership.group.userData.aura){
    let pulse=0.5+0.5*Math.sin(mothership.age*0.045+mothership.phase);
    let colorCycle=0.5+0.5*Math.sin(mothership.age*0.006+mothership.phase);
    let colorMix=0.5+0.5*Math.sin(mothership.age*0.004+mothership.phase+1.7);
    mothershipAuraColorTemp.copy(mothershipAuraColorA).lerp(mothershipAuraColorB,colorCycle).lerp(mothershipAuraColorC,colorMix*0.55);
    mothership.group.userData.aura.material.color.copy(mothershipAuraColorTemp);
    mothership.group.userData.aura.material.opacity=0.12+pulse*0.06;
    mothership.group.userData.aura.scale.set(34+pulse*1.8,8.2+pulse*0.5,18+pulse*1.0);
  }
  if(mothership.group.userData.lowerAura){
    let pulse=0.5+0.5*Math.sin(mothership.age*0.065+mothership.phase+1.4);
    let colorCycle=0.5+0.5*Math.sin(mothership.age*0.006+mothership.phase+0.9);
    let colorMix=0.5+0.5*Math.sin(mothership.age*0.004+mothership.phase+2.4);
    mothershipAuraColorTemp.copy(mothershipAuraColorC).lerp(mothershipAuraColorB,colorCycle*0.75).lerp(mothershipAuraColorA,colorMix*0.45);
    mothership.group.userData.lowerAura.material.color.copy(mothershipAuraColorTemp);
    mothership.group.userData.lowerAura.material.opacity=0.16+pulse*0.08;
    mothership.group.userData.lowerAura.scale.set(24+pulse*1.4,3.6+pulse*0.35,13+pulse*0.8);
  }
  if(mothership.hitFlash>0){
    mothership.group.scale.setScalar(materializeScale*(1+Math.sin(mothership.hitFlash*1.7)*0.012));
    mothership.hitFlash--;
  }else{
    mothership.group.scale.setScalar(materializeScale);
  }

  if(!mothership.materializing && !mothership.beamingOut && mothership.hoverFrames>=mothershipHoverFrames && mothership.dropsRemaining>0){
    mothership.dropTimer--;
    if(mothership.dropTimer<=0){
      if(dropSpiderFromMothership()) mothership.dropsRemaining--;
      mothership.dropTimer=mothershipDropInterval;
    }
  }

  if(!mothership.beamingOut && mothership.age>mothership.life){
    let shipY=mothership.group ? mothership.group.position.y : mothership.y;
    mothership.beamingOut=true;
    mothership.beamOutAge=0;
    mothership.materializing=false;
    if(mothership.beam) disposeMothershipBeam(mothership.beam);
    mothership.beam=createMothershipBeam(
      mothership.x,
      mothership.z,
      drivingSurfaceHeight(mothership.x,mothership.z),
      shipY,
      "out"
    );
  }

  if(mothership.beamingOut && mothership.beamOutAge>=mothership.beamOutFrames){
    removeMothership();
    scheduleNextMothership();
  }
}

function clearEnemies(){
  for(let enemy of enemies){
    enemy.active=false;
    enemy.group.visible=false;
    if(enemy.shadow){
      enemy.shadow.dispose();
      enemy.shadow=null;
    }
    scene.remove(enemy.group);
  }
  enemies=[];
  enemyWaveDelay=0;
  enemyPatrolDelay=900;
  removeMothership();
  scheduleNextMothership();
}

function updateEnemy(enemy,settings=currentDifficulty(),targetableCars=enemyTargetableCars()){
  if(!enemy.active || enemy.health<=0) return;
  if(enemy.cannonCooldown>0) enemy.cannonCooldown--;

  let target=smartEnemyTarget(enemy,targetableCars);
  if(!target){
    enemy.speed*=0.9;
    return;
  }

  enemy.aiTarget=target;
  let dx=target.x-enemy.x;
  let dz=target.z-enemy.z;
  let distance=Math.max(0.001,Math.hypot(dx,dz));
  let targetAngle=Math.atan2(dx,dz);
  let predictedTarget=predictedTargetPointForEnemy(enemy,target,distance);
  let aimTargetAngle=Math.atan2(predictedTarget.x-enemy.x,predictedTarget.z-enemy.z);
  let tacticalTargetAngle=updateEnemyTacticalState(enemy,distance,aimTargetAngle);
  if(enemy.isBoat){
    updateBoatEnemy(enemy,target,distance,aimTargetAngle,settings);
    return;
  }
  let desiredAngle=tacticalTargetAngle;
  let desiredSpeed;
  let missionOutpostActive=enemy.missionOutpost && !enemy.missionOutpost.destroyed;

  if(missionOutpostActive){
    let homeX=Number.isFinite(enemy.guardX) ? enemy.guardX : enemy.missionOutpost.x;
    let homeZ=Number.isFinite(enemy.guardZ) ? enemy.guardZ : enemy.missionOutpost.z;
    let homeDx=homeX-enemy.x;
    let homeDz=homeZ-enemy.z;
    let homeDistance=Math.hypot(homeDx,homeDz);
    let homeAngle=Math.atan2(homeDx,homeDz);
    let outpostDx=enemy.missionOutpost.x-enemy.x;
    let outpostDz=enemy.missionOutpost.z-enemy.z;
    let outpostDistance=Math.hypot(outpostDx,outpostDz);
    let engageDistance=enemy.isDrone ? 420 : enemy.isBuggy ? 360 : 320;
    let leashDistance=enemy.isDrone ? 260 : 210;

    if(distance<engageDistance && outpostDistance<leashDistance){
      desiredAngle=tacticalTargetAngle;
      desiredSpeed=(enemy.isDrone ? 0.3 : enemy.isBuggy ? 0.32 : 0.22)*(enemy.aiAggression || 1);
      if(distance<70){
        desiredAngle=tacticalTargetAngle+Math.PI+enemy.aiStrafe*0.28;
        desiredSpeed=enemy.isBuggy ? 0.18 : 0.12;
      }
    }else if(homeDistance>18){
      desiredAngle=homeAngle;
      desiredSpeed=enemy.isDrone ? 0.24 : enemy.isBuggy ? 0.2 : 0.14;
    }else{
      let patrolTime=performance.now()*0.00045*(enemy.aiStrafe || 1)+enemy.guardPhase;
      let radius=enemy.guardRadius || 86;
      let patrolX=enemy.missionOutpost.x+Math.sin(patrolTime)*radius;
      let patrolZ=enemy.missionOutpost.z+Math.cos(patrolTime)*radius;
      desiredAngle=Math.atan2(patrolX-enemy.x,patrolZ-enemy.z);
      desiredSpeed=enemy.isDrone ? 0.16 : enemy.isBuggy ? 0.12 : 0.07;
    }
  }else if(enemy.isBuggy){
    let minDistance=76;
    let preferredDistance=enemy.aiPreferredRange || 138;
    let farDistance=preferredDistance+74;
    if(distance<minDistance){
      let escapeStrength=clamp((minDistance-distance)/minDistance,0,1);
      desiredAngle=tacticalTargetAngle+Math.PI+enemy.aiStrafe*(0.12+escapeStrength*0.22);
      desiredSpeed=0.16+escapeStrength*0.12;
    }else if(distance>farDistance){
      desiredAngle=tacticalTargetAngle+enemy.aiStrafe*0.07;
      desiredSpeed=0.42*(enemy.aiAggression || 1);
    }else{
      let orbit=0.12+Math.sin(performance.now()*0.00065+enemy.guardPhase)*0.035;
      desiredAngle=tacticalTargetAngle+enemy.aiStrafe*orbit;
      desiredSpeed=distance>preferredDistance ? 0.26 : 0.12;
    }
    if(distance>78 && distance<186 && enemy.cannonCooldown<20){
      desiredAngle=tacticalTargetAngle+enemy.aiStrafe*0.025;
    }
  }else if(enemy.isSpider){
    if(distance<22){
      desiredAngle+=enemy.aiStrafe*clamp((22-distance)/18,0,1)*0.42;
    }
    desiredSpeed=distance>18 ? 0.28 : 0.12;
  }else if(enemy.isDrone){
    let minAimableDistance=48;
    let preferredDistance=enemy.aiPreferredRange || 74;
    let farDistance=preferredDistance+34;
    if(distance<minAimableDistance){
      let escapeStrength=clamp((minAimableDistance-distance)/minAimableDistance,0,1);
      desiredAngle=tacticalTargetAngle+Math.PI+enemy.aiStrafe*(0.34+escapeStrength*0.7);
      desiredSpeed=0.24+escapeStrength*0.22;
    }else if(distance<preferredDistance){
      let ringT=clamp((preferredDistance-distance)/(preferredDistance-minAimableDistance),0,1);
      desiredAngle=tacticalTargetAngle+enemy.aiStrafe*(0.68+ringT*0.42);
      desiredSpeed=0.12+ringT*0.08;
    }else if(distance>farDistance){
      desiredAngle=tacticalTargetAngle+enemy.aiStrafe*0.22;
      desiredSpeed=0.34*(enemy.aiAggression || 1);
    }else{
      desiredAngle=tacticalTargetAngle+enemy.aiStrafe*(0.82+Math.sin(performance.now()*0.0016+enemy.guardPhase)*0.14);
      desiredSpeed=0.12;
    }
    if(distance>=minAimableDistance && distance<=farDistance && enemy.cannonCooldown<18){
      desiredAngle=tacticalTargetAngle+enemy.aiStrafe*0.18;
    }
  }else if(enemy.isGuard){
    if(distance<44){
      desiredAngle+=enemy.aiStrafe*clamp((44-distance)/28,0,1)*0.52;
    }
    desiredSpeed=distance>70 ? 0.3 : distance>38 ? 0.14 : -0.05;
  }else if(enemy.isGiant){
    if(distance<62){
      desiredAngle+=enemy.aiStrafe*clamp((62-distance)/38,0,1)*0.28;
    }
    desiredSpeed=distance>88 ? 0.2 : distance>46 ? 0.085 : -0.035;
  }else if(enemy.spawnVillage && !enemy.isPatrol){
    let homeX=Number.isFinite(enemy.guardX) ? enemy.guardX : enemy.spawnVillage.x;
    let homeZ=Number.isFinite(enemy.guardZ) ? enemy.guardZ : enemy.spawnVillage.z;
    let homeDx=homeX-enemy.x;
    let homeDz=homeZ-enemy.z;
    let homeDistance=Math.hypot(homeDx,homeDz);
    let homeAngle=Math.atan2(homeDx,homeDz);

    if(distance>74 && homeDistance<18){
      desiredAngle=tacticalTargetAngle;
      desiredSpeed=0.035;
    }else if(homeDistance>24){
      desiredAngle=homeAngle;
      desiredSpeed=0.16;
    }else if(homeDistance>10){
      desiredAngle=homeAngle;
      desiredSpeed=0.055;
    }else{
      desiredAngle=tacticalTargetAngle+enemy.aiStrafe*0.18*Math.sin(performance.now()*0.0015+enemy.guardPhase);
      desiredSpeed=0.012*Math.sin(performance.now()*0.002+enemy.guardPhase);
    }
  }else{
    if(distance<48){
      desiredAngle+=enemy.aiStrafe*clamp((48-distance)/28,0,1)*0.68;
    }
    desiredSpeed=distance>58 ? 0.38 : distance>30 ? 0.18 : -0.08;
  }

  if(enemy.isBuggy){
    if(!Number.isFinite(enemy.steadyDesiredAngle)) enemy.steadyDesiredAngle=enemy.angle;
    let steadyDelta=normalizeAngle(desiredAngle-enemy.steadyDesiredAngle);
    enemy.steadyDesiredAngle=normalizeAngle(enemy.steadyDesiredAngle+clamp(steadyDelta,-0.035,0.035));
    desiredAngle=enemy.steadyDesiredAngle;
  }

  let turnLimit=enemy.isGiant ? 0.026 : enemy.isBuggy ? 0.028 : enemy.isDrone || enemy.isSpider ? 0.075 : 0.045;
  let turn=clamp(normalizeAngle(desiredAngle-enemy.angle),-turnLimit,turnLimit);
  enemy.angle=normalizeAngle(enemy.angle+turn);

  desiredSpeed*=settings.speed;
  let speedStep=(enemy.isBuggy ? 0.0075 : 0.012)*settings.speed;
  enemy.speed+=clamp(desiredSpeed-enemy.speed,-speedStep,speedStep);
  let maxEnemySpeed=(enemy.isSpider ? 0.32 : enemy.isDrone ? 0.48 : enemy.isBuggy ? 0.46 : enemy.isGiant ? 0.22 : enemy.isGuard ? 0.32 : enemy.isBoss ? 0.15 : enemy.spawnVillage && !enemy.isPatrol ? 0.18 : 0.42)*settings.speed;
  enemy.speed=clamp(enemy.speed,-(enemy.isBuggy ? 0.08 : 0.14)*settings.speed,maxEnemySpeed);

  let prevX=enemy.x;
  let prevZ=enemy.z;
  if(!gameOver){
    enemy.x+=Math.sin(enemy.angle)*enemy.speed;
    enemy.z+=Math.cos(enemy.angle)*enemy.speed;
  }

  let collision=enemy.isDrone ? {hit:false} : movementCollision(enemy,prevX,prevZ,enemy.x,enemy.z);
  if(collision.hit){
    enemy.x=collision.safeX;
    enemy.z=collision.safeZ;
    enemy.speed*=enemy.isBuggy ? -0.08 : -0.25;
    enemy.angle=normalizeAngle(enemy.angle+(Math.random()<0.5 ? -1 : 1)*(enemy.isBuggy ? 0.22 : 0.55));
    if(enemy.isBuggy) enemy.steadyDesiredAngle=enemy.angle;
    enemy.aiStrafe*=-1;
    enemy.blockedFrames=(enemy.blockedFrames || 0)+6;
    if((enemy.isSpider || enemy.isGiant) && collision.otherCar && enemy.contactCooldown<=0){
      damageCar(collision.otherCar,enemy.isGiant ? 8 : 4);
      rattleActor(collision.otherCar,enemy.isGiant ? 1.1 : 0.6);
      enemy.contactCooldown=42;
    }
  }else if(!enemy.isDrone && Math.abs(enemy.speed)>0.045){
    let movedSq=(enemy.x-prevX)*(enemy.x-prevX)+(enemy.z-prevZ)*(enemy.z-prevZ);
    let blockedThreshold=Math.max(0.02,Math.abs(enemy.speed)*0.18);
    if(movedSq<blockedThreshold*blockedThreshold){
      enemy.blockedFrames=(enemy.blockedFrames || 0)+1;
    }else{
      enemy.blockedFrames=Math.max(0,(enemy.blockedFrames || 0)-1);
    }
  }else{
    enemy.blockedFrames=Math.max(0,(enemy.blockedFrames || 0)-1);
  }
  if(enemy.contactCooldown>0) enemy.contactCooldown--;

  let surfaceY=drivingSurfaceHeight(enemy.x,enemy.z);
  if(enemy.isDrone){
    let hoverOffset=22+Math.sin(performance.now()*0.002+enemy.guardPhase)*4;
    let targetY=Math.max(surfaceY+hoverOffset,target.y+14);
    enemy.y+=(targetY-enemy.y)*0.08;
    enemy.pitch=clamp((target.y-enemy.y)*0.015,-0.32,0.08);
    enemy.onGround=false;
    enemy.airborne=true;
    if(enemy.droneModel && enemy.droneModel.userData.core){
      enemy.droneModel.userData.core.scale.setScalar(1+Math.sin(performance.now()*0.025+enemy.guardPhase)*0.12);
    }
  }else if(settings.hardFlight && !enemy.isBuggy && enemy.flightTimer>0){
    enemy.flightTimer--;
    let flightOffset=enemy.isPatrol ? 24 : 12;
    let targetY=surfaceY+flightOffset+Math.sin(performance.now()*0.0018+enemy.guardPhase)*3.5;
    enemy.y+=(targetY-enemy.y)*0.045;
    enemy.onGround=false;
    enemy.airborne=true;
  }else{
    if(settings.hardFlight && !enemy.isBuggy && enemy.flightCooldown>0) enemy.flightCooldown--;
    if(settings.hardFlight && !enemy.isBuggy && enemy.flightCooldown<=0 && distance>34 && Math.random()<0.018){
      enemy.flightTimer=150+Math.floor(Math.random()*130);
      enemy.flightCooldown=260+Math.floor(Math.random()*220);
    }
    let yFollow=enemy.isBuggy ? 0.14 : 0.22;
    enemy.y+=(surfaceY-enemy.y)*yFollow;
    if(Math.abs(enemy.y-surfaceY)<(enemy.isBuggy ? 0.08 : 0.05)) enemy.y=surfaceY;
    enemy.onGround=true;
    enemy.airborne=false;
  }
  enemy.velAngle=enemy.angle;
  enemy.group.position.set(enemy.x,enemy.y,enemy.z);
  enemy.group.rotation.y=enemy.angle;
  enemy.group.rotation.x=enemy.pitch;
  enemy.group.rotation.z=0;
  updateMechAnimation(enemy);
  if(enemy.spiderModel && enemy.spiderModel.userData.legs){
    let t=performance.now()*0.018+enemy.guardPhase;
    for(let leg of enemy.spiderModel.userData.legs){
      leg.mesh.rotation.x=leg.baseRotation.x+Math.sin(t+leg.phase)*0.36;
      leg.mesh.rotation.z=leg.baseRotation.z+Math.cos(t*1.15+leg.phase)*0.22;
    }
    if(enemy.spiderModel.userData.core){
      enemy.spiderModel.userData.core.scale.setScalar(1+Math.sin(t*1.8)*0.1);
    }
  }
  if(enemy.buggyModel && enemy.buggyModel.userData){
    let trackSpeed=Math.max(-0.24,Math.min(0.72,enemy.speed))*0.018;
    let trackOffset=(enemy.buggyModel.userData.trackOffset || 0)+trackSpeed;
    trackOffset=trackOffset-Math.floor(trackOffset);
    enemy.buggyModel.userData.trackOffset=trackOffset;
    for(let track of enemy.buggyModel.userData.tracks || []){
      let offset=trackOffset+(track.phase || 0);
      for(let pad of track.pads || []){
        let t=(pad.baseT+offset)%1;
        if(t<0) t+=1;
        let y;
        let z;
        let rotX;
        if(t<0.35){
          let u=t/0.35;
          z=-2.74+u*5.48;
          y=-0.56;
          rotX=0;
        }else if(t<0.5){
          let u=(t-0.35)/0.15;
          z=2.74+Math.sin(u*Math.PI)*0.2;
          y=-0.56+u*1.12;
          rotX=u*Math.PI;
        }else if(t<0.85){
          let u=(t-0.5)/0.35;
          z=2.74-u*5.48;
          y=0.56;
          rotX=Math.PI;
        }else{
          let u=(t-0.85)/0.15;
          z=-2.74-Math.sin(u*Math.PI)*0.2;
          y=0.56-u*1.12;
          rotX=Math.PI+u*Math.PI;
        }
        pad.mesh.position.set(0,y,z);
        pad.mesh.rotation.x=rotX;
      }
    }
    animateEnemyBuggyWheels(enemy.buggyModel,enemy.speed);
    if(enemy.buggyModel.userData.launcher){
      let localAim=clamp(normalizeAngle(aimTargetAngle-enemy.angle),-0.64,0.64);
      enemy.buggyModel.userData.launcher.rotation.y+=(localAim-enemy.buggyModel.userData.launcher.rotation.y)*0.16;
      enemy.buggyModel.userData.launcher.rotation.x=-0.08-Math.min(0.24,Math.max(0,(distance-70)/360));
    }
  }

  let fireRange=enemy.isBuggy ? 190 : enemy.isDrone ? 118 : enemy.isGiant ? 132 : enemy.isGuard ? 96 : enemy.isBoss ? 112 : 82;
  let fireArc=enemy.isBuggy ? 0.76 : enemy.isDrone ? 0.82 : enemy.isGiant ? 0.58 : enemy.isGuard ? 0.62 : enemy.isBoss ? 0.68 : 0.52;
  if(!enemy.isSpider && distance<fireRange && Math.abs(normalizeAngle(aimTargetAngle-enemy.angle))<fireArc){
    if(enemy.isBuggy ? (distance>58 && fireEnemyBuggyRocket(enemy,target)) : fireCannon(enemy)){
      let baseDelay=enemy.isBuggy ? 138+Math.floor(Math.random()*84) : enemy.isDrone ? 54+Math.floor(Math.random()*42) : enemy.isGiant ? 92+Math.floor(Math.random()*46) : enemy.isGuard ? 64+Math.floor(Math.random()*36) : enemy.isBoss ? 44+Math.floor(Math.random()*36) : 78+Math.floor(Math.random()*58);
      enemy.cannonCooldown=scaledDelay(baseDelay,settings.fireDelay);
    }
  }

  if(enemy.hitRattle>0){
    let shake=enemy.hitRattle;
    let t=performance.now()*0.04+enemy.hitRattleSeed;
    enemy.group.rotation.x+=Math.sin(t*1.7)*0.08*shake;
    enemy.group.rotation.z+=Math.cos(t*2.1)*0.11*shake;
    enemy.group.position.x+=Math.sin(t*2.6)*0.14*shake;
    enemy.group.position.y+=Math.abs(Math.sin(t*3.1))*0.12*shake;
    enemy.group.position.z+=Math.cos(t*2.3)*0.14*shake;
    enemy.hitRattle=Math.max(0,enemy.hitRattle-0.055);
  }

  if(enemy.shadow) enemy.shadow.update({carX:enemy.x,carZ:enemy.z,carY:enemy.y,surfaceY,carVelAngle:enemy.angle});
}

function updateEnemies(){
  let settings=currentDifficulty();
  let targetableCars=enemyTargetableCars();
  let farEnemyUpdateDistance=currentFrameStressLevel>=2 ? 260 : currentFrameStressLevel>=1 ? 340 : 420;
  let farEnemyUpdateEvery=currentFrameStressLevel>=2 ? 4 : 3;
  let farEnemyUpdateDistanceSq=farEnemyUpdateDistance*farEnemyUpdateDistance;
  for(let enemy of enemies){
    let distSq=playerDistanceSqForEnemy(enemy,targetableCars);
    let skipFarUpdate=enemy.active
      && distSq>farEnemyUpdateDistanceSq
      && enemy.hitRattle<=0
      && !enemy.isBoss
      && ((enemy.lodFrame=(enemy.lodFrame || 0)+1)%farEnemyUpdateEvery!==0);

    if(!skipFarUpdate) updateEnemy(enemy,settings,targetableCars);
    let missionGuardActive=enemy.missionOutpost && !enemy.missionOutpost.destroyed;
    if(enemy.active && distSq>720*720 && !missionGuardActive){
      enemy.active=false;
      enemy.group.visible=false;
      if(enemy.shadow){
        enemy.shadow.dispose();
        enemy.shadow=null;
      }
      scene.remove(enemy.group);
    }
  }
  enemies=enemies.filter(enemy=>enemy.active);

  if(missionEnemyGraceActive()){
    return;
  }

  let ambientCount=ambientEnemyCount(targetableCars);
  if(ambientCount<=1){
    if(enemyWaveDelay>0) enemyWaveDelay--;
    else{
      if(spawnEnemyWave()){
        enemyWaveDelay=scaledDelay(420,settings.waveDelay);
      }else{
        enemyWaveDelay=scaledDelay(90,settings.waveDelay);
      }
    }
  }

  if(enemyPatrolDelay>0) enemyPatrolDelay--;
  else{
    if(ambientCount<8 && spawnEnemyPatrol()){
      enemyPatrolDelay=scaledDelay(1500+Math.floor(Math.random()*1200),settings.patrolDelay);
    }else{
      enemyPatrolDelay=scaledDelay(360,settings.patrolDelay);
    }
  }
}

function updateVillageTurrets(){
  if(gameDifficulty==="easy") return;
  let targetableCars=enemyTargetableCars();
  if(!targetableCars.length) return;

  for(let turret of world.activeTurrets || []){
    if(!turret || turret.destroyed) continue;
    let target=null;
    let bestDistSq=Infinity;

    for(let car of targetableCars){
      let dx=car.x-turret.x;
      let dz=car.z-turret.z;
      let distSq=dx*dx+dz*dz;
      if(distSq<bestDistSq){
        bestDistSq=distSq;
        target=car;
      }
    }

    if(!target || bestDistSq>170*170) continue;

    let y=drivingSurfaceHeight(turret.x,turret.z)+0.2;
    let angle=Math.atan2(target.x-turret.x,target.z-turret.z);
    if(turret.object){
      turret.object.rotation.y+=normalizeAngle(angle-turret.object.rotation.y)*0.12;
    }

    if(!turret.actor){
      turret.actor={
        id:`turret-${Math.round(turret.x)}-${Math.round(turret.z)}`,
        isEnemy:true,
        health:1,
        x:turret.x,
        y,
        z:turret.z,
        angle,
        aiTarget:target,
        cannonCooldown:40+Math.floor(Math.random()*70),
        morphed:false,
        morphProgress:0,
        jetMode:false,
        jetProgress:0
      };
    }

    let actor=turret.actor;
    actor.x=turret.x;
    actor.y=y;
    actor.z=turret.z;
    actor.angle=angle;
    actor.aiTarget=target;
    actor.health=1;
    if(actor.cannonCooldown>0) actor.cannonCooldown--;
    if(actor.cannonCooldown<=0 && fireCannon(actor)){
      actor.cannonCooldown=96+Math.floor(Math.random()*58);
    }
  }
}

function spawnBossLaserBeam(from,to){
  let direction=to.clone().sub(from).normalize();
  let side=new THREE.Vector3(-direction.z,0,direction.x);
  if(side.lengthSq()<0.001) side.set(1,0,0);
  side.normalize();
  let up=new THREE.Vector3(0,1,0);
  let layers=[];
  let offsets=[
    new THREE.Vector3(0,0,0),
    side.clone().multiplyScalar(0.22),
    side.clone().multiplyScalar(-0.22),
    up.clone().multiplyScalar(0.18),
    up.clone().multiplyScalar(-0.18)
  ];

  for(let i=0;i<offsets.length;i++){
    let offset=offsets[i];
    let material=(i===0 ? bossLaserMat : bossLaserGlowMat).clone();
    let geometry=new THREE.BufferGeometry().setFromPoints([
      from.clone().add(offset),
      to.clone().add(offset)
    ]);
    let line=new THREE.Line(geometry,material);
    line.renderOrder=20-i;
    scene.add(line);
    layers.push({line,material});
  }

  bossLaserBeams.push({layers,life:16,maxLife:16});
}

function clearBossLaserBeams(){
  for(let beam of bossLaserBeams){
    for(let layer of beam.layers || []){
      scene.remove(layer.line);
      layer.line.geometry.dispose();
      layer.material.dispose();
    }
  }
  bossLaserBeams=[];
}

function updateBossLaserBeams(){
  for(let i=bossLaserBeams.length-1;i>=0;i--){
    let beam=bossLaserBeams[i];
    beam.life--;
    let fade=Math.max(0,beam.life/beam.maxLife);
    for(let index=0;index<(beam.layers || []).length;index++){
      let layer=beam.layers[index];
      layer.material.opacity=fade*(index===0 ? 1 : 0.58);
    }
    if(beam.life<=0){
      for(let layer of beam.layers || []){
        scene.remove(layer.line);
        layer.line.geometry.dispose();
        layer.material.dispose();
      }
      bossLaserBeams.splice(i,1);
    }
  }
}

function updateBossBaseDefenses(){
  let targetableCars=enemyTargetableCars();
  if(!targetableCars.length) return;

  for(let base of world.bossBases || []){
    if(!base || !base.active || base.health<=0) continue;
    if(base.group && !base.group.visible) continue;

    if(base.impactPulse>0){
      let pulse=base.impactPulse;
      base.group.scale.setScalar(1+Math.sin(pulse*Math.PI)*0.018);
      base.impactPulse=Math.max(0,pulse-0.08);
    }else if(base.group.scale.x!==1){
      base.group.scale.setScalar(1);
    }

    base.reinforcementCooldown=Math.max(0,(base.reinforcementCooldown || 0)-1);

    for(let car of targetableCars){
      let dx=car.x-base.x;
      let dz=car.z-base.z;
      if(dx*dx+dz*dz<330*330){
        requestBossBaseReinforcements(base,2);
        break;
      }
    }

    for(let turret of base.turrets || []){
      let target=null;
      let bestDistSq=Infinity;
      turret.object.updateWorldMatrix(true,false);
      turret.object.getWorldPosition(bossLaserPointA);

      for(let car of targetableCars){
        let dx=car.x-bossLaserPointA.x;
        let dz=car.z-bossLaserPointA.z;
        let distSq=dx*dx+dz*dz;
        if(distSq<bestDistSq){
          bestDistSq=distSq;
          target=car;
        }
      }

      if(!target || bestDistSq>260*260) continue;

      let angle=Math.atan2(target.x-bossLaserPointA.x,target.z-bossLaserPointA.z);
      turret.object.rotation.y+=normalizeAngle(angle-base.angle-turret.object.rotation.y)*0.14;
      turret.cooldown=Math.max(0,(turret.cooldown || 0)-1);

      if(turret.cooldown<=0 && Math.abs(normalizeAngle(angle-base.angle-turret.object.rotation.y))<0.34){
        bossLaserPointB.set(target.x,target.y+2.1,target.z);
        spawnBossLaserBeam(bossLaserPointA,bossLaserPointB);
        if(motorAudio.playLaserFire) motorAudio.playLaserFire({x:bossLaserPointA.x,y:bossLaserPointA.y,z:bossLaserPointA.z});
        damageCar(target,7,{x:bossLaserPointB.x,y:bossLaserPointB.y,z:bossLaserPointB.z});
        rattleActor(target,0.45);
        turret.cooldown=72+Math.floor(Math.random()*38);
      }
    }
  }
}

function settleTrickAngle(value,amount){
  return value+normalizeAngle(-value)*amount;
}

function updateAirTricks(car,airborne){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);

  car.lastTrickButtons={...buttons};
  car.trickPitchVel=clamp(car.trickPitchVel,-0.19,0.19);
  car.trickRollVel=clamp(car.trickRollVel,-0.21,0.21);
  car.trickYawVel=clamp(car.trickYawVel,-0.18,0.18);

  car.trickPitch=normalizeAngle(car.trickPitch+car.trickPitchVel);
  car.trickRoll=normalizeAngle(car.trickRoll+car.trickRollVel);
  car.trickYaw=normalizeAngle(car.trickYaw+car.trickYawVel);

  if(airborne){
    car.trickPitchVel*=0.972;
    car.trickRollVel*=0.972;
    car.trickYawVel*=0.972;
  }else{
    car.trickPitchVel*=0.76;
    car.trickRollVel*=0.76;
    car.trickYawVel*=0.76;
    car.trickPitch=settleTrickAngle(car.trickPitch,0.24);
    car.trickRoll=settleTrickAngle(car.trickRoll,0.24);
    car.trickYaw=settleTrickAngle(car.trickYaw,0.18);

    if(Math.abs(car.trickPitch)<0.004) car.trickPitch=0;
    if(Math.abs(car.trickRoll)<0.004) car.trickRoll=0;
    if(Math.abs(car.trickYaw)<0.004) car.trickYaw=0;
  }
}

function updateMorphInput(car){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let keyboardMorph=gameMode==="single" && car===playerCar && input.keys.t;
  let keyboardJet=gameMode==="single" && car===playerCar && input.keys.z;
  let morphButton=buttons.a || keyboardMorph;
  let jetButton=buttons.b || keyboardJet;
  let pressedMorph=morphButton && !car.lastMorphButton;
  let pressedJet=jetUnlocked && jetButton && !car.lastJetButton;
  let exitingJet=car.jetMode || car.jetProgress>0.35;
  let fuelEmpty=(car.fuel ?? maxFuel)<=0.001;
  let surfaceY=surfaceHeightForActor(car,car.x,car.z);
  let nearGroundForJetExit=car.y-surfaceY<=jetExitGroundClearance;

  if(pressedMorph && !gameOver && car.health>0){
    if(exitingJet){
      car.jetAutoLandToRobot=true;
      car.jetMode=true;
      car.morphed=false;
      car.lastMorphButton=morphButton;
      car.lastJetButton=jetButton;
      return;
    }
    car.morphed=!car.morphed;
    if(car.morphed) car.jetMode=false;
  }
  if(pressedJet && !gameOver && car.health>0){
    if(!car.jetMode && fuelEmpty){
      car.lastMorphButton=morphButton;
      car.lastJetButton=jetButton;
      return;
    }
    if(car.jetMode && !nearGroundForJetExit){
      car.lastMorphButton=morphButton;
      car.lastJetButton=jetButton;
      return;
    }
    car.jetMode=!car.jetMode;
    if(car.jetMode){
      car.morphed=false;
      car.jetAutoLandToRobot=false;
      car.landingSequenceVoicePlayed=false;
      let currentSurface=surfaceHeightForActor(car,car.x,car.z);
      car.jetHoverSurfaceY=currentSurface;
      car.jetAltitudeTarget=Math.max(car.y,currentSurface+jetHoverGroundClearance);
    }
  }
  car.lastMorphButton=morphButton;
  car.lastJetButton=jetButton;
}

function updateFlightThrust(car,surfaceY){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let keyboardFlight=gameMode==="single" && car===playerCar && input.keys[" "];
  let hoverInput=buttons.leftStick || keyboardFlight;
  car.hoverInputActive=hoverInput;
  if(!hoverInput || gameOver || car.health<=0) return false;
  if((car.fuel ?? maxFuel)<=0.001) return false;
  if(car.morphed || car.morphProgress>0.35) return false;
  if(car.boostCharge<=0) return false;

  let altitude=car.y-surfaceY;
  if(altitude<0.12){
    car.y=surfaceY+0.12;
    car.vy=Math.max(car.vy,0.18);
  }

  car.boostCharge=Math.max(0,car.boostCharge-(altitude<18 ? 0.34 : 0.18));
  if(altitude>=robotBoostFlightMaxAltitude){
    car.y=Math.min(car.y,surfaceY+robotBoostFlightMaxAltitude);
    car.vy=Math.min(car.vy,0);
    car.onGround=false;
    return true;
  }

  let ceilingEase=clamp((robotBoostFlightMaxAltitude-altitude)/8,0,1);
  let altitudeLift=(altitude<18 ? 0.052 : 0.018)*ceilingEase;
  let maxUpVelocity=0.08+0.54*ceilingEase;
  car.vy=clamp(car.vy+altitudeLift,-0.08,maxUpVelocity);
  car.onGround=false;
  return true;
}

function rechargeHoverBoost(car){
  if(gameOver || car.health<=0 || car.hoverInputActive) return;
  if(!Number.isFinite(car.boostCharge)) car.boostCharge=maxBoostCharge;
  if(car.boostCharge>=maxBoostCharge) return;
  car.boostCharge=Math.min(maxBoostCharge,car.boostCharge+hoverBoostRechargeRate);
}

function updateFuelForCar(car,jetHovering){
  if(gameOver || car.health<=0) return;
  if(!Number.isFinite(car.fuel)) car.fuel=maxFuel;

  let drain=0;

  if(jetHovering){
    let speedUse=clamp(Math.abs(car.speed || 0)/Math.max(0.001,jetMaxSpeed),0,1);
    let climbUse=0;
    drain=jetFuelDrainRate*(0.75+speedUse*0.55+climbUse*0.35);
  }else if(car.morphProgress>0.65 && car.onGround && (Math.abs(car.throttleInput || 0)>0.05 || Math.abs(car.speed || 0)>0.05)){
    let speedUse=clamp(Math.abs(car.speed || 0)/Math.max(0.001,mechGroundMaxSpeed),0,2.5);
    drain=carFuelDrainRate*(0.45+speedUse*0.55);
  }

  if(drain>0) car.fuel=Math.max(0,car.fuel-drain);
}

function emitFlightExhaust(car){
  let spawnJetParticle=dust.spawnJetExhaustParticle || dust.spawnThrusterParticle;
  let speedAbs=Math.abs(car.speed || 0);
  for(let side of [-1,1]){
    let footX=car.x+Math.cos(car.angle)*side*0.72-Math.sin(car.angle)*0.08;
    let footZ=car.z-Math.sin(car.angle)*side*0.72-Math.cos(car.angle)*0.08;

    for(let i=0;i<3;i++){
      let lateral=(Math.random()-.5)*0.24;
      let rear=(Math.random()-.5)*0.18;
      let px=footX+Math.cos(car.angle)*lateral-Math.sin(car.angle)*rear;
      let pz=footZ-Math.sin(car.angle)*lateral-Math.cos(car.angle)*rear;

      spawnJetParticle(
        px,
        car.y+0.12+Math.random()*0.12,
        pz,
        (Math.random()-.5)*0.18-Math.sin(car.angle)*(0.55+speedAbs*0.52),
        (Math.random()-.5)*0.18-Math.cos(car.angle)*(0.55+speedAbs*0.52),
        -0.35-Math.random()*0.42,
        0.22+Math.random()*0.14,
        0.24+Math.random()*0.14
      );
    }
  }
}

function emitRobotLandingBoosters(car,intensity=1){
  let spawnJetParticle=dust.spawnJetExhaustParticle || dust.spawnThrusterParticle;
  if(!spawnJetParticle || !car) return;

  let amount=clamp(intensity,0,1);
  if(amount<=0.01) return;

  let visualY=Number.isFinite(car.renderY) ? Math.max(car.renderY,car.y) : car.y;
  let speedAbs=Math.abs(car.speed || 0);
  let bursts=2+Math.ceil(amount*4);

  for(let side of [-1,1]){
    let footX=car.x+Math.cos(car.angle)*side*0.74-Math.sin(car.angle)*0.04;
    let footZ=car.z-Math.sin(car.angle)*side*0.74-Math.cos(car.angle)*0.04;

    for(let i=0;i<bursts;i++){
      let lateral=(Math.random()-.5)*0.34;
      let rear=(Math.random()-.5)*0.2;
      let px=footX+Math.cos(car.angle)*lateral-Math.sin(car.angle)*rear;
      let pz=footZ-Math.sin(car.angle)*lateral-Math.cos(car.angle)*rear;
      let wash=0.38+amount*0.34+speedAbs*0.2;

      spawnJetParticle(
        px,
        visualY+0.16+Math.random()*0.12,
        pz,
        (Math.random()-.5)*0.28-Math.sin(car.angle)*wash,
        (Math.random()-.5)*0.28-Math.cos(car.angle)*wash,
        -0.42-amount*0.42-Math.random()*0.2,
        0.24+Math.random()*0.16,
        0.24+amount*0.18+Math.random()*0.12
      );

      if(dust.spawnThrusterParticle && i===0){
        dust.spawnThrusterParticle(
          px,
          visualY+0.12,
          pz,
          (Math.random()-.5)*0.18,
          (Math.random()-.5)*0.18,
          -0.5-amount*0.32,
          0.16+Math.random()*0.08,
          0.12+amount*0.08
        );
      }
    }
  }
}

function emitJetHoverExhaust(car){
  return;
}

function emitBuggyGroundDust(car,surfaceY){
  if(!dust.spawnGroundDustParticle) return;

  let speedAbs=Math.abs(car.speed || 0);
  let dryGround=waterDepthAt(car.x,car.z)<=0.08;
  let buggyMode=car.morphProgress>0.68 && car.jetProgress<0.35;
  if(!buggyMode || !dryGround || !car.onGround || speedAbs<0.075 || gameOver || car.health<=0) return;

  let forwardX=Math.sin(car.velAngle);
  let forwardZ=Math.cos(car.velAngle);
  let rightX=Math.cos(car.velAngle);
  let rightZ=-Math.sin(car.velAngle);
  let steeringDust=clamp(Math.abs(car.turnInputEase || 0)*0.9+Math.abs(car.turnVelocity || 0)*18,0,1.4);
  let throttleDust=clamp(Math.abs(car.throttleEase || car.throttleInput || 0),0,1);
  let dustAmount=Math.min(10,Math.max(1,Math.floor(speedAbs*12+steeringDust*2+throttleDust*1.6)));
  let rearBase=2.15+speedAbs*1.4;
  let modelTrackHalfWidth=car.carModel && car.carModel.userData
    ? car.carModel.userData.trackHalfWidth
    : null;
  let modelWidthScale=car.carModel && car.carModel.userData && car.carModel.userData.baseScale
    ? car.carModel.scale.x/Math.max(0.001,car.carModel.userData.baseScale.x)
    : 1;
  let tireHalfWidth=(modelTrackHalfWidth || 0.96)*Math.max(0.82,Math.min(1.08,modelWidthScale));

  for(let i=0;i<dustAmount;i++){
    let side=i%2===0 ? -1 : 1;
    let lateral=side*(tireHalfWidth+(Math.random()-0.5)*0.18)+(Math.random()-0.5)*0.14;
    let rear=rearBase+Math.random()*0.9;
    let px=car.x-forwardX*rear+rightX*lateral;
    let pz=car.z-forwardZ*rear+rightZ*lateral;
    let wake=0.65+speedAbs*2.8;
    let sideDrift=(Math.random()-0.5)*(0.45+steeringDust*0.4);

    dust.spawnGroundDustParticle(
      px,
      surfaceY+0.14+Math.random()*0.12,
      pz,
      -forwardX*wake+rightX*sideDrift+(Math.random()-0.5)*0.18,
      -forwardZ*wake+rightZ*sideDrift+(Math.random()-0.5)*0.18,
      0.28+Math.random()*0.75+speedAbs*0.25,
      0.32+Math.random()*0.24,
      0.16+Math.random()*0.13+speedAbs*0.08
    );
  }
}

function resetMechPart(part){
  if(!part || !part.userData.basePosition || !part.userData.baseRotation) return;
  part.position.copy(part.userData.basePosition);
  part.rotation.copy(part.userData.baseRotation);
  if(part.userData.baseScale) part.scale.copy(part.userData.baseScale);
}

function rememberMechBasePose(model){
  if(!model) return;
  model.updateMatrixWorld(true);
  model.traverse(child=>{
    if(!child.isMesh) return;
    child.userData.basePosition=child.position.clone();
    child.userData.baseRotation=child.rotation.clone();
    child.userData.baseScale=child.scale.clone();
  });
}

function enemyVariantValue(seed,salt){
  return Math.sin(seed*91.17+salt*37.91)*0.5+0.5;
}

function makeEnemyRobotVariant(seed,type){
  let heavy=type==="boss" || type==="giant" || type==="guard";
  return {
    height:heavy ? 1.04+enemyVariantValue(seed,1)*0.2 : 0.88+enemyVariantValue(seed,1)*0.32,
    width:heavy ? 1.04+enemyVariantValue(seed,2)*0.26 : 0.84+enemyVariantValue(seed,2)*0.38,
    depth:0.86+enemyVariantValue(seed,3)*0.34,
    arm:0.82+enemyVariantValue(seed,4)*0.45,
    leg:0.9+enemyVariantValue(seed,5)*0.35,
    shoulder:0.9+enemyVariantValue(seed,6)*0.55,
    head:0.82+enemyVariantValue(seed,7)*0.38,
    hunch:(enemyVariantValue(seed,8)-0.5)*(heavy ? 0.16 : 0.34),
    asymmetry:(enemyVariantValue(seed,9)-0.5)*0.22
  };
}

function makeEnemyWalkProfile(seed,type){
  let heavy=type==="boss" || type==="giant" || type==="guard";
  let style=Math.floor(enemyVariantValue(seed,21)*5);
  let profile={
    style,
    phaseOffset:enemyVariantValue(seed,22)*Math.PI*2,
    strideScale:heavy ? 1.12+enemyVariantValue(seed,23)*0.34 : 0.82+enemyVariantValue(seed,23)*0.34,
    cadenceScale:heavy ? 0.72+enemyVariantValue(seed,24)*0.22 : 0.92+enemyVariantValue(seed,24)*0.38,
    intensityScale:heavy ? 1.08+enemyVariantValue(seed,25)*0.26 : 1.12+enemyVariantValue(seed,25)*0.34,
    legSwing:0.9+enemyVariantValue(seed,26)*0.44,
    armSwing:0.76+enemyVariantValue(seed,27)*0.55,
    footLift:0.85+enemyVariantValue(seed,28)*0.5,
    kneeDrive:0.82+enemyVariantValue(seed,29)*0.42,
    bobScale:heavy ? 0.62+enemyVariantValue(seed,30)*0.22 : 0.88+enemyVariantValue(seed,30)*0.36,
    torsoSway:0.82+enemyVariantValue(seed,31)*0.38,
    forwardLean:heavy ? 0.62+enemyVariantValue(seed,32)*0.22 : 0.9+enemyVariantValue(seed,32)*0.34,
    armLag:(enemyVariantValue(seed,33)-0.5)*0.34
  };

  if(style===1){
    profile.legSwing*=1.18;
    profile.footLift*=1.2;
    profile.cadenceScale*=1.08;
  }else if(style===2){
    profile.strideScale*=1.22;
    profile.cadenceScale*=0.9;
    profile.armSwing*=0.85;
  }else if(style===3){
    profile.bobScale*=0.72;
    profile.torsoSway*=1.24;
    profile.armLag+=0.18;
  }else if(style===4){
    profile.strideScale*=0.9;
    profile.cadenceScale*=1.18;
    profile.footLift*=0.82;
  }

  return profile;
}

function scaleMeshPart(mesh,x=1,y=1,z=1){
  if(mesh) mesh.scale.set(mesh.scale.x*x,mesh.scale.y*y,mesh.scale.z*z);
}

function shiftMeshPart(mesh,x=0,y=0,z=0){
  if(mesh) mesh.position.set(mesh.position.x+x,mesh.position.y+y,mesh.position.z+z);
}

function applyEnemyRobotVariant(model,seed,type){
  let parts=model && model.userData ? model.userData.walkParts : null;
  if(!parts) return;
  let variant=makeEnemyRobotVariant(seed,type);
  let style=Math.floor(enemyVariantValue(seed,10)*5);

  function addVariantPart(mesh){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    model.add(mesh);
    return mesh;
  }

  scaleMeshPart(parts.pelvis,variant.width*0.92,variant.height*0.78,variant.depth);
  scaleMeshPart(parts.torso,variant.width,variant.height,variant.depth);
  scaleMeshPart(parts.chestPlate,variant.width*1.08,variant.height*0.86,variant.depth*0.78);
  scaleMeshPart(parts.reactorPack,variant.width*0.86,variant.height,variant.depth*1.16);
  scaleMeshPart(parts.neck,variant.head*0.84,variant.height,variant.head*0.84);
  scaleMeshPart(parts.head,variant.head,variant.head*(1.04+variant.hunch*0.3),variant.head);
  scaleMeshPart(parts.visor,variant.head*1.12,variant.head*0.82,variant.head*0.88);
  shiftMeshPart(parts.head,0,variant.hunch*0.35,variant.hunch*0.42);
  shiftMeshPart(parts.visor,0,variant.hunch*0.35,variant.hunch*0.42);

  for(let sideName of ["left","right"]){
    let side=sideName==="left" ? -1 : 1;
    let sideParts=parts[sideName];
    if(!sideParts) continue;
    let sideAsym=1+variant.asymmetry*side;
    scaleMeshPart(sideParts.shoulder,variant.shoulder*sideAsym,variant.shoulder*0.9,variant.depth);
    scaleMeshPart(sideParts.upperArm,variant.arm*0.78*sideAsym,variant.arm*1.08,variant.arm*0.86);
    scaleMeshPart(sideParts.forearm,variant.arm*0.82*sideAsym,variant.arm*1.12,variant.arm);
    scaleMeshPart(sideParts.hand,variant.arm*0.9,variant.arm*0.9,variant.arm*0.9);
    scaleMeshPart(sideParts.cannon,variant.arm*0.82,variant.arm*1.08,variant.arm*1.18);
    scaleMeshPart(sideParts.cannonShroud,variant.arm*0.9,variant.arm*0.92,variant.arm*1.15);
    scaleMeshPart(sideParts.hip,variant.width*0.92,variant.leg*0.86,variant.depth);
    scaleMeshPart(sideParts.upperLeg,variant.leg*0.9,variant.leg*1.12,variant.leg*0.9);
    scaleMeshPart(sideParts.shin,variant.leg*0.84,variant.leg*1.16,variant.leg*0.84);
    scaleMeshPart(sideParts.foot,variant.leg*0.95,variant.leg*0.76,variant.leg*1.16);
    scaleMeshPart(sideParts.toePlate,variant.leg*0.9,variant.leg*0.76,variant.leg*1.2);
    shiftMeshPart(sideParts.shoulder,side*(variant.width-1)*0.28,variant.hunch*0.18,0);
    shiftMeshPart(sideParts.hip,side*(variant.width-1)*0.18,0,0);
  }

  if(type==="giant"){
    let core=parts.torso || model;
    for(let side of [-1,1]){
      let pauldron=new THREE.Mesh(new THREE.BoxGeometry(0.78,0.58,1.35),enemyTrimMat.clone());
      pauldron.name=side<0 ? "giant-left-pauldron" : "giant-right-pauldron";
      pauldron.position.set(side*1.95,3.72,0.02);
      pauldron.rotation.z=side*0.16;
      pauldron.castShadow=true;
      pauldron.receiveShadow=true;
      model.add(pauldron);

      let backFin=new THREE.Mesh(new THREE.ConeGeometry(0.22,1.28,5),enemyTrimMat.clone());
      backFin.name=side<0 ? "giant-left-back-fin" : "giant-right-back-fin";
      backFin.position.set(side*0.72,4.35,-0.92);
      backFin.rotation.x=-0.52;
      backFin.rotation.z=side*0.22;
      backFin.castShadow=true;
      backFin.receiveShadow=true;
      model.add(backFin);
    }
    scaleMeshPart(core,1.16,1.08,1.12);
  }

  if(style===0){
    for(let side of [-1,1]){
      let antenna=new THREE.Mesh(new THREE.ConeGeometry(0.045,0.9,5),enemyTrimMat.clone());
      antenna.name=side<0 ? "enemy-left-antenna-fin" : "enemy-right-antenna-fin";
      antenna.position.set(side*0.34,5.04,-0.08);
      antenna.rotation.z=-side*0.18;
      addVariantPart(antenna);
    }
  }else if(style===1){
    for(let side of [-1,1]){
      let thruster=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.92,0.42),enemyTrimMat.clone());
      thruster.name=side<0 ? "enemy-left-back-thruster" : "enemy-right-back-thruster";
      thruster.position.set(side*0.48,3.34,-1.02);
      thruster.rotation.x=-0.08;
      addVariantPart(thruster);
    }
  }else if(style===2){
    for(let side of [-1,1]){
      let shinFin=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.76,0.58),enemyTrimMat.clone());
      shinFin.name=side<0 ? "enemy-left-shin-fin" : "enemy-right-shin-fin";
      shinFin.position.set(side*0.72,0.06,-0.42);
      shinFin.rotation.z=side*0.12;
      addVariantPart(shinFin);
    }
  }else if(style===3){
    let sensorSide=enemyVariantValue(seed,11)<0.5 ? -1 : 1;
    let sensor=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.32,0.72),enemyEyeMat.clone());
    sensor.name=sensorSide<0 ? "enemy-left-shoulder-sensor" : "enemy-right-shoulder-sensor";
    sensor.position.set(sensorSide*1.74,3.98,0.36);
    sensor.rotation.z=sensorSide*0.12;
    addVariantPart(sensor);
  }else{
    let crest=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.86,0.18),enemyTrimMat.clone());
    crest.name="enemy-head-crest";
    crest.position.set(0,5.08,0.1);
    crest.rotation.x=-0.12;
    addVariantPart(crest);
  }

  rememberMechBasePose(model);
}

function morphStage(progress,start,end){
  return smoothStep((progress-start)/(end-start));
}

function morphPulse(progress,center,width){
  return clamp(1-Math.abs(progress-center)/width,0,1);
}

function crossedMorphStage(previous,current,stage){
  return (previous<stage && current>=stage) || (previous>stage && current<=stage);
}

function emitMorphSparks(car,count=12){
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);

  for(let i=0;i<count;i++){
    let side=i%2===0 ? -1 : 1;
    let lateral=side*(0.65+Math.random()*1.55);
    let longitudinal=-1.45+Math.random()*3.5;
    let height=0.7+Math.random()*2.6;
    let burst=1.1+Math.random()*2.4;

    dust.spawnThrusterParticle(
      car.x+rightX*lateral+forwardX*longitudinal,
      car.y+height,
      car.z+rightZ*lateral+forwardZ*longitudinal,
      rightX*side*burst+forwardX*(Math.random()-0.5)*1.8,
      rightZ*side*burst+forwardZ*(Math.random()-0.5)*1.8,
      0.6+Math.random()*2.2,
      0.16+Math.random()*0.12,
      0.045+Math.random()*0.035
    );
  }
}

function applyTransformerFold(model,progress){
  let parts=model && model.userData ? model.userData.walkParts : null;
  if(!parts) return;

  let unlock=morphStage(progress,0.02,0.2);
  let crouch=morphStage(progress,0.08,0.38);
  let fold=morphStage(progress,0.2,0.56);
  let tuck=morphStage(progress,0.36,0.72);
  let lock=morphStage(progress,0.62,0.94);
  let jitter=morphPulse(progress,0.48,0.32)*Math.sin(performance.now()*0.055)*0.028;

  if(parts.pelvis){
    parts.pelvis.position.y-=0.26*crouch+0.62*tuck;
    parts.pelvis.position.z+=0.34*fold+0.42*lock;
    parts.pelvis.rotation.x+=0.38*fold+0.22*lock;
    parts.pelvis.scale.y*=1-0.22*tuck;
  }
  if(parts.torso){
    parts.torso.position.y-=0.54*crouch+0.76*fold;
    parts.torso.position.z+=0.26*fold+0.38*lock;
    parts.torso.rotation.x+=0.62*fold-0.16*lock+jitter;
    parts.torso.scale.y*=1-0.24*fold;
    parts.torso.scale.z*=1+0.26*tuck;
  }
  if(parts.chestPlate){
    parts.chestPlate.position.y-=0.58*crouch+0.92*fold;
    parts.chestPlate.position.z+=0.2*fold+0.72*lock;
    parts.chestPlate.rotation.x+=0.72*fold-0.24*lock;
    parts.chestPlate.scale.x*=1+0.16*lock;
  }
  if(parts.cockpit){
    parts.cockpit.position.y-=0.72*crouch+1.06*fold;
    parts.cockpit.position.z+=0.38*fold+0.96*lock;
    parts.cockpit.rotation.x+=0.82*fold-0.28*lock;
    parts.cockpit.scale.x*=1+0.32*lock;
    parts.cockpit.scale.y*=1-0.16*lock;
  }
  if(parts.reactorPack){
    parts.reactorPack.position.y-=0.36*crouch+0.48*fold;
    parts.reactorPack.position.z-=0.32*fold+0.78*tuck;
    parts.reactorPack.rotation.x-=0.7*fold;
    parts.reactorPack.scale.z*=1+0.42*lock;
  }
  if(parts.neck){
    parts.neck.position.y-=0.86*fold;
    parts.neck.scale.y*=1-0.72*fold;
  }
  if(parts.head){
    parts.head.position.y-=0.9*crouch+1.18*fold;
    parts.head.position.z-=0.22*fold+0.34*tuck;
    parts.head.rotation.x+=1.12*fold;
    let headScale=1-0.34*fold;
    parts.head.scale.multiplyScalar(headScale);
  }
  if(parts.visor){
    parts.visor.position.y-=0.92*crouch+1.2*fold;
    parts.visor.position.z-=0.2*fold+0.36*tuck;
    parts.visor.rotation.x+=1.12*fold;
    parts.visor.scale.multiplyScalar(1-0.2*fold);
  }
  if(parts.antenna){
    parts.antenna.position.y-=0.86*fold;
    parts.antenna.position.z-=0.2*fold;
    parts.antenna.rotation.x+=1.45*fold;
    parts.antenna.rotation.z-=0.55*fold;
  }

  for(let sideName of ["left","right"]){
    let side=sideName==="left" ? -1 : 1;
    let sideParts=parts[sideName];
    if(!sideParts) continue;
    let wheelsVisible=progress>0.08;

    if(sideParts.shoulder){
      sideParts.shoulder.position.x+=side*(0.24*unlock+0.54*tuck);
      sideParts.shoulder.position.y-=0.42*crouch+0.74*fold;
      sideParts.shoulder.position.z-=0.48*fold;
      sideParts.shoulder.rotation.z+=side*(0.42*fold+0.92*tuck);
      sideParts.shoulder.rotation.x-=0.24*fold;
    }
    if(sideParts.upperArm){
      sideParts.upperArm.position.x+=side*(0.18*unlock+0.42*tuck);
      sideParts.upperArm.position.y-=0.5*crouch+0.42*fold;
      sideParts.upperArm.position.z-=0.22*fold+0.24*lock;
      sideParts.upperArm.rotation.x-=0.78*fold+0.42*tuck;
      sideParts.upperArm.rotation.z+=side*(0.3*fold+0.72*tuck);
      sideParts.upperArm.scale.y*=1-0.18*lock;
    }
    if(sideParts.elbow){
      sideParts.elbow.position.x+=side*(0.2*unlock+0.46*tuck);
      sideParts.elbow.position.y-=0.42*crouch+0.38*fold;
      sideParts.elbow.position.z-=0.12*fold+0.18*lock;
    }
    if(sideParts.forearm){
      sideParts.forearm.position.x+=side*(0.24*unlock+0.62*tuck);
      sideParts.forearm.position.y-=0.38*crouch+0.12*fold;
      sideParts.forearm.position.z+=0.18*fold+0.72*lock;
      sideParts.forearm.rotation.x-=0.62*fold;
      sideParts.forearm.rotation.z+=side*(0.5*fold+1.08*tuck);
      sideParts.forearm.scale.y*=1-0.28*lock;
    }
    if(sideParts.hand){
      sideParts.hand.position.x+=side*(0.26*unlock+0.76*tuck);
      sideParts.hand.position.y-=0.32*crouch;
      sideParts.hand.position.z+=0.36*fold+0.9*lock;
      sideParts.hand.rotation.z+=side*1.12*tuck;
      sideParts.hand.scale.y*=1-0.34*lock;
    }
    if(sideParts.cannon){
      sideParts.cannon.position.x+=side*(0.28*unlock+0.76*tuck);
      sideParts.cannon.position.y-=0.32*crouch+0.2*fold;
      sideParts.cannon.position.z+=0.72*fold+1.05*lock;
      sideParts.cannon.rotation.y+=side*0.26*lock;
      sideParts.cannon.rotation.z+=side*0.36*tuck;
    }
    if(sideParts.cannonShroud){
      sideParts.cannonShroud.position.x+=side*(0.28*unlock+0.72*tuck);
      sideParts.cannonShroud.position.y-=0.36*crouch+0.28*fold;
      sideParts.cannonShroud.position.z+=0.52*fold+0.88*lock;
      sideParts.cannonShroud.rotation.z+=side*0.86*tuck;
    }

    if(sideParts.hip){
      sideParts.hip.position.y-=0.28*crouch+0.54*fold;
      sideParts.hip.position.z+=0.22*fold+0.24*lock;
      sideParts.hip.rotation.x+=side*0.18*tuck;
    }
    if(sideParts.upperLeg){
      sideParts.upperLeg.position.x+=side*0.12*tuck;
      sideParts.upperLeg.position.y+=0.1*crouch-0.36*fold+0.42*tuck;
      sideParts.upperLeg.position.z+=0.24*fold+0.52*lock;
      sideParts.upperLeg.rotation.x-=0.88*fold+0.42*tuck;
      sideParts.upperLeg.scale.y*=1-0.22*lock;
    }
    if(sideParts.knee){
      sideParts.knee.position.x+=side*0.18*tuck;
      sideParts.knee.position.y+=0.24*tuck;
      sideParts.knee.position.z+=0.38*fold+0.62*lock;
    }
    if(sideParts.kneePlate){
      sideParts.kneePlate.position.x+=side*0.18*tuck;
      sideParts.kneePlate.position.y+=0.26*tuck;
      sideParts.kneePlate.position.z+=0.54*fold+0.82*lock;
      sideParts.kneePlate.rotation.x-=0.42*lock;
    }
    if(sideParts.shin){
      sideParts.shin.position.x+=side*0.2*tuck;
      sideParts.shin.position.y+=0.72*tuck;
      sideParts.shin.position.z+=0.62*fold+1.02*lock;
      sideParts.shin.rotation.x+=0.72*fold-0.36*lock;
      sideParts.shin.scale.y*=1-0.28*lock;
    }
    if(sideParts.foot){
      sideParts.foot.position.x+=side*(0.18*tuck+0.34*lock);
      sideParts.foot.position.y+=0.9*tuck;
      sideParts.foot.position.z+=0.88*fold+1.48*lock;
      sideParts.foot.rotation.x-=0.2*fold+0.16*lock;
      sideParts.foot.rotation.z+=side*0.16*lock;
      sideParts.foot.scale.z*=1+0.28*lock;
      sideParts.foot.scale.y*=1-0.22*lock;
    }
    if(sideParts.toePlate){
      sideParts.toePlate.position.x+=side*(0.18*tuck+0.34*lock);
      sideParts.toePlate.position.y+=0.9*tuck;
      sideParts.toePlate.position.z+=1.02*fold+1.74*lock;
      sideParts.toePlate.rotation.x-=0.36*fold+0.08*lock;
      sideParts.toePlate.scale.z*=1+0.34*lock;
    }

    if(sideParts.frontWheel){
      sideParts.frontWheel.visible=wheelsVisible;
      sideParts.frontWheel.position.x+=side*(0.18*unlock+0.6*tuck);
      sideParts.frontWheel.position.y-=0.74*crouch+0.92*fold;
      sideParts.frontWheel.position.z+=0.68*fold+1.34*lock;
      sideParts.frontWheel.rotation.x+=progress*8;
      sideParts.frontWheel.scale.multiplyScalar(1+0.18*lock);
    }
    if(sideParts.frontHub){
      sideParts.frontHub.visible=wheelsVisible;
      sideParts.frontHub.position.x+=side*(0.18*unlock+0.6*tuck);
      sideParts.frontHub.position.y-=0.74*crouch+0.92*fold;
      sideParts.frontHub.position.z+=0.68*fold+1.34*lock;
      sideParts.frontHub.rotation.x+=progress*8;
      sideParts.frontHub.scale.multiplyScalar(1+0.18*lock);
    }
    if(sideParts.rearWheel){
      sideParts.rearWheel.visible=wheelsVisible;
      sideParts.rearWheel.position.x+=side*(0.2*tuck+0.46*lock);
      sideParts.rearWheel.position.y+=0.92*tuck;
      sideParts.rearWheel.position.z+=0.58*fold+1.12*lock;
      sideParts.rearWheel.rotation.x+=progress*8;
      sideParts.rearWheel.scale.multiplyScalar(1+0.22*lock);
    }
    if(sideParts.rearHub){
      sideParts.rearHub.visible=wheelsVisible;
      sideParts.rearHub.position.x+=side*(0.2*tuck+0.46*lock);
      sideParts.rearHub.position.y+=0.92*tuck;
      sideParts.rearHub.position.z+=0.58*fold+1.12*lock;
      sideParts.rearHub.rotation.x+=progress*8;
      sideParts.rearHub.scale.multiplyScalar(1+0.22*lock);
    }
  }
}

function applyJetFold(model,progress){
  let parts=model && model.userData ? model.userData.walkParts : null;
  if(!parts) return;

  let crouch=morphStage(progress,0.04,0.26);
  let flatten=morphStage(progress,0.16,0.58);
  let sweep=morphStage(progress,0.34,0.78);
  let hide=morphStage(progress,0.72,1);
  let shiver=morphPulse(progress,0.42,0.28)*Math.sin(performance.now()*0.064)*0.025;

  if(parts.pelvis){
    parts.pelvis.position.y-=0.45*crouch+0.82*flatten;
    parts.pelvis.position.z-=0.18*flatten+0.46*sweep;
    parts.pelvis.rotation.x+=0.9*flatten;
    parts.pelvis.scale.y*=1-0.32*sweep;
  }
  if(parts.torso){
    parts.torso.position.y-=0.72*crouch+1.15*flatten;
    parts.torso.position.z+=0.22*flatten+0.72*sweep;
    parts.torso.rotation.x+=1.08*flatten+shiver;
    parts.torso.scale.y*=1-0.42*sweep;
    parts.torso.scale.z*=1+0.44*sweep;
  }
  if(parts.chestPlate){
    parts.chestPlate.position.y-=0.8*crouch+1.28*flatten;
    parts.chestPlate.position.z+=0.66*sweep;
    parts.chestPlate.rotation.x+=1.18*flatten;
    parts.chestPlate.scale.x*=1+0.18*sweep;
  }
  if(parts.cockpit){
    parts.cockpit.position.y-=0.92*crouch+1.34*flatten;
    parts.cockpit.position.z+=0.94*sweep;
    parts.cockpit.rotation.x+=1.08*flatten-0.28*sweep;
    parts.cockpit.scale.x*=1+0.42*sweep;
  }
  if(parts.reactorPack){
    parts.reactorPack.position.y-=0.58*crouch+0.92*flatten;
    parts.reactorPack.position.z-=0.72*sweep;
    parts.reactorPack.rotation.x-=0.72*flatten;
    parts.reactorPack.scale.z*=1+0.52*sweep;
  }
  if(parts.neck){
    parts.neck.position.y-=0.98*flatten;
    parts.neck.scale.y*=1-0.8*flatten;
  }
  if(parts.head){
    parts.head.position.y-=0.96*crouch+1.36*flatten;
    parts.head.position.z+=0.34*sweep;
    parts.head.rotation.x+=1.35*flatten;
    parts.head.scale.multiplyScalar(1-0.28*flatten);
  }
  if(parts.visor){
    parts.visor.position.y-=0.98*crouch+1.38*flatten;
    parts.visor.position.z+=0.36*sweep;
    parts.visor.rotation.x+=1.35*flatten;
    parts.visor.scale.multiplyScalar(1-0.18*flatten);
  }
  if(parts.antenna){
    parts.antenna.position.y-=1.1*flatten;
    parts.antenna.rotation.x+=1.5*flatten;
    parts.antenna.rotation.z-=0.5*flatten;
  }

  for(let sideName of ["left","right"]){
    let side=sideName==="left" ? -1 : 1;
    let sideParts=parts[sideName];
    if(!sideParts) continue;

    for(let wheel of [sideParts.frontWheel,sideParts.frontHub,sideParts.rearWheel,sideParts.rearHub]){
      if(wheel) wheel.visible=false;
    }

    if(sideParts.shoulder){
      sideParts.shoulder.position.x+=side*(0.42*crouch+1.35*sweep);
      sideParts.shoulder.position.y-=0.52*crouch+0.96*flatten;
      sideParts.shoulder.position.z+=0.16*flatten-0.22*sweep;
      sideParts.shoulder.rotation.z+=side*(0.64*flatten+0.56*sweep);
      sideParts.shoulder.scale.x*=1+0.22*sweep;
    }
    if(sideParts.upperArm){
      sideParts.upperArm.position.x+=side*(0.7*crouch+1.82*sweep);
      sideParts.upperArm.position.y-=0.56*crouch+0.72*flatten;
      sideParts.upperArm.position.z+=0.14*flatten-0.34*sweep;
      sideParts.upperArm.rotation.z+=side*(1.16*sweep);
      sideParts.upperArm.rotation.x-=0.54*flatten;
      sideParts.upperArm.scale.y*=1-0.22*sweep;
    }
    if(sideParts.elbow){
      sideParts.elbow.position.x+=side*(0.84*crouch+1.96*sweep);
      sideParts.elbow.position.y-=0.48*crouch+0.6*flatten;
      sideParts.elbow.position.z-=0.22*sweep;
    }
    if(sideParts.forearm){
      sideParts.forearm.position.x+=side*(0.95*crouch+2.34*sweep);
      sideParts.forearm.position.y-=0.42*crouch+0.44*flatten;
      sideParts.forearm.position.z-=0.12*flatten-0.26*sweep;
      sideParts.forearm.rotation.z+=side*(1.34*sweep);
      sideParts.forearm.rotation.x-=0.38*flatten;
      sideParts.forearm.scale.y*=1-0.3*sweep;
    }
    if(sideParts.hand){
      sideParts.hand.position.x+=side*(1.05*crouch+2.55*sweep);
      sideParts.hand.position.y-=0.32*crouch+0.36*flatten;
      sideParts.hand.position.z-=0.12*sweep;
      sideParts.hand.rotation.z+=side*1.48*sweep;
    }
    if(sideParts.cannon){
      sideParts.cannon.position.x+=side*(0.94*crouch+2.48*sweep);
      sideParts.cannon.position.y-=0.34*crouch+0.38*flatten;
      sideParts.cannon.position.z+=0.2*flatten+0.18*sweep;
      sideParts.cannon.rotation.z+=side*1.12*sweep;
    }
    if(sideParts.cannonShroud){
      sideParts.cannonShroud.position.x+=side*(0.88*crouch+2.24*sweep);
      sideParts.cannonShroud.position.y-=0.4*crouch+0.42*flatten;
      sideParts.cannonShroud.position.z+=0.16*flatten+0.1*sweep;
      sideParts.cannonShroud.rotation.z+=side*1.18*sweep;
    }

    if(sideParts.hip){
      sideParts.hip.position.x+=side*0.16*sweep;
      sideParts.hip.position.y-=0.38*crouch+0.62*flatten;
      sideParts.hip.position.z-=0.18*sweep;
    }
    if(sideParts.upperLeg){
      sideParts.upperLeg.position.x+=side*0.22*sweep;
      sideParts.upperLeg.position.y-=0.18*crouch+0.2*flatten;
      sideParts.upperLeg.position.z-=0.82*sweep;
      sideParts.upperLeg.rotation.x+=1.02*flatten;
      sideParts.upperLeg.scale.y*=1-0.28*sweep;
    }
    if(sideParts.knee){
      sideParts.knee.position.x+=side*0.26*sweep;
      sideParts.knee.position.y+=0.38*sweep;
      sideParts.knee.position.z-=0.96*sweep;
    }
    if(sideParts.kneePlate){
      sideParts.kneePlate.position.x+=side*0.26*sweep;
      sideParts.kneePlate.position.y+=0.38*sweep;
      sideParts.kneePlate.position.z-=0.84*sweep;
      sideParts.kneePlate.rotation.x+=0.62*sweep;
    }
    if(sideParts.shin){
      sideParts.shin.position.x+=side*0.34*sweep;
      sideParts.shin.position.y+=0.82*sweep;
      sideParts.shin.position.z-=1.38*sweep;
      sideParts.shin.rotation.x+=1.18*flatten;
      sideParts.shin.scale.y*=1-0.32*sweep;
    }
    if(sideParts.foot){
      sideParts.foot.position.x+=side*0.42*sweep;
      sideParts.foot.position.y+=1.1*sweep;
      sideParts.foot.position.z-=1.84*sweep;
      sideParts.foot.rotation.x+=0.58*flatten;
      sideParts.foot.scale.z*=1+0.18*sweep;
      sideParts.foot.scale.y*=1-0.24*sweep;
    }
    if(sideParts.toePlate){
      sideParts.toePlate.position.x+=side*0.42*sweep;
      sideParts.toePlate.position.y+=1.1*sweep;
      sideParts.toePlate.position.z-=2.02*sweep;
      sideParts.toePlate.rotation.x+=0.72*flatten;
    }
  }

  model.scale.multiplyScalar(1-0.55*hide);
}

function makeAimCross(accentColor){
  let group=new THREE.Group();
  group.position.set(0,3.15,32);

  let material=new THREE.MeshBasicMaterial({
    color:accentColor,
    transparent:true,
    opacity:0.72,
    depthWrite:false,
    depthTest:false
  });
  let lineMaterial=new THREE.LineBasicMaterial({
    color:0x8dfff2,
    transparent:true,
    opacity:0.86,
    depthWrite:false,
    depthTest:false
  });

  let ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,0.032,8,56),material);
  ring.renderOrder=20;
  group.add(ring);

  let points=[
    -1.55,0,0, -0.78,0,0,
    0.78,0,0, 1.55,0,0,
    0,-1.55,0, 0,-0.78,0,
    0,0.78,0, 0,1.55,0
  ];
  let crossGeo=new THREE.BufferGeometry();
  crossGeo.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
  let cross=new THREE.LineSegments(crossGeo,lineMaterial);
  cross.renderOrder=21;
  group.add(cross);
  group.userData.ring=ring;
  group.userData.cross=cross;
  group.userData.baseRingColor=material.color.clone();
  group.userData.baseCrossColor=lineMaterial.color.clone();
  group.userData.lockColor=new THREE.Color(0x42ff68);

  return group;
}

function makeVehicleHeadlights(accentColor){
  let rig=new THREE.Group();
  let lensMat=new THREE.MeshBasicMaterial({
    color:accentColor,
    transparent:true,
    opacity:0,
    depthWrite:false
  });
  let lensGeo=new THREE.SphereGeometry(0.16,12,8);
  rig.userData.lenses=[];
  rig.userData.spots=[];
  rig.userData.targets=[];

  for(let side of [-1,1]){
    let spot=new THREE.SpotLight(0xfff1c8,0,260,0.46,0.58,0.82);
    let target=new THREE.Object3D();
    let lens=new THREE.Mesh(lensGeo,lensMat.clone());

    lens.scale.set(1,0.55,0.35);
    lens.renderOrder=18;
    spot.target=target;
    rig.add(spot,target,lens);
    rig.userData.spots.push(spot);
    rig.userData.targets.push(target);
    rig.userData.lenses.push(lens);
  }

  return rig;
}

function updateVehicleHeadlights(car){
  let rig=car.headlights;
  if(!rig) return;

  let nightPower=clamp01((headlightNightAmount-0.28)/0.5);
  nightPower=nightPower*nightPower*(3-2*nightPower);
  let jetFade=1-clamp01((car.jetProgress || 0)*1.7);
  let power=nightPower*jetFade*(car.health>0 && car.group.visible && !gameOver ? 1 : 0);
  let carBlend=car.morphProgress || 0;
  let y=(3.45*(1-carBlend)+0.72*carBlend);
  let z=(0.92*(1-carBlend)+2.1*carBlend);
  let x=(0.42*(1-carBlend)+0.78*carBlend);
  let targetY=(2.55*(1-carBlend)+0.28*carBlend);
  let targetZ=(27*(1-carBlend)+42*carBlend);

  rig.visible=power>0.01;
  for(let i=0;i<2;i++){
    let side=i===0 ? -1 : 1;
    let spot=rig.userData.spots[i];
    let target=rig.userData.targets[i];
    let lens=rig.userData.lenses[i];

    spot.position.set(side*x,y,z);
    spot.intensity=power*(carBlend>0.55 ? 28 : 22);
    spot.distance=carBlend>0.55 ? 280 : 230;
    spot.angle=carBlend>0.55 ? 0.42 : 0.5;
    target.position.set(side*x*0.7,targetY,targetZ);
    lens.position.set(side*x,y,z+0.05);
    lens.material.opacity=0.26+power*0.74;
  }
}

function collectPlayerCarWheels(model){
  let wheels=[];
  if(!model) return wheels;
  model.traverse(child=>{
    if(child.isMesh && child.userData && child.userData.playerCarWheel){
      let axis=child.userData.playerCarWheelAxis || "y";
      if(axis==="x"){
        child.userData.playerCarWheelBaseRotationX=Number.isFinite(child.userData.playerCarWheelBaseRotationX)
          ? child.userData.playerCarWheelBaseRotationX
          : child.rotation.x;
      }else{
        child.userData.playerCarWheelBaseRotationY=Number.isFinite(child.userData.playerCarWheelBaseRotationY)
          ? child.userData.playerCarWheelBaseRotationY
          : child.rotation.y;
      }
      wheels.push(child);
    }
  });
  return wheels;
}

function animatePlayerCarWheels(car){
  let carModel=car && car.carModel;
  if(!carModel || !carModel.userData) return;
  let wheels=carModel.userData.wheels || [];
  if(!wheels.length) return;
  let speed=car && Number.isFinite(car.speed) ? car.speed : 0;
  let visibleAmount=clamp((car.morphProgress-0.56)/0.22,0,1)*(1-clamp((car.jetProgress || 0)/0.45,0,1));
  let spin=(carModel.userData.wheelSpin || 0)+speed*(carModel.userData.wheelSpinRate || 0.62)*visibleAmount;
  carModel.userData.wheelSpin=spin;

  for(let wheel of wheels){
    if(!wheel) continue;
    let direction=wheel.userData && Number.isFinite(wheel.userData.playerCarWheelDirection)
      ? wheel.userData.playerCarWheelDirection
      : 1;
    let axis=wheel.userData && wheel.userData.playerCarWheelAxis || "y";
    if(axis==="x"){
      let base=wheel.userData && Number.isFinite(wheel.userData.playerCarWheelBaseRotationX)
        ? wheel.userData.playerCarWheelBaseRotationX
        : 0;
      wheel.rotation.x=base+spin*direction;
    }else{
      let base=wheel.userData && Number.isFinite(wheel.userData.playerCarWheelBaseRotationY)
        ? wheel.userData.playerCarWheelBaseRotationY
        : 0;
      wheel.rotation.y=base+spin*direction;
    }
  }
}

let hovercraftPropulsionColorA=new THREE.Color();
let hovercraftPropulsionColorB=new THREE.Color();

function animateHovercraftPropulsion(model,visibleAmount=1){
  if(!model || !model.userData) return;
  let parts=model.userData.hoverPropulsionParts || [];
  if(!parts.length) return;
  let amount=clamp(visibleAmount,0,1);
  let time=performance.now()*0.001;

  for(let part of parts){
    if(!part || !part.userData) continue;
    let data=part.userData;
    let constantGlow=Boolean(data.hoverConstantGlow);
    let pulse=0.5+0.5*Math.sin(time*(data.hoverPulseSpeed || 2.1)+(data.hoverPulsePhase || 0));
    let flicker=0.5+0.5*Math.sin(time*((data.hoverPulseSpeed || 2.1)*1.9)+(data.hoverPulsePhase || 0)*1.7);

    if(data.baseScale){
      let pulseScale=data.hoverPulseScale || 0.08;
      let pulseY=data.hoverPulseY || 0.12;
      let pulseZ=Number.isFinite(data.hoverPulseZ) ? data.hoverPulseZ : pulseScale;
      if(constantGlow){
        part.scale.copy(data.baseScale);
      }else{
        part.scale.set(
          data.baseScale.x*(1+pulseScale*pulse),
          data.baseScale.y*(1+pulseY*flicker),
          data.baseScale.z*(1+pulseZ*pulse)
        );
      }
    }

    if(part.material){
      let baseOpacity=Number.isFinite(data.baseOpacity) ? data.baseOpacity : part.material.opacity;
      part.material.opacity=baseOpacity*amount*(constantGlow ? 1 : 0.66+pulse*0.48);
      if(Number.isFinite(data.hoverColorA) && Number.isFinite(data.hoverColorB) && !constantGlow){
        hovercraftPropulsionColorA.setHex(data.hoverColorA);
        hovercraftPropulsionColorB.setHex(data.hoverColorB);
        part.material.color.copy(hovercraftPropulsionColorA.lerp(hovercraftPropulsionColorB,0.28+flicker*0.38));
      }else if(Number.isFinite(data.hoverColorA)){
        part.material.color.setHex(data.hoverColorA);
      }
    }
  }
}

function setupMorphModels(car,accentColor){
  let mech=makeMechModel(accentColor,{dust:true});
  let aimCross=makeAimCross(accentColor);
  let headlights=makeVehicleHeadlights(accentColor);
  mech.position.y+=playerRobotVisualLift;
  mech.userData.baseY=mech.position.y;

  car.group.clear();
  car.group.add(mech,headlights,aimCross);
  car.mechModel=mech;
  car.jetModel=null;
  car.carModel=null;
  car.aimCross=aimCross;
  car.headlights=headlights;
  updateVehicleHeadlights(car);
  applyRobotHitFlashVisuals(car.mechModel,car.damageFlashZones || createRobotDamageState());
}

function attachBackPackToPlayerRobot(car,model){
  if(!car || !model || !car.mechModel || !car.mechModel.userData) return;

  let parts=car.mechModel.userData.walkParts || {};
  let backMount=parts.torso || car.mechModel;
  let existing=backMount.getObjectByName("player-backpack");
  if(existing) backMount.remove(existing);

  let backPack=model.clone(true);
  backPack.name="player-backpack";
  backPack.position.set(0,0.23232,-0.98);
  backPack.rotation.set(0,Math.PI,0);
  backPack.scale.multiplyScalar(1.342);
  backMount.add(backPack);
  rememberMechBasePose(backPack);
}

function setMorphCarModel(car,model){
  if(car.carModel) car.group.remove(car.carModel);
  model.visible=false;
  model.userData.wheels=collectPlayerCarWheels(model);
  model.userData.wheelSpin=0;
  model.userData.wheelSpinRate=0.62;
  car.carModel=model;
  car.group.add(model);
  updateMorphVisual(car);
}

function setMorphJetModel(car,model){
  if(car.jetModel) car.group.remove(car.jetModel);
  model.visible=false;
  car.jetModel=model;
  car.group.add(model);
  updateMorphVisual(car);
}

function makeEnemyMechModel(seed=0,type="mech"){
  let mech=makeMechModel(seed%2===0 ? 0x8f7d5c : 0x6f637d);
  mech.name="enemy-mech";
  mech.scale.set(1.18,0.96,1.1);

  mech.traverse(child=>{
    if(!child.isMesh) return;
    child.material=child.material.clone();
    if(child.name.includes("cockpit") || child.name.includes("visor")){
      child.material=enemyEyeMat.clone();
    }else if(child.name.includes("plate") || child.name.includes("shroud")){
      child.material=enemyTrimMat.clone();
    }else if(child.name.includes("torso") || child.name.includes("shoulder") || child.name.includes("forearm") || child.name.includes("upper-leg") || child.name.includes("foot")){
      child.material.color.set(seed%2===0 ? 0x263230 : 0x302d36);
      child.material.roughness=0.72;
      child.material.metalness=0.62;
    }else{
      child.material.color.set(0x121615);
    }
  });

  function addEnemyPart(mesh){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    mesh.userData.basePosition=mesh.position.clone();
    mesh.userData.baseRotation=mesh.rotation.clone();
    mesh.userData.baseScale=mesh.scale.clone();
    mech.add(mesh);
  }

  let eye=new THREE.Mesh(new THREE.BoxGeometry(0.92,0.18,0.1),enemyEyeMat.clone());
  eye.name="enemy-amber-eye";
  eye.position.set(0,4.56,0.58);
  addEnemyPart(eye);

  for(let side of [-1,1]){
    let horn=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.72,5),enemyTrimMat.clone());
    horn.name=side<0 ? "enemy-left-horn" : "enemy-right-horn";
    horn.position.set(side*0.42,4.96,0.06);
    horn.rotation.z=-side*0.28;
    addEnemyPart(horn);

    let shoulderSpike=new THREE.Mesh(new THREE.ConeGeometry(0.18,0.84,5),enemyTrimMat.clone());
    shoulderSpike.name=side<0 ? "enemy-left-shoulder-spike" : "enemy-right-shoulder-spike";
    shoulderSpike.position.set(side*1.72,3.92,-0.04);
    shoulderSpike.rotation.z=-side*Math.PI/2;
    addEnemyPart(shoulderSpike);
  }

  applyEnemyRobotVariant(mech,seed,type);
  return mech;
}

function makeGuardRobotModel(seed=0){
  let mech=makeEnemyMechModel(seed+17,"guard");
  mech.name="base-guard";
  mech.scale.set(1.34,1.08,1.22);

  mech.traverse(child=>{
    if(!child.isMesh) return;
    child.material=child.material.clone();
    if(child.name.includes("cockpit") || child.name.includes("visor") || child.name.includes("eye")){
      child.material=enemyEyeMat.clone();
      child.material.emissiveIntensity=0.72;
    }else if(child.name.includes("plate") || child.name.includes("shroud")){
      child.material.color.set(0x665e76);
      child.material.emissive.set(0x16101e);
      child.material.emissiveIntensity=0.12;
      child.material.metalness=0.62;
    }else{
      child.material.color.set(0x171a22);
      child.material.roughness=0.68;
      child.material.metalness=0.7;
    }
  });

  function addGuardPart(mesh){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    mesh.userData.basePosition=mesh.position.clone();
    mesh.userData.baseRotation=mesh.rotation.clone();
    mesh.userData.baseScale=mesh.scale.clone();
    mech.add(mesh);
  }

  for(let side of [-1,1]){
    let shield=new THREE.Mesh(new THREE.BoxGeometry(0.34,1.55,1.15),enemyTrimMat.clone());
    shield.name=side<0 ? "guard-left-shield" : "guard-right-shield";
    shield.position.set(side*1.45,2.35,0.34);
    shield.rotation.z=side*0.14;
    addGuardPart(shield);

    let kneeGuard=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.28,0.72),enemyTrimMat.clone());
    kneeGuard.name=side<0 ? "guard-left-knee-guard" : "guard-right-knee-guard";
    kneeGuard.position.set(side*0.52,1.1,0.62);
    addGuardPart(kneeGuard);
  }

  return mech;
}

function makeDroneModel(seed=0){
  let drone=new THREE.Group();
  let body=new THREE.Mesh(new THREE.OctahedronGeometry(1.15,1),droneBodyMat.clone());
  body.scale.set(1.35,0.54,1.05);
  body.castShadow=true;
  body.receiveShadow=true;
  drone.add(body);

  let core=new THREE.Mesh(new THREE.SphereGeometry(0.38,16,10),droneCoreMat.clone());
  core.position.set(0,0.02,0.82);
  drone.add(core);

  for(let side of [-1,1]){
    let wing=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.16,0.52),droneWingMat.clone());
    wing.position.set(side*1.65,0,0);
    wing.rotation.z=side*0.12;
    wing.castShadow=true;
    wing.receiveShadow=true;
    drone.add(wing);

    let rotor=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,0.08,18),droneCoreMat.clone());
    rotor.position.set(side*2.74,0.04,0);
    rotor.rotation.x=Math.PI/2;
    drone.add(rotor);
  }

  drone.userData.core=core;
  return drone;
}

function makeSpiderModel(seed=0){
  let spider=new THREE.Group();
  let body=new THREE.Mesh(new THREE.SphereGeometry(0.9,16,10),spiderBodyMat.clone());
  body.scale.set(1.25,0.48,1.05);
  body.position.y=0.78;
  body.castShadow=true;
  body.receiveShadow=true;
  spider.add(body);

  let core=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8),droneCoreMat.clone());
  core.position.set(0,0.86,0.72);
  spider.add(core);

  let legs=[];
  for(let side of [-1,1]){
    for(let i=0;i<4;i++){
      let leg=new THREE.Mesh(new THREE.BoxGeometry(1.25,0.12,0.16),spiderLegMat.clone());
      let z=-0.56+i*0.38;
      leg.position.set(side*(0.88+i*0.08),0.58,z);
      leg.rotation.y=side*(0.55-i*0.1);
      leg.rotation.z=side*(0.24+i*0.06);
      leg.castShadow=true;
      leg.receiveShadow=true;
      spider.add(leg);
      legs.push({mesh:leg,baseRotation:leg.rotation.clone(),phase:i*0.9+(side>0 ? 0 : Math.PI)});
    }
  }

  spider.userData.legs=legs;
  spider.userData.core=core;
  return spider;
}

function makeRobotBoatModel(seed=0){
  let boat=new THREE.Group();
  let variant=Math.abs(Math.sin(seed*12.9898)*43758.5453)%1;

  function addPart(mesh){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    boat.add(mesh);
    return mesh;
  }

  let hull=new THREE.Mesh(new THREE.BoxGeometry(5.4,0.9,8.4),boatHullMat.clone());
  hull.position.y=0.52;
  hull.scale.x=0.9+variant*0.18;
  addPart(hull);

  let prow=new THREE.Mesh(new THREE.ConeGeometry(2.45,2.6,4),boatHullMat.clone());
  prow.position.set(0,0.54,4.85);
  prow.rotation.y=Math.PI*0.25;
  prow.rotation.x=Math.PI*0.5;
  prow.scale.set(1.05,0.92,0.72);
  addPart(prow);

  for(let side of [-1,1]){
    let pontoon=new THREE.Mesh(new THREE.CylinderGeometry(0.54,0.7,7.6,12),boatDeckMat.clone());
    pontoon.position.set(side*2.95,0.04,0.2);
    pontoon.rotation.x=Math.PI*0.5;
    addPart(pontoon);

    let rack=new THREE.Mesh(new THREE.BoxGeometry(0.82,0.52,2.3),boatMissileMat.clone());
    rack.position.set(side*1.55,1.52,-1.15);
    rack.rotation.x=-0.18;
    addPart(rack);

    for(let i=0;i<2;i++){
      let tube=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2,1.35,10),rocketBodyMat);
      tube.position.set(side*1.55,1.78,-1.72+i*0.82);
      tube.rotation.x=Math.PI*0.5-0.2;
      addPart(tube);
    }
  }

  let cabin=new THREE.Mesh(new THREE.BoxGeometry(2.5,1.25,2.2),boatDeckMat.clone());
  cabin.position.set(0,1.42,0.82);
  cabin.rotation.y=(variant-0.5)*0.12;
  addPart(cabin);

  let sensor=new THREE.Mesh(new THREE.SphereGeometry(0.36,16,10),droneCoreMat.clone());
  sensor.position.set(0,1.62,2.08);
  boat.add(sensor);

  let antenna=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.06,1.5,8),enemyTrimMat.clone());
  antenna.position.set(0.72,2.34,0.18);
  antenna.rotation.z=-0.16;
  addPart(antenna);

  boat.userData.core=sensor;
  return boat;
}

function collectEnemyBuggyWheels(model){
  let wheels=[];
  if(!model) return wheels;
  model.traverse(child=>{
    if(child.isMesh && child.userData && child.userData.enemyBuggyWheel){
      let axis=child.userData.enemyBuggyWheelAxis || "x";
      if(axis==="y"){
        child.userData.enemyBuggyWheelBaseRotationY=Number.isFinite(child.userData.enemyBuggyWheelBaseRotationY)
          ? child.userData.enemyBuggyWheelBaseRotationY
          : child.rotation.y;
      }else{
        child.userData.enemyBuggyWheelBaseRotationX=Number.isFinite(child.userData.enemyBuggyWheelBaseRotationX)
          ? child.userData.enemyBuggyWheelBaseRotationX
          : child.rotation.x;
      }
      wheels.push(child);
    }
  });
  return wheels;
}

function animateEnemyBuggyWheels(buggyModel,speed){
  if(!buggyModel || !buggyModel.userData) return;
  let wheels=buggyModel.userData.wheels || [];
  if(!wheels.length) return;
  let spin=(buggyModel.userData.wheelSpin || 0)+speed*(buggyModel.userData.wheelSpinRate || 0.34);
  buggyModel.userData.wheelSpin=spin;
  for(let wheel of wheels){
    if(!wheel) continue;
    let direction=wheel.userData && Number.isFinite(wheel.userData.enemyBuggyWheelDirection)
      ? wheel.userData.enemyBuggyWheelDirection
      : 1;
    let axis=wheel.userData && wheel.userData.enemyBuggyWheelAxis || "x";
    if(axis==="y"){
      let base=wheel.userData && Number.isFinite(wheel.userData.enemyBuggyWheelBaseRotationY)
        ? wheel.userData.enemyBuggyWheelBaseRotationY
        : 0;
      wheel.rotation.y=base-spin*direction;
    }else{
      let base=wheel.userData && Number.isFinite(wheel.userData.enemyBuggyWheelBaseRotationX)
        ? wheel.userData.enemyBuggyWheelBaseRotationX
        : 0;
      wheel.rotation.x=base+spin*direction;
    }
  }
}

function makeEnemyBuggyModel(seed=0){
  if(enemyBuggyModel){
    let buggy=enemyBuggyModel.clone(true);
    let launcher=buggy.getObjectByName("enemy-buggy-launcher-anchor");
    let wheels=collectEnemyBuggyWheels(buggy);
    buggy.userData.tracks=[];
    buggy.userData.trackOffset=0;
    buggy.userData.wheels=wheels;
    buggy.userData.wheelSpin=0;
    buggy.userData.wheelSpinRate=0.32;
    buggy.userData.launcher=launcher || null;
    return buggy;
  }

  let buggy=new THREE.Group();
  let wheels=[];
  let variant=Math.abs(Math.sin(seed*31.4159)*43758.5453)%1;

  function dustBuggyMesh(mesh){
    if(!mesh || !mesh.material) return;
    let name=(mesh.name || "").toLowerCase();
    if(name.includes("windshield") || name.includes("light") || name.includes("wheel") || name.includes("hub")) return;
    let materials=Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for(let i=0;i<materials.length;i++){
      let material=materials[i];
      if(!material || material.transparent || material.opacity<0.92) continue;
      if(material.emissiveIntensity && material.emissiveIntensity>0.42) continue;
      materials[i]=addPatchyCarDust(material,seed*0.31+mesh.id*0.49+i*1.77+11.2,enemyBuggyDustPatchOptions);
    }
    mesh.material=Array.isArray(mesh.material) ? materials : materials[0];
  }

  function addPart(mesh){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    dustBuggyMesh(mesh);
    buggy.add(mesh);
    return mesh;
  }

  let chassis=new THREE.Mesh(new THREE.BoxGeometry(5.65,1.08,7.35),buggyHullMat.clone());
  chassis.position.y=1.15;
  chassis.scale.x=0.96+variant*0.12;
  addPart(chassis);

  let skidPlate=new THREE.Mesh(new THREE.BoxGeometry(5.18,0.28,7.25),buggyTrimMat.clone());
  skidPlate.position.set(0,0.62,0.02);
  skidPlate.rotation.x=0.02;
  addPart(skidPlate);

  let lowerArmor=new THREE.Mesh(new THREE.BoxGeometry(5.2,0.72,4.2),buggyArmorMat.clone());
  lowerArmor.position.set(0,1.64,0.82);
  addPart(lowerArmor);

  let nose=new THREE.Mesh(new THREE.BoxGeometry(4.62,0.98,2.95),buggyArmorMat.clone());
  nose.position.set(0,1.82,2.26);
  nose.rotation.x=-0.08;
  addPart(nose);

  let cabin=new THREE.Mesh(new THREE.BoxGeometry(3.05,1.78,2.22),buggyArmorMat.clone());
  cabin.position.set(0,2.55,-0.52);
  cabin.rotation.x=0.035;
  addPart(cabin);

  let turretDeck=new THREE.Mesh(new THREE.BoxGeometry(2.72,0.42,2.48),buggyHullMat.clone());
  turretDeck.position.set(0,3.42,-0.98);
  addPart(turretDeck);

  let windshield=new THREE.Mesh(new THREE.BoxGeometry(1.92,0.58,0.1),enemyEyeMat.clone());
  windshield.name="buggy-windshield";
  windshield.position.set(0,2.74,0.66);
  windshield.rotation.x=-0.16;
  addPart(windshield);

  let launcherBase=new THREE.Mesh(new THREE.CylinderGeometry(0.68,0.84,0.42,14),buggyLauncherMat.clone());
  launcherBase.position.set(0,3.68,-1.08);
  addPart(launcherBase);

  let launcher=new THREE.Group();
  launcher.name="buggy-roof-rocket-launcher";
  launcher.position.set(0,4.0,-1.08);
  buggy.add(launcher);

  for(let side of [-1,1]){
    let tube=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.28,2.55,12),rocketBodyMat);
    tube.position.set(side*0.45,0,0.58);
    tube.rotation.x=Math.PI*0.5-0.12;
    tube.castShadow=true;
    tube.receiveShadow=true;
    launcher.add(tube);

    let cap=new THREE.Mesh(new THREE.ConeGeometry(0.29,0.44,12),rocketNoseMat);
    cap.position.set(side*0.45,0,1.9);
    cap.rotation.x=Math.PI*0.5;
    launcher.add(cap);
  }

  let rack=new THREE.Mesh(new THREE.BoxGeometry(1.48,0.28,1.88),buggyLauncherMat.clone());
  rack.position.set(0,-0.12,0.6);
  rack.castShadow=true;
  rack.receiveShadow=true;
  launcher.add(rack);

  let tracks=[];
  for(let side of [-1,1]){
    let trackGroup=new THREE.Group();
    trackGroup.position.set(side*2.92,0.82,-0.1);
    buggy.add(trackGroup);

    let belt=new THREE.Mesh(new THREE.BoxGeometry(0.96,1.22,6.55),buggyWheelMat.clone());
    belt.position.set(0,0,0);
    belt.castShadow=true;
    belt.receiveShadow=true;
    trackGroup.add(belt);

    let sideArmor=new THREE.Mesh(new THREE.BoxGeometry(1.02,0.86,5.85),buggyHullMat.clone());
    sideArmor.position.set(-side*0.02,0.18,0);
    sideArmor.castShadow=true;
    sideArmor.receiveShadow=true;
    trackGroup.add(sideArmor);

    for(let z of [-2.74,2.74]){
      let sprocket=new THREE.Mesh(new THREE.CylinderGeometry(0.64,0.64,0.92,18),buggyTrimMat.clone());
      sprocket.position.set(0,0,z);
      sprocket.rotation.z=Math.PI*0.5;
      sprocket.castShadow=true;
      sprocket.receiveShadow=true;
      sprocket.userData.enemyBuggyWheel=true;
      sprocket.userData.enemyBuggyWheelAxis="y";
      sprocket.userData.enemyBuggyWheelDirection=1;
      sprocket.userData.enemyBuggyWheelBaseRotationY=sprocket.rotation.y;
      trackGroup.add(sprocket);
      wheels.push(sprocket);

      let hub=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.98,12),buggyLauncherMat.clone());
      hub.position.set(0,0,z);
      hub.rotation.z=Math.PI*0.5;
      hub.castShadow=true;
      hub.receiveShadow=true;
      hub.userData.enemyBuggyWheel=true;
      hub.userData.enemyBuggyWheelAxis="y";
      hub.userData.enemyBuggyWheelDirection=1;
      hub.userData.enemyBuggyWheelBaseRotationY=hub.rotation.y;
      trackGroup.add(hub);
      wheels.push(hub);
    }

    let pads=[];
    for(let i=0;i<20;i++){
      let pad=new THREE.Mesh(new THREE.BoxGeometry(1.12,0.18,0.36),buggyTrimMat.clone());
      pad.castShadow=true;
      pad.receiveShadow=true;
      trackGroup.add(pad);
      pads.push({mesh:pad,baseT:i/20});
    }

    tracks.push({group:trackGroup,pads,phase:variant*0.17});

    let trackGuard=new THREE.Mesh(new THREE.BoxGeometry(0.78,0.58,6.58),buggyArmorMat.clone());
    trackGuard.position.set(side*2.5,1.74,-0.1);
    trackGuard.rotation.z=side*0.045;
    addPart(trackGuard);

    let flankPlate=new THREE.Mesh(new THREE.BoxGeometry(0.32,1.42,3.85),buggyArmorMat.clone());
    flankPlate.position.set(side*2.26,2.08,0.28);
    flankPlate.rotation.z=side*0.035;
    addPart(flankPlate);

    let nerfBar=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,6.4,8),buggyTrimMat.clone());
    nerfBar.position.set(side*3.08,1.46,-0.08);
    nerfBar.rotation.x=Math.PI*0.5;
    nerfBar.rotation.z=side*0.03;
    addPart(nerfBar);
  }

  let rollCage=new THREE.Group();
  rollCage.position.set(0,3.14,-0.46);
  buggy.add(rollCage);
  for(let side of [-1,1]){
    let upright=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,1.42,8),buggyTrimMat.clone());
    upright.position.set(side*1.32,-0.08,-0.76);
    upright.rotation.z=side*0.14;
    upright.castShadow=true;
    upright.receiveShadow=true;
    rollCage.add(upright);

    let frontPost=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.065,1.32,8),buggyTrimMat.clone());
    frontPost.position.set(side*1.08,-0.22,0.54);
    frontPost.rotation.x=-0.18;
    frontPost.rotation.z=side*0.1;
    frontPost.castShadow=true;
    frontPost.receiveShadow=true;
    rollCage.add(frontPost);
  }
  let roofBar=new THREE.Mesh(new THREE.BoxGeometry(2.9,0.1,1.55),buggyTrimMat.clone());
  roofBar.position.set(0,0.72,-0.12);
  roofBar.castShadow=true;
  roofBar.receiveShadow=true;
  rollCage.add(roofBar);

  let bumper=new THREE.Mesh(new THREE.BoxGeometry(5.2,0.42,0.46),buggyTrimMat.clone());
  bumper.position.set(0,1.36,3.9);
  addPart(bumper);

  let rearArmor=new THREE.Mesh(new THREE.BoxGeometry(4.62,1.12,1.35),buggyArmorMat.clone());
  rearArmor.position.set(0,1.92,-3.12);
  rearArmor.rotation.x=0.06;
  addPart(rearArmor);

  for(let side of [-1,1]){
    let light=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,8),droneCoreMat.clone());
    light.position.set(side*1.1,1.66,3.7);
    buggy.add(light);
  }

  buggy.userData.tracks=tracks;
  buggy.userData.trackOffset=0;
  buggy.userData.wheels=wheels;
  buggy.userData.wheelSpin=0;
  buggy.userData.wheelSpinRate=0.4;
  buggy.userData.launcher=launcher;
  buggy.traverse(child=>{
    if(child.isMesh) dustBuggyMesh(child);
  });
  buggy.scale.setScalar(1.5);
  return buggy;
}

function addMothershipHoverHaze(ship,bounds=null){
  let box=bounds && !bounds.isEmpty() ? bounds.clone() : new THREE.Box3().setFromObject(ship);
  let size=box.getSize(new THREE.Vector3());
  let center=box.getCenter(new THREE.Vector3());
  let halfX=clamp(size.x*0.34,12,30);
  let halfZ=clamp(size.z*0.34,8,22);
  let lowerY=box.min.y-Math.max(5.5,size.y*0.24);

  function makeHaze(color,opacity,scale,yOffset,renderOrder){
    let material=mothershipAuraMat.clone();
    material.color.set(color);
    material.opacity=opacity;
    material.depthWrite=false;
    material.depthTest=true;
    material.side=THREE.DoubleSide;
    let haze=new THREE.Mesh(mothershipHoverHazeGeo,material);
    haze.position.set(center.x,lowerY+yOffset,center.z);
    haze.scale.copy(scale);
    haze.renderOrder=renderOrder;
    haze.userData.baseScale=scale.clone();
    haze.userData.baseOpacity=opacity;
    ship.add(haze);
    return haze;
  }

  let lowerHaze=makeHaze(
    0x78f0e6,
    0.16,
    new THREE.Vector3(halfX*1.12,1.15,halfZ*1.02),
    -1.2,
    4
  );
  let upperHaze=makeHaze(
    0xb9ffff,
    0.2,
    new THREE.Vector3(halfX*0.68,0.75,halfZ*0.62),
    1.35,
    5
  );
  let coreHaze=makeHaze(
    0xe8ffff,
    0.24,
    new THREE.Vector3(halfX*0.28,0.95,halfZ*0.26),
    0.05,
    6
  );

  ship.userData.hoverHazeLower=lowerHaze;
  ship.userData.hoverHazeUpper=upperHaze;
  ship.userData.hoverHazeCore=coreHaze;
}

function makeMothershipModel(){
  if(enemyShipModel){
    let ship=enemyShipModel.clone(true);
    let shipBounds=new THREE.Box3().setFromObject(ship);
    let aura=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),mothershipAuraMat.clone());
    aura.scale.set(34,8.2,18);
    aura.renderOrder=4;
    ship.add(aura);

    let lowerAura=new THREE.Mesh(new THREE.SphereGeometry(1,32,12),mothershipAuraMat.clone());
    lowerAura.position.y=-3.25;
    lowerAura.scale.set(24,3.6,13);
    lowerAura.material.opacity=0.22;
    lowerAura.renderOrder=5;
    ship.add(lowerAura);

    let bay=new THREE.Mesh(new THREE.CylinderGeometry(4.8,6.2,0.56,32),mothershipGlowMat);
    bay.position.y=-3.9;
    bay.rotation.x=Math.PI/2;
    ship.add(bay);
    addMothershipHoverHaze(ship,shipBounds);

    ship.userData.bay=bay;
    ship.userData.aura=aura;
    ship.userData.lowerAura=lowerAura;
    return ship;
  }

  let ship=new THREE.Group();
  let hull=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),mothershipHullMat);
  hull.scale.set(28,5.2,13.5);
  hull.castShadow=true;
  hull.receiveShadow=true;
  ship.add(hull);

  let deck=new THREE.Mesh(new THREE.CylinderGeometry(7.2,10.8,3.2,10),mothershipHullMat);
  deck.position.y=3.15;
  deck.scale.set(1.35,1,0.82);
  deck.castShadow=true;
  deck.receiveShadow=true;
  ship.add(deck);

  let bridge=new THREE.Mesh(new THREE.BoxGeometry(7.8,2.1,4.4),mothershipHullMat);
  bridge.position.set(0,5.1,1.6);
  bridge.castShadow=true;
  bridge.receiveShadow=true;
  ship.add(bridge);

  let aura=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),mothershipAuraMat.clone());
  aura.scale.set(34,8.2,18);
  aura.renderOrder=4;
  ship.add(aura);

  let lowerAura=new THREE.Mesh(new THREE.SphereGeometry(1,32,12),mothershipAuraMat.clone());
  lowerAura.position.y=-3.25;
  lowerAura.scale.set(24,3.6,13);
  lowerAura.material.opacity=0.22;
  lowerAura.renderOrder=5;
  ship.add(lowerAura);

  let bay=new THREE.Mesh(new THREE.CylinderGeometry(4.8,6.2,0.56,32),mothershipGlowMat);
  bay.position.y=-3.9;
  bay.rotation.x=Math.PI/2;
  ship.add(bay);

  let spine=new THREE.Mesh(new THREE.BoxGeometry(38,0.7,1.1),mothershipGlowMat);
  spine.position.set(0,0.55,-0.4);
  ship.add(spine);

  for(let side of [-1,1]){
    let wing=new THREE.Mesh(new THREE.BoxGeometry(19,1.0,4.8),mothershipHullMat);
    wing.position.set(side*18.4,-0.3,0.3);
    wing.rotation.z=side*0.08;
    wing.rotation.y=side*0.05;
    wing.castShadow=true;
    wing.receiveShadow=true;
    ship.add(wing);

    let fin=new THREE.Mesh(new THREE.ConeGeometry(2.2,7.4,4),mothershipHullMat);
    fin.position.set(side*10.5,1.6,-8.9);
    fin.rotation.x=Math.PI*0.5;
    fin.rotation.z=side*0.24;
    fin.castShadow=true;
    fin.receiveShadow=true;
    ship.add(fin);

    for(let i=0;i<3;i++){
      let engine=new THREE.Mesh(new THREE.SphereGeometry(1.35,16,10),mothershipGlowMat);
      engine.position.set(side*(21+i*3.0),-0.45,-6.2+i*1.4);
      engine.scale.set(1.45,0.86,1.45);
      ship.add(engine);
    }

    for(let i=0;i<4;i++){
      let light=new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8),mothershipGlowMat);
      light.position.set(side*(5+i*4.2),-3.2,7.8);
      light.scale.set(1,0.55,1);
      ship.add(light);
    }
  }

  let shipBounds=new THREE.Box3().setFromObject(ship);
  addMothershipHoverHaze(ship,shipBounds);

  ship.userData.bay=bay;
  ship.userData.aura=aura;
  ship.userData.lowerAura=lowerAura;
  return ship;
}

function createEnemyState(index,x,z,type="mech"){
  let group=new THREE.Group();
  group.rotation.order="YXZ";
  scene.add(group);

  let isDrone=type==="drone";
  let isBoss=type==="boss";
  let isSpider=type==="spider";
  let isGuard=type==="guard";
  let isGiant=type==="giant";
  let isBoat=type==="boat";
  let isBuggy=type==="buggy";
  let mech=(isDrone || isSpider || isBoat || isBuggy) ? null : isGuard ? makeGuardRobotModel(index) : makeEnemyMechModel(index,type);
  let drone=isDrone ? makeDroneModel(index) : null;
  let spider=isSpider ? makeSpiderModel(index) : null;
  let boat=isBoat ? makeRobotBoatModel(index) : null;
  let buggy=isBuggy ? makeEnemyBuggyModel(index) : null;
  if(mech){
    if(isBoss) mech.scale.multiplyScalar(1.55);
    if(isGiant) mech.scale.multiplyScalar(2.2);
    group.add(mech);
  }
  if(drone) group.add(drone);
  if(spider) group.add(spider);
  if(boat) group.add(boat);
  if(buggy) group.add(buggy);
  let collisionRadius=isGiant ? 7.9 : isBoss ? 5.8 : isBoat ? 5.6 : isBuggy ? 7.2 : isGuard ? 3.15 : isSpider ? 3.2 : isDrone ? 2.9 : 2.35;
  let aimRadius=isGiant ? 10.5 : isBoss ? 9.5 : isBoat ? 7.5 : isBuggy ? 10.8 : isSpider ? 4.8 : isDrone ? 4.2 : isGuard ? 5.0 : 4.5;
  let hitHeight=isGiant ? 12.5 : isBoss ? 8.5 : isBoat ? 4.6 : isBuggy ? 7.2 : isDrone ? 5.2 : isSpider ? 3.6 : 5.2;
  let baseHealth=isGiant ? 420 : isBoss ? 260 : isGuard ? 82 : isBoat ? 72 : isBuggy ? 92 : isDrone ? 34 : isSpider ? 24 : 36;
  let startY=isBoat ? waterLevel+0.56 : drivingSurfaceHeight(x,z)+(isDrone ? 20 : 0);
  let walkMaxSpeed=isGiant ? 0.24 : isBoss ? 0.2 : isGuard ? 0.32 : isBuggy ? 0.54 : 0.4;

  return {
    id:`enemy-${index}`,
    isEnemy:true,
    enemyType:type,
    isDrone,
    isSpider,
    isGuard,
    isBoss,
    isGiant,
    isBoat,
    isBuggy,
    blocksTradingOutpostFootprint:isGiant,
    active:true,
    group,
    shadow:(isDrone || isBoat) ? null : createCarShadow(scene,isBuggy ? {width:10.8,length:13.2,opacity:0.74,minOpacity:0.42} : {}),
    mechModel:mech,
    droneModel:drone,
    spiderModel:spider,
    boatModel:boat,
    buggyModel:buggy,
    carModel:null,
    aimCross:null,
    x,
    y:startY,
    z,
    collisionRadius,
    aimRadius,
    hitHeight,
    angle:Math.random()*Math.PI*2,
    velAngle:0,
    speed:0,
    onGround:!isDrone && !isBoat,
    airborne:isDrone,
    vy:0,
    pitch:0,
    trickPitch:0,
    trickRoll:0,
    trickYaw:0,
    trickPitchVel:0,
    trickRollVel:0,
    trickYawVel:0,
    lastTrickButtons:{a:false,b:false,x:false,y:false},
    morphed:false,
    morphProgress:0,
    lastMorphProgress:0,
    jetMode:false,
    jetProgress:0,
    jetAltitudeTarget:drivingSurfaceHeight(x,z)+jetHoverGroundClearance,
    jetHoverSurfaceY:drivingSurfaceHeight(x,z),
    jetModel:null,
    aimOffsetX:0,
    aimOffsetY:0,
    lastAimMouseVersion:-1,
    lastRocketButton:false,
    rocketCooldown:0,
    lastCannonButton:false,
    cannonCooldown:(isBoat || isBuggy ? 150 : isGiant ? 70 : isBoss ? 35 : isDrone ? 46 : 60)+Math.floor(Math.random()*(isBoat || isBuggy ? 120 : isGiant ? 70 : isBoss ? 35 : isDrone ? 38 : 70)),
    clusterBombCooldown:0,
    clusterBombAmmo:0,
    flightTimer:0,
    flightCooldown:90+Math.floor(Math.random()*220),
    contactCooldown:0,
    hitRattle:0,
    hitRattleSeed:0,
    walkCycle:0,
    lastWalkX:x,
    lastWalkZ:z,
    health:baseHealth,
    aiTarget:null,
    aiStrafe:Math.random()<0.5 ? -1 : 1,
    aiThink:Math.floor(Math.random()*45),
    aiAggression:0.9+Math.random()*0.28,
    aiPreferredRange:0,
    avoidAngle:0,
    avoidFrames:0,
    blockedFrames:0,
    lastAiX:x,
    lastAiZ:z,
    guardPhase:Math.random()*Math.PI*2,
    boatHomeX:isBoat ? x : 0,
    boatHomeZ:isBoat ? z : 0,
    boatRoamX:isBoat ? x+Math.sin(Math.random()*Math.PI*2)*120 : 0,
    boatRoamZ:isBoat ? z+Math.cos(Math.random()*Math.PI*2)*120 : 0,
    boatRoamAngle:Math.random()*Math.PI*2,
    boatRoamCooldown:isBoat ? 1 : 0,
    lateralOffset:0,
    walkProfile:(isDrone || isSpider || isBoat || isBuggy) ? null : makeEnemyWalkProfile(index,type),
    walkMaxSpeed
  };
}

function clearGiantTestRobot(){
  if(!giantTestRobot) return;
  scene.remove(giantTestRobot.group);
  if(giantTestRobot.shadow) scene.remove(giantTestRobot.shadow);
  giantTestRobot=null;
}

function makeGiantTestRobotShadow(){
  let shadow=new THREE.Mesh(
    new THREE.CircleGeometry(1,48),
    new THREE.MeshBasicMaterial({
      color:0x000000,
      transparent:true,
      opacity:0.24,
      depthWrite:false,
      depthTest:true
    })
  );
  shadow.rotation.x=-Math.PI/2;
  shadow.scale.set(42,26,1);
  shadow.renderOrder=1;
  scene.add(shadow);
  return shadow;
}

function makeGiantRobotConnector(name,material){
  let connector=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,1,16),material.clone());
  connector.name=name;
  connector.castShadow=true;
  connector.receiveShadow=true;
  return connector;
}

function giantRobotPartPoint(mesh,offsetY=0){
  let point=new THREE.Vector3(0,offsetY,0);
  point.applyEuler(mesh.rotation);
  point.add(mesh.position);
  return point;
}

function giantRobotHalfHeight(mesh){
  if(!mesh || !mesh.geometry) return 0.1;
  if(!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  let box=mesh.geometry.boundingBox;
  return Math.max(0.1,(box.max.y-box.min.y)*mesh.scale.y*0.5);
}

function addGiantRobotLegConnectors(robot){
  let model=robot && robot.mechModel;
  let parts=model && model.userData ? model.userData.walkParts : null;
  if(!parts) return;

  let connectorMat=new THREE.MeshStandardMaterial({
    color:0x151a20,
    roughness:0.62,
    metalness:0.72
  });

  robot.legConnectors=[];
  for(let sideName of ["left","right"]){
    let sideParts=parts[sideName];
    if(!sideParts) continue;
    for(let spec of [
      ["hipUpper",sideParts.hip,sideParts.upperLeg,0,1],
      ["upperKnee",sideParts.upperLeg,sideParts.knee,-1,0],
      ["kneeShin",sideParts.knee,sideParts.shin,0,1],
      ["shinFoot",sideParts.shin,sideParts.foot,-1,1]
    ]){
      let connector=makeGiantRobotConnector(`giant-${sideName}-${spec[0]}-connector`,connectorMat);
      model.add(connector);
      robot.legConnectors.push({
        mesh:connector,
        from:spec[1],
        to:spec[2],
        fromSign:spec[3],
        toSign:spec[4]
      });
    }
  }
}

function updateGiantRobotLegConnectors(robot){
  if(!robot || !robot.legConnectors) return;

  let yAxis=new THREE.Vector3(0,1,0);
  for(let connector of robot.legConnectors){
    let from=connector.from;
    let to=connector.to;
    if(!from || !to) continue;

    let fromY=connector.fromSign*giantRobotHalfHeight(from)*0.82;
    let toY=connector.toSign*giantRobotHalfHeight(to)*0.82;
    let a=giantRobotPartPoint(from,fromY);
    let b=giantRobotPartPoint(to,toY);
    let delta=b.clone().sub(a);
    let length=Math.max(0.1,delta.length());

    connector.mesh.position.copy(a).add(b).multiplyScalar(0.5);
    connector.mesh.quaternion.setFromUnitVectors(yAxis,delta.normalize());
    connector.mesh.scale.set(1,length,1);
  }
}

function triggerScreenShake(amount=0.12){
  screenShakeAmount=Math.min(1.7,Math.max(screenShakeAmount,amount));
  screenShakeSeed=Math.random()*Math.PI*2;
}

function triggerGiantFootstepShake(robot,sideName){
  let nearestDistance=Infinity;
  for(let car of activeCars()){
    if(!car || !car.group.visible || car.health<=0) continue;
    nearestDistance=Math.min(nearestDistance,Math.hypot(car.x-robot.x,car.z-robot.z));
  }

  let distanceFalloff=Number.isFinite(nearestDistance)
    ? clamp(1-nearestDistance/520,0.18,1)
    : 0.35;
  let sideVariation=sideName==="left" ? 1 : 0.92;
  triggerScreenShake(0.82*distanceFalloff*sideVariation);
  if(motorAudio.playGiantFootstep) motorAudio.playGiantFootstep(distanceFalloff*sideVariation,{x:robot.x,y:robot.y,z:robot.z});
}

function giantRobotStepPose(phaseOffset,stride){
  let phase=phaseOffset%(Math.PI*2);
  if(phase<0) phase+=Math.PI*2;
  let t=phase/(Math.PI*2);

  if(t<0.5){
    let stanceT=t/0.5;
    return {
      z:stride*(1-stanceT*2),
      lift:0,
      planted:1
    };
  }

  let swingT=(t-0.5)/0.5;
  return {
    z:-stride+swingT*stride*2,
    lift:Math.sin(swingT*Math.PI),
    planted:0
  };
}

function updateGiantTestRobotWalk(robot){
  let model=robot && robot.mechModel;
  let parts=model && model.userData ? model.userData.walkParts : null;
  if(!model || !parts) return;

  model.traverse(child=>{
    if(child.isMesh) resetMechPart(child);
  });

  let phase=robot.walkCycle || 0;
  let stride=1.82;
  let bodyBob=Math.abs(Math.sin(phase*2))*0.055;
  let bodySway=Math.sin(phase)*0.018;
  let bodyPitch=0.035+Math.max(0,Math.sin(phase*2))*0.018;

  model.position.y=(model.userData.baseY || 0)+bodyBob;
  model.rotation.x=-bodyPitch;
  model.rotation.z=bodySway;

  if(parts.pelvis){
    parts.pelvis.rotation.z-=bodySway*0.8;
    parts.pelvis.rotation.x+=bodyPitch*0.35;
  }
  if(parts.torso){
    parts.torso.rotation.z+=bodySway*0.45;
    parts.torso.rotation.y+=Math.sin(phase)*0.025;
  }
  if(parts.head){
    parts.head.rotation.z-=bodySway*0.7;
    parts.head.rotation.x+=bodyPitch*0.24;
  }
  if(parts.reactorPack) parts.reactorPack.rotation.x+=bodyPitch*0.4;

  for(let sideName of ["left","right"]){
    let side=sideName==="left" ? -1 : 1;
    let sideParts=parts[sideName];
    if(!sideParts) continue;

    let pose=giantRobotStepPose(phase+(sideName==="left" ? 0 : Math.PI),stride);
    let footZ=pose.z;
    let lift=pose.lift;
    let planted=pose.planted;
    if(!robot.footPlantState) robot.footPlantState={left:planted,right:planted};
    if(planted && !robot.footPlantState[sideName]) triggerGiantFootstepShake(robot,sideName);
    robot.footPlantState[sideName]=planted;
    let kneeDrive=lift*0.58;
    let hipSwing=-footZ*0.16;
    let anklePitch=-footZ*0.12-lift*0.08+planted*0.08;

    if(sideParts.hip){
      sideParts.hip.rotation.x+=hipSwing*0.28;
      sideParts.hip.position.y-=planted*0.035;
    }
    if(sideParts.upperLeg){
      sideParts.upperLeg.rotation.x+=hipSwing+kneeDrive*0.42;
      sideParts.upperLeg.position.z+=footZ*0.22+kneeDrive*0.16;
      sideParts.upperLeg.position.y-=planted*0.04;
    }
    if(sideParts.knee){
      sideParts.knee.position.z+=footZ*0.38+kneeDrive*0.46;
      sideParts.knee.position.y+=lift*0.24;
    }
    if(sideParts.kneePlate){
      sideParts.kneePlate.position.z+=footZ*0.38+kneeDrive*0.46;
      sideParts.kneePlate.position.y+=lift*0.24;
    }
    if(sideParts.shin){
      sideParts.shin.rotation.x+=-hipSwing*0.64-kneeDrive*0.52;
      sideParts.shin.position.z+=footZ*0.54+kneeDrive*0.36;
      sideParts.shin.position.y+=lift*0.18;
    }
    if(sideParts.foot){
      sideParts.foot.position.z+=footZ;
      sideParts.foot.position.y+=lift*0.72;
      sideParts.foot.rotation.x+=anklePitch;
      sideParts.foot.rotation.z+=side*planted*0.025;
    }
    if(sideParts.toePlate){
      sideParts.toePlate.position.z+=footZ+0.12;
      sideParts.toePlate.position.y+=lift*0.72;
      sideParts.toePlate.rotation.x+=anklePitch+lift*0.1;
      sideParts.toePlate.rotation.z+=side*planted*0.025;
    }
    if(sideParts.upperArm){
      sideParts.upperArm.rotation.x+=-side*0.02-Math.sin(phase+(sideName==="left" ? Math.PI : 0))*0.22;
      sideParts.upperArm.rotation.z+=side*0.06;
    }
    if(sideParts.forearm){
      sideParts.forearm.rotation.x+=-Math.sin(phase+(sideName==="left" ? Math.PI : 0))*0.12;
    }
    if(sideParts.hand){
      sideParts.hand.position.z+=-Math.sin(phase+(sideName==="left" ? Math.PI : 0))*0.1;
    }
    if(sideParts.shoulder){
      sideParts.shoulder.rotation.z+=side*0.018;
    }

    if(robot.throwWindup>0 && robot.activeThrowSide===sideName){
      let throwPose=smoothStep(robot.throwWindup/28);
      if(sideParts.shoulder) sideParts.shoulder.rotation.x-=0.18*throwPose;
      if(sideParts.upperArm) {
        sideParts.upperArm.rotation.x-=0.9*throwPose;
        sideParts.upperArm.rotation.z+=side*0.22*throwPose;
      }
      if(sideParts.forearm) sideParts.forearm.rotation.x-=0.48*throwPose;
      if(sideParts.hand) sideParts.hand.position.z+=0.36*throwPose;
    }
  }

  robot.walkCycle=phase+(robot.gaitRate || 0.0116);
}

function makeGiantFireballMesh(){
  let group=new THREE.Group();
  let core=new THREE.Mesh(giantFireballCoreGeo,giantFireballCoreMat.clone());
  let glow=new THREE.Mesh(giantFireballGlowGeo,giantFireballGlowMat.clone());
  let corona=new THREE.Mesh(giantFireballGlowGeo,giantFireballGlowMat.clone());

  core.scale.setScalar(2.2);
  glow.scale.setScalar(4.4);
  corona.scale.setScalar(7.2);
  corona.material.opacity=0.16;
  group.add(core,glow,corona);
  group.userData.core=core;
  group.userData.glow=glow;
  group.userData.corona=corona;
  return group;
}

function giantRobotThrowPoint(robot,sideName){
  let model=robot && robot.mechModel;
  let parts=model && model.userData ? model.userData.walkParts : null;
  let sideParts=parts && parts[sideName];
  let hand=sideParts && sideParts.hand;

  if(hand){
    model.updateWorldMatrix(true,true);
    hand.updateWorldMatrix(true,false);
    return hand.localToWorld(new THREE.Vector3(0,0,0.28));
  }

  let side=sideName==="left" ? -1 : 1;
  let forwardX=Math.sin(robot.angle);
  let forwardZ=Math.cos(robot.angle);
  let rightX=Math.cos(robot.angle);
  let rightZ=-Math.sin(robot.angle);
  return new THREE.Vector3(
    robot.x+forwardX*18+rightX*side*15,
    robot.y+38,
    robot.z+forwardZ*18+rightZ*side*15
  );
}

function nearestEnemyForGiant(robot){
  let best=null;
  let bestDistSq=Infinity;
  let range=620;

  for(let enemy of activeEnemies()){
    if(!enemy || !enemy.active || enemy.health<=0) continue;
    let dx=enemy.x-robot.x;
    let dz=enemy.z-robot.z;
    let distSq=dx*dx+dz*dz;
    if(distSq<bestDistSq && distSq<range*range){
      best=enemy;
      bestDistSq=distSq;
    }
  }

  return best;
}

function throwGiantFireball(robot,target){
  if(!robot || !target) return false;

  let sideName=robot.throwSide==="left" ? "left" : "right";
  robot.throwSide=sideName==="left" ? "right" : "left";
  robot.activeThrowSide=sideName;
  let start=giantRobotThrowPoint(robot,sideName);
  let targetY=target.y+Math.max(3,target.hitHeight || 5)*0.62;
  let dx=target.x-start.x;
  let dz=target.z-start.z;
  let dy=targetY-start.y;
  let horizontalDistance=Math.max(1,Math.hypot(dx,dz));
  let gravity=0.018;
  let flightFrames=clamp(horizontalDistance/3.1,72,150);
  let vx=dx/flightFrames;
  let vz=dz/flightFrames;
  let vy=(dy+0.5*gravity*flightFrames*flightFrames)/flightFrames;
  let mesh=makeGiantFireballMesh();

  mesh.position.copy(start);
  scene.add(mesh);
  giantFireballs.push({
    owner:robot,
    target,
    mesh,
    x:start.x,
    y:start.y,
    z:start.z,
    vx,
    vy,
    vz,
    gravity,
    age:0,
    life:Math.ceil(flightFrames)+54,
    damage:95,
    blastRadius:42
  });

  robot.throwCooldown=118;
  robot.throwWindup=28;

  for(let i=0;i<20;i++){
    dust.spawnThrusterParticle(
      start.x,
      start.y,
      start.z,
      -vx*(1.8+Math.random()*1.8)+(Math.random()-0.5)*2.2,
      -vz*(1.8+Math.random()*1.8)+(Math.random()-0.5)*2.2,
      -vy*0.25+(Math.random()-0.5)*2.6,
      0.28+Math.random()*0.18,
      0.12+Math.random()*0.08
    );
  }

  if(motorAudio.playRocketLaunch) motorAudio.playRocketLaunch(robot);
  return true;
}

function updateGiantFireballs(){
  for(let i=giantFireballs.length-1;i>=0;i--){
    let fireball=giantFireballs[i];
    fireball.age++;

    let prevX=fireball.x;
    let prevY=fireball.y;
    let prevZ=fireball.z;
    fireball.vy-=fireball.gravity;
    fireball.x+=fireball.vx;
    fireball.y+=fireball.vy;
    fireball.z+=fireball.vz;

    fireball.mesh.position.set(fireball.x,fireball.y,fireball.z);
    fireball.mesh.rotation.y+=0.08;
    fireball.mesh.rotation.x+=0.055;
    let pulse=1+Math.sin(fireball.age*0.42)*0.08;
    if(fireball.mesh.userData.core) fireball.mesh.userData.core.scale.setScalar(2.2*pulse);
    if(fireball.mesh.userData.glow) fireball.mesh.userData.glow.scale.setScalar(4.4*(1+Math.sin(fireball.age*0.31)*0.1));
    if(fireball.mesh.userData.corona) fireball.mesh.userData.corona.scale.setScalar(7.2*(1+Math.sin(fireball.age*0.23)*0.08));

    if(fireball.age%2===0){
      for(let t=0;t<3;t++){
        dust.spawnThrusterParticle(
          fireball.x-fireball.vx*(0.5+t*0.32),
          fireball.y-fireball.vy*(0.5+t*0.32),
          fireball.z-fireball.vz*(0.5+t*0.32),
          -fireball.vx*(1.2+Math.random()*0.9)+(Math.random()-0.5)*1.6,
          -fireball.vz*(1.2+Math.random()*0.9)+(Math.random()-0.5)*1.6,
          -fireball.vy*0.35+(Math.random()-0.5)*1.8,
          0.32+Math.random()*0.22,
          0.12+Math.random()*0.08
        );
      }
    }

    let surfaceY=drivingSurfaceHeight(fireball.x,fireball.z);
    let hitEnemy=null;
    for(let enemy of activeEnemies()){
      let hitRadius=Math.max(7.5,(enemy.collisionRadius || 3)+4.8);
      let hitHeight=Math.max(8,enemy.hitHeight || 5);
      let dx=enemy.x-fireball.x;
      let dz=enemy.z-fireball.z;
      if(dx*dx+dz*dz<hitRadius*hitRadius && Math.abs(fireball.y-enemy.y)<hitHeight+8){
        hitEnemy=enemy;
        break;
      }
    }

    let obstacleHitInfo={};
    let hitObstacle=world.obstacleAlongSegment3D(prevX,prevY,prevZ,fireball.x,fireball.y,fireball.z,2.4,obstacleHitInfo);
    let exactRockHitInfo={};
    let exactRock=world.rockObstacleAlongSegmentExact
      ? world.rockObstacleAlongSegmentExact(prevX,prevY,prevZ,fireball.x,fireball.y,fireball.z,exactRockHitInfo)
      : null;
    if(exactRock && (!hitObstacle || exactRockHitInfo.distance<obstacleHitInfo.distance)){
      hitObstacle=exactRock;
      obstacleHitInfo=exactRockHitInfo;
    }
    let hitGround=fireball.y<=surfaceY+1.1;
    let expired=fireball.age>fireball.life;

    if(hitEnemy || hitObstacle || hitGround || expired){
      let explosionX=hitEnemy ? hitEnemy.x : hitObstacle && Number.isFinite(obstacleHitInfo.x) ? obstacleHitInfo.x : hitObstacle ? hitObstacle.x : fireball.x;
      let explosionZ=hitEnemy ? hitEnemy.z : hitObstacle && Number.isFinite(obstacleHitInfo.z) ? obstacleHitInfo.z : hitObstacle ? hitObstacle.z : fireball.z;
      let explosionY=hitEnemy
        ? hitEnemy.y+Math.max(2,(hitEnemy.hitHeight || 5)*0.45)
        : Math.max(hitObstacle && Number.isFinite(obstacleHitInfo.y) ? obstacleHitInfo.y : fireball.y,drivingSurfaceHeight(explosionX,explosionZ)+1.1);

      spawnRocketExplosion(explosionX,explosionY,explosionZ);
      triggerScreenShake(0.68);

      if(hitEnemy){
        damageEnemy(hitEnemy,fireball.damage,{skipUnitReward:true});
        rattleActor(hitEnemy,1.2);
      }

      for(let enemy of activeEnemies()){
        if(enemy===hitEnemy) continue;
        let dx=enemy.x-explosionX;
        let dz=enemy.z-explosionZ;
        if(dx*dx+dz*dz<fireball.blastRadius*fireball.blastRadius){
          damageEnemy(enemy,Math.max(24,fireball.damage*0.55),{skipUnitReward:true});
          rattleActor(enemy,0.95);
        }
      }

      for(let s=0;s<34;s++){
        let angle=Math.random()*Math.PI*2;
        let speed=4+Math.random()*9;
        dust.spawnThrusterParticle(
          explosionX,
          explosionY,
          explosionZ,
          Math.cos(angle)*speed,
          Math.sin(angle)*speed,
          1.2+Math.random()*5.8,
          0.38+Math.random()*0.28,
          0.14+Math.random()*0.1
        );
      }

      scene.remove(fireball.mesh);
      giantFireballs.splice(i,1);
    }
  }
}

function clearGiantFireballs(){
  for(let fireball of giantFireballs){
    scene.remove(fireball.mesh);
  }
  giantFireballs=[];
}

function tradingOutpostAvoidanceAt(actor,x,z,padding=72){
  let actorRadius=actor && Number.isFinite(actor.collisionRadius)
    ? actor.collisionRadius
    : 2.35;
  let best=null;

  for(let collision of activeTradingOutpostCollisions()){
    let floor=collision && collision.floor;
    if(!floor) continue;

    let local=worldToTradingOutpostLocal(x,z,collision);
    if(!local) continue;

    let minX=floor.minX-actorRadius-padding;
    let maxX=floor.maxX+actorRadius+padding;
    let minZ=floor.minZ-actorRadius-padding;
    let maxZ=floor.maxZ+actorRadius+padding;
    if(local.x<minX || local.x>maxX || local.z<minZ || local.z>maxZ) continue;

    let distances=[
      {x:-1,z:0,value:local.x-minX},
      {x:1,z:0,value:maxX-local.x},
      {x:0,z:-1,value:local.z-minZ},
      {x:0,z:1,value:maxZ-local.z}
    ].sort((a,b)=>a.value-b.value);
    let nearest=distances[0];
    let worldVector=tradingOutpostLocalVectorToWorld(nearest.x,nearest.z,collision);
    let strength=1+clamp((padding+actorRadius-nearest.value)/Math.max(1,padding+actorRadius),0,1.8);

    if(!best || strength>best.strength){
      best={x:worldVector.x,z:worldVector.z,strength};
    }
  }

  return best;
}

function landingPadAvoidanceAt(actor,x,z,padding=68){
  if(!world || !world.landingSurfaceAt) return null;

  let surface=world.landingSurfaceAt(x,z,true);
  if(!surface) return null;

  let actorRadius=actor && Number.isFinite(actor.collisionRadius)
    ? actor.collisionRadius
    : 2.35;
  let dx=x-surface.x;
  let dz=z-surface.z;
  let distance=Math.max(0.001,Math.hypot(dx,dz));
  let limit=(surface.padR || surface.r || 0)+actorRadius+padding;
  if(distance>limit) return null;

  return {
    x:dx/distance,
    z:dz/distance,
    strength:1+clamp((limit-distance)/Math.max(1,limit),0,1.5)
  };
}

function giantBuildingAvoidanceVector(robot){
  if(!robot) return null;

  let forwardX=Math.sin(robot.angle);
  let forwardZ=Math.cos(robot.angle);
  let lookAhead=Math.max(95,(robot.collisionRadius || 29)*3.8);
  let samples=[
    {x:robot.x,z:robot.z,weight:1.35,padding:78},
    {x:robot.x+forwardX*lookAhead,z:robot.z+forwardZ*lookAhead,weight:1,padding:92}
  ];
  let vx=0;
  let vz=0;
  let strength=0;

  for(let sample of samples){
    let avoid=tradingOutpostAvoidanceAt(robot,sample.x,sample.z,sample.padding)
      || landingPadAvoidanceAt(robot,sample.x,sample.z,sample.padding*0.85);
    if(!avoid) continue;

    let weight=sample.weight*(avoid.strength || 1);
    vx+=avoid.x*weight;
    vz+=avoid.z*weight;
    strength+=weight;
  }

  let length=Math.hypot(vx,vz);
  if(length<0.001) return null;

  return {
    x:vx/length,
    z:vz/length,
    strength
  };
}

function spawnGiantTestRobot(startInfo){
  clearGiantTestRobot();

  let angle=startInfo.angle;
  let forwardX=Math.sin(angle);
  let forwardZ=Math.cos(angle);
  let rightX=Math.cos(angle);
  let rightZ=-Math.sin(angle);
  let basePoint=roadPointForOffset(startInfo.z,startInfo.fieldOffset);
  let x=basePoint.x+forwardX*165+rightX*62;
  let z=basePoint.z+forwardZ*165+rightZ*62;
  let y=drivingSurfaceHeight(x,z);
  let patrolRadius=Math.max(150,Math.hypot(x-basePoint.x,z-basePoint.z));
  let group=new THREE.Group();
  group.rotation.order="YXZ";
  scene.add(group);

  let model=makeEnemyMechModel(9871,"giant");
  model.name="giant-test-robot";
  model.scale.multiplyScalar(8.2);
  model.position.y=0.84*model.scale.y;
  model.userData.baseY=model.position.y;
  model.traverse(child=>{
    if(!child.isMesh || !child.material) return;
    child.castShadow=true;
    child.receiveShadow=true;
    child.material=child.material.clone();
    if(child.name.includes("cockpit") || child.name.includes("visor") || child.name.includes("eye")){
      child.material.color.set(0xa9f2ff);
      if(child.material.emissive) child.material.emissive.set(0x32d7ff);
      child.material.emissiveIntensity=1.4;
    }else if(child.name.includes("plate") || child.name.includes("shroud") || child.name.includes("pauldron")){
      child.material.color.set(0x756c84);
      if(child.material.emissive) child.material.emissive.set(0x140b1e);
      child.material.emissiveIntensity=0.18;
    }
  });
  group.add(model);

  giantTestRobot={
    id:"giant-test-robot",
    group,
    mechModel:model,
    carModel:null,
    x,
    y,
    z,
    collisionRadius:29,
    blocksTradingOutpostFootprint:true,
    homeX:x,
    homeZ:z,
    patrolCenterX:basePoint.x,
    patrolCenterZ:basePoint.z,
    patrolRadius,
    angle,
    velAngle:angle,
    speed:0.108,
    speedDelta:0,
    turnVelocity:0,
    gaitRate:Math.PI/270,
    throwCooldown:80,
    throwWindup:0,
    throwSide:"right",
    patrolSign:1,
    onGround:true,
    airborne:false,
    health:1000,
    morphProgress:0,
    walkCycle:0,
    lastWalkX:x,
    lastWalkZ:z,
    movementCompression:0,
    movementLean:0,
    movementPitch:0,
    walkMaxSpeed:0.12,
    walkProfile:{
      phaseOffset:0,
      strideScale:3.6,
      cadenceScale:0.32,
      intensityScale:1.08,
      legSwing:1.32,
      armSwing:0.5,
      footLift:1.24,
      kneeDrive:0.9,
      bobScale:0.34,
      torsoSway:0.52,
      forwardLean:0.18,
      armLag:-0.18
    },
    shadow:makeGiantTestRobotShadow()
  };

  addGiantRobotLegConnectors(giantTestRobot);
  updateGiantTestRobot();
}

function updateGiantTestRobot(){
  if(!giantTestRobot) return;

  let robot=giantTestRobot;
  if(robot.throwCooldown>0) robot.throwCooldown--;
  if(robot.throwWindup>0) robot.throwWindup--;

  let target=nearestEnemyForGiant(robot);
  if(target){
    let targetAngle=Math.atan2(target.x-robot.x,target.z-robot.z);
    let turn=clamp(normalizeAngle(targetAngle-robot.angle),-0.012,0.012);
    robot.angle=normalizeAngle(robot.angle+turn);
    robot.velAngle=robot.angle;

    if(robot.throwCooldown<=0){
      throwGiantFireball(robot,target);
    }
  }else{
    let centerX=Number.isFinite(robot.patrolCenterX) ? robot.patrolCenterX : robot.homeX;
    let centerZ=Number.isFinite(robot.patrolCenterZ) ? robot.patrolCenterZ : robot.homeZ;
    let dx=robot.x-centerX;
    let dz=robot.z-centerZ;
    let distance=Math.max(1,Math.hypot(dx,dz));
    let radius=Number.isFinite(robot.patrolRadius) ? robot.patrolRadius : 180;
    let orbitAngle=Math.atan2(dx,dz);
    let lookAhead=clamp(0.42+Math.abs(distance-radius)/radius,0.42,0.95);
    let aheadAngle=orbitAngle+(robot.patrolSign || 1)*lookAhead;
    let targetX=centerX+Math.sin(aheadAngle)*radius;
    let targetZ=centerZ+Math.cos(aheadAngle)*radius;
    let desiredAngle=Math.atan2(targetX-robot.x,targetZ-robot.z);
    let turn=clamp(normalizeAngle(desiredAngle-robot.angle),-0.009,0.009);
    robot.angle=normalizeAngle(robot.angle+turn);
    robot.velAngle=robot.angle;
  }

  let buildingAvoidance=giantBuildingAvoidanceVector(robot);
  if(buildingAvoidance){
    let avoidAngle=Math.atan2(buildingAvoidance.x,buildingAvoidance.z);
    let avoidTurn=normalizeAngle(avoidAngle-robot.angle);
    let turnLimit=buildingAvoidance.strength>2 ? 0.06 : 0.034;
    robot.angle=normalizeAngle(robot.angle+clamp(avoidTurn,-turnLimit,turnLimit));
    robot.velAngle=robot.angle;
    robot.patrolSign=avoidTurn>=0 ? 1 : -1;
  }

  let previousSpeed=robot.speed;
  let nextX=robot.x+Math.sin(robot.angle)*robot.speed;
  let nextZ=robot.z+Math.cos(robot.angle)*robot.speed;
  let robotBounds=actorObstacleVerticalBounds(robot,nextX,nextZ);
  let robotObstacleCollision=world && world.collidesWithObstacles
    ? world.collidesWithObstacles(nextX,nextZ,robot.collisionRadius || 29,robotBounds)
    : false;
  if(robotObstacleCollision || collidesWithTradingOutpostWalls(robot,nextX,nextZ,robot.x,robot.z) || collidesWithLandingPad(robot,nextX,nextZ,robot.x,robot.z)){
    let avoid=giantBuildingAvoidanceVector(robot);
    if(avoid){
      robot.angle=normalizeAngle(Math.atan2(avoid.x,avoid.z));
      robot.x+=avoid.x*0.42;
      robot.z+=avoid.z*0.42;
    }else{
      robot.patrolSign=-(robot.patrolSign || 1);
      robot.angle=normalizeAngle(robot.angle+robot.patrolSign*0.48);
    }
    robot.velAngle=robot.angle;
  }else{
    robot.x=nextX;
    robot.z=nextZ;
  }
  robot.y=drivingSurfaceHeight(robot.x,robot.z);
  robot.speedDelta=robot.speed-previousSpeed;
  robot.turnVelocity=0;
  robot.group.position.set(robot.x,robot.y,robot.z);
  robot.group.rotation.y=robot.angle;
  robot.group.rotation.x=0;
  robot.group.rotation.z=0;
  updateGiantTestRobotWalk(robot);
  updateGiantRobotLegConnectors(robot);

  if(robot.shadow){
    robot.shadow.position.set(robot.x,robot.y+0.08,robot.z);
    robot.shadow.rotation.z=-robot.angle;
  }
}

function updateMorphVisual(car){
  let target=car.morphed ? 1 : 0;
  let previous=car.morphProgress;
  car.morphProgress+=(target-car.morphProgress)*morphTransitionRate;
  if(Math.abs(target-car.morphProgress)<0.003) car.morphProgress=target;

  let jetTarget=car.jetMode ? 1 : 0;
  let previousJet=car.jetProgress || 0;
  car.jetProgress+=(jetTarget-car.jetProgress)*jetTransitionRate;
  if(Math.abs(jetTarget-car.jetProgress)<0.003) car.jetProgress=jetTarget;

  let p=car.morphProgress;
  let jetP=car.jetProgress;
  let bodyFold=morphStage(p,0.08,0.62);
  let vehicleReveal=morphStage(p,0.58,0.88);
  let lockIn=morphStage(p,0.64,0.96);
  let jetReveal=morphStage(jetP,0.34,0.86);
  let jetFold=morphStage(jetP,0.1,0.72);
  let transformShake=Math.max(morphPulse(p,0.5,0.32),morphPulse(jetP,0.46,0.32));

  if(car.mechModel){
    let baseY=car.mechModel.userData.baseY || 0.72;
    let finalHide=Math.max(morphStage(p,0.82,1),morphStage(jetP,0.78,1));
    let scaleX=1.05*(1+0.12*bodyFold+0.08*jetFold-0.72*finalHide);
    let scaleY=1.05*(1-0.38*bodyFold-0.46*jetFold-0.42*finalHide);
    let scaleZ=1.05*(1+0.28*bodyFold+0.34*jetFold-0.68*finalHide);

    car.mechModel.visible=p<0.995;
    car.mechModel.visible=finalHide<0.995;
    car.mechModel.scale.set(scaleX,scaleY,scaleZ);
    let foldAmount=Math.max(bodyFold,jetFold);
    car.mechModel.position.y=car.mechModel.position.y*(1-foldAmount)+((baseY*0.28)+0.2)*foldAmount;
    car.mechModel.rotation.x+=-0.22*bodyFold-0.18*jetFold+Math.sin(performance.now()*0.07)*0.02*transformShake;
    car.mechModel.rotation.z+=Math.sin(performance.now()*0.049)*0.035*transformShake;
    if(jetP>0.001) applyJetFold(car.mechModel,jetP);
    else applyTransformerFold(car.mechModel,p);
    updateRobotDamageFlashes(car);
  }

  if(car.carModel){
    let baseY=car.carModel.userData.baseY || 0.04;
    let baseScale=car.carModel.userData.baseScale || new THREE.Vector3(1,1,1);
    let wheelDrop=morphStage(p,0.18,0.48);
    let scale=0.78+vehicleReveal*0.22;
    let widthSnap=1+0.18*wheelDrop*(1-lockIn);
    let heightSquash=1-0.22*lockIn*(1-vehicleReveal);

    car.carModel.visible=p>0.56;
    car.carModel.scale.set(baseScale.x*scale*widthSnap,baseScale.y*scale*heightSquash,baseScale.z*scale);
    car.carModel.position.y=baseY+(1-vehicleReveal)*0.86+Math.sin(p*Math.PI*5)*0.06*transformShake;
    car.carModel.rotation.x=(1-vehicleReveal)*0.34-0.08*wheelDrop*(1-lockIn);
    car.carModel.rotation.z=Math.sin(performance.now()*0.061)*0.028*transformShake*(1-lockIn);
    animatePlayerCarWheels(car);
  }

  if(car.jetModel){
    let baseY=car.jetModel.userData.baseY || 0.45;
    let baseScale=car.jetModel.userData.baseScale || new THREE.Vector3(1,1,1);
    let jetVisible=car.jetMode || jetP>0.12;
    let jetVisualFade=morphStage(jetP,0.12,0.34);
    let scale=0.48+jetVisualFade*0.34+jetReveal*0.18;
    let snap=morphStage(jetP,0.72,1);

    car.jetModel.visible=jetVisible;
    car.jetModel.scale.set(baseScale.x*scale,baseScale.y*(0.74+jetReveal*0.26),baseScale.z*scale);
    car.jetModel.position.y=baseY+(1-jetReveal)*0.62+(1-jetVisualFade)*0.18+Math.sin(performance.now()*0.006)*0.12*jetReveal;
    car.jetModel.rotation.x=(1-jetReveal)*0.28-0.08*snap;
    car.jetModel.rotation.z=Math.sin(performance.now()*0.052)*0.035*transformShake*(1-snap);
    animateHovercraftPropulsion(car.jetModel,jetVisualFade);
  }

  if(car.aimCross){
    let jetAimCross=car.jetMode || car.jetProgress>0.35;
    car.aimCross.scale.setScalar(jetAimCross ? 1 : 1+Math.sin(performance.now()*0.004)*0.035);
  }
  updateVehicleHeadlights(car);

  if(car.group.visible && car.health>0 && !gameOver && previous!==p){
    if(crossedMorphStage(previous,p,0.22)) emitMorphSparks(car,10);
    if(crossedMorphStage(previous,p,0.48)) emitMorphSparks(car,16);
    if(crossedMorphStage(previous,p,0.78)) emitMorphSparks(car,12);
  }
  if(car.group.visible && car.health>0 && !gameOver && previousJet!==jetP){
    if(crossedMorphStage(previousJet,jetP,0.24)) emitMorphSparks(car,12);
    if(crossedMorphStage(previousJet,jetP,0.54)) emitMorphSparks(car,18);
  }
  car.lastMorphProgress=p;
}

function beginJetLandingTransform(car,surfaceY){
  if(!car || car.jetProgress<0.2) return;
  let visualY=Number.isFinite(car.renderY)
    ? car.renderY
    : car.group && Number.isFinite(car.group.position.y)
    ? car.group.position.y
    : car.y;
  let referenceY=Math.max(Number.isFinite(visualY) ? visualY : car.y,Number.isFinite(car.y) ? car.y : 0);
  let clearance=Number.isFinite(surfaceY) ? Math.max(0,referenceY-surfaceY) : 0;
  let lift=clamp(clearance,2.8,6.8);
  car.jetLandingTransformLift=Math.max(car.jetLandingTransformLift || 0,lift);
  car.jetLandingTransformStartLift=Math.max(car.jetLandingTransformStartLift || 0,lift);
}

function updateJetLandingTransformLift(car){
  if(!car) return 0;
  let current=Math.max(0,car.jetLandingTransformLift || 0);
  if(current<=0.001){
    car.jetLandingTransformLift=0;
    return 0;
  }
  if(car.jetMode){
    car.jetLandingTransformLift=0;
    return 0;
  }

  let startLift=Math.max(current,car.jetLandingTransformStartLift || 0);
  let jetBlend=smoothStep(clamp((car.jetProgress || 0)/0.82,0,1));
  let target=startLift*jetBlend;
  let follow=target<current ? 0.105 : 0.055;
  current+=(target-current)*follow;
  if((car.jetProgress || 0)<0.06 && current<0.08){
    current=0;
    car.jetLandingTransformStartLift=0;
  }
  car.jetLandingTransformLift=current;
  return current;
}

function updateMechAnimation(car){
  let model=car.mechModel || car.group.children[0];
  let parts=model && model.userData ? model.userData.walkParts : null;
  if(!model || !parts) return;

  model.traverse(child=>{
    if(child.isMesh) resetMechPart(child);
  });

  let speedAbs=Math.abs(car.speed || 0);
  let walkProfile=car.walkProfile || null;
  let walkMaxSpeed=car.walkMaxSpeed || mechGroundMaxSpeed;
  let previousWalkX=Number.isFinite(car.lastWalkX) ? car.lastWalkX : car.x;
  let previousWalkZ=Number.isFinite(car.lastWalkZ) ? car.lastWalkZ : car.z;
  let groundDistance=Math.hypot(car.x-previousWalkX,car.z-previousWalkZ);
  car.lastWalkX=car.x;
  car.lastWalkZ=car.z;

  let moving=car.onGround && car.health>0 && !gameOver && groundDistance>0.002 && speedAbs>0.01 && car.morphProgress<0.35;
  let runAmount=moving ? smoothStep((speedAbs-walkMaxSpeed*0.5)/(walkMaxSpeed*0.85)) : 0;
  let longStrideAmount=moving ? smoothStep((speedAbs-walkMaxSpeed*0.42)/(walkMaxSpeed*0.28)) : 0;
  let sprintAmount=moving ? smoothStep((speedAbs-walkMaxSpeed*0.62)/(walkMaxSpeed*0.26)) : 0;
  let intensity=moving ? clamp(groundDistance/walkMaxSpeed,0.16,1.1+runAmount*0.35) : 0;
  if(walkProfile) intensity*=walkProfile.intensityScale;
  let direction=car.speed<0 ? -1 : 1;
  let accelKick=clamp((car.speedDelta || 0)*34,-1,1);
  let brakingLoad=clamp(-(car.speedDelta || 0)*48,0,1);
  let turnLoad=clamp((car.turnVelocity || 0)*28,-1,1);
  let targetCompression=moving ? brakingLoad*0.16+Math.abs(turnLoad)*0.05+longStrideAmount*0.024+sprintAmount*0.018 : 0;
  let targetLean=moving ? -turnLoad*(0.07+runAmount*0.08) : 0;
  let targetPitch=moving
    ? (runAmount*0.08+longStrideAmount*0.025+sprintAmount*0.025)*direction-accelKick*0.04+brakingLoad*0.08
    : 0;

  car.movementCompression+=(targetCompression-(car.movementCompression || 0))*0.18;
  car.movementLean+=(targetLean-(car.movementLean || 0))*0.14;
  car.movementPitch+=(targetPitch-(car.movementPitch || 0))*0.12;

  if(moving){
    let strideLength=mechStrideLength*(walkProfile ? walkProfile.strideScale : 1)*(1+runAmount*1.38+longStrideAmount*1.35+sprintAmount*0.42);
    let strideDrag=1-brakingLoad*0.18;
    let cadence=(walkProfile ? walkProfile.cadenceScale : 1)*(1+runAmount*0.06-longStrideAmount*0.1-sprintAmount*0.04);
    car.walkCycle+=direction*groundDistance*(Math.PI*2/strideLength)*cadence*strideDrag;
  }else{
    car.walkCycle*=0.88;
  }

  let phase=car.walkCycle+(walkProfile ? walkProfile.phaseOffset : 0);
  let flightPulse=Math.pow(Math.max(0,Math.sin(phase*2)),2)*runAmount*(1-longStrideAmount*0.32-sprintAmount*0.24);
  let bobScale=1-longStrideAmount*0.26-sprintAmount*0.16;
  let bob=(Math.abs(Math.sin(phase))*0.12*intensity*bobScale+flightPulse*0.16)*(walkProfile ? walkProfile.bobScale : 1);
  let torsoSway=Math.sin(phase)*0.04*intensity*(1+runAmount*0.35-longStrideAmount*0.12-sprintAmount*0.08)*(walkProfile ? walkProfile.torsoSway : 1);
  let torsoTwist=Math.sin(phase)*0.055*intensity*(longStrideAmount*0.65+sprintAmount*0.35)*direction;
  let headCounter=Math.sin(phase)*0.025*intensity*(1+runAmount*0.25-longStrideAmount*0.12-sprintAmount*0.06);
  let forwardLean=(runAmount*0.08+longStrideAmount*0.035+sprintAmount*0.02)*direction*(walkProfile ? walkProfile.forwardLean : 1);
  let compression=car.movementCompression || 0;
  let heavyLean=car.movementLean || 0;
  let heavyPitch=car.movementPitch || 0;

  model.position.y=(model.userData.baseY || 0)+bob-compression;
  model.rotation.z=torsoSway+heavyLean;
  model.rotation.x=-0.035*intensity+forwardLean+heavyPitch;

  if(parts.torso) parts.torso.rotation.z+=torsoSway*0.45;
  if(parts.torso) parts.torso.rotation.y-=torsoTwist*0.7;
  let headLookRobotAmount=clamp(1-(car.morphProgress || 0)/0.48,0,1)*clamp(1-(car.jetProgress || 0)/0.38,0,1);
  let headLookYaw=updateRobotHeadLookYaw(car,headLookRobotAmount);
  if(parts.torso) parts.torso.rotation.y+=headLookYaw*0.12;
  if(parts.pelvis) {
    parts.pelvis.rotation.z-=torsoSway*0.8;
    parts.pelvis.rotation.x+=forwardLean*0.35;
    parts.pelvis.rotation.y+=torsoTwist;
    parts.pelvis.position.y-=compression*0.46;
  }
  if(parts.head) {
    parts.head.rotation.z-=headCounter+heavyLean*0.32;
    parts.head.rotation.x+=forwardLean*0.32-heavyPitch*0.35;
    parts.head.rotation.y+=torsoTwist*0.32+headLookYaw;
  }
  if(parts.visor) parts.visor.rotation.y+=headLookYaw*0.92;
  if(parts.torso) {
    parts.torso.position.y-=compression*0.34;
    parts.torso.rotation.x+=heavyPitch*0.42;
  }
  if(parts.chestPlate) parts.chestPlate.position.y-=compression*0.24;
  if(parts.reactorPack) parts.reactorPack.rotation.x+=Math.sin(phase*2)*0.025*intensity+forwardLean*0.45-heavyPitch*0.52;

  for(let sideName of ["left","right"]){
    let side=sideName==="left" ? -1 : 1;
    let sideParts=parts[sideName];
    let sidePhase=phase+(sideName==="left" ? 0 : Math.PI)+(walkProfile ? walkProfile.armLag*side : 0);
    let swing=Math.sin(sidePhase)*intensity;
    let planted=Math.max(0,Math.cos(sidePhase))*intensity;
    let lifted=Math.max(0,-Math.cos(sidePhase))*intensity;
    let lifted01=smoothStep(lifted/Math.max(0.001,intensity));
    let planted01=smoothStep(planted/Math.max(0.001,intensity));
    let giantFootPlanted=car.isGiant && moving && planted01>0.72 && lifted01<0.2;
    if(car.isGiant){
      if(!car.footPlantState) car.footPlantState={left:false,right:false};
      if(giantFootPlanted && !car.footPlantState[sideName]) triggerGiantFootstepShake(car,sideName);
      car.footPlantState[sideName]=giantFootPlanted;
    }
    let stride=1+runAmount*1.36+longStrideAmount*0.98+sprintAmount*0.28;
    let lift=(1+runAmount*0.56+longStrideAmount*0.18)*(walkProfile ? walkProfile.footLift : 1);
    let kneeDrive=runAmount*lifted01*(1-longStrideAmount*0.12-sprintAmount*0.06)*(walkProfile ? walkProfile.kneeDrive : 1);
    let footPlant=runAmount*planted01;
    let sideLoad=1+planted01*(0.12+brakingLoad*0.26);
    let turnBrace=turnLoad*side*planted01;
    let sprintDrive=(longStrideAmount*0.82+sprintAmount*0.18)*direction;
    let groundDrive=sprintDrive*planted01;
    let swingDrive=sprintDrive*lifted01;
    let legSwing=walkProfile ? walkProfile.legSwing : 1;
    let armSwing=walkProfile ? walkProfile.armSwing : 1;

    if(sideParts.upperLeg){
      sideParts.upperLeg.rotation.x+=swing*0.74*stride*legSwing+kneeDrive*(0.48+sprintAmount*0.12)-turnBrace*0.12-groundDrive*0.16;
      sideParts.upperLeg.position.z+=swing*0.3*stride*legSwing+kneeDrive*0.18-footPlant*0.12-groundDrive*0.18;
      sideParts.upperLeg.position.y-=compression*0.2*sideLoad;
    }
    if(sideParts.shin){
      sideParts.shin.rotation.x+=(-swing*0.42*stride*legSwing-lifted*0.22*lift-kneeDrive*(0.58+sprintAmount*0.16)+groundDrive*0.12);
      sideParts.shin.position.z+=swing*0.24*stride*legSwing+kneeDrive*0.26-groundDrive*0.14;
    }
    if(sideParts.knee){
      sideParts.knee.position.y+=lifted*0.05+kneeDrive*(0.36+sprintAmount*0.12);
      sideParts.knee.position.z+=swing*0.12+kneeDrive*0.34+swingDrive*0.14;
    }
    if(sideParts.kneePlate){
      sideParts.kneePlate.position.y+=lifted*0.05+kneeDrive*(0.36+sprintAmount*0.12);
      sideParts.kneePlate.position.z+=swing*0.12+kneeDrive*0.34+swingDrive*0.14;
    }
    if(sideParts.foot){
      sideParts.foot.position.y+=lifted*0.22*lift+kneeDrive*(0.54+sprintAmount*0.1)-compression*0.34*sideLoad;
      sideParts.foot.position.z+=swing*0.7*stride*legSwing-planted*0.26*sideLoad+kneeDrive*0.5-footPlant*0.34-groundDrive*0.38+swingDrive*0.16;
      sideParts.foot.rotation.x+=-swing*0.28*stride*legSwing+lifted*0.1*lift+kneeDrive*0.36-footPlant*(0.3+sprintAmount*0.18)-brakingLoad*planted01*0.18-groundDrive*0.12;
      sideParts.foot.rotation.z+=side*turnBrace*0.1;
    }
    if(sideParts.toePlate){
      sideParts.toePlate.position.y+=lifted*0.22*lift+kneeDrive*(0.54+sprintAmount*0.1)-compression*0.34*sideLoad;
      sideParts.toePlate.position.z+=swing*0.7*stride*legSwing-planted*0.26*sideLoad+kneeDrive*0.5-footPlant*0.34-groundDrive*0.38+swingDrive*0.16;
      sideParts.toePlate.rotation.x+=-swing*0.34*stride*legSwing+lifted*0.14*lift+kneeDrive*0.42-footPlant*(0.38+sprintAmount*0.22)-brakingLoad*planted01*0.22-groundDrive*0.14;
      sideParts.toePlate.rotation.z+=side*turnBrace*0.12;
    }
    if(sideParts.upperArm){
      sideParts.upperArm.rotation.x+=-swing*(0.24+runAmount*0.58+sprintAmount*0.46)*armSwing+heavyPitch*0.2;
      sideParts.upperArm.rotation.y+=side*(0.04+0.16*sprintAmount)*planted01;
      sideParts.upperArm.rotation.z+=side*0.04*intensity-heavyLean*0.32;
    }
    if(sideParts.forearm){
      sideParts.forearm.rotation.x+=-swing*(0.16+runAmount*0.36+sprintAmount*0.28)*armSwing-lifted01*sprintAmount*0.16;
    }
    if(sideParts.hand){
      sideParts.hand.position.z+=-swing*(0.06+runAmount*0.18+sprintAmount*0.22)*armSwing;
    }
    if(sideParts.cannon){
      sideParts.cannon.rotation.x+=-swing*(0.06+runAmount*0.14);
    }
    if(sideParts.shoulder){
      sideParts.shoulder.rotation.z+=side*0.025*intensity;
      sideParts.shoulder.rotation.y-=side*sprintAmount*planted01*0.08;
    }
  }
}

function updateCar(car){
  let prevX=car.x;
  let prevZ=car.z;
  let prevY=car.y;
  let previousSpeed=car.speed || 0;
  let {forward,turn,lift}=controlsFor(car);
  updateMorphInput(car);
  car.collisionRadius=actorObstacleRadius(car);
  car.hitHeight=car.jetProgress>0.35 ? 4.8 : car.morphProgress>0.65 ? 3.6 : 6.2;
  if(!Number.isFinite(car.fuel)) car.fuel=maxFuel;
  let fuelEmpty=car.fuel<=0.001;
  let fuelBlocksMovement=fuelEmpty && (car.jetMode || car.jetProgress>0.35 || car.morphProgress>0.65);
  if(fuelBlocksMovement){
    forward=0;
    lift=0;
  }
  updateAimCross(car);
  updateRocketInput(car);
  car.throttleInput=forward;
  car.liftInput=lift;
  let roadDist=roadDistance(car.x,car.z);
  let localMaxSpeed=mechGroundMaxSpeed;
  let morphSpeedMultiplier=car.morphProgress>0.65 ? morphedCarSpeedMultiplier : 1;
  let jetMovement=car.jetMode || car.jetProgress>0.65;
  let airborneMovement=car.airborne || !car.onGround;
  let carDisabled=car.health<=0;
  let hoverButtons=input.getGamepadFaceButtons(car.gamepadIndex);
  let keyboardHover=gameMode==="single" && car===playerCar && input.keys[" "];
  let robotHoverMovement=!fuelBlocksMovement
    && !car.jetAutoLandToRobot
    && !jetMovement
    && car.morphProgress<0.35
    && !car.morphed
    && (car.boostCharge || 0)>0
    && (hoverButtons.leftStick || keyboardHover);
  let weightedMechMovement=!jetMovement && !airborneMovement && car.morphProgress<0.4;
  let carGroundMovement=!jetMovement && !airborneMovement && car.morphProgress>0.68;

  if(gameOver || carDisabled){
    car.speed=0;
    car.slipAmount=0;
    car.vy=0;
    car.throttleEase=0;
    car.turnInputEase=0;
    car.turnVelocity=0;
    car.jetBank+=(0-(car.jetBank || 0))*0.18;
  }else{
    let speedAbs=Math.abs(car.speed);
    let speedRatio=clamp(speedAbs/mechGroundMaxSpeed,0,1);
    let forwardMaxSpeed=jetMovement ? jetMaxSpeed : airborneMovement ? mechAirMaxSpeed*morphSpeedMultiplier : localMaxSpeed*morphSpeedMultiplier;

    if(weightedMechMovement){
      let throttleResponse=forward===0 ? 0.08 : 0.055;
      car.throttleEase+=(forward-car.throttleEase)*throttleResponse;
      if(Math.abs(forward)<0.001 && Math.abs(car.throttleEase)<0.015) car.throttleEase=0;

      let targetSpeed=car.throttleEase>=0
        ? car.throttleEase*localMaxSpeed
        : car.throttleEase*localMaxSpeed*0.42;
      let changingDirection=car.speed*targetSpeed<0;
      let accelLimit=targetSpeed===0 ? 0.0034 : targetSpeed>car.speed ? 0.0042 : 0.0078;
      if(changingDirection) accelLimit=0.012;
      accelLimit*=1-speedRatio*0.18;
      car.speed=approach(car.speed,targetSpeed,Math.max(0.0022,accelLimit));
      if(forward===0){
        car.speed*=car.onGround ? 0.985 : 0.992;
        if(Math.abs(car.speed)<0.006) car.speed=0;
      }
    }else{
      car.throttleEase=forward;
      let throttle=forward>0;
      let brakeOrReverse=forward<0;
      let throttlePower=Math.abs(forward);

      if(throttle){
        let airThrust=airborneMovement ? 1.85 : 1;
        car.speed+=0.0052*airThrust*throttlePower*(1-speedRatio*0.35);
      }else if(brakeOrReverse){
        if(jetMovement){
          car.speed=approach(car.speed,0,0.026*throttlePower);
        }else{
          car.speed+=(car.speed>0.03 ? -0.02 : -0.0045)*throttlePower;
        }
      }else{
        if(!jetMovement){
          car.speed*=car.onGround ? 0.965 : 0.985;
          if(Math.abs(car.speed)<0.008) car.speed=0;
        }
      }
    }

    if(fuelBlocksMovement){
      car.throttleEase=0;
      car.speed=approach(car.speed,0,jetMovement ? 0.024 : 0.012);
    }

    car.speed=clamp(car.speed,jetMovement ? 0 : -localMaxSpeed*0.42,forwardMaxSpeed);

    speedAbs=Math.abs(car.speed);
    let movingSteer=clamp(speedAbs/0.34,0,1);
    let reverseSteer=car.speed< -0.04 ? -1 : 1;
    if(weightedMechMovement){
      let highSpeedCalm=1-clamp((speedAbs-0.32)/0.32,0,0.2);
      let turnResponse=turn===0 ? 0.13 : 0.16;
      car.turnInputEase+=(turn-car.turnInputEase)*turnResponse;
      let pivotSteer=0.22*(1-movingSteer);
      let strideSteer=0.52+movingSteer*0.58+pivotSteer;
      let targetTurnVelocity=car.turnInputEase*reverseSteer*0.027*strideSteer*highSpeedCalm;
      car.turnVelocity+=(targetTurnVelocity-car.turnVelocity)*0.12;
      car.turnVelocity*=turn===0 ? 0.86 : 0.985;
      car.turnVelocity=clamp(car.turnVelocity,-0.034,0.034);
      car.angle=normalizeAngle(car.angle+car.turnVelocity);
      car.velAngle+=normalizeAngle(car.angle-car.velAngle)*(0.16+0.1*(1-movingSteer));
    }else{
      car.turnInputEase=turn;
      let highSpeedCalm=1-clamp((speedAbs-0.32)/0.32,0,0.18);
      let robotTurnBoost=1+0.42*(1-smoothStep(car.morphProgress/0.65));
      let steeringResponse=(0.52+movingSteer*0.54)*highSpeedCalm*robotTurnBoost;
      let jetYawScale=jetMovement ? 0.38 : 1;
      let carModeSteering=carGroundMovement && car.morphProgress>0.72;
      let jetModeSteering=jetMovement && !car.jetAutoLandToRobot;
      let driftSpeed=clamp((speedAbs-0.32)/0.82,0,1);
      let driftTurn=Math.min(1,Math.abs(turn));
      let driftAmount=carModeSteering ? smoothStep(driftSpeed)*driftTurn : 0;
      let yawRate=turn*reverseSteer*0.031*steeringResponse*jetYawScale;
      if(carModeSteering){
        yawRate*=1-driftAmount*0.28;
        car.turnVelocity+=(yawRate-car.turnVelocity)*0.24;
        car.turnVelocity*=turn===0 ? 0.84 : 0.975;
        car.turnVelocity=clamp(car.turnVelocity,-0.048,0.048);
        car.angle=normalizeAngle(car.angle+car.turnVelocity);
        let alignRate=0.16-driftAmount*0.125;
        alignRate*=turn===0 ? 1.32 : 1;
        car.velAngle+=normalizeAngle(car.angle-car.velAngle)*clamp(alignRate,0.028,0.22);
        car.slipAmount=clamp(Math.abs(normalizeAngle(car.angle-car.velAngle))*3.05+driftAmount*0.95,0,1.45);
      }else if(jetModeSteering){
        let jetSpeedDrift=smoothStep(clamp((speedAbs-0.32)/1.12,0,1));
        let jetCurveDrift=jetSpeedDrift*Math.min(1,Math.abs(turn));
        yawRate*=1-jetSpeedDrift*0.22;
        car.turnVelocity+=(yawRate-car.turnVelocity)*jetDriftTurnResponse;
        car.turnVelocity*=turn===0 ? 0.82 : 0.992;
        car.turnVelocity=clamp(car.turnVelocity,-0.028,0.028);
        car.angle=normalizeAngle(car.angle+car.turnVelocity);
        let alignRate=jetDriftAlignMax-jetCurveDrift*(jetDriftAlignMax-jetDriftAlignMin);
        alignRate*=turn===0 ? 1.45 : 1;
        car.velAngle+=normalizeAngle(car.angle-car.velAngle)*clamp(alignRate,jetDriftAlignMin,jetDriftAlignMax*1.45);
        car.slipAmount=clamp(Math.abs(normalizeAngle(car.angle-car.velAngle))*jetDriftSlipScale+jetCurveDrift*0.72,0,1.65);
      }else{
        car.turnVelocity=0;
        car.angle=normalizeAngle(car.angle+yawRate);
        car.velAngle=car.angle;
        car.slipAmount=0;
      }
    }

    if(!carGroundMovement && !jetMovement) car.slipAmount=0;
  }

  if(!gameOver && !carDisabled){
    let moveAngle=(weightedMechMovement || carGroundMovement || jetMovement) ? car.velAngle : car.angle;
    car.x+=Math.sin(moveAngle)*car.speed;
    car.z+=Math.cos(moveAngle)*car.speed;
    if(carGroundMovement && Math.abs(car.speed)>0.01){
      let previousSurface=surfaceHeightForActor(car,prevX,prevZ);
      let nextSurface=surfaceHeightForActor(car,car.x,car.z);
      let crestDrop=previousSurface-nextSurface;
      let launchSpeed=clamp((Math.abs(car.speed)-0.72)/1.05,0,1);
      if(launchSpeed>0 && crestDrop>0.18 && car.y<=previousSurface+0.22 && car.vy<=0.04){
        let crestStrength=clamp((crestDrop-0.18)/2.4,0,1)*launchSpeed;
        car.vy=Math.max(car.vy,0.2+crestStrength*0.72);
        car.y=previousSurface+0.08;
        car.onGround=false;
        car.airborne=true;
      }

      let uphillGrade=uphillGradeAlongSegment(prevX,prevZ,car.x,car.z);
      if(uphillGrade>0.014){
        let uphill01=clamp((uphillGrade-0.014)/0.11,0,1);
        let uphillEase=uphill01*uphill01*uphill01;
        let uphillDrag=uphillEase*0.009;
        let uphillMaxSpeed=localMaxSpeed*morphSpeedMultiplier*(1-uphillEase*0.34);
        let speedSign=car.speed<0 ? -1 : 1;
        car.speed*=1-uphillDrag;
        if(Math.abs(car.speed)>uphillMaxSpeed){
          let slowedAbs=approach(Math.abs(car.speed),uphillMaxSpeed,0.003+uphillEase*0.024);
          car.speed=speedSign*slowedAbs;
        }
      }
    }
    let climbProfile=carGroundMovement
      ? mountainClimbProfile(car,prevX,prevZ,car.x,car.z)
      : {blocked:false,slowdown:0};
    if(carGroundMovement && climbProfile.slowdown>0 && car.speed>0){
      let climbEase=climbProfile.slowdown*climbProfile.slowdown;
      let climbDrag=0.018+climbEase*0.052;
      let climbMaxSpeed=localMaxSpeed*morphSpeedMultiplier*(1-climbEase*0.58);
      car.speed*=1-climbDrag;
      if(car.speed>climbMaxSpeed){
        car.speed=approach(car.speed,climbMaxSpeed,0.004+climbEase*0.02);
      }
      car.throttleEase*=1-climbEase*0.08;
    }
    if(climbProfile.blocked && !robotHoverMovement){
      car.x=prevX;
      car.z=prevZ;
      car.speed*=0.52;
      if(Math.abs(car.speed)<0.025) car.speed=0;
      car.vy=Math.min(car.vy,0);
      car.throttleEase=Math.min(0.18,car.throttleEase || 0);
    }
  }

  roadDist=roadDistance(car.x,car.z);
  car.surfaceDistance=roadDist;
  localMaxSpeed=mechGroundMaxSpeed;
  morphSpeedMultiplier=car.morphProgress>0.65 ? morphedCarSpeedMultiplier : 1;
  jetMovement=car.jetMode || car.jetProgress>0.65;
  airborneMovement=car.airborne || !car.onGround;
  car.speed=Math.max(
    jetMovement ? 0 : -localMaxSpeed*0.42,
    Math.min(jetMovement ? jetMaxSpeed : (airborneMovement ? mechAirMaxSpeed : localMaxSpeed)*morphSpeedMultiplier,car.speed)
  );

  let surfaceY=surfaceHeightForActor(car,car.x,car.z);
  let landingSurface=landingSurfaceAt(car.x,car.z);
  let landingPadSurface=landingPadSurfaceAt(car.x,car.z);
  let takeoffInput=!car.jetAutoLandToRobot && ((car.throttleInput || 0)>0.08 || (car.liftInput || 0)>0.08);
  if(takeoffInput && (car.landedOnPad || car.landingReleaseFrames>0)){
    car.landingReleaseFrames=90;
    car.landedOnPad=false;
    car.jetAltitudeTarget=Math.max(car.y,surfaceY+jetHoverGroundClearance);
    car.vy=Math.max(car.vy,0.18);
  }else if((car.landingReleaseFrames || 0)>0){
    car.landingReleaseFrames--;
  }

  let flying=false;
  if(car.jetAutoLandToRobot){
    car.hoverInputActive=false;
  }else{
    flying=updateFlightThrust(car,surfaceY);
  }
  if(flying) emitFlightExhaust(car);
  rechargeHoverBoost(car);
  let jetHovering=car.jetMode || car.jetProgress>0.65;
  let autoLanding=car.jetMode && jetHovering && landingSurface && car.jetProgress>0.82 && !(car.landingReleaseFrames>0);
  let fuelAutoLanding=car.jetMode && jetHovering && fuelEmpty && !autoLanding;
  let manualAutoLanding=car.jetMode && jetHovering && car.jetAutoLandToRobot && !autoLanding && !fuelAutoLanding;
  let robotLandingTransformBurn=!car.jetMode
    && jetHovering
    && (car.jetProgress || 0)>0.08
    && (car.jetLandingTransformLift || 0)>0.08
    && car.morphProgress<0.35;
  if(autoLanding || fuelAutoLanding || manualAutoLanding) announceLandingSequence(car);
  let groundAutoLanded=false;
  let autoLandingApproachY=autoLanding ? landingSurface.y+12 : null;
  let autoLandingDeckY=null;
  let robotLandingBoosterAmount=0;
  let jetAltitudeMax=surfaceY+jetFlightMaxAltitude;
  if(jetHovering && !gameOver && !carDisabled){
    car.speed=clamp(car.speed,0,jetMaxSpeed);
    if(!Number.isFinite(car.jetAltitudeTarget)){
      car.jetAltitudeTarget=Math.max(car.y,surfaceY+jetHoverGroundClearance);
    }
    if(autoLanding){
      let targetX=landingSurface.x;
      let targetZ=landingSurface.z;
      let dx=targetX-car.x;
      let dz=targetZ-car.z;
      let padRadius=Math.max(1,landingSurface.r || 24);
      let touchdownRadius=Math.max(1,landingSurface.padR || 24);
      let distanceToPad=Math.hypot(dx,dz);
      let padCentering=clamp(1-Math.hypot(dx,dz)/padRadius,0,1);
      let pullStrength=0.026+0.07*padCentering;
      let centeredOnPad=distanceToPad<=Math.max(2.8,touchdownRadius*0.16);
      car.x+=dx*pullStrength;
      car.z+=dz*pullStrength;
      car.speed*=0.82+0.08*(1-padCentering);
      autoLandingDeckY=centeredOnPad
        ? landingSurface.y+2.4+(car.jetAutoLandToRobot ? jetLandingMorphClearance : 0)
        : autoLandingApproachY;
      car.jetAltitudeTarget=approach(car.jetAltitudeTarget,autoLandingDeckY,centeredOnPad ? 0.72 : 0.48);
    }else if(manualAutoLanding){
      car.speed=approach(car.speed,0,0.032);
      car.jetAltitudeTarget=approach(car.jetAltitudeTarget,surfaceY+jetLandingMorphClearance,0.62);
    }else if(robotLandingTransformBurn){
      car.speed=approach(car.speed,0,0.05);
      car.jetAltitudeTarget=approach(car.jetAltitudeTarget,surfaceY+0.82,0.72);
    }else if(fuelAutoLanding){
      car.speed=approach(car.speed,0,0.02);
      car.jetAltitudeTarget=approach(car.jetAltitudeTarget,surfaceY+1.1,0.62);
    }else{
      if(!Number.isFinite(car.jetHoverSurfaceY)) car.jetHoverSurfaceY=surfaceY;
      let terrainFollow=surfaceY>car.jetHoverSurfaceY
        ? jetHoverTerrainRiseFollow
        : jetHoverTerrainFallFollow;
      car.jetHoverSurfaceY+=(surfaceY-car.jetHoverSurfaceY)*terrainFollow;
      let smoothedHoverTarget=car.jetHoverSurfaceY+jetHoverGroundClearance;
      let minimumHoverTarget=surfaceY+jetHoverMinimumGroundClearance;
      car.jetAltitudeTarget=clamp(Math.max(smoothedHoverTarget,minimumHoverTarget),waterLevel+5,jetAltitudeMax);
    }
    let hoverTarget=car.jetAltitudeTarget+Math.sin(performance.now()*0.004)*0.22;
    if(autoLanding || fuelAutoLanding || manualAutoLanding || robotLandingTransformBurn) hoverTarget=car.jetAltitudeTarget;
    let lift=(hoverTarget-car.y)*jetHoverSpring-car.vy*jetHoverDamping;
    let maxDescentSpeed=0.82;
    let maxClimbSpeed=0.92;
    if(autoLanding || fuelAutoLanding || manualAutoLanding || robotLandingTransformBurn){
      let landingTargetY=autoLanding && Number.isFinite(autoLandingDeckY)
        ? autoLandingDeckY
        : surfaceY+(manualAutoLanding ? jetLandingMorphClearance : robotLandingTransformBurn ? 0.82 : 1.1);
      let landingClearance=Math.max(0,car.y-landingTargetY);
      let nearGround=1-clamp((landingClearance-1.5)/18,0,1);
      maxDescentSpeed=0.62-nearGround*0.46;
      maxClimbSpeed=0.78;
      let robotLandingBurn=manualAutoLanding || robotLandingTransformBurn || (autoLanding && car.jetAutoLandToRobot);
      if(robotLandingBurn){
        maxClimbSpeed=0;
        robotLandingBoosterAmount=1-clamp(landingClearance/jetLandingBoosterLeadClearance,0,1);
        if(robotLandingBoosterAmount>0){
          maxDescentSpeed=Math.min(
            maxDescentSpeed,
            jetLandingBoosterSoftDescentSpeed+(1-robotLandingBoosterAmount)*0.24
          );
        }
      }
    }
    car.vy=clamp(car.vy+lift,-maxDescentSpeed,maxClimbSpeed);
    if(robotLandingBoosterAmount>0){
      let softDescentSpeed=jetLandingBoosterSoftDescentSpeed+(1-robotLandingBoosterAmount)*0.08;
      car.vy=clamp(car.vy,-softDescentSpeed,0);
      if(car.jetMode) emitRobotLandingBoosters(car,robotLandingBoosterAmount);
    }
    emitJetHoverExhaust(car);
  }

  let robotWaterMovement=!jetHovering && car.morphProgress<0.4;
  let waterDrag=clamp(waterDepthAt(car.x,car.z)/(robotWaterMovement ? 8.2 : 9.5),0,1);
  if(!gameOver && !carDisabled && !jetHovering && waterDrag>0){
    car.speed*=1-(robotWaterMovement ? 0.03 : 0.018)*waterDrag;
  }

  if(car.holeDamageCooldown>0) car.holeDamageCooldown--;
  let groundHole=groundHoleAt(car.x,car.z);
  if(!gameOver && !carDisabled && !jetHovering && groundHole){
    let intensity=clamp(groundHole.intensity || 0,0,1);
    let deep=clamp((intensity-0.28)/0.72,0,1);
    let carMode=car.morphProgress>0.65;
    let throttleEscape=clamp(Math.abs(car.throttleEase || car.throttleInput || 0),0,1);
    let holeDrag=carMode ? 0.006+0.016*deep : 0.014+0.036*deep;
    holeDrag*=1-throttleEscape*(carMode ? 0.72 : 0.42);
    car.speed*=1-holeDrag*deep;
    if(carMode && throttleEscape>0.12 && Math.abs(car.speed)<0.22){
      let escapeSpeed=0.018*throttleEscape*(1-deep*0.35);
      car.speed+=Math.sign(car.throttleEase || car.throttleInput || 1)*escapeSpeed;
    }
    car.vy-=carMode ? 0.0015*deep : 0.004*deep;

    if(carMode && deep>0.42 && car.y<=surfaceY+1.4 && Math.abs(car.speed)>0.08 && car.holeDamageCooldown<=0){
      damageCar(car,1+Math.floor(deep*2),{x:car.x,y:car.y,z:car.z});
      rattleActor(car,0.28+deep*0.34);
      car.holeDamageCooldown=54;
    }
  }

  if(!gameOver && !carDisabled) car.vy-=flying ? gravityStrength*0.22 : jetHovering ? 0 : gravityStrength;
  let robotLandingPostHoverBurn=!jetHovering
    && !car.jetMode
    && (car.jetProgress || 0)>0.08
    && (car.jetLandingTransformLift || 0)>0.08
    && car.morphProgress<0.35
    && car.y>surfaceY+0.24;
  if(!gameOver && !carDisabled && robotLandingPostHoverBurn){
    car.vy=clamp(car.vy,-jetLandingBoosterSoftDescentSpeed,0);
  }
  let landingVy=car.vy;
  car.y+=car.vy;
  if(flying && !jetHovering){
    let robotBoostCeiling=surfaceY+robotBoostFlightMaxAltitude;
    if(car.y>robotBoostCeiling){
      car.y=robotBoostCeiling;
      car.vy=Math.min(car.vy,0);
    }
  }else if(jetHovering && !autoLanding && !fuelAutoLanding && !manualAutoLanding){
    let jetCeiling=surfaceY+jetFlightMaxAltitude;
    if(car.y>jetCeiling){
      car.y=jetCeiling;
      car.vy=Math.min(car.vy,0);
      car.jetAltitudeTarget=Math.min(car.jetAltitudeTarget || jetCeiling,jetCeiling);
    }
  }

  if(!gameOver && !carDisabled && jetHovering && !autoLanding && !fuelAutoLanding && !manualAutoLanding){
    let terrainCollision=terrainCollisionAlongSegment(prevX,prevY,prevZ,car.x,car.y,car.z,1.15);
    if(terrainCollision.hit){
      car.x=terrainCollision.safeX;
      car.z=terrainCollision.safeZ;
      surfaceY=surfaceHeightForActor(car,car.x,car.z);
      car.y=Math.max(terrainCollision.safeY,surfaceY+1.15);
      car.vy=Math.max(0.12,-car.vy*0.25);
      car.speed*=0.18;
      car.jetHoverSurfaceY=surfaceY;
      car.jetAltitudeTarget=Math.max(car.jetAltitudeTarget || 0,car.y+jetHoverGroundClearance,surfaceY+jetHoverGroundClearance);
      damageCar(car,4);
      rattleActor(car,0.8);
    }
  }

  if(!gameOver && !carDisabled && manualAutoLanding && car.y<=surfaceY+jetLandingMorphClearance+0.12){
    car.y=Math.min(car.y,surfaceY+jetLandingMorphClearance);
    car.renderY=car.y;
    beginJetLandingTransform(car,surfaceY);
    car.vy=-0.035;
    car.speed=0;
    car.jetMode=false;
    car.jetHoverSurfaceY=surfaceY;
    car.jetAltitudeTarget=surfaceY+jetHoverGroundClearance;
    car.landingReleaseFrames=0;
    car.landedOnPad=false;
    car.landingSequenceVoicePlayed=false;
    car.morphed=false;
    car.jetAutoLandToRobot=false;
  }else if(!gameOver && !carDisabled && fuelAutoLanding && car.y<=surfaceY+1.12){
    car.y=surfaceY;
    car.renderY=car.y;
    car.jetLandingTransformLift=0;
    car.jetLandingTransformStartLift=0;
    car.vy=0;
    car.speed=0;
    car.jetMode=false;
    car.jetHoverSurfaceY=surfaceY;
    car.jetAltitudeTarget=surfaceY+jetHoverGroundClearance;
    car.landingReleaseFrames=0;
    car.landedOnPad=false;
    car.landingSequenceVoicePlayed=false;
    groundAutoLanded=true;
  }

  if(!gameOver && !carDisabled && autoLanding){
    landingPadSurface=landingPadSurfaceAt(car.x,car.z);
    let landingDeckY=landingPadSurface ? landingPadSurface.y+2.4 : null;
    surfaceY=surfaceHeightForActor(car,car.x,car.z);
    if(!landingPadSurface && Number.isFinite(autoLandingApproachY) && car.y<autoLandingApproachY){
      car.y=autoLandingApproachY;
      car.vy=0;
      car.jetAltitudeTarget=autoLandingApproachY;
    }
    let deckTransitionY=Number.isFinite(landingDeckY)
      ? landingDeckY+(car.jetAutoLandToRobot ? jetLandingMorphClearance : 0)
      : null;
    if(Number.isFinite(deckTransitionY) && car.y<=deckTransitionY+0.08){
      car.x=landingPadSurface.x;
      car.z=landingPadSurface.z;
      car.y=car.jetAutoLandToRobot ? Math.min(car.y,deckTransitionY) : deckTransitionY;
      car.renderY=car.y;
      if(car.jetAutoLandToRobot) beginJetLandingTransform(car,landingDeckY);
      else{
        car.jetLandingTransformLift=0;
        car.jetLandingTransformStartLift=0;
      }
      car.vy=car.jetAutoLandToRobot ? -0.035 : 0;
      car.speed*=0.82;
      car.jetHoverSurfaceY=surfaceY;
      car.jetAltitudeTarget=deckTransitionY;
      car.landedOnPad=!car.jetAutoLandToRobot;
      car.landingSequenceVoicePlayed=false;
      if(car.jetAutoLandToRobot){
        car.jetMode=false;
        car.morphed=false;
        car.jetAutoLandToRobot=false;
        car.landingReleaseFrames=0;
      }
    }
    if(Number.isFinite(landingDeckY) && car.y<=landingDeckY+0.18){
      surfaceY=landingDeckY;
    }
  }

  if(!jetHovering && car.y<surfaceY){
    if(!gameOver && landingVy<-0.9){
      let landingDamage=landingDamageAmount(car,car.x,car.z,-landingVy);
      if(landingDamage>0) damageCar(car,landingDamage);
    }
    car.y=surfaceY;
    car.vy=0;
  }

  let collision=movementCollision(car,prevX,prevZ,car.x,car.z);
  if(!gameOver && !carDisabled && !jetHovering && collision.hit){
    car.x=collision.safeX;
    car.z=collision.safeZ;
    car.y=prevY;
    car.speed=0;
    if(collision.otherCar){
      car.angle+=Math.PI*0.12;
      car.velAngle=car.angle;
    }
    if(collision.damagesPlayer) damageCar(car,collision.otherCar ? 1 : 3);
    surfaceY=surfaceHeightForActor(car,car.x,car.z);
    if(car.y<surfaceY) car.y=surfaceY;
  }

  let waterDepth=waterDepthAt(car.x,car.z);
  let inWater=!jetHovering && waterDepth>0.15 && car.y<=waterLevel+1.1;
  let emitSplash=!jetHovering && !carDisabled && inWater && car.y<=waterLevel+1.1 && Math.abs(car.speed)>0.08;
  car.onGround=(!jetHovering || autoLanding || groundAutoLanded) && car.y<=surfaceY+0.18;
  updateFuelForCar(car,jetHovering && !groundAutoLanded);
  if(car.onGround){
    let refuelSurface=landingPadSurfaceAt(car.x,car.z);
    if(refuelSurface && car.y<=refuelSurface.y+2.72) car.fuel=maxFuel;
  }
  let wheelTrackReady=!jetHovering && !car.jetMode && car.jetProgress<0.35;
  if(wheelTrackReady) wheelTracks.addCarTracks(car,surfaceY,inWater);
  else if(wheelTracks.resetCarTracks) wheelTracks.resetCarTracks(car);
  if(!jetHovering) emitBuggyGroundDust(car,surfaceY);
  if(emitSplash){
    let speedAbs=Math.abs(car.speed);
    let splashAmount=Math.ceil(speedAbs*18);
    for(let i=0;i<splashAmount;i++){
      let side=(i%2===0 ? -1 : 1);
      let spread=(Math.random()-.5)*0.55;
      let rear=1.15+Math.random()*1.3;
      let lateral=side*(0.75+Math.random()*0.55)+spread;
      let offsetX=car.x-Math.sin(car.velAngle)*rear+Math.cos(car.velAngle)*lateral;
      let offsetZ=car.z-Math.cos(car.velAngle)*rear-Math.sin(car.velAngle)*lateral;
      let wakePush=Math.max(0.22,speedAbs)*2.7;
      let sideSpray=side*(0.7+Math.random()*1.2)*speedAbs;

      dust.spawnSplashParticle(
        offsetX,
        waterLevel+0.08+Math.random()*0.12,
        offsetZ,
        -Math.sin(car.velAngle)*wakePush+Math.cos(car.velAngle)*sideSpray+(Math.random()-.5)*0.5,
        -Math.cos(car.velAngle)*wakePush-Math.sin(car.velAngle)*sideSpray+(Math.random()-.5)*0.5,
        3.2+Math.random()*3.8+speedAbs*0.9,
        0.2+Math.random()*0.16,
        0.035+Math.random()*0.055
      );
    }
  }

  let airborne=car.y>surfaceY+0.35;
  if(autoLanding && car.y<=surfaceY+0.18) airborne=false;
  car.airborne=airborne;
  updateAirTricks(car,airborne);
  car.speedDelta=car.speed-previousSpeed;

  let pitchSampleDist=2.2;
  let frontX=car.x+Math.sin(car.angle)*pitchSampleDist;
  let frontZ=car.z+Math.cos(car.angle)*pitchSampleDist;
  let backX=car.x-Math.sin(car.angle)*pitchSampleDist;
  let backZ=car.z-Math.cos(car.angle)*pitchSampleDist;
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);
  let frontY=surfaceHeightForActor(car,frontX,frontZ);
  let backY=surfaceHeightForActor(car,backX,backZ);
  let sideSampleDist=car.morphProgress>0.65 ? 2.65 : 2.25;
  let leftY=surfaceHeightForActor(car,car.x-rightX*sideSampleDist,car.z-rightZ*sideSampleDist);
  let rightY=surfaceHeightForActor(car,car.x+rightX*sideSampleDist,car.z+rightZ*sideSampleDist);
  let jetPitch=clamp(-Math.max(0,car.speed)*0.018,-0.18,0.08);
  let robotHoverPitch=clamp(-Math.max(0,car.speed)*0.035-car.vy*0.08,-0.16,0.12);
  let targetPitch=jetHovering ? jetPitch : flying ? robotHoverPitch : -Math.atan2(frontY-backY,pitchSampleDist*2);
  car.pitch+=(targetPitch-car.pitch)*(flying ? 0.095 : 0.18);
  let carModeTilt=car.morphProgress>0.65 && car.jetProgress<0.35;
  let robotModeTilt=car.morphProgress<0.35 && car.jetProgress<0.35;
  let slopeRollTarget=(!jetHovering && !airborne && !flying)
    ? clamp(Math.atan2(rightY-leftY,sideSampleDist*2)*(carModeTilt ? 1.05 : robotModeTilt ? 0.42 : 0.72),-0.34,0.34)
    : 0;
  if(!Number.isFinite(car.surfaceRoll)) car.surfaceRoll=0;
  car.surfaceRoll+=(slopeRollTarget-car.surfaceRoll)*(carModeTilt ? 0.18 : 0.12);
  let jetBankTarget=0;
  car.jetBank+=(jetBankTarget-(car.jetBank || 0))*(jetHovering ? 0.28 : 0.18);
  if(jetHovering && Math.abs(car.jetBank)<0.002) car.jetBank=0;

  let renderY=car.y+updateJetLandingTransformLift(car);
  car.renderY=renderY;
  car.group.position.set(car.x,renderY,car.z);
  car.group.rotation.y=car.angle+car.trickYaw;
  car.group.rotation.x=car.pitch+car.trickPitch;
  car.group.rotation.z=car.trickRoll+(car.jetBank || 0)+(car.surfaceRoll || 0);
  updateMechAnimation(car);
  updateMorphVisual(car);
  updatePlayerLaserInput(car);
  updateCannonInput(car);
  if(car.hitRattle>0){
    let shake=car.hitRattle;
    let t=performance.now()*0.04+car.hitRattleSeed;
    car.group.rotation.x+=Math.sin(t*1.7)*0.08*shake;
    car.group.rotation.z+=Math.cos(t*2.1)*0.11*shake;
    car.group.position.x+=Math.sin(t*2.6)*0.18*shake;
    car.group.position.y+=Math.abs(Math.sin(t*3.1))*0.16*shake;
    car.group.position.z+=Math.cos(t*2.3)*0.18*shake;
    car.hitRattle=Math.max(0,car.hitRattle-0.055);
  }
  car.shadow.update({carX:car.x,carZ:car.z,carY:car.y,surfaceY,carVelAngle:car.angle});
}

function cameraPitchTargetFromAim(car){
  let canPitchToAim=car.aimCross
    && car.health>0
    && car.group.visible
    && car.jetProgress<0.35
    && car.morphProgress<0.72
    && (car.hasMouseAimPoint || car.hasGamepadAimPoint);

  if(!canPitchToAim) return 0;

  if(gameMode==="single" && car===playerCar && car.hasMouseAimPoint && input.mouse.hasPosition){
    let normalized=((innerHeight*0.5)-input.mouse.y)/Math.max(1,innerHeight*0.5);
    let deadZone=0.12;
    let amount=Math.max(0,(Math.abs(normalized)-deadZone)/(1-deadZone));
    return normalized>0 ? amount*cameraAimPitchMax : -amount*Math.abs(cameraAimPitchMin);
  }

  return clamp((car.controllerAimOffsetY || 0)*0.42,cameraAimPitchMin,cameraAimPitchMax);
}

function firstPersonPitchTargetForCar(car){
  if(gameMode==="single" && car===playerCar && input.mouse.hasPosition){
    let normalized=((innerHeight*0.5)-input.mouse.y)/Math.max(1,innerHeight*0.5);
    let deadZone=0.08;
    let amount=Math.max(0,(Math.abs(normalized)-deadZone)/(1-deadZone));
    return normalized>0 ? amount*cameraAimPitchMax : -amount*Math.abs(cameraAimPitchMin);
  }

  return clamp((car.controllerAimOffsetY || 0)*0.42,cameraAimPitchMin,cameraAimPitchMax);
}

function firstPersonYawTargetForCar(car){
  if(gameMode==="single" && car===playerCar && input.mouse.hasPosition){
    let normalized=(input.mouse.x-(innerWidth*0.5))/Math.max(1,innerWidth*0.5);
    let deadZone=0.08;
    let amount=Math.max(0,(Math.abs(normalized)-deadZone)/(1-deadZone));
    return normalized>0 ? amount*0.62 : -amount*0.62;
  }

  return clamp((car.controllerAimOffsetX || 0)*0.052,-0.58,0.58);
}

function updateFirstPersonYawOffset(car,targetYawOffset){
  if(!Number.isFinite(car.firstPersonYawOffset)) car.firstPersonYawOffset=0;
  car.firstPersonYawOffset+=(targetYawOffset-car.firstPersonYawOffset)*0.07;
  return car.firstPersonYawOffset;
}

function updateCameraPitchOffset(car,targetPitchOffset){
  if(!Number.isFinite(car.cameraPitchOffset)) car.cameraPitchOffset=0;
  car.cameraPitchOffset+=(targetPitchOffset-car.cameraPitchOffset)*0.035;
  return car.cameraPitchOffset;
}

function updateRobotHeadLookYaw(car,robotAmount=1){
  let aiming=car && car.health>0 && car.group && car.group.visible
    && (car.hasMouseAimPoint || car.hasGamepadAimPoint);
  let target=0;
  if(aiming){
    let aimDistance=Math.max(8,car.aimDistance || 32);
    let aimYaw=Math.atan2(car.aimOffsetX || 0,aimDistance);
    target=clamp(aimYaw,-0.56,0.56)*clamp(robotAmount,0,1);
  }
  if(!Number.isFinite(car.headLookYaw)) car.headLookYaw=0;
  car.headLookYaw+=(target-car.headLookYaw)*0.09;
  return car.headLookYaw;
}

function updateCameraForCar(car){
  let cameraYawDelta=normalizeAngle(car.velAngle-car.cameraYaw);
  let activeTurn=Math.abs(car.turnInputEase || 0)>0.08 || Math.abs(car.turnVelocity || 0)>0.004;
  let jetCameraMode=car.jetMode || car.jetProgress>0.45;
  let cameraYawFollow=activeTurn
    ? cameraYawTurnFollowRate
    : jetCameraMode
    ? jetCameraYawRecenterFollowRate
    : cameraYawRecenterFollowRate;
  car.cameraYaw+=cameraYawDelta*cameraYawFollow;
  let cameraBaseY=Number.isFinite(car.renderY) ? car.renderY : car.y;

  if(firstPersonViewActive()){
    car.cameraYaw+=normalizeAngle(car.angle-car.cameraYaw)*0.28;
    let morphBlend=smoothStep(clamp((car.morphProgress-0.12)/0.78,0,1));
    let jetBlend=smoothStep(clamp((car.jetProgress-0.35)/0.38,0,1));
    let robotViewAmount=(1-morphBlend)*(1-jetBlend);
    let robotMode=robotViewAmount>0.42;
    let jetMode=jetBlend>0.5;
    let cockpitLookYaw=updateFirstPersonYawOffset(car,firstPersonYawTargetForCar(car));
    let viewYaw=car.cameraYaw+(car.headLookYaw || 0)*robotViewAmount*0.64-cockpitLookYaw*jetBlend*0.86;
    let positionYaw=jetMode ? car.cameraYaw : viewYaw;
    let forwardX=Math.sin(positionYaw);
    let forwardZ=Math.cos(positionYaw);
    let rightX=Math.cos(positionYaw);
    let rightZ=-Math.sin(positionYaw);
    let lookForwardX=Math.sin(viewYaw);
    let lookForwardZ=Math.cos(viewYaw);
    let desiredNear=0.1+0.22*robotViewAmount;
    if(Math.abs(car.camera.near-desiredNear)>0.001){
      car.camera.near=desiredNear;
      car.camera.updateProjectionMatrix();
    }
    let groundEyeHeight=5.16+(2.65-5.16)*morphBlend;
    let groundForwardOffset=2.35+(2.05-2.35)*morphBlend;
    let targetEyeHeight=groundEyeHeight+(2.2-groundEyeHeight)*jetBlend;
    let targetForwardOffset=groundForwardOffset+(8.6-groundForwardOffset)*jetBlend;
    if(!Number.isFinite(car.firstPersonEyeHeight)) car.firstPersonEyeHeight=targetEyeHeight;
    if(!Number.isFinite(car.firstPersonForwardOffset)) car.firstPersonForwardOffset=targetForwardOffset;
    car.firstPersonEyeHeight+=(targetEyeHeight-car.firstPersonEyeHeight)*0.13;
    car.firstPersonForwardOffset+=(targetForwardOffset-car.firstPersonForwardOffset)*0.13;
    let eyeHeight=car.firstPersonEyeHeight;
    let forwardOffset=car.firstPersonForwardOffset;
    let sideOffset=gameMode==="double" ? (car===playerCar ? -0.24 : 0.24) : 0;
    let camX=car.x+forwardX*forwardOffset+rightX*sideOffset+rightX*screenShakeOffset.x*0.32;
    let camZ=car.z+forwardZ*forwardOffset+rightZ*sideOffset+rightZ*screenShakeOffset.x*0.32;
    let camY=cameraBaseY+eyeHeight+screenShakeOffset.y*0.35;
    let walkingFirstPerson=robotMode && car.onGround && car.health>0 && Math.abs(car.speed || 0)>0.018;
    let targetWalkMotion=walkingFirstPerson ? clamp(Math.abs(car.speed || 0)/Math.max(0.001,mechGroundMaxSpeed),0,1)*robotViewAmount : 0;
    if(!Number.isFinite(car.firstPersonWalkMotion)) car.firstPersonWalkMotion=0;
    car.firstPersonWalkMotion+=(targetWalkMotion-car.firstPersonWalkMotion)*0.07;
    let walkMotion=car.firstPersonWalkMotion;
    let walkPhase=(car.walkCycle || 0)*0.62;
    if(robotMode && walkMotion>0.001){
      let step=Math.sin(walkPhase);
      let doubleStep=Math.sin(walkPhase*2);
      let sideBob=step*0.028*walkMotion;
      let verticalBob=(Math.abs(step)-0.5)*0.052*walkMotion+doubleStep*0.007*walkMotion;
      let forwardBob=Math.cos(walkPhase*2)*0.015*walkMotion;
      camX+=rightX*sideBob+forwardX*forwardBob;
      camZ+=rightZ*sideBob+forwardZ*forwardBob;
      camY+=verticalBob;
    }
    camY=Math.max(camY,cameraClearanceSurfaceHeightForCar(car,camX,camZ)+1.6);

    let lookAhead=36;
    let lookPitch=updateCameraPitchOffset(car,firstPersonPitchTargetForCar(car));
    let groundVehicleViewAmount=morphBlend*(1-jetBlend);
    let vehiclePitchLiftTarget=-(car.pitch || 0)*18*groundVehicleViewAmount;
    if(!Number.isFinite(car.firstPersonVehiclePitchLift)) car.firstPersonVehiclePitchLift=vehiclePitchLiftTarget;
    car.firstPersonVehiclePitchLift+=(vehiclePitchLiftTarget-car.firstPersonVehiclePitchLift)*0.1;
    let pitchLift=jetMode
      ? clamp(-(car.pitch || 0)*18-(car.jetBank || 0)*2+lookPitch*1.15,-11,11)
      : clamp(car.firstPersonVehiclePitchLift+lookPitch*1.15, -9, 10);
    if(robotMode && walkMotion>0.001){
      pitchLift+=Math.sin(walkPhase*2)*0.085*walkMotion;
    }
    car.camera.position.set(camX,camY,camZ);
    car.camera.lookAt(
      camX+lookForwardX*lookAhead,
      camY+1.2+pitchLift,
      camZ+lookForwardZ*lookAhead
    );
    let groundVehicleRollTarget=(car.surfaceRoll || 0)*groundVehicleViewAmount;
    if(!Number.isFinite(car.firstPersonVehicleRoll)) car.firstPersonVehicleRoll=groundVehicleRollTarget;
    car.firstPersonVehicleRoll+=(groundVehicleRollTarget-car.firstPersonVehicleRoll)*0.1;
    let groundVehicleRoll=car.firstPersonVehicleRoll;
    if(Math.abs(groundVehicleRoll)>0.0001){
      car.camera.rotateZ(-groundVehicleRoll);
    }
    if(jetMode){
      car.camera.rotateZ(-(car.jetBank || 0)*0.72);
    }
    if(robotMode && walkMotion>0.001){
      car.camera.rotateZ(Math.sin(walkPhase)*0.007*walkMotion);
    }
    return;
  }

  car.firstPersonEyeHeight=NaN;
  car.firstPersonForwardOffset=NaN;
  car.firstPersonWalkMotion=0;
  car.firstPersonYawOffset=0;
  car.firstPersonVehiclePitchLift=NaN;
  car.firstPersonVehicleRoll=NaN;
  if(Math.abs(car.camera.near-0.1)>0.001){
    car.camera.near=0.1;
    car.camera.updateProjectionMatrix();
  }

  let downhillAmount=0;
  let groundMovement=Math.abs(car.speed || 0)>0.035 && car.jetProgress<0.45;
  if(groundMovement){
    let direction=car.speed>=0 ? car.velAngle : car.velAngle+Math.PI;
    let sampleDist=cameraDownhillSampleDistance;
    let aheadX=car.x+Math.sin(direction)*sampleDist;
    let aheadZ=car.z+Math.cos(direction)*sampleDist;
    let behindX=car.x-Math.sin(direction)*sampleDist;
    let behindZ=car.z-Math.cos(direction)*sampleDist;
    let aheadY=surfaceHeightForActor(car,aheadX,aheadZ);
    let behindY=surfaceHeightForActor(car,behindX,behindZ);
    let downhillGrade=(behindY-aheadY)/(sampleDist*2);
    downhillAmount=clamp((downhillGrade-0.045)/0.18,0,1);
  }

  if(!Number.isFinite(car.cameraDownhillAmount)) car.cameraDownhillAmount=0;
  let downhillFollow=downhillAmount>car.cameraDownhillAmount ? 0.08 : 0.045;
  car.cameraDownhillAmount+=(downhillAmount-car.cameraDownhillAmount)*downhillFollow;

  let camDist=cameraFollowDistance-cameraDownhillPullIn*car.cameraDownhillAmount;
  let camHeight=cameraFollowHeight+cameraDownhillExtraHeight*car.cameraDownhillAmount;
  let camX=car.x-Math.sin(car.cameraYaw)*camDist;
  let camZ=car.z-Math.cos(car.cameraYaw)*camDist;
  let targetCamY=cameraBaseY+camHeight;
  let carMode=car.morphProgress>0.72 && car.jetProgress<0.35;
  if(!Number.isFinite(car.cameraY) || !carMode){
    car.cameraY=targetCamY;
  }else{
    let cameraYFollow=targetCamY<car.cameraY ? 0.3 : 0.14;
    car.cameraY+=(targetCamY-car.cameraY)*cameraYFollow;
  }
  let camY=car.cameraY;
  let lookAhead=16;
  let rightX=Math.cos(car.cameraYaw);
  let rightZ=-Math.sin(car.cameraYaw);

  camX+=rightX*screenShakeOffset.x;
  camY+=screenShakeOffset.y;
  camZ+=rightZ*screenShakeOffset.x;
  camY=Math.max(camY,drivingSurfaceHeight(camX,camZ)+cameraTerrainClearance);

  let lookX=car.x+Math.sin(car.cameraYaw)*lookAhead;
  let lookY=cameraBaseY+3.8;
  let lookZ=car.z+Math.cos(car.cameraYaw)*lookAhead;
  lookY+=updateCameraPitchOffset(car,cameraPitchTargetFromAim(car));

  if(!Number.isFinite(car.cameraLookY)){
    car.cameraLookY=lookY;
  }else{
    let verticalDelta=lookY-car.cameraLookY;
    let lookFollow=verticalDelta<0 ? 0.34 : 0.075;
    car.cameraLookY+=verticalDelta*lookFollow;
  }

  car.camera.position.set(camX,camY,camZ);
  car.camera.lookAt(
    lookX,
    car.cameraLookY,
    lookZ
  );
}

function updateCameras(){
  updateScreenShakeFrame();
  updateCameraForCar(playerCar);
  if(gameMode==="double") updateCameraForCar(secondCar);
  applyStartSequenceCameraForCar(playerCar);
  if(gameMode==="double") applyStartSequenceCameraForCar(secondCar);
  if(terraformFinale && terraformFinale.active && !startSequence){
    applyTerraformFinaleCameraForCar(playerCar,1);
    if(gameMode==="double") applyTerraformFinaleCameraForCar(secondCar,-1);
  }

  if(gameMode==="single"){
    px=playerCar.x;
    py=playerCar.y+cameraFollowHeight;
    pz=playerCar.z;
  }else{
    px=(playerCar.x+secondCar.x)*0.5;
    py=(playerCar.y+secondCar.y)*0.5+cameraFollowHeight;
    pz=(playerCar.z+secondCar.z)*0.5;
  }

  let moonDistance=92000;
  distantMoon.position.set(
    px+distantMoonDirection.x*moonDistance,
    py+distantMoonDirection.y*moonDistance,
    pz+distantMoonDirection.z*moonDistance
  );
  distantPlanetHaze.position.copy(distantMoon.position);
  distantPlanetLight.position.copy(distantMoon.position);
  distantPlanetVeil.position.copy(distantMoon.position);
}

function setDistantMoonDirectionForHeading(heading){
  if(!Number.isFinite(heading)) return;

  let moonAngle=heading+0.42;
  distantMoonDirection.set(
    Math.sin(moonAngle)*0.995,
    0.0168,
    Math.cos(moonAngle)*0.995
  ).normalize();
}

function aimCrossVisibleFor(car){
  let groundWeaponMode=car.morphProgress<0.35 || car.morphProgress>0.72;
  let jetWeaponMode=car.jetMode || car.jetProgress>0.35;
  return car.aimCross && (groundWeaponMode || jetWeaponMode) && car.health>0 && !gameOver && car.group.visible;
}

function setAimCrossForRender(focusedCar){
  for(let car of cars){
    if(!car.aimCross) continue;
    car.aimCross.visible=car===focusedCar && aimCrossVisibleFor(car);
  }
}

function positionSkyForCamera(camera){
  if(!skyDome || !camera) return;
  skyDome.position.copy(camera.position);
}

function renderSkyViewport(camera,x,y,width,height){
  if(!camera) return;
  positionSkyForCamera(camera);
  camera.layers.set(skyRenderLayer);
  skyRenderer.setViewport(x,y,width,height);
  skyRenderer.setScissor(x,y,width,height);
  skyRenderer.render(scene,camera);
}

function renderWorldViewport(camera,x,y,width,height){
  if(!camera) return;
  camera.layers.set(worldRenderLayer);
  renderer.setViewport(x,y,width,height);
  renderer.setScissor(x,y,width,height);
  renderer.render(scene,camera);
}

function renderLayeredViewport(camera,x,y,width,height){
  renderSkyViewport(camera,x,y,width,height);
  renderWorldViewport(camera,x,y,width,height);
}

function renderGame(){
  let width=rendererViewportWidth();
  let height=rendererViewportHeight();

  if(terraformFinale && terraformFinale.active){
    setAimCrossForRender(null);
    renderLayeredViewport(playerCamera,0,0,width,height);
    return;
  }

  if(gameMode==="single"){
    setAimCrossForRender(playerCar);
    renderLayeredViewport(playerCamera,0,0,width,height);
    setAimCrossForRender(null);
    return;
  }

  let halfWidth=Math.floor(width*0.5);

  let leftCar=displayCars()[0];
  let rightCar=displayCars()[1];

  setAimCrossForRender(leftCar);
  renderLayeredViewport(leftCar.camera,0,0,halfWidth,height);

  setAimCrossForRender(rightCar);
  renderLayeredViewport(rightCar.camera,halfWidth,0,width-halfWidth,height);
  setAimCrossForRender(null);
}

function clearTerraformFinale(){
  pendingBossFinale=null;
  if(!terraformFinale) return;
  if(terraformFinale.group){
    scene.remove(terraformFinale.group);
    terraformFinale.group.traverse(child=>{
      if(child && child.isInstancedMesh) child.dispose();
      if(child && child.geometry && child.userData.disposeGeometry) child.geometry.dispose();
      if(child && child.material && child.userData.disposeMaterial) child.material.dispose();
    });
  }
  document.body.classList.remove("terraform-finale");
  if(terraformFadeOverlay) terraformFadeOverlay.style.opacity="0";
  if(terraformCompleteText) terraformCompleteText.style.opacity="0";
  if(world && world.setTerraformBloomAmount) world.setTerraformBloomAmount(0);
  terraformFinale=null;
}

function makeTerraformEntries(centerX,centerZ,count,minRadius,maxRadius,seed,options={}){
  let entries=[];
  let attempts=0;
  let maxAttempts=count*8;
  while(entries.length<count && attempts<maxAttempts){
    let i=attempts++;
    let angle=hash01(seed+i*3.17,centerX*0.01-centerZ*0.02)*Math.PI*2;
    let radius=minRadius+Math.pow(hash01(seed-i*5.31,centerZ*0.013+i),0.62)*(maxRadius-minRadius);
    let x=centerX+Math.sin(angle)*radius;
    let z=centerZ+Math.cos(angle)*radius;
    let y=drivingSurfaceHeight(x,z);
    if(y<waterLevel+1.8 || roadDistance(x,z)<(options.roadClearance || 42)) continue;
    entries.push({
      x,
      y,
      z,
      yaw:hash01(seed+i*9.1,centerX-centerZ)*Math.PI*2,
      finalScale:(options.minScale || 1)+(options.maxScale || 1)*hash01(seed-i*11.7,centerX+z),
      delay:Math.floor((radius/maxRadius)*(options.spreadFrames || 520)+hash01(seed+i*13.2,z)*70),
      growFrames:options.growFrames || 110,
      sway:0.75+hash01(seed+i*17.9,x-z)*0.5
    });
  }
  return entries;
}

function setTerraformInstance(mesh,index,entry,progress,kind){
  let grow=smoothStep(progress);
  let minGrow=0.001;
  let scale=Math.max(minGrow,grow)*entry.finalScale;
  terraformMatrixDummy.rotation.set(0,entry.yaw,0);

  if(kind==="treeTrunk"){
    let height=3.4*scale;
    terraformMatrixDummy.position.set(entry.x,entry.y+height*0.5,entry.z);
    terraformMatrixDummy.scale.set(0.9*scale,height,0.9*scale);
  }else if(kind==="treeCrown"){
    let trunkHeight=3.4*entry.finalScale*Math.max(minGrow,grow);
    terraformMatrixDummy.position.set(entry.x,entry.y+trunkHeight+1.1*scale,entry.z);
    terraformMatrixDummy.scale.set(1.25*scale,1.05*scale,1.25*scale);
  }else if(kind==="coniferTrunk"){
    let height=4.1*scale;
    terraformMatrixDummy.position.set(entry.x,entry.y+height*0.5,entry.z);
    terraformMatrixDummy.scale.set(0.72*scale,height,0.72*scale);
  }else if(kind==="coniferCrown"){
    let trunkHeight=2.15*entry.finalScale*Math.max(minGrow,grow);
    let tier=entry.tier || 0;
    let tierScale=1-tier*0.15;
    terraformMatrixDummy.position.set(entry.x,entry.y+trunkHeight+(0.95+tier*0.72)*scale,entry.z);
    terraformMatrixDummy.scale.set(1.22*scale*tierScale,0.72*scale,1.08*scale*tierScale);
  }else if(kind==="broadTreeTrunk"){
    let height=2.8*scale;
    terraformMatrixDummy.position.set(entry.x,entry.y+height*0.5,entry.z);
    terraformMatrixDummy.scale.set(1.05*scale,height,1.05*scale);
  }else if(kind==="broadTreeCrown"){
    let trunkHeight=2.8*entry.finalScale*Math.max(minGrow,grow);
    terraformMatrixDummy.position.set(entry.x,entry.y+trunkHeight+0.85*scale,entry.z);
    terraformMatrixDummy.scale.set(2.15*scale,0.78*scale,1.85*scale);
  }else if(kind==="columnTreeTrunk"){
    let height=5.2*scale;
    terraformMatrixDummy.position.set(entry.x,entry.y+height*0.5,entry.z);
    terraformMatrixDummy.scale.set(0.58*scale,height,0.58*scale);
  }else if(kind==="columnTreeCrown"){
    let trunkHeight=3.7*entry.finalScale*Math.max(minGrow,grow);
    terraformMatrixDummy.position.set(entry.x,entry.y+trunkHeight+1.55*scale,entry.z);
    terraformMatrixDummy.scale.set(0.72*scale,1.72*scale,0.72*scale);
  }else if(kind==="bush"){
    terraformMatrixDummy.position.set(entry.x,entry.y+0.55*scale,entry.z);
    terraformMatrixDummy.scale.set(1.35*scale,0.78*scale,1.12*scale);
  }else if(kind==="fern"){
    let lean=Math.sin(entry.yaw*2.1)*0.18;
    let height=1.35*scale;
    terraformMatrixDummy.rotation.set(lean,entry.yaw,-lean*0.6);
    terraformMatrixDummy.position.set(entry.x,entry.y+height*0.48,entry.z);
    terraformMatrixDummy.scale.set(0.54*scale,height,0.32*scale);
  }else if(kind==="flowerStem"){
    let height=1.55*scale;
    terraformMatrixDummy.position.set(entry.x,entry.y+height*0.5,entry.z);
    terraformMatrixDummy.scale.set(1.0*scale,height,1.0*scale);
  }else if(kind==="flowerHead"){
    let stemHeight=1.55*entry.finalScale*Math.max(minGrow,grow);
    terraformMatrixDummy.position.set(entry.x,entry.y+stemHeight+0.16*scale,entry.z);
    terraformMatrixDummy.scale.set(1.18*scale,1.0*scale,1.18*scale);
  }else if(kind==="flower"){
    terraformMatrixDummy.position.set(entry.x,entry.y+0.18+0.2*grow,entry.z);
    terraformMatrixDummy.scale.set(0.8*scale,0.8*scale,0.8*scale);
  }else{
    let height=1.2*scale;
    terraformMatrixDummy.position.set(entry.x,entry.y+height*0.5,entry.z);
    terraformMatrixDummy.scale.set(0.75*scale,height,0.75*scale);
  }

  terraformMatrixDummy.updateMatrix();
  mesh.setMatrixAt(index,terraformMatrixDummy.matrix);
}

function updateTerraformEntryMesh(mesh,entries,age,kind){
  if(!mesh || !entries) return;
  for(let i=0;i<entries.length;i++){
    let entry=entries[i];
    let progress=(age-entry.delay)/Math.max(1,entry.growFrames);
    setTerraformInstance(mesh,i,entry,progress,kind);
  }
  mesh.instanceMatrix.needsUpdate=true;
}

function startTerraformFinale(car=playerCar){
  if(terraformFinale && terraformFinale.active) return;
  clearTerraformFinale();
  clearRockets();
  clearEnemies();
  if(terraformFadeOverlay) terraformFadeOverlay.style.opacity="0";
  if(terraformCompleteText) terraformCompleteText.style.opacity="0";
  if(world && world.setTerraformBloomAmount) world.setTerraformBloomAmount(0);

  let centerX=car.x;
  let centerZ=car.z;
  let centerY=drivingSurfaceHeight(centerX,centerZ);
  let group=new THREE.Group();
  group.name="TerraformFinale";
  scene.add(group);

  let grassEntries=makeTerraformEntries(centerX,centerZ,2600,12,760,41,{minScale:0.5,maxScale:1.5,spreadFrames:1180,growFrames:78,roadClearance:34});
  let fernEntries=makeTerraformEntries(centerX,centerZ,1180,20,790,63,{minScale:0.4,maxScale:1.35,spreadFrames:1260,growFrames:98,roadClearance:36});
  let bushEntries=makeTerraformEntries(centerX,centerZ,520,28,820,79,{minScale:0.5,maxScale:1.55,spreadFrames:1340,growFrames:138,roadClearance:44});
  let treeEntries=makeTerraformEntries(centerX,centerZ,1120,36,900,97,{minScale:0.52,maxScale:1.78,spreadFrames:1420,growFrames:162,roadClearance:50});
  let coniferEntries=makeTerraformEntries(centerX,centerZ,760,54,940,109,{minScale:0.5,maxScale:1.55,spreadFrames:1480,growFrames:176,roadClearance:52});
  let coniferTierEntries=[
    ...coniferEntries.map(entry=>({...entry,tier:0})),
    ...coniferEntries.map(entry=>({...entry,tier:1,delay:entry.delay+18})),
    ...coniferEntries.map(entry=>({...entry,tier:2,delay:entry.delay+34}))
  ];
  let broadTreeEntries=makeTerraformEntries(centerX,centerZ,520,44,880,127,{minScale:0.48,maxScale:1.52,spreadFrames:1360,growFrames:150,roadClearance:50});
  let columnTreeEntries=makeTerraformEntries(centerX,centerZ,420,60,920,139,{minScale:0.45,maxScale:1.4,spreadFrames:1500,growFrames:188,roadClearance:54});
  let flowerEntries=makeTerraformEntries(centerX,centerZ,980,16,720,151,{minScale:0.62,maxScale:1.28,spreadFrames:1120,growFrames:66,roadClearance:30});
  let pinkFlowerEntries=makeTerraformEntries(centerX,centerZ,820,18,750,173,{minScale:0.52,maxScale:1.24,spreadFrames:1200,growFrames:72,roadClearance:30});
  let blueFlowerEntries=makeTerraformEntries(centerX,centerZ,680,22,780,197,{minScale:0.48,maxScale:1.18,spreadFrames:1280,growFrames:76,roadClearance:32});
  let orangeFlowerEntries=makeTerraformEntries(centerX,centerZ,620,18,710,223,{minScale:0.56,maxScale:1.16,spreadFrames:1160,growFrames:70,roadClearance:30});
  let tallFlowerEntries=makeTerraformEntries(centerX,centerZ,420,24,680,251,{minScale:0.48,maxScale:1.38,spreadFrames:1240,growFrames:96,roadClearance:34});

  let grasses=new THREE.InstancedMesh(terraformGrassGeo,terraformGrassMat,grassEntries.length);
  let ferns=new THREE.InstancedMesh(terraformFernGeo,terraformFernMat,fernEntries.length);
  let bushes=new THREE.InstancedMesh(terraformBushGeo,terraformBushMat,bushEntries.length);
  let trunks=new THREE.InstancedMesh(terraformTrunkGeo,terraformTrunkMat,treeEntries.length);
  let crowns=new THREE.InstancedMesh(terraformCrownGeo,terraformCrownMat,treeEntries.length);
  let coniferTrunks=new THREE.InstancedMesh(terraformTrunkGeo,terraformTrunkMat,coniferEntries.length);
  let coniferCrowns=new THREE.InstancedMesh(terraformConiferCrownGeo,terraformDarkCrownMat,coniferTierEntries.length);
  let broadTreeTrunks=new THREE.InstancedMesh(terraformTrunkGeo,terraformTrunkMat,broadTreeEntries.length);
  let broadTreeCrowns=new THREE.InstancedMesh(terraformBroadCrownGeo,terraformPaleCrownMat,broadTreeEntries.length);
  let columnTreeTrunks=new THREE.InstancedMesh(terraformTrunkGeo,terraformTrunkMat,columnTreeEntries.length);
  let columnTreeCrowns=new THREE.InstancedMesh(terraformColumnCrownGeo,terraformDarkCrownMat,columnTreeEntries.length);
  let flowers=new THREE.InstancedMesh(terraformFlowerGeo,terraformFlowerMat,flowerEntries.length);
  let pinkFlowers=new THREE.InstancedMesh(terraformFlowerGeo,terraformPinkFlowerMat,pinkFlowerEntries.length);
  let blueFlowers=new THREE.InstancedMesh(terraformFlowerGeo,terraformBlueFlowerMat,blueFlowerEntries.length);
  let orangeFlowers=new THREE.InstancedMesh(terraformFlowerGeo,terraformOrangeFlowerMat,orangeFlowerEntries.length);
  let tallFlowerStems=new THREE.InstancedMesh(terraformFlowerStemGeo,terraformStemMat,tallFlowerEntries.length);
  let tallFlowerHeads=new THREE.InstancedMesh(terraformFlowerGeo,terraformPinkFlowerMat,tallFlowerEntries.length);
  for(let mesh of [grasses,ferns,bushes,trunks,crowns,coniferTrunks,coniferCrowns,broadTreeTrunks,broadTreeCrowns,columnTreeTrunks,columnTreeCrowns,flowers,pinkFlowers,blueFlowers,orangeFlowers,tallFlowerStems,tallFlowerHeads]){
    mesh.frustumCulled=false;
    group.add(mesh);
  }

  let rings=[];
  for(let i=0;i<3;i++){
    let ring=new THREE.Mesh(new THREE.RingGeometry(0.82,1,96),terraformRingMat.clone());
    ring.userData.disposeGeometry=true;
    ring.userData.disposeMaterial=true;
    ring.rotation.x=-Math.PI*0.5;
    ring.position.set(centerX,centerY+0.28+i*0.03,centerZ);
    ring.renderOrder=3;
    rings.push(ring);
    group.add(ring);
  }

  terraformFinale={
    active:true,
    age:0,
    centerX,
    centerY,
    centerZ,
    heading:car.cameraYaw || car.angle || 0,
    group,
    grasses,
    ferns,
    bushes,
    trunks,
    crowns,
    coniferTrunks,
    coniferCrowns,
    broadTreeTrunks,
    broadTreeCrowns,
    columnTreeTrunks,
    columnTreeCrowns,
    flowers,
    pinkFlowers,
    blueFlowers,
    orangeFlowers,
    tallFlowerStems,
    tallFlowerHeads,
    grassEntries,
    fernEntries,
    bushEntries,
    treeEntries,
    coniferEntries,
    coniferTierEntries,
    broadTreeEntries,
    columnTreeEntries,
    flowerEntries,
    pinkFlowerEntries,
    blueFlowerEntries,
    orangeFlowerEntries,
    tallFlowerEntries,
    rings
  };
  document.body.classList.add("terraform-finale");
}

function maybeStartTestingTerraformFinale(){
  if(!testingTerraformFinaleAfterSpawn || terraformFinaleTriggered || !startSequence) return;
  let spawnStartFrames=startSequence.spawnStartFrames || startSequence.beamStartFrames || 0;
  if((startSequence.age || 0)<spawnStartFrames+testingTerraformFinaleDelayFrames) return;
  terraformFinaleTriggered=true;
  startTerraformFinale(playerCar);
}

function updateTerraformFinale(){
  if(!terraformFinale || !terraformFinale.active) return;
  terraformFinale.age++;
  let age=terraformFinale.age;
  let greenAmount=smoothStep(clamp(age/1160,0,1));
  let fadeAmount=smoothStep(clamp((age-1280)/260,0,1));
  let titleAmount=smoothStep(clamp((age-1180)/180,0,1));
  if(world && world.setTerraformBloomAmount) world.setTerraformBloomAmount(greenAmount);
  if(terraformFadeOverlay) terraformFadeOverlay.style.opacity=String(fadeAmount);
  if(terraformCompleteText) terraformCompleteText.style.opacity=String(titleAmount);

  if(age<=1540){
    updateTerraformEntryMesh(terraformFinale.grasses,terraformFinale.grassEntries,age,"grass");
    updateTerraformEntryMesh(terraformFinale.ferns,terraformFinale.fernEntries,age,"fern");
    updateTerraformEntryMesh(terraformFinale.bushes,terraformFinale.bushEntries,age,"bush");
    updateTerraformEntryMesh(terraformFinale.trunks,terraformFinale.treeEntries,age,"treeTrunk");
    updateTerraformEntryMesh(terraformFinale.crowns,terraformFinale.treeEntries,age,"treeCrown");
    updateTerraformEntryMesh(terraformFinale.coniferTrunks,terraformFinale.coniferEntries,age,"coniferTrunk");
    updateTerraformEntryMesh(terraformFinale.coniferCrowns,terraformFinale.coniferTierEntries,age,"coniferCrown");
    updateTerraformEntryMesh(terraformFinale.broadTreeTrunks,terraformFinale.broadTreeEntries,age,"broadTreeTrunk");
    updateTerraformEntryMesh(terraformFinale.broadTreeCrowns,terraformFinale.broadTreeEntries,age,"broadTreeCrown");
    updateTerraformEntryMesh(terraformFinale.columnTreeTrunks,terraformFinale.columnTreeEntries,age,"columnTreeTrunk");
    updateTerraformEntryMesh(terraformFinale.columnTreeCrowns,terraformFinale.columnTreeEntries,age,"columnTreeCrown");
    updateTerraformEntryMesh(terraformFinale.flowers,terraformFinale.flowerEntries,age,"flower");
    updateTerraformEntryMesh(terraformFinale.pinkFlowers,terraformFinale.pinkFlowerEntries,age,"flower");
    updateTerraformEntryMesh(terraformFinale.blueFlowers,terraformFinale.blueFlowerEntries,age,"flower");
    updateTerraformEntryMesh(terraformFinale.orangeFlowers,terraformFinale.orangeFlowerEntries,age,"flower");
    updateTerraformEntryMesh(terraformFinale.tallFlowerStems,terraformFinale.tallFlowerEntries,age,"flowerStem");
    updateTerraformEntryMesh(terraformFinale.tallFlowerHeads,terraformFinale.tallFlowerEntries,age,"flowerHead");
  }

  for(let i=0;i<terraformFinale.rings.length;i++){
    let ring=terraformFinale.rings[i];
    let t=clamp((age-i*42)/540,0,1);
    let eased=smoothStep(t);
    ring.scale.setScalar(18+eased*920);
    ring.material.opacity=(1-t)*0.28;
  }

  for(let car of activeCars()){
    car.speed=0;
    car.vy=0;
    car.throttleEase=0;
    car.turnInputEase=0;
    car.turnVelocity=0;
  }
}

function applyTerraformFinaleCameraForCar(car,side=1){
  if(!terraformFinale || !terraformFinale.active || !car) return;
  let age=terraformFinale.age;
  let zoom=smoothStep(clamp(age/1280,0,1));
  let bloom=smoothStep(clamp(age/960,0,1));
  let orbit=terraformFinale.heading+0.24+zoom*0.72;
  let dist=36+zoom*760;
  let height=14+zoom*320;
  let centerX=terraformFinale.centerX;
  let centerZ=terraformFinale.centerZ;
  let centerY=terraformFinale.centerY;
  let rightX=Math.cos(orbit);
  let rightZ=-Math.sin(orbit);
  car.camera.position.set(
    centerX-Math.sin(orbit)*dist+rightX*side*10*(1-zoom),
    centerY+height,
    centerZ-Math.cos(orbit)*dist+rightZ*side*10*(1-zoom)
  );
  car.camera.lookAt(
    centerX,
    centerY+5+bloom*36,
    centerZ
  );
}

let lastChunkSignature="";
let fixedStepMs=1000/60;
let maxFixedStepsPerSimulationTick=1;
let maxFixedAccumulatorMs=fixedStepMs*6;
let fixedAccumulator=0;
let simulationCatchupFrames=0;
let lastLoopTime=null;
let lastSimulationTime=null;
let simulationTimerId=null;
let renderFrameIndex=0;
let fixedFrameIndex=0;
let currentFrameStressLevel=0;
let performanceStressHoldFrames=0;

function performanceStressLevel(frameMs=0){
  let instantaneousFps=frameMs>0 ? 1000/Math.max(1,frameMs) : lastMeasuredFps;
  let fps=Math.min(lastMeasuredFps,instantaneousFps);
  let target=0;
  if(fps<22 || frameMs>62) target=3;
  else if(fps<32 || frameMs>42) target=2;
  else if(fps<44 || frameMs>28 || gameMode==="double") target=1;
  if(target>currentFrameStressLevel){
    performanceStressHoldFrames=90;
    return target;
  }
  if(performanceStressHoldFrames>0){
    performanceStressHoldFrames--;
    return Math.max(target,currentFrameStressLevel);
  }
  return target;
}

function fixedStepLimitForAccumulator(accumulatorMs=fixedAccumulator){
  let expectedSteps=Math.ceil(Math.max(0,accumulatorMs)/fixedStepMs);
  return Math.max(1,Math.min(maxFixedStepsPerSimulationTick,expectedSteps));
}

function resetSimulationClock(now=performance.now()){
  fixedAccumulator=0;
  lastSimulationTime=now;
}

function gameSimulationActive(){
  return gameStarted && !gamePaused && !terminalOverlayOpen() && !gameOver && !missionCompleteShownAt;
}

function runFixedSimulationTo(timestamp=performance.now()){
  if(lastSimulationTime==null) lastSimulationTime=timestamp;
  timestamp=Math.max(timestamp,lastSimulationTime);
  if(!gameSimulationActive()){
    resetSimulationClock(timestamp);
    simulationCatchupFrames=Math.max(0,simulationCatchupFrames-1);
    return 0;
  }

  let elapsed=Math.min(maxFixedAccumulatorMs,Math.max(0,timestamp-lastSimulationTime));
  lastSimulationTime=timestamp;
  fixedAccumulator=Math.min(fixedAccumulator+elapsed,maxFixedAccumulatorMs);

  let steps=0;
  let fixedStepLimit=fixedStepLimitForAccumulator(fixedAccumulator);
  let simStart=performance.now();
  while(fixedAccumulator>=fixedStepMs && steps<fixedStepLimit){
    let willRunAnotherStep=fixedAccumulator-fixedStepMs>=fixedStepMs && steps+1<fixedStepLimit;
    fixedUpdateGame({updateFrameVisuals:steps===0 || !willRunAnotherStep});
    fixedAccumulator-=fixedStepMs;
    steps++;
  }
  if(steps>0) recordPerfSim(performance.now()-simStart,steps);

  let simulationStillBehind=fixedAccumulator>=fixedStepMs;
  if(simulationStillBehind){
    simulationCatchupFrames=8;
  }
  else if(steps>1) simulationCatchupFrames=Math.max(simulationCatchupFrames,3);
  else simulationCatchupFrames=Math.max(0,simulationCatchupFrames-1);

  return steps;
}

function scheduleSimulationTick(delayMs=fixedStepMs){
  simulationTimerId=window.setTimeout(simulationLoop,delayMs);
}

function simulationLoop(){
  simulationTimerId=null;
  let active=gameSimulationActive();
  let steps=runFixedSimulationTo(performance.now());
  let catchingUp=steps>=maxFixedStepsPerSimulationTick && fixedAccumulator>=fixedStepMs;
  scheduleSimulationTick(active ? (catchingUp ? 0 : fixedStepMs*0.5) : 100);
}

function startSimulationLoop(){
  if(simulationTimerId!=null) return;
  resetSimulationClock(performance.now());
  scheduleSimulationTick(0);
}

function chunkViewDistanceForCar(car){
  let altitude=car.y-surfaceHeightForActor(car,car.x,car.z);
  let jetView=car.jetMode || car.jetProgress>0.35 || altitude>32;
  if(!jetView) return viewDistance;

  if(currentFrameStressLevel>=2 || lastMeasuredFps<34) return viewDistance;
  let stressed=gameMode==="double" || lastMeasuredFps<46;
  return viewDistance+(stressed ? 1 : 2);
}

function chunkCenterForCar(car){
  return {
    x:car.x,
    z:car.z,
    viewDistance:chunkViewDistanceForCar(car)
  };
}

function chunkCentersForActiveCars(){
  return activeCars().map(chunkCenterForCar);
}

function bossBaseInVisibleChunk(base){
  if(!base || base.active===false || base.health<=0) return false;

  let baseCx=Math.floor(base.x/chunkSize);
  let baseCz=Math.floor(base.z/chunkSize);
  for(let car of activeCars()){
    if(!car || !car.group.visible || car.health<=0) continue;

    let carCx=Math.floor(car.x/chunkSize);
    let carCz=Math.floor(car.z/chunkSize);
    let visibleChunks=chunkViewDistanceForCar(car);
    if(Math.abs(baseCx-carCx)<=visibleChunks && Math.abs(baseCz-carCz)<=visibleChunks) return true;
  }

  return false;
}

function scanVisibleChunksForBossBases(){
  if(!world || !world.bossBases) return false;

  let found=false;
  for(let base of world.bossBases){
    if(!bossBaseInVisibleChunk(base)) continue;
    if(!scannedBossBases.has(base)){
      scannedBossBases.add(base);
      found=true;
    }
  }

  if(found && hud) hud.updateMapHud(true);
  return found;
}

function objectInVisibleChunk(object){
  if(!object || !Number.isFinite(object.x) || !Number.isFinite(object.z)) return false;

  let objectCx=Math.floor(object.x/chunkSize);
  let objectCz=Math.floor(object.z/chunkSize);
  for(let car of activeCars()){
    if(!car || !car.group.visible || car.health<=0) continue;

    let carCx=Math.floor(car.x/chunkSize);
    let carCz=Math.floor(car.z/chunkSize);
    let visibleChunks=chunkViewDistanceForCar(car);
    if(Math.abs(objectCx-carCx)<=visibleChunks && Math.abs(objectCz-carCz)<=visibleChunks) return true;
  }

  return false;
}

function scanVisibleChunksForTradingOutposts(){
  let found=false;
  for(let [key,outpost] of rareTradingOutposts){
    if(!objectInVisibleChunk(outpost)) continue;
    if(!scannedTradingOutposts.has(key)){
      scannedTradingOutposts.set(key,{x:outpost.x,z:outpost.z});
      found=true;
    }
  }
  if(found && hud) hud.updateMapHud(true);
  return found;
}

function scanVisibleChunksForRadarOutposts(){
  if(!world || !world.chunks) return false;

  let found=false;
  for(let [chunkKey,chunk] of world.chunks){
    if(!chunk || !chunk.colliders) continue;

    for(let obstacle of chunk.colliders){
      if(!obstacle || obstacle.type!=="radarOutpost" || obstacle.destroyed) continue;
      if(!objectInVisibleChunk(obstacle)) continue;

      let key=`${chunkKey}:radar:${Math.round(obstacle.x)}:${Math.round(obstacle.z)}`;
      if(!scannedRadarOutposts.has(key)){
        scannedRadarOutposts.set(key,{
          x:obstacle.x,
          z:obstacle.z,
          r:obstacle.r || 8,
          missionId:obstacle.missionId || null
        });
        found=true;
      }
    }
  }

  if(found && hud) hud.updateMapHud(true);
  return found;
}

function scanVisibleChunksForLandingSpaces(){
  if(!world || !world.chunks) return false;

  let found=false;
  for(let [chunkKey,chunk] of world.chunks){
    if(!chunk || !chunk.landingSurfaces) continue;
    for(let i=0;i<chunk.landingSurfaces.length;i++){
      let surface=chunk.landingSurfaces[i];
      if(!surface || !objectInVisibleChunk(surface)) continue;

      let key=`${chunkKey}:landing:${i}`;
      if(!scannedLandingSpaces.has(key)){
        scannedLandingSpaces.set(key,{
          x:surface.x,
          z:surface.z,
          r:surface.padR || surface.r || 18
        });
        found=true;
      }
    }
  }

  if(found && hud) hud.updateMapHud(true);
  return found;
}

function scanVisibleChunksForPortals(){
  if(!portalKeyUnlocked()) return false;
  if(!portalSystem || !portalSystem.getPortals) return false;

  let found=false;
  for(let portal of portalSystem.getPortals()){
    if(!portal || !objectInVisibleChunk(portal)) continue;

    let key=`portal:${Math.round(portal.x)}:${Math.round(portal.z)}`;
    if(!scannedPortals.has(key)){
      scannedPortals.set(key,{
        x:portal.x,
        z:portal.z,
        r:portal.radius || 8
      });
      found=true;
    }
  }

  if(found && hud) hud.updateMapHud(true);
  return found;
}

function scanVisibleChunksForMapFeatures(){
  let foundBossBases=scanVisibleChunksForBossBases();
  let foundTradingOutposts=scanVisibleChunksForTradingOutposts();
  let foundRadarOutposts=scanVisibleChunksForRadarOutposts();
  let foundLandingSpaces=scanVisibleChunksForLandingSpaces();
  let foundPortals=scanVisibleChunksForPortals();
  return foundBossBases || foundTradingOutposts || foundRadarOutposts || foundLandingSpaces || foundPortals;
}

function clearRareTradingOutposts(clearScanned=false){
  for(let outpost of rareTradingOutposts.values()){
    unregisterTradingPlaceCollision(outpost);
    if(outpost && outpost.object) scene.remove(outpost.object);
  }
  rareTradingOutposts.clear();
  rareTradingOutpostRejectedKeys.clear();
  if(clearScanned) scannedTradingOutposts.clear();
}

function rareTradingOutpostCandidateForChunk(cx,cz){
  if(!tradingOutpostModel) return null;
  if(hash01(cx+931,cz-577)>rareTradingOutpostChunkProbability) return null;

  let best=null;
  for(let attempt=0;attempt<5;attempt++){
    let x=(cx+0.16+hash01(cx*7+13+attempt*37,cz*5-19-attempt*23)*0.68)*chunkSize;
    let z=(cz+0.16+hash01(cx*11-29-attempt*31,cz*3+31+attempt*41)*0.68)*chunkSize;
    let angle=hash01(cx-71+attempt*17,cz+151-attempt*29)*Math.PI*2;

    if(tradingOutpost){
      let dx=x-tradingOutpost.position.x;
      let dz=z-tradingOutpost.position.z;
      if(dx*dx+dz*dz<650*650) continue;
    }

    let tooCloseToTradingOutpost=false;
    for(let outpost of rareTradingOutposts.values()){
      if(!outpost) continue;
      let dx=x-outpost.x;
      let dz=z-outpost.z;
      if(dx*dx+dz*dz<rareTradingOutpostMinSpacing*rareTradingOutpostMinSpacing){
        tooCloseToTradingOutpost=true;
        break;
      }
    }
    if(tooCloseToTradingOutpost) continue;

    let tooCloseToBoss=false;
    for(let base of world.bossBases || []){
      if(!base || base.active===false) continue;
      let dx=x-base.x;
      let dz=z-base.z;
      if(dx*dx+dz*dz<430*430){
        tooCloseToBoss=true;
        break;
      }
    }
    if(tooCloseToBoss) continue;

    let info=tradingOutpostPlacementInfo(x,z,angle);
    if(!info || !info.usable) continue;

    let score=info.range*120+info.maxSlope*900;
    if(!best || score<best.score) best={...info,angle,score};
  }

  return best;
}

function updateRareTradingOutposts(){
  if(!tradingOutpostModel || !world || !world.chunks) return;

  for(let [key,outpost] of rareTradingOutposts){
    if(!world.chunks.has(key)){
      unregisterTradingPlaceCollision(outpost);
      if(outpost && outpost.object) scene.remove(outpost.object);
      rareTradingOutposts.delete(key);
    }
  }

  for(let [key,chunk] of world.chunks){
    if(rareTradingOutposts.has(key)) continue;
    if(rareTradingOutpostRejectedKeys.has(key)) continue;
    let candidate=rareTradingOutpostCandidateForChunk(chunk.cx,chunk.cz);
    if(!candidate){
      rareTradingOutpostRejectedKeys.add(key);
      continue;
    }

    let object=tradingOutpostModel.clone(true);
    object.position.set(candidate.x,candidate.y,candidate.z);
    object.rotation.y=candidate.angle;
    tintTradingOutpostForEnvironment(object);
    scene.add(object);

    let outpost={
      key,
      object,
      x:candidate.x,
      z:candidate.z
    };
    registerTradingPlaceCollision(outpost,tradingOutpostModel);
    rareTradingOutposts.set(key,outpost);
  }
}

function makeSurfaceScanLine(pointCount,material,renderOrder=24){
  let geometry=new THREE.BufferGeometry();
  let positions=new Float32Array(pointCount*3);
  let attribute=new THREE.BufferAttribute(positions,3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position",attribute);

  let line=new THREE.LineLoop(geometry,material.clone());
  line.frustumCulled=false;
  line.renderOrder=renderOrder;
  scene.add(line);
  return line;
}

function makeSurfaceScanSpokes(material){
  let geometry=new THREE.BufferGeometry();
  let positions=new Float32Array(surfaceScanSpokeCount*2*3);
  let attribute=new THREE.BufferAttribute(positions,3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position",attribute);

  let line=new THREE.LineSegments(geometry,material.clone());
  line.frustumCulled=false;
  line.renderOrder=23;
  scene.add(line);
  return line;
}

function writeSurfaceScanRing(line,originX,originZ,radius,phase=0,lift=0.32){
  let attribute=line.geometry.attributes.position;
  let positions=attribute.array;

  for(let i=0;i<surfaceScanRingSegments;i++){
    let angle=(i/surfaceScanRingSegments)*Math.PI*2+phase;
    let x=originX+Math.sin(angle)*radius;
    let z=originZ+Math.cos(angle)*radius;
    let index=i*3;
    positions[index]=x;
    positions[index+1]=drivingSurfaceHeight(x,z)+lift;
    positions[index+2]=z;
  }

  attribute.needsUpdate=true;
}

function writeSurfaceScanSpokes(line,originX,originZ,outerRadius,innerRadius,phase=0,lift=0.34){
  let attribute=line.geometry.attributes.position;
  let positions=attribute.array;

  for(let i=0;i<surfaceScanSpokeCount;i++){
    let angle=(i/surfaceScanSpokeCount)*Math.PI*2+phase;
    let sin=Math.sin(angle);
    let cos=Math.cos(angle);
    let innerX=originX+sin*innerRadius;
    let innerZ=originZ+cos*innerRadius;
    let outerX=originX+sin*outerRadius;
    let outerZ=originZ+cos*outerRadius;
    let index=i*6;
    positions[index]=innerX;
    positions[index+1]=drivingSurfaceHeight(innerX,innerZ)+lift;
    positions[index+2]=innerZ;
    positions[index+3]=outerX;
    positions[index+4]=drivingSurfaceHeight(outerX,outerZ)+lift;
    positions[index+5]=outerZ;
  }

  attribute.needsUpdate=true;
}

function spawnSurfaceScanPulse(car){
  if(!car || !car.group.visible || car.health<=0) return;

  let maxRadius=Math.min(chunkSize*2.3,chunkSize*(chunkViewDistanceForCar(car)+0.5));
  let pulse={
    x:car.x,
    z:car.z,
    age:0,
    life:1.45,
    maxRadius,
    phase:Math.random()*Math.PI*2,
    rings:[
      makeSurfaceScanLine(surfaceScanRingSegments,surfaceScanGlowMat,25),
      makeSurfaceScanLine(surfaceScanRingSegments,surfaceScanMat,24),
      makeSurfaceScanLine(surfaceScanRingSegments,surfaceScanMat,23)
    ],
    spokes:makeSurfaceScanSpokes(surfaceScanMat)
  };
  surfaceScanPulses.push(pulse);
}

function disposeSurfaceScanPulse(pulse){
  for(let ring of pulse.rings || []){
    scene.remove(ring);
    ring.geometry.dispose();
    ring.material.dispose();
  }
  if(pulse.spokes){
    scene.remove(pulse.spokes);
    pulse.spokes.geometry.dispose();
    pulse.spokes.material.dispose();
  }
}

function clearSurfaceScanPulses(){
  for(let pulse of surfaceScanPulses) disposeSurfaceScanPulse(pulse);
  surfaceScanPulses=[];
}

function updateSurfaceScanPulses(deltaSeconds){
  for(let i=surfaceScanPulses.length-1;i>=0;i--){
    let pulse=surfaceScanPulses[i];
    pulse.age+=deltaSeconds;
    let t=clamp(pulse.age/pulse.life,0,1);
    let eased=1-Math.pow(1-t,2.35);
    let radius=Math.max(2,pulse.maxRadius*eased);
    let fade=Math.pow(1-t,1.35);
    let spin=pulse.phase+pulse.age*0.72;

    pulse.rings[0].material.opacity=0.48*fade;
    pulse.rings[1].material.opacity=0.96*fade;
    pulse.rings[2].material.opacity=0.42*fade;
    pulse.spokes.material.opacity=0.34*fade;

    writeSurfaceScanRing(pulse.rings[0],pulse.x,pulse.z,radius*1.012,spin,0.38);
    writeSurfaceScanRing(pulse.rings[1],pulse.x,pulse.z,radius,spin,0.36);
    writeSurfaceScanRing(pulse.rings[2],pulse.x,pulse.z,Math.max(1,radius*0.48),-spin*0.6,0.34);
    writeSurfaceScanSpokes(pulse.spokes,pulse.x,pulse.z,radius,Math.max(1,radius*0.16),spin,0.35);

    if(t>=1){
      disposeSurfaceScanPulse(pulse);
      surfaceScanPulses.splice(i,1);
    }
  }
}

function updateScannerMode(){
  let scannerControllerPressed=activeCars().some(car=>{
    let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
    return buttons.rightBumper;
  });
  let scannerPressed=!!input.keys.c || scannerControllerPressed;
  if(!scannerUnlocked()){
    scannerKeyDown=scannerPressed;
    return;
  }

  let now=performance.now();
  let scannerReady=now>=scannerReadyAt;
  if(scannerPressed && !scannerKeyDown && scannerReady && gameStarted && !gamePaused && !terminalOverlayOpen() && !gameOver){
    scannerReadyAt=now+scannerCooldownMs;
    missionCompassScannerFired=true;
    if(motorAudio.playScannerPulse) motorAudio.playScannerPulse();
    for(let car of activeCars()) spawnSurfaceScanPulse(car);
    scanVisibleChunksForMapFeatures();
  }
  scannerKeyDown=scannerPressed;
}

function chunkBuildBudget(){
  if(simulationCatchupFrames>0) return {items:0,frameMs:0};
  let expandedView=activeCars().some(car=>chunkViewDistanceForCar(car)>viewDistance);
  if(lastMeasuredFps<28) return {items:0,frameMs:0};
  if(!expandedView){
    if(lastMeasuredFps<36) return {items:1,frameMs:0.55};
    if(lastMeasuredFps<48) return {items:1,frameMs:0.9};
    return {items:1,frameMs:1.25};
  }
  if(gameMode==="double") return {items:1,frameMs:lastMeasuredFps<42 ? 0.65 : 1.15};
  if(lastMeasuredFps<38) return {items:1,frameMs:0.65};
  if(lastMeasuredFps<50) return {items:1,frameMs:1.1};
  return {items:3,frameMs:2.6};
}

function updateJetFogAmount(){
  let target=0;

  if(gameStarted){
    for(let car of activeCars()){
      if(!car || car.health<=0 || !car.group.visible) continue;

      let altitude=Math.max(0,car.y-surfaceHeightForActor(car,car.x,car.z));
      let jetState=Math.max(car.jetMode ? 1 : 0,car.jetProgress || 0);
      let altitudeState=clamp((altitude-28)/92,0,1);
      target=Math.max(target,jetState,altitudeState);
    }
  }

  jetFogAmount+=(target-jetFogAmount)*0.08;
  if(Math.abs(target-jetFogAmount)<0.004) jetFogAmount=target;
}

function chunkSignatureForCars(){
  return activeCars()
    .map(car=>Math.floor(car.x/chunkSize)+","+Math.floor(car.z/chunkSize)+","+chunkViewDistanceForCar(car))
    .join("|");
}

function fixedUpdateGame(options={}){
  fixedFrameIndex++;
  targetableCarsCacheFrame=-1;
  targetableCarsCache=null;

  let updateFrameVisuals=options.updateFrameVisuals ?? true;
  let fixedVisualInterval=currentFrameStressLevel>=3 ? 6 : currentFrameStressLevel>=2 ? 3 : currentFrameStressLevel>=1 ? 2 : 1;
  let updateFixedVisuals=updateFrameVisuals && fixedFrameIndex%fixedVisualInterval===0;
  let maintenanceInterval=currentFrameStressLevel>=3 ? 45 : currentFrameStressLevel>=2 ? 30 : currentFrameStressLevel>=1 ? 18 : 10;
  let updateMaintenance=fixedFrameIndex%maintenanceInterval===0;

  if(updateMaintenance){
    updateRareTradingOutposts();
    updateUnlockedRandomPortals();
  }
  updateScannerMode();
  updateStartSequence();
  updateTerraformFinale();
  updatePendingBossFinale();
  let finaleActive=!!(terraformFinale && terraformFinale.active);
  for(let car of activeCars()){
    if(isCarInStartSequence(car)) continue;
    if(finaleActive) continue;
    updateCar(car);
  }
  if(!finaleActive){
    updateTreasurePickups();
    updateMothership();
    updateEnemies();
    if(currentFrameStressLevel<3 || fixedFrameIndex%2===0) updateAmbientSpaceships();
    if(currentFrameStressLevel<3 || fixedFrameIndex%2===0) updateVillageTurrets();
    updateBossBaseDefenses();
    updateSupplyBoxes();
    updateRockets();
    updateTradingOutpostRepair();
    updateCannonBolts();
    updateClusterBombs();
    updateGiantFireballs();
  }
  if(healthDamageCooldown>0) healthDamageCooldown--;

  if(updateFixedVisuals){
    dust.update();
    updateExplosions();
    updateTeleportEffects();
    updateTreasurePickupEffects();
    updateRockDebris();
    updateBossLaserBeams();
  }
  updateJetFogAmount();
  updateGiantTestRobot();
  portalSystem.updatePortals();
  if(updateFixedVisuals){
    portalSystem.updateDreamDimensionVisuals();
    updateWeather();
    world.updateWind(performance.now(),rainIntensity,currentDayAmount,headlightNightAmount);
    for(let car of cars) updateVehicleHeadlights(car);
  }
  if(updateFrameVisuals){
    motorAudio.update();
    updateCameras();
  }

  let chunkSignature=chunkSignatureForCars();

  if(chunkSignature!==lastChunkSignature){
    lastChunkSignature=chunkSignature;
    world.updateChunksForCenters(chunkCentersForActiveCars());
  }
}

function loop(timestamp=performance.now()){
  requestAnimationFrame(loop);
  renderFrameIndex++;

  if(lastLoopTime==null) lastLoopTime=timestamp;
  let frameMs=Math.min(250,Math.max(0,timestamp-lastLoopTime));
  lastLoopTime=timestamp;
  updateFpsDisplay(timestamp);
  updateMissionStartTitle(timestamp);
  updateFirstPersonVisorOverlay();
  updateObjectiveHudLayout();

  if(!gameStarted){
    resetSimulationClock(timestamp);
    updateCameras();
    world.processChunkQueue(2,true);
    portalSystem.updatePortals(timestamp);
    portalSystem.updateDreamDimensionVisuals(timestamp);
    updateWeather();
    world.updateWind(timestamp,rainIntensity,currentDayAmount,headlightNightAmount);
    for(let car of cars) updateVehicleHeadlights(car);
    updateGiantTestRobot();
    clouds.update();
    stars.update();
    birds.update();
    lowHaze.update();
    ambientMotes.update();
    renderGame();
    return;
  }

  updateControllerMenuInput();
  if(updateMissionCompleteInput()){
    resetSimulationClock(timestamp);
    updateCameras();
    renderGame();
    return;
  }

  if(gamePaused){
    resetSimulationClock(timestamp);
    updateCameras();
    pauseMenu.update(timestamp);
    renderGame();
    return;
  }

  if(terminalOverlayOpen()){
    resetSimulationClock(timestamp);
    updateCameras();
    tradingScreen.update();
    missionScreen.update();
    renderGame();
    return;
  }

  currentFrameStressLevel=performanceStressLevel(frameMs);
  runFixedSimulationTo(timestamp);

  let effectsStart=performance.now();
  if(timestamp-lastPixelRatioUpdate>500){
    lastPixelRatioUpdate=timestamp;
    updateRendererPixelRatio();
  }

  let stressLevel=currentFrameStressLevel;
  if(stressLevel>=2) updateRendererPixelRatio();
  let visualInterval=simulationCatchupFrames>0 ? 8 : stressLevel>=3 ? 6 : stressLevel>=2 ? 3 : stressLevel>=1 ? 2 : 1;
  let updateVisuals=renderFrameIndex%visualInterval===0;
  if(updateVisuals){
    clouds.update();
    stars.update();
    birds.update();
    lowHaze.update();
    ambientMotes.update();
    updateSurfaceScanPulses((frameMs/1000)*visualInterval);
  }
  if(stressLevel<3 || renderFrameIndex%2===0) hud.updateSpeedHud();
  hud.updateMapHud();
  if(stressLevel<2 || renderFrameIndex%2===0) hud.updateCompassHud();
  pauseMenu.update(timestamp);
  recordPerfBucket("effects",performance.now()-effectsStart);

  let chunkBudget=chunkBuildBudget();
  let chunkStart=performance.now();
  if(chunkBudget.items>0) world.processChunkQueue(chunkBudget.items,false,chunkBudget.frameMs);
  recordPerfBucket("chunks",performance.now()-chunkStart);

  if(world.setRenderStressLevel) world.setRenderStressLevel(stressLevel,chunkCentersForActiveCars());

  let renderStart=performance.now();
  renderGame();
  recordPerfBucket("render",performance.now()-renderStart);
  recordPerfFrame(frameMs);
}

renderer.domElement.addEventListener("click",event=>{
  if(handleTradingTerminalClick(event)) return;
  if(automaticFullscreenEnabled) requestBrowserFullscreen();
  if(gameStarted && !gamePaused && !terminalOverlayOpen() && !gameOver) input.requestPointerLock(renderer.domElement);
});

window.addEventListener("resize",()=>{
  resizeRendererToViewport();
});
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",scheduleRendererViewportRefresh);
}

function setCarActive(car,active){
  let hiddenForStart=startSequence
    && car.startSequenceLocked
    && (startSequence.age || 0)<(startSequence.spawnStartFrames || startSequence.preludeFrames || 0);
  car.group.visible=active && !hiddenForStart;
  car.shadow.setVisible(active && !hiddenForStart);
}

function roadPointForOffset(z,lateralOffset){
  let yaw=roadYawAt(z);
  let centerX=roadCenterX(z);
  return {
    x:centerX+Math.cos(yaw)*lateralOffset,
    z:z-Math.sin(yaw)*lateralOffset,
    angle:yaw
  };
}

const startFieldOffsets=[-135,135,-180,180,-105,105,-230,230];

function fieldPatchInfo(x,z,radius=18){
  if(groundHoleAt(x,z)) return null;
  let minH=Infinity;
  let maxH=-Infinity;
  let samples=[
    [0,0],
    [1,0],
    [-1,0],
    [0,1],
    [0,-1],
    [0.7,0.7],
    [-0.7,0.7],
    [0.7,-0.7],
    [-0.7,-0.7]
  ];

  for(let sample of samples){
    let sx=x+sample[0]*radius;
    let sz=z+sample[1]*radius;
    if(waterDepthAt(sx,sz)>0.05) return null;
    if(groundHoleAt(sx,sz)) return null;
    if(roadDistance(sx,sz)<72) return null;

    let h=groundHeight(sx,sz);
    minH=Math.min(minH,h);
    maxH=Math.max(maxH,h);
  }

  return {minH,maxH,range:maxH-minH};
}

function startPlacementInfo(z,fieldOffset,lateralOffsets){
  let maxHeight=-Infinity;
  let maxSlope=0;
  let maxRange=0;
  let points=[];

  for(let offset of lateralOffsets){
    let point=roadPointForOffset(z,fieldOffset+offset);
    if(!Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
    if(roadDistance(point.x,point.z)<86) return null;

    let y=groundHeight(point.x,point.z);
    let patch=fieldPatchInfo(point.x,point.z);
    if(!patch) return null;

    let ahead=roadPointForOffset(z+40,fieldOffset+offset);
    let behind=roadPointForOffset(z-40,fieldOffset+offset);
    let rightX=Math.cos(point.angle);
    let rightZ=-Math.sin(point.angle);
    let forwardSlope=Math.abs(groundHeight(ahead.x,ahead.z)-groundHeight(behind.x,behind.z))/80;
    let sideSlope=Math.abs(
      groundHeight(point.x+rightX*18,point.z+rightZ*18)
      - groundHeight(point.x-rightX*18,point.z-rightZ*18)
    )/36;

    maxHeight=Math.max(maxHeight,y);
    maxRange=Math.max(maxRange,patch.range);
    maxSlope=Math.max(maxSlope,forwardSlope,sideSlope);
    points.push(point);
  }

  let preferredMaxHeight=waterLevel+30;
  let preferredMaxSlope=0.18;
  let preferredMaxRange=3.8;
  let mountainPenalty=Math.max(0,maxHeight-preferredMaxHeight);

  return {
    z,
    fieldOffset,
    points,
    angle:roadYawAt(z),
    preferred:maxHeight<=preferredMaxHeight && maxSlope<=preferredMaxSlope && maxRange<=preferredMaxRange,
    score:Math.abs(z)*0.002+Math.abs(fieldOffset)*0.025+maxHeight*2.5+maxSlope*90+maxRange*28+mountainPenalty*18
  };
}

function startAreaClear(info){
  let center=info.points.reduce((acc,point)=>({
    x:acc.x+point.x/info.points.length,
    z:acc.z+point.z/info.points.length
  }),{x:0,z:0});

  world.updateChunksForCenters([center]);
  world.processChunkQueue(80,true);

  for(let point of info.points){
    if(world.collidesWithObstacles(point.x,point.z)) return false;
    let clearanceSamples=[
      [12,0],
      [-12,0],
      [0,12],
      [0,-12],
      [8,8],
      [-8,8],
      [8,-8],
      [-8,-8]
    ];

    for(let sample of clearanceSamples){
      if(world.collidesWithObstacles(point.x+sample[0],point.z+sample[1])) return false;
    }
  }

  return true;
}

function findSafeFieldStart(lateralOffsets){
  let step=80;
  let maxSteps=120;
  let bestDry=[];

  function rememberCandidate(info){
    bestDry.push(info);
    bestDry.sort((a,b)=>a.score-b.score);
    if(bestDry.length>12) bestDry.length=12;
  }

  for(let i=0;i<=maxSteps;i++){
    for(let direction of (i===0 ? [1] : [1,-1])){
      let z=i*step*direction;
      for(let fieldOffset of startFieldOffsets){
        let info=startPlacementInfo(z,fieldOffset,lateralOffsets);
        if(!info) continue;
        rememberCandidate(info);
        if(info.preferred && startAreaClear(info)) return info;
      }
    }
  }

  for(let info of bestDry){
    if(startAreaClear(info)) return info;
  }

  return {
    z:0,
    fieldOffset:startFieldOffsets[0],
    points:lateralOffsets.map(offset=>roadPointForOffset(0,startFieldOffsets[0]+offset)),
    angle:roadYawAt(0)
  };
}

function activeBossBaseDefenders(base){
  let count=0;
  for(let enemy of enemies){
    if(enemy.active && enemy.health>0 && enemy.bossBase===base) count++;
  }
  return count;
}

function bossBaseDefensePoint(base,index,count=10,dist=86){
  let angle=base.angle+(index/count)*Math.PI*2+Math.PI*0.12;
  return {
    x:base.x+Math.sin(angle)*dist,
    z:base.z+Math.cos(angle)*dist,
    angle
  };
}

function spawnBossBaseDefender(base,point,type="guard",aggressive=true){
  if(!base || !point) return false;
  if(waterDepthAt(point.x,point.z)>1.2 || world.collidesWithObstacles(point.x,point.z)) return false;

  let defender=createEnemyState(++enemySpawnSerial,point.x,point.z,type);
  defender.isPatrol=aggressive;
  defender.bossBase=base;
  defender.guardX=point.x;
  defender.guardZ=point.z;
  defender.guardPhase=Math.random()*Math.PI*2;
  defender.angle=Math.atan2(base.x-point.x,base.z-point.z);
  defender.velAngle=defender.angle;
  defender.cannonCooldown=Math.min(defender.cannonCooldown || 90,28+Math.floor(Math.random()*46));
  defender.group.position.set(defender.x,defender.y,defender.z);
  defender.group.rotation.y=defender.angle;
  if(defender.shadow) defender.shadow.update({carX:defender.x,carZ:defender.z,carY:defender.y,surfaceY:defender.y,carVelAngle:defender.angle});
  enemies.push(defender);
  spawnEnemyTeleportEffect(defender);
  return true;
}

function requestBossBaseReinforcements(base,urgency=1){
  if(!base || !base.active || base.health<=0) return;
  if(missionEnemyGraceActive()) return;
  if((base.reinforcementCooldown || 0)>0) return;

  let activeCount=activeBossBaseDefenders(base);
  let maxDefenders=gameDifficulty==="hard" ? 15 : gameDifficulty==="easy" ? 9 : 12;
  if(activeCount>=maxDefenders) return;

  let spawnCount=Math.min(maxDefenders-activeCount,urgency+1);
  let spawned=0;
  let startIndex=base.reinforcementIndex || 0;
  for(let i=0;i<spawnCount*4 && spawned<spawnCount;i++){
    let index=startIndex+i;
    let dist=92+(index%3)*18;
    let point=bossBaseDefensePoint(base,index,12,dist);
    let roll=(index+spawned)%9;
    let type=roll===0 && gameDifficulty!=="easy" ? "giant" : roll===3 ? "drone" : "guard";
    if(spawnBossBaseDefender(base,point,type,true)) spawned++;
  }

  base.reinforcementIndex=startIndex+spawnCount+3;
  base.reinforcementCooldown=spawned>0 ? 260-Math.min(120,urgency*38) : 90;
}

function spawnBossBaseGuards(){
  for(let base of world.bossBases || []){
    if(!base || base.guardsSpawned || !base.active) continue;
    let initialCount=gameDifficulty==="hard" ? 10 : gameDifficulty==="easy" ? 6 : 8;
    let points=[...(base.guardPoints || [])];
    for(let i=points.length;i<initialCount+4;i++){
      points.push(bossBaseDefensePoint(base,i,initialCount+4,76+(i%3)*15));
    }

    let spawned=0;
    for(let i=0;i<points.length && spawned<initialCount;i++){
      let point=points[i];
      if(!point) continue;
      let type=i===2 && gameDifficulty!=="easy" ? "giant" : i%5===4 ? "drone" : "guard";
      if(spawnBossBaseDefender(base,point,type,true)) spawned++;
    }
    base.reinforcementIndex=points.length;
    base.reinforcementCooldown=180;
    base.guardsSpawned=true;
  }
}

function missionOutpostDefensePoint(outpost,index,count=3,dist=58){
  let angle=(outpost && Number.isFinite(outpost.missionIndex) ? outpost.missionIndex*0.48 : 0)
    +(index/count)*Math.PI*2
    +Math.PI*0.18;
  return {
    x:outpost.x+Math.sin(angle)*dist,
    z:outpost.z+Math.cos(angle)*dist,
    angle
  };
}

function spawnMissionOutpostGuard(outpost,index,count){
  if(!outpost) return false;

  let point=null;
  for(let attempt=0;attempt<8 && !point;attempt++){
    let dist=92+(attempt%4)*32+Math.floor(attempt/4)*22+(index%3)*12;
    let candidate=missionOutpostDefensePoint(outpost,index+attempt*count,count,dist);
    if(waterDepthAt(candidate.x,candidate.z)>1.2) continue;
    if(world.collidesWithObstacles(candidate.x,candidate.z)) continue;
    point=candidate;
  }
  if(!point) return false;

  let type="guard";
  if(index%4===1) type="buggy";
  else if(index%5===3) type="drone";
  else if(gameDifficulty==="hard" && index%7===5) type="giant";
  let defender=createEnemyState(++enemySpawnSerial,point.x,point.z,type);
  defender.isPatrol=true;
  defender.missionOutpost=outpost;
  defender.guardX=point.x;
  defender.guardZ=point.z;
  defender.guardRadius=84+(index%4)*18;
  defender.guardPhase=Math.random()*Math.PI*2;
  defender.angle=Math.atan2(outpost.x-point.x,outpost.z-point.z);
  defender.velAngle=defender.angle;
  defender.cannonCooldown=Math.min(defender.cannonCooldown || 90,18+Math.floor(Math.random()*38));
  defender.group.position.set(defender.x,defender.y,defender.z);
  defender.group.rotation.y=defender.angle;
  if(defender.shadow) defender.shadow.update({carX:defender.x,carZ:defender.z,carY:defender.y,surfaceY:defender.y,carVelAngle:defender.angle});
  enemies.push(defender);
  spawnEnemyTeleportEffect(defender);
  return true;
}

function spawnMissionOutpostGuardsForOutpost(outpost){
  if(!outpost || outpost.destroyed || outpost.guardsSpawned) return 0;

  let guardCount=gameDifficulty==="hard" ? 7 : gameDifficulty==="easy" ? 4 : 5;
  let spawned=0;
  for(let i=0;i<guardCount*5 && spawned<guardCount;i++){
    if(spawnMissionOutpostGuard(outpost,i,guardCount*5)) spawned++;
  }
  if(spawned>0) outpost.guardsSpawned=true;
  return spawned;
}

function requestMissionOutpostDefense(outpost){
  if(missionEnemyGraceActive()) return;
  if(!outpost || outpost.type!=="radarOutpost") return;
  spawnMissionOutpostGuardsForOutpost(outpost);
}

function seedMissionOutpostsOnMap(outposts){
  for(let i=0;i<outposts.length;i++){
    let outpost=outposts[i];
    if(!outpost) continue;
    scannedRadarOutposts.set(`mission:${outpost.missionId || "outpost"}:${i}`,{
      x:outpost.x,
      z:outpost.z,
      r:outpost.r || 8,
      missionId:outpost.missionId || null
    });
  }
  if(hud) hud.updateMapHud(true);
}

function setupCurrentPlanetMission(){
  missionCommunicationOutposts=[];
  generatedPlanetMission=null;
  if(world.clearMissionRadarOutposts) world.clearMissionRadarOutposts();

  if(world.clearBossBases) world.clearBossBases();

  if(missionIdForEnvironment(currentEnvironment)===emberCommunicationMissionId){
    missionCommunicationOutposts=world.placeMissionRadarOutpostsNearStart
      ? world.placeMissionRadarOutpostsNearStart(
        playerCar.x,
        playerCar.z,
        playerCar.angle,
        emberCommunicationOutpostCount,
        {missionId:emberCommunicationMissionId}
      )
      : [];
    seedMissionOutpostsOnMap(missionCommunicationOutposts);
    if(missionScreen) missionScreen.update();
    updateMissionGoalDisplay();
    return true;
  }

  generatedPlanetMission=createGeneratedPlanetMission(currentEnvironment);
  if(generatedPlanetMission.type==="relay"){
    missionCommunicationOutposts=world.placeMissionRadarOutpostsNearStart
      ? world.placeMissionRadarOutpostsNearStart(
        playerCar.x,
        playerCar.z,
        playerCar.angle,
        generatedPlanetMission.target,
        {missionId:generatedPlanetMission.id}
      )
      : [];
    seedMissionOutpostsOnMap(missionCommunicationOutposts);
  }else if(generatedPlanetMission.type==="bossBase" || generatedPlanetMission.type==="neonCity"){
    world.placeTestBossBaseNearStart(playerCar.x,playerCar.z,playerCar.angle);
  }

  if(missionScreen) missionScreen.update();
  updateMissionGoalDisplay();
  return true;
}

function updatePlanetMissionAfterOutpostDestroyed(obstacle){
  if(!obstacle) return;
  if(obstacle.missionId===emberCommunicationMissionId){
    if(missionScreen) missionScreen.update();
    updateMissionGoalDisplay();
    if(activeCommunicationMissionOutposts().length>0) return;

    if(motorAudio.stopMusic) motorAudio.stopMusic();
    showMissionAccomplished(emberCommunicationMissionId);
    return;
  }

  if(generatedPlanetMission && generatedPlanetMission.type==="relay" && obstacle.missionId===generatedPlanetMission.id){
    advanceGeneratedPlanetMission("relay",1);
  }
}

function applyGeneratedMissionSpawnTiming(){
  if(!generatedPlanetMission || generatedPlanetMission.completed) return;
  if(generatedPlanetMission.type==="mothership"){
    mothershipDelay=Math.min(mothershipDelay,420);
  }else if(generatedPlanetMission.type==="enemy"){
    enemyWaveDelay=0;
    enemyPatrolDelay=60;
  }
}

function startGame(mode,difficulty="medium",savedStatus=null){
  gameMode=mode;
  gameDifficulty=difficultySettings[difficulty] ? difficulty : "medium";
  currentGameFromSave=!!savedStatus;
  enemyBudgetRun++;
  gameStarted=true;
  missionEnemyGraceUntil=performance.now()+missionEnemyGraceMs;
  gameIntroAudioStarted=false;
  setGameAudioAllowed(false);
  input.requestPointerLock(renderer.domElement);
  document.body.classList.toggle("single-player",mode==="single");
  document.body.classList.toggle("double-player",mode==="double");

  clearRockets();
  clearAmbientSpaceships();
  ambientStartFormationDelay=0;
  ambientStartFormationSpawned=false;
  clearEnemies();
  clearSupplyBoxes();
  clearGiantTestRobot();
  clearTradingOutpost();
  clearTestingTradingOutpost();
  clearTestingRadarOutpost();
  missionCommunicationOutposts=[];
  generatedPlanetMission=null;
  if(world.clearMissionRadarOutposts) world.clearMissionRadarOutposts();
  clearStartSequence();
  clearTerraformFinale();
  pendingBossFinale=null;
  terraformFinaleTriggered=false;
  if(world.clearBossBases) world.clearBossBases();
  if(savedStatus) applySavedWorldSettings(savedStatus);
  jetUnlocked=false;
  gameOver=false;
  gameWon=false;
  gamePaused=false;
  tradingScreenOpen=false;
  missionScreenOpen=false;
  jetFogAmount=0;
  motorAudio.setPaused(false);
  pauseMenu.setVisible(false);
  missionScreen.setVisible(false);
  tradingScreen.setVisible(false);
  resetSimulationClock();
  lastLoopTime=null;
  units=initialUnits;
  purchasedTradingItems=new Set();
  applyDefaultStartItems();
  scoredVillages=new WeakSet();
  scannedBossBases=new Set();
  scannedRadarOutposts=new Map();
  scannedLandingSpaces=new Map();
  scannedPortals=new Map();
  clearRareTradingOutposts(true);
  portalSystem.clearRandomPortals();
  tradingPlaceCollisions=[];
  scannerKeyDown=false;
  scannerReadyAt=0;
  missionCompassScannerFired=false;
  updateMissionGoalDisplay();
  playerCar.damageZones=createRobotDamageState();
  secondCar.damageZones=createRobotDamageState();
  playerCar.damageFlashZones=createRobotDamageState();
  secondCar.damageFlashZones=createRobotDamageState();
  playerCar.holeDamageCooldown=0;
  secondCar.holeDamageCooldown=0;
  applyRobotHitFlashVisuals(playerCar.mechModel,playerCar.damageFlashZones);
  applyRobotHitFlashVisuals(secondCar.mechModel,secondCar.damageFlashZones);
  clearSurfaceScanPulses();
  playerCar.lateralOffset=mode==="single" ? 0 : -4.2;
  secondCar.lateralOffset=4.2;
  let savedStartInfo=savedStatus && savedStatus.startInfo;
  let startInfo=savedStartInfo
    && Number.isFinite(savedStartInfo.z)
    && Number.isFinite(savedStartInfo.angle)
    && Number.isFinite(savedStartInfo.fieldOffset)
    ? savedStartInfo
    : findSafeFieldStart(mode==="double" ? [playerCar.lateralOffset,secondCar.lateralOffset] : [playerCar.lateralOffset]);
  placeCarOnOpenField(playerCar,startInfo);
  placeCarOnOpenField(secondCar,startInfo);
  if(savedStatus){
    let savedCars=new Map((savedStatus.cars || []).map(car=>[car.id,car]));
    restoreCarStatus(playerCar,savedCars.get("car1"));
    restoreCarStatus(secondCar,savedCars.get("car2"));
  }
  spawnGiantTestRobot(startInfo);
  placeTradingOutpostNearStart(startInfo);
  placeTestingTradingOutpostNearHomeBase();
  if(!savedStatus) placeStartingCarsAtBaseEntrance(mode,!testingSkipIntro);
  if(!setupCurrentPlanetMission()){
    world.placeTestBossBaseNearStart(playerCar.x,playerCar.z,playerCar.angle);
    spawnBossBaseGuards();
  }
  setCarActive(playerCar,true);
  setCarActive(secondCar,mode==="double");
  if(!savedStatus && !missionEnemyGraceActive()) spawnTestingRocketBuggiesAtStart();
  playerCar.cameraYaw=playerCar.angle;
  secondCar.cameraYaw=secondCar.angle;
  updateRendererPixelRatio();
  updateCameraProjection();
  updateCameras();

  let startScreen=document.getElementById("startScreen");
  if(startScreen) startScreen.style.display="none";
  showMissionStartTitle();
  startIntroAudio();

  hud.init();
  lastChunkSignature=chunkSignatureForCars();
  world.updateChunksForCenters(chunkCentersForActiveCars());
  let settings=currentDifficulty();
  enemyWaveDelay=scaledDelay(90,settings.waveDelay);
  enemyPatrolDelay=scaledDelay(900+Math.floor(Math.random()*420),settings.patrolDelay);
  applyGeneratedMissionSpawnTiming();
  if(savedStatus){
    restoreSavedRuntimeStatus(savedStatus);
    hud.updateHealthHud();
    hud.updateSpeedHud();
    hud.updateMapHud(true);
  }
}

let startScreen=document.getElementById("startScreen");
if(startScreen){
  let startPlanetLoading=false;
  updateStartupLoadingState();
  updateLoadGameButton();
  function selectedStartDifficulty(){
    let selected=startScreen.querySelector("[data-difficulty].is-selected");
    let difficulty=startScreen.dataset.difficulty || (selected && selected.dataset.difficulty) || "medium";
    return difficultySettings[difficulty] ? difficulty : "medium";
  }
  function applyStartDifficultySelection(difficulty){
    let selectedDifficulty=difficultySettings[difficulty] ? difficulty : "medium";
    startScreen.dataset.difficulty=selectedDifficulty;
    startScreen.querySelectorAll("[data-difficulty]").forEach(button=>{
      button.classList.toggle("is-selected",button.dataset.difficulty===selectedDifficulty);
    });
  }
  function setStartPlanetLoading(loading){
    startPlanetLoading=!!loading;
    startScreen.classList.toggle("is-planet-loading",startPlanetLoading);
    startScreen.querySelectorAll("[data-planet], [data-mode], [data-load-game], [data-difficulty]").forEach(button=>{
      if(button.hasAttribute("data-load-game")){
        button.disabled=startPlanetLoading || !readSavedGameStatus();
      }else if(button.hasAttribute("data-mode")){
        button.disabled=startPlanetLoading || !startupAssetsReady;
      }else if(button.hasAttribute("data-planet")){
        let environment=worldEnvironments[Number(button.dataset.planet)];
        button.disabled=startPlanetLoading || !planetSelectable(environment);
      }else{
        button.disabled=startPlanetLoading;
      }
    });
  }
  function setPlanetPendingButton(index){
    startScreen.querySelectorAll("[data-planet]").forEach(button=>{
      button.classList.toggle("is-loading",Number(button.dataset.planet)===index);
    });
  }
  function finishStartPlanetLoading(startedAt,loadedIndex=null,selectedDifficulty=null){
    let elapsed=performance.now()-startedAt;
    let remaining=Math.max(0,620-elapsed);
    setTimeout(()=>{
      setPlanetPendingButton(null);
      if(Number.isFinite(loadedIndex)) updatePlanetSelectionButtons(loadedIndex);
      if(selectedDifficulty) applyStartDifficultySelection(selectedDifficulty);
      setStartPlanetLoading(false);
      updateStartupLoadingState();
      updateLoadGameButton();
    },remaining);
  }
  function updatePlanetSelectionButtons(selectedIndex){
    startScreen.querySelectorAll("[data-planet]").forEach(button=>{
      let index=Number(button.dataset.planet);
      let environment=worldEnvironments[index];
      let completed=environmentMissionCompleted(environment);
      let selectable=planetSelectable(environment);
      button.classList.toggle("is-selected",index===selectedIndex);
      button.classList.toggle("is-completed",completed);
      button.classList.toggle("is-locked",!selectable);
      button.disabled=!selectable;
      button.textContent=!selectable
        ? `${environment.name || `Planet ${index+1}`} - locked`
        : completed
        ? `${environment.name || `Planet ${index+1}`} - completed`
        : environment.name || `Planet ${index+1}`;
    });
    startScreen.dataset.environmentIndex=String(selectedIndex);
  }
  function initPlanetSelectionMenu(){
    let planetOptions=startScreen.querySelector("[data-planet-options]");
    if(!planetOptions) return;
    planetOptions.textContent="";
    let selectedIndex=worldEnvironments.indexOf(currentEnvironment);
    if(selectedIndex<0) selectedIndex=0;
    if(!planetSelectable(worldEnvironments[selectedIndex])){
      selectedIndex=firstSelectablePlanetIndex();
      currentEnvironment=worldEnvironments[selectedIndex] || currentEnvironment;
      updatePlanetNameDisplay();
    }
    worldEnvironments.forEach((environment,index)=>{
      let button=document.createElement("button");
      button.type="button";
      button.dataset.planet=String(index);
      let completed=environmentMissionCompleted(environment);
      let selectable=planetSelectable(environment);
      button.textContent=!selectable
        ? `${environment.name || `Planet ${index+1}`} - locked`
        : completed
        ? `${environment.name || `Planet ${index+1}`} - completed`
        : environment.name || `Planet ${index+1}`;
      button.classList.toggle("is-selected",index===selectedIndex);
      button.classList.toggle("is-completed",completed);
      button.classList.toggle("is-locked",!selectable);
      button.disabled=!selectable;
      planetOptions.appendChild(button);
    });
    startScreen.dataset.environmentIndex=String(selectedIndex);
  }
  refreshStartPlanetButtons=()=>{
    let selectedIndex=Number(startScreen.dataset.environmentIndex);
    if(!Number.isFinite(selectedIndex)) selectedIndex=worldEnvironments.indexOf(currentEnvironment);
    updatePlanetSelectionButtons(selectedIndex);
  };
  initPlanetSelectionMenu();
  startPlanetPreview=initStartPlanetPreview();
  if(startPlanetPreview) startPlanetPreview.setEnvironment(currentEnvironment);
  function startActionForTarget(target){
    let loadButton=target && target.closest("[data-load-game]");
    if(loadButton && !loadButton.disabled) return "load";
    let modeButton=target && target.closest("[data-mode]");
    if(modeButton && !modeButton.disabled) return "mode";
    return null;
  }
  startScreen.addEventListener("pointerdown",event=>{
    if(!startupAssetsReady || gameStarted || startPlanetLoading) return;
    if(automaticFullscreenEnabled && startActionForTarget(event.target)) showFullscreenTransitionOverlay();
  },true);
  startScreen.addEventListener("click",event=>{
    let clickedMenuButton=event.target.closest("[data-planet], [data-load-game], [data-mode], [data-difficulty]");
    if(clickedMenuButton && !clickedMenuButton.disabled) playMenuClickFeedback();

    let planetButton=event.target.closest("[data-planet]");
    if(planetButton && !planetButton.disabled && !gameStarted && !startPlanetLoading){
      let index=Number(planetButton.dataset.planet);
      if(Number.isFinite(index)){
        let loadingStartedAt=performance.now();
        let selectedDifficulty=selectedStartDifficulty();
        setPlanetPendingButton(index);
        setStartPlanetLoading(true);
        requestAnimationFrame(()=>{
          setTimeout(()=>{
            try{
              selectStartEnvironment(index);
            }finally{
              finishStartPlanetLoading(loadingStartedAt,index,selectedDifficulty);
            }
          },140);
        });
      }
      return;
    }

    if(!startupAssetsReady || startPlanetLoading) return;

    let loadButton=event.target.closest("[data-load-game]");
    if(loadButton && !loadButton.disabled && !gameStarted){
      if(automaticFullscreenEnabled) showFullscreenTransitionOverlay();
      requestBrowserFullscreen();
      let status=readSavedGameStatus();
      if(status) startGame(status.mode,status.difficulty,status);
      else updateLoadGameButton();
      return;
    }

    let button=event.target.closest("[data-mode]");
    if(!button || button.disabled || gameStarted) return;
    if(!planetSelectable(currentEnvironment)){
      selectStartEnvironment(firstSelectablePlanetIndex());
      refreshStartPlanetButtons();
      return;
    }
    if(automaticFullscreenEnabled) showFullscreenTransitionOverlay();
    requestBrowserFullscreen();
    let difficulty=selectedStartDifficulty();
    startGame(button.dataset.mode==="double" ? "double" : "single",difficulty);
  });
}

setupMorphModels(playerCar,0xb83a32);
setupMorphModels(secondCar,0x2f66d8);
setCarActive(playerCar,true);
setCarActive(secondCar,false);

let startupAssetPromises=[];

startupAssetPromises.push(trackStartupAsset(loadBackPackModel()
  .then(model=>{
    attachBackPackToPlayerRobot(playerCar,model);
    attachBackPackToPlayerRobot(secondCar,model);
  })
  .catch(error=>{
    console.error("Failed to load backpack model:",error);
  })));

startupAssetPromises.push(trackStartupAsset(loadCarModel()
  .then(model=>{
    setMorphCarModel(playerCar,model.clone(true));
    setMorphCarModel(secondCar,model.clone(true));
  })
  .catch(error=>{
    console.error("Failed to load car model:",error);
  })));

startupAssetPromises.push(trackStartupAsset(loadJetModel(0xb83a32)
  .then(model=>{
    setMorphJetModel(playerCar,model);
  })
  .catch(error=>{
    console.error("Failed to load player hovercraft model:",error);
  })));

startupAssetPromises.push(trackStartupAsset(loadJetModel(0x2f66d8)
  .then(model=>{
    setMorphJetModel(secondCar,model);
  })
  .catch(error=>{
    console.error("Failed to load second hovercraft model:",error);
  })));

startupAssetPromises.push(trackStartupAsset(loadEnemyBattleShipModel()
  .then(model=>{
    enemyShipModel=model;
  })
  .catch(error=>{
    console.error("Failed to load enemy ship model:",error);
  })));

startupAssetPromises.push(trackStartupAsset(loadEnemyBuggyModel()
  .then(model=>{
    enemyBuggyModel=model;
  })
  .catch(error=>{
    console.error("Failed to load enemy buggy model:",error);
  })));

startupAssetPromises.push(trackStartupAsset(loadLandingSpaceModel()
  .then(model=>{
    world.setLandingSpaceModel(model);
  })
  .catch(error=>{
    console.error("Failed to load landing space model:",error);
  })));

startupAssetPromises.push(trackStartupAsset(loadTreasureChestModels()
  .then(models=>{
    if(world.setTreasureChestModels) world.setTreasureChestModels(models);
  })
  .catch(error=>{
    console.error("Failed to load treasure chest models:",error);
  })));

startupAssetPromises.push(trackStartupAsset(loadBaseStationModel()
  .then(model=>{
    baseStationModel=model;
    placeTradingOutpostNearStart(currentStartInfo);
    placeTestingTradingOutpostNearHomeBase();
    if(gameStarted && !currentGameFromSave && !startSequence) placeStartingCarsAtBaseEntrance(gameMode,false);
  })
  .catch(error=>{
    console.error("Failed to load base station model:",error);
  })));

startupAssetPromises.push(trackStartupAsset(loadTradingOutpostModel()
  .then(model=>{
    tradingOutpostModel=model;
    placeTestingTradingOutpostNearHomeBase();
    updateRareTradingOutposts();
  })
  .catch(error=>{
    console.error("Failed to load trading outpost model:",error);
  })));

Promise.allSettled(startupAssetPromises).then(finishStartupAssetLoading);

function placeCarOnOpenField(car,startInfo){
  let point=roadPointForOffset(startInfo.z,startInfo.fieldOffset+car.lateralOffset);
  car.x=point.x;
  car.z=point.z;
  car.angle=startInfo.angle;
  car.velAngle=startInfo.angle;
  car.speed=0;
  car.throttleEase=0;
  car.turnInputEase=0;
  car.turnVelocity=0;
  car.speedDelta=0;
  car.movementCompression=0;
  car.movementLean=0;
  car.movementPitch=0;
  car.throttleInput=0;
  car.liftInput=0;
  car.surfaceDistance=roadDistance(car.x,car.z);
  car.slipAmount=0;
  car.onGround=true;
  car.airborne=false;
  car.vy=0;
  car.trickPitch=0;
  car.trickRoll=0;
  car.trickYaw=0;
  car.trickPitchVel=0;
  car.trickRollVel=0;
  car.trickYawVel=0;
  car.morphed=false;
  car.morphProgress=0;
  car.lastMorphProgress=0;
  car.lastMorphButton=false;
  car.jetMode=false;
  car.jetProgress=0;
  car.jetBank=0;
  car.jetHoverSurfaceY=drivingSurfaceHeight(car.x,car.z);
  car.jetAltitudeTarget=car.jetHoverSurfaceY+jetHoverGroundClearance;
  car.jetLandingTransformLift=0;
  car.jetLandingTransformStartLift=0;
  car.landingReleaseFrames=0;
  car.landedOnPad=false;
  car.jetAutoLandToRobot=false;
  car.landingSequenceVoicePlayed=false;
  car.lastJetButton=false;
  car.aimOffsetX=0;
  car.aimOffsetY=0;
  car.aimDistance=32;
  car.headLookYaw=0;
  car.hasMouseAimPoint=false;
  car.hasGamepadAimPoint=false;
  car.controllerAimOffsetX=0;
  car.controllerAimOffsetY=0;
  car.mouseAimWorldX=0;
  car.mouseAimWorldY=0;
  car.mouseAimWorldZ=0;
  car.cameraY=NaN;
  car.cameraLookY=NaN;
  car.cameraPitchOffset=0;
  car.cameraDownhillAmount=0;
  car.lastAimMouseVersion=input.mouse.version;
  if(car.aimCross) car.aimCross.position.set(0,3.15,32);
  car.lastRocketButton=false;
  car.rocketLauncherSide=1;
  car.rocketCooldown=0;
  car.rocketAmmo=maxRocketAmmo();
  car.carRocketAmmo=maxCarRocketAmmo();
  car.lastCannonButton=false;
  car.cannonCooldown=0;
  car.cannonAmmo=maxCannonAmmo();
  car.lastLaserButton=false;
  car.laserFireFrames=0;
  car.laserCooldown=0;
  car.laserDamageTick=0;
  clearPlayerLaserBeam(car);
  car.clusterBombCooldown=0;
  car.clusterBombAmmo=initialClusterBombAmmo;
  car.boostCharge=maxBoostCharge;
  car.hoverInputActive=false;
  car.fuel=maxFuel;
  car.hitRattle=0;
  car.hitRattleSeed=0;
  car.walkCycle=0;
  car.lastWalkX=car.x;
  car.lastWalkZ=car.z;
  car.y=drivingSurfaceHeight(car.x,car.z);
  car.renderY=car.y;
  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle;
  car.group.rotation.x=0;
  car.group.rotation.z=0;
  updateMechAnimation(car);
  updateMorphVisual(car);
}

function createStartBeam(x,z,surfaceY){
  let height=58;
  let radius=5.4;
  let beamMat=teleportBeamMat.clone();
  beamMat.color.set(0x9fe9ff);
  beamMat.opacity=0;
  let beam=new THREE.Mesh(teleportBeamGeo,beamMat);
  beam.position.set(x,surfaceY+height*0.5,z);
  beam.scale.set(radius,height,radius);
  beam.renderOrder=34;
  scene.add(beam);

  let coreMat=teleportBeamMat.clone();
  coreMat.color.set(0xffffff);
  coreMat.opacity=0;
  let core=new THREE.Mesh(teleportBeamGeo,coreMat);
  core.position.copy(beam.position);
  core.scale.set(0.72,height*1.04,0.72);
  core.renderOrder=36;
  scene.add(core);

  let ringMat=explosionRingMat.clone();
  ringMat.color.set(0xb7f4ff);
  ringMat.opacity=0;
  let ring=new THREE.Mesh(teleportRingGeo,ringMat);
  ring.position.set(x,surfaceY+0.16,z);
  ring.rotation.x=Math.PI/2;
  ring.scale.setScalar(radius*0.46);
  ring.renderOrder=35;
  scene.add(ring);

  return {beam,core,ring,beamMat,coreMat,ringMat,height,radius};
}

function disposeStartBeam(beam){
  if(!beam) return;
  scene.remove(beam.beam,beam.core,beam.ring);
  if(beam.beamMat) beam.beamMat.dispose();
  if(beam.coreMat) beam.coreMat.dispose();
  if(beam.ringMat) beam.ringMat.dispose();
}

function clearStartSequence(){
  if(!startSequence) return;
  if(startSequence.beamSound && motorAudio.stopIntroBeamSound){
    motorAudio.stopIntroBeamSound(startSequence.beamSound);
  }
  for(let entry of startSequence.entries || []){
    disposeStartBeam(entry.beam);
    if(entry.car){
      entry.car.group.scale.setScalar(1);
      entry.car.group.visible=true;
      if(entry.car.shadow && entry.car.shadow.setVisible) entry.car.shadow.setVisible(true);
      entry.car.startSequenceLocked=false;
    }
  }
  startSequence=null;
}

function baseEntranceStartPoint(lateralSlot=0){
  if(!tradingOutpostCollision) return null;

  let shell=tradingOutpostCollision.solidShell;
  let floor=tradingOutpostCollision.floor;
  let entranceHalfWidth=shell && Number.isFinite(shell.entranceHalfWidth)
    ? shell.entranceHalfWidth
    : 12;
  let localX=clamp(lateralSlot,-entranceHalfWidth*0.55,entranceHalfWidth*0.55);
  let frontZ=shell && Number.isFinite(shell.front)
    ? shell.front
    : floor && Number.isFinite(floor.maxZ)
    ? floor.maxZ
    : 0;
  let local={x:localX,z:frontZ+64};
  let worldPoint=tradingOutpostLocalToWorld(local,tradingOutpostCollision);
  let lookPoint=tradingOutpostLocalToWorld({x:localX,z:frontZ+96},tradingOutpostCollision);
  if(!worldPoint) return null;

  let surfaceY=drivingSurfaceHeight(worldPoint.x,worldPoint.z);
  let facing=lookPoint
    ? Math.atan2(lookPoint.x-worldPoint.x,lookPoint.z-worldPoint.z)
    : tradingOutpostCollision.angle+Math.PI;
  return {
    x:worldPoint.x,
    z:worldPoint.z,
    y:surfaceY,
    angle:facing
  };
}

function setCarAtStartPoint(car,point,beamIntro=false){
  if(!car || !point) return null;

  let finalY=drivingSurfaceHeight(point.x,point.z);
  let startY=finalY+54;
  car.x=point.x;
  car.z=point.z;
  car.y=beamIntro ? startY : finalY;
  car.renderY=car.y;
  car.jetLandingTransformLift=0;
  car.jetLandingTransformStartLift=0;
  car.angle=point.angle;
  car.velAngle=point.angle;
  car.cameraYaw=point.angle;
  car.speed=0;
  car.throttleEase=0;
  car.turnInputEase=0;
  car.turnVelocity=0;
  car.speedDelta=0;
  car.surfaceDistance=roadDistance(car.x,car.z);
  car.vy=0;
  car.onGround=!beamIntro;
  car.airborne=beamIntro;
  car.lastWalkX=car.x;
  car.lastWalkZ=car.z;
  car.jetHoverSurfaceY=finalY;
  car.jetAltitudeTarget=car.jetHoverSurfaceY+jetHoverGroundClearance;
  car.startSequenceLocked=beamIntro;
  car.group.scale.setScalar(beamIntro ? 0.08 : 1);
  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle;
  car.group.rotation.x=0;
  car.group.rotation.z=0;
  updateMechAnimation(car);
  updateMorphVisual(car);
  return {
    car,
    x:car.x,
    z:car.z,
    finalY,
    startY,
    angle:car.angle,
    beam:beamIntro ? createStartBeam(car.x,car.z,finalY) : null
  };
}

function placeStartingCarsAtBaseEntrance(mode,beamIntro=true){
  clearStartSequence();

  let entries=[];
  let playerPoint=baseEntranceStartPoint(mode==="double" ? -4.5 : 0);
  if(!playerPoint){
    playerPoint={
      x:playerCar.x,
      z:playerCar.z,
      y:drivingSurfaceHeight(playerCar.x,playerCar.z),
      angle:playerCar.angle
    };
  }
  let playerEntry=setCarAtStartPoint(playerCar,playerPoint,beamIntro);
  if(playerEntry) entries.push(playerEntry);

  if(mode==="double"){
    let secondPoint=baseEntranceStartPoint(4.5) || {
      x:secondCar.x,
      z:secondCar.z,
      y:drivingSurfaceHeight(secondCar.x,secondCar.z),
      angle:secondCar.angle
    };
    let secondEntry=setCarAtStartPoint(secondCar,secondPoint,beamIntro);
    if(secondEntry) entries.push(secondEntry);
  }

  if(beamIntro && entries.length){
    startSequence={
      age:0,
      beamStartFrames:120,
      spawnStartFrames:240,
      duration:560,
      beamFrames:190,
      blendStart:468,
      entries
    };
  }
  setDistantMoonDirectionForHeading(playerCar.cameraYaw);
}

function moveCarToBaseStart(car,lateralSlot=0){
  if(!car || !tradingOutpostCollision || !tradingOutpostCollision.floor) return false;

  let floor=tradingOutpostCollision.floor;
  let safeX=Math.max(floor.minX+10,Math.min(floor.maxX-10,lateralSlot));
  let candidateZ=[
    floor.maxZ-15,
    (floor.minZ+floor.maxZ)*0.5,
    floor.minZ+13
  ];
  let chosen=null;

  for(let z of candidateZ){
    let local={x:safeX,z:Math.max(floor.minZ+9,Math.min(floor.maxZ-9,z))};
    let worldPoint=tradingOutpostLocalToWorld(local,tradingOutpostCollision);
    if(!worldPoint) continue;
    if(collidesWithTradingOutpostWalls(car,worldPoint.x,worldPoint.z)) continue;
    chosen=worldPoint;
    break;
  }

  if(!chosen){
    chosen=tradingOutpostLocalToWorld({
      x:safeX,
      z:(floor.minZ+floor.maxZ)*0.5
    },tradingOutpostCollision);
  }
  if(!chosen) return false;

  car.x=chosen.x;
  car.z=chosen.z;
  car.y=drivingSurfaceHeight(car.x,car.z);
  car.renderY=car.y;
  car.jetLandingTransformLift=0;
  car.jetLandingTransformStartLift=0;
  let terminalWorld=tradingOutpostCollision.terminal
    ? tradingOutpostLocalToWorld(tradingOutpostCollision.terminal,tradingOutpostCollision)
    : null;
  let facing=terminalWorld
    ? Math.atan2(terminalWorld.x-car.x,terminalWorld.z-car.z)
    : tradingOutpostCollision.angle;
  car.angle=facing;
  car.velAngle=facing;
  car.cameraYaw=facing;
  car.speed=0;
  car.throttleEase=0;
  car.turnInputEase=0;
  car.turnVelocity=0;
  car.speedDelta=0;
  car.surfaceDistance=roadDistance(car.x,car.z);
  car.vy=0;
  car.onGround=true;
  car.airborne=false;
  car.lastWalkX=car.x;
  car.lastWalkZ=car.z;
  car.jetHoverSurfaceY=car.y;
  car.jetAltitudeTarget=car.jetHoverSurfaceY+jetHoverGroundClearance;
  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle;
  car.group.rotation.x=0;
  car.group.rotation.z=0;
  updateMechAnimation(car);
  updateMorphVisual(car);
  return true;
}

function placeStartingCarsInsideBase(mode){
  moveCarToBaseStart(playerCar,mode==="double" ? -5.5 : 0);
  if(mode==="double") moveCarToBaseStart(secondCar,5.5);
  setDistantMoonDirectionForHeading(playerCar.cameraYaw);
}

function isCarInStartSequence(car){
  return !!(startSequence && car && car.startSequenceLocked);
}

function updateStartSequence(){
  if(!startSequence) return;

  startSequence.age++;
  let age=startSequence.age;
  let beamStartFrames=startSequence.beamStartFrames || startSequence.preludeFrames || 0;
  let spawnStartFrames=startSequence.spawnStartFrames || beamStartFrames;
  let beamVisualAge=Math.max(0,age-beamStartFrames);
  let beamAge=Math.max(0,age-spawnStartFrames);
  let beamStarted=age>=beamStartFrames;
  let spawnStarted=age>=spawnStartFrames;
  let beamFrames=startSequence.beamFrames || 96;
  let duration=startSequence.duration || 210;
  let fadeOut=clamp((beamAge-beamFrames)/Math.max(1,duration-spawnStartFrames-beamFrames),0,1);
  if(beamStarted && !startSequence.beamSoundStarted){
    startSequence.beamSoundStarted=true;
    let firstEntry=startSequence.entries && startSequence.entries[0];
    if(firstEntry && motorAudio.startIntroBeamSound){
      startSequence.beamSound=motorAudio.startIntroBeamSound({
        x:firstEntry.x,
        y:firstEntry.finalY,
        z:firstEntry.z
      });
    }
  }

  for(let entry of startSequence.entries || []){
    let car=entry.car;
    if(!car) continue;

    let descendT=smoothStep(clamp((beamAge-6)/Math.max(1,beamFrames-24),0,1));
    let scaleT=smoothStep(clamp((beamAge-18)/Math.max(1,beamFrames-28),0,1));
    let y=entry.startY+(entry.finalY-entry.startY)*descendT;
    let scale=spawnStarted ? 0.08+scaleT*0.92 : 0.001;
    car.x=entry.x;
    car.z=entry.z;
    car.y=y;
    car.renderY=car.y;
    car.jetLandingTransformLift=0;
    car.jetLandingTransformStartLift=0;
    car.speed=0;
    car.vy=0;
    car.throttleEase=0;
    car.turnInputEase=0;
    car.turnVelocity=0;
    car.onGround=spawnStarted && beamAge>=beamFrames-8;
    car.airborne=!car.onGround;
    car.group.visible=spawnStarted;
    if(car.shadow && car.shadow.setVisible) car.shadow.setVisible(spawnStarted);
    car.group.position.set(car.x,car.y,car.z);
    car.group.rotation.y=car.angle;
    car.group.rotation.x=0;
    car.group.rotation.z=0;
    car.group.scale.setScalar(scale);
    updateMechAnimation(car);
    updateMorphVisual(car);
    car.shadow.update({carX:car.x,carZ:car.z,carY:car.y,surfaceY:entry.finalY,carVelAngle:car.angle});

    if(entry.beam){
      let beamFade=1-fadeOut;
      let beamIn=smoothStep(clamp(beamVisualAge/36,0,1));
      let pulse=1+Math.sin(beamVisualAge*0.19)*0.035;
      entry.beam.beam.scale.set(
        entry.beam.radius*(0.92+descendT*0.28)*pulse,
        entry.beam.height,
        entry.beam.radius*(0.92+descendT*0.28)*pulse
      );
      entry.beam.core.scale.set(
        0.7+Math.sin(beamVisualAge*0.24)*0.08,
        entry.beam.height*1.04,
        0.7+Math.sin(beamVisualAge*0.24)*0.08
      );
      entry.beam.beamMat.opacity=beamStarted ? 0.34*beamFade*beamIn : 0;
      entry.beam.coreMat.opacity=beamStarted ? 0.58*beamFade*(1-descendT*0.35)*beamIn : 0;
      entry.beam.ring.scale.setScalar(entry.beam.radius*(0.44+descendT*1.15+fadeOut*0.8));
      entry.beam.ringMat.opacity=beamStarted ? 0.82*beamFade*beamIn : 0;
    }
  }

  maybeStartTestingTerraformFinale();

  if(age>=duration){
    clearStartSequence();
  }
}

function applyStartSequenceCameraForCar(car){
  if(!startSequence || !car) return;
  let entry=(startSequence.entries || []).find(item=>item.car===car);
  if(!entry) return;

  startSequenceNormalPos.copy(car.camera.position);
  startSequenceNormalQuat.copy(car.camera.quaternion);

  let age=startSequence.age;
  let duration=startSequence.duration || 210;
  let beamStartFrames=startSequence.beamStartFrames || startSequence.preludeFrames || 0;
  let spawnStartFrames=startSequence.spawnStartFrames || beamStartFrames;
  let beamAge=Math.max(0,age-spawnStartFrames);
  let spawnFollow=smoothStep(clamp(beamAge/70,0,1));
  let blendStart=startSequence.blendStart || 118;
  let blend=smoothStep(clamp((age-blendStart)/Math.max(1,duration-blendStart),0,1));
  let skyHold=age<spawnStartFrames ? 1 : 1-smoothStep(clamp((age-spawnStartFrames)/150,0,1));
  let materialize=clamp(beamAge/Math.max(1,startSequence.beamFrames || 96),0,1);
  let heading=entry.angle;
  let orbit=Math.sin(age*0.012)*0.18;
  let cameraYaw=heading-orbit;
  let side=gameMode==="double" && car===secondCar ? -1 : 1;

  let trackedY=entry.finalY+(car.y-entry.finalY)*spawnFollow;
  let groundCamX=entry.x-Math.sin(cameraYaw)*28+Math.cos(cameraYaw)*side*10;
  let groundCamY=entry.finalY+7.8+Math.sin(age*0.035)*0.25;
  let groundCamZ=entry.z-Math.cos(cameraYaw)*28-Math.sin(cameraYaw)*side*10;
  let skyCamX=entry.x-Math.sin(heading)*12+Math.cos(heading)*side*4;
  let skyCamY=entry.finalY+7.4;
  let skyCamZ=entry.z-Math.cos(heading)*12-Math.sin(heading)*side*4;

  startSequenceCameraPos.set(
    skyCamX*skyHold+groundCamX*(1-skyHold),
    skyCamY*skyHold+groundCamY*(1-skyHold),
    skyCamZ*skyHold+groundCamZ*(1-skyHold)
  );
  startSequenceLookAt.set(
    entry.x+Math.sin(heading)*22*skyHold,
    entry.finalY+110*skyHold+(trackedY-entry.finalY+3.2+materialize*1.4)*(1-skyHold),
    entry.z+Math.cos(heading)*22*skyHold
  );

  car.camera.position.copy(startSequenceCameraPos);
  car.camera.lookAt(startSequenceLookAt);
  if(blend>0){
    car.camera.position.lerp(startSequenceNormalPos,blend);
    car.camera.quaternion.slerp(startSequenceNormalQuat,blend);
  }
}

function clearTradingOutpost(){
  if(tradingOutpost) scene.remove(tradingOutpost);
  tradingOutpost=null;
  tradingOutpostCollision=null;
  tradingTerminalObject=null;
}

function clearTestingTradingOutpost(){
  if(!testingTradingOutpost) return;

  unregisterTradingPlaceCollision(testingTradingOutpost);
  if(testingTradingOutpost.object) scene.remove(testingTradingOutpost.object);
  testingTradingOutpost=null;
}

function clearTestingRadarOutpost(){
  if(world && world.clearTestingRadarOutpost) world.clearTestingRadarOutpost();
  scannedRadarOutposts.delete("testing-home-radar-outpost");
  if(hud) hud.updateMapHud(true);
}

function makeTradingOutpostCollision(x,z,angle,y,model=tradingOutpostModel,object=null,terminalObject=null,terminalMode="trading"){
  let modelData=model ? model.userData || {} : {};
  let bounds=modelData.tradingOutpostBounds || {};
  let halfX=Math.max(31,(Number.isFinite(modelData.footprintHalfX) ? modelData.footprintHalfX : 31)-3.2);
  let halfZ=Math.max(33,(Number.isFinite(modelData.footprintHalfZ) ? modelData.footprintHalfZ : 33)-3.2);
  let minX=Number.isFinite(bounds.wallMinX) ? bounds.wallMinX : -halfX;
  let maxX=Number.isFinite(bounds.wallMaxX) ? bounds.wallMaxX : halfX;
  let minZ=Number.isFinite(bounds.wallMinZ) ? bounds.wallMinZ : -halfZ;
  let maxZ=Number.isFinite(bounds.wallMaxZ) ? bounds.wallMaxZ : halfZ;
  let wallLeftX=Number.isFinite(bounds.wallLeftX) ? bounds.wallLeftX : minX;
  let wallRightX=Number.isFinite(bounds.wallRightX) ? bounds.wallRightX : maxX;
  let wallMinZ=Number.isFinite(bounds.wallMinZInner) ? bounds.wallMinZInner : minZ;
  let wallMaxZ=Number.isFinite(bounds.wallMaxZInner) ? bounds.wallMaxZInner : maxZ;
  let entranceHalfWidth=Math.max(13,Math.min((wallRightX-wallLeftX)*0.24,Math.min(Math.abs(wallLeftX),Math.abs(wallRightX))*0.78));
  let wallInset=0;
  let wallRadius=2.4;
  let floorInset=1.8;
  let floorMinX=Number.isFinite(bounds.floorMinX) ? bounds.floorMinX+floorInset : minX+wallRadius;
  let floorMaxX=Number.isFinite(bounds.floorMaxX) ? bounds.floorMaxX-floorInset : maxX-wallRadius;
  let floorMinZ=Number.isFinite(bounds.floorMinZ) ? bounds.floorMinZ+floorInset : minZ+wallRadius;
  let floorMaxZ=Number.isFinite(bounds.floorMaxZ) ? bounds.floorMaxZ-floorInset : maxZ-wallRadius;
  let entranceMinX=-entranceHalfWidth;
  let entranceMaxX=entranceHalfWidth;
  let entranceBand=8;

  function addEntranceClippedWall(items,wall){
    let nearEntrance=wall.maxZ>=wallMaxZ-entranceBand
      && wall.minZ<=wallMaxZ+entranceBand
      && wall.minX<entranceMaxX
      && wall.maxX>entranceMinX;
    if(!nearEntrance){
      items.push(wall);
      return;
    }

    if(wall.kind==="segment"){
      let horizontal=Math.abs(wall.bz-wall.az)<=Math.max(0.2,(wall.r || wallRadius)*0.55)
        && Math.abs(wall.bx-wall.ax)>Math.abs(wall.bz-wall.az)*2.5;
      if(!horizontal){
        items.push(wall);
        return;
      }

      let leftEnd=Math.min(wall.ax,wall.bx);
      let rightEnd=Math.max(wall.ax,wall.bx);
      let z=(wall.az+wall.bz)*0.5;
      if(leftEnd<entranceMinX-0.5){
        items.push({...wall,ax:leftEnd,az:z,bx:Math.min(entranceMinX,rightEnd),bz:z});
      }
      if(rightEnd>entranceMaxX+0.5){
        items.push({...wall,ax:Math.max(entranceMaxX,leftEnd),az:z,bx:rightEnd,bz:z});
      }
      return;
    }

    if(wall.kind==="rect"){
      if(wall.minX<entranceMinX-0.5){
        items.push({...wall,maxX:Math.min(wall.maxX,entranceMinX)});
      }
      if(wall.maxX>entranceMaxX+0.5){
        items.push({...wall,minX:Math.max(wall.minX,entranceMaxX)});
      }
    }
  }

  let preciseWalls=Array.isArray(bounds.wallSegments)
    ? bounds.wallSegments.reduce((items,wall)=>{
      if(!wall) return items;
      if(wall.kind==="rect"
        && Number.isFinite(wall.minX)
        && Number.isFinite(wall.maxX)
        && Number.isFinite(wall.minZ)
        && Number.isFinite(wall.maxZ)){
        addEntranceClippedWall(items,{
          kind:"rect",
          minX:Math.min(wall.minX,wall.maxX),
          maxX:Math.max(wall.minX,wall.maxX),
          minZ:Math.min(wall.minZ,wall.maxZ),
          maxZ:Math.max(wall.minZ,wall.maxZ)
        });
      }else if(Number.isFinite(wall.ax)
        && Number.isFinite(wall.az)
        && Number.isFinite(wall.bx)
        && Number.isFinite(wall.bz)){
        let normalizedWall={
          kind:"segment",
          ax:wall.ax,
          az:wall.az,
          bx:wall.bx,
          bz:wall.bz,
          r:Number.isFinite(wall.r) ? Math.max(0.45,Math.min(3.0,wall.r)) : wallRadius,
          minX:Math.min(wall.ax,wall.bx),
          maxX:Math.max(wall.ax,wall.bx),
          minZ:Math.min(wall.az,wall.bz),
          maxZ:Math.max(wall.az,wall.bz)
        };
        addEntranceClippedWall(items,normalizedWall);
      }
      return items;
    },[])
    : [];
  let fallbackWalls=[
    {ax:wallLeftX,az:wallMinZ+wallInset,bx:wallLeftX,bz:wallMaxZ-wallInset,r:wallRadius},
    {ax:wallRightX,az:wallMinZ+wallInset,bx:wallRightX,bz:wallMaxZ-wallInset,r:wallRadius},
    {ax:wallLeftX+wallInset,az:wallMinZ,bx:wallRightX-wallInset,bz:wallMinZ,r:wallRadius},
    {ax:wallLeftX,az:wallMaxZ,bx:-entranceHalfWidth,bz:wallMaxZ,r:wallRadius},
    {ax:entranceHalfWidth,az:wallMaxZ,bx:wallRightX,bz:wallMaxZ,r:wallRadius}
  ];
  return {
    object,
    terminalObject,
    terminalMode,
    x,
    z,
    angle,
    y:Number.isFinite(y) ? y : carSurfaceHeight(x,z),
    floor:{
      minX:Math.min(floorMinX,floorMaxX),
      maxX:Math.max(floorMinX,floorMaxX),
      minZ:Math.min(floorMinZ,floorMaxZ),
      maxZ:Math.max(floorMinZ,floorMaxZ),
      y:Number.isFinite(bounds.floorY) ? bounds.floorY : 0
    },
    room:null,
    solidShell:terminalMode==="mission"
      ? {
        left:Math.min(wallLeftX,wallRightX),
        right:Math.max(wallLeftX,wallRightX),
        back:Math.min(wallMinZ,wallMaxZ),
        front:Math.max(wallMinZ,wallMaxZ),
        entranceHalfWidth
      }
      : null,
    terminal:tradingOutpostTerminalLocalInfo(bounds),
    walls:preciseWalls.length ? preciseWalls : fallbackWalls
  };
}

function setTradingOutpostCollision(x,z,angle,y,model=tradingOutpostModel,terminalMode="trading"){
  tradingOutpostCollision=makeTradingOutpostCollision(x,z,angle,y,model,tradingOutpost,tradingTerminalObject,terminalMode);
}

function registerTradingPlaceCollision(outpost,model=tradingOutpostModel,terminalMode="trading"){
  if(!outpost || !outpost.object) return null;

  let object=outpost.object;
  let terminalObject=object.getObjectByName("missionOutpostTerminal");
  let collision=makeTradingOutpostCollision(
    outpost.x,
    outpost.z,
    object.rotation.y || 0,
    object.position.y,
    model,
    object,
    terminalObject,
    terminalMode
  );
  tradingPlaceCollisions.push(collision);
  outpost.collision=collision;
  outpost.terminalObject=terminalObject;
  return collision;
}

function unregisterTradingPlaceCollision(outpost){
  if(!outpost || !outpost.collision) return;

  let index=tradingPlaceCollisions.indexOf(outpost.collision);
  if(index>=0) tradingPlaceCollisions.splice(index,1);
  outpost.collision=null;
  outpost.terminalObject=null;
}

function mixedPlanetColor(a,b,amount){
  return new THREE.Color(a).lerp(new THREE.Color(b),Math.max(0,Math.min(1,amount)));
}

function tintTradingOutpostForEnvironment(outpost){
  let colors=currentEnvironment.colors || {};
  let hull=mixedPlanetColor(colors.wall || 0x5a526d,colors.mid || colors.rock || 0x3f334b,0.36);
  let floor=mixedPlanetColor(colors.rock || 0x3f334b,colors.wall || 0x5a526d,0.46);
  let roof=mixedPlanetColor(colors.roof || 0x322b45,colors.rock || 0x3f334b,0.52);
  let dark=mixedPlanetColor(colors.roof || 0x322b45,colors.bark || colors.rock || 0x24133a,0.58);
  let trim=mixedPlanetColor(colors.trim || 0xa78fbd,colors.high || colors.wall || 0x5a526d,0.34);
  let pale=mixedPlanetColor(colors.shore || colors.trim || 0xa78fbd,colors.high || colors.water || 0x8dfff2,0.32);
  let glass=mixedPlanetColor(colors.water || 0x8dfff2,colors.trim || 0xa78fbd,0.28);
  let glow=new THREE.Color(colors.waterEmissive || colors.podEmissive || colors.water || colors.pod || 0x8dfff2);
  let accent=new THREE.Color(colors.podEmissive || colors.pod || colors.trim || 0xff7a32);
  let warning=mixedPlanetColor(colors.pod || 0xff6bd6,colors.roof || 0x322b45,0.28);

  function applyOutpostMaterial(material,color,options={}){
    material.color.copy(color);
    material.roughness=options.roughness ?? material.roughness ?? 0.62;
    material.metalness=options.metalness ?? material.metalness ?? 0.2;
    if(options.transparent!=null) material.transparent=options.transparent;
    if(options.opacity!=null) material.opacity=options.opacity;
    if(options.depthWrite!=null) material.depthWrite=options.depthWrite;
    if(material.emissive){
      material.emissive.copy(options.emissive || new THREE.Color(0x000000));
      material.emissiveIntensity=options.emissiveIntensity ?? 0;
    }
  }

  outpost.traverse(child=>{
    if(!child.isMesh || !child.material) return;

    let materials=Array.isArray(child.material) ? child.material : [child.material];
    let tinted=materials.map(material=>{
      let clone=material.clone();
      if(clone.name==="color_7720667"){
        applyOutpostMaterial(clone,glass,{roughness:0.14,metalness:0.08,transparent:true,opacity:0.68,depthWrite:false,emissive:glow,emissiveIntensity:0.24});
      }else if(clone.name==="color_10988977"){
        applyOutpostMaterial(clone,floor,{roughness:0.72,metalness:0.26});
      }else if(clone.name==="color_2829873"){
        applyOutpostMaterial(clone,dark,{roughness:0.78,metalness:0.5});
      }else if(clone.name==="color_16448250"){
        applyOutpostMaterial(clone,pale,{roughness:0.36,metalness:0.18,emissive:glass,emissiveIntensity:0.1});
      }else if(clone.name==="color_6383466"){
        applyOutpostMaterial(clone,hull,{roughness:0.66,metalness:0.38});
      }else if(clone.name==="color_14789940"){
        applyOutpostMaterial(clone,trim,{roughness:0.46,metalness:0.28,emissive:accent,emissiveIntensity:0.12});
      }else if(clone.name==="color_12568524"){
        applyOutpostMaterial(clone,roof,{roughness:0.7,metalness:0.3});
      }else if(clone.name==="color_4634441"){
        applyOutpostMaterial(clone,glow,{roughness:0.24,metalness:0.12,emissive:glow,emissiveIntensity:0.68});
      }else if(clone.name==="color_9771553"){
        applyOutpostMaterial(clone,warning,{roughness:0.42,metalness:0.24,emissive:accent,emissiveIntensity:0.22});
      }
      return clone;
    });

    child.material=Array.isArray(child.material) ? tinted : tinted[0];
  });
}

function updateTradingOutpostRepair(){
  if(!tradingOutpost || gameOver) return;

  let repairRadius=92;
  let repaired=false;
  for(let car of activeCars()){
    if(!car.group.visible || car.health<=0 || car.health>=100) continue;

    let dx=car.x-tradingOutpost.position.x;
    let dz=car.z-tradingOutpost.position.z;
    if(dx*dx+dz*dz>repairRadius*repairRadius) continue;

    car.health=100;
    repaired=true;
  }

  if(repaired) hud.updateHealthHud();
}

function placeTestingTradingOutpostNearHomeBase(){
  if(!testingTradingOutpostEnabled || !tradingOutpostModel || !tradingOutpost || !tradingOutpostCollision) return;

  clearTestingTradingOutpost();

  let homeX=tradingOutpost.position.x;
  let homeZ=tradingOutpost.position.z;
  let angle=tradingOutpost.rotation.y || 0;
  let forwardX=Math.sin(angle);
  let forwardZ=Math.cos(angle);
  let rightX=Math.cos(angle);
  let rightZ=-Math.sin(angle);
  let offsets=[
    {forward:0,right:170},
    {forward:0,right:-170},
    {forward:68,right:182},
    {forward:-68,right:182},
    {forward:68,right:-182},
    {forward:-68,right:-182},
    {forward:132,right:206},
    {forward:-132,right:206},
    {forward:132,right:-206},
    {forward:-132,right:-206}
  ];
  let placementOptions={
    footprintPadding:12,
    sampleDivisions:6,
    waterLimit:0.03,
    centerWaterLimit:0.06,
    roadCenterClearance:24,
    roadSampleClearance:18,
    centerObstacleRadius:24,
    sampleObstacleRadius:6,
    flatRange:1.55,
    usableRange:2.35,
    flatSlope:0.052,
    usableSlope:0.075,
    yLift:0.12
  };
  let homeClearance=126;
  let chosen=null;

  world.updateChunksForCenters(offsets.map(offset=>({
    x:homeX+forwardX*offset.forward+rightX*offset.right,
    z:homeZ+forwardZ*offset.forward+rightZ*offset.right
  })));
  world.processChunkQueue(240,true);

  for(let offset of offsets){
    let x=homeX+forwardX*offset.forward+rightX*offset.right;
    let z=homeZ+forwardZ*offset.forward+rightZ*offset.right;
    let homeDx=x-homeX;
    let homeDz=z-homeZ;
    if(homeDx*homeDx+homeDz*homeDz<homeClearance*homeClearance) continue;

    let info=tradingOutpostPlacementInfo(x,z,angle,tradingOutpostModel,placementOptions);
    if(!info || !info.usable) continue;

    let score=Math.hypot(offset.forward,offset.right)*0.22+info.range*150+info.maxSlope*1100+(info.flat ? 0 : 120);
    if(!chosen || score<chosen.score) chosen={...info,score};
  }

  if(!chosen){
    for(let offset of offsets){
      let x=homeX+forwardX*offset.forward+rightX*offset.right;
      let z=homeZ+forwardZ*offset.forward+rightZ*offset.right;
      let homeDx=x-homeX;
      let homeDz=z-homeZ;
      if(homeDx*homeDx+homeDz*homeDz<homeClearance*homeClearance) continue;

      let info=baseCampForcedPlacementInfo(x,z,angle,tradingOutpostModel);
      let score=(info.maxWater || 0)*8000+info.range*180+info.maxSlope*1300+Math.hypot(offset.forward,offset.right)*0.24;
      if(!chosen || score<chosen.score) chosen={...info,score};
    }
  }

  if(!chosen) return;

  let object=tradingOutpostModel.clone(true);
  object.position.set(chosen.x,chosen.y,chosen.z);
  object.rotation.y=angle;
  tintTradingOutpostForEnvironment(object);
  scene.add(object);

  testingTradingOutpost={
    key:"testing-home-trading-outpost",
    object,
    x:chosen.x,
    z:chosen.z
  };
  registerTradingPlaceCollision(testingTradingOutpost,tradingOutpostModel,"trading");
  scannedTradingOutposts.set(testingTradingOutpost.key,{x:chosen.x,z:chosen.z});
  if(hud) hud.updateMapHud(true);
}

function placeTestingRadarOutpostNearHomeBase(){
  if(!testingRadarOutpostEnabled || !tradingOutpost || !world || !world.placeTestRadarOutpost) return;

  clearTestingRadarOutpost();

  let homeX=tradingOutpost.position.x;
  let homeZ=tradingOutpost.position.z;
  let homeY=drivingSurfaceHeight(homeX,homeZ);
  let angle=tradingOutpost.rotation.y || 0;
  let forwardX=Math.sin(angle);
  let forwardZ=Math.cos(angle);
  let rightX=Math.cos(angle);
  let rightZ=-Math.sin(angle);
  let offsets=[
    {forward:18,right:112},
    {forward:-22,right:112},
    {forward:54,right:124},
    {forward:-58,right:124},
    {forward:18,right:-112},
    {forward:-22,right:-112},
    {forward:72,right:146},
    {forward:-86,right:146},
    {forward:72,right:-146},
    {forward:-86,right:-146}
  ];

  world.updateChunksForCenters(offsets.map(offset=>({
    x:homeX+forwardX*offset.forward+rightX*offset.right,
    z:homeZ+forwardZ*offset.forward+rightZ*offset.right,
    viewDistance:1
  })));
  world.processChunkQueue(160,true);

  let chosen=null;
  let fallback=null;
  for(let offset of offsets){
    let x=homeX+forwardX*offset.forward+rightX*offset.right;
    let z=homeZ+forwardZ*offset.forward+rightZ*offset.right;
    let distance=Math.hypot(x-homeX,z-homeZ);
    if(distance<86) continue;

    let water=waterDepthAt(x,z);
    let slope=terrainSlopeAt(x,z);
    let heightDelta=Math.abs(drivingSurfaceHeight(x,z)-homeY);
    let obstacle=world.obstacleAt ? world.obstacleAt(x,z,18) : null;
    if(obstacle) continue;

    let score=distance*0.18+water*900+slope*640+heightDelta*18;
    if(water<=0.1 && slope<0.16 && heightDelta<4.5){
      if(!chosen || score<chosen.score) chosen={x,z,score};
    }else if(water<=0.45 && slope<0.28){
      if(!fallback || score<fallback.score) fallback={x,z,score};
    }
  }

  let spot=chosen || fallback;
  if(!spot) return;

  let collider=world.placeTestRadarOutpost(spot.x,spot.z,angle+Math.PI*0.34);
  if(!collider) return;

  scannedRadarOutposts.set("testing-home-radar-outpost",{
    x:collider.x,
    z:collider.z,
    r:collider.r || 8
  });
  if(hud) hud.updateMapHud(true);
}

function tradingOutpostFootprintSize(model=tradingOutpostModel){
  let modelData=model ? model.userData || {} : {};
  let bounds=modelData.tradingOutpostBounds || {};
  let halfX=Number.isFinite(bounds.floorMinX) && Number.isFinite(bounds.floorMaxX)
    ? Math.max(Math.abs(bounds.floorMinX),Math.abs(bounds.floorMaxX))
    : modelData.footprintHalfX;
  let halfZ=Number.isFinite(bounds.floorMinZ) && Number.isFinite(bounds.floorMaxZ)
    ? Math.max(Math.abs(bounds.floorMinZ),Math.abs(bounds.floorMaxZ))
    : modelData.footprintHalfZ;

  return {
    halfX:Math.max(32,halfX || 32)+4,
    halfZ:Math.max(34,halfZ || 34)+4
  };
}

function tradingOutpostPlacementInfo(x,z,angle,model=tradingOutpostModel,options={}){
  let waterLimit=Number.isFinite(options.waterLimit) ? options.waterLimit : 0.08;
  let centerWaterLimit=Number.isFinite(options.centerWaterLimit) ? options.centerWaterLimit : Math.max(0.18,waterLimit);
  let roadCenterClearance=Number.isFinite(options.roadCenterClearance) ? options.roadCenterClearance : 42;
  let roadSampleClearance=Number.isFinite(options.roadSampleClearance) ? options.roadSampleClearance : 30;
  let centerObstacleRadius=Number.isFinite(options.centerObstacleRadius) ? options.centerObstacleRadius : 22;
  let sampleObstacleRadius=Number.isFinite(options.sampleObstacleRadius) ? options.sampleObstacleRadius : 5;
  let sampleDivisions=Math.max(4,Math.floor(options.sampleDivisions || 4));
  let footprintPadding=Number.isFinite(options.footprintPadding) ? options.footprintPadding : 0;
  let flatRange=Number.isFinite(options.flatRange) ? options.flatRange : 1.65;
  let usableRange=Number.isFinite(options.usableRange) ? options.usableRange : 2.6;
  let flatSlope=Number.isFinite(options.flatSlope) ? options.flatSlope : 0.045;
  let usableSlope=Number.isFinite(options.usableSlope) ? options.usableSlope : 0.075;
  let yLift=Number.isFinite(options.yLift) ? options.yLift : 0.04;

  if(waterDepthAt(x,z)>centerWaterLimit) return null;
  if(groundHoleAt(x,z)) return null;
  if(roadDistance(x,z)<roadCenterClearance) return null;
  if(world.collidesWithObstacles(x,z,centerObstacleRadius)) return null;

  let footprint=tradingOutpostFootprintSize(model);
  footprint.halfX+=footprintPadding;
  footprint.halfZ+=footprintPadding;
  let c=Math.cos(angle);
  let s=Math.sin(angle);
  let steps=[];
  for(let i=0;i<=sampleDivisions;i++){
    steps.push(-1+(i/sampleDivisions)*2);
  }
  let heights=[];
  let minH=Infinity;
  let maxH=-Infinity;
  let maxSlope=0;

  for(let ix=0;ix<steps.length;ix++){
    heights[ix]=[];
    for(let iz=0;iz<steps.length;iz++){
      let localX=steps[ix]*footprint.halfX;
      let localZ=steps[iz]*footprint.halfZ;
      let wx=x+localX*c+localZ*s;
      let wz=z-localX*s+localZ*c;

      if(waterDepthAt(wx,wz)>waterLimit) return null;
      if(groundHoleAt(wx,wz)) return null;
      if(roadDistance(wx,wz)<roadSampleClearance) return null;
      if(world.collidesWithObstacles(wx,wz,sampleObstacleRadius)) return null;

      let h=groundHeight(wx,wz);
      heights[ix][iz]=h;
      minH=Math.min(minH,h);
      maxH=Math.max(maxH,h);

      if(ix>0){
        let distance=(steps[ix]-steps[ix-1])*footprint.halfX;
        maxSlope=Math.max(maxSlope,Math.abs(h-heights[ix-1][iz])/distance);
      }
      if(iz>0){
        let distance=(steps[iz]-steps[iz-1])*footprint.halfZ;
        maxSlope=Math.max(maxSlope,Math.abs(h-heights[ix][iz-1])/distance);
      }
    }
  }

  let range=maxH-minH;
  return {
    x,
    z,
    y:maxH+yLift,
    range,
    maxSlope,
    flat:range<=flatRange && maxSlope<=flatSlope,
    usable:range<=usableRange && maxSlope<=usableSlope
  };
}

function baseCampEmergencyPlacementInfo(x,z,angle,model=baseStationModel){
  if(waterDepthAt(x,z)>0.08) return null;
  if(groundHoleAt(x,z)) return null;
  if(roadDistance(x,z)<38) return null;

  let footprint=tradingOutpostFootprintSize(model);
  footprint.halfX+=8;
  footprint.halfZ+=8;
  let c=Math.cos(angle);
  let s=Math.sin(angle);
  let steps=[-1,-0.66,-0.33,0,0.33,0.66,1];
  let heights=[];
  let minH=Infinity;
  let maxH=-Infinity;
  let maxSlope=0;

  for(let ix=0;ix<steps.length;ix++){
    heights[ix]=[];
    for(let iz=0;iz<steps.length;iz++){
      let localX=steps[ix]*footprint.halfX;
      let localZ=steps[iz]*footprint.halfZ;
      let wx=x+localX*c+localZ*s;
      let wz=z-localX*s+localZ*c;

      if(waterDepthAt(wx,wz)>0.08) return null;
      if(groundHoleAt(wx,wz)) return null;

      let h=groundHeight(wx,wz);
      heights[ix][iz]=h;
      minH=Math.min(minH,h);
      maxH=Math.max(maxH,h);

      if(ix>0){
        let distance=(steps[ix]-steps[ix-1])*footprint.halfX;
        maxSlope=Math.max(maxSlope,Math.abs(h-heights[ix-1][iz])/distance);
      }
      if(iz>0){
        let distance=(steps[iz]-steps[iz-1])*footprint.halfZ;
        maxSlope=Math.max(maxSlope,Math.abs(h-heights[ix][iz-1])/distance);
      }
    }
  }

  let range=maxH-minH;
  return {
    x,
    z,
    y:maxH+0.65,
    range,
    maxSlope,
    flat:range<=2.4 && maxSlope<=0.085,
    usable:true
  };
}

function baseCampForcedPlacementInfo(x,z,angle,model=baseStationModel){
  let footprint=tradingOutpostFootprintSize(model);
  footprint.halfX+=8;
  footprint.halfZ+=8;
  let c=Math.cos(angle);
  let s=Math.sin(angle);
  let steps=[-1,-0.5,0,0.5,1];
  let heights=[];
  let minH=Infinity;
  let maxH=-Infinity;
  let maxSlope=0;
  let maxWater=0;

  for(let ix=0;ix<steps.length;ix++){
    heights[ix]=[];
    for(let iz=0;iz<steps.length;iz++){
      let localX=steps[ix]*footprint.halfX;
      let localZ=steps[iz]*footprint.halfZ;
      let wx=x+localX*c+localZ*s;
      let wz=z-localX*s+localZ*c;
      let h=groundHeight(wx,wz);

      heights[ix][iz]=h;
      minH=Math.min(minH,h);
      maxH=Math.max(maxH,h);
      maxWater=Math.max(maxWater,waterDepthAt(wx,wz));

      if(ix>0){
        let distance=(steps[ix]-steps[ix-1])*footprint.halfX;
        maxSlope=Math.max(maxSlope,Math.abs(h-heights[ix-1][iz])/distance);
      }
      if(iz>0){
        let distance=(steps[iz]-steps[iz-1])*footprint.halfZ;
        maxSlope=Math.max(maxSlope,Math.abs(h-heights[ix][iz-1])/distance);
      }
    }
  }

  let range=maxH-minH;
  return {
    x,
    z,
    y:Math.max(maxH,waterLevel)+0.85,
    range,
    maxSlope,
    maxWater,
    flat:false,
    usable:true
  };
}

function placeTradingOutpostNearStart(startInfo){
  if(startInfo) currentStartInfo=startInfo;
  if(!baseStationModel || !currentStartInfo) return;

  clearTradingOutpost();

  startInfo=currentStartInfo;
  let basePoint=roadPointForOffset(startInfo.z,startInfo.fieldOffset);
  let angle=startInfo.angle;
  let forwardX=Math.sin(angle);
  let forwardZ=Math.cos(angle);
  let rightX=Math.cos(angle);
  let rightZ=-Math.sin(angle);
  let baseCampPlacementOptions={
    footprintPadding:26,
    sampleDivisions:8,
    waterLimit:0.015,
    centerWaterLimit:0.03,
    roadCenterClearance:46,
    roadSampleClearance:34,
    centerObstacleRadius:30,
    sampleObstacleRadius:8,
    flatRange:1.05,
    usableRange:1.55,
    flatSlope:0.032,
    usableSlope:0.048,
    yLift:0.16
  };
  let baseCampRelaxedPlacementOptions={
    ...baseCampPlacementOptions,
    footprintPadding:18,
    waterLimit:0.025,
    centerWaterLimit:0.04,
    flatRange:1.45,
    usableRange:2.05,
    flatSlope:0.042,
    usableSlope:0.062,
    yLift:0.22
  };
  let offsets=[
    {forward:18,right:-58},
    {forward:-18,right:58},
    {forward:48,right:-54},
    {forward:-48,right:54},
    {forward:0,right:68},
    {forward:0,right:-68}
  ];
  let chosen=null;
  let best=null;
  let seenOffsets=new Set();

  function addOffset(forward,right){
    let key=`${Math.round(forward)}:${Math.round(right)}`;
    if(seenOffsets.has(key)) return;
    seenOffsets.add(key);
    offsets.push({forward,right});
  }

  for(let forward=-336;forward<=336;forward+=42){
    for(let right of [-296,-254,-212,-176,-146,-116,-88,-68,68,88,116,146,176,212,254,296]){
      addOffset(forward,right);
    }
  }
  for(let forward=-504;forward<=504;forward+=84){
    for(let right of [-464,-380,-338,338,380,464]){
      addOffset(forward,right);
    }
  }

  world.updateChunksForCenters(offsets.map(offset=>({
    x:basePoint.x+forwardX*offset.forward+rightX*offset.right,
    z:basePoint.z+forwardZ*offset.forward+rightZ*offset.right
  })));
  world.processChunkQueue(520,true);

  for(let offset of offsets){
    let x=basePoint.x+forwardX*offset.forward+rightX*offset.right;
    let z=basePoint.z+forwardZ*offset.forward+rightZ*offset.right;
    let info=tradingOutpostPlacementInfo(x,z,angle+Math.PI*0.5,baseStationModel,baseCampPlacementOptions);
    if(!info) continue;

    let distanceScore=Math.hypot(offset.forward,offset.right)*0.18;
    let score=info.range*120+info.maxSlope*900+distanceScore;
    if(!best || score<best.score) best={...info,score};
    if(info.flat && (!chosen || score<chosen.score)) chosen={...info,score};
  }

  if(!chosen && best && best.usable) chosen=best;

  if(!chosen){
    for(let offset of offsets){
      let x=basePoint.x+forwardX*offset.forward+rightX*offset.right;
      let z=basePoint.z+forwardZ*offset.forward+rightZ*offset.right;
      let info=tradingOutpostPlacementInfo(x,z,angle+Math.PI*0.5,baseStationModel,baseCampRelaxedPlacementOptions);
      if(!info || !info.usable) continue;

      let distanceScore=Math.hypot(offset.forward,offset.right)*0.18;
      let score=info.range*160+info.maxSlope*1200+distanceScore;
      if(info.flat && (!chosen || score<chosen.score)) chosen={...info,score};
      else if(!chosen || score<chosen.score) chosen={...info,score};
    }
  }

  if(!chosen){
    for(let offset of offsets){
      let x=basePoint.x+forwardX*offset.forward+rightX*offset.right;
      let z=basePoint.z+forwardZ*offset.forward+rightZ*offset.right;
      let info=baseCampEmergencyPlacementInfo(x,z,angle+Math.PI*0.5,baseStationModel);
      if(!info) continue;

      let distanceScore=Math.hypot(offset.forward,offset.right)*0.18;
      let score=info.range*220+info.maxSlope*1500+distanceScore;
      if(info.flat && (!chosen || score<chosen.score)) chosen={...info,score};
      else if(!chosen || score<chosen.score) chosen={...info,score};
    }
  }

  if(!chosen){
    let fallback=null;
    for(let offset of offsets){
      let x=basePoint.x+forwardX*offset.forward+rightX*offset.right;
      let z=basePoint.z+forwardZ*offset.forward+rightZ*offset.right;
      let info=baseCampForcedPlacementInfo(x,z,angle+Math.PI*0.5,baseStationModel);
      let distanceScore=Math.hypot(offset.forward,offset.right)*0.18;
      let roadPenalty=roadDistance(x,z)<38 ? 10000 : 0;
      let score=(info.maxWater || 0)*9000+info.range*260+info.maxSlope*1800+distanceScore+roadPenalty;
      if(!fallback || score<fallback.score) fallback={...info,score};
    }
    chosen=fallback;
    console.warn("Using raised fallback base camp placement; no fully dry, flat candidate was found.");
  }

  tradingOutpost=baseStationModel.clone(true);
  tradingTerminalObject=tradingOutpost.getObjectByName("missionOutpostTerminal");
  tradingOutpost.position.set(chosen.x,chosen.y,chosen.z);
  tradingOutpost.rotation.y=angle+Math.PI*0.5;
  tintTradingOutpostForEnvironment(tradingOutpost);
  setTradingOutpostCollision(chosen.x,chosen.z,tradingOutpost.rotation.y,tradingOutpost.position.y,baseStationModel,"mission");
  scene.add(tradingOutpost);
  placeTestingRadarOutpostNearHomeBase();
  scheduleTestingAmbientSpaceshipFormationOverHomeBase();
}

applyWorldEnvironment(currentEnvironment,{resetChunks:false,refreshNature:false});
setupStartWorldPreview();
startSimulationLoop();
loop();
