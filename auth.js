import jwt from "jsonwebtoken";
import {env} from "./config.js";
import {db} from "./db.js";
export function authenticate(req,res,next){
 const token=(req.headers.authorization||"").replace(/^Bearer\s+/,"");
 if(!token)return res.status(401).json({error:"Authentication required"});
 try{
  const p=jwt.verify(token,env.JWT_SECRET);
  const user=db.prepare("SELECT id,name,email,role,contractor_name,phone,active FROM users WHERE id=?").get(p.sub);
  if(!user||!user.active)return res.status(401).json({error:"Account unavailable"});
  req.user=user;next();
 }catch{return res.status(401).json({error:"Invalid or expired token"});}
}
export const roles=(...allowed)=>(req,res,next)=>allowed.includes(req.user?.role)?next():res.status(403).json({error:"Insufficient permissions"});
export function audit(user,action,type,id,details={}){
 db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)")
 .run(user?.id||null,action,type,String(id??""),JSON.stringify(details));
}
