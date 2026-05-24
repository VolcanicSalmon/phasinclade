import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import '@fontsource/roboto';
import './App.css';

const categoryOptions = [
  { value: 'potato_RH', label: 'Potato RH' },
  { value: 'potato_DM', label: 'Potato DM' },
  { value: 'tomato_ITAG', label: 'Tomato ITAG' }
];

// Size options vary by category
const getSizeOptions = (category) => {
  if (category === 'tomato_ITAG') {
    return [
      { value: '21', label: '21 nt' },
      { value: '22', label: '22 nt' }
    ];
  }
  return [
    { value: '21', label: '21 nt' },
    { value: '22', label: '22 nt' },
    { value: '23', label: '23 nt' },
    { value: '24', label: '24 nt' }
  ];
};

const App = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [targetOptions, setTargetOptions] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [combData, setCombData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jbrowseUrl, setJbrowseUrl] = useState(null);
  const [sizeOptions, setSizeOptions] = useState([]);
  const [debugInfo, setDebugInfo] = useState("");

  // Update size options when category changes
  useEffect(() => {
    if (selectedCategory) {
      setSizeOptions(getSizeOptions(selectedCategory));
      setSelectedSize(null); // Reset size when category changes
    }
  }, [selectedCategory]);

  // Reset when category or size changes
  useEffect(() => {
    setSelectedTarget(null);
    setTargetOptions([]);
    setCombData([]);
    setError(null);
    setJbrowseUrl(null);
    setDebugInfo("");
  }, [selectedCategory, selectedSize]);

  // Load data when category and size are selected
  useEffect(() => {
    if (!selectedCategory || !selectedSize) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setDebugInfo(`Fetching data for ${selectedCategory} ${selectedSize}nt...`);

        
        let fileName = '';
        if (selectedCategory === 'potato_RH') {
          fileName = `comb_phasi1_vs_RH_tipdf_200up_${selectedSize}nt.txt`;
        } else if (selectedCategory === 'potato_DM') {
          fileName = `stu_mature_vs_DM_tipdf_200up_${selectedSize}nt.txt`;
        } else { // tomato_ITAG
          fileName = `sly_mature_vs_ITAG_tipdf_${selectedSize}nt.txt`;
        }

        setDebugInfo(prev => prev + `\nFetching file: ${fileName}`);

        const response = await fetch(`/data/${fileName}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch ${fileName} (${response.status}): ${errorText.substring(0, 100)}...`);
        }

        const text = await response.text();
        setDebugInfo(prev => prev + "\nFile loaded successfully");

        // Parse the data
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length <= 1) {
          setError('No data found in file');
          setDebugInfo(prev => prev + "\nWarning: File has only header or is empty");
          return;
        }

        const headers = lines[0].split(/\s+/); // Use space as delimiter
        setDebugInfo(prev => prev + `\nHeaders found: ${headers.join(', ')}`);

        // Check if Target_Acc. is in the headers
        if (!headers.includes('Target_Acc.')) {
          setError('Target_Acc. column not found in the file');
          setDebugInfo(prev => prev + "\nError: Target_Acc. column not found");
          return;
        }

        const parsedData = lines.slice(1).map(line => {
          const values = line.split(/\s+/);
          const entry = {};
          headers.forEach((header, index) => {
            entry[header.trim()] = values[index]?.trim() || '';
          });
          return entry;
        });

        setCombData(parsedData);
        setDebugInfo(prev => prev + `\nParsed ${parsedData.length} data entries`);

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

        setDebugInfo(prev => prev + `\nFound ${sortedTargets.length} unique targets`);

        if (sortedTargets.length > 0) {
          setDebugInfo(prev => prev + `\nSample targets: ${sortedTargets.slice(0, 3).map(t => t[0]).join(', ')}`);
        }

        const targetOpts = sortedTargets.map(([target, count]) => ({
          value: target,
          label: `${target} (${count} sites)`
        }));

        setTargetOptions(targetOpts);

        if (sortedTargets.length === 0) {
          setError("No target genes found in the data files. Please check the file format.");
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        setError(`Error loading data: ${error.message}`);
        setDebugInfo(prev => prev + `\nError: ${error.message}`);
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
      setDebugInfo(prev => prev + `\nCreating JBrowse view for target: ${selectedTarget}`);

      // Parse the target location based on category
      let chr, coordinates, location;

      if (selectedCategory === 'tomato_ITAG') {
        // ITAG format: Solyc06g007740.1.1
        // We need to extract chromosome and coordinates from the target
        // Assuming the format is Solyc{chr}g{position}.{version}
        // For example: Solyc06g007740.1.1 would be chromosome 06

        // Extract chromosome number from the target (Solyc06g007740.1.1 -> chr06)
        const chrMatch = selectedTarget.match(/Solyc(\d+)g/);
        if (!chrMatch) {
          setError('Invalid target format for ITAG: cannot extract chromosome');
          setDebugInfo(prev => prev + "\nError: Cannot extract chromosome from ITAG target");
          return;
        }

        chr = `chr${chrMatch[1]}`; // Convert to chr06 format

        // For ITAG, we need to get the coordinates from the data
        // Find the entry in combData that matches the selected target
        const targetEntry = combData.find(item => item['Target_Acc.'] === selectedTarget);
        if (!targetEntry) {
          setError('Cannot find coordinates for selected target');
          setDebugInfo(prev => prev + "\nError: Cannot find coordinates for selected target");
          return;
        }

        // Get coordinates from the Target_start and Target_end columns
        const start = parseInt(targetEntry['Target_start']);
        const end = parseInt(targetEntry['Target_end']);

        if (isNaN(start) || isNaN(end)) {
          setError('Invalid coordinate values in target data');
          setDebugInfo(prev => prev + "\nError: Invalid coordinate values in target data");
          return;
        }

        coordinates = `${start}-${end}`;
      } else {
        // RH and DM format: RHC06H2G0388.2::chr6_2:6584209-6586179 or Soltu.DM.06G002340.1::chr06:2770084-2775265
        const parts = selectedTarget.split('::');
        if (parts.length < 2) {
          setError(`Invalid target format for ${selectedCategory}`);
          setDebugInfo(prev => prev + `\nError: Invalid target format for ${selectedCategory}`);
          return;
        }
        location = parts[1];
        [chr, coordinates] = location.split(':');
      }

      if (!chr || !coordinates) {
        setError('Invalid target coordinates');
        setDebugInfo(prev => prev + "\nError: Invalid target coordinates");
        return;
      }

      // For RH and DM, we already have coordinates in the format start-end
      // For ITAG, we've already set coordinates to start-end
      const [start, end] = coordinates.split('-').map(Number);
      if (isNaN(start) || isNaN(end)) {
        setError('Invalid coordinate values');
        setDebugInfo(prev => prev + "\nError: Invalid coordinate values");
        return;
      }

      // Calculate padding and region
      const padding = Math.max(5000, (end - start) * 0.3);
      const regionStart = Math.max(1, start - padding);
      const regionEnd = end + padding;

      // Create URL to the standalone JBrowse instance with appropriate config
      let config = '';
      let tracks = '';

      if (selectedCategory === 'potato_RH') {
        config = 'jbvar/config.json';
        tracks = 'gff3,phasi_cluster,sRNA_with_clusters';
      } else if (selectedCategory === 'potato_DM') {
        config = 'jbdm/config.json';
        tracks = 'DM_1-3_516_R44_potato.v6.1.hc_gene_models,pare_dmst_1,pvy_dmst_1,sRNA_with_clusters_pare,sRNA_with_clusters_pvy';
      } else { // tomato_ITAG
        config = 'jbly/config.json';
        // Update these to match your actual ITAG track names
        tracks = 'ITAG_gene_models,ITAG_phasi_clusters,ITAG_sRNA_clusters';
      }

      const params = new URLSearchParams({
        config: config,
        loc: `${chr}:${regionStart}-${regionEnd}`,
        tracks: tracks
      });

      setJbrowseUrl(`/jbrowse/?${params.toString()}`);
      setError(null);
      setDebugInfo(prev => prev + `\nJBrowse URL created with config: ${config}, location: ${chr}:${regionStart}-${regionEnd}`);

    } catch (error) {
      console.error('Error parsing coordinates:', error);
      setError(`Error parsing target coordinates: ${error.message}`);
      setJbrowseUrl(null);
      setDebugInfo(prev => prev + `\nError creating JBrowse URL: ${error.message}`);
    }
  }, [selectedTarget, selectedCategory, combData]);

  const targetInteractions = selectedTarget ?
    combData.filter(item => item['Target_Acc.'] === selectedTarget) : [];

  // Get the category label for display
  const getCategoryLabel = (value) => {
    const option = categoryOptions.find(opt => opt.value === value);
    return option ? option.label : value;
  };

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
            isDisabled={!selectedCategory || sizeOptions.length === 0}
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

      {/* DEBUG INFO */}
      {debugInfo && (
        <div className="debug-info">
          <h3>Debug Information:</h3>
          <pre>{debugInfo}</pre>
        </div>
      )}

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
            <h3>🎯 Target Gene: {selectedTarget}</h3>
            <p>
              <strong>Category:</strong> {getCategoryLabel(selectedCategory)} |
              <strong>Size filter:</strong> {selectedSize}nt miRNAs
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

