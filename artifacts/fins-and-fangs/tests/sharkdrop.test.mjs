import * as D from '../src/drop/rules.js';
import { chooseMove, newBotGame } from '../src/drop/bot.js';
let fail=0; const ok=(s)=>!!D.validateState(JSON.parse(JSON.stringify(s)));
const A={uid:'a',name:'A'};
let s=newBotGame(A,'easy'); for(const c of [0,1,0,1,0,1,0]) s=D.drop(s,s.turn,c,s.turnNo);
if(s.status!=='over'||s.winner!==0||s.line.length!==4||!ok(s)) {console.log('FAIL vertical',s); fail=1;}
for (const [l0,l1] of [['easy','hard'],['medium','hard'],['easy','medium']]) { const res={0:0,1:0,draw:0}; const t=Date.now();
  for(let g=0;g<12;g++){ let x=newBotGame(A,'hard',1); while(x.status==='playing') x=D.drop(x,x.turn,chooseMove(x,x.turn,x.turn?l1:l0),x.turnNo); if(!ok(x)){console.log('invalid');fail=1;} res[x.winner]++; }
  console.log(l0,'(first) vs',l1,res,'ms/game',Math.round((Date.now()-t)/12)); }
console.log(fail?'FAILED':'drop ok');
