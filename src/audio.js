export function createMotorAudio(cars){
  let context=null;
  let master=null;
  let motors=[];
  let supported=true;

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
    let noiseBuffer=createNoiseBuffer();

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

  return {
    resume,
    update
  };
}
