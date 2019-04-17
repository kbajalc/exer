import os = require('os');
import Utils = require('./utils');

const LOAD_TIME = Math.round(process.uptime() * 1000);
const CREATED = new Date(Date.now() - Math.round(LOAD_TIME));
const ZEROSTAMP = Utils.micros();
const IDENTITY = Utils.uuid();

// Fake gql
function gql(txt: any): string { return txt[0]; }

// tslint:disable-next-line:variable-name
export const ProcessInfoQuery: string = gql`{
  Core {
    Process {
      # Function
      application,
      container,
      version,
      identity,
      # Stats
      created,
      micostamp,
      state,
      loadTime,
      initTime,
      # Runtime
      timestamp,
      serial,
      uptime,
      # Memory
      memory,
      heapTotal,
      heapUsed,
      external,
      cpuUser,
      cpuSystem,
      cpuUserTotal,
      cpuSystemTotal,
      # Codebase
      moduleCount,
      packageCount,
      scriptSize,
      # Misc
      cpus {
        model,
        speed,
        user,
        nice,
        sys,
        idle,
        irq
      },
      networks {
        name,
        address,
        netmask,
        family,
        mac,
        cidr,
        # internal
      },
      node
    }
  }
}`;

export interface ProcessInfo {
  // Function
  application: string;
  container: string;
  version: string;
  identity: string;
  // Stats
  created: Date;
  zerostamp: number;
  state: string;
  loadTime: number;
  initTime: number;
  // Runtime
  timestamp: Date;
  micostamp: number;
  serial: number;
  uptime: number;
  // Usage
  memory: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  cpuUser: number;
  cpuSystem: number;
  cpuUserTotal: number;
  cpuSystemTotal: number;
  moduleCount: number;
  packageCount: number;
  scriptSize: number;
  // Instance
  // instance: string;
  node: any;
  cpus: CpuInfo[];
  networks: NetworkInfo[];
  // Package and code size
  entry: ModuleInfo;
  packages: PackageInfo[];
  modules: ModuleInfo[];
  // TODO: Statistics of service use
}

export interface CpuInfo {
  model: string;
  speed: number;
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
}

export interface NetworkInfo {
  name: string;
  address: string;
  netmask: string;
  family: string;
  mac: string;
  internal: boolean;
  cidr: string;
}

export interface PackageInfo {
  name: string;
  version: string;
  description: string;
  level: number;
  size: number;
  parent: PackageInfo;
  import: ModuleInfo;
  moduleCount: number;
  modules: ModuleInfo[];
  imports: PackageInfo[];
  uses: PackageInfo[];
  path: string;
  json: any;
}

export type CommonModule = NodeModule & { i?: string };

export interface ModuleInfo {
  id: string;
  name: string;
  file: string;
  size: number;
  level: number;
  parent: ModuleInfo;
  package: PackageInfo;
}

export class ProcessInfo {
  private static mainModule: CommonModule;
  private static mainFile: string;
  private static mainPackage: PackageInfo;

  private static entry: ModuleInfo;
  private static packages: Record<string, PackageInfo> = {};
  private static modules: Record<string, ModuleInfo> = {};

  private static serial: number = 0;
  private static cpuUsage = process.cpuUsage();

  public static get(level?: number): ProcessInfo {
    const start = Utils.time();
    this.refresh();
    const mem = process.memoryUsage();
    const total = process.cpuUsage();
    const usage = this.cpuUsage = process.cpuUsage(this.cpuUsage);
    const cpus = os.cpus().map(c => ({ model: c.model, speed: c.speed, ...c.times }));
    const networks = Object.entries(os.networkInterfaces())
      .map(([k, v]): [string, any] => ([k, v.filter(i => !i.internal && i.family !== 'IPv6')]))
      .filter(([k, v]) => v.length)
      .map(([k, v]) => ({ name: k, ...v[0] }));

    const packages = Object.values(this.packages);
    const modules = Object.values(this.modules);
    let scriptSize = 0;
    modules.forEach(m => scriptSize += m.size);

    const span = Utils.span(start);
    return {
      application: process.title,
      container: process.title,
      version: process.version,
      identity: IDENTITY,

      created: CREATED,
      zerostamp: ZEROSTAMP,
      state: this.serial ? 'warm' : 'cold',
      loadTime: LOAD_TIME,
      initTime: +span,

      timestamp: new Date(),
      micostamp: Utils.micros(),

      serial: this.serial++,
      uptime: process.uptime(),
      memory: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      cpuUser: usage.user,
      cpuSystem: usage.system,
      cpuUserTotal: total.user,
      cpuSystemTotal: total.system,
      packageCount: packages.length,
      moduleCount: modules.length,
      scriptSize,

      node: {
        pid: process.pid,
        arch: process.arch,
        platform: process.platform,
        release: process.release,
        versions: process.versions
      },
      cpus,
      networks,

      entry: this.entry,
      packages: packages.filter((m: any) => level === undefined || m.level <= level),
      modules: modules.filter((m: any) => level === undefined || m.level <= level)
    };
  }

  public static refresh() {
    const cache: NodeModule[] = Object.values(require.cache);
    this.mainModule = process.mainModule;
    this.mainFile = this.mainModule && String(this.mainModule.filename || this.mainModule.id || this.mainModule.i) || '<main>';
    this.mainPackage = {
      name: '.',
      // TODO: Find versions
      version: null,
      description: null,
      level: 0,
      size: 0,
      import: null,
      parent: null,
      moduleCount: 0,
      modules: [],
      uses: [],
      imports: [],
      path: this.mainFile,
      json: null
    };
    this.packages['.'] = this.mainPackage;
    if (this.mainModule) ProcessInfo.resolve(this.mainModule);
    for (const mod of cache) ProcessInfo.resolve(mod);
  }

  private static resolve(mod: CommonModule) {
    const id = String(mod.id || mod.i);
    const file = String(mod.filename || id);
    if (this.modules[id]) return this.modules[id];

    let name = (mod === this.mainModule) ? id : Utils.relative(file, this.mainFile);
    const parent = mod.parent && this.modules[mod.parent.id];
    const level = parent && (parent.level + 1) || 0;
    const size = Utils.fsize(file) || 0;
    const info: ModuleInfo = { id, name, size, package: undefined, file, level, parent };
    this.modules[id] = info;
    if (mod === this.mainModule) {
      this.entry = info;
      this.mainPackage.import = info;
    }

    const ix = name && name.indexOf('node_modules/');
    if (ix >= 0) {
      name = name.substring(ix + 13);
      const parts = name.split('/');
      const pack = parts[0] + (parts[0].startsWith('@') ? '/' + parts[1] : '');
      const path = file.substring(0, file.indexOf('node_modules/') + 13) + pack + '/package.json';
      let json: any;
      try {
        json = require(path);
      } catch (e) {
        json = { varsion: null };
      }
      const pkg: PackageInfo = this.packages[pack] || {
        name: pack,
        version: json && json.version || null,
        description: json && json.description || null,
        path,
        json,
        // from: parent && parent.package && parent.package.name,
        level: info.level,
        size: 0,
        moduleCount: 0,
        parent: info.parent && info.parent.package,
        import: info.parent,
        modules: [],
        imports: [],
        uses: []
      };
      info.package = pkg;
      pkg.size += info.size;
      pkg.modules.push(info);
      pkg.moduleCount++;
      pkg.level = Math.min(pkg.level, info.level);
      this.packages[pack] = pkg;
    } else {
      info.package = this.mainPackage;
      this.mainPackage.size += info.size;
      if (!this.mainPackage.moduleCount) {
        this.mainPackage.path = file;
      }
      this.mainPackage.modules.push(info);
      this.mainPackage.moduleCount++;
    }

    for (const item of mod.children || []) {
      const ch = this.resolve(item);
      if (ch.package === info.package) continue;
      if (!ch.package.uses.includes(info.package)) {
        ch.package.uses.push(info.package);
      }
      if (!info.package.imports.includes(ch.package)) {
        info.package.imports.push(ch.package);
      }
    }
    return info;
  }
}

// export function reload(level?: number): NodeModule {
//   const dump = modules(level);
//   const list = Object.keys(require.cache);
//   console.log('Before relaod:', list.length);
//   // const now = Object.keys(require.cache);
//   for (const key of list) {
//     delete require.cache[key];
//   }
//   let first: NodeModule = undefined;
//   for (const mod of dump.files) {
//     if (require.cache[mod.id]) continue;
//     console.log('Reload:', mod.id);
//     first = first || require(mod.id);
//   }
//   console.log('After relaod:', Object.keys(require.cache).length);
//   return first;
// }
