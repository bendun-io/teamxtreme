import { pool } from './pool.js';

const SELECT_MEDIA = `
  SELECT m.id, m.uploaded_by, u.name AS uploaded_by_name, m.file_name, m.original_name,
         m.mime_type, m.file_size, m.created_at
  FROM media m
  JOIN users u ON u.id = m.uploaded_by
`;

export async function listMedia() {
  const { rows } = await pool.query(`${SELECT_MEDIA} ORDER BY m.created_at DESC`);
  return rows;
}

export async function findMediaById(id) {
  const { rows } = await pool.query(`${SELECT_MEDIA} WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

export async function createMedia(uploadedBy, { fileName, originalName, mimeType, fileSize }) {
  const { rows } = await pool.query(
    `INSERT INTO media (uploaded_by, file_name, original_name, mime_type, file_size)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [uploadedBy, fileName, originalName, mimeType, fileSize]
  );
  return findMediaById(rows[0].id);
}
