import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
const schema = z.object({
 PORT:z.coerce.number().int().positive().default(4000),
 CLIENT_ORIGIN:z.string().url().default("http://localhost:5173"),
 JWT_SECRET:z.string().min(32),
 JWT_EXPIRES_IN:z.string().default("8h"),
 DB_PATH:z.string().default("./data/dispatch.sqlite"),
 BOOTSTRAP_ADMIN_EMAIL:z.string().email().optional().or(z.literal("")),
 BOOTSTRAP_ADMIN_PASSWORD:z.string().min(12).optional().or(z.literal("")),
 BOOTSTRAP_ADMIN_NAME:z.string().default("System Administrator"),
 WHATSAPP_API_BASE:z.string().url().default("https://graph.facebook.com"),
 WHATSAPP_API_VERSION:z.string().default("v22.0"),
 WHATSAPP_PHONE_NUMBER_ID:z.string().optional().default(""),
 WHATSAPP_ACCESS_TOKEN:z.string().optional().default("")
});
const parsed=schema.safeParse(process.env);
if(!parsed.success){console.error("Environment invalid:",parsed.error.flatten().fieldErrors);process.exit(1);}
export const env=parsed.data;
