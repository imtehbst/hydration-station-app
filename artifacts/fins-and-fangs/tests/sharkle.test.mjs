import * as R from '../src/wordle/rules.js';
import { COMMON, ANSWERS } from '../src/wordle/words.js';
import { FACTS } from '../src/wordle/facts.js';
let fail=0; const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) {console.log('FAIL',m,a,b); fail=1;} };
eq(Object.keys(FACTS).filter(w=>!ANSWERS.includes(w)),[],'facts are sea words');
// no repeats across a whole pool
let s=null; const got=new Set();
for(let i=0;i<ANSWERS.length;i++){ s=R.newSolo(s,Math.random,'sea'); got.add(R.decode(s.w)); eq(!!R.validateState(s),true,'valid solo'); s={...s,status:'over'}; }
eq(got.size,ANSWERS.length,'173 distinct sea words'); s=R.newSolo(s,Math.random,'sea'); eq(ANSWERS.includes(R.decode(s.w)),true,'wraps');
// hard
eq(R.hardProblem(['crane'],'crabs','crown'),'Hard mode: 3rd letter must be A','hard green');
eq(R.hardProblem(['saner'],'crabs','crick'),'Hard mode: guess must use S','hard yellow');
eq(R.hardProblem(['crane'],'crabs','crabs'),null,'hard ok');
// vs time tiebreak
const A={uid:'a',name:'A'},B={uid:'b',name:'B'};
let v=R.joinVs(R.createVs(A,null,()=>0),B); const w=R.decode(v.w);
v=R.vsGuess(v,'a','crane',1000); v=R.vsGuess(v,'a',w,61000);
v=R.vsGuess(v,'b','crane',500000); eq(v.status,'playing','b may still tie');
v=R.vsGuess(v,'b',w,520000); eq([v.status,v.winner,R.wonOnTime(v)],['over',1,true],'b faster wins'); eq(!!R.validateState(v),true,'valid vs');
let v2=R.vsRematch(v); eq(v2.seen.length,2,'seen grows'); eq(!!R.validateState(JSON.parse(JSON.stringify(v2))),true,'valid rematch');
let v3=R.createVs(A,v2,Math.random,'all',true); eq([v3.round,v3.score.b,v3.hard],[3,1,true],'createVs carries');
// legacy state without t0/pool/seen still valid
const legacy={v:1,kind:'vs',status:'playing',seats:[A,B],w:R.encode('shark'),boards:{a:{guesses:['crane'],gaveUp:false},b:{guesses:[],gaveUp:false}},winner:null,score:{},round:1,turnNo:2};
eq(!!R.validateState(legacy),true,'legacy vs'); eq(R.vsGuess(legacy,'a','shark',5).status,'playing','legacy guess');
// daily
const d=R.dateKey(new Date(2026,10,15)); eq(d,'2026-11-15','dateKey'); const dw=R.dailyWord(d); eq(COMMON.includes(dw),true,'daily word common');
let dd=R.dailyGuess(R.newDaily(d),'a','crane',10); dd=R.dailyGuess(dd,'a',dw,9010); eq(R.boardDone(dd.boards.a,dw),true,'daily done'); eq(!!R.validateState(JSON.parse(JSON.stringify(dd))),true,'valid daily');
console.log(R.shareText({title:'Sharkle Daily '+d,guesses:dd.boards.a.guesses,answer:dw,time:R.timeOf(dd.boards.a)}));
const days=new Set(); for(let i=1;i<=28;i++) days.add(R.dailyWord('2026-12-'+String(i).padStart(2,'0'))); console.log('distinct of 28 days:',days.size, dw);
console.log(fail?'FAILED':'all ok');
{ let st=R.recordDaily(null,'2026-11-14',3); st=R.recordDaily(st,'2026-11-15',4); eq([st.streak,st.best,st.played,st.wins],[2,2,2,2],'streak'); eq(R.recordDaily(st,'2026-11-15',2),null,'once a day');
  let s2=R.recordDaily(st,'2026-11-17',5); eq(s2.streak,1,'gap resets'); s2=R.recordDaily(s2,'2026-11-18',0); eq([s2.streak,s2.best],[0,2],'miss'); eq(!!R.validateState(JSON.parse(JSON.stringify(s2))),true,'valid dstats');
  eq(R.prevDay('2026-03-01'),'2026-02-28','prevDay'); eq(R.liveStreak(st,'2026-11-16'),2,'live'); eq(R.liveStreak(st,'2026-11-17'),0,'stale'); console.log(fail?'FAILED2':'dstats ok'); }
{ // hints
  let s=R.newSolo(null,()=>0,'all'); const ans=R.decode(s.w); s=R.soloGuess(s,ans==='crane'?'slate':'crane'); s=R.soloHint(s,2); eq([R.limitOf(s),R.hasHint(s)],[5,true],'solo hint');
  let thr=false; try{R.soloHint(s,1)}catch{thr=true} eq(thr,true,'one hint only'); eq(!!R.validateState(JSON.parse(JSON.stringify(s))),true,'valid hinted solo');
  for(const g of ['house','mount','plumb','fizzy'].filter(w=>w!==ans).slice(0,4)) if(s.status==='playing') s=R.soloGuess(s,g); eq([s.status,s.guesses.length],['over',5],'5 rows after hint');
  const A={uid:'a',name:'A'},B={uid:'b',name:'B'}; let v=R.joinVs(R.createVs(A,null,()=>0),B); const w=R.decode(v.w);
  v=R.vsHint(v,'a',0); v=R.vsGuess(v,'a',w,10); // a: 1 guess + hint = cost 2
  v=R.vsGuess(v,'b','crane'===w?'slate':'crane',20); eq(v.status,'playing','b can still tie at 2'); v=R.vsGuess(v,'b',w,5000);
  eq([v.status,R.costOf(v.boards.a,w),R.costOf(v.boards.b,w)],['over',2,2],'hint costs a guess'); eq(!!R.validateState(JSON.parse(JSON.stringify(v))),true,'valid hinted vs');
  eq(R.hintChoices(['crane'],'crabs'),[3,4],'hint choices'); console.log(fail?'FAILED3':'hint ok'); }
