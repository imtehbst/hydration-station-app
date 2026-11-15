import * as E from '../src/eels/rules.js';
let fail=0; const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) {console.log('FAIL',m,a,b); fail=1;} };
const A={uid:'a',name:'A'}; const ok=(s)=>!!E.validateState(JSON.parse(JSON.stringify(s)));
let c=E.newBotGame(A,1); c=E.roll(c,0,3,0); eq(ok(c),true,'classic'); const leg={...c}; delete leg.mode; delete leg.offer; eq(ok(leg),true,'legacy');
let p=E.newBotGame(A,1,'pick'); let threw=false; try{E.roll(p,0,3,0)}catch{threw=true} eq(threw,true,'needs offer');
p=E.offerDice(p,0,[2,5],0); eq(ok(p),true,'offer valid'); threw=false; try{E.roll(p,0,3,0)}catch{threw=true} eq(threw,true,'must be offered die');
p=E.roll(p,0,5,0); eq([p.pos[0],p.offer,p.turn],[5,null,1],'picked'); eq(ok(p),true,'after pick');
console.log(fail?'FAILED':'eels ok');
