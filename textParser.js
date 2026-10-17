const aliases={
 wo_number:["wo number","work order number","workorder number","wo"],
 customer_id:["customer id","id customer","customerid"],
 customer_name:["customer name","end user name","nama pelanggan"],
 customer_phone:["customer phone","customer contact","phone","no hp"],
 area:["area"],cluster_name:["cluster name","cluster"],street_name:["street name","alamat"],
 slot_time:["slot time","appointment time","jadwal"],contractor_name:["contractor name","contractor","contactor name","vendor name"],
 ticket_category:["ticket category","initial ticket category"]
};
const norm=s=>String(s).toLowerCase().replace(/[_:*#]/g," ").replace(/\s+/g," ").trim();
export function parseWO(text){
 if(typeof text!=="string"||!text.trim())return {valid:false,errors:["Tempel teks WO terlebih dahulu."],rows:[],mappedFields:[]};
 const rows=[], current={};
 for(const line of text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){
  const m=line.match(/^([^:=\t]+?)\s*(?::|=|\t)\s*(.*)$/);if(!m)continue;
  const label=norm(m[1]),value=m[2].trim();
  const key=Object.entries(aliases).find(([,a])=>a.some(x=>norm(x)===label))?.[0];
  if(!key)continue;
  if(key==="wo_number"&&current.wo_number){rows.push({...current});Object.keys(current).forEach(k=>delete current[k]);}
  if(value)current[key]=value;
 }
 if(Object.keys(current).length)rows.push({...current});
 const errors=[];
 if(!rows.length)errors.push("Tidak ada label dikenali. Contoh: WO Number: WO20260000001");
 rows.forEach((r,i)=>{if(!r.wo_number)errors.push(`Record ${i+1}: WO Number wajib diisi.`)});
 return {valid:errors.length===0,errors,rows,mappedFields:[...new Set(rows.flatMap(r=>Object.keys(r)))]};
}
