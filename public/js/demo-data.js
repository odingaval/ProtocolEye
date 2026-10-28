// Push-the-Frontier demo SOPs + labeled sample preview data (ASCII only).

export const DEMO_SAMPLES = [
  {
    id: 'loto',
    title: 'Electrical Lockout-Tagout (LOTO)',
    sopText: `Standard Operating Procedure: Electrical Panel Lockout-Tagout (LOTO)
Section 3.2 - De-energize and secure
1. Notify all affected operators before starting. Post the "Maintenance in Progress" sign.
2. Open the main disconnect switch and verify the panel indicator reads 0 Volts.
3. Apply your personal red lock to the disconnect handle. Only the person who applied the lock may remove it.
4. Attach a completed tag: name, date, reason, expected duration.
5. Test the circuit with a rated meter (try-start) to confirm zero energy.
6. PPE required within 1 meter of the open panel: hard hat, safety glasses, insulated gloves, arc-rated vest.
Section 3.3 - Release
7. Clear tools, remove tag, remove lock, close the panel, notify operators.`,
  },
  {
    id: 'cnc',
    title: 'CNC Machine Setup Check',
    sopText: `Standard Operating Procedure: CNC Mill Setup Verification
Section 5.1 - Pre-cycle checks
1. Confirm the work area is clear: no loose tools, rags, or stock on the machine bed.
2. Verify the safety enclosure door is fully closed and the interlock light is green.
3. Operator must wear safety glasses and fitted gloves; no loose sleeves or jewelry.
4. Check the coolant level sight glass reads between MIN and MAX.
5. Confirm the correct program number is loaded on the controller screen.
6. Press CYCLE START only after all checks above pass, standing clear of the enclosure.`,
  },
];

export const STEP_META = {
  supported: { label: 'Supported', glyph: '✓' },
  deviation: { label: 'Deviation', glyph: '!' },
  inconclusive: { label: 'Inconclusive', glyph: '?' },
  'not-observed': { label: 'Not observed', glyph: '–' },
};

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#F2F2EE"/><rect x="60" y="60" width="840" height="480" rx="12" fill="#FFFFFF" stroke="#B8B8B0"/><rect x="120" y="120" width="300" height="360" rx="8" fill="#E6ECF4"/><rect x="150" y="150" width="240" height="60" rx="4" fill="#D3E2F7"/><rect x="150" y="230" width="120" height="120" rx="60" fill="#B8B8B0"/><rect x="150" y="370" width="240" height="24" rx="4" fill="#B03A0A"/><rect x="480" y="120" width="360" height="360" rx="8" fill="#EFE9F7"/><rect x="520" y="160" width="200" height="28" rx="4" fill="#D5C8EC"/><rect x="520" y="210" width="280" height="200" rx="4" fill="#FFFFFF" stroke="#B8B8B0"/><circle cx="660" cy="310" r="60" fill="none" stroke="#1F5FBF" stroke-width="10"/><line x1="660" y1="310" x2="700" y2="270" stroke="#1F5FBF" stroke-width="8"/><text x="120" y="530" font-family="sans-serif" font-size="22" fill="#5E5E58">SAMPLE EVIDENCE - not a real inspection photo</text></svg>`;

export const SAMPLE_FRAME_DATA_URL = 'data:image/svg+xml;base64,' + btoa(SAMPLE_SVG);

export const SAMPLE_DETECTIONS = [
  {
    label: 'electrical panel',
    boxes: [{ id: 0, nx1: 125, ny1: 200, nx2: 438, ny2: 800 }],
  },
  {
    label: 'pressure gauge',
    boxes: [{ id: 1, nx1: 625, ny1: 417, nx2: 750, ny2: 617 }],
  },
];

export const SAMPLE_AUDIT = {
  executiveSummary: {
    status: 'Fail',
    summary: 'Sample: the panel was de-energized and posted, but no personal lock or tag is visible and PPE cannot be verified.',
  },
  steps: [
    { index: 1, title: 'Notify and post sign', requirement: 'Notify all affected operators and post the "Maintenance in Progress" sign.', reference: 'Sec 3.2 - sample', status: 'supported', assessment: 'A sign is posted at the panel and the area appears cleared in this sample.' },
    { index: 2, title: 'De-energize panel', requirement: 'Open the main disconnect switch and verify the indicator reads 0 Volts.', reference: 'Sec 3.2 - sample', status: 'supported', assessment: 'The disconnect handle is in the open position in this sample.', notEstablished: 'Meter reading digits are not legible.' },
    { index: 3, title: 'Apply personal lock', requirement: 'Apply your personal red lock to the disconnect handle.', reference: 'Sec 3.2 - sample', status: 'deviation', assessment: 'No lock is visible on the disconnect handle in this sample.' },
    { index: 4, title: 'Wear PPE', requirement: 'Hard hat, safety glasses, insulated gloves, and arc-rated vest within 1 meter.', reference: 'Sec 3.2 - sample', status: 'inconclusive', assessment: 'No worker is visible in this sample frame, so PPE cannot be judged.', notEstablished: 'Whether any worker entered the zone during the work.' },
  ],
  reasoningTrace: 'Sample trace: each SOP step was checked against the labeled regions in the evidence frame.',
  meta: { model: 'sample-data', latencyMs: 0 },
};
