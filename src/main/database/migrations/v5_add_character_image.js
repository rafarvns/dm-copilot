// Migration v5: Add image_path to characters
module.exports = {
  version: 5,
  up: (db) => {
    // Adicionar coluna image_path à tabela characters
    try {
      db.exec(`ALTER TABLE characters ADD COLUMN image_path TEXT;`);
      console.log('Migration v5 (add image_path) applied successfully');
    } catch (error) {
      // Ignorar se a coluna já existir (prevenção de erros em restarts)
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
    }
  }
};
