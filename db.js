import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import {env} from "./config.js";
fs.mkdirSync(path.dirname(path.resolve(env.DB_PATH)),{recursive:true});
export const db=new Database(path.resolve(env.DB_PATH));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('SUPER_ADMIN','DISPATCH','LEADER','INSTALLER')),
 contractor_name TEXT,phone TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS work_orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT,wo_number TEXT NOT NULL UNIQUE,customer_id TEXT,customer_name TEXT,
 customer_phone TEXT,area TEXT,cluster_name TEXT,street_name TEXT,slot_time TEXT,contractor_name TEXT,
 installer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN('NEW','ASSIGNED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED')),
 ticket_category TEXT,report_notes TEXT,created_by INTEGER REFERENCES users(id),created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS audit_logs(
 id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id INTEGER,action TEXT NOT NULL,entity_type TEXT NOT NULL,
 entity_id TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')));
`);
if(env.BOOTSTRAP_ADMIN_EMAIL && env.BOOTSTRAP_ADMIN_PASSWORD &&
 !db.prepare("SELECT id FROM users WHERE email=?").get(env.BOOTSTRAP_ADMIN_EMAIL)){
 db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'SUPER_ADMIN')")
 .run(env.BOOTSTRAP_ADMIN_NAME,env.BOOTSTRAP_ADMIN_EMAIL,bcrypt.hashSync(env.BOOTSTRAP_ADMIN_PASSWORD,12));
 console.log("Bootstrap Super Admin created from environment.");
}
