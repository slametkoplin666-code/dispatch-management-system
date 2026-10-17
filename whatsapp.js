import {env} from "./config.js";
export async function sendWhatsAppText(to,body){
 if(!env.WHATSAPP_PHONE_NUMBER_ID||!env.WHATSAPP_ACCESS_TOKEN)
  return {skipped:true,reason:"WhatsApp API belum dikonfigurasi."};
 const url=`${env.WHATSAPP_API_BASE}/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
 const r=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,"Content-Type":"application/json"},
 body:JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{preview_url:false,body}})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(new Error("WhatsApp provider menolak permintaan."),{status:502});
 return {sent:true,messageId:data.messages?.[0]?.id||null};
}
