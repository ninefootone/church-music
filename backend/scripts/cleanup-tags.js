require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CHURCH_ID = 'b0c60082-789e-48c7-be6c-2237ea5a5c39';

const TAGS_TO_DELETE = [
  'Wisdom', 'Justification', 'Sustainer', 'Dwelling', 'Sorrow', 'Nature',
  'Offering', 'Desire', 'God\'s Creation', 'Gospel', 'Victor', 'Aspiration',
  'Death', 'God\'s Word', 'Healing', 'The Son', 'Devotion', 'Evangelism',
  'Processional', 'Overcome', 'Obedience', 'Messiah', 'Light', 'His Name',
  'Giving', 'Deliverance', 'Suffering', 'Unity', 'Birth', 'Confession',
  'Son Of God', 'Awesome', 'Longing', 'Immanuel', 'Shelter', 'Unchanging',
  'River', 'Calling', 'Treasure', 'Wonder', 'Ascension', 'Incarnation',
  'Loving kindness', 'Contentment', 'Compassion', 'Inheritance', 'Pardon',
  'Reverence', 'Vision', 'Kingdom Of God', 'Listen', 'Living Water',
  'Commission', 'Repentance', 'Service', 'Word', 'Rest', 'The Cross', 'Army',
  'Alive', 'The Christian Life', 'Revival', 'Jesus\' Return', 'Bride',
  'Cornerstone', 'Humility', 'Kindness', 'Perseverance', 'Nations',
  'Servanthood', 'Family', 'Beauty', 'Church', 'Conquering', 'Covenant',
  'Purpose', 'Purity', 'Provision', 'Expectation', 'Voice', 'Providence',
  'Jerusalem', 'Justice', 'Will', 'Heart', 'Intercession', 'Judgment',
  'Lord', 'Jesus\' Ministry', 'Meditation', 'God', 'Waiting'
];

const MERGES = [
  { from: 'Everlasting Life', to: 'Eternal Life' },
];

const cleanup = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- MERGES ---
    for (const { from, to } of MERGES) {
      const { rows: fromRows } = await client.query(
        `SELECT id FROM tags WHERE name = $1 AND church_id = $2`,
        [from, CHURCH_ID]
      );
      const { rows: toRows } = await client.query(
        `SELECT id FROM tags WHERE name = $1 AND church_id = $2`,
        [to, CHURCH_ID]
      );

      if (!fromRows.length) {
        console.log(`MERGE: source tag "${from}" not found, skipping`);
        continue;
      }
      if (!toRows.length) {
        console.log(`MERGE: target tag "${to}" not found, skipping`);
        continue;
      }

      const fromId = fromRows[0].id;
      const toId = toRows[0].id;

      // Reassign song_tags rows, ignoring any that would create duplicates
      const { rowCount: reassigned } = await client.query(`
        UPDATE song_tags
        SET tag_id = $1
        WHERE tag_id = $2
          AND song_id NOT IN (
            SELECT song_id FROM song_tags WHERE tag_id = $1
          )
      `, [toId, fromId]);

      // Delete any remaining rows for the old tag (duplicates)
      await client.query(`DELETE FROM song_tags WHERE tag_id = $1`, [fromId]);

      // Delete the old tag
      await client.query(`DELETE FROM tags WHERE id = $1`, [fromId]);

      console.log(`MERGE: "${from}" → "${to}" (${reassigned} songs reassigned)`);
    }

    // --- DELETIONS ---
    let totalDeleted = 0;
    for (const name of TAGS_TO_DELETE) {
      const { rows } = await client.query(
        `SELECT id FROM tags WHERE name = $1 AND church_id = $2`,
        [name, CHURCH_ID]
      );
      if (!rows.length) {
        console.log(`DELETE: "${name}" not found, skipping`);
        continue;
      }
      const tagId = rows[0].id;
      await client.query(`DELETE FROM song_tags WHERE tag_id = $1`, [tagId]);
      await client.query(`DELETE FROM tags WHERE id = $1`, [tagId]);
      totalDeleted++;
      console.log(`DELETE: "${name}" removed`);
    }

    await client.query('COMMIT');
    console.log(`\nDone. ${totalDeleted} tags deleted, ${MERGES.length} merges completed.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error — rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

cleanup();