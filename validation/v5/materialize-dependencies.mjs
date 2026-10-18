import fs from 'node:fs';
import path from 'node:path';
const workspace=process.cwd();
const expected='C:/Users/agomesdesiqueira/.codex/worktrees/odontiq-v5/odontiq';
if(path.resolve(workspace).toLowerCase()!==path.resolve(expected).toLowerCase())throw Error('Unexpected workspace');
const source='C:/240 - odontIQ/odontiq/node_modules';
const target=path.join(workspace,'node_modules');
if(!fs.lstatSync(target).isSymbolicLink()||fs.realpathSync(target).toLowerCase()!==fs.realpathSync(source).toLowerCase())throw Error('Expected only the known dependency junction');
// Remove only the verified junction itself, never its target or contents.
fs.rmdirSync(target);
fs.mkdirSync(target);
let files=0;
function copy(from,to){
 for(const e of fs.readdirSync(from,{withFileTypes:true})){
  const src=path.join(from,e.name),dst=path.join(to,e.name);
  if(e.isDirectory()){fs.mkdirSync(dst);copy(src,dst);}
  else if(e.isSymbolicLink())fs.symlinkSync(fs.readlinkSync(src),dst,fs.statSync(src).isDirectory()?'junction':'file');
  else{fs.linkSync(src,dst);files++;if(files%10000===0)console.log(`Materialized ${files} dependency files`);}
 }
}
copy(source,target);
fs.writeFileSync('validation/v5/dependency-configuration.json',JSON.stringify({at:new Date().toISOString(),source,target,files,layout:'Local directory tree; immutable dependency files hard-linked on the same volume. Application sources are independent copies. The external node_modules junction was removed without traversing its target.',reason:'Turbopack filesystem-root compatibility; no app configuration or bundler change.'},null,2));
console.log({files,completed:true});
