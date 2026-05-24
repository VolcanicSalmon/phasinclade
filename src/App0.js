import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import '@fontsource/roboto';
import './App.css';

const categoryOptions = [
  { value: 'potato_RH', label: 'Potato RH' },
  { value: 'potato_DM', label: 'Potato DM' }
];

const sizeOptions = [
  { value: '21', label: '21 nt' },
  { value: '22', label: '22 nt' },
  { value: '23', label: '23 nt' },
  { value: '24', label: '24 nt' }
];

const App = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [targetOptions, setTargetOptions] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [combData, setCombData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jbrowseUrl, setJbrowseUrl] = useState(null);

  // Reset when category or size changes
  useEffect(() => {
    setSelectedTarget(null);
    setTargetOptions([]);
    setCombData([]);
    setError(null);
    setJbrowseUrl(null);
  }, [selectedCategory, selectedSize]);

  // Load data when category and size are selected
  useEffect(() => {
    if (!selectedCategory || !selectedSize) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Determine which file to load based on category
        const fileName = selectedCategory === 'potato_RH'
          ? `comb_phasi1_vs_RH_tipdf_200up_${selectedSize}nt.txt`
          : `stu_mature_vs_DM_tipdf_200up_${selectedSize}nt.txt`;

        console.log('Fetching:', fileName);

        const response = await fetch(`/data/${fileName}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch ${fileName} (${response.status})`);
        }

        const text = await response.text();

        // Parse the data
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length <= 1) {
          setError('No data found in file');
          return;
        }

        const headers = lines[0].split(/\s+/); // Use space as delimiter

        const parsedData = lines.slice(1).map(line => {
          const values = line.split(/\s+/);
          const entry = {};
          headers.forEach((header, index) => {
            entry[header.trim()] = values[index]?.trim() || '';
          });
          return entry;
        });

        setCombData(parsedData);

        // Extract targets
        const targetMap = new Map();
        parsedData.forEach(item => {
          const target = item['Target_Acc.'];
          if (target) {
            const count = targetMap.get(target) || 0;
            targetMap.set(target, count + 1);
          }
        });

        const sortedTargets = Array.from(targetMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50);

        const targetOpts = sortedTargets.map(([target, count]) => ({
          value: target,
          label: `${target.split('::')[0]} (${count} sites)`
        }));

        setTargetOptions(targetOpts);

      } catch (error) {
        console.error('Error fetching data:', error);
        setError(`Error loading data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedCategory, selectedSize]);

  // Generate JBrowse URL when target is selected
  useEffect(() => {
    if (!selectedTarget) {
      setJbrowseUrl(null);
      return;
    }

    try {
      const [, location] = selectedTarget.split('::');
      if (!location) {
        setError('Invalid target format');
        return;
      }

      const [chr, coordinates] = location.split(':');
      if (!chr || !coordinates) {
        setError('Invalid target coordinates');
        return;
      }

      const [start, end] = coordinates.split('-').map(Number);
      if (isNaN(start) || isNaN(end)) {
        setError('Invalid coordinate values');
        return;
      }

      // Calculate padding and region
      const padding = Math.max(5000, (end - start) * 0.3);
      const regionStart = Math.max(1, start - padding);
      const regionEnd = end + padding;

      // Create URL to the standalone JBrowse instance with appropriate config
      const config = selectedCategory === 'potato_RH' ? 'jbvar/config.json' : 'jbdm/config.json';

      // Create track list based on category
      let tracks = '';
      if (selectedCategory === 'potato_RH') {
        tracks = 'gff3,phasi_cluster,sRNA_with_clusters';
      } else {
        // For DM, use the tracks from your config
        tracks = 'DM_1-3_516_R44_potato.v6.1.hc_gene_models,pare_dmst_1,pvy_dmst_1,sRNA_with_clusters_pare,sRNA_with_clusters_pvy';
      }

      const params = new URLSearchParams({
        config: config,
        loc: `${chr}:${regionStart}-${regionEnd}`,
        tracks: tracks
      });

      setJbrowseUrl(`/jbrowse/?${params.toString()}`);
      setError(null);

    } catch (error) {
      console.error('Error parsing coordinates:', error);
      setError('Error parsing target coordinates');
      setJbrowseUrl(null);
    }
  }, [selectedTarget, selectedCategory]);

  const targetInteractions = selectedTarget ?
    combData.filter(item => item['Target_Acc.'] === selectedTarget) : [];

  return (
    <div className="app-container">
      <h1>🧬 miRNA-Target Genome Browser</h1>

      {/* CONTROLS */}
      <div className="controls-grid">
        <div className="select-container">
          <label>Category:</label>
          <Select
            value={selectedCategory ? categoryOptions.find(opt => opt.value === selectedCategory) : null}
            onChange={(option) => setSelectedCategory(option ? option.value : null)}
            options={categoryOptions}
            placeholder="Select category..."
            isClearable
          />
        </div>

        <div className="select-container">
          <label>miRNA Size:</label>
          <Select
            value={selectedSize ? { value: selectedSize, label: `${selectedSize} nt` } : null}
            onChange={(option) => setSelectedSize(option ? option.value : null)}
            options={sizeOptions}
            placeholder="Select size..."
            isClearable
            isDisabled={!selectedCategory}
          />
        </div>

        <div className="select-container">
          <label>Target Gene:</label>
          <Select
            value={selectedTarget ? {
              value: selectedTarget,
              label: targetOptions.find(t => t.value === selectedTarget)?.label || selectedTarget
            } : null}
            onChange={(option) => setSelectedTarget(option ? option.value : null)}
            options={targetOptions}
            placeholder={targetOptions.length > 0 ? "Select target..." : "No targets available"}
            isClearable
            isDisabled={!selectedSize || isLoading || targetOptions.length === 0}
          />
        </div>
      </div>

      {/* STATUS MESSAGES */}
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Loading data...</div>}

      {/* STATS */}
      {combData.length > 0 && !selectedTarget && (
        <div className="stats-container">
          <p>📊 {combData.length} interactions • {selectedSize}nt miRNAs • {targetOptions.length} targets available</p>
        </div>
      )}

      {/* TARGET INFO AND JBROWSE */}
      {selectedTarget && (
        <div className="target-section">
          <div className="target-info">
            <h3>🎯 Target Gene: {selectedTarget.split('::')[0]}</h3>
            <p>
              <strong>Location:</strong> {selectedTarget.split('::')[1]} |
              <strong>Interactions:</strong> {targetInteractions.length} |
              <strong>Size filter:</strong> {selectedSize}nt miRNAs |
              <strong>Category:</strong> {selectedCategory === 'potato_RH' ? 'RH' : 'DM'}
            </p>
          </div>

          {jbrowseUrl && (
            <div className="jbrowse-container">
              <iframe
                src={jbrowseUrl}
                width="100%"
                height="700px"
                style={{
                  border: 'none',
                  borderRadius: '8px',
                  display: 'block'
                }}
                title="JBrowse2 Genome Browser"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;

