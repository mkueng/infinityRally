import { THREE } from "./three.js";
import { gravityStrength, jumpBaseBoost, jumpSlopeBoost, chunkSize, mothershipDropCount, mothershipDropInterval, mothershipDropLineSpacing, mothershipHoverDistance, mothershipHoverFrames, mothershipMinDelay, mothershipRandomDelay, mothershipRocketHits } from "./constants.js";
import { carSurfaceHeight, groundHeight, roadCenterX, roadDistance, setWorldSeed } from "./terrain.js?v=no-ramps";
import { createInput } from "./input.js";
import { createHud } from "./hud.js?v=robot-ammo-icons";
import { createAmbientMotes, createBirds, createCarShadow, createClouds, createDust, createRain, createWheelTracks } from "./effects.js?v=ambient-motes-varied";
import { createWorld } from "./world.js?v=city-districts";
import { createMotorAudio } from "./audio.js?v=mech-walk-audio";
import { loadCarModel, loadJetModel, makeMechModel } from "./models.js?v=jet-assets";
import { makeSkyTexture } from "./textures.js?v=alien-planet";

const worldEnvironments=[
  {
    name:"alien dusk",
    terrain:{heightScale:1,hillScale:1,mountainScale:1,baseHeight:0,roadWave1:220,roadWave2:80,roadWave3:25,roadFrequencyScale:1},
    sky:["#12072b","#33145f","#9c416f","#f08c71","#ffd3a5"],
    fog:0x7b4771,
    colors:{
      underwater:0x8f5a6c,shore:0xd6b25a,low:0x8b3852,mid:0x5a3b70,high:0x3f3456,
      water:0x20ffd4,waterEmissive:0x036f6d,bark:0x24133a,barkEmissive:0x12061f,
      leaf:0xb66cff,leafEmissive:0x5a22c9,pod:0xff6bd6,podEmissive:0xff2ca8,
      grass:0x9df58d,grassEmissive:0x173d18,rock:0x3f334b,wall:0x5a526d,roof:0x322b45,trim:0xa78fbd,brick:0x714060
    },
    groundTexture:{base:"#6f2d46",dark:[55,20,70],bright:[150,70,55],streak:"104,255,213"},
    rainChance:0.24,
    rainIntensity:[0.18,0.42],
    vegetation:{treeClusters:2,treesPerCluster:8,treeClusterRadius:25,crownsPerTree:7,podsPerTree:4,trunkHeightBase:1,trunkHeightVariance:0.34,trunkWidthBase:0.72,trunkWidthVariance:0.34,leanAmount:0.18,crownBaseScale:1.25,crownScaleStep:0.08,crownSpreadBase:1.1,crownSpreadVariance:2.4,crownLiftBase:9.1,crownLiftStep:0.28,crownWidthScale:1,crownFlatness:1,crownDepthScale:1,podScaleBase:0.42,podScaleVariance:0.34,podLiftBase:7.1,podLiftVariance:1.6,podElongation:1.35,grassClusters:20,grassPerCluster:400,grassClusterRadius:10}
  },
  {
    name:"crystal frost",
    terrain:{heightScale:0.9,hillScale:1.15,mountainScale:1.35,baseHeight:-1,roadWave1:170,roadWave2:115,roadWave3:34,roadFrequencyScale:0.88},
    sky:["#06182b","#123b5a","#5a8db2","#d2b4c8","#fff1dd"],
    fog:0x7fa3b9,
    colors:{
      underwater:0x315970,shore:0xc8d9cf,low:0x5f8b94,mid:0x6b7daa,high:0xc7d8db,
      water:0x7ff8ff,waterEmissive:0x0f6d80,bark:0x243340,barkEmissive:0x081318,
      leaf:0x9fd8ff,leafEmissive:0x195a70,pod:0xe8fbff,podEmissive:0x64d7ff,
      grass:0xb8ffdf,grassEmissive:0x1f5c4c,rock:0x5f6f84,wall:0x697d8a,roof:0x2f4559,trim:0xc2d6dc,brick:0x506879
    },
    groundTexture:{base:"#496b7d",dark:[38,58,76],bright:[132,170,180],streak:"210,255,255"},
    rainChance:0.18,
    rainIntensity:[0.12,0.32],
    vegetation:{treeClusters:2,treesPerCluster:7,treeClusterRadius:24,crownsPerTree:5,podsPerTree:3,trunkHeightBase:1.28,trunkHeightVariance:0.45,trunkWidthBase:0.52,trunkWidthVariance:0.22,leanAmount:0.09,crownBaseScale:1.05,crownScaleStep:0.04,crownSpreadBase:0.65,crownSpreadVariance:1.2,crownLiftBase:10.6,crownLiftStep:0.92,crownWidthScale:0.74,crownFlatness:1.65,crownDepthScale:0.74,podScaleBase:0.28,podScaleVariance:0.22,podLiftBase:9.4,podLiftVariance:2.4,podElongation:2.15,grassClusters:16,grassPerCluster:320,grassClusterRadius:11}
  },
  {
    name:"ember badlands",
    terrain:{heightScale:1.08,hillScale:0.95,mountainScale:1.5,baseHeight:1.5,roadWave1:260,roadWave2:70,roadWave3:42,roadFrequencyScale:1.12},
    sky:["#1d0612","#55151b","#9c3824","#f08b3e","#ffe0a8"],
    fog:0x9b5140,
    colors:{
      underwater:0x5d2530,shore:0xffb45f,low:0xa85233,mid:0x7a3a3a,high:0x4d3440,
      water:0xff8c45,waterEmissive:0x8a2d08,bark:0x321b18,barkEmissive:0x170604,
      leaf:0xd78f38,leafEmissive:0x6f2d08,pod:0xffdf6a,podEmissive:0xb85a00,
      grass:0xdfb65a,grassEmissive:0x5f3608,rock:0x5b3a35,wall:0x72544b,roof:0x3c2529,trim:0xd29a65,brick:0x8f4c38
    },
    groundTexture:{base:"#733823",dark:[72,31,25],bright:[172,83,44],streak:"255,185,86"},
    rainChance:0.08,
    rainIntensity:[0.1,0.24],
    vegetation:{treeClusters:1,treesPerCluster:7,treeClusterRadius:28,crownsPerTree:4,podsPerTree:6,trunkHeightBase:0.82,trunkHeightVariance:0.22,trunkWidthBase:1.05,trunkWidthVariance:0.42,leanAmount:0.34,crownBaseScale:0.96,crownScaleStep:0.12,crownSpreadBase:1.8,crownSpreadVariance:3.8,crownLiftBase:6.8,crownLiftStep:0.08,crownWidthScale:1.55,crownFlatness:0.52,crownDepthScale:1.35,podScaleBase:0.32,podScaleVariance:0.42,podLiftBase:5.8,podLiftVariance:1.2,podElongation:1.05,grassClusters:12,grassPerCluster:260,grassClusterRadius:12}
  },
  {
    name:"dschungel canopy",
    terrain:{heightScale:0.78,hillScale:1.55,mountainScale:0.62,baseHeight:-2.5,roadWave1:130,roadWave2:145,roadWave3:48,roadFrequencyScale:1.28},
    sky:["#05190f","#0d3b22","#1f7144","#79a867","#ffe4a3"],
    fog:0x2f744d,
    colors:{
      underwater:0x123f39,shore:0x8fac55,low:0x1f6f3d,mid:0x2d8a4b,high:0x537846,
      water:0x2effb8,waterEmissive:0x087a51,bark:0x1d2814,barkEmissive:0x071006,
      leaf:0x38c751,leafEmissive:0x0d5c20,pod:0xff5bbb,podEmissive:0x9c1268,
      grass:0x75ff6a,grassEmissive:0x1b6d18,rock:0x2f4d3c,wall:0x4e6747,roof:0x253921,trim:0x9cc779,brick:0x4f7241
    },
    groundTexture:{base:"#275f35",dark:[24,70,36],bright:[86,150,62],streak:"124,255,120"},
    rainChance:0.72,
    rainIntensity:[0.38,0.82],
    vegetation:{treeClusters:3,treesPerCluster:8,treeClusterRadius:34,crownsPerTree:7,podsPerTree:3,trunkHeightBase:1.55,trunkHeightVariance:0.58,trunkWidthBase:0.64,trunkWidthVariance:0.28,leanAmount:0.24,crownBaseScale:1.45,crownScaleStep:0.045,crownSpreadBase:2.0,crownSpreadVariance:3.2,crownLiftBase:11.2,crownLiftStep:0.42,crownWidthScale:1.35,crownFlatness:0.78,crownDepthScale:1.35,podScaleBase:0.26,podScaleVariance:0.2,podLiftBase:8.8,podLiftVariance:3.2,podElongation:1.8,grassClusters:24,grassPerCluster:300,grassClusterRadius:15}
  },
  {
    name:"dschungel wetlands",
    terrain:{heightScale:0.62,hillScale:1.25,mountainScale:0.35,baseHeight:-4.2,roadWave1:155,roadWave2:128,roadWave3:36,roadFrequencyScale:1.05},
    sky:["#071712","#123d36","#2c6f5f","#82a95e","#f3d98e"],
    fog:0x315f50,
    colors:{
      underwater:0x0f3834,shore:0x6f8a42,low:0x24583a,mid:0x34704a,high:0x476b43,
      water:0x35e6aa,waterEmissive:0x0a6048,bark:0x172412,barkEmissive:0x071006,
      leaf:0x2fae4f,leafEmissive:0x0a4d1d,pod:0xf0d75f,podEmissive:0x736600,
      grass:0x8be65d,grassEmissive:0x255d13,rock:0x33493c,wall:0x4d6352,roof:0x21382a,trim:0x8ebf75,brick:0x486a4b
    },
    groundTexture:{base:"#24543c",dark:[20,62,45],bright:[80,132,70],streak:"94,230,154"},
    rainChance:0.88,
    rainIntensity:[0.48,0.96],
    vegetation:{treeClusters:4,treesPerCluster:7,treeClusterRadius:38,crownsPerTree:6,podsPerTree:4,trunkHeightBase:1.2,trunkHeightVariance:0.38,trunkWidthBase:0.9,trunkWidthVariance:0.35,leanAmount:0.42,crownBaseScale:1.28,crownScaleStep:0.06,crownSpreadBase:2.7,crownSpreadVariance:2.9,crownLiftBase:8.4,crownLiftStep:0.18,crownWidthScale:1.75,crownFlatness:0.48,crownDepthScale:1.55,podScaleBase:0.22,podScaleVariance:0.22,podLiftBase:6.2,podLiftVariance:2.1,podElongation:1.2,grassClusters:25,grassPerCluster:280,grassClusterRadius:18}
  },
  {
    name:"storm archipelago",
    terrain:{heightScale:0.52,hillScale:1.05,mountainScale:0.48,baseHeight:-5.6,roadWave1:190,roadWave2:132,roadWave3:52,roadFrequencyScale:0.92},
    sky:["#03111f","#063756","#18707b","#69a7a8","#f0dca9"],
    fog:0x2d7180,
    colors:{
      underwater:0x0a3044,shore:0xd4c06f,low:0x1d6d74,mid:0x2c8b80,high:0x5d7f73,
      water:0x22d7ff,waterEmissive:0x045f78,bark:0x17313b,barkEmissive:0x041119,
      leaf:0x43d7a2,leafEmissive:0x0a5f48,pod:0xffcf67,podEmissive:0xa65f00,
      grass:0x90e68c,grassEmissive:0x1f5f25,rock:0x355365,wall:0x557477,roof:0x223548,trim:0x9fd6cc,brick:0x486569
    },
    groundTexture:{base:"#2f6b69",dark:[22,64,72],bright:[92,156,130],streak:"98,230,255"},
    rainChance:0.94,
    rainIntensity:[0.42,1],
    vegetation:{treeClusters:2,treesPerCluster:6,treeClusterRadius:42,crownsPerTree:5,podsPerTree:5,trunkHeightBase:1.05,trunkHeightVariance:0.52,trunkWidthBase:0.72,trunkWidthVariance:0.32,leanAmount:0.55,crownBaseScale:1.08,crownScaleStep:0.08,crownSpreadBase:2.6,crownSpreadVariance:3.4,crownLiftBase:7.8,crownLiftStep:0.22,crownWidthScale:1.6,crownFlatness:0.56,crownDepthScale:1.45,podScaleBase:0.3,podScaleVariance:0.28,podLiftBase:6.7,podLiftVariance:2.5,podElongation:1.35,grassClusters:18,grassPerCluster:240,grassClusterRadius:20}
  },
  {
    name:"violet mesas",
    terrain:{heightScale:1.16,hillScale:0.72,mountainScale:1.82,baseHeight:3.2,roadWave1:285,roadWave2:62,roadWave3:58,roadFrequencyScale:1.18},
    sky:["#100b24","#2f2462","#724b98","#c9798f","#ffe1ba"],
    fog:0x76548a,
    colors:{
      underwater:0x3f315f,shore:0xcaa66d,low:0x674e8b,mid:0x895d89,high:0xb08b82,
      water:0xb474ff,waterEmissive:0x4e1b8d,bark:0x2d2138,barkEmissive:0x100719,
      leaf:0xff8fd0,leafEmissive:0x8a2c68,pod:0x8dfff2,podEmissive:0x0ebdb2,
      grass:0xd0a6ff,grassEmissive:0x46306d,rock:0x6b5274,wall:0x7d667f,roof:0x3c2b4e,trim:0xdfb3d6,brick:0x86605f
    },
    groundTexture:{base:"#67487c",dark:[58,42,80],bright:[152,96,132],streak:"226,168,240"},
    rainChance:0.16,
    rainIntensity:[0.08,0.28],
    vegetation:{treeClusters:1,treesPerCluster:6,treeClusterRadius:30,crownsPerTree:4,podsPerTree:5,trunkHeightBase:1.42,trunkHeightVariance:0.62,trunkWidthBase:0.46,trunkWidthVariance:0.18,leanAmount:0.12,crownBaseScale:0.82,crownScaleStep:0.1,crownSpreadBase:0.9,crownSpreadVariance:1.6,crownLiftBase:12.8,crownLiftStep:1.1,crownWidthScale:0.68,crownFlatness:1.9,crownDepthScale:0.72,podScaleBase:0.34,podScaleVariance:0.28,podLiftBase:10.6,podLiftVariance:3.1,podElongation:2.4,grassClusters:10,grassPerCluster:220,grassClusterRadius:13}
  },
  {
    name:"ash bloom",
    terrain:{heightScale:0.96,hillScale:1.34,mountainScale:1.08,baseHeight:0.4,roadWave1:210,roadWave2:105,roadWave3:44,roadFrequencyScale:0.98},
    sky:["#07090c","#20242a","#5d6861","#b17d67","#f2c99a"],
    fog:0x697067,
    colors:{
      underwater:0x263642,shore:0xa79368,low:0x4e5f58,mid:0x66705a,high:0x8b8170,
      water:0x78cfd1,waterEmissive:0x1c6266,bark:0x1e1e20,barkEmissive:0x08080a,
      leaf:0x9ee36d,leafEmissive:0x385d16,pod:0xff7a5c,podEmissive:0xbd2a12,
      grass:0xb7d879,grassEmissive:0x3d4f18,rock:0x565b5c,wall:0x6f7268,roof:0x2b3034,trim:0xd4b36f,brick:0x766150
    },
    groundTexture:{base:"#555a4f",dark:[50,52,52],bright:[134,130,94],streak:"255,132,92"},
    rainChance:0.32,
    rainIntensity:[0.16,0.48],
    vegetation:{treeClusters:2,treesPerCluster:7,treeClusterRadius:31,crownsPerTree:6,podsPerTree:6,trunkHeightBase:0.92,trunkHeightVariance:0.34,trunkWidthBase:0.82,trunkWidthVariance:0.38,leanAmount:0.3,crownBaseScale:1.18,crownScaleStep:0.075,crownSpreadBase:1.55,crownSpreadVariance:2.5,crownLiftBase:8.2,crownLiftStep:0.34,crownWidthScale:1.25,crownFlatness:0.82,crownDepthScale:1.18,podScaleBase:0.38,podScaleVariance:0.32,podLiftBase:6.8,podLiftVariance:1.9,podElongation:1.05,grassClusters:15,grassPerCluster:260,grassClusterRadius:14}
  },
  {
    name:"neon city",
    city:true,
    terrain:{heightScale:0.42,hillScale:0.55,mountainScale:0.18,baseHeight:-1.4,roadWave1:95,roadWave2:48,roadWave3:18,roadFrequencyScale:0.72},
    sky:["#050812","#101a2c","#203858","#57728a","#d6c2a2"],
    fog:0x26384c,
    colors:{
      underwater:0x111a24,shore:0x58606a,low:0x303842,mid:0x3e4650,high:0x555d66,
      water:0x4dc7ff,waterEmissive:0x0a5270,bark:0x1c2025,barkEmissive:0x05070a,
      leaf:0x607060,leafEmissive:0x121c10,pod:0x86dfff,podEmissive:0x1d8fb8,
      grass:0x5f705e,grassEmissive:0x101b12,rock:0x343a42,wall:0x4b5563,roof:0x202733,trim:0x8aa0b8,brick:0x333b45,street:0x171b20
    },
    groundTexture:{base:"#343b43",dark:[25,30,36],bright:[88,96,104],streak:"90,185,255"},
    rainChance:0.52,
    rainIntensity:[0.18,0.58],
    vegetation:{treeClusters:0,treesPerCluster:1,treeClusterRadius:16,crownsPerTree:1,podsPerTree:0,trunkHeightBase:0.8,trunkHeightVariance:0.1,trunkWidthBase:0.5,trunkWidthVariance:0.1,leanAmount:0.04,crownBaseScale:0.8,crownScaleStep:0.02,crownSpreadBase:0.4,crownSpreadVariance:0.5,crownLiftBase:5.2,crownLiftStep:0.1,crownWidthScale:0.65,crownFlatness:1.2,crownDepthScale:0.65,podScaleBase:0.2,podScaleVariance:0.1,podLiftBase:4.5,podLiftVariance:0.8,podElongation:1,grassClusters:2,grassPerCluster:60,grassClusterRadius:7}
  }
];
let currentEnvironment=worldEnvironments[Math.floor(Math.random()*worldEnvironments.length)];
let rainIntensity=0;
let weatherTargetIntensity=0;
let nextWeatherChange=0;
let baseFogDensity=0.00042;
let lastSkyWeatherIntensity=-1;
let lastSkyNightAmount=-1;
let hemiLight=null;
let sun=null;
let headlightNightAmount=0;
const stormSkyStops=["#040711","#09121e","#172534","#2f3c45","#5f6660"];
const nightSkyStops=["#02040c","#071121","#0d1930","#18223c","#26304a"];
const dayNightCycleMs=360000;

function randomRange(min,max){
  return min+Math.random()*(max-min);
}

function clamp01(value){
  return Math.max(0,Math.min(1,value));
}

function dayNightState(now=performance.now()){
  let phase=(now/dayNightCycleMs+0.18)%1;
  let sunHeight=Math.sin(phase*Math.PI*2);
  let dayAmount=clamp01((sunHeight+0.32)/0.44);
  dayAmount=dayAmount*dayAmount*(3-2*dayAmount);
  return {
    phase,
    sunHeight,
    dayAmount,
    nightAmount:1-dayAmount
  };
}

function randomRainIntensity(environment,scale=1){
  let range=environment.rainIntensity || [0.2,0.55];
  return Math.max(0,Math.min(1,randomRange(range[0],range[1])*scale));
}

function chooseWeatherTarget(environment){
  let wetness=environment.rainChance || 0;
  let roll=Math.random();
  let clearChance=Math.max(0.08,0.72-wetness*0.64);
  let drizzleChance=Math.min(0.36,0.12+wetness*0.28);
  let rainChance=Math.min(0.34,0.08+wetness*0.26);

  if(roll<clearChance) return 0;
  if(roll<clearChance+drizzleChance) return randomRainIntensity(environment,0.45);
  if(roll<clearChance+drizzleChance+rainChance) return randomRainIntensity(environment,0.82);
  return randomRainIntensity(environment,1.18);
}

function scheduleNextWeatherChange(now=performance.now()){
  nextWeatherChange=now+randomRange(18000,46000);
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

function weatherSkyStops(){
  let sky=currentEnvironment.sky || ["#12072b","#33145f","#9c416f","#f08c71","#ffd3a5"];
  let stormAmount=Math.pow(Math.max(0,Math.min(1,rainIntensity)),0.72)*0.82;
  return sky.map((color,index)=>blendHexColor(color,stormSkyStops[index] || stormSkyStops[stormSkyStops.length-1],stormAmount));
}

function timeOfDaySkyStops(now=performance.now()){
  let nightAmount=dayNightState(now).nightAmount*0.88;
  return weatherSkyStops().map((color,index)=>blendHexColor(color,nightSkyStops[index] || nightSkyStops[nightSkyStops.length-1],nightAmount));
}

function updateSkyForWeather(force=false,now=performance.now()){
  let weatherBucket=Math.round(rainIntensity*24)/24;
  let nightBucket=Math.round(dayNightState(now).nightAmount*32)/32;
  if(!force && Math.abs(weatherBucket-lastSkyWeatherIntensity)<0.001 && Math.abs(nightBucket-lastSkyNightAmount)<0.001) return;
  lastSkyWeatherIntensity=weatherBucket;
  lastSkyNightAmount=nightBucket;
  if(scene.background && scene.background.dispose) scene.background.dispose();
  scene.background=makeSkyTexture({...currentEnvironment,sky:timeOfDaySkyStops(now)});
}

function refreshSceneEnvironment(){
  lastSkyWeatherIntensity=-1;
  lastSkyNightAmount=-1;
  updateSkyForWeather(true);
  scene.fog=new THREE.FogExp2(currentEnvironment.fog || 0x7b4771,baseFogDensity);
}

function updateDayNight(now=performance.now(),forceSky=false){
  let state=dayNightState(now);
  let day=state.dayAmount;
  let night=state.nightAmount;
  let rainDim=1-rainIntensity*0.24;
  headlightNightAmount=night;

  if(hemiLight){
    hemiLight.intensity=(0.42+day*0.93)*rainDim;
    hemiLight.color.set(0xffb8d4).lerp(new THREE.Color(0x6f86c8),night*0.82);
    hemiLight.groundColor.set(0x21484d).lerp(new THREE.Color(0x07101b),night*0.72);
  }

  if(sun){
    let sunAngle=state.phase*Math.PI*2;
    let sunLift=Math.max(0,state.sunHeight);
    sun.position.set(Math.cos(sunAngle)*5.5,1.2+sunLift*8.5,Math.sin(sunAngle)*5.5);
    sun.intensity=(0.22+day*1.83)*rainDim;
    sun.color.set(0xffd29b).lerp(new THREE.Color(0x9db8ff),night*0.92);
  }

  if(scene.fog){
    scene.fog.color.set(currentEnvironment.fog || 0x7b4771).lerp(new THREE.Color(0x081226),night*0.72);
    scene.fog.density=baseFogDensity+rainIntensity*0.00042+night*0.00026;
  }

  updateSkyForWeather(forceSky,now);
}

function updateWeather(){
  let now=performance.now();
  if(now>=nextWeatherChange){
    weatherTargetIntensity=chooseWeatherTarget(currentEnvironment);
    scheduleNextWeatherChange(now);
  }

  rainIntensity+=(weatherTargetIntensity-rainIntensity)*0.006;
  if(Math.abs(weatherTargetIntensity-rainIntensity)<0.003) rainIntensity=weatherTargetIntensity;

  updateDayNight(now);
}

let scene=new THREE.Scene();
let playerCamera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,1e6);
let secondCamera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,1e6);
let renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
function updateRendererPixelRatio(){
  let maxRatio=gameMode==="double" ? 1 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,maxRatio));
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);
refreshSceneEnvironment();

hemiLight=new THREE.HemisphereLight(0xffb8d4,0x21484d,1.35);
scene.add(hemiLight);
sun=new THREE.DirectionalLight(0xffd29b,2.05);
sun.position.set(-3.5,6.5,2.2);
scene.add(sun);
updateDayNight(performance.now(),true);

let input=createInput();
let px=0,py=20,pz=0;
let gameOver=false;
let healthDamageCooldown=0;
let cameraFollowDistance=18;
let cameraFollowHeight=7.5;
let cars=[];
let gameStarted=false;
let gameMode="single";
let gameDifficulty="medium";
let difficultySettings={
  easy:{
    waveCount:0.38,
    waveDelay:1.75,
    patrolDelay:2.05,
    speed:0.58,
    fireDelay:1.55,
    villageBudget:0.42,
    hardFlight:false,
    rocketAmmo:70,
    cannonAmmo:500
  },
  medium:{
    waveCount:1,
    waveDelay:1,
    patrolDelay:1,
    speed:1,
    fireDelay:1,
    villageBudget:1,
    hardFlight:false,
    rocketAmmo:50,
    cannonAmmo:300
  },
  hard:{
    waveCount:1.65,
    waveDelay:0.72,
    patrolDelay:0.68,
    speed:1.14,
    fireDelay:0.5,
    villageBudget:1.45,
    hardFlight:true,
    rocketAmmo:30,
    cannonAmmo:200
  }
};
let enemies=[];
let enemyWaveDelay=0;
let enemyPatrolDelay=900;
let enemySpawnSerial=0;
let enemyBudgetRun=0;
let mothership=null;
let mothershipDelay=mothershipMinDelay+Math.floor(Math.random()*mothershipRandomDelay);
let jetUnlocked=false;
let score=0;
let enemyScoreAmount=100;
let giantScoreAmount=350;
let bossScoreAmount=650;
let villageScoreAmount=1000;
let scoredVillages=new WeakSet();
let waterLevel=-20;
let mechGroundMaxSpeed=0.4;
let mechAirMaxSpeed=0.9;
let morphedCarSpeedMultiplier=4;
let morphTransitionRate=0.075;
let jetTransitionRate=0.075;
let jetMaxSpeed=2.4;
let mechStrideLength=2.35;
let rocketSpeed=1.75;
let rocketCooldownFrames=34;
let rocketTurnRate=0.075;
let rocketAimYOffset=-4.2;
let aimOffsetYMin=-9;
let aimOffsetYMax=13;
let initialClusterBombAmmo=10;
let maxBoostCharge=100;
let rocketSupplyAmount=6;
let cannonSupplyAmount=40;
let healthSupplyAmount=35;
let boostSupplyAmount=45;
let rockets=[];
let supplyBoxes=[];
let supplySpawnKeys=new Set();
let rocketBodyGeo=new THREE.CylinderGeometry(0.11,0.13,0.8,12);
let rocketNoseGeo=new THREE.ConeGeometry(0.16,0.34,12);
let rocketFinGeo=new THREE.BoxGeometry(0.08,0.18,0.22);
let rocketBodyMat=new THREE.MeshStandardMaterial({color:0x30363b,roughness:0.48,metalness:0.55});
let rocketNoseMat=new THREE.MeshStandardMaterial({color:0xff6633,emissive:0x8f2108,emissiveIntensity:0.55,roughness:0.38,metalness:0.35});
let rocketFlameMat=new THREE.MeshStandardMaterial({color:0xfff0a0,emissive:0xff7a12,emissiveIntensity:1.2,roughness:0.28});
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
let bossLaserBeams=[];
let bossLaserPointA=new THREE.Vector3();
let bossLaserPointB=new THREE.Vector3();
let droneBodyMat=new THREE.MeshStandardMaterial({color:0x202935,emissive:0x061728,emissiveIntensity:0.35,roughness:0.56,metalness:0.7});
let droneWingMat=new THREE.MeshStandardMaterial({color:0x58657a,emissive:0x121827,emissiveIntensity:0.22,roughness:0.6,metalness:0.55});
let droneCoreMat=new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.78,depthWrite:false,blending:THREE.AdditiveBlending});
let boatHullMat=new THREE.MeshStandardMaterial({color:0x1a2630,emissive:0x06121a,emissiveIntensity:0.28,roughness:0.58,metalness:0.62});
let boatDeckMat=new THREE.MeshStandardMaterial({color:0x4f6172,emissive:0x101820,emissiveIntensity:0.16,roughness:0.52,metalness:0.58});
let boatMissileMat=new THREE.MeshStandardMaterial({color:0x7f2f25,emissive:0x2f0703,emissiveIntensity:0.42,roughness:0.4,metalness:0.5});
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

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function smoothStep(value){
  value=clamp(value,0,1);
  return value*value*(3-2*value);
}

function approach(value,target,amount){
  if(value<target) return Math.min(target,value+amount);
  if(value>target) return Math.max(target,value-amount);
  return target;
}

function waterDepthAt(x,z){
  return waterLevel-groundHeight(x,z);
}

function drivingSurfaceHeight(x,z){
  let surfaceY=carSurfaceHeight(x,z);
  return waterDepthAt(x,z)>0.15 ? Math.max(surfaceY,waterLevel-0.34) : surfaceY;
}

function terrainSlopeAt(x,z){
  let sampleDistance=3.2;
  let center=drivingSurfaceHeight(x,z);
  let xSlope=Math.abs(drivingSurfaceHeight(x+sampleDistance,z)-drivingSurfaceHeight(x-sampleDistance,z))/(sampleDistance*2);
  let zSlope=Math.abs(drivingSurfaceHeight(x,z+sampleDistance)-drivingSurfaceHeight(x,z-sampleDistance))/(sampleDistance*2);
  let diagonalSlope=Math.abs(drivingSurfaceHeight(x+sampleDistance,z+sampleDistance)-drivingSurfaceHeight(x-sampleDistance,z-sampleDistance))/(sampleDistance*2.828);
  return Math.max(xSlope,zSlope,diagonalSlope,Math.abs(center-drivingSurfaceHeight(x+sampleDistance,z-sampleDistance))/(sampleDistance*1.414));
}

function mountainClimbBlocked(car,fromX,fromZ,toX,toZ){
  let fromY=drivingSurfaceHeight(fromX,fromZ);
  let actuallyFlying=car.y>fromY+1.4 || car.jetMode || car.jetProgress>0.2;
  if(actuallyFlying) return false;
  if(roadDistance(toX,toZ)<58) return false;

  let dx=toX-fromX;
  let dz=toZ-fromZ;
  let distance=Math.hypot(dx,dz);
  if(distance<0.01) return false;

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
  let heightAboveRoad=drivingSurfaceHeight(toX,toZ)-drivingSurfaceHeight(roadCenterX(toZ),toZ);
  return heightAboveRoad>18 && totalUphill>0.42 && maxGrade>0.95 && localSlope>0.85;
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
  let splitAspect=Math.max(0.1,(gameMode==="single" ? innerWidth : innerWidth*0.5)/innerHeight);

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

function activeCars(){
  return gameMode==="single" ? [playerCar] : cars;
}

function displayCars(){
  return gameMode==="single" ? [playerCar] : [secondCar,playerCar];
}

function activeEnemies(){
  return enemies.filter(enemy=>enemy.active && enemy.health>0);
}

function combatActors(){
  return [...activeCars(),...activeEnemies()];
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

function scaledDelay(frames,scale){
  return Math.max(1,Math.round(frames*scale));
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
    group,
    shadow:createCarShadow(scene),
    x:0,
    y:20,
    z:0,
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
    mechModel:null,
    jetModel:null,
    carModel:null,
    aimCross:null,
    aimOffsetX:0,
    aimOffsetY:0,
    aimDistance:32,
    hasMouseAimPoint:false,
    hasGamepadAimPoint:false,
    controllerAimOffsetX:0,
    controllerAimOffsetY:0,
    mouseAimWorldX:0,
    mouseAimWorldY:0,
    mouseAimWorldZ:0,
    lastAimMouseVersion:-1,
    lastRocketButton:false,
    rocketCooldown:0,
    rocketAmmo:maxRocketAmmo(),
    lastCannonButton:false,
    cannonCooldown:0,
    cannonAmmo:maxCannonAmmo(),
    clusterBombCooldown:0,
    clusterBombAmmo:initialClusterBombAmmo,
    boostCharge:maxBoostCharge,
    hitRattle:0,
    hitRattleSeed:0,
    walkCycle:0,
    lastWalkX:0,
    lastWalkZ:0,
    health:100,
    lateralOffset
  };
}

let playerCar=createCarState("car1",-4.2,{up:"w",down:"s",left:"a",right:"d"},playerCamera,0);
let secondCar=createCarState("car2",4.2,{up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright"},secondCamera,1);
cars=[playerCar,secondCar];
secondCar.group.visible=false;
secondCar.shadow.setVisible(false);

let world=createWorld(scene,{getDifficulty:()=>gameDifficulty,getEnvironment:()=>currentEnvironment});
let clouds=createClouds(scene,()=>({carX:playerCar.x,carZ:playerCar.z}));
let birds=createBirds(scene,()=>({carX:playerCar.x,carZ:playerCar.z}));
let rain=createRain(scene,()=>({carX:px,carZ:pz}),()=>rainIntensity);
let ambientMotes=createAmbientMotes(scene,()=>({carX:px,carY:py,carZ:pz}),()=>rainIntensity);
let dust=createDust(scene);
let wheelTracks=createWheelTracks(scene);
let motorAudio=createMotorAudio(cars);
let hud=createHud({
  getPerformanceMode:()=>gameMode==="double" ? "split" : "full",
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
    rocketAmmo:car.rocketAmmo,
    cannonAmmo:car.cannonAmmo,
    clusterBombAmmo:car.clusterBombAmmo,
    boostCharge:car.boostCharge,
    score
  })),
  getEnemyStates:()=>activeEnemies().map(enemy=>({
    id:enemy.id,
    x:enemy.x,
    z:enemy.z,
    health:enemy.health
  })),
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

function damageCar(car,amount){
  if(healthDamageCooldown>0 || car.health<=0) return;
  let reducedAmount=Math.max(1,Math.ceil(amount*0.5));
  car.health=Math.max(0,car.health-reducedAmount);
  healthDamageCooldown=42;
  hud.updateHealthHud();
  if(activeCars().some(item=>item.health<=0)) showGameOver();
}

function addScore(amount){
  score+=amount;
  if(hud) hud.updateCompassHud();
}

function destroyWorldObstacle(obstacle){
  if(!world.destroyObstacle(obstacle)) return false;

  if(obstacle.village && world.isVillageCleared(obstacle.village) && !scoredVillages.has(obstacle.village)){
    scoredVillages.add(obstacle.village);
    addScore(villageScoreAmount);
  }

  return true;
}

function obstacleMaxHealth(obstacle){
  if(!obstacle || obstacle.type!=="building") return 1;

  let height=obstacle.visualHeight || obstacle.height || 8;
  if(!obstacle.cityBuilding) return 30;

  let radius=obstacle.visualRadius || obstacle.r || 6;
  return Math.max(95,Math.ceil(height*1.85+radius*2.4));
}

function damageWorldObstacle(obstacle,amount=1){
  if(!obstacle || obstacle.destroyed) return false;
  if(obstacle.type!=="building") return destroyWorldObstacle(obstacle);

  if(!Number.isFinite(obstacle.maxHealth)) obstacle.maxHealth=obstacleMaxHealth(obstacle);
  if(!Number.isFinite(obstacle.health)) obstacle.health=obstacle.maxHealth;

  obstacle.health=Math.max(0,obstacle.health-amount);
  if(obstacle.health>0) return false;

  return destroyWorldObstacle(obstacle);
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
  let hardenedDamage=Math.max(1,amount*0.48);
  let destroyed=world.damageBossBase(obstacle,hardenedDamage);

  if(destroyed){
    spawnBossBaseDebris(base);
    spawnRadiusExplosion(base.x,base.y+12,base.z,72);
    for(let i=0;i<8;i++){
      let angle=(i/8)*Math.PI*2+Math.random()*0.24;
      let dist=12+Math.random()*34;
      spawnRocketExplosion(
        base.x+Math.cos(angle)*dist,
        base.y+6+Math.random()*30,
        base.z+Math.sin(angle)*dist
      );
    }
    for(let i=0;i<18;i++){
      let angle=Math.random()*Math.PI*2;
      let dist=Math.random()*58;
      dust.spawnThrusterParticle(
        base.x+Math.cos(angle)*dist,
        base.y+4+Math.random()*32,
        base.z+Math.sin(angle)*dist,
        Math.cos(angle)*(2+Math.random()*7),
        Math.sin(angle)*(2+Math.random()*7),
        1.5+Math.random()*6,
        0.28+Math.random()*0.18,
        0.12+Math.random()*0.1
      );
    }
    addScore(bossScoreAmount);
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

function damageEnemy(enemy,amount){
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
    addScore(enemy.isBoss ? bossScoreAmount : enemy.isGiant ? giantScoreAmount : enemyScoreAmount);
    spawnRocketExplosion(enemy.x,enemy.y+(enemy.isGiant ? 5.8 : 2.2),enemy.z);
  }
}

function damageActor(actor,amount){
  if(actor.isEnemy) damageEnemy(actor,amount);
  else damageCar(actor,amount);
}

function rattleActor(actor,amount=1){
  if(!actor || actor.health<=0) return;
  actor.hitRattle=Math.max(actor.hitRattle,amount);
  actor.hitRattleSeed=Math.random()*Math.PI*2;
}

function landingDamageAmount(car,x,z,impactSpeed){
  let front=carSurfaceHeight(x+Math.sin(car.velAngle)*3,z+Math.cos(car.velAngle)*3);
  let back=carSurfaceHeight(x-Math.sin(car.velAngle)*3,z-Math.cos(car.velAngle)*3);
  let side=carSurfaceHeight(x+Math.cos(car.velAngle)*2.2,z-Math.sin(car.velAngle)*2.2);
  let roughness=Math.max(Math.abs(front-back),Math.abs(side-carSurfaceHeight(x,z)));
  let impactDamage=Math.max(0,impactSpeed-1.05)*7;
  let roughDamage=Math.max(0,roughness-2.0)*1.4;
  return Math.min(12,Math.round(impactDamage+roughDamage));
}

function controlsFor(car){
  let forward=0;
  let turn=0;
  let lift=0;
  let keyboardForward=0;

  if(!gameOver){
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
    let dx=nextX-other.x;
    let dz=nextZ-other.z;
    let minGap=(car.collisionRadius || 1.8)+(other.collisionRadius || 1.8);
    if(dx*dx+dz*dz<minGap*minGap) return other;
  }
  return null;
}

function movementCollision(car,fromX,fromZ,toX,toZ){
  let dx=toX-fromX;
  let dz=toZ-fromZ;
  let distance=Math.hypot(dx,dz);
  let steps=Math.max(1,Math.min(24,Math.ceil(distance/0.45)));
  let safeX=fromX;
  let safeZ=fromZ;

  for(let i=1;i<=steps;i++){
    let t=i/steps;
    let x=fromX+dx*t;
    let z=fromZ+dz*t;
    let otherCar=collidesWithOtherCars(car,x,z);

    if(world.collidesWithObstacles(x,z) || otherCar){
      return {hit:true,otherCar,safeX,safeZ};
    }

    safeX=x;
    safeZ=z;
  }

  return {hit:false,otherCar:null,safeX:toX,safeZ:toZ};
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

function spawnRocketExplosion(x,y,z,playSound=true){
  if(playSound) motorAudio.playExplosion();

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

function spawnRadiusExplosion(x,y,z,radius,playSound=true){
  if(playSound) motorAudio.playExplosion();

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

function hash01(a,b){
  let value=Math.sin(a*127.1+b*311.7)*43758.5453;
  return value-Math.floor(value);
}

function makeSupplyBox(type){
  let group=new THREE.Group();
  let baseMat=type==="rocket" ? rocketSupplyMat : type==="health" ? healthSupplyMat : type==="boost" ? boostSupplyMat : type==="jet" ? jetSupplyMat : cannonSupplyMat;
  let bandMat=type==="rocket" ? rocketSupplyBandMat : type==="health" ? healthSupplyBandMat : type==="boost" ? boostSupplyBandMat : type==="jet" ? jetSupplyBandMat : cannonSupplyBandMat;
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
  let typeOffset=type==="rocket" ? 7 : type==="health" ? 31 : type==="boost" ? 47 : type==="jet" ? 67 : 23;
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

  let fallbackAngle=(type==="rocket" ? 0.3 : type==="health" ? 0.72 : type==="boost" ? 0.95 : type==="jet" ? 1.32 : 1.15)*Math.PI;
  let x=village.x+Math.cos(fallbackAngle)*villageRadius*0.22;
  let z=village.z+Math.sin(fallbackAngle)*villageRadius*0.22;
  return {x,y:drivingSurfaceHeight(x,z),z,angle:fallbackAngle};
}

function nearestActiveCarDistanceSq(x,z){
  let best=Infinity;
  for(let car of activeCars()){
    if(car.health<=0 || !car.group.visible) continue;
    let dx=x-car.x;
    let dz=z-car.z;
    best=Math.min(best,dx*dx+dz*dz);
  }
  return best;
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
  let jetUnlockCandidate=null;

  for(let chunk of world.chunks.values()){
    if(!chunk.villageCenters) continue;
    for(let village of chunk.villageCenters){
      if(!world.isVillageCleared(village)) continue;

      if(!jetUnlocked && !supplySpawnKeys.has("jet-unlock") && village.buildings && village.buildings.length>4){
        let distSq=nearestActiveCarDistanceSq(village.x,village.z);
        if(Number.isFinite(distSq) && (!jetUnlockCandidate || distSq<jetUnlockCandidate.distSq)){
          jetUnlockCandidate={village,distSq};
        }
      }

      let supplySets=gameMode==="double" ? 2 : 1;
      for(let set=0;set<supplySets;set++){
        for(let type of ["rocket","cannon","health","boost"]){
          let key=supplyKeyForVillage(village,`${type}-${set}`);
          if(supplySpawnKeys.has(key)) continue;

          let typeIndex=type==="rocket" ? 0 : type==="cannon" ? 1 : type==="health" ? 2 : 3;
          spawnSupplyBoxForVillage(village,type,typeIndex+set*4,key);
        }
      }
    }
  }

  if(jetUnlockCandidate && !supplySpawnKeys.has("jet-unlock")){
    spawnSupplyBoxForVillage(jetUnlockCandidate.village,"jet",8,"jet-unlock");
  }
}

function collectSupplyBox(box,car){
  let type=box.userData.type;

  if(type==="rocket"){
    let rocketAmmoCap=maxRocketAmmo();
    if(car.rocketAmmo>=rocketAmmoCap) return false;
    car.rocketAmmo=Math.min(rocketAmmoCap,car.rocketAmmo+rocketSupplyAmount);
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
  }else{
    if(car.health>=100) return false;
    car.health=Math.min(100,car.health+healthSupplyAmount);
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
  spawnVillageSupplyBoxes();

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

    let obstacle=world.obstacleAlongSegment3D(
      mouseAimRayStart.x,
      mouseAimRayStart.y,
      mouseAimRayStart.z,
      mouseAimRayEnd.x,
      mouseAimRayEnd.y,
      mouseAimRayEnd.z,
      0.35
    );
    if(obstacle){
      let obstacleY=Number.isFinite(obstacle.y)
        ? obstacle.y
        : groundHeight(obstacle.x,obstacle.z)+Math.max(0.6,obstacle.r*0.45);
      let obstacleT=(obstacle.x-origin.x)*direction.x+(obstacleY-origin.y)*direction.y+(obstacle.z-origin.z)*direction.z;
      obstacleT=clamp(obstacleT,minDistance,t);
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
  if(car.morphed || car.morphProgress>0.22) return;
  if(car.jetMode || car.jetProgress>0.35) return;
  if(!car.isEnemy && car.rocketAmmo<=0) return;

  let mesh=makeRocketMesh();
  let launchPoint=rocketLaunchPointForCar(car);
  let startX=launchPoint.x;
  let startY=launchPoint.y;
  let startZ=launchPoint.z;
  let targetActor=nearbyRocketTargetForCar(car);
  let aimPoint=targetActor ? rocketTargetPoint(targetActor) : aimTargetForCar(car);
  let aimX=aimPoint.x-startX;
  let aimY=aimPoint.y-startY;
  let aimZ=aimPoint.z-startZ;
  let aimLen=Math.max(0.001,Math.hypot(aimX,aimY,aimZ));
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
    damage:22,
    blastRadius:18
  });

  motorAudio.playRocketLaunch(boat);
  boat.cannonCooldown=scaledDelay(175+Math.floor(Math.random()*115),currentDifficulty().fireDelay);
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

function fireCannon(car){
  if(gameOver || car.health<=0 || car.cannonCooldown>0) return false;
  if(car.morphed || car.morphProgress>0.35) return false;
  if(car.jetMode || car.jetProgress>0.35) return false;
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

function fireClusterBomb(car){
  if(gameOver || car.health<=0 || car.clusterBombCooldown>0) return false;
  if(!(car.jetMode || car.jetProgress>0.65)) return false;
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

  for(let chunk of world.chunks.values()){
    if(!chunk.colliders) continue;
    for(let obstacle of chunk.colliders){
      if(!obstacle || obstacle.destroyed) continue;
      let dx=obstacle.x-x;
      let dz=obstacle.z-z;
      let reach=radius+(obstacle.r || 0);
      if(dx*dx+dz*dz>reach*reach) continue;
      if(destroyWorldObstacle(obstacle)) destroyed.push(obstacle);
    }
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

    let bombHitDamage=(base.maxHealth || 720)/3/0.48;
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

  for(let i=0;i<12;i++){
    let angle=(i/12)*Math.PI*2+Math.random()*0.28;
    let dist=clusterBombRadius*(0.18+Math.random()*0.74);
    let bx=x+Math.cos(angle)*dist;
    let bz=z+Math.sin(angle)*dist;
    let by=drivingSurfaceHeight(bx,bz)+0.8+Math.random()*2.2;
    spawnRocketExplosion(bx,by,bz,false);
  }

  let destroyed=destroyObstaclesInRadius(x,z,clusterBombRadius);
  damageBossBasesInRadius(x,y,z,clusterBombRadius);
  let debrisCount=0;
  for(let obstacle of destroyed){
    if(debrisCount>=42) break;
    if(obstacle.type==="rock" || obstacle.type==="smallRock" || obstacle.type==="building" || obstacle.type==="wall" || obstacle.type==="turret"){
      spawnRockDebris(
        obstacle.x,
        drivingSurfaceHeight(obstacle.x,obstacle.z)+Math.max(0.8,(obstacle.r || 2)*0.35),
        obstacle.z,
        obstacle
      );
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

  if(motorAudio.playBombExplosion) motorAudio.playBombExplosion();
  else motorAudio.playExplosion();
}

function updateCannonInput(car){
  if(car.cannonCooldown>0) car.cannonCooldown--;
  if(car.clusterBombCooldown>0) car.clusterBombCooldown--;

  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let mouseShot=gameMode==="single" && car===playerCar && input.mouse.left;
  let cannonButton=buttons.rightTrigger || mouseShot;
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
  clearExplosions();
  clearRockDebris();
  clearTeleportEffects();
  clearBossLaserBeams();
}

function updateRockets(){
  for(let i=rockets.length-1;i>=0;i--){
    let rocket=rockets[i];
    rocket.age++;

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
      let desiredVx=(dx/desiredLen)*rocketSpeed;
      let desiredVy=(dy/desiredLen)*rocketSpeed;
      let desiredVz=(dz/desiredLen)*rocketSpeed;
      rocket.vx+=(desiredVx-rocket.vx)*rocketTurnRate;
      rocket.vy+=(desiredVy-rocket.vy)*rocketTurnRate;
      rocket.vz+=(desiredVz-rocket.vz)*rocketTurnRate;
      let velocityLen=Math.max(0.001,Math.hypot(rocket.vx,rocket.vy,rocket.vz));
      rocket.vx=(rocket.vx/velocityLen)*rocketSpeed;
      rocket.vy=(rocket.vy/velocityLen)*rocketSpeed;
      rocket.vz=(rocket.vz/velocityLen)*rocketSpeed;
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

    if(rocket.age%2===0){
      dust.spawnThrusterParticle(
        rocket.x-Math.sin(rocket.angle)*0.62,
        rocket.y,
        rocket.z-Math.cos(rocket.angle)*0.62,
        -Math.sin(rocket.angle)*2.4+(Math.random()-0.5)*0.8,
        -Math.cos(rocket.angle)*2.4+(Math.random()-0.5)*0.8,
        (Math.random()-0.5)*0.8,
        0.18,
        0.07+Math.random()*0.04
      );
    }

    let surfaceY=drivingSurfaceHeight(rocket.x,rocket.z);
    let hitActor=null;
    let mothershipHit=null;
    if(rocket.age>4){
      for(let actor of combatActors()){
        if(actor===rocket.owner) continue;
        if(rocket.owner.isEnemy && actor.isEnemy) continue;
        let hitRadius=actor.collisionRadius ? Math.max(4.2,actor.collisionRadius+1.1) : 4.2;
        let hitHeight=actor.hitHeight || 4.2;
        let dx=rocket.x-actor.x;
        let dz=rocket.z-actor.z;
        if(dx*dx+dz*dz<hitRadius*hitRadius && Math.abs(rocket.y-actor.y)<hitHeight){
          hitActor=actor;
          break;
        }
      }
      if(!rocket.owner.isEnemy){
        mothershipHit=mothershipHitAlongSegment(prevX,prevY,prevZ,rocket.x,rocket.y,rocket.z,1.6);
      }
    }

    let hitObstacle=world.obstacleAlongSegment3D(prevX,prevY,prevZ,rocket.x,rocket.y,rocket.z,1.25);
    let targetImpact=false;
    if(rocket.ballistic && rocket.targetX!==undefined){
      let dx=rocket.x-rocket.targetX;
      let dz=rocket.z-rocket.targetZ;
      targetImpact=(rocket.age>=rocket.impactAge && dx*dx+dz*dz<28*28)
        || (dx*dx+dz*dz<12*12 && rocket.y<=rocket.targetY+14);
    }
    let hit=rocket.y<=surfaceY+0.35 || hitObstacle || hitActor || mothershipHit || targetImpact;

    if(hit || rocket.age>rocket.life){
      let shouldExplode=hit || rocket.ballistic;
      if(shouldExplode){
        let explosionX=mothershipHit ? mothershipHit.x : hitObstacle ? hitObstacle.x : targetImpact ? rocket.targetX : rocket.x;
        let explosionZ=mothershipHit ? mothershipHit.z : hitObstacle ? hitObstacle.z : targetImpact ? rocket.targetZ : rocket.z;
        let explosionSurfaceY=drivingSurfaceHeight(explosionX,explosionZ);
        let explosionY=hitObstacle
          ? Math.max(groundHeight(hitObstacle.x,hitObstacle.z)+Math.max(0.8,hitObstacle.r*0.45),explosionSurfaceY+0.5)
          : mothershipHit
          ? mothershipHit.y
          : targetImpact
          ? Math.max(rocket.targetY,explosionSurfaceY+0.5)
          : Math.max(rocket.y,explosionSurfaceY+0.5);
        spawnRocketExplosion(explosionX,explosionY,explosionZ);
        if(mothershipHit) damageMothership(explosionX,explosionY,explosionZ,1);
        if(hitObstacle){
          if(hitObstacle.type==="bossBase"){
            damageBossBaseObstacle(hitObstacle,rocket.x,rocket.y,rocket.z,34);
          }else if(hitObstacle.type==="rock" || hitObstacle.type==="smallRock" || hitObstacle.type==="building" || hitObstacle.type==="wall" || hitObstacle.type==="turret"){
            if(hitObstacle.type==="building" || hitObstacle.type==="wall") spawnBuildingAmmoImpact(hitObstacle,rocket.x,rocket.y,rocket.z,34);
            if(damageWorldObstacle(hitObstacle,34)){
              spawnRockDebris(hitObstacle.x,explosionY,hitObstacle.z,hitObstacle);
            }
          }else{
            destroyWorldObstacle(hitObstacle);
          }
        }
        if(hitActor){
          damageActor(hitActor,rocket.damage || 18);
          rattleActor(hitActor,1);
        }
        if(rocket.blastRadius){
          for(let actor of combatActors()){
            if(actor===rocket.owner || actor===hitActor) continue;
            if(rocket.owner.isEnemy && actor.isEnemy) continue;
            let dx=actor.x-explosionX;
            let dz=actor.z-explosionZ;
            if(dx*dx+dz*dz<rocket.blastRadius*rocket.blastRadius){
              damageActor(actor,Math.max(6,(rocket.damage || 18)*0.55));
              rattleActor(actor,0.85);
            }
          }
        }
      }
      removeRocket(i);
    }
  }
}

function updateCannonBolts(){
  for(let i=cannonBolts.length-1;i>=0;i--){
    let bolt=cannonBolts[i];
    bolt.age++;

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

    if(bolt.age%2===0){
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
      for(let actor of combatActors()){
        if(actor===bolt.owner) continue;
        if(bolt.owner.isEnemy && actor.isEnemy) continue;
        let hitRadius=actor.collisionRadius ? Math.max(3.6,actor.collisionRadius+0.6) : 3.6;
        let hitHeight=actor.hitHeight || 4.0;
        let dx=bolt.x-actor.x;
        let dz=bolt.z-actor.z;
        if(dx*dx+dz*dz<hitRadius*hitRadius && Math.abs(bolt.y-actor.y)<hitHeight){
          hitActor=actor;
          break;
        }
      }
      if(!bolt.owner.isEnemy){
        mothershipHit=mothershipHitAlongSegment(prevX,prevY,prevZ,bolt.x,bolt.y,bolt.z,0.95);
      }
    }

    let hitObstacle=world.obstacleAlongSegment3D(prevX,prevY,prevZ,bolt.x,bolt.y,bolt.z,0.9);
    let hit=bolt.y<=surfaceY+0.22 || hitObstacle || hitActor || mothershipHit;

    if(hit || bolt.age>bolt.life){
      if(hit){
        let explosionX=mothershipHit ? mothershipHit.x : hitObstacle ? hitObstacle.x : bolt.x;
        let explosionZ=mothershipHit ? mothershipHit.z : hitObstacle ? hitObstacle.z : bolt.z;
        let explosionY=hitObstacle
          ? Math.max(groundHeight(hitObstacle.x,hitObstacle.z)+Math.max(0.55,hitObstacle.r*0.35),surfaceY+0.4)
          : mothershipHit
          ? mothershipHit.y
          : Math.max(bolt.y,surfaceY+0.45);
        spawnRocketExplosion(explosionX,explosionY,explosionZ);
        if(mothershipHit) damageMothership(explosionX,explosionY,explosionZ,0.4);
        if(hitObstacle){
          if(hitObstacle.type==="bossBase"){
            damageBossBaseObstacle(hitObstacle,bolt.x,bolt.y,bolt.z,13);
          }else if(hitObstacle.type==="rock" || hitObstacle.type==="smallRock" || hitObstacle.type==="building" || hitObstacle.type==="wall" || hitObstacle.type==="turret"){
            if(hitObstacle.type==="building" || hitObstacle.type==="wall") spawnBuildingAmmoImpact(hitObstacle,bolt.x,bolt.y,bolt.z,13);
            if(damageWorldObstacle(hitObstacle,13)){
              spawnRockDebris(hitObstacle.x,explosionY,hitObstacle.z,hitObstacle);
            }
          }else{
            destroyWorldObstacle(hitObstacle);
          }
        }
        if(hitActor){
          damageActor(hitActor,9);
          rattleActor(hitActor,0.72);
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

    if(bomb.age%2===0){
      let trailCount=3;
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

function nearestActivePlayer(enemy){
  let best=null;
  let bestDist=Infinity;

  for(let car of activeCars()){
    if(car.health<=0 || !car.group.visible) continue;
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

function playerDistanceSqForEnemy(enemy){
  let best=Infinity;
  for(let car of activeCars()){
    if(car.health<=0 || !car.group.visible) continue;
    let dx=enemy.x-car.x;
    let dz=enemy.z-car.z;
    best=Math.min(best,dx*dx+dz*dz);
  }
  return best;
}

function updateBoatEnemy(enemy,target,distance,targetAngle,settings){
  let preferredDistance=230;
  let minDistance=120;
  let maxDistance=390;
  let desiredAngle=targetAngle+enemy.aiStrafe*(0.72+Math.sin(performance.now()*0.0012+enemy.guardPhase)*0.18);
  let desiredSpeed=0.11;

  if(distance>maxDistance){
    desiredAngle=targetAngle;
    desiredSpeed=0.32;
  }else if(distance<minDistance){
    desiredAngle=targetAngle+Math.PI+enemy.aiStrafe*0.36;
    desiredSpeed=0.24;
  }else if(distance>preferredDistance){
    desiredSpeed=0.18;
  }

  let turn=clamp(normalizeAngle(desiredAngle-enemy.angle),-0.038,0.038);
  enemy.angle=normalizeAngle(enemy.angle+turn);
  enemy.speed+=clamp(desiredSpeed*settings.speed-enemy.speed,-0.009*settings.speed,0.009*settings.speed);
  enemy.speed=clamp(enemy.speed,0,0.34*settings.speed);

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
    enemy.angle=normalizeAngle(targetAngle+enemy.aiStrafe*(0.95+Math.random()*0.55));
    enemy.aiStrafe*=-1;
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

  let aimError=Math.abs(normalizeAngle(targetAngle-enemy.angle));
  if(distance>130 && distance<430 && aimError<0.72){
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

  for(let chunk of world.chunks.values()){
    if(!chunk.villageCenters) continue;
    for(let village of chunk.villageCenters){
      prepareVillageEnemyBudget(village);
      if((village.enemyRemaining ?? 0)<=0) continue;
      let dx=village.x-center.x;
      let dz=village.z-center.z;
      let distSq=dx*dx+dz*dz;
      if(distSq<130*130 || distSq>620*620) continue;
      villages.push({village,distSq});
    }
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
    let type=boatPoint ? "boat" : roll<0.08 ? "giant" : roll<0.48 ? "drone" : "mech";
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
  scene.remove(mothership.group);
  mothership=null;
}

function mothershipHitAlongSegment(fromX,fromY,fromZ,toX,toY,toZ,padding=0){
  if(!mothership || mothership.health<=0) return null;

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
  if(!mothership || mothership.health<=0) return;
  mothership.health-=amount;
  mothership.hitFlash=Math.max(mothership.hitFlash,10);

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
    addScore(900);
    removeMothership();
    scheduleNextMothership();
  }
}

function spawnMothership(){
  if(mothership || gameOver || activeEnemies().length>10) return false;

  let center=playerCenter();
  let angle=Math.random()*Math.PI*2;
  let startDistance=mothershipHoverDistance+1450;
  let x=center.x+Math.cos(angle)*startDistance;
  let z=center.z+Math.sin(angle)*startDistance;
  let hoverX=center.x+Math.cos(angle)*mothershipHoverDistance;
  let hoverZ=center.z+Math.sin(angle)*mothershipHoverDistance;
  let exitX=center.x-Math.cos(angle)*(mothershipHoverDistance+520);
  let exitZ=center.z-Math.sin(angle)*(mothershipHoverDistance+520);
  let targetX=hoverX;
  let targetZ=hoverZ;
  let dx=targetX-x;
  let dz=targetZ-z;
  let len=Math.max(0.001,Math.hypot(dx,dz));
  let speed=2.45;
  let group=makeMothershipModel();
  let y=drivingSurfaceHeight(hoverX,hoverZ)+38+Math.random()*12;

  group.position.set(x,y,z);
  group.rotation.y=Math.atan2(dx,dz);
  scene.add(group);

  mothership={
    group,
    x,
    y,
    z,
    hoverX,
    hoverZ,
    exitX,
    exitZ,
    vx:(dx/len)*speed,
    vz:(dz/len)*speed,
    age:0,
    health:mothershipRocketHits,
    hitFlash:0,
    hasReachedHover:false,
    hoverFrames:0,
    life:mothershipHoverFrames+1280,
    dropTimer:70,
    dropsRemaining:mothershipDropCount,
    dropsDone:0,
    phase:Math.random()*Math.PI*2
  };
  return true;
}

function dropSpiderFromMothership(){
  if(!mothership || activeEnemies().length>14) return false;

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
    if(!gameOver && gameStarted){
      mothershipDelay--;
      if(mothershipDelay<=0 && !spawnMothership()) scheduleNextMothership();
    }
    return;
  }

  mothership.age++;
  let hoverDx=mothership.hoverX-mothership.x;
  let hoverDz=mothership.hoverZ-mothership.z;
  let hoverDistance=Math.hypot(hoverDx,hoverDz);
  if(hoverDistance<18) mothership.hasReachedHover=true;
  let hovering=mothership.hasReachedHover && mothership.hoverFrames<mothershipHoverFrames;

  if(hovering){
    mothership.hoverFrames++;
    mothership.x=mothership.hoverX+Math.sin(mothership.age*0.018+mothership.phase)*3.6;
    mothership.z=mothership.hoverZ+Math.cos(mothership.age*0.016+mothership.phase)*3.6;
  }else{
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
  let bob=Math.sin(mothership.age*0.025+mothership.phase)*4;
  if(mothership.hoverFrames<mothershipHoverFrames){
    let targetY=drivingSurfaceHeight(mothership.x,mothership.z)+42;
    mothership.y+=(targetY-mothership.y)*0.035;
  }
  mothership.group.position.set(mothership.x,mothership.y+bob,mothership.z);
  mothership.group.rotation.z=Math.sin(mothership.age*0.018+mothership.phase)*0.035;
  if(mothership.group.userData.bay){
    mothership.group.userData.bay.scale.setScalar(1+Math.sin(mothership.age*0.18)*0.08);
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
    mothership.group.scale.setScalar(1+Math.sin(mothership.hitFlash*1.7)*0.012);
    mothership.hitFlash--;
  }else{
    mothership.group.scale.setScalar(1);
  }

  if(mothership.hoverFrames>=mothershipHoverFrames && mothership.dropsRemaining>0){
    mothership.dropTimer--;
    if(mothership.dropTimer<=0){
      if(dropSpiderFromMothership()) mothership.dropsRemaining--;
      mothership.dropTimer=mothershipDropInterval;
    }
  }

  if(mothership.age>mothership.life){
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

function updateEnemy(enemy){
  if(!enemy.active || enemy.health<=0) return;
  if(enemy.cannonCooldown>0) enemy.cannonCooldown--;
  let settings=currentDifficulty();

  let target=nearestActivePlayer(enemy);
  if(!target){
    enemy.speed*=0.9;
    return;
  }

  enemy.aiTarget=target;
  let dx=target.x-enemy.x;
  let dz=target.z-enemy.z;
  let distance=Math.max(0.001,Math.hypot(dx,dz));
  let targetAngle=Math.atan2(dx,dz);
  if(enemy.isBoat){
    updateBoatEnemy(enemy,target,distance,targetAngle,settings);
    return;
  }
  let desiredAngle=targetAngle;
  let desiredSpeed;

  if(enemy.isSpider){
    if(distance<22){
      desiredAngle+=enemy.aiStrafe*clamp((22-distance)/18,0,1)*0.42;
    }
    desiredSpeed=distance>18 ? 0.28 : 0.12;
  }else if(enemy.isDrone){
    let minAimableDistance=48;
    let preferredDistance=74;
    let farDistance=104;
    if(distance<minAimableDistance){
      let escapeStrength=clamp((minAimableDistance-distance)/minAimableDistance,0,1);
      desiredAngle=targetAngle+Math.PI+enemy.aiStrafe*(0.34+escapeStrength*0.7);
      desiredSpeed=0.24+escapeStrength*0.22;
    }else if(distance<preferredDistance){
      let ringT=clamp((preferredDistance-distance)/(preferredDistance-minAimableDistance),0,1);
      desiredAngle=targetAngle+enemy.aiStrafe*(0.68+ringT*0.42);
      desiredSpeed=0.12+ringT*0.08;
    }else if(distance>farDistance){
      desiredAngle=targetAngle+enemy.aiStrafe*0.22;
      desiredSpeed=0.34;
    }else{
      desiredAngle=targetAngle+enemy.aiStrafe*(0.82+Math.sin(performance.now()*0.0016+enemy.guardPhase)*0.14);
      desiredSpeed=0.12;
    }
    if(distance>=minAimableDistance && distance<=farDistance && enemy.cannonCooldown<18){
      desiredAngle=targetAngle+enemy.aiStrafe*0.18;
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
      desiredAngle=targetAngle;
      desiredSpeed=0.035;
    }else if(homeDistance>24){
      desiredAngle=homeAngle;
      desiredSpeed=0.16;
    }else if(homeDistance>10){
      desiredAngle=homeAngle;
      desiredSpeed=0.055;
    }else{
      desiredAngle=targetAngle+enemy.aiStrafe*0.18*Math.sin(performance.now()*0.0015+enemy.guardPhase);
      desiredSpeed=0.012*Math.sin(performance.now()*0.002+enemy.guardPhase);
    }
  }else{
    if(distance<48){
      desiredAngle+=enemy.aiStrafe*clamp((48-distance)/28,0,1)*0.68;
    }
    desiredSpeed=distance>58 ? 0.38 : distance>30 ? 0.18 : -0.08;
  }

  let turnLimit=enemy.isGiant ? 0.026 : enemy.isDrone || enemy.isSpider ? 0.075 : 0.045;
  let turn=clamp(normalizeAngle(desiredAngle-enemy.angle),-turnLimit,turnLimit);
  enemy.angle=normalizeAngle(enemy.angle+turn);

  desiredSpeed*=settings.speed;
  enemy.speed+=clamp(desiredSpeed-enemy.speed,-0.012*settings.speed,0.012*settings.speed);
  let maxEnemySpeed=(enemy.isSpider ? 0.32 : enemy.isDrone ? 0.48 : enemy.isGiant ? 0.22 : enemy.isGuard ? 0.32 : enemy.isBoss ? 0.15 : enemy.spawnVillage && !enemy.isPatrol ? 0.18 : 0.42)*settings.speed;
  enemy.speed=clamp(enemy.speed,-0.14*settings.speed,maxEnemySpeed);

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
    enemy.speed*=-0.25;
    enemy.angle=normalizeAngle(enemy.angle+(Math.random()<0.5 ? -1 : 1)*0.55);
    enemy.aiStrafe*=-1;
    if((enemy.isSpider || enemy.isGiant) && collision.otherCar && enemy.contactCooldown<=0){
      damageCar(collision.otherCar,enemy.isGiant ? 8 : 4);
      rattleActor(collision.otherCar,enemy.isGiant ? 1.1 : 0.6);
      enemy.contactCooldown=42;
    }
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
  }else if(settings.hardFlight && enemy.flightTimer>0){
    enemy.flightTimer--;
    let flightOffset=enemy.isPatrol ? 24 : 12;
    let targetY=surfaceY+flightOffset+Math.sin(performance.now()*0.0018+enemy.guardPhase)*3.5;
    enemy.y+=(targetY-enemy.y)*0.045;
    enemy.onGround=false;
    enemy.airborne=true;
  }else{
    if(settings.hardFlight && enemy.flightCooldown>0) enemy.flightCooldown--;
    if(settings.hardFlight && enemy.flightCooldown<=0 && distance>34 && Math.random()<0.018){
      enemy.flightTimer=150+Math.floor(Math.random()*130);
      enemy.flightCooldown=260+Math.floor(Math.random()*220);
    }
    enemy.y+=(surfaceY-enemy.y)*0.22;
    if(Math.abs(enemy.y-surfaceY)<0.05) enemy.y=surfaceY;
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

  let fireRange=enemy.isDrone ? 118 : enemy.isGiant ? 132 : enemy.isGuard ? 96 : enemy.isBoss ? 112 : 82;
  let fireArc=enemy.isDrone ? 0.82 : enemy.isGiant ? 0.58 : enemy.isGuard ? 0.62 : enemy.isBoss ? 0.68 : 0.52;
  if(!enemy.isSpider && distance<fireRange && Math.abs(normalizeAngle(targetAngle-enemy.angle))<fireArc){
    if(fireCannon(enemy)){
      let baseDelay=enemy.isDrone ? 54+Math.floor(Math.random()*42) : enemy.isGiant ? 92+Math.floor(Math.random()*46) : enemy.isGuard ? 64+Math.floor(Math.random()*36) : enemy.isBoss ? 44+Math.floor(Math.random()*36) : 78+Math.floor(Math.random()*58);
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
  for(let enemy of enemies){
    updateEnemy(enemy);
    if(enemy.active && playerDistanceSqForEnemy(enemy)>720*720){
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

  if(activeEnemies().length<=1){
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
    if(activeEnemies().length<8 && spawnEnemyPatrol()){
      enemyPatrolDelay=scaledDelay(1500+Math.floor(Math.random()*1200),settings.patrolDelay);
    }else{
      enemyPatrolDelay=scaledDelay(360,settings.patrolDelay);
    }
  }
}

function updateVillageTurrets(){
  if(gameDifficulty==="easy") return;
  for(let chunk of world.chunks.values()){
    if(!chunk.colliders) continue;
    for(let turret of chunk.colliders){
      if(!turret || turret.type!=="turret" || turret.destroyed) continue;
      let target=null;
      let bestDistSq=Infinity;

      for(let car of activeCars()){
        if(car.health<=0 || !car.group.visible) continue;
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
  for(let base of world.bossBases || []){
    if(!base || !base.active || base.health<=0) continue;

    if(base.impactPulse>0){
      let pulse=base.impactPulse;
      base.group.scale.setScalar(1+Math.sin(pulse*Math.PI)*0.018);
      base.impactPulse=Math.max(0,pulse-0.08);
    }else if(base.group.scale.x!==1){
      base.group.scale.setScalar(1);
    }

    base.reinforcementCooldown=Math.max(0,(base.reinforcementCooldown || 0)-1);

    for(let car of activeCars()){
      if(car.health<=0 || !car.group.visible) continue;
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

      for(let car of activeCars()){
        if(car.health<=0 || !car.group.visible) continue;
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
        if(motorAudio.playLaserFire) motorAudio.playLaserFire();
        damageCar(target,7);
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

  if(pressedMorph && !gameOver && car.health>0){
    car.morphed=!car.morphed;
    if(car.morphed) car.jetMode=false;
  }
  if(pressedJet && !gameOver && car.health>0){
    car.jetMode=!car.jetMode;
    if(car.jetMode){
      car.morphed=false;
      car.jetAltitudeTarget=Math.max(car.y,drivingSurfaceHeight(car.x,car.z)+8);
    }
  }
  car.lastMorphButton=morphButton;
  car.lastJetButton=jetButton;
}

function updateFlightThrust(car,surfaceY){
  let buttons=input.getGamepadFaceButtons(car.gamepadIndex);
  let keyboardFlight=gameMode==="single" && car===playerCar && input.keys[" "];
  if(!(buttons.x || keyboardFlight) || gameOver || car.health<=0) return false;
  if(car.morphed || car.morphProgress>0.35) return false;
  if(car.boostCharge<=0) return false;

  let altitude=car.y-surfaceY;
  if(altitude<0.12){
    car.y=surfaceY+0.12;
    car.vy=Math.max(car.vy,0.18);
  }

  car.boostCharge=Math.max(0,car.boostCharge-(altitude<18 ? 0.34 : 0.18));
  let altitudeLift=altitude<18 ? 0.052 : 0.018;
  car.vy=clamp(car.vy+altitudeLift,-0.08,0.62);
  car.onGround=false;
  return true;
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

function emitJetHoverExhaust(car){
  let spawnJetParticle=dust.spawnJetExhaustParticle || dust.spawnThrusterParticle;
  let speedAbs=Math.abs(car.speed || 0);
  let forwardX=Math.sin(car.angle);
  let forwardZ=Math.cos(car.angle);
  let rightX=Math.cos(car.angle);
  let rightZ=-Math.sin(car.angle);

  for(let i=0;i<3;i++){
    let spread=(Math.random()-0.5)*1.05;
    let rearJitter=(Math.random()-0.5)*0.34;
    let px=car.x-forwardX*(2.35+rearJitter)+rightX*spread;
    let pz=car.z-forwardZ*(2.35+rearJitter)+rightZ*spread;
    spawnJetParticle(
      px,
      car.y+0.7+Math.random()*0.12,
      pz,
      -forwardX*(1.8+speedAbs*0.75)+rightX*(Math.random()-0.5)*0.38,
      -forwardZ*(1.8+speedAbs*0.75)+rightZ*(Math.random()-0.5)*0.38,
      -0.18-Math.random()*0.28,
      0.2+Math.random()*0.08,
      0.22+Math.random()*0.1
    );
  }
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
    let spot=new THREE.SpotLight(0xfff1c8,0,130,0.4,0.5,1.12);
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
  let targetZ=(15.5*(1-carBlend)+24*carBlend);

  rig.visible=power>0.01;
  for(let i=0;i<2;i++){
    let side=i===0 ? -1 : 1;
    let spot=rig.userData.spots[i];
    let target=rig.userData.targets[i];
    let lens=rig.userData.lenses[i];

    spot.position.set(side*x,y,z);
    spot.intensity=power*(carBlend>0.55 ? 11.5 : 8.8);
    spot.distance=carBlend>0.55 ? 145 : 118;
    spot.angle=carBlend>0.55 ? 0.34 : 0.42;
    target.position.set(side*x*0.7,targetY,targetZ);
    lens.position.set(side*x,y,z+0.05);
    lens.material.opacity=0.26+power*0.74;
  }
}

function setupMorphModels(car,accentColor){
  let mech=makeMechModel(accentColor);
  let aimCross=makeAimCross(accentColor);
  let headlights=makeVehicleHeadlights(accentColor);

  car.group.clear();
  car.group.add(mech,headlights,aimCross);
  car.mechModel=mech;
  car.jetModel=null;
  car.carModel=null;
  car.aimCross=aimCross;
  car.headlights=headlights;
  updateVehicleHeadlights(car);
}

function setMorphCarModel(car,model){
  if(car.carModel) car.group.remove(car.carModel);
  model.visible=false;
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

function makeMothershipModel(){
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
  let mech=(isDrone || isSpider || isBoat) ? null : isGuard ? makeGuardRobotModel(index) : makeEnemyMechModel(index,type);
  let drone=isDrone ? makeDroneModel(index) : null;
  let spider=isSpider ? makeSpiderModel(index) : null;
  let boat=isBoat ? makeRobotBoatModel(index) : null;
  if(mech){
    if(isBoss) mech.scale.multiplyScalar(1.55);
    if(isGiant) mech.scale.multiplyScalar(2.2);
    group.add(mech);
  }
  if(drone) group.add(drone);
  if(spider) group.add(spider);
  if(boat) group.add(boat);
  let collisionRadius=isGiant ? 7.9 : isBoss ? 5.8 : isBoat ? 5.6 : isGuard ? 3.15 : isSpider ? 3.2 : isDrone ? 2.9 : 2.35;
  let aimRadius=isGiant ? 10.5 : isBoss ? 9.5 : isBoat ? 7.5 : isSpider ? 4.8 : isDrone ? 4.2 : isGuard ? 5.0 : 4.5;
  let hitHeight=isGiant ? 12.5 : isBoss ? 8.5 : isBoat ? 4.6 : isDrone ? 5.2 : isSpider ? 3.6 : 5.2;
  let baseHealth=isGiant ? 420 : isBoss ? 260 : isGuard ? 82 : isBoat ? 72 : isDrone ? 34 : isSpider ? 24 : 36;
  let startY=isBoat ? waterLevel+0.56 : drivingSurfaceHeight(x,z)+(isDrone ? 20 : 0);
  let walkMaxSpeed=isGiant ? 0.24 : isBoss ? 0.2 : isGuard ? 0.32 : 0.4;

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
    active:true,
    group,
    shadow:(isDrone || isBoat) ? null : createCarShadow(scene),
    mechModel:mech,
    droneModel:drone,
    spiderModel:spider,
    boatModel:boat,
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
    jetAltitudeTarget:drivingSurfaceHeight(x,z)+8,
    jetModel:null,
    aimOffsetX:0,
    aimOffsetY:0,
    lastAimMouseVersion:-1,
    lastRocketButton:false,
    rocketCooldown:0,
    lastCannonButton:false,
    cannonCooldown:(isBoat ? 150 : isGiant ? 70 : isBoss ? 35 : isDrone ? 46 : 60)+Math.floor(Math.random()*(isBoat ? 120 : isGiant ? 70 : isBoss ? 35 : isDrone ? 38 : 70)),
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
    aiThink:0,
    guardPhase:Math.random()*Math.PI*2,
    lateralOffset:0,
    walkProfile:(isDrone || isSpider || isBoat) ? null : makeEnemyWalkProfile(index,type),
    walkMaxSpeed
  };
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
  let jetReveal=morphStage(jetP,0.46,0.86);
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
  }

  if(car.jetModel){
    let baseY=car.jetModel.userData.baseY || 0.45;
    let baseScale=car.jetModel.userData.baseScale || new THREE.Vector3(1,1,1);
    let scale=0.82+jetReveal*0.18;
    let snap=morphStage(jetP,0.72,1);

    car.jetModel.visible=jetP>0.34;
    car.jetModel.scale.set(baseScale.x*scale,baseScale.y*(0.74+jetReveal*0.26),baseScale.z*scale);
    car.jetModel.position.y=baseY+(1-jetReveal)*0.62+Math.sin(performance.now()*0.006)*0.12*jetReveal;
    car.jetModel.rotation.x=(1-jetReveal)*0.28-0.08*snap;
    car.jetModel.rotation.z=Math.sin(performance.now()*0.052)*0.035*transformShake*(1-snap);
  }

  if(car.aimCross){
    car.aimCross.scale.setScalar(1+Math.sin(performance.now()*0.004)*0.035);
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
  if(parts.pelvis) {
    parts.pelvis.rotation.z-=torsoSway*0.8;
    parts.pelvis.rotation.x+=forwardLean*0.35;
    parts.pelvis.rotation.y+=torsoTwist;
    parts.pelvis.position.y-=compression*0.46;
  }
  if(parts.head) {
    parts.head.rotation.z-=headCounter+heavyLean*0.32;
    parts.head.rotation.x+=forwardLean*0.32-heavyPitch*0.35;
    parts.head.rotation.y+=torsoTwist*0.32;
  }
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
  let weightedMechMovement=!jetMovement && !airborneMovement && car.morphProgress<0.4;

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
        car.speed+=(car.speed>0.03 ? -0.02 : -0.0045)*throttlePower;
      }else{
        if(!jetMovement){
          car.speed*=car.onGround ? 0.965 : 0.985;
          if(Math.abs(car.speed)<0.008) car.speed=0;
        }
      }
    }

    car.speed=clamp(car.speed,-localMaxSpeed*0.42,forwardMaxSpeed);

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
      car.turnVelocity=0;
      let highSpeedCalm=1-clamp((speedAbs-0.32)/0.32,0,0.18);
      let robotTurnBoost=1+0.42*(1-smoothStep(car.morphProgress/0.65));
      let steeringResponse=(0.52+movingSteer*0.54)*highSpeedCalm*robotTurnBoost;
      let jetYawScale=jetMovement ? 0.36 : 1;
      car.angle+=turn*reverseSteer*0.031*steeringResponse*jetYawScale;
      car.velAngle=car.angle;
    }

    car.slipAmount=0;
  }

  if(!gameOver && !carDisabled){
    let moveAngle=weightedMechMovement ? car.velAngle : car.angle;
    car.x+=Math.sin(moveAngle)*car.speed;
    car.z+=Math.cos(moveAngle)*car.speed;
    if(mountainClimbBlocked(car,prevX,prevZ,car.x,car.z)){
      car.x=prevX;
      car.z=prevZ;
      car.speed=Math.min(0,car.speed*0.18);
      car.vy=Math.min(car.vy,0);
      car.throttleEase=Math.min(0,car.throttleEase || 0);
    }
  }

  roadDist=roadDistance(car.x,car.z);
  car.surfaceDistance=roadDist;
  localMaxSpeed=mechGroundMaxSpeed;
  morphSpeedMultiplier=car.morphProgress>0.65 ? morphedCarSpeedMultiplier : 1;
  jetMovement=car.jetMode || car.jetProgress>0.65;
  airborneMovement=car.airborne || !car.onGround;
  car.speed=Math.max(
    -localMaxSpeed*0.42,
    Math.min(jetMovement ? jetMaxSpeed : (airborneMovement ? mechAirMaxSpeed : localMaxSpeed)*morphSpeedMultiplier,car.speed)
  );

  let surfaceY=drivingSurfaceHeight(car.x,car.z);

  let flying=updateFlightThrust(car,surfaceY);
  if(flying) emitFlightExhaust(car);
  let jetHovering=car.jetMode || car.jetProgress>0.65;
  if(jetHovering && !gameOver && !carDisabled){
    let climbInput=Math.max(0,car.liftInput || 0);
    car.speed=clamp(car.speed+climbInput*0.027,-mechGroundMaxSpeed*0.42,jetMaxSpeed);
    if(!Number.isFinite(car.jetAltitudeTarget)){
      car.jetAltitudeTarget=Math.max(car.y,surfaceY+8);
    }
    car.jetAltitudeTarget=clamp(car.jetAltitudeTarget+(car.liftInput || 0)*0.224,waterLevel+5,154);
    let hoverTarget=car.jetAltitudeTarget+Math.sin(performance.now()*0.004)*0.22;
    let lift=(hoverTarget-car.y)*0.045-car.vy*0.2;
    car.vy=clamp(car.vy+lift,-0.42,0.78);
    emitJetHoverExhaust(car);
  }

  let robotWaterMovement=!jetHovering && car.morphProgress<0.4;
  let waterDrag=clamp(waterDepthAt(car.x,car.z)/(robotWaterMovement ? 8.2 : 9.5),0,1);
  if(!gameOver && !carDisabled && !jetHovering && waterDrag>0){
    car.speed*=1-(robotWaterMovement ? 0.03 : 0.018)*waterDrag;
  }

  if(!gameOver && !carDisabled) car.vy-=flying ? gravityStrength*0.22 : jetHovering ? 0 : gravityStrength;
  let landingVy=car.vy;
  car.y+=car.vy;

  if(!gameOver && !carDisabled && jetHovering){
    let terrainCollision=terrainCollisionAlongSegment(prevX,prevY,prevZ,car.x,car.y,car.z,1.15);
    if(terrainCollision.hit){
      car.x=terrainCollision.safeX;
      car.z=terrainCollision.safeZ;
      surfaceY=drivingSurfaceHeight(car.x,car.z);
      car.y=Math.max(terrainCollision.safeY,surfaceY+1.15);
      car.vy=Math.max(0.12,-car.vy*0.25);
      car.speed*=0.18;
      car.jetAltitudeTarget=Math.max(car.jetAltitudeTarget || 0,car.y+7,surfaceY+9);
      damageCar(car,4);
      rattleActor(car,0.8);
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
    car.angle+=collision.otherCar ? Math.PI*0.12 : Math.PI*0.18;
    car.velAngle=car.angle;
    damageCar(car,collision.otherCar ? 1 : 3);
    surfaceY=drivingSurfaceHeight(car.x,car.z);
    if(car.y<surfaceY) car.y=surfaceY;
  }

  let waterDepth=waterDepthAt(car.x,car.z);
  let inWater=!jetHovering && waterDepth>0.15 && car.y<=waterLevel+1.1;
  let emitSplash=!jetHovering && !carDisabled && inWater && car.y<=waterLevel+1.1 && Math.abs(car.speed)>0.08;
  car.onGround=!jetHovering && car.y<=surfaceY+0.18;
  if(!jetHovering) wheelTracks.addCarTracks(car,surfaceY,inWater);
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
  car.airborne=airborne;
  updateAirTricks(car,airborne);
  car.speedDelta=car.speed-previousSpeed;

  let pitchSampleDist=2.2;
  let frontX=car.x+Math.sin(car.angle)*pitchSampleDist;
  let frontZ=car.z+Math.cos(car.angle)*pitchSampleDist;
  let backX=car.x-Math.sin(car.angle)*pitchSampleDist;
  let backZ=car.z-Math.cos(car.angle)*pitchSampleDist;
  let frontY=drivingSurfaceHeight(frontX,frontZ);
  let backY=drivingSurfaceHeight(backX,backZ);
  let jetPitch=clamp(-(car.liftInput || 0)*0.18-Math.max(0,car.speed)*0.025,-0.3,0.12);
  let targetPitch=jetHovering ? jetPitch : -Math.atan2(frontY-backY,pitchSampleDist*2);
  car.pitch+=(targetPitch-car.pitch)*0.18;
  let jetBankTarget=jetHovering ? clamp((car.turnInputEase || 0)*-0.46+(car.turnVelocity || 0)*-5.5,-0.58,0.58) : 0;
  car.jetBank+=(jetBankTarget-(car.jetBank || 0))*(jetHovering ? 0.12 : 0.18);

  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle+car.trickYaw;
  car.group.rotation.x=car.pitch+car.trickPitch;
  car.group.rotation.z=car.trickRoll+(car.jetBank || 0);
  updateMechAnimation(car);
  updateMorphVisual(car);
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

function updateCameraForCar(car){
  car.cameraYaw+=normalizeAngle(car.velAngle-car.cameraYaw)*0.075;

  let camDist=cameraFollowDistance;
  let camHeight=cameraFollowHeight;
  let camX=car.x-Math.sin(car.cameraYaw)*camDist;
  let camZ=car.z-Math.cos(car.cameraYaw)*camDist;
  let camY=car.y+camHeight;
  let lookAhead=16;

  car.camera.position.set(camX,camY,camZ);
  car.camera.lookAt(
    car.x+Math.sin(car.cameraYaw)*lookAhead,
    car.y+3.8,
    car.z+Math.cos(car.cameraYaw)*lookAhead
  );
}

function updateCameras(){
  updateCameraForCar(playerCar);
  if(gameMode==="double") updateCameraForCar(secondCar);

  if(gameMode==="single"){
    px=playerCar.x;
    py=playerCar.y+cameraFollowHeight;
    pz=playerCar.z;
  }else{
    px=(playerCar.x+secondCar.x)*0.5;
    py=(playerCar.y+secondCar.y)*0.5+cameraFollowHeight;
    pz=(playerCar.z+secondCar.z)*0.5;
  }
}

function aimCrossVisibleFor(car){
  return car.aimCross && car.morphProgress<0.35 && car.jetProgress<0.35 && car.health>0 && !gameOver && car.group.visible;
}

function setAimCrossForRender(focusedCar){
  for(let car of cars){
    if(!car.aimCross) continue;
    car.aimCross.visible=car===focusedCar && aimCrossVisibleFor(car);
  }
}

function renderGame(){
  let width=innerWidth;
  let height=innerHeight;

  if(gameMode==="single"){
    setAimCrossForRender(playerCar);
    renderer.setViewport(0,0,width,height);
    renderer.setScissor(0,0,width,height);
    renderer.render(scene,playerCamera);
    setAimCrossForRender(null);
    return;
  }

  let halfWidth=Math.floor(width*0.5);

  let leftCar=displayCars()[0];
  let rightCar=displayCars()[1];

  setAimCrossForRender(leftCar);
  renderer.setViewport(0,0,halfWidth,height);
  renderer.setScissor(0,0,halfWidth,height);
  renderer.render(scene,leftCar.camera);

  setAimCrossForRender(rightCar);
  renderer.setViewport(halfWidth,0,width-halfWidth,height);
  renderer.setScissor(halfWidth,0,width-halfWidth,height);
  renderer.render(scene,rightCar.camera);
  setAimCrossForRender(null);
}

let lastChunkSignature="";

function chunkSignatureForCars(){
  return activeCars()
    .map(car=>Math.floor(car.x/chunkSize)+","+Math.floor(car.z/chunkSize))
    .join("|");
}

function loop(){
  requestAnimationFrame(loop);

  if(!gameStarted){
    updateCameras();
    world.processChunkQueue(4,true);
    updateWeather();
    world.updateWind(performance.now(),rainIntensity);
    for(let car of cars) updateVehicleHeadlights(car);
    clouds.update();
    birds.update();
    ambientMotes.update();
    rain.update();
    renderGame();
    return;
  }

  for(let car of activeCars()){
    updateCar(car);
  }
  updateMothership();
  updateEnemies();
  updateVillageTurrets();
  updateBossBaseDefenses();
  updateSupplyBoxes();
  updateRockets();
  updateCannonBolts();
  updateClusterBombs();
  if(healthDamageCooldown>0) healthDamageCooldown--;

  dust.update();
  updateExplosions();
  updateTeleportEffects();
  updateRockDebris();
  updateBossLaserBeams();
  updateWeather();
  world.updateWind(performance.now(),rainIntensity);
  for(let car of cars) updateVehicleHeadlights(car);
  motorAudio.update();
  updateCameras();

  let chunkSignature=chunkSignatureForCars();

  if(chunkSignature!==lastChunkSignature){
    lastChunkSignature=chunkSignature;
    world.updateChunksForCenters(activeCars().map(car=>({x:car.x,z:car.z})));
  }

  clouds.update();
  birds.update();
  ambientMotes.update();
  rain.update();
  hud.updateSpeedHud();
  hud.updateMapHud();
  hud.updateCompassHud();
  world.processChunkQueue();
  renderGame();
}

window.addEventListener("resize",()=>{
  updateRendererPixelRatio();
  updateCameraProjection();
  renderer.setSize(innerWidth,innerHeight);
});

function setCarActive(car,active){
  car.group.visible=active;
  car.shadow.setVisible(active);
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

function startGame(mode,difficulty="medium"){
  gameMode=mode;
  gameDifficulty=difficultySettings[difficulty] ? difficulty : "medium";
  enemyBudgetRun++;
  gameStarted=true;
  document.body.classList.toggle("single-player",mode==="single");
  document.body.classList.toggle("double-player",mode==="double");

  clearRockets();
  clearEnemies();
  clearSupplyBoxes();
  jetUnlocked=false;
  score=0;
  scoredVillages=new WeakSet();
  playerCar.lateralOffset=mode==="single" ? 0 : -4.2;
  secondCar.lateralOffset=4.2;
  let startInfo=findSafeFieldStart(mode==="double" ? [playerCar.lateralOffset,secondCar.lateralOffset] : [playerCar.lateralOffset]);
  placeCarOnOpenField(playerCar,startInfo);
  placeCarOnOpenField(secondCar,startInfo);
  world.placeTestBossBaseNearStart(playerCar.x,playerCar.z,playerCar.angle);
  spawnBossBaseGuards();
  setCarActive(playerCar,true);
  setCarActive(secondCar,mode==="double");
  playerCar.cameraYaw=playerCar.angle;
  secondCar.cameraYaw=secondCar.angle;
  updateRendererPixelRatio();
  updateCameraProjection();
  updateCameras();

  let startScreen=document.getElementById("startScreen");
  if(startScreen) startScreen.style.display="none";

  hud.init();
  lastChunkSignature=chunkSignatureForCars();
  world.updateChunksForCenters(activeCars().map(car=>({x:car.x,z:car.z})));
  let settings=currentDifficulty();
  enemyWaveDelay=scaledDelay(90,settings.waveDelay);
  enemyPatrolDelay=scaledDelay(900+Math.floor(Math.random()*420),settings.patrolDelay);
}

let startScreen=document.getElementById("startScreen");
if(startScreen){
  startScreen.addEventListener("click",event=>{
    let button=event.target.closest("[data-mode]");
    if(!button || gameStarted) return;
    let difficulty=startScreen.dataset.difficulty || "medium";
    startGame(button.dataset.mode==="double" ? "double" : "single",difficulty);
  });
}

setupMorphModels(playerCar,0xb83a32);
setupMorphModels(secondCar,0x2f66d8);
setCarActive(playerCar,true);
setCarActive(secondCar,false);

loadCarModel()
  .then(model=>{
    setMorphCarModel(playerCar,model.clone(true));
    setMorphCarModel(secondCar,model.clone(true));
  })
  .catch(error=>{
    console.error("Failed to load car model:",error);
  });

loadJetModel(0xb83a32)
  .then(model=>{
    setMorphJetModel(playerCar,model);
  })
  .catch(error=>{
    console.error("Failed to load player jet model:",error);
  });

loadJetModel(0x2f66d8)
  .then(model=>{
    setMorphJetModel(secondCar,model);
  })
  .catch(error=>{
    console.error("Failed to load second jet model:",error);
  });

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
  car.jetAltitudeTarget=drivingSurfaceHeight(car.x,car.z)+8;
  car.lastJetButton=false;
  car.aimOffsetX=0;
  car.aimOffsetY=0;
  car.aimDistance=32;
  car.hasMouseAimPoint=false;
  car.hasGamepadAimPoint=false;
  car.controllerAimOffsetX=0;
  car.controllerAimOffsetY=0;
  car.mouseAimWorldX=0;
  car.mouseAimWorldY=0;
  car.mouseAimWorldZ=0;
  car.lastAimMouseVersion=input.mouse.version;
  if(car.aimCross) car.aimCross.position.set(0,3.15,32);
  car.lastRocketButton=false;
  car.rocketCooldown=0;
  car.rocketAmmo=maxRocketAmmo();
  car.lastCannonButton=false;
  car.cannonCooldown=0;
  car.cannonAmmo=maxCannonAmmo();
  car.clusterBombCooldown=0;
  car.clusterBombAmmo=initialClusterBombAmmo;
  car.boostCharge=maxBoostCharge;
  car.hitRattle=0;
  car.hitRattleSeed=0;
  car.walkCycle=0;
  car.lastWalkX=car.x;
  car.lastWalkZ=car.z;
  car.y=drivingSurfaceHeight(car.x,car.z);
  car.group.position.set(car.x,car.y,car.z);
  car.group.rotation.y=car.angle;
  car.group.rotation.x=0;
  car.group.rotation.z=0;
  updateMechAnimation(car);
  updateMorphVisual(car);
}

setWorldSeed(Math.random()*100000,currentEnvironment.terrain || {});
let initialStartInfo=findSafeFieldStart([playerCar.lateralOffset,0,secondCar.lateralOffset]);
placeCarOnOpenField(playerCar,initialStartInfo);
placeCarOnOpenField(secondCar,initialStartInfo);
world.placeTestBossBaseNearStart(playerCar.x,playerCar.z,playerCar.angle);
playerCar.cameraYaw=playerCar.angle;
secondCar.cameraYaw=secondCar.angle;
updateCameras();

lastChunkSignature=chunkSignatureForCars();
world.updateChunksForCenters(activeCars().map(car=>({x:car.x,z:car.z})));
world.processChunkQueue(80,true);
clouds.makeClouds();
birds.makeBirds();
loop();
