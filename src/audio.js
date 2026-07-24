export function createMotorAudio(cars){
  let context=null;
  let master=null;
  let motors=[];
  let noiseBuffer=null;
  let rocketLaunchBuffer=null;
  let rocketLaunchBufferPromise=null;
  let rocketImpactBuffer=null;
  let rocketImpactBufferPromise=null;
  let cannonImpactBuffer=null;
  let cannonImpactBufferPromise=null;
  let playerLaserBuffer=null;
  let playerLaserBufferPromise=null;
  let giantFootstepBuffer=null;
  let giantFootstepBufferPromise=null;
  let scannerBuffer=null;
  let scannerBufferPromise=null;
  let mothershipHum=null;
  let rainAudio=null;
  let supported=true;
  let sfxVolume=1.0;
  let musicVolume=0.1;
  let paused=false;
  let sfxEnabled=false;
  let playbackAllowed=false;
  let musicPlaylist=[
    "./assets/music/Planetatmospher.mp3",
    "./assets/music/ROSpace.mp3"
  ];
  let musicTrackIndex=0;
  let musicPlayCount=0;
  let musicLoopsPerTrack=2;
  let musicSwitchDelayMs=5000;
  let musicSwitchTimer=null;
  let musicSuppressed=false;
  let backgroundMusic=new Audio();
  backgroundMusic.loop=false;
  backgroundMusic.volume=musicVolume;
  backgroundMusic.preload="none";

  function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
  }

  function ensureContext(){
    if(context || !supported) return;

    let AudioContextClass=window.AudioContext || window.webkitAudioContext;
    if(!AudioContextClass){
      supported=false;
      return;
    }

    context=new AudioContextClass();
    master=context.createGain();
    master.gain.value=paused || !sfxEnabled ? 0 : 0.26*sfxVolume;
    master.connect(context.destination);
    noiseBuffer=createNoiseBuffer();
    loadRocketLaunchBuffer();
    loadRocketImpactBuffer();
    loadCannonImpactBuffer();
    loadPlayerLaserBuffer();
    loadGiantFootstepBuffer();
    loadScannerBuffer();

    motors=cars.map((car,index)=>{
      let idleOsc=context.createOscillator();
      let idleFilter=context.createBiquadFilter();
      let idleGain=context.createGain();
      let roadNoise=context.createBufferSource();
      let roadFilter=context.createBiquadFilter();
      let roadGain=context.createGain();
      let skidNoise=context.createBufferSource();
      let skidFilter=context.createBiquadFilter();
      let skidGain=context.createGain();
      let output=context.createGain();
      let pan=context.createStereoPanner ? context.createStereoPanner() : null;

      idleOsc.type="triangle";
      idleFilter.type="lowpass";
      idleFilter.frequency.value=150;
      idleFilter.Q.value=3.2;
      idleGain.gain.value=0;
      roadNoise.buffer=noiseBuffer;
      roadNoise.loop=true;
      roadFilter.type="bandpass";
      roadFilter.frequency.value=240;
      roadFilter.Q.value=0.7;
      roadGain.gain.value=0;
      skidNoise.buffer=noiseBuffer;
      skidNoise.loop=true;
      skidFilter.type="highpass";
      skidFilter.frequency.value=900;
      skidGain.gain.value=0;
      output.gain.value=0.85;

      idleOsc.connect(idleFilter);
      idleFilter.connect(idleGain);
      roadNoise.connect(roadFilter);
      roadFilter.connect(roadGain);
      skidNoise.connect(skidFilter);
      skidFilter.connect(skidGain);

      if(pan){
        pan.pan.value=0;
        idleGain.connect(pan);
        roadGain.connect(pan);
        skidGain.connect(pan);
        pan.connect(output);
      }else{
        idleGain.connect(output);
        roadGain.connect(output);
        skidGain.connect(output);
      }

      output.connect(master);
      idleOsc.start();
      roadNoise.start();
      skidNoise.start();

      return {
        car,
        idleOsc,
        idleFilter,
        idleGain,
        roadFilter,
        roadGain,
        skidFilter,
        skidGain,
        output,
        pan,
        nextPulseTime:0,
        airRev:0
      };
    });
  }

  function applyVolumes(){
    backgroundMusic.volume=musicVolume;
    if(master) master.gain.value=paused || !sfxEnabled || !playbackAllowed ? 0 : 0.26*sfxVolume;
  }

  function ensureBackgroundMusicSource(){
    if(backgroundMusic.src) return;
    backgroundMusic.src=musicPlaylist[musicTrackIndex];
  }

  function playBackgroundMusic(){
    if(!playbackAllowed || musicSuppressed || paused || musicVolume<=0) return;
    ensureBackgroundMusicSource();
    backgroundMusic.play().catch(()=>{});
  }

  function stopMusic(){
    musicSuppressed=true;
    if(musicSwitchTimer){
      window.clearTimeout(musicSwitchTimer);
      musicSwitchTimer=null;
    }
    if(!backgroundMusic.paused) backgroundMusic.pause();
    try{ backgroundMusic.currentTime=0; }catch(error){}
  }

  function advanceBackgroundMusic(){
    if(musicSwitchTimer){
      window.clearTimeout(musicSwitchTimer);
      musicSwitchTimer=null;
    }

    musicPlayCount++;
    if(musicPlayCount>=musicLoopsPerTrack){
      musicPlayCount=0;
      musicTrackIndex=(musicTrackIndex+1)%musicPlaylist.length;
      backgroundMusic.src=musicPlaylist[musicTrackIndex];
      musicSwitchTimer=window.setTimeout(()=>{
        musicSwitchTimer=null;
        playBackgroundMusic();
      },musicSwitchDelayMs);
    }else{
      backgroundMusic.currentTime=0;
      playBackgroundMusic();
    }
  }

  function setMusicVolume(value){
    musicVolume=clamp(Number(value) || 0,0,1);
    applyVolumes();
    if(playbackAllowed && !musicSuppressed && !paused && musicVolume>0 && backgroundMusic.paused) playBackgroundMusic();
  }

  function setSfxVolume(value){
    sfxVolume=clamp(Number(value) || 0,0,1);
    applyVolumes();
  }

  function setPaused(value){
    paused=!!value;
    applyVolumes();
  }

  function setSfxEnabled(value){
    sfxEnabled=!!value;
    applyVolumes();
  }

  function setPlaybackAllowed(value){
    playbackAllowed=!!value;
    if(playbackAllowed){
      musicSuppressed=false;
      sfxEnabled=true;
      ensureContext();
      if(context && context.state==="suspended") context.resume();
      applyVolumes();
      playBackgroundMusic();
    }else{
      if(!backgroundMusic.paused) backgroundMusic.pause();
      applyVolumes();
    }
  }

  function getVolumeSettings(){
    return {
      music:musicVolume,
      sfx:sfxVolume
    };
  }

  function ensureRainAudio(){
    ensureContext();
    if(!context || !supported || rainAudio) return rainAudio;

    let rainNoise=context.createBufferSource();
    let rainFilter=context.createBiquadFilter();
    let rainGain=context.createGain();
    let patterNoise=context.createBufferSource();
    let patterFilter=context.createBiquadFilter();
    let patterGain=context.createGain();
    let output=context.createGain();

    rainNoise.buffer=noiseBuffer || createNoiseBuffer();
    rainNoise.loop=true;
    rainFilter.type="bandpass";
    rainFilter.frequency.value=1150;
    rainFilter.Q.value=0.55;
    rainGain.gain.value=0;

    patterNoise.buffer=noiseBuffer || createNoiseBuffer();
    patterNoise.loop=true;
    patterFilter.type="highpass";
    patterFilter.frequency.value=5100;
    patterFilter.Q.value=0.72;
    patterGain.gain.value=0;
    output.gain.value=1;

    rainNoise.connect(rainFilter);
    rainFilter.connect(rainGain);
    patterNoise.connect(patterFilter);
    patterFilter.connect(patterGain);
    rainGain.connect(output);
    patterGain.connect(output);
    output.connect(master);

    rainNoise.start();
    patterNoise.start();

    rainAudio={
      rainFilter,
      rainGain,
      patterFilter,
      patterGain,
      output
    };
    return rainAudio;
  }

  function updateRain(intensity=0){
    let level=clamp(Number(intensity) || 0,0,1);
    if(level<=0.002 && !rainAudio) return;

    let audio=ensureRainAudio();
    if(!audio || !context || !supported) return;

    let now=context.currentTime;
    let bed=Math.pow(level,0.72);
    let splatter=Math.pow(level,0.92);
    let heavy=level*level;
    audio.rainGain.gain.setTargetAtTime(bed*(0.038+0.024*(1-heavy)),now,0.78);
    audio.patterGain.gain.setTargetAtTime(splatter*(0.052+heavy*0.056),now,0.28);
    audio.rainFilter.frequency.setTargetAtTime(760+level*820,now,0.9);
    audio.rainFilter.Q.setTargetAtTime(0.42+level*0.26,now,0.9);
    audio.patterFilter.frequency.setTargetAtTime(4300+level*3600,now,0.32);
    audio.patterFilter.Q.setTargetAtTime(0.65+level*0.7,now,0.32);
  }

  function visibleCarCount(){
    return cars.filter(car=>car && (!car.group || car.group.visible) && car.health>0).length;
  }

  function screenPanForCar(car,count=visibleCarCount()){
    if(count<2) return 0;
    if(car && car.id==="car2") return -0.42;
    if(car && car.id==="car1") return 0.42;
    return 0;
  }

  function listenerStates(){
    let active=cars.filter(car=>car && (!car.group || car.group.visible) && car.health>0);
    let listeners=active.length ? active : (cars[0] ? [cars[0]] : []);

    return listeners.map((car,index)=>({
      x:Number.isFinite(car.x) ? car.x : 0,
      z:Number.isFinite(car.z) ? car.z : 0,
      yaw:Number.isFinite(car.cameraYaw) ? car.cameraYaw : Number.isFinite(car.angle) ? car.angle : 0,
      screenPan:screenPanForCar(car,listeners.length)
    }));
  }

  function spatialMetrics(position,options={}){
    if(!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return {gain:1,pan:0};

    let minDistance=options.minDistance ?? 24;
    let maxDistance=options.maxDistance ?? 760;
    let rolloff=options.rolloff ?? 2.8;
    let volume=options.volume ?? 1;
    let listeners=listenerStates();
    if(!listeners.length) return {gain:1,pan:0};

    let panStrength=options.panStrength ?? 0.82;
    let strongestGain=0;
    let weightedPan=0;
    let totalWeight=0;

    for(let listener of listeners){
      let dx=position.x-listener.x;
      let dz=position.z-listener.z;
      let distance=Math.hypot(dx,dz);
      let falloff=distance<=minDistance
        ? 1
        : 1/(1+((distance-minDistance)/Math.max(1,maxDistance-minDistance))*rolloff);
      let listenerGain=clamp(falloff*volume,options.floor ?? 0.025,1.25);
      let rightX=Math.cos(listener.yaw);
      let rightZ=-Math.sin(listener.yaw);
      let localPan=distance>0.001 ? clamp((dx*rightX+dz*rightZ)/distance,-1,1) : 0;
      let pan=clamp(listener.screenPan-localPan*panStrength*0.58,-1,1);
      let weight=listenerGain*listenerGain;

      strongestGain=Math.max(strongestGain,listenerGain);
      weightedPan+=pan*weight;
      totalWeight+=weight;
    }

    let gain=clamp(strongestGain,options.floor ?? 0.025,1.25);
    let pan=totalWeight>0 ? clamp(weightedPan/totalWeight,-1,1) : 0;
    return {gain,pan};
  }

  function spatialDestination(position,options={}){
    if(!context || !supported) return master;
    let metrics=spatialMetrics(position,options);
    let distanceGain=context.createGain();
    distanceGain.gain.value=metrics.gain;

    if(context.createStereoPanner){
      let pan=context.createStereoPanner();
      pan.pan.value=metrics.pan;
      pan.connect(distanceGain);
      distanceGain.connect(master);
      return pan;
    }

    distanceGain.connect(master);
    return distanceGain;
  }

  function updateSpatialRoute(route,position,options={}){
    if(!route || !context || !supported) return 1;
    let metrics=spatialMetrics(position,options);
    let now=context.currentTime;
    if(route.gain) route.gain.gain.setTargetAtTime(metrics.gain,now,0.18);
    if(route.pan) route.pan.pan.setTargetAtTime(metrics.pan,now,0.18);
    return metrics.gain;
  }

  function createNoiseBuffer(){
    let length=context.sampleRate*2;
    let buffer=context.createBuffer(1,length,context.sampleRate);
    let data=buffer.getChannelData(0);
    let last=0;

    for(let i=0;i<length;i++){
      let white=Math.random()*2-1;
      last=last*0.82+white*0.18;
      data[i]=last;
    }

    return buffer;
  }

  function loadRocketLaunchBuffer(){
    if(!context || !supported) return null;
    if(rocketLaunchBuffer) return Promise.resolve(rocketLaunchBuffer);
    if(rocketLaunchBufferPromise) return rocketLaunchBufferPromise;

    rocketLaunchBufferPromise=fetch("./assets/sounds/rocketLaunch.mp3")
      .then(response=>{
        if(!response.ok) throw new Error(`Failed to load rocketLaunch.mp3: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data=>context.decodeAudioData(data))
      .then(buffer=>{
        rocketLaunchBuffer=buffer;
        return buffer;
      })
      .catch(error=>{
        console.warn(error);
        rocketLaunchBufferPromise=null;
        return null;
      });

    return rocketLaunchBufferPromise;
  }

  function loadRocketImpactBuffer(){
    if(!context || !supported) return null;
    if(rocketImpactBuffer) return Promise.resolve(rocketImpactBuffer);
    if(rocketImpactBufferPromise) return rocketImpactBufferPromise;

    rocketImpactBufferPromise=fetch("./assets/sounds/rocketImpact.mp3")
      .then(response=>{
        if(!response.ok) throw new Error(`Failed to load rocketImpact.mp3: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data=>context.decodeAudioData(data))
      .then(buffer=>{
        rocketImpactBuffer=buffer;
        return buffer;
      })
      .catch(error=>{
        console.warn(error);
        rocketImpactBufferPromise=null;
        return null;
      });

    return rocketImpactBufferPromise;
  }

  function loadCannonImpactBuffer(){
    if(!context || !supported) return null;
    if(cannonImpactBuffer) return Promise.resolve(cannonImpactBuffer);
    if(cannonImpactBufferPromise) return cannonImpactBufferPromise;

    cannonImpactBufferPromise=fetch("./assets/sounds/cannonImpact.mp3")
      .then(response=>{
        if(!response.ok) throw new Error(`Failed to load cannonImpact.mp3: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data=>context.decodeAudioData(data))
      .then(buffer=>{
        cannonImpactBuffer=buffer;
        return buffer;
      })
      .catch(error=>{
        console.warn(error);
        cannonImpactBufferPromise=null;
        return null;
      });

    return cannonImpactBufferPromise;
  }

  function loadPlayerLaserBuffer(){
    if(!context || !supported) return null;
    if(playerLaserBuffer) return Promise.resolve(playerLaserBuffer);
    if(playerLaserBufferPromise) return playerLaserBufferPromise;

    playerLaserBufferPromise=fetch("./assets/sounds/laser.mp3")
      .then(response=>{
        if(!response.ok) throw new Error(`Failed to load laser.mp3: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data=>context.decodeAudioData(data))
      .then(buffer=>{
        playerLaserBuffer=buffer;
        return buffer;
      })
      .catch(error=>{
        console.warn(error);
        playerLaserBufferPromise=null;
        return null;
      });

    return playerLaserBufferPromise;
  }

  function loadGiantFootstepBuffer(){
    if(!context || !supported) return null;
    if(giantFootstepBuffer) return Promise.resolve(giantFootstepBuffer);
    if(giantFootstepBufferPromise) return giantFootstepBufferPromise;

    giantFootstepBufferPromise=fetch("./assets/sounds/GiantWalking.mp3")
      .then(response=>{
        if(!response.ok) throw new Error(`Failed to load GiantWalking.mp3: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data=>context.decodeAudioData(data))
      .then(buffer=>{
        giantFootstepBuffer=buffer;
        return buffer;
      })
      .catch(error=>{
        console.warn(error);
        giantFootstepBufferPromise=null;
        return null;
      });

    return giantFootstepBufferPromise;
  }

  function loadScannerBuffer(){
    if(!context || !supported) return null;
    if(scannerBuffer) return Promise.resolve(scannerBuffer);
    if(scannerBufferPromise) return scannerBufferPromise;

    scannerBufferPromise=fetch("./assets/sounds/scanner.mp3")
      .then(response=>{
        if(!response.ok) throw new Error(`Failed to load scanner.mp3: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data=>context.decodeAudioData(data))
      .then(buffer=>{
        scannerBuffer=buffer;
        return buffer;
      })
      .catch(error=>{
        console.warn(error);
        scannerBufferPromise=null;
        return null;
      });

    return scannerBufferPromise;
  }

  function resume(){
    ensureContext();
    if(context && context.state==="suspended") context.resume();
    if(playbackAllowed) sfxEnabled=true;
    applyVolumes();
    if(playbackAllowed && backgroundMusic.paused){
      playBackgroundMusic();
    }
  }

  backgroundMusic.addEventListener("ended",advanceBackgroundMusic);

  window.addEventListener("pointerdown",resume);
  window.addEventListener("keydown",resume);
  window.addEventListener("click",resume);
  window.addEventListener("gamepadconnected",resume);

  function update(){
    if(!context || context.state!=="running") return;

    let now=context.currentTime;
    let activeMotorCount=visibleCarCount();
    for(let motor of motors){
      let car=motor.car;
      let speedRatio=clamp(Math.abs(car.speed || 0)/0.38,0,1);
      let throttle=clamp(Math.max(0,car.throttleInput || 0),0,1);
      let disabled=car.health<=0 || (car.group && !car.group.visible);
      let onGround=car.onGround!==false;
      let airborne=car.airborne===true;
      let mechMode=(car.morphProgress || 0)<0.35 && (car.jetProgress || 0)<0.35;
      let offroad=clamp(((car.surfaceDistance || 0)-34)/72,0,1);
      let slip=clamp(car.slipAmount || 0,0,1);
      let targetAirRev=airborne && !disabled ? 1 : 0;
      motor.airRev+=(targetAirRev-motor.airRev)*(targetAirRev>motor.airRev ? 0.055 : 0.022);

      let idleFrequency=disabled ? 26 : 32+speedRatio*18+throttle*8+motor.airRev*58;
      let idleGain=disabled ? 0.004 : mechMode ? 0.003 : 0.016+speedRatio*0.016+throttle*0.012+motor.airRev*0.014;

      motor.idleOsc.frequency.setTargetAtTime(idleFrequency,now,0.07);
      motor.idleFilter.frequency.setTargetAtTime(130+speedRatio*170+throttle*80+motor.airRev*180,now,0.08);
      motor.idleGain.gain.setTargetAtTime(idleGain,now,0.08);
      motor.roadFilter.frequency.setTargetAtTime(130+speedRatio*260+offroad*180,now,0.12);
      motor.roadFilter.Q.setTargetAtTime(0.55+offroad*0.35,now,0.12);
      motor.roadGain.gain.setTargetAtTime(!mechMode && onGround && !disabled ? speedRatio*(0.018+offroad*0.045) : 0,now,0.12);
      motor.skidFilter.frequency.setTargetAtTime(620+speedRatio*620+offroad*240,now,0.08);
      motor.skidGain.gain.setTargetAtTime(!mechMode && onGround && !disabled ? Math.pow(slip,1.35)*speedRatio*(0.018+offroad*0.018) : 0,now,0.07);
      if(motor.pan) motor.pan.pan.setTargetAtTime(screenPanForCar(car,activeMotorCount),now,0.18);

      if(disabled) continue;
      if(motor.nextPulseTime<now) motor.nextPulseTime=now;
      motor.nextPulseTime=now+0.08;
    }
  }

  function playRocketLaunch(car,position=car){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();
    if(!rocketLaunchBuffer){
      loadRocketLaunchBuffer();
      return;
    }

    let destination=spatialDestination(position,{minDistance:18,maxDistance:520,rolloff:3.2,volume:1});
    let time=context.currentTime+0.01;
    let source=context.createBufferSource();
    let gain=context.createGain();

    source.buffer=rocketLaunchBuffer;
    source.playbackRate.setValueAtTime(0.98+Math.random()*0.04,time);
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(0.06,time+0.006);
    gain.gain.setTargetAtTime(0.0001,time+0.1,0.42);

    source.connect(gain);
    gain.connect(destination);

    source.start(time);
    source.stop(time+Math.min(rocketLaunchBuffer.duration,1.6));
  }

  function playCannonFire(car,position=car){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();

    let destination=spatialDestination(position,{minDistance:20,maxDistance:560,rolloff:3.4,volume:1});
    let time=context.currentTime+0.006;
    let crack=context.createBufferSource();
    let crackFilter=context.createBiquadFilter();
    let crackGain=context.createGain();
    let blast=context.createBufferSource();
    let blastFilter=context.createBiquadFilter();
    let blastGain=context.createGain();
    let thump=context.createOscillator();
    let thumpGain=context.createGain();
    let snap=context.createOscillator();
    let snapGain=context.createGain();

    crack.buffer=noiseBuffer || createNoiseBuffer();
    crackFilter.type="highpass";
    crackFilter.frequency.setValueAtTime(680,time);
    crackFilter.Q.setValueAtTime(0.55,time);
    crackGain.gain.setValueAtTime(0.0001,time);
    crackGain.gain.exponentialRampToValueAtTime(0.34,time+0.004);
    crackGain.gain.exponentialRampToValueAtTime(0.0001,time+0.11);

    blast.buffer=noiseBuffer || createNoiseBuffer();
    blastFilter.type="lowpass";
    blastFilter.frequency.setValueAtTime(1450,time);
    blastFilter.frequency.exponentialRampToValueAtTime(260,time+0.18);
    blastFilter.Q.setValueAtTime(0.9,time);
    blastGain.gain.setValueAtTime(0.0001,time);
    blastGain.gain.exponentialRampToValueAtTime(0.2,time+0.006);
    blastGain.gain.exponentialRampToValueAtTime(0.0001,time+0.24);

    thump.type="sine";
    thump.frequency.setValueAtTime(96,time);
    thump.frequency.exponentialRampToValueAtTime(34,time+0.18);
    thumpGain.gain.setValueAtTime(0.0001,time);
    thumpGain.gain.exponentialRampToValueAtTime(0.2,time+0.008);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001,time+0.24);

    snap.type="square";
    snap.frequency.setValueAtTime(2600,time);
    snap.frequency.exponentialRampToValueAtTime(880,time+0.025);
    snapGain.gain.setValueAtTime(0.0001,time);
    snapGain.gain.exponentialRampToValueAtTime(0.045,time+0.002);
    snapGain.gain.exponentialRampToValueAtTime(0.0001,time+0.035);

    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    blast.connect(blastFilter);
    blastFilter.connect(blastGain);
    thump.connect(thumpGain);
    snap.connect(snapGain);
    crackGain.connect(destination);
    blastGain.connect(destination);
    thumpGain.connect(destination);
    snapGain.connect(destination);

    crack.start(time);
    blast.start(time);
    thump.start(time);
    snap.start(time);
    crack.stop(time+0.12);
    blast.stop(time+0.25);
    thump.stop(time+0.25);
    snap.stop(time+0.04);
  }

  function playExplosion(position=null,options={}){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();

    let volume=clamp(Number(options.volume) || 1,0,2.5);
    let time=context.currentTime+0.005;
    let boom=context.createOscillator();
    let boomGain=context.createGain();
    let noise=context.createBufferSource();
    let noiseFilter=context.createBiquadFilter();
    let noiseGain=context.createGain();
    let destination=spatialDestination(position,{minDistance:34,maxDistance:980,rolloff:2.2,volume});

    noise.buffer=noiseBuffer || createNoiseBuffer();
    boom.type="sine";
    boom.frequency.setValueAtTime(42,time);
    boom.frequency.exponentialRampToValueAtTime(16,time+0.9);
    boomGain.gain.setValueAtTime(0.0001,time);
    boomGain.gain.exponentialRampToValueAtTime(0.42,time+0.018);
    boomGain.gain.exponentialRampToValueAtTime(0.0001,time+1.35);

    noiseFilter.type="lowpass";
    noiseFilter.frequency.setValueAtTime(760,time);
    noiseFilter.frequency.exponentialRampToValueAtTime(90,time+1.25);
    noiseFilter.Q.setValueAtTime(0.85,time);
    noiseGain.gain.setValueAtTime(0.0001,time);
    noiseGain.gain.exponentialRampToValueAtTime(0.38,time+0.026);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001,time+1.45);

    boom.connect(boomGain);
    boomGain.connect(destination);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(destination);

    boom.start(time);
    noise.start(time);
    boom.stop(time+1.42);
    noise.stop(time+1.5);
  }

  function playRocketImpact(position=null){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();
    if(!rocketImpactBuffer){
      loadRocketImpactBuffer();
      return;
    }

    let time=context.currentTime+0.004;
    let source=context.createBufferSource();
    let gain=context.createGain();
    let destination=spatialDestination(position,{minDistance:26,maxDistance:820,rolloff:2.8,volume:1});

    source.buffer=rocketImpactBuffer;
    source.playbackRate.setValueAtTime(0.98+Math.random()*0.04,time);
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(1,time+0.006);
    gain.gain.setTargetAtTime(0.0001,time+0.1,0.42);

    source.connect(gain);
    gain.connect(destination);

    source.start(time);
    source.stop(time+Math.min(rocketImpactBuffer.duration,1.8));
  }

  function playCannonImpact(position=null){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();
    if(!cannonImpactBuffer){
      loadCannonImpactBuffer();
      return;
    }

    let time=context.currentTime+0.004;
    let source=context.createBufferSource();
    let gain=context.createGain();
    let destination=spatialDestination(position,{minDistance:22,maxDistance:700,rolloff:3.1,volume:1});

    source.buffer=cannonImpactBuffer;
    source.playbackRate.setValueAtTime(0.98+Math.random()*0.04,time);
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(1,time+0.006);
    gain.gain.setTargetAtTime(0.0001,time+0.08,0.32);

    source.connect(gain);
    gain.connect(destination);

    source.start(time);
    source.stop(time+Math.min(cannonImpactBuffer.duration,1.4));
  }

  function playBombExplosion(position=null){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();

    let time=context.currentTime+0.005;
    let sub=context.createOscillator();
    let subGain=context.createGain();
    let body=context.createOscillator();
    let bodyGain=context.createGain();
    let noise=context.createBufferSource();
    let noiseFilter=context.createBiquadFilter();
    let noiseGain=context.createGain();
    let destination=spatialDestination(position,{minDistance:52,maxDistance:1300,rolloff:1.8,volume:1.1});

    noise.buffer=noiseBuffer || createNoiseBuffer();

    sub.type="sine";
    sub.frequency.setValueAtTime(28,time);
    sub.frequency.exponentialRampToValueAtTime(11,time+1.65);
    subGain.gain.setValueAtTime(0.0001,time);
    subGain.gain.exponentialRampToValueAtTime(0.86,time+0.035);
    subGain.gain.exponentialRampToValueAtTime(0.0001,time+2.25);

    body.type="triangle";
    body.frequency.setValueAtTime(54,time);
    body.frequency.exponentialRampToValueAtTime(18,time+1.25);
    bodyGain.gain.setValueAtTime(0.0001,time);
    bodyGain.gain.exponentialRampToValueAtTime(0.48,time+0.05);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001,time+1.85);

    noiseFilter.type="lowpass";
    noiseFilter.frequency.setValueAtTime(210,time);
    noiseFilter.frequency.exponentialRampToValueAtTime(38,time+1.8);
    noiseFilter.Q.setValueAtTime(0.7,time);
    noiseGain.gain.setValueAtTime(0.0001,time);
    noiseGain.gain.exponentialRampToValueAtTime(0.62,time+0.055);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001,time+2.4);

    sub.connect(subGain);
    body.connect(bodyGain);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    subGain.connect(destination);
    bodyGain.connect(destination);
    noiseGain.connect(destination);

    sub.start(time);
    body.start(time);
    noise.start(time);
    sub.stop(time+2.3);
    body.stop(time+1.9);
    noise.stop(time+2.45);
  }

  function playGiantFootstep(intensity=1,position=null){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();

    intensity=clamp(Number(intensity) || 0,0,1);
    if(intensity<=0.01) return;
    if(!giantFootstepBuffer){
      loadGiantFootstepBuffer();
      return;
    }

    let time=context.currentTime+0.004;
    let source=context.createBufferSource();
    let gain=context.createGain();
    let destination=spatialDestination(position,{minDistance:34,maxDistance:720,rolloff:2.4,volume:1,panStrength:0.62});

    source.buffer=giantFootstepBuffer;
    source.playbackRate.setValueAtTime(0.96+Math.random()*0.08,time);
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(1.45*intensity,time+0.01);
    gain.gain.setTargetAtTime(0.0001,time+0.08,0.32);

    source.connect(gain);
    gain.connect(destination);

    source.start(time);
    source.stop(time+Math.min(giantFootstepBuffer.duration,1.4));
  }

  function playScannerPulse(){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();
    if(!scannerBuffer){
      loadScannerBuffer().then(buffer=>{
        if(buffer) playScannerBuffer(buffer);
      });
      return;
    }

    playScannerBuffer(scannerBuffer);
  }

  function playScannerBuffer(buffer){
    if(!context || !supported || !buffer) return;
    let time=context.currentTime+0.006;
    let source=context.createBufferSource();
    let gain=context.createGain();

    source.buffer=buffer;
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(1,time+0.006);
    gain.gain.setTargetAtTime(0.0001,time+buffer.duration*0.82,0.08);

    source.connect(gain);
    gain.connect(master);

    source.start(time);
    source.stop(time+buffer.duration);
  }

  function playLaserFire(position=null){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();

    let time=context.currentTime+0.004;
    let zap=context.createOscillator();
    let zapGain=context.createGain();
    let body=context.createOscillator();
    let bodyGain=context.createGain();
    let noise=context.createBufferSource();
    let noiseFilter=context.createBiquadFilter();
    let noiseGain=context.createGain();
    let destination=spatialDestination(position,{minDistance:30,maxDistance:760,rolloff:3.0,volume:1});

    zap.type="sawtooth";
    zap.frequency.setValueAtTime(1800,time);
    zap.frequency.exponentialRampToValueAtTime(420,time+0.11);
    zapGain.gain.setValueAtTime(0.0001,time);
    zapGain.gain.exponentialRampToValueAtTime(0.16,time+0.006);
    zapGain.gain.exponentialRampToValueAtTime(0.0001,time+0.16);

    body.type="triangle";
    body.frequency.setValueAtTime(118,time);
    body.frequency.exponentialRampToValueAtTime(58,time+0.18);
    bodyGain.gain.setValueAtTime(0.0001,time);
    bodyGain.gain.exponentialRampToValueAtTime(0.14,time+0.008);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001,time+0.22);

    noise.buffer=noiseBuffer || createNoiseBuffer();
    noiseFilter.type="bandpass";
    noiseFilter.frequency.setValueAtTime(2400,time);
    noiseFilter.frequency.exponentialRampToValueAtTime(780,time+0.16);
    noiseFilter.Q.setValueAtTime(3.4,time);
    noiseGain.gain.setValueAtTime(0.0001,time);
    noiseGain.gain.exponentialRampToValueAtTime(0.12,time+0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001,time+0.18);

    zap.connect(zapGain);
    body.connect(bodyGain);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    zapGain.connect(destination);
    bodyGain.connect(destination);
    noiseGain.connect(destination);

    zap.start(time);
    body.start(time);
    noise.start(time);
    zap.stop(time+0.18);
    body.stop(time+0.24);
    noise.stop(time+0.2);
  }

  function playPlayerLaserFire(position=null,duration=5){
    ensureContext();
    if(!context || !supported) return null;
    if(context.state==="suspended") context.resume();
    if(!playerLaserBuffer){
      loadPlayerLaserBuffer();
      return null;
    }

    let time=context.currentTime+0.004;
    let source=context.createBufferSource();
    let gain=context.createGain();
    let destination=spatialDestination(position,{minDistance:24,maxDistance:760,rolloff:2.8,volume:1});
    let stopAt=time+Math.min(playerLaserBuffer.duration,Math.max(0.1,duration));
    let stopped=false;

    source.buffer=playerLaserBuffer;
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(0.82,time+0.018);
    gain.gain.setTargetAtTime(0.0001,Math.max(time+0.08,stopAt-0.18),0.08);

    source.connect(gain);
    gain.connect(destination);
    source.start(time);
    source.stop(stopAt+0.04);

    return ()=>{
      if(stopped) return;
      stopped=true;
      let now=context.currentTime;
      try{
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(0.0001,gain.gain.value || 0.0001),now);
        gain.gain.exponentialRampToValueAtTime(0.0001,now+0.08);
        source.stop(now+0.1);
      }catch(error){}
    };
  }

  function playTerminalBleep(){
    ensureContext();
    if(!context || !supported || !sfxEnabled) return;
    if(context.state==="suspended") context.resume();

    let time=context.currentTime+0.004;
    let ping=context.createOscillator();
    let overtone=context.createOscillator();
    let gain=context.createGain();
    let filter=context.createBiquadFilter();
    let volume=0.18*sfxVolume;

    ping.type="triangle";
    overtone.type="sine";
    ping.frequency.setValueAtTime(880,time);
    ping.frequency.exponentialRampToValueAtTime(1320,time+0.055);
    overtone.frequency.setValueAtTime(1760,time);
    overtone.frequency.exponentialRampToValueAtTime(2140,time+0.045);
    filter.type="bandpass";
    filter.frequency.setValueAtTime(1450,time);
    filter.Q.setValueAtTime(5.5,time);
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001,volume),time+0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001,time+0.16);

    ping.connect(filter);
    overtone.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    ping.start(time);
    overtone.start(time);
    ping.stop(time+0.18);
    overtone.stop(time+0.14);
  }

  function playMenuClick(){
    ensureContext();
    if(!context || !supported || sfxVolume<=0) return;
    if(context.state==="suspended") context.resume();

    let time=context.currentTime+0.004;
    let tick=context.createOscillator();
    let body=context.createOscillator();
    let filter=context.createBiquadFilter();
    let gain=context.createGain();
    let volume=0.11*sfxVolume;

    tick.type="triangle";
    body.type="sine";
    tick.frequency.setValueAtTime(1160,time);
    tick.frequency.exponentialRampToValueAtTime(1520,time+0.035);
    body.frequency.setValueAtTime(420,time);
    body.frequency.exponentialRampToValueAtTime(260,time+0.06);
    filter.type="bandpass";
    filter.frequency.setValueAtTime(1180,time);
    filter.Q.setValueAtTime(4.2,time);
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001,volume),time+0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001,time+0.075);

    tick.connect(filter);
    body.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    tick.start(time);
    body.start(time);
    tick.stop(time+0.09);
    body.stop(time+0.085);
  }

  function speakRoboticSystemPhrase(text){
    if("speechSynthesis" in window && "SpeechSynthesisUtterance" in window){
      let utterance=new SpeechSynthesisUtterance(text);
      utterance.volume=clamp(0.72*sfxVolume,0,1);
      utterance.rate=0.88;
      utterance.pitch=1.64;
      let voices=window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      let preferred=voices.find(voice=>/en/i.test(voice.lang) && /samantha|victoria|karen|moira|tessa|serena|susan|zira|aria|jenny|female/i.test(voice.name))
        || voices.find(voice=>/en/i.test(voice.lang) && /google.*english|compact|system/i.test(voice.name) && !/fred|daniel|alex|male/i.test(voice.name))
        || voices.find(voice=>/en/i.test(voice.lang) && /fred|zarvox|trinoids|boing|cellos|bad news|good news|bells/i.test(voice.name))
        || voices.find(voice=>/en/i.test(voice.lang))
        || voices[0];
      if(preferred) utterance.voice=preferred;
      try{
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }catch(error){}
    }
  }

  function playMissionInitiatedVoice(){
    speakRoboticSystemPhrase("Mission. Initiated.");
  }

  function playLandingSequenceVoice(){
    speakRoboticSystemPhrase("Landing. Sequence. Initiated.");
  }

  function startMothershipHum(position=null){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();
    if(mothershipHum && !mothershipHum.stopping) return;
    if(mothershipHum) stopMothershipHum(true);

    let time=context.currentTime;
    let low=context.createOscillator();
    let high=context.createOscillator();
    let lowFilter=context.createBiquadFilter();
    let noise=context.createBufferSource();
    let noiseFilter=context.createBiquadFilter();
    let noiseGain=context.createGain();
    let output=context.createGain();
    let spatialGain=context.createGain();
    let spatialPan=context.createStereoPanner ? context.createStereoPanner() : null;

    low.type="sawtooth";
    high.type="triangle";
    low.frequency.setValueAtTime(38,time);
    high.frequency.setValueAtTime(76,time);
    lowFilter.type="lowpass";
    lowFilter.frequency.setValueAtTime(160,time);
    lowFilter.Q.setValueAtTime(3.8,time);

    noise.buffer=noiseBuffer || createNoiseBuffer();
    noise.loop=true;
    noiseFilter.type="bandpass";
    noiseFilter.frequency.setValueAtTime(84,time);
    noiseFilter.Q.setValueAtTime(1.9,time);
    noiseGain.gain.setValueAtTime(0.026,time);
    output.gain.setValueAtTime(0.0001,time);
    output.gain.setTargetAtTime(0.12,time+0.02,0.55);

    low.connect(lowFilter);
    lowFilter.connect(output);
    high.connect(output);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);
    if(spatialPan){
      output.connect(spatialPan);
      spatialPan.connect(spatialGain);
    }else{
      output.connect(spatialGain);
    }
    spatialGain.connect(master);
    let initialSpatial=spatialMetrics(position,{minDistance:80,maxDistance:1450,rolloff:1.7,volume:1,panStrength:0.7});
    spatialGain.gain.value=initialSpatial.gain;
    if(spatialPan) spatialPan.pan.value=initialSpatial.pan;

    low.start(time);
    high.start(time);
    noise.start(time);

    mothershipHum={
      low,
      high,
      lowFilter,
      noise,
      noiseFilter,
      noiseGain,
      output,
      spatialGain,
      spatialPan,
      stopping:false
    };
  }

  function updateMothershipHum(intensity=1,position=null){
    if(!mothershipHum || !context || !supported) return;
    let now=context.currentTime;
    let level=clamp(intensity,0,1);
    let wobble=0.5+0.5*Math.sin(now*1.8);
    updateSpatialRoute(
      {gain:mothershipHum.spatialGain,pan:mothershipHum.spatialPan},
      position,
      {minDistance:80,maxDistance:1450,rolloff:1.7,volume:1,panStrength:0.7}
    );

    mothershipHum.low.frequency.setTargetAtTime(34+level*9+wobble*2.2,now,0.18);
    mothershipHum.high.frequency.setTargetAtTime(68+level*18+wobble*5.5,now,0.16);
    mothershipHum.lowFilter.frequency.setTargetAtTime(120+level*90+wobble*25,now,0.22);
    mothershipHum.noiseFilter.frequency.setTargetAtTime(72+level*58+wobble*18,now,0.2);
    mothershipHum.output.gain.setTargetAtTime(0.035+level*0.125,now,0.28);
  }

  function stopMothershipHum(immediate=false){
    if(!mothershipHum || !context || !supported) return;
    let hum=mothershipHum;
    let now=context.currentTime;
    let stopTime=immediate ? now+0.02 : now+0.75;
    hum.stopping=true;
    hum.output.gain.cancelScheduledValues(now);
    hum.output.gain.setTargetAtTime(0.0001,now,immediate ? 0.01 : 0.24);

    try{ hum.low.stop(stopTime); }catch(error){}
    try{ hum.high.stop(stopTime); }catch(error){}
    try{ hum.noise.stop(stopTime); }catch(error){}
    window.setTimeout(()=>{
      if(mothershipHum===hum) mothershipHum=null;
      try{ hum.output.disconnect(); }catch(error){}
      try{ hum.spatialGain.disconnect(); }catch(error){}
      try{ if(hum.spatialPan) hum.spatialPan.disconnect(); }catch(error){}
    },immediate ? 40 : 850);
  }

  function startAmbientSpaceshipFlyover(position=null,options={}){
    ensureContext();
    if(!context || !supported || !sfxEnabled) return null;
    if(context.state==="suspended") context.resume();

    let time=context.currentTime;
    let low=context.createOscillator();
    let whine=context.createOscillator();
    let lowFilter=context.createBiquadFilter();
    let lowGain=context.createGain();
    let whineGain=context.createGain();
    let noise=context.createBufferSource();
    let noiseFilter=context.createBiquadFilter();
    let noiseGain=context.createGain();
    let output=context.createGain();
    let spatialGain=context.createGain();
    let spatialPan=context.createStereoPanner ? context.createStereoPanner() : null;
    let routeOptions={
      minDistance:options.minDistance ?? 260,
      maxDistance:options.maxDistance ?? 4200,
      rolloff:options.rolloff ?? 1.05,
      volume:options.volume ?? 0.52,
      floor:options.floor ?? 0,
      panStrength:options.panStrength ?? 0.62
    };

    low.type="triangle";
    whine.type="sine";
    low.frequency.setValueAtTime(54,time);
    whine.frequency.setValueAtTime(116,time);
    lowFilter.type="lowpass";
    lowFilter.frequency.setValueAtTime(210,time);
    lowFilter.Q.setValueAtTime(0.7,time);
    lowGain.gain.setValueAtTime(0.012,time);
    whineGain.gain.setValueAtTime(0.004,time);

    noise.buffer=noiseBuffer || createNoiseBuffer();
    noise.loop=true;
    noiseFilter.type="bandpass";
    noiseFilter.frequency.setValueAtTime(1350,time);
    noiseFilter.Q.setValueAtTime(0.28,time);
    noiseGain.gain.setValueAtTime(0.15,time);
    output.gain.setValueAtTime(0.0001,time);
    output.gain.setTargetAtTime(0.0001,time+0.02,0.35);

    low.connect(lowFilter);
    lowFilter.connect(lowGain);
    lowGain.connect(output);
    whine.connect(whineGain);
    whineGain.connect(output);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);
    if(spatialPan){
      output.connect(spatialPan);
      spatialPan.connect(spatialGain);
    }else{
      output.connect(spatialGain);
    }
    spatialGain.connect(master);
    let initialSpatial=spatialMetrics(position,routeOptions);
    spatialGain.gain.value=initialSpatial.gain;
    if(spatialPan) spatialPan.pan.value=initialSpatial.pan;

    low.start(time);
    whine.start(time);
    noise.start(time);

    return {
      low,
      whine,
      lowFilter,
      lowGain,
      whineGain,
      noise,
      noiseFilter,
      noiseGain,
      output,
      spatialGain,
      spatialPan,
      routeOptions,
      stopping:false,
      baseGain:options.gain ?? 0.06
    };
  }

  function updateAmbientSpaceshipFlyover(route,position=null,intensity=1){
    if(!route || !context || !supported || route.stopping) return;

    let now=context.currentTime;
    let level=clamp(intensity,0,1);
    let wobble=0.5+0.5*Math.sin(now*5.4);
    updateSpatialRoute(
      {gain:route.spatialGain,pan:route.spatialPan},
      position,
      route.routeOptions
    );

    route.low.frequency.setTargetAtTime(46+level*30+wobble*3,now,0.24);
    route.whine.frequency.setTargetAtTime(92+level*26+wobble*5,now,0.34);
    route.lowFilter.frequency.setTargetAtTime(150+level*120+wobble*22,now,0.5);
    if(route.lowGain) route.lowGain.gain.setTargetAtTime(0.004+level*0.012,now,0.42);
    if(route.whineGain) route.whineGain.gain.setTargetAtTime(0.0015+level*0.004,now,0.48);
    route.noiseFilter.frequency.setTargetAtTime(980+level*980+wobble*260,now,0.5);
    route.noiseGain.gain.setTargetAtTime(0.095+level*0.115,now,0.42);
    route.output.gain.setTargetAtTime(route.baseGain*(0.04+level*0.98)*(0.96+wobble*0.05),now,0.6);
  }

  function stopAmbientSpaceshipFlyover(route,immediate=false){
    if(!route || !context || !supported || route.stopping) return;

    let now=context.currentTime;
    let stopTime=immediate ? now+0.02 : now+0.72;
    route.stopping=true;
    route.output.gain.cancelScheduledValues(now);
    route.output.gain.setTargetAtTime(0.0001,now,immediate ? 0.01 : 0.22);

    try{ route.low.stop(stopTime); }catch(error){}
    try{ route.whine.stop(stopTime); }catch(error){}
    try{ route.noise.stop(stopTime); }catch(error){}
    window.setTimeout(()=>{
      try{ route.output.disconnect(); }catch(error){}
      try{ route.spatialGain.disconnect(); }catch(error){}
      try{ if(route.spatialPan) route.spatialPan.disconnect(); }catch(error){}
    },immediate ? 40 : 820);
  }

  function startIntroBeamSound(position=null){
    ensureContext();
    if(!context || !supported || !sfxEnabled) return null;
    if(context.state==="suspended") context.resume();

    let time=context.currentTime;
    let noise=context.createBufferSource();
    let crackle=context.createBufferSource();
    let fizzFilter=context.createBiquadFilter();
    let crackleFilter=context.createBiquadFilter();
    let fizzGain=context.createGain();
    let crackleGain=context.createGain();
    let body=context.createOscillator();
    let bodyGain=context.createGain();
    let whine=context.createOscillator();
    let whineFilter=context.createBiquadFilter();
    let whineGain=context.createGain();
    let output=context.createGain();
    let spatialGain=context.createGain();
    let spatialPan=context.createStereoPanner ? context.createStereoPanner() : null;
    let routeOptions={minDistance:26,maxDistance:920,rolloff:2.2,volume:1.1,panStrength:0.68};

    noise.buffer=noiseBuffer || createNoiseBuffer();
    noise.loop=true;
    crackle.buffer=noiseBuffer || createNoiseBuffer();
    crackle.loop=true;

    fizzFilter.type="highpass";
    fizzFilter.frequency.setValueAtTime(6200,time);
    fizzFilter.Q.setValueAtTime(0.82,time);
    crackleFilter.type="bandpass";
    crackleFilter.frequency.setValueAtTime(10400,time);
    crackleFilter.Q.setValueAtTime(5.4,time);
    fizzGain.gain.setValueAtTime(0.058,time);
    crackleGain.gain.setValueAtTime(0.02,time);

    body.type="sine";
    body.frequency.setValueAtTime(260,time);
    body.frequency.linearRampToValueAtTime(318,time+0.9);
    bodyGain.gain.setValueAtTime(0.072,time);

    whine.type="sine";
    whine.frequency.setValueAtTime(880,time);
    whine.frequency.linearRampToValueAtTime(1180,time+1.2);
    whineFilter.type="bandpass";
    whineFilter.frequency.setValueAtTime(1850,time);
    whineFilter.Q.setValueAtTime(3.2,time);
    whineGain.gain.setValueAtTime(0.088,time);

    output.gain.setValueAtTime(0.0001,time);
    output.gain.setTargetAtTime(0.2,time+0.02,0.2);

    noise.connect(fizzFilter);
    fizzFilter.connect(fizzGain);
    fizzGain.connect(output);
    crackle.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(output);
    body.connect(bodyGain);
    bodyGain.connect(output);
    whine.connect(whineFilter);
    whineFilter.connect(whineGain);
    whineGain.connect(output);

    if(spatialPan){
      output.connect(spatialPan);
      spatialPan.connect(spatialGain);
    }else{
      output.connect(spatialGain);
    }
    spatialGain.connect(master);
    let initialSpatial=spatialMetrics(position,routeOptions);
    spatialGain.gain.value=initialSpatial.gain;
    if(spatialPan) spatialPan.pan.value=initialSpatial.pan;

    noise.start(time);
    crackle.start(time);
    body.start(time);
    whine.start(time);

    return {
      noise,
      crackle,
      body,
      whine,
      fizzFilter,
      crackleFilter,
      output,
      spatialGain,
      spatialPan,
      routeOptions,
      stopping:false
    };
  }

  function stopIntroBeamSound(route,immediate=false){
    if(!route || !context || !supported || route.stopping) return;

    let now=context.currentTime;
    let stopTime=immediate ? now+0.02 : now+0.48;
    route.stopping=true;
    route.output.gain.cancelScheduledValues(now);
    route.output.gain.setTargetAtTime(0.0001,now,immediate ? 0.01 : 0.16);

    try{ route.noise.stop(stopTime); }catch(error){}
    try{ route.crackle.stop(stopTime); }catch(error){}
    try{ route.body.stop(stopTime); }catch(error){}
    try{ route.whine.stop(stopTime); }catch(error){}
    window.setTimeout(()=>{
      try{ route.output.disconnect(); }catch(error){}
      try{ route.spatialGain.disconnect(); }catch(error){}
      try{ if(route.spatialPan) route.spatialPan.disconnect(); }catch(error){}
    },immediate ? 40 : 620);
  }

  return {
    resume,
    update,
    setMusicVolume,
    setSfxVolume,
    setPaused,
    setSfxEnabled,
    setPlaybackAllowed,
    stopMusic,
    getVolumeSettings,
    playRocketLaunch,
    playCannonFire,
    playExplosion,
    playRocketImpact,
    playCannonImpact,
    playBombExplosion,
    playGiantFootstep,
    playScannerPulse,
    playLaserFire,
    playPlayerLaserFire,
    playTerminalBleep,
    playMenuClick,
    playMissionInitiatedVoice,
    playLandingSequenceVoice,
    startMothershipHum,
    updateMothershipHum,
    stopMothershipHum,
    startAmbientSpaceshipFlyover,
    updateAmbientSpaceshipFlyover,
    stopAmbientSpaceshipFlyover,
    startIntroBeamSound,
    stopIntroBeamSound,
    updateRain
  };
}
