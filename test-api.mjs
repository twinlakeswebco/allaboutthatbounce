import assert from 'node:assert/strict';
const base=process.env.API_BASE_URL||'http://localhost:8787';
async function req(path,options={}){const r=await fetch(base+path,options);const b=await r.json();if(!r.ok)throw new Error(b.error);return b}
const units=await req('/api/units');assert.ok(Array.isArray(units));
const settings=await req('/api/settings');assert.equal(settings.free_radius_miles,15);assert.equal(settings.per_mile_rate,0.35);assert.equal(settings.trip_multiplier,4);
if(units[0]){const dates=await req(`/api/units/${encodeURIComponent(units[0].id)}/blocked-dates`);assert.ok(Array.isArray(dates));}
console.log('API contract checks passed against '+base+'.');