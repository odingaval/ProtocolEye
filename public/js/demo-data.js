// Push-the-Frontier demo SOPs + labeled sample preview data (ASCII only).

export const DEMO_SAMPLES = [
  {
    id: 'briefing',
    title: 'Cabin Safety Briefing',
    sopText: `Standard Operating Procedure: Pre-Takeoff Passenger Safety Briefing
Section 7.1 - Cabin safety demonstration (performed before every flight)
1. Welcome passengers and confirm attention: pause until the cabin is quiet, face the aisle, make eye contact with both sides.
2. Seatbelt demonstration: hold up the buckle, fasten and unfasten it visibly, pull the strap tight across the lap.
3. Emergency exits: point clearly to the front exits, then the rear exits, then the overwing exits; state the nearest exit may be behind you.
4. Oxygen masks: pull the demo mask down from above, place it over nose and mouth, state to breathe normally and secure your own mask before helping others.
5. Life vest: hold up the vest, pull the straps around the waist, fasten the buckle in front; vests are under each seat and must only be inflated outside the aircraft.
6. Brace position: demonstrate head down, arms over head or hands holding ankles, feet flat on the floor.
7. Final checks announcement: no smoking including lavatories, devices in flight mode, tray tables stowed, seatbacks upright, window shades open, hand baggage fully under the seat.`,
  },
];

export const STEP_META = {
  supported: { label: 'Supported', glyph: '✓' },
  deviation: { label: 'Deviation', glyph: '!' },
  inconclusive: { label: 'Inconclusive', glyph: '?' },
  'not-observed': { label: 'Not observed', glyph: '–' },
};

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#F5E6EA"/><rect x="60" y="60" width="840" height="480" rx="12" fill="#FFFFFF" stroke="#B8B8B0"/><rect x="120" y="120" width="300" height="360" rx="8" fill="#F9EAED"/><rect x="150" y="150" width="240" height="60" rx="4" fill="#E7B9C2"/><rect x="150" y="230" width="120" height="120" rx="60" fill="#B8B8B0"/><rect x="150" y="370" width="240" height="24" rx="4" fill="#B03A0A"/><rect x="480" y="120" width="360" height="360" rx="8" fill="#F9EAED"/><rect x="520" y="160" width="200" height="28" rx="4" fill="#E7B9C2"/><rect x="520" y="210" width="280" height="200" rx="4" fill="#FFFFFF" stroke="#B8B8B0"/><circle cx="660" cy="310" r="60" fill="none" stroke="#800020" stroke-width="10"/><line x1="660" y1="310" x2="700" y2="270" stroke="#800020" stroke-width="8"/><text x="120" y="530" font-family="sans-serif" font-size="22" fill="#5E5E58">SAMPLE EVIDENCE - not a real inspection photo</text></svg>`;

export const SAMPLE_FRAME_DATA_URL = 'data:image/svg+xml;base64,' + btoa(SAMPLE_SVG);

export const SAMPLE_DETECTIONS = [
  {
    label: 'seatbelt buckle',
    boxes: [{ id: 0, nx1: 125, ny1: 200, nx2: 438, ny2: 800 }],
  },
  {
    label: 'oxygen mask',
    boxes: [{ id: 1, nx1: 625, ny1: 417, nx2: 750, ny2: 617 }],
  },
];

export const SAMPLE_AUDIT = {
  executiveSummary: {
    status: 'Caution',
    summary: 'Sample: the seatbelt and exits were demonstrated clearly, but the oxygen mask step was skipped and the life vest is only partly visible.',
  },
  steps: [
    { index: 1, title: 'Seatbelt demonstration', requirement: 'Hold up the buckle, fasten and unfasten it visibly, pull the strap tight across the lap.', reference: 'Sec 7.1 - sample', status: 'supported', assessment: 'The buckle is held up and fastened on camera in this sample.' },
    { index: 2, title: 'Emergency exits', requirement: 'Point clearly to the front, rear, and overwing exits.', reference: 'Sec 7.1 - sample', status: 'supported', assessment: 'All three exit directions are pointed out in this sample.', notEstablished: 'Whether the overwing row was verbally briefed.' },
    { index: 3, title: 'Oxygen masks', requirement: 'Pull the demo mask down, place it over nose and mouth.', reference: 'Sec 7.1 - sample', status: 'deviation', assessment: 'No mask demonstration appears anywhere in this sample.' },
    { index: 4, title: 'Life vest', requirement: 'Hold up the vest, pull the straps around the waist, fasten the buckle in front.', reference: 'Sec 7.1 - sample', status: 'inconclusive', assessment: 'A yellow vest is partly visible but the straps and buckle cannot be judged in this sample.', notEstablished: 'Whether the buckle was fastened.' },
  ],
  reasoningTrace: 'Sample trace: each SOP step was checked against the labeled regions in the evidence frame.',
  meta: { model: 'sample-data', latencyMs: 0 },
};
