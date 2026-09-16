// Optional isolated PostgreSQL/WASM migration smoke test; no network database connection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    const root = path.resolve(__dirname, '../prisma/migrations');
    for (const name of fs.readdirSync(root).filter((name) => /^\d/.test(name)).sort()) {
      await db.exec(fs.readFileSync(path.join(root, name, 'migration.sql'), 'utf8'));
      console.log('Applied:', name);
    }
    const cols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'HazardReport'");
    assert.equal(cols.rows.length, 17);
    await db.exec(`INSERT INTO "User" ("id","nickname") VALUES ('user','테스트');
      INSERT INTO "Course" ("id","slug","name","description","distanceM","difficulty","themes","startLat","startLng","polyline","estMinutes") VALUES ('course','test-course','테스트 코스','검증용',2000,'초급',ARRAY['수변'],35.83,128.61,'[[35.83,128.61],[35.84,128.61]]',20);`);
    const insert = `INSERT INTO "HazardReport" ("id","requestId","courseId","authorId","category","description","lat","lng","locationSource","photo","updatedAt") VALUES ($1,$2,'course','user','SURFACE','테스트 파손 위치',$3,128.61,'GPS',$4,CURRENT_TIMESTAMP)`;
    await db.query(insert, ['one', 'request-one', 35.83, new Uint8Array([255, 216, 255])]);
    await assert.rejects(db.query(insert, ['two', 'request-one', 35.83, new Uint8Array([1])]), /unique/i);
    await assert.rejects(db.query(insert, ['three', 'request-three', 99, new Uint8Array([1])]), /check/i);
    const rows = await db.query('SELECT "status", "version", "photo" FROM "HazardReport"');
    assert.equal(rows.rows[0].status, 'RECEIVED'); assert.equal(rows.rows[0].version, 1); assert.equal(rows.rows[0].photo.length, 3);
    await assert.rejects(db.exec(`DELETE FROM "Course" WHERE "id"='course'`), /foreign key/i);
    await assert.rejects(db.exec(`DELETE FROM "User" WHERE "id"='user'`), /foreign key/i);
    console.log('PASS: all migrations, binary photo persistence, defaults, unique request, coordinate and foreign-key constraints');
  } finally { await db.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
