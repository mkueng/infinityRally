export function createMotorAudio(cars){
  let context=null;
  let master=null;
  let motors=[];
  let noiseBuffer=null;
  let supported=true;
  let backgroundMusic=new Audio("./assets/music/ROSpace.mp3");
  backgroundMusic.loop=true;
  backgroundMusic.volume=0.34;
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
    master.gain.value=0.26;
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
    let filter=context.createBiquadFilter();
    let gain=context.createGain();
    let bodyGain=context.createGain();
    let duration=0.085+amount*0.04;

    osc.type="triangle";
    body.type="sine";
    filter.type="bandpass";
    filter.frequency.setValueAtTime(brightness,time);
    filter.Q.setValueAtTime(4.8,time);
    osc.frequency.setValueAtTime(frequency,time);
    body.frequency.setValueAtTime(frequency*0.56,time);

    gain.gain.setValueAtTime(0.0001,time);
    gain.gain.exponentialRampToValueAtTime(0.11*amount,time+0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001,time+duration);
    bodyGain.gain.setValueAtTime(0.0001,time);
    bodyGain.gain.exponentialRampToValueAtTime(0.065*amount,time+0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001,time+duration*1.4);

    osc.connect(filter);
    filter.connect(gain);
    body.connect(bodyGain);
    gain.connect(motor.pan || motor.output);
    bodyGain.connect(motor.pan || motor.output);

    osc.start(time);
    body.start(time);
    osc.stop(time+duration+0.02);
    body.stop(time+duration*1.5);
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
      let offroad=clamp(((car.surfaceDistance || 0)-34)/72,0,1);
      let slip=clamp(car.slipAmount || 0,0,1);
      let walking=onGround && !disabled && speedRatio>0.04;
      let targetAirRev=airborne && !disabled ? 1 : 0;
      motor.airRev+=(targetAirRev-motor.airRev)*(targetAirRev>motor.airRev ? 0.055 : 0.022);

      let stepRate=0.58+speedRatio*0.95+throttle*0.16-reverse*0.08;
      let pulseInterval=1/Math.max(0.55,stepRate);
      let idleFrequency=disabled ? 26 : 32+speedRatio*18+throttle*8+motor.airRev*58;
      let idleGain=disabled ? 0.004 : 0.016+speedRatio*0.016+throttle*0.012+motor.airRev*0.014;
      let brightness=180+speedRatio*380+offroad*160+motor.airRev*420;
      let amount=disabled ? 0 : 0.65+speedRatio*0.48+offroad*0.25;

      motor.idleOsc.frequency.setTargetAtTime(idleFrequency,now,0.07);
      motor.idleFilter.frequency.setTargetAtTime(130+speedRatio*170+throttle*80+motor.airRev*180,now,0.08);
      motor.idleGain.gain.setTargetAtTime(idleGain,now,0.08);
      motor.roadFilter.frequency.setTargetAtTime(130+speedRatio*260+offroad*180,now,0.12);
      motor.roadFilter.Q.setTargetAtTime(0.55+offroad*0.35,now,0.12);
      motor.roadGain.gain.setTargetAtTime(walking ? speedRatio*(0.018+offroad*0.045) : 0,now,0.12);
      motor.skidFilter.frequency.setTargetAtTime(620+speedRatio*620+offroad*240,now,0.08);
      motor.skidGain.gain.setTargetAtTime(walking ? Math.pow(slip,1.35)*speedRatio*(0.018+offroad*0.018) : 0,now,0.07);

      if(disabled) continue;
      if(motor.nextPulseTime<now) motor.nextPulseTime=now;
      if(!walking){
        motor.nextPulseTime=now+0.08;
        continue;
      }

      let scheduleUntil=now+0.08;
      while(motor.nextPulseTime<scheduleUntil){
        let jitter=Math.sin(motor.nextPulseTime*37+car.gamepadIndex)*0.0016;
        let pulseFrequency=44+speedRatio*54+offroad*18+motor.airRev*70;
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

  return {
    resume,
    update,
    playRocketLaunch,
    playCannonFire,
    playExplosion
  };
}
