import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';

const FASTA_SOURCES = [
  { label: 'RH / baldrich 21-23nt condensed', genome: 'RH', dataset: 'baldrich_condensed', path: 'jbrowse/jbrh/srnaseq/baldrich/baldrich_leaf_condensed_rhppregion_21_23.fa' },
  { label: 'RH / baldrich 21nt', genome: 'RH', dataset: 'baldrich_21nt', path: 'jbrowse/jbrh/srnaseq/baldrich/baldrich_leaf_21nt.fa' },
  { label: 'RH / baldrich 22nt', genome: 'RH', dataset: 'baldrich_22nt', path: 'jbrowse/jbrh/srnaseq/baldrich/baldrich_leaf_22nt.fa' },
  { label: 'RH / baldrich 23nt', genome: 'RH', dataset: 'baldrich_23nt', path: 'jbrowse/jbrh/srnaseq/baldrich/baldrich_leaf_23nt.fa' },
  { label: 'RH / pare_pinfes_ctrl', genome: 'RH', dataset: 'pare_pinfes_ctrl', path: 'jbrowse/jbrh/srnaseq/pare_pinfes_ctrl.inrh/Results_21_23.fa' },
  { label: 'RH / pare_pinfes_infec', genome: 'RH', dataset: 'pare_pinfes_infec', path: 'jbrowse/jbrh/srnaseq/pare_pinfes_infec.inrh/Results_21_23.fa' },
  { label: 'DM / pare_pinfes_ctrl (PPR)', genome: 'DM', dataset: 'pare_pinfes_ctrl_ppr', path: 'jbrowse/jbdm2/srnaseq/pare_pinfes_ctrl.indm/merged_dm_in_ppr_region_21_23.fa' },
  { label: 'DM / pare_pinfes_infec (PPR)', genome: 'DM', dataset: 'pare_pinfes_infec_ppr', path: 'jbrowse/jbdm2/srnaseq/pare_pinfes_infec.indm/merged_dm_in_ppr_region_21_23.fa' },
  { label: 'DM / pare_pinfes_ctrl', genome: 'DM', dataset: 'pare_pinfes_ctrl', path: 'jbrowse/jbdm2/srnaseq/pare_pinfes_ctrl.indm/Results_21_23.fa' },
  { label: 'DM / pare_pinfes_infec', genome: 'DM', dataset: 'pare_pinfes_infec', path: 'jbrowse/jbdm2/srnaseq/pare_pinfes_infec.indm/Results_21_23.fa' },
  { label: 'DM / gruden 21nt', genome: 'DM', dataset: 'gruden_21nt', path: 'jbrowse/jbdm2/srnaseq/gruden/gruden_passdeg_21nt.dedup.fa' },
  { label: 'DM / gruden 22nt', genome: 'DM', dataset: 'gruden_22nt', path: 'jbrowse/jbdm2/srnaseq/gruden/gruden_passdeg_22nt.dedup.fa' },
  { label: 'DM / gruden 23nt', genome: 'DM', dataset: 'gruden_23nt', path: 'jbrowse/jbdm2/srnaseq/gruden/gruden_passdeg_23nt.dedup.fa' },
  { label: 'Solath mature miRNA', genome: 'Solath', dataset: 'solath_mature', path: 'data/solath_mature.fa' },
  { label: 'NB / baksa (PPR)', genome: 'NB', dataset: 'baksa_ppr', path: 'jbrowse/jbnb/srnaseq/baksa/merged_benth_in_ppr_region_21_23.fa' },
];

function normalize(seq) {
  return seq.toUpperCase().replace(/U/g, 'T').replace(/[^ACGT]/g, '');
}

function toRna(seq) {
  return seq.toUpperCase().replace(/T/g, 'U');
}

function revComp(seq) {
  const comp = { A: 'T', T: 'A', G: 'C', C: 'G' };
  return seq.split('').reverse().map(c => comp[c] || 'N').join('');
}

function parseFasta(text) {
  const entries = [];
  let name = null, seq = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('>')) {
      if (name !== null) entries.push({ name, seq });
      name = line.slice(1).trim();
      seq = '';
    } else {
      seq += line.trim();
    }
  }
  if (name !== null && seq) entries.push({ name, seq });
  return entries;
}

function bestAlignment(query, subject, maxMismatches) {
  if (subject.length > query.length) return null;
  let best = null;
  for (let i = 0; i <= query.length - subject.length; i++) {
    let mm = 0;
    for (let j = 0; j < subject.length; j++) {
      if (query[i + j] !== subject[j]) mm++;
      if (mm > maxMismatches) break;
    }
    if (mm <= maxMismatches && (!best || mm < best.mismatches)) {
      best = { mismatches: mm, queryStart: i + 1, queryEnd: i + subject.length };
    }
  }
  return best;
}

function searchQuery(querySeq, fastaEntries, maxMismatches) {
  const q = normalize(querySeq);
  const results = [];
  for (const { name, seq } of fastaEntries) {
    const s = normalize(seq);
    const fwd = bestAlignment(q, s, maxMismatches);
    if (fwd) results.push({ name, seq: s, strand: '+', ...fwd });
    const src = revComp(s);
    const rev = bestAlignment(q, src, maxMismatches);
    if (rev) results.push({ name, seq: src, strand: '-', ...rev });
  }
  return results.sort((a, b) => a.mismatches - b.mismatches);
}

function searchHeader(queryText, fastaEntries) {
  const q = queryText.toLowerCase();
  return fastaEntries
    .filter(({ name }) => name.toLowerCase().includes(q))
    .map(({ name, seq }) => ({ name, seq }));
}

export default function BlastPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState('sequence');
  const [maxMismatches, setMaxMismatches] = useState(0);
  const [autoTranscribe, setAutoTranscribe] = useState(false);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const cacheRef = useRef({});

  async function handleSearch() {
    const raw = query.trim();
    if (!raw) return;

    setSearching(true);
    setError(null);
    setResults(null);

    try {
      const allResults = [];
      for (const source of FASTA_SOURCES) {
        if (!cacheRef.current[source.path]) {
          const res = await fetch(`${process.env.PUBLIC_URL}/${source.path}`);
          if (!res.ok) throw new Error(`Failed to load ${source.label}: HTTP ${res.status}`);
          cacheRef.current[source.path] = parseFasta(await res.text());
        }
        const entries = cacheRef.current[source.path];

        if (searchMode === 'header') {
          const hits = searchHeader(raw, entries);
          hits.forEach(h => allResults.push({ ...h, ...source }));
        } else {
          const seq = raw.startsWith('>') ? raw.split('\n').slice(1).join('') : raw;
          const qNorm = normalize(seq);
          if (!qNorm) { setError('No valid sequence found (A/T/U/G/C only).'); setSearching(false); return; }
          const hits = searchQuery(qNorm, entries, maxMismatches);
          hits.forEach(h => allResults.push({ ...h, ...source }));
        }
      }
      setResults(allResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  const grouped = results
    ? FASTA_SOURCES.map(src => ({
        ...src,
        hits: results.filter(r => r.path === src.path)
      })).filter(g => g.hits.length > 0)
    : [];

  return (
    <div className="app-container">
      <div className="browser-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back to tree</button>
        <h2>sRNA sequence search</h2>
      </div>

      <div className="blast-panel">
        <div className="blast-mode-bar">
          {['sequence', 'header'].map(m => (
            <label key={m} className="slice-radio">
              <input type="radio" name="searchMode" value={m}
                checked={searchMode === m} onChange={() => { setSearchMode(m); setResults(null); }} />
              {m === 'sequence' ? 'Sequence search' : 'Header / ID search'}
            </label>
          ))}
        </div>
        <textarea
          className="blast-textarea"
          placeholder={searchMode === 'sequence'
            ? 'Paste sequence here (FASTA or plain DNA/RNA)…'
            : 'Type cluster name, coordinates, or any header text…'}
          value={query}
          onChange={e => setQuery(e.target.value)}
          rows={searchMode === 'sequence' ? 5 : 2}
        />
        <div className="blast-controls">
          {searchMode === 'sequence' && (
            <>
              <label className="blast-control-label">
                Max mismatches:
                <select value={maxMismatches} onChange={e => setMaxMismatches(Number(e.target.value))}
                  className="blast-select">
                  {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="slice-checkbox">
                <input type="checkbox" checked={autoTranscribe}
                  onChange={e => setAutoTranscribe(e.target.checked)} />
                Auto-transcription (T→U)
              </label>
            </>
          )}
          <button className="blast-btn" onClick={handleSearch} disabled={searching || !query.trim()}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {results !== null && results.length === 0 && (
        <div className="blast-no-results">No matches found across all datasets.</div>
      )}

      {grouped.map(group => (
        <div key={group.path} className="blast-result-group">
          <div className="blast-group-header">
            <span className="category-tag">{group.genome}</span> {group.label}
            <span className="blast-hit-count">{group.hits.length} hit{group.hits.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="blast-table">
            <thead>
              <tr>
                <th>Sequence ID</th>
                {searchMode === 'sequence' && <><th>Strand</th><th>Query pos.</th><th>Mismatches</th></>}
                <th>sRNA sequence</th>
              </tr>
            </thead>
            <tbody>
              {group.hits.map((hit, i) => (
                <tr key={i}>
                  <td className="blast-seqid">{hit.name}</td>
                  {searchMode === 'sequence' && (
                    <><td>{hit.strand}</td><td>{hit.queryStart}–{hit.queryEnd}</td><td>{hit.mismatches}</td></>
                  )}
                  <td className="blast-seq">{autoTranscribe ? toRna(hit.seq) : hit.seq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
