import React, { createContext, useContext, useState, useEffect } from 'react';
import { applyTransforms, parseNewick, pruneTree, serializeNewick, parseBed } from './utils';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [prunedNewick, setPrunedNewick] = useState('');
  const [rhPprData, setRhPprData] = useState([]);
  const [dmPprData, setDmPprData] = useState([]);
  const [nbPprData, setNbPprData] = useState([]);
  const [rhTipsInTree, setRhTipsInTree] = useState(new Set());
  const [dmTipsInTree, setDmTipsInTree] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [nwkRes, rhBedRes, dmBedRes, nbBedRes, cladeRes] = await Promise.all([
          fetch(`${process.env.PUBLIC_URL}/data/pfatrerhodm_2305.nwk`),
          fetch(`${process.env.PUBLIC_URL}/jbrowse/jbrh/RH_PPR_transcript_regions.bed`),
          fetch(`${process.env.PUBLIC_URL}/jbrowse/jbdm2/DM_PPR_transcript_regions.bed`),
          fetch(`${process.env.PUBLIC_URL}/jbrowse/jbnb/NbeHZ1_ppr_transcript_regions.bed`),
          fetch(`${process.env.PUBLIC_URL}/data/itol_clade_renamed.txt`)
        ]);
        if (!nwkRes.ok) throw new Error(`Newick: HTTP ${nwkRes.status}`);
        if (!rhBedRes.ok) throw new Error(`RH BED: HTTP ${rhBedRes.status}`);
        if (!dmBedRes.ok) throw new Error(`DM BED: HTTP ${dmBedRes.status}`);
        if (!nbBedRes.ok) throw new Error(`NB BED: HTTP ${nbBedRes.status}`);
        if (!cladeRes.ok) throw new Error(`Richclade: HTTP ${cladeRes.status}`);

        const [nwkText, rhBedText, dmBedText, nbBedText, cladeText] = await Promise.all([
          nwkRes.text(), rhBedRes.text(), dmBedRes.text(), nbBedRes.text(), cladeRes.text()
        ]);

        const keepSet = new Set(
          cladeText.split('\n').map(l => l.trim()).filter(Boolean).map(applyTransforms)
        );
        const tree = parseNewick(nwkText.trim());
        const pruned = pruneTree(tree, keepSet);
        if (!pruned) throw new Error('Pruning removed all tips — check richclade names match tree');
        const newickStr = serializeNewick(pruned) + ';';
        setPrunedNewick(newickStr);

        const rhRows = parseBed(rhBedText);
        setRhPprData(rhRows);
        setRhTipsInTree(new Set(
          rhRows.filter(r => newickStr.includes(`tuberosumRH_${r.name}`)).map(r => r.name)
        ));

        const dmRows = parseBed(dmBedText);
        setDmPprData(dmRows);
        setDmTipsInTree(new Set(
          dmRows.filter(r => newickStr.includes(`tuberosumDM_${r.name}`)).map(r => r.name)
        ));

        const nbRows = parseBed(nbBedText);
        setNbPprData(nbRows);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  return (
    <DataContext.Provider value={{
      prunedNewick, rhPprData, dmPprData, nbPprData, rhTipsInTree, dmTipsInTree, loading, error
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
