class vElement {
    stopDiffChild = false;
    stopRendChild = false;
    tag;
    attributes = Object.create(null);
    properties = Object.create(null);
    $on = Object.create(null);
    style = Object.create(null);
    children = [];
    $ref = null;
    rootSymb = void 0;
    constructor(tag) {
        this.tag = tag;
    }
    setStopDiffChild(v) {
        this.stopDiffChild = v;
        return this;
    }
    setStopRendChild(v) {
        this.stopRendChild = v;
        return this;
    }
    on(type, handler) {
        if (!this.$on[type]) {
            this.$on[type] = [];
        }
        this.$on[type].push(handler);
        return this;
    }
    ons(types, handler) {
        for (const t of types) {
            this.on(t, handler);
        }
        return this;
    }
    _emit(ev, info) {
        const m = this.$on[ev];
        if (m && m.length) {
            for (let i = 0, l = m.length; i < l; i++) {
                m[i](info);
            }
        }
    }
    emit(ev, info) {
        return nextDoor(() => this._emit(ev, info));
    }
    addEventListener(type, handler) {
        this.on(type, handler);
        return this;
    }
    addClass(c) {
        const oc = (this.attributes.class || '') + ' ' + c;
        const s = new Set(oc.split(/\s/).filter(x => !!x));
        this.setAttributes({ class: [...s].join(' ') });
        return this;
    }
    addChildren(children) {
        for (let child of children) {
            this.addChild(child);
        }
        return this;
    }
    addChild(child) {
        if (typeof child === 'string') {
            child = new vText(child);
        }
        if (!child) {
            return this;
        }
        this.children.push(child);
        return this;
    }
    addText(s) {
        this.addChildren([s]);
        return this;
    }
    setAny(t) {
        let { properties } = this;
        for (let [key, value] of Object.entries(t)) {
            properties[key] = value;
        }
        return this;
    }
    setProperties(t) {
        let { properties } = this;
        for (let [key, value] of Object.entries(t)) {
            properties[key] = value;
        }
        return this;
    }
    setStyle(t) {
        let { style } = this;
        for (let [key, value] of Object.entries(t)) {
            style[key] = value;
        }
        return this;
    }
    setValue(v) {
        this.properties.value = v;
        return this;
    }
    setAttributes(t) {
        let { attributes } = this;
        for (let [key, value] of Object.entries(t)) {
            attributes[key] = value;
        }
        return this;
    }
    removeStyle(key) {
        this.style[key] = null;
        return this;
    }
    removeAttribute(key) {
        this.attributes[key] = null;
        return this;
    }
    afterRendOrDiff(type) { }
}
class vText {
    data = '';
    rootSymb = void 0;
    $ref = null;
    constructor(data) {
        this.data = data;
    }
    afterRendOrDiff() { }
}
function isNul(item) {
    return (item === null) || (item === void 0);
}
class Watcher {
    root;
    data;
    listened = [];
    target = null;
    flushInterval = 100;
    model;
    flushAfterEvent = false;
    symb = Symbol(crypto.randomUUID());
    $on = Object.create(null);
    $once = Object.create(null);
    vdomTree = null;
    async getPromisedTree() {
        return loopAwait(async () => this.vdomTree, false, res => !!(res?.$ref), this.flushInterval);
    }
    noAfterFlush(handler) {
        this.no('afterFlush', handler);
    }
    afterFlush(handler, once = false) {
        once ? this.once("afterFlush", handler) : this.on("afterFlush", handler);
    }
    no(ev, handler) {
        if (!this.$on[ev]) {
            this.$on[ev] = [];
        }
        for (let m = this.$on[ev], i = m.length - 1; i >= 0; i--) {
            if (handler === m[i]) {
                m.splice(i, 1);
            }
        }
    }
    on(ev, handler) {
        if (!this.$on[ev]) {
            this.$on[ev] = [];
        }
        this.$on[ev].push(handler);
    }
    once(ev, handler) {
        if (!this.$once[ev]) {
            this.$once[ev] = [];
        }
        this.$once[ev].push(handler);
    }
    delayFnPool = new DelayFnManager;
    _emit(ev) {
        {
            const m = this.$on[ev];
            if (m && m.length) {
                for (let i = 0, l = m.length; i < l; i++) {
                    m[i]({
                        model: this.model,
                        eventName: ev,
                        watcher: this
                    });
                }
            }
        }
        {
            const m = this.$once[ev];
            if (m && m.length) {
                for (let i = 0, l = m.length; i < l; i++) {
                    m[i]({
                        model: this.model,
                        eventName: ev,
                        watcher: this
                    });
                }
                m.length = 0;
            }
        }
    }
    emit(ev) {
        nextDoor(() => this._emit(ev));
    }
    promisedFlush() {
        return new Promise(resolve => {
            this.afterFlush(resolve, true);
            this.flush();
        });
    }
    flush = throttle(this._flush.bind(this), this.flushInterval);
    _flush() {
        requestAnimationFrame(async () => {
            if (!this.vdomTree) {
                //第一次刷新时,只做简单替换
                let newTarget;
                this.vdomTree = await this.root(this.data);
                this.vdomTree.rootSymb = this.symb;
                try {
                    newTarget = rend(this.vdomTree, this.symb);
                }
                catch (e) {
                    console.error(e);
                    newTarget = document.createTextNode('渲染时发生错误');
                }
                if (this.target) {
                    this.target.replaceWith(newTarget);
                    this.target = null;
                }
            }
            else {
                /*diff*/
                let newTree = await this.root(this.data);
                newTree.rootSymb = this.symb;
                singleElementDiff(this.vdomTree, newTree, this.symb);
                this.vdomTree = newTree;
            }
            this.emit('afterFlush');
        });
    }
    listenDOMEvent() {
        const f = (type) => {
            return (e) => {
                const target = e.target;
                if (!target) {
                    return;
                }
                const g = {
                    model: this.model,
                    event: e,
                    srcTarget: target,
                    currentTarget: target,
                    watcher: this,
                    flush: this.flush,
                    stop: false,
                    $ref: null,
                    data: this.data,
                    delayPool: this.delayFnPool
                };
                const h = () => {
                    if (!g.currentTarget) {
                        return;
                    }
                    const $symb = Reflect.get(g.currentTarget, '$symb');
                    if ($symb !== this.symb) {
                        return;
                    }
                    const $ref = Reflect.get(g.currentTarget, '$ref');
                    if (!$ref) {
                        return;
                    }
                    g.$ref = $ref;
                    nextDoor(() => $ref.emit(type, g))
                        .then(() => g.stop)
                        .then(stop => {
                        if ((!stop) && g.currentTarget) {
                            g.currentTarget = g.currentTarget.parentElement;
                            h();
                        }
                    });
                };
                h();
                this.flushAfterEvent && this.flush();
            };
        };
        const sT = new Set(this.listened);
        for (const name of sT) {
            document.addEventListener(name, f(name), true);
        }
    }
    constructor(init) {
        this.listened = (init.listened || []).concat(['click', 'change']);
        this.target = init.target;
        this.data = init.data;
        this.root = init.root;
        this.model = this.genModel();
        this.flushAfterEvent = !!init.flushAfterEvent;
        this.listenDOMEvent();
        this.flush();
        this.once('afterFlush', () => { console.log(this.symb, 'first flush!'); });
        console.log(this.symb, 'watcher standby!');
    }
    genModel() {
        return new Proxy(this.data, {
            get: (target, key) => {
                const value = Reflect.get(target, key);
                if (typeof value === 'object' && value) {
                    this.flush();
                }
                return value;
            },
            set: (target, key, newValue) => {
                const oldValue = Reflect.get(target, key, target);
                if (!Object.is(newValue, oldValue)) {
                    this.flush();
                }
                return Reflect.set(target, key, newValue, target);
            }
        });
    }
}
function f() {
    return function h(tag) {
        return new vElement(tag);
    };
}
async function sleep(ms, val) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms, val);
    });
}
function shiftRef(ot, nt) {
    const r = ot.$ref;
    if (r) {
        Reflect.set(r, '$ref', nt);
        nt.$ref = r;
        ot.$ref = null;
    }
    return r;
}
function rend(node, symb) {
    //当节点不属于这个Watcher时,直接返回
    if (node.rootSymb && node.rootSymb !== symb) {
        //throw '异端'
        //console.log('异端!', node.$ref)
        return node.$ref || document.createTextNode('<占位符>');
    }
    let res;
    if (node instanceof vElement) {
        res = document.createElement(node.tag);
        const { children, style, attributes, properties } = node;
        const rst = res.style;
        for (const [key, value] of Object.entries(style)) {
            rst[key] = value;
        }
        if (!node.stopRendChild) {
            for (const child of children) {
                res.appendChild(rend(child, symb));
            }
        }
        for (let [key, value] of Object.entries(attributes)) {
            isNul(value) || res.setAttribute(key, value + '');
        }
        for (let [key, value] of Object.entries(properties)) {
            Reflect.set(res, key, value);
        }
    }
    else {
        res = document.createTextNode(node.data);
    }
    node.$ref = res;
    Reflect.set(res, '$ref', node);
    Reflect.set(res, '$symb', symb);
    nextDoor(() => node.afterRendOrDiff('rend'));
    return res;
}
function childrenDiff(ocs, ncs, pr, symb) {
    let i = 0;
    for (const l = Math.min(ocs.length, ncs.length); i < l; i++) {
        singleElementDiff(ocs[i], ncs[i], symb);
    }
    if (ocs.length === ncs.length) {
        return;
    }
    if (ocs.length > ncs.length) {
        for (const l = ocs.length; i < l; i++) {
            const oc = ocs[i];
            //当旧孩子是另一个Watcher的根树时
            if (oc.rootSymb && oc.rootSymb !== symb) {
                oc.$ref?.remove();
                continue;
            }
            if (oc.$ref) {
                Reflect.set(oc.$ref, '$ref', null);
                oc.$ref.remove();
                oc.$ref = null;
            }
        }
    }
    else {
        for (const l = ncs.length; i < l; i++) {
            const nc = ncs[i];
            //当新孩子是另一个Watcher的根树时
            if (nc.rootSymb && nc.rootSymb !== symb) {
                if (nc.$ref) {
                    pr.appendChild(nc.$ref);
                }
                continue;
            }
            pr.appendChild(rend(nc, symb));
        }
    }
}
function attrsDiff(type, ot, nt, $ref) {
    const f = () => {
        switch (type) {
            case 'attributes':
                {
                    const keysSet = new Set([...Object.keys(ot.attributes), ...Object.keys(nt.attributes)]);
                    for (const key of keysSet) {
                        const v0 = nt.attributes[key];
                        const v1 = ot.attributes[key];
                        if (isNul(v0)) {
                            $ref.removeAttribute(key);
                        }
                        else if (v0 !== v1) {
                            $ref.setAttribute(key, v0 + '');
                        }
                    }
                }
                break;
            case 'properties':
                {
                    const keysSet = new Set([...Object.keys(ot.properties), ...Object.keys(nt.properties)]);
                    for (const key of keysSet) {
                        if (key === '$ref')
                            continue;
                        const v0 = nt.properties[key];
                        const v1 = ot.properties[key];
                        if (v0 !== v1) {
                            Reflect.set($ref, key, v0);
                        }
                    }
                }
                break;
            case 'styles':
                {
                    const keysSet = new Set([...Object.keys(ot.style), ...Object.keys(nt.style)]);
                    for (const key of keysSet) {
                        const v0 = nt.style[key];
                        const v1 = ot.style[key];
                        if (isNul(v0)) {
                            $ref.style.removeProperty(key);
                        }
                        else if (v0 !== v1) {
                            $ref.style[key] = v0;
                        }
                    }
                }
                break;
        }
    };
    nextDoor(f);
}
function singleElementDiff(ot, nt, symb) {
    //当ot与nt都是根树,且属于不同的Watcher时,直接替换
    if ((ot.rootSymb && nt.rootSymb) && (ot.rootSymb !== nt.rootSymb)) {
        if (ot.$ref && nt.$ref) {
            ot.$ref.replaceWith(nt.$ref);
        }
        return;
    }
    //当ot不是根树,nt是根树(不同Watcher)时
    if ((!ot.rootSymb) && nt.rootSymb && nt.rootSymb !== symb) {
        if (ot.$ref && nt.$ref) {
            ot.$ref.replaceWith(nt.$ref);
        }
        return;
    }
    //当ot是根树(不同Watcher),nt不是根树时
    if (ot.rootSymb && ot.rootSymb !== symb && !nt.rootSymb) {
        if (ot.$ref) {
            ot.$ref.replaceWith(nt.$ref || rend(nt, symb));
        }
        return;
    }
    //如果nt是别的Watcher的根树,直接结束
    if (nt.rootSymb && symb !== nt.rootSymb) {
        return;
    }
    //其他情况
    const _ref = shiftRef(ot, nt);
    if (!_ref) {
        return;
    }
    if (ot instanceof vElement && nt instanceof vElement && ot.tag === nt.tag) {
        const $ref = _ref;
        if ((!ot.stopDiffChild) && (!nt.stopDiffChild)) {
            childrenDiff(ot.children, nt.children, $ref, symb);
            attrsDiff('attributes', ot, nt, $ref);
            attrsDiff('styles', ot, nt, $ref);
            attrsDiff('properties', ot, nt, $ref);
            nextDoor(() => nt.afterRendOrDiff('diff'));
        }
        else if (ot.stopDiffChild && nt.stopDiffChild) {
            attrsDiff('attributes', ot, nt, $ref);
            attrsDiff('styles', ot, nt, $ref);
            attrsDiff('properties', ot, nt, $ref);
            nextDoor(() => nt.afterRendOrDiff('diff'));
        }
        else {
            _ref.replaceWith(rend(nt, symb));
            Reflect.set(_ref, '$ref', null);
        }
    }
    else if (ot instanceof vText && nt instanceof vText) {
        if (nt.data !== ot.data) {
            _ref.data = nt.data;
        }
        nextDoor(() => nt.afterRendOrDiff());
    }
    else {
        _ref.replaceWith(rend(nt, symb));
        Reflect.set(_ref, '$ref', null);
    }
}
async function loopAwait(f, print, testor, sleepTime) {
    let count = 0;
    let warnFlag = true;
    while (true) {
        if (print) {
            console.log(`loopAwait第${count}次循环`);
        }
        try {
            if (warnFlag && (count > 1000)) {
                console.warn('该loopAwait已经循环了1000次以上,请确认代码是否有问题');
                warnFlag = false;
            }
            const result = await f(count);
            count++;
            print && console.log(result);
            await sleep(sleepTime);
            if (testor(result, count)) {
                return result;
            }
        }
        catch (e) {
            print && console.log(e);
        }
    }
}
function throttle(fn, delay) {
    let timer = void 0;
    return () => {
        if (timer !== void 0) {
            return;
        }
        timer = setTimeout(() => {
            fn();
            timer = void 0;
        }, delay);
    };
}
async function nextDoor(f) {
    return new Promise(res => res(void 0)).then(f);
}
class DelayFnManager {
    map = new Map();
    set(k, fn) {
        this.map.set(k, fn);
    }
    clear() {
        this.map.clear();
    }
    delete(k) {
        this.map.delete(k);
    }
    run(k) {
        this.map.get(k)?.();
        this.delete(k);
    }
    runAll() {
        for (const [_, fn] of this.map) {
            fn();
        }
        this.clear();
    }
    keyFilterRun(filter) {
        for (const [key, fn] of this.map) {
            if (filter(key)) {
                fn();
                this.map.delete(key);
            }
        }
    }
}

class Store {
    _dbname = '';
    get fullName() {
        return '$$easyDB - ' + this._dbname;
    }
    db = null;
    openDB() {
        if (this.db) {
            return;
        }
        const q = indexedDB.open(this.fullName);
        q.onupgradeneeded = () => {
            if (!q.result.objectStoreNames.contains(this.fullName)) {
                q.result.createObjectStore(this.fullName, { keyPath: 'id' }).transaction.oncomplete = () => {
                    this.db = q.result;
                };
            }
        };
        q.onsuccess = () => {
            this.db = q.result;
        };
    }
    keys() {
        return new Promise(resolve => {
            let timer = null;
            timer = setInterval(() => {
                if (!this.db) {
                    return;
                }
                const q = this.db
                    .transaction(this.fullName, 'readonly')
                    .objectStore(this.fullName)
                    .getAll();
                q.onsuccess = () => {
                    if (q.result) {
                        const $result = q.result;
                        resolve($result.map(x => x.id));
                    }
                    else {
                        resolve([]);
                    }
                };
                q.onerror = () => resolve([]);
                clearInterval(timer);
            }, 0);
        });
    }
    values() {
        return new Promise(resolve => {
            let timer = null;
            timer = setInterval(() => {
                if (!this.db) {
                    return;
                }
                const q = this.db
                    .transaction(this.fullName, 'readonly')
                    .objectStore(this.fullName)
                    .getAll();
                q.onsuccess = () => {
                    if (q.result) {
                        const $result = q.result;
                        resolve($result.map(x => x.value));
                    }
                    else {
                        resolve([]);
                    }
                };
                q.onerror = () => resolve([]);
                clearInterval(timer);
            }, 0);
        });
    }
    entries() {
        return new Promise(resolve => {
            let timer = null;
            timer = setInterval(() => {
                if (!this.db) {
                    return;
                }
                const q = this.db
                    .transaction(this.fullName, 'readonly')
                    .objectStore(this.fullName)
                    .getAll();
                q.onsuccess = () => {
                    if (q.result) {
                        const $result = q.result;
                        resolve($result.map(x => [x.id, x.value]));
                    }
                    else {
                        resolve([]);
                    }
                };
                q.onerror = () => resolve([]);
                clearInterval(timer);
            }, 0);
        });
    }
    getItem(id) {
        return new Promise(resolve => {
            let timer = null;
            timer = setInterval(() => {
                if (!this.db) {
                    return;
                }
                const q = this.db
                    .transaction(this.fullName, 'readonly')
                    .objectStore(this.fullName)
                    .get(id);
                q.onsuccess = () => {
                    if (q.result) {
                        resolve(q.result.value);
                    }
                    else {
                        resolve(null);
                    }
                };
                q.onerror = () => resolve(null);
                clearInterval(timer);
            }, 0);
        });
    }
    hasItem(id) {
        return new Promise(resolve => {
            let timer = null;
            timer = setInterval(() => {
                if (!this.db) {
                    return;
                }
                const q = this.db
                    .transaction(this.fullName, 'readonly')
                    .objectStore(this.fullName)
                    .get(id);
                q.onsuccess = () => {
                    if (q.result) {
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    }
                };
                q.onerror = () => resolve(false);
                clearInterval(timer);
            }, 0);
        });
    }
    setItem(id, value) {
        return new Promise(resolve => {
            let timer = null;
            timer = setInterval(() => {
                if (!this.db) {
                    return;
                }
                const q = this.db
                    .transaction(this.fullName, 'readwrite')
                    .objectStore(this.fullName)
                    .put({ id, value });
                q.onsuccess = () => {
                    resolve(true);
                };
                q.onerror = () => resolve(false);
                clearInterval(timer);
            }, 0);
        });
    }
    removeItem(id) {
        return new Promise(resolve => {
            let timer = null;
            timer = setInterval(() => {
                if (!this.db) {
                    return;
                }
                const q = this.db
                    .transaction(this.fullName, 'readwrite')
                    .objectStore(this.fullName)
                    .delete(id);
                q.onsuccess = () => {
                    resolve(true);
                };
                q.onerror = () => resolve(false);
                clearInterval(timer);
            }, 0);
        });
    }
    clear() {
        return new Promise(resolve => {
            let timer = null;
            timer = setInterval(() => {
                if (!this.db) {
                    return;
                }
                const q = this.db
                    .transaction(this.fullName, 'readwrite')
                    .objectStore(this.fullName)
                    .clear();
                q.onsuccess = () => {
                    resolve(true);
                };
                q.onerror = () => resolve(false);
                clearInterval(timer);
            }, 0);
        });
    }
    async fromEntries(ent) {
        for (const [key, value] of ent) {
            await this.setItem(key, value);
        }
    }
    async fromEntriesSkipy(ent) {
        for (const [key, value] of ent) {
            if (await this.hasItem(key)) {
                continue;
            }
            await this.setItem(key, value);
        }
    }
    constructor(n) {
        if (!n) {
            throw new Error('创建Store失败:不能使用空字符!');
        }
        this._dbname = n;
        this.openDB();
    }
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const PER_PAGE = 10;
function timeStampDiff(st0, st1) {
    const r = {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isPositive: true
    };
    const odiff = st0 - st1;
    r.isPositive = odiff >= 0;
    let diff = Math.abs(odiff);
    r.days = Math.floor(diff / DAY);
    diff %= DAY;
    r.hours = Math.floor(diff / HOUR);
    diff %= HOUR;
    r.minutes = Math.floor(diff / MINUTE);
    diff %= MINUTE;
    r.seconds = Math.floor(diff / SECOND);
    return r;
}
class Data {
    records = [];
    _page = 0;
    get page() {
        return this._page;
    }
    set page(value) {
        this._page = Math.max(Math.min(this.pageMax(), value), 0);
    }
    pageMax() {
        if (this.records.length === 0) {
            return 0;
        }
        return Math.floor((this.records.length - 1) / PER_PAGE);
    }
    store = new Store('电瓶车充电记录');
    async save() {
        const slot = prompt('输入电车名', '我的电车');
        if (!slot) {
            return false;
        }
        return this.store.setItem(slot, this.records);
    }
    async load() {
        const keys = await this.store.keys();
        const slot = prompt(`输入电车名:\n${keys.map(x => `    -${x}`)}`, '我的电车');
        if (!slot) {
            return;
        }
        this.records = await this.store.getItem(slot) || [];
        this.page = this.pageMax();
    }
}
const $8hours = 8 * 60 * 60 * 1000;
const h = f();
var ui;
(function (ui) {
    function app(data) {
        return h('div').addChildren([
            content(data),
            control(data)
        ]);
    }
    ui.app = app;
    function content(data) {
        return h('table').addChildren([
            h('tr').addChildren([
                h('th').addText('序号'),
                h('th').addText('时间'),
                h('th').addText('总行程(KM)'),
                h('th').addText('备注'),
                h('th').addText('操作'),
            ])
        ]).addChildren((() => {
            const r = [];
            const start = PER_PAGE * data.page;
            for (let i = start, l = Math.min(start + PER_PAGE, data.records.length); i < l; i++) {
                const rc = data.records[i];
                r.push(h('tr').addChildren([
                    h('td').addChildren([
                        (() => {
                            return h('div')
                                .addText(i + 1 + '');
                        })()
                    ]),
                    h('td').addChildren([
                        (() => {
                            const diff = i > 0 ? timeStampDiff(rc.timeStamp, data.records[i - 1].timeStamp) : null;
                            if (diff) {
                                const txt = `${diff.isPositive ? '+' : '-'}${diff.days}天${diff.hours}时${diff.minutes}分${diff.seconds}秒`;
                                return h('div').addChildren([txt]).setStyle({
                                    color: diff.isPositive ? 'blue' : 'red'
                                });
                            }
                            else {
                                return h('div').addChildren([
                                    '-'
                                ]);
                            }
                        })(),
                        h('input').setAttributes({ type: 'datetime-local' }).setProperties({
                            valueAsNumber: rc.timeStamp + $8hours
                        }).on('change', ({ flush, srcTarget }) => {
                            rc.timeStamp = srcTarget.valueAsNumber - $8hours;
                            flush();
                        })
                    ]),
                    h('td').addChildren([
                        (() => {
                            const diff = i > 0 ? rc.driven - data.records[i - 1].driven : NaN;
                            const flag = diff >= 0;
                            return h('div').addChildren([
                                (!isNaN(diff))
                                    ? (flag ? '+' + diff : diff + '')
                                    : '-'
                            ]).setStyle({
                                color: flag ? 'blue' : 'red'
                            });
                        })(),
                        h('input').setValue(rc.driven).setAttributes({ type: 'number' }).on('change', ({ srcTarget, flush }) => {
                            rc.driven = srcTarget.valueAsNumber;
                            flush();
                        })
                    ]),
                    h('td').addChildren([
                        h('input').setValue(rc.comment).on('change', ({ srcTarget, flush }) => {
                            rc.comment = srcTarget.value;
                            flush();
                        })
                    ]),
                    h('td').addChildren([
                        h('button').addText('删除').on('click', ({ model }) => {
                            if (!confirm('确实要删除本条目吗?')) {
                                return;
                            }
                            model.records.splice(i, 1);
                        }).setStyle({ color: "red" })
                    ]),
                ]));
            }
            return r;
        })()).setAttributes({ border: 1 }).setStyle({ borderCollapse: 'collapse' });
    }
    function jump(data) {
        return h('div').addChildren([
            h('button').addText('上一页').on('click', ({ model }) => { model.page--; }),
            h('span').addChildren([
                h('input').setValue(data.page + 1).on('change', ({ model, srcTarget }) => {
                    model.page = +srcTarget.value - 1;
                }),
                '/',
                data.pageMax() + 1 + ''
            ]),
            h('button').addText('下一页').on('click', ({ model }) => { model.page++; }),
        ]);
    }
    function control(data) {
        return h('div').addChildren([
            jump(data),
            h('button').addText('添加').on('click', ({ model }) => {
                const count = +(prompt('添加几条?', '1') ?? 0) || 0;
                for (let i = 0; i < count; i++) {
                    model.records.push({
                        timeStamp: +new Date,
                        driven: 0,
                        comment: ''
                    });
                }
            }),
            h('button').addText('SPLICE').on('click', ({ model }) => {
                const index = +(prompt('序号?', 'NaN') ?? NaN) || NaN;
                const delCount = +(prompt('删除数?', 'NaN') ?? NaN) || NaN;
                const addCount = +(prompt('添加数?', 'NaN') ?? NaN) || NaN;
                const tmp = [];
                for (let i = 0; i < addCount; i++) {
                    tmp.push({
                        timeStamp: +new Date,
                        driven: 0,
                        comment: ''
                    });
                }
                model.records.splice(index, delCount, ...tmp);
            }),
            h('button').addText('保存').on('click', async ({ model }) => {
                alert(`保存${await model.save() ? '成功' : '失败'}`);
            }),
            h('button').addText('导出').on('click', async ({ model }) => {
                const slot = prompt('输入电车名', '我的电车');
                if (!slot) {
                    return;
                }
                const json = JSON.stringify(await model.store.getItem(slot), void 0, '\t');
                const a = document.createElement('a');
                const u = URL.createObjectURL(new Blob([
                    json
                ], { type: 'text/plain' }));
                a.href = u;
                a.download = `充电记录_${slot}.txt`;
                a.click();
            }),
            h('button').addText('导入').on('click', () => {
                document.getElementById('file').click();
            }),
            h('input').setAttributes({ type: 'file', id: 'file' }).setStyle({ display: 'none' }).on('change', ({ model, srcTarget }) => {
                const file = srcTarget.files?.[0];
                if (file) {
                    const fr = new FileReader;
                    fr.onload = () => {
                        const result = JSON.parse(fr.result);
                        if (Array.isArray(result)) {
                            model.records = result;
                        }
                    };
                    fr.readAsText(file);
                }
            }),
        ]);
    }
})(ui || (ui = {}));
async function main() {
    const wt = new Watcher({
        target: document.getElementById('app'),
        async root(data) {
            return ui.app(data);
        },
        data: new Data
    });
    wt.model.load();
}
main();
