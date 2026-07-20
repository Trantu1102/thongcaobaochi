use rusqlite::Connection;
use serde::Serialize;

#[derive(Serialize)]
pub struct Document {
    pub id: i64,
    pub engine: String,
    pub title: String,
    pub brief: String,
    pub content: String,
    pub model: String,
    pub created_at: String,
}

pub fn init(path: &std::path::Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            engine TEXT NOT NULL,
            title TEXT NOT NULL,
            brief TEXT NOT NULL,
            content TEXT NOT NULL,
            model TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );",
    )?;
    Ok(conn)
}

pub fn insert_document(
    conn: &Connection,
    engine: &str,
    title: &str,
    brief: &str,
    content: &str,
    model: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO documents (engine, title, brief, content, model) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![engine, title, brief, content, model],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

pub fn list_documents(conn: &Connection) -> Result<Vec<Document>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, engine, title, brief, content, model, created_at
             FROM documents ORDER BY id DESC LIMIT 200",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Document {
                id: row.get(0)?,
                engine: row.get(1)?,
                title: row.get(2)?,
                brief: row.get(3)?,
                content: row.get(4)?,
                model: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn delete_document(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM documents WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
