"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.createMenteNativeRequest = factory;
})(
  typeof window === "object" ? window : globalThis,
  function ({
    prefix,
    send,
    timeout,
    timeoutMessage,
    invalidMessage,
    schedule = setTimeout,
    cancel = clearTimeout,
    now = Date.now,
  }) {
    const pending = new Map();
    let sequence = 0;

    function take(id) {
      const request = pending.get(id);
      if (request) {
        cancel(request.timer);
        pending.delete(id);
      }
      return request;
    }

    function resolve(id, raw) {
      const request = take(id);
      if (!request) return;
      try {
        const response = JSON.parse(raw);
        if (
          !response ||
          typeof response !== "object" ||
          Array.isArray(response)
        ) {
          throw new Error(invalidMessage);
        }
        if (response.error) request.reject(new Error(String(response.error)));
        else request.resolve(response);
      } catch (_) {
        request.reject(new Error(invalidMessage));
      }
    }

    function request(...args) {
      return new Promise((resolve, reject) => {
        const id =
          prefix + "-" + now().toString(36) + "-" + (++sequence).toString(36);
        const timer = schedule(() => {
          const request = take(id);
          if (request) request.reject(new Error(timeoutMessage));
        }, timeout);
        pending.set(id, { resolve, reject, timer });
        try {
          send(id, ...args);
        } catch (error) {
          take(id);
          reject(error);
        }
      });
    }

    return { request, resolve };
  },
);
