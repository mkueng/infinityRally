import { MTLLoader, OBJLoader, THREE } from "./three.js";

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

  let scale=5.016/Math.max(size.x,size.z,0.001);
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

export function loadJetModel(accentColor=0xb83a32){
  let mtlLoader=new MTLLoader();
  mtlLoader.setPath("assets/jets/");

  return new Promise((resolve,reject)=>{
    mtlLoader.load(
      "obj.mtl",
      materials=>{
        materials.preload();

        let objLoader=new OBJLoader();
        objLoader.setPath("assets/jets/");
        objLoader.setMaterials(materials);
        objLoader.load(
          "tinker.obj",
          object=>resolve(normalizeJetModel(object,accentColor)),
          undefined,
          reject
        );
      },
      undefined,
      reject
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
    }
  });
  mech.userData.walkParts=walkParts;
  mech.userData.baseY=mech.position.y;

  return mech;
}

export function makeJetModel(accentColor=0xb83a32){
  let jet=new THREE.Group();

  let armorMat=new THREE.MeshStandardMaterial({
    color:0x3f474a,
    roughness:0.5,
    metalness:0.62
  });
  let darkMat=new THREE.MeshStandardMaterial({
    color:0x111517,
    roughness:0.72,
    metalness:0.5
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

  function add(mesh){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    if(mesh.geometry) mesh.geometry.computeVertexNormals();
    jet.add(mesh);
    return mesh;
  }

  let body=add(new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.58,4.2,18),armorMat));
  body.name="jet-body";
  body.rotation.x=Math.PI/2;
  body.position.set(0,0.78,0.1);

  let nose=add(new THREE.Mesh(new THREE.ConeGeometry(0.43,1.15,18),accentMat));
  nose.name="jet-nose";
  nose.rotation.x=Math.PI/2;
  nose.position.set(0,0.78,2.76);

  let cockpit=add(new THREE.Mesh(new THREE.BoxGeometry(0.72,0.34,0.92),glassMat));
  cockpit.name="jet-cockpit";
  cockpit.position.set(0,1.18,1.22);
  cockpit.rotation.x=-0.18;

  let intake=add(new THREE.Mesh(new THREE.BoxGeometry(0.8,0.28,0.42),darkMat));
  intake.name="jet-intake";
  intake.position.set(0,0.48,1.2);

  for(let side of [-1,1]){
    let wing=add(new THREE.Mesh(new THREE.BoxGeometry(2.45,0.12,1.26),armorMat));
    wing.name=side<0 ? "jet-left-wing" : "jet-right-wing";
    wing.position.set(side*1.22,0.62,0.08);
    wing.rotation.y=-side*0.32;
    wing.rotation.z=-side*0.08;

    let wingTip=add(new THREE.Mesh(new THREE.BoxGeometry(0.78,0.1,0.28),accentMat));
    wingTip.name=side<0 ? "jet-left-wing-tip" : "jet-right-wing-tip";
    wingTip.position.set(side*2.38,0.58,-0.16);
    wingTip.rotation.y=-side*0.32;

    let tail=add(new THREE.Mesh(new THREE.BoxGeometry(0.22,1.0,0.78),accentMat));
    tail.name=side<0 ? "jet-left-tail-fin" : "jet-right-tail-fin";
    tail.position.set(side*0.54,1.1,-1.74);
    tail.rotation.z=-side*0.22;
  }

  let centerTail=add(new THREE.Mesh(new THREE.BoxGeometry(0.22,1.15,0.9),accentMat));
  centerTail.name="jet-center-tail-fin";
  centerTail.position.set(0,1.34,-1.82);
  centerTail.rotation.x=0.1;

  for(let side of [-1,1]){
    let thruster=add(new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.22,0.62,16),darkMat));
    thruster.name=side<0 ? "jet-left-thruster" : "jet-right-thruster";
    thruster.rotation.x=Math.PI/2;
    thruster.position.set(side*0.38,0.72,-2.16);
  }

  jet.scale.set(1.32,1.32,1.32);
  jet.position.y=0.45;
  jet.visible=false;
  jet.userData.baseY=jet.position.y;
  jet.userData.baseScale=jet.scale.clone();

  return jet;
}
