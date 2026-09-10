'use strict';
const $ = id => document.getElementById(id);
const wrap = a => (a % 360 + 360) % 360;
const angularError = (a,b) => Math.abs((a-b+540)%360-180);
const rad = a => a*Math.PI/180;
let ctx, master, source, panner, timer, onset=0, heading=0, target=0;
let running=false, accepting=false, checking=false, queue=[], records=[], cloud=null;
let sessionDark=false;
const keys=new Set();
function message(s){$('status').textContent=s;}
async function audio(){
 if(!ctx){
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)throw Error('이 브라우저는 Web Audio를 지원하지 않습니다.');
  ctx=new Audio();master=ctx.createGain();master.connect(ctx.destination);
 }
 await ctx.resume();
 if(ctx.state!=='running')throw Error('오디오를 시작할 수 없습니다. 브라우저의 소리 권한을 확인하세요.');
 master.gain.value=Number($('volume').value);
}
function silence(){if(source){source.stop();source.disconnect();source=null;}if(panner){panner.disconnect();panner=null;}}
// Mono synthesized bell. Same stimulus and distance in every direction.
function sound(angle, loop=true){
 silence(); const n=ctx.sampleRate, buffer=ctx.createBuffer(1,n,ctx.sampleRate), samples=buffer.getChannelData(0);
 for(let i=0;i<n;i++){
  const t=i/n, beat=t%0.5, env=Math.min(1,beat/.008)*Math.exp(-beat*12);
  samples[i]=env*(Math.sin(2*Math.PI*880*t)*.35+Math.sin(2*Math.PI*1379*t)*.2+Math.sin(2*Math.PI*2131*t)*.12);
 }
 panner=ctx.createPanner();panner.panningModel='HRTF';panner.rolloffFactor=0;
 panner.connect(master);source=ctx.createBufferSource();source.buffer=buffer;source.loop=loop;source.connect(panner);
 position(angle); const startAt=ctx.currentTime+.06;source.start(startAt);return startAt;
}
function position(angle){if(!panner)return;const a=rad(angle);panner.positionX.value=Math.sin(a)*3;panner.positionY.value=0;panner.positionZ.value=-Math.cos(a)*3;}
function controls(){for(const id of ['start','count','dark','ply','up','clear','check'])$(id).disabled=running||checking;$('stop').disabled=!running;$('answer').disabled=!accepting;$('left').disabled=checking;$('right').disabled=checking;$('home-view').disabled=running;}
function blind(on){$('blackout').hidden=!on;document.body.classList.toggle('blind',on);}
function next(){
 if(!running)return;
 if(!queue.length){finish('완료했습니다. 아래에서 결과를 확인하세요.');return;}
 accepting=false;heading=0;target=queue.shift();
 $('progress').textContent=`${records.length+1} / ${Number($('count').value)}`;
 message('잠시 후 벨 소리가 들립니다. 방향을 찾아 Space로 선택하세요.');controls();draw();
 timer=setTimeout(()=>{
  if(!running)return;
  onset=sound(target);accepting=true;controls();message('← → 회전 · Space 선택 · Esc 종료');
  timer=setTimeout(()=>{if(running&&accepting){accepting=false;silence();records.push({target,response:null,error:null,rt:null,timeout:true});next();}},30000);
 },700+Math.random()*500);
}
function finish(text){running=false;accepting=false;clearTimeout(timer);silence();keys.clear();blind(false);controls();message(text);$('progress').textContent=`${records.length} TRIALS`;$('download').disabled=!records.length;results();draw();}
function answer(){
 if(!running||!accepting||ctx.currentTime<onset)return;
 accepting=false;clearTimeout(timer);
 records.push({target,response:Math.round(heading*10)/10,error:angularError(heading,target),rt:(ctx.currentTime-onset)*1000,timeout:false});
 silence();keys.clear();next();
}
function rotate(delta){if(running&&!accepting)return;heading=wrap(heading+delta);position(target-heading);draw();}
$('start').onclick=async()=>{
 if(running||checking)return;
 try{checking=true;controls();await audio();checking=false;records=[];sessionDark=$('dark').checked;
  queue=Array.from({length:Number($('count').value)},(_,i)=>(i%12)*30);
  for(let i=queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[queue[i],queue[j]]=[queue[j],queue[i]];}
  running=true;$('download').disabled=true;results();$('arena').focus();blind(sessionDark);next();
 }catch(e){checking=false;finish(e.message);}
};
$('check').onclick=async()=>{
 if(running||checking)return;
 checking=true;controls();message('왼쪽 벨 소리 → 오른쪽 벨 소리');
 try{await audio();sound(270,false);timer=setTimeout(()=>{sound(90,false);timer=setTimeout(()=>{silence();checking=false;controls();message('헤드폰 좌우를 확인한 후 시작하세요.');},1200);},1400);}catch(e){checking=false;controls();message(e.message);}
};
$('volume').oninput=()=>{if(master)master.gain.setTargetAtTime(Number($('volume').value),ctx.currentTime,.02);};
$('stop').onclick=$('exit-dark').onclick=()=>finish('테스트를 종료했습니다. 완료한 시행만 표시합니다.');
$('answer').onclick=answer;$('left').onclick=()=>rotate(-5);$('right').onclick=()=>rotate(5);
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&(running||checking)){checking=false;finish('테스트를 종료했습니다.');return;}
 if((!running&&!$('arena').contains(e.target))||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 const code=({' ':'Space',Left:'ArrowLeft',Right:'ArrowRight',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight'}[e.key]||e.code);
 if(['ArrowLeft','ArrowRight','Space'].includes(code)){e.preventDefault();if(code==='Space'){if(!e.repeat)answer();}else{if(!e.repeat)rotate(code==='ArrowRight'?5:-5);keys.add(code);}}
});
document.addEventListener('keyup',e=>keys.delete(({Left:'ArrowLeft',Right:'ArrowRight',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight'}[e.key]||e.code)));
window.addEventListener('blur',()=>{keys.clear();if(running||checking){checking=false;finish('창 포커스가 이동해 종료했습니다. 진행 중 시행은 제외했습니다.');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||checking)){checking=false;finish('화면이 숨겨져 종료했습니다.');}});
let last=performance.now();
function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;if(accepting||!running){const dir=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));if(dir)rotate(dir*75*dt);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
function draw(){
 $('heading').textContent=`${Math.round(heading)%360}°`;
 if(window.spatial3D){window.spatial3D.update({heading,target,running,dark:sessionDark});window.spatial3D.pointCloud(cloud,$('up').value);}
}
window.addEventListener('spatial-ready',draw);
window.addEventListener('spatial-turn',e=>rotate(e.detail));
window.addEventListener('spatial-head',e=>{heading=e.detail;position(target-heading);draw();});
window.addEventListener('spatial-home',()=>{if(!running){heading=0;draw();}});
window.addEventListener('spatial-answer',answer);
window.addEventListener('spatial-stop',()=>{if(running)finish('VR 세션을 종료했습니다.');});
function bins(){return Array.from({length:12},(_,i)=>{const trials=records.filter(r=>r.target===i*30),valid=trials.filter(r=>!r.timeout);return {angle:i*30,n:trials.length,valid:valid.length,error:valid.length?valid.reduce((a,r)=>a+r.error,0)/valid.length:null,rt:valid.length?valid.reduce((a,r)=>a+r.rt,0)/valid.length:null,hit:trials.length?valid.filter(r=>r.error<=15).length/trials.length:null};});}
function plot(id,field,data){
 const g=$(id).getContext('2d'),cx=210,cy=210,outer=155,inner=65;g.clearRect(0,0,420,420);
 const max=field==='error'?180:Math.max(1000,...data.map(b=>b.rt||0));
 for(const b of data){const a=rad(b.angle-105),z=rad(b.angle-75),v=b[field];g.beginPath();g.arc(cx,cy,outer,a,z);g.arc(cx,cy,inner,z,a,true);g.closePath();g.fillStyle=v===null?'#253943':field==='error'?`hsl(${150-150*v/max} 65% 48%)`:`hsl(195 70% ${80-50*v/max}%)`;g.fill();g.strokeStyle='#111f28';g.lineWidth=3;g.stroke();g.fillStyle='#b9cdd6';g.font='13px sans-serif';g.textAlign='center';g.fillText(`${b.angle}°`,cx+181*Math.sin(rad(b.angle)),cy-181*Math.cos(rad(b.angle))+5);}
 g.fillStyle='#e5edf0';g.font='14px sans-serif';g.textAlign='center';g.fillText(field==='error'?'평균 오차':'평균 반응시간',cx,cy-4);g.fillStyle='#8eaab7';g.fillText(field==='error'?'0–180°':`0–${(max/1000).toFixed(1)} s`,cx,cy+18);
}
function results(){
 const data=bins(),valid=records.filter(r=>!r.timeout);plot('accuracy','error',data);plot('reaction','rt',data);
 $('summary').textContent=records.length?`${records.length}회 시행 · 응답 ${valid.length}회 · 시간초과 ${records.length-valid.length}회`+(valid.length?` · 평균 오차 ${(valid.reduce((a,r)=>a+r.error,0)/valid.length).toFixed(1)}° · 평균 반응시간 ${(valid.reduce((a,r)=>a+r.rt,0)/valid.length/1000).toFixed(2)}초 · 적중률 ${(valid.filter(r=>r.error<=15).length/records.length*100).toFixed(0)}%`:''):'테스트 후 결과가 표시됩니다.';
 $('bins').replaceChildren(...data.map(b=>{const tr=document.createElement('tr');for(const text of [`${b.angle}°`,`${b.valid}/${b.n}`,b.error===null?'—':`${b.error.toFixed(1)}°`,b.hit===null?'—':`${(b.hit*100).toFixed(0)}%`,b.rt===null?'—':`${(b.rt/1000).toFixed(2)} s`]){const td=document.createElement('td');td.textContent=text;tr.append(td);}return tr;}));
}
$('download').onclick=()=>{
 const rows=['trial,target_deg,response_deg,absolute_error_deg,response_ms,hit_within_15deg,timeout,audio_only,stimulus'];
 records.forEach((r,i)=>rows.push([i+1,r.target,r.response??'',r.error?.toFixed(2)??'',r.rt?.toFixed(1)??'',!r.timeout&&r.error<=15,r.timeout,sessionDark,'synthetic_bell_hrtf'].join(',')));
 const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`spatial-audio-${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
// PLY scalar vertex reader: ASCII and binary (both endian variants); no network upload.
function parsePLY(buffer){
 const bytes=new Uint8Array(buffer),head=new TextDecoder().decode(bytes.subarray(0,Math.min(bytes.length,65536))),match=/end_header\r?\n/.exec(head);
 if(!head.startsWith('ply\n')&&!head.startsWith('ply\r\n'))throw Error('PLY 파일 형식이 아닙니다.');
 if(!match)throw Error('PLY 헤더를 읽을 수 없습니다.');
 const header=head.slice(0,match.index),offset=new TextEncoder().encode(head.slice(0,match.index+match[0].length)).length;
 let format='',count=0,inVertex=false,seenOther=false,properties=[];
 for(const line of header.split(/\r?\n/)){const p=line.trim().split(/\s+/);if(p[0]==='format')format=p[1];if(p[0]==='element'){inVertex=p[1]==='vertex';if(inVertex){if(seenOther)throw Error('vertex가 첫 번째 요소인 PLY를 사용하세요.');count=Number(p[2]);}else if(Number(p[2])>0)seenOther=true;}if(p[0]==='property'&&inVertex){if(p[1]==='list')throw Error('vertex list 속성은 지원하지 않습니다.');properties.push({type:p[1],name:p[2]});}}
 if(!Number.isInteger(count)||count<1||count>10000000)throw Error('지원하는 vertex 개수는 1~10,000,000개입니다.');
 const indices=['x','y','z'].map(n=>properties.findIndex(p=>p.name===n));if(indices.includes(-1))throw Error('x, y, z 좌표가 필요합니다.');
 const stride=Math.max(1,Math.ceil(count/18000)),points=[];
 if(format==='ascii'){
  const lines=new TextDecoder().decode(bytes.subarray(offset)).trim().split(/\r?\n/);if(lines.length<count)throw Error('PLY 데이터가 잘렸습니다.');
  for(let i=0;i<count;i+=stride){const values=lines[i].trim().split(/\s+/);points.push(indices.map(j=>Number(values[j])));}
 }else{
  if(!['binary_little_endian','binary_big_endian'].includes(format))throw Error('지원하지 않는 PLY 인코딩입니다.');
  const types={char:[1,'getInt8'],uchar:[1,'getUint8'],int8:[1,'getInt8'],uint8:[1,'getUint8'],short:[2,'getInt16'],ushort:[2,'getUint16'],int16:[2,'getInt16'],uint16:[2,'getUint16'],int:[4,'getInt32'],uint:[4,'getUint32'],int32:[4,'getInt32'],uint32:[4,'getUint32'],float:[4,'getFloat32'],float32:[4,'getFloat32'],double:[8,'getFloat64'],float64:[8,'getFloat64']};
  let size=0;for(const p of properties){if(!types[p.type])throw Error('지원하지 않는 PLY 속성입니다.');p.offset=size;size+=types[p.type][0];}
  if(offset+size*count>buffer.byteLength)throw Error('PLY 데이터가 잘렸습니다.');const view=new DataView(buffer),le=format==='binary_little_endian';
  for(let i=0;i<count;i+=stride)points.push(indices.map(j=>{const p=properties[j];return view[types[p.type][1]](offset+i*size+p.offset,le);}));
 }
 if(points.some(p=>p.some(v=>!Number.isFinite(v))))throw Error('유효하지 않은 좌표가 있습니다.');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]);}
 const scale=Math.max(...max.map((v,j)=>v-min[j]));if(!scale)throw Error('공간 범위가 없는 PLY입니다.');
 return points.map(p=>p.map((v,j)=>(v-(min[j]+max[j])/2)/scale*2));
}
$('ply').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100*1024*1024)throw Error('100 MB 이하의 PLY를 선택하세요.');cloud=parsePLY(await file.arrayBuffer());$('space-info').textContent=`${file.name} · ${cloud.length.toLocaleString()}개 점 표시 · 반사·잔향 시뮬레이션 없음`;draw();}catch(err){$('space-info').textContent=err.message;e.target.value='';}};
$('up').onchange=draw;$('clear').onclick=()=>{cloud=null;$('ply').value='';$('space-info').textContent='Spatial X 경기장 · 반사·잔향 시뮬레이션 없음';draw();};
controls();draw();results();
