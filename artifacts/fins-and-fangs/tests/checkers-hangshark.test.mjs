import * as C from '../src/checkers/rules.js'; import * as CB from '../src/checkers/bot.js';
import * as H from '../src/hang/rules.js'; import * as HB from '../src/hang/bot.js';
let fail=0; const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) {console.log('FAIL',m,a,b); fail=1;} };
const ok=(R,s)=>!!R.validateState(JSON.parse(JSON.stringify(s))); const A={uid:'a',name:'A'},B={uid:'b',name:'B'};
// checkers
let s=C.joinGame(C.createGame(A),B); eq([C.countOf(s,0),C.countOf(s,1),C.legalMoves(s).length],[12,12,7],'start');
for (const [l0,l1,n] of [['easy','hard',6],['medium','hard',6],['easy','medium',10]]) { const res={0:0,1:0,draw:0}; const t=Date.now(); let moves=0;
  for(let g=0;g<n;g++){ let x=CB.newBotGame(A,'hard'); let k=0; while(x.status==='playing'){ x=C.move(x,x.turn,CB.chooseMove(x,x.turn,x.turn?l1:l0),x.turnNo); moves++; if(++k%9===0&&!ok(C,x)){console.log('invalid mid');fail=1;break;} if(k>2000){console.log('loop');fail=1;break;} } if(!ok(C,x)){console.log('invalid end');fail=1;} res[x.winner]++; }
  console.log('checkers',l0,'v',l1,JSON.stringify(res),'ms/move',Math.round((Date.now()-t)/moves)); }
// forced multi-jump
let j={...s,board:Array(64).fill(0)}; j.board[5*8+2]=1; j.board[4*8+3]=3; j.board[2*8+5]=3; j.board[0*8+1]=3; j.turn=0;
eq(C.legalMoves(j),[[42,28]],'must jump'); j=C.move(j,0,[42,28],j.turnNo); eq([j.must,j.turn,j.board[35]],[28,0,0],'keeps jumping'); j=C.move(j,0,[28,14],j.turnNo); eq([j.must,j.turn,C.countOf(j,1)],[null,1,1],'double jump done');
// hangshark
let h=H.joinGame(H.createGame(A),B); eq([h.status,H.isMyTurn(h,'a'),H.isMyTurn(h,'b')],['setting',true,false],'setter first');
h=H.move(h,0,{t:'word',w:'shark'},h.turnNo); eq([h.status,H.isMyTurn(h,'b'),ok(H,h)],['playing',true,true],'word set');
for (const l of 'shark') h=H.move(h,1,{t:'guess',l},h.turnNo); eq([h.status,h.winner,h.score.b,ok(H,h)],['over',1,1,true],'guesser wins');
h=H.rematch(h); eq([h.status,h.setter,h.w],['setting',1,''],'roles swap'); h=H.move(h,1,{t:'word',w:'reef'},h.turnNo);
for (const l of 'qwxyzjv') h=H.move(h,0,{t:'guess',l},h.turnNo); eq([h.status,h.winner,H.missesOf(h),ok(H,h)],['over',1,7,true],'setter wins on misses');
let hb=HB.newBotGame(A,'hard'); eq([hb.status,hb.maxMiss,H.isMyTurn(hb,'a'),H.isMyTurn(hb,'bot:hard'),ok(H,hb)],['playing',5,true,false,true],'bot game');
for (const l of H.wordOf(hb)) if(hb.status==='playing'&&!hb.guessed.includes(l)) hb=H.move(hb,0,{t:'guess',l},hb.turnNo); const hb2=HB.rematch(hb); eq([hb2.status,hb2.setter,hb2.maxMiss,ok(H,hb2)],['playing',1,5,true],'bot rematch');
console.log(fail?'FAILED':'checkers+hang ok');
