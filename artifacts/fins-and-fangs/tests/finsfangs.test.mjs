import * as F from '../src/fnf/rules.js';
let fail=0; const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) {console.log('FAIL',m,a,b); fail=1;} };
const A={uid:'a',name:'A'},B={uid:'b',name:'B'}; const ok=(s)=>!!F.validateState(JSON.parse(JSON.stringify(s)));
let s=F.joinGame(F.createGame(A,{a:4,b:2},2,true),B,Math.random); eq(ok(s),true,'series valid');
const winA=(s)=>{ // seat that isn't first guesses right immediately when possible; simple: loop guesses until over
  while(s.status==='playing'){ const seat=s.turn; s=F.applyMove(s,seat,{kind:'guess',charId: seat===0? s.secrets[1] : F.candidates(s,1).find(id=>id!==s.secrets[0])},s.turnNo); } return s; };
for(let i=0;i<3;i++){ s=winA(s); eq(s.winner,0,'a wins '+i); eq(ok(s),true,'valid over'); if(i<2){ eq(F.seriesInfo(s).winner,null,'not yet'); s=F.rematch(s,Math.random);} }
eq(F.seriesInfo(s),{to:3,wins:[3,0],winner:0},'series won'); const n=F.rematch(s,Math.random); eq(F.seriesInfo(n).wins,[0,0],'new series resets'); eq(n.score.a,7,'score kept');
const plain=F.joinGame(F.createGame(A,{}),B,Math.random); eq([F.seriesInfo(plain),ok(plain)],[null,true],'single game');
console.log(fail?'FAILED':'fnf ok');
