const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../app/src/main/assets/www/core.js");
const catalog = require("../app/src/main/assets/www/catalog.js");
const createStore = require("../app/src/main/assets/www/data-store.js");

function element(dataset = {}) {
  const events = {},
    classes = new Set();
  return {
    dataset,
    style: {},
    childNodes: [],
    textContent: "",
    value: "",
    disabled: false,
    firstChild: { textContent: "" },
    classList: {
      add: (value) => classes.add(value),
      remove: (value) => classes.delete(value),
      toggle(value, enabled) {
        if (enabled) classes.add(value);
        else classes.delete(value);
      },
    },
    append(...children) {
      this.childNodes.push(...children);
    },
    appendChild(child) {
      this.append(child);
    },
    replaceChildren(...children) {
      this.childNodes = children;
    },
    setAttribute() {},
    focus() {},
    addEventListener(name, callback) {
      events[name] = callback;
    },
    fire(name) {
      return events[name]?.({ currentTarget: this, preventDefault() {} });
    },
  };
}

function fixture(feature, extra = {}) {
  const fields = new Map(),
    groups = new Map(),
    timers = new Map();
  let nextId = 0,
    saved = "";
  const $ = (selector) => {
    if (!fields.has(selector)) fields.set(selector, element());
    return fields.get(selector);
  };
  const $$ = (selector) => groups.get(selector) || [];
  const document = {
    querySelector: $,
    querySelectorAll: $$,
    createElement: () => element(),
    createTextNode: (text) => ({ textContent: text }),
  };
  const window = { scrollTo() {}, MenteAgilAccount: { connected: () => true } };
  const schedule = (callback) => {
    timers.set(++nextId, callback);
    return nextId;
  };
  const context = vm.createContext({
    window,
    document,
    setTimeout: schedule,
    setInterval: schedule,
    clearTimeout: (id) => timers.delete(id),
    clearInterval: (id) => timers.delete(id),
    requestAnimationFrame: (callback) => callback(),
  });
  vm.runInContext(
    fs.readFileSync(
      path.join(__dirname, "../app/src/main/assets/www/", feature + ".js"),
      "utf8",
    ),
    context,
  );
  const store = createStore(
    {
      MenteAgilData: {
        load: () => "",
        loadAccountSlot: () => "",
        save: (json) => {
          saved = json;
          return true;
        },
      },
    },
    catalog,
    () => {},
  );
  const ui = {
    $,
    $$,
    showToast() {},
    setSingleActive() {},
    playSound() {},
    applyTheme() {},
  };
  const api = window.MenteModules[feature]({
    store,
    ui,
    core,
    catalog,
    switchScreen() {},
    renderHome() {},
    onSaved() {},
    onRankedFinish() {},
    ...extra,
  });
  return { api, store, $, groups, timers, saved: () => JSON.parse(saved) };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

module.exports = { fixture, element, deferred };
