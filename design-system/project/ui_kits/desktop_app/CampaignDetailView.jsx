// CampaignDetailView.jsx — opened when a card is clicked.
function CampaignDetailView({ campaign, onBack, onOpenEncounter }) {
  return (
    <div className="campaign-detail" data-screen-label="Campanha · Detalhe">
      <div style={{display:"flex", alignItems:"center", gap:"var(--space-3)"}}>
        <button className="btn-icon" onClick={onBack} title="Voltar">⬅️</button>
        <span className="badge badge--primary">{campaign.system}</span>
      </div>
      <div className="campaign-detail__header">
        <h1 className="campaign-detail__name">{campaign.name}</h1>
      </div>
      <div className="campaign-detail__meta">
        <div className="campaign-detail__meta-item"><span className="campaign-detail__meta-icon">🧙</span> 4 personagens</div>
        <div className="campaign-detail__meta-item"><span className="campaign-detail__meta-icon">⚔️</span> 6 encontros</div>
        <div className="campaign-detail__meta-item"><span className="campaign-detail__meta-icon">🎭</span> 3 cenas</div>
        <div className="campaign-detail__meta-item"><span className="campaign-detail__meta-icon">📅</span> Atualizado {campaign.updatedAt}</div>
      </div>
      <p className="campaign-detail__desc">{campaign.description}</p>
      <div className="campaign-detail__actions">
        <button className="btn btn--primary"><span className="btn__icon">✏️</span> Editar Campanha</button>
        <button className="btn btn--secondary"><span className="btn__icon">➕</span> Adicionar Encontro</button>
      </div>

      <div className="campaign-detail__sections">
        <h3 style={{marginBottom:"var(--space-4)"}}>Encontros</h3>
        <div className="campaigns-grid">
          {[
            { name: "Emboscada na Floresta", difficulty: "Médio", loc: "Estrada leste" },
            { name: "Cripta dos Anões",      difficulty: "Difícil", loc: "Khundrak'tar, nível 3" },
            { name: "O Despertar",            difficulty: "Mortal", loc: "Câmara central" },
          ].map((e,i) => (
            <div className="campaign-card" key={i} onClick={onOpenEncounter}>
              <div className="campaign-card__header">
                <div className="campaign-card__title" style={{fontSize:"var(--text-base)"}}>⚔️ {e.name}</div>
                <span className={"badge " + (e.difficulty === "Mortal" ? "badge--gold" : "badge--gold")}
                      style={e.difficulty === "Mortal" ? {background:"rgba(244,63,94,0.15)", color:"#f43f5e"} : {}}>
                  {e.difficulty}
                </span>
              </div>
              <div className="campaign-card__desc">{e.loc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.CampaignDetailView = CampaignDetailView;
