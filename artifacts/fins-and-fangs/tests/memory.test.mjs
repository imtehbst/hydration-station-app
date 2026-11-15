import * as M from '../src/memory/rules.js';
import { chooseFlip, newBotGame } from '../src/memory/bot.js';
let fail=0; const ok=(s)=>!!M.validateState(JSON.parse(JSON.stringify(s))); const A={uid:'a',name:'A'};
for (const size of ['small','medium','large']) for (const [l0,l1] of [['easy','hard'],['hard','easy'],['medium','medium']]) { const res={0:0,1:0,draw:0};
  for(let g=0;g<30;g++){ let x=newBotGame(A,'hard',1,size); let n=0; while(x.status==='playing'){ x=M.flip(x,x.turn,chooseFlip(x,x.turn?l1:l0),x.turnNo); if(++n%5===0&&!ok(x)){console.log('invalid mid');fail=1;break;} if(n>2000){console.log('loop');fail=1;break;} } if(!ok(x)){console.log('invalid end');fail=1;} res[x.winner]++; }
  console.log(size,l0,'vs',l1,JSON.stringify(res)); }
let r=newBotGame(A,'easy',1,'small'); while(r.status==='playing') r=M.flip(r,r.turn,chooseFlip(r,'hard'),r.turnNo); const rm=M.rematch(r); if(!ok(rm)||rm.round!==2){console.log('rematch bad');fail=1;}
console.log(fail?'FAILED':'memory ok');
