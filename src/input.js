export function createInput(){
  let keys={};
  let mouse={
    x:0,
    y:0,
    left:false,
    right:false,
    hasPosition:false,
    locked:false,
    version:0
  };
  let gamepads=[];

  window.addEventListener("keydown",event=>{
    if(event.key===" ") event.preventDefault();
    keys[event.key.toLowerCase()]=1;
  });
  window.addEventListener("keyup",event=>{
    if(event.key===" ") event.preventDefault();
    keys[event.key.toLowerCase()]=0;
  });

  window.addEventListener("gamepadconnected",event=>{
    gamepads[event.gamepad.index]=event.gamepad;
  });
  window.addEventListener("gamepaddisconnected",event=>{
    gamepads[event.gamepad.index]=null;
  });

  function updateMousePosition(event){
    if(mouse.locked){
      mouse.x=Math.max(0,Math.min(window.innerWidth,mouse.x+(event.movementX || 0)));
      mouse.y=Math.max(0,Math.min(window.innerHeight,mouse.y+(event.movementY || 0)));
    }else{
      mouse.x=event.clientX;
      mouse.y=event.clientY;
    }
    mouse.hasPosition=true;
    mouse.version++;
  }

  function requestPointerLock(target=document.body){
    if(!target || !target.requestPointerLock) return;
    if(document.pointerLockElement===target) return;
    try{
      let request=target.requestPointerLock({unadjustedMovement:true});
      if(request && request.catch){
        request.catch(()=>{
          try{
            target.requestPointerLock();
          }catch(error){}
        });
      }
    }catch(error){
      try{
        target.requestPointerLock();
      }catch(fallbackError){}
    }
  }

  document.addEventListener("pointerlockchange",()=>{
    let wasLocked=mouse.locked;
    mouse.locked=document.pointerLockElement!=null;
    if(mouse.locked && !wasLocked){
      mouse.x=window.innerWidth*0.5;
      mouse.y=window.innerHeight*0.5;
      mouse.hasPosition=true;
      mouse.version++;
    }
  });

  window.addEventListener("mousemove",updateMousePosition);
  window.addEventListener("mousedown",event=>{
    updateMousePosition(event);
    if(event.button===2) event.preventDefault();
    if(event.button===0) mouse.left=true;
    if(event.button===2) mouse.right=true;
  });
  window.addEventListener("mouseup",event=>{
    updateMousePosition(event);
    if(event.button===2) event.preventDefault();
    if(event.button===0) mouse.left=false;
    if(event.button===2) mouse.right=false;
  });
  window.addEventListener("contextmenu",event=>{
    event.preventDefault();
  });
  window.addEventListener("blur",()=>{
    mouse.left=false;
    mouse.right=false;
  });

  function axis(value,deadzone=0.18){
    if(Math.abs(value)<deadzone) return 0;
    let sign=Math.sign(value);
    return sign*((Math.abs(value)-deadzone)/(1-deadzone));
  }

  function buttonValue(button){
    if(!button) return 0;
    return typeof button==="number" ? button : button.value;
  }

  function getGamepadControls(index){
    let pads=navigator.getGamepads ? navigator.getGamepads() : gamepads;
    let pad=pads[index];
    if(!pad) return {forward:0,turn:0,lift:0,dpadForward:0};

    let leftStickX=axis(pad.axes[0] || 0);
    let dpadLeft=buttonValue(pad.buttons[14])>0.35 ? -1 : 0;
    let dpadRight=buttonValue(pad.buttons[15])>0.35 ? 1 : 0;
    let turn=Math.abs(leftStickX)>0 ? leftStickX : dpadLeft+dpadRight;

    let dpadUp=buttonValue(pad.buttons[12]);
    let dpadDown=buttonValue(pad.buttons[13]);
    let stickThrottle=-axis(pad.axes[1] || 0,0.35);
    let dpadForward=dpadUp-dpadDown;
    let forward=Math.max(dpadUp,stickThrottle)-Math.max(dpadDown,-stickThrottle);

    return {
      forward:Math.max(-1,Math.min(1,forward)),
      turn:Math.max(-1,Math.min(1,turn)),
      lift:Math.max(-1,Math.min(1,stickThrottle)),
      dpadForward:Math.max(-1,Math.min(1,dpadForward))
    };
  }

  function getGamepadFaceButtons(index){
    let pads=navigator.getGamepads ? navigator.getGamepads() : gamepads;
    let pad=pads[index];
    if(!pad) return {a:false,b:false,x:false,y:false,leftTrigger:false,rightTrigger:false};

    return {
      a:buttonValue(pad.buttons[0])>0.35,
      b:buttonValue(pad.buttons[1])>0.35,
      x:buttonValue(pad.buttons[2])>0.35,
      y:buttonValue(pad.buttons[3])>0.35,
      leftTrigger:buttonValue(pad.buttons[6])>0.35,
      rightTrigger:buttonValue(pad.buttons[7])>0.35
    };
  }

  function getGamepadAim(index){
    let pads=navigator.getGamepads ? navigator.getGamepads() : gamepads;
    let pad=pads[index];
    if(!pad) return {x:0,y:0};

    return {
      x:axis(pad.axes[2] || 0,0.16),
      y:axis(pad.axes[3] || 0,0.16)
    };
  }

  return {
    keys,
    mouse,
    requestPointerLock,
    getGamepadControls,
    getGamepadFaceButtons,
    getGamepadAim
  };
}
