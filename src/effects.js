import { THREE } from "./three.js";
import { cloudCount } from "./constants.js";
import { makeCarShadowTexture, makeCloudTexture, makeDustTexture, makeHazeTexture } from "./textures.js?v=unclipped-cloud-variants";
import { groundHeight, rand } from "./terrain.js";

function normalizeTrackAngle(angle){
  while(angle>Math.PI) angle-=Math.PI*2;
  while(angle<-Math.PI) angle+=Math.PI*2;
  return angle;
}

export function createCarShadow(scene,options={}){
  let width=options.width || 4.8;
  let length=options.length || 7.0;
  let baseOpacity=options.opacity || 0.48;
  let minOpacity=options.minOpacity || Math.min(0.24,baseOpacity);
  let carShadowRoot=new THREE.Group();
  let carShadow=new THREE.Mesh(
    new THREE.PlaneGeometry(width,length),
    new THREE.MeshBasicMaterial({
      map:makeCarShadowTexture(),
      transparent:true,
      opacity:baseOpacity,
      depthWrite:false,
      depthTest:true,
      blending:THREE.NormalBlending,
      polygonOffset:true,
      polygonOffsetFactor:-1,
      polygonOffsetUnits:-1
    })
  );
  carShadow.rotation.x=-Math.PI/2;
  carShadow.renderOrder=1;
  carShadowRoot.add(carShadow);
  scene.add(carShadowRoot);

  function update({carX,carZ,carY,surfaceY,carVelAngle}){
    let shadowLift=Math.max(0,carY-surfaceY);
    carShadowRoot.position.set(carX,surfaceY+0.16,carZ);
    carShadowRoot.rotation.y=carVelAngle;
    carShadow.material.opacity=Math.max(minOpacity,baseOpacity-shadowLift*0.014);
    let shadowScale=1+Math.min(0.55,shadowLift*0.025);
    carShadow.scale.set(shadowScale,shadowScale,1);
  }

  function setVisible(visible){
    carShadowRoot.visible=visible;
  }

  function dispose(){
    scene.remove(carShadowRoot);
    carShadow.geometry.dispose();
    carShadow.material.dispose();
  }

  return {update,setVisible,dispose};
}

export function createClouds(scene,getCarPosition){
  let cloudGroup=new THREE.Group();
  scene.add(cloudGroup);
  let cloudSprites=[];
  let cloudTime=0;

  function clearClouds(){
    let oldMaps=new Set();
    for(let cloud of cloudSprites){
      cloudGroup.remove(cloud);
      if(cloud.material){
        if(cloud.material.map) oldMaps.add(cloud.material.map);
        cloud.material.dispose();
      }
    }
    for(let map of oldMaps) map.dispose();
    cloudSprites.length=0;
  }

  function makeClouds(){
    clearClouds();
    let cloudTextures=[
      makeCloudTexture(0),
      makeCloudTexture(1),
      makeCloudTexture(2),
      makeCloudTexture(3),
      makeCloudTexture(4)
    ];
    let cloudRange=12800;
    let cloudRand=(a,b)=>rand(a,b)*0.5+0.5;

    for(let i=0;i<cloudCount;i++){
      let sizeT=Math.pow(cloudRand(i*59,29),0.62);
      let aspectT=cloudRand(i*67,33);
      let textureIndex=Math.min(cloudTextures.length-1,Math.floor(cloudRand(i*101,97)*cloudTextures.length));
      let material=new THREE.SpriteMaterial({
        map:cloudTextures[textureIndex],
        color:0xffffff,
        transparent:true,
        opacity:0.032+cloudRand(i*17,91)*0.068,
        depthWrite:false,
        fog:false
      });
      material.rotation=(cloudRand(i*89,41)-0.5)*0.32;
      let cloud=new THREE.Sprite(material);
      let baseX=(cloudRand(i*23,7)-0.5)*cloudRange;
      let baseZ=(cloudRand(i*31,11)-0.5)*cloudRange;
      let baseY=165+cloudRand(i*43,19)*245;
      let width=(1450+sizeT*2550)*(0.86+aspectT*0.36);
      let height=(220+cloudRand(i*61,31)*420)*(0.84+(1-aspectT)*0.34);
      if(cloudRand(i*107,51)>0.78){
        width*=1.28+cloudRand(i*109,57)*0.32;
        height*=1.08+cloudRand(i*113,63)*0.18;
      }
      let windAngle=-0.45+cloudRand(i*73,47)*0.35;
      let windSpeed=18+cloudRand(i*71,37)*16;

      cloud.position.set(baseX,baseY,baseZ);
      cloud.scale.set(width,height,1);
      cloud.userData={
        baseX,
        baseZ,
        baseY,
        width,
        height,
        windX:Math.cos(windAngle)*windSpeed,
        windZ:Math.sin(windAngle)*windSpeed,
        bobAmount:8+cloudRand(i*83,13)*18,
        bobSpeed:0.08+cloudRand(i*97,23)*0.08,
        phase:cloudRand(i*109,53)*Math.PI*2
      };
      cloudGroup.add(cloud);
      cloudSprites.push(cloud);
    }
  }

  function wrapCloudCoord(value,center,range){
    let half=range*0.5;
    while(value<center-half) value+=range;
    while(value>center+half) value-=range;
    return value;
  }

  function update(){
    let {carX,carZ}=getCarPosition();
    cloudTime+=0.016;
    let range=12800;

    for(let cloud of cloudSprites){
      let data=cloud.userData;
      let x=wrapCloudCoord(data.baseX+cloudTime*data.windX,carX,range);
      let z=wrapCloudCoord(
        data.baseZ+cloudTime*data.windZ+Math.sin(cloudTime*0.12+data.phase)*55,
        carZ,
        range
      );
      let y=data.baseY+Math.sin(cloudTime*data.bobSpeed+data.phase)*data.bobAmount;
      let dx=x-carX;
      let dz=z-carZ;
      let minDist=3600;
      if(dx*dx+dz*dz<minDist*minDist){
        let angle=Math.atan2(dz || 1,dx || 1);
        x=carX+Math.cos(angle)*minDist;
        z=carZ+Math.sin(angle)*minDist;
      }
      cloud.position.set(x,y,z);
    }
  }

  return {makeClouds,update,dispose:clearClouds};
}

export function createLowHangingHaze(scene,getCarPosition,getEnvironment=()=>({})){
  let hazeGroup=new THREE.Group();
  scene.add(hazeGroup);
  let hazeTime=0;
  let hazeTexture=makeHazeTexture();
  let cloudBankTexture=makeCloudTexture();
  let hazeRand=(a,b)=>rand(a,b)*0.5+0.5;
  let maxHazePuffs=320;
  let maxCloudBanks=260;
  let positions=new Float32Array(maxHazePuffs*3);
  let colors=new Float32Array(maxHazePuffs*3);
  let sizes=new Float32Array(maxHazePuffs);
  let opacities=new Float32Array(maxHazePuffs);
  let hazeData=[];
  let cloudBankData=[];
  let cloudBankSprites=[];
  let cloudBankUpdateFrame=0;
  let hazeColor=new THREE.Color(0xbfd7bd);
  let hazeGeometry=new THREE.BufferGeometry();
  hazeGeometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  hazeGeometry.setAttribute("particleColor",new THREE.BufferAttribute(colors,3));
  hazeGeometry.setAttribute("particleSize",new THREE.BufferAttribute(sizes,1));
  hazeGeometry.setAttribute("particleOpacity",new THREE.BufferAttribute(opacities,1));

  let hazeMaterial=new THREE.ShaderMaterial({
    uniforms:{map:{value:hazeTexture}},
    transparent:true,
    depthWrite:false,
    depthTest:true,
    blending:THREE.NormalBlending,
    vertexShader:[
      "attribute vec3 particleColor;",
      "attribute float particleSize;",
      "attribute float particleOpacity;",
      "varying vec3 vColor;",
      "varying float vOpacity;",
      "void main(){",
      "  vColor=particleColor;",
      "  vOpacity=particleOpacity;",
      "  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);",
      "  gl_PointSize=clamp(particleSize*(2100.0/max(1.0,-mvPosition.z)),52.0,760.0);",
      "  gl_Position=projectionMatrix*mvPosition;",
      "}"
    ].join("\n"),
    fragmentShader:[
      "uniform sampler2D map;",
      "varying vec3 vColor;",
      "varying float vOpacity;",
      "void main(){",
      "  vec4 tex=texture2D(map,gl_PointCoord);",
      "  float alpha=tex.a*vOpacity;",
      "  if(alpha<0.006) discard;",
      "  gl_FragColor=vec4(vColor,alpha);",
      "}"
    ].join("\n")
  });
  let hazePoints=new THREE.Points(hazeGeometry,hazeMaterial);
  hazePoints.frustumCulled=false;
  hazeGroup.add(hazePoints);
  let cloudBankGroup=new THREE.Group();
  hazeGroup.add(cloudBankGroup);
  let cloudSheetGroup=new THREE.Group();
  let cloudSheetMeshes=[];
  hazeGroup.add(cloudSheetGroup);

  for(let i=0;i<maxHazePuffs;i++){
    hazeData.push({
      angle:hazeRand(i*17,31)*Math.PI*2,
      radius:140+hazeRand(i*23,43)*720,
      heightT:hazeRand(i*53,79),
      phase:hazeRand(i*61,83)*Math.PI*2,
      drift:hazeRand(i*71,97)*0.22+0.08,
      nearSize:92+hazeRand(i*41,59)*145,
      farSize:118+hazeRand(i*47,67)*190,
      opacity:0.05+hazeRand(i*89,109)*0.075
    });
  }

  for(let i=0;i<maxCloudBanks;i++){
    cloudBankData.push({
      angle:hazeRand(i*131,149)*Math.PI*2,
      radiusT:Math.pow(hazeRand(i*137,151),0.72),
      heightT:hazeRand(i*157,163),
      widthT:hazeRand(i*167,173),
      opacityT:hazeRand(i*179,181),
      phase:hazeRand(i*191,193)*Math.PI*2,
      drift:hazeRand(i*197,199)*0.35+0.12,
      sway:hazeRand(i*211,223)*2-1
    });
  }

  function wrapOffset(value,range){
    let half=range*0.5;
    while(value<-half) value+=range;
    while(value>half) value-=range;
    return value;
  }

  function ensureCloudBankSprites(count,color){
    while(cloudBankSprites.length<count){
      let material=new THREE.SpriteMaterial({
        map:cloudBankTexture,
        color,
        transparent:true,
        opacity:0,
        depthWrite:false,
        depthTest:true,
        fog:true
      });
      let sprite=new THREE.Sprite(material);
      sprite.frustumCulled=false;
      cloudBankGroup.add(sprite);
      cloudBankSprites.push(sprite);
    }
  }

  function updateCloudBanks(config,centerX,centerY,centerZ){
    let count=Math.min(maxCloudBanks,Math.max(0,config.count || 170));
    let range=config.range || 900;
    let color=config.color || 0xd1c59b;
    let opacityScale=config.opacity ?? 1;
    let heightMin=config.heightMin ?? 16;
    let heightMax=config.heightMax ?? 62;
    let minRadius=config.minRadius ?? 42;
    let widthMin=config.widthMin || 160;
    let widthMax=config.widthMax || 390;
    let heightScale=config.heightScale || 0.28;
    let rise=config.rise ?? 0;
    let fadeStart=config.fadeStart || range*0.72;
    let fadeEnd=config.fadeEnd || range;
    let nearFadeRadius=config.nearFadeRadius ?? 95;
    let driftScale=config.drift ?? 1;

    ensureCloudBankSprites(count,color);

    for(let i=0;i<count;i++){
      let data=cloudBankData[i];
      let radius=minRadius+(range-minRadius)*data.radiusT;
      let angle=data.angle+hazeTime*0.006*data.drift*driftScale;
      let lateral=Math.sin(hazeTime*0.045+data.phase)*18*data.sway*driftScale;
      let x=centerX+Math.cos(angle)*radius+Math.cos(angle+Math.PI*0.5)*lateral;
      let z=centerZ+Math.sin(angle)*radius+Math.sin(angle+Math.PI*0.5)*lateral;
      let terrainY=groundHeight(x,z);
      let y=centerY+heightMin+(heightMax-heightMin)*data.heightT+Math.sin(hazeTime*0.08+data.phase)*rise;
      y=Math.max(y,terrainY+3);

      let width=widthMin+(widthMax-widthMin)*data.widthT;
      let height=width*(heightScale+(hazeRand(i*229,233)-0.5)*0.08);
      let edgeFade=1-Math.max(0,Math.min(1,(radius-fadeStart)/(fadeEnd-fadeStart)));
      let nearFade=Math.max(0,Math.min(1,(radius-minRadius)/nearFadeRadius));
      let opacity=(0.18+0.36*data.opacityT)*opacityScale*edgeFade*nearFade;

      let sprite=cloudBankSprites[i];
      sprite.visible=true;
      sprite.position.set(x,y,z);
      sprite.scale.set(width,height,1);
      sprite.material.color.set(color);
      sprite.material.opacity=opacity;
    }

    for(let i=count;i<cloudBankSprites.length;i++){
      cloudBankSprites[i].visible=false;
      cloudBankSprites[i].material.opacity=0;
    }
  }

  function ensureCloudSheets(count){
    while(cloudSheetMeshes.length<count){
      let material=new THREE.ShaderMaterial({
        uniforms:{
          color:{value:new THREE.Color(0xb8dcc7)},
          center:{value:new THREE.Vector2()},
          range:{value:900},
          fadeStart:{value:650},
          opacity:{value:0.45},
          noiseScale:{value:0.006},
          layerOffset:{value:0}
        },
        transparent:true,
        depthWrite:false,
        depthTest:true,
        side:THREE.DoubleSide,
        blending:THREE.NormalBlending,
        vertexShader:[
          "varying vec2 vWorldXZ;",
          "void main(){",
          "  vec4 worldPosition=modelMatrix*vec4(position,1.0);",
          "  vWorldXZ=worldPosition.xz;",
          "  gl_Position=projectionMatrix*viewMatrix*worldPosition;",
          "}"
        ].join("\n"),
        fragmentShader:[
          "uniform vec3 color;",
          "uniform vec2 center;",
          "uniform float range;",
          "uniform float fadeStart;",
          "uniform float opacity;",
          "uniform float noiseScale;",
          "uniform float layerOffset;",
          "varying vec2 vWorldXZ;",
          "float hash(vec2 p){",
          "  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);",
          "}",
          "float noise(vec2 p){",
          "  vec2 i=floor(p);",
          "  vec2 f=fract(p);",
          "  vec2 u=f*f*(3.0-2.0*f);",
          "  float a=hash(i+layerOffset);",
          "  float b=hash(i+vec2(1.0,0.0)+layerOffset);",
          "  float c=hash(i+vec2(0.0,1.0)+layerOffset);",
          "  float d=hash(i+vec2(1.0,1.0)+layerOffset);",
          "  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);",
          "}",
          "float fbm(vec2 p){",
          "  float value=0.0;",
          "  float amp=0.56;",
          "  for(int i=0;i<4;i++){",
          "    value+=noise(p)*amp;",
          "    p*=2.03;",
          "    amp*=0.5;",
          "  }",
          "  return value;",
          "}",
          "void main(){",
          "  float d=distance(vWorldXZ,center);",
          "  float edge=1.0-smoothstep(fadeStart,range,d);",
          "  float cloud=fbm(vWorldXZ*noiseScale+vec2(layerOffset*0.13,layerOffset*0.07));",
          "  cloud=smoothstep(0.32,0.78,cloud);",
          "  float veil=smoothstep(0.05,0.82,1.0-d/range)*0.34;",
          "  float alpha=(cloud*0.78+veil)*edge*opacity;",
          "  if(alpha<0.008) discard;",
          "  gl_FragColor=vec4(color,alpha);",
          "}"
        ].join("\n")
      });
      let mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1,1,1),material);
      mesh.rotation.x=-Math.PI/2;
      mesh.frustumCulled=false;
      cloudSheetGroup.add(mesh);
      cloudSheetMeshes.push(mesh);
    }
  }

  function updateCloudSheets(config,centerX,centerY,centerZ){
    let layers=config.layers || [
      {height:12,scale:1,opacity:0.42,noiseScale:0.006,offset:11},
      {height:28,scale:0.86,opacity:0.32,noiseScale:0.0048,offset:47},
      {height:46,scale:0.68,opacity:0.22,noiseScale:0.0037,offset:89}
    ];
    let range=config.range || 900;
    let fadeStart=config.fadeStart || range*0.72;
    let color=config.color || 0xb8dcc7;

    ensureCloudSheets(layers.length);

    for(let i=0;i<layers.length;i++){
      let layer=layers[i];
      let mesh=cloudSheetMeshes[i];
      let layerRange=range*(layer.scale || 1);
      mesh.visible=true;
      mesh.position.set(centerX,centerY+(layer.height ?? 20),centerZ);
      mesh.scale.set(layerRange*2.18,layerRange*2.18,1);
      mesh.material.uniforms.color.value.set(layer.color || color);
      mesh.material.uniforms.center.value.set(centerX,centerZ);
      mesh.material.uniforms.range.value=layerRange;
      mesh.material.uniforms.fadeStart.value=Math.min(layerRange*0.96,fadeStart*(layer.scale || 1));
      mesh.material.uniforms.opacity.value=(layer.opacity ?? 0.34)*(config.opacity ?? 1);
      mesh.material.uniforms.noiseScale.value=layer.noiseScale || config.noiseScale || 0.005;
      mesh.material.uniforms.layerOffset.value=layer.offset || i*37+11;
    }

    for(let i=layers.length;i<cloudSheetMeshes.length;i++){
      cloudSheetMeshes[i].visible=false;
    }
  }

  function update(){
    let environment=getEnvironment() || {};
    let config=environment.lowHaze;
    let enabled=!!config;

    hazeTime+=0.016;
    hazeGroup.visible=enabled;
    if(!enabled){
      hazePoints.visible=false;
      return;
    }
    hazePoints.visible=true;

    let center=getCarPosition();
    let centerX=center.carX ?? center.x ?? 0;
    let centerY=center.carY ?? center.y ?? 0;
    let centerZ=center.carZ ?? center.z ?? 0;
    if(config.mode==="cloudSheet"){
      hazePoints.visible=false;
      cloudBankGroup.visible=false;
      cloudSheetGroup.visible=true;
      updateCloudSheets(config,centerX,centerY,centerZ);
      return;
    }
    if(config.mode==="cloudBanks"){
      hazePoints.visible=false;
      cloudBankGroup.visible=true;
      cloudSheetGroup.visible=false;
      cloudBankUpdateFrame++;
      if(cloudBankSprites.length>0 && cloudBankUpdateFrame%2!==0) return;
      updateCloudBanks(config,centerX,centerY,centerZ);
      return;
    }
    cloudBankGroup.visible=false;
    cloudSheetGroup.visible=false;
    hazePoints.visible=true;
    let range=config.range || 1500;
    let count=Math.min(maxHazePuffs,Math.max(0,config.count || maxHazePuffs));
    let nearCount=Math.min(count,Math.max(0,config.nearCount || 0));
    let nearRange=config.nearRange || range*0.42;
    let nearOpacity=config.nearOpacity ?? 1;
    let nearScale=config.nearScale ?? 1;
    let opacityScale=config.opacity ?? 1;
    let color=config.color || 0xbfd7bd;
    let minHeight=config.heightMin ?? 4;
    let maxHeight=config.heightMax ?? 42;
    let driftScale=config.drift ?? 1;

    hazeColor.set(color);

    for(let i=0;i<maxHazePuffs;i++){
      let offset=i*3;
      if(i>=count){
        opacities[i]=0;
        continue;
      }

      let data=hazeData[i];
      let near=i<nearCount;
      let activeRange=near ? nearRange : range;
      let radius=near
        ? 12+hazeRand(i*137,151)*nearRange*0.32
        : data.radius;
      let x=wrapOffset(Math.cos(data.angle)*radius,activeRange);
      let z=wrapOffset(Math.sin(data.angle)*radius,activeRange);
      let y=centerY+minHeight+(maxHeight-minHeight)*(near ? 0.08+0.42*hazeRand(i*101,113) : 0.18+0.82*hazeRand(i*101,113));
      y+=Math.sin(hazeTime*0.36+data.phase)*(near ? 2.6 : 4.5);
      let pulse=0.78+Math.sin(hazeTime*0.42+data.phase)*0.22;
      let distanceFade=1-Math.min(1,Math.hypot(x,z)/(activeRange*0.58));
      let scale=near ? nearScale : 1;
      let opacityBoost=near ? nearOpacity : 1;

      positions[offset]=centerX+x;
      positions[offset+1]=y;
      positions[offset+2]=centerZ+z;
      colors[offset]=hazeColor.r;
      colors[offset+1]=hazeColor.g;
      colors[offset+2]=hazeColor.b;
      sizes[i]=(near ? data.nearSize : data.farSize)*scale;
      opacities[i]=data.opacity*opacityScale*opacityBoost*pulse*(0.55+distanceFade*0.45);
    }

    hazeGeometry.attributes.position.needsUpdate=true;
    hazeGeometry.attributes.particleColor.needsUpdate=true;
    hazeGeometry.attributes.particleSize.needsUpdate=true;
    hazeGeometry.attributes.particleOpacity.needsUpdate=true;
  }

  return {update};
}

export function createStars(scene,getCarPosition,getNightAmount=()=>0,getRainIntensity=()=>0){
  let starCount=1800;
  let positions=new Float32Array(starCount*3);
  let colors=new Float32Array(starCount*3);
  let sizes=new Float32Array(starCount);
  let phases=new Float32Array(starCount);
  let color=new THREE.Color();

  for(let i=0;i<starCount;i++){
    let angle=Math.random()*Math.PI*2;
    let elevation=0.08+Math.pow(Math.random(),0.62)*(Math.PI*0.5-0.08);
    let radius=76000+Math.random()*22000;
    let flatRadius=Math.cos(elevation)*radius;

    positions[i*3]=Math.cos(angle)*flatRadius;
    positions[i*3+1]=Math.sin(elevation)*radius;
    positions[i*3+2]=Math.sin(angle)*flatRadius;

    color.set(Math.random()>0.78 ? 0xbfdcff : 0xffffff);
    if(Math.random()>0.9) color.lerp(new THREE.Color(0xffddaa),0.45);
    colors[i*3]=color.r;
    colors[i*3+1]=color.g;
    colors[i*3+2]=color.b;
    sizes[i]=1.2+Math.pow(Math.random(),2.4)*4.8;
    phases[i]=Math.random()*Math.PI*2;
  }

  let geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("starColor",new THREE.BufferAttribute(colors,3));
  geometry.setAttribute("starSize",new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute("twinklePhase",new THREE.BufferAttribute(phases,1));

  let material=new THREE.ShaderMaterial({
    uniforms:{
      opacity:{value:0},
      time:{value:0}
    },
    transparent:true,
    depthWrite:false,
    depthTest:true,
    blending:THREE.AdditiveBlending,
    fog:false,
    vertexShader:[
      "attribute vec3 starColor;",
      "attribute float starSize;",
      "attribute float twinklePhase;",
      "uniform float opacity;",
      "uniform float time;",
      "varying vec3 vColor;",
      "varying float vOpacity;",
      "void main(){",
      "  vColor=starColor;",
      "  float twinkle=0.72+sin(time*1.6+twinklePhase)*0.18+sin(time*0.73+twinklePhase*1.7)*0.1;",
      "  vOpacity=opacity*twinkle;",
      "  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);",
      "  gl_PointSize=clamp(starSize*(120000.0/max(1.0,-mvPosition.z)),1.1,5.5);",
      "  gl_Position=projectionMatrix*mvPosition;",
      "}"
    ].join("\n"),
    fragmentShader:[
      "varying vec3 vColor;",
      "varying float vOpacity;",
      "void main(){",
      "  vec2 uv=gl_PointCoord-vec2(0.5);",
      "  float falloff=smoothstep(0.5,0.08,length(uv));",
      "  float alpha=vOpacity*falloff;",
      "  if(alpha<0.01) discard;",
      "  gl_FragColor=vec4(vColor,alpha);",
      "}"
    ].join("\n")
  });

  let stars=new THREE.Points(geometry,material);
  stars.frustumCulled=false;
  stars.renderOrder=-10;
  stars.visible=false;
  scene.add(stars);

  function update(){
    let night=Math.max(0,Math.min(1,getNightAmount()));
    let rain=Math.max(0,Math.min(1,getRainIntensity()));
    let opacity=Math.pow(Math.max(0,(night-0.28)/0.72),1.4)*(1-rain*0.68);

    if(opacity<=0.01){
      stars.visible=false;
      return;
    }

    let center=getCarPosition();
    stars.visible=true;
    stars.position.set(center.x || center.carX || 0,center.y || 0,center.z || center.carZ || 0);
    material.uniforms.opacity.value=opacity*0.86;
    material.uniforms.time.value+=0.016;
  }

  return {update};
}

export function createBirds(scene,getCarPosition){
  let birdGroup=new THREE.Group();
  scene.add(birdGroup);
  let birds=[];
  let birdTime=0;

  let bodyGeo=new THREE.SphereGeometry(1,8,6);
  let headGeo=new THREE.SphereGeometry(1,6,4);
  let wingGeo=new THREE.BufferGeometry();
  wingGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      0,0,0,
      1.45,0,0.18,
      0.22,0,-0.64
    ],3)
  );
  wingGeo.computeVertexNormals();

  let bodyMat=new THREE.MeshStandardMaterial({
    color:0x2b2b28,
    roughness:0.88,
    metalness:0,
    flatShading:true
  });
  let wingMat=new THREE.MeshStandardMaterial({
    color:0x1d1d1b,
    roughness:0.9,
    side:THREE.DoubleSide,
    flatShading:true
  });

  function makeBird(scale){
    let bird=new THREE.Group();
    bird.rotation.order="YXZ";

    let body=new THREE.Mesh(bodyGeo,bodyMat);
    body.scale.set(0.22*scale,0.14*scale,0.48*scale);
    body.position.y=0.02*scale;
    bird.add(body);

    let head=new THREE.Mesh(headGeo,bodyMat);
    head.scale.set(0.12*scale,0.1*scale,0.12*scale);
    head.position.set(0,0.04*scale,0.44*scale);
    bird.add(head);

    let leftWingPivot=new THREE.Group();
    leftWingPivot.position.set(-0.12*scale,0,0.08*scale);
    let leftWing=new THREE.Mesh(wingGeo,wingMat);
    leftWing.scale.set(scale,scale,scale);
    leftWingPivot.add(leftWing);
    bird.add(leftWingPivot);

    let rightWingPivot=new THREE.Group();
    rightWingPivot.position.set(0.12*scale,0,0.08*scale);
    let rightWing=new THREE.Mesh(wingGeo,wingMat);
    rightWing.scale.set(-scale,scale,scale);
    rightWingPivot.add(rightWing);
    bird.add(rightWingPivot);

    bird.userData.leftWingPivot=leftWingPivot;
    bird.userData.rightWingPivot=rightWingPivot;
    return bird;
  }

  function makeBirds(){
    let birdRand=(a,b)=>rand(a,b)*0.5+0.5;
    let flockCount=3;
    let birdsPerFlock=3;
    let range=3600;

    for(let flock=0;flock<flockCount;flock++){
      let flockX=(birdRand(flock*91,17)-0.5)*range;
      let flockZ=(birdRand(flock*53,29)-0.5)*range;
      let flockY=115+birdRand(flock*71,43)*150;
      let heading=birdRand(flock*37,61)*Math.PI*2;
      let speed=20+birdRand(flock*83,97)*22;
      let circleRadius=180+birdRand(flock*101,31)*260;

      for(let i=0;i<birdsPerFlock;i++){
        let scale=3.8+Math.pow(birdRand(flock*211+i*19,flock*137-i),1.7)*8.5;
        let bird=makeBird(scale);
        let side=(i%2===0 ? -1 : 1);
        let row=Math.floor(i/2);
        let offsetX=side*(28+row*24)+birdRand(i*47,flock*13)*12;
        let offsetZ=row*34+birdRand(i*71,flock*19)*18;
        let phase=birdRand(flock*173+i*23,flock*199-i*11)*Math.PI*2;

        bird.userData={
          ...bird.userData,
          flockX,
          flockZ,
          flockY,
          heading,
          speed,
          circleRadius,
          offsetX,
          offsetZ,
          phase,
          flapSpeed:4.8+birdRand(i*89,flock*41)*2.2,
          glidePhase:birdRand(i*109,flock*67)*Math.PI*2,
          bankAmount:0.1+birdRand(i*131,flock*79)*0.18
        };

        birdGroup.add(bird);
        birds.push(bird);
      }
    }
  }

  function wrapBirdCoord(value,center,range){
    let half=range*0.5;
    while(value<center-half) value+=range;
    while(value>center+half) value-=range;
    return value;
  }

  function update(){
    if(birds.length===0) return;

    let {carX,carZ}=getCarPosition();
    birdTime+=0.016;
    let range=3600;

    for(let bird of birds){
      let data=bird.userData;
      let circle=birdTime*0.08+data.phase;
      let heading=data.heading+Math.sin(circle)*0.32;
      let windX=Math.sin(data.heading)*data.speed*birdTime;
      let windZ=Math.cos(data.heading)*data.speed*birdTime;
      let orbitX=Math.sin(circle)*data.circleRadius;
      let orbitZ=Math.cos(circle)*data.circleRadius*0.55;

      let rightX=Math.cos(heading);
      let rightZ=-Math.sin(heading);
      let fwdX=Math.sin(heading);
      let fwdZ=Math.cos(heading);
      let x=wrapBirdCoord(
        data.flockX+windX+orbitX+rightX*data.offsetX+fwdX*data.offsetZ,
        carX,
        range
      );
      let z=wrapBirdCoord(
        data.flockZ+windZ+orbitZ+rightZ*data.offsetX+fwdZ*data.offsetZ,
        carZ,
        range
      );
      let y=data.flockY+Math.sin(birdTime*0.7+data.phase)*12+Math.sin(circle*0.5)*18;
      let flap=Math.sin(birdTime*data.flapSpeed+data.phase);
      let gliding=Math.sin(birdTime*0.42+data.glidePhase)>0.58;
      let flapAngle=gliding ? -0.08+flap*0.06 : flap*0.62;
      let bank=Math.sin(circle)*data.bankAmount;

      bird.position.set(x,y,z);
      bird.rotation.y=heading;
      bird.rotation.x=-0.06+Math.sin(circle*0.6)*0.03;
      bird.rotation.z=bank;
      bird.userData.leftWingPivot.rotation.z=0.16+flapAngle;
      bird.userData.rightWingPivot.rotation.z=-(0.16+flapAngle);
      bird.userData.leftWingPivot.rotation.x=gliding ? -0.02 : flap*0.08;
      bird.userData.rightWingPivot.rotation.x=gliding ? -0.02 : -flap*0.08;
    }
  }

  return {makeBirds,update};
}

export function createRain(scene,getCarPosition,getRainIntensity=()=>0,getRainQuality=()=>1,getRainDirection=()=>({x:0,z:0,speed:0}),getWaterLevel=()=>-Infinity,isViewerUnderWater=()=>false){
  let maxDrops=850;
  let maxSplashes=120;
  let range=420;
  let height=190;
  let positions=new Float32Array(maxDrops*2*3);
  let speeds=new Float32Array(maxDrops);
  let offsets=new Float32Array(maxDrops*3);
  let rainTime=0;
  let rainDirX=-0.18;
  let rainDirZ=0.08;
  let splashCursor=0;
  let waterSplashTimer=0;
  let splashes=[];

  for(let i=0;i<maxDrops;i++){
    offsets[i*3]=(Math.random()-0.5)*range;
    offsets[i*3+1]=Math.random()*height;
    offsets[i*3+2]=(Math.random()-0.5)*range;
    speeds[i]=4.8+Math.random()*4.6;
  }

  let geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  let material=new THREE.LineBasicMaterial({
    color:0xbfefff,
    transparent:true,
    opacity:0.46,
    depthWrite:false,
    fog:true
  });
  let rain=new THREE.LineSegments(geometry,material);
  rain.frustumCulled=false;
  rain.visible=false;
  scene.add(rain);

  let splashGeometry=new THREE.RingGeometry(0.34,0.62,18);
  let splashMaterial=new THREE.MeshBasicMaterial({
    color:0xd6fff7,
    transparent:true,
    opacity:0,
    depthWrite:false,
    depthTest:true,
    blending:THREE.AdditiveBlending,
    side:THREE.DoubleSide,
    polygonOffset:true,
    polygonOffsetFactor:-2,
    polygonOffsetUnits:-2,
    fog:true
  });
  let splashGroup=new THREE.Group();
  splashGroup.renderOrder=12;
  splashGroup.visible=false;
  scene.add(splashGroup);
  for(let i=0;i<maxSplashes;i++){
    let splash=new THREE.Mesh(splashGeometry,splashMaterial.clone());
    splash.rotation.x=-Math.PI*0.5;
    splash.visible=false;
    splash.renderOrder=9;
    splash.userData.age=0;
    splash.userData.life=0.26;
    splash.userData.baseScale=1;
    splashGroup.add(splash);
    splashes.push(splash);
  }

  function wrap(value,halfRange){
    while(value<-halfRange) value+=halfRange*2;
    while(value>halfRange) value-=halfRange*2;
    return value;
  }

  function spawnSplash(x,y,z,intensity){
    let splash=splashes[splashCursor];
    splashCursor=(splashCursor+1)%splashes.length;
    splash.position.set(x,y+0.16,z);
    splash.rotation.z=Math.random()*Math.PI*2;
    splash.visible=true;
    splash.userData.age=0;
    splash.userData.life=0.2+Math.random()*0.18;
    splash.userData.baseScale=0.56+Math.random()*0.84+intensity*0.42;
    splash.scale.setScalar(splash.userData.baseScale);
    splash.material.opacity=0.34+intensity*0.24;
  }

  function spawnAmbientWaterSplashes(centerX,centerZ,waterLevel,intensity,quality){
    if(!Number.isFinite(waterLevel)) return;
    waterSplashTimer+=0.016*(0.45+intensity*1.4)*Math.max(0.45,quality);
    let spawnInterval=0.11+Math.max(0,1-intensity)*0.18;
    let maxSpawns=3;
    while(waterSplashTimer>=spawnInterval && maxSpawns>0){
      waterSplashTimer-=spawnInterval;
      maxSpawns--;
      let angle=Math.random()*Math.PI*2;
      let radius=32+Math.pow(Math.random(),0.72)*220;
      let x=centerX+Math.cos(angle)*radius;
      let z=centerZ+Math.sin(angle)*radius;
      if(groundHeight(x,z)<waterLevel-0.12){
        spawnSplash(x,waterLevel+0.1,z,intensity);
      }
    }
  }

  function updateSplashes(intensity){
    let anyVisible=false;
    for(let splash of splashes){
      if(!splash.visible) continue;
      splash.userData.age+=0.016;
      let t=splash.userData.age/splash.userData.life;
      if(t>=1){
        splash.visible=false;
        splash.material.opacity=0;
        continue;
      }
      let fade=1-t;
      splash.scale.setScalar(splash.userData.baseScale*(0.85+t*2.35));
      splash.material.opacity=(0.26+intensity*0.24)*fade*fade;
      anyVisible=true;
    }
    splashGroup.visible=anyVisible;
  }

  function update(){
    let intensity=Math.max(0,Math.min(1,getRainIntensity()));
    if(intensity<=0.01){
      rain.visible=false;
      updateSplashes(0);
      return;
    }

    if(isViewerUnderWater()){
      rain.visible=false;
      updateSplashes(intensity);
      return;
    }

    rain.visible=true;
    let quality=Math.max(0.25,Math.min(1,getRainQuality()));
    material.opacity=0.18+intensity*0.42;
    let activeDrops=Math.max(16,Math.floor(maxDrops*intensity*quality*0.72));
    let {carX,carY=20,carZ}=getCarPosition();
    let waterLevel=Number.isFinite(getWaterLevel()) ? getWaterLevel() : -Infinity;
    let direction=getRainDirection() || {};
    let targetDirX=Number.isFinite(direction.x) ? direction.x : 0;
    let targetDirZ=Number.isFinite(direction.z) ? direction.z : 0;
    let targetSpeed=Number.isFinite(direction.speed) ? Math.abs(direction.speed) : 0;
    let targetLen=Math.hypot(targetDirX,targetDirZ);
    if(targetLen>0.001 && targetSpeed>0.04){
      targetDirX/=targetLen;
      targetDirZ/=targetLen;
      let movementInfluence=Math.min(1,targetSpeed/0.62);
      rainDirX+=((-targetDirX)-rainDirX)*(0.055+movementInfluence*0.1);
      rainDirZ+=((-targetDirZ)-rainDirZ)*(0.055+movementInfluence*0.1);
    }else{
      rainDirX+=(-0.18-rainDirX)*0.018;
      rainDirZ+=(0.08-rainDirZ)*0.018;
    }
    let lowerY=Math.min(8,carY-130);
    let upperY=Math.max(150,carY+70);
    let rainHeight=upperY-lowerY;
    rainTime+=0.016;

    for(let i=0;i<activeDrops;i++){
      let ox=wrap(offsets[i*3]+Math.sin(rainTime*0.7+i)*18,range*0.5);
      let fall=(offsets[i*3+1]-rainTime*speeds[i]*60)%rainHeight;
      if(fall<0) fall+=rainHeight;
      let oz=wrap(offsets[i*3+2]+Math.cos(rainTime*0.55+i*0.7)*12,range*0.5);
      let x=carX+ox;
      let y=lowerY+fall;
      let z=carZ+oz;
      let base=i*6;
      let slant=4.2+intensity*9.2+Math.min(10.5,targetSpeed*6.2);
      let endX=x+rainDirX*slant;
      let endY=y-10-intensity*8;
      let endZ=z+rainDirZ*slant;
      let waterSurfaceY=waterLevel+0.1;
      let overWater=Number.isFinite(waterLevel) && groundHeight(x,z)<waterLevel-0.12;

      if(overWater && endY<=waterSurfaceY){
        if(y>=waterSurfaceY){
          let hitT=(y-waterSurfaceY)/Math.max(0.001,y-endY);
          endX=x+(endX-x)*hitT;
          endY=waterSurfaceY;
          endZ=z+(endZ-z)*hitT;
          if(Math.random()<0.012+intensity*0.032) spawnSplash(endX,waterSurfaceY,endZ,intensity);
        }else{
          y=waterSurfaceY;
          endY=waterSurfaceY;
        }
      }

      positions[base]=x;
      positions[base+1]=y;
      positions[base+2]=z;
      positions[base+3]=endX;
      positions[base+4]=endY;
      positions[base+5]=endZ;
    }

    geometry.setDrawRange(0,activeDrops*2);
    geometry.attributes.position.needsUpdate=true;
    spawnAmbientWaterSplashes(carX,carZ,waterLevel,intensity,quality);
    updateSplashes(intensity);
  }

  return {update};
}

export function createAmbientMotes(scene,getCarPosition,getRainIntensity=()=>0){
  let maxMotes=86;
  let motes=[];
  let texture=makeDustTexture();
  let moteTime=0;
  let spawnTimer=0;

  for(let i=0;i<maxMotes;i++){
    let material=new THREE.SpriteMaterial({
      map:texture,
      color:Math.random()>0.35 ? 0xf2dc9a : 0xd9f4ff,
      transparent:true,
      opacity:0,
      depthWrite:false,
      depthTest:true,
      blending:THREE.AdditiveBlending,
      fog:false
    });
    let sprite=new THREE.Sprite(material);
    sprite.frustumCulled=false;
    sprite.userData={
      active:false,
      life:0,
      age:0,
      vx:0,
      vy:0,
      vz:0,
      phase:Math.random()*Math.PI*2,
      size:0.12+Math.pow(Math.random(),1.8)*0.55,
      opacity:0.22+Math.random()*0.12
    };
    sprite.visible=false;
    scene.add(sprite);
    motes.push(sprite);
  }

  function spawnMote(center){
    let mote=motes.find(item=>!item.userData.active);
    if(!mote) return;

    let data=mote.userData;
    let side=Math.random()>0.5 ? 1 : -1;
    let forward=24+Math.random()*58;
    let lateral=side*(24+Math.random()*34);
    let height=(Math.random()-0.5)*22;
    let driftAngle=Math.random()*Math.PI*2;

    mote.position.set(
      center.carX+lateral,
      (center.carY ?? 20)+height,
      center.carZ+forward
    );
    data.vx=Math.cos(driftAngle)*0.28;
    data.vy=(Math.random()-0.5)*0.18;
    data.vz=Math.sin(driftAngle)*0.28;
    data.life=5.2+Math.random()*4.2;
    data.age=0;
    data.active=true;
    data.phase=Math.random()*Math.PI*2;
    data.size=0.12+Math.pow(Math.random(),1.8)*0.55;
    data.opacity=0.22+Math.random()*0.12;
    mote.scale.set(data.size,data.size,data.size);
    mote.visible=true;
  }

  function update(){
    let center=getCarPosition();
    let rain=Math.max(0,Math.min(1,getRainIntensity()));
    moteTime+=0.016;
    spawnTimer-=0.016;

    if(spawnTimer<=0){
      let spawnCount=3+(Math.random()>0.48 ? 1 : 0);
      for(let i=0;i<spawnCount;i++) spawnMote(center);
      spawnTimer=0.28+Math.random()*0.72+rain*0.62;
    }

    for(let mote of motes){
      let data=mote.userData;
      if(!data.active) continue;

      data.age+=0.016;
      mote.position.x+=data.vx*0.016+Math.sin(moteTime*0.9+data.phase)*0.006;
      mote.position.y+=data.vy*0.016+Math.sin(moteTime*0.7+data.phase)*0.005;
      mote.position.z+=data.vz*0.016;

      let t=data.age/data.life;
      let fade=t<0.22 ? t/0.22 : Math.max(0,(1-t)/0.78);
      let shimmer=0.72+Math.sin(moteTime*1.6+data.phase)*0.28;
      mote.material.opacity=data.opacity*(1-rain*0.42)*fade*shimmer;

      if(data.age>=data.life){
        data.active=false;
        mote.visible=false;
      }
    }
  }

  return {update};
}

export function createDust(scene){
  let maxDustParticles=650;
  let activeParticles=[];
  let freeParticles=[];
  let dustTexture=makeDustTexture();
  let positions=new Float32Array(maxDustParticles*3);
  let colors=new Float32Array(maxDustParticles*3);
  let sizes=new Float32Array(maxDustParticles);
  let opacities=new Float32Array(maxDustParticles);
  let geometry=new THREE.BufferGeometry();
  let material=new THREE.ShaderMaterial({
    uniforms:{map:{value:dustTexture}},
    transparent:true,
    depthWrite:false,
    blending:THREE.NormalBlending,
    fog:false,
    vertexShader:[
      "attribute vec3 particleColor;",
      "attribute float particleSize;",
      "attribute float particleOpacity;",
      "varying vec3 vColor;",
      "varying float vOpacity;",
      "void main(){",
      "  vColor=particleColor;",
      "  vOpacity=particleOpacity;",
      "  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);",
      "  gl_PointSize=clamp(particleSize*(1400.0/max(1.0,-mvPosition.z)),2.0,96.0);",
      "  gl_Position=projectionMatrix*mvPosition;",
      "}"
    ].join("\n"),
    fragmentShader:[
      "uniform sampler2D map;",
      "varying vec3 vColor;",
      "varying float vOpacity;",
      "void main(){",
      "  vec4 tex=texture2D(map,gl_PointCoord);",
      "  float alpha=vOpacity*tex.a;",
      "  if(alpha<0.01) discard;",
      "  gl_FragColor=vec4(vColor,alpha);",
      "}"
    ].join("\n")
  });
  let tempColor=new THREE.Color();

  for(let i=0;i<maxDustParticles;i++){
    positions[i*3]=0;
    positions[i*3+1]=-10000;
    positions[i*3+2]=0;
    colors[i*3]=1;
    colors[i*3+1]=1;
    colors[i*3+2]=1;
    sizes[i]=0;
    opacities[i]=0;
    freeParticles.push({
      index:i,
      px:0,
      py:0,
      pz:0,
      vx:0,
      vz:0,
      vy:0,
      age:0,
      life:1,
      baseSize:1,
      gravity:0.018,
      growth:2.4,
      opacity:0.78,
      fadePower:2
    });
  }

  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("particleColor",new THREE.BufferAttribute(colors,3));
  geometry.setAttribute("particleSize",new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute("particleOpacity",new THREE.BufferAttribute(opacities,1));

  let points=new THREE.Points(geometry,material);
  points.frustumCulled=false;
  scene.add(points);

  function spawnParticle(px,py,pz,vx,vz,vy,life,size,options={}){
    let particle=freeParticles.pop();
    if(!particle) return;

    let index=particle.index;
    tempColor.set(options.color || 0xffffff);
    colors[index*3]=tempColor.r;
    colors[index*3+1]=tempColor.g;
    colors[index*3+2]=tempColor.b;
    positions[index*3]=px;
    positions[index*3+1]=py;
    positions[index*3+2]=pz;
    sizes[index]=size;
    opacities[index]=options.opacity ?? 0.78;

    particle.px=px;
    particle.py=py;
    particle.pz=pz;
    particle.vx=vx;
    particle.vz=vz;
    particle.vy=vy;
    particle.age=0;
    particle.life=life;
    particle.baseSize=size;
    particle.gravity=options.gravity ?? 0.018;
    particle.growth=options.growth ?? 2.4;
    particle.opacity=options.opacity ?? 0.78;
    particle.fadePower=options.fadePower ?? 2;

    activeParticles.push(particle);
    geometry.attributes.position.needsUpdate=true;
    geometry.attributes.particleColor.needsUpdate=true;
    geometry.attributes.particleSize.needsUpdate=true;
    geometry.attributes.particleOpacity.needsUpdate=true;
  }

  function spawnSplashParticle(px,py,pz,vx,vz,vy,life,size){
    spawnParticle(px,py,pz,vx,vz,vy,life,size,{
      color:0xbfefff,
      gravity:0.18,
      growth:0.18,
      opacity:0.78,
      fadePower:1.7
    });
  }

  function spawnGroundDustParticle(px,py,pz,vx,vz,vy,life,size){
    spawnParticle(px,py,pz,vx,vz,vy,life,size,{
      color:Math.random()>0.42 ? 0xbca78b : 0x8f8374,
      gravity:0.012,
      growth:2.8,
      opacity:0.62,
      fadePower:1.85
    });
  }

  function spawnThrusterParticle(px,py,pz,vx,vz,vy,life,size){
    spawnParticle(px,py,pz,vx,vz,vy,life,size,{
      color:Math.random()>0.45 ? 0xfff1a8 : 0xff8a2a,
      gravity:-0.012,
      growth:1.35,
      opacity:0.95,
      fadePower:1.35
    });
  }

  function spawnJetExhaustParticle(px,py,pz,vx,vz,vy,life,size){
    spawnParticle(px,py,pz,vx,vz,vy,life,size,{
      color:Math.random()>0.45 ? 0xd8fbff : 0x7ac8ff,
      gravity:-0.004,
      growth:1.65,
      opacity:0.52,
      fadePower:0.82
    });
  }

  function update(){
    if(activeParticles.length===0) return;

    for(let i=activeParticles.length-1;i>=0;i--){
      let p=activeParticles[i];
      p.age+=0.016;

      p.px+=p.vx*0.016;
      p.pz+=p.vz*0.016;
      p.py+=p.vy*0.016;
      p.vx*=0.995;
      p.vz*=0.995;
      p.vy-=p.gravity;

      let t=Math.min(1,p.age/p.life);
      let puff=p.baseSize*(1+t*p.growth);
      let index=p.index;
      positions[index*3]=p.px;
      positions[index*3+1]=p.py;
      positions[index*3+2]=p.pz;
      sizes[index]=puff;
      opacities[index]=Math.max(0,p.opacity*Math.pow(1-t,p.fadePower));

      if(p.age>=p.life){
        positions[index*3]=0;
        positions[index*3+1]=-10000;
        positions[index*3+2]=0;
        sizes[index]=0;
        opacities[index]=0;
        freeParticles.push(p);
        activeParticles[i]=activeParticles[activeParticles.length-1];
        activeParticles.pop();
      }
    }

    geometry.attributes.position.needsUpdate=true;
    geometry.attributes.particleSize.needsUpdate=true;
    geometry.attributes.particleOpacity.needsUpdate=true;
  }

  return {spawnSplashParticle,spawnGroundDustParticle,spawnThrusterParticle,spawnJetExhaustParticle,update};
}

export function createWheelTracks(scene){
  let maxTracks=780;
  let trackCursor=0;
  let lastTrackByCar=new Map();
  let trackGeo=new THREE.PlaneGeometry(0.34,1.18);
  let trackTexture=makeTrackTexture();
  let trackMat=new THREE.MeshBasicMaterial({
    map:trackTexture,
    color:0x1e1a16,
    transparent:true,
    opacity:0.3,
    depthWrite:false,
    depthTest:true,
    polygonOffset:true,
    polygonOffsetFactor:-2,
    polygonOffsetUnits:-2
  });

  function makeTrackTexture(){
    let canvas=document.createElement("canvas");
    canvas.width=32;
    canvas.height=96;
    let ctx=canvas.getContext("2d");
    let gradient=ctx.createLinearGradient(0,0,canvas.width,0);
    gradient.addColorStop(0,"rgba(255,255,255,0)");
    gradient.addColorStop(0.28,"rgba(255,255,255,0.55)");
    gradient.addColorStop(0.5,"rgba(255,255,255,0.7)");
    gradient.addColorStop(0.72,"rgba(255,255,255,0.55)");
    gradient.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=gradient;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    let texture=new THREE.CanvasTexture(canvas);
    texture.needsUpdate=true;
    return texture;
  }

  let trackMesh=new THREE.InstancedMesh(trackGeo,trackMat,maxTracks);
  let trackDummy=new THREE.Object3D();
  let hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);
  trackMesh.renderOrder=1;
  for(let i=0;i<maxTracks;i++){
    trackMesh.setMatrixAt(i,hiddenMatrix);
  }
  trackMesh.instanceMatrix.needsUpdate=true;
  trackMesh.frustumCulled=false;
  scene.add(trackMesh);

  function addTrack(x,y,z,angle,opacity,width,length){
    trackDummy.position.set(x,y+0.045,z);
    trackDummy.rotation.order="YXZ";
    trackDummy.rotation.set(-Math.PI/2,angle,0);
    trackDummy.scale.set(width/0.34,length/1.18,1);
    trackDummy.updateMatrix();
    trackMesh.setMatrixAt(trackCursor,trackDummy.matrix);
    trackMesh.instanceMatrix.needsUpdate=true;
    trackCursor=(trackCursor+1)%maxTracks;
  }

  function addCarTracks(car,surfaceY,inWater){
    let speed=Math.abs(car.speed || 0);
    if(inWater || !car.onGround || car.jetMode || car.jetProgress>0.35 || car.health<=0){
      lastTrackByCar.delete(car.id);
      return;
    }
    if(speed<0.08) return;

    let last=lastTrackByCar.get(car.id);
    let dx=last ? car.x-last.x : Infinity;
    let dz=last ? car.z-last.z : Infinity;
    let buggyMode=car.morphProgress>0.68 && car.jetProgress<0.35;

    let offroad=Math.max(0,Math.min(1,((car.surfaceDistance || 0)-24)/70));
    let slip=Math.max(0,Math.min(1,car.slipAmount || 0));
    let opacity=(buggyMode ? 0.16 : 0.14)+offroad*0.1+slip*0.08;
    let length=(buggyMode ? 1.34 : 0.98)+Math.min(0.24,speed*0.1)+slip*0.16;
    let width=(buggyMode ? 0.48 : 0.62)+offroad*0.14+slip*0.08;
    let footForward=buggyMode ? -0.28 : 0.12;
    let modelTrackHalfWidth=car.carModel && car.carModel.userData
      ? car.carModel.userData.trackHalfWidth
      : null;
    let modelWidthScale=car.carModel && car.carModel.userData && car.carModel.userData.baseScale
      ? car.carModel.scale.x/Math.max(0.001,car.carModel.userData.baseScale.x)
      : 1;
    let trackHalfWidth=buggyMode
      ? (modelTrackHalfWidth || 0.96)*Math.max(0.82,Math.min(1.08,modelWidthScale))
      : 0.66;

    function addTrackPairAt(x,z,angle){
      for(let side of [-1,1]){
        let tx=x+Math.sin(angle)*footForward+Math.cos(angle)*side*trackHalfWidth;
        let tz=z+Math.cos(angle)*footForward-Math.sin(angle)*side*trackHalfWidth;
        addTrack(tx,surfaceY,tz,angle,opacity,width,length);
      }
    }

    if(buggyMode){
      let spacing=0.78;
      let distance=Math.sqrt(dx*dx+dz*dz);
      if(!last || !Number.isFinite(distance)){
        addTrackPairAt(car.x,car.z,car.velAngle);
      }else if(distance>=0.18){
        let steps=Math.max(1,Math.ceil(distance/spacing));
        for(let i=1;i<=steps;i++){
          let t=i/steps;
          let x=last.x+(car.x-last.x)*t;
          let z=last.z+(car.z-last.z)*t;
          let angle=last.angle!==undefined
            ? last.angle+normalizeTrackAngle(car.velAngle-last.angle)*t
            : car.velAngle;
          addTrackPairAt(x,z,angle);
        }
      }
      lastTrackByCar.set(car.id,{x:car.x,z:car.z,side:1,angle:car.velAngle});
      return;
    }

    if(dx*dx+dz*dz<1.15*1.15) return;

    let side=last && last.side ? -last.side : -1;
    let x=car.x+Math.sin(car.velAngle)*footForward+Math.cos(car.velAngle)*side*trackHalfWidth;
    let z=car.z+Math.cos(car.velAngle)*footForward-Math.sin(car.velAngle)*side*trackHalfWidth;

    lastTrackByCar.set(car.id,{x:car.x,z:car.z,side,angle:car.velAngle});
    addTrack(x,surfaceY,z,car.velAngle,opacity,width,length);
  }

  function resetCarTracks(car){
    if(car && car.id!==undefined) lastTrackByCar.delete(car.id);
  }

  return {addCarTracks,resetCarTracks};
}
