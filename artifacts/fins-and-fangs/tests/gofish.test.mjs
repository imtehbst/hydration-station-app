import * as G from '../src/gofish/rules.js'; import * as GB from '../src/gofish/bot.js';
let fail=0; const ok=(s)=>!!G.validateState(JSON.parse(JSON.stringify(s))); const A={uid:'a',name:'A'};
for (const [l0,l1] of [['easy','hard'],['hard','easy'],['medium','medium']]) { const res={0:0,1:0}; let turns=0;
  for(let g=0;g<60;g++){ let x=GB.newBotGame(A,'hard'); if(!ok(x)){console.log('invalid start');fail=1;} let k=0; while(x.status==='playing'){ x=G.move(x,x.turn,GB.chooseMove(x,x.turn,x.turn?l1:l0),x.turnNo); if(++k%5===0&&!ok(x)){console.log('invalid mid',JSON.stringify(x).slice(0,300));fail=1;break;} if(k>3000){console.log('loop');fail=1;break;} } turns+=k; if(!ok(x)){console.log('invalid end');fail=1;} res[x.winner]++; const rm=G.rematch(x); if(!ok(rm)){console.log('bad rematch');fail=1;} }
  console.log('gofish',l0,'v',l1,JSON.stringify(res),'avg turns',Math.round(turns/60)); }
console.log(fail?'FAILED':'gofish ok'); 
