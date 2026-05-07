// Sidebar.jsx — DM Copilot left navigation
// Source: src/renderer/src/shared/sidebar/sidebar.html
const { useState } = React;

const NAV = [
  { section: "Principal", items: [
    { id: "campaigns", icon: "🏰", label: "Campanhas" },
    { id: "characters", icon: "🧙", label: "Personagens" },
    { id: "scenes",     icon: "🎭", label: "Cenas" },
    { id: "encounters", icon: "⚔️", label: "Encontros" },
  ]},
  { section: "Recursos", items: [
    { id: "spells", icon: "📜", label: "Magias" },
    { id: "items",  icon: "🎒", label: "Itens" },
    { id: "dice",   icon: "🎲", label: "Rolador" },
    { id: "journal",icon: "📝", label: "Diário" },
  ]},
  { section: "Configurações", items: [
    { id: "settings", icon: "⚙️", label: "Preferências" },
  ]},
];

function Sidebar({ active, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <img className="sidebar__logo-img" src="../../assets/logo_dm_copilot.png" alt="DM Copilot" />
          <div>
            <div className="sidebar__logo-text">DM Copilot</div>
            <div className="sidebar__logo-sub">Seu Companheiro de RPG</div>
          </div>
        </div>
      </div>
      <nav className="sidebar__nav">
        {NAV.map(group => (
          <div className="sidebar__section" key={group.section}>
            <div className="sidebar__section-title">{group.section}</div>
            {group.items.map(item => (
              <a key={item.id}
                 className={"sidebar__link" + (active === item.id ? " sidebar__link--active" : "")}
                 onClick={(e) => { e.preventDefault(); onNavigate?.(item.id); }}
                 href="#">
                <span className="sidebar__link-icon">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

window.Sidebar = Sidebar;
