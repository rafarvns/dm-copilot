// App.jsx — orchestrates Sidebar + view routing for the kit demo.
const { useState: useStateApp } = React;

function App() {
  const [view, setView]     = useStateApp("campaigns");
  const [active, setActive] = useStateApp("campaigns");
  const [openCampaign, setOpenCampaign] = useStateApp(null);
  const [encounterOpen, setEncounterOpen] = useStateApp(false);

  const navigate = (id) => {
    setActive(id);
    setView(id);
    setOpenCampaign(null);
  };

  return (
    <div id="app">
      <div className="app-content">
        <Sidebar active={active} onNavigate={navigate} />
        <main className="main-view">
          {view === "campaigns" && !openCampaign &&
            <CampaignsView onOpen={c => { setOpenCampaign(c); setActive("campaigns"); }} />}
          {view === "campaigns" && openCampaign &&
            <CampaignDetailView campaign={openCampaign}
                                onBack={() => setOpenCampaign(null)}
                                onOpenEncounter={() => setEncounterOpen(true)} />}
          {view === "characters" && <CharactersView />}
          {(view !== "campaigns" && view !== "characters") && (
            <div className="empty-state" style={{margin:"auto"}}>
              <div className="empty-state__icon">{
                {scenes:"🎭", encounters:"⚔️", spells:"📜", items:"🎒", dice:"🎲", journal:"📝", settings:"⚙️"}[view] || "✨"
              }</div>
              <h3 className="empty-state__title">Em breve</h3>
              <p className="empty-state__text">Esta seção ainda não está disponível neste protótipo. Volte para Campanhas ou Personagens para explorar a UI.</p>
              <button className="btn btn--primary" onClick={() => navigate("campaigns")}>
                <span className="btn__icon">⬅️</span> Voltar às Campanhas
              </button>
            </div>
          )}
        </main>
      </div>

      <div className="statusbar">
        <div className="statusbar__item">
          <span className="statusbar__dot"></span>
          <span>Conectado · Banco local</span>
        </div>
        <div className="statusbar__item">
          <span>v0.1.0 · DM Copilot</span>
        </div>
      </div>

      {encounterOpen && <EncounterView onClose={() => setEncounterOpen(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
