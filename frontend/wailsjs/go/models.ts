export namespace model {
	
	export class Conn {
	    pid: number;
	    process: string;
	    proto: string;
	    local: string;
	    remote: string;
	    state: string;
	
	    static createFrom(source: any = {}) {
	        return new Conn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.process = source["process"];
	        this.proto = source["proto"];
	        this.local = source["local"];
	        this.remote = source["remote"];
	        this.state = source["state"];
	    }
	}
	export class Device {
	    mac: string;
	    ip: string;
	    hostname: string;
	    firstSeen: number;
	    lastSeen: number;
	    online: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Device(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mac = source["mac"];
	        this.ip = source["ip"];
	        this.hostname = source["hostname"];
	        this.firstSeen = source["firstSeen"];
	        this.lastSeen = source["lastSeen"];
	        this.online = source["online"];
	    }
	}
	export class Event {
	    t: number;
	    kind: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Event(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.t = source["t"];
	        this.kind = source["kind"];
	        this.message = source["message"];
	    }
	}
	export class LatencyRow {
	    t: number;
	    avg: number;
	    max: number;
	    loss: number;
	
	    static createFrom(source: any = {}) {
	        return new LatencyRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.t = source["t"];
	        this.avg = source["avg"];
	        this.max = source["max"];
	        this.loss = source["loss"];
	    }
	}
	export class TrafficRow {
	    t: number;
	    rx: number;
	    tx: number;
	
	    static createFrom(source: any = {}) {
	        return new TrafficRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.t = source["t"];
	        this.rx = source["rx"];
	        this.tx = source["tx"];
	    }
	}
	export class History {
	    from: number;
	    to: number;
	    step: number;
	    traffic: TrafficRow[];
	    latency: LatencyRow[];
	    rxBytes: number;
	    txBytes: number;
	    peakRx: number;
	    peakTx: number;
	    avgMs: number;
	    maxLoss: number;
	
	    static createFrom(source: any = {}) {
	        return new History(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.from = source["from"];
	        this.to = source["to"];
	        this.step = source["step"];
	        this.traffic = this.convertValues(source["traffic"], TrafficRow);
	        this.latency = this.convertValues(source["latency"], LatencyRow);
	        this.rxBytes = source["rxBytes"];
	        this.txBytes = source["txBytes"];
	        this.peakRx = source["peakRx"];
	        this.peakTx = source["peakTx"];
	        this.avgMs = source["avgMs"];
	        this.maxLoss = source["maxLoss"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IfaceInfo {
	    name: string;
	    ip: string;
	    mac: string;
	    mtu: number;
	    speed: number;
	
	    static createFrom(source: any = {}) {
	        return new IfaceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.ip = source["ip"];
	        this.mac = source["mac"];
	        this.mtu = source["mtu"];
	        this.speed = source["speed"];
	    }
	}
	export class LatencyPoint {
	    t: number;
	    ms: number;
	    loss: number;
	
	    static createFrom(source: any = {}) {
	        return new LatencyPoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.t = source["t"];
	        this.ms = source["ms"];
	        this.loss = source["loss"];
	    }
	}
	
	export class Packet {
	    t: number;
	    proto: string;
	    src: string;
	    dst: string;
	    length: number;
	    info: string;
	
	    static createFrom(source: any = {}) {
	        return new Packet(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.t = source["t"];
	        this.proto = source["proto"];
	        this.src = source["src"];
	        this.dst = source["dst"];
	        this.length = source["length"];
	        this.info = source["info"];
	    }
	}
	export class Settings {
	    iface: string;
	    dataPath: string;
	    dbSize: number;
	    retentionDays: number;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.iface = source["iface"];
	        this.dataPath = source["dataPath"];
	        this.dbSize = source["dbSize"];
	        this.retentionDays = source["retentionDays"];
	        this.version = source["version"];
	    }
	}
	export class TrafficPoint {
	    t: number;
	    rx: number;
	    tx: number;
	
	    static createFrom(source: any = {}) {
	        return new TrafficPoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.t = source["t"];
	        this.rx = source["rx"];
	        this.tx = source["tx"];
	    }
	}
	export class Snapshot {
	    iface: IfaceInfo;
	    ifaces: string[];
	    rxRate: number;
	    txRate: number;
	    latencyMs: number;
	    lossPct: number;
	    gateway: string;
	    conns: number;
	    devicesOnline: number;
	    devicesTotal: number;
	    paused: boolean;
	    linkUp: boolean;
	    traffic: TrafficPoint[];
	    latency: LatencyPoint[];
	    topConns: Conn[];
	    packets: Packet[];
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.iface = this.convertValues(source["iface"], IfaceInfo);
	        this.ifaces = source["ifaces"];
	        this.rxRate = source["rxRate"];
	        this.txRate = source["txRate"];
	        this.latencyMs = source["latencyMs"];
	        this.lossPct = source["lossPct"];
	        this.gateway = source["gateway"];
	        this.conns = source["conns"];
	        this.devicesOnline = source["devicesOnline"];
	        this.devicesTotal = source["devicesTotal"];
	        this.paused = source["paused"];
	        this.linkUp = source["linkUp"];
	        this.traffic = this.convertValues(source["traffic"], TrafficPoint);
	        this.latency = this.convertValues(source["latency"], LatencyPoint);
	        this.topConns = this.convertValues(source["topConns"], Conn);
	        this.packets = this.convertValues(source["packets"], Packet);
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

