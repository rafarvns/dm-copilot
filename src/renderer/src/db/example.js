// Exemplo de uso do Database Service
// Este arquivo demonstra como usar o banco de dados no seu app

import databaseService from "./db/database.js";

// ============================================
// Exemplo 1: Inicializar e verificar status
// ============================================
async function exampleInit() {
  try {
    const ready = await databaseService.init();
    if (ready) {
      console.log("Database is ready!");
    }
  } catch (error) {
    console.error("Failed to initialize:", error);
  }
}

// ============================================
// Exemplo 2: Criar uma campanha
// ============================================
async function exampleCreateCampaign() {
  try {
    const campaign = await databaseService.createCampaign({
      name: "A Lenda de Zelda",
      description: "Uma campanha épica em Hyrule",
      system: "D&D 5e"
    });
    
    console.log("Campaign created:", campaign);
    return campaign.id;
  } catch (error) {
    console.error("Failed to create campaign:", error);
  }
}

// ============================================
// Exemplo 3: Listar todas as campanhas
// ============================================
async function exampleGetCampaigns() {
  try {
    const campaigns = await databaseService.getAllCampaigns();
    console.log("All campaigns:", campaigns);
    return campaigns;
  } catch (error) {
    console.error("Failed to get campaigns:", error);
  }
}

// ============================================
// Exemplo 4: Criar personagem
// ============================================
async function exampleCreateCharacter(campaignId) {
  try {
    const character = await databaseService.createCharacter({
      campaign_id: campaignId,
      name: "Link",
      class: "Paladino",
      level: 5,
      race: "Humano",
      hp: 45,
      max_hp: 45,
      attributes: {
        strength: 16,
        dexterity: 14,
        constitution: 14,
        intelligence: 12,
        wisdom: 10,
        charisma: 13
      }
    });
    
    console.log("Character created:", character);
  } catch (error) {
    console.error("Failed to create character:", error);
  }
}

// ============================================
// Exemplo 5: Criar encontro
// ============================================
async function exampleCreateEncounter(campaignId) {
  try {
    const encounter = await databaseService.createEncounter({
      campaign_id: campaignId,
      name: "Batalha contra Ganondorf",
      description: "O confronto final no castelo de Ganon",
      difficulty: "hard",
      monsters: [
        { name: "Ganondorf", hp: 200, ac: 18 },
        { name: "Gerudo Warrior", hp: 60, ac: 15 }
      ]
    });
    
    console.log("Encounter created:", encounter);
  } catch (error) {
    console.error("Failed to create encounter:", error);
  }
}

// ============================================
// Exemplo 6: Criar nota
// ============================================
async function exampleCreateNote(campaignId) {
  try {
    const note = await databaseService.createNote({
      campaign_id: campaignId,
      title: "Quest Secundária",
      content: "Encontrar a espada Master Sword no Bosque da Perdição"
    });
    
    console.log("Note created:", note);
  } catch (error) {
    console.error("Failed to create note:", error);
  }
}

// ============================================
// Exemplo 7: Backup do banco de dados
// ============================================
async function exampleBackup() {
  try {
    const backupPath = await databaseService.backup();
    console.log("Backup created:", backupPath);
  } catch (error) {
    console.error("Failed to create backup:", error);
  }
}

// ============================================
// Exemplo 8: Transação (múltiplas operações)
// ============================================
async function exampleTransaction() {
  try {
    // Criar campanha
    const campaign = await databaseService.createCampaign({
      name: "Transação de Teste",
      description: "Testando transações",
      system: "Pathfinder"
    });

    // Criar personagem
    await databaseService.createCharacter({
      campaign_id: campaign.id,
      name: "Personagem 1",
      class: "Mago",
      level: 1
    });

    // Criar personagem 2
    await databaseService.createCharacter({
      campaign_id: campaign.id,
      name: "Personagem 2",
      class: "Guerreiro",
      level: 1
    });

    console.log("Transaction completed successfully");
  } catch (error) {
    console.error("Transaction failed:", error);
  }
}

// ============================================
// Exemplo 9: Atualizar dados
// ============================================
async function exampleUpdateCampaign(campaignId) {
  try {
    const updated = await databaseService.updateCampaign(campaignId, {
      name: "A Lenda de Zelda - Edição Atualizada",
      description: "Uma campanha épica em Hyrule (Atualizada)",
      system: "D&D 5e"
    });
    
    console.log("Campaign updated:", updated);
  } catch (error) {
    console.error("Failed to update campaign:", error);
  }
}

// ============================================
// Exemplo 10: Deletar dados
// ============================================
async function exampleDeleteCampaign(campaignId) {
  try {
    const deleted = await databaseService.deleteCampaign(campaignId);
    console.log("Campaign deleted:", deleted);
  } catch (error) {
    console.error("Failed to delete campaign:", error);
  }
}

// ============================================
// Função principal para testar todos os exemplos
// ============================================
async function runAllExamples() {
  console.log("=== Running Database Examples ===\n");
  
  // 1. Inicializar
  await exampleInit();
  
  // 2. Criar campanha
  const campaignId = await exampleCreateCampaign();
  
  // 3. Listar campanhas
  await exampleGetCampaigns();
  
  // 4. Criar personagem
  if (campaignId) {
    await exampleCreateCharacter(campaignId);
  }
  
  // 5. Criar encontro
  if (campaignId) {
    await exampleCreateEncounter(campaignId);
  }
  
  // 6. Criar nota
  if (campaignId) {
    await exampleCreateNote(campaignId);
  }
  
  // 7. Backup
  await exampleBackup();
  
  // 8. Atualizar
  if (campaignId) {
    await exampleUpdateCampaign(campaignId);
  }
  
  // 9. Deletar
  if (campaignId) {
    await exampleDeleteCampaign(campaignId);
  }
  
  console.log("\n=== All Examples Completed ===");
}

// Exportar funções para uso externo
export {
  exampleInit,
  exampleCreateCampaign,
  exampleGetCampaigns,
  exampleCreateCharacter,
  exampleCreateEncounter,
  exampleCreateNote,
  exampleBackup,
  exampleTransaction,
  exampleUpdateCampaign,
  exampleDeleteCampaign,
  runAllExamples
};
