// CampaignCard.jsx — single tile in the campaigns grid
function CampaignBadge({ system }) {
  return <span className="badge badge--primary">{system}</span>;
}

function CampaignCard({ campaign, onOpen }) {
  return (
    <div className="campaign-card" onClick={() => onOpen?.(campaign)}>
      <div className="campaign-card__header">
        <div className="campaign-card__title">{campaign.name}</div>
        <CampaignBadge system={campaign.system} />
      </div>
      <div className="campaign-card__desc">{campaign.description}</div>
      <div className="campaign-card__footer">
        <span className="campaign-card__date">Atualizado {campaign.updatedAt}</span>
        <div className="campaign-card__actions">
          <button className="campaign-card__btn" title="Editar" onClick={e => e.stopPropagation()}>✏️</button>
          <button className="campaign-card__btn campaign-card__btn--delete" title="Excluir" onClick={e => e.stopPropagation()}>🗑️</button>
        </div>
      </div>
    </div>
  );
}

window.CampaignCard = CampaignCard;
