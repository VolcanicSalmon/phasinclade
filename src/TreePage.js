import React, { useState, useEffect, useRef } from 'react';
import { Reactree } from 'reactreejs';
import Select from 'react-select';
import { useNavigate } from 'react-router';
import { useData } from './DataContext';

const CATEGORY_OPTIONS = [
  { value: 'rh', label: 'Potato RH' },
  { value: 'dm', label: 'Potato DM' },
  { value: 'nb', label: 'Benth HZ' }
];

export default function TreePage() {
  const { prunedNewick, rhPprData, dmPprData, nbPprData, rhTipsInTree, dmTipsInTree, loading, error } = useData();
  const [selectedCategory, setSelectedCategory] = useState('rh');
  const [selectedGene, setSelectedGene] = useState(null);
  const treeRef = useRef(null);
  const navigate = useNavigate();

  const pprData = selectedCategory === 'rh' ? rhPprData : selectedCategory === 'dm' ? dmPprData : nbPprData;
  const tipsInTree = selectedCategory === 'rh' ? rhTipsInTree : dmTipsInTree;

  const geneOptions = pprData.map(r => ({
    value: r.name,
    label: tipsInTree.has(r.name) ? `★ ${r.name}` : r.name
  }));

  useEffect(() => {
    setSelectedGene(null);
  }, [selectedCategory]);

  useEffect(() => {
    if (!prunedNewick) return;
    const timer = setTimeout(() => {
      const circBtn = Array.from(document.querySelectorAll('button')).find(b => /circ/i.test(b.textContent));
      if (circBtn) circBtn.click();
    }, 600);
    return () => clearTimeout(timer);
  }, [prunedNewick]);

  useEffect(() => {
    if (!selectedGene || !tipsInTree.has(selectedGene)) return;
    const container = treeRef.current;
    if (!container) return;
    container.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'f', code: 'KeyF', ctrlKey: true, bubbles: true, cancelable: true
    }));
    setTimeout(() => {
      const input = container.querySelector('input[type="text"], input[type="search"]');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, selectedGene);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, 150);
  }, [selectedGene, tipsInTree]);

  function handleGeneSelect(opt) {
    const gene = opt ? opt.value : null;
    setSelectedGene(gene);
    if (gene) {
      window.open(`${process.env.PUBLIC_URL}/browser?gene=${encodeURIComponent(gene)}&cat=${selectedCategory}`, '_blank');
    }
  }

  return (
    <div className="app-container">
      <div className="tree-header">
        <h2>PPR sRNA subclade</h2>
        <button className="back-btn" onClick={() => navigate('/blast')}>sRNA search</button>
        <div className="gene-select-bar">
          <Select
            value={CATEGORY_OPTIONS.find(o => o.value === selectedCategory)}
            onChange={opt => setSelectedCategory(opt.value)}
            options={CATEGORY_OPTIONS}
            isSearchable={false}
            styles={{ container: base => ({ ...base, minWidth: 150 }) }}
          />
          <label>PPR gene:</label>
          <div className="gene-select-input">
            <Select
              value={selectedGene ? { value: selectedGene, label: selectedGene } : null}
              onChange={handleGeneSelect}
              options={geneOptions}
              placeholder={loading ? 'Loading...' : `Search ${geneOptions.length} ${selectedCategory.toUpperCase()} PPR genes (★ = in tree)...`}
              isClearable
              isDisabled={loading || !geneOptions.length}
            />
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-message">Loading phylogenetic tree...</div>}

      {prunedNewick && (
        <div className="tree-container" ref={treeRef}>
          <Reactree newick={prunedNewick} defaultHeight={560} />
        </div>
      )}
    </div>
  );
}
