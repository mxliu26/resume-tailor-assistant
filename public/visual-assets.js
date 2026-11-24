// Decorative presentation assets. No external resources or application state.
const paths = Object.freeze({
  document: '<path d="M14 3H6a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5V8.5L14 3Z"/><path d="M14 3v5.5h5.5M8 12h8M8 16h6"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a25 25 0 0 0 18 0"/><rect x="10" y="11" width="4" height="4" rx="1"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-12Z"/><path d="M3 10h18"/>',
  bookmark: '<path d="M7 3.5h10A1.5 1.5 0 0 1 18.5 5v16L12 17l-6.5 4V5A1.5 1.5 0 0 1 7 3.5Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  tasks: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h6"/>',
  settings: '<path d="m9.5 4 .6-2h3.8l.6 2 1.8 1 2.1-.5 1.9 3.3-1.5 1.5v2.1l1.5 1.5-1.9 3.3-2.1-.5-1.8 1-.6 2h-3.8l-.6-2-1.8-1-2.1.5-1.9-3.3 1.5-1.5V9.3L3.8 7.8l1.9-3.3 2.1.5 1.7-1Z" transform="translate(0 1.6)"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  edit: '<path d="m4 20 1-5L16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 2ZM14 6l4 4M4 20l4-2"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  save: '<path d="M5 3h12l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 3v6h9V3M7 21v-8h10v8M13 3v3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'
});

const escapeAttribute = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

/** Inherit foreground color so controls retain their hover/focus/disabled states. */
export function icon(name, cls = '') {
  const body = Object.hasOwn(paths, name) ? paths[name] : paths.document;
  return `<svg class="ui-icon${cls ? ` ${escapeAttribute(cls)}` : ''}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** Small stationery vignette: paper, pencils and books; intentionally no text. */
export function deskIllustration() {
  return `<svg class="desk-illustration" viewBox="0 0 300 130" width="300" height="130" fill="none" stroke="var(--illustration-ink,#AC8C6E)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="m20 28 8 4m4-24 10 14M53 7l1 11" stroke="#E7A86E" stroke-width="2"/>
    <g transform="rotate(-12 93 93)">
      <rect x="48" y="57" width="85" height="65" rx="3" fill="#F5EADF"/>
      <path d="M60 72h46M60 82h58M60 92h43M60 102h52" stroke="#D5B99F"/>
    </g>
    <g transform="rotate(-10 107 63)">
      <rect x="65" y="9" width="94" height="112" rx="3" fill="#FFFDFC"/>
      <circle cx="86" cy="32" r="6"/>
      <path d="M76 51c0-8 4-12 10-12s10 4 10 12H76Z"/>
      <path d="M108 29h34M108 40h29M76 65h67M76 77h58M76 89h67M76 101h49" stroke="#CFAB8C"/>
    </g>
    <g>
      <path d="m184 74-4-40c-.5-4 5-5 5-1l6 41" fill="#F7E7CD"/>
      <path d="m188 76 6-53c.5-5 6-4 5 1l-5 52" fill="#E7A86E"/>
      <path d="m198 76 13-48c1-4 6-2 5 2l-12 46" fill="#D9E1CD"/>
      <path d="M178 65h34l-4 56h-26l-4-56Z" fill="#A7B399"/>
      <path d="M184 71h22" stroke="#DDE3D4"/>
    </g>
    <g>
      <path d="M228 80h45c-3 4-3 9 0 13h-45a6.5 6.5 0 0 1 0-13Z" fill="#FBF0E1"/>
      <path d="M230 84h37M230 89h35" stroke="#DCC5AB"/>
      <path d="M222 94h62c-3 5-3 10 0 15h-62a7.5 7.5 0 0 1 0-15Z" fill="#FFFDFC"/>
      <path d="M224 99h53M224 104h51" stroke="#DCC5AB"/>
      <path d="M228 110h63v11h-63a5.5 5.5 0 0 1 0-11Z" fill="#E9D4BA"/>
      <path d="M232 115h52" stroke="#FFFDFC"/>
    </g>
    <path d="M42 124h251" stroke="#E1D4C5"/>
  </svg>`;
}

/** Quiet goal marker, placed once at the foot of the sidebar. */
export function goalIllustration() {
  return `<svg class="goal-illustration" viewBox="0 0 70 60" width="70" height="60" fill="none" stroke="var(--illustration-ink,#AC8C6E)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="m8 52 22-29 25 29H8Z" fill="#E4E8DC"/>
    <path d="m22 34 8-11 9 11-5-2-4 4-4-5-4 3Z" fill="#FFFDFC"/>
    <path d="M30 23V7"/>
    <path d="m31 7 20 6-20 7V7Z" fill="#E7A86E" stroke="#E7A86E"/>
    <path d="M5 53h54" stroke="#D5C4B0"/>
  </svg>`;
}
