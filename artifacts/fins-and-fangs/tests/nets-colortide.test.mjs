import * as N from '../src/nets/rules.js'; import * as NB from '../src/nets/bot.js';
import * as F from '../src/flood/rules.js'; import * as FB from '../src/flood/bot.js';
let fail=0; const ok=(R,s)=>!!R.validateState(JSON.parse(JSON.stringify(s))); const A={uid:'a',name:'A'};
function play(R,B,opts,l0,l1,games){ const res={0:0,1:0,draw:0}; for(let g=0;g<games;g++){ let x=B.newBotGame(A,'hard',1,opts); let n=0; while(x.status==='playing'){ x=R.move(x,x.turn,B.chooseMove(x,x.turn,x.turn?l1:l0),x.turnNo); if(++n%7===0&&!ok(R,x)){console.log('invalid mid');fail=1;break;} if(n>3000){console.log('loop');fail=1;break;} } if(!ok(R,x)){console.log('invalid end');fail=1;} res[x.winner]++; const rm=R.rematch(x); if(!ok(R,rm)||rm.status!=='playing'){console.log('rematch bad');fail=1;} } return JSON.stringify(res); }
for (const size of ['3','4','5']) console.log('nets',size,'easy v hard',play(N,NB,{size},'easy','hard',20),'med v hard',play(N,NB,{size},'medium','hard',20));
for (const size of ['small','medium','large']) console.log('flood',size,'easy v hard',play(F,FB,{size},'easy','hard',20),'med v hard',play(F,FB,{size},'medium','hard',20));
const f=F.createGame(A,{},1,{size:'small'}); if(F.sizeOfPatch(f,0)!==1||F.sizeOfPatch(f,1)!==1){console.log('flood start patch not 1');fail=1;}
console.log(fail?'FAILED':'nets+flood ok');
