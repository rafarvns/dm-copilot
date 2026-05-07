// EncounterView.jsx — overlay: dice toolbar + three combat columns.
const { useState: useStateEV } = React;

const SAMPLE_PARTICIPANTS = {
  ally: [
    { id: 1, name: "Grog, o Bárbaro",     hp: 58, ac: 16, ini: 12, image: null },
    { id: 2, name: "Lyanna Vento-Claro",  hp: 32, ac: 14, ini: 18, image: null },
    { id: 3, name: "Mestre Korin",        hp: 24, ac: 12, ini: 9,  image: null },
  ],
  neutral: [
    { id: 4, name: "Comerciante Élfico", hp: 12, ac: 11, ini: 6, image: null },
  ],
  enemy: [
    { id: 5, name: "Orc Comum",          hp: 15, ac: 13, ini: 8,  image: null },
    { id: 6, name: "Orc Comum",          hp: 15, ac: 13, ini: 8,  image: null },
    { id: 7, name: "Chefe Goblin",       hp: 21, ac: 15, ini: 14, image: null },
  ],
};

function EncounterView({ onClose }) {
  const [round, setRound]   = useStateEV(3);
  const [running, setRunning] = useStateEV(true);
  const [diceMode, setDiceMode] = useStateEV("master");
  const [lastRoll, setLastRoll] = useStateEV({ value: 17, detail: "1d20 + 5" });

  return (
    <div className="overlay-view" data-screen-label="Encontro · Combate">
      <div className="overlay-view__header">
        <div className="overlay-view__title-group">
          <button className="btn-icon" onClick={onClose} title="Voltar">⬅️</button>
          {lastRoll && (
            <div className="last-roll-display">
              <span className="last-roll-display__label">Último Resultado:</span>
              <span className="last-roll-display__value">{lastRoll.value}</span>
              <span className="last-roll-display__details">({lastRoll.detail})</span>
            </div>
          )}
          <div>
            <h2 style={{margin:0}}>Emboscada na Floresta</h2>
            <div className="overlay-view__meta">
              <span className="badge badge--gold">Médio</span>
              <span className="text-secondary text-xs">Clareira próxima à estrada leste</span>
            </div>
          </div>
        </div>
        <div className="overlay-view__actions">
          <DiceToolbar mode={diceMode} onModeChange={setDiceMode}
                       onRoll={r => setLastRoll({ value: 17, detail: r.notation })} />
        </div>
      </div>

      <div className="encounter-manager">
        <div className="combat-controls">
          <div className="combat-controls__status">
            {!running ? (
              <button className="btn btn--primary" onClick={() => setRunning(true)}>
                <span className="btn__icon">⚔️</span> Iniciar Encontro
              </button>
            ) : (
              <button className="btn btn--danger" onClick={() => setRunning(false)}>
                <span className="btn__icon">🏳️</span> Finalizar Encontro
              </button>
            )}
            <button className="btn btn--secondary btn--sm"><span className="btn__icon">➕</span> Add</button>
            <button className="btn btn--secondary btn--sm"><span className="btn__icon">✏️</span> Editar</button>
          </div>
          {running && (
            <div className="combat-controls__round">
              Rodada <span style={{color:"var(--color-primary-light)", fontWeight:700}}>{round}</span>
            </div>
          )}
        </div>

        {running && (
          <div className="combat-arena">
            <div className="combat-arena__actions">
              <button className="btn btn--secondary" onClick={() => setRound(Math.max(1, round-1))}>
                <span className="btn__icon">⬅️</span> Turno Anterior
              </button>
              <button className="btn btn--primary btn--lg" onClick={() => setRound(round+1)}>
                Próximo Turno <span className="btn__icon">➡️</span>
              </button>
            </div>
          </div>
        )}

        <div className="encounter-columns">
          <div className="encounter-section encounter-section--allies">
            <div className="encounter-section__header">
              <h3 className="encounter-section__title">Aliados</h3>
            </div>
            <div className="encounter-section__list">
              {SAMPLE_PARTICIPANTS.ally.map(p => <ParticipantCard key={p.id} p={p} />)}
            </div>
          </div>
          <div className="encounter-section encounter-section--neutrals">
            <div className="encounter-section__header">
              <h3 className="encounter-section__title">Neutros</h3>
            </div>
            <div className="encounter-section__list">
              {SAMPLE_PARTICIPANTS.neutral.map(p => <ParticipantCard key={p.id} p={p} />)}
            </div>
          </div>
          <div className="encounter-section encounter-section--enemies">
            <div className="encounter-section__header">
              <h3 className="encounter-section__title">Inimigos</h3>
            </div>
            <div className="encounter-section__list">
              {SAMPLE_PARTICIPANTS.enemy.map(p => <ParticipantCard key={p.id} p={p} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.EncounterView = EncounterView;
