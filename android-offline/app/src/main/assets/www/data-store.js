(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.createMenteDataStore = factory;
})(
  typeof window === "object" ? window : globalThis,
  function (environment, catalog, showToast) {
    "use strict";
    const { THEMES, RANKING_MEDALS } = catalog;
    const DEFAULT_DATA = {
      version: 3,
      installId: "",
      profile: {
        name: "Jogador",
        sound: true,
        theme: "neon",
        publicMedals: [],
      },
      rankingEligibleMedals: [],
      sessions: [],
    };

    let data = loadData();

    function loadData() {
      try {
        let raw = "";
        if (
          environment.MenteAgilData &&
          typeof environment.MenteAgilData.load === "function"
        ) {
          raw = environment.MenteAgilData.load();
        } else if (environment.localStorage) {
          raw = environment.localStorage.getItem("mente-agil-offline-v1") || "";
        }
        if (!raw) return freshData();

        const parsed = JSON.parse(raw);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !Array.isArray(parsed.sessions)
        ) {
          return freshData();
        }
        return {
          version: 3,
          installId: validInstallId(parsed.installId)
            ? parsed.installId
            : createInstallId(),
          ...(typeof parsed.accountId === "string"
            ? {
                accountId: parsed.accountId,
                publicId: String(parsed.publicId || ""),
                syncedAt: Number(parsed.syncedAt) || 0,
              }
            : {}),
          profile: {
            name:
              typeof parsed.profile?.name === "string"
                ? parsed.profile.name.slice(0, 24)
                : "Jogador",
            sound: parsed.profile?.sound !== false,
            theme: THEMES.some((item) => item.id === parsed.profile?.theme)
              ? parsed.profile.theme
              : "neon",
            publicMedals: Array.isArray(parsed.profile?.publicMedals)
              ? [...new Set(parsed.profile.publicMedals.map(String))]
                  .filter((id) => RANKING_MEDALS.some((item) => item.id === id))
                  .slice(0, 3)
              : [],
          },
          rankingEligibleMedals: Array.isArray(parsed.rankingEligibleMedals)
            ? parsed.rankingEligibleMedals
                .map(String)
                .filter((id) => RANKING_MEDALS.some((item) => item.id === id))
            : [],
          sessions: parsed.sessions.filter(validSession).slice(-100),
        };
      } catch (_) {
        return freshData();
      }
    }

    function freshData() {
      const next = structuredCloneSafe(DEFAULT_DATA);
      next.installId = createInstallId();
      return next;
    }

    function validInstallId(value) {
      return typeof value === "string" && /^[A-Za-z0-9-]{16,80}$/.test(value);
    }

    function createInstallId() {
      try {
        if (
          environment.crypto &&
          typeof environment.crypto.randomUUID === "function"
        )
          return environment.crypto.randomUUID();
      } catch (_) {
        // Continua com um identificador local aleatório em WebViews antigos.
      }
      return (
        "mobile-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2)
      );
    }

    function structuredCloneSafe(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function validSession(item) {
      return (
        item &&
        typeof item === "object" &&
        ["add", "sub", "mul"].includes(item.operation) &&
        Array.isArray(item.answers) &&
        Number.isFinite(Number(item.startedAt))
      );
    }

    function save(showFailure = true) {
      data.sessions = data.sessions.slice(-100);
      const json = JSON.stringify(data);
      let saved = false;
      try {
        if (
          environment.MenteAgilData &&
          typeof environment.MenteAgilData.save === "function"
        ) {
          saved = environment.MenteAgilData.save(json);
          if (saved && environment.MenteAgilData.saveAccountSlot)
            environment.MenteAgilData.saveAccountSlot(json);
        } else if (environment.localStorage) {
          environment.localStorage.setItem("mente-agil-offline-v1", json);
          saved = true;
        }
      } catch (_) {
        saved = false;
      }
      if (!saved && showFailure)
        showToast("Não foi possível salvar o histórico.");
      return saved;
    }

    function sanitizeImportedBackup(parsed) {
      if (
        !parsed ||
        parsed.backupVersion !== 1 ||
        !Array.isArray(parsed.sessions)
      )
        return null;
      const theme = THEMES.some((item) => item.id === parsed.profile?.theme)
        ? parsed.profile.theme
        : "neon";
      return {
        version: 3,
        installId: data.installId,
        ...(data.accountId
          ? {
              accountId: data.accountId,
              publicId: data.publicId,
              syncedAt: data.syncedAt || 0,
            }
          : {}),
        profile: {
          name:
            typeof parsed.profile?.name === "string"
              ? parsed.profile.name.slice(0, 24)
              : data.profile.name,
          sound: parsed.profile?.sound !== false,
          theme,
          publicMedals: data.profile.publicMedals,
        },
        rankingEligibleMedals: data.rankingEligibleMedals,
        sessions: parsed.sessions.filter(validSession).slice(-100),
      };
    }

    function mergeSessions(incoming, existing) {
      const key = (item) =>
        item.id ||
        JSON.stringify([
          item.startedAt,
          item.operation,
          item.level,
          item.answers,
        ]);
      const merged = new Map(
        [...incoming.filter(validSession), ...existing].map((item) => [
          key(item),
          item,
        ]),
      );
      return [...merged.values()]
        .sort((a, b) => a.startedAt - b.startedAt)
        .slice(-100);
    }

    function accountSlot(accountId) {
      const raw = environment.MenteAgilData?.loadAccountSlot() || "";
      if (!raw) return null;
      const restored = JSON.parse(raw);
      if (
        !restored.profile ||
        !Array.isArray(restored.sessions) ||
        restored.accountId !== accountId
      ) {
        throw new Error("Não foi possível abrir o progresso desta conta.");
      }
      return restored;
    }

    function connect(account) {
      const changedAccount = data.accountId !== account.id;
      if (data.accountId && data.accountId !== account.id) {
        data = accountSlot(account.id) || freshData();
      } else if (!data.accountId) {
        const restored = accountSlot(account.id);
        if (restored) {
          restored.sessions = mergeSessions(data.sessions, restored.sessions);
          data = restored;
        }
        environment.MenteAgilData?.adoptGuestPhoto?.();
      }
      // Pending requests keep their original object and cannot write into a new owner.
      if (changedAccount) data = { ...data, profile: { ...data.profile } };
      data.accountId = account.id;
      data.publicId = account.publicId;
      data.profile.name = account.name;
      save();
    }

    function disconnect() {
      data = freshData();
      save();
    }

    function mergeHistory(sessions, syncedAt) {
      data.sessions = mergeSessions(sessions, data.sessions);
      data.syncedAt = syncedAt;
      save();
    }

    return {
      getData: () => data,
      snapshot: () => structuredCloneSafe(data),
      replace: (next) => {
        data = next;
      },
      save,
      freshData,
      sanitizeImportedBackup,
      connect,
      disconnect,
      mergeHistory,
    };
  },
);
