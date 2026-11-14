import express from "express";
import { createServer } from "node:http";
import {
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { dirname } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(value, stored) {
  try {
    const [salt, hash] = stored.split(":");
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(value, salt, 64);

    return (
      expected.length === actual.length &&
      timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

function originAutorisee(req) {
  if (!req.headers.origin) return true;

  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function createCollaborationServer({
  dataFile,
  secureCookie = false,
  configureApp,
} = {}) {
  if (!dataFile) {
    throw new Error("Le chemin dataFile est requis.");
  }

  const data = existsSync(dataFile)
    ? JSON.parse(readFileSync(dataFile, "utf8"))
    : {
        key: randomBytes(32).toString("hex"),
        users: [],
        notes: [],
      };

  const sessions = new Map();
  const rooms = new Map();
  const attempts = new Map();

  function persist() {
    mkdirSync(dirname(dataFile), { recursive: true });

    writeFileSync(
      `${dataFile}.tmp`,
      JSON.stringify(data),
      { mode: 0o600 }
    );

    renameSync(`${dataFile}.tmp`, dataFile);
  }

  function encrypt(value) {
    const iv = randomBytes(12);

    const cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(data.key, "hex"),
      iv
    );

    const bytes = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);

    return [iv, cipher.getAuthTag(), bytes]
      .map((part) => part.toString("base64"))
      .join(".");
  }

  function decrypt(value) {
    const [iv, tag, bytes] = value
      .split(".")
      .map((part) => Buffer.from(part, "base64"));

    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(data.key, "hex"),
      iv
    );

    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(bytes),
      decipher.final(),
    ]).toString("utf8");
  }

  function cookieToken(req) {
    return /(?:^|;\s*)campus_session=([a-f0-9]+)/.exec(
      req.headers.cookie || ""
    )?.[1];
  }

  function getSession(req) {
    const token = cookieToken(req);

    if (!token) return null;

    const key = digest(token);
    const session = sessions.get(key);

    if (!session) return null;

    if (session.expires <= Date.now()) {
      sessions.delete(key);
      return null;
    }

    return session;
  }

  function newSession(res, userId = null) {
    const token = randomBytes(32).toString("hex");

    const session = {
      userId,
      grants: new Set(),
      expires: Date.now() + 86400000,
    };

    sessions.set(digest(token), session);

    res.setHeader(
      "Set-Cookie",
      `campus_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${
        secureCookie ? "; Secure" : ""
      }`
    );

    return session;
  }

  function publicUser(session) {
    const user = data.users.find(
      (entry) => entry.id === session?.userId
    );

    return user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
        }
      : null;
  }

  function allowed(session, note) {
    return Boolean(
      session &&
      session.expires > Date.now() &&
      (
        session.userId === note.ownerId ||
        session.grants.has(note.id)
      )
    );
  }

  function limited(req, key) {
    const id = `${req.socket.remoteAddress}:${key}`;
    let entry = attempts.get(id);

    if (!entry || entry.until < Date.now()) {
      entry = {
        count: 0,
        until: Date.now() + 60000,
      };

      attempts.set(id, entry);
    }

    return ++entry.count > 10;
  }

  function room(note) {
    if (rooms.has(note.id)) {
      return rooms.get(note.id);
    }

    const doc = new Y.Doc();
    Y.applyUpdate(doc, Buffer.from(note.state, "base64"));

    const result = {
      doc,
      clients: new Set(),
    };

    rooms.set(note.id, result);

    return result;
  }

  const app = express();

  app.use(express.json({ limit: "5mb" }));

  // Branche les routes Forum/Horaire avant les routes Notes.
  configureApp?.(app);

  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");

    if (!originAutorisee(req)) {
      return res.status(403).json({
        message: "Origine non autorisée.",
      });
    }

    req.session = getSession(req);
    next();
  });

  app.get("/api/session", (req, res) => {
    if (!req.session) {
      req.session = newSession(res);
    }

    res.json({
      user: publicUser(req.session),
    });
  });

  app.post(
    ["/api/auth/login", "/api/auth/register"],
    (req, res) => {
      const action = req.path.split("/").pop();

      if (limited(req, "auth")) {
        return res.status(429).json({
          message: "Trop de tentatives. Réessayez dans une minute.",
        });
      }

      const { email, password, name } = req.body || {};

      if (
        typeof email !== "string" ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        email.length > 254 ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
      ) {
        return res.status(400).json({
          message:
            "Adresse courriel valide et mot de passe de 8 à 128 caractères requis.",
        });
      }

      const normalized = email.trim().toLowerCase();

      let user = data.users.find(
        (entry) => entry.email === normalized
      );

      if (action === "register") {
        if (user) {
          return res.status(409).json({
            message: "Ce courriel est déjà utilisé.",
          });
        }

        if (
          typeof name !== "string" ||
          !name.trim() ||
          name.length > 80
        ) {
          return res.status(400).json({
            message: "Nom requis, 80 caractères maximum.",
          });
        }

        user = {
          id: randomUUID(),
          email: normalized,
          name: name.trim(),
          password: hashPassword(password),
        };

        data.users.push(user);
        persist();
      } else if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({
          message: "Courriel ou mot de passe incorrect.",
        });
      }

      const previousToken = cookieToken(req);

      // Invalide l’ancienne session et ses connexions.
      if (previousToken) {
        const previous = sessions.get(digest(previousToken));

        if (previous) {
          previous.expires = 0;

          for (const client of wss.clients) {
            if (client.session === previous) {
              client.close(1008, "Session remplacée");
            }
          }
        }

        sessions.delete(digest(previousToken));
      }

      const session = newSession(res, user.id);

      res.json({
        user: publicUser(session),
      });
    }
  );

  app.post("/api/logout", (req, res) => {
    if (req.session) {
      req.session.expires = 0;

      for (const client of wss.clients) {
        if (client.session === req.session) {
          client.close(1008, "Déconnexion");
        }
      }
    }

    const token = cookieToken(req);

    if (token) {
      sessions.delete(digest(token));
    }

    newSession(res);

    res.json({ ok: true });
  });

  app.post("/api/shared-notes", (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({
        message: "Connectez-vous pour partager une note.",
      });
    }

    const { title, state, code } = req.body || {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 120 ||
      typeof state !== "string" ||
      typeof code !== "string" ||
      !/^\d{8}$/.test(code)
    ) {
      return res.status(400).json({
        message: "Note invalide.",
      });
    }

    const doc = new Y.Doc();

    try {
      Y.applyUpdate(doc, Buffer.from(state, "base64"));
    } catch {
      doc.destroy();

      return res.status(400).json({
        message: "Document invalide.",
      });
    }

    const note = {
      id: randomUUID(),
      ownerId: req.session.userId,
      title: title.trim(),
      password: hashPassword(code),
      code: encrypt(code),
      state: Buffer.from(
        Y.encodeStateAsUpdate(doc)
      ).toString("base64"),
    };

    doc.destroy();

    data.notes.push(note);
    persist();

    res.status(201).json({
      id: note.id,
    });
  });

  app.get("/api/shared-notes", (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({
        message: "Connexion requise.",
      });
    }

    res.json(
      data.notes
        .filter((note) => note.ownerId === req.session.userId)
        .map((note) => ({
          id: note.id,
          title: note.title,
        }))
    );
  });

  app.get("/api/shared-notes/:id", (req, res) => {
    const note = data.notes.find(
      (entry) => entry.id === req.params.id
    );

    if (!note) {
      return res.status(404).json({
        message: "Cette note partagée est introuvable.",
      });
    }

    if (!allowed(req.session, note)) {
      return res.status(403).json({
        locked: true,
        message: "Cette note est protégée.",
      });
    }

    res.json({
      id: note.id,
      title: note.title,
      owner: req.session.userId === note.ownerId,
    });
  });

  app.post("/api/shared-notes/:id/unlock", (req, res) => {
    const note = data.notes.find(
      (entry) => entry.id === req.params.id
    );

    if (!note) {
      return res.status(404).json({
        message: "Note introuvable.",
      });
    }

    if (limited(req, `unlock:${note.id}`)) {
      return res.status(429).json({
        message: "Trop de tentatives. Réessayez dans une minute.",
      });
    }

    const code = req.body?.code;

    if (
      typeof code !== "string" ||
      !/^\d{8}$/.test(code) ||
      !verifyPassword(code, note.password)
    ) {
      return res.status(403).json({
        message: "Code incorrect.",
      });
    }

    const session = req.session || newSession(res);
    session.grants.add(note.id);

    res.json({ ok: true });
  });

  app.get("/api/shared-notes/:id/share", (req, res) => {
    const note = data.notes.find(
      (entry) => entry.id === req.params.id
    );

    if (!note || req.session?.userId !== note.ownerId) {
      return res.status(403).json({
        message: "Accès réservé au propriétaire.",
      });
    }

    res.json({
      code: decrypt(note.code),
    });
  });

  const server = createServer(app);

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 5 * 1024 * 1024,
  });

  server.on("upgrade", (req, socket, head) => {
    let url;

    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      socket.destroy();
      return;
    }

    const id = /^\/api\/live\/([a-f0-9-]+)$/.exec(
      url.pathname
    )?.[1];

    const note = data.notes.find(
      (entry) => entry.id === id
    );

    const session = getSession(req);

    if (
      !note ||
      !allowed(session, note) ||
      !originAutorisee(req)
    ) {
      socket.end(
        "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"
      );
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const current = room(note);

      ws.session = session;
      current.clients.add(ws);
      ws.send(Y.encodeStateAsUpdate(current.doc));

      function presence() {
        const message = JSON.stringify({
          type: "presence",
          count: current.clients.size,
        });

        for (const client of current.clients) {
          if (client.session.expires <= Date.now()) {
            client.close(1008, "Session expirée");
            continue;
          }

          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        }
      }

      presence();

      ws.on("message", (bytes, binary) => {
        if (!allowed(session, note)) {
          ws.close(1008, "Session expirée");
          return;
        }

        if (!binary) return;

        try {
          Y.applyUpdate(current.doc, bytes);

          note.state = Buffer.from(
            Y.encodeStateAsUpdate(current.doc)
          ).toString("base64");

          persist();

          for (const client of current.clients) {
            if (client.session.expires <= Date.now()) {
              client.close(1008, "Session expirée");
              continue;
            }

            if (
              client !== ws &&
              client.readyState === WebSocket.OPEN
            ) {
              client.send(bytes);
            }
          }

          ws.send(JSON.stringify({ type: "saved" }));
        } catch {
          ws.close(1011, "Sauvegarde impossible");
        }
      });

      ws.on("close", () => {
        current.clients.delete(ws);
        presence();
      });

      ws.on("error", () => {});
    });
  });

  return { app, server, wss };
}

export function generateCode() {
  return String(randomInt(0, 100000000)).padStart(8, "0");
}