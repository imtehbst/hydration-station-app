import * as H from '../src/hooked/rules.js';
import { chooseCast, newBotGame } from '../src/hooked/bot.js';
import { randomFleet } from '../src/hooked/fleets.js';
let fail=0; const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) {console.log('FAIL',m,a,b); fail=1;} };
const A={uid:'a',name:'A'}; const ok=(s)=>!!H.validateState(JSON.parse(JSON.stringify(s)));
for (const salvo of [false,true]) for (let g=0;g<15;g++){
  let s=newBotGame(A,[8,9,10][g%3],'hard',Math.random,1,salvo); s=H.placeFleet(s,0,randomFleet(s.size));
  if(salvo) eq(s.shots,s.fleets[0].length,'initial shots');
  let n=0, maxRun=0, run=0, last=null;
  while(s.status==='playing'){ const seat=s.turn; const {r,c}=chooseCast(s,seat,seat?'hard':'medium'); const before=s.shots; s=H.placeFleet?H.castAt(s,seat,r,c,s.turnNo):s; n++;
    if(n%7===0 && !ok(s)) { console.log('invalid mid', salvo); fail=1; break; } }
  if(!ok(s)) { console.log('invalid end', salvo, g); fail=1; }
  if(!salvo){ const leg=JSON.parse(JSON.stringify(s)); delete leg.salvo; delete leg.shots; eq(!!H.validateState(leg),true,'legacy valid'); }
}
// tampered shots rejected
{ let s=newBotGame(A,8,'easy',Math.random,1,true); s=H.placeFleet(s,0,randomFleet(8)); s=H.castAt(s,0,0,0,0); const bad={...s,shots:(s.shots%4)+1===s.shots? s.shots+1 : (s.shots%4)+1}; eq(!!H.validateState(JSON.parse(JSON.stringify(bad))),false,'bad shots rejected'); }
console.log(fail?'FAILED':'hooked ok');
