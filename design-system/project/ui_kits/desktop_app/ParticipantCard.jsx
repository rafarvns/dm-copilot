// ParticipantCard.jsx — combat participant row inside encounter columns
function StatControl({ label, value, color }) {
  return (
    <div className="stat-control">
      <span className="stat-control__label">{label}</span>
      <input className="stat-control__input"
             style={{ color }}
             defaultValue={value} />
    </div>
  );
}

function ParticipantCard({ p, onRollInitiative }) {
  return (
    <div className="participant-card participant-card--with-img">
      <div className="participant-card__image-container">
        {p.image
          ? <img className="participant-card__img" src={p.image} alt={p.name} />
          : <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%",fontSize:"2rem",color:"var(--color-text-muted)"}}>👤</div>}
      </div>
      <div className="participant-card__main">
        <div className="participant-card__header">
          <span className="participant-card__name">{p.name}</span>
        </div>
        <div className="participant-card__stats">
          <StatControl label="HP" value={p.hp} color="#f43f5e" />
          <StatControl label="AC" value={p.ac} color="#0ea5e9" />
          <StatControl label="INI" value={p.ini} color="#f59e0b" />
          <button className="btn btn--secondary btn--sm" onClick={onRollInitiative}>🎲 Iniciativa</button>
        </div>
      </div>
    </div>
  );
}

window.ParticipantCard = ParticipantCard;
