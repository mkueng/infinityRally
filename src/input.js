export function createInput(){
  let keys={};
  let gamepads=[];

  window.addEventListener("keydown",event=>{
    keys[event.key.toLowerCase()]=1;
  });
  window.addEventListener("keyup",event=>{
    keys[event.key.toLowerCase()]=0;
  });

  window.addEventListener("gamepadconnected",event=>{
    gamepads[event.gamepad.index]=event.gamepad;
  });
  window.addEventListener("gamepaddisconnected",event=>{
    gamepads[event.gamepad.index]=null;
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
    if(!pad) return {forward:0,turn:0};

    let leftStickX=axis(pad.axes[0] || 0);
    let dpadLeft=buttonValue(pad.buttons[14])>0.35 ? -1 : 0;
    let dpadRight=buttonValue(pad.buttons[15])>0.35 ? 1 : 0;
    let turn=Math.abs(leftStickX)>0 ? leftStickX : dpadLeft+dpadRight;

    let rightTrigger=buttonValue(pad.buttons[7]);
    let leftTrigger=buttonValue(pad.buttons[6]);
    let faceDown=buttonValue(pad.buttons[0]);
    let faceRight=buttonValue(pad.buttons[1]);
    let dpadUp=buttonValue(pad.buttons[12]);
    let dpadDown=buttonValue(pad.buttons[13]);
    let stickThrottle=-axis(pad.axes[1] || 0,0.35);
    let forward=rightTrigger-leftTrigger;

    if(Math.abs(forward)<0.05){
      forward=Math.max(faceDown,dpadUp,stickThrottle)-Math.max(faceRight,dpadDown,-stickThrottle);
    }

    return {
      forward:Math.max(-1,Math.min(1,forward)),
      turn:Math.max(-1,Math.min(1,turn))
    };
  }

  function getGamepadFaceButtons(index){
    let pads=navigator.getGamepads ? navigator.getGamepads() : gamepads;
    let pad=pads[index];
    if(!pad) return {a:false,b:false,x:false,y:false};

    return {
      a:buttonValue(pad.buttons[0])>0.35,
      b:buttonValue(pad.buttons[1])>0.35,
      x:buttonValue(pad.buttons[2])>0.35,
      y:buttonValue(pad.buttons[3])>0.35
    };
  }

  return {
    keys,
    getGamepadControls,
    getGamepadFaceButtons
  };
}
