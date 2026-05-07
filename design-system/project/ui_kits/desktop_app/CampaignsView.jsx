// CampaignsView.jsx — landing surface: header, search/filter toolbar, grid.
const { useState: useStateCV, useMemo } = React;

const SAMPLE_CAMPAIGNS = [
  { id: 1, name: "A Mina do Rei Anão",  system: "D&D 5e",   updatedAt: "há 3 dias", description: "Os heróis descem nas profundezas de Khundrak'tar para recuperar o martelo perdido do clã Pedra-Forte. Goblins, lava e segredos esperam."},
  { id: 2, name: "Tormenta na Costa",   system: "Tormenta", updatedAt: "hoje",       description: "Piratas, deuses esquecidos e uma tempestade que não passa. A tripulação do Albatroz precisa decidir entre o ouro e a alma."},
  { id: 3, name: "O Concílio das Sombras", system: "Vampiro", updatedAt: "há 1 semana", description: "São Paulo dos anos 80. Cinco neófitos, um Príncipe paranoico, e uma profecia que se recusa a ficar escondida."},
  { id: 4, name: "Caçadores de Pathfinder", system: "Pathfinder", updatedAt: "há 2 dias", description: "Uma vila à beira do colapso contrata o grupo para investigar desaparecimentos na floresta de Cinzaverde."},
  { id: 5, name: "Linhagens do Sangue", system: "GURPS",    updatedAt: "há 1 mês",   description: "Campanha urbano-fantástica com regras táticas pesadas. Pausada — retomar quando o grupo voltar."},
  { id: 6, name: "Crônicas da Fronteira", system: "D&D 5e", updatedAt: "ontem",      description: "Uma fortaleza no limite do Reino. O grupo é a guarda — e os primeiros a saber que algo se move no norte."},
];

function CampaignsView({ onOpen }) {
  const [query, setQuery]   = useStateCV("");
  const [system, setSystem] = useStateCV("");
  const filtered = useMemo(() => SAMPLE_CAMPAIGNS.filter(c =>
    (!query || c.name.toLowerCase().includes(query.toLowerCase()) || c.description.toLowerCase().includes(query.toLowerCase())) &&
    (!system || c.system === system)
  ), [query, system]);

  return (
    <div className="campaigns-view view" data-screen-label="Campanhas">
      <div className="campaigns-header">
        <div className="campaigns-header__title">
          <span className="campaigns-header__icon">🏰</span>
          <h1 className="campaigns-header__text">Campanhas</h1>
          <span className="badge badge--muted" style={{marginLeft:"var(--space-3)"}}>{filtered.length}</span>
        </div>
        <button className="btn btn--primary btn--lg">
          <span className="btn__icon">➕</span> Nova Campanha
        </button>
      </div>

      <div className="campaigns-toolbar">
        <div className="campaigns-search">
          <span className="campaigns-search__icon">🔍</span>
          <input className="campaigns-search__input"
                 placeholder="Buscar por nome ou descrição…"
                 value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select className="campaigns-filter" value={system} onChange={e => setSystem(e.target.value)}>
          <option value="">Todos os sistemas</option>
          <option>D&D 5e</option>
          <option>Pathfinder</option>
          <option>Tormenta</option>
          <option>GURPS</option>
          <option>Vampiro</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🏰</div>
          <h3 className="empty-state__title">Nenhuma campanha encontrada</h3>
          <p className="empty-state__text">Comece criando sua primeira aventura. Você pode adicionar personagens e encontros depois.</p>
          <button className="btn btn--primary"><span className="btn__icon">➕</span> Criar Campanha</button>
        </div>
      ) : (
        <div className="campaigns-grid">
          {filtered.map(c => <CampaignCard key={c.id} campaign={c} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

window.CampaignsView = CampaignsView;
