import { useMemo, useState } from "react";
import { perfumes, filterOptions } from "./data/perfumes";
import { notes } from "./data/notes";
import "./App.css";
import { getTierData } from "./utils/tierUtils";
import PerfumeCard from "./components/PerfumeCard";

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

const MAX_SLOTS = 16;
const BASE_DECANTS = 14;
const POINT_VALUE = 90;

function App() {
  const [selectedPerfumes, setSelectedPerfumes] = useState([]);
  const [activeFilters, setActiveFilters] = useState({
    seasons: "",
    occasions: "",
    vibes: "",
  });

  const totalSlots = selectedPerfumes.length;
  const totalPoints = selectedPerfumes.reduce(
    (sum, perfume) => sum + perfume.points,
    0
  );

  const estimatedValue = totalPoints * POINT_VALUE;
  const baseValue = BASE_DECANTS * POINT_VALUE;
  const upgradeValue = Math.max(0, estimatedValue - baseValue);

  const filteredPerfumes = useMemo(() => {
    return perfumes.filter((perfume) => {
      const matchesSeason =
        !activeFilters.seasons ||
        perfume.seasons.includes(activeFilters.seasons);

      const matchesOccasion =
        !activeFilters.occasions ||
        perfume.occasions.includes(activeFilters.occasions);

      const matchesVibe =
        !activeFilters.vibes || perfume.vibes.includes(activeFilters.vibes);

      return matchesSeason && matchesOccasion && matchesVibe;
    });
  }, [activeFilters]);

  const boxSummary = useMemo(() => {
  const allOccasions = selectedPerfumes.flatMap((p) => p.occasions || []);
  const allSeasons = selectedPerfumes.flatMap((p) => p.seasons || []);
  const allNotes = selectedPerfumes
    .flatMap((p) => getPerfumeNoteIds(p))
    .map((noteId) => notes[noteId]?.name)
    .filter(Boolean);
  const allVibes = selectedPerfumes.flatMap((p) => p.vibes || []);
  const accordMap = selectedPerfumes.reduce((map, perfume) => {
  (perfume.accords || []).forEach((accord) => {
    if (!map[accord]) {
      map[accord] = [];
    }

    map[accord].push(perfume.name);
  });

  return map;
}, {});

  return {
    occasions: [...new Set(allOccasions)],
    seasons: [...new Set(allSeasons)],
    notes: [...new Set(allNotes)],
    vibes: [...new Set(allVibes)],
    accordMap,
  };
}, [selectedPerfumes]);

  function handleFilterChange(category, value) {
    setActiveFilters((currentFilters) => ({
      ...currentFilters,
      [category]: value,
    }));
  }

  function addPerfume(perfume) {
    if (totalSlots >= MAX_SLOTS) return;

    setSelectedPerfumes((current) => [...current, perfume]);
  }

  function removePerfume(indexToRemove) {
    setSelectedPerfumes((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
  }

  function clearBox() {
    setSelectedPerfumes([]);
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Decant Box Builder</p>
        <h1>Build your fragrance box</h1>
        <p>
          Select up to {MAX_SLOTS} decants, explore different moods, and see the
          value of your box update in real time.
        </p>
      </section>

      <section className="layout">
        <section className="catalog-section">
          <div className="panel-header">
            <div>
              <h2>Catalog</h2>
              <p>{filteredPerfumes.length} perfumes available</p>
            </div>
          </div>

          <div className="filters">
            {Object.entries(filterOptions).map(([category, options]) => (
              <select
                key={category}
                value={activeFilters[category]}
                onChange={(event) =>
                  handleFilterChange(category, event.target.value)
                }
              >
                <option value="">All {category}</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ))}
          </div>

          <div className="catalog-grid">
  {filteredPerfumes.map((perfume) => {
    const tierData = getTierData(perfume.id);
    const noteNames = getPerfumeNoteIds(perfume)
      .map((noteId) => notes[noteId]?.name)
      .filter(Boolean);

    return (
      <PerfumeCard
        key={perfume.id}
        perfume={perfume}
        tierData={tierData}
        noteNames={noteNames}
        onAddToBox={addPerfume}
        isDisabled={totalSlots >= MAX_SLOTS}
      />
    );
  })}
</div>
        </section>

        <aside className="builder-panel">
          <div className="panel-header">
            <div>
              <h2>My Box</h2>
              <p>
                {totalSlots}/{MAX_SLOTS} slots used
              </p>
            </div>

            <button className="ghost-button" onClick={clearBox}>
              Clear
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span>Points</span>
              <strong>{totalPoints.toFixed(1)}</strong>
            </div>

            <div className="stat-card">
              <span>Value</span>
              <strong>${estimatedValue.toFixed(0)}</strong>
            </div>

            <div className="stat-card">
              <span>Upgrade</span>
              <strong>${upgradeValue.toFixed(0)}</strong>
            </div>
          </div>

          <div className="slot-bar">
            <div
              className="slot-progress"
              style={{ width: `${(totalSlots / MAX_SLOTS) * 100}%` }}
            />
          </div>

          <div className="selected-list">
            {selectedPerfumes.length === 0 ? (
              <p className="empty-state">Start adding perfumes to your box.</p>
            ) : (
              selectedPerfumes.map((perfume, index) => (
                <div className="selected-item" key={`${perfume.id}-${index}`}>
                  <div>
                    <strong>{perfume.name}</strong>
                    <span>
                      {perfume.brand} · {perfume.points} pt
                    </span>
                  </div>

                  <button onClick={() => removePerfume(index)}>Remove</button>
                </div>
              ))
            )}
          </div>

  <h3>Box Profile</h3>

  <div>
    <span>Occasions</span>
    <div className="summary-tags">
      {boxSummary.occasions.length > 0 ? (
        boxSummary.occasions.map((item) => <span key={item}>{item}</span>)
      ) : (
        <p>No data yet</p>
      )}
    </div>
  </div>

  <div>
    <span>Seasons</span>
    <div className="summary-tags">
      {boxSummary.seasons.length > 0 ? (
        boxSummary.seasons.map((item) => <span key={item}>{item}</span>)
      ) : (
        <p>No data yet</p>
      )}
    </div>
  </div>

  <div>
    <span>Vibes</span>
    <div className="summary-tags">
      {boxSummary.vibes.length > 0 ? (
        boxSummary.vibes.map((item) => <span key={item}>{item}</span>)
      ) : (
        <p>No data yet</p>
      )}
    </div>
  </div>

<div>
  <span>Scent Palette</span>

  <div className="summary-tags">
    {Object.entries(boxSummary.accordMap).length > 0 ? (
      Object.entries(boxSummary.accordMap).map(([accord, perfumeNames]) => (
        <span className="accord-tooltip" key={accord}>
          {accord} ×{perfumeNames.length}

          <div className="tooltip-box">
            <strong>{accord}</strong>
            {perfumeNames.map((name) => (
              <p key={name}>{name}</p>
            ))}
          </div>
        </span>
      ))
    ) : (
      <p>No data yet</p>
    )}
  </div>
</div>

  <div>
    <span>Notes</span>
    <p>
      {boxSummary.notes.length > 0
        ? `${boxSummary.notes.length} unique notes covered`
        : "No data yet"}
    </p>
  </div>
        </aside>
      </section>
    </main>
  );
}

export default App;
