import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useData } from './DataContext';

export default function BrowserPage() {
  const { rhPprData, dmPprData, nbPprData, loading } = useData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const gene = searchParams.get('gene');
  const category = searchParams.get('cat') || 'rh';
  const pprData = category === 'rh' ? rhPprData : category === 'dm' ? dmPprData : nbPprData;

  const [sliceDatasets, setSliceDatasets] = useState({
    mir: false, baldrich: true, gruden: true, pare_pinfes_ctrl: false, pare_pinfes_infec: false
  });
  const [dmSliceDatasets, setDmSliceDatasets] = useState({
    mir: false, gruden: true, pare_pinfes_ctrl: false, pare_pinfes_infec: false
  });
  const [nbSliceDatasets, setNbSliceDatasets] = useState({
    baksa: true
  });
  const [jbrowseUrl, setJbrowseUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gene || loading) return;
    const ppr = pprData.find(r => r.name === gene);
    if (!ppr) {
      setError(`No coordinates for ${gene}`);
      setJbrowseUrl(null);
      return;
    }
    setError(null);
    const padding = Math.max(2000, Math.round((ppr.end - ppr.start) * 0.2));
    const regionStart = Math.max(1, ppr.start + 1 - padding);
    const regionEnd = ppr.end + padding;

    let config, tracks;
    if (category === 'rh') {
      const sliceTracks = [
        ...(sliceDatasets.mir ? ['slice_mir'] : []),
        ...(sliceDatasets.baldrich ? ['slice_baldrich'] : []),
        ...(sliceDatasets.gruden ? ['slice_gruden'] : []),
        ...['pare_pinfes_ctrl', 'pare_pinfes_infec'].filter(d => sliceDatasets[d]).map(d => `slice_${d}`)
      ];
      config = 'jbrh/config.json';
      tracks = ['RH_gene_models', 'ppr_transcript_regions', 'baldrich_condensed_sRNA', ...sliceTracks].join(',');
    } else if (category === 'nb') {
      const nbSliceTracks = [
        ...(nbSliceDatasets.baksa ? ['NB_slice_baksa'] : [])
      ];
      config = 'jbnb/config.json';
      tracks = ['NB_gene_models', 'NB_ppr_transcript_regions', 'NB_baksa', ...nbSliceTracks].join(',');
    } else {
      const dmSliceTracks = [
        ...(dmSliceDatasets.mir ? ['DM_slice_mir'] : []),
        ...(dmSliceDatasets.gruden ? ['DM_slice_gruden'] : []),
        ...(dmSliceDatasets.pare_pinfes_ctrl ? ['DM_slice_pare_pinfes_ctrl'] : []),
        ...(dmSliceDatasets.pare_pinfes_infec ? ['DM_slice_pare_pinfes_infec'] : [])
      ];
      config = 'jbdm2/config.json';
      tracks = ['DM_gene_models', 'DM_ppr_transcript_regions', 'DM_gruden', 'DM_pare_pinfes_ctrl', 'DM_pare_pinfes_infec', ...dmSliceTracks].join(',');
    }

    const params = new URLSearchParams({ config, loc: `${ppr.chr}:${regionStart}-${regionEnd}`, tracks });
    const base = process.env.NODE_ENV === 'development' ? '' : process.env.PUBLIC_URL;
    setJbrowseUrl(`${base}/jbrowse/?${params.toString()}`);
  }, [gene, pprData, category, sliceDatasets, dmSliceDatasets, nbSliceDatasets, loading]);

  return (
    <div className="app-container">
      <div className="browser-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back to tree</button>
        <h2>{gene} <span className="category-tag">{category.toUpperCase()}</span></h2>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-message">Loading data...</div>}

      {gene && category === 'rh' && (
        <div className="slice-panel">
          <span className="slice-panel-title">Slice tracks</span>
          <div className="slice-group">
            <span className="slice-group-label">Dataset:</span>
            {['mir', 'baldrich', 'gruden', 'pare_pinfes_ctrl', 'pare_pinfes_infec'].map(d => (
              <label key={d} className="slice-checkbox">
                <input type="checkbox" checked={sliceDatasets[d]}
                  onChange={e => setSliceDatasets(prev => ({ ...prev, [d]: e.target.checked }))} />
                {d}
              </label>
            ))}
          </div>
        </div>
      )}

      {gene && category === 'dm' && (
        <div className="slice-panel">
          <span className="slice-panel-title">Slice tracks</span>
          <div className="slice-group">
            <span className="slice-group-label">Dataset:</span>
            {['mir', 'gruden', 'pare_pinfes_ctrl', 'pare_pinfes_infec'].map(d => (
              <label key={d} className="slice-checkbox">
                <input type="checkbox" checked={dmSliceDatasets[d]}
                  onChange={e => setDmSliceDatasets(prev => ({ ...prev, [d]: e.target.checked }))} />
                {d}
              </label>
            ))}
          </div>
        </div>
      )}

      {gene && category === 'nb' && (
        <div className="slice-panel">
          <span className="slice-panel-title">Slice tracks</span>
          <div className="slice-group">
            <span className="slice-group-label">Dataset:</span>
            {['baksa'].map(d => (
              <label key={d} className="slice-checkbox">
                <input type="checkbox" checked={nbSliceDatasets[d]}
                  onChange={e => setNbSliceDatasets(prev => ({ ...prev, [d]: e.target.checked }))} />
                {d}
              </label>
            ))}
          </div>
        </div>
      )}

      {jbrowseUrl && (
        <div className="jbrowse-container">
          <iframe src={jbrowseUrl} width="100%" height="700px"
            style={{ border: 'none', borderRadius: '8px', display: 'block' }}
            title="JBrowse2 Genome Browser" />
        </div>
      )}
    </div>
  );
}
