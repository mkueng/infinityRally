import { MTLLoader, OBJLoader, THREE } from "./three.js";
import { carModelPath } from "./assetPaths.js";

export function makeReflectiveCarMaterial(source){
  let color=(source && source.color) ? source.color.clone() : new THREE.Color(0xffffff);
  let isRed=color.r>0.65 && color.g<0.25 && color.b<0.3;
  let isGlass=color.b>0.45 && color.g>0.45 && color.r<0.6;
  let isDark=color.r+color.g+color.b<0.75;
  let isLight=color.r+color.g+color.b>2.1;
  let material;

  if(isGlass){
    material=new THREE.MeshPhysicalMaterial({
      color,
      roughness:0.02,
      metalness:0,
      clearcoat:1,
      clearcoatRoughness:0.02,
      transparent:true,
      opacity:0.62
    });
  }else if(isRed){
    material=new THREE.MeshPhysicalMaterial({
      color,
      roughness:0.18,
      metalness:0.08,
      clearcoat:1,
      clearcoatRoughness:0.04
    });
  }else if(isDark){
    material=new THREE.MeshStandardMaterial({
      color,
      roughness:0.38,
      metalness:0.12
    });
  }else{
    material=new THREE.MeshPhysicalMaterial({
      color,
      roughness:isLight ? 0.16 : 0.24,
      metalness:isLight ? 0.35 : 0.65,
      clearcoat:0.45,
      clearcoatRoughness:0.08
    });
  }

  material.side=THREE.FrontSide;
  material.envMapIntensity=0.7;
  return material;
}

export function normalizeLoadedCarModel(car){
  let model=new THREE.Group();
  car.rotation.x=-Math.PI/2;
  model.rotation.y=Math.PI/2;
  model.add(car);
  car=model;
  car.updateMatrixWorld(true);

  let box=new THREE.Box3().setFromObject(car);
  let size=new THREE.Vector3();
  let center=new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let targetLength=4.4;
  let scale=targetLength/Math.max(size.z,0.001);
  car.scale.setScalar(scale);
  car.updateMatrixWorld(true);

  box.setFromObject(car);
  box.getCenter(center);

  car.position.x-=center.x;
  car.position.z-=center.z;
  car.updateMatrixWorld(true);

  box.setFromObject(car);
  car.position.y-=box.min.y;

  car.traverse(child=>{
    if(child.isMesh){
      child.castShadow=true;
      child.receiveShadow=true;
      if(child.geometry){
        child.geometry.computeVertexNormals();
      }
      if(child.material){
        child.material=Array.isArray(child.material)
          ? child.material.map(makeReflectiveCarMaterial)
          : makeReflectiveCarMaterial(child.material);
      }
    }
  });

  return car;
}

export function loadCarModel(){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath(carModelPath);

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

          let objLoader=new OBJLoader();
          objLoader.setPath(carModelPath);
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeLoadedCarModel(object)),
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

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

export function makeFallbackCarModel(){
  let car=new THREE.Group();

  let paintMat=new THREE.MeshPhysicalMaterial({
    color:0xaa99A5,
    roughness:1.28,
    metalness:0.75,
    clearcoat:0.1,
    clearcoatRoughness:0.12
  });

  let darkMat=new THREE.MeshStandardMaterial({color:0x111111,roughness:0.95});
  let glassMat=new THREE.MeshStandardMaterial({
    color:0x87bfff,
    transparent:true,
    opacity:0.55,
    roughness:0.08,
    metalness:0.15
  });
  let rimMat=new THREE.MeshStandardMaterial({color:0xb8b8b8,roughness:0.35,metalness:0.95});

  // Main rounded body
  let bodyGeo=new THREE.CapsuleGeometry(1.15,3.6,6,18);
  let body=new THREE.Mesh(bodyGeo,paintMat);
  body.rotation.x=Math.PI/2;
  body.scale.set(1,0.52,1);
  body.position.y=0.95;
  car.add(body);

  // Lower side skirt for a flatter profile
  let skirtGeo=new THREE.CapsuleGeometry(1.05,3.0,4,14);
  let skirt=new THREE.Mesh(skirtGeo,paintMat);
  skirt.rotation.x=Math.PI/2;
  skirt.scale.set(1,0.22,1);
  skirt.position.y=0.45;
  car.add(skirt);

  // Cabin / roof
  let cabinGeo=new THREE.CapsuleGeometry(0.9,1.4,6,16);
  let cabin=new THREE.Mesh(cabinGeo,paintMat);
  cabin.rotation.x=Math.PI/2;
  cabin.scale.set(1,0.48,1);
  cabin.position.set(0,1.65,0.15);
  car.add(cabin);

  // Windshield and rear window
  let windshieldGeo=new THREE.BoxGeometry(1.7,0.7,0.08);
  let windshield=new THREE.Mesh(windshieldGeo,glassMat);
  windshield.position.set(0,1.55,-1.05);
  windshield.rotation.x=-0.35;
  car.add(windshield);

  let backGlass=new THREE.Mesh(windshieldGeo,glassMat);
  backGlass.position.set(0,1.55,1.05);
  backGlass.rotation.x=0.35;
  car.add(backGlass);

  // Front and rear bumpers
  let bumperGeo=new THREE.CylinderGeometry(0.18,0.18,1.55,14);
  let frontBumper=new THREE.Mesh(bumperGeo,darkMat);
  frontBumper.rotation.z=Math.PI/2;
  frontBumper.position.set(0,0.62,-1.95);
  car.add(frontBumper);

  let rearBumper=new THREE.Mesh(bumperGeo,darkMat);
  rearBumper.rotation.z=Math.PI/2;
  rearBumper.position.set(0,0.62,1.95);
  car.add(rearBumper);

  // Wheels with more rounded geometry
  let wheelGeo=new THREE.TorusGeometry(0.42,0.16,10,20);
  let wheelPositions=[[-0.95,0.42,-1.25],[0.95,0.42,-1.25],[-0.95,0.42,1.25],[0.95,0.42,1.25]];
  for(let pos of wheelPositions){
    let wheel=new THREE.Mesh(wheelGeo,darkMat);
    wheel.rotation.y=Math.PI/2;
    wheel.rotation.x=Math.PI/2;
    wheel.position.set(pos[0],pos[1],pos[2]);
    car.add(wheel);

    let rim=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.06,8,16),rimMat);
    rim.rotation.y=Math.PI/2;
    rim.rotation.x=Math.PI/2;
    rim.position.set(pos[0],pos[1],pos[2]);
    car.add(rim);
  }

  // Slight overall shaping so it feels more car-like
  car.scale.set(1.1,1.1,1.1);

  return car;
}
