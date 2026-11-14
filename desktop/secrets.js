"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ALLOWED_MODELS, DEFAULT_MODEL, DEFAULT_PROVIDER } = require("./logic");

// API keys are encrypted at rest.
// When Electron can use the OS key store (Windows Data Protection, macOS Keychain,
// Linux secret service), each key is wrapped with that. Otherwise a random 256-bit
// key is stored in secret.key next to the ciphertext (mode 0600). The app never
// writes the raw key into the library or into logs.

function createSecrets(file, keyFile, codec) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let state = {
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    keys: {},
  };
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      state = {
        provider: parsed.provider || DEFAULT_PROVIDER,
        model: parsed.model || DEFAULT_MODEL,
        keys: parsed.keys && typeof parsed.keys === "object" ? parsed.keys : {},
      };
    } catch (exc) {
      console.error(`Settings file could not be read. Starting without saved keys. ${exc.message}`);
    }
  }

  function aesKey() {
    if (fs.existsSync(keyFile)) {
      const buf = fs.readFileSync(keyFile);
      if (buf.length === 32) return buf;
    }
    const buf = crypto.randomBytes(32);
    fs.writeFileSync(keyFile, buf, { mode: 0o600 });
    try { fs.chmodSync(keyFile, 0o600); } catch { /* Windows ignores this */ }
    return buf;
  }

  function encrypt(plain) {
    if (codec && typeof codec.encrypt === "function") {
      const wrapped = codec.encrypt(plain);
      if (wrapped && wrapped.encoding && wrapped.payload) return wrapped;
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", aesKey(), iv);
    const payload = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    return {
      encoding: "aes",
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      payload: payload.toString("base64"),
    };
  }

  function decrypt(blob) {
    if (!blob) return "";
    if (blob.encoding === "safe") {
      if (!codec || typeof codec.decrypt !== "function") {
        throw new Error("This key was protected by the operating system, which is not available right now.");
      }
      const value = codec.decrypt(blob);
      if (typeof value !== "string") throw new Error("The operating system could not unlock a saved API key.");
      return value;
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(blob.iv, "base64"));
    decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(blob.payload, "base64")), decipher.final()]);
    return plain.toString("utf8");
  }

  function save() {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ provider: state.provider, model: state.model, keys: state.keys }), { mode: 0o600 });
    fs.renameSync(tmp, file);
    try { fs.chmodSync(file, 0o600); } catch { /* Windows ignores this */ }
  }

  function keyStorage() {
    if (codec && typeof codec.available === "function" && codec.available()) return "os";
    return "file";
  }

  function publicView(dataDir) {
    const keys = {};
    for (const id of Object.keys(ALLOWED_MODELS)) keys[id] = !!state.keys[id];
    return {
      provider: state.provider,
      model: state.model,
      keys,
      key_storage: keyStorage(),
      data_dir: dataDir,
    };
  }

  function getKey(provider) {
    const blob = state.keys[provider];
    if (!blob) return "";
    try {
      return decrypt(blob);
    } catch (exc) {
      console.error(`Could not unlock the ${provider} key. ${exc.message}`);
      return "";
    }
  }

  function setSelection(provider, model) {
    if (!ALLOWED_MODELS[provider]) {
      const err = new Error("Pick a supported provider and model in Settings.");
      err.statusCode = 400;
      throw err;
    }
    if (!ALLOWED_MODELS[provider].includes(model)) {
      const err = new Error("Pick a supported provider and model in Settings.");
      err.statusCode = 400;
      throw err;
    }
    state.provider = provider;
    state.model = model;
    save();
  }

  function setKey(provider, key) {
    state.keys[provider] = encrypt(String(key).trim());
    save();
  }

  function clearKey(provider) {
    delete state.keys[provider];
    save();
  }

  return { publicView, getKey, setSelection, setKey, clearKey, keyStorage };
}

module.exports = { createSecrets };
