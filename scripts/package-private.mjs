// Build from an allowlisted checkout without project env files. Do not pass service credentials to Next.
import {cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {dirname,join,relative} from "node:path";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";

const root = fileURLToPath(new URL("../",import.meta.url));
const accessMode = process.env.NEXT_PUBLIC_SALES_ACCESS_MODE || "private";
if (!["private","public"].includes(accessMode))
  throw new Error("NEXT_PUBLIC_SALES_ACCESS_MODE deve ser private ou public.");
const whatsappSelfServe = process.env.NEXT_PUBLIC_SALES_WHATSAPP_SELF_SERVE || "disabled";
if (!["enabled","disabled"].includes(whatsappSelfServe))
  throw new Error("NEXT_PUBLIC_SALES_WHATSAPP_SELF_SERVE deve ser enabled ou disabled.");
const stage = await mkdtemp(join(root,".v2-package-"));
const dest = join(root,".artifacts");
await mkdir(dest,{recursive:true});
const modulesRoot = dirname(await realpath(join(root,"node_modules")));
const env = {PATH:process.env.PATH, HOME:stage, TMPDIR:tmpdir(), CI:"1", NODE_ENV:"production",
  NEXT_TELEMETRY_DISABLED:"1", SALES_WEB_MODE:"integrated", SALES_PACKAGE_ROOT:modulesRoot,
  NEXT_PUBLIC_SALES_ACCESS_MODE:accessMode,NEXT_PUBLIC_SALES_WHATSAPP_SELF_SERVE:whatsappSelfServe};

async function hashSources(hash, directory, prefix) {
  const entries = await readdir(directory,{withFileTypes:true});
  entries.sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const item of entries) {
    const name = prefix + item.name;
    const path = join(directory,item.name);
    if (item.isDirectory()) await hashSources(hash,path,name + "/");
    else if (item.isFile()) {
      const bytes = await readFile(path);
      hash.update(name + "\0" + bytes.length + "\0").update(bytes);
    }
  }
}

try {
  for (const name of ["app","lib","src","tsconfig.json","package.json","pnpm-lock.yaml","next.config.mjs"])
    await cp(join(root,name),join(stage,name),{recursive:true,filter:source => {
      const path = relative(root,source);
      return !["app/lp","app/telas","app/portal"].includes(path) && !path.split("/").some(part=>part.startsWith("."));
    }});
  await symlink(join(root,"node_modules"),join(stage,"node_modules"),"dir");
  await mkdir(join(stage,"public/assets"),{recursive:true});
  for (const name of ["sales-mark.svg","idle_thumbnail.png","whatsapp.svg"])
    await cp(join(root,"public/assets",name),join(stage,"public/assets",name));
  await mkdir(join(stage,"public/zoe-avatar"));
  for (const entry of await readdir(join(root,"public/zoe-avatar"),{withFileTypes:true})) {
    if (entry.isFile() && (entry.name === "manifest.json" || /^[\w-]+\.png$/.test(entry.name)))
      await cp(join(root,"public/zoe-avatar",entry.name),join(stage,"public/zoe-avatar",entry.name));
  }
  const hash = createHash("sha256");
  await hashSources(hash,stage,"");
  for (const path of ["server/private-web.mjs","server/v2-bff.mjs","server/staff-bff.mjs","scripts/package-private.mjs",
    "deploy/private/Dockerfile","deploy/private/.dockerignore","deploy/private/compose.web.yaml",
    "deploy/private/compose.traefik.yaml"]) {
    const bytes = await readFile(join(root,path));
    hash.update(path + "\0" + bytes.length + "\0").update(bytes);
  }
  hash.update("NEXT_PUBLIC_SALES_ACCESS_MODE\0" + accessMode + "\0");
  hash.update("NEXT_PUBLIC_SALES_WHATSAPP_SELF_SERVE\0" + whatsappSelfServe + "\0");
  const revision = "sha256:" + hash.digest("hex");
  execFileSync(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"build"],{cwd:stage,env,stdio:"inherit"});
  const out = join(stage,"out");
  if (!(await readFile(join(out,"index.html"),"utf8")).includes('data-sales-mode="integrated"'))
    throw new Error("O HTML exportado não identifica a interface integrada.");
  const bundle = await mkdtemp(join(dest,"sales-v2-web-"));
  await writeFile(join(bundle,"REVISION"),revision + "\n");
  await mkdir(join(bundle,"site/_next"),{recursive:true});
  await mkdir(join(bundle,"server"));
  for (const path of ["index.html","assets","zoe-avatar","_next/static"])
    await cp(join(out,path),join(bundle,"site",path),{recursive:true});
  for (const path of ["v2-bff.mjs","staff-bff.mjs","private-web.mjs"])
    await cp(join(root,"server",path),join(bundle,"server",path));
  for (const path of [".dockerignore","Dockerfile","compose.web.yaml","compose.traefik.yaml"])
    await cp(join(root,"deploy/private",path),join(bundle,path));
  await cp(join(root,"docs/homologacao-privada.md"),join(bundle,"README.md"));
  const archive = bundle + ".tar.gz";
  execFileSync("tar",["-czf",archive,"-C",bundle,"."],{env:{...env,COPYFILE_DISABLE:"1"}});
  console.log("Revisão dos fontes:",revision);
  console.log("Contexto Docker:",bundle);
  console.log("Pacote compilado:",archive,"(" + (await stat(archive)).size + " bytes)");
} finally {
  await rm(stage,{recursive:true,force:true});
}
