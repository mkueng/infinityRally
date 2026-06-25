import { THREE } from "./three.js";
import { makeCarShadowTexture, makeCloudTexture, makeDustTexture } from "./textures.js";
import { rand } from "./terrain.js";

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

  return {update};
}

export function createClouds(scene,getCarPosition){
  let cloudGroup=new THREE.Group();
  scene.add(cloudGroup);
  let cloudSprites=[];
  let cloudTime=0;

  function makeClouds(){
    let cloudTexture=makeCloudTexture();
    let cloudRange=5200;
    let cloudCount=16;
    let cloudRand=(a,b)=>rand(a,b)*0.5+0.5;

    for(let i=0;i<cloudCount;i++){
      let material=new THREE.SpriteMaterial({
        map:cloudTexture,
        color:0xffffff,
        transparent:true,
        opacity:0.32+cloudRand(i*17,91)*0.28,
        depthWrite:false,
        fog:false
      });
      let cloud=new THREE.Sprite(material);
      let baseX=(cloudRand(i*23,7)-0.5)*cloudRange;
      let baseZ=(cloudRand(i*31,11)-0.5)*cloudRange;
      let baseY=155+cloudRand(i*43,19)*210;
      let width=430+cloudRand(i*59,29)*520;
      let height=145+cloudRand(i*61,31)*155;
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
    let range=5200;

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
      let minDist=850;
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

export function createDust(scene){
  let maxDustParticles=450;
  let dustParticles=[];
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

  function spawnDustParticle(px,py,pz,vx,vz,vy,life,size){
    if(dustParticles.length>=maxDustParticles) return;

    let sprite=new THREE.Sprite(dustBaseMaterial.clone());
    sprite.position.set(px,py,pz);
    sprite.scale.set(size,size,size);
    scene.add(sprite);

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
      baseSize:size
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
      p.vy-=0.018;

      let t=Math.min(1,p.age/p.life);
      let puff=p.baseSize*(1+t*2.4);
      p.sprite.position.set(p.px,p.py,p.pz);
      p.sprite.scale.set(puff,puff,puff);
      p.sprite.material.opacity=Math.max(0,0.78*(1-t)*(1-t));

      if(p.age>=p.life){
        scene.remove(p.sprite);
        p.sprite.material.dispose();
        dustParticles.splice(i,1);
      }
    }
  }

  return {spawnDustParticle,update};
}
