import { useMemo, useState } from "react";
import { perfumes } from "./data/perfumes";
import { buildFilterOptions } from "./utils/filterUtils";
import { notes } from "./data/notes";
import "./App.css";
import { getTierData } from "./utils/tierUtils";
import PerfumeCard from "./components/PerfumeCard";
import FilterBar from "./components/FilterBar";
import BuilderPanel from "./components/BuilderPanel";
import { buildBoxSummary } from "./utils/buildBoxSummary";
import { getPerfumeNoteIds } from "./utils/noteUtils";
import { buildCoverageSummary } from "./utils/buildCoverageSummary";
import {
  MIN_BOX_SLOTS,
  MAX_BOX_SLOTS,
  MIN_BOX_POINTS,
  BASE_DECANTS,
  POINT_VALUE,
} from "./constants/boxRules";

function App() {
  const [selectedPerfumes, setSelectedPerfumes] = useState([]);
  const [activeFilters, setActiveFilters] = useState({
    seasons: "",
    occasions: "",
    vibes: "",
  });
  const [pendingPerfume, setPendingPerfume] = useState(null);

  const totalSlots = selectedPerfumes.length;
  const totalPoints = selectedPerfumes.reduce(
    (sum, perfume) => sum + perfume.points,
    0
  );

  const estimatedValue = totalPoints * POINT_VALUE;
  const baseValue = BASE_DECANTS * POINT_VALUE;
  const upgradeValue = Math.max(0, estimatedValue - baseValue);
  const missingSlots = Math.max(0, MIN_BOX_SLOTS - totalSlots);
  const missingPoints = Math.max(0, MIN_BOX_POINTS - totalPoints);
  const isBoxReady = missingSlots === 0 && missingPoints === 0;
  const filterOptions = useMemo(() => buildFilterOptions(perfumes), []);

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
  return buildBoxSummary(selectedPerfumes, notes);
}, [selectedPerfumes]);
const coverageSummary = buildCoverageSummary(boxSummary);

  function handleFilterChange(category, value) {
    setActiveFilters((currentFilters) => ({
      ...currentFilters,
      [category]: value,
    }));
  }

  const addPerfume = (perfume) => {
  if (perfume.warningMessage) {
    setPendingPerfume(perfume);
    return;
  }

  setSelectedPerfumes((prev) => [...prev, perfume]);
};

const confirmAddPerfume = () => {
  if (!pendingPerfume) return;

  setSelectedPerfumes((prev) => [
    ...prev,
    pendingPerfume,
  ]);

  setPendingPerfume(null);
};

const cancelAddPerfume = () => {
  setPendingPerfume(null);
};

  function removePerfume(indexToRemove) {
    setSelectedPerfumes((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
  }

  function clearBox() {
    setSelectedPerfumes([]);
  }

  return (
    <>
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Decant Box Builder</p>
        <h1>Build your fragrance box</h1>
        <p>
          Select up to {MAX_BOX_SLOTS} decants, explore different moods, and see the
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
                  isDisabled={totalSlots >= MAX_BOX_SLOTS}
                />
              );
            })}
          </div>
        </section>

        <BuilderPanel
          totalSlots={totalSlots}
          maxSlots={MAX_BOX_SLOTS}
          totalPoints={totalPoints}
          estimatedValue={estimatedValue}
          upgradeValue={upgradeValue}
          selectedPerfumes={selectedPerfumes}
          boxSummary={boxSummary}
          onClearBox={clearBox}
          onRemovePerfume={removePerfume}
          minSlots={MIN_BOX_SLOTS}
          minPoints={MIN_BOX_POINTS}
          missingSlots={missingSlots}
          missingPoints={missingPoints}
          coverageSummary={coverageSummary}
          isBoxReady={isBoxReady}
        />
      </section>
    </main>
    {pendingPerfume && (
  <div className="modal-overlay">
    <div className="warning-modal">
      <h2>Rare Selection</h2>

      <h3>{pendingPerfume.name}</h3>

      <p>{pendingPerfume.warningMessage}</p>

      <p className="warning-footer">
      ☠ Proceed with caution.
      </p>

      <div className="modal-actions">
        <button onClick={confirmAddPerfume}>
          Add to Box
        </button>

        <button onClick={cancelAddPerfume}>
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </>
  );
}

export default App;