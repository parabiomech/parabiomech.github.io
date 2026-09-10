import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

const $=id=>document.getElementById(id), canvas=$('scene'),host=$('view3d');
let renderer,stadium,ball,points,lastCloud=null;
let state={heading:0,running:false,dark:false,target:0},pitch=0;
const world=new THREE.Scene();world.background=new THREE.Color('#101820');
const camera=new THREE.PerspectiveCamera(75,2,.03,1000);
const rig=new THREE.Group();rig.position.set(0,1.25,0);rig.add(camera);world.add(rig);
const hall=new THREE.Group();world.add(hall);
const fallback=new THREE.Group();world.add(fallback);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(18,30),new THREE.MeshStandardMaterial({color:0x51686e,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;fallback.add(floor);
const grid=new THREE.GridHelper(18,18,0xbcd0c5,0x648681);grid.position.y=.01;fallback.add(grid);
world.add(new THREE.HemisphereLight(0xffffff,0x666666,2));
const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(3,8,4);world.add(light);
const marker=new THREE.Mesh(new THREE.SphereGeometry(.125,24,16),new THREE.MeshStandardMaterial({color:0xe58f43,roughness:.75}));marker.position.set(0,.125,-3);world.add(marker);
function updatePose(){
 if(renderer?.xr.isPresenting)return;
 rig.rotation.y=-THREE.MathUtils.degToRad(state.heading);camera.rotation.set(pitch,0,0,'YXZ');
}
function stadiumTransform(){
 hall.rotation.set($('stadium-flip').checked?Math.PI:0,THREE.MathUtils.degToRad(Number($('stadium-yaw').value)),0,'YXZ');
 hall.scale.setScalar(Number($('stadium-scale').value));hall.position.set(-.62,Number($('stadium-height').value),.35);
}
function resize(){if(!renderer)return;const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function report(s){$('view-status').textContent=s;}
async function init(){
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local');
  const spark=new SparkRenderer({renderer});world.add(spark);
  new ResizeObserver(resize).observe(host);resize();
  const clock=new THREE.Clock(),direction=new THREE.Vector3();
  renderer.setAnimationLoop(()=>{
   const time=clock.getElapsedTime();
   if(renderer.xr.isPresenting){renderer.xr.getCamera().getWorldDirection(direction);const yaw=(THREE.MathUtils.radToDeg(Math.atan2(direction.x,-direction.z))+360)%360;window.dispatchEvent(new CustomEvent('spatial-head',{detail:yaw}));}
   const hidden=state.running&&state.dark;
   hall.visible=!hidden&&!points;fallback.visible=!hidden&&!stadium&&!points;
   if(points)points.visible=!hidden;
   marker.visible=!hidden&&!state.running&&$('show-ball').checked&&!ball;
   if(ball){ball.visible=!hidden&&!state.running&&$('show-ball').checked;ball.rotation.y=time*.3;}
   world.background.set(hidden?'#000000':'#101820');
   renderer.render(world,camera);
  });
  window.spatial3D={
   update(next){state=next;updatePose();},
   pointCloud(cloud,up){
    if(cloud===lastCloud&&points?.userData.up===up)return;lastCloud=cloud;
    if(points){world.remove(points);points.geometry.dispose();points.material.dispose();points=null;}
    if(cloud){const coords=new Float32Array(cloud.length*3);cloud.forEach((p,i)=>{coords[i*3]=p[0]*8;coords[i*3+1]=(up==='z'?p[2]:p[1])*8;coords[i*3+2]=(up==='z'?p[1]:p[2])*8;});const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(coords,3));points=new THREE.Points(geo,new THREE.PointsMaterial({color:0x8ddacc,size:.025}));points.userData.up=up;world.add(points);}
   }
  };
  window.dispatchEvent(new Event('spatial-ready'));
  for(const id of ['stadium-scale','stadium-height','stadium-yaw','stadium-flip'])$(id).addEventListener('input',stadiumTransform);
  stadiumTransform();
  report('경기장 SOG 불러오는 중…');
  const splat=new SplatMesh({url:'./models/stadium.sog',onProgress:e=>report(`경기장 로딩 ${e.total?Math.round(e.loaded/e.total*100)+'%':(e.loaded/1048576).toFixed(1)+' MB'}`)});
  hall.add(splat);
  splat.initialized.then(()=>{stadium=splat;const b=splat.getBoundingBox();report(`실제 경기장 · ${splat.numSplats.toLocaleString()} splats`);$('space-info').textContent=`경기장 로드 완료 · 스캔 범위 ${b.getSize(new THREE.Vector3()).toArray().map(x=>x.toFixed(1)).join(' × ')} · ballO6.fbx`;}).catch(e=>{hall.remove(splat);splat.dispose();report('경기장 로딩 실패 · 기본 3D 코트');console.error(e);});
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{
   const name=url.split(/[\\/]/).pop();if(name==='ballO6.jpg'||name==='ballO6_normal.jpg')return './models/'+name;return url;
  });
  const textureLoader=new THREE.TextureLoader(manager);
  const [model,map,normal]=await Promise.all([new FBXLoader(manager).loadAsync('./models/ballO6.fbx'),textureLoader.loadAsync('./models/ballO6.jpg'),textureLoader.loadAsync('./models/ballO6_normal.jpg')]);
  map.colorSpace=THREE.SRGBColorSpace;
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  model.position.sub(center);const holder=new THREE.Group();holder.add(model);holder.scale.setScalar(.25/Math.max(size.x,size.y,size.z));holder.position.set(0,.5,-2.5);
  model.traverse(obj=>{if(obj.isMesh){obj.material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide,transparent:true});obj.renderOrder=10;}});ball=holder;world.add(ball);
  if(navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr')){
   const button=VRButton.createButton(renderer);$('xr-control').append(button);button.style.cssText='position:static;width:auto;font:inherit;padding:11px 15px;border:1px solid #3d5866;border-radius:8px;background:#1b303d;color:#e5edf0';
   renderer.xr.addEventListener('sessionstart',()=>{rig.rotation.set(0,0,0);camera.rotation.set(0,0,0);});
   renderer.xr.addEventListener('sessionend',()=>{window.dispatchEvent(new Event('spatial-stop'));updatePose();});
   for(let i=0;i<2;i++)renderer.xr.getController(i).addEventListener('selectstart',()=>window.dispatchEvent(new Event('spatial-answer')));
  }else $('xr-control').textContent='헤드셋 VR: 지원 기기에서 표시';
 }catch(e){report('3D 초기화 오류: '+e.message);console.error(e);}
}
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||renderer?.xr.isPresenting)return;drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);$('arena').focus();});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};pitch=THREE.MathUtils.clamp(pitch-dy*.003,-1.1,1.1);window.dispatchEvent(new CustomEvent('spatial-turn',{detail:dx*.2}));updatePose();});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
$('home-view').onclick=()=>{pitch=0;window.dispatchEvent(new Event('spatial-home'));updatePose();};
$('immersive').onclick=async()=>{try{await $('arena').requestFullscreen();$('arena').focus();}catch{report('전체화면을 지원하지 않는 브라우저입니다.');}};
$('leave-fullscreen').onclick=()=>document.exitFullscreen();
document.addEventListener('fullscreenchange',()=>{$('leave-fullscreen').hidden=!document.fullscreenElement;resize();});
init();
