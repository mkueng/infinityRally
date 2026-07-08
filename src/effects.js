import { THREE } from "./three.js";
import { cloudCount } from "./constants.js";
import { makeCarShadowTexture, makeCloudTexture, makeDustTexture } from "./textures.js?v=smeared-clouds-unclipped";
import { rand } from "./terrain.js";

function normalizeTrackAngle(angle){
  while(angle>Math.PI) angle-=Math.PI*2;
  while(angle<-Math.PI) angle+=Math.PI*2;
  return angle;
}

export function createCarShadow(scene){
  let carShadowRoot=new THREE.Group();
  let carShadow=new THREE.Mesh(
    new THREE.PlaneGeometry(4.8,7.0),
    new THREE.MeshBasicMaterial({
      map:makeCarShadowTexture(),
      transparent:true,
      opacity:0.48,
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
    carShadow.material.opacity=Math.max(0.24,0.48-shadowLift*0.014);
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

  function makeClouds(){
    let cloudTexture=makeCloudTexture();
    let cloudRange=12800;
    let cloudRand=(a,b)=>rand(a,b)*0.5+0.5;

    for(let i=0;i<cloudCount;i++){
      let material=new THREE.SpriteMaterial({
        map:cloudTexture,
        color:0xffffff,
        transparent:true,
        opacity:0.035+cloudRand(i*17,91)*0.075,
        depthWrite:false,
        fog:false
      });
      let cloud=new THREE.Sprite(material);
      let baseX=(cloudRand(i*23,7)-0.5)*cloudRange;
      let baseZ=(cloudRand(i*31,11)-0.5)*cloudRange;
      let baseY=155+cloudRand(i*43,19)*210;
      let width=980+cloudRand(i*59,29)*1280;
      let height=190+cloudRand(i*61,31)*190;
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

  return {makeClouds,update};
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

export function createRain(scene,getCarPosition,getRainIntensity=()=>0){
  let maxDrops=850;
  let range=420;
  let height=190;
  let positions=new Float32Array(maxDrops*2*3);
  let speeds=new Float32Array(maxDrops);
  let offsets=new Float32Array(maxDrops*3);
  let rainTime=0;

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

  function wrap(value,halfRange){
    while(value<-halfRange) value+=halfRange*2;
    while(value>halfRange) value-=halfRange*2;
    return value;
  }

  function update(){
    let intensity=Math.max(0,Math.min(1,getRainIntensity()));
    if(intensity<=0.01){
      rain.visible=false;
      return;
    }

    rain.visible=true;
    material.opacity=0.18+intensity*0.42;
    let activeDrops=Math.max(40,Math.floor(maxDrops*intensity));
    let {carX,carZ}=getCarPosition();
    rainTime+=0.016;

    for(let i=0;i<activeDrops;i++){
      let ox=wrap(offsets[i*3]+Math.sin(rainTime*0.7+i)*18,range*0.5);
      let fall=(offsets[i*3+1]-rainTime*speeds[i]*60)%height;
      if(fall<0) fall+=height;
      let oz=wrap(offsets[i*3+2]+Math.cos(rainTime*0.55+i*0.7)*12,range*0.5);
      let x=carX+ox;
      let y=18+fall;
      let z=carZ+oz;
      let base=i*6;

      positions[base]=x;
      positions[base+1]=y;
      positions[base+2]=z;
      positions[base+3]=x-1.5;
      positions[base+4]=y-10-intensity*8;
      positions[base+5]=z+0.65;
    }

    geometry.setDrawRange(0,activeDrops*2);
    geometry.attributes.position.needsUpdate=true;
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
  let dustParticles=[];
  let dustPool=[];
  let dustTexture=makeDustTexture();
  let dustBaseMaterial=new THREE.SpriteMaterial({
    map:dustTexture,
    color:0xffffff,
    transparent:true,
    opacity:0.85,
    depthWrite:false,
    blending:THREE.NormalBlending,
    fog:false
  });

  function makeDustSprite(){
    let sprite=new THREE.Sprite(dustBaseMaterial.clone());
    sprite.visible=false;
    scene.add(sprite);
    return sprite;
  }

  for(let i=0;i<maxDustParticles;i++){
    dustPool.push(makeDustSprite());
  }

  function spawnParticle(px,py,pz,vx,vz,vy,life,size,options={}){
    if(dustParticles.length>=maxDustParticles) return;

    let sprite=dustPool.pop();
    if(!sprite) return;

    sprite.visible=true;
    sprite.material.opacity=options.opacity ?? 0.78;
    sprite.material.color.set(options.color || 0xffffff);
    sprite.position.set(px,py,pz);
    sprite.scale.set(size,size,size);

    dustParticles.push({
      sprite,
      px,
      py,
      pz,
      vx,
      vz,
      vy,
      age:0,
      life,
      baseSize:size,
      gravity:options.gravity ?? 0.018,
      growth:options.growth ?? 2.4,
      opacity:options.opacity ?? 0.78,
      fadePower:options.fadePower ?? 2
    });
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
      opacity:0.42,
      fadePower:1.85
    });
  }

  function spawnThrusterParticle(px,py,pz,vx,vz,vy,life,size){
    spawnParticle(px,py,pz,vx,vz,vy,life,size,{
      color:Math.random()>0.45 ? 0xfff1a8 : 0xff8a2a,
      gravity:-0.012,
      growth:1.35,
      opacity:0.88,
      fadePower:1.35
    });
  }

  function spawnJetExhaustParticle(px,py,pz,vx,vz,vy,life,size){
    spawnParticle(px,py,pz,vx,vz,vy,life,size,{
      color:Math.random()>0.45 ? 0xd8fbff : 0x7ac8ff,
      gravity:-0.004,
      growth:1.65,
      opacity:0.36,
      fadePower:0.82
    });
  }

  function update(){
    for(let i=dustParticles.length-1;i>=0;i--){
      let p=dustParticles[i];
      p.age+=0.016;

      p.px+=p.vx*0.016;
      p.pz+=p.vz*0.016;
      p.py+=p.vy*0.016;
      p.vx*=0.995;
      p.vz*=0.995;
      p.vy-=p.gravity;

      let t=Math.min(1,p.age/p.life);
      let puff=p.baseSize*(1+t*p.growth);
      p.sprite.position.set(p.px,p.py,p.pz);
      p.sprite.scale.set(puff,puff,puff);
      p.sprite.material.opacity=Math.max(0,p.opacity*Math.pow(1-t,p.fadePower));

      if(p.age>=p.life){
        p.sprite.visible=false;
        p.sprite.material.opacity=0;
        dustPool.push(p.sprite);
        dustParticles[i]=dustParticles[dustParticles.length-1];
        dustParticles.pop();
      }
    }
  }

  return {spawnSplashParticle,spawnGroundDustParticle,spawnThrusterParticle,spawnJetExhaustParticle,update};
}

export function createWheelTracks(scene){
  let maxTracks=1400;
  let tracks=[];
  let lastTrackByCar=new Map();
  let trackGeo=new THREE.PlaneGeometry(0.34,1.18);
  let trackTexture=makeTrackTexture();
  let trackMat=new THREE.MeshBasicMaterial({
    map:trackTexture,
    color:0x1e1a16,
    transparent:true,
    opacity:0.24,
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

  function addTrack(x,y,z,angle,opacity,width,length){
    let mesh=new THREE.Mesh(trackGeo,trackMat.clone());
    mesh.material.opacity=opacity;
    mesh.position.set(x,y+0.045,z);
    mesh.rotation.order="YXZ";
    mesh.rotation.set(-Math.PI/2,angle,0);
    mesh.scale.set(width/0.34,length/1.18,1);
    mesh.renderOrder=1;
    scene.add(mesh);
    tracks.push(mesh);

    while(tracks.length>maxTracks){
      let old=tracks.shift();
      scene.remove(old);
      old.material.dispose();
    }
  }

  function addCarTracks(car,surfaceY,inWater){
    let speed=Math.abs(car.speed || 0);
    if(inWater || !car.onGround || speed<0.08 || car.health<=0) return;

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
      let spacing=0.52;
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

    if(dx*dx+dz*dz<0.78*0.78) return;

    let side=last && last.side ? -last.side : -1;
    let x=car.x+Math.sin(car.velAngle)*footForward+Math.cos(car.velAngle)*side*trackHalfWidth;
    let z=car.z+Math.cos(car.velAngle)*footForward-Math.sin(car.velAngle)*side*trackHalfWidth;

    lastTrackByCar.set(car.id,{x:car.x,z:car.z,side,angle:car.velAngle});
    addTrack(x,surfaceY,z,car.velAngle,opacity,width,length);
  }

  return {addCarTracks};
}
