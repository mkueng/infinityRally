import { MTLLoader, OBJLoader, THREE } from "./three.js";

export function normalizeGasStationModel(station){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  station.rotation.x=-Math.PI/2;
  asset.add(station);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=24/Math.max(size.x,size.z,0.001);
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
          material.roughness=material.roughness ?? 0.72;
        }
      }
    }
  });

  return model;
}

export function loadGasStationModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/gasStation/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/gasStation/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeGasStationModel(object)),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

export function normalizeGarageModel(garage){
  let model=new THREE.Group();
  let asset=new THREE.Group();
  garage.rotation.x=-Math.PI/2;
  asset.add(garage);
  model.add(asset);
  model.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(model);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=20/Math.max(size.x,size.z,0.001);
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
          material.roughness=material.roughness ?? 0.74;
        }
      }
    }
  });

  return model;
}

export function loadGarageModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/garage/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/garage/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeGarageModel(object)),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
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

  let scale=4.8/Math.max(size.x,size.z,0.001);
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
          material.roughness=material.roughness ?? 0.56;
          material.metalness=material.metalness ?? 0.24;
          if(material.name==="color_7720667"){
            material.transparent=true;
            material.opacity=0.46;
            material.depthWrite=false;
            material.roughness=0.14;
            material.metalness=0.08;
          }
        }
      }
    }
  });

  model.position.y=0.04;
  model.userData.baseY=model.position.y;
  model.userData.baseScale=model.scale.clone();

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

export function makeMechModel(accentColor=0xb83a32){
  let mech=new THREE.Group();
  let walkParts={left:{},right:{}};

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

  function box(name,w,h,d,material,x,y,z,rx=0,ry=0,rz=0){
    let mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
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
    parts.shoulder=box(`${sideName}-shoulder`,0.72,0.62,0.92,armorMat,side*1.55,3.55,0.03,0,0,side*0.08);
    parts.upperArm=box(`${sideName}-upper-arm`,0.42,0.92,0.5,darkMat,side*1.92,2.92,0.02,0,0,side*0.14);
    parts.elbow=cylinder(`${sideName}-elbow`,0.23,0.5,jointMat,side*1.96,2.42,0.03,Math.PI/2,0,0,14);
    parts.forearm=box(`${sideName}-forearm`,0.5,0.88,0.58,armorMat,side*2.0,1.95,0.08,0,0,side*-0.08);
    parts.hand=box(`${sideName}-hand`,0.45,0.28,0.52,darkMat,side*2.02,1.38,0.18);

    let cannon=cylinder(`${sideName}-arm-cannon`,0.16,1.45,darkMat,side*2.04,1.94,0.82,Math.PI/2,0,0,18);
    cannon.scale.x=0.75;
    parts.cannon=cannon;
    parts.cannonShroud=box(`${sideName}-cannon-shroud`,0.48,0.28,0.46,accentMat,side*2.04,2.08,0.48);

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
    }
  });
  mech.userData.walkParts=walkParts;
  mech.userData.baseY=mech.position.y;

  return mech;
}
