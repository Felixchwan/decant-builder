import { useMemo, useState } from "react";
import { perfumes, filterOptions } from "./data/perfumes";
import { notes } from "./data/notes";
import "./App.css";
import { getTierData } from "./utils/tierUtils";
import PerfumeCard from "./components/PerfumeCard";
import FilterBar from "./components/FilterBar";
import BuilderPanel from "./components/BuilderPanel";

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

                    <FilterBar
            filterOptions={filterOptions}
            activeFilters={activeFilters}
            handleFilterChange={handleFilterChange}
          />

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

        <BuilderPanel
          totalSlots={totalSlots}
          maxSlots={MAX_SLOTS}
          totalPoints={totalPoints}
          estimatedValue={estimatedValue}
          upgradeValue={upgradeValue}
          selectedPerfumes={selectedPerfumes}
          boxSummary={boxSummary}
          onClearBox={clearBox}
          onRemovePerfume={removePerfume}
        />
      </section>
    </main>
  );
}

export default App;