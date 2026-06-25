export function createInput(){
  let keys={};

  window.addEventListener("keydown",event=>{
    keys[event.key.toLowerCase()]=1;
  });
  window.addEventListener("keyup",event=>{
    keys[event.key.toLowerCase()]=0;
  });

  return keys;
}
