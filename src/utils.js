export function randomRange(min,max){
  return min+Math.random()*(max-min);
}

export function clamp01(value){
  return Math.max(0,Math.min(1,value));
}

export function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

export function smoothStep(value){
  value=clamp(value,0,1);
  return value*value*(3-2*value);
}

export function approach(value,target,amount){
  if(value<target) return Math.min(target,value+amount);
  if(value>target) return Math.max(target,value-amount);
  return target;
}

export function hash01(a,b){
  let value=Math.sin(a*127.1+b*311.7)*43758.5453;
  return value-Math.floor(value);
}
