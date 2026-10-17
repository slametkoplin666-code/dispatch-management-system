import express from "express";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {z} from "zod";
import {env} from "./config.js";
import {db} from "./db.js";
import {authenticate,roles,audit} from "./auth.js";
import {parseWO} from "./textParser.js";
import {sendWhatsAppText} from "./whatsapp.js";

const app=express();
app.disable("x-powered-by");app.use(helmet());app.use(cors({origin:env.CLIENT_ORIGIN}));
app.use(express.json({limit:"1mb"}));
app.get("/api/health",(req,res)=>res.json({ok:true}));
app.post("/api/auth/login",(req,res)=>{
 const p=z.object({email:z.string().email(),password:z.string().min(1)}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:"Email dan password wajib valid."});
 const u=db.prepare("SELECT * FROM users WHERE email=? COLLATE NOCASE").get(p.data.email);
 if(!u||!u.active||!bcrypt.compareSync(p.data.password,u.password_hash))return res.status(401).json({error:"Email atau password salah."});
 const token=jwt.sign({sub:String(u.id)},env.JWT_SECRET,{expiresIn:env.JWT_EXPIRES_IN});
 const {password_hash,...user}=u;res.json({token,user});
});
app.get("/api/auth/me",authenticate,(req,res)=>res.json({user:req.user}));
app.get("/api/wo/summary",authenticate,(req,res)=>{
 let rows=db.prepare("SELECT * FROM work_orders ORDER BY created_at DESC").all();
 rows=scopeWO(req.user,rows);
 const counts={total:rows.length,new:0,assigned:0,in_progress:0,completed:0,failed:0};
 rows.forEach(w=>{const k=w.status.toLowerCase();if(k in counts)counts[k]++});res.json({counts});
});
app.get("/api/wo",authenticate,(req,res)=>{
 let rows=scopeWO(req.user,db.prepare("SELECT w.*,u.name installer_name FROM work_orders w LEFT JOIN users u ON u.id=w.installer_id ORDER BY w.created_at DESC").all());
 const q=String(req.query.q||"").toLowerCase(),st=String(req.query.status||"");
 if(q)rows=rows.filter(w=>[w.wo_number,w.customer_id,w.customer_name,w.area,w.cluster_name].some(v=>String(v||"").toLowerCase().includes(q)));
 if(st)rows=rows.filter(w=>w.status===st);res.json({workOrders:rows});
});
const woSchema=z.object({wo_number:z.string().trim().min(2),customer_id:z.string().optional().default(""),customer_name:z.string().optional().default(""),customer_phone:z.string().optional().default(""),area:z.string().optional().default(""),cluster_name:z.string().optional().default(""),street_name:z.string().optional().default(""),slot_time:z.string().optional().default(""),contractor_name:z.string().optional().default(""),ticket_category:z.string().optional().default("")});
app.post("/api/wo",authenticate,roles("SUPER_ADMIN","DISPATCH"),(req,res)=>{
 const p=woSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:"Data WO tidak valid."});
 try{const d=p.data;const r=db.prepare("INSERT INTO work_orders(wo_number,customer_id,customer_name,customer_phone,area,cluster_name,street_name,slot_time,contractor_name,ticket_category,created_by) VALUES(@wo_number,@customer_id,@customer_name,@customer_phone,@area,@cluster_name,@street_name,@slot_time,@contractor_name,@ticket_category,@created_by)").run({...d,created_by:req.user.id});audit(req.user,"CREATE","WO",r.lastInsertRowid,{wo_number:d.wo_number});res.status(201).json({id:r.lastInsertRowid});}
 catch(e){if(String(e.message).includes("UNIQUE"))return res.status(409).json({error:"WO Number sudah ada."});throw e;}
});
app.post("/api/wo/:id/assign",authenticate,roles("SUPER_ADMIN","DISPATCH","LEADER"),async(req,res,next)=>{
 try{
  const wo=db.prepare("SELECT * FROM work_orders WHERE id=?").get(req.params.id);if(!wo)return res.status(404).json({error:"WO tidak ditemukan."});
  if(req.user.role==="LEADER"&&wo.contractor_name!==req.user.contractor_name)return res.status(403).json({error:"WO bukan milik kontraktor Leader ini."});
  const installer=db.prepare("SELECT * FROM users WHERE id=? AND role='INSTALLER' AND active=1").get(Number(req.body.installer_id));
  if(!installer||installer.contractor_name!==wo.contractor_name)return res.status(400).json({error:"Installer tidak valid atau kontraktor berbeda."});
  db.prepare("UPDATE work_orders SET installer_id=?,status='ASSIGNED',updated_at=datetime('now') WHERE id=?").run(installer.id,wo.id);
  audit(req.user,"ASSIGN","WO",wo.id,{installer_id:installer.id});
  let notification={skipped:true,reason:"Nomor WhatsApp Installer belum diisi."};
  if(installer.phone)notification=await sendWhatsAppText(installer.phone,`Dispatch WO: ${wo.wo_number}\\nCustomer ID: ${wo.customer_id||"-"}\\nCustomer: ${wo.customer_name||"-"}\\nArea: ${wo.area||"-"}\\nCluster: ${wo.cluster_name||"-"}\\nSlot: ${wo.slot_time||"-"}`);
  res.json({ok:true,notification});
 }catch(e){next(e);}
});
app.post("/api/wo/:id/report",authenticate,roles("INSTALLER"),(req,res)=>{
 const wo=db.prepare("SELECT * FROM work_orders WHERE id=? AND installer_id=?").get(req.params.id,req.user.id);if(!wo)return res.status(404).json({error:"WO tidak ditugaskan kepada akun ini."});
 const p=z.object({status:z.enum(["IN_PROGRESS","COMPLETED","FAILED"]),notes:z.string().max(3000).optional().default("")}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:"Status/laporan tidak valid."});
 db.prepare("UPDATE work_orders SET status=?,report_notes=?,updated_at=datetime('now') WHERE id=?").run(p.data.status,p.data.notes,wo.id);
 audit(req.user,"REPORT","WO",wo.id,{status:p.data.status});res.json({ok:true});
});
app.get("/api/users",authenticate,roles("SUPER_ADMIN","DISPATCH","LEADER"),(req,res)=>{
 let users=db.prepare("SELECT id,name,email,role,contractor_name,phone,active FROM users ORDER BY id DESC").all();
 if(req.user.role==="LEADER")users=users.filter(u=>u.role==="INSTALLER"&&u.contractor_name===req.user.contractor_name);
 res.json({users});
});
app.post("/api/users",authenticate,(req,res)=>{
 if(!(req.user.role==="SUPER_ADMIN"||req.user.role==="LEADER"&&req.body.role==="INSTALLER"))return res.status(403).json({error:"Super Admin membuat Dispatch/Leader; Leader hanya membuat Installer."});
 const p=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(12),role:z.enum(["DISPATCH","LEADER","INSTALLER"]),contractor_name:z.string().optional().default(""),phone:z.string().optional().default("")}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:"Data akun tidak valid."});
 const d=p.data,contractor=req.user.role==="LEADER"?req.user.contractor_name:d.contractor_name;
 if(d.role==="LEADER"&&!contractor)return res.status(400).json({error:"Contractor Name wajib untuk Leader."});
 try{const r=db.prepare("INSERT INTO users(name,email,password_hash,role,contractor_name,phone) VALUES(?,?,?,?,?,?)").run(d.name,d.email,bcrypt.hashSync(d.password,12),d.role,contractor||null,d.phone||null);audit(req.user,"CREATE","USER",r.lastInsertRowid,{role:d.role});res.status(201).json({id:r.lastInsertRowid,name:d.name,email:d.email,role:d.role});}
 catch(e){if(String(e.message).includes("UNIQUE"))return res.status(409).json({error:"Email sudah terdaftar."});throw e;}
});
app.post("/api/text-to-table/preview",authenticate,roles("SUPER_ADMIN","DISPATCH","LEADER"),(req,res)=>{
 const parsed=parseWO(req.body?.text);const duplicates=parsed.rows.filter(r=>r.wo_number&&db.prepare("SELECT id FROM work_orders WHERE wo_number=?").get(r.wo_number)).map(r=>r.wo_number);
 res.json({...parsed,duplicates:[...new Set(duplicates)]});
});
app.post("/api/text-to-table/import",authenticate,roles("SUPER_ADMIN","DISPATCH"),(req,res)=>{
 const p=parseWO(req.body?.text);if(!p.valid)return res.status(400).json({error:"Validasi mapping gagal.",details:p.errors});
 const added=[],duplicates=[];
 const insert=db.prepare("INSERT INTO work_orders(wo_number,customer_id,customer_name,customer_phone,area,cluster_name,street_name,slot_time,contractor_name,ticket_category,created_by) VALUES(@wo_number,@customer_id,@customer_name,@customer_phone,@area,@cluster_name,@street_name,@slot_time,@contractor_name,@ticket_category,@created_by)");
 const tx=db.transaction(()=>p.rows.forEach(r=>{
  if(db.prepare("SELECT id FROM work_orders WHERE wo_number=?").get(r.wo_number)){duplicates.push(r.wo_number);return;}
  insert.run({wo_number:r.wo_number,customer_id:r.customer_id||"",customer_name:r.customer_name||"",customer_phone:r.customer_phone||"",area:r.area||"",cluster_name:r.cluster_name||"",street_name:r.street_name||"",slot_time:r.slot_time||"",contractor_name:r.contractor_name||"",ticket_category:r.ticket_category||"",created_by:req.user.id});added.push(r.wo_number);
 }));tx();res.status(201).json({added,duplicates,mappedFields:p.mappedFields});
});
app.post("/api/whatsapp/test",authenticate,roles("SUPER_ADMIN"),async(req,res,next)=>{
 try{const p=z.object({to:z.string().min(5),message:z.string().min(1).max(1000)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:"Recipient/message wajib."});res.json(await sendWhatsAppText(p.data.to,p.data.message));}catch(e){next(e);}
});
app.use((req,res)=>res.status(404).json({error:"Route not found"}));
app.use((err,req,res,next)=>{console.error(err);res.status(err.status||500).json({error:err.status?err.message:"Internal server error"});});
function scopeWO(user,rows){if(user.role==="LEADER")return rows.filter(w=>w.contractor_name===user.contractor_name);if(user.role==="INSTALLER")return rows.filter(w=>w.installer_id===user.id);return rows;}
app.listen(env.PORT,()=>console.log(`Dispatch API listening on ${env.PORT}`));
