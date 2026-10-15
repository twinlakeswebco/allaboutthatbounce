export function decodePhoto(data) {
  if (typeof data !== "string" || !data.startsWith("data:image/"))
    throw new Error("Photos must be PNG, JPEG, or WebP images.");
  const i = data.indexOf(",");
  const bytes = Uint8Array.from(atob(data.slice(i + 1)), (c) => c.charCodeAt(0));
  if (bytes.length > 1048576) throw new Error("Each photo must be 1 MB or smaller.");
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  const type = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
  if (!type) throw new Error("Photos must be PNG, JPEG, or WebP images.");
  return { bytes, type };
}
export async function savePhotos(env, unitId, photos = []) {
  if (!Array.isArray(photos) || photos.length > 5)
    throw new Error("Use no more than 5 photos per inflatable.");
  const old = await env.DB.prepare(
    "SELECT id,r2_key,position FROM unit_photos WHERE unit_id=? ORDER BY position",
  )
    .bind(unitId)
    .all();
  const byUrl = new Map((old.results || []).map((x) => ["/media/" + x.r2_key, x]));
  const final = [],
    created = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (byUrl.has(p)) {
      final.push({ ...byUrl.get(p), position: i });
      continue;
    }
    const decoded = decodePhoto(p),
      key = crypto.randomUUID();
    await env.PHOTOS.put(key, decoded.bytes, { httpMetadata: { contentType: decoded.type } });
    const item = { id: crypto.randomUUID(), r2_key: key, position: i };
    created.push(item);
    final.push(item);
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM unit_photos WHERE unit_id=?").bind(unitId),
    ...final.map((x) =>
      env.DB.prepare("INSERT INTO unit_photos(id,unit_id,r2_key,position) VALUES(?,?,?,?)").bind(
        x.id,
        unitId,
        x.r2_key,
        x.position,
      ),
    ),
  ]);
  const kept = new Set(final.map((x) => x.r2_key));
  await Promise.all(
    (old.results || []).filter((x) => !kept.has(x.r2_key)).map((x) => env.PHOTOS.delete(x.r2_key)),
  );
  return final.sort((a, b) => a.position - b.position).map((x) => "/media/" + x.r2_key);
}
export async function media(env, key) {
  const o = await env.PHOTOS.get(key);
  if (!o) return new Response("Not found", { status: 404 });
  const h = new Headers();
  o.writeHttpMetadata(h);
  h.set("etag", o.httpEtag);
  h.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(o.body, { headers: h });
}
