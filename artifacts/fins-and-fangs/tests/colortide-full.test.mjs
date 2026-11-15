import * as F from '../src/flood/rules.js'; import * as FB from '../src/flood/bot.js';
let fail=0; const ok=(s)=>!!F.validateState(JSON.parse(JSON.stringify(s))); const A={uid:'a',name:'A'};
for (const size of ['small','medium','large']) for (const [l0,l1] of [['easy','easy'],['easy','hard'],['hard','hard']]) { const res={0:0,1:0,draw:0}; let turns=0, max=0, capped=0;
  for(let g=0;g<25;g++){ let x=FB.newBotGame(A,'hard',1,{size}); while(x.status==='playing'){ x=F.move(x,x.turn,FB.chooseMove(x,x.turn,x.turn?l1:l0),x.turnNo); if(x.turnNo%9===0&&!ok(x)){console.log('invalid mid');fail=1;break;} }
    if(!ok(x)){console.log('invalid end');fail=1;} const a=F.sizeOfPatch(x,0),b=F.sizeOfPatch(x,1); if(a+b!==x.w*x.h) capped++; turns+=x.turnNo; max=Math.max(max,x.turnNo); res[x.winner]++; }
  console.log(size,l0,'v',l1,JSON.stringify(res),'avg moves',Math.round(turns/25),'max',max,'hit move limit',capped); }
// a game saved under the old rule (ended past half, squares left) still loads
let o=FB.newBotGame(A,'easy',1,{size:'small'}); while(F.sizeOfPatch(o,0)*2<=48&&F.sizeOfPatch(o,1)*2<=48&&o.status==='playing') o=F.move(o,o.turn,FB.chooseMove(o,o.turn,'hard'),o.turnNo);
if(o.status==='playing'){ const a=F.sizeOfPatch(o,0),b=F.sizeOfPatch(o,1); const legacy={...o,status:'over',winner:a>b?0:1,score:{}}; if(!ok(legacy)){console.log('legacy over game rejected');fail=1;} else console.log('legacy finished game still loads'); }
console.log(fail?'FAILED':'flood ok');
