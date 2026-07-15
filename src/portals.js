import { THREE } from "./three.js";
import { chunkSize } from "./constants.js";
import { hash01, smoothStep } from "./utils.js";

const randomPortalChunkProbability=0.025;
const randomPortalMinSpacing=chunkSize*3.0;
const portalSurfaceWaterDepthThreshold=0.3;
const portalSurfaceWaterLift=0.1;
const portalPlacementWaterDepthThreshold=0.45;
const portalPlacementMaxHeightRange=3.2;
const portalPlacementSamples=[
  [9,0],
  [-9,0],
  [0,9],
  [0,-9],
  [6,6],
  [-6,6],
  [6,-6],
  [-6,-6]
];
const portalDefaultRadius=8.5;
const portalHeightScale=1.74;
const portalCenterHeightScale=0.52;
const portalTriggerRadiusScale=0.95;
const portalRingTubeRadius=0.055;
const portalHaloTubeRadius=0.018;
const portalRingRadialSegments=18;
const portalHaloRadialSegments=12;
const portalRingTubularSegments=128;
const portalCoreSegments=96;
const portalRingColor=0xd6a8ff;
const portalDreamRingColor=0x9df7ff;
const portalHaloColor=0x7ff8ff;
const portalCoreColor=0x8ceaff;
const portalDreamCoreColor=0xffcdf6;
const portalSparkColor=0xf4d6ff;
const portalRingOpacity=0.88;
const portalHaloOpacity=0.58;
const portalCoreOpacity=0.26;
const portalSparkOpacity=0.88;
const portalSparkSize=0.22;
const portalRingRenderOrder=28;
const portalHaloRenderOrder=27;
const portalCoreRenderOrder=26;
const portalSparkRenderOrder=29;
const portalStoneColor=0x4f4a58;
const portalStoneEmissive=0x140b1e;
const portalStoneTubeRadius=0.16;
const portalStoneRadialSegments=7;
const portalStoneTubularSegments=40;
const portalStoneRadiusScale=1.13;
const portalStoneHeightScale=1.13;
const portalStoneDepthScale=0.74;
const portalRingHeightScale=0.5;
const portalHaloRadiusScale=1.22;
const portalHaloHeightScale=0.61;
const portalCoreRadiusScale=0.86;
const portalCoreHeightScale=0.43;
const portalSparkCount=120;
const portalSparkRingBiasBase=0.72;
const portalSparkRingBiasRange=0.42;
const portalSparkHeightScale=0.9;
const portalSparkDepthJitter=0.32;
const portalSparkSpeedBase=0.35;
const portalSparkSpeedRange=1.25;
const portalPulseHeightScale=0.42;
const portalPulseRadius=28;
const portalTransitionEase=0.045;
const portalTransitionSnapThreshold=0.001;
const portalTransitionNotifyThreshold=0.002;
const portalAnimationTimeScale=0.001;
const portalPulseFrequency=2.8;
const portalPulseAmount=0.045;
const portalFloatFrequency=1.7;
const portalFloatAmount=0.26;
const portalRingRotationSpeed=0.012;
const portalRingActiveOpacity=0.78;
const portalRingOpacityPulseFrequency=4.1;
const portalRingOpacityPulseAmount=0.1;
const portalHaloRotationSpeed=-0.008;
const portalHaloRadiusPulseBase=1.18;
const portalHaloRadiusPulseFrequency=2.2;
const portalHaloRadiusPulseAmount=0.08;
const portalHaloHeightPulseBase=0.59;
const portalHaloHeightPulseFrequency=2.5;
const portalHaloHeightPulseAmount=0.035;
const portalHaloActiveOpacity=0.34;
const portalHaloOpacityPulseFrequency=3.2;
const portalHaloOpacityPulseAmount=0.1;
const portalCoreRotationSpeed=0.006;
const portalCoreActiveOpacity=0.2;
const portalCoreOpacityPulseFrequency=5.3;
const portalCoreOpacityPulseAmount=0.045;
const portalSparkWobbleBase=0.86;
const portalSparkWobbleFrequency=3.7;
const portalSparkWobbleAmount=0.14;
const portalSparkBobFrequency=2.4;
const portalSparkBobAmount=0.55;
const portalSparkDepthFrequency=6.2;
const portalSparkDepthAmount=0.18;
const portalSparkActiveOpacity=0.72;
const portalSparkOpacityPulseFrequency=4.6;
const portalSparkOpacityPulseAmount=0.12;
const dreamMistTextureSize=96;
const dreamMistTextureCenter=dreamMistTextureSize/2;
const dreamMistInnerStop=0.34;
const dreamMistOuterStop=0.68;
const dreamMistPointColor=0xe8ddff;
const dreamMistPointBaseSize=32;
const dreamMistPointRenderOrder=17;
const dreamMistPointCount=210;
const dreamMistDistancePower=0.72;
const dreamMistMaxDistance=74;
const dreamMistMinY=1.8;
const dreamMistHeightRange=17;
const dreamMistAngleJitter=0.55;
const dreamMistSpeedBase=0.025;
const dreamMistSpeedRange=0.075;
const dreamMistBobBase=0.6;
const dreamMistBobRange=1.9;
const dreamMistVisibleThreshold=0.015;
const dreamMistMaxOpacity=0.72;
const dreamMistDisplayBaseSize=42;
const dreamMistDisplaySizeRange=30;
const dreamMistDriftTimeScale=0.001;
const dreamMistBreatheBase=0.76;
const dreamMistBreatheTimeScale=0.0015;
const dreamMistBreatheAmount=0.24;
const dreamMistBobTimeScale=0.0018;
const portalWarpSeedXOffset=177;
const portalWarpSeedZOffset=-313;
const portalWarpDirectionSpread=Math.PI*1.6;
const portalWarpDistanceScales=[5.5,7.2,4.4,8.6,3.6];
const portalWarpAttemptsPerDistance=14;
const portalWarpAttemptAngleStep=0.34;
const portalWarpRingAngleStep=0.47;
const portalWarpFallbackDistanceScale=4.5;
const portalChunkProcessLimit=36;
const portalCarCooldownFrames=120;
const portalTriggerCooldownFrames=90;
const randomPortalCandidateAttempts=5;
const randomPortalProbabilitySeedX=1531;
const randomPortalProbabilitySeedZ=-911;
const randomPortalCandidateInset=0.16;
const randomPortalCandidateRange=0.68;
const randomPortalYawRange=Math.PI*2;

export function createPortalSystem(context){
  let dreamDimension=false;
  let dreamTransition=0;
  let dreamTarget=0;
  let portals=[];
  let randomPortals=new Map();
  let randomPortalRejectedKeys=new Set();
  let dreamMistGroup=null;
  let dreamMistPlanes=[];
  let dreamFogSpriteTexture=null;
  let dreamFogPointMat=null;

  let portalRingGeo=new THREE.TorusGeometry(1,portalRingTubeRadius,portalRingRadialSegments,portalRingTubularSegments);
  let portalCoreGeo=new THREE.CircleGeometry(1,portalCoreSegments);
  let portalHaloGeo=new THREE.TorusGeometry(1,portalHaloTubeRadius,portalHaloRadialSegments,portalRingTubularSegments);
  let portalStoneGeo=new THREE.TorusGeometry(1,portalStoneTubeRadius,portalStoneRadialSegments,portalStoneTubularSegments);
  let portalStoneMat=new THREE.MeshStandardMaterial({
    color:portalStoneColor,
    emissive:portalStoneEmissive,
    emissiveIntensity:0.12,
    roughness:0.92,
    metalness:0.04
  });
  let portalRingMat=new THREE.MeshBasicMaterial({
    color:portalRingColor,
    transparent:true,
    opacity:portalRingOpacity,
    depthWrite:false,
    depthTest:true,
    blending:THREE.AdditiveBlending
  });
  let portalCoreMat=new THREE.MeshBasicMaterial({
    color:portalCoreColor,
    transparent:true,
    opacity:portalCoreOpacity,
    depthWrite:false,
    depthTest:true,
    side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending
  });
  let portalSparkMat=new THREE.PointsMaterial({
    color:portalSparkColor,
    size:portalSparkSize,
    transparent:true,
    opacity:portalSparkOpacity,
    depthWrite:false,
    depthTest:true,
    blending:THREE.AdditiveBlending
  });

  function notifyDreamChanged(){
    if(context.onDreamTransitionChange) context.onDreamTransitionChange();
  }

  function portalSurfaceY(x,z){
    let y=context.drivingSurfaceHeight(x,z);
    if(context.waterDepthAt(x,z)>portalSurfaceWaterDepthThreshold) y=Math.max(y,context.waterLevel+portalSurfaceWaterLift);
    return y;
  }

  function addPortalStoneStructure(group,radius,height){
    let ringYRadius=height*portalRingHeightScale;
    let stoneRing=new THREE.Mesh(portalStoneGeo,portalStoneMat);
    stoneRing.scale.set(radius*portalStoneRadiusScale,ringYRadius*portalStoneHeightScale,portalStoneDepthScale);
    stoneRing.castShadow=false;
    stoneRing.receiveShadow=true;
    group.add(stoneRing);
  }

  function createPortal(x,z,yaw=0,options={}){
    let surfaceY=portalSurfaceY(x,z);
    let radius=options.radius || portalDefaultRadius;
    let height=radius*portalHeightScale;
    let group=new THREE.Group();
    group.position.set(x,surfaceY+height*portalCenterHeightScale,z);
    group.rotation.y=yaw;
    let visualGroup=new THREE.Group();
    group.add(visualGroup);
    group.userData={
      x,
      z,
      yaw,
      key:options.key || null,
      randomPortal:!!options.randomPortal,
      radius:radius*portalTriggerRadiusScale,
      visualRadius:radius,
      height,
      phase:Math.random()*Math.PI*2,
      cooldown:0
    };

    let ring=new THREE.Mesh(portalRingGeo,portalRingMat.clone());
    ring.scale.set(radius,height*portalRingHeightScale,radius);
    ring.renderOrder=portalRingRenderOrder;
    visualGroup.add(ring);

    let halo=new THREE.Mesh(portalHaloGeo,portalRingMat.clone());
    halo.material.color.set(portalHaloColor);
    halo.material.opacity=portalHaloOpacity;
    halo.scale.set(radius*portalHaloRadiusScale,height*portalHaloHeightScale,radius*portalHaloRadiusScale);
    halo.renderOrder=portalHaloRenderOrder;
    visualGroup.add(halo);

    let core=new THREE.Mesh(portalCoreGeo,portalCoreMat.clone());
    core.scale.set(radius*portalCoreRadiusScale,height*portalCoreHeightScale,1);
    core.renderOrder=portalCoreRenderOrder;
    visualGroup.add(core);

    addPortalStoneStructure(group,radius,height);

    let sparkCount=portalSparkCount;
    let sparkPositions=new Float32Array(sparkCount*3);
    let sparkData=[];
    for(let i=0;i<sparkCount;i++){
      let angle=Math.random()*Math.PI*2;
      let ringBias=portalSparkRingBiasBase+Math.random()*portalSparkRingBiasRange;
      sparkPositions[i*3]=Math.cos(angle)*radius*ringBias;
      sparkPositions[i*3+1]=(Math.random()-0.5)*height*portalSparkHeightScale;
      sparkPositions[i*3+2]=(Math.random()-0.5)*portalSparkDepthJitter;
      sparkData.push({
        angle,
        radius:radius*ringBias,
        y:(Math.random()-0.5)*height*portalSparkHeightScale,
        speed:portalSparkSpeedBase+Math.random()*portalSparkSpeedRange,
        phase:Math.random()*Math.PI*2
      });
    }
    let sparkGeo=new THREE.BufferGeometry();
    sparkGeo.setAttribute("position",new THREE.BufferAttribute(sparkPositions,3));
    let sparks=new THREE.Points(sparkGeo,portalSparkMat.clone());
    sparks.renderOrder=portalSparkRenderOrder;
    visualGroup.add(sparks);

    group.userData.visualGroup=visualGroup;
    group.userData.ring=ring;
    group.userData.halo=halo;
    group.userData.core=core;
    group.userData.sparks=sparks;
    group.userData.sparkPositions=sparkPositions;
    group.userData.sparkData=sparkData;
    portals.push(group);
    context.scene.add(group);
    return group;
  }

  function disposePortal(portal){
    if(!portal) return;
    let index=portals.indexOf(portal);
    if(index>=0) portals.splice(index,1);
    context.scene.remove(portal);
    portal.traverse(child=>{
      if(child.geometry
        && child.geometry !== portalRingGeo
        && child.geometry !== portalCoreGeo
        && child.geometry !== portalHaloGeo
        && child.geometry !== portalStoneGeo){
        child.geometry.dispose();
      }
      if(child.material){
        if(Array.isArray(child.material)){
          for(let material of child.material){
            if(material !== portalStoneMat) material.dispose();
          }
        }else if(child.material !== portalStoneMat){
          child.material.dispose();
        }
      }
    });
  }

  function consumePortal(portal){
    if(!portal || !portal.userData) return;
    let key=portal.userData.key;
    if(key && randomPortals.get(key)===portal){
      randomPortals.delete(key);
      randomPortalRejectedKeys.add(key);
    }
    disposePortal(portal);
  }

  function spawnPortalPulse(portal){
    if(!portal || !portal.userData) return;
    let data=portal.userData;
    let surfaceY=portalSurfaceY(data.x,data.z);
    context.spawnRadiusExplosion(data.x,surfaceY+data.height*portalPulseHeightScale,data.z,portalPulseRadius,false);
  }

  function setDreamDimension(enabled,portal=null){
    dreamDimension=!!enabled;
    dreamTarget=dreamDimension ? 1 : 0;
    notifyDreamChanged();
    if(portal) spawnPortalPulse(portal);
  }

  function createDreamMist(){
    if(dreamMistGroup) return;
    let canvas=document.createElement("canvas");
    canvas.width=dreamMistTextureSize;
    canvas.height=dreamMistTextureSize;
    let ctx=canvas.getContext("2d");
    let gradient=ctx.createRadialGradient(dreamMistTextureCenter,dreamMistTextureCenter,0,dreamMistTextureCenter,dreamMistTextureCenter,dreamMistTextureCenter);
    gradient.addColorStop(0,"rgba(255,255,255,0.72)");
    gradient.addColorStop(dreamMistInnerStop,"rgba(226,214,255,0.32)");
    gradient.addColorStop(dreamMistOuterStop,"rgba(188,232,255,0.12)");
    gradient.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=gradient;
    ctx.fillRect(0,0,dreamMistTextureSize,dreamMistTextureSize);
    dreamFogSpriteTexture=new THREE.CanvasTexture(canvas);
    dreamFogSpriteTexture.needsUpdate=true;
    dreamFogPointMat=new THREE.PointsMaterial({
      color:dreamMistPointColor,
      map:dreamFogSpriteTexture,
      transparent:true,
      opacity:0,
      size:dreamMistPointBaseSize,
      sizeAttenuation:true,
      depthWrite:false,
      depthTest:true,
      blending:THREE.NormalBlending
    });

    dreamMistGroup=new THREE.Group();
    dreamMistGroup.visible=false;
    dreamMistPlanes=[];
    let count=dreamMistPointCount;
    let positions=new Float32Array(count*3);
    let geometry=new THREE.BufferGeometry();
    for(let i=0;i<count;i++){
      let angle=Math.random()*Math.PI*2;
      let dist=Math.pow(Math.random(),dreamMistDistancePower)*dreamMistMaxDistance;
      let y=dreamMistMinY+Math.random()*dreamMistHeightRange;
      positions[i*3]=Math.cos(angle)*dist;
      positions[i*3+1]=y;
      positions[i*3+2]=Math.sin(angle)*dist;
      dreamMistPlanes.push({
        angle:(i/count)*Math.PI*2+Math.random()*dreamMistAngleJitter,
        dist,
        y,
        speed:dreamMistSpeedBase+Math.random()*dreamMistSpeedRange,
        bob:dreamMistBobBase+Math.random()*dreamMistBobRange,
        phase:Math.random()*Math.PI*2
      });
    }
    geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
    let fogPoints=new THREE.Points(geometry,dreamFogPointMat);
    fogPoints.renderOrder=dreamMistPointRenderOrder;
    dreamMistGroup.userData.fogPoints=fogPoints;
    dreamMistGroup.add(fogPoints);
    context.scene.add(dreamMistGroup);
  }

  function dreamMistCenter(){
    let visibleCars=context.activeCars().filter(car=>car && car.group && car.group.visible && car.health>0);
    if(visibleCars.length===0) return context.fallbackCenter();
    let x=0;
    let z=0;
    for(let car of visibleCars){
      x+=car.x;
      z+=car.z;
    }
    return {x:x/visibleCars.length,z:z/visibleCars.length};
  }

  function updateDreamMist(now=performance.now()){
    if(!dreamMistGroup) createDreamMist();
    let amount=smoothStep(dreamTransition);
    dreamMistGroup.visible=amount>dreamMistVisibleThreshold;
    if(!dreamMistGroup.visible) return;
    let center=dreamMistCenter();
    dreamMistGroup.position.set(center.x,0,center.z);
    let fogPoints=dreamMistGroup.userData.fogPoints;
    if(!fogPoints) return;
    let positions=fogPoints.geometry.attributes.position.array;
    for(let i=0;i<dreamMistPlanes.length;i++){
      let data=dreamMistPlanes[i];
      let drift=now*dreamMistDriftTimeScale*data.speed;
      let angle=data.angle+drift;
      let breathe=dreamMistBreatheBase+Math.sin(now*dreamMistBreatheTimeScale+data.phase)*dreamMistBreatheAmount;
      positions[i*3]=Math.cos(angle)*data.dist*breathe;
      positions[i*3+1]=data.y+Math.sin(now*dreamMistBobTimeScale+data.phase)*data.bob;
      positions[i*3+2]=Math.sin(angle)*data.dist*breathe;
    }
    fogPoints.geometry.attributes.position.needsUpdate=true;
    fogPoints.material.opacity=dreamMistMaxOpacity*amount;
    fogPoints.material.size=dreamMistDisplayBaseSize+amount*dreamMistDisplaySizeRange;
  }

  function updateDreamDimensionVisuals(now=performance.now()){
    let before=dreamTransition;
    dreamTransition+=(dreamTarget-dreamTransition)*portalTransitionEase;
    if(Math.abs(dreamTransition-dreamTarget)<portalTransitionSnapThreshold) dreamTransition=dreamTarget;
    if(Math.abs(before-dreamTransition)>portalTransitionNotifyThreshold) notifyDreamChanged();
    updateDreamMist(now);
  }

  function animatePortal(portal,now){
    let data=portal.userData;
    data.cooldown=Math.max(0,(data.cooldown || 0)-1);
    let t=now*portalAnimationTimeScale+data.phase;
    let pulse=1+Math.sin(t*portalPulseFrequency)*portalPulseAmount;
    portal.position.y=portalSurfaceY(data.x,data.z)+data.height*portalCenterHeightScale;
    if(data.visualGroup){
      data.visualGroup.position.y=Math.sin(t*portalFloatFrequency)*portalFloatAmount;
    }
    if(data.ring){
      data.ring.rotation.z+=portalRingRotationSpeed;
      data.ring.scale.set(data.visualRadius*pulse,data.height*portalRingHeightScale*pulse,data.visualRadius*pulse);
      data.ring.material.color.set(dreamDimension ? portalDreamRingColor : portalRingColor);
      data.ring.material.opacity=portalRingActiveOpacity+Math.sin(t*portalRingOpacityPulseFrequency)*portalRingOpacityPulseAmount;
    }
    if(data.halo){
      data.halo.rotation.z+=portalHaloRotationSpeed;
      let haloRadiusPulse=portalHaloRadiusPulseBase+Math.sin(t*portalHaloRadiusPulseFrequency)*portalHaloRadiusPulseAmount;
      data.halo.scale.set(data.visualRadius*haloRadiusPulse,data.height*(portalHaloHeightPulseBase+Math.cos(t*portalHaloHeightPulseFrequency)*portalHaloHeightPulseAmount),data.visualRadius*haloRadiusPulse);
      data.halo.material.opacity=portalHaloActiveOpacity+Math.sin(t*portalHaloOpacityPulseFrequency)*portalHaloOpacityPulseAmount;
    }
    if(data.core){
      data.core.rotation.z+=portalCoreRotationSpeed;
      data.core.material.color.set(dreamDimension ? portalDreamCoreColor : portalCoreColor);
      data.core.material.opacity=portalCoreActiveOpacity+Math.sin(t*portalCoreOpacityPulseFrequency)*portalCoreOpacityPulseAmount;
    }
    if(data.sparks && data.sparkPositions && data.sparkData){
      for(let i=0;i<data.sparkData.length;i++){
        let spark=data.sparkData[i];
        let a=spark.angle+t*spark.speed;
        let wobble=portalSparkWobbleBase+Math.sin(t*portalSparkWobbleFrequency+spark.phase)*portalSparkWobbleAmount;
        data.sparkPositions[i*3]=Math.cos(a)*spark.radius*wobble;
        data.sparkPositions[i*3+1]=spark.y+Math.sin(t*portalSparkBobFrequency+spark.phase)*portalSparkBobAmount;
        data.sparkPositions[i*3+2]=Math.sin(t*portalSparkDepthFrequency+spark.phase)*portalSparkDepthAmount;
      }
      data.sparks.geometry.attributes.position.needsUpdate=true;
      data.sparks.material.opacity=portalSparkActiveOpacity+Math.sin(t*portalSparkOpacityPulseFrequency)*portalSparkOpacityPulseAmount;
    }
  }

  function portalPlacementUsable(x,z){
    let world=context.getWorld();
    if(context.waterDepthAt(x,z)>portalPlacementWaterDepthThreshold) return false;
    if(world.collidesWithObstacles(x,z)) return false;

    let centerY=context.drivingSurfaceHeight(x,z);
    let minY=centerY;
    let maxY=centerY;
    for(let sample of portalPlacementSamples){
      let sx=x+sample[0];
      let sz=z+sample[1];
      if(context.waterDepthAt(sx,sz)>portalPlacementWaterDepthThreshold) return false;
      if(world.collidesWithObstacles(sx,sz)) return false;
      let y=context.drivingSurfaceHeight(sx,sz);
      minY=Math.min(minY,y);
      maxY=Math.max(maxY,y);
    }
    if(maxY-minY>portalPlacementMaxHeightRange) return false;

    for(let portal of portals){
      let data=portal.userData || {};
      let dx=x-data.x;
      let dz=z-data.z;
      if(dx*dx+dz*dz<randomPortalMinSpacing*randomPortalMinSpacing) return false;
    }

    return true;
  }

  function portalWarpDestination(portal,car){
    let data=portal.userData || {};
    let baseX=Number.isFinite(data.x) ? data.x : car.x;
    let baseZ=Number.isFinite(data.z) ? data.z : car.z;
    let baseYaw=Number.isFinite(data.yaw) ? data.yaw : car.angle || 0;
    let portalKeySeed=hash01(Math.floor(baseX/chunkSize)+portalWarpSeedXOffset,Math.floor(baseZ/chunkSize)+portalWarpSeedZOffset);
    let preferredDirection=baseYaw+(portalKeySeed-0.5)*portalWarpDirectionSpread;
    let distances=portalWarpDistanceScales.map(scale=>chunkSize*scale);

    for(let ring=0;ring<distances.length;ring++){
      let distance=distances[ring];
      let attempts=portalWarpAttemptsPerDistance;
      for(let i=0;i<attempts;i++){
        let spread=(i===0 ? 0 : ((i%2===0 ? 1 : -1)*Math.ceil(i/2))*portalWarpAttemptAngleStep);
        let angle=preferredDirection+spread+ring*portalWarpRingAngleStep;
        let x=baseX+Math.sin(angle)*distance;
        let z=baseZ+Math.cos(angle)*distance;
        if(!portalPlacementUsable(x,z)) continue;
        if(context.groundHoleAt(x,z)) continue;
        return {x,z,angle};
      }
    }

    let fallbackDistance=chunkSize*portalWarpFallbackDistanceScale;
    return {
      x:baseX+Math.sin(preferredDirection)*fallbackDistance,
      z:baseZ+Math.cos(preferredDirection)*fallbackDistance,
      angle:preferredDirection
    };
  }

  function warpCarThroughPortal(car,portal){
    let destination=portalWarpDestination(portal,car);
    car.x=destination.x;
    car.z=destination.z;
    car.angle=destination.angle;
    car.velAngle=destination.angle;
    car.cameraYaw=destination.angle;
    car.speed=0;
    car.turnVelocity=0;
    car.speedDelta=0;
    car.throttleEase=0;
    car.turnInputEase=0;
    car.y=context.surfaceHeightForActor(car,car.x,car.z);
    car.surfaceDistance=context.roadDistance(car.x,car.z);
    car.lastWalkX=car.x;
    car.lastWalkZ=car.z;
    car.vy=0;
    car.onGround=true;
    car.airborne=false;
    car.portalCooldown=portalCarCooldownFrames;
    car.group.position.set(car.x,car.y,car.z);
    car.group.rotation.y=car.angle;
    car.group.rotation.x=0;
    car.group.rotation.z=0;
    if(car.shadow) car.shadow.update({carX:car.x,carZ:car.z,carY:car.y,surfaceY:car.y,carVelAngle:car.velAngle || car.angle});

    let world=context.getWorld();
    if(world && world.updateChunksForCenters && world.processChunkQueue){
      world.updateChunksForCenters([{x:car.x,z:car.z,viewDistance:context.chunkViewDistanceForCar(car)}]);
      world.processChunkQueue(portalChunkProcessLimit,true);
      if(context.setLastChunkSignature) context.setLastChunkSignature(context.chunkSignatureForCars());
    }
  }

  function triggerPortalForCar(portal,car){
    if(!portal || !car) return;
    let data=portal.userData;
    data.cooldown=portalTriggerCooldownFrames;
    spawnPortalPulse(portal);
    warpCarThroughPortal(car,portal);
    spawnPortalPulse({userData:{x:car.x,z:car.z,height:data.height || portalDefaultRadius*portalHeightScale}});
    setDreamDimension(!dreamDimension);
    consumePortal(portal);
  }

  function updatePortals(now=performance.now()){
    if(portals.length===0) return;
    for(let car of context.cars()){
      if(car && car.portalCooldown>0) car.portalCooldown--;
    }
    for(let portal of portals){
      animatePortal(portal,now);
      let data=portal.userData;
      for(let car of context.activeCars()){
        if(!car || car.health<=0 || !car.group || !car.group.visible || car.portalCooldown>0 || data.cooldown>0) continue;
        let dx=car.x-data.x;
        let dz=car.z-data.z;
        if(dx*dx+dz*dz<data.radius*data.radius){
          triggerPortalForCar(portal,car);
          break;
        }
      }
    }
  }

  function randomPortalCandidateForChunk(cx,cz,key){
    if(hash01(cx+randomPortalProbabilitySeedX,cz+randomPortalProbabilitySeedZ)>randomPortalChunkProbability) return null;

    for(let attempt=0;attempt<randomPortalCandidateAttempts;attempt++){
      let x=(cx+randomPortalCandidateInset+hash01(cx*19+attempt*97,cz*23-attempt*41)*randomPortalCandidateRange)*chunkSize;
      let z=(cz+randomPortalCandidateInset+hash01(cx*31-attempt*53,cz*17+attempt*89)*randomPortalCandidateRange)*chunkSize;
      let yaw=hash01(cx*43+attempt*11,cz*47-attempt*13)*randomPortalYawRange;
      if(!portalPlacementUsable(x,z)) continue;
      return {key,x,z,yaw};
    }

    return null;
  }

  function updateRandomPortals(){
    let world=context.getWorld();
    if(!world || !world.chunks) return;

    for(let [key,portal] of randomPortals){
      if(!world.chunks.has(key)){
        disposePortal(portal);
        randomPortals.delete(key);
      }
    }

    for(let [key,chunk] of world.chunks){
      if(randomPortals.has(key)) continue;
      if(randomPortalRejectedKeys.has(key)) continue;
      let candidate=randomPortalCandidateForChunk(chunk.cx,chunk.cz,key);
      if(!candidate){
        randomPortalRejectedKeys.add(key);
        continue;
      }

      let portal=createPortal(candidate.x,candidate.z,candidate.yaw,{
        key,
        randomPortal:true,
        radius:portalDefaultRadius
      });
      randomPortals.set(key,portal);
    }
  }

  function clearRandomPortals(){
    for(let portal of randomPortals.values()){
      disposePortal(portal);
    }
    randomPortals.clear();
    randomPortalRejectedKeys.clear();
  }

  return {
    isDreamDimension:()=>dreamDimension,
    getDreamTransition:()=>dreamTransition,
    getPortals:()=>portals.map(portal=>({
      x:portal.userData && Number.isFinite(portal.userData.x) ? portal.userData.x : portal.position.x,
      z:portal.userData && Number.isFinite(portal.userData.z) ? portal.userData.z : portal.position.z,
      radius:portal.userData && Number.isFinite(portal.userData.visualRadius) ? portal.userData.visualRadius : portalDefaultRadius
    })),
    updatePortals,
    updateDreamDimensionVisuals,
    updateRandomPortals,
    clearRandomPortals
  };
}
