export function createMotorAudio(cars){
  let context=null;
  let master=null;
  let motors=[];
  let noiseBuffer=null;
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

  function makePulse(motor,time,frequency,amount,brightness){
    let osc=context.createOscillator();
    let body=context.createOscillator();
    let stomp=context.createOscillator();
    let stompGain=context.createGain();
    let clack=context.createBufferSource();
    let clackFilter=context.createBiquadFilter();
    let clackGain=context.createGain();
    let filter=context.createBiquadFilter();
    let gain=context.createGain();
    let bodyGain=context.createGain();
    let duration=0.16+amount*0.06;

    clack.buffer=noiseBuffer || createNoiseBuffer();
    clackFilter.type="bandpass";
    clackFilter.frequency.setValueAtTime(brightness*1.15,time);
    clackFilter.Q.setValueAtTime(5.8,time);
    clackGain.gain.setValueAtTime(0.0001,time);
    clackGain.gain.exponentialRampToValueAtTime(0.095*amount,time+0.003);
    clackGain.gain.exponentialRampToValueAtTime(0.0001,time+0.09);

    osc.type="triangle";
    body.type="sine";
    stomp.type="sine";
    filter.type="bandpass";
    filter.frequency.setValueAtTime(brightness,time);
    filter.Q.setValueAtTime(3.2,time);
    osc.frequency.setValueAtTime(frequency,time);
    body.frequency.setValueAtTime(frequency*0.42,time);
    stomp.frequency.setValueAtTime(32,time);
    stomp.frequency.exponentialRampToValueAtTime(18,time+0.18);

    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(0.14*amount,time+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001,time+duration);
    bodyGain.gain.setValueAtTime(0.0001,time);
    bodyGain.gain.exponentialRampToValueAtTime(0.3*amount,time+0.012);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001,time+duration*1.4);
    stompGain.gain.setValueAtTime(0.0001,time);
    stompGain.gain.exponentialRampToValueAtTime(0.22*amount,time+0.01);
    stompGain.gain.exponentialRampToValueAtTime(0.0001,time+0.34);

    osc.connect(filter);
    filter.connect(gain);
    body.connect(bodyGain);
    stomp.connect(stompGain);
    clack.connect(clackFilter);
    clackFilter.connect(clackGain);
    gain.connect(motor.pan || motor.output);
    bodyGain.connect(motor.pan || motor.output);
    stompGain.connect(motor.pan || motor.output);
    clackGain.connect(motor.pan || motor.output);

    osc.start(time);
    body.start(time);
    stomp.start(time);
    clack.start(time);
    osc.stop(time+duration+0.02);
    body.stop(time+duration*1.5);
    stomp.stop(time+0.36);
    clack.stop(time+0.1);
  }

  function update(){
    if(!context || context.state!=="running") return;

    let now=context.currentTime;
    for(let motor of motors){
      let car=motor.car;
      let speedRatio=clamp(Math.abs(car.speed || 0)/0.38,0,1);
      let throttle=clamp(Math.max(0,car.throttleInput || 0),0,1);
      let reverse=car.throttleInput<0 ? 1 : 0;
      let disabled=car.health<=0;
      let onGround=car.onGround!==false;
      let airborne=car.airborne===true;
      let mechMode=(car.morphProgress || 0)<0.35 && (car.jetProgress || 0)<0.35;
      let offroad=clamp(((car.surfaceDistance || 0)-34)/72,0,1);
      let slip=clamp(car.slipAmount || 0,0,1);
      let walking=mechMode && onGround && !disabled && speedRatio>0.04;
      let targetAirRev=airborne && !disabled ? 1 : 0;
      motor.airRev+=(targetAirRev-motor.airRev)*(targetAirRev>motor.airRev ? 0.055 : 0.022);

      let stepRate=0.9+speedRatio*1.18+throttle*0.18-reverse*0.1;
      let pulseInterval=1/Math.max(0.55,stepRate);
      let idleFrequency=disabled ? 26 : 32+speedRatio*18+throttle*8+motor.airRev*58;
      let idleGain=disabled ? 0.004 : mechMode ? 0.003 : 0.016+speedRatio*0.016+throttle*0.012+motor.airRev*0.014;
      let brightness=170+speedRatio*360+offroad*170+motor.airRev*260;
      let amount=disabled ? 0 : 1.25+speedRatio*0.95+offroad*0.45;

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
      if(!walking){
        motor.nextPulseTime=now+0.08;
        continue;
      }

      let scheduleUntil=now+0.08;
      while(motor.nextPulseTime<scheduleUntil){
        let jitter=Math.sin(motor.nextPulseTime*37+car.gamepadIndex)*0.0016;
        let pulseFrequency=34+speedRatio*42+offroad*16+motor.airRev*42;
        makePulse(motor,motor.nextPulseTime+jitter,pulseFrequency,amount,brightness);
        motor.nextPulseTime+=pulseInterval;
      }
    }
  }

  function playRocketLaunch(car){
    ensureContext();
    if(!context || !supported) return;
    if(context.state==="suspended") context.resume();

    let motor=motors.find(item=>item.car===car);
    let destination=motor ? (motor.pan || motor.output) : master;
    let time=context.currentTime+0.01;
    let noise=context.createBufferSource();
    let noiseFilter=context.createBiquadFilter();
    let noiseGain=context.createGain();
    let swooshFilter=context.createBiquadFilter();
    let swooshGain=context.createGain();
    let punch=context.createOscillator();
    let punchGain=context.createGain();

    noise.buffer=noiseBuffer || createNoiseBuffer();
    noiseFilter.type="bandpass";
    noiseFilter.frequency.setValueAtTime(1280,time);
    noiseFilter.frequency.exponentialRampToValueAtTime(220,time+0.48);
    noiseFilter.Q.setValueAtTime(1.35,time);
    noiseGain.gain.setValueAtTime(0.0001,time);
    noiseGain.gain.exponentialRampToValueAtTime(0.52,time+0.014);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001,time+0.68);

    swooshFilter.type="highpass";
    swooshFilter.frequency.setValueAtTime(1800,time);
    swooshFilter.frequency.exponentialRampToValueAtTime(360,time+0.68);
    swooshFilter.Q.setValueAtTime(0.8,time);
    swooshGain.gain.setValueAtTime(0.0001,time);
    swooshGain.gain.exponentialRampToValueAtTime(0.36,time+0.025);
    swooshGain.gain.exponentialRampToValueAtTime(0.0001,time+0.9);

    punch.type="sawtooth";
    punch.frequency.setValueAtTime(108,time);
    punch.frequency.exponentialRampToValueAtTime(36,time+0.2);
    punchGain.gain.setValueAtTime(0.0001,time);
    punchGain.gain.exponentialRampToValueAtTime(0.22,time+0.008);
    punchGain.gain.exponentialRampToValueAtTime(0.0001,time+0.24);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(destination);
    noise.connect(swooshFilter);
    swooshFilter.connect(swooshGain);
    swooshGain.connect(destination);
    punch.connect(punchGain);
    punchGain.connect(destination);

    noise.start(time);
    punch.start(time);
    noise.stop(time+0.94);
    punch.stop(time+0.26);
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
    playBombExplosion,
    playLaserFire
  };
}
