// One-time Google sign-in for the Drive copy. Run from the project folder:
//   node scripts/drive-signin.mjs
// Opens Google's "Allow access" page, then saves GOOGLE_REFRESH_TOKEN into .env.local (never printed).
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";

process.loadEnvFile(".env.local");
const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.log("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be in .env.local first.");
  process.exit(1);
}

const state = crypto.randomBytes(16).toString("hex");
const verifier = crypto.randomBytes(32).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname !== "/") return res.writeHead(404).end();
  const done = (msg) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<p style="font:18px system-ui;padding:40px">${msg}</p>`);
    console.log(msg);
    server.close();
  };
  if (url.searchParams.get("state") !== state) return done("Sign-in didn't match. Run the command again.");
  if (url.searchParams.get("error")) return done(`Google said: ${url.searchParams.get("error")}. Nothing was saved.`);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      code: url.searchParams.get("code") ?? "",
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirect,
    }),
  });
  const body = await tokenRes.json();
  if (!body.refresh_token) return done(`Google didn't give access (${body.error ?? "no refresh token"}). Nothing was saved.`);
  const env = fs.readFileSync(".env.local", "utf8");
  const line = `GOOGLE_REFRESH_TOKEN=${body.refresh_token}`;
  fs.writeFileSync(".env.local", /^GOOGLE_REFRESH_TOKEN=.*$/m.test(env) ? env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line) : `${env.replace(/\n*$/, "\n")}${line}\n`);
  done("Google Drive is connected. You can close this tab.");
});

let redirect;
server.listen(0, "127.0.0.1", () => {
  redirect = `http://127.0.0.1:${server.address().port}`;
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.search = new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  console.log("Opening Google in your browser. Approve access there…");
  execFile("open", [auth.toString()]);
});
