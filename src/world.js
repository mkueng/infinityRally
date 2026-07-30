import { THREE } from "./three.js";
import { carRadius, chunkSize, segments, viewDistance } from "./constants.js";
import { groundHeight, rand, roadCenterX, roadDistance } from "./terrain.js?v=titan-wide-plateaus";
import { makeCarShadowTexture, makeGroundTexture } from "./textures.js?v=building-shadows";
import { makeMissionOutpostTerminal } from "./models.js?v=radar-performance-fix";

export function createWorld(scene,options={}){
  let chunkQueue=[];
  let removalQueue=[];
  let neededChunks=new Set();
  let chunkDetails=new Map();
  let chunks=new Map();
  let bossBases=[];
  let bossBaseColliders=[];
  let testingRadarOutpost=null;
  let missionRadarOutposts=[];
  let landingSpaceModel=null;
  let treasureChestModels=[];
  let treasureHoleChance=0.24;
  let animatedLandingRings=[];
  let animatedRadarDishes=[];
  let lastRadarDishAnimationTime=0;
  let activeVillages=[];
  let activeTurrets=[];
  let rockRaycaster=new THREE.Raycaster();
  let rockRayDirection=new THREE.Vector3();
  let rockRayHits=[];
  let rockInstanceMatrix=new THREE.Matrix4();
  let rockInstancePosition=new THREE.Vector3();
  let rockInstanceQuaternion=new THREE.Quaternion();
  let rockInstanceScale=new THREE.Vector3();
  let activeChunkBuild=null;
  let lastChunkBuildTime=0;
  let chunkWorker=null;
  let chunkWorkerJobId=1;
  let chunkWorkerGeneration=1;
  let chunkWorkerResults=new Map();
  let chunkWorkerTerrainSeed=0;
  let chunkWorkerTerrainProfile={};
  let renderStressSignature="";
  let getDifficulty=typeof options.getDifficulty==="function" ? options.getDifficulty : ()=>"medium";
  let getPerformanceMode=typeof options.getPerformanceMode==="function" ? options.getPerformanceMode : ()=>"full";
  let defaultEnvironment={
    colors:{
      underwater:0x8f5a6c,
      shore:0xd6b25a,
      low:0x8b3852,
      mid:0x5a3b70,
      high:0x3f3456,
      water:0x20ffd4,
      waterEmissive:0x036f6d,
      bark:0x24133a,
      barkEmissive:0x12061f,
      leaf:0xb66cff,
      leafEmissive:0x5a22c9,
      pod:0xff6bd6,
      podEmissive:0xff2ca8,
      grass:0x9df58d,
      grassEmissive:0x173d18,
      rock:0x3f334b,
      wall:0x5a526d,
      roof:0x322b45,
      trim:0xa78fbd,
      brick:0x714060,
      street:0x1d1f25
    },
    city:false,
    shoreline:{
      wetWaterMix:0,
      innerHeight:1.8,
      outerHeight:12,
      innerShoreBlend:0.35,
      wetShaderWaterMix:0,
      wetShaderHeight:9.5,
      wetShaderStrength:0.18,
      terrainShoreStrength:1,
      shoreBandWaterMix:0,
      showBand:false,
      useClippedWater:false,
      waterMinVisibleDepth:0
    },
    rocks:{
      highAltitudeStart:34,
      highAltitudeFull:58,
      highAltitudeMaxScale:1.38,
      veryHighMaxScale:1.02
    },
    vegetation:{
      treeClusters:2,
      treesPerCluster:8,
      treeClusterRadius:25,
      crownsPerTree:7,
      podsPerTree:4,
      trunkHeightBase:1,
      trunkHeightVariance:0.34,
      trunkWidthBase:0.72,
      trunkWidthVariance:0.34,
      leanAmount:0.18,
      crownBaseScale:1.25,
      crownScaleStep:0.08,
      crownSpreadBase:1.1,
      crownSpreadVariance:2.4,
      crownLiftBase:9.1,
      crownLiftStep:0.28,
      crownWidthScale:1,
      crownFlatness:1,
      crownDepthScale:1,
      podScaleBase:0.42,
      podScaleVariance:0.34,
      podLiftBase:7.1,
      podLiftVariance:1.6,
      podElongation:1.35,
      grassClusters:20,
      grassPerCluster:400,
      grassClusterRadius:10
    }
  };
  let initialEnvironment=options.getEnvironment ? options.getEnvironment() : {};
  let currentEnvironment={
    ...defaultEnvironment,
    ...initialEnvironment,
    colors:{...defaultEnvironment.colors,...(initialEnvironment.colors || {})},
    shoreline:{...defaultEnvironment.shoreline,...(initialEnvironment.shoreline || {})},
    rocks:{...defaultEnvironment.rocks,...(initialEnvironment.rocks || {})},
    vegetation:{...defaultEnvironment.vegetation,...(initialEnvironment.vegetation || {})}
  };
  const roadsEnabled=false;
  const waterSurfaceVisualLift=0.62;

let landMat;
let rockMat;
let cheapTreeCrownMats=[];
const terrainDetailTexture=new THREE.TextureLoader().load(
  "./assets/textures/Ground056.png?v=terrain-detail-ground056",
  ()=>{
    if(landMat) landMat.needsUpdate=true;
  },
  undefined,
  error=>console.warn("Ground terrain texture failed to load",error)
);
terrainDetailTexture.wrapS=THREE.RepeatWrapping;
terrainDetailTexture.wrapT=THREE.RepeatWrapping;
terrainDetailTexture.anisotropy=4;
if(THREE.SRGBColorSpace) terrainDetailTexture.colorSpace=THREE.SRGBColorSpace;

const terrainNormalTexture=new THREE.TextureLoader().load(
  "./assets/textures/Ground056_1K-JPG_NormalGL.jpg?v=terrain-normal-ground056",
  ()=>{
    if(landMat) landMat.needsUpdate=true;
  },
  undefined,
  error=>console.warn("Ground normal texture failed to load",error)
);
terrainNormalTexture.wrapS=THREE.RepeatWrapping;
terrainNormalTexture.wrapT=THREE.RepeatWrapping;
terrainNormalTexture.repeat.set(12,12);
terrainNormalTexture.anisotropy=4;
if(THREE.NoColorSpace) terrainNormalTexture.colorSpace=THREE.NoColorSpace;

const rockTexture=new THREE.TextureLoader().load(
  "./assets/textures/rocks/Rock050.png?v=rock050-color",
  ()=>{
    if(rockMat) rockMat.needsUpdate=true;
  },
  undefined,
  error=>console.warn("Rock texture failed to load",error)
);
rockTexture.wrapS=THREE.RepeatWrapping;
rockTexture.wrapT=THREE.RepeatWrapping;
rockTexture.repeat.set(1.7,1.7);
rockTexture.anisotropy=4;
if(THREE.SRGBColorSpace) rockTexture.colorSpace=THREE.SRGBColorSpace;

const rockNormalTexture=new THREE.TextureLoader().load(
  "./assets/textures/rocks/Rock050_1K-PNG_NormalGL.png?v=rock050-normal",
  ()=>{
    if(rockMat) rockMat.needsUpdate=true;
  },
  undefined,
  error=>console.warn("Rock normal texture failed to load",error)
);
rockNormalTexture.wrapS=THREE.RepeatWrapping;
rockNormalTexture.wrapT=THREE.RepeatWrapping;
rockNormalTexture.repeat.set(1.7,1.7);
rockNormalTexture.anisotropy=4;
if(THREE.NoColorSpace) rockNormalTexture.colorSpace=THREE.NoColorSpace;

const cheapTreeCrownTexture=new THREE.TextureLoader().load(
  "./assets/textures/plants/Ground001.png?v=cheap-tree-crown-ground001",
  ()=>{
    for(let material of cheapTreeCrownMats) material.needsUpdate=true;
  },
  undefined,
  error=>console.warn("Cheap tree crown texture failed to load",error)
);
cheapTreeCrownTexture.wrapS=THREE.RepeatWrapping;
cheapTreeCrownTexture.wrapT=THREE.RepeatWrapping;
cheapTreeCrownTexture.repeat.set(1.8,1.8);
cheapTreeCrownTexture.anisotropy=4;
if(THREE.SRGBColorSpace) cheapTreeCrownTexture.colorSpace=THREE.SRGBColorSpace;

const cheapTreeCrownNormalTexture=new THREE.TextureLoader().load(
  "./assets/textures/plants/Ground001_1K-PNG_NormalGL.png?v=cheap-tree-crown-ground001-normal",
  ()=>{
    for(let material of cheapTreeCrownMats) material.needsUpdate=true;
  },
  undefined,
  error=>console.warn("Cheap tree crown normal texture failed to load",error)
);
cheapTreeCrownNormalTexture.wrapS=THREE.RepeatWrapping;
cheapTreeCrownNormalTexture.wrapT=THREE.RepeatWrapping;
cheapTreeCrownNormalTexture.repeat.set(1.8,1.8);
cheapTreeCrownNormalTexture.anisotropy=4;
if(THREE.NoColorSpace) cheapTreeCrownNormalTexture.colorSpace=THREE.NoColorSpace;

landMat=new THREE.MeshStandardMaterial({
  map:makeGroundTexture(currentEnvironment),
  normalMap:terrainNormalTexture,
  normalScale:new THREE.Vector2(currentEnvironment.terrainDetail?.normalScale ?? 0.38,currentEnvironment.terrainDetail?.normalScale ?? 0.38),
  vertexColors:true,
  side:THREE.DoubleSide,
  roughness:0.92,
  metalness:0.04
});
landMat.onBeforeCompile=shader=>{
  shader.uniforms.terrainDetailMap={value:terrainDetailTexture};
  shader.uniforms.terrainDetailScale={value:currentEnvironment.terrainDetail?.scale ?? 0.024};
  shader.uniforms.terrainDetailStrength={value:currentEnvironment.terrainDetail?.strength ?? 0.54};
  shader.uniforms.terrainDetailTextureMix={value:currentEnvironment.terrainDetail?.textureMix ?? 1};
  shader.uniforms.mountainDetailStrength={value:currentEnvironment.terrainDetail?.mountainStrength ?? 1};
  shader.uniforms.landWetWaterLevel={value:waterLevel+waterSurfaceVisualLift};
  shader.uniforms.landWetShoreColor={value:new THREE.Color(0xd6b25a)};
  shader.uniforms.landWetWaterColor={value:new THREE.Color(0x20ffd4)};
  shader.uniforms.landWetStrength={value:0.34};
  shader.uniforms.landWetBandHeight={value:currentEnvironment.shoreline?.wetShaderHeight ?? 9.5};
  landMat.userData.shader=shader;
  shader.vertexShader=shader.vertexShader.replace(
    "#include <common>",
    [
      "#include <common>",
      "varying vec3 vLandWorldPosition;"
    ].join("\n")
  );
  shader.vertexShader=shader.vertexShader.replace(
    "#include <begin_vertex>",
    [
      "#include <begin_vertex>",
      "vLandWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;"
    ].join("\n")
  );
  shader.fragmentShader=shader.fragmentShader.replace(
    "#include <common>",
    [
      "#include <common>",
      "varying vec3 vLandWorldPosition;",
      "uniform sampler2D terrainDetailMap;",
      "uniform float terrainDetailScale;",
      "uniform float terrainDetailStrength;",
      "uniform float terrainDetailTextureMix;",
      "uniform float mountainDetailStrength;",
      "uniform float landWetWaterLevel;",
      "uniform vec3 landWetShoreColor;",
      "uniform vec3 landWetWaterColor;",
      "uniform float landWetStrength;",
      "uniform float landWetBandHeight;",
      "float landHash(vec2 p){",
      "  p=fract(p*vec2(127.1,311.7));",
      "  p+=dot(p,p+74.7);",
      "  return fract(p.x*p.y);",
      "}",
      "float landNoise(vec2 p){",
      "  vec2 i=floor(p);",
      "  vec2 f=fract(p);",
      "  vec2 u=f*f*(3.0-2.0*f);",
      "  float a=landHash(i);",
      "  float b=landHash(i+vec2(1.0,0.0));",
      "  float c=landHash(i+vec2(0.0,1.0));",
      "  float d=landHash(i+vec2(1.0,1.0));",
      "  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);",
      "}",
      "vec4 terrainDetailSample(vec2 uv){",
      "  vec2 tile=floor(uv);",
      "  vec2 f=fract(uv);",
      "  vec2 flip=step(0.5,vec2(landHash(tile+vec2(11.0,3.0)),landHash(tile+vec2(5.0,17.0))));",
      "  f=mix(f,1.0-f,flip);",
      "  float rot=floor(landHash(tile+vec2(23.0,29.0))*4.0);",
      "  vec2 rf=f-0.5;",
      "  if(rot<0.5){",
      "    f=rf+0.5;",
      "  }else if(rot<1.5){",
      "    f=vec2(-rf.y,rf.x)+0.5;",
      "  }else if(rot<2.5){",
      "    f=-rf+0.5;",
      "  }else{",
      "    f=vec2(rf.y,-rf.x)+0.5;",
      "  }",
      "  vec2 offset=vec2(landHash(tile+vec2(31.0,47.0)),landHash(tile+vec2(53.0,61.0)))*0.42;",
      "  vec2 sampleUv=fract(f*0.52+offset);",
      "  return texture2D(terrainDetailMap,sampleUv);",
      "}"
    ].join("\n")
  );
  shader.fragmentShader=shader.fragmentShader.replace(
    "#include <dithering_fragment>",
    [
      "float terrainBreakup=landNoise(vLandWorldPosition.xz*0.006+vec2(17.4,-9.2));",
      "float terrainWarpA=landNoise(vLandWorldPosition.xz*0.018+vec2(4.1,-8.7))-0.5;",
      "float terrainWarpB=landNoise(vLandWorldPosition.xz*0.027+vec2(-12.4,6.6))-0.5;",
      "vec2 terrainWarp=vec2(terrainWarpA,terrainWarpB)*(0.75+terrainBreakup*0.65);",
      "vec2 terrainDetailUvA=vLandWorldPosition.xz*terrainDetailScale+terrainWarp;",
      "vec2 terrainDetailUvB=vec2(terrainDetailUvA.x*0.54-terrainDetailUvA.y*0.84,terrainDetailUvA.x*0.84+terrainDetailUvA.y*0.54)*1.73+vec2(0.37,0.19);",
      "vec2 terrainDetailUvC=vec2(terrainDetailUvA.x*-0.18-terrainDetailUvA.y*0.98,terrainDetailUvA.x*0.98-terrainDetailUvA.y*0.18)*0.63+vec2(0.71,0.43);",
      "vec4 terrainDetailA=terrainDetailSample(terrainDetailUvA);",
      "vec4 terrainDetailB=terrainDetailSample(terrainDetailUvB);",
      "vec4 terrainDetailC=terrainDetailSample(terrainDetailUvC);",
      "float terrainBlend=landNoise(vLandWorldPosition.xz*0.014+vec2(terrainBreakup*3.3,2.8));",
      "vec3 terrainDetailRgb=mix(mix(terrainDetailA.rgb,terrainDetailB.rgb,0.35+terrainBreakup*0.34),terrainDetailC.rgb,0.18+terrainBlend*0.28);",
      "float terrainDetailLuma=dot(terrainDetailRgb,vec3(0.299,0.587,0.114));",
      "float terrainDetailContrast=(terrainDetailLuma-0.5)*2.0;",
      "float terrainFine=landNoise(vLandWorldPosition.xz*0.044+vec2(terrainBreakup*6.1,terrainBreakup*-4.3));",
      "float terrainProceduralContrast=(terrainBreakup*0.72+terrainFine*0.28-0.5)*1.65;",
      "terrainDetailContrast=mix(terrainProceduralContrast,terrainDetailContrast,terrainDetailTextureMix);",
      "float terrainDetailMask=0.68+terrainBreakup*0.24+terrainFine*0.14;",
      "float terrainDetailDistance=distance(cameraPosition,vLandWorldPosition);",
      "float terrainDetailFade=1.0-smoothstep(950.0,2100.0,terrainDetailDistance);",
      "vec3 terrainDetailTone=vec3(1.0+terrainDetailContrast*0.58);",
      "vec3 terrainDetailColorTone=mix(vec3(1.0+terrainProceduralContrast*0.42),terrainDetailRgb*1.18,terrainDetailTextureMix);",
      "vec3 terrainDetailResult=gl_FragColor.rgb*mix(terrainDetailTone,terrainDetailColorTone,0.2);",
      "gl_FragColor.rgb=mix(gl_FragColor.rgb,terrainDetailResult,terrainDetailStrength*terrainDetailMask*terrainDetailFade);",
      "float wetHeight=vLandWorldPosition.y-landWetWaterLevel;",
      "float wetBand=(1.0-smoothstep(1.0,landWetBandHeight,wetHeight))*smoothstep(-1.4,0.85,wetHeight);",
      "float wetBreakup=landNoise(vLandWorldPosition.xz*0.043+vec2(9.3,-4.7));",
      "wetBand*=0.68+wetBreakup*0.32;",
      "vec3 wetColor=mix(landWetWaterColor,landWetShoreColor,smoothstep(0.0,landWetBandHeight*0.74,max(wetHeight,0.0)));",
      "gl_FragColor.rgb=mix(gl_FragColor.rgb,wetColor,wetBand*landWetStrength);",
      "float mountainTintMask=smoothstep(18.0,46.0,vLandWorldPosition.y)*mountainDetailStrength;",
      "if(mountainTintMask>0.001){",
      "  float crag=landNoise(vLandWorldPosition.xz*0.055+vec2(vLandWorldPosition.y*0.017,-vLandWorldPosition.y*0.013));",
      "  float breakup=landNoise(vLandWorldPosition.xz*0.021+vec2(41.2,-29.6));",
      "  float crack=1.0-abs(landNoise(vLandWorldPosition.xz*0.115+vec2(23.4,-17.8)+breakup*1.7)*2.0-1.0);",
      "  float darkCuts=smoothstep(0.78,0.96,crack)*0.24;",
      "  float paleEdges=smoothstep(0.74,1.0,crag)*smoothstep(0.24,0.92,breakup)*0.12;",
      "  vec3 rockShadow=vec3(0.52,0.48,0.62);",
      "  vec3 rockHighlight=vec3(1.18,1.12,1.04);",
      "  gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*rockShadow,mountainTintMask*darkCuts);",
      "  gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*rockHighlight,mountainTintMask*paleEdges);",
      "}",
      "#include <dithering_fragment>"
    ].join("\n")
  );
};

function setTerraformBloomAmount(amount=0){
  let t=Math.max(0,Math.min(1,amount));
  landMat.color.set(0xffffff).lerp(new THREE.Color(0x7dff71),t*0.78);
  landMat.emissive.set(0x102a0c).multiplyScalar(t*0.28);
}

let waterMat=new THREE.MeshStandardMaterial({
  color:0x20ffd4,
  emissive:0x036f6d,
  emissiveIntensity:0.38,
  transparent:true,
  opacity:.56,
  depthWrite:false,
  depthTest:true,
  side:THREE.DoubleSide
});
let shoreBandMat=new THREE.MeshBasicMaterial({
  color:0x8feee7,
  transparent:true,
  opacity:0.42,
  depthWrite:false,
  depthTest:true,
  side:THREE.DoubleSide
});
shoreBandMat.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace(
    "#include <common>",
    [
      "#include <common>",
      "attribute float shoreBandAlpha;",
      "varying float vShoreBandAlpha;",
      "varying vec3 vShoreBandWorldPosition;"
    ].join("\n")
  );
  shader.vertexShader=shader.vertexShader.replace(
    "#include <begin_vertex>",
    [
      "#include <begin_vertex>",
      "vShoreBandAlpha=shoreBandAlpha;",
      "vShoreBandWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;"
    ].join("\n")
  );
  shader.fragmentShader=shader.fragmentShader.replace(
    "#include <common>",
    [
      "#include <common>",
      "varying float vShoreBandAlpha;",
      "varying vec3 vShoreBandWorldPosition;",
      "float shoreBandHash(vec2 p){",
      "  p=fract(p*vec2(123.34,345.45));",
      "  p+=dot(p,p+34.21);",
      "  return fract(p.x*p.y);",
      "}",
      "float shoreBandNoise(vec2 p){",
      "  vec2 i=floor(p);",
      "  vec2 f=fract(p);",
      "  vec2 u=f*f*(3.0-2.0*f);",
      "  float a=shoreBandHash(i);",
      "  float b=shoreBandHash(i+vec2(1.0,0.0));",
      "  float c=shoreBandHash(i+vec2(0.0,1.0));",
      "  float d=shoreBandHash(i+vec2(1.0,1.0));",
      "  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);",
      "}"
    ].join("\n")
  );
  shader.fragmentShader=shader.fragmentShader.replace(
    "#include <dithering_fragment>",
    [
      "float shoreBandBreakup=shoreBandNoise(vShoreBandWorldPosition.xz*0.055);",
      "gl_FragColor.a*=vShoreBandAlpha*(0.5+shoreBandBreakup*0.5);",
      "#include <dithering_fragment>"
    ].join("\n")
  );
};
let waterLevel=-20;
let underwaterVisualDropBase=1.55;
let underwaterVisualDropScale=0.62;
let underwaterVisualDropMax=10.5;
let underwaterLargePondDropMax=16;

function waterSmoothstep01(value){
  value=Math.max(0,Math.min(1,value));
  return value*value*(3-2*value);
}

function underwaterVisualHeight(baseHeight,shoreDistance=0){
  if(baseHeight>=waterLevel) return baseHeight;
  let depth=waterLevel-baseHeight;
  let pondScale=waterSmoothstep01((shoreDistance-24)/210);
  let visualDrop=underwaterVisualDropBase
    +Math.min(underwaterVisualDropMax,depth*underwaterVisualDropScale)
    +pondScale*Math.min(underwaterLargePondDropMax,2.2+depth*0.74);
  return Math.min(baseHeight,waterLevel-visualDrop);
}

function waterShoreDistances(waterMask){
  let gridSize=segments+1;
  let vertexCount=waterMask.length;
  let distances=new Float32Array(vertexCount);
  let large=1000000;
  let straight=chunkSize/segments;
  let diagonal=straight*Math.SQRT2;
  let hasDry=false;

  for(let i=0;i<vertexCount;i++){
    if(waterMask[i]){
      distances[i]=large;
    }else{
      distances[i]=0;
      hasDry=true;
    }
  }

  if(!hasDry){
    distances.fill(chunkSize*0.75);
    return distances;
  }

  for(let z=0;z<gridSize;z++){
    for(let x=0;x<gridSize;x++){
      let i=z*gridSize+x;
      let d=distances[i];
      if(x>0) d=Math.min(d,distances[i-1]+straight);
      if(z>0) d=Math.min(d,distances[i-gridSize]+straight);
      if(x>0 && z>0) d=Math.min(d,distances[i-gridSize-1]+diagonal);
      if(x<gridSize-1 && z>0) d=Math.min(d,distances[i-gridSize+1]+diagonal);
      distances[i]=d;
    }
  }

  for(let z=gridSize-1;z>=0;z--){
    for(let x=gridSize-1;x>=0;x--){
      let i=z*gridSize+x;
      let d=distances[i];
      if(x<gridSize-1) d=Math.min(d,distances[i+1]+straight);
      if(z<gridSize-1) d=Math.min(d,distances[i+gridSize]+straight);
      if(x<gridSize-1 && z<gridSize-1) d=Math.min(d,distances[i+gridSize+1]+diagonal);
      if(x>0 && z<gridSize-1) d=Math.min(d,distances[i+gridSize-1]+diagonal);
      distances[i]=d;
    }
  }

  return distances;
}

let barkMat=new THREE.MeshStandardMaterial({color:0x24133a,emissive:0x12061f,emissiveIntensity:0.2,roughness:0.88});
let leafMat=new THREE.MeshStandardMaterial({color:0xb66cff,emissive:0x5a22c9,emissiveIntensity:0.48,roughness:0.64});
function makeCheapTreeCrownMaterial(color,emissive){
  return new THREE.MeshStandardMaterial({
    color,
    map:cheapTreeCrownTexture,
    normalMap:cheapTreeCrownNormalTexture,
    normalScale:new THREE.Vector2(0.72,0.72),
    emissive,
    emissiveIntensity:0.18,
    roughness:0.94,
    metalness:0.02
  });
}
cheapTreeCrownMats=[
  makeCheapTreeCrownMaterial(0x9ed873,0x123b16),
  makeCheapTreeCrownMaterial(0xd6d45f,0x3d3810),
  makeCheapTreeCrownMaterial(0x63b46d,0x0b2b18)
];
let podMat=new THREE.MeshStandardMaterial({color:0xff6bd6,emissive:0xff2ca8,emissiveIntensity:0.78,roughness:0.52});
let waterShimmerShader=null;
let grassMat=new THREE.MeshStandardMaterial({color:0x9df58d,emissive:0x173d18,emissiveIntensity:0.12,roughness:0.84});
let bushMat=new THREE.MeshStandardMaterial({color:0x38c751,emissive:0x0d5c20,emissiveIntensity:0.18,roughness:0.82,vertexColors:true});
waterMat.onBeforeCompile=shader=>{
  shader.uniforms.waterShimmerTime={value:0};
  shader.uniforms.waterDayAmount={value:1};
  shader.uniforms.waterNightAmount={value:0};
  shader.uniforms.waterRainIntensity={value:0};
  waterShimmerShader=shader;
  shader.vertexShader=shader.vertexShader.replace(
    "#include <common>",
    [
      "#include <common>",
      "varying vec3 vWaterWorldPosition;"
    ].join("\n")
  );
  shader.vertexShader=shader.vertexShader.replace(
    "#include <begin_vertex>",
    [
      "#include <begin_vertex>",
      "vWaterWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;"
    ].join("\n")
  );
  shader.fragmentShader=shader.fragmentShader.replace(
    "#include <common>",
    [
      "#include <common>",
      "uniform float waterShimmerTime;",
      "uniform float waterDayAmount;",
      "uniform float waterNightAmount;",
      "uniform float waterRainIntensity;",
      "varying vec3 vWaterWorldPosition;",
      "float waterHash(vec2 p){",
      "  p=fract(p*vec2(123.34,456.21));",
      "  p+=dot(p,p+45.32);",
      "  return fract(p.x*p.y);",
      "}",
      "float waterValueNoise(vec2 p){",
      "  vec2 i=floor(p);",
      "  vec2 f=fract(p);",
      "  vec2 u=f*f*(3.0-2.0*f);",
      "  float a=waterHash(i);",
      "  float b=waterHash(i+vec2(1.0,0.0));",
      "  float c=waterHash(i+vec2(0.0,1.0));",
      "  float d=waterHash(i+vec2(1.0,1.0));",
      "  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);",
      "}"
    ].join("\n")
  );
  shader.fragmentShader=shader.fragmentShader.replace(
    "#include <dithering_fragment>",
    [
      "vec2 waterUv=vWaterWorldPosition.xz;",
      "float waterRainFade=1.0-clamp(waterRainIntensity*0.55,0.0,0.72);",
      "float shimmerA=waterValueNoise(waterUv*0.058+vec2(waterShimmerTime*0.58,waterShimmerTime*0.25));",
      "float shimmerB=waterValueNoise(waterUv*0.113+vec2(-waterShimmerTime*0.36,waterShimmerTime*0.5));",
      "float shimmer=pow(max(shimmerA*0.62+shimmerB*0.48-0.48,0.0),2.6);",
      "float dayShimmer=waterDayAmount*0.46;",
      "float nightShimmer=waterNightAmount*0.3;",
      "float shimmerAmount=shimmer*(dayShimmer+nightShimmer)*waterRainFade;",
      "vec3 shimmerColor=mix(vec3(0.28,0.92,1.0),vec3(0.92,1.0,0.98),clamp(waterDayAmount,0.0,1.0));",
      "gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb+shimmerColor,shimmerAmount);",
      "#include <dithering_fragment>"
    ].join("\n")
  );
};

function makeWaterGeometryFromTerrain(terrainPositions,minVisibleDepth=0){
  if(!terrainPositions) return null;

  let gridSize=segments+1;
  let positions=[];
  let normals=[];
  let uvs=[];
  let indices=[];
  let vertexMap=new Map();
  let waterMargin=0.3;
  let waterThreshold=waterLevel+waterMargin-Math.max(0,minVisibleDepth);

  function terrainIndex(ix,iz){
    return iz*gridSize+ix;
  }

  function localX(ix){
    return (ix/segments-0.5)*chunkSize;
  }

  function localZ(iz){
    return (iz/segments-0.5)*chunkSize;
  }

  function addVertex(vertex){
    let index=positions.length/3;
    positions.push(vertex.x,0,vertex.z);
    normals.push(0,1,0);
    uvs.push(vertex.u,vertex.v);
    return index;
  }

  function addCachedVertex(vertex){
    let key=vertex.gx+","+vertex.gz;
    let existing=vertexMap.get(key);
    if(existing!==undefined) return existing;
    let index=addVertex(vertex);
    vertexMap.set(key,index);
    return index;
  }

  function gridHeight(gx,gz){
    let x0=Math.max(0,Math.min(segments,Math.floor(gx)));
    let z0=Math.max(0,Math.min(segments,Math.floor(gz)));
    let x1=Math.min(segments,x0+1);
    let z1=Math.min(segments,z0+1);
    let tx=Math.max(0,Math.min(1,gx-x0));
    let tz=Math.max(0,Math.min(1,gz-z0));
    let h00=terrainPositions.getY(terrainIndex(x0,z0));
    let h10=terrainPositions.getY(terrainIndex(x1,z0));
    let h01=terrainPositions.getY(terrainIndex(x0,z1));
    let h11=terrainPositions.getY(terrainIndex(x1,z1));
    let h0=h00+(h10-h00)*tx;
    let h1=h01+(h11-h01)*tx;
    return h0+(h1-h0)*tz;
  }

  function terrainVertex(gx,gz){
    return {
      x:localX(gx),
      z:localZ(gz),
      h:gridHeight(gx,gz),
      u:gx/segments,
      v:gz/segments,
      gx,
      gz
    };
  }

  function shoreVertex(a,b){
    let denom=b.h-a.h;
    let t=Math.abs(denom)<0.0001 ? 0.5 : (waterThreshold-a.h)/denom;
    t=Math.max(0,Math.min(1,t));
    return {
      x:a.x+(b.x-a.x)*t,
      z:a.z+(b.z-a.z)*t,
      h:waterThreshold,
      u:a.u+(b.u-a.u)*t,
      v:a.v+(b.v-a.v)*t
    };
  }

  function addWaterTriangle(a,b,c){
    let input=[a,b,c];
    let clipped=[];

    for(let i=0;i<input.length;i++){
      let current=input[i];
      let previous=input[(i+input.length-1)%input.length];
      let currentWet=current.h<=waterThreshold;
      let previousWet=previous.h<=waterThreshold;

      if(currentWet){
        if(!previousWet) clipped.push(shoreVertex(previous,current));
        clipped.push(current);
      }else if(previousWet){
        clipped.push(shoreVertex(previous,current));
      }
    }

    if(clipped.length<3) return;

    let first=addVertex(clipped[0]);
    for(let i=1;i<clipped.length-1;i++){
      let i1=addVertex(clipped[i]);
      let i2=addVertex(clipped[i+1]);
      indices.push(first,i1,i2);
    }
  }

  for(let iz=0;iz<segments;iz++){
    for(let ix=0;ix<segments;ix++){
      let v00=terrainVertex(ix,iz);
      let v10=terrainVertex(ix+1,iz);
      let v01=terrainVertex(ix,iz+1);
      let v11=terrainVertex(ix+1,iz+1);
      let wetCount=(v00.h<=waterThreshold ? 1 : 0)+(v10.h<=waterThreshold ? 1 : 0)+(v01.h<=waterThreshold ? 1 : 0)+(v11.h<=waterThreshold ? 1 : 0);
      if(wetCount===0) continue;

      if(wetCount===4){
        let i00=addCachedVertex(v00);
        let i10=addCachedVertex(v10);
        let i01=addCachedVertex(v01);
        let i11=addCachedVertex(v11);
        indices.push(i00,i01,i10,i10,i01,i11);
        continue;
      }

      addWaterTriangle(v00,v01,v10);
      addWaterTriangle(v10,v01,v11);
    }
  }

  if(indices.length===0) return null;

  let geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
  geo.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

function makeWaterPlaneGeometry(){
  let geo=new THREE.PlaneGeometry(chunkSize,chunkSize,1,1);
  geo.rotateX(-Math.PI/2);
  return geo;
}

function makeShoreBandGeometryFromTerrain(terrainPositions){
  if(!terrainPositions) return null;

  let gridSize=segments+1;
  let positions=[];
  let normals=[];
  let uvs=[];
  let alphas=[];
  let indices=[];
  let shoreLow=waterLevel-2.8;
  let shoreHigh=waterLevel+6.2;
  let y=waterLevel+waterSurfaceVisualLift+0.045;

  function terrainIndex(ix,iz){
    return iz*gridSize+ix;
  }

  function localX(ix){
    return (ix/segments-0.5)*chunkSize;
  }

  function localZ(iz){
    return (iz/segments-0.5)*chunkSize;
  }

  function alphaForHeight(h){
    let below=waterSmoothstep01((h-shoreLow)/(waterLevel-shoreLow));
    let above=1-waterSmoothstep01((h-waterLevel)/(shoreHigh-waterLevel));
    return Math.max(0,Math.min(1,Math.min(below,above)));
  }

  function addVertex(ix,iz,h){
    let index=positions.length/3;
    positions.push(localX(ix),y,localZ(iz));
    normals.push(0,1,0);
    uvs.push(ix/segments,iz/segments);
    alphas.push(alphaForHeight(h));
    return index;
  }

  for(let iz=0;iz<segments;iz++){
    for(let ix=0;ix<segments;ix++){
      let h00=terrainPositions.getY(terrainIndex(ix,iz));
      let h10=terrainPositions.getY(terrainIndex(ix+1,iz));
      let h01=terrainPositions.getY(terrainIndex(ix,iz+1));
      let h11=terrainPositions.getY(terrainIndex(ix+1,iz+1));
      let minH=Math.min(h00,h10,h01,h11);
      let maxH=Math.max(h00,h10,h01,h11);
      if(minH>shoreHigh || maxH<shoreLow) continue;
      if(maxH<waterLevel-5.5 || minH>waterLevel+8.5) continue;

      let i00=addVertex(ix,iz,h00);
      let i10=addVertex(ix+1,iz,h10);
      let i01=addVertex(ix,iz+1,h01);
      let i11=addVertex(ix+1,iz+1,h11);
      indices.push(i00,i01,i10,i10,i01,i11);
    }
  }

  if(indices.length===0) return null;

  let geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
  geo.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geo.setAttribute("shoreBandAlpha",new THREE.Float32BufferAttribute(alphas,1));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

rockMat=new THREE.MeshStandardMaterial({
  color:0x3f334b,
  map:rockTexture,
  normalMap:rockNormalTexture,
  normalScale:new THREE.Vector2(1.05,1.05),
  emissive:0x000000,
  emissiveIntensity:0,
  roughness:0.84,
  metalness:0.03
});
let gravelMat=new THREE.MeshStandardMaterial({color:0x5a5164,roughness:1,metalness:0.02});
let buildingWallMat=new THREE.MeshStandardMaterial({color:0x5a526d,roughness:0.9,metalness:0.16});
let buildingRoofMat=new THREE.MeshStandardMaterial({color:0x322b45,roughness:0.92,metalness:0.18});
let windowMat=new THREE.MeshStandardMaterial({color:0x8dfff2,emissive:0x0bd1c4,emissiveIntensity:0.72,roughness:0.18});
let doorMat=new THREE.MeshStandardMaterial({color:0x241b2b,roughness:0.9,metalness:0.08});
let chimneyMat=new THREE.MeshStandardMaterial({color:0x494058,roughness:1,metalness:0.12});
let houseTrimMat=new THREE.MeshStandardMaterial({color:0xa78fbd,roughness:0.78,metalness:0.08});
let brickWallMat=new THREE.MeshStandardMaterial({color:0x714060,roughness:0.95,metalness:0.05});
let cityStreetMat=new THREE.MeshStandardMaterial({color:0x1d1f25,roughness:0.86,metalness:0.08});
let cityDetailMat=new THREE.MeshStandardMaterial({color:0xa78fbd,emissive:0x241438,emissiveIntensity:0.18,roughness:0.72,metalness:0.1});
let cityGlowMat=new THREE.MeshBasicMaterial({color:0x8dfff2,transparent:true,opacity:0.82,depthWrite:false,depthTest:true});
let buildingShadowMat=new THREE.MeshBasicMaterial({
  map:makeCarShadowTexture(),
  color:0x000000,
  transparent:true,
  opacity:0.26,
  depthWrite:false,
  depthTest:true,
  polygonOffset:true,
  polygonOffsetFactor:-1,
  polygonOffsetUnits:-1
});
let rockShadowMat=new THREE.MeshBasicMaterial({
  map:makeCarShadowTexture(),
  color:0x000000,
  transparent:true,
  opacity:0.46,
  depthWrite:false,
  depthTest:true,
  polygonOffset:true,
  polygonOffsetFactor:-1,
  polygonOffsetUnits:-1
});
let radarOutpostBaseMat=new THREE.MeshStandardMaterial({color:0x363f4a,roughness:0.74,metalness:0.48});
let radarOutpostDishMat=new THREE.MeshStandardMaterial({color:0x9fb1bd,roughness:0.48,metalness:0.62,side:THREE.DoubleSide});
let radarOutpostGlowMat=new THREE.MeshBasicMaterial({color:0x8dfff2,transparent:true,opacity:0.9,depthWrite:false,depthTest:true});
let bossBaseMat=new THREE.MeshStandardMaterial({color:0x191a24,emissive:0x19091f,emissiveIntensity:0.28,roughness:0.78,metalness:0.58});
let bossBaseTrimMat=new THREE.MeshStandardMaterial({color:0x7a2f68,emissive:0x4c123d,emissiveIntensity:0.52,roughness:0.5,metalness:0.4});
let bossBaseGlowMat=new THREE.MeshBasicMaterial({color:0xff4fc8,transparent:true,opacity:0.72});

let trunkGeo=new THREE.CylinderGeometry(.28,1.08,10.5,6);
let crownGeo=new THREE.IcosahedronGeometry(2.35,1);
let podGeo=new THREE.SphereGeometry(.72,8,6);
let grassGeo=new THREE.ConeGeometry(.065,1.2,2);
let bushGeo=new THREE.IcosahedronGeometry(1,1);
function makeRockGeometry(){
  let geo=new THREE.DodecahedronGeometry(1,1);
  let pos=geo.attributes.position;
  let normal=new THREE.Vector3();

  for(let i=0;i<pos.count;i++){
    normal.set(pos.getX(i),pos.getY(i),pos.getZ(i)).normalize();
    let x=normal.x;
    let y=normal.y;
    let z=normal.z;
    let ridge=
      1+
      Math.sin(x*8.7+y*3.1+z*5.9)*0.09+
      Math.sin(x*14.3-y*9.4+z*4.2)*0.055+
      Math.sin((x+y-z)*19.0)*0.035;
    pos.setXYZ(i,x*ridge,y*ridge,z*ridge);
  }

  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
let rockGeo=makeRockGeometry();
let gravelGeo=new THREE.DodecahedronGeometry(1,0);
let buildingGeo=new THREE.BoxGeometry(1,1,1);
let buildingRoofGeo=new THREE.CylinderGeometry(1.05,1.25,1,4);
let windowGeo=new THREE.BoxGeometry(1,1,1);
let doorGeo=new THREE.BoxGeometry(1,1,1);
let chimneyGeo=new THREE.BoxGeometry(1,1,1);
let trimGeo=new THREE.BoxGeometry(1,1,1);
let porchGeo=new THREE.BoxGeometry(1,1,1);
let brickWallGeo=new THREE.BoxGeometry(1,1,1);
let cityStreetGeo=new THREE.BoxGeometry(1,1,1);
let buildingShadowGeo=new THREE.PlaneGeometry(1,1);
let radarOutpostBaseGeo=new THREE.CylinderGeometry(1,1.18,1,10);
let radarOutpostMastGeo=new THREE.CylinderGeometry(0.18,0.28,1,10);
let radarOutpostDishGeo=new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*0.55);
let radarOutpostPanelGeo=new THREE.BoxGeometry(1,1,1);
for(let geometry of [radarOutpostBaseGeo,radarOutpostMastGeo,radarOutpostDishGeo,radarOutpostPanelGeo]){
  geometry.computeVertexNormals();
}
let turretBaseGeo=new THREE.CylinderGeometry(1,1.25,1,8);
let turretHeadGeo=new THREE.BoxGeometry(1,1,1);
let turretBarrelGeo=new THREE.CylinderGeometry(0.16,0.2,2.4,10);
let bossBasePlatformGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseTowerGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseSpireGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseGateGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseRingGeo=new THREE.BoxGeometry(1,1,1);
let bossBaseGlowGeo=new THREE.BoxGeometry(1,1,1);
let landingRingGeo=new THREE.RingGeometry(0.72,1,96);
let turretBaseMat=new THREE.MeshStandardMaterial({color:0x312a3e,roughness:0.82,metalness:0.42});
let turretHeadMat=new THREE.MeshStandardMaterial({color:0x554163,emissive:0x16091f,emissiveIntensity:0.22,roughness:0.72,metalness:0.48});
let turretBarrelMat=new THREE.MeshStandardMaterial({color:0x151923,emissive:0x06162d,emissiveIntensity:0.32,roughness:0.56,metalness:0.7});
let chunkSharedMaterials=new Set([
  barkMat,
  leafMat,
  ...cheapTreeCrownMats,
  buildingShadowMat,
  shoreBandMat,
  radarOutpostBaseMat,
  radarOutpostDishMat,
  radarOutpostGlowMat
]);
let chunkSharedGeometries=new Set([
  buildingShadowGeo,
  radarOutpostBaseGeo,
  radarOutpostMastGeo,
  radarOutpostDishGeo,
  radarOutpostPanelGeo
]);

function environmentColors(){
  return {...defaultEnvironment.colors,...(currentEnvironment.colors || {})};
}

function environmentVegetation(){
  return {...defaultEnvironment.vegetation,...(currentEnvironment.vegetation || {})};
}

function environmentShoreline(){
  return {...defaultEnvironment.shoreline,...(currentEnvironment.shoreline || {})};
}

function environmentRocks(){
  return {...defaultEnvironment.rocks,...(currentEnvironment.rocks || {})};
}

function environmentSettlements(){
  return {
    villagesPerChunk:1.15,
    villageSpawnChance:0.5,
    patchRadiusScale:1.28,
    smallTownMaxRange:6.5,
    largeTownMaxRange:8,
    ...(currentEnvironment.settlements || {})
  };
}

function environmentSettlementStyle(){
  let name=(currentEnvironment && currentEnvironment.name || "").toLowerCase();
  let city=!!(currentEnvironment && currentEnvironment.city);
  let base={
    widthScale:1,
    depthScale:1,
    heightScale:1,
    roofHeightScale:1,
    roofScale:1,
    roofYawOffset:0.25,
    densityScale:1,
    minGapScale:1,
    windowRows:3,
    windowColumns:2,
    sideWindowRows:2,
    trimBands:0,
    trimCapacity:6,
    chimneyChance:1,
    chimneyCount:1,
    chimneyHeightScale:1,
    chimneyWidthScale:1,
    porchChance:1,
    porchScale:1,
    supportPosts:false,
    supportHeightScale:0.42,
    wallSegments:14,
    wallRingScale:1.22,
    wallHeight:2.2,
    wallThickness:0.55,
    wallSkipAngle:0.32,
    cityWindowRowsScale:1,
    cityWindowColumnsScale:1,
    cityTrimBands:2,
    cityGlowDensity:1,
    bodyRandomScale:1
  };

  let styles={
    "alien dusk":{
      widthScale:0.92,depthScale:1.08,heightScale:1.18,roofHeightScale:1.35,roofScale:0.92,roofYawOffset:0.52,
      windowRows:3,windowColumns:2,sideWindowRows:2,trimBands:2,chimneyChance:0.8,chimneyHeightScale:1.55,porchChance:0.65,
      wallSegments:16,wallHeight:2.35,wallRingScale:1.26
    },
    "crystal frost":{
      widthScale:0.78,depthScale:0.82,heightScale:1.62,roofHeightScale:1.8,roofScale:0.64,roofYawOffset:0.78,
      windowRows:4,windowColumns:2,sideWindowRows:3,trimBands:3,chimneyChance:0.9,chimneyHeightScale:2.2,chimneyWidthScale:0.62,
      porchChance:0.35,wallSegments:18,wallHeight:2.7,wallThickness:0.42,minGapScale:1.12
    },
    "ember badlands":{
      widthScale:1.18,depthScale:1.06,heightScale:0.76,roofHeightScale:0.42,roofScale:1.05,
      windowRows:2,windowColumns:2,sideWindowRows:1,trimBands:1,chimneyChance:1,chimneyCount:2,chimneyHeightScale:1.8,chimneyWidthScale:1.45,
      porchChance:0.25,wallSegments:12,wallHeight:3.1,wallThickness:0.86,wallRingScale:1.17,minGapScale:1.08
    },
    "dschungel canopy":{
      widthScale:1.2,depthScale:1.16,heightScale:0.9,roofHeightScale:1.55,roofScale:1.25,
      windowRows:2,windowColumns:3,sideWindowRows:2,trimBands:1,chimneyChance:0.3,porchChance:1,porchScale:1.45,
      supportPosts:true,supportHeightScale:0.48,wallSegments:10,wallHeight:1.55,wallThickness:0.48,wallRingScale:1.3,minGapScale:1.18
    },
    "dschungel wetlands":{
      widthScale:1.12,depthScale:1.24,heightScale:0.82,roofHeightScale:1.35,roofScale:1.32,
      windowRows:2,windowColumns:2,sideWindowRows:2,trimBands:1,chimneyChance:0.45,porchChance:1,porchScale:1.7,
      supportPosts:true,supportHeightScale:0.62,wallSegments:10,wallHeight:1.35,wallThickness:0.42,wallRingScale:1.35,minGapScale:1.22
    },
    "storm archipelago":{
      widthScale:0.82,depthScale:0.9,heightScale:1.38,roofHeightScale:1.22,roofScale:0.9,
      windowRows:4,windowColumns:1,sideWindowRows:3,trimBands:2,chimneyChance:0.75,chimneyHeightScale:2.6,chimneyWidthScale:0.58,
      porchChance:0.8,porchScale:1.2,supportPosts:true,supportHeightScale:0.42,wallSegments:16,wallHeight:2.0,wallThickness:0.5
    },
    "violet mesas":{
      widthScale:1.34,depthScale:1.18,heightScale:0.72,roofHeightScale:0.32,roofScale:1.1,
      windowRows:2,windowColumns:1,sideWindowRows:1,trimBands:3,chimneyChance:0.55,chimneyHeightScale:0.9,chimneyWidthScale:1.35,
      porchChance:0.55,wallSegments:13,wallHeight:2.55,wallThickness:0.78,wallRingScale:1.16,minGapScale:1.16
    },
    "ash bloom":{
      widthScale:1.02,depthScale:1.04,heightScale:1.08,roofHeightScale:0.78,roofScale:0.96,
      windowRows:3,windowColumns:2,sideWindowRows:2,trimBands:2,chimneyChance:1,chimneyCount:3,chimneyHeightScale:2.15,chimneyWidthScale:0.82,
      porchChance:0.45,wallSegments:15,wallHeight:2.45,wallThickness:0.62
    },
    "neon city":{
      widthScale:0.92,depthScale:0.92,heightScale:1.12,roofHeightScale:0.65,roofScale:0.76,
      cityWindowRowsScale:1.15,cityWindowColumnsScale:1.2,cityTrimBands:4,cityGlowDensity:1.45,chimneyCount:3,chimneyHeightScale:1.35,
      minGapScale:0.95,bodyRandomScale:1.22
    }
  };

  let selected=styles[name] || {};
  return {...base,...selected,city};
}

function setMaterialColor(material,color,emissive=null){
  if(material.color && color!=null) material.color.set(color);
  if(material.emissive && emissive!=null) material.emissive.set(emissive);
}

function mixHexColor(a,b,amount){
  let color=new THREE.Color(a);
  color.lerp(new THREE.Color(b),Math.max(0,Math.min(1,amount)));
  return color.getHex();
}

function displayWaterColor(color){
  let displayed=new THREE.Color(color);
  displayed.lerp(new THREE.Color(0xffffff),0.08);
  return displayed.getHex();
}

function displayWaterEmissive(color){
  let displayed=new THREE.Color(color);
  displayed.multiplyScalar(0.72);
  return displayed.getHex();
}

function applyEnvironment(environment={}){
  currentEnvironment={
    ...defaultEnvironment,
    ...environment,
    colors:{...defaultEnvironment.colors,...(environment.colors || {})},
    shoreline:{...defaultEnvironment.shoreline,...(environment.shoreline || {})},
    rocks:{...defaultEnvironment.rocks,...(environment.rocks || {})},
    vegetation:{...defaultEnvironment.vegetation,...(environment.vegetation || {})}
  };
  let colors=environmentColors();
  let shoreline=environmentShoreline();
  if(landMat.map) landMat.map.dispose();
  landMat.map=makeGroundTexture(currentEnvironment);
  landMat.normalScale.setScalar(currentEnvironment.terrainDetail?.normalScale ?? 0.38);
  landMat.needsUpdate=true;
  setMaterialColor(waterMat,displayWaterColor(colors.water),displayWaterEmissive(colors.waterEmissive || colors.water));
  if(landMat.userData.shader){
    let shader=landMat.userData.shader;
    if(shader.uniforms.terrainDetailScale) shader.uniforms.terrainDetailScale.value=currentEnvironment.terrainDetail?.scale ?? 0.024;
    if(shader.uniforms.terrainDetailStrength) shader.uniforms.terrainDetailStrength.value=currentEnvironment.terrainDetail?.strength ?? 0.54;
    if(shader.uniforms.terrainDetailTextureMix) shader.uniforms.terrainDetailTextureMix.value=currentEnvironment.terrainDetail?.textureMix ?? 1;
    if(shader.uniforms.mountainDetailStrength) shader.uniforms.mountainDetailStrength.value=currentEnvironment.terrainDetail?.mountainStrength ?? 1;
    if(shader.uniforms.landWetWaterLevel) shader.uniforms.landWetWaterLevel.value=waterLevel+waterSurfaceVisualLift;
    if(shader.uniforms.landWetShoreColor) shader.uniforms.landWetShoreColor.value.set(mixHexColor(colors.shore || colors.low,colors.low || colors.shore,0.2));
    if(shader.uniforms.landWetWaterColor) shader.uniforms.landWetWaterColor.value.set(mixHexColor(colors.shore || colors.low,displayWaterColor(colors.water),shoreline.wetShaderWaterMix ?? 0.16));
    if(shader.uniforms.landWetStrength) shader.uniforms.landWetStrength.value=shoreline.wetShaderStrength ?? 0.34;
    if(shader.uniforms.landWetBandHeight) shader.uniforms.landWetBandHeight.value=shoreline.wetShaderHeight ?? 9.5;
  }
  if(shoreBandMat.color) shoreBandMat.color.set(mixHexColor(colors.shore || colors.low,displayWaterColor(colors.water),shoreline.shoreBandWaterMix ?? 0.28));
  setMaterialColor(barkMat,colors.bark,colors.barkEmissive);
  setMaterialColor(leafMat,colors.leaf,colors.leafEmissive);
  let cheapCrownBase=new THREE.Color(colors.leaf);
  let cheapCrownAccent=new THREE.Color(colors.bushAccent || colors.pod || colors.shore || colors.grass);
  let cheapCrownDark=new THREE.Color(colors.bushDark || colors.low || colors.leaf);
  let cheapCrownGlow=new THREE.Color(colors.leafEmissive || colors.bushEmissive || colors.grassEmissive || colors.leaf);
  let cheapCrownVariants=[
    {color:cheapCrownBase.clone().lerp(new THREE.Color(0xffffff),0.2),emissive:cheapCrownGlow.clone()},
    {color:cheapCrownBase.clone().lerp(cheapCrownAccent,0.64).lerp(new THREE.Color(0xffffff),0.16),emissive:cheapCrownGlow.clone().lerp(cheapCrownAccent,0.34)},
    {color:cheapCrownBase.clone().lerp(cheapCrownDark,0.54),emissive:cheapCrownGlow.clone().lerp(cheapCrownDark,0.48)}
  ];
  for(let i=0;i<cheapTreeCrownMats.length;i++){
    let variant=cheapCrownVariants[i%cheapCrownVariants.length];
    cheapTreeCrownMats[i].color.copy(variant.color);
    cheapTreeCrownMats[i].emissive.copy(variant.emissive);
    cheapTreeCrownMats[i].emissiveIntensity=(colors.bushEmissiveIntensity ?? 0.28)*0.18;
    cheapTreeCrownMats[i].needsUpdate=true;
  }
  setMaterialColor(podMat,colors.pod,colors.podEmissive);
  setMaterialColor(grassMat,colors.grass,colors.grassEmissive);
  setMaterialColor(bushMat,mixHexColor(colors.leaf,colors.grass,0.28),colors.bushEmissive || mixHexColor(colors.leafEmissive || colors.leaf,colors.grassEmissive || colors.grass,0.36));
  bushMat.emissiveIntensity=colors.bushEmissiveIntensity ?? 0.18;
  setMaterialColor(rockMat,colors.rock,colors.rockEmissive);
  rockMat.emissiveIntensity=colors.rockEmissiveIntensity ?? 0;
  setMaterialColor(gravelMat,mixHexColor(colors.rock,colors.shore,0.36));
  setMaterialColor(buildingWallMat,colors.wall);
  setMaterialColor(buildingRoofMat,colors.roof);
  setMaterialColor(chimneyMat,colors.roof);
  setMaterialColor(houseTrimMat,colors.trim);
  setMaterialColor(brickWallMat,colors.brick);
  setMaterialColor(cityStreetMat,colors.street || mixHexColor(colors.roof,colors.rock,0.5));
  setMaterialColor(cityDetailMat,mixHexColor(colors.trim,colors.wall,0.22),mixHexColor(colors.trim,colors.podEmissive || colors.pod || colors.water,0.38));
  if(cityGlowMat.color) cityGlowMat.color.set(colors.waterEmissive || colors.water || colors.podEmissive || colors.trim);
  setMaterialColor(radarOutpostBaseMat,0x24282e,0x020304);
  setMaterialColor(radarOutpostDishMat,0x8d969d,0x0a0c0e);
  if(radarOutpostGlowMat.color) radarOutpostGlowMat.color.set(0x8dfff2);

  let bossHull=mixHexColor(colors.rock,colors.roof,0.56);
  let bossHullEmissive=mixHexColor(colors.barkEmissive || colors.bark,colors.rock,0.32);
  let bossTrim=colors.trim;
  let bossTrimEmissive=mixHexColor(colors.trim,colors.podEmissive || colors.pod || colors.water,0.42);
  let bossGlow=colors.podEmissive || colors.pod || colors.water;
  setMaterialColor(bossBaseMat,bossHull,bossHullEmissive);
  setMaterialColor(bossBaseTrimMat,bossTrim,bossTrimEmissive);
  if(bossBaseGlowMat.color) bossBaseGlowMat.color.set(bossGlow);
  setMaterialColor(turretBaseMat,mixHexColor(colors.rock,colors.wall,0.44));
  setMaterialColor(turretHeadMat,mixHexColor(colors.wall,colors.trim,0.36),bossHullEmissive);
  setMaterialColor(turretBarrelMat,mixHexColor(colors.roof,colors.rock,0.5),colors.waterEmissive || bossGlow);
}

applyEnvironment(currentEnvironment);

function createChunkWorker(){
  if(options.disableChunkWorker || typeof Worker==="undefined") return null;

  try{
    let worker=new Worker(new URL("./chunkWorker.js?v=titan-wide-plateaus",import.meta.url),{type:"module"});
    let template=makeTerrainVertexTemplate();
    worker.postMessage({
      type:"setTerrainTemplate",
      localX:template.localX,
      localZ:template.localZ
    },[template.localX.buffer,template.localZ.buffer]);
    worker.onmessage=event=>{
      let message=event.data || {};
      if(message.generation!==chunkWorkerGeneration) return;
      if(message.type==="terrainBuilt"){
        chunkWorkerResults.set(message.id,message);
      }else if(message.type==="terrainError"){
        console.warn("Chunk worker failed; falling back to main-thread chunk generation.",message.message || message.key || "");
        chunkWorker=null;
        if(activeChunkBuild && activeChunkBuild.workerJobId===message.id){
          activeChunkBuild.waitingForWorker=false;
          activeChunkBuild.workerError=true;
          activeChunkBuild.generator=makeChunk(activeChunkBuild.cx,activeChunkBuild.cz,null);
        }
      }
    };
    worker.onerror=event=>{
      console.warn("Chunk worker unavailable; falling back to main-thread chunk generation.",event && event.message ? event.message : event);
      chunkWorker=null;
      if(activeChunkBuild && activeChunkBuild.waitingForWorker){
        activeChunkBuild.waitingForWorker=false;
        activeChunkBuild.workerError=true;
        activeChunkBuild.generator=makeChunk(activeChunkBuild.cx,activeChunkBuild.cz,null);
      }
    };
    return worker;
  }catch(error){
    console.warn("Chunk worker unavailable; falling back to main-thread chunk generation.",error);
    return null;
  }
}

chunkWorker=createChunkWorker();

function makeTerrainVertexTemplate(){
  let geo=new THREE.PlaneGeometry(chunkSize,chunkSize,segments,segments);
  geo.rotateX(-Math.PI/2);
  let pos=geo.attributes.position;
  let localX=new Float32Array(pos.count);
  let localZ=new Float32Array(pos.count);

  for(let i=0;i<pos.count;i++){
    localX[i]=pos.getX(i);
    localZ[i]=pos.getZ(i);
  }

  geo.dispose();
  return {localX,localZ};
}

function chunkKey(cx,cz){
  return cx+","+cz;
}

function chunkKeyForWorldPoint(x,z){
  return chunkKey(Math.floor(x/chunkSize),Math.floor(z/chunkSize));
}

function chunkLoadedAt(x,z){
  return chunks.has(chunkKeyForWorldPoint(x,z));
}

function updateIndependentStructureVisibility(){
  for(let base of bossBases){
    if(!base || !base.group) continue;
    base.group.visible=chunkLoadedAt(base.x,base.z);
  }
}

function cloneChunkDetail(detail){
  return detail
    ? {
      treeDensity:detail.treeDensity,
      partDensity:detail.partDensity,
      grassDensity:detail.grassDensity,
      featureDensity:detail.featureDensity
    }
    : null;
}

function sameChunkDetail(a,b){
  return !!a && !!b
    && a.treeDensity===b.treeDensity
    && a.partDensity===b.partDensity
    && a.grassDensity===b.grassDensity
    && (a.featureDensity ?? 1)===(b.featureDensity ?? 1);
}

function roadYawAt(z){
  return Math.atan2(roadCenterX(z+18)-roadCenterX(z-18),36);
}

function r01(a,b){
  return rand(a,b)*0.5+0.5;
}

function cityDistrictChance(){
  return currentEnvironment.city ? 0.28 : 0.075;
}

function chunkHasCityDistrict(cx,cz){
  return r01(cx*37,cz*53)<=cityDistrictChance();
}

function cityDistrictCandidate(cx,cz){
  if(!chunkHasCityDistrict(cx,cz)) return null;

  let rr1=r01(cx*701,cz*409);
  let rr2=r01(cx*157,cz*991);
  let centerX=cx*chunkSize+(rr1-.5)*chunkSize;
  let centerZ=cz*chunkSize+(rr2-.5)*chunkSize;
  let centerY=groundHeight(centerX,centerZ);
  let centerRoadD=roadDistance(centerX,centerZ);
  if(centerRoadD<12) return null;

  let villageRadius=86+r01(cx,cz+9)*34;
  if(!terrainPatchOk(centerX,centerZ,villageRadius*1.08,25,7.5)) return null;

  return {x:centerX,z:centerZ,y:centerY,r:villageRadius};
}

function findCityDistrictNearRoad(searchRadiusChunks=18){
  let best=null;
  for(let dz=0;dz<=searchRadiusChunks;dz++){
    for(let direction of (dz===0 ? [1] : [1,-1])){
      let cz=dz*direction;
      let roadCx=Math.floor(roadCenterX(cz*chunkSize)/chunkSize);
      for(let offset=-4;offset<=4;offset++){
        let cx=roadCx+offset;
        let city=cityDistrictCandidate(cx,cz);
        if(!city) continue;
        let roadDist=roadDistance(city.x,city.z);
        let score=Math.abs(cz)*0.8+Math.abs(offset)*1.2+Math.abs(roadDist-170)*0.015;
        if(!best || score<best.score) best={...city,score};
      }
    }
    if(best && dz>2) break;
  }

  return best;
}

let hiddenInstanceMatrix=new THREE.Matrix4().makeScale(0,0,0);

function freezeStaticObject(object){
  object.updateMatrix();
  object.matrixAutoUpdate=false;
  object.matrixWorldNeedsUpdate=true;
  return object;
}

function stabilizeVegetationMesh(mesh){
  if(!mesh) return;
  if(mesh.computeBoundingSphere) mesh.computeBoundingSphere();
  mesh.frustumCulled=false;
  freezeStaticObject(mesh);
}

function hideInstance(mesh,index){
  if(!mesh || index==null || index<0) return;
  mesh.setMatrixAt(index,hiddenInstanceMatrix);
  mesh.instanceMatrix.needsUpdate=true;
}

function terrainSlopeAt(x,z,sampleDistance=18){
  let left=groundHeight(x-sampleDistance,z);
  let right=groundHeight(x+sampleDistance,z);
  let back=groundHeight(x,z-sampleDistance);
  let front=groundHeight(x,z+sampleDistance);
  return Math.max(Math.abs(right-left),Math.abs(front-back))/(sampleDistance*2);
}

function disposeObjectResources(object,{disposeGeometry=false}={}){
  if(!object || typeof object.traverse!=="function") return;

  let disposedMaterials=new Set();
  let disposedGeometries=new Set();
  object.traverse(child=>{
    if(disposeGeometry && child.geometry && !chunkSharedGeometries.has(child.geometry) && !disposedGeometries.has(child.geometry)){
      child.geometry.dispose();
      disposedGeometries.add(child.geometry);
    }

    if(!child.material) return;
    let materials=Array.isArray(child.material) ? child.material : [child.material];
    for(let material of materials){
      if(!material || chunkSharedMaterials.has(material) || disposedMaterials.has(material)) continue;
      if(typeof material.dispose==="function") material.dispose();
      disposedMaterials.add(material);
    }
  });
}

function disposeRadarOutpostObject(object){
  disposeObjectResources(object,{disposeGeometry:true});
}

function disposeLandingSpaceObject(object){
  disposeObjectResources(object,{disposeGeometry:false});
}

function makeTurret(x,y,z,angle){
  let group=new THREE.Group();
  let base=new THREE.Mesh(turretBaseGeo,turretBaseMat);
  let head=new THREE.Mesh(turretHeadGeo,turretHeadMat);
  let barrel=new THREE.Mesh(turretBarrelGeo,turretBarrelMat);

  base.position.y=0.5;
  head.position.y=1.45;
  head.scale.set(1.55,0.9,1.25);
  barrel.position.set(0,1.48,1.25);
  barrel.rotation.x=Math.PI/2;
  barrel.scale.set(1,1,1.15);

  for(let mesh of [base,head,barrel]){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    group.add(mesh);
  }

  group.position.set(x,y,z);
  group.rotation.y=angle;
  return group;
}

function makeRadarOutpost(x,y,z,angle=0){
  let group=new THREE.Group();
  group.position.set(x,y,z);
  group.rotation.y=angle;
  let radarScale=2.13;
  group.scale.setScalar(radarScale);

  function add(mesh,px=0,py=0,pz=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
    mesh.position.set(px,py,pz);
    mesh.rotation.set(rx,ry,rz);
    mesh.scale.set(sx,sy,sz);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
  }

  let dishPivot=new THREE.Group();
  dishPivot.name="radar-dish-pivot";
  dishPivot.position.set(0,6.1,0.25);
  dishPivot.userData.phase=rand(x*0.031,z*0.037)*Math.PI*2;
  dishPivot.userData.speed=0.00042+rand(x*0.047,z*0.053)*0.00018;
  group.add(dishPivot);

  function addToDish(mesh,px=0,py=0,pz=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
    mesh.position.set(px,py,pz);
    mesh.rotation.set(rx,ry,rz);
    mesh.scale.set(sx,sy,sz);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    dishPivot.add(mesh);
    return mesh;
  }

  add(new THREE.Mesh(radarOutpostBaseGeo,radarOutpostBaseMat),0,0.32,0,4.4,0.64,4.4);
  add(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostBaseMat),0,0.82,0,5.8,0.34,5.15,0,Math.PI*0.25,0);
  add(new THREE.Mesh(radarOutpostBaseGeo,radarOutpostDishMat),0,1.22,0,2.5,0.34,2.5);

  for(let side of [-1,1]){
    add(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostBaseMat),side*2.65,0.48,2.25,0.72,0.38,1.25,0,Math.PI*0.18,0);
    add(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostBaseMat),side*2.65,0.48,-2.25,0.72,0.38,1.25,0,-Math.PI*0.18,0);
    add(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostDishMat),side*1.9,1.25,-2.2,1.05,0.9,0.58,0,side*0.28,0);
    add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),side*1.9,0.9,-2.2,0.22,1.45,0.22,0,0,0);
    add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),side*2.05,2.6,0.28,0.46,3.95,0.46,0,0,side*0.32);
    add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostGlowMat.clone()),side*3.35,1.45,0,0.26,1.65,0.26,0,0,0);
    add(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostBaseMat),side*3.35,0.72,0,0.52,0.34,0.52,0,0,0);
  }

  add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),0,4.0,0,1.05,5.8,1.05);
  add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),-1.35,2.85,0.22,0.52,4.25,0.52,0,0,0.34);
  add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),1.35,2.85,-0.22,0.52,4.25,0.52,0,0,-0.34);
  add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),0,3.45,-1.4,0.38,4.3,0.38,0.34,0,0);
  add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),0,3.45,1.4,0.38,4.3,0.38,-0.34,0,0);
  add(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostBaseMat),0,5.95,0.42,1.35,0.72,1.05,0,0,0);
  add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),0,6.95,1.18,0.34,2.45,0.34,Math.PI*0.5,0,0);
  add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),0,5.05,-2.2,0.28,3.25,0.28,0,0,0);
  add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),0,5.08,-2.2,0.2,1.65,0.2,0,0,Math.PI*0.5);

  let dish=addToDish(
    new THREE.Mesh(radarOutpostDishGeo,radarOutpostDishMat),
    0,
    1.25,
    0.8,
    2.45,
    0.72,
    2.45,
    -Math.PI*0.56,
    0,
    0
  );
  dish.name="radar-dish";

  addToDish(new THREE.Mesh(radarOutpostDishGeo,radarOutpostDishMat),0,0.25,-1.2,1.0,0.34,1.0,-Math.PI*0.58,Math.PI,0);
  addToDish(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),0,0.95,0.27,0.22,1.95,0.22,Math.PI*0.5,0,0);
  addToDish(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),0,0.22,-0.83,0.22,1.35,0.22,Math.PI*0.5,0,0);

  let receiver=addToDish(new THREE.Mesh(radarOutpostMastGeo,radarOutpostGlowMat.clone()),0,1.62,2.23,0.32,1.35,0.32,Math.PI*0.5,0,0);
  receiver.renderOrder=14;

  for(let i=0;i<3;i++){
    let height=5.05+i*0.48;
    let antenna=add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostGlowMat.clone()),-0.62+i*0.62,height,-2.2,0.13,1.15+i*0.18,0.13,0,0,0);
    antenna.renderOrder=14;
  }

  for(let side of [-1,1]){
    let panel=add(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostGlowMat.clone()),side*2.82,1.42,0,0.18,1.45,2.35);
    panel.renderOrder=14;

    add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),side*2.82,0.96,0,0.16,1.05,0.16,0,0,0);
    addToDish(new THREE.Mesh(radarOutpostMastGeo,radarOutpostDishMat),side*0.5,0.24,1.37,0.16,1.42,0.16,0,0,Math.PI*0.5);
    let vane=addToDish(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostDishMat),side*0.86,0.25,1.37,0.12,0.58,1.25,0.16,side*0.42,0);
    vane.renderOrder=12;
  }

  let terminal=makeMissionOutpostTerminal({
    floorY:0,
    floorMinX:-20,
    floorMaxX:20,
    floorMinZ:-20,
    floorMaxZ:20,
    terminalInset:16
  },{
    lights:false
  });
  terminal.name="radarOutpostTerminal";
  terminal.position.set(0,0,10.4);
  terminal.rotation.y=0;
  terminal.scale.setScalar(0.5/radarScale);
  terminal.traverse(child=>{
    if(!child.isMesh) return;
    child.castShadow=false;
    child.receiveShadow=false;
  });
  group.add(terminal);
  add(new THREE.Mesh(radarOutpostMastGeo,radarOutpostBaseMat),0,0.13,7.55,0.18,5.4,0.18,Math.PI*0.5,0,0);
  add(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostDishMat),0,0.18,4.92,0.64,0.22,0.5,0,0,0);
  add(new THREE.Mesh(radarOutpostPanelGeo,radarOutpostDishMat),0,0.18,10.12,0.48,0.18,0.42,0,0,0);

  group.userData.radarDishPivot=dishPivot;
  animatedRadarDishes.push(dishPivot);

  return group;
}

function makeBossBase(x,z,angle=0){
  let y=groundHeight(x,z);
  let group=new THREE.Group();
  group.position.set(x,y,z);
  group.rotation.y=angle;
  let turrets=[];
  let guardPoints=[];

  function addPart(geo,mat,px,py,pz,sx,sy,sz,rx=0,ry=0,rz=0){
    let mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(px,py,pz);
    mesh.scale.set(sx,sy,sz);
    mesh.rotation.set(rx,ry,rz);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
  }

  addPart(bossBasePlatformGeo,bossBaseMat,0,2.2,0,76,4.4,50,0,Math.PI*0.25,0);
  addPart(bossBasePlatformGeo,bossBaseMat,0,4.8,0,66,5.2,66,0,0,0);
  addPart(bossBasePlatformGeo,bossBaseTrimMat,0,7.6,0,58,3.4,14,0,Math.PI*0.25,0);
  addPart(bossBasePlatformGeo,bossBaseTrimMat,0,8.8,0,14,3.8,58,0,Math.PI*0.25,0);

  addPart(bossBaseTowerGeo,bossBaseMat,0,22,0,20,31,20,0,Math.PI*0.25,0);
  addPart(bossBaseTowerGeo,bossBaseTrimMat,0,27,0,24,5,24,0,Math.PI*0.25,0);
  addPart(bossBaseSpireGeo,bossBaseTrimMat,0,42,0,24,6,24,0,Math.PI*0.25,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,46,0,18,2,18,0,Math.PI*0.25,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,35.5,10.8,10,0.9,0.45,0,0,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,35.5,-10.8,10,0.9,0.45,0,0,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),10.8,35.5,0,0.45,0.9,10,0,0,0);
  addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),-10.8,35.5,0,0.45,0.9,10,0,0,0);

  for(let side of [-1,1]){
    for(let level of [17,24,31]){
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),side*10.4,level,0,0.55,1.5,8,0,0,0);
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,level,side*10.4,8,1.5,0.55,0,0,0);
    }
    for(let band of [-1,1]){
      addPart(bossBaseGateGeo,bossBaseTrimMat,side*22,13,band*22,2.2,12,10,0,band*0.55,0);
    }
  }

  for(let side of [-1,1]){
    addPart(bossBaseGateGeo,bossBaseMat,0,9.5,side*34,24,8,5,0,0,0);
    addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),0,10.3,side*36.7,18,2.4,0.45,0,0,0);
    addPart(bossBaseGateGeo,bossBaseTrimMat,side*32,10,0,5,9,24,0,0,0);
    addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),side*36.7,10.8,0,0.45,2.4,18,0,0,0);
    addPart(bossBaseGateGeo,bossBaseMat,side*18,7.5,side*28,9,4,4,0,side*0.35,0);
    addPart(bossBaseGateGeo,bossBaseMat,-side*18,7.5,side*28,9,4,4,0,-side*0.35,0);
    for(let notch of [-1,0,1]){
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),notch*7.5,13.5,side*39.4,3.4,0.65,0.35,0,0,0);
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),side*39.4,13.5,notch*7.5,0.35,0.65,3.4,0,0,0);
    }
  }

  for(let i=0;i<8;i++){
    let a=(i/8)*Math.PI*2+Math.PI*0.125;
    let px=Math.cos(a)*36;
    let pz=Math.sin(a)*36;
    let bladeYaw=-a+Math.PI*0.5;
    let height=i%2===0 ? 24 : 18;
    addPart(bossBaseTowerGeo,bossBaseMat,px,height*0.5+5,pz,6,height,10,0,bladeYaw,0);
    addPart(bossBaseSpireGeo,bossBaseTrimMat,px,height+16,pz,8,6,12,0,bladeYaw+Math.PI*0.25,0);
    addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),px,height+7,pz,0.55,11,4,0,bladeYaw,0);
    addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),px,height*0.5+8,pz,0.65,1.4,7,0,bladeYaw,0);
    addPart(bossBaseGateGeo,bossBaseTrimMat,px*0.82,9.5,pz*0.82,7,3.6,1.2,0,bladeYaw,0);
    addPart(bossBaseGateGeo,bossBaseMat,px*0.64,15.5,pz*0.64,2.4,15,2.4,0,bladeYaw+Math.PI*0.25,0);
    if(i%2===0){
      let turret=makeTurret(0,0,0,bladeYaw);
      turret.position.set(px*0.92,14.8,pz*0.92);
      turret.scale.set(1.35,1.35,1.35);
      group.add(turret);
      turrets.push({
        object:turret,
        cooldown:50+i*13,
        localX:px*0.92,
        localY:14.8,
        localZ:pz*0.92
      });
    }
  }

  for(let i=0;i<12;i++){
    let a=(i/12)*Math.PI*2;
    let px=Math.cos(a)*48;
    let pz=Math.sin(a)*48;
    addPart(bossBaseSpireGeo,bossBaseTrimMat,px,7.4,pz,5.8,10,2.8,0,-a+Math.PI*0.5,0);
  }

  for(let i=0;i<16;i++){
    let a=(i/16)*Math.PI*2;
    let px=Math.cos(a)*40;
    let pz=Math.sin(a)*40;
    let yaw=-a+Math.PI*0.5;
    addPart(bossBaseGateGeo,bossBaseMat,px,4.4,pz,7.5,2.4,1.4,0,yaw,0);
    if(i%2===0){
      addPart(bossBaseGlowGeo,bossBaseGlowMat.clone(),px,6.1,pz,4.5,0.6,0.35,0,yaw,0);
    }
  }

  for(let i=0;i<20;i++){
    let a=(i/20)*Math.PI*2+Math.PI*0.05;
    let px=Math.cos(a)*29;
    let pz=Math.sin(a)*29;
    let yaw=-a+Math.PI*0.5;
    let panelHeight=i%3===0 ? 1.8 : 1.1;
    addPart(bossBaseGateGeo,bossBaseTrimMat,px,11.4+(i%4)*1.15,pz,3.2,panelHeight,0.75,0,yaw,0);
  }

  for(let i=0;i<5;i++){
    let a=angle+(i/5)*Math.PI*2+Math.PI*0.22;
    let dist=i===0 ? 62 : 72+(i%2)*10;
    guardPoints.push({
      x:x+Math.sin(a)*dist,
      z:z+Math.cos(a)*dist
    });
  }

  scene.add(group);
  group.visible=chunkLoadedAt(x,z);

  return {
    group,
    x,
    y,
    z,
    angle,
    r:46,
    health:1200,
    maxHealth:1200,
    active:true,
    turrets,
    guardPoints,
    guardsSpawned:false
  };
}

function clearBossBases(){
  for(let base of bossBases){
    scene.remove(base.group);
  }
  bossBases.length=0;
  bossBaseColliders.length=0;
}

function addBossBaseCollider(base){
  if(!base) return;
  bossBaseColliders.push({
    x:base.x,
    baseY:base.y,
    y:base.y+18,
    z:base.z,
    r:base.r,
    height:48,
    visualRadius:base.r,
    visualHeight:54,
    type:"bossBase",
    base,
    indestructible:true,
    object:base.group
  });
}

function placeTestBossBaseNearStart(startX,startZ,startAngle=0,options={}){
  clearBossBases();

  let nearStart=!!(options && options.nearStart);
  let minBossBaseStartDistance=nearStart ? 160 : 5200;
  let forwardX=Math.sin(startAngle);
  let forwardZ=Math.cos(startAngle);
  let rightX=Math.cos(startAngle);
  let rightZ=-Math.sin(startAngle);
  let best=null;
  let offsets=nearStart
    ? [
      {forward:220,side:92},
      {forward:260,side:-108},
      {forward:310,side:72},
      {forward:360,side:-126},
      {forward:420,side:112}
    ]
    : [
      {forward:5600,side:1180},
      {forward:6400,side:-1320},
      {forward:7200,side:880},
      {forward:8050,side:-1460},
      {forward:8900,side:1260}
    ];

  for(let offset of offsets){
    for(let sideSign of [1,-1]){
      let side=offset.side*sideSign;
      let x=startX+forwardX*offset.forward+rightX*side;
      let z=startZ+forwardZ*offset.forward+rightZ*side;
      if(Math.hypot(x-startX,z-startZ)<minBossBaseStartDistance) continue;
      let y=groundHeight(x,z);
      if(y<waterLevel+3 || y>38) continue;
      if(roadDistance(x,z)<70) continue;
      if(collidesWithObstacles(x,z)) continue;
      best={x,z};
      break;
    }
    if(best) break;
  }

  if(!best){
    best={
      x:startX+forwardX*(nearStart ? 280 : 6200)+rightX*(nearStart ? 96 : 1180),
      z:startZ+forwardZ*(nearStart ? 280 : 6200)+rightZ*(nearStart ? 96 : 1180)
    };
  }

  let base=makeBossBase(best.x,best.z,startAngle+Math.PI);
  bossBases.push(base);
  addBossBaseCollider(base);

  return base;
}

function damageBossBase(obstacle,amount=1){
  let base=obstacle && obstacle.base ? obstacle.base : obstacle;
  if(!base || !base.active || base.health<=0) return false;

  base.health=Math.max(0,base.health-amount);

  if(base.health<=0){
    base.active=false;
    base.group.visible=false;
    for(let collider of bossBaseColliders){
      if(collider.base===base) collider.destroyed=true;
    }
    return true;
  }

  return false;
}

function obstacleMovementRadius(obstacle,padding=0){
  let radius=obstacle && Number.isFinite(obstacle.r) ? obstacle.r : 0;
  if(obstacle && obstacle.type==="smallRock" && obstacle.gravelRock){
    radius=Math.max(0.62,Math.min(radius,(obstacle.visualRadius || radius)*0.82));
  }else if(obstacle && obstacle.type==="smallRock"){
    radius=Math.max(1.45,Math.min(radius,(obstacle.visualRadius || radius)*0.95));
  }
  return radius+padding;
}

function obstacleVerticalBounds(obstacle){
  if(!obstacle) return {bottom:0,top:0,center:0,height:0};
  if(Number.isFinite(obstacle.bottomY) && Number.isFinite(obstacle.topY)){
    let bottom=Math.min(obstacle.bottomY,obstacle.topY);
    let top=Math.max(obstacle.bottomY,obstacle.topY);
    return {
      bottom,
      top,
      center:(bottom+top)*0.5,
      height:Math.max(0.001,top-bottom)
    };
  }

  let base=Number.isFinite(obstacle.baseY) ? obstacle.baseY : groundHeight(obstacle.x,obstacle.z);
  let height=obstacle.visualHeight || obstacle.height || obstacle.r || 1;
  let isRock=obstacle.type==="rock" || obstacle.type==="smallRock";
  let bottom=isRock ? base-Math.max(0.75,height*0.32) : base;
  let top=base+height;

  return {
    bottom,
    top,
    center:(bottom+top)*0.5,
    height:Math.max(0.001,top-bottom)
  };
}

function verticalBoundsOverlap(actorBounds,obstacle){
  if(!actorBounds) return true;
  let obstacleBounds=obstacleVerticalBounds(obstacle);
  let obstacleBaseY=Number.isFinite(obstacle.baseY)
    ? obstacle.baseY
    : Number.isFinite(obstacle.x) && Number.isFinite(obstacle.z)
    ? groundHeight(obstacle.x,obstacle.z)
    : obstacleBounds.bottom;
  let exposedObstacleHeight=Math.max(0,obstacleBounds.top-obstacleBaseY);
  let canStepOver=obstacle
    && (obstacle.type==="rock" || obstacle.type==="smallRock" || obstacle.type==="wall")
    && Number.isFinite(actorBounds.stepHeight)
    && exposedObstacleHeight<=actorBounds.stepHeight;
  if(canStepOver) return false;
  let actorBottom=Number.isFinite(actorBounds.bottom) ? actorBounds.bottom : -Infinity;
  let actorTop=Number.isFinite(actorBounds.top) ? actorBounds.top : Infinity;
  let clearance=Number.isFinite(actorBounds.clearance) ? Math.max(0,actorBounds.clearance) : 0.18;
  return actorTop>=obstacleBounds.bottom+clearance && actorBottom<=obstacleBounds.top-clearance;
}

function collidesWithObstacles(x,z,padding=carRadius,actorBounds=null){
  let pcx=Math.floor(x/chunkSize);
  let pcz=Math.floor(z/chunkSize);

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.colliders) continue;

      for(let obstacle of chunk.colliders){
        if(obstacle.destroyed) continue;
        if(!verticalBoundsOverlap(actorBounds,obstacle)) continue;

        let ox=obstacle.x;
        let oz=obstacle.z;
        let r=obstacleMovementRadius(obstacle,padding);
        let dist=x-ox;
        let distz=z-oz;

        if(dist*dist+distz*distz<r*r) return true;
      }
    }
  }

  for(let obstacle of bossBaseColliders){
    if(obstacle.destroyed) continue;
    if(!verticalBoundsOverlap(actorBounds,obstacle)) continue;
    let r=obstacle.r+padding;
    let dist=x-obstacle.x;
    let distz=z-obstacle.z;
    if(dist*dist+distz*distz<r*r) return true;
  }

  return false;
}

function obstacleAt(x,z,padding=0,actorBounds=null){
  let pcx=Math.floor(x/chunkSize);
  let pcz=Math.floor(z/chunkSize);
  let best=null;
  let bestDist=Infinity;

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.colliders) continue;

      for(let obstacle of chunk.colliders){
        if(obstacle.destroyed || obstacle.type==="treeCluster") continue;
        if(!verticalBoundsOverlap(actorBounds,obstacle)) continue;

        let ox=obstacle.x;
        let oz=obstacle.z;
        let r=obstacleMovementRadius(obstacle,padding);
        let distSq=(x-ox)*(x-ox)+(z-oz)*(z-oz);

        if(distSq<r*r && distSq<bestDist){
          best=obstacle;
          bestDist=distSq;
        }
      }
    }
  }

  for(let obstacle of bossBaseColliders){
    if(obstacle.destroyed) continue;
    if(!verticalBoundsOverlap(actorBounds,obstacle)) continue;
    let r=obstacle.r+padding;
    let distSq=(x-obstacle.x)*(x-obstacle.x)+(z-obstacle.z)*(z-obstacle.z);
    if(distSq<r*r && distSq<bestDist){
      best=obstacle;
      bestDist=distSq;
    }
  }

  return best;
}

function obstacleCollisionInfo(x,z,padding=carRadius,actorBounds=null){
  let pcx=Math.floor(x/chunkSize);
  let pcz=Math.floor(z/chunkSize);
  let best=null;
  let bestOverlap=0;

  function considerObstacle(obstacle){
    if(!obstacle || obstacle.destroyed || obstacle.type==="treeCluster") return;
    if(!verticalBoundsOverlap(actorBounds,obstacle)) return;
    let radius=obstacleMovementRadius(obstacle,padding);
    let dx=x-obstacle.x;
    let dz=z-obstacle.z;
    let distSq=dx*dx+dz*dz;
    if(distSq>=radius*radius) return;

    let dist=Math.sqrt(Math.max(0.000001,distSq));
    let overlap=radius-dist;
    if(overlap>bestOverlap){
      bestOverlap=overlap;
      best={obstacle,radius,dist,overlap,dx,dz};
    }
  }

  function considerVisibleRockInstance(mesh,collidersByInstance,index){
    if(!actorBounds || !mesh || index<0 || index>=mesh.count) return;
    let collider=collidersByInstance ? collidersByInstance[index] : null;
    if(collider && collider.destroyed) return;

    mesh.getMatrixAt(index,rockInstanceMatrix);
    rockInstanceMatrix.decompose(rockInstancePosition,rockInstanceQuaternion,rockInstanceScale);
    if(Math.abs(rockInstanceScale.x)+Math.abs(rockInstanceScale.y)+Math.abs(rockInstanceScale.z)<0.001) return;

    let radius=Math.max(
      collider && Number.isFinite(collider.r) ? collider.r : 0,
      Math.max(Math.abs(rockInstanceScale.x),Math.abs(rockInstanceScale.z))*1.38,
      1.15
    );
    let halfHeight=Math.max(Math.abs(rockInstanceScale.y)*1.42,0.35);
    let obstacle=collider || {
      x:rockInstancePosition.x,
      z:rockInstancePosition.z,
      type:"rock",
      instances:[{mesh,index}]
    };
    obstacle.x=Number.isFinite(obstacle.x) ? obstacle.x : rockInstancePosition.x;
    obstacle.z=Number.isFinite(obstacle.z) ? obstacle.z : rockInstancePosition.z;
    obstacle.baseY=Number.isFinite(obstacle.baseY) ? obstacle.baseY : groundHeight(rockInstancePosition.x,rockInstancePosition.z);
    obstacle.bottomY=Number.isFinite(obstacle.bottomY) ? obstacle.bottomY : rockInstancePosition.y-halfHeight;
    obstacle.topY=Number.isFinite(obstacle.topY) ? obstacle.topY : rockInstancePosition.y+halfHeight;
    obstacle.y=Number.isFinite(obstacle.y) ? obstacle.y : (obstacle.bottomY+obstacle.topY)*0.5;
    obstacle.r=Math.max(Number.isFinite(obstacle.r) ? obstacle.r : 0,radius);
    obstacle.visualRadius=Math.max(Number.isFinite(obstacle.visualRadius) ? obstacle.visualRadius : 0,radius);
    obstacle.visualHeight=Math.max(Number.isFinite(obstacle.visualHeight) ? obstacle.visualHeight : 0,obstacle.topY-obstacle.bottomY);
    obstacle.height=Math.max(Number.isFinite(obstacle.height) ? obstacle.height : 0,obstacle.topY-obstacle.bottomY);
    if(!verticalBoundsOverlap(actorBounds,obstacle)) return;

    let hitRadius=obstacleMovementRadius(obstacle,padding);
    let dx=x-obstacle.x;
    let dz=z-obstacle.z;
    let distSq=dx*dx+dz*dz;
    if(distSq>=hitRadius*hitRadius) return;

    let dist=Math.sqrt(Math.max(0.000001,distSq));
    let overlap=hitRadius-dist;
    if(overlap>bestOverlap){
      bestOverlap=overlap;
      best={obstacle,radius:hitRadius,dist,overlap,dx,dz};
    }
  }

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.colliders) continue;
      for(let obstacle of chunk.colliders) considerObstacle(obstacle);
      if(actorBounds && chunk.rocks){
        for(let i=0;i<chunk.rocks.count;i++) considerVisibleRockInstance(chunk.rocks,chunk.rockCollidersByInstance,i);
      }
    }
  }

  for(let obstacle of bossBaseColliders){
    if(!obstacle || obstacle.destroyed) continue;
    if(!verticalBoundsOverlap(actorBounds,obstacle)) continue;
    let radius=(obstacle.r || 0)+padding;
    let dx=x-obstacle.x;
    let dz=z-obstacle.z;
    let distSq=dx*dx+dz*dz;
    if(distSq>=radius*radius) continue;

    let dist=Math.sqrt(Math.max(0.000001,distSq));
    let overlap=radius-dist;
    if(overlap>bestOverlap){
      bestOverlap=overlap;
      best={obstacle,radius,dist,overlap,dx,dz};
    }
  }

  return best;
}

function obstacleAlongSegment(fromX,fromZ,toX,toZ,padding=0){
  let dx=toX-fromX;
  let dz=toZ-fromZ;
  let distance=Math.hypot(dx,dz);
  let steps=Math.max(1,Math.min(24,Math.ceil(distance/0.35)));

  for(let i=0;i<=steps;i++){
    let t=i/steps;
    let obstacle=obstacleAt(fromX+dx*t,fromZ+dz*t,padding);
    if(obstacle) return obstacle;
  }

  return null;
}

function obstacleAlongSegment3D(fromX,fromY,fromZ,toX,toY,toZ,padding=0,hitInfo=null){
  let fromCx=Math.floor(fromX/chunkSize);
  let fromCz=Math.floor(fromZ/chunkSize);
  let toCx=Math.floor(toX/chunkSize);
  let toCz=Math.floor(toZ/chunkSize);
  let sx=toX-fromX;
  let sy=toY-fromY;
  let sz=toZ-fromZ;
  let segLenSq=Math.max(0.0001,sx*sx+sy*sy+sz*sz);
  let segLen=Math.sqrt(segLenSq);
  let best=null;
  let bestT=Infinity;

  if(hitInfo){
    hitInfo.t=Infinity;
    hitInfo.distance=Infinity;
    hitInfo.x=toX;
    hitInfo.y=toY;
    hitInfo.z=toZ;
  }

  for(let cx=Math.min(fromCx,toCx)-1;cx<=Math.max(fromCx,toCx)+1;cx++){
    for(let cz=Math.min(fromCz,toCz)-1;cz<=Math.max(fromCz,toCz)+1;cz++){
      let chunk=chunks.get(chunkKey(cx,cz));
      if(!chunk || !chunk.colliders) continue;

      for(let obstacle of chunk.colliders){
        if(obstacle.destroyed || obstacle.type==="treeCluster") continue;

        let isRock=obstacle.type==="rock" || obstacle.type==="smallRock";
        let isStructure=obstacle.type==="building" || obstacle.type==="wall" || obstacle.type==="turret" || obstacle.type==="radarOutpost";
        let isBossBase=obstacle.type==="bossBase";
        let verticalBounds=isRock || isStructure
          ? obstacleVerticalBounds(obstacle)
          : null;
        let obstacleY=isRock
          ? verticalBounds.center
          : isBossBase && Number.isFinite(obstacle.y)
          ? obstacle.y
          : isStructure
          ? verticalBounds.center
          : groundHeight(obstacle.x,obstacle.z)+Math.max(0.6,obstacle.r*0.45);
        let t=((obstacle.x-fromX)*sx+(obstacleY-fromY)*sy+(obstacle.z-fromZ)*sz)/segLenSq;
        t=Math.max(0,Math.min(1,t));

        let closestX=fromX+sx*t;
        let closestY=fromY+sy*t;
        let closestZ=fromZ+sz*t;
        let radius=(isBossBase
          ? Math.max(4,obstacle.r)
          : isRock
          ? Math.max(2.9,(obstacle.visualRadius || obstacle.r)*1.82)
          : isStructure
          ? Math.max(2.0,(obstacle.visualRadius || obstacle.r)*0.9)
          : Math.max(1.2,obstacle.r*0.72))+padding;
        let verticalRadius=(isBossBase
          ? Math.max(4,(obstacle.visualHeight || obstacle.height || obstacle.r)*0.52)
          : isRock
          ? Math.max(2.1,verticalBounds.height*0.56)
          : isStructure
          ? Math.max(2.0,verticalBounds.height*0.52)
          : Math.max(1.0,obstacle.r*0.65))+padding;
        let verticalScale=Math.max(0.001,verticalRadius/radius);
        let distSq=(closestX-obstacle.x)*(closestX-obstacle.x)
          + ((closestY-obstacleY)/verticalScale)*((closestY-obstacleY)/verticalScale)
          + (closestZ-obstacle.z)*(closestZ-obstacle.z);
        let hitT=t;

        if((isRock || isStructure) && distSq>=radius*radius){
          let horizontalSegLenSq=Math.max(0.0001,sx*sx+sz*sz);
          let horizontalSegLen=Math.sqrt(horizontalSegLenSq);
          let obstacleT=((obstacle.x-fromX)*sx+(obstacle.z-fromZ)*sz)/horizontalSegLenSq;
          obstacleT=Math.max(0,Math.min(1,obstacleT));
          let obstacleX=fromX+sx*obstacleT;
          let obstacleYAtT=fromY+sy*obstacleT;
          let obstacleZ=fromZ+sz*obstacleT;
          let horizontalDistSq=(obstacleX-obstacle.x)*(obstacleX-obstacle.x)+(obstacleZ-obstacle.z)*(obstacleZ-obstacle.z);
          let visualTop=verticalBounds.top;
          let visualBottom=verticalBounds.bottom;
          let verticalPad=padding+0.85;
          if(horizontalDistSq<radius*radius && obstacleYAtT>=visualBottom-verticalPad && obstacleYAtT<=visualTop+verticalPad){
            distSq=radius*radius*0.5;
            let entryOffset=Math.sqrt(Math.max(0,radius*radius-horizontalDistSq))/Math.max(0.0001,horizontalSegLen);
            let entryT=Math.max(0,obstacleT-entryOffset);
            let entryY=fromY+sy*entryT;
            hitT=entryY>=visualBottom-verticalPad && entryY<=visualTop+verticalPad
              ? entryT
              : obstacleT;
            t=obstacleT;
          }
        }else if(distSq<radius*radius){
          hitT=Math.max(0,t-(radius/Math.max(0.0001,segLen))*(isRock ? 0.9 : isStructure ? 0.58 : 0.35));
        }

        if(distSq<radius*radius && hitT<bestT){
          best=obstacle;
          bestT=hitT;
        }
      }
    }
  }

  for(let obstacle of bossBaseColliders){
    if(obstacle.destroyed) continue;

    let obstacleY=Number.isFinite(obstacle.y)
      ? obstacle.y
      : groundHeight(obstacle.x,obstacle.z)+Math.max(0.6,obstacle.r*0.45);
    let t=((obstacle.x-fromX)*sx+(obstacleY-fromY)*sy+(obstacle.z-fromZ)*sz)/segLenSq;
    t=Math.max(0,Math.min(1,t));

    let closestX=fromX+sx*t;
    let closestY=fromY+sy*t;
    let closestZ=fromZ+sz*t;
    let radius=Math.max(4,obstacle.r)+padding;
    let verticalRadius=Math.max(4,(obstacle.visualHeight || obstacle.height || obstacle.r)*0.52)+padding;
    let verticalScale=Math.max(0.001,verticalRadius/radius);
    let distSq=(closestX-obstacle.x)*(closestX-obstacle.x)
      + ((closestY-obstacleY)/verticalScale)*((closestY-obstacleY)/verticalScale)
      + (closestZ-obstacle.z)*(closestZ-obstacle.z);

    let hitT=distSq<radius*radius
      ? Math.max(0,t-(radius/Math.max(0.0001,segLen))*0.58)
      : t;

    if(distSq<radius*radius && hitT<bestT){
      best=obstacle;
      bestT=hitT;
    }
  }

  if(best && hitInfo){
    hitInfo.t=bestT;
    hitInfo.distance=bestT*segLen;
    hitInfo.x=fromX+sx*bestT;
    hitInfo.y=fromY+sy*bestT;
    hitInfo.z=fromZ+sz*bestT;
  }

  return best;
}

function rockObstacleAlongSegmentExact(fromX,fromY,fromZ,toX,toY,toZ,hitInfo=null){
  let sx=toX-fromX;
  let sy=toY-fromY;
  let sz=toZ-fromZ;
  let distance=Math.hypot(sx,sy,sz);
  if(distance<0.001) return null;

  rockRayDirection.set(sx/distance,sy/distance,sz/distance);
  rockRaycaster.set({x:fromX,y:fromY,z:fromZ},rockRayDirection);
  rockRaycaster.near=0;
  rockRaycaster.far=distance;

  let minCx=Math.floor((Math.min(fromX,toX)-chunkSize*0.5)/chunkSize);
  let maxCx=Math.floor((Math.max(fromX,toX)+chunkSize*0.5)/chunkSize);
  let minCz=Math.floor((Math.min(fromZ,toZ)-chunkSize*0.5)/chunkSize);
  let maxCz=Math.floor((Math.max(fromZ,toZ)+chunkSize*0.5)/chunkSize);
  let best=null;
  let bestDistance=Infinity;
  let bestPoint=null;

  function checkMesh(mesh,collidersByInstance){
    if(!mesh || !mesh.visible) return;
    rockRayHits.length=0;
    rockRaycaster.intersectObject(mesh,false,rockRayHits);
    for(let hit of rockRayHits){
      if(!hit || hit.instanceId==null || hit.distance>=bestDistance) continue;
      let collider=collidersByInstance ? collidersByInstance[hit.instanceId] : null;
      if(collider && collider.destroyed) continue;
      best=collider || {
        x:hit.point ? hit.point.x : fromX+rockRayDirection.x*hit.distance,
        y:hit.point ? hit.point.y : fromY+rockRayDirection.y*hit.distance,
        z:hit.point ? hit.point.z : fromZ+rockRayDirection.z*hit.distance,
        type:"rock",
        instances:[{mesh,index:hit.instanceId}]
      };
      bestDistance=hit.distance;
      bestPoint=hit.point;
    }
  }

  for(let cx=minCx;cx<=maxCx;cx++){
    for(let cz=minCz;cz<=maxCz;cz++){
      let chunk=chunks.get(chunkKey(cx,cz));
      if(!chunk) continue;
      checkMesh(chunk.rocks,chunk.rockCollidersByInstance);
      checkMesh(chunk.gravel,chunk.gravelCollidersByInstance);
    }
  }

  if(best && hitInfo){
    hitInfo.distance=bestDistance;
    hitInfo.x=bestPoint ? bestPoint.x : fromX+rockRayDirection.x*bestDistance;
    hitInfo.y=bestPoint ? bestPoint.y : fromY+rockRayDirection.y*bestDistance;
    hitInfo.z=bestPoint ? bestPoint.z : fromZ+rockRayDirection.z*bestDistance;
  }

  return best;
}

function destroyObstacle(obstacle){
  if(!obstacle || obstacle.destroyed) return false;
  if(obstacle.indestructible) return false;
  obstacle.destroyed=true;

  if(obstacle.instances){
    for(let item of obstacle.instances){
      hideInstance(item.mesh,item.index);
    }
  }
  if(obstacle.object) obstacle.object.visible=false;

  return true;
}

function disposeRadarOutpostRecord(record){
  if(!record) return;

  let {object,collider,chunk}=record;
  if(chunk && chunk.colliders){
    let colliderIndex=chunk.colliders.indexOf(collider);
    if(colliderIndex>=0) chunk.colliders.splice(colliderIndex,1);
  }
  if(chunk && chunk.radarOutposts){
    let objectIndex=chunk.radarOutposts.indexOf(object);
    if(objectIndex>=0) chunk.radarOutposts.splice(objectIndex,1);
  }
  let dishPivot=object && object.userData ? object.userData.radarDishPivot : null;
  if(dishPivot){
    let dishIndex=animatedRadarDishes.indexOf(dishPivot);
    if(dishIndex>=0) animatedRadarDishes.splice(dishIndex,1);
  }
  if(object && object.parent) object.parent.remove(object);
  else if(object) scene.remove(object);
  disposeRadarOutpostObject(object);
}

function clearTestingRadarOutpost(){
  if(!testingRadarOutpost) return;

  disposeRadarOutpostRecord(testingRadarOutpost);
  testingRadarOutpost=null;
}

function clearMissionRadarOutposts(){
  for(let record of missionRadarOutposts){
    disposeRadarOutpostRecord(record);
  }
  missionRadarOutposts.length=0;
}

function createRadarOutpostRecord(x,z,angle=0,options={}){
  if(!Number.isFinite(x) || !Number.isFinite(z)) return null;

  let cx=Math.floor(x/chunkSize);
  let cz=Math.floor(z/chunkSize);
  let chunk=chunks.get(chunkKey(cx,cz));
  if(!chunk){
    updateChunksForCenters([{x,z,viewDistance:1}]);
    processChunkQueue(80,true);
    chunk=chunks.get(chunkKey(cx,cz));
  }
  if(!chunk) return null;

  let y=groundHeight(x,z);
  let outpost=makeRadarOutpost(x,y,z,angle);
  let health=options.missionId ? 520 : 92;
  let collider={
    x,
    baseY:y,
    y:y+7.8,
    z,
    r:18.0,
    height:23.4,
    visualRadius:17.1,
    visualHeight:23.7,
    type:"radarOutpost",
    object:outpost,
    health,
    maxHealth:health
  };
  if(options.missionId){
    collider.missionId=options.missionId;
    collider.missionTarget=true;
    collider.missionIndex=Number.isFinite(options.missionIndex) ? options.missionIndex : 0;
  }

  outpost.userData.collider=collider;
  chunk.colliders=chunk.colliders || [];
  chunk.radarOutposts=chunk.radarOutposts || [];
  chunk.colliders.push(collider);
  chunk.radarOutposts.push(outpost);
  chunk.root.add(outpost);

  return {object:outpost,collider,chunk};
}

function placeTestRadarOutpost(x,z,angle=0){
  clearTestingRadarOutpost();

  let record=createRadarOutpostRecord(x,z,angle);
  if(!record) return null;

  testingRadarOutpost=record;
  return record.collider;
}

function placeMissionRadarOutpostsNearStart(startX,startZ,startAngle=0,count=3,options={}){
  clearMissionRadarOutposts();

  if(!Number.isFinite(startX) || !Number.isFinite(startZ)) return [];
  count=Math.max(1,Math.floor(count || 1));

  let forwardX=Math.sin(startAngle);
  let forwardZ=Math.cos(startAngle);
  let rightX=Math.cos(startAngle);
  let rightZ=-Math.sin(startAngle);
  let offsets=[
    {forward:8200,side:-900},
    {forward:9000,side:2100},
    {forward:10350,side:-1600},
    {forward:8400,side:-3100},
    {forward:9600,side:3400},
    {forward:11600,side:800},
    {forward:8900,side:4300},
    {forward:10800,side:-3600},
    {forward:8100,side:2900},
    {forward:11900,side:-1200},
    {forward:9700,side:-4600},
    {forward:11200,side:2500}
  ];
  let candidates=offsets.map(offset=>({
    x:startX+forwardX*offset.forward+rightX*offset.side,
    z:startZ+forwardZ*offset.forward+rightZ*offset.side,
    angle:startAngle+Math.PI+(offset.side<0 ? -0.18 : 0.18)
  }));

  updateChunksForCenters(candidates.map(candidate=>({
    x:candidate.x,
    z:candidate.z,
    viewDistance:1
  })));
  processChunkQueue(240,true);

  let placed=[];
  let minOutpostSpacing=1100;
  let minOutpostSpacingSq=minOutpostSpacing*minOutpostSpacing;
  function farEnoughFromPlaced(candidate){
    return placed.every(outpost=>{
      let dx=outpost.x-candidate.x;
      let dz=outpost.z-candidate.z;
      return dx*dx+dz*dz>=minOutpostSpacingSq;
    });
  }

  for(let candidate of candidates){
    if(placed.length>=count) break;
    if(!farEnoughFromPlaced(candidate)) continue;

    let y=groundHeight(candidate.x,candidate.z);
    if(y<waterLevel+2.6 || y>42) continue;
    if(collidesWithObstacles(candidate.x,candidate.z)) continue;

    let record=createRadarOutpostRecord(candidate.x,candidate.z,candidate.angle,{
      missionId:options.missionId,
      missionIndex:placed.length
    });
    if(!record) continue;

    missionRadarOutposts.push(record);
    placed.push(record.collider);
  }

  for(let candidate of candidates){
    if(placed.length>=count) break;
    if(!farEnoughFromPlaced(candidate)) continue;

    let record=createRadarOutpostRecord(candidate.x,candidate.z,candidate.angle,{
      missionId:options.missionId,
      missionIndex:placed.length
    });
    if(!record) continue;

    missionRadarOutposts.push(record);
    placed.push(record.collider);
  }

  return placed;
}

function isVillageCleared(village){
  return !!(village && village.buildings && village.buildings.length>0
    && village.buildings.every(building=>building.destroyed));
}

function terrainPatchOk(x,z,radius,maxHeight=24,maxRange=7){
  let minH=Infinity;
  let maxH=-Infinity;
  let samples=[
    [0,0],
    [1,0],
    [-1,0],
    [0,1],
    [0,-1],
    [0.72,0.72],
    [-0.72,0.72],
    [0.72,-0.72],
    [-0.72,-0.72]
  ];

  for(let sample of samples){
    let h=groundHeight(x+sample[0]*radius,z+sample[1]*radius);
    minH=Math.min(minH,h);
    maxH=Math.max(maxH,h);
  }

  return minH>-12 && maxH<maxHeight && maxH-minH<maxRange;
}

function holeDepthAt(hole,x,z){
  if(!hole) return 0;
  let dx=x-hole.x;
  let dz=z-hole.z;
  let dist=Math.hypot(dx,dz);
  if(dist>=hole.r) return 0;

  let inner=hole.innerR || hole.r*0.34;
  if(dist<=inner) return hole.depth;

  let t=(dist-inner)/Math.max(0.001,hole.r-inner);
  let rim=t*t*(3-2*t);
  return hole.depth*(1-rim);
}

function pointInHole(holes,x,z,padding=0){
  if(!holes) return null;
  for(let hole of holes){
    let radius=(hole.r || 0)+padding;
    let dx=x-hole.x;
    let dz=z-hole.z;
    if(dx*dx+dz*dz<radius*radius) return hole;
  }
  return null;
}

function holesForChunk(cx,cz,cityMode=false){
  let holes=[];
  let firstRoll=r01(cx*1229+19,cz*1697-31);
  let targetCount=cityMode
    ? (firstRoll>0.72 ? 1 : 0)
    : firstRoll>0.84 ? 3 : firstRoll>0.34 ? 2 : 1;

  for(let i=0;i<targetCount;i++){
    for(let attempt=0;attempt<18;attempt++){
      let rx=r01(cx*2381+i*101+attempt*17,cz*997-i*67-attempt*11);
      let rz=r01(cx*1471-i*53-attempt*23,cz*2063+i*83+attempt*13);
      let x=cx*chunkSize+(rx-0.5)*chunkSize;
      let z=cz*chunkSize+(rz-0.5)*chunkSize;
      let y=groundHeight(x,z);
      let sizeRoll=r01(cx*421+i*37+attempt,cz*733-i*19);
      let radius=32+Math.pow(sizeRoll,1.28)*58;

      if(y<waterLevel+4 || y>42) continue;
      if(roadDistance(x,z)<44+radius*0.55) continue;
      if(!terrainPatchOk(x,z,radius*0.92,50,14.5)) continue;
      if(pointInHole(holes,x,z,radius*1.65)) continue;

      let maxDepth=Math.max(3,y-waterLevel-2.2);
      let depthRoll=r01(cx*887-i*7,cz*569+attempt*29);
      let depth=Math.min(maxDepth,10+depthRoll*12+(radius-32)*0.12);
      holes.push({
        x,
        z,
        y,
        r:radius,
        innerR:radius*(0.34+r01(cx+i*5,cz-attempt*3)*0.16),
        depth,
        type:"hole"
      });
      break;
    }
  }

  return holes;
}

function terrainHolesForChunk(cx,cz){
  let holes=[];
  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let hx=cx+dx;
      let hz=cz+dz;
      holes.push(...holesForChunk(hx,hz,chunkHasCityDistrict(hx,hz)));
    }
  }
  return holes;
}

function makeTreasureChestForHole(hole,cx,cz,index){
  if(!hole || !treasureChestModels.length) return null;
  if(r01(cx*1759+index*97,cz*2441-index*43)>treasureHoleChance) return null;

  let modelIndex=Math.floor(r01(cx*313+index*41,cz*719-index*17)*treasureChestModels.length)%treasureChestModels.length;
  let source=treasureChestModels[modelIndex];
  if(!source) return null;

  let treasure=new THREE.Group();
  treasure.name="hole-treasure";

  let chest=source.clone(true);
  chest.name="hole-treasure-chest";
  chest.position.set(hole.x,hole.y-hole.depth+0.72,hole.z);
  chest.rotation.y=r01(cx*887+index*23,cz*463-index*31)*Math.PI*2;
  chest.scale.multiplyScalar(Math.max(0.72,Math.min(1.12,hole.innerR/8.5)));
  chest.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
    }
  });

  treasure.add(chest);
  treasure.userData.x=hole.x;
  treasure.userData.y=chest.position.y;
  treasure.userData.z=hole.z;
  treasure.userData.r=Math.max(3.2,Math.min(8,hole.innerR*0.42));
  treasure.userData.treasureType=source.userData.treasureType || "common";
  treasure.userData.collected=false;

  return treasure;
}

function localColliderAt(colliders,x,z,padding=0){
  for(let obstacle of colliders){
    if(obstacle.destroyed) continue;
    let radius=obstacleMovementRadius(obstacle,padding);
    let dx=x-obstacle.x;
    let dz=z-obstacle.z;
    if(dx*dx+dz*dz<radius*radius) return obstacle;
  }

  return null;
}

function landingSpacePointForChunk(cx,cz,colliders,holes=[]){
  if(!landingSpaceModel) return null;
  if(r01(cx*953+17,cz*587-29)>0.055) return null;

  for(let attempt=0;attempt<12;attempt++){
    let rx=r01(cx*1949+attempt*43,cz*2879-attempt*31);
    let rz=r01(cx*3539-attempt*19,cz*1423+attempt*47);
    let x=cx*chunkSize+(rx-.5)*chunkSize;
    let z=cz*chunkSize+(rz-.5)*chunkSize;
    let y=groundHeight(x,z);

    if(y<waterLevel+1.2 || y>30) continue;
    if(roadDistance(x,z)<74) continue;
    if(!terrainPatchOk(x,z,34,34,3.2)) continue;
    if(pointInHole(holes,x,z,54)) continue;
    if(localColliderAt(colliders,x,z,44)) continue;

    return {
      x,
      y,
      z,
      yaw:r01(cx*463+attempt*23,cz*811-attempt*7)*Math.PI*2
    };
  }

  return null;
}

function applyLandingSpacePalette(landingSpace){
  let colors=environmentColors();
  let hull=mixHexColor(colors.rock,colors.roof || colors.wall,0.56);
  let deck=mixHexColor(colors.wall || colors.rock,colors.trim || colors.shore,0.28);
  let accent=colors.trim || colors.shore;
  let glow=colors.waterEmissive || colors.water || colors.podEmissive || colors.pod;
  let green=mixHexColor(colors.grass || colors.low,colors.leaf || colors.mid,0.42);

  landingSpace.traverse(child=>{
    if(!child.isMesh || !child.material) return;
    let materials=Array.isArray(child.material) ? child.material : [child.material];
    let cloned=materials.map(material=>{
      let next=material.clone();
      if(next.name==="color_6383466" || next.name==="color_2829873"){
        next.color.set(hull);
        if(next.emissive) next.emissive.set(mixHexColor(colors.barkEmissive || hull,colors.rock,0.35));
        next.emissiveIntensity=0.1;
      }else if(next.name==="color_12568524" || next.name==="color_16448250"){
        next.color.set(deck);
        if(next.emissive) next.emissive.set(mixHexColor(deck,glow,0.18));
        next.emissiveIntensity=0.08;
      }else if(next.name==="color_9771553" || next.name==="color_15277357"){
        next.color.set(accent);
        if(next.emissive) next.emissive.set(mixHexColor(accent,glow,0.45));
        next.emissiveIntensity=0.34;
      }else if(next.name==="color_11593967"){
        next.color.set(mixHexColor(colors.water || glow,colors.trim || glow,0.22));
        if(next.emissive) next.emissive.set(glow);
        next.emissiveIntensity=0.5;
      }else if(next.name==="color_4634441"){
        next.color.set(green);
        if(next.emissive) next.emissive.set(mixHexColor(green,colors.grassEmissive || green,0.5));
        next.emissiveIntensity=0.18;
      }
      return next;
    });
    child.material=Array.isArray(child.material) ? cloned : cloned[0];
  });
}

function makeLandingSpace(point,parent=scene){
  let landingSpace=landingSpaceModel.clone(true);
  applyLandingSpacePalette(landingSpace);
  landingSpace.position.set(point.x,point.y+0.04,point.z);
  landingSpace.rotation.y=point.yaw;
  freezeStaticObject(landingSpace);
  parent.add(landingSpace);
  return landingSpace;
}

function makeLandingSurface(point){
  let surfaceOffset=landingSpaceModel && Number.isFinite(landingSpaceModel.userData.landingSurfaceOffset)
    ? landingSpaceModel.userData.landingSurfaceOffset
    : 0.24;
  let localX=landingSpaceModel && Number.isFinite(landingSpaceModel.userData.landingSurfaceLocalX)
    ? landingSpaceModel.userData.landingSurfaceLocalX
    : 0;
  let localZ=landingSpaceModel && Number.isFinite(landingSpaceModel.userData.landingSurfaceLocalZ)
    ? landingSpaceModel.userData.landingSurfaceLocalZ
    : 0;
  let yaw=point.yaw || 0;
  let cos=Math.cos(yaw);
  let sin=Math.sin(yaw);
  let surfaceX=point.x+localX*cos+localZ*sin;
  let surfaceZ=point.z-localX*sin+localZ*cos;
  let touchdownBackOffset=4.8;
  let touchdownX=surfaceX-sin*touchdownBackOffset;
  let touchdownZ=surfaceZ-cos*touchdownBackOffset;

  return {
    x:surfaceX,
    z:surfaceZ,
    touchdownX,
    touchdownZ,
    modelX:point.x,
    modelZ:point.z,
    y:point.y+0.04+surfaceOffset,
    r:92,
    padR:24
  };
}

function makeLandingRing(surface,parent=scene){
  let colors=environmentColors();
  let glow=colors.waterEmissive || colors.water || colors.podEmissive || colors.pod || colors.trim;
  let material=new THREE.MeshBasicMaterial({
    color:glow,
    transparent:true,
    opacity:0.72,
    depthWrite:false,
    depthTest:true,
    blending:THREE.AdditiveBlending,
    side:THREE.DoubleSide
  });
  let ring=new THREE.Mesh(landingRingGeo,material);
  let baseScale=Math.max(8.5,Math.min(13.5,(surface.padR || 24)*0.44));
  ring.position.set(surface.x,surface.y+0.12,surface.z);
  ring.rotation.x=-Math.PI/2;
  ring.renderOrder=16;
  ring.userData.baseScale=baseScale;
  ring.userData.phase=rand(surface.x*0.17,surface.z*0.23)*Math.PI*2;
  ring.scale.setScalar(baseScale);
  parent.add(ring);
  animatedLandingRings.push(ring);
  return ring;
}

function* makeChunk(cx,cz,precomputedTerrain=null){
  let chunkRoot=new THREE.Group();
  let envColors=environmentColors();
  let shoreline=environmentShoreline();
  let vegetation=environmentVegetation();
  let rockSettings=environmentRocks();
  let detail=chunkDetails.get(chunkKey(cx,cz)) || {treeDensity:1,partDensity:1,grassDensity:1,featureDensity:1};
  let featureDensity=detail.featureDensity ?? 1;
  let buildChunkFeatures=featureDensity>0.05;
  let cityMode=buildChunkFeatures && chunkHasCityDistrict(cx,cz);
  let colors=[];
  let colliders=[];
  let landingSpaces=[];
  let landingSurfaces=[];
  let landingRings=[];
  let localHoles=precomputedTerrain && Array.isArray(precomputedTerrain.holes)
    ? precomputedTerrain.holes
    : holesForChunk(cx,cz,cityMode);
  let holes=precomputedTerrain && Array.isArray(precomputedTerrain.terrainHoles)
    ? precomputedTerrain.terrainHoles
    : terrainHolesForChunk(cx,cz);
  let holeMeshes=[];
  let treasureChests=[];
  let radarOutposts=[];
  let chunkHasWater=!!(precomputedTerrain && precomputedTerrain.chunkHasWater);
  let geo=new THREE.PlaneGeometry(chunkSize,chunkSize,segments,segments);
  geo.rotateX(-Math.PI/2);

  let pos=geo.attributes.position;
  let vertexColor=new THREE.Color();
  let lowColor=new THREE.Color(envColors.low);
  let shoreColor=new THREE.Color(envColors.shore);
  let shoreInnerHeight=shoreline.innerHeight ?? 1.8;
  let shoreOuterHeight=shoreline.outerHeight ?? 12;
  let shoreInnerBlend=shoreline.innerShoreBlend ?? 0.35;
  let shoreTransitionHeight=Math.max(0.1,shoreOuterHeight-shoreInnerHeight);
  let terrainShoreStrength=Math.max(0,Math.min(1,shoreline.terrainShoreStrength ?? 1));
  let wetShoreColor=shoreColor.clone().lerp(new THREE.Color(displayWaterColor(envColors.water || 0x20ffd4)),shoreline.wetWaterMix ?? 0.2);
  let holeColor=new THREE.Color(0x09070a);

  if(precomputedTerrain && precomputedTerrain.heights && precomputedTerrain.colors){
    let heights=precomputedTerrain.heights;
    for(let i=0;i<pos.count && i<heights.length;i++){
      pos.setY(i,heights[i]);
    }
    colors=precomputedTerrain.colors;
  }else{
    let vertexCount=pos.count;
    let holeAmounts=new Float32Array(vertexCount);
    let waterMask=new Uint8Array(vertexCount);

    for(let i=0;i<pos.count;i++){
      let wx=pos.getX(i)+cx*chunkSize;
      let wz=pos.getZ(i)+cz*chunkSize;
      let baseH=groundHeight(wx,wz);
      let h=baseH;
      let holeAmount=0;

      for(let hole of holes){
        let depth=holeDepthAt(hole,wx,wz);
        if(depth>0){
          h-=depth;
          holeAmount=Math.max(holeAmount,depth/Math.max(0.001,hole.depth));
        }
      }

      if(baseH<waterLevel){
        chunkHasWater=true;
        waterMask[i]=1;
      }

      pos.setY(i,h);
      holeAmounts[i]=holeAmount;
    }

    let shoreDistances=chunkHasWater ? waterShoreDistances(waterMask) : null;
    if(shoreDistances){
      for(let i=0;i<vertexCount;i++){
        if(waterMask[i]) pos.setY(i,underwaterVisualHeight(pos.getY(i),shoreDistances[i]));
      }
    }

    for(let i=0;i<vertexCount;i++){
      let h=pos.getY(i);
      let holeAmount=holeAmounts[i];
      if(holeAmount>0){
        let wallShade=0.18+Math.min(0.82,holeAmount)*0.22;
        vertexColor.set(holeColor).lerp(lowColor,wallShade);
      }else if(h<waterLevel) vertexColor.set(envColors.underwater);
      else if(h<waterLevel+shoreInnerHeight){
        let t=waterSmoothstep01((h-waterLevel)/shoreInnerHeight);
        let targetColor=wetShoreColor.clone().lerp(shoreColor,t*shoreInnerBlend);
        vertexColor.copy(lowColor).lerp(targetColor,terrainShoreStrength);
      }else if(h<waterLevel+shoreOuterHeight){
        let t=waterSmoothstep01((h-(waterLevel+shoreInnerHeight))/shoreTransitionHeight);
        let targetColor=wetShoreColor.clone().lerp(lowColor,t);
        vertexColor.copy(lowColor).lerp(targetColor,terrainShoreStrength);
      }
      else if(h<15) vertexColor.set(envColors.low);
      else if(h<30) vertexColor.set(envColors.mid);
      else vertexColor.set(envColors.high);

      colors.push(vertexColor.r,vertexColor.g,vertexColor.b);
    }
  }

  geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();

  let land=new THREE.Mesh(geo,landMat);
  land.position.set(cx*chunkSize,0,cz*chunkSize);
  freezeStaticObject(land);
  chunkRoot.add(land);

  for(let holeIndex=0;holeIndex<localHoles.length;holeIndex++){
    let hole=localHoles[holeIndex];
    let chest=makeTreasureChestForHole(hole,cx,cz,holeIndex);
    if(chest){
      treasureChests.push(chest);
      chunkRoot.add(chest);
    }
  }

  let road=new THREE.Object3D();
  let water=new THREE.Object3D();
  let shoreBand=new THREE.Object3D();
  if(chunkHasWater){
    let waterGeo=shoreline.useClippedWater
      ? makeWaterGeometryFromTerrain(pos,shoreline.waterMinVisibleDepth ?? 0)
      : makeWaterPlaneGeometry();
    if(waterGeo){
      water=new THREE.Mesh(waterGeo,waterMat);
      water.position.set(cx*chunkSize,waterLevel+waterSurfaceVisualLift,cz*chunkSize);
      water.renderOrder=2;
      freezeStaticObject(water);
      chunkRoot.add(water);
    }
    let shoreBandGeo=(shoreline.showBand ?? true) ? makeShoreBandGeometryFromTerrain(pos) : null;
    if(shoreBandGeo){
      shoreBand=new THREE.Mesh(shoreBandGeo,shoreBandMat);
      shoreBand.position.set(cx*chunkSize,0,cz*chunkSize);
      shoreBand.renderOrder=3;
      freezeStaticObject(shoreBand);
      chunkRoot.add(shoreBand);
    }
  }
  yield;

  let clusterCount=Math.max(0,Math.ceil(vegetation.treeClusters*detail.treeDensity));
  let treesPerCluster=Math.max(1,Math.ceil(vegetation.treesPerCluster*detail.treeDensity));
  let clusterRadius=vegetation.treeClusterRadius;
  let crownsPerTree=Math.max(1,Math.floor(vegetation.crownsPerTree*detail.partDensity));
  let podsPerTree=Math.max(0,Math.floor(vegetation.podsPerTree*detail.partDensity));
  let maxTrees=clusterCount*treesPerCluster;

  let dummy=new THREE.Object3D();
  let trunks=null;
  let crowns=null;
  let pods=null;
  let treeUsed=0;
  let crownUsed=0;
  let podUsed=0;

  if(maxTrees>0){
    trunks=new THREE.InstancedMesh(trunkGeo,barkMat,maxTrees);
    crowns=new THREE.InstancedMesh(crownGeo,leafMat,maxTrees*crownsPerTree);
    pods=new THREE.InstancedMesh(podGeo,podMat,Math.max(1,maxTrees*podsPerTree));
  }

  for(let c=0;c<clusterCount && trunks;c++){
    let crx=rand(cx*91+c,cz*37-c);
    let crz=rand(cx*53-c,cz*79+c);

    let centerX=cx*chunkSize+(crx-.5)*chunkSize;
    let centerZ=cz*chunkSize+(crz-.5)*chunkSize;
    let centerY=groundHeight(centerX,centerZ);

    if(centerY<-15 || centerY>32) continue;
    if(roadDistance(centerX,centerZ)<70) continue;
    if(pointInHole(holes,centerX,centerZ,clusterRadius+8)) continue;

    colliders.push({x:centerX,z:centerZ,r:6,type:"treeCluster"});

    for(let i=0;i<treesPerCluster;i++){
      let a=rand(cx*999+c*17+i,cz*777-i)*Math.PI*2;
      let r=Math.pow(rand(cx*333+i,cz*555+c),.6)*clusterRadius;

      let wx=centerX+Math.cos(a)*r;
      let wz=centerZ+Math.sin(a)*r;
      let wy=groundHeight(wx,wz);

      if(wy<-15 || wy>32) continue;
      if(roadDistance(wx,wz)<45) continue;

      let scale=.55+rand(i+cx+c,cz-i)*.9;
      let rot=rand(i,cx+cz+c)*Math.PI*2;
      let leanX=(rand(cx*13+i,cz*19+c)-0.5)*vegetation.leanAmount;
      let leanZ=(rand(cx*23-i,cz*29-c)-0.5)*vegetation.leanAmount;
      let trunkHeightScale=vegetation.trunkHeightBase+rand(cx*31+i,cz*41-c)*vegetation.trunkHeightVariance;
      let trunkWidthScale=vegetation.trunkWidthBase+rand(cx*43-i,cz*47+c)*vegetation.trunkWidthVariance;
      let rootRadius=Math.max(1.7,scale*trunkWidthScale*1.9);
      if(pointInHole(holes,wx,wz,rootRadius+2)) continue;
      if(!terrainPatchOk(wx,wz,rootRadius,34,2.6)) continue;

      let treeCollider={x:wx,z:wz,r:2.4,type:"tree",instances:[]};
      colliders.push(treeCollider);
      let rootSink=0.45+Math.min(0.9,Math.abs(leanX)+Math.abs(leanZ));

      dummy.position.set(wx,wy+5.25*scale*trunkHeightScale-rootSink,wz);
      dummy.rotation.set(leanX,rot,leanZ);
      dummy.scale.set(scale*trunkWidthScale,scale*trunkHeightScale,scale*trunkWidthScale);
      dummy.updateMatrix();
      trunks.setMatrixAt(treeUsed,dummy.matrix);
      treeCollider.instances.push({mesh:trunks,index:treeUsed});

      let crownStart=crownUsed;
      for(let j=0;j<crownsPerTree;j++){
        let crownScale=scale*(vegetation.crownBaseScale-j*vegetation.crownScaleStep);
        let angle=rot+j*2.38+rand(i+j*11,c*17)*0.9;
        let radius=j===0 ? 0 : (vegetation.crownSpreadBase+rand(i*7+j,cx-cz)*vegetation.crownSpreadVariance)*scale;
        let lift=(vegetation.crownLiftBase+Math.sin(j*1.7)*0.8+j*vegetation.crownLiftStep)*scale*trunkHeightScale;

        dummy.position.set(
          wx+Math.cos(angle)*radius,
          wy+lift,
          wz+Math.sin(angle)*radius
        );
        dummy.rotation.set(
          rand(j+i,cx)*Math.PI,
          angle,
          rand(cz,j-c)*Math.PI
        );
        dummy.scale.set(
          crownScale*(0.95+rand(j+cx,i)*0.45)*vegetation.crownWidthScale,
          crownScale*(0.48+rand(j+cz,i+c)*0.34)*vegetation.crownFlatness,
          crownScale*(0.9+rand(j-cx,i-c)*0.5)*vegetation.crownDepthScale
        );
        dummy.updateMatrix();

        crowns.setMatrixAt(crownUsed,dummy.matrix);
        crownUsed++;
      }

      for(let k=crownStart;k<crownUsed;k++){
        treeCollider.instances.push({mesh:crowns,index:k});
      }

      let podStart=podUsed;
      for(let j=0;j<podsPerTree;j++){
        let podScale=scale*(vegetation.podScaleBase+rand(i*19+j,cx+cz)*vegetation.podScaleVariance);
        let angle=rot+j*Math.PI*0.5+rand(c*29+j,i)*0.65;
        let radius=(1.4+rand(i*31-j,cz)*1.8)*scale;

        dummy.position.set(
          wx+Math.cos(angle)*radius,
          wy+(vegetation.podLiftBase+rand(j+cx,c-i)*vegetation.podLiftVariance)*scale*trunkHeightScale,
          wz+Math.sin(angle)*radius
        );
        dummy.rotation.set(0,angle,0);
        dummy.scale.set(podScale,podScale*vegetation.podElongation,podScale);
        dummy.updateMatrix();

        pods.setMatrixAt(podUsed,dummy.matrix);
        podUsed++;
      }

      for(let k=podStart;k<podUsed;k++){
        treeCollider.instances.push({mesh:pods,index:k});
      }

      treeUsed++;
    }

    if(c<clusterCount-1) yield;
  }

  if(trunks){
    trunks.count=treeUsed;
    crowns.count=crownUsed;
    pods.count=podUsed;
    trunks.instanceMatrix.needsUpdate=true;
    crowns.instanceMatrix.needsUpdate=true;
    pods.instanceMatrix.needsUpdate=true;
    if(treeUsed>0){
      stabilizeVegetationMesh(trunks);
      chunkRoot.add(trunks);
    }else{
      trunks.dispose();
      trunks=null;
    }
    if(crownUsed>0){
      stabilizeVegetationMesh(crowns);
      chunkRoot.add(crowns);
    }else{
      crowns.dispose();
      crowns=null;
    }
    if(podUsed>0){
      stabilizeVegetationMesh(pods);
      chunkRoot.add(pods);
    }else{
      pods.dispose();
      pods=null;
    }
  }
  yield;

  let grassClusterCount=Math.max(0,Math.ceil(vegetation.grassClusters*detail.grassDensity));
  let grassPerCluster=Math.max(1,Math.ceil(vegetation.grassPerCluster*detail.grassDensity));
  let grassClusterRadius=vegetation.grassClusterRadius*0.74;
  let grassMinHeight=vegetation.grassMinHeight ?? -15;
  let grassMaxHeight=vegetation.grassMaxHeight ?? 28;
  let grassMaxSlope=vegetation.grassMaxSlope ?? Infinity;
  let grassSlopeSampleDistance=vegetation.grassSlopeSampleDistance ?? 18;
  let rawMaxGrasses=grassClusterCount*grassPerCluster;
  let grassBudget=Math.max(0,vegetation.maxGrassInstancesPerChunk ?? 18000);
  let maxGrasses=Math.min(rawMaxGrasses,Math.ceil(grassBudget*Math.max(0.08,Math.min(1,detail.grassDensity))));

  let grasses=maxGrasses>0 ? new THREE.InstancedMesh(grassGeo,grassMat,maxGrasses) : null;
  let grassUsed=0;

  for(let c=0;c<grassClusterCount && grassUsed<maxGrasses;c++){
    let crx=rand(cx*234+c,cz*567-c);
    let crz=rand(cx*890-c,cz*12+c);

    let centerX=cx*chunkSize+(crx-.5)*chunkSize;
    let centerZ=cz*chunkSize+(crz-.5)*chunkSize;
    let centerY=groundHeight(centerX,centerZ);

    if(centerY<grassMinHeight || centerY>grassMaxHeight) continue;
    if(terrainSlopeAt(centerX,centerZ,grassSlopeSampleDistance)>grassMaxSlope) continue;
    if(roadDistance(centerX,centerZ)<35) continue;

    for(let i=0;i<grassPerCluster && grassUsed<maxGrasses;i++){
      let a=rand(cx*345+c*11+i,cz*678-i)*Math.PI*2;
      let r=Math.pow(rand(cx*901+i,cz*234+c),.5)*grassClusterRadius;

      let wx=centerX+Math.cos(a)*r;
      let wz=centerZ+Math.sin(a)*r;
      let wy=groundHeight(wx,wz);

      if(wy<grassMinHeight || wy>grassMaxHeight) continue;
      if(terrainSlopeAt(wx,wz,grassSlopeSampleDistance)>grassMaxSlope) continue;
      if(roadDistance(wx,wz)<35) continue;
      if(pointInHole(holes,wx,wz,1.8)) continue;

      let scale=.4+rand(i,cx-cz)*.8;

      dummy.position.set(wx,wy+1.2*scale,wz);
      dummy.rotation.set(0,rand(i*3,cx+cz)*Math.PI*2,0);
      dummy.scale.set(scale*1.12,.7+scale,scale*1.12);
      dummy.updateMatrix();

      grasses.setMatrixAt(grassUsed,dummy.matrix);
      grassUsed++;
    }

    if(c<grassClusterCount-1 && c%3===2) yield;
  }

  if(grasses){
    grasses.count=grassUsed;
    grasses.instanceMatrix.needsUpdate=true;
    if(grassUsed>0){
      stabilizeVegetationMesh(grasses);
      chunkRoot.add(grasses);
    }else{
      grasses.dispose();
      grasses=null;
    }
  }
  yield;

  let cheapTreeDensity=Math.max(0,detail.treeDensity);
  let cheapTreeMinDensity=vegetation.cheapTreeMinDensity ?? 0.5;
  let cheapTreeCount=cheapTreeDensity>=cheapTreeMinDensity
    ? Math.max(0,Math.floor((vegetation.cheapTreeCount || 0)*cheapTreeDensity))
    : 0;
  let cheapTreeTrunks=cheapTreeCount>0 ? new THREE.InstancedMesh(trunkGeo,barkMat,cheapTreeCount) : null;
  let cheapTreeCrowns=cheapTreeCount>0
    ? cheapTreeCrownMats.map(material=>new THREE.InstancedMesh(crownGeo,material,cheapTreeCount))
    : [];
  let cheapTrees=cheapTreeCount>0 ? new THREE.Group() : null;
  let cheapTreeUsed=0;
  let cheapTreeCrownUsed=new Array(cheapTreeCrowns.length).fill(0);
  let cheapTreeMinHeight=vegetation.cheapTreeMinHeight ?? grassMinHeight;
  let cheapTreeMaxHeight=vegetation.cheapTreeMaxHeight ?? grassMaxHeight;
  let cheapTreeMaxSlope=vegetation.cheapTreeMaxSlope ?? 0.2;
  let cheapTreeSlopeSampleDistance=vegetation.cheapTreeSlopeSampleDistance ?? 28;
  let cheapTreeRoadClearance=vegetation.cheapTreeRoadClearance ?? 62;
  let cheapTreePatchRadius=vegetation.cheapTreePatchRadius ?? 13;
  let cheapTreePatchMaxRange=vegetation.cheapTreePatchMaxRange ?? 6.5;
  let cheapTreeAttempts=Math.max(cheapTreeCount,Math.floor((vegetation.cheapTreeAttempts || cheapTreeCount*12)));

  for(let attempt=0;attempt<cheapTreeAttempts && cheapTreeUsed<cheapTreeCount;attempt++){
    let wx=cx*chunkSize+(rand(cx*617+attempt*23,cz*293-attempt*17)-0.5)*chunkSize;
    let wz=cz*chunkSize+(rand(cx*149-attempt*19,cz*881+attempt*31)-0.5)*chunkSize;
    let wy=groundHeight(wx,wz);

    if(wy<cheapTreeMinHeight || wy>cheapTreeMaxHeight) continue;
    if(terrainSlopeAt(wx,wz,cheapTreeSlopeSampleDistance)>cheapTreeMaxSlope) continue;
    if(roadDistance(wx,wz)<cheapTreeRoadClearance) continue;
    if(pointInHole(holes,wx,wz,cheapTreePatchRadius+6)) continue;
    if(!terrainPatchOk(wx,wz,cheapTreePatchRadius,36,cheapTreePatchMaxRange)) continue;

    let scale=(vegetation.cheapTreeScaleBase ?? 1)*(0.72+rand(attempt*41+cx,cz-attempt*13)*0.62);
    let heightScale=(vegetation.cheapTreeHeightScale ?? 2.6)*scale;
    let widthScale=(vegetation.cheapTreeWidthScale ?? 1.35)*scale;
    let crownScale=(vegetation.cheapTreeCrownScale ?? 3.1)*scale;
    let yaw=rand(cx*199+attempt,cz*307-attempt)*Math.PI*2;
    let leanX=(rand(cx*13+attempt,cz*19)-0.5)*(vegetation.cheapTreeLean ?? 0.08);
    let leanZ=(rand(cx*23-attempt,cz*29)-0.5)*(vegetation.cheapTreeLean ?? 0.08);

    let collider={
      x:wx,
      baseY:wy,
      y:wy+heightScale*5.25,
      z:wz,
      r:Math.max(2.8,widthScale*2.4),
      height:heightScale*10.5+crownScale*5.6,
      visualRadius:crownScale*2.6,
      visualHeight:heightScale*10.5+crownScale*5.2,
      type:"cheapTree",
      instances:[]
    };
    colliders.push(collider);

    dummy.position.set(wx,wy+5.25*heightScale-0.42,wz);
    dummy.rotation.set(leanX,yaw,leanZ);
    dummy.scale.set(widthScale,heightScale,widthScale);
    dummy.updateMatrix();
    cheapTreeTrunks.setMatrixAt(cheapTreeUsed,dummy.matrix);
    collider.instances.push({mesh:cheapTreeTrunks,index:cheapTreeUsed});

    dummy.position.set(
      wx+Math.sin(yaw)*0.85*scale,
      wy+10.5*heightScale+crownScale*1.35,
      wz+Math.cos(yaw)*0.85*scale
    );
    dummy.rotation.set(rand(attempt,cx)*Math.PI,yaw,rand(cz,attempt)*Math.PI);
    let crownWidthSeed=rand(cx*421+attempt,cz*163-attempt);
    let crownDepthSeed=rand(cx*239-attempt,cz*419+attempt);
    let crownFlatnessSeed=rand(cx*617-attempt,cz*271+attempt);
    crownWidthSeed=crownWidthSeed-Math.floor(crownWidthSeed);
    crownDepthSeed=crownDepthSeed-Math.floor(crownDepthSeed);
    crownFlatnessSeed=crownFlatnessSeed-Math.floor(crownFlatnessSeed);
    let crownWidthJitter=0.92+crownWidthSeed*0.28;
    let crownDepthJitter=0.9+crownDepthSeed*0.34;
    let crownFlatness=0.58+crownFlatnessSeed*0.28;
    dummy.scale.set(crownScale*1.08*crownWidthJitter,crownScale*crownFlatness,crownScale*crownDepthJitter);
    dummy.updateMatrix();
    let crownVariantSeed=rand(cx*331+attempt,cz*557-attempt);
    crownVariantSeed=crownVariantSeed-Math.floor(crownVariantSeed);
    let crownVariantIndex=Math.min(cheapTreeCrowns.length-1,Math.floor(crownVariantSeed*cheapTreeCrowns.length));
    let crownMesh=cheapTreeCrowns[crownVariantIndex];
    let crownIndex=cheapTreeCrownUsed[crownVariantIndex];
    crownMesh.setMatrixAt(crownIndex,dummy.matrix);
    cheapTreeCrownUsed[crownVariantIndex]=crownIndex+1;
    collider.instances.push({mesh:crownMesh,index:crownIndex});

    cheapTreeUsed++;
  }

  if(cheapTrees){
    cheapTreeTrunks.count=cheapTreeUsed;
    cheapTreeTrunks.instanceMatrix.needsUpdate=true;
    if(cheapTreeUsed>0){
      stabilizeVegetationMesh(cheapTreeTrunks);
      cheapTrees.add(cheapTreeTrunks);
      for(let i=0;i<cheapTreeCrowns.length;i++){
        let crownMesh=cheapTreeCrowns[i];
        crownMesh.count=cheapTreeCrownUsed[i];
        crownMesh.instanceMatrix.needsUpdate=true;
        if(crownMesh.count>0){
          stabilizeVegetationMesh(crownMesh);
          cheapTrees.add(crownMesh);
        }else{
          crownMesh.dispose();
        }
      }
      freezeStaticObject(cheapTrees);
      chunkRoot.add(cheapTrees);
    }else{
      cheapTreeTrunks.dispose();
      for(let crownMesh of cheapTreeCrowns) crownMesh.dispose();
      cheapTrees=null;
    }
  }
  yield;

  let bushClusterCount=Math.max(0,Math.ceil((vegetation.bushClusters || 0)*detail.grassDensity));
  let bushesPerCluster=Math.max(1,Math.ceil((vegetation.bushesPerCluster || 1)*detail.grassDensity));
  let bushClusterRadius=(vegetation.bushClusterRadius || 18)*0.74;
  let bushMinHeight=vegetation.bushMinHeight ?? grassMinHeight;
  let bushMaxHeight=vegetation.bushMaxHeight ?? grassMaxHeight;
  let bushMaxSlope=vegetation.bushMaxSlope ?? grassMaxSlope;
  let bushSlopeSampleDistance=vegetation.bushSlopeSampleDistance ?? grassSlopeSampleDistance;
  let maxBushes=Math.max(1,bushClusterCount*bushesPerCluster);
  let bushBaseColor=new THREE.Color(mixHexColor(envColors.leaf,envColors.grass,0.28));
  let bushAccentColor=new THREE.Color(envColors.bushAccent || envColors.pod || envColors.shore || envColors.grass);
  let bushDarkColor=new THREE.Color(envColors.bushDark || envColors.low || envColors.leaf);
  let bushGlowColor=new THREE.Color(envColors.bushEmissive || mixHexColor(envColors.leafEmissive || envColors.leaf,envColors.grassEmissive || envColors.grass,0.36));
  let bushGroup=null;
  let bushVariants=[
    {color:bushBaseColor.clone(),emissive:bushGlowColor.clone(),intensity:1},
    {color:bushBaseColor.clone().lerp(bushAccentColor,0.38).multiplyScalar(1.12),emissive:bushGlowColor.clone().lerp(bushAccentColor,0.28),intensity:1.08},
    {color:bushBaseColor.clone().lerp(bushDarkColor,0.42).multiplyScalar(0.86),emissive:bushGlowColor.clone().lerp(bushDarkColor,0.32),intensity:0.86},
    {color:bushBaseColor.clone().lerp(new THREE.Color(envColors.shore || envColors.grass),0.24).multiplyScalar(1.04),emissive:bushGlowColor.clone().lerp(new THREE.Color(envColors.shore || envColors.grass),0.22),intensity:0.96}
  ];
  let bushMeshes=[];
  if(bushClusterCount>0){
    bushGroup=new THREE.Group();
    bushMeshes=bushVariants.map(variant=>{
      let material=bushMat.clone();
      material.vertexColors=false;
      material.color.copy(variant.color);
      material.emissive.copy(variant.emissive);
      material.emissiveIntensity=(envColors.bushEmissiveIntensity ?? 0.18)*variant.intensity;
      let mesh=new THREE.InstancedMesh(bushGeo,material,maxBushes);
      mesh.count=0;
      bushGroup.add(mesh);
      return mesh;
    });
  }
  let bushUsedByVariant=new Array(bushMeshes.length).fill(0);

  for(let c=0;c<bushClusterCount && bushGroup;c++){
    let crx=rand(cx*523+c,cz*167-c);
    let crz=rand(cx*278-c,cz*613+c);

    let centerX=cx*chunkSize+(crx-.5)*chunkSize;
    let centerZ=cz*chunkSize+(crz-.5)*chunkSize;
    let centerY=groundHeight(centerX,centerZ);

    if(centerY<bushMinHeight || centerY>bushMaxHeight) continue;
    if(terrainSlopeAt(centerX,centerZ,bushSlopeSampleDistance)>bushMaxSlope) continue;
    if(roadDistance(centerX,centerZ)<42) continue;

    for(let i=0;i<bushesPerCluster;i++){
      let a=rand(cx*821+c*17+i,cz*386-i)*Math.PI*2;
      let r=Math.pow(rand(cx*419+i,cz*758+c),0.62)*bushClusterRadius;

      let wx=centerX+Math.cos(a)*r;
      let wz=centerZ+Math.sin(a)*r;
      let wy=groundHeight(wx,wz);

      if(wy<bushMinHeight || wy>bushMaxHeight) continue;
      if(terrainSlopeAt(wx,wz,bushSlopeSampleDistance)>bushMaxSlope) continue;
      if(roadDistance(wx,wz)<42) continue;
      if(pointInHole(holes,wx,wz,3.2)) continue;

      let scale=vegetation.bushScaleBase ?? 1;
      scale*=0.74+rand(i*11+cx,c*7-cz)*0.82;
      dummy.position.set(wx,wy+0.42*scale,wz);
      dummy.rotation.set(0,rand(i*13,cx-cz)*Math.PI*2,0);
      dummy.scale.set(scale*(1.25+rand(i,c)*0.55),scale*(0.38+rand(i*3,cx)*0.24),scale*(1.05+rand(c*5,i)*0.52));
      dummy.updateMatrix();

      let variantSeed=rand(i*97+cx*11,c*43-cz*17);
      variantSeed=variantSeed-Math.floor(variantSeed);
      let variantIndex=Math.min(bushMeshes.length-1,Math.floor(variantSeed*bushMeshes.length));
      let variantMesh=bushMeshes[variantIndex];
      let variantUsed=bushUsedByVariant[variantIndex];
      variantMesh.setMatrixAt(variantUsed,dummy.matrix);
      bushUsedByVariant[variantIndex]=variantUsed+1;
    }

    if(c<bushClusterCount-1 && c%3===2) yield;
  }

  if(bushGroup){
    for(let i=0;i<bushMeshes.length;i++){
      let mesh=bushMeshes[i];
      mesh.count=bushUsedByVariant[i];
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.count>0){
        stabilizeVegetationMesh(mesh);
      }else{
        bushGroup.remove(mesh);
        if(mesh.material) mesh.material.dispose();
        mesh.dispose();
      }
    }
    if(bushGroup.children.length>0){
      freezeStaticObject(bushGroup);
      chunkRoot.add(bushGroup);
    }else{
      bushGroup=null;
    }
  }
  yield;

  let rockCount=Math.max(1,Math.floor((cityMode ? 6 : 30)*Math.max(0.18,featureDensity)));
  let rocks=new THREE.InstancedMesh(rockGeo,rockMat,rockCount);
  let rockShadows=new THREE.InstancedMesh(buildingShadowGeo,rockShadowMat,rockCount);
  rockShadows.renderOrder=1;
  let rockUsed=0;
  let rockCollidersByInstance=[];

  for(let i=0;i<rockCount;i++){
    let rx=rand(cx*222+i,cz*888-i);
    let rz=rand(cx*444-i,cz*666+i);

    let wx=cx*chunkSize+(rx-.5)*chunkSize;
    let wz=cz*chunkSize+(rz-.5)*chunkSize;
    let wy=groundHeight(wx,wz);
    let scale=.8+rand(i+9,cx-cz)*3;
    if(wy>=rockSettings.highAltitudeStart){
      let altitudeT=waterSmoothstep01((wy-rockSettings.highAltitudeStart)/Math.max(1,rockSettings.highAltitudeFull-rockSettings.highAltitudeStart));
      let highAltitudeCap=rockSettings.highAltitudeMaxScale+(rockSettings.veryHighMaxScale-rockSettings.highAltitudeMaxScale)*altitudeT;
      scale=Math.min(scale,highAltitudeCap);
    }

    if(wy<-18) continue;
    if(roadDistance(wx,wz)<40) continue;
    if(pointInHole(holes,wx,wz,Math.max(7.5,scale*2.4))) continue;

    let rockBottomY=wy-scale*0.68-0.45;
    let rockTopY=wy+scale*1.58+0.45;
    let rockCollider={
      x:wx,
      baseY:wy,
      bottomY:rockBottomY,
      topY:rockTopY,
      y:(rockBottomY+rockTopY)*0.5,
      z:wz,
      r:2.1+scale*0.55,
      height:Math.max(1.0,rockTopY-rockBottomY),
      visualRadius:Math.max(1.6,scale*1.24),
      visualHeight:Math.max(1.25,rockTopY-rockBottomY),
      type:scale<1.65 ? "smallRock" : "rock",
      instances:[{mesh:rocks,index:rockUsed}]
    };
    colliders.push(rockCollider);
    rockCollidersByInstance[rockUsed]=rockCollider;

    let shadowAngle=-0.72+rand(i*17+3,cx-cz)*0.18;
    let shadowDirX=Math.sin(shadowAngle);
    let shadowDirZ=Math.cos(shadowAngle);
    let shadowLength=scale*(2.58+rand(i*29,cx+cz)*0.48);
    let shadowWidth=scale*(1.28+rand(i*31,cx-cz)*0.24);
    let shadowOffset=scale*(0.82+rand(i*37,cz-cx)*0.22);
    dummy.position.set(wx+shadowDirX*shadowOffset,wy+0.12,wz+shadowDirZ*shadowOffset);
    dummy.rotation.set(-Math.PI*0.5,0,shadowAngle);
    dummy.scale.set(shadowWidth,shadowLength,1);
    dummy.updateMatrix();
    rockShadows.setMatrixAt(rockUsed,dummy.matrix);

    dummy.position.set(wx,wy+scale*.5,wz);
    dummy.rotation.set(
      rand(i,cx)*Math.PI,
      rand(i,cz)*Math.PI,
      rand(cx,cz+i)*Math.PI
    );
    dummy.scale.set(scale,scale*.55,scale*.8);
    dummy.updateMatrix();

    rocks.setMatrixAt(rockUsed,dummy.matrix);
    rockUsed++;
  }

  rocks.count=rockUsed;
  rockShadows.count=rockUsed;
  rocks.instanceMatrix.needsUpdate=true;
  rockShadows.instanceMatrix.needsUpdate=true;
  if(rocks.computeBoundingSphere) rocks.computeBoundingSphere();
  if(rocks.computeBoundingBox) rocks.computeBoundingBox();
  if(rockShadows.computeBoundingSphere) rockShadows.computeBoundingSphere();
  freezeStaticObject(rocks);
  freezeStaticObject(rockShadows);
  chunkRoot.add(rockShadows,rocks);
  yield;

  let gravelCount=Math.max(0,Math.floor((cityMode ? 55 : 120)*detail.grassDensity));
  let gravel=new THREE.InstancedMesh(gravelGeo,gravelMat,gravelCount);
  let gravelUsed=0;
  let gravelCollidersByInstance=[];

  for(let i=0;i<gravelCount;i++){
    let rx=rand(cx*712+i*13,cz*991-i*5);
    let rz=rand(cx*407-i*7,cz*533+i*17);
    let wx=cx*chunkSize+(rx-.5)*chunkSize;
    let wz=cz*chunkSize+(rz-.5)*chunkSize;
    let wy=groundHeight(wx,wz);
    let roadDist=roadDistance(wx,wz);

    if(wy<waterLevel+1.2 || wy>38) continue;
    if(roadDist<28) continue;
    if(cityMode && roadDist<76) continue;
    if(pointInHole(holes,wx,wz,1.2)) continue;

    let scale=0.16+rand(i*5+11,cx-cz)*0.38;
    let flatness=0.035+rand(cx+i*3,cz-i*2)*0.055;

    dummy.position.set(wx,wy+0.035,wz);
    dummy.rotation.set(
      rand(i,cx+5)*0.24,
      rand(i*9,cz-3)*Math.PI*2,
      rand(cx-7,cz+i)*0.24
    );
    dummy.scale.set(scale*(0.9+rand(i+1,cx)*0.6),flatness,scale*(0.7+rand(i+2,cz)*0.8));
    dummy.updateMatrix();

    gravel.setMatrixAt(gravelUsed,dummy.matrix);
    if(scale>0.42 && rand(cx*1237+i*19,cz*1709-i*23)>0.42){
      let gravelBottomY=wy-0.08;
      let gravelTopY=wy+Math.max(0.22,flatness*2.6)+0.12;
      let gravelCollider={
        x:wx,
        baseY:wy,
        bottomY:gravelBottomY,
        topY:gravelTopY,
        y:(gravelBottomY+gravelTopY)*0.5,
        z:wz,
        r:Math.max(0.52,scale*0.94),
        height:Math.max(0.16,gravelTopY-gravelBottomY),
        visualRadius:Math.max(0.72,scale*1.28),
        visualHeight:Math.max(0.22,gravelTopY-gravelBottomY),
        type:"smallRock",
        gravelRock:true,
        instances:[{mesh:gravel,index:gravelUsed}]
      };
      colliders.push(gravelCollider);
      gravelCollidersByInstance[gravelUsed]=gravelCollider;
    }
    gravelUsed++;
  }

  gravel.count=gravelUsed;
  gravel.instanceMatrix.needsUpdate=true;
  if(gravel.computeBoundingSphere) gravel.computeBoundingSphere();
  if(gravel.computeBoundingBox) gravel.computeBoundingBox();
  freezeStaticObject(gravel);
  chunkRoot.add(gravel);
  yield;

  let settlements=environmentSettlements();
  let villageAttemptRoll=settlements.villagesPerChunk || 1;
  let villagesPerChunk=cityMode
    ? 1
    : buildChunkFeatures ? Math.max(1,Math.min(3,Math.floor(villageAttemptRoll)+(r01(cx*919+17,cz*613-23)<villageAttemptRoll%1 ? 1 : 0))) : 1;
  let villageSpawnChance=!buildChunkFeatures ? 0 : cityMode ? 1 : Math.max(0,Math.min(1,(settlements.villageSpawnChance ?? 0.45)*featureDensity));
  let maxBuildings=Math.max(1,Math.floor((cityMode ? 48 : 120*villagesPerChunk)*Math.max(0.08,featureDensity)));
  let maxWindowInstances=maxBuildings*(cityMode ? 84 : 8);
  let buildingShadows=new THREE.InstancedMesh(buildingShadowGeo,buildingShadowMat,maxBuildings);
  buildingShadows.renderOrder=1;
  let buildingBodies=new THREE.InstancedMesh(buildingGeo,buildingWallMat,maxBuildings);
  let maxRoofInstances=cityMode ? maxBuildings*2 : maxBuildings;
  let maxTrimInstances=maxBuildings*(cityMode ? 9 : 2);
  let maxChimneyInstances=maxBuildings*(cityMode ? 3 : 1);
  let buildingRoofs=new THREE.InstancedMesh(buildingRoofGeo,buildingRoofMat,maxRoofInstances);
  let buildingWindows=new THREE.InstancedMesh(windowGeo,windowMat,maxWindowInstances);
  let buildingDoors=new THREE.InstancedMesh(doorGeo,doorMat,maxBuildings);
  let buildingChimneys=new THREE.InstancedMesh(chimneyGeo,chimneyMat,maxChimneyInstances);
  let buildingTrims=new THREE.InstancedMesh(trimGeo,houseTrimMat,maxTrimInstances);
  let buildingPorches=new THREE.InstancedMesh(porchGeo,houseTrimMat,maxBuildings);
  let villageWalls=new THREE.InstancedMesh(brickWallGeo,brickWallMat,villagesPerChunk*18);
  let cityStreets=new THREE.InstancedMesh(cityStreetGeo,cityStreetMat,roadsEnabled && cityMode ? villagesPerChunk*8 : 1);
  let cityStreetDetails=new THREE.InstancedMesh(cityStreetGeo,cityDetailMat,roadsEnabled && cityMode ? villagesPerChunk*96 : 1);
  let cityTechDetails=new THREE.InstancedMesh(cityStreetGeo,cityGlowMat,cityMode ? maxBuildings*10+villagesPerChunk*24 : 1);
  let buildingShadowUsed=0;
  let buildingUsed=0;
  let windowUsed=0;
  let doorUsed=0;
  let chimneyUsed=0;
  let trimUsed=0;
  let porchUsed=0;
  let wallUsed=0;
  let streetUsed=0;
  let streetDetailUsed=0;
  let techDetailUsed=0;
  let villageCenters=[];

  for(let v=0;v<villagesPerChunk;v++){
    if(r01(cx*37+v*101,cz*53-v*17)>villageSpawnChance) continue;
    let rr1=r01(cx*701+v*13,cz*409-v*11);
    let rr2=r01(cx*157-v*19,cz*991+v*23);
    let centerX=cx*chunkSize+(rr1-.5)*chunkSize;
    let centerZ=cz*chunkSize+(rr2-.5)*chunkSize;
    let centerY=groundHeight(centerX,centerZ);
    let centerRoadD=roadDistance(centerX,centerZ);

    if(centerRoadD<(cityMode ? 12 : 24)) continue;

    let largeTown=cityMode || r01(cx*1291+v*43,cz*683-v*29)>0.78;
    let villageRadius=cityMode
      ? 86+r01(cx-v*3,cz+v*9)*34
      : 20+(r01(cx-v*3,cz+v*9)*24)+(largeTown ? 16+r01(cx*503-v*7,cz*211+v*5)*10 : 0);
    if(pointInHole(holes,centerX,centerZ,villageRadius+18)) continue;
    let patchRadiusScale=cityMode ? 1.08 : settlements.patchRadiusScale;
    let patchMaxRange=cityMode ? 7.5 : largeTown ? settlements.largeTownMaxRange : settlements.smallTownMaxRange;
    if(!terrainPatchOk(centerX,centerZ,villageRadius*patchRadiusScale,largeTown ? 25 : 23,patchMaxRange)) continue;

    let bossVillage=largeTown && r01(cx*1741+v*71,cz*927-v*37)>0.42;
    let enemyBudget=(cityMode ? 8 : 5)+Math.floor(r01(cx*811+v*31,cz*337-v*13)*(cityMode ? 10 : 7))+(bossVillage ? 5 : largeTown ? 2 : 0);
    let turretCount=getDifficulty()==="easy" ? 0 : bossVillage ? 3 : largeTown ? 1 : 0;
    let village={x:centerX,z:centerZ,y:centerY,r:villageRadius,buildings:[],turrets:[],enemyBudget,enemyRemaining:enemyBudget,bossVillage,bossSpawned:false,city:cityMode};
    villageCenters.push(village);
    let housesInVillage=cityMode
      ? 44
      : largeTown
      ? 26+Math.floor(r01(cx+v*7,cz-v*5)*12)
      : 12+Math.floor(r01(cx+v*7,cz-v*5)*10);
    let placed=[];

    if(cityMode && roadsEnabled){
      let cityYaw=roadYawAt(centerZ);
      let streetLength=villageRadius*2.25;
      let streetWidth=9.5;
      let streetSpacing=villageRadius*0.5;
      for(let axis=0;axis<2;axis++){
        let yaw=cityYaw+axis*Math.PI*0.5;
        let rightYaw=yaw+Math.PI*0.5;
        for(let offset of [-streetSpacing,0,streetSpacing]){
          if(streetUsed>=cityStreets.count) break;
          let wx=centerX+Math.sin(rightYaw)*offset;
          let wz=centerZ+Math.cos(rightYaw)*offset;
          let wy=groundHeight(wx,wz);
          dummy.position.set(wx,wy+0.05,wz);
          dummy.rotation.set(0,yaw,0);
          dummy.scale.set(streetLength,0.08,streetWidth);
          dummy.updateMatrix();
          cityStreets.setMatrixAt(streetUsed,dummy.matrix);
          streetUsed++;
        }
      }

      for(let axis=0;axis<2;axis++){
        let yaw=cityYaw+axis*Math.PI*0.5;
        let rightYaw=yaw+Math.PI*0.5;
        let dirX=Math.sin(yaw);
        let dirZ=Math.cos(yaw);
        for(let offset of [-streetSpacing,0,streetSpacing]){
          let baseX=centerX+Math.sin(rightYaw)*offset;
          let baseZ=centerZ+Math.cos(rightYaw)*offset;
          for(let stripe=-2;stripe<=2 && streetDetailUsed<cityStreetDetails.count;stripe++){
            let along=stripe*streetLength*0.18;
            let wx=baseX+dirX*along;
            let wz=baseZ+dirZ*along;
            let wy=groundHeight(wx,wz);
            dummy.position.set(wx,wy+0.12,wz);
            dummy.rotation.set(0,yaw,0);
            dummy.scale.set(streetLength*0.055,0.1,0.42);
            dummy.updateMatrix();
            cityStreetDetails.setMatrixAt(streetDetailUsed,dummy.matrix);
            streetDetailUsed++;
          }

          for(let crossing of [-streetSpacing,0,streetSpacing]){
            if(streetDetailUsed>=cityStreetDetails.count) break;
            let wx=baseX+dirX*crossing;
            let wz=baseZ+dirZ*crossing;
            let wy=groundHeight(wx,wz);
            dummy.position.set(wx,wy+0.13,wz);
            dummy.rotation.set(0,yaw,0);
            dummy.scale.set(1.25,0.1,streetWidth*1.42);
            dummy.updateMatrix();
            cityStreetDetails.setMatrixAt(streetDetailUsed,dummy.matrix);
            streetDetailUsed++;

            if(techDetailUsed<cityTechDetails.count){
              dummy.position.set(wx,wy+0.18,wz);
              dummy.rotation.set(0,yaw+Math.PI*0.5,0);
              dummy.scale.set(0.55,0.12,streetWidth*0.72);
              dummy.updateMatrix();
              cityTechDetails.setMatrixAt(techDetailUsed,dummy.matrix);
              techDetailUsed++;
            }
          }
        }
      }

      for(let ix of [-streetSpacing,0,streetSpacing]){
        for(let iz of [-streetSpacing,0,streetSpacing]){
          if(streetDetailUsed>=cityStreetDetails.count) break;
          let rightX=Math.cos(cityYaw);
          let rightZ=-Math.sin(cityYaw);
          let forwardX=Math.sin(cityYaw);
          let forwardZ=Math.cos(cityYaw);
          let wx=centerX+rightX*ix+forwardX*iz;
          let wz=centerZ+rightZ*ix+forwardZ*iz;
          let wy=groundHeight(wx,wz);
          dummy.position.set(wx,wy+0.115,wz);
          dummy.rotation.set(0,cityYaw+Math.PI*0.25,0);
          dummy.scale.set(8.5,0.08,8.5);
          dummy.updateMatrix();
          cityStreetDetails.setMatrixAt(streetDetailUsed,dummy.matrix);
          streetDetailUsed++;

          for(let beacon=0;beacon<2 && techDetailUsed<cityTechDetails.count;beacon++){
            let side=beacon===0 ? -1 : 1;
            dummy.position.set(wx+rightX*side*5.2,wy+1.1,wz+rightZ*side*5.2);
            dummy.rotation.set(0,cityYaw,0);
            dummy.scale.set(0.42,2.1,0.42);
            dummy.updateMatrix();
            cityTechDetails.setMatrixAt(techDetailUsed,dummy.matrix);
            techDetailUsed++;
          }
        }
      }
    }else{
      let gateAngle=r01(cx*2131+v*17,cz*1723-v*31)*Math.PI*2;
      let wallSegments=14;
      for(let s=0;s<wallSegments && wallUsed<villagesPerChunk*18;s++){
        let t=s/wallSegments;
        let a=t*Math.PI*2;
        let diff=Math.abs(Math.atan2(Math.sin(a-gateAngle),Math.cos(a-gateAngle)));
        if(diff<0.32) continue;

        let radius=villageRadius*1.22;
        let wx=centerX+Math.cos(a)*radius;
        let wz=centerZ+Math.sin(a)*radius;
        let wy=groundHeight(wx,wz);
        let segLen=Math.max(3.2,(Math.PI*2*radius)/wallSegments*0.9);

        dummy.position.set(wx,wy+1.1,wz);
        dummy.rotation.set(0,a+Math.PI*0.5,0);
        dummy.scale.set(segLen,2.2,0.55);
        dummy.updateMatrix();
        villageWalls.setMatrixAt(wallUsed,dummy.matrix);
        wallUsed++;

        colliders.push({
          x:wx,
          z:wz,
          r:Math.max(1.2,segLen*0.32),
          baseY:wy,
          bottomY:wy,
          topY:wy+2.9,
          height:2.9,
          visualHeight:2.9,
          type:"wall",
          instances:[{mesh:villageWalls,index:wallUsed-1}]
        });
      }
    }

    for(let t=0;t<turretCount;t++){
      let angle=(t/turretCount)*Math.PI*2+r01(cx*3001+t*17,cz*2077-t*19)*0.9;
      let tx=centerX+Math.cos(angle)*villageRadius*0.82;
      let tz=centerZ+Math.sin(angle)*villageRadius*0.82;
      let ty=groundHeight(tx,tz);
      if(ty<waterLevel+0.3 || roadDistance(tx,tz)<20) continue;

      let turret=makeTurret(tx,ty,tz,Math.atan2(centerX-tx,centerZ-tz));
      chunkRoot.add(turret);
      let collider={x:tx,z:tz,r:3.2,type:"turret",village,object:turret};
      village.turrets.push(collider);
      colliders.push(collider);
    }

    for(let i=0;i<housesInVillage && buildingUsed<maxBuildings;i++){
      if(i>0 && i%12===0) yield;

      let angle=(i/housesInVillage)*Math.PI*2 + r01(i+v*31,cx-cz)*0.9;
      let dist=(0.2+r01(i+cx*3,cz+v)*0.8)*villageRadius;
      let wx=centerX+Math.cos(angle)*dist;
      let wz=centerZ+Math.sin(angle)*dist;
      let cityLocalX=0;
      let cityLocalZ=0;
      if(cityMode){
        let cols=Math.ceil(Math.sqrt(housesInVillage));
        let row=Math.floor(i/cols);
        let col=i%cols;
        let cityYaw=roadYawAt(centerZ);
        let rightX=Math.cos(cityYaw);
        let rightZ=-Math.sin(cityYaw);
        let forwardX=Math.sin(cityYaw);
        let forwardZ=Math.cos(cityYaw);
        let spacing=24+r01(cx*17+i,cz*23-v)*8;
        cityLocalX=(col-(cols-1)*0.5)*spacing+(r01(i*11+cx,cz)-0.5)*4;
        cityLocalZ=(row-(cols-1)*0.5)*spacing+(r01(i*13+cz,cx)-0.5)*4;
        if(roadsEnabled){
          let streetSpacing=villageRadius*0.5;
          let streetClearance=10.5;
          let nearStreetX=Math.min(Math.abs(cityLocalX),Math.abs(cityLocalX-streetSpacing),Math.abs(cityLocalX+streetSpacing));
          let nearStreetZ=Math.min(Math.abs(cityLocalZ),Math.abs(cityLocalZ-streetSpacing),Math.abs(cityLocalZ+streetSpacing));
          if(nearStreetX<streetClearance || nearStreetZ<streetClearance) continue;
        }
        wx=centerX+rightX*cityLocalX+forwardX*cityLocalZ;
        wz=centerZ+rightZ*cityLocalX+forwardZ*cityLocalZ;
      }
      let wy=groundHeight(wx,wz);
      let roadD=roadDistance(wx,wz);

      if(roadD<(cityMode ? 10 : 20)) continue;

      let width=cityMode ? 9+r01(i+cx*5,cz+v*2)*8 : 8+r01(i+cx*5,cz+v*2)*8;
      let depth=cityMode ? 9+r01(i+cz*6,cx-v*2)*8 : 8+r01(i+cz*6,cx-v*2)*8;
      let height=cityMode
        ? 22+r01(cx-i,cz+i+v*17)*54+(i%7===0 ? 18+r01(cx+i*3,cz-v*5)*28 : 0)
        : 4.8+r01(cx-i,cz+i+v*17)*5.6;
      let minGap=Math.max(width,depth)*(cityMode ? 1.48 : largeTown ? 1.05 : 1.35);
      if(!terrainPatchOk(wx,wz,Math.max(width,depth)*0.62,cityMode ? 70 : 24,cityMode ? 5.8 : 4.5)) continue;

      let tooClose=false;
      for(let p of placed){
        let dx=wx-p.x;
        let dz=wz-p.z;
        let gap=minGap+p.r;
        if(dx*dx+dz*dz<gap*gap){
          tooClose=true;
          break;
        }
      }
      if(tooClose) continue;

      let roofHeight=cityMode ? 0.42+r01(i+99+v,cx+cz)*0.36 : 1.4+r01(i+99+v,cx+cz)*1.3;
      let buildingVisualHeight=height+roofHeight+Math.min(24,cityMode ? height*0.28 : roofHeight*0.7);
      let buildingCollider={
        x:wx,
        baseY:wy,
        y:wy+buildingVisualHeight*0.5,
        z:wz,
        r:Math.max(width,depth)*0.78,
        height:buildingVisualHeight,
        visualRadius:Math.max(width,depth)*0.72,
        visualHeight:buildingVisualHeight,
        type:"building",
        cityBuilding:cityMode,
        instances:[],
        village
      };
      let buildingIndex=buildingUsed;
      let windowStart=windowUsed;
      let doorStart=doorUsed;
      let chimneyStart=chimneyUsed;
      let trimStart=trimUsed;
      let porchStart=porchUsed;
      let techStart=techDetailUsed;

      let yaw=cityMode
        ? roadYawAt(centerZ)+(r01(i+v*13,cx-cz)>0.5 ? Math.PI*0.5 : 0)
        : r01(i+v*13,cx-cz)*Math.PI*2;
      let fwdX=Math.sin(yaw),fwdZ=Math.cos(yaw);
      let rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);
      let crownOffset=cityMode ? (r01(i*31+cz,cx+v)-0.5)*Math.min(width,depth)*0.18 : 0;
      dummy.position.set(wx,wy+height*0.5,wz);
      dummy.rotation.set(0,yaw,0);
      dummy.scale.set(
        width*(cityMode ? 0.86+r01(i+cx*2,cz-v)*0.28 : 1),
        height,
        depth*(cityMode ? 0.86+r01(i+cz*2,cx+v)*0.28 : 1)
      );
      dummy.updateMatrix();
      buildingBodies.setMatrixAt(buildingUsed,dummy.matrix);
      buildingCollider.instances.push({mesh:buildingBodies,index:buildingIndex});

      if(buildingShadowUsed<maxBuildings){
        let shadowAngle=-0.72;
        let shadowDirX=Math.sin(shadowAngle);
        let shadowDirZ=Math.cos(shadowAngle);
        let tallShadow=Math.max(0,height-(cityMode ? 18 : 8));
        let shadowLength=depth*1.18+Math.min(cityMode ? 112 : 48,height*(cityMode ? 0.5 : 0.34)+tallShadow*(cityMode ? 0.34 : 0.16));
        let shadowWidth=width*1.18+Math.min(cityMode ? 20 : 10,height*0.08);
        let shadowOffset=Math.min(cityMode ? 52 : 22,height*(cityMode ? 0.22 : 0.13)+tallShadow*(cityMode ? 0.12 : 0.05));
        dummy.position.set(wx+shadowDirX*shadowOffset,wy+0.16,wz+shadowDirZ*shadowOffset);
        dummy.rotation.set(-Math.PI*0.5,0,shadowAngle);
        dummy.scale.set(shadowWidth,shadowLength,1);
        dummy.updateMatrix();
        buildingShadows.setMatrixAt(buildingShadowUsed,dummy.matrix);
        buildingShadowUsed++;
      }

      let roofScale=Math.max(width,depth)*(cityMode ? 0.82 : 0.72);
      dummy.position.set(wx+rightX*crownOffset,wy+height+roofHeight*0.5,wz+rightZ*crownOffset);
      dummy.rotation.set(0,yaw+Math.PI*0.25,0);
      dummy.scale.set(
        roofScale*(cityMode ? 0.55+r01(i+71,cx-cz)*0.32 : 1),
        roofHeight,
        roofScale*(cityMode ? 0.55+r01(i+73,cz-cx)*0.32 : 1)
      );
      dummy.updateMatrix();
      buildingRoofs.setMatrixAt(buildingUsed,dummy.matrix);
      buildingCollider.instances.push({mesh:buildingRoofs,index:buildingIndex});

      // Details: front door, four windows, and a roof chimney.
      let frontX=wx+fwdX*(depth*0.5+0.02);
      let frontZ=wz+fwdZ*(depth*0.5+0.02);

      if(doorUsed<maxBuildings){
        dummy.position.set(frontX,wy+1.45,frontZ);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(Math.max(1.0,width*0.14),2.8,0.35);
        dummy.updateMatrix();
        buildingDoors.setMatrixAt(doorUsed,dummy.matrix);
        doorUsed++;
      }

      if(!cityMode && porchUsed<maxBuildings){
        dummy.position.set(frontX,wy+0.25,frontZ);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(Math.max(1.8,width*0.3),0.45,1.1);
        dummy.updateMatrix();
        buildingPorches.setMatrixAt(porchUsed,dummy.matrix);
        porchUsed++;
      }

      if(trimUsed<maxTrimInstances){
        dummy.position.set(wx,wy+height+0.05,wz);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(width*1.02,cityMode ? 0.38 : 0.24,depth*1.02);
        dummy.updateMatrix();
        buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
        trimUsed++;
      }
      if(trimUsed<maxTrimInstances){
        dummy.position.set(wx,wy+0.35,wz);
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(width*1.03,cityMode ? 0.34 : 0.24,depth*1.03);
        dummy.updateMatrix();
        buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
        trimUsed++;
      }
      if(cityMode){
        for(let fin=0;fin<2 && trimUsed<maxTrimInstances;fin++){
          let side=fin===0 ? -1 : 1;
          dummy.position.set(
            wx+rightX*side*(width*0.52)+fwdX*(depth*0.08),
            wy+height*(0.48+r01(i+fin*17,cx-cz)*0.18),
            wz+rightZ*side*(width*0.52)+fwdZ*(depth*0.08)
          );
          dummy.rotation.set(0,yaw,side*0.08);
          dummy.scale.set(0.38,height*(0.38+r01(i+fin*23,cz)*0.18),Math.max(1.8,depth*0.16));
          dummy.updateMatrix();
          buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
          trimUsed++;
        }
        if(trimUsed<maxTrimInstances){
          dummy.position.set(wx+rightX*crownOffset,wy+height+roofHeight+Math.min(12,height*0.14),wz+rightZ*crownOffset);
          dummy.rotation.set(0,yaw,0);
          dummy.scale.set(0.42,Math.min(24,height*0.28),0.42);
          dummy.updateMatrix();
          buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
          trimUsed++;
        }
        for(let ledge=0;ledge<2 && trimUsed<maxTrimInstances;ledge++){
          let side=ledge===0 ? -1 : 1;
          dummy.position.set(
            wx+fwdX*side*(depth*0.51),
            wy+height*(0.34+r01(i+ledge*41,cz+v)*0.36),
            wz+fwdZ*side*(depth*0.51)
          );
          dummy.rotation.set(0,yaw+Math.PI*0.5,0);
          dummy.scale.set(depth*0.18,0.32,width*0.92);
          dummy.updateMatrix();
          buildingTrims.setMatrixAt(trimUsed,dummy.matrix);
          trimUsed++;
        }

        for(let corner=0;corner<4 && techDetailUsed<cityTechDetails.count;corner++){
          let sideX=corner<2 ? -1 : 1;
          let sideZ=corner%2===0 ? -1 : 1;
          dummy.position.set(
            wx+rightX*sideX*(width*0.48)+fwdX*sideZ*(depth*0.5+0.08),
            wy+height*0.52,
            wz+rightZ*sideX*(width*0.48)+fwdZ*sideZ*(depth*0.5+0.08)
          );
          dummy.rotation.set(0,yaw,0);
          dummy.scale.set(0.22,height*0.7,0.2);
          dummy.updateMatrix();
          cityTechDetails.setMatrixAt(techDetailUsed,dummy.matrix);
          techDetailUsed++;
        }

        let techBandCount=Math.min(3,Math.max(1,Math.floor(height/28)));
        for(let band=0;band<techBandCount && techDetailUsed<cityTechDetails.count;band++){
          let lift=wy+height*(0.28+(band+0.5)*(0.54/techBandCount));
          dummy.position.set(frontX+fwdX*0.08,lift,frontZ+fwdZ*0.08);
          dummy.rotation.set(0,yaw,0);
          dummy.scale.set(width*0.72,0.16,0.18);
          dummy.updateMatrix();
          cityTechDetails.setMatrixAt(techDetailUsed,dummy.matrix);
          techDetailUsed++;
        }
      }

      if(cityMode){
        let rows=Math.min(11,Math.max(4,Math.floor(height/6)));
        let columns=Math.min(5,Math.max(2,Math.floor(width/4.4)));
        for(let row=0;row<rows && windowUsed<maxWindowInstances;row++){
          let lift=wy+height*(0.16+(row+0.5)*(0.74/rows));
          for(let col=0;col<columns && windowUsed<maxWindowInstances;col++){
            let lateral=(col-(columns-1)*0.5)*(width/(columns+0.9));
            dummy.position.set(frontX+rightX*lateral,lift,frontZ+rightZ*lateral);
            dummy.rotation.set(0,yaw,0);
            dummy.scale.set(Math.max(0.7,width*0.1),0.85,0.16);
            dummy.updateMatrix();
            buildingWindows.setMatrixAt(windowUsed,dummy.matrix);
            windowUsed++;
          }
        }

        for(let sideSign of [-1,1]){
          let sideX=wx+rightX*(width*0.5+0.05)*sideSign;
          let sideZ=wz+rightZ*(width*0.5+0.05)*sideSign;
          let sideRows=Math.min(rows,10);
          for(let row=0;row<sideRows && windowUsed<maxWindowInstances;row++){
            let along=((row%4)-1.5)*depth*0.14;
            dummy.position.set(
              sideX+fwdX*along,
              wy+height*(0.18+(row+0.5)*(0.7/sideRows)),
              sideZ+fwdZ*along
            );
            dummy.rotation.set(0,yaw+Math.PI*0.5,0);
            dummy.scale.set(Math.max(0.65,depth*0.09),0.78,0.16);
            dummy.updateMatrix();
            buildingWindows.setMatrixAt(windowUsed,dummy.matrix);
            windowUsed++;
          }
        }
      }else{
        for(let w=0;w<6 && windowUsed<maxWindowInstances;w++){
          let side=(w%2===0?-1:1);
          let row=(w<2?0:(w<4?1:2));
          let lift=height*(0.46+row*0.2);
          let lateral=(width*0.22)*side;
          dummy.position.set(
            frontX+rightX*lateral,
            wy+lift,
            frontZ+rightZ*lateral
          );
          dummy.rotation.set(0,yaw,0);
          dummy.scale.set(Math.max(0.9,width*0.13),1.1,0.2);
          dummy.updateMatrix();
          buildingWindows.setMatrixAt(windowUsed,dummy.matrix);
          windowUsed++;
        }

        // Side windows (two per side) to avoid flat facades.
        for(let sideSign of [-1,1]){
          for(let row=0;row<2 && windowUsed<maxWindowInstances;row++){
            let sideX=wx+rightX*(width*0.5+0.05)*sideSign;
            let sideZ=wz+rightZ*(width*0.5+0.05)*sideSign;
            let along=(row===0?-depth*0.18:depth*0.18);
            dummy.position.set(
              sideX+fwdX*along,
              wy+height*(0.52+row*0.18),
              sideZ+fwdZ*along
            );
            dummy.rotation.set(0,yaw+Math.PI*0.5,0);
            dummy.scale.set(Math.max(0.85,depth*0.11),0.95,0.2);
            dummy.updateMatrix();
            buildingWindows.setMatrixAt(windowUsed,dummy.matrix);
            windowUsed++;
          }
        }
      }

      if(cityMode){
        let rooftopCount=1+Math.floor(r01(cx+i*79,cz-v*37)*3);
        for(let roofItem=0;roofItem<rooftopCount && chimneyUsed<maxChimneyInstances;roofItem++){
          let localX=(r01(i*101+roofItem*17,cx-v)-0.5)*width*0.44;
          let localZ=(r01(i*131-roofItem*13,cz+v)-0.5)*depth*0.44;
          dummy.position.set(
            wx+rightX*localX+fwdX*localZ,
            wy+height+roofHeight+0.42+roofItem*0.05,
            wz+rightZ*localX+fwdZ*localZ
          );
          dummy.rotation.set(0,yaw+r01(i+roofItem*23,cx+cz)*Math.PI,0);
          dummy.scale.set(
            0.75+r01(i+roofItem*31,cz)*1.35,
            0.65+r01(i-roofItem*19,cx)*2.4,
            0.75+r01(i+roofItem*47,cx-cz)*1.35
          );
          dummy.updateMatrix();
          buildingChimneys.setMatrixAt(chimneyUsed,dummy.matrix);
          chimneyUsed++;
        }

        if(techDetailUsed<cityTechDetails.count){
          dummy.position.set(
            wx+rightX*crownOffset,
            wy+height+roofHeight+Math.min(16,height*0.22)+1.8,
            wz+rightZ*crownOffset
          );
          dummy.rotation.set(0,yaw,0);
          dummy.scale.set(0.28,Math.min(18,height*0.18),0.28);
          dummy.updateMatrix();
          cityTechDetails.setMatrixAt(techDetailUsed,dummy.matrix);
          techDetailUsed++;
        }
      }else if(chimneyUsed<maxChimneyInstances){
        dummy.position.set(
          wx+rightX*(width*0.22)-fwdX*(depth*0.15),
          wy+height+roofHeight*0.7,
          wz+rightZ*(width*0.22)-fwdZ*(depth*0.15)
        );
        dummy.rotation.set(0,yaw,0);
        dummy.scale.set(0.6,1.6,0.6);
        dummy.updateMatrix();
        buildingChimneys.setMatrixAt(chimneyUsed,dummy.matrix);
        chimneyUsed++;
      }

      for(let k=windowStart;k<windowUsed;k++) buildingCollider.instances.push({mesh:buildingWindows,index:k});
      for(let k=doorStart;k<doorUsed;k++) buildingCollider.instances.push({mesh:buildingDoors,index:k});
      for(let k=chimneyStart;k<chimneyUsed;k++) buildingCollider.instances.push({mesh:buildingChimneys,index:k});
      for(let k=trimStart;k<trimUsed;k++) buildingCollider.instances.push({mesh:buildingTrims,index:k});
      for(let k=porchStart;k<porchUsed;k++) buildingCollider.instances.push({mesh:buildingPorches,index:k});
      for(let k=techStart;k<techDetailUsed;k++) buildingCollider.instances.push({mesh:cityTechDetails,index:k});
      colliders.push(buildingCollider);
      village.buildings.push(buildingCollider);

      placed.push({x:wx,z:wz,r:minGap*0.5});

      buildingUsed++;
    }
  }

  buildingShadows.count=buildingShadowUsed;
  buildingBodies.count=buildingUsed;
  buildingRoofs.count=buildingUsed;
  buildingWindows.count=windowUsed;
  buildingDoors.count=doorUsed;
  buildingChimneys.count=chimneyUsed;
  buildingTrims.count=trimUsed;
  buildingPorches.count=porchUsed;
  villageWalls.count=wallUsed;
  cityStreets.count=streetUsed;
  cityStreetDetails.count=streetDetailUsed;
  cityTechDetails.count=techDetailUsed;
  buildingShadows.instanceMatrix.needsUpdate=true;
  buildingBodies.instanceMatrix.needsUpdate=true;
  buildingRoofs.instanceMatrix.needsUpdate=true;
  buildingWindows.instanceMatrix.needsUpdate=true;
  buildingDoors.instanceMatrix.needsUpdate=true;
  buildingChimneys.instanceMatrix.needsUpdate=true;
  buildingTrims.instanceMatrix.needsUpdate=true;
  buildingPorches.instanceMatrix.needsUpdate=true;
  villageWalls.instanceMatrix.needsUpdate=true;
  cityStreets.instanceMatrix.needsUpdate=true;
  cityStreetDetails.instanceMatrix.needsUpdate=true;
  cityTechDetails.instanceMatrix.needsUpdate=true;
  freezeStaticObject(buildingShadows);
  freezeStaticObject(buildingBodies);
  freezeStaticObject(buildingRoofs);
  freezeStaticObject(buildingWindows);
  freezeStaticObject(buildingDoors);
  freezeStaticObject(buildingChimneys);
  freezeStaticObject(buildingTrims);
  freezeStaticObject(buildingPorches);
  freezeStaticObject(villageWalls);
  freezeStaticObject(cityStreets);
  freezeStaticObject(cityStreetDetails);
  freezeStaticObject(cityTechDetails);
  chunkRoot.add(buildingShadows,buildingBodies,buildingRoofs,buildingWindows,buildingDoors,buildingChimneys,buildingTrims,buildingPorches,villageWalls,cityStreets,cityStreetDetails,cityTechDetails);
  yield;

  function colliderNear(x,z,radius){
    for(let collider of colliders){
      if(!collider || collider.destroyed) continue;
      let reach=radius+(collider.r || 0);
      let dx=x-collider.x;
      let dz=z-collider.z;
      if(dx*dx+dz*dz<reach*reach) return true;
    }
    return false;
  }

  let radarRoll=r01(cx*3181+29,cz*2417-53);
  let disableProceduralRadarOutposts=((currentEnvironment && currentEnvironment.name) || "").toLowerCase()==="ember badlands";
  let radarOutpostTarget=buildChunkFeatures && !disableProceduralRadarOutposts && radarRoll<(cityMode ? 0.03 : 0.07) ? 1 : 0;
  for(let i=0;i<radarOutpostTarget;i++){
    for(let attempt=0;attempt<16;attempt++){
      let rx=r01(cx*1973+i*131+attempt*17,cz*2657-i*61-attempt*23);
      let rz=r01(cx*2909-i*89-attempt*19,cz*1741+i*109+attempt*31);
      let wx=cx*chunkSize+(rx-0.5)*chunkSize;
      let wz=cz*chunkSize+(rz-0.5)*chunkSize;
      let wy=groundHeight(wx,wz);
      let radius=18;

      if(Math.hypot(wx,wz)<260) continue;
      if(wy<waterLevel+2.2 || wy>40) continue;
      if(roadDistance(wx,wz)<76) continue;
      if(pointInHole(holes,wx,wz,radius+12)) continue;
      if(!terrainPatchOk(wx,wz,13,42,5.4)) continue;
      if(colliderNear(wx,wz,28)) continue;

      let angle=rand(cx*73+i,cz*97-attempt)*Math.PI*2;
      let outpost=makeRadarOutpost(wx,wy,wz,angle);
      let collider={
        x:wx,
        baseY:wy,
        y:wy+7.8,
        z:wz,
        r:18.0,
        height:23.4,
        visualRadius:17.1,
        visualHeight:23.7,
        type:"radarOutpost",
        object:outpost,
        health:92,
        maxHealth:92
      };
      outpost.userData.collider=collider;
      colliders.push(collider);
      radarOutposts.push(outpost);
      chunkRoot.add(outpost);
      break;
    }
  }

  let landingSpacePoint=buildChunkFeatures ? landingSpacePointForChunk(cx,cz,colliders,holes) : null;
  if(landingSpacePoint){
    landingSpaces.push(makeLandingSpace(landingSpacePoint,chunkRoot));
    let landingSurface=makeLandingSurface(landingSpacePoint);
    landingSurfaces.push(landingSurface);
    landingRings.push(makeLandingRing(landingSurface,chunkRoot));
  }

  return {cx,cz,root:chunkRoot,land,road,water,shoreBand,trunks,crowns,pods,grasses,cheapTrees,bushes:bushGroup,rocks,rockShadows,rockCollidersByInstance,gravel,gravelCollidersByInstance,holeMeshes,treasureChests,radarOutposts,buildingShadows,buildingBodies,buildingRoofs,buildingWindows,buildingDoors,buildingChimneys,buildingTrims,buildingPorches,villageWalls,cityStreets,cityStreetDetails,cityTechDetails,landingSpaces,landingSurfaces,landingRings,villageCenters,colliders,holes:localHoles};
}

function updateChunksForCenters(centers){
  let chunkCenters=centers.map(center=>({
    cx:Math.floor(center.x/chunkSize),
    cz:Math.floor(center.z/chunkSize),
    viewDistance:Math.max(1,Math.floor(center.viewDistance || viewDistance))
  }));

  neededChunks.clear();
  chunkQueue=[];
  let queuedChunks=new Set();

  function detailForDistanceSq(distanceSq){
    let detail;
    if(distanceSq<=8) detail={treeDensity:1,partDensity:1,grassDensity:1,featureDensity:1};
    else if(distanceSq<=24) detail={treeDensity:0.58,partDensity:0.62,grassDensity:0.62,featureDensity:1};
    else if(distanceSq>viewDistance*viewDistance) detail={treeDensity:0.08,partDensity:0.18,grassDensity:0.08,featureDensity:0};
    else detail={treeDensity:0.24,partDensity:0.42,grassDensity:0.34,featureDensity:1};

    if(getPerformanceMode()!=="split") return detail;
    return {
      treeDensity:detail.treeDensity*0.72,
      partDensity:detail.partDensity*0.82,
      grassDensity:detail.grassDensity*0.54,
      featureDensity:detail.featureDensity
    };
  }

  for(let center of chunkCenters){
    for(let x=-center.viewDistance;x<=center.viewDistance;x++){
      for(let z=-center.viewDistance;z<=center.viewDistance;z++){
        let cx=center.cx+x;
        let cz=center.cz+z;
        let key=chunkKey(cx,cz);
        let distanceSq=x*x+z*z;
        let currentDetail=chunkDetails.get(key);
        let nextDetail=detailForDistanceSq(distanceSq);
        let detailIncreased=!currentDetail
          || nextDetail.treeDensity>currentDetail.treeDensity
          || nextDetail.partDensity>currentDetail.partDensity
          || nextDetail.grassDensity>currentDetail.grassDensity
          || (nextDetail.featureDensity ?? 1)>(currentDetail.featureDensity ?? 1);

        if(detailIncreased){
          chunkDetails.set(key,nextDetail);
        }

        neededChunks.add(key);

        if(!chunks.has(key) && !queuedChunks.has(key)){
          queuedChunks.add(key);
          chunkQueue.push({cx,cz,key});
        }
      }
    }
  }

  for(let record of missionRadarOutposts){
    let collider=record && record.collider;
    if(!collider || collider.destroyed) continue;

    let cx=Math.floor(collider.x/chunkSize);
    let cz=Math.floor(collider.z/chunkSize);
    let key=chunkKey(cx,cz);
    neededChunks.add(key);
    if(!chunkDetails.has(key)){
      chunkDetails.set(key,{treeDensity:0.18,partDensity:0.28,grassDensity:0.18,featureDensity:1});
    }
    if(!chunks.has(key) && !queuedChunks.has(key)){
      queuedChunks.add(key);
      chunkQueue.push({cx,cz,key});
    }
  }

  chunkQueue.sort((a,b)=>{
    let ad=Infinity;
    let bd=Infinity;

    for(let center of chunkCenters){
      let adx=a.cx-center.cx;
      let adz=a.cz-center.cz;
      let bdx=b.cx-center.cx;
      let bdz=b.cz-center.cz;
      ad=Math.min(ad,adx*adx+adz*adz);
      bd=Math.min(bd,bdx*bdx+bdz*bdz);
    }

    return ad-bd;
  });

  for(let [key,chunk] of chunks){
    if(!neededChunks.has(key)){
      removalQueue.push(chunk);
      chunks.delete(key);
      chunkDetails.delete(key);
    }
  }
  updateIndependentStructureVisibility();
  renderStressSignature="";
}

function updateChunks(px,pz){
  updateChunksForCenters([{x:px,z:pz}]);
}

function disposeChunk(chunk){
  unregisterChunk(chunk);
  let turretObjects=[];
  if(chunk.villageCenters){
    for(let village of chunk.villageCenters){
      if(!village.turrets) continue;
      for(let turret of village.turrets){
        if(turret.object) turretObjects.push(turret.object);
      }
    }
  }

  if(chunk.root) scene.remove(chunk.root);

  scene.remove(
    chunk.land,
    chunk.road,
    chunk.water,
    chunk.shoreBand,
    chunk.trunks,
    chunk.crowns,
    chunk.pods,
    chunk.grasses,
    chunk.cheapTrees,
    chunk.bushes,
    chunk.rockShadows,
    chunk.rocks,
    chunk.gravel,
    ...(chunk.holeMeshes || []),
    ...(chunk.treasureChests || []),
    ...(chunk.radarOutposts || []),
    chunk.buildingShadows,
    chunk.buildingBodies,
    chunk.buildingRoofs,
    chunk.buildingWindows,
    chunk.buildingDoors,
    chunk.buildingChimneys,
    chunk.buildingTrims,
    chunk.buildingPorches,
    chunk.villageWalls,
    chunk.cityStreets,
    chunk.cityStreetDetails,
    chunk.cityTechDetails,
    ...(chunk.landingSpaces || []),
    ...(chunk.landingRings || []),
    ...turretObjects
  );

  chunk.land.geometry.dispose();
  if(chunk.road.geometry) chunk.road.geometry.dispose();
  if(chunk.water && chunk.water.geometry) chunk.water.geometry.dispose();
  if(chunk.shoreBand && chunk.shoreBand.geometry) chunk.shoreBand.geometry.dispose();
  if(chunk.trunks) chunk.trunks.dispose();
  if(chunk.crowns) chunk.crowns.dispose();
  if(chunk.pods) chunk.pods.dispose();
  if(chunk.grasses) chunk.grasses.dispose();
  if(chunk.cheapTrees) disposeObjectResources(chunk.cheapTrees,{disposeGeometry:false});
  if(chunk.bushes) disposeObjectResources(chunk.bushes,{disposeGeometry:false});
  if(chunk.rockShadows) chunk.rockShadows.dispose();
  chunk.rocks.dispose();
  if(chunk.gravel) chunk.gravel.dispose();
  if(chunk.buildingShadows) chunk.buildingShadows.dispose();
  chunk.buildingBodies.dispose();
  chunk.buildingRoofs.dispose();
  chunk.buildingWindows.dispose();
  chunk.buildingDoors.dispose();
  chunk.buildingChimneys.dispose();
  chunk.buildingTrims.dispose();
  chunk.buildingPorches.dispose();
  chunk.villageWalls.dispose();
  if(chunk.cityStreets) chunk.cityStreets.dispose();
  if(chunk.cityStreetDetails) chunk.cityStreetDetails.dispose();
  if(chunk.cityTechDetails) chunk.cityTechDetails.dispose();
  if(chunk.landingRings){
    for(let ring of chunk.landingRings){
      let ringIndex=animatedLandingRings.indexOf(ring);
      if(ringIndex>=0) animatedLandingRings.splice(ringIndex,1);
      if(ring.material) ring.material.dispose();
    }
  }
  if(chunk.landingSpaces){
    for(let landingSpace of chunk.landingSpaces){
      disposeLandingSpaceObject(landingSpace);
    }
  }
  if(chunk.radarOutposts){
    for(let outpost of chunk.radarOutposts){
      let dishPivot=outpost && outpost.userData ? outpost.userData.radarDishPivot : null;
      if(dishPivot){
        let dishIndex=animatedRadarDishes.indexOf(dishPivot);
        if(dishIndex>=0) animatedRadarDishes.splice(dishIndex,1);
      }
      disposeRadarOutpostObject(outpost);
    }
  }
}

function registerChunk(chunk){
  if(!chunk) return;
  if(chunk.villageCenters){
    for(let village of chunk.villageCenters){
      activeVillages.push(village);
    }
  }
  if(chunk.colliders){
    for(let collider of chunk.colliders){
      if(collider && collider.type==="turret") activeTurrets.push(collider);
    }
  }
}

function unregisterChunk(chunk){
  if(!chunk) return;
  if(chunk.villageCenters){
    for(let village of chunk.villageCenters){
      let index=activeVillages.indexOf(village);
      if(index>=0) activeVillages.splice(index,1);
    }
  }
  if(chunk.colliders){
    for(let collider of chunk.colliders){
      if(!collider || collider.type!=="turret") continue;
      let index=activeTurrets.indexOf(collider);
      if(index>=0) activeTurrets.splice(index,1);
    }
  }
}

function collidersInRadius(x,z,radius){
  let found=[];
  let reach=radius+chunkSize;
  let minCx=Math.floor((x-reach)/chunkSize);
  let maxCx=Math.floor((x+reach)/chunkSize);
  let minCz=Math.floor((z-reach)/chunkSize);
  let maxCz=Math.floor((z+reach)/chunkSize);

  for(let cx=minCx;cx<=maxCx;cx++){
    for(let cz=minCz;cz<=maxCz;cz++){
      let chunk=chunks.get(chunkKey(cx,cz));
      if(!chunk || !chunk.colliders) continue;
      for(let collider of chunk.colliders){
        found.push(collider);
      }
    }
  }

  return found;
}

function startNextChunkBuild(useWorker=true){
  while(chunkQueue.length>0){
    let item=chunkQueue.shift();
    if(chunks.has(item.key) || !neededChunks.has(item.key)) continue;

    let detail=cloneChunkDetail(chunkDetails.get(item.key));
    if(useWorker && chunkWorker){
      let id=chunkWorkerJobId++;
      activeChunkBuild={
        cx:item.cx,
        cz:item.cz,
        key:item.key,
        detail,
        waitingForWorker:true,
        workerJobId:id,
        generation:chunkWorkerGeneration
      };
      chunkWorker.postMessage({
        type:"buildTerrain",
        id,
        key:item.key,
        generation:chunkWorkerGeneration,
        cx:item.cx,
        cz:item.cz,
        cityMode:chunkHasCityDistrict(item.cx,item.cz),
        cityDistrictChance:cityDistrictChance(),
        colors:environmentColors(),
        shoreline:environmentShoreline(),
        seed:chunkWorkerTerrainSeed,
        terrainProfile:chunkWorkerTerrainProfile
      });
      return true;
    }

    activeChunkBuild={
      cx:item.cx,
      cz:item.cz,
      key:item.key,
      detail,
      generator:makeChunk(item.cx,item.cz,null)
    };
    return true;
  }

  return false;
}

function finishChunkBuild(job,chunk){
  if(!chunk) return;

  let currentDetail=chunkDetails.get(job.key);
  let stale=!neededChunks.has(job.key)
    || chunks.has(job.key)
    || !sameChunkDetail(job.detail,currentDetail);

  if(stale){
    disposeChunk(chunk);
    if(neededChunks.has(job.key) && !chunks.has(job.key)){
      chunkQueue.push({cx:job.cx,cz:job.cz,key:job.key});
    }
    return;
  }

  chunks.set(job.key,chunk);
  if(chunk.root){
    scene.add(chunk.root);
    chunk.root.updateMatrixWorld(true);
  }
  registerChunk(chunk);
  updateIndependentStructureVisibility();
  renderStressSignature="";
}

function setChunkObjectVisible(object,visible){
  if(!object) return;
  if(Array.isArray(object)){
    for(let item of object) setChunkObjectVisible(item,visible);
    return;
  }
  object.visible=visible;
}

function chunkDistanceSqToCenters(chunk,centers){
  let best=Infinity;
  for(let center of centers){
    let cx=Math.floor(center.x/chunkSize);
    let cz=Math.floor(center.z/chunkSize);
    let dx=chunk.cx-cx;
    let dz=chunk.cz-cz;
    best=Math.min(best,dx*dx+dz*dz);
  }
  return best;
}

function applyChunkRenderStress(chunk,stressLevel,centers){
  if(!chunk) return;
  let distanceSq=chunkDistanceSqToCenters(chunk,centers);
  let hideFarGrass=distanceSq>36;
  let hideMidVegetation=stressLevel>=2 && distanceSq>8;
  let hideDecor=(stressLevel>=1 && distanceSq>9) || (stressLevel>=2 && distanceSq>4);
  let hideMoreDecor=(stressLevel>=2 && distanceSq>4) || (stressLevel>=3 && distanceSq>1);
  let hideFarWater=stressLevel>=2 && distanceSq>16;

  setChunkObjectVisible(chunk.grasses,!hideFarGrass);
  setChunkObjectVisible(chunk.bushes,!hideMidVegetation);
  setChunkObjectVisible(chunk.cheapTrees,true);
  setChunkObjectVisible(chunk.trunks,true);
  setChunkObjectVisible(chunk.crowns,true);
  setChunkObjectVisible(chunk.pods,true);
  setChunkObjectVisible(chunk.rocks,true);
  setChunkObjectVisible(chunk.rockShadows,!hideDecor);
  setChunkObjectVisible(chunk.gravel,!hideDecor);
  setChunkObjectVisible(chunk.buildingShadows,!hideDecor);
  setChunkObjectVisible(chunk.buildingWindows,!hideDecor);
  setChunkObjectVisible(chunk.buildingDoors,!hideMoreDecor);
  setChunkObjectVisible(chunk.buildingChimneys,!hideDecor);
  setChunkObjectVisible(chunk.buildingTrims,!hideDecor);
  setChunkObjectVisible(chunk.buildingPorches,!hideMoreDecor);
  setChunkObjectVisible(chunk.cityStreetDetails,!hideDecor);
  setChunkObjectVisible(chunk.cityTechDetails,!hideDecor);
  setChunkObjectVisible(chunk.landingRings,!hideDecor);
  setChunkObjectVisible(chunk.water,!hideFarWater);
  setChunkObjectVisible(chunk.shoreBand,!hideFarWater);
}

function setRenderStressLevel(stressLevel=0,centers=[]){
  let level=Math.max(0,Math.min(3,Math.floor(stressLevel || 0)));
  let safeCenters=Array.isArray(centers) && centers.length ? centers : [{x:0,z:0}];
  let signature=level+"|"+safeCenters
    .map(center=>Math.floor(center.x/chunkSize)+","+Math.floor(center.z/chunkSize))
    .join("|");
  if(signature===renderStressSignature) return;
  renderStressSignature=signature;

  for(let chunk of chunks.values()){
    applyChunkRenderStress(chunk,level,safeCenters);
  }
}

function processChunkQueue(maxItems=1,immediate=false,maxFrameMs=2){
  let processed=0;
  let deadline=performance.now()+maxFrameMs;

  while(processed<maxItems){
    let now=performance.now();
    if(!immediate && processed>0 && now>=deadline) break;

    if(!activeChunkBuild && !startNextChunkBuild(!immediate)) break;
    if(!activeChunkBuild) break;

    lastChunkBuildTime=now;

    let job=activeChunkBuild;
    if(job.waitingForWorker){
      if(immediate){
        chunkWorkerGeneration++;
        chunkWorkerResults.clear();
        job.waitingForWorker=false;
        job.generator=makeChunk(job.cx,job.cz,null);
      }else{
        let workerResult=chunkWorkerResults.get(job.workerJobId);
        if(!workerResult) break;
        chunkWorkerResults.delete(job.workerJobId);
        job.waitingForWorker=false;
        job.generator=makeChunk(job.cx,job.cz,workerResult);
      }
    }

    let result=job.generator.next();

    if(result.done){
      activeChunkBuild=null;
      finishChunkBuild(job,result.value);
    }

    processed++;
  }

  while(removalQueue.length>0 && processed<maxItems){
    disposeChunk(removalQueue.shift());
    processed++;
  }
}

function updateWind(time,rainIntensity=0,dayAmount=1,nightAmount=0){
  let t=time*0.004;
  for(let ring of animatedLandingRings){
    let pulse=(Math.sin(t+(ring.userData.phase || 0))*0.5+0.5);
    let scale=(ring.userData.baseScale || 10)*(0.92+pulse*0.18);
    ring.scale.setScalar(scale);
    if(ring.material) ring.material.opacity=0.38+pulse*0.42;
  }

  if(time-lastRadarDishAnimationTime>33){
    lastRadarDishAnimationTime=time;
    for(let dish of animatedRadarDishes){
      if(!dish || !dish.parent || !dish.visible) continue;
      dish.rotation.y=(dish.userData.phase || 0)+time*(dish.userData.speed || 0.0005);
    }
  }

  let rain=Math.max(0,Math.min(1,rainIntensity));
  if(waterShimmerShader){
    if(waterShimmerShader.uniforms.waterShimmerTime) waterShimmerShader.uniforms.waterShimmerTime.value=time*0.001;
    if(waterShimmerShader.uniforms.waterDayAmount) waterShimmerShader.uniforms.waterDayAmount.value=Math.max(0,Math.min(1,dayAmount));
    if(waterShimmerShader.uniforms.waterNightAmount) waterShimmerShader.uniforms.waterNightAmount.value=Math.max(0,Math.min(1,nightAmount));
    if(waterShimmerShader.uniforms.waterRainIntensity) waterShimmerShader.uniforms.waterRainIntensity.value=rain;
  }

}

function resetChunks(){
  chunkWorkerGeneration++;
  chunkWorkerResults.clear();
  clearTestingRadarOutpost();
  if(activeChunkBuild){
    let job=activeChunkBuild;
    activeChunkBuild=null;
    if(job.generator){
      let result=job.generator.next();
      while(!result.done){
        result=job.generator.next();
      }
      if(result.value) disposeChunk(result.value);
    }
  }

  for(let chunk of chunks.values()){
    disposeChunk(chunk);
  }
  for(let chunk of removalQueue){
    disposeChunk(chunk);
  }
  chunks.clear();
  neededChunks.clear();
  chunkDetails.clear();
  chunkQueue=[];
  removalQueue=[];
  activeVillages.length=0;
  activeTurrets.length=0;
  animatedLandingRings.length=0;
  animatedRadarDishes.length=0;
  lastRadarDishAnimationTime=0;
  activeChunkBuild=null;
  lastChunkBuildTime=0;
  clearBossBases();
}

function setWorkerTerrain(seed,profile={}){
  chunkWorkerTerrainSeed=Number.isFinite(seed) ? seed : 0;
  chunkWorkerTerrainProfile={...(profile || {})};
  chunkWorkerGeneration++;
  chunkWorkerResults.clear();
}

function setLandingSpaceModel(model){
  landingSpaceModel=model;
  for(let chunk of chunks.values()){
    if(!chunk || (chunk.landingSpaces && chunk.landingSpaces.length>0)) continue;
    let landingSpacePoint=landingSpacePointForChunk(chunk.cx,chunk.cz,chunk.colliders || [],chunk.holes || []);
    if(landingSpacePoint){
      chunk.landingSpaces=chunk.landingSpaces || [];
      chunk.landingSurfaces=chunk.landingSurfaces || [];
      chunk.landingRings=chunk.landingRings || [];
      let parent=chunk.root || scene;
      chunk.landingSpaces.push(makeLandingSpace(landingSpacePoint,parent));
      let landingSurface=makeLandingSurface(landingSpacePoint);
      chunk.landingSurfaces.push(landingSurface);
      chunk.landingRings.push(makeLandingRing(landingSurface,parent));
    }
  }
}

function setTreasureChestModels(models=[]){
  treasureChestModels=Array.isArray(models) ? models.filter(Boolean) : [];

  for(let chunk of chunks.values()){
    if(!chunk || !chunk.holes) continue;

    if(chunk.treasureChests){
      for(let chest of chunk.treasureChests){
        if(chest && chest.parent) chest.parent.remove(chest);
        else if(chest) scene.remove(chest);
      }
    }

    chunk.treasureChests=[];
    if(!treasureChestModels.length) continue;

    for(let i=0;i<chunk.holes.length;i++){
      let chest=makeTreasureChestForHole(chunk.holes[i],chunk.cx,chunk.cz,i);
      if(!chest) continue;
      chunk.treasureChests.push(chest);
      (chunk.root || scene).add(chest);
    }
  }
}

function collectTreasureAt(x,z,radius=3.2){
  let pcx=Math.floor(x/chunkSize);
  let pcz=Math.floor(z/chunkSize);

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.treasureChests) continue;

      for(let i=chunk.treasureChests.length-1;i>=0;i--){
        let treasure=chunk.treasureChests[i];
        if(!treasure || treasure.userData.collected) continue;

        let tx=treasure.userData.x;
        let tz=treasure.userData.z;
        let reach=radius+(treasure.userData.r || 3.2);
        let ddx=x-tx;
        let ddz=z-tz;
        if(ddx*ddx+ddz*ddz>reach*reach) continue;

        treasure.userData.collected=true;
        let pickupVisual=treasure.clone(true);
        if(treasure.parent) treasure.parent.remove(treasure);
        else scene.remove(treasure);
        chunk.treasureChests.splice(i,1);
        return {
          type:treasure.userData.treasureType || "common",
          x:tx,
          y:treasure.userData.y,
          z:tz,
          r:treasure.userData.r || 3.2,
          visual:pickupVisual
        };
      }
    }
  }

  return null;
}

function landingSurfaceAt(x,z,physicalOnly=false){
  let pcx=Math.floor(x/chunkSize);
  let pcz=Math.floor(z/chunkSize);
  let best=null;
  let bestDistSq=Infinity;

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.landingSurfaces) continue;

      for(let surface of chunk.landingSurfaces){
        let sx=x-surface.x;
        let sz=z-surface.z;
        let distSq=sx*sx+sz*sz;
        let radius=physicalOnly ? (surface.padR || surface.r || 0) : (surface.r || 0);
        if(distSq<radius*radius && distSq<bestDistSq){
          best=surface;
          bestDistSq=distSq;
        }
      }
    }
  }

  return best;
}

function landingSurfaceHeightAt(x,z,physicalOnly=false){
  let surface=landingSurfaceAt(x,z,physicalOnly);
  return surface ? surface.y : null;
}

function holeAt(x,z){
  let pcx=Math.floor(x/chunkSize);
  let pcz=Math.floor(z/chunkSize);
  let best=null;
  let bestIntensity=0;

  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      let chunk=chunks.get(chunkKey(pcx+dx,pcz+dz));
      if(!chunk || !chunk.holes) continue;

      for(let hole of chunk.holes){
        let depth=holeDepthAt(hole,x,z);
        if(depth<=0) continue;
        let intensity=depth/Math.max(0.001,hole.depth);
        if(intensity>bestIntensity){
          bestIntensity=intensity;
          best={...hole,depthAtPoint:depth,intensity};
        }
      }
    }
  }

  return best;
}

function holeSurfaceHeightAt(x,z){
  let hole=holeAt(x,z);
  return hole ? groundHeight(x,z)-hole.depthAtPoint : null;
}

  return {
    chunks,
    bossBases,
    activeVillages,
    activeTurrets,
    collidersInRadius,
    collidesWithObstacles,
    obstacleAt,
    obstacleCollisionInfo,
    obstacleAlongSegment,
    obstacleAlongSegment3D,
    rockObstacleAlongSegmentExact,
    destroyObstacle,
    damageBossBase,
    isVillageCleared,
    placeTestRadarOutpost,
    clearTestingRadarOutpost,
    missionRadarOutposts,
    placeMissionRadarOutpostsNearStart,
    clearMissionRadarOutposts,
    placeTestBossBaseNearStart,
    clearBossBases,
    findCityDistrictNearRoad,
    updateChunks,
    updateChunksForCenters,
    setRenderStressLevel,
    updateWind,
    setTerraformBloomAmount,
    processChunkQueue,
    setEnvironment:applyEnvironment,
    setWorkerTerrain,
    setLandingSpaceModel,
    setTreasureChestModels,
    collectTreasureAt,
    landingSurfaceAt,
    landingSurfaceHeightAt,
    holeAt,
    holeSurfaceHeightAt,
    resetChunks
  };
}
