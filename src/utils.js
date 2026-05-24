export function applyTransforms(name) {
  if (/^KRH/.test(name)) return name.replace(/^KRH/, 'Fabales_Glycine_max_KRH');
  if (/^orange/.test(name)) return name.replace(/^orange/, 'Sapindales_Citrus_sinensis_orange');
  if (/^AT/.test(name)) return name.replace(/^AT/, 'Brassicales_Arabidopsis_thaliana_AT');
  if (/^PNS/.test(name)) return name.replace(/^PNS/, 'Malpighiales_Populus_trichocarpa_PNS');
  if (/^PNT/.test(name)) return name.replace(/^PNT/, 'Malpighiales_Populus_trichocarpa_PNT');
  if (/Solyc/.test(name)) return name.replace('Solyc', 'Solanales_Solanum_lycopersicum_Solyc');
  return name;
}

export function parseNewick(s) {
  const stack = [];
  let node = { name: '', length: null, children: [] };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') {
      const child = { name: '', length: null, children: [] };
      node.children.push(child);
      stack.push(node);
      node = child;
      i++;
    } else if (ch === ',') {
      const parent = stack[stack.length - 1];
      const sibling = { name: '', length: null, children: [] };
      parent.children.push(sibling);
      node = sibling;
      i++;
    } else if (ch === ')') {
      node = stack.pop();
      i++;
    } else if (ch === ':') {
      i++;
      let len = '';
      while (i < s.length && !',)('.includes(s[i]) && s[i] !== ';') len += s[i++];
      node.length = parseFloat(len);
    } else if (ch === ';') {
      break;
    } else {
      let name = '';
      while (i < s.length && !':,)('.includes(s[i]) && s[i] !== ';') name += s[i++];
      node.name = name.trim();
    }
  }
  return node;
}

export function pruneTree(node, keepSet) {
  if (!node.children || node.children.length === 0) {
    return keepSet.has(node.name) ? node : null;
  }
  const kept = node.children.map(c => pruneTree(c, keepSet)).filter(Boolean);
  if (kept.length === 0) return null;
  return { ...node, children: kept };
}

export function serializeNewick(node) {
  if (!node.children || node.children.length === 0) {
    return node.name + (node.length != null ? ':' + node.length : '');
  }
  const inner = node.children.map(serializeNewick).join(',');
  const len = node.length != null ? ':' + node.length : '';
  return `(${inner})${node.name || ''}${len}`;
}

export function parseBed(text) {
  return text.split('\n').filter(l => l.trim()).map(line => {
    const c = line.split('\t');
    return { chr: c[0], start: parseInt(c[1]), end: parseInt(c[2]), name: c[3] };
  }).filter(r => r.name);
}
