// CharactersView.jsx — grid of character avatars + stats.
const SAMPLE_CHARACTERS = [
  { id:1, name:"Grog, o Bárbaro",   system:"D&D 5e", desc:"Bárbaro humano, 1.95 m, dois machados, zero paciência.", hp:58, ac:16, ini:12 },
  { id:2, name:"Lyanna Vento-Claro", system:"D&D 5e", desc:"Druida élfica das florestas. Conversa com lobos e desconfia de clérigos.", hp:32, ac:14, ini:18 },
  { id:3, name:"Mestre Korin",       system:"D&D 5e", desc:"Mago humano idoso, especialista em runas. Carrega segredos do Concílio.", hp:24, ac:12, ini:9 },
  { id:4, name:"Sira Tormentosa",    system:"Tormenta", desc:"Paladina de Lena com martelo encantado. Acredita em redenção, não em piedade.", hp:46, ac:18, ini:7 },
];

function CharactersView() {
  return (
    <div className="characters-view view" data-screen-label="Personagens">
      <div className="campaigns-header">
        <div className="campaigns-header__title">
          <span className="campaigns-header__icon">🧙</span>
          <h1 className="campaigns-header__text">Personagens</h1>
          <span className="badge badge--muted" style={{marginLeft:"var(--space-3)"}}>{SAMPLE_CHARACTERS.length}</span>
        </div>
        <button className="btn btn--primary btn--lg">
          <span className="btn__icon">➕</span> Novo Personagem
        </button>
      </div>

      <div className="characters-grid">
        {SAMPLE_CHARACTERS.map(c => (
          <div className="character-card" key={c.id}>
            <div className="character-card__header">
              <div className="character-card__avatar">
                <span className="character-card__avatar-placeholder">👤</span>
              </div>
              <div className="character-card__title-group">
                <div className="character-card__title">{c.name}</div>
                <span className="badge badge--primary" style={{alignSelf:"flex-start", marginTop:4}}>{c.system}</span>
              </div>
            </div>
            <div className="character-card__desc">{c.desc}</div>
            <div className="character-card__stats">
              <div className="stat-box"><span className="stat-box__label">HP</span><span className="stat-box__value stat-box__value--hp">{c.hp}</span></div>
              <div className="stat-box"><span className="stat-box__label">AC</span><span className="stat-box__value stat-box__value--ac">{c.ac}</span></div>
              <div className="stat-box"><span className="stat-box__label">INI</span><span className="stat-box__value stat-box__value--ini">{c.ini}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.CharactersView = CharactersView;
