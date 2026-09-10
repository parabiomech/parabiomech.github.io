const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync('playground/spatial-audio/lab.js','utf8');
const c={TextDecoder,TextEncoder,Uint8Array,DataView,Math,Number,Error};vm.createContext(c);
vm.runInContext(s.slice(s.indexOf('const wrap'),s.indexOf('let ctx'))+s.slice(s.indexOf('function parsePLY'),s.indexOf("$('ply').onchange")),c);
assert.equal(vm.runInContext('angularError(355,5)',c),10);
assert.equal(vm.runInContext('angularError(0,180)',c),180);
assert.equal(vm.runInContext('wrap(-5)',c),355);
const header=f=>`ply\nformat ${f} 1.0\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nend_header\n`;
let bytes=new TextEncoder().encode(header('ascii')+'0 0 0\n2 4 6\n');
c.input=bytes.buffer;assert.equal(vm.runInContext('parsePLY(input).length',c),2);
for(const little of [true,false]){
 const h=new TextEncoder().encode(header(little?'binary_little_endian':'binary_big_endian'));const b=new ArrayBuffer(h.length+24);new Uint8Array(b).set(h);const v=new DataView(b);[0,0,0,2,4,6].forEach((n,i)=>v.setFloat32(h.length+i*4,n,little));c.input=b;assert.equal(vm.runInContext('parsePLY(input)[1][2]',c),1);
 c.input=b.slice(0,-1);assert.throws(()=>vm.runInContext('parsePLY(input)',c),/잘렸/);
}
c.input=new TextEncoder().encode(header('ascii')+'0 NaN 0\n2 4 6\n').buffer;assert.throws(()=>vm.runInContext('parsePLY(input)',c),/좌표/);
console.log('PASS: wraparound, 180-degree error, ASCII/binary PLY, endian handling, truncated/invalid input');
