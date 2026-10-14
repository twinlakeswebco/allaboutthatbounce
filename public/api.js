export const defaultSettings={free_radius_miles:15,per_mile_rate:0.35,trip_multiplier:4,max_delivery_miles:null};
async function request(path,options={}){const r=await fetch(path,{...options,headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});let data;try{data=await r.json()}catch{data=null}if(!r.ok)throw new Error(data?.error||'Something went wrong. Please try again.');return data;}
const post=(path,data,method='POST')=>request(path,{method,body:JSON.stringify(data)});
function protectedFields(input){const x={...input};x.turnstile_token=x.turnstile_token||x['cf-turnstile-response']||document.querySelector('[name="cf-turnstile-response"]')?.value||'';delete x['cf-turnstile-response'];x.website=x.website||document.querySelector('[name="website"]')?.value||'';return x;}
export async function listUnits(){return request('/api/units')}
export async function getSettings(){return request('/api/settings')}
export async function updateSettings(settings){return post('/api/admin/settings',settings,'PUT')}
export async function getBlockedDates(unitId){return request(`/api/units/${encodeURIComponent(unitId)}/blocked-dates`)}
export async function getDeliveryQuote(address){return post('/api/delivery-quote',{address})}
export async function createBookingRequest(input){return post('/api/booking-requests',protectedFields(input))}
export function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export async function listBookingRequests(){return request('/api/admin/booking-requests')}
export async function setBookingStatus(id,status){return post(`/api/admin/booking-requests/${encodeURIComponent(id)}/status`,{status})}
export async function saveUnit(unit){return post(unit.id?`/api/admin/units/${encodeURIComponent(unit.id)}`:'/api/admin/units',unit,unit.id?'PUT':'POST')}
export async function deleteUnit(id){return post(`/api/admin/units/${encodeURIComponent(id)}`,{},'DELETE')}
export async function blockDate(unitId,date){return post(`/api/admin/units/${encodeURIComponent(unitId)}/blocked-dates/${encodeURIComponent(date)}`,{},'PUT')}
export async function unblockDate(unitId,date){return post(`/api/admin/units/${encodeURIComponent(unitId)}/blocked-dates/${encodeURIComponent(date)}`,{},'DELETE')}
export async function sendContactMessage(input){return post('/api/contact',protectedFields(input))}