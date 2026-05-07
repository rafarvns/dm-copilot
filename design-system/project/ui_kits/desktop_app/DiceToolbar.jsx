// DiceToolbar.jsx — translucent pill at the top of the encounter view
const { useState: useStateDT } = React;

const DICE = ["d4", "d6", "d8", "d10", "d12", "d20"];

function DiceToolbar({ onRoll, mode, onModeChange }) {
  const [counts, setCounts] = useStateDT({ d4:0, d6:0, d8:0, d10:0, d12:0, d20:0 });
  const [bonus, setBonus] = useStateDT(0);

  const bump = (d) => setCounts(c => ({ ...c, [d]: (c[d] || 0) + 1 }));
  const total = Object.values(counts).reduce((a,b)=>a+b,0);

  const roll = () => {
    if (total === 0) return;
    const parts = DICE.filter(d => counts[d]).map(d => `${counts[d]}${d}`).join(" + ");
    onRoll?.({ notation: bonus ? `${parts} + ${bonus}` : parts, mode });
    setCounts({ d4:0, d6:0, d8:0, d10:0, d12:0, d20:0 });
  };

  return (
    <div className="dice-toolbar">
      <div className="dice-buttons">
        {DICE.map(d => (
          <button key={d}
                  className={"dice-btn" + (counts[d] ? " dice-btn--active" : "")}
                  onClick={() => bump(d)} title={d}>
            <span className="dice-btn__icon">
              <img src={`../../assets/dice/${d}.png`} alt={d} />
            </span>
            {counts[d] > 0 && <span className="dice-btn__pill">{counts[d]}</span>}
          </button>
        ))}
      </div>
      <div className="dice-bonus">
        <span className="dice-bonus__label">+</span>
        <input className="dice-bonus__input" type="number" value={bonus}
               onChange={e => setBonus(parseInt(e.target.value || 0, 10))} />
      </div>
      <label className="dice-roller-toggle" title="Quem está rolando">
        <input type="checkbox"
               checked={mode === "character"}
               onChange={e => onModeChange?.(e.target.checked ? "character" : "master")} />
        <span className="dice-roller-toggle__track">
          <span className="dice-roller-toggle__thumb"></span>
        </span>
        <span className="dice-roller-toggle__label-master">Mestre</span>
        <span className="dice-roller-toggle__label-char">Personagem</span>
      </label>
      <button className="btn btn--primary btn--roll" onClick={roll}>
        <span className="btn__icon">💥</span> ROLL
      </button>
    </div>
  );
}

window.DiceToolbar = DiceToolbar;
