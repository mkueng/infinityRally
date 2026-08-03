import { MTLLoader, OBJLoader, RoundedBoxGeometry, THREE } from "./three.js";

const carDustTexture=new THREE.TextureLoader().load(
  "assets/textures/cars/Rock009.png?v=car-dust-patches",
  undefined,
  undefined,
  error=>console.warn("Car dust texture failed to load",error)
);
carDustTexture.wrapS=THREE.RepeatWrapping;
carDustTexture.wrapT=THREE.RepeatWrapping;
carDustTexture.anisotropy=4;
if(THREE.SRGBColorSpace) carDustTexture.colorSpace=THREE.SRGBColorSpace;

function shouldDustCarMesh(mesh,material){
  if(mesh.userData && mesh.userData.playerCarWheel) return false;
  let name=`${mesh.name || ""} ${material.name || ""}`.toLowerCase();
  if(material.transparent || material.opacity<0.92) return false;
  if(name.includes("7720667")) return false;
  if(name.includes("2829873")) return false;
  if(name.includes("10988977")) return false;
  return true;
}

function shouldDustRobotMesh(mesh){
  let name=(mesh.name || "").toLowerCase();
  if(name.includes("cockpit") || name.includes("visor")) return false;
  if(name.includes("wheel") || name.includes("hub")) return false;
  return true;
}

function shouldDustHovercraftMesh(mesh,material){
  let name=`${mesh.name || ""} ${material.name || ""}`.toLowerCase();
  if(material.transparent || material.opacity<0.92) return false;
  if(name.includes("cockpit") || name.includes("visor")) return false;
  if(name.includes("glow") || name.includes("light")) return false;
  if(name.includes("button") || name.includes("display") || name.includes("screen")) return false;
  if(name.includes("antenna")) return false;
  if(name.includes("fan") || name.includes("duct")) return false;
  if(name.includes("dirt") || name.includes("scuff")) return false;
  return true;
}

export const robotDustPatchOptions={
  strength:0.54,
  uvScale:0.82,
  sideUvScale:0.66,
  verticalUvScale:0.48,
  patchScale:1.08,
  fineScale:2.05,
  blend:0.56,
  maskLow:0.42,
  maskHigh:0.74,
  fineLow:0.08,
  fineHigh:0.58,
  surfaceBase:0.62,
  topAmount:0.24,
  sideAmount:0.2
};

export const enemyBuggyDustPatchOptions={
  strength:0.76,
  uvScale:0.7,
  sideUvScale:0.56,
  verticalUvScale:0.42,
  patchScale:0.92,
  fineScale:1.84,
  blend:0.64,
  maskLow:0.34,
  maskHigh:0.7,
  fineLow:0.06,
  fineHigh:0.55,
  surfaceBase:0.72,
  topAmount:0.34,
  sideAmount:0.32
};

const playerCarDirtPatchOptions={
  strength:0.58,
  uvScale:0.16,
  sideUvScale:0.12,
  verticalUvScale:0.062,
  patchScale:0.3,
  fineScale:0.72,
  blend:0.58,
  maskLow:0.42,
  maskHigh:0.78,
  fineLow:0.1,
  fineHigh:0.6,
  surfaceBase:0.64,
  topAmount:0.28,
  sideAmount:0.24
};

const hovercraftDirtPatchOptions={
  strength:0.5,
  uvScale:0.34,
  sideUvScale:0.24,
  verticalUvScale:0.13,
  patchScale:0.92,
  fineScale:1.76,
  blend:0.5,
  maskLow:0.52,
  maskHigh:0.86,
  fineLow:0.22,
  fineHigh:0.74,
  surfaceBase:0.44,
  topAmount:0.15,
  sideAmount:0.22
};

export function addPatchyCarDust(material,seed=0,options={}){
  if(material.userData && material.userData.carDustApplied) return material;

  let settings={
    strength:0.48,
    uvScale:0.095,
    sideUvScale:0.071,
    verticalUvScale:0.034,
    patchScale:0.19,
    fineScale:0.46,
    blend:0.52,
    maskLow:0.48,
    maskHigh:0.8,
    fineLow:0.14,
    fineHigh:0.64,
    surfaceBase:0.56,
    topAmount:0.22,
    sideAmount:0.18,
    ...options
  };
  let dusted=material.clone();
  dusted.userData={...(dusted.userData || {}),carDustApplied:true};
  dusted.roughness=Math.max(dusted.roughness ?? 0.56,0.68);

  dusted.onBeforeCompile=shader=>{
    shader.uniforms.carDustMap={value:carDustTexture};
    shader.uniforms.carDustSeed={value:seed};
    shader.uniforms.carDustStrength={value:settings.strength};
    shader.uniforms.carDustUvScale={value:settings.uvScale};
    shader.uniforms.carDustSideUvScale={value:settings.sideUvScale};
    shader.uniforms.carDustVerticalUvScale={value:settings.verticalUvScale};
    shader.uniforms.carDustPatchScale={value:settings.patchScale};
    shader.uniforms.carDustFineScale={value:settings.fineScale};
    shader.uniforms.carDustBlend={value:settings.blend};
    shader.uniforms.carDustMaskLow={value:settings.maskLow};
    shader.uniforms.carDustMaskHigh={value:settings.maskHigh};
    shader.uniforms.carDustFineLow={value:settings.fineLow};
    shader.uniforms.carDustFineHigh={value:settings.fineHigh};
    shader.uniforms.carDustSurfaceBase={value:settings.surfaceBase};
    shader.uniforms.carDustTopAmount={value:settings.topAmount};
    shader.uniforms.carDustSideAmount={value:settings.sideAmount};
    shader.vertexShader=shader.vertexShader.replace(
      "#include <common>",
      [
        "#include <common>",
        "varying vec3 vCarDustLocalPosition;",
        "varying vec3 vCarDustLocalNormal;"
      ].join("\n")
    );
    shader.vertexShader=shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      [
        "#include <beginnormal_vertex>",
        "vCarDustLocalNormal=normalize(objectNormal);"
      ].join("\n")
    );
    shader.vertexShader=shader.vertexShader.replace(
      "#include <begin_vertex>",
      [
        "#include <begin_vertex>",
        "vCarDustLocalPosition=position;"
      ].join("\n")
    );
    shader.fragmentShader=shader.fragmentShader.replace(
      "#include <common>",
      [
        "#include <common>",
        "uniform sampler2D carDustMap;",
        "uniform float carDustSeed;",
        "uniform float carDustStrength;",
        "uniform float carDustUvScale;",
        "uniform float carDustSideUvScale;",
        "uniform float carDustVerticalUvScale;",
        "uniform float carDustPatchScale;",
        "uniform float carDustFineScale;",
        "uniform float carDustBlend;",
        "uniform float carDustMaskLow;",
        "uniform float carDustMaskHigh;",
        "uniform float carDustFineLow;",
        "uniform float carDustFineHigh;",
        "uniform float carDustSurfaceBase;",
        "uniform float carDustTopAmount;",
        "uniform float carDustSideAmount;",
        "varying vec3 vCarDustLocalPosition;",
        "varying vec3 vCarDustLocalNormal;",
        "float carDustHash(vec2 p){",
        "  p=fract(p*vec2(127.1,311.7));",
        "  p+=dot(p,p+45.32+carDustSeed);",
        "  return fract(p.x*p.y);",
        "}",
        "float carDustNoise(vec2 p){",
        "  vec2 i=floor(p);",
        "  vec2 f=fract(p);",
        "  vec2 u=f*f*(3.0-2.0*f);",
        "  float a=carDustHash(i);",
        "  float b=carDustHash(i+vec2(1.0,0.0));",
        "  float c=carDustHash(i+vec2(0.0,1.0));",
        "  float d=carDustHash(i+vec2(1.0,1.0));",
        "  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);",
        "}",
        "vec3 carDustSample(vec2 uv){",
        "  vec2 f=fract(uv);",
        "  return texture2D(carDustMap,f*0.42+vec2(0.29)).rgb;",
        "}"
      ].join("\n")
    );
    shader.fragmentShader=shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      [
        "vec3 carDustNormal=normalize(vCarDustLocalNormal);",
        "vec2 carDustUvA=vCarDustLocalPosition.xz*carDustUvScale+vec2(carDustSeed*0.137,carDustSeed*0.071);",
        "vec2 carDustUvB=vec2(vCarDustLocalPosition.z*carDustSideUvScale-vCarDustLocalPosition.y*carDustVerticalUvScale,vCarDustLocalPosition.x*carDustSideUvScale*0.86+vCarDustLocalPosition.y*carDustVerticalUvScale*1.26)+vec2(carDustSeed*0.193,0.41);",
        "float carDustPatch=carDustNoise(vCarDustLocalPosition.xz*carDustPatchScale+vec2(carDustSeed*1.7,-carDustSeed*0.9));",
        "float carDustFine=carDustNoise(vCarDustLocalPosition.xy*carDustFineScale+vec2(3.2+carDustSeed,7.1));",
        "float carDustMask=smoothstep(carDustMaskLow,carDustMaskHigh,carDustPatch)*smoothstep(carDustFineLow,carDustFineHigh,carDustFine);",
        "float carDustSurface=carDustSurfaceBase+max(carDustNormal.y,0.0)*carDustTopAmount+(1.0-abs(carDustNormal.y))*carDustSideAmount;",
        "vec3 carDustColor=mix(carDustSample(carDustUvA),carDustSample(carDustUvB),0.42);",
        "float carDustLuma=dot(carDustColor,vec3(0.299,0.587,0.114));",
        "carDustColor=mix(vec3(0.76,0.67,0.46),vec3(carDustLuma)*vec3(1.18,1.04,0.78),0.24);",
        "vec3 carDustResult=mix(gl_FragColor.rgb,carDustColor,carDustBlend);",
        "gl_FragColor.rgb=mix(gl_FragColor.rgb,carDustResult,carDustStrength*carDustMask*carDustSurface);",
        "#include <dithering_fragment>"
      ].join("\n")
    );
  };

  return dusted;
}

function shouldDustEnemyBuggyMesh(mesh,material){
  if(mesh.userData && mesh.userData.enemyBuggyWheel) return false;
  let name=`${mesh.name || ""} ${material.name || ""}`.toLowerCase();
  if(material.transparent || material.opacity<0.92) return false;
  if(name.includes("11593967")) return false;
  if(name.includes("16121600") || name.includes("16776448")) return false;
  return true;
}

function isEnemyBuggyAssetWheelMesh(mesh){
  if(!mesh || !mesh.geometry || !mesh.material) return false;
  let materials=Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  let materialName=materials.map(material=>material && material.name || "").join(" ").toLowerCase();
  if(!materialName.includes("color_2829873") && !materialName.includes("color_16448250")) return false;

  mesh.geometry.computeBoundingBox();
  let bounds=mesh.geometry.boundingBox;
  if(!bounds) return false;
  let size=bounds.getSize(new THREE.Vector3());
  let axleDepth=size.x;
  let wheelHeight=size.y;
  let wheelRadiusDepth=size.z;
  return axleDepth>=5.5
    && axleDepth<=12.5
    && wheelHeight>=11
    && wheelHeight<=23
    && wheelRadiusDepth>=11
    && wheelRadiusDepth<=23;
}

function prepareEnemyBuggyAssetWheel(mesh){
  mesh.geometry.computeBoundingBox();
  let bounds=mesh.geometry.boundingBox;
  if(!bounds) return;
  let center=bounds.getCenter(new THREE.Vector3());
  mesh.geometry.translate(-center.x,-center.y,-center.z);
  mesh.geometry.computeBoundingBox();
  mesh.position.x+=center.x;
  mesh.position.y+=center.y;
  mesh.position.z+=center.z;
  mesh.userData.enemyBuggyWheel=true;
  mesh.userData.enemyBuggyWheelAxis="x";
  mesh.userData.enemyBuggyWheelDirection=1;
  mesh.userData.enemyBuggyWheelBaseRotationX=mesh.rotation.x;
}

function isPlayerCarAssetWheelMesh(mesh){
  if(!mesh || !mesh.geometry || !mesh.material) return false;
  let materials=Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  let materialName=materials.map(material=>material && material.name || "").join(" ").toLowerCase();
  if(!materialName.includes("color_2829873")) return false;

  mesh.geometry.computeBoundingBox();
  let bounds=mesh.geometry.boundingBox;
  if(!bounds) return false;
  let size=bounds.getSize(new THREE.Vector3());
  let wheelWidth=size.x;
  let axleDepth=size.y;
  let wheelHeight=size.z;
  return wheelWidth>=18
    && wheelWidth<=22
    && axleDepth>=9
    && axleDepth<=13
    && wheelHeight>=18
    && wheelHeight<=22;
}

function preparePlayerCarAssetWheel(mesh){
  mesh.geometry.computeBoundingBox();
  let bounds=mesh.geometry.boundingBox;
  if(!bounds) return;
  let center=bounds.getCenter(new THREE.Vector3());
  mesh.geometry.translate(-center.x,-center.y,-center.z);
  mesh.geometry.computeBoundingBox();
  mesh.position.x+=center.x;
  mesh.position.y+=center.y;
  mesh.position.z+=center.z;
  mesh.userData.playerCarWheel=true;
  mesh.userData.playerCarWheelAxis="y";
  mesh.userData.playerCarWheelDirection=1;
  mesh.userData.playerCarWheelBaseRotationY=mesh.rotation.y;
}

function darkenVehicleMaterial(material,amount=0.66,emissiveAmount=0.72){
  if(!material || !material.color) return;
  if(material.userData && material.userData.vehicleDarkened) return;
  material.color.multiplyScalar(amount);
  if(material.emissive) material.emissive.multiplyScalar(emissiveAmount);
  material.userData={...(material.userData || {}),vehicleDarkened:true};
}

export function normalizeCarModel(car){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  car.rotation.x=-Math.PI/2;
  asset.rotation.y=Math.PI/2;
  asset.add(car);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=(5.016*1.05)/Math.max(size.x,size.z,0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);
  asset.position.x-=center.x/scale;
  asset.position.z-=center.z/scale;
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  asset.position.y-=box.min.y/scale;

  model.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(isPlayerCarAssetWheelMesh(child)){
        preparePlayerCarAssetWheel(child);
      }
      if(child.geometry) child.geometry.computeVertexNormals();
      if(child.material){
        let materials=Array.isArray(child.material) ? child.material : [child.material];
        for(let i=0;i<materials.length;i++){
          let material=materials[i];
          material.side=THREE.FrontSide;
          material.roughness=material.roughness ?? 0.56;
          material.metalness=material.metalness ?? 0.24;
          if(material.name==="color_7720667"){
            material.transparent=true;
            material.opacity=0.46;
            material.depthWrite=false;
            material.roughness=0.14;
            material.metalness=0.08;
          }else if(material.name==="color_14900002"){
            darkenVehicleMaterial(material,0.5,0.62);
          }else if(material.name==="color_2829873"){
            darkenVehicleMaterial(material,0.58,0.62);
          }else{
            darkenVehicleMaterial(material,0.42,0.62);
          }
          if(shouldDustCarMesh(child,material)){
            materials[i]=addPatchyCarDust(material,child.id*0.37+i*1.91,playerCarDirtPatchOptions);
          }
        }
        child.material=Array.isArray(child.material) ? materials : materials[0];
      }
    }
  });

  model.position.y=-0.18;
  model.userData.baseY=model.position.y;
  model.userData.baseScale=model.scale.clone();
  model.userData.trackHalfWidth=Math.max(0.92,Math.min(1.18,size.x*0.43));

  let launcherMat=new THREE.MeshStandardMaterial({
    color:0x262d32,
    roughness:0.5,
    metalness:0.58
  });
  let launcherBandMat=new THREE.MeshStandardMaterial({
    color:0xff7a32,
    emissive:0x4a1606,
    emissiveIntensity:0.34,
    roughness:0.42,
    metalness:0.32
  });
  for(let side of [-1,1]){
    let tube=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.16,1.24,12),launcherMat);
    tube.position.set(side*0.86,1.08,0.22);
    tube.rotation.x=Math.PI/2;
    tube.castShadow=true;
    tube.receiveShadow=true;
    model.add(tube);

    let band=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.12,12),launcherBandMat);
    band.position.set(side*0.86,1.08,0.75);
    band.rotation.x=Math.PI/2;
    band.castShadow=true;
    band.receiveShadow=true;
    model.add(band);
  }

  return model;
}

export function loadCarModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/cars/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/cars/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeCarModel(object)),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

export function normalizeJetModel(jet,accentColor=0xb83a32){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  jet.rotation.x=-Math.PI/2;
  asset.rotation.y=Math.PI/2;
  asset.add(jet);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=7.1/Math.max(size.x,size.z,0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);
  asset.position.x-=center.x/scale;
  asset.position.z-=center.z/scale;
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  asset.position.y-=box.min.y/scale;

  model.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(child.geometry) child.geometry.computeVertexNormals();
      if(child.material){
        let materials=Array.isArray(child.material) ? child.material : [child.material];
        for(let material of materials){
          material.side=THREE.FrontSide;
          material.roughness=material.roughness ?? 0.48;
          material.metalness=material.metalness ?? 0.32;
          if(material.name==="color_14900002"){
            material.color.setHex(accentColor);
            material.roughness=0.38;
            material.metalness=0.42;
          }
          if(material.name==="color_11593967" || material.name==="color_7720667"){
            material.transparent=true;
            material.opacity=0.58;
            material.depthWrite=false;
            material.roughness=0.12;
            material.metalness=0.08;
          }
        }
      }
    }
  });

  model.position.y=0.45;
  model.position.z=1.6;
  model.visible=false;
  model.userData.baseY=model.position.y;
  model.userData.baseScale=model.scale.clone();

  return model;
}

function makeHovercraftAuraMaterial(color,opacity){
  return new THREE.MeshBasicMaterial({
    color,
    transparent:true,
    opacity,
    depthWrite:false,
    depthTest:true,
    blending:THREE.AdditiveBlending,
    side:THREE.DoubleSide
  });
}

function addHovercraftMothershipPropulsion(model,addOverlay,setTransform,accentColor=0xb83a32,options={}){
  let hazeGeo=new THREE.SphereGeometry(1,36,14);
  let coreGeo=new THREE.SphereGeometry(1,28,12);
  let emitterGeo=new THREE.CylinderGeometry(1,1.24,0.14,36);
  let podGeo=new THREE.SphereGeometry(1,18,10);
  let rearEngineDiskGeo=new THREE.CircleGeometry(1,34);
  let rearEngineRingGeo=new THREE.RingGeometry(0.58,1,36);
  let rearEnginePlumeGeo=new THREE.SphereGeometry(1,24,10);
  let parts=model.userData.hoverPropulsionParts || [];
  model.userData.hoverPropulsionParts=parts;
  let rearEngineX=options.rearEngineX ?? 0.82;
  let rearEngineY=options.rearEngineY ?? 0.62;
  let rearEngineZ=options.rearEngineZ ?? -2.34;
  let rearPlumeZ=options.rearPlumeZ ?? -2.62;

  function addPulsePart(name,geometry,material,x,y,z,sx,sy,sz,renderOrder,pulseScale=0.08,pulseY=0.16,pulseSpeed=2.1,pulsePhase=0){
    let mesh=addOverlay(new THREE.Mesh(geometry,material));
    mesh.name=name;
    setTransform(mesh,x,y,z,sx,sy,sz);
    mesh.renderOrder=renderOrder;
    mesh.userData.baseScale=mesh.scale.clone();
    mesh.userData.baseOpacity=material.opacity;
    mesh.userData.hoverPropulsion=true;
    mesh.userData.hoverPulseScale=pulseScale;
    mesh.userData.hoverPulseY=pulseY;
    mesh.userData.hoverPulseSpeed=pulseSpeed;
    mesh.userData.hoverPulsePhase=pulsePhase;
    mesh.userData.hoverColorA=material.color.getHex();
    mesh.userData.hoverColorB=name.includes("core") ? 0xffffff : 0xb18cff;
    parts.push(mesh);
    return mesh;
  }

  addPulsePart(
    "hovercraft-mothership-lower-haze",
    hazeGeo,
    makeHovercraftAuraMaterial(0x78f0e6,0.16),
    0,0.055,0.02,
    2.72,0.2,2.38,
    18,
    0.12,0.22,1.85,0.3
  );
  addPulsePart(
    "hovercraft-mothership-upper-haze",
    hazeGeo,
    makeHovercraftAuraMaterial(0xb9ffff,0.2),
    0,0.2,0.06,
    1.72,0.18,1.42,
    19,
    0.16,0.18,2.35,1.1
  );
  addPulsePart(
    "hovercraft-mothership-core-haze",
    coreGeo,
    makeHovercraftAuraMaterial(0xe8ffff,0.27),
    0,0.12,0.14,
    0.76,0.3,0.78,
    20,
    0.22,0.22,3.2,2.0
  );
  addPulsePart(
    "hovercraft-mothership-emitter-bay",
    emitterGeo,
    makeHovercraftAuraMaterial(accentColor,0.34),
    0,0.15,0.05,
    0.92,1,0.66,
    21,
    0.08,0.1,2.7,2.8
  );

  for(let side of [-1,1]){
    for(let i=0;i<2;i++){
      addPulsePart(
        `hovercraft-${side<0 ? "left" : "right"}-mothership-glow-pod-${i}`,
        podGeo,
        makeHovercraftAuraMaterial(i===0 ? 0x9fd8ff : 0x78f0e6,0.3),
        side*(1.0+i*0.62),
        0.24,
        -0.82+i*1.52,
        0.26,
        0.14,
        0.26,
        22,
        0.2,
        0.16,
        2.9+i*0.55,
        side*0.8+i*1.4
      );
    }

    let engineDisk=addPulsePart(
      `hovercraft-${side<0 ? "left" : "right"}-rear-engine-pulse-disc`,
      rearEngineDiskGeo,
      makeHovercraftAuraMaterial(0x9fd8ff,0.58),
      side*rearEngineX,
      rearEngineY,
      rearEngineZ,
      0.34,
      0.34,
      1,
      24,
      0.28,
      0.28,
      4.15,
      side>0 ? 0.55 : 1.35
    );
    engineDisk.userData.hoverColorB=0xffffff;

    let engineRing=addPulsePart(
      `hovercraft-${side<0 ? "left" : "right"}-rear-engine-pulse-ring`,
      rearEngineRingGeo,
      makeHovercraftAuraMaterial(accentColor,0.42),
      side*rearEngineX,
      rearEngineY,
      rearEngineZ-0.005,
      0.44,
      0.44,
      1,
      25,
      0.34,
      0.34,
      3.55,
      side>0 ? 1.2 : 2.0
    );
    engineRing.userData.hoverColorB=0x78f0e6;

    let plume=addPulsePart(
      `hovercraft-${side<0 ? "left" : "right"}-rear-engine-pulse-plume`,
      rearEnginePlumeGeo,
      makeHovercraftAuraMaterial(0x78f0e6,0.28),
      side*rearEngineX,
      rearEngineY-0.02,
      rearPlumeZ,
      0.28,
      0.24,
      0.62,
      23,
      0.12,
      0.18,
      3.9,
      side>0 ? 2.25 : 2.85
    );
    plume.userData.hoverPulseZ=0.48;
    plume.userData.hoverColorB=0xb18cff;
  }
}

function addHovercraftOverlayMeshes(model,accentColor=0xb83a32,scaleCompensation=1){
  let dirtMat=new THREE.MeshStandardMaterial({
    color:0x8b7750,
    roughness:0.98,
    metalness:0.02,
    side:THREE.DoubleSide
  });
  let darkDirtMat=new THREE.MeshStandardMaterial({
    color:0x4c412e,
    roughness:1,
    metalness:0,
    side:THREE.DoubleSide
  });
  let dirtPatchGeo=new THREE.DodecahedronGeometry(1,0);
  let dirtScratchGeo=new THREE.BoxGeometry(1,1,1);
  let s=scaleCompensation;

  function addOverlay(mesh){
    mesh.castShadow=false;
    mesh.receiveShadow=false;
    model.add(mesh);
    return mesh;
  }

  function setOverlayTransform(mesh,x,y,z,sx,sy,sz,rotationY=0){
    mesh.position.set(x*s,y*s,z*s);
    mesh.rotation.y=rotationY;
    mesh.scale.set(sx*s,sy*s,sz*s);
  }

  addHovercraftMothershipPropulsion(model,addOverlay,setOverlayTransform,accentColor,{
    rearEngineX:0.58,
    rearEngineY:0.92,
    rearEngineZ:-3.34,
    rearPlumeZ:-3.78
  });

  function addDirtPatch(name,x,y,z,sx,sy,sz,rotationY=0,material=dirtMat){
    let patch=addOverlay(new THREE.Mesh(dirtPatchGeo,material));
    patch.name=name;
    setOverlayTransform(patch,x,y,z,sx,sy,sz,rotationY);
    return patch;
  }

  function addDirtScratch(name,x,y,z,sx,sy,sz,rotationY=0,material=darkDirtMat){
    let scratch=addOverlay(new THREE.Mesh(dirtScratchGeo,material));
    scratch.name=name;
    setOverlayTransform(scratch,x,y,z,sx,sy,sz,rotationY);
    return scratch;
  }

  addDirtPatch("hovercraft-front-left-dirt",-.72,1.205,1.62,.28,.012,.15,-0.18);
  addDirtPatch("hovercraft-front-right-dirt",.58,1.205,1.48,.22,.012,.12,0.42,darkDirtMat);
  addDirtPatch("hovercraft-center-dirt",-.18,1.205,.36,.36,.012,.18,0.12);
  addDirtPatch("hovercraft-rear-deck-dirt",.52,1.285,-1.34,.42,.012,.16,-0.34);
  addDirtPatch("hovercraft-rear-corner-dirt",-.84,1.285,-1.7,.26,.012,.12,0.38,darkDirtMat);
  addDirtPatch("hovercraft-bow-dirt",.24,.96,2.08,.24,.01,.12,-0.08);
  addDirtPatch("hovercraft-left-skirt-dirt",-1.92,.68,.96,.09,.012,.36,0.06,darkDirtMat);
  addDirtPatch("hovercraft-right-skirt-dirt",1.92,.68,.42,.08,.012,.3,-0.12);
  addDirtPatch("hovercraft-left-rear-skirt-dirt",-1.92,.68,-1.32,.08,.012,.32,0.18);
  addDirtPatch("hovercraft-right-rear-skirt-dirt",1.92,.68,-1.68,.1,.012,.24,-0.28,darkDirtMat);
  addDirtScratch("hovercraft-front-scuff",-.36,1.218,1.04,.34,.014,.028,0.22,darkDirtMat);
  addDirtScratch("hovercraft-side-scuff-left",-2.02,.79,-.54,.022,.035,.48,0,darkDirtMat);
  addDirtScratch("hovercraft-side-scuff-right",2.02,.79,-.18,.022,.035,.38,0,darkDirtMat);
  addDirtScratch("hovercraft-rear-scuff",.2,1.292,-1.86,.46,.014,.026,-0.14,darkDirtMat);
}

function tuneHovercraftAssetMaterial(mesh,material,accentColor){
  let name=`${mesh.name || ""} ${material.name || ""}`.toLowerCase();
  let next=material.clone();
  next.side=THREE.FrontSide;
  next.roughness=next.roughness ?? 0.58;
  next.metalness=next.metalness ?? 0.28;

  if(name.includes("glow") || name.includes("screen")){
    if(next.emissive){
      next.emissive.set(name.includes("lower") || name.includes("pod") ? 0x55dcff : accentColor);
      next.emissiveIntensity=Math.max(next.emissiveIntensity || 0,0.85);
    }
    next.transparent=true;
    next.opacity=name.includes("lower") || name.includes("pod") ? 0.82 : 0.94;
    next.depthWrite=false;
  }else if(name.includes("accent") || name.includes("bumper") || name.includes("button_red")){
    if(next.color) next.color.set(accentColor);
    if(next.emissive) next.emissive.set(accentColor).multiplyScalar(0.18);
  }else if(name.includes("button_green") || name.includes("green_tip")){
    if(next.emissive){
      next.emissive.set(0x35ff7d);
      next.emissiveIntensity=Math.max(next.emissiveIntensity || 0,0.35);
    }
  }else if(name.includes("button_cyan")){
    if(next.emissive){
      next.emissive.set(0x55dcff);
      next.emissiveIntensity=Math.max(next.emissiveIntensity || 0,0.45);
    }
  }

  if(shouldDustHovercraftMesh(mesh,next)){
    next=addPatchyCarDust(next,mesh.id*0.41+4.6,hovercraftDirtPatchOptions);
  }

  return next;
}

export function normalizeHovercraftModel(hovercraft,accentColor=0xb83a32){
  let model=new THREE.Group();
  let asset=hovercraft && hovercraft.scene ? hovercraft.scene : hovercraft;
  asset.rotation.x=-Math.PI/2;
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let targetFootprint=6.8*0.8*1.05;
  let overlayScale=targetFootprint/6.8;
  let scale=targetFootprint/Math.max(size.x,size.z,0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);
  asset.position.x-=center.x/scale;
  asset.position.z-=center.z/scale;
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  asset.position.y-=box.min.y/scale;

  asset.traverse(child=>{
    if(!child.isMesh) return;
    child.castShadow=true;
    child.receiveShadow=true;
    if(child.geometry) child.geometry.computeVertexNormals();
    if(child.material){
      let materials=Array.isArray(child.material) ? child.material : [child.material];
      materials=materials.map(material=>tuneHovercraftAssetMaterial(child,material,accentColor));
      child.material=Array.isArray(child.material) ? materials : materials[0];
    }
  });

  addHovercraftOverlayMeshes(model,accentColor,overlayScale/scale);
  model.name="player-hovercraft";
  model.position.y=0.38;
  model.visible=false;
  model.userData.baseY=model.position.y;
  model.userData.baseScale=model.scale.clone();

  return model;
}

export function loadJetModel(accentColor=0xb83a32){
  let path="assets/hovercraft/";
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath(path);

  return new Promise(resolve=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath(path);
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeHovercraftModel(object,accentColor)),
          undefined,
          error=>{
            console.warn("Failed to load hovercraft OBJ asset; using procedural fallback:",error);
            resolve(makeHovercraftModel(accentColor));
          }
        );
      },
      undefined,
      error=>{
        console.warn("Failed to load hovercraft materials; using procedural fallback:",error);
        resolve(makeHovercraftModel(accentColor));
      }
    );
  });
}

export function normalizeEnemyBattleShipModel(ship){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  ship.rotation.x=-Math.PI/2;
  asset.add(ship);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=58/Math.max(size.x,size.z,0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);
  asset.position.x-=center.x/scale;
  asset.position.y-=center.y/scale;
  asset.position.z-=center.z/scale;

  model.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(child.geometry) child.geometry.computeVertexNormals();
      if(child.material){
        let materials=Array.isArray(child.material) ? child.material : [child.material];
        for(let material of materials){
          material.side=THREE.FrontSide;
          material.roughness=material.roughness ?? 0.54;
          material.metalness=material.metalness ?? 0.28;
        }
      }
    }
  });

  return model;
}

export function loadEnemyBattleShipModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/enemyBattleShip/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/enemyBattleShip/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeEnemyBattleShipModel(object)),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

export function normalizeEnemyBuggyModel(buggy){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  buggy.rotation.x=-Math.PI/2;
  asset.rotation.y=0;
  asset.add(buggy);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=7.35/Math.max(size.x,size.z,0.001);
  model.scale.setScalar(scale*1.5);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);
  asset.position.x-=center.x/scale;
  asset.position.z-=center.z/scale;
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  asset.position.y-=box.min.y/scale;

  model.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(isEnemyBuggyAssetWheelMesh(child)){
        prepareEnemyBuggyAssetWheel(child);
      }
      if(child.geometry) child.geometry.computeVertexNormals();
      if(child.material){
        let materials=Array.isArray(child.material) ? child.material : [child.material];
        for(let i=0;i<materials.length;i++){
          let material=materials[i];
          material.side=THREE.FrontSide;
          material.roughness=material.roughness ?? 0.62;
          material.metalness=material.metalness ?? 0.34;
          if(material.name==="color_11593967"){
            darkenVehicleMaterial(material,0.68,0.62);
            material.emissive=new THREE.Color(0x123238);
            material.emissiveIntensity=0.22;
            material.roughness=0.24;
          }else if(material.name==="color_16121600" || material.name==="color_16776448"){
            darkenVehicleMaterial(material,0.56,0.62);
            material.emissive=new THREE.Color(0x4a3b00);
            material.emissiveIntensity=0.18;
          }else if(material.name==="color_2829873" || material.name==="color_6383466"){
            darkenVehicleMaterial(material,0.48,0.62);
          }else{
            darkenVehicleMaterial(material,0.38,0.62);
          }
          if(shouldDustEnemyBuggyMesh(child,material)){
            materials[i]=addPatchyCarDust(material,child.id*0.47+i*2.13+8.4,enemyBuggyDustPatchOptions);
          }
        }
        child.material=Array.isArray(child.material) ? materials : materials[0];
      }
    }
  });

  let launcherAnchor=new THREE.Object3D();
  launcherAnchor.name="enemy-buggy-launcher-anchor";
  launcherAnchor.position.set(0,4.1,1.65);
  model.add(launcherAnchor);
  model.userData.tracks=[];
  model.userData.trackOffset=0;
  model.userData.launcher=launcherAnchor;
  return model;
}

export function loadEnemyBuggyModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/enemyBuggy/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/enemyBuggy/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeEnemyBuggyModel(object)),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

export function normalizeLandingSpaceModel(landingSpace){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  landingSpace.rotation.x=-Math.PI/2;
  asset.add(landingSpace);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=46/Math.max(size.x,size.z,0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);
  asset.position.x-=center.x/scale;
  asset.position.z-=center.z/scale;
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  asset.position.y-=box.min.y/scale;
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  model.userData.landingSurfaceOffset=Math.max(0.1,box.max.y);

  let topBox=new THREE.Box3();
  let topPoint=new THREE.Vector3();
  let localPoint=new THREE.Vector3();
  let topThreshold=box.max.y-Math.max(0.08,box.max.y*0.025);
  model.traverse(child=>{
    if(!child.isMesh || !child.geometry || !child.geometry.attributes.position) return;
    let positions=child.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      localPoint.fromBufferAttribute(positions,i);
      topPoint.copy(localPoint).applyMatrix4(child.matrixWorld);
      if(topPoint.y>=topThreshold) topBox.expandByPoint(topPoint);
    }
  });
  if(!topBox.isEmpty()){
    let topCenter=new THREE.Vector3();
    topBox.getCenter(topCenter);
    model.userData.landingSurfaceLocalX=topCenter.x;
    model.userData.landingSurfaceLocalZ=topCenter.z;
  }

  model.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(child.geometry) child.geometry.computeVertexNormals();
      if(child.material){
        let materials=Array.isArray(child.material) ? child.material : [child.material];
        for(let material of materials){
          material.side=THREE.FrontSide;
          material.roughness=material.roughness ?? 0.68;
          material.metalness=material.metalness ?? 0.18;
          if(material.name==="color_11593967"){
            material.emissive=material.emissive || new THREE.Color(0x000000);
            material.emissive.set(0x1b7180);
            material.emissiveIntensity=0.38;
          }
          if(material.name==="color_4634441"){
            material.emissive=material.emissive || new THREE.Color(0x000000);
            material.emissive.set(0x134f18);
            material.emissiveIntensity=0.22;
          }
        }
      }
    }
  });

  return model;
}

export function loadLandingSpaceModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/landingSpace/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/landingSpace/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeLandingSpaceModel(object)),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

export function makeMissionOutpostTerminal(bounds,options={}){
  let terminal=new THREE.Group();
  terminal.name="missionOutpostTerminal";

  let bodyMat=new THREE.MeshStandardMaterial({
    name:"terminal_body",
    color:0x263137,
    roughness:0.58,
    metalness:0.48
  });
  let darkMat=new THREE.MeshStandardMaterial({
    name:"terminal_dark",
    color:0x0c1114,
    roughness:0.78,
    metalness:0.34
  });
  let trimMat=new THREE.MeshStandardMaterial({
    name:"terminal_trim",
    color:0x8c9aa0,
    roughness:0.42,
    metalness:0.62
  });
  let screenMat=new THREE.MeshStandardMaterial({
    name:"terminal_screen",
    color:0x4df4ff,
    emissive:0x20d6ff,
    emissiveIntensity:1.8,
    roughness:0.12,
    metalness:0.04
  });
  let amberMat=new THREE.MeshStandardMaterial({
    name:"terminal_amber_light",
    color:0xffb13d,
    emissive:0xff7a18,
    emissiveIntensity:1.25,
    roughness:0.25,
    metalness:0.12
  });

  function box(name,w,h,d,material,x,y,z,rx=0,ry=0,rz=0){
    let mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.rotation.set(rx,ry,rz);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    terminal.add(mesh);
    return mesh;
  }

  function cyl(name,radius,depth,material,x,y,z,rx=0,ry=0,rz=0,segments=18){
    let mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,segments),material);
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.rotation.set(rx,ry,rz);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    terminal.add(mesh);
    return mesh;
  }

  let floorY=Number.isFinite(bounds.floorY) ? bounds.floorY : 0;
  let floorMinZ=Number.isFinite(bounds.floorMinZ) ? bounds.floorMinZ : -18;
  let floorMaxZ=Number.isFinite(bounds.floorMaxZ) ? bounds.floorMaxZ : 18;
  let floorMinX=Number.isFinite(bounds.floorMinX) ? bounds.floorMinX : -20;
  let floorMaxX=Number.isFinite(bounds.floorMaxX) ? bounds.floorMaxX : 20;
  let usableHalfX=Math.max(10,Math.min(Math.abs(floorMinX),Math.abs(floorMaxX)));
  let depth=Math.max(16,floorMaxZ-floorMinZ);
  let terminalStandOff=Math.min(18,Math.max(12,depth*0.28));
  let terminalInset=Number.isFinite(bounds.terminalInset) ? bounds.terminalInset : null;
  let z=Number.isFinite(terminalInset)
    ? Math.min(floorMaxZ-10,floorMinZ+terminalInset)
    : floorMinZ-terminalStandOff;
  let x=Math.min(usableHalfX-7,Math.max(-usableHalfX+7,-usableHalfX*0.36));
  let screenSide=Number.isFinite(terminalInset) ? 1 : -1;
  let screenTilt=-screenSide*0.34;

  terminal.position.set(x,floorY,z);
  terminal.rotation.y=0;

  box("terminal_base",5.8,1.1,4.2,bodyMat,0,0.55,0);
  box("terminal_column",2.4,3.6,2.2,darkMat,0,2.35,-0.18);
  box("terminal_console_slab",6.8,0.7,4.1,bodyMat,0,4.15,0.45,-0.22,0,0);
  box("terminal_screen_frame",5.9,3.4,0.5,bodyMat,0,5.95,screenSide*1.05,screenTilt,0,0);
  box("terminal_screen",4.95,2.35,0.12,screenMat,0,6.03,screenSide*1.34,screenTilt,0,0);
  box("terminal_keyboard",5.6,0.18,1.35,darkMat,0,4.65,1.36,-0.22,0,0);

  for(let i=0;i<5;i++){
    box(`terminal_key_${i}`,0.62,0.14,0.34,trimMat,-1.75+i*0.88,4.8,1.12,-0.22,0,0);
  }

  cyl("terminal_left_handle",0.18,3.4,trimMat,-3.55,5.18,-0.18,0,0,0,14);
  cyl("terminal_right_handle",0.18,3.4,trimMat,3.55,5.18,-0.18,0,0,0,14);
  cyl("terminal_status_light_a",0.28,0.18,amberMat,-2.35,4.92,1.95,Math.PI/2,0,0,16);
  cyl("terminal_status_light_b",0.2,0.16,screenMat,2.55,4.9,1.94,Math.PI/2,0,0,16);
  cyl("terminal_floor_cable",0.1,5.4,darkMat,2.8,0.15,-1.1,Math.PI/2,0,0,10);

  if(options.lights!==false){
    let glow=new THREE.PointLight(0x35eaff,1.25,18,2.2);
    glow.name="terminal_screen_glow";
    glow.position.set(0,6.2,screenSide*1.0);
    terminal.add(glow);
  }

  return terminal;
}

function makeBaseStationStandingLights(bounds={}){
  let lights=new THREE.Group();
  lights.name="base_station_standing_lights";

  let housingMat=new THREE.MeshStandardMaterial({
    name:"base_station_standing_light_housing",
    color:0x1e2b31,
    roughness:0.48,
    metalness:0.55
  });
  let panelMat=new THREE.MeshStandardMaterial({
    name:"base_station_standing_light_panel",
    color:0xf4ffff,
    emissive:0xbdfcff,
    emissiveIntensity:7.5,
    roughness:0.18,
    metalness:0.04
  });
  let floorGlowMat=new THREE.MeshBasicMaterial({
    name:"base_station_standing_light_floor_reflection",
    color:0x9ff7ff,
    transparent:true,
    opacity:0.34,
    depthWrite:false,
    blending:THREE.AdditiveBlending
  });

  function box(name,width,height,depth,material,x,y,z){
    let mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.castShadow=false;
    mesh.receiveShadow=false;
    lights.add(mesh);
    return mesh;
  }

  function cyl(name,radius,depth,material,x,y,z,segments=20){
    let mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,segments),material);
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    lights.add(mesh);
    return mesh;
  }

  function floorGlow(x,z){
    let mesh=new THREE.Mesh(new THREE.CircleGeometry(2.8,36),floorGlowMat);
    mesh.name="base_station_standing_light_floor_reflection";
    mesh.position.set(x,floorY+0.035,z);
    mesh.rotation.x=-Math.PI/2;
    mesh.castShadow=false;
    mesh.receiveShadow=false;
    lights.add(mesh);
    return mesh;
  }

  let floorY=Number.isFinite(bounds.floorY) ? bounds.floorY : 0;
  let floorMinX=Number.isFinite(bounds.floorMinX) ? bounds.floorMinX : -20;
  let floorMaxX=Number.isFinite(bounds.floorMaxX) ? bounds.floorMaxX : 20;
  let floorMinZ=Number.isFinite(bounds.floorMinZ) ? bounds.floorMinZ : -20;
  let floorMaxZ=Number.isFinite(bounds.floorMaxZ) ? bounds.floorMaxZ : 20;
  let ceilingY=Number.isFinite(bounds.ceilingY) ? bounds.ceilingY : floorY+11.5;
  let leftWallX=Number.isFinite(bounds.wallLeftX) ? bounds.wallLeftX+2.6 : floorMinX+2.8;
  let rightWallX=Number.isFinite(bounds.wallRightX) ? bounds.wallRightX-2.6 : floorMaxX-2.8;
  let depth=Math.max(18,floorMaxZ-floorMinZ);
  let lampHeight=Math.max(3.8,Math.min(5.2,ceilingY-floorY-2.4));
  let tubeHeight=lampHeight*0.62;
  let tubeY=floorY+0.36+lampHeight-tubeHeight*0.5;
  let rows=[floorMinZ+depth*0.27,floorMinZ+depth*0.5,floorMinZ+depth*0.73];
  let sides=[
    {x:leftWallX,glowX:leftWallX+0.9},
    {x:rightWallX,glowX:rightWallX-0.9}
  ];

  for(let side of sides){
    for(let z of rows){
      cyl("base_station_standing_light_base",0.72,0.24,housingMat,side.x,floorY+0.12,z,24);
      cyl("base_station_standing_light_pole",0.12,lampHeight,housingMat,side.x,floorY+0.36+lampHeight*0.5,z,14);
      cyl("base_station_standing_light_tube",0.34,tubeHeight,panelMat,side.x,tubeY,z,24);
      box("base_station_standing_light_cap",0.78,0.16,0.78,housingMat,side.x,tubeY+tubeHeight*0.5+0.12,z);
      box("base_station_standing_light_cap",0.78,0.16,0.78,housingMat,side.x,tubeY-tubeHeight*0.5-0.12,z);
      floorGlow(side.x,z);

      let glow=new THREE.PointLight(0xd9ffff,2.8,42,1.85);
      glow.name="base_station_standing_light_glow";
      glow.position.set(side.glowX,tubeY,z);
      glow.castShadow=false;
      lights.add(glow);

      let floorBounce=new THREE.PointLight(0x9ff7ff,0.75,16,2.4);
      floorBounce.name="base_station_standing_light_floor_bounce";
      floorBounce.position.set(side.x,floorY+0.45,z);
      floorBounce.castShadow=false;
      lights.add(floorBounce);
    }
  }

  return lights;
}

export function normalizeTradingOutpostModel(outpost,options={}){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  outpost.rotation.x=-Math.PI/2;
  asset.add(outpost);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=86/Math.max(size.x,size.z,0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);
  asset.position.x-=center.x/scale;
  asset.position.z-=center.z/scale;
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  asset.position.y-=box.min.y/scale;
  box.setFromObject(model);
  box.getSize(size);

  model.userData.footprintHalfX=size.x*0.5;
  model.userData.footprintHalfZ=size.z*0.5;

  model.updateMatrixWorld(true);
  let wallBounds=new THREE.Box3();
  let floorBounds=new THREE.Box3();
  let hasWallBounds=false;
  let hasFloorBounds=false;
  let leftWallInnerX=-Infinity;
  let rightWallInnerX=Infinity;
  let minZWallInnerZ=-Infinity;
  let maxZWallInnerZ=Infinity;
  let wallSegments=[];
  let includeStructuralSolids=options.structuralCollision!==false && !options.standingLights;

  function addCollisionPrimitive(childBox,childSize){
    let centerX=(childBox.min.x+childBox.max.x)*0.5;
    let centerZ=(childBox.min.z+childBox.max.z)*0.5;
    let longer=Math.max(childSize.x,childSize.z);
    let shorter=Math.min(childSize.x,childSize.z);

    if(longer>3.2 && shorter>0.2 && longer>shorter*1.35){
      if(childSize.x>=childSize.z){
        wallSegments.push({
          ax:childBox.min.x,
          az:centerZ,
          bx:childBox.max.x,
          bz:centerZ,
          r:Math.max(0.85,Math.min(2.6,childSize.z*0.5+0.32))
        });
      }else{
        wallSegments.push({
          ax:centerX,
          az:childBox.min.z,
          bx:centerX,
          bz:childBox.max.z,
          r:Math.max(0.85,Math.min(2.6,childSize.x*0.5+0.32))
        });
      }
    }else if(childSize.y>2.8 && childSize.x>0.45 && childSize.z>0.45){
      wallSegments.push({
        kind:"rect",
        minX:childBox.min.x,
        maxX:childBox.max.x,
        minZ:childBox.min.z,
        maxZ:childBox.max.z
      });
    }
  }

  model.traverse(child=>{
    if(!child.isMesh || !child.material) return;

    let childBox=new THREE.Box3().setFromObject(child);
    let childSize=new THREE.Vector3();
    childBox.getSize(childSize);
    let materials=Array.isArray(child.material) ? child.material : [child.material];
    let materialNames=materials.map(material=>material && material.name);
    let floorLike=childBox.min.y<2.1 && childSize.y<2.2 && (childSize.x>18 || childSize.z>18);
    let wallMaterial=materialNames.includes("color_7720667");
    let playerHeightSolid=childBox.min.y<30
      && childBox.max.y>1.2
      && childSize.y>4.2
      && childSize.x>1.05
      && childSize.z>1.05;

    if(wallMaterial){
      wallBounds.union(childBox);
      hasWallBounds=true;
      addCollisionPrimitive(childBox,childSize);
      if(childSize.x<childSize.z){
        if(childBox.max.x<0) leftWallInnerX=Math.max(leftWallInnerX,childBox.max.x);
        if(childBox.min.x>0) rightWallInnerX=Math.min(rightWallInnerX,childBox.min.x);
      }else if(childSize.z<childSize.x){
        if(childBox.max.z<0) minZWallInnerZ=Math.max(minZWallInnerZ,childBox.max.z);
        if(childBox.min.z>0) maxZWallInnerZ=Math.min(maxZWallInnerZ,childBox.min.z);
      }
    }
    if(includeStructuralSolids && !wallMaterial && !floorLike && playerHeightSolid) addCollisionPrimitive(childBox,childSize);
    if(floorLike){
      floorBounds.union(childBox);
      hasFloorBounds=true;
    }
  });

  if(hasWallBounds || hasFloorBounds){
    let floorY=hasFloorBounds ? floorBounds.max.y : 0;
    model.userData.tradingOutpostBounds={
      wallMinX:hasWallBounds ? wallBounds.min.x : -model.userData.footprintHalfX,
      wallMaxX:hasWallBounds ? wallBounds.max.x : model.userData.footprintHalfX,
      wallMinZ:hasWallBounds ? wallBounds.min.z : -model.userData.footprintHalfZ,
      wallMaxZ:hasWallBounds ? wallBounds.max.z : model.userData.footprintHalfZ,
      wallLeftX:Number.isFinite(leftWallInnerX) ? leftWallInnerX : wallBounds.min.x,
      wallRightX:Number.isFinite(rightWallInnerX) ? rightWallInnerX : wallBounds.max.x,
      wallMinZInner:Number.isFinite(minZWallInnerZ) ? minZWallInnerZ : wallBounds.min.z,
      wallMaxZInner:Number.isFinite(maxZWallInnerZ) ? maxZWallInnerZ : wallBounds.max.z,
      floorMinX:hasFloorBounds ? floorBounds.min.x : -model.userData.footprintHalfX,
      floorMaxX:hasFloorBounds ? floorBounds.max.x : model.userData.footprintHalfX,
      floorMinZ:hasFloorBounds ? floorBounds.min.z : -model.userData.footprintHalfZ,
      floorMaxZ:hasFloorBounds ? floorBounds.max.z : model.userData.footprintHalfZ,
      floorY,
      ceilingY:hasWallBounds ? Math.max(floorY+7,wallBounds.max.y-1.4) : floorY+11.5,
      wallSegments,
      terminalInset:Number.isFinite(options.terminalInset) ? options.terminalInset : null
    };
  }

  model.add(makeMissionOutpostTerminal(model.userData.tradingOutpostBounds || {}));
  if(options.standingLights) model.add(makeBaseStationStandingLights(model.userData.tradingOutpostBounds || {}));

  model.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(child.geometry) child.geometry.computeVertexNormals();
      if(child.material){
        let materials=Array.isArray(child.material) ? child.material : [child.material];
        for(let material of materials){
          material.side=THREE.FrontSide;
          material.roughness=material.roughness ?? 0.62;
          material.metalness=material.metalness ?? 0.2;
          if(material.name==="color_7720667" || material.name==="color_11593967"){
            material.transparent=true;
            material.opacity=0.72;
            material.depthWrite=false;
            material.roughness=0.14;
            material.metalness=0.08;
            if(material.emissive) material.emissive.set(0x124b55);
            material.emissiveIntensity=0.28;
          }
          if(material.name==="color_14900002"){
            if(material.emissive) material.emissive.set(0x4a1606);
            material.emissiveIntensity=0.18;
          }
        }
      }
    }
  });

  return model;
}

export function loadTradingOutpostModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/tradingOutposts/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/tradingOutposts/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeTradingOutpostModel(object)),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

export function loadBaseStationModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/baseStation/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/baseStation/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeTradingOutpostModel(object,{standingLights:true,terminalInset:16})),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

export function normalizeBackPackModel(backPack){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  backPack.rotation.x=-Math.PI/2;
  asset.add(backPack);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=1.82/Math.max(size.x,size.y,size.z,0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);
  asset.position.x-=center.x/scale;
  asset.position.y-=center.y/scale;
  asset.position.z-=center.z/scale;

  model.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(child.geometry) child.geometry.computeVertexNormals();
      if(child.material){
        let materials=Array.isArray(child.material) ? child.material : [child.material];
        for(let material of materials){
          material.side=THREE.FrontSide;
          material.roughness=material.roughness ?? 0.58;
          material.metalness=material.metalness ?? 0.28;
        }
      }
    }
  });

  model.name="player-backpack";
  return model;
}

export function loadBackPackModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/backPacks/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/backPacks/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeBackPackModel(object)),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

export function normalizeTreasureChestModel(chest,type="common"){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  chest.rotation.x=-Math.PI/2;
  asset.add(chest);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=4.6/Math.max(size.x,size.y,size.z,0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);
  asset.position.x-=center.x/scale;
  asset.position.z-=center.z/scale;
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  asset.position.y-=box.min.y/scale;

  model.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(child.geometry) child.geometry.computeVertexNormals();
      if(child.material){
        let materials=Array.isArray(child.material) ? child.material : [child.material];
        for(let material of materials){
          material.side=THREE.FrontSide;
          material.roughness=material.roughness ?? 0.54;
          material.metalness=material.metalness ?? 0.22;
        }
      }
    }
  });

  model.name=`treasure-chest-${type}`;
  model.userData.treasureType=type;
  return model;
}

export function loadTreasureChestModels(){
  let types=["common","normal","rare"];

  function loadTreasureChestModel(type){
    let path=`assets/treasures/${type}/`;
    let mtlLoader=new MTLLoader();
    mtlLoader.setPath(path);

    return new Promise((resolve,reject)=>{
      mtlLoader.load(
        "obj.mtl",
        materials=>{
          materials.preload();

          let objLoader=new OBJLoader();
          objLoader.setPath(path);
          objLoader.setMaterials(materials);
          objLoader.load(
            "tinker.obj",
            object=>resolve(normalizeTreasureChestModel(object,type)),
            undefined,
            reject
          );
        },
        undefined,
        reject
      );
    });
  }

  return Promise.all(types.map(loadTreasureChestModel));
}

export function makeMechModel(accentColor=0xb83a32,options={}){
  let mech=new THREE.Group();
  let walkParts={left:{},right:{}};
  let robotDust=Boolean(options.dust);

  let armorMat=new THREE.MeshStandardMaterial({
    color:0x3f474a,
    roughness:0.58,
    metalness:0.55
  });
  let darkMat=new THREE.MeshStandardMaterial({
    color:0x171b1d,
    roughness:0.86,
    metalness:0.35
  });
  let accentMat=new THREE.MeshStandardMaterial({
    color:accentColor,
    roughness:0.44,
    metalness:0.4
  });
  let jointMat=new THREE.MeshStandardMaterial({
    color:0x0d0f10,
    roughness:0.72,
    metalness:0.75
  });
  let glassMat=new THREE.MeshStandardMaterial({
    color:0x78d7ff,
    emissive:0x0a3a52,
    emissiveIntensity:0.7,
    roughness:0.12,
    metalness:0.08
  });

  function roundedRobotBoxGeometry(w,h,d){
    let minSide=Math.min(w,h,d);
    let radius=Math.max(0.018,Math.min(0.16,minSide*0.22));
    radius=Math.min(radius,minSide*0.45);
    return new RoundedBoxGeometry(w,h,d,3,radius);
  }

  function box(name,w,h,d,material,x,y,z,rx=0,ry=0,rz=0){
    let mesh=new THREE.Mesh(roundedRobotBoxGeometry(w,h,d),material);
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.rotation.set(rx,ry,rz);
    mech.add(mesh);
    return mesh;
  }

  function cylinder(name,radius,depth,material,x,y,z,rx=0,ry=0,rz=0,segments=16){
    let mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,segments),material);
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.rotation.set(rx,ry,rz);
    mech.add(mesh);
    return mesh;
  }

  box("pelvis",1.55,0.72,1.05,darkMat,0,2.05,0);
  box("torso",2.25,1.7,1.35,armorMat,0,3.25,0.08,-0.08,0,0);
  box("chest-plate",2.0,0.62,0.18,accentMat,0,3.55,0.78,-0.12,0,0);
  box("cockpit",0.9,0.58,0.16,glassMat,0,3.85,0.86,-0.18,0,0);
  box("reactor-pack",1.45,1.2,0.42,darkMat,0,3.28,-0.72,0.05,0,0);

  walkParts.torso=mech.getObjectByName("torso");
  walkParts.pelvis=mech.getObjectByName("pelvis");
  walkParts.chestPlate=mech.getObjectByName("chest-plate");
  walkParts.cockpit=mech.getObjectByName("cockpit");
  walkParts.reactorPack=mech.getObjectByName("reactor-pack");

  for(let side of [-1,1]){
    let sideName=side<0 ? "left" : "right";
    let parts=walkParts[sideName];
    parts.shoulder=box(`${sideName}-shoulder`,0.72,0.62,0.92,armorMat,side*1.36,3.55,0.03,0,0,side*0.08);
    parts.upperArm=box(`${sideName}-upper-arm`,0.42,0.92,0.5,darkMat,side*1.72,2.92,0.02,0,0,side*0.14);
    parts.elbow=cylinder(`${sideName}-elbow`,0.23,0.5,jointMat,side*1.76,2.42,0.03,Math.PI/2,0,0,14);
    parts.forearm=box(`${sideName}-forearm`,0.5,0.88,0.58,armorMat,side*1.8,1.95,0.08,0,0,side*-0.08);
    parts.hand=box(`${sideName}-hand`,0.45,0.28,0.52,darkMat,side*1.82,1.38,0.18);

    let cannon=cylinder(`${sideName}-arm-cannon`,0.16,1.45,darkMat,side*1.84,1.94,0.82,Math.PI/2,0,0,18);
    cannon.scale.x=0.75;
    parts.cannon=cannon;
    parts.cannonShroud=box(`${sideName}-cannon-shroud`,0.48,0.28,0.46,accentMat,side*1.84,2.08,0.48);

    parts.hip=cylinder(`${sideName}-hip-joint`,0.3,0.65,jointMat,side*0.72,1.72,0,0,0,Math.PI/2,16);
    parts.upperLeg=box(`${sideName}-upper-leg`,0.55,1.12,0.62,armorMat,side*0.72,1.12,0.05,0,0,side*0.05);
    parts.knee=cylinder(`${sideName}-knee`,0.26,0.58,jointMat,side*0.72,0.48,0.05,0,0,Math.PI/2,16);
    parts.shin=box(`${sideName}-shin`,0.62,1.05,0.56,darkMat,side*0.72,-0.02,0.08,0,0,side*-0.04);
    parts.kneePlate=box(`${sideName}-knee-plate`,0.58,0.28,0.16,accentMat,side*0.72,0.52,0.45,-0.18,0,0);
    parts.foot=box(`${sideName}-foot`,0.78,0.28,1.28,armorMat,side*0.72,-0.68,0.28,0,0,side*0.03);
    parts.toePlate=box(`${sideName}-toe-plate`,0.72,0.16,0.52,accentMat,side*0.72,-0.52,0.95,0.08,0,0);

    parts.frontWheel=cylinder(`${sideName}-front-wheel`,0.32,0.24,darkMat,side*1.72,3.18,-0.48,0,0,Math.PI/2,20);
    parts.frontHub=cylinder(`${sideName}-front-hub`,0.17,0.28,accentMat,side*1.73,3.18,-0.48,0,0,Math.PI/2,16);
    parts.rearWheel=cylinder(`${sideName}-rear-wheel`,0.36,0.26,darkMat,side*0.96,-0.08,-0.18,0,0,Math.PI/2,20);
    parts.rearHub=cylinder(`${sideName}-rear-hub`,0.18,0.3,accentMat,side*0.97,-0.08,-0.18,0,0,Math.PI/2,16);
    parts.frontWheel.visible=false;
    parts.frontHub.visible=false;
    parts.rearWheel.visible=false;
    parts.rearHub.visible=false;
  }

  cylinder("neck",0.22,0.38,jointMat,0,4.22,0.05,0,0,0,14);
  box("head",0.9,0.5,0.72,armorMat,0,4.52,0.12,-0.04,0,0);
  box("visor",0.68,0.16,0.08,glassMat,0,4.56,0.51);
  cylinder("antenna",0.035,0.78,darkMat,0.38,4.92,0.02,0.1,0,0,8);
  walkParts.neck=mech.getObjectByName("neck");
  walkParts.head=mech.getObjectByName("head");
  walkParts.visor=mech.getObjectByName("visor");
  walkParts.antenna=mech.getObjectByName("antenna");

  mech.scale.set(1.05,1.05,1.05);
  mech.position.y=0.72;
  mech.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(child.geometry) child.geometry.computeVertexNormals();
      child.userData.basePosition=child.position.clone();
      child.userData.baseRotation=child.rotation.clone();
      child.userData.baseScale=child.scale.clone();
      if(robotDust && child.material && shouldDustRobotMesh(child)){
        child.material=addPatchyCarDust(child.material,child.id*0.43+2.7,robotDustPatchOptions);
      }
    }
  });
  mech.userData.walkParts=walkParts;
  mech.userData.baseY=mech.position.y;

  return mech;
}

export function makeHovercraftModel(accentColor=0xb83a32){
  let hovercraft=new THREE.Group();

  let armorMat=new THREE.MeshStandardMaterial({
    color:0x465052,
    roughness:0.52,
    metalness:0.58
  });
  let darkMat=new THREE.MeshStandardMaterial({
    color:0x101517,
    roughness:0.76,
    metalness:0.42
  });
  let accentMat=new THREE.MeshStandardMaterial({
    color:accentColor,
    roughness:0.38,
    metalness:0.42
  });
  let glassMat=new THREE.MeshStandardMaterial({
    color:0x78d7ff,
    emissive:0x0a3a52,
    emissiveIntensity:0.85,
    roughness:0.12,
    metalness:0.08
  });
  let cushionMat=new THREE.MeshStandardMaterial({
    color:0x141918,
    roughness:0.88,
    metalness:0.16
  });
  let glowMat=new THREE.MeshBasicMaterial({
    color:accentColor,
    transparent:true,
    opacity:0.56,
    depthWrite:false,
    blending:THREE.AdditiveBlending
  });
  let dirtMat=new THREE.MeshStandardMaterial({
    color:0x8b7750,
    roughness:0.98,
    metalness:0.02,
    side:THREE.DoubleSide
  });
  let darkDirtMat=new THREE.MeshStandardMaterial({
    color:0x4c412e,
    roughness:1,
    metalness:0,
    side:THREE.DoubleSide
  });
  let dirtPatchGeo=new THREE.DodecahedronGeometry(1,0);
  let dirtScratchGeo=new THREE.BoxGeometry(1,1,1);

  function add(mesh){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    if(mesh.geometry) mesh.geometry.computeVertexNormals();
    hovercraft.add(mesh);
    return mesh;
  }

  function addGlow(mesh){
    mesh.castShadow=false;
    mesh.receiveShadow=false;
    hovercraft.add(mesh);
    return mesh;
  }

  function addDirtPatch(name,x,y,z,sx,sy,sz,rotationY=0,material=dirtMat){
    let patch=addGlow(new THREE.Mesh(dirtPatchGeo,material));
    patch.name=name;
    patch.position.set(x,y,z);
    patch.rotation.y=rotationY;
    patch.scale.set(sx,sy,sz);
    return patch;
  }

  function addDirtScratch(name,x,y,z,sx,sy,sz,rotationY=0,material=darkDirtMat){
    let scratch=addGlow(new THREE.Mesh(dirtScratchGeo,material));
    scratch.name=name;
    scratch.position.set(x,y,z);
    scratch.rotation.y=rotationY;
    scratch.scale.set(sx,sy,sz);
    return scratch;
  }

  let skirt=add(new THREE.Mesh(new THREE.CylinderGeometry(1.62,1.92,0.46,18),cushionMat));
  skirt.name="hovercraft-air-skirt";
  skirt.scale.set(1.08,1,1.55);
  skirt.position.set(0,0.28,0);

  addHovercraftMothershipPropulsion(
    hovercraft,
    addGlow,
    (mesh,x,y,z,sx,sy,sz,rotationY=0)=>{
      mesh.position.set(x,y,z);
      mesh.rotation.y=rotationY;
      mesh.scale.set(sx,sy,sz);
    },
    accentColor
  );

  let lowerHull=add(new THREE.Mesh(new THREE.BoxGeometry(2.96,0.42,4.4),armorMat));
  lowerHull.name="hovercraft-lower-hull";
  lowerHull.position.set(0,0.58,0);

  let upperHull=add(new THREE.Mesh(new THREE.BoxGeometry(2.18,0.5,3.36),armorMat));
  upperHull.name="hovercraft-upper-hull";
  upperHull.position.set(0,0.94,0.18);

  let bow=add(new THREE.Mesh(new THREE.ConeGeometry(1.12,1.14,4),accentMat));
  bow.name="hovercraft-armored-bow";
  bow.rotation.x=Math.PI/2;
  bow.rotation.z=Math.PI/4;
  bow.position.set(0,0.84,2.42);

  let cockpit=add(new THREE.Mesh(new THREE.BoxGeometry(1.04,0.42,0.98),glassMat));
  cockpit.name="hovercraft-cockpit";
  cockpit.position.set(0,1.36,0.98);
  cockpit.rotation.x=-0.08;

  let noseWindow=add(new THREE.Mesh(new THREE.BoxGeometry(0.82,0.12,0.08),glassMat));
  noseWindow.name="hovercraft-front-visor";
  noseWindow.position.set(0,1.34,1.5);
  noseWindow.rotation.x=-0.18;

  let rearDeck=add(new THREE.Mesh(new THREE.BoxGeometry(2.28,0.18,1.12),darkMat));
  rearDeck.name="hovercraft-rear-deck";
  rearDeck.position.set(0,1.18,-1.3);

  for(let side of [-1,1]){
    let pontoon=add(new THREE.Mesh(new THREE.BoxGeometry(0.54,0.52,4.7),cushionMat));
    pontoon.name=side<0 ? "hovercraft-left-skirt-rail" : "hovercraft-right-skirt-rail";
    pontoon.position.set(side*1.58,0.38,-0.02);

    let sideArmor=add(new THREE.Mesh(new THREE.BoxGeometry(0.34,0.26,3.52),accentMat));
    sideArmor.name=side<0 ? "hovercraft-left-side-armor" : "hovercraft-right-side-armor";
    sideArmor.position.set(side*1.46,0.78,0.08);

    let liftFan=add(new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.48,0.22,24),darkMat));
    liftFan.name=side<0 ? "hovercraft-left-lift-fan" : "hovercraft-right-lift-fan";
    liftFan.position.set(side*0.72,0.32,0.22);

    let duct=add(new THREE.Mesh(new THREE.TorusGeometry(0.52,0.08,12,28),darkMat));
    duct.name=side<0 ? "hovercraft-left-rear-duct" : "hovercraft-right-rear-duct";
    duct.position.set(side*0.72,1.34,-2.16);

    let fanHub=add(new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.16,16),accentMat));
    fanHub.name=side<0 ? "hovercraft-left-fan-hub" : "hovercraft-right-fan-hub";
    fanHub.rotation.x=Math.PI/2;
    fanHub.position.set(side*0.72,1.34,-2.16);

    for(let blade=0;blade<3;blade++){
      let fanBlade=add(new THREE.Mesh(new THREE.BoxGeometry(0.72,0.05,0.12),armorMat));
      fanBlade.name=`hovercraft-${side<0 ? "left" : "right"}-fan-blade-${blade}`;
      fanBlade.position.set(side*0.72,1.34,-2.16);
      fanBlade.rotation.z=blade*Math.PI*2/3;
    }

    let tailFin=add(new THREE.Mesh(new THREE.BoxGeometry(0.16,0.82,0.66),accentMat));
    tailFin.name=side<0 ? "hovercraft-left-stabilizer" : "hovercraft-right-stabilizer";
    tailFin.position.set(side*1.18,1.2,-1.68);
    tailFin.rotation.z=-side*0.12;
  }

  for(let z of [-1.56,-0.56,0.54,1.54]){
    let vent=add(new THREE.Mesh(new THREE.BoxGeometry(1.52,0.045,0.12),darkMat));
    vent.name="hovercraft-deck-vent";
    vent.position.set(0,1.42,z);
  }

  let headlight=add(new THREE.Mesh(new THREE.BoxGeometry(0.98,0.08,0.08),glowMat));
  headlight.name="hovercraft-forward-light";
  headlight.position.set(0,0.86,2.98);

  addDirtPatch("hovercraft-front-left-dirt",-.72,1.205,1.62,.28,.012,.15,-0.18);
  addDirtPatch("hovercraft-front-right-dirt",.58,1.205,1.48,.22,.012,.12,0.42,darkDirtMat);
  addDirtPatch("hovercraft-center-dirt",-.18,1.205,.36,.36,.012,.18,0.12);
  addDirtPatch("hovercraft-rear-deck-dirt",.52,1.285,-1.34,.42,.012,.16,-0.34);
  addDirtPatch("hovercraft-rear-corner-dirt",-.84,1.285,-1.7,.26,.012,.12,0.38,darkDirtMat);
  addDirtPatch("hovercraft-bow-dirt",.24,.96,2.58,.24,.01,.12,-0.08);
  addDirtPatch("hovercraft-left-skirt-dirt",-1.61,.68,.96,.09,.012,.36,0.06,darkDirtMat);
  addDirtPatch("hovercraft-right-skirt-dirt",1.61,.68,.42,.08,.012,.3,-0.12);
  addDirtPatch("hovercraft-left-rear-skirt-dirt",-1.61,.68,-1.32,.08,.012,.32,0.18);
  addDirtPatch("hovercraft-right-rear-skirt-dirt",1.61,.68,-1.68,.1,.012,.24,-0.28,darkDirtMat);
  addDirtScratch("hovercraft-front-scuff",-.36,1.218,1.04,.34,.014,.028,0.22,darkDirtMat);
  addDirtScratch("hovercraft-side-scuff-left",-1.655,.79,-.54,.022,.035,.48,0,darkDirtMat);
  addDirtScratch("hovercraft-side-scuff-right",1.655,.79,-.18,.022,.035,.38,0,darkDirtMat);
  addDirtScratch("hovercraft-rear-scuff",.2,1.292,-1.86,.46,.014,.026,-0.14,darkDirtMat);

  hovercraft.traverse(child=>{
    if(!child.isMesh || !child.material) return;
    let materials=Array.isArray(child.material) ? child.material : [child.material];
    for(let i=0;i<materials.length;i++){
      let material=materials[i];
      if(shouldDustHovercraftMesh(child,material)){
        materials[i]=addPatchyCarDust(material,child.id*0.41+i*1.73+4.6,hovercraftDirtPatchOptions);
      }
    }
    child.material=Array.isArray(child.material) ? materials : materials[0];
  });

  hovercraft.name="player-hovercraft";
  hovercraft.scale.set(1.22,1.22,1.22);
  hovercraft.position.y=0.38;
  hovercraft.visible=false;
  hovercraft.userData.baseY=hovercraft.position.y;
  hovercraft.userData.baseScale=hovercraft.scale.clone();

  return hovercraft;
}

export function makeJetModel(accentColor=0xb83a32){
  return makeHovercraftModel(accentColor);
}
