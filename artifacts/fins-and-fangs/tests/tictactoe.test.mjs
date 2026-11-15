import * as T from '../src/ttt/rules.js';
import { chooseMove, newBotGame } from '../src/ttt/bot.js';
let fail=0; const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) {console.log('FAIL',m,a,b); fail=1;} };
const A={uid:'a',name:'A'};
// classic unchanged & legacy state (no mode) valid
let c=newBotGame(A,'hard',1); c=T.place(c,0,4,0); eq(!!T.validateState(JSON.parse(JSON.stringify(c))),true,'classic valid'); const leg={...c}; delete leg.mode; eq(!!T.validateState(leg),true,'legacy valid');
// vanishing: 4th piece removes oldest
let s=newBotGame(A,'easy',1,'three');
for (const [seat,cell] of [[0,0],[1,3],[0,1],[1,4],[0,8],[1,6]]) s=T.place(s,seat,cell,s.turnNo);
eq(T.fading(s,0),0,'fading'); s=T.place(s,0,2,s.turnNo); eq([s.board[0],s.board[2],s.status],[null,0,'playing'],'vanish (1,8,2 no line)');
eq(!!T.validateState(JSON.parse(JSON.stringify(s))),true,'three valid');
// bots: hard vs easy over many games, no crash, valid states, hard rarely loses
let res={0:0,1:0,draw:0}, t=Date.now();
for(let g=0;g<40;g++){ let x=newBotGame(A,'hard',1,'three'); let n=0; while(x.status==='playing'){ const lvl=x.turn===0?'easy':'hard'; x=T.place(x,x.turn,chooseMove(x,x.turn,lvl),x.turnNo); n++; } if(!T.validateState(JSON.parse(JSON.stringify(x)))) {console.log('invalid end'); fail=1;} res[x.winner]++; }
console.log('easy(0) vs hard(1):',res,'ms',Date.now()-t, fail?'FAILED':'ok');
