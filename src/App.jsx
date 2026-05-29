import { useMemo, useState } from "react";
import { perfumes, filterOptions } from "./data/perfumes";
import { notes } from "./data/notes";
import "./App.css";

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
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

  return {
    occasions: [...new Set(allOccasions)],
    seasons: [...new Set(allSeasons)],
    notes: [...new Set(allNotes)],
    vibes: [...new Set(allVibes)],
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
            {filteredPerfumes.map((perfume) => (
              <article className="perfume-card" key={perfume.id}>
                <div className="bottle-placeholder">
                  {perfume.image ? (
                    <img src={perfume.image} alt={perfume.name} />
                  ) : (
                    <span>{perfume.brand[0]}</span>
                  )}
                </div>

                <div className="perfume-info">
                  <h3>{perfume.name}</h3>
                  <p>{perfume.brand}</p>
                </div>

                <div className="tag-row">
                  <span>{perfume.points} pt</span>
                  {(perfume.accords || []).slice(0, 3).map((accord) => (
                  <span key={accord}>{accord}</span>
                  ))}
                </div>

                <div className="hover-details">
                  <p>
                    <strong>Notes:</strong>{" "}
                    {getPerfumeNoteIds(perfume)
                      .map((noteId) => notes[noteId]?.name)
                      .join(", ")}
                  </p>
                  <p>
                    <strong>Best for:</strong> {perfume.occasions.join(", ")}
                  </p>
                </div>

                <button
                  onClick={() => addPerfume(perfume)}
                  disabled={totalSlots >= MAX_SLOTS}
                >
                  Add to box
                </button>
              </article>
            ))}
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

          <div className="summary-panel">
            <h3>Box Profile</h3>

            <div>
              <span>Occasions</span>
              <p>{boxSummary.occasions.join(", ") || "No data yet"}</p>
            </div>

            <div>
              <span>Seasons</span>
              <p>{boxSummary.seasons.join(", ") || "No data yet"}</p>
            </div>

            <div>
              <span>Notes</span>
              <p>{boxSummary.notes.join(", ") || "No data yet"}</p>
            </div>

            <div>
              <span>Vibes</span>
              <p>{boxSummary.vibes.join(", ") || "No data yet"}</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default App;
