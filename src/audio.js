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
  let giantFootstepBuffer=null;
  let giantFootstepBufferPromise=null;
  let scannerBuffer=null;
  let scannerBufferPromise=null;
  let supported=true;
  let sfxVolume=1;
  let musicVolume=0.2;
  let paused=false;
  let backgroundMusic=new Audio("./assets/music/ROSpace.mp3");
  backgroundMusic.loop=true;
  backgroundMusic.volume=musicVolume;
  backgroundMusic.preload="auto";

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
    master.gain.value=paused ? 0 : 0.26*sfxVolume;
    master.connect(context.destination);
    noiseBuffer=createNoiseBuffer();
    loadRocketLaunchBuffer();
    loadRocketImpactBuffer();
    loadCannonImpactBuffer();
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
        pan.pan.value=index===0 ? -0.42 : 0.42;
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
    if(master) master.gain.value=paused ? 0 : 0.26*sfxVolume;
  }

  function setMusicVolume(value){
    musicVolume=clamp(Number(value) || 0,0,1);
    applyVolumes();
  }

  function setSfxVolume(value){
    sfxVolume=clamp(Number(value) || 0,0,1);
    applyVolumes();
  }

  function setPaused(value){
    paused=!!value;
    applyVolumes();
  }

  function getVolumeSettings(){
    return {
      music:musicVolume,
      sfx:sfxVolume
    };
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
    if(backgroundMusic.paused){
      backgroundMusic.play().catch(()=>{});
    }
  }

  window.addEventListener("pointerdown",resume);
  window.addEventListener("keydown",resume);
  window.addEventListener("click",resume);
  window.addEventListener("gamepadconnected",resume);

  function update(){
    if(!context || context.state!=="running") return;

    let now=context.currentTime;
    for(let motor of motors){
      let car=motor.car;
      let speedRatio=clamp(Math.abs(car.speed || 0)/0.38,0,1);
      let throttle=clamp(Math.max(0,car.throttleInput || 0),0,1);
      let disabled=car.health<=0;
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

      if(disabled) continue;
      if(motor.nextPulseTime<now) motor.nextPulseTime=now;
      motor.nextPulseTime=now+0.08;
    }
  }

  function playRocketLaunch(car){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();
    if(!rocketLaunchBuffer){
      loadRocketLaunchBuffer();
      return;
    }

    let motor=motors.find(item=>item.car===car);
    let destination=motor ? (motor.pan || motor.output) : master;
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

  function playCannonFire(car){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();

    let motor=motors.find(item=>item.car===car);
    let destination=motor ? (motor.pan || motor.output) : master;
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

  function playExplosion(){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();

    let time=context.currentTime+0.005;
    let boom=context.createOscillator();
    let boomGain=context.createGain();
    let noise=context.createBufferSource();
    let noiseFilter=context.createBiquadFilter();
    let noiseGain=context.createGain();

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
    boomGain.connect(master);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);

    boom.start(time);
    noise.start(time);
    boom.stop(time+1.42);
    noise.stop(time+1.5);
  }

  function playRocketImpact(){
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

    source.buffer=rocketImpactBuffer;
    source.playbackRate.setValueAtTime(0.98+Math.random()*0.04,time);
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(1,time+0.006);
    gain.gain.setTargetAtTime(0.0001,time+0.1,0.42);

    source.connect(gain);
    gain.connect(master);

    source.start(time);
    source.stop(time+Math.min(rocketImpactBuffer.duration,1.8));
  }

  function playCannonImpact(){
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

    source.buffer=cannonImpactBuffer;
    source.playbackRate.setValueAtTime(0.98+Math.random()*0.04,time);
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(1,time+0.006);
    gain.gain.setTargetAtTime(0.0001,time+0.08,0.32);

    source.connect(gain);
    gain.connect(master);

    source.start(time);
    source.stop(time+Math.min(cannonImpactBuffer.duration,1.4));
  }

  function playBombExplosion(){
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
    subGain.connect(master);
    bodyGain.connect(master);
    noiseGain.connect(master);

    sub.start(time);
    body.start(time);
    noise.start(time);
    sub.stop(time+2.3);
    body.stop(time+1.9);
    noise.stop(time+2.45);
  }

  function playGiantFootstep(intensity=1){
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

    source.buffer=giantFootstepBuffer;
    source.playbackRate.setValueAtTime(0.96+Math.random()*0.08,time);
    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(1.45*intensity,time+0.01);
    gain.gain.setTargetAtTime(0.0001,time+0.08,0.32);

    source.connect(gain);
    gain.connect(master);

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

  function playLaserFire(){
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
    zapGain.connect(master);
    bodyGain.connect(master);
    noiseGain.connect(master);

    zap.start(time);
    body.start(time);
    noise.start(time);
    zap.stop(time+0.18);
    body.stop(time+0.24);
    noise.stop(time+0.2);
  }

  return {
    resume,
    update,
    setMusicVolume,
    setSfxVolume,
    setPaused,
    getVolumeSettings,
    playRocketLaunch,
    playCannonFire,
    playExplosion,
    playRocketImpact,
    playCannonImpact,
    playBombExplosion,
    playGiantFootstep,
    playScannerPulse,
    playLaserFire
  };
}
